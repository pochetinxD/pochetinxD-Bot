// ============================================
// index.js — Bot de WhatsApp con Baileys + antispam
//
// Uso:
//   npm install
//   npm start
//   Escanea el QR con WhatsApp > Dispositivos vinculados,
//   o pon USE_PAIRING_CODE=true en .env y usa el código de 8
//   caracteres que imprime la terminal (sin QR).
//
// NO uses tu número principal si te da miedo el ban.
// Baileys es NO oficial: el antispam ayuda, pero no te hace inmune.
// ============================================

require('dotenv').config();

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const config = require('./config');
const { revisarMensaje, extraerTexto, delayHumano } = require('./src/antispam');
const { procesarComando } = require('./src/commands');
// Módulos locales: XP, AFK y antilink (todo en data/, sin APIs).
const nivelMod = require('./src/level');
const afkMod = require('./src/afk');
const { esAntilinkActivo, tieneLink } = require('./src/group');
const { obtenerMetaGrupo, mismaIdentidad, buscarParticipante } = require('./src/groupmeta');
const { flushAll } = require('./src/store');
const { pairingHabilitado, telefonoPairing, pedirCodigo } = require('./src/pairing');

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' }); // LOG_LEVEL=warn en .env para diagnosticar

// ---- Reconexión progresiva (exponential backoff) ----
// Estado compartido: cuántos reintentos llevamos seguidos y si
// ya hay un reintento programado. Sin esto, un cierre podía
// programar varios conectar() a la vez (conexiones duplicadas)
// y reintentar para siempre sin tope.
let intentosRecon = 0;
let temporizadorRecon = null;
let sockActual = null;

function retrasoRecon(intento) {
  const base = config.RECONNECT_BASE_MS || config.RECONNECT_DELAY_MS || 5000;
  const max = config.RECONNECT_MAX_MS || 300000;
  return Math.min(max, base * Math.pow(2, intento));
}

// Programa UN reintento (si no hay ya uno) o se rinde al llegar
// al tope. Devuelve true si programó un reintento.
function agendarReconexion(motivo) {
  if (temporizadorRecon) return true; // ya hay uno en camino, no duplicar
  if (intentosRecon >= (config.RECONNECT_MAX_ATTEMPTS || 10)) {
    console.log(`🛑 Ya intenté reconectar ${intentosRecon} veces (${motivo}). Me rindo: salgo con error para que iniciar.bat o pm2 me relance.`);
    try { flushAll(); } catch { /* mejor esfuerzo */ }
    // Salir con código 1 (no 0): así el .bat / pm2 sabe que se cayó
    // y lo vuelve a arrancar. Sin esto, el proceso se quedaba vivo
    // sin hacer nada y nadie lo relanzaba.
    setTimeout(() => process.exit(1), 1000);
    return false;
  }
  const espera = retrasoRecon(intentosRecon);
  intentosRecon += 1;
  console.log(`🔄 Reintentando en ${Math.round(espera / 1000)}s (intento ${intentosRecon}/${config.RECONNECT_MAX_ATTEMPTS || 10}, ${motivo})...`);
  temporizadorRecon = setTimeout(() => {
    temporizadorRecon = null;
    conectar().catch((err) => {
      console.error('💥 Falló la reconexión:', err.message);
      agendarReconexion('error al reconectar');
    });
  }, espera);
  if (temporizadorRecon.unref) temporizadorRecon.unref();
  return true;
}

