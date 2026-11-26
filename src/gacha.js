// ============================================
// src/gacha.js — Gacha local, sin APIs ni imágenes
//
// Los personajes son inventados (data/waifus.json) y todo es
// texto: nada de fotos de internet ni APIs de anime.
// Cada personaje solo puede tener un dueño por bot.
// ============================================

const { load, save } = require('./store');
const config = require('../config');

const ARCHIVO = 'gacha.json';
const CATALOGO = require('../data/waifus.json');

// Probabilidades de cada rareza al tirar.
const PESOS = [
  { rareza: 'común', peso: 60 },
  { rareza: 'rara', peso: 25 },
  { rareza: 'épica', peso: 12 },
  { rareza: 'legendaria', peso: 3 },
];

const ESTRELLAS = { 'común': '⭐', 'rara': '⭐⭐', 'épica': '⭐⭐⭐', 'legendaria': '⭐⭐⭐⭐' };

function estado() {
  return load(ARCHIVO, { users: {}, duenos: {} });
}

function guardar(e) {
  save(ARCHIVO, e);
}

function usuario(e, numero) {
  if (!e.users[numero]) e.users[numero] = { lastRoll: 0, lastWaifu: null, harem: [] };
  return e.users[numero];
}

function formatoTiempo(ms) {
  const s = Math.ceil(ms / 1000);
  if (s >= 60) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${s}s`;
}

function sortearRareza() {
  const total = PESOS.reduce((a, p) => a + p.peso, 0);
  let tiro = Math.random() * total;
  for (const p of PESOS) {
    tiro -= p.peso;
    if (tiro <= 0) return p.rareza;
  }
  return 'común';
}

function roll(numero) {
  const e = estado();
  const u = usuario(e, numero);
  const espera = u.lastRoll + config.ROLL_COOLDOWN_MS - Date.now();
  if (espera > 0) return `⏳ Espera ${formatoTiempo(espera)} para volver a tirar, we.`;
  const rareza = sortearRareza();
  let candidatas = CATALOGO.filter(w => w.rareza === rareza);
  if (!candidatas.length) candidatas = CATALOGO;
  const waifu = candidatas[Math.floor(Math.random() * candidatas.length)];
  u.lastRoll = Date.now();
  u.lastWaifu = waifu.id;
  guardar(e);
  const dueno = e.duenos[waifu.id];
  const estadoDueno = dueno
    ? (dueno === numero ? 'ya es tuya' : `ya tiene dueño (@${dueno})`)
    : 'libre, usa !claim';
  return [
    '🎲 *Roll*',
    '',
    `*${waifu.nombre}* — ${waifu.serie}`,
    `Rareza: ${waifu.rareza} ${ESTRELLAS[waifu.rareza] || '⭐'}`,
    waifu.desc,
    '',
    `Estado: ${estadoDueno}`,
    `ID: ${waifu.id}`,
  ].join('\n');
}

function claim(numero) {
  const e = estado();
  const u = usuario(e, numero);
  if (!u.lastWaifu) return 'Primero tira con !rollwaifu, we.';
  const waifu = CATALOGO.find(w => w.id === u.lastWaifu);
  if (!waifu) return 'Ese roll ya no existe, tira de nuevo con !rollwaifu.';
  const dueno = e.duenos[waifu.id];
  if (dueno === numero) return `${waifu.nombre} ya es tuya, we.`;
  if (dueno) return `${waifu.nombre} ya tiene dueño (@${dueno}). Tira de nuevo con !rollwaifu.`;
  e.duenos[waifu.id] = numero;
  if (!u.harem.includes(waifu.id)) u.harem.push(waifu.id);
  guardar(e);
  return `💍 ¡${waifu.nombre} ahora es tuya! La agregué a tu harem (!harem).`;
}

function cantidadHarem(numero) {
  return usuario(estado(), numero).harem.length;
}

function haremTexto(numero) {
  const e = estado();
  const u = usuario(e, numero);
  if (!u.harem.length) return 'Tu harem está vacío, we. Tira con !rollwaifu y luego !claim.';
  const lineas = u.harem.map(id => {
    const w = CATALOGO.find(x => x.id === id);
    return w ? `• ${w.nombre} (${w.serie}) — ${w.rareza}` : `• ${id}`;
  });
  return [`💞 *Tu harem* (${u.harem.length})`, '', ...lineas].join('\n');
}

function charinfo(busqueda) {
  const q = (busqueda || '').toLowerCase().trim();
  if (!q) return 'Pon un nombre o ID. Ejemplo: `!charinfo luna`.';
  const w = CATALOGO.find(x => x.id === q || x.nombre.toLowerCase().includes(q));
  if (!w) return 'No encontré a ese personaje en el catálogo local.';
  const e = estado();
  const dueno = e.duenos[w.id];
  return [
    `*${w.nombre}* — ${w.serie}`,
    '',
    `Rareza: ${w.rareza} ${ESTRELLAS[w.rareza] || '⭐'}`,
    w.desc,
    '',
    `Dueño: ${dueno ? `@${dueno}` : 'nadie (libre)'}`,
    `ID: ${w.id}`,
  ].join('\n');
}

module.exports = { roll, claim, cantidadHarem, haremTexto, charinfo, CATALOGO };
