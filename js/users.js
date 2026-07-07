/**
 * User Management Page JS script
 * Handles fetching, listing, filtering, and registering new users.
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
    const addUserBtn = document.getElementById('addUserBtn');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const addUserModal = document.getElementById('addUserModal');
    const modalContent = document.getElementById('modalContent');

    // Open Modal
    addUserBtn?.addEventListener('click', () => {
        // Reset form
        document.getElementById('addUserForm').reset();
        
        addUserModal.classList.remove('hidden');
        addUserModal.classList.add('flex');
        
        // Trigger transitions
        setTimeout(() => {
            addUserModal.classList.remove('opacity-0');
            addUserModal.classList.add('opacity-100');
            modalContent.classList.remove('scale-95');
            modalContent.classList.add('scale-100');
        }, 10);
    });

    // Close Modal helper
    const closeModal = () => {
        addUserModal.classList.remove('opacity-100');
        addUserModal.classList.add('opacity-0');
        modalContent.classList.remove('scale-100');
        modalContent.classList.add('scale-95');
        
        setTimeout(() => {
            addUserModal.classList.remove('flex');
            addUserModal.classList.add('hidden');
        }, 200);
    };

    closeModalBtn?.addEventListener('click', closeModal);
    cancelModalBtn?.addEventListener('click', closeModal);
    
    // Close on overlay click
    addUserModal?.addEventListener('click', (e) => {
        if (e.target === addUserModal) {
            closeModal();
        }
    });

    // Save callback to window for form submit handler to close it
    window.closeAddUserModal = closeModal;
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
                    <td colspan="5" class="px-6 py-12 text-center text-red-500 font-medium">
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
                <td colspan="5" class="px-6 py-12 text-center text-red-500 font-medium">
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

    // Filter list
    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name?.toLowerCase().includes(searchVal) || 
                              user.email?.toLowerCase().includes(searchVal);
        const matchesRole = !roleVal || user.role === roleVal;
        return matchesSearch && matchesRole;
    });

    if (filteredUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-8 text-center text-gray-400">
                    No users found matching your search.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredUsers.map(user => {
        // Initials avatar
        const initials = user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U';
        
        // Role Styling
        let roleBadge = '';
        if (user.role === 'admin') {
            roleBadge = `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center gap-1 w-fit"><i data-lucide="shield-check" class="w-3 h-3"></i> Admin</span>`;
        } else if (user.role === 'counselor') {
            roleBadge = `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-50 text-purple-600 border border-purple-100 flex items-center gap-1 w-fit"><i data-lucide="user-check" class="w-3 h-3"></i> Counselor</span>`;
        } else {
            roleBadge = `<span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center gap-1 w-fit"><i data-lucide="briefcase" class="w-3 h-3"></i> Employee</span>`;
        }

        // Just fake joined date based on ID timestamp (since created date is not explicitly fetched/stored)
        // Or default if not parseable
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
            </tr>
        `;
    }).join('');

    // Reinitialize Lucide Icons for dynamic role icon rendering
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

    // Client-side validations
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

    // Loading State
    saveUserBtn.disabled = true;
    saveUserBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...`;
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    try {
        const registerData = { name, email, password, role };
        const response = await registerUser(registerData);

        if (response && response.success) {
            showToast('success', 'User registered successfully!');
            
            // Close modal & reload users
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
        // Reset loading state
        saveUserBtn.disabled = false;
        saveUserBtn.innerHTML = originalText;
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }
}
