/**
 * Tasteza WebSocket Hub  
 * Run: npm install ws  (in server/)
 */
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const rooms = {
  sales: new Set(),
  kot: new Set(),
  billing: new Set(),
  dashboard: new Set(),
  kds: new Set(),
};

function broadcast(room, message) {
  const targets = rooms[room];
  if (!targets) return;
  const data = JSON.stringify(message);
  targets.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

function broadcastAll(message) {
  Object.keys(rooms).forEach(r => broadcast(r, message));
}

function init(httpServer) {
  const wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

  wss.on('connection', (socket, req) => {
    // Try to auth from query string immediately
    let user = null;
    try {
      const url = new URL(req.url, 'http://x');
      const tkn = url.searchParams.get('token');
      if (tkn) {
        user = jwt.verify(tkn, process.env.JWT_SECRET);
      }
    } catch {}

    socket._rooms = new Set();

    // Auto-subscribe to all rooms if authenticated via query token
    const autoSubscribe = () => {
      ['sales', 'kot', 'billing', 'dashboard', 'kds'].forEach(r => {
        rooms[r].add(socket);
        socket._rooms.add(r);
      });
      socket.send(JSON.stringify({ type: 'subscribed', rooms: ['sales', 'kot', 'billing', 'dashboard', 'kds'] }));
    };

    if (user) {
      // Already authenticated - auto subscribe
      autoSubscribe();
    }

    socket.on('message', raw => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === 'ping') {
        socket.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      if (msg.type === 'auth') {
        try {
          user = jwt.verify(msg.token, process.env.JWT_SECRET);
          socket.send(JSON.stringify({ type: 'auth_ok' }));
          autoSubscribe();
        } catch {
          socket.send(JSON.stringify({ type: 'auth_fail' }));
        }
        return;
      }

      if (msg.type === 'subscribe') {
        if (!user) { socket.send(JSON.stringify({ type: 'error', message: 'Not authenticated' })); return; }
        const list = Array.isArray(msg.rooms) ? msg.rooms : [msg.room].filter(Boolean);
        list.forEach(r => {
          if (rooms[r]) { rooms[r].add(socket); socket._rooms.add(r); }
        });
        socket.send(JSON.stringify({ type: 'subscribed', rooms: [...socket._rooms] }));
        return;
      }
    });

    const cleanup = () => {
      socket._rooms.forEach(r => rooms[r]?.delete(socket));
    };
    socket.on('close', cleanup);
    socket.on('error', cleanup);
  });

  console.log('🔌 WebSocket ready at ws://[host]/ws');
  return wss;
}

module.exports = { init, broadcast, broadcastAll };
