'use strict';

const {
  coreDiscoveryPages,
  englishPages,
  primaryNavigation,
  requiredFiles,
  requiredPageIds,
  requiredPageScripts,
  publicProfilePages,
} = require('../config');
const {
  exists,
  readText,
  listRootFiles,
  stripQueryAndFragment,
  collectIds,
} = require('../lib/util');

function lineAt(text, offset) {
  return text.slice(0, offset).split('\n').length;
}

function attribute(tag, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag);
  return match ? match[1] : null;
}

function hasClass(tag, className) {
  const value = attribute(tag, 'class') || '';
  return value.split(/\s+/).includes(className);
}

function isExplicitlyHidden(tag) {
  const style = attribute(tag, 'style') || '';
  return /\shidden(?:\s|=|>)/i.test(` ${tag}`) ||
    attribute(tag, 'aria-hidden') === 'true' ||
    /display\s*:\s*none/i.test(style) ||
    /visibility\s*:\s*hidden/i.test(style);
}

function stripMarkup(value) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function primaryNavList(html) {
  const navRe = /<nav\b([^>]*)>([\s\S]*?)<\/nav>/gi;
  let navMatch;
  while ((navMatch = navRe.exec(html)) !== null) {
    const attrs = navMatch[1];
    const navClass = attribute(attrs, 'class') || '';
    const ariaLabel = attribute(attrs, 'aria-label') || '';
    if (!/(?:quick-menu|primary-nav|site-nav)/i.test(navClass) &&
        !/(?:primary|navigation)/i.test(ariaLabel)) {
      continue;
    }
    const list = /<ul\b[^>]*class\s*=\s*["'][^"']*\bnav-list\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i
      .exec(navMatch[2]) || /<ul\b[^>]*>([\s\S]*?)<\/ul>/i.exec(navMatch[2]);
    return list ? list[1] : null;
  }
  return null;
}

function navItems(listMarkup) {
  const items = [];
  const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRe.exec(listMarkup)) !== null) {
    items.push({
      href: stripQueryAndFragment(attribute(match[1], 'href') || ''),
      label: stripMarkup(match[2]),
    });
  }
  return items;
}

