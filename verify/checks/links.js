'use strict';

const fs = require('fs');
const path = require('path');
const {
  REPO_ROOT,
  jsLinkScanExclude,
} = require('../config');
const {
  exists,
  readText,
  listRootFiles,
  normalizeLocalUrl,
  extractRefsFromHtml,
  extractPageRefsFromJs,
  collectIds,
} = require('../lib/util');

module.exports = {
  name: 'links',
  description: 'local page links and JS string page references resolve to existing files',

  run() {
    const errors = [];
    const warnings = [];
    let refsChecked = 0;
    const pagesWithFragmentErrors = new Set();

    const htmlFiles = listRootFiles('.html');
    const idCache = new Map();

    function idsOf(page) {
      if (!idCache.has(page)) {
        idCache.set(page, exists(page) ? collectIds(readText(page)) : new Set());
      }
      return idCache.get(page);
    }

    function checkRef(rawRef, from, baseDir) {
      const norm = normalizeLocalUrl(rawRef, baseDir);
      if (norm === null) return;
      refsChecked += 1;

      if (norm.fragment && !norm.path) {
        // In-page anchor.
        if (!idsOf(from).has(norm.fragment)) {
          errors.push(`${from}: anchor "#${norm.fragment}" not found as id in ${from}`);
          pagesWithFragmentErrors.add(from);
        }
        return;
      }

      if (!exists(norm.path)) {
        errors.push(`${from}: link "${rawRef}" -> missing local file "${norm.path}"`);
        return;
      }

      if (norm.fragment) {
        const target = path.basename(norm.path);
        if (target.endsWith('.html')) {
          const targetIds = idsOf(target);
          if (!targetIds.has(norm.fragment)) {
            errors.push(`${from}: link "${rawRef}" -> "${target}" has no id "${norm.fragment}"`);
            pagesWithFragmentErrors.add(from);
          }
        }
      }
    }

    // 1. href/src references inside HTML files.
    for (const page of htmlFiles) {
      let html;
      try {
        html = readText(page);
      } catch (err) {
        errors.push(`${page}: cannot read (${err.message})`);
        continue;
      }
      for (const ref of extractRefsFromHtml(html)) {
        checkRef(ref, page, '');
      }
    }

    // 2. .html/.css string literals in frontend JS.
    for (const file of listRootFiles('.js')) {
      if (jsLinkScanExclude.has(file)) continue;
      let text;
      try {
        text = readText(file);
      } catch (err) {
        errors.push(`${file}: cannot read (${err.message})`);
        continue;
      }
      for (const ref of extractPageRefsFromJs(text)) {
        checkRef(ref, file, '');
      }
    }

    // 3. Page-name literals in the Telegram bot, which resolve
    //    against the site root, not against bot/.
    const botJs = path.join(REPO_ROOT, 'bot', 'bot.js');
    if (fs.existsSync(botJs)) {
      for (const ref of extractPageRefsFromJs(fs.readFileSync(botJs, 'utf8'))) {
        checkRef(ref, 'bot/bot.js', '');
      }
    }

    return {
      errors,
      warnings,
      info: { refsChecked, fragmentErrorPages: pagesWithFragmentErrors.size },
    };
  },
};
