/*
 * Public runtime configuration for the Lumeya browser client.
 *
 * Populate these two publishable values only from Lumeya's dedicated Supabase
 * project. An empty configuration deliberately keeps the site in guest/fallback
 * mode. Never place a service-role or other privileged credential here.
 */
window.LumeyaConfig = Object.freeze({
  supabaseUrl: 'https://ccwvyjszlrrluzplizsu.supabase.co',
  supabasePublishableKey: 'sb_publishable_41TaV7iEZxB2Gp7qaUx29w_xo1MeUs1'
});
