// ============================================
// src/antispam.js — Sistema antispam del bot
//
// Idea: que el bot NO se comporte como spam.
// WhatsApp banea por patrones, no por un solo mensaje:
// reenviar de todo, mandar en ráfaga, muchos links,
// responder al instante a todo, mencionar a medio grupo.
//
// Este módulo revisa cada mensaje ANTES de responder y decide:
//   { allowed: true }  -> se puede procesar
//   { allowed: false, reason, action } -> se ignora / advierte / mutea
//
// Todo es en memoria (se reinicia al apagar el bot).
// Si quieres persistencia, aquí es donde se guardaría en un .json / DB.
//
// Estabilidad (auditoría 2026-11-26):
// - El Map de usuarios ya no crece sin fin: hay tope de
//   usuarios (ANTISPAM_MAX_USERS), TTL por inactividad
//   (ANTISPAM_USER_TTL_MS) y los warns se resetean si el
//   usuario no reincide (ANTISPAM_WARN_DECAY_MS). Antes los
//   warns nunca se borraban y eso impedía borrar al usuario.
// - El dueño / whitelist / blocklist se resuelven ANTES de
//   crear la entrada en el Map: ya no se guarda estado de
//   gente que nunca pasa por el filtro.
// - Los logs ya no imprimen números completos ni el texto
//   del mensaje: solo JID enmascarado, motivo y contadores.
// ============================================

const config = require('../config');
const { mismaIdentidad } = require('./groupmeta'); // LID: comparar @lid y @s.whatsapp.net

// Ventanas de tiempo
const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;

// Topes de memoria (ver config.js).
function maxUsuarios() {
  return config.ANTISPAM_MAX_USERS || 500;
}
function ttlUsuarioMs() {
  return config.ANTISPAM_USER_TTL_MS || 30 * MIN_MS;
}
function decayWarnsMs() {
  return config.ANTISPAM_WARN_DECAY_MS || 60 * MIN_MS;
}

// Estado por usuario: Map<jid, estado>
const users = new Map();
// Estado global de eventos (para el comando !antispam)
const stats = {
  totalRevisados: 0,
  bloqueados: 0,
  advertencias: 0,
  muteados: 0,
  reenviadosBloqueados: 0,
  porMotivo: {}, // { motivo: cantidad }
};

function now() {
  return Date.now();
}

// '521...:12@s.whatsapp.net' -> '521...' (quita el sufijo :lid).
function numeroDe(jid) {
  return (jid || '').split('@')[0].split(':')[0];
}

// Enmascara un JID para los logs: no se imprime el número completo.
// '5215512345678@s.whatsapp.net' -> '5215****78@s.whatsapp.net'
function mascaraJid(jid) {
  const [num, dom] = (jid || '').split('@');
  if (!num) return 'desconocido';
  const n = numeroDe(jid);
  const visible = n.length > 6 ? `${n.slice(0, 4)}****${n.slice(-2)}` : '****';
  return dom ? `${visible}@${dom}` : visible;
}

function getUser(jid) {
  if (!users.has(jid)) {
    users.set(jid, {
      // timestamps de mensajes (últimos 10 min)
      timestamps: [],
      // últimos textos para detectar repetición: [{ text, at }]
      recentTexts: [],
      // timestamps de reenviados (última hora)
      forwardedAt: [],
      // timestamps de links (últimos 10 min)
      linkAt: [],
      // hasta cuándo está muteado (timestamp, 0 = no)
      mutedUntil: 0,
      // advertencias acumuladas (se resetean si no reincide)
      warns: 0,
      // última actividad y última infracción (para limpieza)
      lastSeen: now(),
      lastWarnAt: 0,
    });
  }
  return users.get(jid);
}

function limpiarViejos(u, t) {
  u.timestamps = u.timestamps.filter(x => t - x < 10 * MIN_MS);
  u.recentTexts = u.recentTexts.filter(x => t - x.at < config.SAME_MSG_WINDOW_MS);
  u.forwardedAt = u.forwardedAt.filter(x => t - x < HOUR_MS);
  u.linkAt = u.linkAt.filter(x => t - x < 10 * MIN_MS);
  // Topes duros por si llega una ráfaga enorme entre limpiezas.
  if (u.timestamps.length > 100) u.timestamps = u.timestamps.slice(-100);
  if (u.recentTexts.length > 20) u.recentTexts = u.recentTexts.slice(-20);
  if (u.forwardedAt.length > 100) u.forwardedAt = u.forwardedAt.slice(-100);
  if (u.linkAt.length > 100) u.linkAt = u.linkAt.slice(-100);
}

