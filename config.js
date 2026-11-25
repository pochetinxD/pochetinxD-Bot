// ============================================
// config.js — Configuración del bot
// Todo se puede sobreescribir con variables en .env
// ============================================
require('dotenv').config();

module.exports = {
  // ---- Dueño / admin ----
  // PON AQUÍ TU NÚMERO con código de país, sin + ni espacios.
  // Ejemplo México: '5215512345678' | Ejemplo Chile: '56912345678'
  // También se puede poner en .env como OWNER_NUMBER=521...
  OWNER_NUMBER: process.env.OWNER_NUMBER || '5210000000000', // <-- ¡CÁMBIALO!

  // Números que nunca pasan por el antispam (además del dueño).
  // Formato: ['5215512345678', '56987654321']
  WHITELIST: (process.env.WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean),

  // Números bloqueados de plano (el bot los ignora siempre).
  BLOCKLIST: (process.env.BLOCKLIST || '').split(',').map(s => s.trim()).filter(Boolean),

  // ---- Comandos ----
  PREFIX: process.env.PREFIX || '!',
  BOT_NAME: process.env.BOT_NAME || 'Musulmán 🗣️🔥',

  // ---- Antispam: rate limiting por usuario ----
  // Máx. mensajes por minuto antes de advertir / mutear.
  MAX_MSG_PER_MIN: parseInt(process.env.MAX_MSG_PER_MIN || '8', 10),
  // Máx. mensajes por 10 minutos.
  MAX_MSG_PER_10MIN: parseInt(process.env.MAX_MSG_PER_10MIN || '30', 10),
  // Segundos de mute temporal cuando se pasa del límite.
  MUTE_SECONDS: parseInt(process.env.MUTE_SECONDS || '60', 10),

  // ---- Antispam: flood / mensajes repetidos ----
  // Veces que se puede repetir el mismo texto en 2 minutos antes de marcarlo.
  MAX_SAME_MSG: parseInt(process.env.MAX_SAME_MSG || '3', 10),
  // Ventana para contar repeticiones (ms).
  SAME_MSG_WINDOW_MS: 2 * 60 * 1000,

  // ---- Antispam: reenviados ----
  // Máx. mensajes reenviados por usuario por hora.
  // Esto es clave: reenviar de todo es lo que más huele a spam para WhatsApp.
  MAX_FORWARDED_PER_HOUR: parseInt(process.env.MAX_FORWARDED_PER_HOUR || '5', 10),
  // Si un mensaje reenviado llega muchas veces seguidas, se bloquea.
  MAX_FORWARDED_BURST: parseInt(process.env.MAX_FORWARDED_BURST || '3', 10),

  // ---- Antispam: links y menciones ----
  // Máx. links por mensaje.
  MAX_LINKS_PER_MSG: parseInt(process.env.MAX_LINKS_PER_MSG || '2', 10),
  // Máx. links por usuario por 10 minutos.
  MAX_LINKS_PER_10MIN: parseInt(process.env.MAX_LINKS_PER_10MIN || '5', 10),
  // Máx. menciones (@) por mensaje.
  MAX_MENTIONS_PER_MSG: parseInt(process.env.MAX_MENTIONS_PER_MSG || '3', 10),

  // Palabras típicas de spam / venta. Si un mensaje trae varias, se marca.
  // Agrégalas o quítalas a tu gusto, en minúsculas.
  SPAM_KEYWORDS: [
    'gana dinero', 'dinero fácil', 'dinero rapido', 'dinero rápido',
    'invierte', 'inversion', 'inversión', 'cripto', 'bitcoin',
    'oferta imperdible', 'solo hoy', '100% gratis', 'hazte rico',
    'trabaja desde casa', 'gana desde casa', 'promo exclusiva',
    'click aquí', 'clic aquí', 'únete ahora', 'unete ahora',
    'comprar seguidores', 'seguidores gratis'
  ],

  // Puntos de spam para marcar un mensaje (ver src/antispam.js).
  SPAM_SCORE_THRESHOLD: parseInt(process.env.SPAM_SCORE_THRESHOLD || '5', 10),

  // ---- Antispam: grupos vs privado ----
  // En grupos el antispam es más estricto (es donde más banean).
  GROUP_STRICT_MULTIPLIER: 0.7, // los límites se multiplican por 0.7 en grupos
  // Si es true, en grupos solo responden los admins / whitelist.
  GROUP_ONLY_ADMINS: process.env.GROUP_ONLY_ADMINS === 'true',
  // Si es true, el bot ignora por completo los mensajes de grupos.
  IGNORE_GROUPS: process.env.IGNORE_GROUPS === 'true',

  // ---- Comportamiento humano ----
  // El bot NUNCA responde al instante: espera un tiempo aleatorio.
  // Esto es lo que más ayuda a no parecer robot.
  MIN_REPLY_DELAY_MS: parseInt(process.env.MIN_REPLY_DELAY_MS || '800', 10),
  MAX_REPLY_DELAY_MS: parseInt(process.env.MAX_REPLY_DELAY_MS || '2500', 10),
  // Muestra "escribiendo..." antes de responder (como humano).
  SHOW_TYPING: process.env.SHOW_TYPING !== 'false',

  // ---- Sesión ----
  AUTH_DIR: process.env.AUTH_DIR || './auth_info',
  // Tiempo entre reintentos de reconexión (ms).
  RECONNECT_DELAY_MS: 5000,
};
