/**
 * Records project actions in Supabase for access across devices.
 */
(function () {
    async function getContext() {
        const db = window.db;
        if (!db) throw new Error('Supabase is not configured.');
        const { data, error } = await db.auth.getUser();
        if (error) throw error;
        if (!data.user) throw new Error('No authenticated user is available.');
        const project = JSON.parse(localStorage.getItem('active_project') || 'null');
        const projectId = Number(window.__auditLogProjectId || (project && (project.project_id || project.id)));
        if (!Number.isSafeInteger(projectId) || projectId < 1) {
            throw new Error('No cloud project is selected.');
        }
        const element = document.getElementById('user-name-display') ||
            document.getElementById('user-display-email') ||
            document.getElementById('current-user') ||
            document.querySelector('.user-profile-name');
        const userName = element && element.textContent.trim()
            ? element.textContent.trim()
            : data.user.user_metadata?.full_name || data.user.email || 'User';
        return { db, userId: data.user.id, projectId, userName };
    }

    function logAction(action, entity, name, meta) {
        getContext().then(({ db, userId, projectId, userName }) =>
            db.from('audit_logs').insert([{
                project_id: projectId,
                user_id: userId,
                user_name: userName,
                action,
                entity,
                name: name || 'Untitled',
                meta: meta || null
            }])
        ).then(({ error }) => {
            if (error) throw error;
        }).catch(error => {
            console.error('Audit log was not saved to Supabase:', error);
        });
    }

    function getAuditLog() {
        return Array.isArray(window.__cloudAuditLogs) ? window.__cloudAuditLogs : [];
    }

    async function clearAuditLog() {
        const { db, projectId } = await getContext();
        const { error } = await db.from('audit_logs').delete()
            .eq('project_id', projectId);
        if (error) throw error;
        window.__cloudAuditLogs = [];
    }

    window.AuditLog = { log: logAction, get: getAuditLog, clear: clearAuditLog };
})();
