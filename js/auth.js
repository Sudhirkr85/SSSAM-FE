// LOGIN
const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();


        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const res = await apiPost(API_ENDPOINTS.AUTH.LOGIN, { email, password });

            localStorage.setItem('token', res.token);
            localStorage.setItem('user', JSON.stringify(res.user));

            window.location.href = 'dashboard.html';

        } catch (err) {
            showToast('error', 'Login failed');
        }


    });
}

/* ======================
PROTECT ROUTES
====================== */
function checkAuth() {
    const token = localStorage.getItem('token');

    if (!token && !window.location.pathname.includes('index.html')) {
        window.location.href = 'index.html';
    }
}

/* ======================
SET USER INFO & ROLE-BASED UI
====================== */
function setUser() {
    const user = getCurrentUser();

    if (document.getElementById('userName')) {
        document.getElementById('userName').textContent = user.name || '';
    }

    if (document.getElementById('userRole')) {
        document.getElementById('userRole').textContent = user.role || '';
    }

    // Apply role-based UI controls
    applyRoleBasedUI();
}

/* ======================
ROLE-BASED UI CONTROLS
====================== */
function applyRoleBasedUI() {
    const role = getUserRole();
    const isAdminUser = isAdmin();

    // Show/hide Reports menu (Admin only)
    const reportsMenu = document.getElementById('reportsMenu');
    if (reportsMenu) {
        if (isAdminUser) {
            reportsMenu.classList.remove('hidden');
        } else {
            reportsMenu.classList.add('hidden');
        }
    }

    // Show/hide Bulk Upload button (Admin only)
    const bulkUploadBtn = document.getElementById('bulkUploadBtn');
    if (bulkUploadBtn) {
        if (isAdminUser) {
            bulkUploadBtn.classList.remove('hidden');
        } else {
            bulkUploadBtn.classList.add('hidden');
        }
    }

    // Show/hide admin-only action buttons
    document.querySelectorAll('[data-admin-only]').forEach(el => {
        if (isAdminUser) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });

    // Show/hide counselor-only elements
    document.querySelectorAll('[data-counselor-only]').forEach(el => {
        if (role === 'counselor') {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });

    // Disable/enable enquiry source edit (typically admin only)
    document.querySelectorAll('[data-admin-field]').forEach(el => {
        if (!isAdminUser) {
            el.disabled = true;
            el.classList.add('bg-gray-100', 'cursor-not-allowed');
        }
    });
}

/* ======================
LOGOUT
====================== */
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.clear();
    window.location.href = 'index.html';
});

/* ======================
INIT
====================== */
checkAuth();
setUser();
