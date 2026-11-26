// tests/commands.test.js — Los nombres de los comandos no cambian.
// Solo comandos puros (sin disco ni WhatsApp): !ping, !menu, !info,
// !antispam de no-dueño y comando desconocido.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { procesarComando } = require('../src/commands');
const config = require('../config');

describe('comandos (nombres y respuestas básicas)', () => {
  it('!ping responde pong', async () => {
    assert.equal(await procesarComando('!ping', {}), 'pong 🏓');
  });

  it('!menu lista los comandos de grupo, economía y gacha', async () => {
    const menu = await procesarComando('!menu', {});
    for (const cmd of ['!kick', '!balance', '!rollwaifu', '!profile', '!tagall', '!antispam']) {
      assert.ok(menu.includes(cmd), `el menú debería incluir ${cmd}`);
    }
  });

  it('!info no muestra el número completo del dueño', async () => {
    const info = await procesarComando('!info', {});
    assert.ok(!info.includes(config.OWNER_NUMBER), 'el número del dueño no debe salir completo');
    assert.ok(info.includes('****'), 'debería salir enmascarado');
  });

  it('!antispam es solo para el dueño', async () => {
    const r = await procesarComando('!antispam', { esDueno: false });
    assert.match(r, /solo para el dueño/);
  });

  it('un comando desconocido sugiere el menú y no rompe nada', async () => {
    const r = await procesarComando('!noexiste123', {});
    assert.match(r, /menu/);
  });

  it('un texto sin prefijo no es un comando', async () => {
    assert.equal(await procesarComando('hola, qué onda', {}), null);
  });
});