async function conectar() {
  let state;
  let version;
  let saveCreds;
  try {
    ({ state, saveCreds } = await useMultiFileAuthState(config.AUTH_DIR));
    ({ version } = await fetchLatestBaileysVersion());
  } catch (err) {
    // Sin red o sin sesión legible: no crashear, reintentar con backoff.
    console.error('💥 No pude preparar la conexión:', err.message);
    agendarReconexion('error de inicio');
    return null;
  }

  // El número del dueño nunca se imprime completo en los logs.
  const duenoLog = (() => {
    const n = String(config.OWNER_NUMBER || '');
    return n.length > 4 ? `${n.slice(0, 4)}****${n.slice(-2)}` : '****';
  })();
  console.log(`\n🤖 ${config.BOT_NAME} — iniciando...`);
  console.log(`   Baileys v${version.join('.')} | Prefijo: ${config.PREFIX}`);
  console.log(`   Dueño: ${duenoLog} (cámbialo en config.js / .env si no es ese)`);
  console.log(`   Login: ${pairingHabilitado(config) ? 'código de emparejamiento' : 'QR'}`);
  console.log(`   Antispam: ${config.MAX_MSG_PER_MIN}/min, ${config.MAX_FORWARDED_PER_HOUR} reenviados/hora\n`);

  // Cierra el socket anterior (si quedó vivo) para no tener dos
  // conexiones peleando por la misma sesión.
  if (sockActual) {
    try { sockActual.ev.removeAllListeners(); sockActual.end(undefined); } catch { /* mejor esfuerzo */ }
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    // No mandes "en línea" todo el rato ni leas todo al instante:
    // eso también es señal de bot.
    markOnlineOnConnect: false,
    // No sincronizar historial completo al conectar.
    syncFullHistory: false,
  });
  sockActual = sock;

  sock.ev.on('creds.update', saveCreds);

  // ---- Login con código (sin QR) ----
  // El código se pide UNA vez por socket, cuando llega el primer
  // evento `qr` (el servidor ya aceptó la conexión). Pedirlo justo
  // después de makeWASocket falla con "Connection Closed" porque el
  // websocket todavía no abre.
  let codigoPedido = false;
  const usarPairing = pairingHabilitado(config) && !state.creds.registered;

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      if (usarPairing && !codigoPedido) {
        codigoPedido = true;
        const telefono = telefonoPairing(config);
        if (!telefono) {
          console.log('⚠️ USE_PAIRING_CODE=true pero no hay número válido (PAIRING_PHONE u OWNER_NUMBER). Uso QR.');
        } else {
          pedirCodigo(sock, telefono).then((codigo) => {
            const telLog = `${telefono.slice(0, 4)}****${telefono.slice(-2)}`;
            console.log(`\n🔢 Código de emparejamiento para ${telLog}: ${codigo}`);
            console.log('   WhatsApp > Dispositivos vinculados > Vincular un dispositivo > Vincular con número de teléfono');
            console.log('   Tienes ~1 minuto. NO cierres el bot hasta que diga "Conectado".\n');
          }).catch((err) => {
            console.error('⚠️ No pude pedir el código:', err.message, '— uso QR.');
            qrcode.generate(qr, { small: true });
          });
        }
      } else if (!usarPairing) {
        console.log('📱 Escanea este QR con WhatsApp > Dispositivos vinculados:');
        qrcode.generate(qr, { small: true });
      }
      // Con pairing activo, los QR siguientes se ignoran a propósito.
    }

    if (connection === 'open') {
      // Conexión buena: el contador de reintentos vuelve a cero.
      intentosRecon = 0;
      if (temporizadorRecon) { clearTimeout(temporizadorRecon); temporizadorRecon = null; }
      console.log('✅ Conectado a WhatsApp. El bot ya está vivo.');
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(`❌ Conexión cerrada (código ${code}).`);

      // Cierres que EXIGEN volver a autenticar: no reintentar,
      // reintentar solo pelearía con la sesión o entraría en bucle.
      if (code === DisconnectReason.loggedOut) {
        console.log('🔑 Sesión cerrada. Borra la carpeta ./auth_info y vuelve a conectar (QR o código, según USE_PAIRING_CODE).');
        return;
      }
      if (code === DisconnectReason.badSession) {
        console.log('🔑 Sesión inválida (badSession). Borra ./auth_info y conecta de nuevo (QR o código).');
        return;
      }
      if (code === DisconnectReason.connectionReplaced) {
        console.log('🔑 Otra sesión tomó tu lugar (abriste WhatsApp en otro lado). No reconecto para no pelear con ella.');
        return;
      }
      // restartRequired (515): el servidor pide reiniciar, reintento corto.
      if (code === DisconnectReason.restartRequired) {
        console.log('🔄 El servidor pidió reiniciar la conexión.');
        agendarReconexion('restartRequired');
        return;
      }
      // El resto (428, 515 genérico, 408 timeout, pérdida de red):
      // temporales, reintentar con backoff.
      agendarReconexion(`código ${code}`);
    }
  });

  // ---- Mensajes entrantes ----
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        // Ignorar mensajes propios y de estado / broadcast.
        if (msg.key.fromMe) continue;
        if (msg.key.remoteJid === 'status@broadcast') continue;
        if (!msg.message) continue;

        const jid = msg.key.remoteJid;
        const isGroup = jid.endsWith('@g.us');
        if (isGroup && config.IGNORE_GROUPS) continue;

        // El que manda puede venir en @lid: Baileys trae el número de
        // teléfono en msg.key.participantPn (grupos) / senderPn
        // (privado). Si viene, se usa ese; si no, el ID tal cual.
        const sender = msg.key.participantPn || msg.key.senderPn || msg.key.participant || jid;
        const numeroSender = sender.split('@')[0].split(':')[0];
        // mismaIdentidad compara @lid y @s.whatsapp.net (ver groupmeta.js):
        // si el dueño manda en @lid, igual se le reconoce.
        const esDueno = mismaIdentidad(sender, config.OWNER_NUMBER);

        // Texto una sola vez (antes se extraía dos veces por mensaje).
        const textoCrudo = extraerTexto(msg);
        const esComando = textoCrudo.startsWith(config.PREFIX);

        // ¿Hace falta saber quién es admin? Solo si es un comando,
        // si el antilink está activo en este grupo, o si el modo
        // GROUP_ONLY_ADMINS está prendido. Antes se pedía
        // groupMetadata() en CADA mensaje de grupo: ahora se pide
        // solo cuando hace falta y con caché de 45s (groupmeta.js).
        const antilinkActivo = isGroup && !esDueno && esAntilinkActivo(jid);
        const necesitaMeta = isGroup && (esComando || antilinkActivo || config.GROUP_ONLY_ADMINS);
        let isAdmin = false;
        let isBotAdmin = false;
        let metaGrupo = null;
        if (necesitaMeta) {
          try {
            metaGrupo = await obtenerMetaGrupo(sock, jid);
            // buscarParticipante compara por id, lid, jid o phoneNumber:
            // el admin se reconoce aunque el grupo use @lid.
            const part = buscarParticipante(metaGrupo.participants, sender);
            isAdmin = part?.admin === 'admin' || part?.admin === 'superadmin';
            const botPart = buscarParticipante(metaGrupo.participants, sock.user?.id);
            isBotAdmin = botPart?.admin === 'admin' || botPart?.admin === 'superadmin';
          } catch { /* si falla, se trata como no-admin */ }
        }

        // 1) ANTISPAM PRIMERO — si no pasa, no se procesa.
        const revision = revisarMensaje(msg, { isGroup, isAdmin });
        if (!revision.allowed) {
          if (revision.action === 'warn' && revision.warnText) {
            // Advertir con delay humano, sin spamear advertencias.
            await delayHumano();
            await sock.sendMessage(jid, { text: revision.warnText }, { quoted: msg });
          }
          // action 'mute' o 'ignore': silencio total, ni leemos el mensaje.
          continue;
        }

        // 1b) ANTILINK (solo grupos): si está activado y un no-admin manda
        // un link, se borra el mensaje y se le avisa. No se procesa nada más.
        if (antilinkActivo && tieneLink(textoCrudo)) {
          try { await sock.sendMessage(jid, { delete: msg.key }); } catch { /* sin admin no se puede borrar */ }
          await delayHumano();
          await sock.sendMessage(jid, { text: '⚠️ En este grupo el antilink está activado, we. Nada de links.' }, { quoted: msg });
          continue;
        }

        // 1c) XP por mensaje (sube de nivel aunque no sea comando).
        const xp = nivelMod.agregarXp(numeroSender);
        const extras = [];
        if (xp.subio) extras.push(`🎉 ¡Subiste al nivel ${xp.nivel}!`);

        // 1d) AFK: si el que escribe estaba AFK, ya volvió.
        // Y si mencionó a alguien AFK, se le avisa en la respuesta.
        if (afkMod.quitarAfk(numeroSender)) {
          extras.push('👋 Ya volviste, ya no estás AFK.');
        }
        const mencionados = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const afkMencionados = afkMod.revisarMenciones(mencionados);
        if (afkMencionados.length) {
          extras.push(afkMencionados.map(a => `😴 @${a.numero} está AFK: ${a.motivo}`).join('\n'));
        }

        // 2) Solo comandos con prefijo. Lo demás se ignora a propósito:
        //    responder a TODO es lo que te marca como bot.
        const respuesta = await procesarComando(textoCrudo, {
          esDueno, isGroup, isAdmin, isBotAdmin, sender, jid, sock, msg, metaGrupo,
        });

        // Si no era comando, solo mandamos los avisos (nivel / AFK), si hay.
        if (!respuesta) {
          if (!extras.length) continue;
          if (config.SHOW_TYPING) await sock.sendPresenceUpdate('composing', jid);
          await delayHumano();
          await sock.sendMessage(jid, { text: extras.join('\n\n') }, { quoted: msg });
          if (config.SHOW_TYPING) await sock.sendPresenceUpdate('paused', jid);
          continue;
        }

        // 3) Delay humano + "escribiendo..." antes de responder.
        if (config.SHOW_TYPING) {
          await sock.sendPresenceUpdate('composing', jid);
        }
        await delayHumano();

        const textoRespuesta = typeof respuesta === 'string' ? respuesta : respuesta.text;
        const menciones = typeof respuesta === 'string' ? undefined : respuesta.mentions;
        const textoFinal = extras.length ? `${textoRespuesta}\n\n${extras.join('\n')}` : textoRespuesta;
        await sock.sendMessage(
          jid,
          menciones ? { text: textoFinal, mentions: menciones } : { text: textoFinal },
          { quoted: msg },
        );
        if (config.SHOW_TYPING) {
          await sock.sendPresenceUpdate('paused', jid);
        }
      } catch (err) {
        console.error('[ERROR] procesando mensaje:', err.message);
      }
    }
  });

  return sock;
}

// Apagado limpio: volcar al disco lo que el store tenía pendiente
// (XP diferido) antes de salir. Sin esto, el último minuto de XP
// se podía perder al hacer Ctrl+C.
function apagarLimpio(senal) {
  try { flushAll(); } catch { /* mejor esfuerzo */ }
  try { if (sockActual && typeof sockActual.end === 'function') sockActual.end(); } catch { /* mejor esfuerzo */ }
  console.log(`\n👋 Apagando (${senal}). Datos guardados.`);
  process.exit(0);
}

// Arranque: solo cuando se corre con `node index.js`.
// Al hacer require('./index') desde pruebas no se conecta nada.
if (require.main === module) {
  process.on('SIGINT', () => apagarLimpio('SIGINT'));
  process.on('SIGTERM', () => apagarLimpio('SIGTERM'));
  conectar().catch((err) => {
    console.error('💥 No se pudo iniciar el bot:', err.message);
    agendarReconexion('error de inicio');
  });
}

module.exports = { conectar, agendarReconexion, retrasoRecon, obtenerMetaGrupo };
