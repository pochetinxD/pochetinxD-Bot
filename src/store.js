// ============================================
// src/store.js — Guardado local en JSON
//
// Todo lo que el bot tiene que recordar (monedas, niveles,
// avisos, AFK, gacha) vive en archivos JSON dentro de data/.
// Nada sale a internet: no hay base de datos externa ni APIs.
//
// Los datos reales (data/*.json) NO se suben a git.
// El catálogo de gacha (data/waifus.json) y los ejemplos
// (data/*.example.json) sí se suben, son solo plantillas.
//
// Estabilidad (auditoría 2026-11-26):
// - Caché en memoria: load() lee del disco solo la primera vez;
//   después devuelve el mismo objeto. Esto elimina las 5-8
//   lecturas de disco por mensaje que había antes, y además
//   evita que dos lecturas seguidas vean estados distintos.
// - Escritura atómica con nombre temporal ÚNICO por escritura
//   (antes era siempre `*.tmp`, dos escrituras podían pisarse).
//   Se escribe, se hace fsync y se renombra: el archivo nunca
//   queda a medias aunque se apague el bot de golpe.
// - Si un JSON está corrupto, se mueve a `*.corrupt-<fecha>`
//   y se devuelve el valor por defecto, en vez de perder los
//   datos en silencio y sobrescribirlos con un vacío.
// - saveSoon(): para datos poco críticos (XP), junta varias
//   escrituras en una sola (debounce de 1s). flushAll() escribe
//   todo lo pendiente; se llama al apagar el bot.
// ============================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Caché: nombre de archivo -> objeto ya cargado (la MISMA
// referencia que devolvió load()). Quien lo muta y luego
// llama a save() persiste esos cambios; quien solo lee no
// toca el disco.
const cache = new Map();

// Escrituras poco críticas pendientes de vaciar:
// nombre -> { datos, timer }
const pendientes = new Map();
let contadorTmp = 0;

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function clonar(v) {
  return JSON.parse(JSON.stringify(v));
}

// Lee un JSON. Si no existe o está roto, devuelve una copia del valor por defecto.
function load(nombre, porDefecto) {
  if (cache.has(nombre)) return cache.get(nombre);
  ensureDir();
  const ruta = path.join(DATA_DIR, nombre);
  let datos;
  try {
    const raw = fs.readFileSync(ruta, 'utf8');
    datos = JSON.parse(raw);
    if (datos === null || typeof datos !== 'object') throw new Error('JSON no es un objeto');
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      // Archivo corrupto: apartarlo con fecha, no borrarlo ni
      // sobrescribirlo en silencio. Así se puede recuperar a mano.
      try {
        const respaldo = `${ruta}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
        fs.renameSync(ruta, respaldo);
        console.warn(`[STORE] ${nombre} estaba corrupto, lo moví a ${path.basename(respaldo)} y uso valores por defecto.`);
      } catch { /* si no se puede mover, igual se sigue con el default */ }
    }
    datos = clonar(porDefecto);
  }
  cache.set(nombre, datos);
  return datos;
}

// Escribe el contenido completo de forma atómica.
// El tmp es único por escritura: ni dos procesos ni dos
// llamadas seguidas pueden pisarse el archivo temporal.
function escribirAtomico(ruta, texto) {
  const tmp = `${ruta}.${process.pid}.${contadorTmp++}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, texto, 'utf8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, ruta);
  // fsync del directorio, mejor esfuerzo: en algunos SO no se puede.
  try {
    const dirFd = fs.openSync(path.dirname(ruta), 'r');
    try { fs.fsyncSync(dirFd); } finally { fs.closeSync(dirFd); }
  } catch { /* no crítico */ }
}

// Guarda un JSON de inmediato (para datos que no se pueden perder:
// monedas, gacha, avisos, AFK). Actualiza la caché y el disco.
function save(nombre, datos) {
  // Si había una escritura diferida pendiente, se cancela:
  // esta escritura inmediata ya lleva los datos más nuevos.
  const pendiente = pendientes.get(nombre);
  if (pendiente) {
    clearTimeout(pendiente.timer);
    pendientes.delete(nombre);
  }
  cache.set(nombre, datos);
  ensureDir();
  const ruta = path.join(DATA_DIR, nombre);
  escribirAtomico(ruta, JSON.stringify(datos, null, 2));
}

// Marca datos para guardarlos en breve (debounce). Para datos
// poco críticos (XP): junta muchas escrituras seguidas en una.
// Si el proceso se apaga, flushAll() escribe lo pendiente.
function saveSoon(nombre, datos, esperaMs = 1000) {
  cache.set(nombre, datos);
  const pendiente = pendientes.get(nombre);
  if (pendiente) clearTimeout(pendiente.timer);
  const timer = setTimeout(() => {
    pendientes.delete(nombre);
    try {
      ensureDir();
      escribirAtomico(path.join(DATA_DIR, nombre), JSON.stringify(datos, null, 2));
    } catch (err) {
      console.error(`[STORE] no pude guardar ${nombre} (diferido):`, err.message);
    }
  }, esperaMs);
  if (timer.unref) timer.unref();
  pendientes.set(nombre, { datos, timer });
}

// Escribe de inmediato todo lo que estaba pendiente con saveSoon.
// Se llama al apagar el bot (SIGINT/SIGTERM) y en las pruebas.
function flushAll() {
  for (const [nombre, pendiente] of pendientes.entries()) {
    clearTimeout(pendiente.timer);
    pendientes.delete(nombre);
    ensureDir();
    escribirAtomico(path.join(DATA_DIR, nombre), JSON.stringify(pendiente.datos, null, 2));
  }
}

// Para pruebas: vacía la caché (el siguiente load relee el disco).
function clearCache() {
  cache.clear();
}

module.exports = { load, save, saveSoon, flushAll, clearCache, DATA_DIR };
