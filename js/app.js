document.addEventListener('DOMContentLoaded', () => {
    const isLoginPage = document.getElementById('loginForm');

    if (isLoginPage) return;

    if (!requireAuth()) return;

    initApp();
});

/* ======================
INIT
====================== */

function initApp() {
    applyRoleUI();
}

/* ======================
ROLE UI
====================== */

function applyRoleUI() {
    const role = getCurrentUser()?.role?.toLowerCase();

    // Admin only
    document.querySelectorAll('[data-admin]').forEach(el => {
        el.classList.toggle('hidden', role !== 'admin');
    });

    // Counselor only
    document.querySelectorAll('[data-counselor]').forEach(el => {
        el.classList.toggle('hidden', role !== 'counselor');
    });

    // Reports menu
    const reports = document.getElementById('reportsMenu');
    if (reports) {
        reports.classList.toggle('hidden', role !== 'admin');
    }
}

/* ======================
PERMISSION CHECK
====================== */

function canAccessEnquiry(enquiry) {
    if (isAdmin()) return true;

    const userId = getCurrentUserId();
    const assigned = enquiry?.assignedTo?._id || enquiry?.assignedTo;

    return !assigned || assigned === userId;
}

/* ======================
EXPORT
====================== */

window.initApp = initApp;
window.canAccessEnquiry = canAccessEnquiry;
