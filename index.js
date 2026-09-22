const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const LOGS_DIR = path.join(__dirname, 'logs');

// Make sure the logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR);
}

// Strip anything that isn't safe for a filename (prevents path traversal too)
function sanitizeSessionId(sessionId) {
  return String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '');
}

const server = http.createServer((req, res) => {
  // CORS headers — allow requests from any origin (adjust for production)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    return;
  }

  if (req.method === 'POST' && req.url === '/save') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Body must be valid JSON' }));
        return;
      }

      const { session_id } = parsed;

      if (!session_id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'session_id is required' }));
        return;
      }

      const safeSessionId = sanitizeSessionId(session_id);
      if (!safeSessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Invalid session_id' }));
        return;
      }

      const filePath = path.join(LOGS_DIR, `${safeSessionId}.txt`);
      const entry = `[${new Date().toISOString()}] ${JSON.stringify(parsed)}\n`;

      fs.appendFile(filePath, entry, (err) => {
        if (err) {
          console.error('Error writing to file:', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Failed to save data' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Data saved successfully', file: `${safeSessionId}.txt` }));
      });
    });

    req.on('error', (err) => {
      console.error('Request error:', err);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Bad request' }));
    });

  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Not found' }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`POST to http://localhost:${PORT}/save to save data`);
  console.log(`GET  http://localhost:${PORT}/health to check server status`);
});