// ============================================
// src/afk.js — Estado AFK (todo local)
//
// !afk <motivo> te marca ausente. Cualquier mensaje tuyo
// después te quita el AFK. Si alguien te menciona estando AFK,
// el bot avisa. Guardado en data/afk.json.
// ============================================

const { load, save } = require('./store');

const ARCHIVO = 'afk.json';

function estado() {
  return load(ARCHIVO, { users: {} });
}

function guardar(e) {
  save(ARCHIVO, e);
}

function numeroDe(jid) {
  return (jid || '').split('@')[0].split(':')[0];
}

function ponerAfk(numero, motivo) {
  const e = estado();
  e.users[numero] = { motivo: motivo || 'sin motivo', desde: Date.now() };
  guardar(e);
}

function quitarAfk(numero) {
  const e = estado();
  if (!e.users[numero]) return false;
  delete e.users[numero];
  guardar(e);
  return true;
}

function estaAfk(numero) {
  return !!estado().users[numero];
}

// Dada una lista de JIDs mencionados, devuelve los que están AFK.
function revisarMenciones(jids = []) {
  const e = estado();
  return jids
    .map(jid => {
      const numero = numeroDe(jid);
      const reg = e.users[numero];
      return reg ? { numero, motivo: reg.motivo } : null;
    })
    .filter(Boolean);
}

module.exports = { ponerAfk, quitarAfk, estaAfk, revisarMenciones };
