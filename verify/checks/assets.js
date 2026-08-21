'use strict';

const path = require('path');
const {
  exists,
  readText,
  listRootFiles,
  normalizeLocalUrl,
  extractSrcFromHtml,
  extractCssUrls,
} = require('../lib/util');

// Extensions treated as local static assets when referenced via src=.
const SRC_ASSET_EXT_RE =
  /\.(css|js|png|jpe?g|gif|webp|svg|ico|avif|apng|mp4|mov|webm|mp3|wav|ogg|woff2?|ttf|otf|pdf|json|csv|map)$/i;

module.exports = {
  name: 'assets',
  description: 'local scripts, stylesheets, media and CSS url() assets exist',

  run() {
    const errors = [];
    const warnings = [];
    let refsChecked = 0;

    // 1. src= references in HTML (scripts, images, videos).
    for (const page of listRootFiles('.html')) {
      let html;
      try {
        html = readText(page);
      } catch (err) {
        errors.push(`${page}: cannot read (${err.message})`);
        continue;
      }
      for (const ref of extractSrcFromHtml(html)) {
        if (!SRC_ASSET_EXT_RE.test(ref.split('?')[0].split('#')[0])) continue;
        const norm = normalizeLocalUrl(ref, '');
        if (norm === null) continue;
        refsChecked += 1;
        if (!exists(norm.path)) {
          errors.push(`${page}: src "${ref}" -> missing local asset "${norm.path}"`);
        }
      }
    }

    // 2. url() references inside CSS files, resolved relative to the CSS file.
    for (const css of listRootFiles('.css')) {
      let text;
      try {
        text = readText(css);
      } catch (err) {
        errors.push(`${css}: cannot read (${err.message})`);
        continue;
      }
      for (const ref of extractCssUrls(text)) {
        const norm = normalizeLocalUrl(ref, '');
        if (norm === null) continue;
        refsChecked += 1;
        if (!exists(norm.path)) {
          warnings.push(`${css}: url(${ref}) -> local asset "${norm.path}" not found`);
        }
      }
    }

    return { errors, warnings, info: { refsChecked } };
  },
};
