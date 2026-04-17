let payments = [];

// Pagination state
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let totalPages = 1;

// Payment mode badge styles (match API uppercase format)
const paymentModeStyles = {
    'CASH': { bg: 'bg-green-100', text: 'text-green-700', icon: '💵' },
    'UPI': { bg: 'bg-purple-100', text: 'text-purple-700', icon: '📱' },
    'CARD': { bg: 'bg-amber-100', text: 'text-amber-700', icon: '💳' },
    'ONLINE': { bg: 'bg-blue-100', text: 'text-blue-700', icon: '🏦' },
    'CHEQUE': { bg: 'bg-gray-100', text: 'text-gray-700', icon: '📝' }
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
        // Use the correct endpoint: GET /api/payments with pagination
        const res = await apiGet(API_ENDPOINTS.PAYMENTS.GET_ALL, {
            page: currentPage,
            limit: ITEMS_PER_PAGE
        });

        // Response: { payments: [...], pagination: {...} }
        payments = res.payments || [];
        const pagination = res.pagination || { page: 1, totalPages: 1, totalCount: 0 };
        totalPages = pagination.totalPages || 1;

        renderTable();
        renderStatsFromDashboard(); // Get stats from dashboard API
        updatePaginationInfoFromServer(pagination);
    } catch (err) {
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
        const mode = p.paymentMode || 'CASH';
        const style = paymentModeStyles[mode] || paymentModeStyles['CASH'];

        // API returns populated admissionId with enquiryId
        const studentName = p.admissionId?.enquiryId?.name || 'Unknown';
        const mobile = p.admissionId?.enquiryId?.mobile || '';
        const course = p.admissionId?.enquiryId?.courseInterested || '-';

        return `
            <tr class="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${studentName}</div>
                    ${mobile ? `<div class="text-xs text-gray-500">${mobile}</div>` : ''}
                </td>
                <td class="px-6 py-4 text-gray-700">${course}</td>
                <td class="px-6 py-4 text-green-600 font-semibold">${formatCurrency(p.amount)}</td>
                <td class="px-6 py-4">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${style.bg} ${style.text}">
                        <span>${style.icon}</span>
                        ${mode}
                    </span>
                </td>
                <td class="px-6 py-4 text-gray-600">${formatDate(p.paymentDate || p.createdAt)}</td>
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
STATS (from Dashboard API)
====================== */
async function renderStatsFromDashboard() {
    try {
        const res = await apiGet(API_ENDPOINTS.DASHBOARD.GET);
        const data = res.data || res;

        // Use dashboard payment stats
        const paymentStats = data.payments || {};
        const totalPayments = paymentStats.totalPayments || 0;

        // Calculate total amount from all modes
        let totalAmount = 0;
        ['CASH', 'UPI', 'CARD', 'ONLINE', 'CHEQUE'].forEach(mode => {
            totalAmount += paymentStats[mode]?.amount || 0;
        });

        // Update stats display
        document.getElementById('totalPayments').textContent = totalPayments;
        document.getElementById('totalAmount').textContent = formatCurrency(totalAmount);

        document.getElementById('cashCount').textContent = paymentStats.CASH?.count || 0;
        document.getElementById('cashAmount').textContent = formatCurrency(paymentStats.CASH?.amount || 0);

        document.getElementById('upiCount').textContent = paymentStats.UPI?.count || 0;
        document.getElementById('upiAmount').textContent = formatCurrency(paymentStats.UPI?.amount || 0);

        document.getElementById('cardCount').textContent = paymentStats.CARD?.count || 0;
        document.getElementById('cardAmount').textContent = formatCurrency(paymentStats.CARD?.amount || 0);
    } catch (err) {
        console.error('Failed to load payment stats:', err);
    }
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
EXPORT
====================== */
window.changePage = changePage;
window.goToPage = goToPage;
window.goToLastPage = goToLastPage;
