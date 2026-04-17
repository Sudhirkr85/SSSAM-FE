let admissions = [];
let selectedAdmissionId = null;
let showCompletedWithRemaining = false;

// Pagination state
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let totalPages = 1;
let paginationData = { page: 1, totalPages: 1, totalCount: 0 };

/* ======================
INIT
====================== */
document.addEventListener('DOMContentLoaded', () => {
    loadAdmissions();

    // Amount validation on input
    const amountInput = document.getElementById('amount');
    if (amountInput) {
        amountInput.addEventListener('input', clearAmountError);
    }

    // Filter checkbox listener
    const filterCheckbox = document.getElementById('showCompletedWithRemaining');
    if (filterCheckbox) {
        filterCheckbox.addEventListener('change', (e) => {
            showCompletedWithRemaining = e.target.checked;
            currentPage = 1;
            loadAdmissions();
        });
    }
});

/* ======================
LOAD DATA
====================== */
async function loadAdmissions() {
    try {
        const params = {
            page: currentPage,
            limit: ITEMS_PER_PAGE
        };

        // Add filter for completed with remaining if checked
        if (showCompletedWithRemaining) {
            params.filter = 'completed_with_remaining';
        }

        const res = await apiGet(API_ENDPOINTS.ADMISSIONS.GET_ALL, params);

        admissions = res.admissions || [];
        paginationData = res.pagination || { page: 1, totalPages: 1, totalCount: 0 };
        totalPages = paginationData.totalPages || 1;

        renderTable();
        renderStats();
        updatePaginationInfoFromServer(paginationData);

        // Update completed with remaining count
        updateCompletedWithRemainingCount();
    } catch (err) {
        showToast('error', 'Failed to load admissions');
        renderEmptyState();
    }
}

/* ======================
COMPLETED WITH REMAINING COUNT
====================== */
function updateCompletedWithRemainingCount() {
    const countElement = document.getElementById('completedWithRemainingCount');
    if (!countElement) return;

    // Calculate completed admissions with remaining payment
    const completedWithRemaining = admissions.filter(a => {
        const paid = a.paidAmount || 0;
        const total = a.totalFees || 0;
        // Completed but has remaining (anomaly)
        return paid >= total && (total - paid) < 0;
    });

    if (completedWithRemaining.length > 0) {
        countElement.textContent = `${completedWithRemaining.length} completed with remaining`;
        countElement.classList.remove('hidden');
    } else {
        countElement.classList.add('hidden');
    }
}

/* ======================
STATUS CALCULATION
====================== */
function getPaymentStatus(paid, total, dueDate) {
    const remaining = total - paid;

    if (remaining <= 0) {
        return { status: 'Paid', color: 'green', bgClass: 'bg-green-50', textClass: 'text-green-700' };
    }

    if (paid > 0 && paid < total) {
        return { status: 'Partial', color: 'amber', bgClass: 'bg-amber-50', textClass: 'text-amber-700' };
    }

    // Check if overdue
    if (dueDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDate);
        due.setHours(0, 0, 0, 0);

        if (today > due) {
            const daysOverdue = Math.floor((today - due) / (1000 * 60 * 60 * 24));
            return { status: 'Overdue', color: 'red', bgClass: 'bg-red-50', textClass: 'text-red-700', daysOverdue };
        }
    }

    return { status: 'Pending', color: 'gray', bgClass: 'bg-gray-50', textClass: 'text-gray-600' };
}

function getStatusBadge(statusInfo) {
    const { status, color, daysOverdue } = statusInfo;
    const icons = {
        'Paid': 'check-circle',
        'Partial': 'clock',
        'Overdue': 'alert-circle',
        'Pending': 'circle'
    };

    let extraText = '';
    if (status === 'Overdue' && daysOverdue) {
        extraText = ` (${daysOverdue}d)`;
    }

    return `
        <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-${color}-100 ${statusInfo.textClass} rounded-lg text-xs font-medium">
            <i data-lucide="${icons[status]}" class="w-3.5 h-3.5"></i>
            ${status}${extraText}
        </span>
    `;
}

function getRowBgClass(status) {
    const bgClasses = {
        'Paid': 'bg-green-50/30 hover:bg-green-50/50',
        'Partial': 'bg-amber-50/30 hover:bg-amber-50/50',
        'Overdue': 'bg-red-50/30 hover:bg-red-50/50',
        'Pending': 'hover:bg-gray-50'
    };
    return bgClasses[status] || 'hover:bg-gray-50';
}

