(function () {
    const fallbackConfig = {
        supabaseUrl: 'https://umdccvvyjyuepmzmqqfn.supabase.co',
        supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtZGNjdnZ5anl1ZXBtem1xcWZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MjA5MTEsImV4cCI6MjEwNTA5NjkxMX0.oLe9xzu-JlpfKQ1oFhKnVUux5XxsgRNEz4btnzFmJqU',
        siteUrl: (window.location && window.location.origin) ? window.location.origin : ''
    };

    const runtimeConfig = Object.assign({}, fallbackConfig, window.__PROJECT_HUB_CONFIG__ || {});
    window.__PROJECT_HUB_CONFIG__ = runtimeConfig;

    window.getSupabaseConfig = function () {
        const config = window.__PROJECT_HUB_CONFIG__ || {};
        const url = (config.supabaseUrl || config.SUPABASE_URL || '').toString().trim();
        const anonKey = (config.supabaseAnonKey || config.SUPABASE_ANON_KEY || config.SUPABASE_KEY || '').toString().trim();
        const siteUrl = (config.siteUrl || config.SITE_URL || (window.location && window.location.origin) || '').toString().trim();

        return {
            url,
            anonKey,
            siteUrl
        };
    };
})();
