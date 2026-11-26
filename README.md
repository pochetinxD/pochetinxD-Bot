# 卩ㄖ匚卄乇ㄒ|几乂ᗪ'丂 乃ㄖㄒ — WhatsApp con Baileys + Antispam

Bot propio de WhatsApp con [Baileys](https://github.com/WhiskeySockets/Baileys) y un sistema antispam hecho a propósito para **no parecer spam**: que WhatsApp no piense que andas vendiendo mierda en internet reenviando de todo.

> ⚠️ **Aviso serio, wey:** Baileys es **NO oficial**. El antispam baja mucho el riesgo, pero **no te hace inmune al ban**. Si usas tu número principal, lo haces bajo tu propio riesgo. Lo ideal es probarlo primero con un número secundario.

## Qué trae

- `index.js` — conexión con Baileys, QR, auto-reconexión, XP y AFK
- `src/antispam.js` — el sistema antispam (el corazón del bot)
- `src/commands.js` — router de todos los comandos
- `src/group.js` — comandos de grupo: kick, warns, tagall, antilink
- `src/economy.js` — monedas, daily, trabajo, apuestas, tienda (local)
- `src/gacha.js` — gacha con 12 personajes inventados (solo texto)
- `src/level.js` — XP por mensaje y niveles
- `src/afk.js` — estado AFK
- `src/store.js` — guardado local en JSON (`data/`)
- `config.js` — todos los límites en un solo lugar, en español
- Sesión guardada en `./auth_info` (no se sube a git)

## Comandos

Todos con prefijo `!` y pasando por el antispam. Sin APIs externas.

### 💰 Economía (monedas de juego, sin dinero real)

| Comando | Qué hace |
|---|---|
| `!balance` | Tus monedas |
| `!daily` | Monedas diarias (1 vez al día, 50–150) |
| `!work` | Trabajar (cada 10 min, 10–40) |
| `!coinflip cara\|cruz <apuesta>` | Volado (apuesta 10–500) |
| `!slot <apuesta>` | Tragamonedas: triple x5, par x2 |
| `!givecoins @usuario <cantidad>` | Regalar monedas (máx 1000) |
| `!shop` | Tienda de coleccionables |
| `!buy <id>` | Comprar un artículo |
| `!inventory` | Tu inventario |
| `!top` | Top 5 de monedas |

### 🎲 Gacha (local, solo texto, 12 personajes inventados)

| Comando | Qué hace |
|---|---|
| `!rollwaifu` | Tira un personaje al azar (cada 10 min) |
| `!claim` | Reclamar tu último roll |
| `!harem` | Tus personajes reclamados |
| `!charinfo <nombre>` | Info de un personaje |

Rarezas: común 60%, rara 25%, épica 12%, legendaria 3%. Cada personaje solo puede tener un dueño.

### 👤 Perfil y niveles

| Comando | Qué hace |
|---|---|
| `!profile` | Tu nivel, XP, monedas y harem |
| `!level` | Tu nivel y barra de XP |
| `!afk <motivo>` | Marcarte ausente (cualquier mensaje tuyo lo quita) |

Cada mensaje que pasa el antispam da 5–15 XP. Al subir de nivel el bot te avisa.

### 👥 Grupo (solo admins del grupo)

| Comando | Qué hace |
|---|---|
| `!kick` | Expulsar (responde, menciona o pon el número) |
| `!promote` / `!demote` | Dar/quitar admin |
| `!tagall` | Mencionar a todos (cooldown 60s) |
| `!groupinfo` | Info del grupo |
| `!warn` | Poner un aviso (3 avisos = expulsión) |
| `!warns` | Ver avisos del grupo |
| `!delwarn` | Quitar un aviso |
| `!open` / `!close` | Abrir/cerrar el grupo |
| `!link` | Link de invitación |
| `!antilink on/off` | Borrar links de no-admins |

### 🤖 Bot

| Comando | Qué hace |
|---|---|
| `!ping` | Responde `pong 🏓` |
| `!help` / `!menu` | Muestra el menú |
| `!info` | Info del bot y límites antispam |
| `!status` | Estado: uptime y stats del antispam |
| `!antispam` | Estado del antispam (solo dueño) |
| `!antispam reset` | Limpia las stats (solo dueño) |

## Cómo instalar y correr

```bash
# 1. Entra a la carpeta
cd whatsapp-bot

# 2. Instala dependencias
npm install

# 3. Configura tu número de dueño
cp .env.example .env
# Abre .env y pon tu número en OWNER_NUMBER, ej: 5215512345678
# O edítalo directo en config.js

# 4. Corre el bot
npm start
```

Te va a salir un **QR en la terminal**. Escanéalo con:

WhatsApp → ⋮ → **Dispositivos vinculados** → **Vincular un dispositivo**

La sesión queda guardada en `auth_info/`. La próxima vez ya no pide QR, entra directo. Si cierras sesión desde el teléfono, borra esa carpeta y vuelve a escanear.

Para verificar que todo está bien sin conectar:

```bash
npm run check
```

## Cómo funciona el antispam

La idea es simple: **WhatsApp banea por patrones, no por un mensaje**. El bot revisa cada mensaje *antes* de responder:

1. **Rate limiting por usuario** — máx. 8 mensajes por minuto y 30 por 10 minutos (en grupos es más estricto, ×0.7). Si te pasas, te mutea 60 segundos.
2. **Flood / repetidos** — si mandas el mismo texto 3+ veces en 2 minutos, te advierte y lo bloquea.
3. **Reenviados controlados** — máx. 5 reenviados por hora por usuario y máx. 3 en ráfaga de 5 minutos. Esto es lo más importante: reenviar de todo en cadena es la señal #1 de spam.
4. **Links y menciones** — máx. 2 links por mensaje y 5 links por 10 minutos, máx. 3 menciones por mensaje. Además hay un *spam score*: palabras típicas de venta/cripto, todo en mayúsculas, etc. Si el puntaje pasa el umbral, se bloquea.
5. **Comportamiento humano** — el bot **nunca** responde al instante: espera entre 0.8 y 2.5 segundos con jitter aleatorio, muestra “escribiendo...”, y **solo responde a comandos con `!`**. Responder a todo es lo que más huele a robot.
6. **Bypass y listas** — el dueño y la whitelist nunca pasan por el antispam. La blocklist se ignora de plano.

Todo lo bloqueado se loguea en consola con `[ANTISPAM] [BLOQUEADO/MUTEADO]` para que veas qué está pasando. El dueño puede ver las stats con `!antispam`.

## Cómo ajustar los límites

En `config.js` o en `.env`:

```env
MAX_MSG_PER_MIN=8          # mensajes por minuto por usuario
MAX_MSG_PER_10MIN=30       # mensajes por 10 min
MUTE_SECONDS=60            # segundos de mute al pasarse
MAX_FORWARDED_PER_HOUR=5   # reenviados por hora (bájalo a 3 si eres paranoico)
MAX_FORWARDED_BURST=3      # reenviados seguidos en 5 min
MAX_LINKS_PER_MSG=2
SPAM_SCORE_THRESHOLD=5     # más alto = más permisivo, más bajo = más estricto
GROUP_ONLY_ADMINS=false    # true = en grupos solo obedecen admins
IGNORE_GROUPS=false        # true = ignora grupos por completo
```

Si el bot te mutea mucho a ti o a tus amigos, sube los números o mételos en `WHITELIST`. Si te sigue marcando spam, bájalos.

## Consejos para no te baneen (aunque tengas antispam)

1. **Calienta el número**: no lo metas a 20 grupos el primer día. Empieza tranqui, habla normal unos días.
2. **No reenvíes en cadena**: ni tú ni los usuarios del bot. El antispam ya lo limita, pero el hábito ayuda.
3. **No lo uses para vender masivo**: si mandas la misma promo a 100 personas, te van a banear con o sin antispam.
4. **No respondas a todo**: este bot solo contesta comandos, por diseño. No le pongas autorespuesta a cada mensaje.
5. **Usa un número secundario primero**: prueba ahí, y si todo bien después de una o dos semanas, decides si lo pasas al principal.
6. **No abuses de los grupos**: en grupos el filtro es más estricto por algo. Si quieres, pon `IGNORE_GROUPS=true` y úsalo solo en privado.

## Estructura

```
whatsapp-bot/
├── index.js            # conexión + QR + auto-reconexión + XP/AFK/antilink
├── config.js           # configuración y límites
├── src/
│   ├── antispam.js     # sistema antispam
│   ├── commands.js     # router: !ping, economía, gacha, grupo...
│   ├── group.js        # kick, warns, tagall, antilink
│   ├── economy.js      # monedas, daily, apuestas, tienda
│   ├── gacha.js        # roll/claim/harem (personajes locales)
│   ├── level.js        # XP y niveles
│   ├── afk.js          # estado AFK
│   └── store.js        # guardado local en JSON
├── data/
│   ├── waifus.json         # catálogo de gacha (12 inventados, sí se sube)
│   ├── *.example.json      # ejemplos de economy/level/warns/gacha/afk
│   └── *.json              # datos reales (NO se suben a git)
├── .env.example        # ejemplo de variables
├── .gitignore          # auth_info, node_modules, .env, data/*.json
├── auth_info/          # sesión (se crea al escanear QR)
└── package.json
```

## Lo que NO tiene (a propósito)

- **Sin APIs externas**: nada de descargas (YouTube, TikTok, Instagram...), nada de imágenes de anime por API, nada de NSFW. Todo es local: si algo necesitaba una API, se dejó fuera.
- **Sin comandos de dueño peligrosos**: no hay `exec`, `eval`, `restart` ni `update` por chat. Eso es una puerta abierta a que te hackeen el bot.
- **Sin stickers**: convertir imágenes a sticker necesita ffmpeg y es otro rollo; no está en esta versión.
- **Sin respuestas automáticas a todo**: el bot solo contesta comandos con `!`, por diseño, para no parecer robot.

## Si algo falla

- **“Sesión cerrada / logged out”**: borra `auth_info/` y vuelve a escanear el QR.
- **Se desconecta y reconecta solo**: normal, es el auto-reconnect. Si se repite cada rato, revisa tu internet.
- **El QR no sale**: corre `npm start` de nuevo; el QR solo se muestra cuando no hay sesión guardada.
- **“No me responde”**: revisa que le mandes un comando con `!` y que no estés muteado por el antispam (mira la consola, ahí dice `[ANTISPAM]`).

Hecho para Alan. Musulmán 🗣️🔥
