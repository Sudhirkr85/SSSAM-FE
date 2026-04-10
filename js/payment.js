/**
 * Payment Module
 * Institute Enquiry Management System
 */

// State
let paymentsData = [];
let currentPage = 1;
let totalPages = 1;
let admissions = [];
let selectedAdmission = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('paymentsTable')) return;
    
    initializeElements();
    setupEventListeners();
    loadStats();
    loadPayments();
    loadAdmissionsForPayment();
});

function initializeElements() {
    // Filters
    document.getElementById('searchInput')?.addEventListener('input', debounce((e) => {
        loadPayments(e.target.value, document.getElementById('dateFilter')?.value);
    }, 300));
    
    document.getElementById('dateFilter')?.addEventListener('change', (e) => {
        loadPayments(document.getElementById('searchInput')?.value, e.target.value);
    });
    
    document.getElementById('resetFilters')?.addEventListener('click', () => {
        document.getElementById('searchInput').value = '';
        document.getElementById('dateFilter').value = '';
        loadPayments();
    });
    
    // Pagination
    document.getElementById('prevPage')?.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadPayments();
        }
    });
    
    document.getElementById('nextPage')?.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadPayments();
        }
    });
    
    // Payment Modal
    document.getElementById('addPaymentBtn')?.addEventListener('click', () => {
        openPaymentModal();
    });
    
    document.getElementById('closePaymentModal')?.addEventListener('click', () => {
        closePaymentModal();
    });
    
    document.getElementById('cancelPayment')?.addEventListener('click', () => {
        closePaymentModal();
    });
    
    document.getElementById('paymentForm')?.addEventListener('submit', handleAddPayment);
    
    document.getElementById('paymentModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            closePaymentModal();
        }
    });
    
    // Admission selection change
    document.getElementById('paymentAdmission')?.addEventListener('change', handleAdmissionChange);
}

function setupEventListeners() {
    // Additional listeners if needed
}

