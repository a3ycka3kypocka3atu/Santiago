'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { REPO_ROOT } = require('../config');

const TEXT_EXTENSIONS = new Set([
  '.css', '.env', '.html', '.js', '.json', '.md', '.py', '.sql',
  '.toml', '.txt', '.xml', '.yaml', '.yml',
]);

const SKIP_PREFIXES = [
  '.git/',
  'bot/node_modules/',
  'man_videos/',
  'woman_videos/',
];

const SECRET_PATTERNS = [
  { name: 'private key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'GitHub token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { name: 'AWS access key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'OpenAI-style secret key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g },
  { name: 'Slack token', re: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g },
  { name: 'Stripe live secret key', re: /\bsk_live_[A-Za-z0-9]{20,}\b/g },
  { name: 'Telegram bot token', re: /\b\d{7,12}:[A-Za-z0-9_-]{30,}\b/g },
  {
    name: 'literal privileged credential assignment',
    re: /\b(?:BOT_TOKEN|SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|VERCEL_TOKEN)\b\s*(?:=|:)\s*["']?([^\s"',;#}]{12,})/gi,
    valueGroup: 1,
  },
];

function trackedAndUnignoredFiles() {
  try {
    const output = execFileSync(
      'git',
      ['ls-files', '-co', '--exclude-standard', '-z'],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return output.split('\0').filter(Boolean);
  } catch (_) {
    return fs.readdirSync(REPO_ROOT).filter((name) =>
      fs.statSync(path.join(REPO_ROOT, name)).isFile());
  }
}

function isCandidate(file) {
  if (SKIP_PREFIXES.some((prefix) => file.startsWith(prefix))) return false;
  if (path.basename(file) === '.DS_Store') return false;
  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()) || path.basename(file).startsWith('.env');
}

function isPlaceholder(value) {
  const raw = String(value || '');
  const normalized = raw.toLowerCase();
  return !normalized ||
    /^[A-Z][A-Z0-9_]*$/.test(raw) ||
    normalized.includes('process.env') ||
    normalized.includes('${{') ||
    normalized.includes('secrets.') ||
    /(?:replace|placeholder|example|dummy|redacted|your[_-]|test[_-]?only)/.test(normalized);
}

function lineAt(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

module.exports = {
  name: 'secrets',
  description: 'tracked and release-source text has no obvious privileged credential literals',

  run() {
    const errors = [];
    const warnings = [];
    let filesChecked = 0;

    for (const file of trackedAndUnignoredFiles().filter(isCandidate).sort()) {
      const abs = path.join(REPO_ROOT, file);
      let stat;
      try {
        stat = fs.statSync(abs);
      } catch (_) {
        continue;
      }
      if (!stat.isFile() || stat.size > 2 * 1024 * 1024) continue;

      let text;
      try {
        text = fs.readFileSync(abs, 'utf8');
      } catch (_) {
        continue;
      }
      filesChecked += 1;

      for (const pattern of SECRET_PATTERNS) {
        pattern.re.lastIndex = 0;
        let match;
        while ((match = pattern.re.exec(text)) !== null) {
          const value = pattern.valueGroup ? match[pattern.valueGroup] : match[0];
          if (isPlaceholder(value)) continue;
          errors.push(`${file}:${lineAt(text, match.index)}: possible ${pattern.name}`);
          if (match[0].length === 0) pattern.re.lastIndex += 1;
        }
      }
    }

    return { errors, warnings, info: { filesChecked } };
  },
};
