// ============================================
// src/commands.js — Comandos del bot (todo local, sin APIs)
//
// Todos pasan por el antispam ANTES de llegar aquí (index.js).
// Los comandos de grupo necesitan el socket de Baileys (ctx.sock)
// y los de admin revisan ctx.isAdmin / ctx.isBotAdmin.
//
// procesarComando es async y devuelve:
//   null              -> no era un comando
//   string            -> texto de respuesta
//   { text, mentions } -> respuesta con menciones (@)
// ============================================

const config = require('../config');
const { getStats, resetStats } = require('./antispam');
const economia = require('./economy');
const gacha = require('./gacha');
const nivel = require('./level');
const afk = require('./afk');
const grupo = require('./group');

const PREFIX = config.PREFIX;

function numeroDe(jid) {
  return (jid || '').split('@')[0].split(':')[0];
}

// Enmascara el número del dueño: !info lo puede correr cualquiera
// en un grupo, no tiene por qué ver el número completo.
function mascaraNumero(numero) {
  const n = String(numero || '');
  if (n.length <= 4) return '****';
  return `${n.slice(0, 4)}****${n.slice(-2)}`;
}

function menuTexto() {
  return [
    `*${config.BOT_NAME}* — Menú`,
    '',
    '💰 *Economía*',
    `${PREFIX}balance — tus monedas`,
    `${PREFIX}daily — monedas diarias (1 vez al día)`,
    `${PREFIX}work — trabajar (cada 10 min)`,
    `${PREFIX}coinflip cara|cruz <apuesta> — volado`,
    `${PREFIX}slot <apuesta> — tragamonedas`,
    `${PREFIX}givecoins @usuario <cantidad> — regalar monedas`,
    `${PREFIX}shop — tienda (sin dinero real)`,
    `${PREFIX}buy <id> — comprar`,
    `${PREFIX}inventory — lo que tienes`,
    `${PREFIX}top — top 5 de monedas`,
    '',
    '🎲 *Gacha (local, solo texto)*',
    `${PREFIX}rollwaifu — tira un personaje al azar`,
    `${PREFIX}claim — reclamar tu último roll`,
    `${PREFIX}harem — tus personajes`,
    `${PREFIX}charinfo <nombre> — info de un personaje`,
    '',
    '👤 *Perfil*',
    `${PREFIX}profile — tu nivel, XP y monedas`,
    `${PREFIX}level — tu nivel y XP`,
    `${PREFIX}afk <motivo> — marcarte ausente`,
    '',
    '👥 *Grupo (solo admins)*',
    `${PREFIX}kick — expulsar (responde, menciona o pon número)`,
    `${PREFIX}promote / ${PREFIX}demote — dar/quitar admin`,
    `${PREFIX}tagall — mencionar a todos (cooldown 60s)`,
    `${PREFIX}groupinfo — info del grupo`,
    `${PREFIX}warn — avisar (3 avisos = expulsión)`,
    `${PREFIX}warns — ver avisos`,
    `${PREFIX}delwarn — quitar un aviso`,
    `${PREFIX}open / ${PREFIX}close — abrir/cerrar el grupo`,
    `${PREFIX}link — link de invitación`,
    `${PREFIX}antilink on/off — borrar links de no-admins`,
    '',
    '🤖 *Bot*',
    `${PREFIX}ping — pong, para probar que ando vivo`,
    `${PREFIX}help / ${PREFIX}menu — este menú`,
    `${PREFIX}info — info del bot y del antispam`,
    `${PREFIX}status — estado del bot`,
    `${PREFIX}antispam — estado del antispam (solo dueño)`,
    '',
    'Si mandas en ráfaga, repites lo mismo o reenvías de todo,',
    'el antispam te va a mutear tantito. Es por tu bien, we.',
  ].join('\n');
}

