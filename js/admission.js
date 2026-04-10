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

// Payment Plan State
let currentAdmissionId = null;
let currentAdmission = null;
let paymentType = 'ONE_TIME'; // 'ONE_TIME' | 'INSTALLMENT'
let installments = [];
let hasUnsavedChanges = false;

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
    
    // Main Admission Modal
    document.getElementById('closeAdmissionModal')?.addEventListener('click', closeAdmissionModal);
    document.getElementById('admissionModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeAdmissionModal();
    });
    
    // Installment Modal
    document.getElementById('closeInstallmentModal')?.addEventListener('click', closeInstallmentModal);
    document.getElementById('cancelInstallment')?.addEventListener('click', closeInstallmentModal);
    document.getElementById('installmentModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeInstallmentModal();
    });
    document.getElementById('installmentForm')?.addEventListener('submit', handleSaveInstallment);
    
    // Pay Full Modal
    document.getElementById('closePayFullModal')?.addEventListener('click', closePayFullModal);
    document.getElementById('cancelPayFull')?.addEventListener('click', closePayFullModal);
    document.getElementById('payFullModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closePayFullModal();
    });
    document.getElementById('payFullForm')?.addEventListener('submit', handlePayFullAmount);
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
        const paymentType = admission.paymentType || 'ONE_TIME';
        
        const paymentTypeBadge = paymentType === 'INSTALLMENT' 
            ? `<span class="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Installment</span>`
            : `<span class="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>One Time</span>`;
        
        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${admission.enquiryId?.name || '-'}</div>
                    <div class="text-sm text-gray-500">${admission.enquiryId?.mobile || ''}</div>
                </td>
                <td class="px-6 py-4 text-gray-600">${admission.enquiryId?.course || '-'}</td>
                <td class="px-6 py-4 text-gray-600">${formatDate(admission.admissionDate)}</td>
                <td class="px-6 py-4">${paymentTypeBadge}</td>
                <td class="px-6 py-4 font-medium text-gray-800">${formatCurrency(admission.totalFees)}</td>
                <td class="px-6 py-4 text-green-600">${formatCurrency(admission.paidAmount || 0)}</td>
                <td class="px-6 py-4 ${pending > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}">${formatCurrency(pending)}</td>
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
        
        // Store current admission data
        currentAdmissionId = id;
        currentAdmission = admission;
        
        // Initialize payment plan state from admission data
        paymentType = admission.paymentType || 'ONE_TIME';
        installments = admission.installments ? [...admission.installments] : [];
        hasUnsavedChanges = false;
        
        renderAdmissionModal(admission);
        
        const modal = document.getElementById('admissionModal');
        modal.classList.remove('hidden');
    } catch (error) {
        showToast('error', 'Error', 'Failed to load admission details');
    }
}

