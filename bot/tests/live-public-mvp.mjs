import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = String(process.env.SUPABASE_URL || '').trim();
const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!url || !publishableKey || !serviceRoleKey) {
  throw new Error('SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY are required.');
}

const anon = createClient(url, publishableKey, { auth: { persistSession: false } });
const service = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const token = randomUUID();
let requestId = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const submission = await anon.rpc('submit_public_discovery_request', {
    p_request_type: 'looking_for',
    p_subject: `Lumeya verification ${token.slice(0, 8)}`,
    p_details: 'Automated release verification request. This row will be removed before the test exits.',
    p_listing_type: null,
    p_location: 'Prague',
    p_preference: 'in_person',
    p_contact: `verification-${token}@example.invalid`,
    p_reference_url: null,
    p_source_page: '/bot/tests/live-public-mvp.mjs',
    p_honeypot: null,
  });
  assert(!submission.error, `anonymous request RPC failed: ${submission.error?.message}`);
  requestId = submission.data;
  assert(requestId, 'anonymous request RPC did not return an id');

  const directRead = await anon.from('public_discovery_requests').select('id').eq('id', requestId);
  assert(directRead.error, 'anonymous role could read private request rows');

  const legacyRpc = await anon.rpc('get_profile_by_telegram_id', { p_telegram_id: 1 });
  assert(legacyRpc.error, 'anonymous role could execute a dormant identity RPC');

  const events = await anon.from('events').select('id,type,status');
  assert(!events.error, `public events read failed: ${events.error?.message}`);
  assert((events.data || []).every((row) => row.type === 'public' && row.status === 'confirmed'), 'public events read returned a non-public or unconfirmed row');

  const services = await anon.from('services').select('id,type,status');
  assert(!services.error, `public services read failed: ${services.error?.message}`);
  assert((services.data || []).every((row) => row.type === 'public' && row.status === 'published'), 'public services read returned a non-public or unpublished row');

  const privateRow = await service.from('public_discovery_requests').select('id,contact,notification_status').eq('id', requestId).single();
  assert(!privateRow.error && privateRow.data?.id === requestId, 'service role could not read the private request queue');

  console.log('live-public-mvp: PASS');
} finally {
  if (requestId) {
    const cleanup = await service.from('public_discovery_requests').delete().eq('id', requestId);
    if (cleanup.error) console.error(`live-public-mvp cleanup failed: ${cleanup.error.message}`);
  }
}
