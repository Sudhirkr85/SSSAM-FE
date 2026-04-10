/**
 * Admission Module
 * Institute Enquiry Management System
 */

// State
let admissionsData = [];
let currentPage = 1;
let totalPages = 1;
let filters = {
    search: '',
    course: '',
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('admissionsTable')) return;
    
    initializeElements();
    setupEventListeners();
    loadCourses();
    loadAdmissions();
    loadStats();
});

function initializeElements() {
    // Filters
    document.getElementById('searchInput')?.addEventListener('input', debounce((e) => {
        filters.search = e.target.value;
        currentPage = 1;
        loadAdmissions();
    }, 300));
    
    document.getElementById('courseFilter')?.addEventListener('change', (e) => {
        filters.course = e.target.value;
        currentPage = 1;
        loadAdmissions();
    });
    
    document.getElementById('resetFilters')?.addEventListener('click', () => {
        filters = { search: '', course: '' };
        document.getElementById('searchInput').value = '';
        document.getElementById('courseFilter').value = '';
        currentPage = 1;
        loadAdmissions();
    });
    
    // Pagination
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadAdmissions();
        }
    });
    
    document.getElementById('nextPage')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadAdmissions();
        }
    });
    
    // Modal
    document.getElementById('closeAdmissionModal')?.addEventListener('click', () => {
        document.getElementById('admissionModal').classList.add('hidden');
    });
    
    document.getElementById('admissionModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            e.currentTarget.classList.add('hidden');
        }
    });
}

function setupEventListeners() {
    // Any additional event listeners
}

function loadCourses() {
    populateAdmissionCourseDropdown(STATIC_COURSES);
}

function populateAdmissionCourseDropdown(courses) {
    const courseFilter = document.getElementById('courseFilter');
    if (courseFilter) {
        courseFilter.innerHTML = '<option value="">All Courses</option>';
        courses.forEach(course => {
            courseFilter.innerHTML += `<option value="${course._id || course.id}">${course.name}</option>`;
        });
    }
}

async function loadStats() {
    try {
        // Use available endpoints instead of non-existent /reports/dashboard
        const admissionsResponse = await apiGet(API_ENDPOINTS.ADMISSIONS.LIST, { limit: 1 });
        const totalAdmissions = admissionsResponse.pagination?.totalCount || 0;

        const feesResponse = await apiGet(API_ENDPOINTS.REPORTS.FEES, { range: 'monthly' }).catch(() => ({ data: { summary: {} } }));
        const summary = feesResponse.data?.summary || {};
        const totalRevenue = summary.totalRevenueCollected || 0;
        const totalPending = summary.totalPending || 0;

        document.getElementById('totalAdmissions').textContent = totalAdmissions;
        document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
        document.getElementById('totalPending').textContent = formatCurrency(totalPending);
    } catch (error) {
        console.error('Failed to load stats:', error);
        document.getElementById('totalAdmissions').textContent = '0';
        document.getElementById('totalRevenue').textContent = formatCurrency(0);
        document.getElementById('totalPending').textContent = formatCurrency(0);
    }
}

async function loadAdmissions() {
    try {
        document.getElementById('admissionsTable').innerHTML = 
            '<tr><td colspan="8" class="px-6 py-8 text-center text-gray-500">Loading...</td></tr>';
        
        const params = {
            page: currentPage,
            limit: 10,
            ...filters,
        };
        
        const response = await apiGet(API_ENDPOINTS.ADMISSIONS.LIST, params);
        
        // API returns data as direct array, pagination at root level
        admissionsData = Array.isArray(response.data) ? response.data : (response.data?.admissions || []);
        const pagination = response.pagination || {};
        
        currentPage = pagination.page || 1;
        totalPages = pagination.totalPages || 1;
        
        renderAdmissions();
        updatePagination(pagination.totalCount || admissionsData.length);
    } catch (error) {
        console.error('Error loading admissions:', error);
        document.getElementById('admissionsTable').innerHTML = 
            '<tr><td colspan="8" class="px-6 py-8 text-center text-red-500">Failed to load admissions.</td></tr>';
    }
}

