module.exports = {
  apps: [{
    name: "thepurplepanther",
    script: "src/index.js",
    // dotenv reads server/.env from the process cwd, so the app must start here.
    cwd: "/home/thepurplepanther-new/htdocs/new.thepurplepanther.in/server",
    env: {
      NODE_ENV: "production",
      PORT: 3000,
      SERVE_CLIENT: "true"
    },
    // The MySQL user has a max_connections_per_hour quota, so a crash loop must stay
    // slow: a few attempts, then stop, rather than burning the hour on restarts.
    max_restarts: 3,
    min_uptime: "30s",
    restart_delay: 60000,
    autorestart: true,
    time: true
  }]
};
