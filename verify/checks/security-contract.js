'use strict';

const { readText } = require('../lib/util');

function requirePattern(text, pattern, label, errors) {
  if (!pattern.test(text)) errors.push(label);
}

module.exports = {
  name: 'security',
  description: 'public request migration, browser config and bot notification boundary are present',

  run() {
    const errors = [];
    const warnings = [];
    const migration = readText('bot/migrations/0016_public_discovery_security.sql');
    const auth = readText('auth.js');
    const config = readText('public-config.js');
    const bot = readText('bot/bot.js');
    const suggest = readText('suggest.html');

    requirePattern(migration, /ALTER TABLE public\.public_discovery_requests ENABLE ROW LEVEL SECURITY/i, 'request table RLS is not enabled', errors);
    requirePattern(migration, /REVOKE ALL PRIVILEGES ON TABLE public\.public_discovery_requests\s+FROM PUBLIC, anon, authenticated/i, 'browser table privileges are not revoked', errors);
    requirePattern(migration, /SECURITY DEFINER\s+SET search_path = ''/i, 'public request functions do not lock search_path', errors);
    requirePattern(migration, /GRANT EXECUTE ON FUNCTION public\.submit_public_discovery_request[\s\S]*TO anon, authenticated/i, 'insert-only RPC is not granted to browser roles', errors);
    requirePattern(migration, /claim_public_discovery_requests/i, 'atomic public request notification claim is missing', errors);
    requirePattern(migration, /FOR UPDATE SKIP LOCKED/i, 'notification claim is not concurrency safe', errors);
    requirePattern(migration, /request_fingerprint[\s\S]*INTERVAL '1 hour'/i, 'server-side request rate limit is missing', errors);
    requirePattern(migration, /expires_at[\s\S]*INTERVAL '90 days'/i, 'request retention boundary is missing', errors);
    requirePattern(migration, /REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated/i, 'legacy browser RPC revocation is missing', errors);
    requirePattern(migration, /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.public_discovery_requests\s+TO service_role/i, 'service-role request queue privileges are not explicit', errors);

    const expectedProjectUrl = 'https://ccwvyjszlrrluzplizsu.supabase.co';
    const configuredProjectUrls = [auth, config]
      .flatMap((text) => text.match(/https:\/\/[a-z0-9-]+\.supabase\.co/gi) || []);
    if (configuredProjectUrls.some((url) => url !== expectedProjectUrl)) {
      errors.push('browser source contains a Supabase URL outside the confirmed Lumeya project');
    }
    if (/service[_-]?role/i.test(config.replace(/service-role[^\n]*/gi, ''))) {
      errors.push('public-config.js appears to contain a service-role value');
    }
    requirePattern(suggest, /public-config\.js[\s\S]*auth\.js/i, 'suggest.html does not load public config before auth', errors);
    requirePattern(bot, /if \(ctx\.from && !isPublicRequestFlow\(ctx\)\)/, 'Telegram public request flow can still create a profile', errors);
    requirePattern(bot, /startPublicRequestWorker\(\)/, 'public request admin notification worker is not started', errors);

    return { errors, warnings, info: { contractsChecked: 15 } };
  },
};
