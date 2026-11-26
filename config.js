// ============================================
// config.js — Configuración del bot
// Todo se puede sobreescribir con variables en .env
// ============================================
require('dotenv').config();

module.exports = {
  // ---- Dueño / admin ----
  // Número del dueño con código de país, sin + ni espacios.
  // Se puede sobreescribir en .env como OWNER_NUMBER=521...
  // Ojo: este valor queda en el repo (público). Si lo quieres
  // privado, ponlo solo en tu .env y deja aquí el placeholder.
  OWNER_NUMBER: process.env.OWNER_NUMBER || '526565920359',

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

  // ---- Economía / gacha / niveles (todo local, sin APIs) ----
  // Monedas con las que empieza cada usuario nuevo.
  START_COINS: parseInt(process.env.START_COINS || '100', 10),
  // !daily: una vez cada 24h, premio entre DAILY_MIN y DAILY_MAX.
  DAILY_COOLDOWN_MS: 24 * 60 * 60 * 1000,
  DAILY_MIN: parseInt(process.env.DAILY_MIN || '50', 10),
  DAILY_MAX: parseInt(process.env.DAILY_MAX || '150', 10),
  // !work: una vez cada 10 min, pago entre WORK_MIN y WORK_MAX.
  WORK_COOLDOWN_MS: 10 * 60 * 1000,
  WORK_MIN: parseInt(process.env.WORK_MIN || '10', 10),
  WORK_MAX: parseInt(process.env.WORK_MAX || '40', 10),
  // Apuestas (!coinflip, !slot): mínimo y máximo por jugada.
  BET_MIN: parseInt(process.env.BET_MIN || '10', 10),
  BET_MAX: parseInt(process.env.BET_MAX || '500', 10),
  // Máx. monedas que se pueden regalar de un jalón con !givecoins.
  GIVE_MAX: parseInt(process.env.GIVE_MAX || '1000', 10),
  // !rollwaifu: una tirada cada 10 min.
  ROLL_COOLDOWN_MS: 10 * 60 * 1000,
  // Avisos (!warn): al llegar a este número, se expulsa del grupo.
  WARN_LIMIT: parseInt(process.env.WARN_LIMIT || '3', 10),
  // Cooldown de !tagall por grupo (ms).
  TAGALL_COOLDOWN_MS: 60 * 1000,
  // XP que da cada mensaje que pasa el antispam (aleatorio entre los dos).
  XP_MIN: parseInt(process.env.XP_MIN || '5', 10),
  XP_MAX: parseInt(process.env.XP_MAX || '15', 10),

  // ---- Comportamiento humano ----
  // El bot NUNCA responde al instante: espera un tiempo aleatorio.
  // Esto es lo que más ayuda a no parecer robot.
  MIN_REPLY_DELAY_MS: parseInt(process.env.MIN_REPLY_DELAY_MS || '800', 10),
  MAX_REPLY_DELAY_MS: parseInt(process.env.MAX_REPLY_DELAY_MS || '2500', 10),
  // Muestra "escribiendo..." antes de responder (como humano).
  SHOW_TYPING: process.env.SHOW_TYPING !== 'false',

  // ---- Sesión ----
  AUTH_DIR: process.env.AUTH_DIR || './auth_info',
  // ---- Login: QR o código de emparejamiento ----
  // Por default se entra con CÓDIGO (sin QR): al no haber sesión
  // se pide un código de 8 caracteres para meterlo en WhatsApp >
  // Dispositivos vinculados > Vincular con número de teléfono.
  // Para volver al QR, pon USE_PAIRING_CODE=false en tu .env.
  USE_PAIRING_CODE: process.env.USE_PAIRING_CODE !== 'false' && process.env.PAIRING_CODE !== 'false',
  // Número al que va el código. Si está vacío, usa OWNER_NUMBER.
  PAIRING_PHONE: (process.env.PAIRING_PHONE || '').trim(),
  // Tiempo base entre reintentos de reconexión (ms). Se duplica en
  // cada intento (exponential backoff) hasta RECONNECT_MAX_MS.
  RECONNECT_DELAY_MS: parseInt(process.env.RECONNECT_DELAY_MS || '5000', 10),
  RECONNECT_BASE_MS: parseInt(process.env.RECONNECT_BASE_MS || process.env.RECONNECT_DELAY_MS || '5000', 10),
  // Tope del backoff: nunca esperar más de 5 min entre reintentos.
  RECONNECT_MAX_MS: parseInt(process.env.RECONNECT_MAX_MS || '300000', 10),
  // Máx. reintentos seguidos antes de rendirse y pedir reinicio manual.
  // Se resetea a 0 cada vez que la conexión abre bien.
  RECONNECT_MAX_ATTEMPTS: parseInt(process.env.RECONNECT_MAX_ATTEMPTS || '10', 10),

  // ---- Rendimiento: caché de metadatos de grupo ----
  // Cuánto dura en caché el resultado de groupMetadata() (ms).
  GROUP_META_TTL_MS: parseInt(process.env.GROUP_META_TTL_MS || '45000', 10),
  // Máx. grupos en esa caché.
  GROUP_META_CACHE_MAX: parseInt(process.env.GROUP_META_CACHE_MAX || '100', 10),

  // ---- Antispam: memoria ----
  // Máx. usuarios distintos guardados en memoria.
  ANTISPAM_MAX_USERS: parseInt(process.env.ANTISPAM_MAX_USERS || '500', 10),
  // Tiempo sin actividad tras el cual se olvida a un usuario (ms).
  ANTISPAM_USER_TTL_MS: parseInt(process.env.ANTISPAM_USER_TTL_MS || String(30 * 60 * 1000), 10),
  // Tiempo sin infracciones tras el cual los warns se resetean (ms).
  ANTISPAM_WARN_DECAY_MS: parseInt(process.env.ANTISPAM_WARN_DECAY_MS || String(60 * 60 * 1000), 10),
};
