/**
 * User Management Page JS script
 * Handles fetching, listing, filtering, registering, role updating, and resetting passwords for users.
 */

let usersList = [];

document.addEventListener('DOMContentLoaded', () => {
    initModalEvents();
    initFilterEvents();
    fetchUsersList();
});

/* ======================
MODAL TOGGLE FUNCTIONALITY
====================== */
function initModalEvents() {
    // Add User Modal
    const addUserBtn = document.getElementById('addUserBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const addUserModal = document.getElementById('addUserModal');
    const modalContent = document.getElementById('modalContent');

    addUserBtn?.addEventListener('click', () => {
        document.getElementById('addUserForm').reset();
        showModal(addUserModal, modalContent);
    });

    const closeAddModal = () => hideModal(addUserModal, modalContent);
    closeModalBtn?.addEventListener('click', closeAddModal);
    cancelModalBtn?.addEventListener('click', closeAddModal);
    addUserModal?.addEventListener('click', (e) => { if (e.target === addUserModal) closeAddModal(); });
    window.closeAddUserModal = closeAddModal;

    // Edit Role Modal
    const editRoleModal = document.getElementById('editRoleModal');
    const editRoleModalContent = document.getElementById('editRoleModalContent');
    const closeEditRoleBtn = document.getElementById('closeEditRoleBtn');
    const cancelEditRoleBtn = document.getElementById('cancelEditRoleBtn');

    const closeEditRole = () => hideModal(editRoleModal, editRoleModalContent);
    closeEditRoleBtn?.addEventListener('click', closeEditRole);
    cancelEditRoleBtn?.addEventListener('click', closeEditRole);
    editRoleModal?.addEventListener('click', (e) => { if (e.target === editRoleModal) closeEditRole(); });
    window.closeEditRoleModal = closeEditRole;

    // Reset Password Modal
    const resetPasswordModal = document.getElementById('resetPasswordModal');
    const resetPassModalContent = document.getElementById('resetPassModalContent');
    const closeResetPassBtn = document.getElementById('closeResetPassBtn');
    const cancelResetPassBtn = document.getElementById('cancelResetPassBtn');

    const closeResetPass = () => hideModal(resetPasswordModal, resetPassModalContent);
    closeResetPassBtn?.addEventListener('click', closeResetPass);
    cancelResetPassBtn?.addEventListener('click', closeResetPass);
    resetPasswordModal?.addEventListener('click', (e) => { if (e.target === resetPasswordModal) closeResetPass(); });
    window.closeResetPassModal = closeResetPass;
}

function showModal(modal, content) {
    if (!modal || !content) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.classList.add('opacity-100');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }, 10);
}

function hideModal(modal, content) {
    if (!modal || !content) return;
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }, 200);
}

/* ======================
SEARCH & FILTER FUNCTIONALITY
====================== */
function initFilterEvents() {
    const searchInput = document.getElementById('searchInput');
    const roleFilter = document.getElementById('roleFilter');

    searchInput?.addEventListener('input', () => {
        renderUsers(usersList);
    });

    roleFilter?.addEventListener('change', () => {
        renderUsers(usersList);
    });
}

