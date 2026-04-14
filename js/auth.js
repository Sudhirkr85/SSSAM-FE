function isAuthenticated() {
    return !!localStorage.getItem('token');
}

function getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
}

function getCurrentUserId() {
    const user = getCurrentUser();
    return user?._id || user?.id || null;
}

/* ======================
ROLE
====================== */

function getRole() {
    const user = getCurrentUser();
    return user?.role?.toLowerCase() || '';
}

function isAdmin() {
    return getRole() === 'admin';
}

function isCounselor() {
    return getRole() === 'counselor';
}

/* ======================
PERMISSIONS
====================== */

function canEdit(enquiry) {
    if (isAdmin()) return true;
    const id = getCurrentUserId();
    const assigned = enquiry?.assignedTo?._id || enquiry?.assignedTo;
    return assigned === id;
}

function canDelete() {
    return isAdmin();
}

function canView(enquiry) {
    if (isAdmin()) return true;

    const id = getCurrentUserId();
    const assigned = enquiry?.assignedTo?._id || enquiry?.assignedTo;

    return !assigned || assigned === id;
}

/* ======================
AUTH FLOW
====================== */

function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

function redirectIfAuthenticated() {
    if (isAuthenticated()) {
        window.location.href = 'dashboard.html';
    }
}

/* ======================
LOGIN
====================== */

async function login(email, password) {
    try {
        const res = await apiPost(API_ENDPOINTS.AUTH.LOGIN, { email, password });

        ```
const data = res.data || {};
const token = data.token;
const user = data.user;

if (!token) {
  return { success: false, error: 'Invalid response from server' };
}

localStorage.setItem('token', token);
localStorage.setItem('user', JSON.stringify(user || {}));

return { success: true };
```

    } catch (err) {
        return {
            success: false,
            error: err.response?.data?.message || 'Login failed'
        };
    }
}

/* ======================
LOGOUT
====================== */

async function logout() {
    try {
        await apiPost(API_ENDPOINTS.AUTH.LOGOUT);
    } catch { }

    localStorage.removeItem('token');
    localStorage.removeItem('user');

    window.location.href = 'index.html';
}

/* ======================
USER UI
====================== */

function updateUserInfo() {
    const user = getCurrentUser();
    if (!user) return;

    const name = document.getElementById('userName');
    const role = document.getElementById('userRole');

    if (name) name.textContent = user.name || user.email;
    if (role) role.textContent = getRole();

    const reports = document.getElementById('reportsMenu');
    if (reports) reports.classList.toggle('hidden', !isAdmin());
}

/* ======================
INIT
====================== */

document.addEventListener('DOMContentLoaded', () => {
    const isLoginPage = document.getElementById('loginForm');

    if (isLoginPage) {
        redirectIfAuthenticated();

        ```
isLoginPage.addEventListener('submit', async (e) => {
  e.preventDefault();

  const btn = document.getElementById('loginBtn');
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  setLoading(btn, true);

  const res = await login(email, password);

  if (res.success) {
    showToast('success', 'Success', 'Login successful');
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 500);
  } else {
    showToast('error', 'Error', res.error);
    setLoading(btn, false);
  }
});
```

    } else {
        if (!requireAuth()) return;

        ```
updateUserInfo();

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.addEventListener('click', logout);
```

    }
});

/* ======================
EXPORT
====================== */

window.isAuthenticated = isAuthenticated;
window.getCurrentUser = getCurrentUser;
window.getCurrentUserId = getCurrentUserId;
window.isAdmin = isAdmin;
window.isCounselor = isCounselor;
window.canEdit = canEdit;
window.canDelete = canDelete;
window.canView = canView;
window.requireAuth = requireAuth;
window.login = login;
window.logout = logout;
window.updateUserInfo = updateUserInfo;
