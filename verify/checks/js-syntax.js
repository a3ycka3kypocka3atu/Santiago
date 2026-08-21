'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { REPO_ROOT } = require('../config');
const { listRootFiles, nodeCheck } = require('../lib/util');

const INLINE_SCRIPT_RE = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;

function checkFile(absPath, label, errors) {
  try {
    nodeCheck(absPath);
    return true;
  } catch (err) {
    errors.push(`${label}: syntax error`);
    const stderr = String(err.stderr || err.message).trim();
    const lines = stderr.split('\n').filter(Boolean);
    for (const line of lines.slice(0, 8)) errors.push(`    ${line}`);
    return false;
  }
}

module.exports = {
  name: 'js',
  description: 'frontend, inline and bot JavaScript parses (node --check)',

  run() {
    const errors = [];
    const warnings = [];
    let checked = 0;

    // 1. Root-level frontend JS.
    for (const file of listRootFiles('.js')) {
      if (checkFile(path.join(REPO_ROOT, file), file, errors)) checked += 1;
    }

    // 2. Telegram bot JS (parse only, nothing is executed).
    const botDir = path.join(REPO_ROOT, 'bot');
    if (fs.existsSync(botDir)) {
      for (const file of fs.readdirSync(botDir).filter((f) => f.endsWith('.js')).sort()) {
        if (checkFile(path.join(botDir, file), path.join('bot', file), errors)) checked += 1;
      }
    }

    // 3. Inline <script> blocks inside HTML pages.
    let inlineChecked = 0;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-inline-'));
    try {
      for (const page of listRootFiles('.html')) {
        const html = fs.readFileSync(path.join(REPO_ROOT, page), 'utf8');
        const blocks = [...html.matchAll(INLINE_SCRIPT_RE)].map((m) => m[1]);
        blocks.forEach((code, i) => {
          if (code.trim() === '') return;
          const tmpFile = path.join(tmpDir, `${page.replace(/\W/g, '_')}_${i}.js`);
          fs.writeFileSync(tmpFile, code);
          if (checkFile(tmpFile, `${page} inline block ${i}`, errors)) inlineChecked += 1;
        });
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    return {
      errors,
      warnings,
      info: { filesChecked: checked, inlineScriptsChecked: inlineChecked },
    };
  },
};
