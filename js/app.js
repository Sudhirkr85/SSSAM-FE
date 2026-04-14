/**
 * Main Application Module
 * Institute Enquiry Management System
 * 
 * Role-based initialization as per specification:
 * if (user.role === 'ADMIN') { loadAdminUI(); } else { loadCounselorUI(); }
 */

// Global State
const AppState = {
    user: null,
    isInitialized: false,
    currentPage: ''
};

/**
 * Initialize Application
 * Called on every page load after auth check
 */
function initializeApp() {
    // Get current user
    AppState.user = getCurrentUser();
    
    if (!AppState.user) {
        console.warn('No user found, redirecting to login');
        window.location.href = 'index.html';
        return;
    }

    // Set current page
    AppState.currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // Role-based UI initialization
    if (isAdmin()) {
        loadAdminUI();
    } else {
        loadCounselorUI();
    }

    AppState.isInitialized = true;
    console.log(`App initialized for ${AppState.user.role}:`, AppState.user.name);
}

/**
 * Load Admin UI - Show all features
 */
function loadAdminUI() {
    // Show admin-only menu items
    const adminMenus = document.querySelectorAll('.admin-only');
    adminMenus.forEach(menu => menu.classList.remove('hidden'));

    // Show reports menu
    const reportsMenu = document.getElementById('reportsMenu');
    if (reportsMenu) {
        reportsMenu.classList.remove('hidden');
    }

    // Show bulk upload button
    const bulkUploadBtn = document.getElementById('bulkUploadBtn');
    if (bulkUploadBtn) {
        bulkUploadBtn.classList.remove('hidden');
    }

    // Show all action buttons that might be hidden
    document.querySelectorAll('[data-requires-admin]').forEach(el => {
        el.classList.remove('hidden');
    });

    console.log('Admin UI loaded');
}

/**
 * Load Counselor UI - Restricted features
 */
function loadCounselorUI() {
    // Hide admin-only menu items
    const adminMenus = document.querySelectorAll('.admin-only');
    adminMenus.forEach(menu => menu.classList.add('hidden'));

    // Hide reports menu
    const reportsMenu = document.getElementById('reportsMenu');
    if (reportsMenu) {
        reportsMenu.classList.add('hidden');
    }

    // Hide bulk upload button
    const bulkUploadBtn = document.getElementById('bulkUploadBtn');
    if (bulkUploadBtn) {
        bulkUploadBtn.classList.add('hidden');
    }

    // Hide admin-only action buttons
    document.querySelectorAll('[data-requires-admin]').forEach(el => {
        el.classList.add('hidden');
    });

    console.log('Counselor UI loaded');
}

/**
 * Check if current user can perform action on enquiry
 * Per spec: function canEdit(enquiry, user) {
 *   return user.role === 'ADMIN' || enquiry.assignedTo === user.id;
 * }
 */
function checkEnquiryPermission(enquiry, action = 'view') {
    const user = AppState.user || getCurrentUser();
    
    if (!user || !enquiry) return false;

    // Admin can do everything
    if (user.role === 'ADMIN' || user.role === 'admin') {
        return true;
    }

    // For viewing: counselor can see unassigned or their assigned
    if (action === 'view') {
        const assignedId = enquiry.assignedTo?._id || enquiry.assignedTo?.id || enquiry.assignedTo;
        return !assignedId || assignedId === (user._id || user.id);
    }

    // For editing: must be assigned to user
    if (action === 'edit' || action === 'update' || action === 'delete') {
        return canEdit(enquiry);
    }

    return false;
}

/**
 * API Call Optimization
 * Per spec: Only call APIs needed for role
 */
function getOptimizedApiParams(baseParams = {}) {
    const params = { ...baseParams };

    if (isCounselor() && !isAdmin()) {
        // Counselor: avoid calling /all, use assigned filters
        params.assigned = 'me,unassigned';
        // Don't request data we can't access
        params.includeRestricted = false;
    } else if (isAdmin()) {
        // Admin: can request all data
        params.assigned = 'all';
        params.includeRestricted = true;
    }

    return params;
}

/**
 * Show/Hide UI elements based on role
 */
function applyRoleBasedVisibility() {
    const isUserAdmin = isAdmin();

    // Elements visible only to admin
    document.querySelectorAll('[data-admin-only]').forEach(el => {
        if (isUserAdmin) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });

    // Elements visible only to counselor
    document.querySelectorAll('[data-counselor-only]').forEach(el => {
        if (!isUserAdmin) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}

/**
 * Debounce function for search inputs
 * Per spec: debounce(() => { loadEnquiries({ search: value }); }, 300);
 */
function createDebouncedSearch(callback, wait = 300) {
    return debounce(callback, wait);
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    // Don't initialize on login page
    const isLoginPage = window.location.pathname.includes('index.html') || 
                       window.location.pathname === '/' ||
                       window.location.pathname.endsWith('/');
    
    if (!isLoginPage) {
        // Check auth first (from auth.js)
        if (typeof requireAuth === 'function' && requireAuth()) {
            initializeApp();
            applyRoleBasedVisibility();
        }
    }
});

// Export for global access
window.AppState = AppState;
window.initializeApp = initializeApp;
window.loadAdminUI = loadAdminUI;
window.loadCounselorUI = loadCounselorUI;
window.checkEnquiryPermission = checkEnquiryPermission;
window.getOptimizedApiParams = getOptimizedApiParams;
window.applyRoleBasedVisibility = applyRoleBasedVisibility;
window.createDebouncedSearch = createDebouncedSearch;
