// pm2 — corre el bot en el servidor (Oracle) y lo relanza
// solo si se cae. Uso:
//   pm2 start ecosystem.config.js
//   pm2 save
//   pm2 startup   (te imprime un comando, córrelo con sudo)
// Ver los logs: pm2 logs pochetinxd-bot
// Reiniciar tras actualizar: pm2 restart pochetinxd-bot
//
// Ojo: index.js ya sale con código 1 cuando se le acaban los
// reintentos de reconexión; pm2 lo vuelve a arrancar solo,
// igual que iniciar.bat en Windows.
module.exports = {
  apps: [
    {
      name: 'pochetinxd-bot',
      script: 'index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 5000,
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'silent',
      },
    },
  ],
};
