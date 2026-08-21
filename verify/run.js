'use strict';

// Santiago Way repository verification runner.
//
// Usage:
//   node verify/run.js            run every check
//   node verify/run.js --pages    run a single check
//   npm run verify                same as running every check
//
// Exit code is 0 when all checks pass, 1 otherwise.

const allChecks = [
  require('./checks/pages'),
  require('./checks/links'),
  require('./checks/assets'),
  require('./checks/js-syntax'),
  require('./checks/html-static'),
  require('./checks/mvp-contract'),
  require('./checks/discovery-journey'),
  require('./checks/security-contract'),
  require('./checks/secrets'),
  require('./checks/http-smoke'),
];

const flagMap = {
  '--pages': ['pages'],
  '--links': ['links'],
  '--assets': ['assets'],
  '--js': ['js'],
  '--static': ['static'],
  '--mvp': ['mvp'],
  '--journey': ['journey'],
  '--security': ['security'],
  '--secrets': ['secrets'],
  '--smoke': ['smoke'],
};

function selectedChecks(argv) {
  const flags = argv.filter((a) => flagMap[a]);
  if (flags.length === 0) return allChecks;
  const wanted = new Set(flags.flatMap((f) => flagMap[f]));
  return allChecks.filter((c) => wanted.has(c.name));
}

function fmtInfo(info) {
  return Object.entries(info)
    .map(([k, v]) => `${k}=${v}`)
    .join(', ');
}

async function main() {
  const checks = selectedChecks(process.argv.slice(2));
  let failed = 0;

  for (const check of checks) {
    let result;
    try {
      result = await check.run();
    } catch (err) {
      failed += 1;
      console.log(`verify: ${check.name.padEnd(8)} FAIL (check crashed: ${err.message})`);
      console.error(err.stack);
      continue;
    }
    const { errors, warnings, info } = result;
    const status = errors.length === 0 ? 'PASS' : 'FAIL';
    if (errors.length > 0) failed += 1;
    console.log(
      `verify: ${check.name.padEnd(8)} ${status}   ${check.description} (${fmtInfo(info)})`
    );
    for (const w of warnings) console.log(`        warn: ${w}`);
    for (const e of errors) console.log(`        error: ${e}`);
  }

  console.log('');
  if (failed === 0) {
    console.log(`SUMMARY: all ${checks.length} checks passed`);
  } else {
    console.log(`SUMMARY: ${failed} of ${checks.length} checks FAILED`);
  }
  process.exit(failed === 0 ? 0 : 1);
}

main();
