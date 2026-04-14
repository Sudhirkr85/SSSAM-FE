let admissions = [];
let selectedAdmissionId = null;

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
});

/* ======================
LOAD DATA
====================== */
async function loadAdmissions() {
    try {
        const res = await apiGet(API_ENDPOINTS.ADMISSIONS.GET_ALL, {
            page: currentPage,
            limit: ITEMS_PER_PAGE
        });

        admissions = res.admissions || [];
        paginationData = res.pagination || { page: 1, totalPages: 1, totalCount: 0 };
        totalPages = paginationData.totalPages || 1;

        renderTable();
        renderStats();
        updatePaginationInfoFromServer(paginationData);
    } catch (err) {
        showToast('error', 'Failed to load admissions');
        renderEmptyState();
    }
}

/* ======================
RENDER
====================== */
function renderTable() {
    const table = document.getElementById('admissionTable');

    if (!admissions.length) {
        renderEmptyState();
        return;
    }

    table.innerHTML = admissions.map(a => {
        const paid = a.paidAmount || 0;
        const total = a.totalFees || 0;
        const pending = total - paid;
        const isComplete = pending <= 0;

        return `
            <tr class="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${a.enquiryId?.name || '-'}</div>
                    ${a.enquiryId?.mobile ? `<div class="text-xs text-gray-500">${a.enquiryId.mobile}</div>` : ''}
                </td>
                <td class="px-6 py-4 text-gray-700">${a.enquiryId?.courseInterested || '-'}</td>
                <td class="px-6 py-4 font-medium text-gray-800">${formatCurrency(total)}</td>
                <td class="px-6 py-4 text-green-600 font-medium">${formatCurrency(paid)}</td>
                <td class="px-6 py-4 ${isComplete ? 'text-green-600' : 'text-red-600'} font-medium">
                    ${isComplete ? '✓ Paid' : formatCurrency(pending)}
                </td>
                <td class="px-6 py-4 text-center">
                    ${!isComplete ? `
                        <button onclick="openPaymentModal('${a._id}')"
                            class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm">
                            Pay
                        </button>
                    ` : `<span class="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                        <i data-lucide="check" class="w-3 h-3"></i> Completed
                    </span>`}
                </td>
            </tr>
        `;
    }).join('');
}

function renderEmptyState() {
    const table = document.getElementById('admissionTable');
    table.innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-12">
                <div class="flex flex-col items-center gap-3">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <i data-lucide="graduation-cap" class="w-8 h-8 text-gray-400"></i>
                    </div>
                    <div>
                        <p class="text-gray-800 font-medium">No admissions yet</p>
                        <p class="text-gray-500 text-sm">Convert enquiries to see them here</p>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

/* ======================
STATS
====================== */
function renderStats() {
    const total = paginationData.totalCount || 0;
    const completed = admissions.filter(a => (a.paidAmount || 0) >= (a.totalFees || 0)).length;
    const pending = admissions.length - completed;

    document.getElementById('totalAdmissions').textContent = total;
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('completedCount').textContent = completed;
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
