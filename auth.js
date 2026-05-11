/* auth.js - Common Supabase and Telegram Auth Logic */

const SUPABASE_URL = 'https://ccwvyjszlrrluzplizsu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_41TaV7iEZxB2Gp7qaUx29w_xo1MeUs1';

let supabaseClient = null;
if (window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  window.supabaseClient = supabaseClient;
}

const Auth = {
  user: {
    id: localStorage.getItem('ma3-user-id') || null,
    role: localStorage.getItem('ma3-user-role') || 'guest',
    name: localStorage.getItem('ma3-user-name') || null,
    isLoggedIn: !!localStorage.getItem('ma3-user-id')
  },

  async syncProfile(telegramId) {
    if (!supabaseClient) {
      console.warn('[Auth] Supabase client is not available.');
      return null;
    }

    const numericTelegramId = Number(telegramId);
    if (!Number.isSafeInteger(numericTelegramId)) {
      console.error('[Auth] Invalid Telegram ID.');
      return null;
    }

    console.log('[Auth] Syncing profile for TG ID:', telegramId);
    const { data, error } = await supabaseClient
      .rpc('get_profile_by_telegram_id', { p_telegram_id: numericTelegramId })
      .maybeSingle();

    if (error) {
      console.error('[Auth] Sync error:', error.message, error.details);
      return null;
    }

    if (data) {
      console.log('[Auth] Profile found:', data.role);
      this.saveSession(data);
      localStorage.setItem('ma3_user', JSON.stringify(data));
      return data;
    }
    return null;
  },

  saveSession(profile) {
    this.user.id = profile.id || profile.telegram_id;
    this.user.role = profile.role;
    this.user.name = profile.full_name;
    this.user.isLoggedIn = true;

    localStorage.setItem('ma3-user-id', this.user.id);
    localStorage.setItem('ma3-user-role', profile.role);
    localStorage.setItem('ma3-user-name', profile.full_name || '');
    
    // Dispatch event for other components to react
    document.dispatchEvent(new CustomEvent('ma3-auth-changed', { detail: this.user }));
  },

  logout() {
    this.user = { id: null, role: 'guest', name: null, isLoggedIn: false };
    localStorage.removeItem('ma3-user-id');
    localStorage.removeItem('ma3-user-role');
    localStorage.removeItem('ma3-user-name');
    document.dispatchEvent(new CustomEvent('ma3-auth-changed', { detail: this.user }));
  },

  init() {
    // Handle URL login from bot
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');
    
    console.log('[Auth] Checking URL for userId:', userId);
    
    if (userId) {
      this.syncProfile(userId).finally(() => {
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
      });
    }

    // Initialize UI on load
    document.addEventListener('DOMContentLoaded', () => {
      // Small delay to ensure all scripts are ready
      setTimeout(() => {
        if (window.MA3Auth && window.MA3Menu) {
          window.MA3Menu.updateAuthUI(window.MA3Auth.user);
        }
      }, 100);
    });
  }
};


Auth.init();
window.MA3Auth = Auth;