function referencedScripts(html) {
  const scripts = new Set();
  const re = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    scripts.add(stripQueryAndFragment(match[1]).replace(/^\.\//, '').replace(/^\//, ''));
  }
  return scripts;
}

function findVisibleControl(html, predicate) {
  const tagRe = /<(?:a|button|div|select)\b[^>]*>/gi;
  let match;
  while ((match = tagRe.exec(html)) !== null) {
    if (!isExplicitlyHidden(match[0]) && predicate(match[0])) {
      return { line: lineAt(html, match.index), tag: match[0] };
    }
  }
  return null;
}

module.exports = {
  name: 'mvp',
  description: 'static Public Discovery MVP, navigation, language and safe-link contract',

  run() {
    const errors = [];
    const warnings = [];
    let englishChecked = 0;
    let navigationChecked = 0;
    let safeLinksChecked = 0;
    let scriptsChecked = 0;
    let structuresChecked = 0;

    for (const file of requiredFiles) {
      if (!exists(file)) errors.push(`missing required release file: ${file}`);
    }

    for (const page of englishPages) {
      if (!exists(page)) continue;
      const html = readText(page);
      englishChecked += 1;
      const htmlTag = /<html\b[^>]*>/i.exec(html);
      const lang = htmlTag ? attribute(htmlTag[0], 'lang') : null;
      if (!lang || lang.toLowerCase() !== 'en') {
        errors.push(`${page}: expected <html lang="en">, found ${lang ? `lang="${lang}"` : 'no lang'}`);
      }
    }

    const expectedHrefs = primaryNavigation.map((item) => item.href);
    const expectedLabels = primaryNavigation.map((item) => item.label);
    for (const page of coreDiscoveryPages) {
      if (!exists(page)) continue;
      const html = readText(page);
      const list = primaryNavList(html);
      navigationChecked += 1;
      if (list === null) {
        errors.push(`${page}: missing primary navigation list`);
      } else {
        const items = navItems(list);
        const hrefs = items.map((item) => item.href);
        const labels = items.map((item) => item.label);
        if (JSON.stringify(hrefs) !== JSON.stringify(expectedHrefs)) {
          errors.push(`${page}: primary navigation destinations must be exactly ${expectedHrefs.join(', ')}; found ${hrefs.join(', ') || 'none'}`);
        }
        if (JSON.stringify(labels) !== JSON.stringify(expectedLabels)) {
          errors.push(`${page}: primary navigation labels must be exactly ${expectedLabels.join(', ')}; found ${labels.join(', ') || 'none'}`);
        }
      }

      const shopControl = findVisibleControl(html, (tag) => hasClass(tag, 'home-icon'));
      if (shopControl) {
        errors.push(`${page}:${shopControl.line}: visible global Shop control is forbidden on core discovery pages`);
      }

      const accountControl = findVisibleControl(html, (tag) => hasClass(tag, 'cabinet-btn'));
      if (accountControl) {
        errors.push(`${page}:${accountControl.line}: visible account/profile control is forbidden in the core public shell`);
      }

      const languageControl = findVisibleControl(html, (tag) =>
        hasClass(tag, 'lang-switcher') || hasClass(tag, 'lang-btn'));
      if (languageControl) {
        errors.push(`${page}:${languageControl.line}: visible language control is forbidden in the English-only MVP`);
      }
    }

    if (exists('.vercelignore')) {
      const ignoreEntries = new Set(
        readText('.vercelignore')
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line && !line.startsWith('#'))
      );
      const requiredIgnoreEntries = [
        '.agents/', '.claude/', 'bot/', 'docs/', 'verify/',
        '**/.env', '**/.env.*', 'man_videos/*', 'woman_videos/*',
      ];
      for (const entry of requiredIgnoreEntries) {
        if (!ignoreEntries.has(entry)) {
          errors.push(`.vercelignore: missing required deployment exclusion "${entry}"`);
        }
      }
    }

    for (const [page, expectedScripts] of Object.entries(requiredPageScripts)) {
      if (!exists(page)) continue;
      const scripts = referencedScripts(readText(page));
      for (const script of expectedScripts) {
        scriptsChecked += 1;
        if (!scripts.has(script)) errors.push(`${page}: missing required script reference "${script}"`);
      }
    }

    for (const [page, expectedIds] of Object.entries(requiredPageIds)) {
      if (!exists(page)) continue;
      const ids = collectIds(readText(page));
      for (const id of expectedIds) {
        structuresChecked += 1;
        if (!ids.has(id)) errors.push(`${page}: missing required integration target id="${id}"`);
      }
    }

    for (const page of publicProfilePages) {
      if (!exists(page)) continue;
      const html = readText(page);
      structuresChecked += 1;
      if (!/<body\b[^>]*\bdata-practitioner(?:\s*=|\s|>)/i.test(html)) {
        errors.push(`${page}: <body> requires data-practitioner for profile enhancement`);
      }
    }

    if (exists('map.html')) {
      const mapHtml = readText('map.html');
      if (!/leaflet(?:\.min)?\.css/i.test(mapHtml)) {
        errors.push('map.html: missing Leaflet stylesheet');
      }
      if (!/leaflet(?:\.min)?\.js/i.test(mapHtml)) {
        errors.push('map.html: missing Leaflet script');
      }
      if (!/\bid\s*=\s*["'][^"']*map[^"']*["']/i.test(mapHtml)) {
        errors.push('map.html: missing map container id');
      }
    }

    if (exists('suggest.html') && !/<form\b/i.test(readText('suggest.html'))) {
      errors.push('suggest.html: missing public suggestion form');
    }

    for (const page of listRootFiles('.html')) {
      const html = readText(page);
      if (referencedScripts(html).has('submission-requests.js')) {
        errors.push(`${page}: legacy submission-requests.js must remain dormant; use public-forms.js for public forms`);
      }
      const anchorRe = /<a\b[^>]*\btarget\s*=\s*["']_blank["'][^>]*>/gi;
      let match;
      while ((match = anchorRe.exec(html)) !== null) {
        safeLinksChecked += 1;
        const rel = (attribute(match[0], 'rel') || '').toLowerCase().split(/\s+/);
        if (!rel.includes('noopener') && !rel.includes('noreferrer')) {
          errors.push(`${page}:${lineAt(html, match.index)}: target="_blank" link requires rel="noopener" or rel="noreferrer"`);
        }
      }
    }

    return {
      errors,
      warnings,
      info: {
        englishChecked,
        navigationChecked,
        safeLinksChecked,
        scriptsChecked,
        structuresChecked,
      },
    };
  },
};
