// ============================================
// src/commands.js — Comandos básicos del bot
// Todos pasan por el antispam ANTES de llegar aquí.
// ============================================

const config = require('../config');
const { getStats, resetStats } = require('./antispam');

const PREFIX = config.PREFIX;

function menuTexto() {
  return [
    `*${config.BOT_NAME}* — Menú`,
    '',
    `${PREFIX}ping - Te respondo pong, para probar que ando vivo`,
    `${PREFIX}help / ${PREFIX}menu - Este menú`,
    `${PREFIX}info - Info del bot y del antispam`,
    `${PREFIX}antispam - Estado del antispam (solo dueño)`,
    '',
    'Si mandas en ráfaga, repites lo mismo o reenvías de todo,',
    'el antispam te va a mutear tantito. Es por tu bien, we.',
  ].join('\n');
}

function infoTexto() {
  return [
    `*${config.BOT_NAME}*`,
    '',
    'Bot propio con Baileys + antispam.',
    `Prefijo: ${PREFIX}`,
    `Dueño: ${config.OWNER_NUMBER}`,
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

// Devuelve el texto de respuesta, o null si no es un comando.
function procesarComando(texto, { esDueno = false } = {}) {
  if (!texto.startsWith(PREFIX)) return null;

  const partes = texto.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = (partes[0] || '').toLowerCase();
  const args = partes.slice(1);

  switch (cmd) {
    case 'ping':
      return 'pong 🏓';

    case 'help':
    case 'menu':
    case 'ayuda':
      return menuTexto();

    case 'info':
      return infoTexto();

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

    default:
      return `No conozco ese comando, we. Escribe ${PREFIX}menu para ver los que sí tengo.`;
  }
}

module.exports = { procesarComando, menuTexto, infoTexto, PREFIX };
