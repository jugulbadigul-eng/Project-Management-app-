/**
 * audit-log.js
 * Records who did what and when across tasks, milestones, and issues.
 * Stores up to 500 entries in localStorage under 'audit_log'.
 */
(function () {
    const AUDIT_KEY = 'audit_log';
    const MAX_ENTRIES = 500;

    function getCurrentUser() {
        const el = document.getElementById('user-name-display') ||
                   document.getElementById('user-display-email') ||
                   document.getElementById('current-user') ||
                   document.querySelector('.user-profile-name');
        if (el && el.textContent.trim()) return el.textContent.trim();
        try {
            const stored = localStorage.getItem('supabase.auth.token') || localStorage.getItem('sb-access-token');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.user?.email) return parsed.user.email;
                if (parsed?.currentSession?.user?.email) return parsed.currentSession.user.email;
            }
        } catch(e) {}
        return 'System';
    }

    /**
     * Log an action.
     * @param {string} action   - e.g. 'Created', 'Updated', 'Deleted', 'Status Changed'
     * @param {string} entity   - e.g. 'Task', 'Milestone', 'Issue'
     * @param {string} name     - The name/title of the item
     * @param {Object} [meta]   - Optional extra detail { field, from, to }
     */
    function logAction(action, entity, name, meta) {
        try {
            const logs = getAuditLog();
            const entry = {
                id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                timestamp: new Date().toISOString(),
                user: getCurrentUser(),
                action,
                entity,
                name: name || 'Untitled',
                meta: meta || null
            };
            logs.unshift(entry);
            if (logs.length > MAX_ENTRIES) logs.length = MAX_ENTRIES;
            localStorage.setItem(AUDIT_KEY, JSON.stringify(logs));
        } catch (e) {
            console.error('AuditLog error:', e);
        }
    }

    function getAuditLog() {
        try {
            return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]');
        } catch (e) { return []; }
    }

    function clearAuditLog() {
        try {
            localStorage.removeItem(AUDIT_KEY);
        } catch (e) {}
    }

    // Expose globally
    window.AuditLog = { log: logAction, get: getAuditLog, clear: clearAuditLog };
})();
