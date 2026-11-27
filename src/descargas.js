// ============================================
// src/descargas.js — Descarga de videos con yt-dlp
//
// !dl <link> baja el video de TikTok, YouTube, Instagram
// o Facebook y el bot lo manda al chat.
//
// Cómo funciona:
// - yt-dlp es el que descarga (binario aparte, no es una API
//   ni librería de Node: hay que instalarlo en el servidor,
//   ver scripts/instalar-oracle.sh y docs/ORACLE.md).
// - Se baja un solo archivo, máximo 720p, sin playlist.
// - El archivo vive en una carpeta temporal y SE BORRA
//   después de mandarlo (index.js lo borra tras el envío).
//   Si se guardara, el disco se llena en semanas.
// - WhatsApp solo acepta ~16 MB como video directo: si pesa
//   más, se manda como documento (hasta 100 MB por default).
//
// Ojo: TikTok, Instagram y Facebook a veces bloquean las
// descargas desde IPs de centro de datos o piden login. Si
// eso pasa, se puede poner un archivo de cookies (formato
// Netscape) en COOKIES_FILE y yt-dlp lo usa. YouTube
// normalmente jala sin cookies.
// ============================================

const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const config = require('../config');

// Plataformas que se aceptan (el link tiene que ser de una).
const PLATAFORMAS = [
  { id: 'youtube', nombre: 'YouTube', regex: /(?:youtube\.com|youtu\.be)/i },
  { id: 'tiktok', nombre: 'TikTok', regex: /tiktok\.com/i },
  { id: 'instagram', nombre: 'Instagram', regex: /instagram\.com/i },
  { id: 'facebook', nombre: 'Facebook', regex: /(?:facebook\.com|fb\.watch)/i },
];

function detectarPlataforma(url) {
  if (typeof url !== 'string') return null;
  for (const p of PLATAFORMAS) {
    if (p.regex.test(url)) return p;
  }
  return null;
}

// ¿Es un link válido de una plataforma soportada?
function esUrlVideo(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  } catch {
    return false;
  }
  return detectarPlataforma(url) !== null;
}

// Cuántas descargas pueden correr a la vez (para no saturar
// RAM/disco si varios piden videos al mismo tiempo).
let descargasActivas = 0;
function maxSimultaneas() {
  return config.DESCARGA_MAX_SIMULTANEAS || 2;
}

function binYtDlp() {
  return config.YT_DLP_BIN || process.env.YT_DLP_BIN || 'yt-dlp';
}

// Corre yt-dlp y devuelve el stdout. Rechaza si tarda más
// de timeoutMs o si yt-dlp falla.
function correrYtDlp(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    execFile(binYtDlp(), args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const detalle = (stderr || err.message || '').trim().split('\n').slice(-2).join(' ');
        reject(new Error(detalle || err.message));
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Descarga un video. Devuelve { ruta, plataforma, tamanoMB, extension }.
 * La ruta es temporal: quien la recibe debe borrarla con
 * borrarDescarga() después de mandarla (index.js ya lo hace).
 * Lanza Error si el link no es soportado, si hay demasiadas
 * descargas a la vez, si yt-dlp falla o si el video pesa más
 * que DESCARGA_MAX_MB.
 */
async function descargarVideo(url, opciones = {}) {
  const plataforma = detectarPlataforma(url);
  if (!plataforma) {
    throw new Error('Ese link no es de TikTok, YouTube, Instagram o Facebook.');
  }
  if (descargasActivas >= maxSimultaneas()) {
    throw new Error('Ya estoy bajando otros videos, we. Espérame tantito y vuelve a intentar.');
  }
  const maxMB = opciones.maxMB || config.DESCARGA_MAX_MB || 100;
  const timeoutMs = opciones.timeoutMs || config.DESCARGA_TIMEOUT_MS || 180000;

  descargasActivas++;
  // Carpeta temporal única por descarga (se borra junto al archivo).
  const dirTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pochetinxd-dl-'));
  try {
    const args = [
      '-f', 'best[height<=720]/best',
      '--no-playlist',
      '--no-warnings',
      '-o', path.join(dirTmp, 'video.%(ext)s'),
    ];
    // Cookies opcionales para TikTok/IG/FB que piden login.
    const cookies = config.COOKIES_FILE || './cookies.txt';
    if (cookies && fs.existsSync(cookies)) args.push('--cookies', cookies);
    args.push(url);

    await correrYtDlp(args, timeoutMs);

    const archivos = fs.readdirSync(dirTmp)
      .map((n) => path.join(dirTmp, n))
      .filter((p) => fs.statSync(p).isFile());
    if (!archivos.length) {
      throw new Error('No se pudo bajar el video, we. El link a lo mejor es privado o la plataforma lo bloqueó.');
    }
    // Si quedó más de un archivo, nos quedamos con el más grande.
    archivos.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
    const ruta = archivos[0];
    const bytes = fs.statSync(ruta).size;
    const tamanoMB = bytes / (1024 * 1024);
    if (tamanoMB > maxMB) {
      borrarDescarga(ruta);
      throw new Error(`El video pesa ${tamanoMB.toFixed(1)} MB y el máximo es ${maxMB} MB, we.`);
    }
    return { ruta, plataforma, tamanoMB, extension: path.extname(ruta).slice(1) || 'mp4' };
  } catch (err) {
    // Limpieza: no dejar basura si falló a la mitad.
    try { fs.rmSync(dirTmp, { recursive: true, force: true }); } catch { /* mejor esfuerzo */ }
    throw err;
  } finally {
    descargasActivas--;
  }
}

// Borra el archivo descargado y su carpeta temporal. Solo toca
// rutas dentro de las carpetas temporales del bot, por seguridad.
function borrarDescarga(ruta) {
  try {
    if (!ruta || typeof ruta !== 'string') return;
    const tmp = os.tmpdir();
    if (!ruta.startsWith(tmp) || !ruta.includes('pochetinxd-dl-')) return;
    const dir = path.dirname(ruta);
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* mejor esfuerzo */ }
}

module.exports = {
  detectarPlataforma,
  esUrlVideo,
  descargarVideo,
  borrarDescarga,
  PLATAFORMAS,
};
