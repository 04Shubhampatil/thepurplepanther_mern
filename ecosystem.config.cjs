module.exports = {
  apps: [{
    name: "thepurplepanther",
    script: "src/index.js",

    // Server directory: server/.env is loaded from this cwd
    cwd: "/home/purplepanthernew/htdocs/thepurplepanther.in/thepurplepanther_mern/server",

    env: {
      NODE_ENV: "production",
      PORT: 5000,
      SERVE_CLIENT: "true"
    },

    // Prevent rapid restart loops
    max_restarts: 3,
    min_uptime: "30s",
    restart_delay: 60000,
    autorestart: true,
    time: true
  }]
};