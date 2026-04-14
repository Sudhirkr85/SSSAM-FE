let payments = [];
let allPayments = [];

// Pagination state
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let totalPages = 1;

// Payment mode badge styles
const paymentModeStyles = {
    'Cash': { bg: 'bg-green-100', text: 'text-green-700', icon: '💵' },
    'UPI': { bg: 'bg-purple-100', text: 'text-purple-700', icon: '📱' },
    'Card': { bg: 'bg-amber-100', text: 'text-amber-700', icon: '💳' },
    'Bank Transfer': { bg: 'bg-blue-100', text: 'text-blue-700', icon: '🏦' }
};

/* ======================
INIT
====================== */
document.addEventListener('DOMContentLoaded', () => {
    loadPayments();
});

/* ======================
LOAD DATA
====================== */
async function loadPayments() {
    try {
        const res = await apiGet(API_ENDPOINTS.PAYMENTS.GET_ALL);
        allPayments = res.payments || [];

        // Calculate pagination
        totalPages = Math.ceil(allPayments.length / ITEMS_PER_PAGE) || 1;

        // Get current page slice
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        payments = allPayments.slice(start, end);

        renderTable();
        renderStats();
        updatePaginationInfo(start, end, allPayments.length);
    } catch {
        showToast('error', 'Failed to load payments');
        renderEmptyState();
    }
}

/* ======================
RENDER TABLE
====================== */
function renderTable() {
    const table = document.getElementById('paymentTable');

    if (!payments.length) {
        renderEmptyState();
        return;
    }

    table.innerHTML = payments.map(p => {
        const mode = p.paymentMode || 'Cash';
        const style = paymentModeStyles[mode] || paymentModeStyles['Cash'];

        return `
            <tr class="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${p.admissionId?.enquiryId?.name || '-'}</div>
                    ${p.admissionId?.enquiryId?.mobile ? `<div class="text-xs text-gray-500">${p.admissionId.enquiryId.mobile}</div>` : ''}
                </td>
                <td class="px-6 py-4 text-gray-700">${p.admissionId?.enquiryId?.courseInterested || '-'}</td>
                <td class="px-6 py-4 text-green-600 font-semibold">${formatCurrency(p.amount)}</td>
                <td class="px-6 py-4">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${style.bg} ${style.text}">
                        <span>${style.icon}</span>
                        ${mode}
                    </span>
                </td>
                <td class="px-6 py-4 text-gray-600">${formatDate(p.createdAt)}</td>
            </tr>
        `;
    }).join('');
}

function renderEmptyState() {
    const table = document.getElementById('paymentTable');
    table.innerHTML = `
        <tr>
            <td colspan="5" class="text-center py-12">
                <div class="flex flex-col items-center gap-3">
                    <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                        <i data-lucide="wallet" class="w-8 h-8 text-gray-400"></i>
                    </div>
                    <div>
                        <p class="text-gray-800 font-medium">No payments found</p>
                        <p class="text-gray-500 text-sm">Payments will appear here when students pay</p>
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
    const total = allPayments.length;
    const totalAmount = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // By payment mode
    const byMode = {
        'Cash': { count: 0, amount: 0 },
        'UPI': { count: 0, amount: 0 },
        'Card': { count: 0, amount: 0 },
        'Bank Transfer': { count: 0, amount: 0 }
    };

    allPayments.forEach(p => {
        const mode = p.paymentMode || 'Cash';
        if (byMode[mode]) {
            byMode[mode].count++;
            byMode[mode].amount += p.amount || 0;
        }
    });

    // Update stats display
    document.getElementById('totalPayments').textContent = total;
    document.getElementById('totalAmount').textContent = formatCurrency(totalAmount);

    document.getElementById('cashCount').textContent = byMode['Cash'].count;
    document.getElementById('cashAmount').textContent = formatCurrency(byMode['Cash'].amount);

    document.getElementById('upiCount').textContent = byMode['UPI'].count;
    document.getElementById('upiAmount').textContent = formatCurrency(byMode['UPI'].amount);

    document.getElementById('cardCount').textContent = byMode['Card'].count;
    document.getElementById('cardAmount').textContent = formatCurrency(byMode['Card'].amount);
}

/* ======================
PAGINATION
====================== */
function changePage(direction) {
    const newPage = currentPage + direction;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        loadPayments();
    }
}

function goToPage(page) {
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        loadPayments();
    }
}

function goToLastPage() {
    currentPage = totalPages;
    loadPayments();
}

function updatePaginationInfo(start, end, total) {
    // Update showing text
    document.getElementById('showingFrom').textContent = total > 0 ? start + 1 : 0;
    document.getElementById('showingTo').textContent = Math.min(end, total);
    document.getElementById('totalItems').textContent = total;

    // Update button states
    document.getElementById('firstPage').disabled = currentPage === 1;
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
    document.getElementById('lastPage').disabled = currentPage === totalPages;

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
EXPORT
====================== */
window.changePage = changePage;
window.goToPage = goToPage;
window.goToLastPage = goToLastPage;
