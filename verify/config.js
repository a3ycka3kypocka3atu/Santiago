'use strict';

// Central configuration for the verification suite.
//
// `publicPages` and `accountPages` define the pages the repository is
// expected to ship. `verify:pages` fails when any of these files is
// missing or empty, and warns when a root-level .html file exists that
// is not listed here (so new pages get registered).

const path = require('path');

const publicPages = [
  'index.html',
  'map.html',
  'about.html',
  'suggest.html',
  'events.html',
  'calendar.html',
  'masters.html',
  'services.html',
  'space.html',
  'projects.html',
  'community.html',
  'coliving.html',
  'school.html',
  'shop.html',
  'openmic.html',
  'project-incubator.html',
  'conscious-networking.html',
  'conscious-relationships.html',
  'ethical-automation-agency.html',
  'offer.html',
  'offer-katerina.html',
];

const accountPages = [
  'cabinet.html',
  'profile.html',
  'profile-andrij.html',
  'profile-katerina.html',
  'profile-violetta.html',
];

// Public discovery pages that form the Stage 1 MVP. Their primary navigation
// is intentionally narrow; legacy experiments remain reachable through
// contextual links, but must not return to the global navigation.
const coreDiscoveryPages = [
  'index.html',
  'services.html',
  'masters.html',
  'map.html',
  'events.html',
  'about.html',
  'suggest.html',
];

const primaryNavigation = [
  { href: 'index.html', label: 'Discover' },
  { href: 'services.html', label: 'Services' },
  { href: 'masters.html', label: 'Practitioners' },
  { href: 'map.html', label: 'Map' },
  { href: 'events.html', label: 'Events' },
  { href: 'about.html', label: 'About' },
];

const publicProfilePages = [
  'profile.html',
  'profile-andrij.html',
  'profile-katerina.html',
  'profile-violetta.html',
];

const englishPages = [...publicPages, ...publicProfilePages];

const requiredFiles = [
  'style.css',
  'mvp.css',
  'menu.js',
  'translations.js',
  'auth.js',
  'public-config.js',
  'public-forms.js',
  'discovery-data.js',
  'profile-enhancements.js',
  'map.js',
  '.vercelignore',
];

const requiredPageScripts = {
  'map.html': ['discovery-data.js', 'map.js'],
  'suggest.html': ['public-forms.js'],
  'services.html': ['discovery-data.js', 'services.js'],
  'masters.html': ['discovery-data.js', 'masters.js'],
  'space.html': ['discovery-data.js', 'spaces.js'],
  'events.html': ['discovery-data.js', 'events.js'],
  'profile.html': ['discovery-data.js', 'profile-enhancements.js'],
  'profile-andrij.html': ['discovery-data.js', 'profile-enhancements.js'],
  'profile-katerina.html': ['discovery-data.js', 'profile-enhancements.js'],
  'profile-violetta.html': ['discovery-data.js', 'profile-enhancements.js'],
};

const requiredPageIds = {
  'services.html': ['services-grid'],
  'masters.html': ['masters-grid'],
  'space.html': ['spaces-grid'],
  'events.html': ['formats-grid', 'scheduled-events', 'events-state'],
  'profile.html': ['profile-discovery-data'],
  'profile-andrij.html': ['profile-discovery-data'],
  'profile-katerina.html': ['profile-discovery-data'],
  'profile-violetta.html': ['profile-discovery-data'],
};

const keyAssets = [
  'style.css',
  'mvp.css',
  'favorites.css',
  'menu.js',
  'translations.js',
  'auth.js',
  'public-config.js',
  'public-forms.js',
  'discovery-data.js',
  'profile-enhancements.js',
  'map.js',
];

// One-off dev utilities that reference other projects on disk.
// Excluded from the JS link scan to avoid false positives.
const jsLinkScanExclude = new Set([
  'update_translations.js',
]);

module.exports = {
  REPO_ROOT: path.resolve(__dirname, '..'),
  publicPages,
  accountPages,
  allPages: [...publicPages, ...accountPages],
  coreDiscoveryPages,
  primaryNavigation,
  publicProfilePages,
  englishPages,
  requiredFiles,
  requiredPageScripts,
  requiredPageIds,
  keyAssets,
  jsLinkScanExclude,
};
