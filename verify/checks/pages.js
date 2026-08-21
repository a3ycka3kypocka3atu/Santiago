'use strict';

const { allPages } = require('../config');
const { exists, readText, listRootFiles } = require('../lib/util');

module.exports = {
  name: 'pages',
  description: 'expected public and account pages exist and are non-empty',

  run() {
    const errors = [];
    const warnings = [];
    let found = 0;

    for (const page of allPages) {
      if (!exists(page)) {
        errors.push(`missing expected page: ${page}`);
        continue;
      }
      let text;
      try {
        text = readText(page);
      } catch (err) {
        errors.push(`unreadable page ${page}: ${err.message}`);
        continue;
      }
      if (text.trim().length === 0) {
        errors.push(`empty page: ${page}`);
      } else {
        found += 1;
      }
    }

    const known = new Set(allPages);
    for (const f of listRootFiles('.html')) {
      if (!known.has(f)) {
        warnings.push(`root HTML not listed in verify/config.js: ${f}`);
      }
    }

    return { errors, warnings, info: { expected: allPages.length, found } };
  },
};