// Saca del Map a los usuarios inactivos y resetea warns viejos.
// Si hay demasiados usuarios, se expulsan los de actividad más vieja.
function purgarUsuarios(t = now()) {
  for (const [jid, u] of users.entries()) {
    if (u.warns > 0 && u.lastWarnAt && t - u.lastWarnAt > decayWarnsMs()) {
      u.warns = 0;
    }
    if (t - (u.lastSeen || 0) > ttlUsuarioMs() && u.mutedUntil <= t) {
      users.delete(jid);
    }
  }
  // Tope duro: expulsar a los de actividad más vieja.
  const max = maxUsuarios();
  if (users.size > max) {
    const ordenados = [...users.entries()].sort((a, b) => (a[1].lastSeen || 0) - (b[1].lastSeen || 0));
    for (let i = 0; i < users.size - max; i++) users.delete(ordenados[i][0]);
  }
  return users.size;
}

function contarUsuarios() {
  return users.size;
}

// Lectura de solo lectura del estado de un usuario (para pruebas
// y monitoreo). Devuelve una copia, nunca la referencia interna.
function verUsuario(jid) {
  const u = users.get(jid);
  if (!u) return null;
  return { warns: u.warns, mutedUntil: u.mutedUntil, lastSeen: u.lastSeen, mensajes10min: u.timestamps.length };
}

function registrar(motivo) {
  stats.bloqueados++;
  stats.porMotivo[motivo] = (stats.porMotivo[motivo] || 0) + 1;
}

function logEvento(tipo, jid, detalle) {
  const hora = new Date().toISOString();
  // Solo JID enmascarado + motivo + contadores. Nunca el texto
  // del mensaje ni el número completo: los logs no son lugar
  // para datos privados.
  console.log(`[ANTISPAM] [${tipo}] ${hora} | ${mascaraJid(jid)} | ${detalle}`);
}

// Extrae el texto de un mensaje de Baileys (varios formatos).
function extraerTexto(msg) {
  const m = msg.message || {};
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  ).trim();
}

function contarLinks(texto) {
  const matches = texto.match(/https?:\/\/[^\s]+|www\.[^\s]+/gi);
  return matches ? matches.length : 0;
}

function contarMenciones(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const mentioned = ctx?.mentionedJid || [];
  const texto = extraerTexto(msg);
  const arrobas = (texto.match(/@\d+/g) || []).length;
  return Math.max(mentioned.length, arrobas);
}

function esReenviado(msg) {
  const ctx =
    msg.message?.extendedTextMessage?.contextInfo ||
    msg.message?.imageMessage?.contextInfo ||
    msg.message?.videoMessage?.contextInfo ||
    {};
  // Baileys marca isForwarded en el contextInfo
  return ctx.isForwarded === true;
}

function calcularSpamScore(texto, links, menciones) {
  let score = 0;
  const bajo = texto.toLowerCase();

  // Links: cada link suma 1 punto.
  score += links * 1;
  // Muchas menciones suman.
  if (menciones >= 4) score += 2;
  // Palabras de spam.
  for (const kw of config.SPAM_KEYWORDS) {
    if (bajo.includes(kw)) score += 2;
  }
  // Texto TODO EN MAYÚSCULAS (grito / spam clásico).
  if (texto.length > 20 && texto === texto.toUpperCase() && /[A-Z]/.test(texto)) score += 1;
  // Muchos emojis / caracteres repetidos (ej: !!!!!!!, 🔥🔥🔥🔥🔥)
  if (/(.)\1{5,}/.test(texto)) score += 1;

  return score;
}

// Retraso con jitter, como humano: no responder al instante.
function delayHumano() {
  const min = config.MIN_REPLY_DELAY_MS;
  const max = config.MAX_REPLY_DELAY_MS;
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise(res => setTimeout(res, ms));
}

// Limpieza periódica para que el Map no crezca infinito.
setInterval(() => {
  const t = now();
  for (const [jid, u] of users.entries()) {
    limpiarViejos(u, t);
  }
  purgarUsuarios(t);
}, 5 * MIN_MS).unref();

/**
 * Revisa un mensaje. Devuelve { allowed, reason?, action?, warnText? }
 * - allowed: si el bot puede procesarlo.
 * - action: 'ignore' | 'warn' | 'mute'
 */
