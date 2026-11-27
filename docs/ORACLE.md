# Host gratis en Oracle Cloud (Always Free)

El bot necesita estar prendido 24/7 con la conexión a WhatsApp abierta. Esta guía lo deja corriendo en un servidor gratis de Oracle, para siempre, sin pagar nada (si respetas los límites).

> **Costo estimado: $0 al mes.** El bot usa ~150-300 MB de RAM, casi nada de CPU y menos de 1 GB de salida al mes con 2,000 usos diarios. Los límites gratis son 2 OCPU, 12 GB de RAM, 200 GB de disco y 10 TB de salida al mes. Hasta con 1,000 videos descargados al día seguirías por debajo del 5%.

## 1. Crear la cuenta

1. Entra a [cloud.oracle.com/free](https://cloud.oracle.com/free) y crea la cuenta con tu correo.
2. Te pide una **tarjeta** para verificarte (hace un cargo temporal que se regresa; no te cobran si usas solo lo gratis).
3. Elige tu **home region** (región principal): no se puede cambiar después. Para México, prueba `us-ashburn-1` (Virginia, EEUU) o `sa-saopaulo-1` (Brasil). Si una no tiene capacidad, prueba la otra.
4. Te dan $300 de crédito de prueba por 30 días. **No crees nada de paga**: solo usa recursos marcados como **Always Free**, o al acabar el trial te empiezan a cobrar.

## 2. Crear el servidor

1. En la consola: **Compute → Instances → Create instance**.
2. Nombre: `pochetinxd-bot`.
3. **Shape:** `VM.Standard.A1.Flex` (Arm, el gratis). Pon **1 OCPU y 6 GB de RAM** (está dentro del gratis: 2 OCPU y 12 GB en total).
   - Si te dice **"Out of capacity"**, inténtalo otra vez más tarde o en otro Availability Domain. Es el problema más común del gratis; hay gente que lo logra tras varios intentos en días distintos.
   - Alternativa si el Arm no sale nunca: `VM.Standard.E2.1.Micro` (AMD, 1 GB de RAM). Al bot le alcanza, pero vas justo con las descargas.
4. **Image:** Ubuntu 22.04.
5. **Boot volume:** 50 GB (default, dentro de los 200 GB gratis).
6. **SSH:** genera un par de llaves en la consola y descarga la privada (`.key`). La vas a necesitar para conectarte.
7. **Red:** deja la VCN default y asegúrate de que tenga **IP pública** (para poder entrar por SSH).
8. Crea la instancia y espera a que diga **Running**.

## 3. Conectarte por SSH

Desde tu PC (con internet) o desde el celular con Termux:

```bash
chmod 400 tu-llave.key
ssh -i tu-llave.key ubuntu@<IP-pública-del-servidor>
```

## 4. Instalar el bot

```bash
git clone https://github.com/pochetinxD/pochetinxD-Bot.git ~/pochetinxd-bot
cd ~/pochetinxd-bot
bash scripts/instalar-oracle.sh
```

El script instala Node.js 20, git, yt-dlp (para `!dl`) y pm2, y deja el `.env` creado desde el ejemplo.

## 5. Configurar y vincular (primera vez)

```bash
nano .env
```

Pon por lo menos:

```env
OWNER_NUMBER=52xxxxxxxxxx
USE_PAIRING_CODE=true
PAIRING_PHONE=52xxxxxxxxxx
HEALTH_PORT=3000
```

Primera vinculación (en primer plano, para ver el código):

```bash
node index.js
```

Anota el código de 8 caracteres y vincúlalo en WhatsApp → Dispositivos vinculados → Vincular con número de teléfono. Cuando diga **"Conectado"**, haz Ctrl+C y arranca con pm2:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # corre el comando que te imprima, con sudo
```

La sesión queda guardada en `auth_info/` en el servidor: si el bot se reinicia, **no hay que volver a vincular**.

## 6. UptimeRobot (opcional, recomendado)

Te avisa si el bot se muere, y el ping cada 5 minutos es tráfico constante que ayuda contra la regla de Oracle de quitar servidores inactivos.

1. El bot ya trae health check: con `HEALTH_PORT=3000` en el `.env`, responde `ok` en `http://<IP>:3000/`.
2. Abre el puerto en Oracle: **Networking → Virtual Cloud Networks → tu VCN → Security Lists → Ingress Rules → Add**: `0.0.0.0/0`, TCP, puerto `3000`.
3. En el servidor, si `ufw` está activo: `sudo ufw allow 3000/tcp`.
4. En [uptimerobot.com](https://uptimerobot.com) crea una cuenta gratis y un monitor **HTTP(S)** a `http://<IP-pública>:3000/` cada 5 minutos. Plan gratis: 50 monitores, sin tarjeta.

## 7. Actualizar el bot

Cuando salga una versión nueva del repo:

```bash
cd ~/pochetinxd-bot
git pull
npm ci
pm2 restart pochetinxd-bot
```

No se borra la sesión ni los datos (`auth_info/` y `data/` no están en el repo).

## 8. Respaldo (hazlo de vez en cuando)

```bash
cd ~ && tar czf bot-backup.tar.gz pochetinxd-bot/auth_info pochetinxd-bot/data pochetinxd-bot/.env
```

Guarda ese archivo fuera del servidor. Si Oracle te quita la instancia, con eso la levantas en otra en minutos.

## Cosas que NO hay que hacer

- **No crees recursos de paga** (bases de datos, balanceadores, instancias más grandes): eso sí cobra.
- **No uses más de 2 OCPU / 12 GB en total** entre todas tus instancias gratis.
- **No dejes el servidor muerto 7 días seguidos** sin un solo mensaje: Oracle puede considerar inactiva la instancia y reclamarla (CPU, red y memoria por debajo del 20% durante 7 días). Con el bot en grupos activos y el ping de UptimeRobot, hay movimiento constante.
- **No subas tu `.env` ni `auth_info/` a ningún lado**: ahí está tu sesión de WhatsApp. Cualquiera con esos archivos controla tu número.
