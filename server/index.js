import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { resolve, join, extname, basename } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { handleApi } from './api.js';
import { startWatcher } from './watcher.js';
import { getProcessManager } from './process.js';

const PORT = parseInt(process.env.PORT || '4545', 10);
const HOST = '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

// --- Multi-project state ---
let activeProjectPath = '';
let projectPaths = [];
let cleanupWatcher = null;

export function getActiveProject() {
  return activeProjectPath;
}

export function getProjects() {
  return projectPaths.map(p => ({ path: p, name: basename(p), active: p === activeProjectPath }));
}

export function switchProject(newPath) {
  if (!projectPaths.includes(newPath)) {
    // Add new project to list
    projectPaths.push(newPath);
  }
  activeProjectPath = newPath;

  // Restart file watcher for new project
  if (cleanupWatcher) cleanupWatcher();
  cleanupWatcher = startWatcher(newPath, broadcast);

  // Notify all clients to reconnect
  broadcast({ type: 'project-switched', projectPath: newPath, projectName: basename(newPath) });
  console.log(`  Switched to: ${newPath}`);
}

// --- WebSocket ---
const clients = new Set();

export function broadcast(message) {
  const data = typeof message === 'string' ? message : JSON.stringify(message);
  for (const ws of clients) {
    if (ws.readyState === 1) {
      try { ws.send(data); } catch (err) { console.error('WebSocket send error:', err.message); }
    }
  }
}

// --- Server ---
export function startServer(initialProjectPaths) {
  // Accept single path or array
  if (typeof initialProjectPaths === 'string') {
    projectPaths = [initialProjectPaths];
  } else {
    projectPaths = [...initialProjectPaths];
  }
  activeProjectPath = projectPaths[0];

  const distDir = resolve(import.meta.dirname, '..', 'dist');

  const server = createServer(async (req, res) => {
    // CORS headers for dev mode
    const origin = req.headers.origin || '';
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400');
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const handled = await handleApi(req, res);
      if (handled) return;

      // Serve static files from dist/
      let pathname = new URL(req.url, `http://${HOST}`).pathname;
      if (pathname === '/') pathname = '/index.html';

      const filePath = join(distDir, pathname);

      if (!filePath.startsWith(distDir)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Forbidden' }));
        return;
      }

      try {
        const fileStat = await stat(filePath);
        if (!fileStat.isFile()) throw new Error('Not a file');

        const ext = extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const content = await readFile(filePath);

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } catch {
        try {
          const indexPath = join(distDir, 'index.html');
          const content = await readFile(indexPath);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(content);
        } catch {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
        }
      }
    } catch (err) {
      console.error('Request error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });

  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
    ws.on('error', (err) => {
      console.error('WebSocket client error:', err.message);
      clients.delete(ws);
    });
  });

  // Start file watcher for initial project
  cleanupWatcher = startWatcher(activeProjectPath, broadcast);

  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('Dev Manager bridge server');
    console.log(`  Projects:  ${projectPaths.map(p => basename(p)).join(', ')}`);
    console.log(`  Active:    ${activeProjectPath}`);
    console.log(`  Server:    http://${HOST}:${PORT}`);
    console.log('');
  });

  function shutdown() {
    console.log('\nShutting down...');
    const pm = getProcessManager();
    pm.killAll();
    if (cleanupWatcher) cleanupWatcher();
    wss.close();
    server.close(() => {
      console.log('Server closed.');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}

// Auto-start when run directly
const isMain = process.argv[1] && import.meta.url === 'file:///' + process.argv[1].replace(/\\/g, '/');
if (isMain) {
  const projectPath = resolve(process.argv[2] || '.');
  startServer(projectPath);
}
