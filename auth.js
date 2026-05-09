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
    if (!supabaseClient) return null;

    try {
      const { data: profile, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('telegram_id', telegramId)
        .single();

      if (!error && profile) {
        this.saveSession(profile);
        return profile;
      }
    } catch (err) {
      console.error('Auth sync error:', err);
    }
    return null;
  },

  saveSession(profile) {
    this.user.id = profile.id;
    this.user.role = profile.role;
    this.user.name = profile.full_name;
    this.user.isLoggedIn = true;

    localStorage.setItem('ma3-user-id', profile.id);
    localStorage.setItem('ma3-user-role', profile.role);
    localStorage.setItem('ma3-user-name', profile.full_name);
    
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
      this.syncProfile(userId).then((profile) => {
        if (profile) {
          console.log('[Auth] Successfully synced profile for userId:', userId);
          // Clean URL
          const newUrl = window.location.pathname + window.location.hash;
          window.history.replaceState({}, document.title, newUrl);
        } else {
          console.warn('[Auth] Failed to sync profile for userId:', userId);
        }
      });
    }

    // Refresh UI on load
    document.dispatchEvent(new CustomEvent('ma3-auth-changed', { detail: this.user }));
  }
};


Auth.init();
window.MA3Auth = Auth;
