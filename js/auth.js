/**
 * Authentication Module
 * Institute Enquiry Management System
 */

// Check if user is authenticated
function isAuthenticated() {
    const token = localStorage.getItem('token');
    return !!token;
}

// Get current user data
function getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// Check if user is admin
function isAdmin() {
    const user = getCurrentUser();
    return user && (user.role === 'admin' || user.role === 'ADMIN');
}

// Check if user is counselor
function isCounselor() {
    const user = getCurrentUser();
    return user && (user.role === 'counselor' || user.role === 'COUNSELOR');
}

// Get current user ID
function getCurrentUserId() {
    const user = getCurrentUser();
    return user ? (user._id || user.id) : null;
}

// Check if user can edit an enquiry (admin or assigned counselor)
function canEdit(enquiry) {
    if (isAdmin()) return true;
    const userId = getCurrentUserId();
    if (!userId || !enquiry) return false;

    const assignedId = enquiry.assignedTo?._id || enquiry.assignedTo?.id || enquiry.assignedTo;
    return assignedId === userId;
}

// Check if user can delete an enquiry (admin only)
function canDelete() {
    return isAdmin();
}

// Check if user can view an enquiry (admin sees all, counselor sees assigned + unassigned)
function canView(enquiry) {
    if (isAdmin()) return true;
    if (!enquiry) return false;

    // Counselor can see unassigned or their assigned enquiries
    const assignedId = enquiry.assignedTo?._id || enquiry.assignedTo?.id || enquiry.assignedTo;
    const userId = getCurrentUserId();

    return !assignedId || assignedId === userId;
}

// Redirect to login if not authenticated
function requireAuth() {
    if (!isAuthenticated()) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// Redirect to dashboard if already authenticated
function redirectIfAuthenticated() {
    if (isAuthenticated()) {
        window.location.href = 'dashboard.html';
        return true;
    }
    return false;
}

// Login function
async function login(email, password) {
    try {
        const response = await apiPost(API_ENDPOINTS.AUTH.LOGIN, { email, password });
        console.log('Login response:', response);

        // Extract token and user from nested data structure
        // Response format: { success: true, message: "...", data: { user: {...}, token: "..." } }
        let token = null;
        let user = null;

        if (response.data && response.data.token) {
            token = response.data.token;
            user = response.data.user;
        } else if (response.token) {
            token = response.token;
            user = response.user;
        }

        console.log('Extracted token:', token ? 'Found' : 'Not found');
        console.log('Extracted user:', user);

        if (token) {
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user || {}));
            console.log('Token saved to localStorage');
            return { success: true, user: user };
        }

        return { success: false, error: 'Invalid response from server. Token not found.' };
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed. Please try again.';

        if (error.response) {
            if (error.response.status === 401) {
                errorMessage = 'Invalid email or password.';
            } else if (error.response.data && error.response.data.message) {
                errorMessage = error.response.data.message;
            }
        }

        return { success: false, error: errorMessage };
    }
}

// Logout function
async function logout() {
    try {
        await apiPost(API_ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
        // Silent fail - clear local storage anyway
    } finally {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }
}

// Update user info in sidebar
function updateUserInfo() {
    const user = getCurrentUser();
    if (user) {
        const nameElement = document.getElementById('userName');
        const roleElement = document.getElementById('userRole');
        
        if (nameElement) nameElement.textContent = user.name || user.email;
        if (roleElement) roleElement.textContent = user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User';
        
        // Show/hide admin-only menu items
        const reportsMenu = document.getElementById('reportsMenu');
        const bulkUploadBtn = document.getElementById('bulkUploadBtn');
        
        if (reportsMenu) {
            reportsMenu.classList.toggle('hidden', !isAdmin());
        }
        
        if (bulkUploadBtn) {
            bulkUploadBtn.classList.toggle('hidden', !isAdmin());
        }
    }
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on login page
    const isLoginPage = window.location.pathname.includes('index.html') || 
                       window.location.pathname.endsWith('/');
    
    if (isLoginPage) {
        // If already logged in, redirect to dashboard
        redirectIfAuthenticated();
        
        // Setup login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const loginBtn = document.getElementById('loginBtn');
                const btnText = document.getElementById('btnText');
                const btnSpinner = document.getElementById('btnSpinner');

                // Show loading state
                loginBtn.disabled = true;
                btnText.textContent = 'Signing in...';
                btnSpinner.classList.remove('hidden');

                try {
                    const result = await login(email, password);

                    if (result.success) {
                        showToast('success', 'Welcome!', 'Login successful. Redirecting...');
                        setTimeout(() => {
                            window.location.href = 'dashboard.html';
                        }, 500);
                    } else {
                        showToast('error', 'Login Failed', result.error);
                        loginBtn.disabled = false;
                        btnText.textContent = 'Sign In';
                        btnSpinner.classList.add('hidden');
                    }
                } catch (error) {
                    console.error('Login error:', error);
                    showToast('error', 'Login Failed', 'An unexpected error occurred. Please try again.');
                    loginBtn.disabled = false;
                    btnText.textContent = 'Sign In';
                    btnSpinner.classList.add('hidden');
                }
            });
        }
    } else {
        // For all other pages, require authentication
        if (requireAuth()) {
            updateUserInfo();
            
            // Setup logout button
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', logout);
            }
            
            // Setup sidebar toggle for mobile
            const sidebarToggle = document.getElementById('sidebarToggle');
            const sidebar = document.getElementById('sidebar');
            
            if (sidebarToggle && sidebar) {
                sidebarToggle.addEventListener('click', () => {
                    sidebar.classList.toggle('open');
                    
                    // Create/remove overlay
                    let overlay = document.querySelector('.sidebar-overlay');
                    if (sidebar.classList.contains('open')) {
                        if (!overlay) {
                            overlay = document.createElement('div');
                            overlay.className = 'sidebar-overlay';
                            overlay.addEventListener('click', () => {
                                sidebar.classList.remove('open');
                                overlay.remove();
                            });
                            document.body.appendChild(overlay);
                        }
                    } else if (overlay) {
                        overlay.remove();
                    }
                });
            }
        }
    }
});

// Export auth functions
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
