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
// ============================================

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Lee un JSON. Si no existe o está roto, devuelve una copia del valor por defecto.
function load(nombre, porDefecto) {
  ensureDir();
  const ruta = path.join(DATA_DIR, nombre);
  try {
    const raw = fs.readFileSync(ruta, 'utf8');
    return JSON.parse(raw);
  } catch {
    return JSON.parse(JSON.stringify(porDefecto));
  }
}

// Guarda un JSON. Escribe a un archivo temporal y lo renombra,
// para no dejar el archivo a medias si el bot se apaga de golpe.
function save(nombre, datos) {
  ensureDir();
  const ruta = path.join(DATA_DIR, nombre);
  const tmp = ruta + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(datos, null, 2), 'utf8');
  fs.renameSync(tmp, ruta);
}

module.exports = { load, save, DATA_DIR };
