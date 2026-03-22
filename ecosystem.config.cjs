module.exports = {
  apps: [
    {
      name: "lulana-claw",
      script: "bun",
      args: "run src/index.ts",
      cwd: __dirname,
      interpreter: "none",
      env: {
        NODE_ENV: "production",
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