function renderAdmissionModal(admission) {
    const content = document.getElementById('admissionModalContent');
    
    const pending = admission.pendingAmount || ((admission.totalFees || 0) - (admission.paidAmount || 0));
    const isLocked = admission.isLocked;
    const user = getCurrentUser();
    const isAdmin = user?.role === 'admin';
    const isCounselor = user?.role === 'counselor';
    
    // Check permissions
    const canEditPaymentPlan = (!isLocked || isAdmin) && pending > 0;
    const canModifyInstallments = canEditPaymentPlan && paymentType === 'INSTALLMENT';
    
    const totalInstallmentAmount = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
    const isInstallmentTotalValid = Math.abs(totalInstallmentAmount - (admission.totalFees || 0)) < 0.01;
    
    content.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Left Column - Student Info & Fee Summary -->
            <div class="lg:col-span-1 space-y-6">
                <div class="bg-gray-50 rounded-lg p-4">
                    <h4 class="font-semibold text-gray-700 mb-3">Student Information</h4>
                    <div class="space-y-2 text-sm">
                        <p><span class="text-gray-500">Name:</span> ${admission.enquiryId?.name || '-'}</p>
                        <p><span class="text-gray-500">Mobile:</span> ${admission.enquiryId?.mobile || '-'}</p>
                        <p><span class="text-gray-500">Course:</span> ${admission.enquiryId?.course || '-'}</p>
                        <p><span class="text-gray-500">Admission Date:</span> ${formatDate(admission.admissionDate)}</p>
                    </div>
                </div>
                
                <div class="bg-gray-50 rounded-lg p-4">
                    <h4 class="font-semibold text-gray-700 mb-3">Fee Summary</h4>
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-500 text-sm">Total Fees:</span>
                            <span class="font-medium">${formatCurrency(admission.totalFees)}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-500 text-sm">Paid Amount:</span>
                            <span class="font-medium text-green-600">${formatCurrency(admission.paidAmount || 0)}</span>
                        </div>
                        <div class="flex justify-between border-t pt-2">
                            <span class="text-gray-500 text-sm">Pending:</span>
                            <span class="font-medium ${pending > 0 ? 'text-red-600' : 'text-green-600'}">${formatCurrency(pending)}</span>
                        </div>
                    </div>
                </div>
                
                ${isLocked ? `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p class="text-red-600 text-sm text-center">
                            <svg class="w-5 h-5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                            </svg>
                            This admission is locked. Contact admin for changes.
                        </p>
                    </div>
                ` : ''}
                
                ${isAdmin && !isLocked ? `
                    <div class="flex justify-center">
                        <button onclick="lockAdmission('${admission._id}')" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">
                            Lock Admission
                        </button>
                    </div>
                ` : ''}
            </div>
            
            <!-- Right Column - Payment Plan Management -->
            <div class="lg:col-span-2 space-y-6">
                <!-- Payment Type Selection -->
                <div class="bg-white border rounded-xl p-6">
                    <h4 class="font-semibold text-gray-800 mb-4">Payment Type</h4>
                    
                    <div class="flex flex-wrap gap-4 mb-4">
                        <label class="flex items-center space-x-3 cursor-pointer ${!canEditPaymentPlan ? 'opacity-60' : ''}">
                            <input type="radio" name="paymentType" value="ONE_TIME" 
                                ${paymentType === 'ONE_TIME' ? 'checked' : ''} 
                                ${!canEditPaymentPlan ? 'disabled' : ''}
                                onchange="handlePaymentTypeChange('ONE_TIME')"
                                class="w-4 h-4 text-blue-600 focus:ring-blue-500">
                            <span class="text-gray-700">One Time Payment</span>
                        </label>
                        <label class="flex items-center space-x-3 cursor-pointer ${!canEditPaymentPlan ? 'opacity-60' : ''}">
                            <input type="radio" name="paymentType" value="INSTALLMENT" 
                                ${paymentType === 'INSTALLMENT' ? 'checked' : ''}
                                ${!canEditPaymentPlan ? 'disabled' : ''}
                                onchange="handlePaymentTypeChange('INSTALLMENT')"
                                class="w-4 h-4 text-blue-600 focus:ring-blue-500">
                            <span class="text-gray-700">Installment Plan</span>
                        </label>
                    </div>
                    
                    <!-- Payment Type Badge -->
                    <div class="mb-4">
                        ${paymentType === 'ONE_TIME' 
                            ? '<span class="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"><svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>Full Payment Mode</span>'
                            : '<span class="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium"><svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>Installment Plan</span>'
                        }
                    </div>
                    
                    <!-- ONE TIME Payment View -->
                    ${paymentType === 'ONE_TIME' ? `
                        <div class="bg-blue-50 rounded-lg p-4 space-y-4">
                            <div class="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <p class="text-sm text-gray-600">Total Fees</p>
                                    <p class="font-semibold text-lg">${formatCurrency(admission.totalFees)}</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600">Paid Amount</p>
                                    <p class="font-semibold text-lg text-green-600">${formatCurrency(admission.paidAmount || 0)}</p>
                                </div>
                                <div>
                                    <p class="text-sm text-gray-600">Pending</p>
                                    <p class="font-semibold text-lg ${pending > 0 ? 'text-red-600' : 'text-green-600'}">${formatCurrency(pending)}</p>
                                </div>
                            </div>
                            ${pending > 0 && canEditPaymentPlan ? `
                                <div class="flex justify-center pt-2">
                                    <button onclick="openPayFullModal()" class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors">
                                        Pay Full Amount
                                    </button>
                                </div>
                            ` : ''}
                            ${pending <= 0 ? `
                                <div class="text-center pt-2">
                                    <span class="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                                        </svg>
                                        Fully Paid
                                    </span>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    <!-- INSTALLMENT Payment View -->
                    ${paymentType === 'INSTALLMENT' ? `
                        <div class="space-y-4">
                            <!-- Installment Progress -->
                            <div class="bg-purple-50 rounded-lg p-4">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="text-sm text-gray-600">Payment Progress</span>
                                    <span class="text-sm font-medium">${installments.filter(i => i.status === 'Paid').length} / ${installments.length} Paid</span>
                                </div>
                                <div class="w-full bg-gray-200 rounded-full h-2">
                                    <div class="bg-purple-600 h-2 rounded-full transition-all duration-300" 
                                        style="width: ${installments.length > 0 ? (installments.filter(i => i.status === 'Paid').length / installments.length * 100) : 0}%"></div>
                                </div>
                                <div class="flex justify-between mt-2 text-sm">
                                    <span class="text-gray-600">Total Installments: ${formatCurrency(totalInstallmentAmount)}</span>
                                    ${!isInstallmentTotalValid ? 
                                        `<span class="text-red-600 font-medium">Must equal ${formatCurrency(admission.totalFees)}</span>` : 
                                        '<span class="text-green-600 font-medium">✓ Valid</span>'
                                    }
                                </div>
                            </div>
                            
                            <!-- Add Installment Button -->
                            ${canModifyInstallments ? `
                                <div class="flex justify-end">
                                    <button onclick="openInstallmentModal()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-2">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                                        </svg>
                                        <span>Add Installment</span>
                                    </button>
                                </div>
                            ` : ''}
                            
                            <!-- Installments Table -->
                            <div class="overflow-x-auto border rounded-lg">
                                <table class="w-full text-sm">
                                    <thead class="bg-gray-50">
                                        <tr>
                                            <th class="px-4 py-2 text-left font-medium text-gray-600">#</th>
                                            <th class="px-4 py-2 text-left font-medium text-gray-600">Amount</th>
                                            <th class="px-4 py-2 text-left font-medium text-gray-600">Due Date</th>
                                            <th class="px-4 py-2 text-left font-medium text-gray-600">Paid</th>
                                            <th class="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                                            <th class="px-4 py-2 text-left font-medium text-gray-600">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-200">
                                        ${installments.length === 0 ? `
                                            <tr>
                                                <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                                                    No installments added yet.
                                                    ${canModifyInstallments ? ' Click "Add Installment" to create a payment plan.' : ''}
                                                </td>
                                            </tr>
                                        ` : installments.map((inst, index) => {
                                            const isPaid = inst.status === 'Paid';
                                            const isOverdue = !isPaid && new Date(inst.dueDate) < new Date();
                                            return `
                                                <tr class="${isOverdue ? 'bg-red-50' : ''} ${isPaid ? 'bg-green-50' : ''}">
                                                    <td class="px-4 py-3 font-medium">${index + 1}</td>
                                                    <td class="px-4 py-3 font-medium">${formatCurrency(inst.amount)}</td>
                                                    <td class="px-4 py-3 ${isOverdue ? 'text-red-600 font-medium' : ''}">
                                                        ${formatDate(inst.dueDate)}
                                                        ${isOverdue ? '<span class="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Overdue</span>' : ''}
                                                    </td>
                                                    <td class="px-4 py-3">${formatCurrency(inst.paidAmount || 0)}</td>
                                                    <td class="px-4 py-3">
                                                        ${isPaid 
                                                            ? '<span class="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Paid</span>'
                                                            : `<span class="inline-flex items-center px-2 py-1 ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'} rounded text-xs font-medium">${isOverdue ? 'Overdue' : 'Pending'}</span>`
                                                        }
                                                    </td>
                                                    <td class="px-4 py-3">
                                                        <div class="flex space-x-2">
                                                            ${!isPaid && canModifyInstallments ? `
                                                                <button onclick="editInstallment(${index})" class="text-blue-600 hover:text-blue-800" title="Edit">
                                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                                                    </svg>
                                                                </button>
                                                                <button onclick="deleteInstallment(${index})" class="text-red-600 hover:text-red-800" title="Delete">
                                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                                                    </svg>
                                                                </button>
                                                            ` : isPaid ? '<span class="text-gray-400 text-xs">Completed</span>' : '<span class="text-gray-400 text-xs">Locked</span>'}
                                                        </div>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- Save Payment Plan Button -->
                    ${canEditPaymentPlan && hasUnsavedChanges ? `
                        <div class="flex justify-end pt-4 border-t mt-4">
                            <button onclick="savePaymentPlan()" 
                                class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2 ${paymentType === 'INSTALLMENT' && !isInstallmentTotalValid ? 'opacity-50 cursor-not-allowed' : ''}"
                                ${paymentType === 'INSTALLMENT' && !isInstallmentTotalValid ? 'disabled' : ''}>
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/>
                                </svg>
                                <span>Save Payment Plan</span>
                            </button>
                        </div>
                        ${paymentType === 'INSTALLMENT' && !isInstallmentTotalValid ? `
                            <p class="text-red-600 text-sm text-right mt-2">Installment total must equal total fees (${formatCurrency(admission.totalFees)})</p>
                        ` : ''}
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

function closeAdmissionModal() {
    if (hasUnsavedChanges) {
        showConfirm('Unsaved Changes', 'You have unsaved changes. Are you sure you want to close?', () => {
            document.getElementById('admissionModal').classList.add('hidden');
            resetPaymentPlanState();
        });
    } else {
        document.getElementById('admissionModal').classList.add('hidden');
        resetPaymentPlanState();
    }
}

function resetPaymentPlanState() {
    currentAdmissionId = null;
    currentAdmission = null;
    paymentType = 'ONE_TIME';
    installments = [];
    hasUnsavedChanges = false;
}

function handlePaymentTypeChange(newType) {
    if (paymentType === newType) return;
    
    paymentType = newType;
    hasUnsavedChanges = true;
    
    if (newType === 'INSTALLMENT' && installments.length === 0) {
        // Initialize with empty installments array
        installments = [];
    } else if (newType === 'ONE_TIME') {
        // Clear installments when switching to one-time
        installments = [];
    }
    
    renderAdmissionModal(currentAdmission);
    showToast('info', 'Payment Type Changed', `Switched to ${newType === 'ONE_TIME' ? 'One Time Payment' : 'Installment Plan'}. Don't forget to save!`);
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

// Installment Modal Functions
function openInstallmentModal(editIndex = null) {
    const modal = document.getElementById('installmentModal');
    const form = document.getElementById('installmentForm');
    const title = document.getElementById('installmentModalTitle');
    const indexField = document.getElementById('installmentIndex');
    const errorDiv = document.getElementById('installmentValidationError');
    
    form.reset();
    errorDiv.classList.add('hidden');
    
    if (editIndex !== null && installments[editIndex]) {
        title.textContent = 'Edit Installment';
        indexField.value = editIndex;
        document.getElementById('installmentAmount').value = installments[editIndex].amount;
        document.getElementById('installmentDueDate').value = installments[editIndex].dueDate.split('T')[0];
    } else {
        title.textContent = 'Add Installment';
        indexField.value = '';
        // Set default due date to next month
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        document.getElementById('installmentDueDate').value = nextMonth.toISOString().split('T')[0];
    }
    
    modal.classList.remove('hidden');
}

function closeInstallmentModal() {
    document.getElementById('installmentModal').classList.add('hidden');
}

function handleSaveInstallment(e) {
    e.preventDefault();
    
    const indexField = document.getElementById('installmentIndex');
    const amount = parseFloat(document.getElementById('installmentAmount').value);
    const dueDate = document.getElementById('installmentDueDate').value;
    const errorDiv = document.getElementById('installmentValidationError');
    
    // Validation
    if (!amount || amount <= 0) {
        errorDiv.textContent = 'Amount must be greater than 0';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    if (!dueDate) {
        errorDiv.textContent = 'Due date is required';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    const editIndex = indexField.value !== '' ? parseInt(indexField.value) : null;
    
    // Check if total would exceed fees (for new installments)
    const currentTotal = installments.reduce((sum, inst, idx) => {
        if (editIndex !== null && idx === editIndex) return sum;
        return sum + (inst.amount || 0);
    }, 0);
    
    const newTotal = currentTotal + amount;
    const totalFees = currentAdmission?.totalFees || 0;
    
    if (newTotal > totalFees) {
        errorDiv.textContent = `Total installments (${formatCurrency(newTotal)}) would exceed total fees (${formatCurrency(totalFees)})`;
        errorDiv.classList.remove('hidden');
        return;
    }
    
    errorDiv.classList.add('hidden');
    
    const installmentData = {
        amount: amount,
        dueDate: dueDate,
        paidAmount: editIndex !== null ? (installments[editIndex].paidAmount || 0) : 0,
        status: editIndex !== null ? installments[editIndex].status : 'Pending'
    };
    
    if (editIndex !== null) {
        installments[editIndex] = installmentData;
        showToast('success', 'Updated', 'Installment updated successfully');
    } else {
        installments.push(installmentData);
        showToast('success', 'Added', 'Installment added successfully');
    }
    
    hasUnsavedChanges = true;
    closeInstallmentModal();
    renderAdmissionModal(currentAdmission);
}

function editInstallment(index) {
    openInstallmentModal(index);
}

function deleteInstallment(index) {
    const inst = installments[index];
    if (inst.status === 'Paid') {
        showToast('error', 'Error', 'Cannot delete a paid installment');
        return;
    }
    
    showConfirm('Delete Installment', `Are you sure you want to delete installment #${index + 1}?`, () => {
        installments.splice(index, 1);
        hasUnsavedChanges = true;
        renderAdmissionModal(currentAdmission);
        showToast('success', 'Deleted', 'Installment deleted successfully');
    });
}

async function savePaymentPlan() {
    if (!currentAdmissionId) return;
    
    // Validation for installment plan
    if (paymentType === 'INSTALLMENT') {
        if (installments.length === 0) {
            showToast('error', 'Error', 'At least one installment is required for installment plan');
            return;
        }
        
        const totalInstallmentAmount = installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
        const totalFees = currentAdmission?.totalFees || 0;
        
        if (Math.abs(totalInstallmentAmount - totalFees) > 0.01) {
            showToast('error', 'Error', `Total installments (${formatCurrency(totalInstallmentAmount)}) must equal total fees (${formatCurrency(totalFees)})`);
            return;
        }
    }
    
    try {
        const payload = {
            paymentType: paymentType,
            installments: paymentType === 'INSTALLMENT' ? installments : []
        };
        
        await apiPut(API_ENDPOINTS.ADMISSIONS.PAYMENT_PLAN(currentAdmissionId), payload);
        
        hasUnsavedChanges = false;
        showToast('success', 'Success', 'Payment plan saved successfully');
        
        // Refresh admission data
        const response = await apiGet(API_ENDPOINTS.ADMISSIONS.DETAIL(currentAdmissionId));
        currentAdmission = response.data?.admission || response.data;
        renderAdmissionModal(currentAdmission);
        
        // Refresh admissions list
        loadAdmissions();
        loadStats();
    } catch (error) {
        const message = error.response?.data?.message || 'Failed to save payment plan';
        showToast('error', 'Error', message);
    }
}

// Pay Full Amount Modal Functions
function openPayFullModal() {
    if (!currentAdmission) return;
    
    const pending = currentAdmission.pendingAmount || ((currentAdmission.totalFees || 0) - (currentAdmission.paidAmount || 0));
    
    document.getElementById('payFullTotal').textContent = formatCurrency(currentAdmission.totalFees);
    document.getElementById('payFullPending').textContent = formatCurrency(pending);
    document.getElementById('payFullPaymentMode').value = '';
    document.getElementById('payFullNotes').value = '';
    
    document.getElementById('payFullModal').classList.remove('hidden');
}

function closePayFullModal() {
    document.getElementById('payFullModal').classList.add('hidden');
}

async function handlePayFullAmount(e) {
    e.preventDefault();
    
    if (!currentAdmissionId) return;
    
    const submitBtn = document.getElementById('confirmPayFull');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Processing...';
    
    try {
        const pending = currentAdmission.pendingAmount || ((currentAdmission.totalFees || 0) - (currentAdmission.paidAmount || 0));
        
        const data = {
            admissionId: currentAdmissionId,
            amount: pending,
            paymentMode: document.getElementById('payFullPaymentMode').value,
            paymentDate: new Date().toISOString().split('T')[0],
            notes: document.getElementById('payFullNotes').value
        };
        
        await apiPost(API_ENDPOINTS.PAYMENTS.CREATE, data);
        
        showToast('success', 'Success', 'Full payment recorded successfully!');
        closePayFullModal();
        
        // Refresh admission data
        const response = await apiGet(API_ENDPOINTS.ADMISSIONS.DETAIL(currentAdmissionId));
        currentAdmission = response.data?.admission || response.data;
        renderAdmissionModal(currentAdmission);
        
        // Refresh admissions list
        loadAdmissions();
        loadStats();
    } catch (error) {
        const message = error.response?.data?.message || 'Failed to record payment';
        showToast('error', 'Error', message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Confirm Payment';
    }
}

// Exports
window.viewAdmission = viewAdmission;
window.lockAdmission = lockAdmission;
window.goToAdmissionPage = goToAdmissionPage;
window.handlePaymentTypeChange = handlePaymentTypeChange;
window.openInstallmentModal = openInstallmentModal;
window.editInstallment = editInstallment;
window.deleteInstallment = deleteInstallment;
window.savePaymentPlan = savePaymentPlan;
window.openPayFullModal = openPayFullModal;
