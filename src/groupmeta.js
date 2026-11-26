// ============================================
// src/groupmeta.js — Caché de metadatos de grupo
//
// Antes index.js llamaba a sock.groupMetadata() en CADA
// mensaje de grupo, aunque no fuera un comando. WhatsApp
// contesta lo mismo durante un rato, así que se guarda el
// resultado 45s (config.GROUP_META_TTL_MS) y con un tope
// de grupos en memoria. Sin APIs externas, solo Baileys.
// ============================================

const config = require('../config');

// jid del grupo -> { meta, at }
const cache = new Map();

function ttlMs() {
  return config.GROUP_META_TTL_MS || 45000;
}

function maxEntradas() {
  return config.GROUP_META_CACHE_MAX || 100;
}

// Devuelve los metadatos del grupo, de caché si siguen frescos.
async function obtenerMetaGrupo(sock, jid) {
  const ahora = Date.now();
  const hit = cache.get(jid);
  if (hit && ahora - hit.at < ttlMs()) return hit.meta;
  const meta = await sock.groupMetadata(jid);
  // Si la caché está llena, saca la entrada más vieja (LRU simple).
  if (cache.size >= maxEntradas()) {
    let claveVieja = null;
    let atViejo = Infinity;
    for (const [k, v] of cache) {
      if (v.at < atViejo) { atViejo = v.at; claveVieja = k; }
    }
    if (claveVieja) cache.delete(claveVieja);
  }
  cache.set(jid, { meta, at: ahora });
  return meta;
}

// Para pruebas: cuántas entradas hay y vaciar la caché.
function tamanoCache() {
  return cache.size;
}

function limpiarCache() {
  cache.clear();
}

module.exports = { obtenerMetaGrupo, tamanoCache, limpiarCache };
