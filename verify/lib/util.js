'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { REPO_ROOT } = require('../config');

function rootPath(rel) {
  return path.join(REPO_ROOT, rel);
}

function readText(rel) {
  return fs.readFileSync(rootPath(rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(rootPath(rel));
}

function listRootFiles(ext) {
  return fs.readdirSync(REPO_ROOT).filter((f) => f.endsWith(ext)).sort();
}

const EXTERNAL_RE =
  /^(?:[a-z][a-z0-9+.-]*:|\/\/|mailto:|tel:|data:|javascript:|blob:)/i;

function stripQueryAndFragment(url) {
  let u = url;
  const h = u.indexOf('#');
  if (h !== -1) u = u.slice(0, h);
  const q = u.indexOf('?');
  if (q !== -1) u = u.slice(0, q);
  return u;
}

function isExternal(url) {
  return !url || url.trim() === '' || EXTERNAL_RE.test(url) ||
    url.startsWith('{') || url.includes('{{');
}

// Convert a local web URL into a repo-relative path.
// Returns { path, fragment } or null when the URL is external or not a
// local file reference. `baseDir` is the posix directory the URL is
// resolved against ('' = repo root).
function normalizeLocalUrl(url, baseDir = '') {
  if (isExternal(url)) return null;
  let u = url.trim().replace(/&amp;/g, '&');
  if (u.startsWith('#')) return { path: '', fragment: u.slice(1) };
  const hashIdx = u.indexOf('#');
  const fragment = hashIdx === -1 ? null : u.slice(hashIdx + 1);
  u = stripQueryAndFragment(u);
  if (u === '' || u === '.' || u === '..' || u.includes('\\') || u.includes('..')) return null;
  if (u.startsWith('/')) u = u.replace(/^\/+/, '');
  u = u.replace(/^\.\//, '');
  u = path.posix.normalize(u);
  if (!u || u.startsWith('../')) return null;
  return { path: baseDir ? path.posix.join(baseDir, u) : u, fragment };
}

function extractRefsFromHtml(html) {
  const refs = [];
  const re = /\b(?:href|src)\s*=\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) refs.push(m[1]);
  return refs;
}

function extractSrcFromHtml(html) {
  const refs = [];
  const re = /\bsrc\s*=\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) refs.push(m[1]);
  return refs;
}

// Extract string literals from JS text (single, double and template
// literals; nested quoted strings inside templates are extracted too).
// Skips // line comments and /* block comments.
function extractJsStringLiterals(text) {
  const literals = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const ch = text[i];
    if (ch === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      i = nl === -1 ? n : nl + 1;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? n : end + 2;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      i += 1;
      let content = '';
      let closed = false;
      while (i < n) {
        const c = text[i];
        if (c === '\\') {
          content += text.slice(i, i + 2);
          i += 2;
          continue;
        }
        if (c === ch) {
          closed = true;
          i += 1;
          break;
        }
        content += c;
        i += 1;
      }
      if (closed) {
        literals.push({ quote: ch, content });
        if (ch === '`') literals.push(...extractJsStringLiterals(content));
      }
      continue;
    }
    i += 1;
  }
  return literals;
}

// From extracted string literals, keep those that look like local
// page/resource references (e.g. 'calendar.html#full-calendar').
function extractPageRefsFromJs(jsText) {
  const refs = [];
  for (const lit of extractJsStringLiterals(jsText)) {
    if (/^[./\w-]*\.(?:html|css)(?:[?#][^"'`]*)?$/.test(lit.content)) {
      refs.push(lit.content);
    }
  }
  return refs;
}

function extractCssUrls(cssText) {
  const refs = [];
  const re = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
  let m;
  while ((m = re.exec(cssText)) !== null) refs.push(m[1]);
  return refs;
}

function collectIds(html) {
  const ids = new Set();
  const re = /\bid\s*=\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  return ids;
}

function nodeCheck(tmpFile) {
  execFileSync(process.execPath, ['--check', tmpFile], { stdio: 'pipe' });
}

module.exports = {
  rootPath,
  readText,
  exists,
  listRootFiles,
  isExternal,
  stripQueryAndFragment,
  normalizeLocalUrl,
  extractRefsFromHtml,
  extractSrcFromHtml,
  extractPageRefsFromJs,
  extractCssUrls,
  collectIds,
  nodeCheck,
};
