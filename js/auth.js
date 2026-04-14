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
SET USER INFO
====================== */
function setUser() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    if (document.getElementById('userName')) {
        document.getElementById('userName').textContent = user.name || '';
    }

    if (document.getElementById('userRole')) {
        document.getElementById('userRole').textContent = user.role || '';
    }

    if (user.role === 'admin') {
        document.getElementById('reportsMenu')?.classList.remove('hidden');
    }
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