function revisarMensaje(msg, { isGroup = false, isAdmin = false } = {}) {
  stats.totalRevisados++;
  const t = now();
  const jid = msg.key?.remoteJid || 'desconocido';
  // El que manda puede venir en @lid: Baileys trae el número en
  // participantPn (grupos) / senderPn (privado). Si viene, se usa
  // ese; si no, el ID tal cual (mismaIdentidad resuelve el resto).
  const sender = msg.key?.participantPn || msg.key?.senderPn || msg.key?.participant || jid;
  const texto = extraerTexto(msg);
  const numeroSender = numeroDe(sender);

  // ---- 1. Blocklist / allowlist / dueño ----
  // Se resuelve ANTES de crear la entrada en el Map: esta gente
  // no necesita estado y no debe ocupar memoria.
  // mismaIdentidad compara @lid y @s.whatsapp.net (ver groupmeta.js).
  if (config.BLOCKLIST.some((n) => mismaIdentidad(sender, n))) {
    registrar('blocklist');
    logEvento('BLOQUEADO', sender, 'blocklist');
    return { allowed: false, reason: 'blocklist', action: 'ignore' };
  }
  const esDueno = mismaIdentidad(sender, config.OWNER_NUMBER);
  const esWhitelist = config.WHITELIST.some((n) => mismaIdentidad(sender, n));
  if (esDueno || esWhitelist) {
    return { allowed: true, reason: 'bypass dueño/whitelist' };
  }

  const u = getUser(sender);
  u.lastSeen = t;
  // Si lleva mucho sin reincidir, los warns se resetean solos.
  if (u.warns > 0 && u.lastWarnAt && t - u.lastWarnAt > decayWarnsMs()) {
    u.warns = 0;
  }

  // ---- 2. Mute temporal activo ----
  if (u.mutedUntil > t) {
    const quedan = Math.ceil((u.mutedUntil - t) / 1000);
    logEvento('MUTEADO', sender, `aún muteado ${quedan}s`);
    return { allowed: false, reason: 'mute', action: 'ignore', muteQuedan: quedan };
  }

  limpiarViejos(u, t);

  // Límites ajustados si es grupo (más estrictos).
  const mult = isGroup ? config.GROUP_STRICT_MULTIPLIER : 1;
  const maxMin = Math.max(3, Math.floor(config.MAX_MSG_PER_MIN * mult));
  const max10 = Math.max(10, Math.floor(config.MAX_MSG_PER_10MIN * mult));

  // Registrar este mensaje para los conteos.
  u.timestamps.push(t);

  // ---- 3. Rate limiting: por minuto / por 10 min ----
  const ultimoMin = u.timestamps.filter(x => t - x < MIN_MS).length;
  if (ultimoMin > maxMin) {
    u.warns++;
    u.lastWarnAt = t;
    u.mutedUntil = t + config.MUTE_SECONDS * 1000;
    stats.muteados++;
    registrar('rate-limit-min');
    logEvento('MUTEADO', sender, `flood ${ultimoMin} msg/min (máx ${maxMin}) -> mute ${config.MUTE_SECONDS}s`);
    return {
      allowed: false,
      reason: 'rate-limit-min',
      action: 'mute',
      warnText: `Nmms we, bájale tantito 😅 te muteo ${config.MUTE_SECONDS}s por mandar en ráfaga.`,
    };
  }
  if (u.timestamps.length > max10) {
    u.warns++;
    u.lastWarnAt = t;
    u.mutedUntil = t + config.MUTE_SECONDS * 1000;
    stats.muteados++;
    registrar('rate-limit-10min');
    logEvento('MUTEADO', sender, `flood ${u.timestamps.length} msg/10min (máx ${max10})`);
    return {
      allowed: false,
      reason: 'rate-limit-10min',
      action: 'mute',
      warnText: `We, ya llevas muchos mensajes en poco tiempo, te doy un respiro de ${config.MUTE_SECONDS}s.`,
    };
  }

  // ---- 4. Flood: mismo mensaje repetido ----
  if (texto) {
    const repetidos = u.recentTexts.filter(x => x.text === texto).length;
    u.recentTexts.push({ text: texto, at: t });
    if (u.recentTexts.length > 20) u.recentTexts = u.recentTexts.slice(-20);
    if (repetidos + 1 > config.MAX_SAME_MSG) {
      u.warns++;
      u.lastWarnAt = t;
      stats.advertencias++;
      registrar('mensaje-repetido');
      logEvento('BLOQUEADO', sender, `mismo mensaje x${repetidos + 1} en 2 min (${texto.length} caracteres)`);
      return {
        allowed: false,
        reason: 'mensaje-repetido',
        action: 'warn',
        warnText: 'Ese mensaje ya lo mandaste varias veces, we. No lo repitas.',
      };
    }
  }

  // ---- 5. Reenviados: el filtro más importante ----
  // Reenviar de todo es la señal #1 de spam para WhatsApp.
  if (esReenviado(msg)) {
    u.forwardedAt.push(t);
    const enUltimaHora = u.forwardedAt.length;
    // Ráfaga de reenviados seguidos.
    const recientes = u.forwardedAt.filter(x => t - x < 5 * MIN_MS).length;
    if (recientes > config.MAX_FORWARDED_BURST) {
      stats.reenviadosBloqueados++;
      registrar('reenviado-rafaga');
      logEvento('BLOQUEADO', sender, `ráfaga de reenviados: ${recientes} en 5 min`);
      return {
        allowed: false,
        reason: 'reenviado-rafaga',
        action: 'warn',
        warnText: 'No reenvíes todo en ráfaga, we. Eso es justo lo que WhatsApp marca como spam.',
      };
    }
    if (enUltimaHora > config.MAX_FORWARDED_PER_HOUR) {
      stats.reenviadosBloqueados++;
      registrar('reenviado-hora');
      logEvento('BLOQUEADO', sender, `demasiados reenviados: ${enUltimaHora}/hora (máx ${config.MAX_FORWARDED_PER_HOUR})`);
      return {
        allowed: false,
        reason: 'reenviado-hora',
        action: 'warn',
        warnText: `Ya reenviaste mucho esta hora (${enUltimaHora}), espérate tantito.`,
      };
    }
  }

  // ---- 6. Links / menciones / palabras spam ----
  const links = contarLinks(texto);
  const menciones = contarMenciones(msg);
  if (links > 0) u.linkAt.push(t);

  if (links > config.MAX_LINKS_PER_MSG) {
    registrar('demasiados-links');
    logEvento('BLOQUEADO', sender, `${links} links en un mensaje (máx ${config.MAX_LINKS_PER_MSG})`);
    return {
      allowed: false,
      reason: 'demasiados-links',
      action: 'warn',
      warnText: `We, ${links} links en un mensaje es mucho. Manda máximo ${config.MAX_LINKS_PER_MSG}.`,
    };
  }
  if (u.linkAt.length > config.MAX_LINKS_PER_10MIN) {
    registrar('links-10min');
    logEvento('BLOQUEADO', sender, `${u.linkAt.length} links/10min`);
    return {
      allowed: false,
      reason: 'links-10min',
      action: 'warn',
      warnText: 'Ya mandaste muchos links en poco tiempo, bájale.',
    };
  }
  if (menciones > config.MAX_MENTIONS_PER_MSG) {
    registrar('demasiadas-menciones');
    logEvento('BLOQUEADO', sender, `${menciones} menciones en un mensaje`);
    return {
      allowed: false,
      reason: 'demasiadas-menciones',
      action: 'warn',
      warnText: 'No menciones a tanta gente de golpe, we.',
    };
  }

  const score = calcularSpamScore(texto, links, menciones);
  if (score >= config.SPAM_SCORE_THRESHOLD) {
    registrar('spam-score');
    logEvento('BLOQUEADO', sender, `spam score ${score} (umbral ${config.SPAM_SCORE_THRESHOLD}, ${texto.length} caracteres)`);
    return {
      allowed: false,
      reason: 'spam-score',
      action: 'warn',
      warnText: 'Ese mensaje huele a spam, we. No lo proceso.',
    };
  }

  // ---- 7. Grupos: solo admins (si está activado) ----
  if (isGroup && config.GROUP_ONLY_ADMINS && !isAdmin) {
    return { allowed: false, reason: 'grupo-solo-admins', action: 'ignore' };
  }

  // Pasó todos los filtros.
  return { allowed: true, score };
}

function getStats() {
  return {
    ...stats,
    usuariosActivos: users.size,
    limites: {
      maxMin: config.MAX_MSG_PER_MIN,
      max10Min: config.MAX_MSG_PER_10MIN,
      maxReenviadosHora: config.MAX_FORWARDED_PER_HOUR,
      maxLinksMsg: config.MAX_LINKS_PER_MSG,
    },
  };
}

function resetStats() {
  stats.totalRevisados = 0;
  stats.bloqueados = 0;
  stats.advertencias = 0;
  stats.muteados = 0;
  stats.reenviadosBloqueados = 0;
  stats.porMotivo = {};
  users.clear();
}

module.exports = {
  revisarMensaje,
  extraerTexto,
  esReenviado,
  delayHumano,
  getStats,
  resetStats,
  // Para pruebas y monitoreo (no son comandos):
  purgarUsuarios,
  contarUsuarios,
  verUsuario,
  mascaraJid,
  numeroDe,
};
