// ============================================
// src/level.js — Niveles y XP por mensaje (todo local)
//
// Cada mensaje que pasa el antispam da XP. El nivel sube con
// la raíz cuadrada del XP: nivel n necesita 100*n^2 de XP.
// Guardado en data/level.json.
// ============================================

const { load, save, saveSoon } = require('./store');
const config = require('../config');

const ARCHIVO = 'level.json';

function nivelPara(xp) {
  return Math.floor(Math.sqrt(xp / 100));
}

function xpParaNivel(n) {
  return 100 * n * n;
}

function estado() {
  return load(ARCHIVO, { users: {} });
}

function guardar(e) {
  save(ARCHIVO, e);
}

function usuario(e, numero) {
  if (!e.users[numero]) e.users[numero] = { xp: 0, level: 0, msgs: 0 };
  return e.users[numero];
}

// Suma XP a un usuario. Devuelve si subió de nivel.
// El XP es poco crítico: se guarda diferido (saveSoon) para no
// escribir el disco en cada mensaje; flushAll() lo vuelca al apagar.
function agregarXp(numero) {
  const e = estado();
  const u = usuario(e, numero);
  const antes = u.level;
  const gano = config.XP_MIN + Math.floor(Math.random() * (config.XP_MAX - config.XP_MIN + 1));
  u.xp += gano;
  u.msgs += 1;
  u.level = nivelPara(u.xp);
  saveSoon(ARCHIVO, e);
  return { xp: u.xp, nivel: u.level, subio: u.level > antes };
}

function datos(numero) {
  return usuario(estado(), numero);
}

function textoNivel(numero) {
  const u = datos(numero);
  const actual = xpParaNivel(u.level);
  const siguiente = xpParaNivel(u.level + 1);
  const progreso = Math.max(0, u.xp - actual);
  const total = Math.max(1, siguiente - actual);
  const bloques = Math.round((progreso / total) * 10);
  const barra = '▰'.repeat(bloques) + '▱'.repeat(10 - bloques);
  return [
    `📈 *Nivel ${u.level}*`,
    '',
    `XP: ${u.xp} (${progreso}/${total} para el nivel ${u.level + 1})`,
    barra,
    `Mensajes contados: ${u.msgs}`,
  ].join('\n');
}

module.exports = { agregarXp, datos, textoNivel, nivelPara, xpParaNivel };
