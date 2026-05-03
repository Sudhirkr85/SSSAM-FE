/* ======================
GLOBAL APP INIT
====================== */

document.addEventListener('DOMContentLoaded', () => {
    highlightActiveMenu();
});

/* ======================
ACTIVE MENU
====================== */
function highlightActiveMenu() {
    const path = window.location.pathname.split('/').pop();

    document.querySelectorAll('.nav-item').forEach(link => {
        const href = link.getAttribute('href');

        
if (href === path) {
  link.classList.add('bg-blue-600', 'text-white');
} else {
  link.classList.remove('bg-blue-600', 'text-white');
}


    });
}

/* ======================
CLICK ROW NAVIGATION (OPTIONAL)
====================== */
function goToEnquiry(id) {
    window.location.href = `enquiry-detail.html?id=${id}`;
}

/* ======================
SAFE PARSE JSON
====================== */
function safeJSONParse(data) {
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

/* ======================
SAFE PARSE LOCAL STORAGE
====================== */
function safeParseLocalStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch {
        return defaultValue;
    }
}

window.goToEnquiry = goToEnquiry;
window.safeParseLocalStorage = safeParseLocalStorage;

/* ======================
STORAGE UTILITIES
====================== */
function safeSetLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error('Failed to save to localStorage:', error);
    }
}

function getCurrentUser() {
    return safeParseLocalStorage('user', {});
}

function getUserRole() {
    const user = getCurrentUser();
    return user.role || 'counselor';
}

function isAdmin() {
    return getUserRole() === 'admin';
}

window.safeSetLocalStorage = safeSetLocalStorage;
window.getCurrentUser = getCurrentUser;
window.getUserRole = getUserRole;
window.isAdmin = isAdmin;

/* ======================
DASHBOARD UTILITIES
====================== */
function getDashboardEndpoint() {
    const user = getCurrentUser();
    const role = user.role || 'counselor';
    
    // Return different endpoints based on user role
    switch(role) {
        case 'admin':
            return '/dashboard/admin';
        case 'counselor':
            return '/dashboard/counselor';
        default:
            return '/dashboard';
    }
}

window.getDashboardEndpoint = getDashboardEndpoint;