/* ======================
RENDER
====================== */
function renderTable() {
    const table = document.getElementById('admissionTable');
    const thead = document.querySelector('thead tr');

    if (!admissions.length) {
        renderEmptyState();
        return;
    }

    // Update table headers based on filter
    if (showCompletedWithRemaining) {
        thead.innerHTML = `
            <th class="px-6 py-3 text-left">Name</th>
            <th class="px-6 py-3">Course</th>
            <th class="px-6 py-3">Counselor</th>
            <th class="px-6 py-3">Total Fees</th>
            <th class="px-6 py-3">Paid</th>
            <th class="px-6 py-3">Remaining</th>
            <th class="px-6 py-3 text-center">Status</th>
        `;
    } else {
        thead.innerHTML = `
            <th class="px-6 py-3 text-left">Name</th>
            <th class="px-6 py-3">Course</th>
            <th class="px-6 py-3">Total Fees</th>
            <th class="px-6 py-3">Paid</th>
            <th class="px-6 py-3">Pending</th>
            <th class="px-6 py-3">Due Date</th>
            <th class="px-6 py-3 text-center">Status</th>
        `;
    }

    table.innerHTML = admissions.map(a => {
        const paid = a.paidAmount || 0;
        const total = a.totalFees || 0;
        const pending = total - paid;
        const counselor = a.enquiryId?.assignedTo;

        // Get due date from installments or admission
        const dueDate = a.installments?.[0]?.dueDate || a.dueDate || a.createdAt;
        const statusInfo = getPaymentStatus(paid, total, dueDate);
        const rowBgClass = getRowBgClass(statusInfo.status);

        if (showCompletedWithRemaining) {
            // Show counselor details in this mode
            return `
                <tr class="${rowBgClass} transition-colors border-b border-gray-50 last:border-0 cursor-pointer" onclick="window.location.href='admission-detail.html?id=${a._id}'">
                    <td class="px-6 py-4">
                        <div class="font-medium text-gray-900">${a.enquiryId?.name || '-'}</div>
                        ${a.enquiryId?.mobile ? `<div class="text-xs text-gray-500">${a.enquiryId.mobile}</div>` : ''}
                    </td>
                    <td class="px-6 py-4 text-gray-700">${a.enquiryId?.courseInterested || '-'}</td>
                    <td class="px-6 py-4">
                        <div class="text-sm text-gray-800">${counselor?.name || 'Unassigned'}</div>
                        ${counselor?.email ? `<div class="text-xs text-gray-500">${counselor.email}</div>` : ''}
                    </td>
                    <td class="px-6 py-4 font-medium text-gray-800">${formatCurrency(total)}</td>
                    <td class="px-6 py-4 text-green-600 font-medium">${formatCurrency(paid)}</td>
                    <td class="px-6 py-4 ${pending <= 0 ? 'text-green-600' : 'text-red-600'} font-medium">
                        ${pending <= 0 ? formatCurrency(Math.abs(pending)) + ' (overpaid)' : formatCurrency(pending)}
                    </td>
                    <td class="px-6 py-4 text-center" onclick="event.stopPropagation()">
                        ${getStatusBadge(statusInfo)}
                    </td>
                </tr>
            `;
        }

        return `
            <tr class="${rowBgClass} transition-colors border-b border-gray-50 last:border-0 cursor-pointer" onclick="window.location.href='admission-detail.html?id=${a._id}'">
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${a.enquiryId?.name || '-'}</div>
                    ${a.enquiryId?.mobile ? `<div class="text-xs text-gray-500">${a.enquiryId.mobile}</div>` : ''}
                </td>
                <td class="px-6 py-4 text-gray-700">${a.enquiryId?.courseInterested || '-'}</td>
                <td class="px-6 py-4 font-medium text-gray-800">${formatCurrency(total)}</td>
                <td class="px-6 py-4 text-green-600 font-medium">${formatCurrency(paid)}</td>
                <td class="px-6 py-4 ${pending <= 0 ? 'text-green-600' : 'text-red-600'} font-medium">
                    ${pending <= 0 ? '✓ Paid' : formatCurrency(pending)}
                </td>
                <td class="px-6 py-4 text-gray-600">
                    ${formatDate(dueDate)}
                </td>
                <td class="px-6 py-4 text-center" onclick="event.stopPropagation()">
                    ${getStatusBadge(statusInfo)}
                </td>
            </tr>
        `;
    }).join('');

    lucide.createIcons();
}

function renderEmptyState() {
    const table = document.getElementById('admissionTable');
    const colSpan = 7;
    const message = showCompletedWithRemaining
        ? 'No completed admissions with remaining payment found'
        : 'Convert enquiries to see them here';
    table.innerHTML = `
        <tr>
            <td colspan="${colSpan}" class="text-center py-12">
                <div class="flex flex-col items-center gap-3">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <i data-lucide="graduation-cap" class="w-8 h-8 text-gray-400"></i>
                    </div>
                    <div>
                        <p class="text-gray-800 font-medium">No admissions yet</p>
                        <p class="text-gray-500 text-sm">${message}</p>
                    </div>
                </div>
            </td>
        </tr>
    `;
    lucide.createIcons();
}

