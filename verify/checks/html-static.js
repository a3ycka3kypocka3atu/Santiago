'use strict';

const { readText, listRootFiles } = require('../lib/util');

module.exports = {
  name: 'static',
  description: 'every HTML page is readable with basic structural markers',

  run() {
    const errors = [];
    const warnings = [];
    let pagesChecked = 0;

    for (const page of listRootFiles('.html')) {
      let html;
      try {
        html = readText(page);
      } catch (err) {
        errors.push(`${page}: cannot read (${err.message})`);
        continue;
      }
      pagesChecked += 1;
      if (html.trim().length === 0) {
        errors.push(`${page}: empty file`);
        continue;
      }
      if (!/<!DOCTYPE/i.test(html)) errors.push(`${page}: missing <!DOCTYPE>`);
      if (!/<html[\s>]/i.test(html)) errors.push(`${page}: missing <html> tag`);
      if (!/<\/html>/i.test(html)) errors.push(`${page}: missing </html>`);
      if (!/<head[\s>]/i.test(html)) errors.push(`${page}: missing <head>`);
      const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
      if (!title) errors.push(`${page}: missing <title>`);
      else if (title[1].trim() === '') errors.push(`${page}: empty <title>`);

      for (const tag of ['script', 'style']) {
        const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'gi')) || []).length;
        const close = (html.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
        if (open !== close) {
          errors.push(`${page}: unbalanced <${tag}> tags (open ${open}, close ${close})`);
        }
      }

      // <div> balance over markup only (script/style/comment content removed).
      const markup = html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '');
      const divOpen = (markup.match(/<div[\s>]/gi) || []).length;
      const divClose = (markup.match(/<\/div>/gi) || []).length;
      if (divOpen !== divClose) {
        errors.push(`${page}: unbalanced <div> tags in markup (open ${divOpen}, close ${divClose})`);
      }
    }

    return { errors, warnings, info: { pagesChecked } };
  },
};
