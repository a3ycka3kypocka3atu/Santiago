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
    console.log('[Auth] Syncing profile for TG ID:', telegramId);
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (error) {
      console.error('[Auth] Sync error:', error.message, error.details);
      return null;
    }

    if (data) {
      console.log('[Auth] Profile found:', data.role);
      this.user = data;
      localStorage.setItem('ma3_user', JSON.stringify(data));
      document.dispatchEvent(new CustomEvent('ma3-auth-changed', { detail: data }));
      return data;
    }
    return null;
  },

  saveSession(profile) {
    this.user.id = profile.id || profile.telegram_id;
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
    const urlRole = params.get('role');
    
    console.log('[Auth] Checking URL for userId:', userId, 'role:', urlRole);
    
    if (userId) {
      if (urlRole) {
        // Direct role bypass for speed and convenience
        console.log('[Auth] Using role from URL:', urlRole);
        const tempUser = { 
          telegram_id: userId, 
          role: urlRole, 
          full_name: 'Resident' 
        };
        this.saveSession(tempUser);
        
        // Clean URL
        const newUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, newUrl);
      } else {
        // Fallback to DB sync if no role in URL
        this.syncProfile(userId).then((profile) => {
          if (profile) {
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, newUrl);
          }
        });
      }
    }

    // Initialize UI on load
    document.addEventListener('DOMContentLoaded', () => {
      // Small delay to ensure all scripts are ready
      setTimeout(() => {
        if (window.MA3Auth) {
          MA3Menu.updateAuthUI(window.MA3Auth.user);
        }
      }, 100);
    });
  }
};


Auth.init();
window.MA3Auth = Auth;
