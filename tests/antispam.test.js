// tests/antispam.test.js — Antispam (sin frameworks, solo node:test)
// Todo en memoria: resetStats() limpia entre pruebas. No toca disco
// ni WhatsApp. Date.now se puede adelantar para probar la limpieza.
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const antispam = require('../src/antispam');
const config = require('../config');

function mensaje(sender, texto, { reenviado = false } = {}) {
  const contextInfo = reenviado ? { isForwarded: true } : {};
  return {
    key: { remoteJid: '123456@g.us', participant: `${sender}@s.whatsapp.net` },
    message: { extendedTextMessage: { text: texto, contextInfo } },
  };
}

beforeEach(() => antispam.resetStats());

describe('antispam', () => {
  it('un mensaje normal pasa', () => {
    const r = antispam.revisarMensaje(mensaje('5211111111111', 'hola we, qué onda'), {});
    assert.equal(r.allowed, true);
  });

  it('el dueño no crea entrada en memoria (bypass antes de guardar estado)', () => {
    const antes = antispam.contarUsuarios();
    const r = antispam.revisarMensaje(mensaje(config.OWNER_NUMBER, 'hola'), {});
    assert.equal(r.allowed, true);
    assert.equal(antispam.contarUsuarios(), antes);
  });

  it('mandar en ráfaga mutea (más de MAX_MSG_PER_MIN en un minuto)', () => {
    const sender = '5212222222222';
    let ultimo;
    for (let i = 0; i < config.MAX_MSG_PER_MIN + 1; i++) {
      ultimo = antispam.revisarMensaje(mensaje(sender, `mensaje ${i}`), {});
    }
    assert.equal(ultimo.allowed, false);
    assert.equal(ultimo.reason, 'rate-limit-min');
    assert.equal(ultimo.action, 'mute');
  });

  it('repetir el mismo texto más de MAX_SAME_MSG veces se bloquea', () => {
    const sender = '5213333333333';
    let ultimo;
    for (let i = 0; i < config.MAX_SAME_MSG + 1; i++) {
      ultimo = antispam.revisarMensaje(mensaje(sender, 'lo mismo de siempre'), {});
    }
    assert.equal(ultimo.allowed, false);
    assert.equal(ultimo.reason, 'mensaje-repetido');
  });

  it('la purga borra usuarios inactivos (TTL) y no deja crecer el Map', () => {
    antispam.revisarMensaje(mensaje('5214444444444', 'hola'), {});
    antispam.revisarMensaje(mensaje('5215555555555', 'hola'), {});
    assert.equal(antispam.contarUsuarios(), 2);
    // 31 minutos en el futuro: fuera del TTL de 30 min.
    const quedan = antispam.purgarUsuarios(Date.now() + 31 * 60 * 1000);
    assert.equal(quedan, 0);
    assert.equal(antispam.contarUsuarios(), 0);
  });

  it('los warns se resetean si el usuario no reincide (decay)', () => {
    const sender = '5216666666666';
    const jid = `${sender}@s.whatsapp.net`;
    // Provoca un warn por mensaje repetido.
    for (let i = 0; i < config.MAX_SAME_MSG + 1; i++) {
      antispam.revisarMensaje(mensaje(sender, 'spam spam'), {});
    }
    assert.ok((antispam.verUsuario(jid) || {}).warns >= 1, 'debería tener al menos 1 warn');
    const realNow = Date.now;
    try {
      // 61 minutos después: el warn ya decayó. Un mensaje normal
      // lo comprueba: el contador vuelve a 0.
      Date.now = () => realNow() + 61 * 60 * 1000;
      const r = antispam.revisarMensaje(mensaje(sender, 'ya me porté bien'), {});
      assert.equal(r.allowed, true);
      assert.equal(antispam.verUsuario(jid).warns, 0);
    } finally {
      Date.now = realNow;
    }
  });

  it('mascaraJid no deja ver el número completo en los logs', () => {
    const m = antispam.mascaraJid('5215512345678@s.whatsapp.net');
    assert.ok(!m.includes('5215512345678'), m);
    assert.ok(m.includes('****'), m);
    assert.ok(m.endsWith('@s.whatsapp.net'), m);
  });
});
