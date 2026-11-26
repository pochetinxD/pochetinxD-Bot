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

// ---- Identidades: LID vs número de teléfono (@s.whatsapp.net) ----
// WhatsApp a veces manda IDs @lid en vez de @s.whatsapp.net. Un @lid
// NO es el número de teléfono: son dígitos distintos para la misma
// persona, así que comparar solo los dígitos del @lid contra el
// número nunca va a coincidir. Baileys 6.7.24 sí trae el puente en
// sus tipos (verificado en node_modules/@whiskeysockets/baileys):
//  - En los mensajes (WAMessageKey): participantPn / senderPn, el
//    número de teléfono cuando participant / remoteJid viene en @lid.
//  - En los participantes de grupo (Contact): id (en formato lid o
//    jid), lid? y jid? (el número en formato @s.whatsapp.net).
//  - En los metadatos del grupo: addressingMode ('pn' | 'lid').
// Por eso aquí nunca se compara un solo campo: se juntan TODAS las
// identidades conocidas y dos usuarios son el mismo si alguna coincide.
// Lo que Baileys 6.7.24 NO trae es una función para convertir un @lid
// en número de teléfono sin más datos (no hay getLid ni jidToLid):
// si un mensaje trae solo el @lid, sin Pn y sin su participante en
// los metadatos, no hay forma de saber su número. Eso no se inventa.

// Dígitos de un JID: '521...:12@s.whatsapp.net' -> '521...'
// Si es un objeto (participante o clave de mensaje), prefiere el
// número de teléfono (jid o phoneNumber) y cae al lid si es lo
// único que hay.
function digitosDe(valor) {
  if (valor == null) return '';
  if (typeof valor === 'object') {
    return digitosDe(valor.jid || valor.phoneNumber || valor.id || valor.lid || '');
  }
  return String(valor).split('@')[0].split(':')[0].replace(/\D/g, '');
}

// Todas las identidades (en dígitos) que se conocen de un usuario:
// el número de teléfono, el @lid y cualquier variante Pn/Lid del
// mensaje. Para un string es solo una; para un participante, varias.
function identidadesDe(valor) {
  const lista = [];
  const agregar = (v) => {
    const d = digitosDe(v);
    if (d && !lista.includes(d)) lista.push(d);
  };
  if (valor == null) return lista;
  if (typeof valor === 'object') {
    // Primero el teléfono, luego el lid, luego el resto.
    agregar(valor.jid);
    agregar(valor.phoneNumber);
    agregar(valor.participantPn);
    agregar(valor.senderPn);
    agregar(valor.id);
    agregar(valor.lid);
    agregar(valor.participantLid);
    agregar(valor.senderLid);
    return lista;
  }
  agregar(valor);
  return lista;
}

// ¿Son el mismo usuario? true si alguna identidad coincide.
// Ojo: mismaIdentidad('123@lid', '521...@s.whatsapp.net') es false,
// porque son dígitos distintos; el puente es el participante, que
// trae jid Y lid a la vez: mismaIdentidad(participante, '521...')
// es true por el jid.
function mismaIdentidad(a, b) {
  const idsA = identidadesDe(a);
  const idsB = identidadesDe(b);
  if (!idsA.length || !idsB.length) return false;
  return idsA.some((x) => idsB.includes(x));
}

// Busca un participante por cualquier identidad que traiga
// (id, lid, jid o phoneNumber). null si no está.
function buscarParticipante(participantes, identidad) {
  const lista = participantes || [];
  return lista.find((p) => mismaIdentidad(p, identidad)) || null;
}

// Número de teléfono (dígitos) de un usuario, si se conoce: su
// jid/phoneNumber, o el jid de su participante en el grupo.
// '' si solo se conoce su @lid.
function numeroTelefonoDe(valor, participantes) {
  if (valor != null && typeof valor === 'object') {
    const tel = digitosDe(valor.jid || valor.phoneNumber || '');
    if (tel) return tel;
  }
  if (typeof valor === 'string' && valor.includes('@s.whatsapp.net')) {
    return digitosDe(valor);
  }
  const part = participantes ? buscarParticipante(participantes, valor) : null;
  if (part) return digitosDe(part.jid || part.phoneNumber || '');
  return '';
}

module.exports = {
  obtenerMetaGrupo, tamanoCache, limpiarCache,
  digitosDe, identidadesDe, mismaIdentidad, buscarParticipante, numeroTelefonoDe,
};