function infoTexto() {
  return [
    `*${config.BOT_NAME}*`,
    '',
    `Bot propio con Baileys + antispam.`,
    `Prefijo: ${PREFIX}`,
    `Dueño: ${mascaraNumero(config.OWNER_NUMBER)}`,
    '',
    'Módulos locales (sin APIs externas):',
    '• Economía: monedas, daily, trabajo, apuestas, tienda',
    '• Gacha: 12 personajes inventados, solo texto',
    '• Niveles: XP por mensaje, AFK',
    '• Grupo: kick, warns, tagall, antilink, abrir/cerrar',
    '',
    'Límites antispam:',
    `• ${config.MAX_MSG_PER_MIN} msg/min, ${config.MAX_MSG_PER_10MIN} msg/10min`,
    `• Máx ${config.MAX_FORWARDED_PER_HOUR} reenviados/hora`,
    `• Máx ${config.MAX_LINKS_PER_MSG} links por mensaje`,
    `• Mute temporal: ${config.MUTE_SECONDS}s`,
    '',
    'No oficial, úsalo con cuidado. No es magia antiban.',
  ].join('\n');
}

function statusTexto() {
  const s = getStats();
  const mins = Math.floor(process.uptime() / 60);
  const uptime = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  return [
    `*${config.BOT_NAME}* — Estado`,
    '',
    `En línea desde hace: ${uptime}`,
    `Prefijo: ${PREFIX}`,
    `Mensajes revisados: ${s.totalRevisados}`,
    `Bloqueados: ${s.bloqueados} | Advertencias: ${s.advertencias} | Muteados: ${s.muteados}`,
    '',
    'Todo local: economía, gacha, niveles y avisos se guardan en data/. Sin APIs externas.',
  ].join('\n');
}

// Revisa que el comando sea en grupo y lo pida un admin (o el dueño).
// Devuelve un texto de error o null si todo bien.
function soloAdmin(ctx) {
  if (!ctx.isGroup) return 'Ese comando solo funciona en grupos, we.';
  if (!ctx.isAdmin && !ctx.esDueno) return 'Eso solo lo hacen los admins del grupo, we.';
  if (!ctx.sock) return 'Sin conexión a WhatsApp, no puedo hacer eso ahorita.';
  return null;
}

function necesitaBotAdmin(ctx) {
  if (!ctx.isBotAdmin) return 'No soy admin del grupo, no puedo hacer eso. Hazme admin primero.';
  return null;
}

function perfilTexto(numero) {
  const n = nivel.datos(numero);
  const coins = economia.saldo(numero);
  const harem = gacha.cantidadHarem(numero);
  const estadoAfk = afk.estaAfk(numero) ? '😴 AFK' : '🟢 activo';
  return [
    `👤 *Perfil de @${numero}*`,
    '',
    `Nivel: ${n.level} (${n.xp} XP, ${n.msgs} mensajes)`,
    `Monedas: ${coins}`,
    `Harem: ${harem} personaje(s)`,
    `Estado: ${estadoAfk}`,
    '',
    `Ve tu progreso con ${PREFIX}level y tus monedas con ${PREFIX}balance.`,
  ].join('\n');
}