function renderAdmissions() {
    const table = document.getElementById('admissionsTable');
    
    if (!admissionsData.length) {
        table.innerHTML = '<tr><td colspan="8" class="px-6 py-8 text-center text-gray-500">No admissions found.</td></tr>';
        return;
    }
    
    table.innerHTML = admissionsData.map(admission => {
        const pending = admission.pendingAmount || ((admission.totalFees || 0) - (admission.paidAmount || 0));
        const isLocked = admission.isLocked;
        
        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${admission.enquiryId?.name || '-'}</div>
                    <div class="text-sm text-gray-500">${admission.enquiryId?.mobile || ''}</div>
                </td>
                <td class="px-6 py-4 text-gray-600">${admission.enquiryId?.course || '-'}</td>
                <td class="px-6 py-4 text-gray-600">${formatDate(admission.admissionDate)}</td>
                <td class="px-6 py-4 font-medium text-gray-800">${formatCurrency(admission.totalFees)}</td>
                <td class="px-6 py-4 text-green-600">${formatCurrency(admission.paidAmount)}</td>
                <td class="px-6 py-4 ${pending > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}">${formatCurrency(pending)}</td>
                <td class="px-6 py-4">
                    ${isLocked ? 
                        '<span class="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Locked</span>' :
                        '<span class="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Active</span>'
                    }
                </td>
                <td class="px-6 py-4">
                    <button onclick="viewAdmission('${admission._id}')" class="text-blue-600 hover:text-blue-800 font-medium">
                        View
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function updatePagination(total) {
    const start = (currentPage - 1) * 10 + 1;
    const end = Math.min(currentPage * 10, total);
    
    document.getElementById('showingStart').textContent = start;
    document.getElementById('showingEnd').textContent = end;
    document.getElementById('totalItems').textContent = total;
    
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
    
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const activeClass = i === currentPage ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50';
            html += `<button onclick="goToAdmissionPage(${i})" class="px-3 py-1 border rounded-lg text-sm ${activeClass}">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span class="px-2 text-gray-400">...</span>`;
        }
    }
    document.getElementById('pageNumbers').innerHTML = html;
}

async function viewAdmission(id) {
    try {
        const response = await apiGet(API_ENDPOINTS.ADMISSIONS.DETAIL(id));
        const admission = response.data?.admission || response.data;
        const modal = document.getElementById('admissionModal');
        const content = document.getElementById('admissionModalContent');
        
        const pending = (admission.pendingAmount || (admission.totalFees || 0) - (admission.paidAmount || 0));
        const isLocked = admission.isLocked;
        const user = getCurrentUser();
        const isAdmin = user?.role === 'admin';
        
        // Check permissions
        const canEdit = !isLocked || isAdmin;
        const overlayClass = canEdit ? '' : 'locked-overlay';
        
        content.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="${overlayClass}">
                    <h4 class="font-semibold text-gray-700 mb-3">Student Information</h4>
                    <div class="space-y-2">
                        <p><span class="text-gray-500">Name:</span> ${admission.enquiryId?.name || '-'}</p>
                        <p><span class="text-gray-500">Mobile:</span> ${admission.enquiryId?.mobile || '-'}</p>
                        <p><span class="text-gray-500">Course:</span> ${admission.enquiryId?.course || '-'}</p>
                    </div>
                </div>
                
                <div class="${overlayClass}">
                    <h4 class="font-semibold text-gray-700 mb-3">Fee Details</h4>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-500">Total Fees:</span>
                            <span class="font-medium">${formatCurrency(admission.totalFees)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500">Paid Amount:</span>
                            <span class="font-medium text-green-600">${formatCurrency(admission.paidAmount)}</span>
                        </div>
                        <div class="flex justify-between border-t pt-2">
                            <span class="text-gray-500">Pending:</span>
                            <span class="font-medium ${pending > 0 ? 'text-red-600' : 'text-green-600'}">${formatCurrency(pending)}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            ${!canEdit ? '<p class="text-red-600 text-sm mt-4 text-center">🔒 This admission is locked. Contact admin for changes.</p>' : ''}
            
            ${isAdmin && !isLocked ? `
                <div class="mt-6 pt-4 border-t flex justify-end space-x-3">
                    <button onclick="lockAdmission('${id}')" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
                        Lock Admission
                    </button>
                </div>
            ` : ''}
        `;
        
        modal.classList.remove('hidden');
    } catch (error) {
        showToast('error', 'Error', 'Failed to load admission details');
    }
}

async function lockAdmission(id) {
    if (!confirm('Are you sure you want to lock this admission? Locked admissions cannot be edited by counselors.')) {
        return;
    }
    try {
        await apiPut(API_ENDPOINTS.ADMISSIONS.LOCK(id));
        showToast('success', 'Success', 'Admission locked successfully');
        document.getElementById('admissionModal').classList.add('hidden');
        loadAdmissions();
    } catch (error) {
        showToast('error', 'Error', 'Failed to lock admission');
    }
}

function goToAdmissionPage(page) {
    currentPage = page;
    loadAdmissions();
}

// Exports
window.viewAdmission = viewAdmission;
window.lockAdmission = lockAdmission;
window.goToAdmissionPage = goToAdmissionPage;
