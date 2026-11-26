// tests/group.test.js — Permisos de grupo (solo node:test)
// Usa un grupo de prueba con JID inventado y un socket falso que
// registra las llamadas a Baileys sin tocar WhatsApp.
// Los avisos se guardan en data/warns.json: se borra al terminar
// si la prueba lo creó (antes no existía).
const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const grupo = require('../src/group');
const store = require('../src/store');
const config = require('../config');

const GID = '9999999999-1111111111@g.us';
const BOT = '5219999999999@s.whatsapp.net';
const DUENO = `${config.OWNER_NUMBER}@s.whatsapp.net`;
const CREADOR = '5211111111111@s.whatsapp.net';
const ADMIN = '5212222222222@s.whatsapp.net';
const ADMIN2 = '5212222222223@s.whatsapp.net';
const NORMAL = '5213333333333@s.whatsapp.net';

function meta() {
  return {
    id: GID,
    subject: 'Grupo de prueba',
    creation: 1700000000,
    desc: 'prueba',
    participants: [
      { id: BOT, admin: 'admin' },
      { id: DUENO, admin: 'admin' },
      { id: CREADOR, admin: 'superadmin' },
      { id: ADMIN, admin: 'admin' },
      { id: ADMIN2, admin: 'admin' },
      { id: NORMAL, admin: null },
    ],
  };
}

function ctxFalso({ sender = ADMIN, esDueno = false } = {}) {
  const llamadas = [];
  const sock = {
    user: { id: BOT },
    groupParticipantsUpdate: async (gid, jids, accion) => {
      llamadas.push({ gid, jids, accion });
    },
    groupMetadata: async () => meta(),
    groupSettingUpdate: async () => {},
    groupInviteCode: async () => 'ABC123',
  };
  return {
    ctx: {
      jid: GID, sender, esDueno, isGroup: true, isAdmin: true, isBotAdmin: true,
      sock, metaGrupo: meta(),
    },
    llamadas,
  };
}

after(() => {
  store.clearCache();
  for (const nombre of ['warns.json', 'antilink.json']) {
    try { fs.unlinkSync(path.join(store.DATA_DIR, nombre)); } catch { /* no existía */ }
  }
});

describe('permisos de grupo', () => {
  it('un admin NO puede expulsar a otro admin (solo el dueño)', async () => {
    const { ctx, llamadas } = ctxFalso({ sender: ADMIN2 });
    const r = await grupo.expulsar(ctx, ADMIN);
    assert.match(String(typeof r === 'string' ? r : r.text), /admin/);
    assert.equal(llamadas.length, 0, 'no se debe llamar a Baileys');
  });

  it('ni el dueño puede expulsar al creador del grupo (superadmin)', async () => {
    const { ctx, llamadas } = ctxFalso({ sender: DUENO, esDueno: true });
    const r = await grupo.expulsar(ctx, CREADOR);
    assert.match(String(typeof r === 'string' ? r : r.text), /creador/);
    assert.equal(llamadas.length, 0);
  });

  it('nadie puede expulsar al dueño ni al bot', async () => {
    const { ctx, llamadas } = ctxFalso({ sender: ADMIN });
    assert.match(await grupo.expulsar(ctx, DUENO), /dueño/);
    assert.match(await grupo.expulsar(ctx, BOT), /bot/);
    assert.equal(llamadas.length, 0);
  });

  it('expulsar a un miembro normal sí funciona', async () => {
    const { ctx, llamadas } = ctxFalso({ sender: ADMIN });
    const r = await grupo.expulsar(ctx, NORMAL);
    assert.equal(llamadas.length, 1);
    assert.equal(llamadas[0].accion, 'remove');
    assert.match(r.text, /Expulsé/);
  });

  it('degradar al creador está bloqueado y promover a un admin avisa que ya lo es', async () => {
    const { ctx, llamadas } = ctxFalso({ sender: ADMIN });
    assert.match(await grupo.degradar(ctx, CREADOR), /creador/);
    assert.match(await grupo.promover(ctx, ADMIN), /ya es admin/);
    assert.equal(llamadas.length, 0);
  });

  it('los avisos a un admin nunca terminan en expulsión', async () => {
    const { ctx, llamadas } = ctxFalso({ sender: ADMIN });
    let r;
    for (let i = 0; i < config.WARN_LIMIT; i++) {
      r = await grupo.advertir(ctx, ADMIN, `falta ${i + 1}`);
    }
    assert.match(r.text, /es admin y no lo expulso/);
    assert.equal(llamadas.filter(l => l.accion === 'remove').length, 0);
  });

  it('infoGrupo y tagall no tiran excepciones si Baileys falla', async () => {
    const sockRoto = {
      user: { id: BOT },
      groupMetadata: async () => { throw new Error('sin red'); },
    };
    const ctx = { jid: GID, sender: ADMIN, esDueno: false, isGroup: true, isAdmin: true, isBotAdmin: true, sock: sockRoto, metaGrupo: null };
    assert.match(await grupo.infoGrupo(ctx), /Inténtalo de nuevo/);
    assert.match(await grupo.mencionarATodos(ctx), /Inténtalo de nuevo/);
  });
});
