// ============================================
// index.js — Bot de WhatsApp con Baileys + antispam
//
// Uso:
//   npm install
//   npm start
//   Escanea el QR con WhatsApp > Dispositivos vinculados
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

const logger = pino({ level: 'silent' }); // Baileys es muy chismoso, lo silenciamos

async function conectar() {
  const { state, saveCreds } = await useMultiFileAuthState(config.AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  console.log(`\n🤖 ${config.BOT_NAME} — iniciando...`);
  console.log(`   Baileys v${version.join('.')} | Prefijo: ${config.PREFIX}`);
  console.log(`   Dueño: ${config.OWNER_NUMBER} (cámbialo en config.js / .env si no es ese)`);
  console.log(`   Antispam: ${config.MAX_MSG_PER_MIN}/min, ${config.MAX_FORWARDED_PER_HOUR} reenviados/hora\n`);

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

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📱 Escanea este QR con WhatsApp > Dispositivos vinculados:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ Conectado a WhatsApp. El bot ya está vivo.');
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log(`❌ Conexión cerrada (código ${code}).`);

      if (loggedOut) {
        // Te sacaron / cerraste sesión: hay que borrar auth y escanear de nuevo.
        console.log('🔑 Sesión cerrada. Borra la carpeta ./auth_info y vuelve a escanear el QR.');
        return;
      }
      // Cualquier otro cierre: reconectar solo, con un respiro.
      console.log(`🔄 Reintentando en ${config.RECONNECT_DELAY_MS / 1000}s...`);
      setTimeout(conectar, config.RECONNECT_DELAY_MS);
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

        const sender = msg.key.participant || jid;
        const esDueno = sender.split('@')[0] === config.OWNER_NUMBER;

        // ¿Es admin del grupo? (solo importa si GROUP_ONLY_ADMINS está activo)
        let isAdmin = false;
        if (isGroup) {
          try {
            const meta = await sock.groupMetadata(jid);
            const part = meta.participants.find(p => p.id === sender);
            isAdmin = part?.admin === 'admin' || part?.admin === 'superadmin';
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

        // 2) Solo comandos con prefijo. Lo demás se ignora a propósito:
        //    responder a TODO es lo que te marca como bot.
        const texto = extraerTexto(msg);
        const respuesta = procesarComando(texto, { esDueno });
        if (!respuesta) continue;

        // 3) Delay humano + "escribiendo..." antes de responder.
        if (config.SHOW_TYPING) {
          await sock.sendPresenceUpdate('composing', jid);
        }
        await delayHumano();

        await sock.sendMessage(jid, { text: respuesta }, { quoted: msg });
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

// Arranque
conectar().catch((err) => {
  console.error('💥 No se pudo iniciar el bot:', err);
  process.exit(1);
});