/* ======================
FETCH SYSTEM USERS
====================== */
async function fetchUsersList() {
    const tbody = document.getElementById('userTableBody');
    try {
        const response = await listAllUsers();
        
        if (response && response.success) {
            usersList = response.data?.users || [];
            updateStats(usersList);
            renderUsers(usersList);
        } else {
            const errorMsg = response?.error?.message || 'Failed to fetch users list';
            showToast('error', errorMsg);
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-12 text-center text-red-500 font-medium">
                        ${errorMsg}
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        console.error('Error fetching users:', err);
        showToast('error', 'Network error while loading users');
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-12 text-center text-red-500 font-medium">
                    Could not load users. Please check backend connection.
                </td>
            </tr>
        `;
    }
}

/* ======================
RENDER TABLE ROWS
====================== */
function renderUsers(users) {
    const tbody = document.getElementById('userTableBody');
    const searchVal = document.getElementById('searchInput').value.toLowerCase().trim();
    const roleVal = document.getElementById('roleFilter').value;

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name?.toLowerCase().includes(searchVal) || 
                              user.email?.toLowerCase().includes(searchVal);
        const matchesRole = !roleVal || user.role === roleVal;
        return matchesSearch && matchesRole;
    });

    if (filteredUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-8 text-center text-gray-400">
                    No users found matching your search.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredUsers.map(user => {
        const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
        
        let roleBadge = '';
        if (user.role === 'admin') {
            roleBadge = `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center gap-1 w-fit"><i data-lucide="shield-check" class="w-3 h-3"></i> Admin</span>`;
        } else if (user.role === 'counselor') {
            roleBadge = `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-50 text-purple-600 border border-purple-100 flex items-center gap-1 w-fit"><i data-lucide="user-check" class="w-3 h-3"></i> Counselor</span>`;
        } else {
            roleBadge = `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1 w-fit"><i data-lucide="briefcase" class="w-3 h-3"></i> Employee</span>`;
        }

        let joinedDate = 'N/A';
        if (user._id) {
            const timestamp = parseInt(user._id.substring(0, 8), 16) * 1000;
            if (!isNaN(timestamp)) {
                joinedDate = new Date(timestamp).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                });
            }
        }

        const safeName = (user.name || '').replace(/'/g, "\\'");

        return `
            <tr class="hover:bg-slate-50/50 transition-colors">
                <td class="px-6 py-4 flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm">
                        ${initials}
                    </div>
                    <div>
                        <span class="font-semibold text-gray-800">${user.name || 'No Name'}</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-gray-600 font-mono text-xs">
                    ${user.email || 'N/A'}
                </td>
                <td class="px-6 py-4">
                    ${roleBadge}
                </td>
                <td class="px-6 py-4 text-gray-500">
                    ${joinedDate}
                </td>
                <td class="px-6 py-4">
                    <span class="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-md">Active</span>
                </td>
                <td class="px-6 py-4 text-right">
                    ${user.role === 'admin' ? `
                        <span class="text-xs text-slate-400 font-medium inline-flex items-center gap-1">
                            <i data-lucide="lock" class="w-3 h-3"></i> Protected
                        </span>
                    ` : `
                        <div class="flex items-center justify-end gap-2">
                            <button onclick="openEditRoleModal('${user._id}', '${safeName}', '${user.role}')" class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Change Role">
                                <i data-lucide="shield" class="w-4 h-4"></i>
                            </button>
                            <button onclick="openResetPasswordModal('${user._id}', '${safeName}')" class="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Reset Password">
                                <i data-lucide="key-round" class="w-4 h-4"></i>
                            </button>
                        </div>
                    `}
                </td>
            </tr>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/* ======================
UPDATE STATS SUMMARY
====================== */
function updateStats(users) {
    const totalUsers = users.length;
    const counselors = users.filter(u => u.role === 'counselor').length;
    const employees = users.filter(u => u.role === 'employee').length;

    document.getElementById('totalUsersCount').textContent = totalUsers;
    document.getElementById('counselorsCount').textContent = counselors;
    document.getElementById('employeesCount').textContent = employees;
}

/* ======================
SUBMIT REGISTER NEW USER
====================== */
async function submitNewUser(event) {
    event.preventDefault();

    const name = document.getElementById('nameInput').value.trim();
    const email = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const role = document.getElementById('roleInput').value;

    if (!name || !email || !password || !role) {
        showToast('error', 'All fields are required');
        return;
    }

    if (password.length < 6) {
        showToast('error', 'Password must be at least 6 characters');
        return;
    }

    const saveUserBtn = document.getElementById('saveUserBtn');
    const originalText = saveUserBtn.innerHTML;

    saveUserBtn.disabled = true;
    saveUserBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const registerData = { name, email, password, role };
        const response = await registerUser(registerData);

        if (response && response.success) {
            showToast('success', 'User registered successfully!');
            window.closeAddUserModal();
            fetchUsersList();
        } else {
            const errorMsg = response?.error?.message || response?.message || 'Failed to register user';
            showToast('error', errorMsg);
        }
    } catch (err) {
        console.error('Error saving user:', err);
        const errMsg = err.response?.data?.message || err.message || 'Error occurred';
        showToast('error', errMsg);
    } finally {
        saveUserBtn.disabled = false;
        saveUserBtn.innerHTML = originalText;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

/* ======================
EDIT ROLE MODAL & ACTION
====================== */
function openEditRoleModal(userId, name, currentRole) {
    document.getElementById('editRoleIdInput').value = userId;
    document.getElementById('editRoleNameDisplay').value = name;
    document.getElementById('editRoleSelect').value = currentRole || 'counselor';
    
    const modal = document.getElementById('editRoleModal');
    const content = document.getElementById('editRoleModalContent');
    showModal(modal, content);
}

async function submitRoleChange(event) {
    event.preventDefault();

    const userId = document.getElementById('editRoleIdInput').value;
    const role = document.getElementById('editRoleSelect').value;

    if (!userId || !role) {
        showToast('error', 'Role selection is required');
        return;
    }

    const saveRoleBtn = document.getElementById('saveRoleBtn');
    const originalText = saveRoleBtn.innerHTML;

    saveRoleBtn.disabled = true;
    saveRoleBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Updating...`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const response = await updateUserRole(userId, role);

        if (response && response.success) {
            showToast('success', 'User role updated successfully!');
            window.closeEditRoleModal();
            fetchUsersList();
        } else {
            const errorMsg = response?.message || response?.error?.message || 'Failed to update role';
            showToast('error', errorMsg);
        }
    } catch (err) {
        console.error('Error updating role:', err);
        const errMsg = err.response?.data?.message || err.message || 'Error occurred';
        showToast('error', errMsg);
    } finally {
        saveRoleBtn.disabled = false;
        saveRoleBtn.innerHTML = originalText;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

/* ======================
RESET PASSWORD MODAL & ACTION
====================== */
function openResetPasswordModal(userId, name) {
    document.getElementById('resetPassIdInput').value = userId;
    document.getElementById('resetPassNameDisplay').value = name;
    document.getElementById('newPasswordInput').value = '';

    const modal = document.getElementById('resetPasswordModal');
    const content = document.getElementById('resetPassModalContent');
    showModal(modal, content);
}

async function submitResetPassword(event) {
    event.preventDefault();

    const userId = document.getElementById('resetPassIdInput').value;
    const newPassword = document.getElementById('newPasswordInput').value;

    if (!userId || !newPassword) {
        showToast('error', 'New password is required');
        return;
    }

    if (newPassword.length < 6) {
        showToast('error', 'Password must be at least 6 characters');
        return;
    }

    const saveResetPassBtn = document.getElementById('saveResetPassBtn');
    const originalText = saveResetPassBtn.innerHTML;

    saveResetPassBtn.disabled = true;
    saveResetPassBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Resetting...`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        const response = await resetUserPassword(userId, newPassword);

        if (response && response.success) {
            showToast('success', 'User password reset successfully!');
            window.closeResetPassModal();
        } else {
            const errorMsg = response?.message || response?.error?.message || 'Failed to reset password';
            showToast('error', errorMsg);
        }
    } catch (err) {
        console.error('Error resetting password:', err);
        const errMsg = err.response?.data?.message || err.message || 'Error occurred';
        showToast('error', errMsg);
    } finally {
        saveResetPassBtn.disabled = false;
        saveResetPassBtn.innerHTML = originalText;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}