// Devuelve el texto de respuesta (o { text, mentions }), o null si no es un comando.
async function procesarComando(texto, ctx = {}) {
  const { esDueno = false } = ctx;
  if (!texto.startsWith(PREFIX)) return null;

  const partes = texto.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = (partes[0] || '').toLowerCase();
  const args = partes.slice(1);
  const numero = numeroDe(ctx.sender);

  switch (cmd) {
    // ---- Bot / principal ----
    case 'ping':
      return 'pong 🏓';

    case 'help':
    case 'menu':
    case 'ayuda':
      return menuTexto();

    case 'info':
      return infoTexto();

    case 'status':
      return statusTexto();

    case 'antispam': {
      if (!esDueno) return 'Ese comando es solo para el dueño, we.';
      if (args[0] === 'reset') {
        resetStats();
        return 'Stats del antispam reseteadas.';
      }
      const s = getStats();
      const motivos = Object.entries(s.porMotivo)
        .map(([k, v]) => `• ${k}: ${v}`)
        .join('\n') || '• (sin bloqueos aún)';
      return [
        '*Antispam — Estado*',
        '',
        `Revisados: ${s.totalRevisados}`,
        `Bloqueados: ${s.bloqueados}`,
        `Advertencias: ${s.advertencias}`,
        `Muteados: ${s.muteados}`,
        `Reenviados bloqueados: ${s.reenviadosBloqueados}`,
        `Usuarios activos en memoria: ${s.usuariosActivos}`,
        '',
        'Por motivo:',
        motivos,
        '',
        `Límites: ${s.limites.maxMin}/min, ${s.limites.max10Min}/10min, ${s.limites.maxReenviadosHora} reenvíos/hora`,
        '',
        `Usa ${PREFIX}antispam reset para limpiar stats.`,
      ].join('\n');
    }

    // ---- Economía ----
    case 'balance':
    case 'bal':
    case 'cartera':
      return economia.textoSaldo(numero);

    case 'daily':
    case 'diario':
      return economia.daily(numero);

    case 'work':
    case 'trabajar':
      return economia.work(numero);

    case 'coinflip':
    case 'moneda':
      return economia.coinflip(numero, args[0], args[1]);

    case 'slot':
    case 'tragamonedas':
      return economia.slot(numero, args[0]);

    case 'givecoins':
    case 'dar': {
      const objetivoJid = grupo.objetivo(ctx.msg, args.slice(0, -1));
      if (!objetivoJid) return '¿A quién le doy? Menciona a alguien o responde su mensaje. Ejemplo: `!givecoins @usuario 100`.';
      return economia.givecoins(numero, numeroDe(objetivoJid), args[args.length - 1]);
    }

    case 'shop':
    case 'tienda':
      return economia.tiendaTexto();

    case 'buy':
    case 'comprar':
      return economia.comprar(numero, args[0]);

    case 'inventory':
    case 'inventario':
    case 'inv':
      return economia.inventarioTexto(numero);

    case 'top':
    case 'topcoins':
      return economia.topTexto();

    // ---- Gacha ----
    case 'rollwaifu':
    case 'roll':
      return gacha.roll(numero);

    case 'claim':
    case 'reclamar':
      return gacha.claim(numero);

    case 'harem':
      return gacha.haremTexto(numero);

    case 'charinfo':
    case 'personaje':
      return gacha.charinfo(args.join(' '));

    // ---- Perfil / nivel / AFK ----
    case 'profile':
    case 'perfil':
      return perfilTexto(numero);

    case 'level':
    case 'nivel':
      return nivel.textoNivel(numero);

    case 'afk': {
      if ((args[0] || '').toLowerCase() === 'off') {
        return afk.quitarAfk(numero)
          ? 'Ya no estás AFK, we. Bienvenido de vuelta.'
          : 'Ni estabas AFK, we.';
      }
      const motivo = args.join(' ') || 'sin motivo';
      afk.ponerAfk(numero, motivo);
      return `😴 Ya estás AFK: ${motivo}.\nCuando mandes cualquier mensaje te quito el AFK solo.`;
    }

    // ---- Grupo (solo admins) ----
    case 'kick':
    case 'expulsar': {
      const err = soloAdmin(ctx); if (err) return err;
      const errBot = necesitaBotAdmin(ctx); if (errBot) return errBot;
      const objetivoJid = grupo.objetivo(ctx.msg, args);
      if (!objetivoJid) return '¿A quién expulso? Responde su mensaje, menciónalo o pon su número.';
      return grupo.expulsar(ctx, objetivoJid);
    }

    case 'promote':
    case 'promover': {
      const err = soloAdmin(ctx); if (err) return err;
      const errBot = necesitaBotAdmin(ctx); if (errBot) return errBot;
      const objetivoJid = grupo.objetivo(ctx.msg, args);
      if (!objetivoJid) return '¿A quién promuevo? Responde su mensaje, menciónalo o pon su número.';
      return grupo.promover(ctx, objetivoJid);
    }

    case 'demote':
    case 'degradar': {
      const err = soloAdmin(ctx); if (err) return err;
      const errBot = necesitaBotAdmin(ctx); if (errBot) return errBot;
      const objetivoJid = grupo.objetivo(ctx.msg, args);
      if (!objetivoJid) return '¿A quién degrado? Responde su mensaje, menciónalo o pon su número.';
      return grupo.degradar(ctx, objetivoJid);
    }

    case 'tagall': {
      const err = soloAdmin(ctx); if (err) return err;
      return grupo.mencionarATodos(ctx);
    }

    case 'groupinfo':
    case 'infogrupo': {
      if (!ctx.isGroup) return 'Eso solo funciona en grupos, we.';
      if (!ctx.sock) return 'Sin conexión a WhatsApp, no puedo hacer eso ahorita.';
      return grupo.infoGrupo(ctx);
    }

    case 'warn':
    case 'avisar': {
      const err = soloAdmin(ctx); if (err) return err;
      const objetivoJid = grupo.objetivo(ctx.msg, args);
      if (!objetivoJid) return '¿A quién le pongo aviso? Responde su mensaje, menciónalo o pon su número.';
      const numObj = numeroDe(objetivoJid);
      let motivo = args.join(' ').replace(new RegExp(`@?${numObj}`), '').trim();
      if (!motivo) motivo = 'sin motivo';
      return grupo.advertir(ctx, objetivoJid, motivo);
    }

    case 'warns':
    case 'avisos': {
      if (!ctx.isGroup) return 'Eso solo funciona en grupos, we.';
      return grupo.verAvisos(ctx.jid);
    }

    case 'delwarn':
    case 'quitaraviso': {
      const err = soloAdmin(ctx); if (err) return err;
      const objetivoJid = grupo.objetivo(ctx.msg, args);
      if (!objetivoJid) return '¿A quién le quito el aviso? Responde su mensaje, menciónalo o pon su número.';
      return grupo.quitarAviso(ctx.jid, objetivoJid);
    }

    case 'open':
    case 'abrir': {
      const err = soloAdmin(ctx); if (err) return err;
      const errBot = necesitaBotAdmin(ctx); if (errBot) return errBot;
      return grupo.abrirGrupo(ctx);
    }

    case 'close':
    case 'cerrar': {
      const err = soloAdmin(ctx); if (err) return err;
      const errBot = necesitaBotAdmin(ctx); if (errBot) return errBot;
      return grupo.cerrarGrupo(ctx);
    }

    case 'link':
    case 'invitacion':
    case 'invitación': {
      const err = soloAdmin(ctx); if (err) return err;
      const errBot = necesitaBotAdmin(ctx); if (errBot) return errBot;
      return grupo.enlaceGrupo(ctx);
    }

    case 'antilink': {
      const err = soloAdmin(ctx); if (err) return err;
      const sub = (args[0] || '').toLowerCase();
      if (sub === 'on' || sub === 'encender') {
        grupo.cambiarAntilink(ctx.jid, true);
        return '🔗 Antilink activado: borraré los links de no-admins en este grupo.';
      }
      if (sub === 'off' || sub === 'apagar') {
        grupo.cambiarAntilink(ctx.jid, false);
        return '🔗 Antilink desactivado.';
      }
      const activo = grupo.esAntilinkActivo(ctx.jid);
      return `Antilink: ${activo ? 'activado ✅' : 'desactivado ❌'}. Usa ${PREFIX}antilink on/off.`;
    }

    default:
      return `No conozco ese comando, we. Escribe ${PREFIX}menu para ver los que sí tengo.`;
  }
}

module.exports = { procesarComando, menuTexto, infoTexto, statusTexto, PREFIX };
