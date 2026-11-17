// Server statico che imita GitHub Pages: /FinanzAi/* -> www/*, con fallback a index.html (come il 404.html di Pages).
// Uso: node tests/e2e/serve.mjs www 8765
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const [, , rootArg = 'www', port = '8765', base = '/FinanzAi/'] = process.argv;
const root = resolve(rootArg);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.ico': 'image/x-icon',
};
http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!p.startsWith(base)) { res.writeHead(404); res.end(); return; }
  const rel = p.slice(base.length) || 'index.html';
  const file = resolve(join(root, rel));
  if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': types['.html'] });
    res.end(await readFile(join(root, 'index.html')));
  }
}).listen(+port, () => console.log('server su', port));