async function loadStats() {
    try {
        const stats = await apiGet('/payments/stats');
        
        document.getElementById('todayCollection').textContent = formatCurrency(stats.today || 0);
        document.getElementById('monthCollection').textContent = formatCurrency(stats.thisMonth || 0);
        document.getElementById('totalTransactions').textContent = stats.totalTransactions || 0;
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

async function loadPayments(search = '', dateRange = '') {
    try {
        document.getElementById('paymentsTable').innerHTML = 
            '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">Loading...</td></tr>';
        
        const params = {
            page: currentPage,
            limit: 10,
            search,
            dateRange,
        };
        
        const response = await apiGet(API_ENDPOINTS.PAYMENTS.LIST, params);
        
        paymentsData = response.data || [];
        currentPage = response.currentPage || 1;
        totalPages = response.totalPages || 1;
        
        renderPayments();
        updatePagination(response.total || 0);
    } catch (error) {
        document.getElementById('paymentsTable').innerHTML = 
            '<tr><td colspan="7" class="px-6 py-8 text-center text-red-500">Failed to load payments.</td></tr>';
    }
}

function renderPayments() {
    const table = document.getElementById('paymentsTable');
    
    if (!paymentsData.length) {
        table.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">No payments found.</td></tr>';
        return;
    }
    
    table.innerHTML = paymentsData.map(payment => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4 font-medium text-gray-900">${payment.receiptNumber || '-'}</td>
            <td class="px-6 py-4">
                <div class="font-medium text-gray-800">${payment.student?.name || payment.admission?.student?.name || '-'}</div>
            </td>
            <td class="px-6 py-4 text-gray-600">${payment.admission?.course?.name || '-'}</td>
            <td class="px-6 py-4 font-medium text-green-600">${formatCurrency(payment.amount)}</td>
            <td class="px-6 py-4 text-gray-600">${formatDate(payment.paymentDate)}</td>
            <td class="px-6 py-4">
                <span class="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                    ${payment.paymentMode}
                </span>
            </td>
            <td class="px-6 py-4">
                <div class="flex space-x-2">
                    <button onclick="viewReceipt('${payment._id || payment.id}')" class="text-blue-600 hover:text-blue-800">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                    </button>
                    <button onclick="printReceipt('${payment._id || payment.id}')" class="text-gray-600 hover:text-gray-800">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
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
            html += `<button onclick="goToPaymentPage(${i})" class="px-3 py-1 border rounded-lg text-sm ${activeClass}">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span class="px-2 text-gray-400">...</span>`;
        }
    }
    document.getElementById('pageNumbers').innerHTML = html;
}

async function loadAdmissionsForPayment() {
    try {
        const response = await apiGet(API_ENDPOINTS.ADMISSIONS.LIST, { limit: 1000 });
        admissions = response.data || [];
        
        const select = document.getElementById('paymentAdmission');
        if (select) {
            select.innerHTML = '<option value="">Select Admission</option>';
            admissions.forEach(admission => {
                const pending = (admission.totalFees || 0) - (admission.paidAmount || 0);
                if (pending > 0) {
                    select.innerHTML += `<option value="${admission._id || admission.id}">
                        ${admission.student?.name || admission.enquiry?.name} - ${admission.course?.name} (Pending: ₹${pending})
                    </option>`;
                }
            });
        }
    } catch (error) {
        console.error('Failed to load admissions:', error);
    }
}

function handleAdmissionChange(e) {
    const admissionId = e.target.value;
    const summary = document.getElementById('paymentSummary');
    
    if (!admissionId) {
        summary.classList.add('hidden');
        return;
    }
    
    selectedAdmission = admissions.find(a => (a._id || a.id) === admissionId);
    
    if (selectedAdmission) {
        const pending = (selectedAdmission.totalFees || 0) - (selectedAdmission.paidAmount || 0);
        document.getElementById('summaryTotal').textContent = formatCurrency(selectedAdmission.totalFees);
        document.getElementById('summaryPaid').textContent = formatCurrency(selectedAdmission.paidAmount);
        document.getElementById('summaryPending').textContent = formatCurrency(pending);
        summary.classList.remove('hidden');
        
        // Set max amount for validation
        document.getElementById('paymentAmount').max = pending;
    }
}

function openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    document.getElementById('paymentForm').reset();
    document.getElementById('paymentSummary').classList.add('hidden');
    document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
    selectedAdmission = null;
    modal.classList.remove('hidden');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
}

async function handleAddPayment(e) {
    e.preventDefault();
    
    const submitBtn = document.getElementById('savePayment');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';
    
    try {
        const data = {
            admissionId: document.getElementById('paymentAdmission').value,
            amount: parseFloat(document.getElementById('paymentAmount').value),
            paymentMode: document.getElementById('paymentMode').value,
            paymentDate: document.getElementById('paymentDate').value,
            nextInstallmentDate: document.getElementById('nextInstallmentDate').value || null,
            notes: document.getElementById('paymentNotes').value,
        };
        
        await apiPost(API_ENDPOINTS.PAYMENTS.CREATE, data);
        
        showToast('success', 'Success', 'Payment recorded successfully!');
        closePaymentModal();
        loadPayments();
        loadStats();
        loadAdmissionsForPayment();
    } catch (error) {
        const message = error.response?.data?.message || 'Failed to add payment';
        showToast('error', 'Error', message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Payment';
    }
}

async function viewReceipt(id) {
    try {
        // Open receipt in new window
        window.open(`${API_BASE_URL}/payments/${id}/receipt`, '_blank');
    } catch (error) {
        showToast('error', 'Error', 'Failed to load receipt');
    }
}

async function printReceipt(id) {
    try {
        // Fetch receipt and print
        const receipt = await apiGet(API_ENDPOINTS.PAYMENTS.RECEIPT(id));
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(receipt);
        printWindow.document.close();
        printWindow.print();
    } catch (error) {
        showToast('error', 'Error', 'Failed to print receipt');
    }
}

function goToPaymentPage(page) {
    currentPage = page;
    loadPayments();
}

// Exports
window.goToPaymentPage = goToPaymentPage;
window.viewReceipt = viewReceipt;
window.printReceipt = printReceipt;
