/* auth.js - Public Supabase client and dormant browser authentication */

(function () {
  'use strict';

  const publicConfig = window.LumeyaConfig || {};
  const SUPABASE_URL = String(publicConfig.supabaseUrl || '').trim();
  const SUPABASE_PUBLISHABLE_KEY = String(publicConfig.supabasePublishableKey || '').trim();
  const LEGACY_IDENTITY_KEYS = [
    'ma3-user-id',
    'ma3-user-role',
    'ma3-user-name',
    'ma3_user'
  ];

  const guestUser = () => ({
    id: null,
    role: 'guest',
    name: null,
    isLoggedIn: false
  });

  function validPublicConfig() {
    if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL)) return false;
    if (!SUPABASE_PUBLISHABLE_KEY || /service_role/i.test(SUPABASE_PUBLISHABLE_KEY)) return false;
    return SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_') || SUPABASE_PUBLISHABLE_KEY.split('.').length === 3;
  }

  let supabaseClient = null;
  if (validPublicConfig() && window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    window.supabaseClient = supabaseClient;
  }
  window.LumeyaDataService = Object.freeze({
    available: Boolean(supabaseClient),
    projectHost: supabaseClient ? new URL(SUPABASE_URL).host : null
  });

  function clearLegacyIdentity() {
    try {
      LEGACY_IDENTITY_KEYS.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      // Guest mode must still initialize when storage is blocked.
    }

    const url = new URL(window.location.href);
    if (url.searchParams.has('userId')) {
      url.searchParams.delete('userId');
      window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
    }
  }

  function notifyGuestState() {
    document.dispatchEvent(new CustomEvent('ma3-auth-changed', {
      detail: Auth.user
    }));
  }

  const Auth = {
    user: guestUser(),

    // Browser identity is deliberately dormant for the public MVP. Telegram IDs
    // are not credentials and must never be used to restore a browser session.
    async syncProfile() {
      return null;
    },

    saveSession() {
      this.user = guestUser();
      clearLegacyIdentity();
      notifyGuestState();
      return null;
    },

    logout() {
      this.user = guestUser();
      clearLegacyIdentity();
      notifyGuestState();
    },

    init() {
      clearLegacyIdentity();
      this.user = guestUser();

      const updateUi = () => {
        notifyGuestState();
        if (window.MA3Menu && typeof window.MA3Menu.updateAuthUI === 'function') {
          window.MA3Menu.updateAuthUI(this.user);
        }
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateUi, { once: true });
      } else {
        updateUi();
      }
    }
  };

  window.MA3Auth = Auth;
  Auth.init();
})();
