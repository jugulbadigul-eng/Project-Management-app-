// =============================================================================
// Project Hub - Shared Authentication Helpers (auth.js)
// =============================================================================

const runtimeConfig = window.getSupabaseConfig ? window.getSupabaseConfig() : (window.__PROJECT_HUB_CONFIG__ || {});
const SUPABASE_URL = runtimeConfig.url || '';
const SUPABASE_KEY = runtimeConfig.anonKey || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn('[auth] Missing Supabase runtime config. Set window.__PROJECT_HUB_CONFIG__ before loading auth.js.');
} else if (window.supabase && typeof window.supabase.createClient === 'function') {
    if (!window.db) {
        window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { storage: window.createSupabaseAuthStorage ? window.createSupabaseAuthStorage() : undefined }
        });
    }
}

window.getCurrentUser = async () => {
    if (!window.db) return null;
    try {
        const { data: { user }, error } = await window.db.auth.getUser();
        return error ? null : user;
    } catch {
        return null;
    }
};

window.getSession = async () => {
    if (!window.db) return null;
    try {
        const { data: { session }, error } = await window.db.auth.getSession();
        return error ? null : session;
    } catch {
        return null;
    }
};
