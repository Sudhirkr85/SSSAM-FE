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
    return user && user.role === 'admin';
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
        
        if (response.token) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            return { success: true, user: response.user };
        }
        
        return { success: false, error: 'Invalid response from server' };
    } catch (error) {
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
window.isAdmin = isAdmin;
window.requireAuth = requireAuth;
window.login = login;
window.logout = logout;
window.updateUserInfo = updateUserInfo;
