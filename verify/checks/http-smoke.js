'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { REPO_ROOT, publicPages, accountPages, keyAssets } = require('../config');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const rel = urlPath.replace(/^\/+/, '');
      if (rel.includes('..') || rel.includes('\0')) {
        res.writeHead(400);
        res.end('bad path');
        return;
      }
      const abs = path.join(REPO_ROOT, rel);
      if (!abs.startsWith(REPO_ROOT + path.sep) && abs !== REPO_ROOT) {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      fs.readFile(abs, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('not found');
          return;
        }
        const ext = path.extname(abs).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    const onError = (err) => reject(err);
    server.once('error', onError);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', onError);
      resolve(server);
    });
  });
}

function fetchStatus(base, urlPath, expectedType) {
  return new Promise((resolve) => {
    http.get(`${base}${urlPath}`, (res) => {
      res.resume();
      resolve({
        path: urlPath,
        status: res.statusCode,
        contentType: res.headers['content-type'] || '',
        expectedType,
      });
    }).on('error', (err) =>
      resolve({ path: urlPath, status: 0, error: err.message, expectedType }));
  });
}

module.exports = {
  name: 'smoke',
  description: 'local HTTP smoke test: every page and key asset serves 200 with the right type',

  run() {
    const errors = [];
    const warnings = [];
    let fetched = 0;

    const targets = [
      ...publicPages.map((p) => [p, 'text/html']),
      ...accountPages.map((p) => [p, 'text/html']),
      ...keyAssets.map((asset) => [
        asset,
        asset.endsWith('.css') ? 'text/css' : 'text/javascript',
      ]),
    ];

    let server;
    return startStaticServer()
      .then((s) => {
        server = s;
        const base = `http://127.0.0.1:${s.address().port}`;
        const jobs = targets.map(([p, type]) => fetchStatus(base, `/${p}`, type));
        return Promise.all(jobs);
      })
      .then((results) => {
        for (const r of results) {
          fetched += 1;
          if (r.status !== 200) {
            errors.push(`${r.path}: HTTP ${r.status || r.error}`);
          } else if (!r.contentType.startsWith(r.expectedType)) {
            warnings.push(`${r.path}: unexpected content-type "${r.contentType}"`);
          }
        }
        return { errors, warnings, info: { fetched } };
      })
      .finally(() => {
        if (server) server.close();
      });
  },
};
