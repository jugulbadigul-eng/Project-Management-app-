// =============================================================================
// Project Hub - Central Auth Guard, Anti-Flash & Profile Authorization
// =============================================================================

(function () {
    var runtimeConfig = window.getSupabaseConfig ? window.getSupabaseConfig() : (window.__PROJECT_HUB_CONFIG__ || {});
    var SUPABASE_URL = runtimeConfig.url || '';
    var SUPABASE_ANON_KEY = runtimeConfig.anonKey || '';

    var currentPath = window.location.pathname.toLowerCase();
    var isPublicPage = currentPath.endsWith('index.html') ||
                       currentPath.endsWith('/') ||
                       currentPath.endsWith('/index') ||
                       currentPath.endsWith('reset-password.html') ||
                       currentPath.endsWith('/reset-password');
    var postLoginPaths = [
        '/dashboard.html',
        '/project-dashboard.html',
        '/project-details.html',
        '/Project-report.html',
        '/tasks.html',
        '/task-board.html',
        '/add-diary-entry.html',
        '/add-task.html',
        '/team-members.html',
        '/milestones.html',
        '/issues.html',
        '/weekly-reports.html',
        '/audit-log.html',
        '/timeline.html'
    ];

    function getPostLoginTarget(target) {
        try {
            var destination = new URL(target || 'dashboard.html', window.location.origin);
            var allowedPath = postLoginPaths.find(function (path) {
                return path.toLowerCase() === destination.pathname.toLowerCase();
            });
            if (destination.origin !== window.location.origin || !allowedPath) {
                return 'dashboard.html';
            }
            return allowedPath + destination.search + destination.hash;
        } catch (e) {
            return 'dashboard.html';
        }
    }

    function authTokenStorageKeys(storage) {
        var keys = [];
        for (var i = 0; i < storage.length; i++) {
            var key = storage.key(i);
            if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) keys.push(key);
        }
        return keys;
    }

    window.setAuthStorageMode = function (rememberMe) {
        var other = rememberMe ? sessionStorage : localStorage;
        try {
            if (rememberMe) sessionStorage.removeItem('auth_storage_mode');
            else sessionStorage.setItem('auth_storage_mode', 'session');
            authTokenStorageKeys(other).forEach(function(key) {
                other.removeItem(key);
            });
        } catch (e) {
            console.warn('[AuthGuard] Could not update sign-in storage mode:', e);
        }
    };

    window.createSupabaseAuthStorage = function () {
        return {
            getItem: function (key) {
                var sessionOnly = sessionStorage.getItem('auth_storage_mode') === 'session';
                var primary = sessionOnly ? sessionStorage : localStorage;
                var secondary = sessionOnly ? localStorage : sessionStorage;
                return primary.getItem(key) || secondary.getItem(key);
            },
            setItem: function (key, value) {
                var sessionOnly = sessionStorage.getItem('auth_storage_mode') === 'session';
                var primary = sessionOnly ? sessionStorage : localStorage;
                var secondary = sessionOnly ? localStorage : sessionStorage;
                primary.setItem(key, value);
                secondary.removeItem(key);
            },
            removeItem: function (key) {
                localStorage.removeItem(key);
                sessionStorage.removeItem(key);
            }
        };
    };

    // ─── SESSION CHECK ────────────────────────────────────────────────────────
    function hasLikelySession() {
        try {
            // Check localStorage for persistent sessions
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
                    var val = localStorage.getItem(k);
                    if (val && val.includes('access_token')) return true;
                }
            }
            // Check sessionStorage for session-only logins (Remember me unchecked)
            for (var j = 0; j < sessionStorage.length; j++) {
                var sk = sessionStorage.key(j);
                if (sk && sk.startsWith('sb-') && sk.endsWith('-auth-token')) {
                    var sv = sessionStorage.getItem(sk);
                    if (sv && sv.includes('access_token')) return true;
                }
            }
        } catch (e) {}
        return false;
    }

    var isLikelyAuthenticated = hasLikelySession();

    // ─── ANTI-FLASH ───────────────────────────────────────────────────────────
    // STRATEGY: Always hide EVERY page immediately using display:none in <head>.
    //
    // For protected pages (authenticated users):
    //   - Page is hidden on navigation start (display:none)
    //   - Each page calls window.revealPage() after rendering cached data
    //     synchronously in DOMContentLoaded. This reveals the page with content
    //     already filled — zero blank flash.
    //
    // For protected pages (unauthenticated users):
    //   - Page stays hidden until auth check redirects to login.
    //
    // For login page (index.html) when authenticated:
    //   - Hidden until redirect to dashboard fires.
    //
    // For login page (index.html) when not authenticated:
    //   - Hidden briefly, revealed once the login form scripts have run.

    var hideStyle = document.createElement('style');
    hideStyle.id = 'auth-anti-flash';
    hideStyle.textContent = 'body { display: none !important; }';

    if (document.head) {
        document.head.appendChild(hideStyle);
    } else if (document.documentElement) {
        document.documentElement.appendChild(hideStyle);
    }

    var pageRevealed = false;
    function revealPage() {
        if (pageRevealed) return;
        pageRevealed = true;
        if (hideStyle && hideStyle.parentNode) {
            hideStyle.parentNode.removeChild(hideStyle);
            hideStyle = null;
        }
        // Trigger a tiny fade-in for smoothness
        if (document.body) {
            document.body.style.opacity = '0';
            document.body.style.transition = 'opacity 0.12s ease';
            // Use rAF so the initial opacity:0 is painted before transition starts
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    if (document.body) {
                        document.body.style.opacity = '1';
                        setTimeout(function() {
                            if (document.body) {
                                document.body.style.opacity = '';
                                document.body.style.transition = '';
                            }
                        }, 130);
                    }
                });
            });
        }
    }

    // Expose globally so each page's DOMContentLoaded can call it after cache render
    window.revealPage = revealPage;

    // Safety net: never leave the page permanently hidden
    var safetyTimer = setTimeout(function () {
        if (!pageRevealed) {
            console.warn('[AuthGuard] Safety timer fired — revealing page');
            revealPage();
        }
    }, isLikelyAuthenticated ? 2000 : 6000);

    // ─── SUPABASE CLIENT ─────────────────────────────────────────────────────
    if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase && typeof window.supabase.createClient === 'function') {
        if (!window.db) {
            window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: { storage: window.createSupabaseAuthStorage() }
            });
        }
    } else if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.warn('[AuthGuard] Missing Supabase runtime config. Set window.__PROJECT_HUB_CONFIG__ before loading auth-guard.js.');
    }

    window.getCurrentUser = async function () {
        if (!window.db) return null;
        try {
            var r = await window.db.auth.getUser();
            return r.error ? null : r.data.user;
        } catch (e) { return null; }
    };

    window.getSession = async function () {
        if (!window.db) return null;
        try {
            var r = await window.db.auth.getSession();
            return r.error ? null : r.data.session;
        } catch (e) { return null; }
    };

    // ─── PROFILE VERIFICATION & AUTO-PROVISIONING ────────────────────────────
    async function verifyUserProfile(user) {
        if (!user) return null;

        var name = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ||
                   (user.email ? user.email.split('@')[0] : 'User');
        var requestedRole = String((user.user_metadata && user.user_metadata.role) || 'TEAM_MEMBER').toUpperCase();
        var role = ['ADMIN', 'PROJECT_MANAGER', 'TEAM_MEMBER'].indexOf(requestedRole) >= 0
            ? requestedRole
            : 'TEAM_MEMBER';
        var usernameBase = (user.email ? user.email.split('@')[0] : name)
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 24) || 'user';
        var profileData = {
            user_id: user.id,
            username: usernameBase + '_' + user.id.replace(/-/g, '').slice(0, 8),
            email: user.email || null,
            full_name: name,
            role: role
        };

        if (!window.db) return profileData;

        try {
            // 1. Session cache fast path
            try {
                var raw = sessionStorage.getItem('vp_' + user.id);
                if (raw) {
                    var cached = JSON.parse(raw);
                    if (cached && cached.user_id === user.id) return cached;
                }
            } catch (e) {}

            // 2. Query profiles by user_id
            var r1 = await window.db.from('profiles')
                .select('user_id, email, full_name, role')
                .eq('user_id', user.id).maybeSingle();
            if (r1.data) {
                try { sessionStorage.setItem('vp_' + user.id, JSON.stringify(r1.data)); } catch(e){}
                try { localStorage.setItem('registered_user_' + user.id, 'true'); } catch(e){}
                return r1.data;
            }

            // 3. Query profiles by email and associate with user_id
            if (user.email) {
                var r2 = await window.db.from('profiles')
                    .select('user_id, email, full_name, role')
                    .eq('email', user.email).maybeSingle();
                if (r2.data) {
                    window.db.from('profiles').update({ user_id: user.id }).eq('email', user.email).then(function(){}).catch(function(){});
                    try { sessionStorage.setItem('vp_' + user.id, JSON.stringify(r2.data)); } catch(e){}
                    try { localStorage.setItem('registered_user_' + user.id, 'true'); } catch(e){}
                    return r2.data;
                }
            }

            // 4. Auto-provision missing profile row in Supabase database
            try {
                window.db.from('profiles').upsert([profileData], { onConflict: 'user_id' }).then(function(res) {
                    if (res.error) console.warn('[AuthGuard] Profile auto-provision notice:', res.error.message);
                }).catch(function(err) {
                    console.warn('[AuthGuard] Profile auto-provision error:', err);
                });
            } catch (err) {
                console.warn('[AuthGuard] Profile upsert notice:', err);
            }

            try { sessionStorage.setItem('vp_' + user.id, JSON.stringify(profileData)); } catch(e){}
            try { localStorage.setItem('registered_user_' + user.id, 'true'); } catch(e){}
            return profileData;
        } catch (e) {
            console.warn('[AuthGuard] verifyUserProfile notice:', e);
            try { sessionStorage.setItem('vp_' + user.id, JSON.stringify(profileData)); } catch(err){}
            try { localStorage.setItem('registered_user_' + user.id, 'true'); } catch(err){}
            return profileData;
        }
    }

    async function updateExistingUserProfile(user) {
        if (!user || !window.db) return;
        try {
            var name = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ||
                       (user.email ? user.email.split('@')[0] : 'User');
            await window.db.from('profiles').update({ full_name: name }).eq('user_id', user.id);
        } catch (e) {}
    }

    async function registerNewUser(user) {
        if (!user || !window.db) return true;
        var name = (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) ||
                   (user.email ? user.email.split('@')[0] : 'User');
        try { localStorage.setItem('registered_user_' + user.id, 'true'); } catch(e){}
        var usernameBase = (user.email ? user.email.split('@')[0] : name)
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 24) || 'user';
        var username = usernameBase + '_' + user.id.replace(/-/g, '').slice(0, 8);
        try { await window.db.auth.updateUser({ data: { is_registered: true, full_name: name, role: 'TEAM_MEMBER' } }); } catch(e){}
        try {
            var ins = await window.db.from('profiles').upsert({
                user_id: user.id,
                username: username,
                email: user.email || null,
                full_name: name,
                role: 'TEAM_MEMBER'
            }, { onConflict: 'user_id' });
            if (ins.error) console.warn('[AuthGuard] Profile registration notice:', ins.error.message);
        } catch(e){}
        return true;
    }

    // ─── DOM UPDATES ─────────────────────────────────────────────────────────
    window.getUserDisplayName = function (user, profile) {
        var profileName = profile && typeof profile.full_name === 'string' ? profile.full_name.trim() : '';
        var metadata = user && user.user_metadata ? user.user_metadata : {};
        var metadataName = (metadata.full_name || metadata.name || '').trim();
        var emailName = user && user.email ? user.email.split('@')[0] : '';
        return profileName || metadataName || emailName || 'User';
    };

    function updateDOMUserInfo(user, profile) {
        if (!user) return;
        var email  = user.email || '';
        var name   = window.getUserDisplayName(user, profile);
        var avatar = (user.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture)) || '';

        var userCache = sessionStorage.getItem('auth_storage_mode') === 'session' ? sessionStorage : localStorage;
        try { userCache.setItem('cached_user_email', email); } catch(e){}
        try { userCache.setItem('cached_user_name',  name);  } catch(e){}

        document.querySelectorAll('#user-display-email, .user-email, .current-user-email')
            .forEach(function(el) { el.textContent = email; });
        document.querySelectorAll('#user-display-name, #sidebar-user-name, .user-name, .current-user-name, #user-name-display')
            .forEach(function(el) { el.textContent = name; });
        if (avatar) {
            document.querySelectorAll('#user-avatar, .user-avatar-img, .header-avatar')
                .forEach(function(el) { if (el.tagName === 'IMG') el.src = avatar; });
        }
        var initials = name.split(' ').map(function(p){ return p.charAt(0); }).join('').slice(0, 2).toUpperCase() || name.charAt(0).toUpperCase();
        document.querySelectorAll('#avatar-circle, #user-avatar-circle, .avatar, .s-avatar')
            .forEach(function(el) {
                if (el.tagName !== 'IMG') {
                    el.textContent = initials;
                }
            });
    }

    function populateCachedUserInfo() {
        try {
            var email = sessionStorage.getItem('cached_user_email') || localStorage.getItem('cached_user_email') || '';
            var name  = sessionStorage.getItem('cached_user_name') || localStorage.getItem('cached_user_name') || (email ? email.split('@')[0] : '');
            if (email) {
                document.querySelectorAll('#user-display-email, .user-email, .current-user-email')
                    .forEach(function(el) {
                        el.textContent = email;
                    });
            }
            if (name) {
                document.querySelectorAll('#user-display-name, #sidebar-user-name, .user-name, .current-user-name, #user-name-display')
                    .forEach(function(el) {
                        el.textContent = name;
                    });
                var initials = name.split(' ').map(function(p){ return p.charAt(0); }).join('').slice(0, 2).toUpperCase() || name.charAt(0).toUpperCase();
                document.querySelectorAll('#avatar-circle, #user-avatar-circle, .avatar, .s-avatar')
                    .forEach(function(el) {
                        if (el.tagName !== 'IMG') {
                            el.textContent = initials;
                        }
                    });
            }
        } catch(e){}
    }

    // ─── LOGOUT ──────────────────────────────────────────────────────────────
    window.handleLogout = async function () {
        try { if (window.db) await window.db.auth.signOut(); } catch(e){}
        try {
            localStorage.removeItem('cached_user_email');
            localStorage.removeItem('cached_user_name');
            localStorage.removeItem('supabase.auth.token');
            sessionStorage.clear();
        } catch(e){}
        window.location.replace('index.html');
    };

    // ─── AUTH ENFORCEMENT ────────────────────────────────────────────────────
    // This runs in the background AFTER the page is already visible.
    // It silently verifies auth and redirects if invalid.
    var isVerifying = false;
    async function enforceAuth(session) {
        if (isVerifying) return;
        isVerifying = true;
        try {
            if (!session || !session.user) {
                var hasOAuth = (window.location.hash && (window.location.hash.includes('access_token') || window.location.hash.includes('error'))) ||
                               (window.location.search && (window.location.search.includes('code=') || window.location.search.includes('error=')));
                if (hasOAuth) {
                    // Wait for Supabase to process OAuth callback
                    setTimeout(async function() {
                        if (window.db) {
                            var r = await window.db.auth.getSession();
                            if (!r.data.session && !isPublicPage) window.location.replace('index.html');
                        }
                    }, 4000);
                    return;
                }
                if (!isPublicPage) {
                    sessionStorage.setItem('redirect_after_login', window.location.href);
                    window.location.replace('index.html');
                } else {
                    revealPage(); // Not logged in on login page — show it
                }
                return;
            }

            var user   = session.user;
            var record = await verifyUserProfile(user);

            // Clean any stale error states
            try {
                localStorage.removeItem('auth_flow_mode');
                localStorage.removeItem('auth_login_error');
                sessionStorage.removeItem('auth_login_error');
            } catch(e){}

            // Update UI elements across page
            updateDOMUserInfo(user, record);
            clearTimeout(safetyTimer);
            revealPage();
            updateExistingUserProfile(user);

            // If on the login/landing page, navigate forward to dashboard
            if (isPublicPage) {
                var target = getPostLoginTarget(sessionStorage.getItem('redirect_after_login'));
                sessionStorage.removeItem('redirect_after_login');
                window.location.replace(target);
            }
        } finally {
            isVerifying = false;
        }
    }

    // ─── INIT ────────────────────────────────────────────────────────────────
    async function initAuth() {
        if (!window.db) { revealPage(); return; }

        window.db.auth.onAuthStateChange(async function(event, session) {
            if (event === 'SIGNED_OUT') {
                if (!isPublicPage) window.location.replace('index.html');
            } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                if (session && session.user) await enforceAuth(session);
            }
        });

        try {
            var r = await window.db.auth.getSession();
            await enforceAuth(r.data.session);
        } catch(err) {
            console.error('[AuthGuard] Session error:', err);
            if (!isPublicPage) window.location.replace('index.html');
            else revealPage();
        }
    }

    // ─── BOOTSTRAP ───────────────────────────────────────────────────────────
    function bootstrap() {
        if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase && typeof window.supabase.createClient === 'function') {
            if (!window.db) {
                window.db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                    auth: { storage: window.createSupabaseAuthStorage() }
                });
            }
        }

        populateCachedUserInfo();

        // For authenticated users on protected pages:
        // Each page's own DOMContentLoaded handler calls window.revealPage() 
        // after rendering cached data. initAuth() runs in background.
        //
        // For unauthenticated users / login page: enforceAuth() calls revealPage().
        //
        // If this is the public login page and user is NOT authenticated, reveal now.
        if (isPublicPage && !isLikelyAuthenticated) {
            // Will be revealed by the login page's own script after setup
            // or by enforceAuth. Do nothing here — revealPage will be called.
        }

        initAuth();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})();