/* ======================
STATS
====================== */
function renderStats() {
    const total = paginationData.totalCount || 0;
    const completed = admissions.filter(a => (a.paidAmount || 0) >= (a.totalFees || 0)).length;
    const pending = admissions.length - completed;

    // Calculate total received and remaining from all admissions data
    let totalReceived = 0;
    let totalRemaining = 0;

    admissions.forEach(a => {
        const paid = a.paidAmount || 0;
        const totalFees = a.totalFees || 0;
        totalReceived += paid;
        totalRemaining += Math.max(0, totalFees - paid);
    });

    document.getElementById('totalAdmissions').textContent = total;
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('totalReceived').textContent = formatCurrency(totalReceived);
    document.getElementById('totalRemaining').textContent = formatCurrency(totalRemaining);
}

/* ======================
PAGINATION
====================== */
function changePage(direction) {
    const newPage = currentPage + direction;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        loadAdmissions();
    }
}

function goToPage(page) {
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        loadAdmissions();
    }
}

function goToLastPage() {
    currentPage = totalPages;
    loadAdmissions();
}

function updatePaginationInfoFromServer(pagination) {
    const total = pagination.totalCount || 0;
    const start = total > 0 ? ((pagination.page - 1) * ITEMS_PER_PAGE) + 1 : 0;
    const end = Math.min(start + ITEMS_PER_PAGE - 1, total);

    // Update showing text
    document.getElementById('showingFrom').textContent = start;
    document.getElementById('showingTo').textContent = end;
    document.getElementById('totalItems').textContent = total;

    // Update button states
    document.getElementById('firstPage').disabled = currentPage === 1;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage >= totalPages;
    document.getElementById('lastPage').disabled = currentPage >= totalPages;

    // Update page numbers display
    const pageNumbers = document.getElementById('pageNumbers');
    let html = '';

    // Show max 5 page numbers centered around current page
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<span class="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg font-medium">${i}</span>`;
        } else {
            html += `<button onclick="goToPage(${i})" class="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">${i}</button>`;
        }
    }

    pageNumbers.innerHTML = html;
}

/* ======================
PAYMENT MODAL
====================== */
function openPaymentModal(id) {
    selectedAdmissionId = id;
    document.getElementById('paymentAdmissionId').value = id;

    // Reset form
    document.getElementById('amount').value = '';
    document.getElementById('paymentMode').value = 'Cash';
    clearAmountError();

    // Show modal with animation
    const modal = document.getElementById('paymentModal');
    const modalContent = document.getElementById('paymentModalContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    const modalContent = document.getElementById('paymentModalContent');
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function clearAmountError() {
    const error = document.getElementById('amountError');
    const input = document.getElementById('amount');
    error.classList.add('hidden');
    input.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
    input.classList.add('border-gray-200', 'focus:border-green-500', 'focus:ring-green-100');
}

function validateAmount() {
    const amount = document.getElementById('amount');
    const error = document.getElementById('amountError');
    const value = Number(amount.value);

    if (!value || value <= 0) {
        error.classList.remove('hidden');
        amount.classList.remove('border-gray-200', 'focus:border-green-500', 'focus:ring-green-100');
        amount.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        return false;
    }
    error.classList.add('hidden');
    amount.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
    amount.classList.add('border-gray-200', 'focus:border-green-500', 'focus:ring-green-100');
    return true;
}

/* ======================
SUBMIT PAYMENT
====================== */
async function submitPayment() {
    const amount = Number(document.getElementById('amount').value);
    const paymentMode = document.getElementById('paymentMode').value;

    if (!validateAmount()) {
        showToast('error', 'Enter a valid amount');
        return;
    }

    try {
        await apiPost(API_ENDPOINTS.PAYMENTS.CREATE, {
            admissionId: selectedAdmissionId,
            amount,
            paymentMode
        });

        showToast('success', 'Payment added successfully');
        closePaymentModal();
        loadAdmissions();
    } catch (err) {
        showToast('error', err?.message || 'Payment failed');
    }
}

/* ======================
EXPORT
====================== */
window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.submitPayment = submitPayment;
window.changePage = changePage;
window.goToPage = goToPage;
window.goToLastPage = goToLastPage;
window.renderEmptyState = renderEmptyState;
window.updateCompletedWithRemainingCount = updateCompletedWithRemainingCount;
