/**
 * setupProxy.js — replaces the simple "proxy" field in package.json.
 *
 * Why: When React dev server is accessed from another device (e.g. phone/tablet
 * on the same Wi-Fi), the browser sends requests to 192.168.1.20:3002, but the
 * simple proxy setting of "http://localhost:3001" still works from the SERVER's
 * perspective (it proxies on the host machine). The real problem is usually just
 * that the backend Express server wasn't bound to 0.0.0.0 — now it is.
 *
 * This file lets us add extra proxy options (changeOrigin, secure, etc.)
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:3001',
      changeOrigin: true,
      secure: false,
      on: {
        error: (err, req, res) => {
          console.error('[Proxy Error]', err.message);
          res.status(502).json({ success: false, message: 'Backend not reachable. Is the server running on port 3001?' });
        }
      }
    })
  );
};
