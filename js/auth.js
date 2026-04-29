// LOGIN
const loginForm = document.getElementById('loginForm');

// Show login field errors (red border on both, one message)
function showLoginError() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const emailError = document.getElementById('emailError');

    // Add red border to BOTH inputs
    emailInput.classList.remove('border-white/20', 'focus:ring-blue-500');
    emailInput.classList.add('border-red-500', 'focus:ring-red-500');

    passwordInput.classList.remove('border-white/20', 'focus:ring-blue-500');
    passwordInput.classList.add('border-red-500', 'focus:ring-red-500');

    // Show ONE error message (under email only)
    emailError.classList.remove('hidden');

    // Refresh icons
    lucide.createIcons();
}

// Clear login field errors
function clearLoginError() {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const emailError = document.getElementById('emailError');

    // Remove red border from BOTH inputs, restore original styling
    emailInput.classList.remove('border-red-500', 'focus:ring-red-500');
    emailInput.classList.add('border-white/20', 'focus:ring-blue-500');

    passwordInput.classList.remove('border-red-500', 'focus:ring-red-500');
    passwordInput.classList.add('border-white/20', 'focus:ring-blue-500');

    // Hide ONE error message
    emailError.classList.add('hidden');
}

// Login handler function
async function handleLogin() {
    // Clear previous errors
    clearLoginError();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const fcmToken = localStorage.getItem('fcmToken');

    // Basic validation
    if (!email || !password) {
        showLoginError();
        showToast('error', 'Please enter email and password');
        return;
    }

    const loginData = {
        email,
        password
    };

    // Only send fcmToken if it exists
    if (fcmToken) {
        loginData.fcmToken = fcmToken;
        loginData.deviceInfo = 'web';
    }

    // Show loading state
    const loginBtn = document.getElementById('loginBtn');
    const originalBtnText = loginBtn.innerHTML;
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Signing in...';
    lucide.createIcons();

    try {
        const res = await apiPost(API_ENDPOINTS.AUTH.LOGIN, loginData);

        // Handle different response structures
        const token = res.token || res.data?.token || res.accessToken;
        const user = res.user || res.data?.user || res.data;

        if (!token) {
            showToast('error', 'Login failed: No token received');
            return;
        }

        if (!user) {
            showToast('error', 'Login failed: No user data received');
            return;
        }

        // Use safe storage utility
        localStorage.setItem('token', token);
        safeSetLocalStorage('user', user);

        window.location.href = 'dashboard.html';

    } catch (err) {
        // Show field-level error (red border + message)
        showLoginError();

        // Also show toast for additional feedback
        const message = err.response?.data?.message || 'Invalid email or password';
        showToast('error', message);

        // Reset button
        loginBtn.disabled = false;
        loginBtn.innerHTML = originalBtnText;
        lucide.createIcons();
    }
}

if (loginForm) {
    // Clear errors on input
    document.getElementById('email')?.addEventListener('input', clearLoginError);
    document.getElementById('password')?.addEventListener('input', clearLoginError);

    // Handle form submit (covers button click + Enter key)
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault(); // 🔥 Stop page refresh
        handleLogin();
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
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    const fcmToken = localStorage.getItem('fcmToken');

    const logoutData = {};

    // Only send fcmToken if it exists
    if (fcmToken) {
        logoutData.fcmToken = fcmToken;
        logoutData.deviceInfo = 'web';
    }

    try {
        // Call logout API with FCM token if available
        if (fcmToken) {
            await apiPost(API_ENDPOINTS.AUTH.LOGOUT, logoutData);
        }
    } catch (err) {
        console.log('Logout API error:', err);
    }

    localStorage.clear();
    window.location.href = 'index.html';
});

/* ======================
INIT
====================== */
checkAuth();
setUser();
