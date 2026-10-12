/**
 * notifications.js
 * Overdue Tasks & Milestones Notification System
 * ─────────────────────────────────────────────────
 * Include this script in any page that has a #notif-bell-container element.
 * It reads cached tasks + milestones from localStorage and shows a badge
 * with a dropdown listing overdue / due-today / due-soon items.
 */

(function () {
    const TASKS_KEY = 'cached_tasks_list';
    const MILESTONES_KEY = 'cached_milestones_data';
    const DISMISSED_KEY = 'dismissed_notifications';

    // ── Helpers ───────────────────────────────────────────────────────
    function today() {
        return new Date(new Date().toDateString());
    }

    function parseDate(str) {
        if (!str) return null;
        const monthMap = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
        const parts = str.trim().split(/[\s\-\/]+/);
        if (parts.length === 3) {
            if (parts[0].length === 4) return new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
            if (monthMap[parts[1]] !== undefined) return new Date(parseInt(parts[2]), monthMap[parts[1]], parseInt(parts[0]));
        }
        const d = new Date(str);
        return isNaN(d) ? null : new Date(d.toDateString());
    }

    function daysDiff(dateObj) {
        if (!dateObj) return null;
        const todayMs = today().getTime();
        return Math.round((dateObj.getTime() - todayMs) / 86400000);
    }

    function getDismissed() {
        try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]'); } catch(e) { return []; }
    }

    function saveDismissed(arr) {
        try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(arr)); } catch(e) {}
    }

    function dismissNotif(id) {
        const arr = getDismissed();
        if (!arr.includes(id)) arr.push(id);
        saveDismissed(arr);
        buildNotifications();
    }
    window.dismissNotif = dismissNotif;

    // ── Data collection ───────────────────────────────────────────────
    function collectAlerts() {
        const dismissed = getDismissed();
        const alerts = [];

        // Tasks
        try {
            const tasks = JSON.parse(localStorage.getItem(TASKS_KEY) || '[]');
            tasks.forEach(function(t) {
                const id = t.task_id || t.id;
                const notifId = 'task-' + id;
                if (dismissed.includes(notifId)) return;
                const status = (t.status || '').toLowerCase();
                if (status === 'completed') return;

                const due = parseDate(t.due_date || t.due);
                const diff = daysDiff(due);
                if (diff === null) return;

                if (diff < 0) {
                    alerts.push({ id: notifId, type: 'overdue', label: 'Task Overdue',
                        name: t.task_name || t.name || 'Untitled Task',
                        detail: 'Due ' + Math.abs(diff) + ' day' + (Math.abs(diff) !== 1 ? 's' : '') + ' ago',
                        link: 'tasks.html', icon: '\uD83D\uDD34' });
                } else if (diff === 0) {
                    alerts.push({ id: notifId, type: 'today', label: 'Due Today',
                        name: t.task_name || t.name || 'Untitled Task',
                        detail: 'Due today', link: 'tasks.html', icon: '\uD83D\uDFE1' });
                } else if (diff <= 3) {
                    alerts.push({ id: notifId, type: 'soon', label: 'Due Soon',
                        name: t.task_name || t.name || 'Untitled Task',
                        detail: 'Due in ' + diff + ' day' + (diff !== 1 ? 's' : ''),
                        link: 'tasks.html', icon: '\uD83D\uDFE0' });
                }
            });
        } catch(e) {}

        // Milestones
        try {
            const milestones = JSON.parse(localStorage.getItem(MILESTONES_KEY) || '[]');
            milestones.forEach(function(m) {
                const id = m.id;
                const notifId = 'ms-' + id;
                if (dismissed.includes(notifId)) return;
                const status = (m.status || '').toLowerCase();
                if (status === 'completed') return;

                const due = parseDate(m.date || m.target_date);
                const diff = daysDiff(due);
                if (diff === null) return;

                if (diff < 0) {
                    alerts.push({ id: notifId, type: 'overdue', label: 'Milestone Overdue',
                        name: m.name || m.milestone_name || 'Untitled Milestone',
                        detail: 'Target was ' + Math.abs(diff) + ' day' + (Math.abs(diff) !== 1 ? 's' : '') + ' ago',
                        link: 'milestones.html', icon: '\uD83D\uDD34' });
                } else if (diff === 0) {
                    alerts.push({ id: notifId, type: 'today', label: 'Milestone Due Today',
                        name: m.name || m.milestone_name || 'Untitled Milestone',
                        detail: 'Target date is today', link: 'milestones.html', icon: '\uD83D\uDFE1' });
                } else if (diff <= 7) {
                    alerts.push({ id: notifId, type: 'soon', label: 'Milestone Due Soon',
                        name: m.name || m.milestone_name || 'Untitled Milestone',
                        detail: 'Target in ' + diff + ' day' + (diff !== 1 ? 's' : ''),
                        link: 'milestones.html', icon: '\uD83D\uDFE0' });
                }
            });
        } catch(e) {}

        var order = { overdue: 0, today: 1, soon: 2 };
        alerts.sort(function(a, b) { return (order[a.type] || 3) - (order[b.type] || 3); });
        return alerts;
    }

    // ── Render ────────────────────────────────────────────────────────
    function escapeNotif(str) {
        return String(str || '').replace(/[&<>"']/g, function(c) {
            return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
        });
    }

    function buildNotifications() {
        var container = document.getElementById('notif-bell-container');
        if (!container) return;

        var alerts = collectAlerts();
        var count = alerts.length;
        var overdueCount = alerts.filter(function(a) { return a.type === 'overdue'; }).length;

        var itemsHtml = count === 0 ?
            '<div class="notif-empty"><svg width="32" height="32" fill="none" stroke="#94a3b8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><p>All caught up! No overdue items.</p></div>' :
            alerts.map(function(a) {
                return '<div class="notif-item ' + a.type + '" data-id="' + a.id + '">' +
                    '<span class="notif-icon">' + a.icon + '</span>' +
                    '<div class="notif-content">' +
                    '<span class="notif-label">' + a.label + '</span>' +
                    '<span class="notif-name">' + escapeNotif(a.name) + '</span>' +
                    '<span class="notif-detail">' + a.detail + '</span>' +
                    '</div>' +
                    '<div class="notif-actions">' +
                    '<a href="' + a.link + '" class="notif-goto" title="Go to page">&rarr;</a>' +
                    '<button class="notif-dismiss-btn" onclick="dismissNotif(\'' + a.id + '\')" title="Dismiss">&times;</button>' +
                    '</div>' +
                    '</div>';
            }).join('');

        container.innerHTML =
            '<div class="notif-wrapper" id="notif-wrapper">' +
            '<button class="notif-bell-btn" id="notif-bell-btn" onclick="toggleNotifPanel()" title="Notifications" aria-label="Notifications (' + count + ')">' +
            '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>' +
            (count > 0 ? '<span class="notif-badge ' + (overdueCount > 0 ? 'overdue' : 'soon') + '">' + count + '</span>' : '') +
            '</button>' +
            '<div class="notif-panel" id="notif-panel" style="display:none;">' +
            '<div class="notif-panel-header"><span>Notifications</span>' +
            (count > 0 ? '<button class="notif-dismiss-all" onclick="dismissAllNotifs()">Dismiss all</button>' : '') +
            '</div>' +
            '<div class="notif-panel-body">' + itemsHtml + '</div>' +
            '</div>' +
            '</div>';
    }

    window.toggleNotifPanel = function() {
        var panel = document.getElementById('notif-panel');
        if (!panel) return;
        panel.style.display = panel.style.display !== 'none' ? 'none' : 'block';
    };

    window.dismissAllNotifs = function() {
        var alerts = collectAlerts();
        var dismissed = getDismissed();
        alerts.forEach(function(a) { if (!dismissed.includes(a.id)) dismissed.push(a.id); });
        saveDismissed(dismissed);
        buildNotifications();
    };

    document.addEventListener('click', function(e) {
        var wrapper = document.getElementById('notif-wrapper');
        if (wrapper && !wrapper.contains(e.target)) {
            var panel = document.getElementById('notif-panel');
            if (panel) panel.style.display = 'none';
        }
    });

    // ── CSS ───────────────────────────────────────────────────────────
    var style = document.createElement('style');
    style.textContent = [
        '.notif-wrapper{position:relative;display:inline-flex;align-items:center;}',
        '.notif-bell-btn{position:relative;background:none;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;cursor:pointer;color:#64748b;display:flex;align-items:center;transition:background .15s,border-color .15s,color .15s;}',
        '.notif-bell-btn:hover{background:#f1f5f9;border-color:#cbd5e1;color:#0f172a;}',
        '.notif-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;border-radius:9px;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 4px;border:2px solid #fff;line-height:1;}',
        '.notif-badge.overdue{background:#ef4444;color:#fff;}',
        '.notif-badge.soon{background:#f59e0b;color:#fff;}',
        '.notif-panel{position:absolute;top:calc(100% + 10px);right:0;width:340px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;box-shadow:0 20px 40px -8px rgba(0,0,0,.12),0 4px 8px -4px rgba(0,0,0,.06);z-index:999;overflow:hidden;animation:notif-slide-in .18s ease;}',
        '@keyframes notif-slide-in{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}',
        '.notif-panel-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 12px;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9;}',
        '.notif-dismiss-all{background:none;border:none;cursor:pointer;font-size:11px;color:#94a3b8;font-weight:600;padding:2px 6px;border-radius:4px;transition:background .12s,color .12s;}',
        '.notif-dismiss-all:hover{background:#fee2e2;color:#dc2626;}',
        '.notif-panel-body{max-height:380px;overflow-y:auto;}',
        '.notif-item{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-bottom:1px solid #f8fafc;transition:background .12s;}',
        '.notif-item:last-child{border-bottom:none;}',
        '.notif-item:hover{background:#f8fafc;}',
        '.notif-item.overdue{border-left:3px solid #ef4444;}',
        '.notif-item.today{border-left:3px solid #f59e0b;}',
        '.notif-item.soon{border-left:3px solid #fb923c;}',
        '.notif-icon{font-size:16px;margin-top:1px;flex-shrink:0;}',
        '.notif-content{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0;}',
        '.notif-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#94a3b8;}',
        '.notif-item.overdue .notif-label{color:#ef4444;}',
        '.notif-item.today .notif-label{color:#d97706;}',
        '.notif-item.soon .notif-label{color:#ea580c;}',
        '.notif-name{font-size:13px;font-weight:600;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
        '.notif-detail{font-size:11px;color:#64748b;}',
        '.notif-actions{display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;}',
        '.notif-goto{font-size:14px;color:#0b5d73;text-decoration:none;padding:2px 5px;border-radius:5px;transition:background .12s;font-weight:700;}',
        '.notif-goto:hover{background:#e6f3f7;}',
        '.notif-dismiss-btn{background:none;border:none;cursor:pointer;font-size:11px;color:#cbd5e1;padding:2px 5px;border-radius:5px;transition:background .12s,color .12s;line-height:1;}',
        '.notif-dismiss-btn:hover{background:#fee2e2;color:#dc2626;}',
        '.notif-empty{padding:32px 16px;text-align:center;color:#94a3b8;display:flex;flex-direction:column;align-items:center;gap:10px;}',
        '.notif-empty p{font-size:13px;font-weight:500;}'
    ].join('');
    document.head.appendChild(style);

    // ── Init ──────────────────────────────────────────────────────────
    function init() {
        buildNotifications();
        setInterval(buildNotifications, 60000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
