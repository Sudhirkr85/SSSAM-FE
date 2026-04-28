let payments = [];

// Pagination state
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let totalPages = 1;

// Sorting state
let sortColumn = null;
let sortDirection = 'asc'; // 'asc' or 'desc'

// Date filter state
let currentFilter = 'currentMonth'; // 'today', '7days', 'currentMonth', 'all', 'month'
let selectedMonth = null; // For month filter: { year: 2026, month: 3 } (0-indexed)

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
    populateMonthDropdown();
    loadPayments();
    initSearchListener();
});

function initSearchListener() {
    let searchTimeout;
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentPage = 1;
            loadPayments(e.target.value);
        }, 300);
    });
}

/* ======================
DATE FILTER FUNCTIONS
====================== */
function populateMonthDropdown() {
    const select = document.getElementById('monthSelector');
    const now = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    for (let i = 0; i < 12; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = date.getFullYear();
        const month = date.getMonth();
        const value = `${year}-${String(month + 1).padStart(2, '0')}`;
        const label = `${monthNames[month]} ${year}`;

        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
    }
}

function getStartDateForFilter(filterType) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    switch (filterType) {
        case 'today':
            return now;
        case '7days':
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            return sevenDaysAgo;
        case 'currentMonth':
            return new Date(now.getFullYear(), now.getMonth(), 1);
        case 'month':
            if (selectedMonth) {
                return new Date(selectedMonth.year, selectedMonth.month, 1);
            }
            return null;
        case 'all':
        default:
            return null;
    }
}

function getEndDateForFilter(filterType) {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    switch (filterType) {
        case 'today':
            return now;
        case '7days':
            return now;
        case 'currentMonth':
            return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        case 'month':
            if (selectedMonth) {
                return new Date(selectedMonth.year, selectedMonth.month + 1, 0, 23, 59, 59, 999);
            }
            return null;
        case 'all':
        default:
            return null;
    }
}

function formatDateForAPI(date) {
    if (!date) return null;
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

function setFilter(filterType) {
    currentFilter = filterType;

    if (filterType === 'month') {
        const select = document.getElementById('monthSelector');
        const value = select.value;
        if (value) {
            const [year, month] = value.split('-').map(Number);
            selectedMonth = { year, month: month - 1 }; // Convert to 0-indexed
        } else {
            selectedMonth = null;
            currentFilter = 'currentMonth'; // Fallback to current month
        }
    } else {
        selectedMonth = null;
        document.getElementById('monthSelector').value = '';
    }

    updateFilterUI();
    currentPage = 1;
    loadPayments();
}

function updateFilterUI() {
    const buttons = ['today', '7days', 'currentMonth', 'all'];
    buttons.forEach(btn => {
        const el = document.getElementById(`filter-${btn}`);
        if (el) {
            if (btn === currentFilter) {
                el.className = 'px-4 py-2 text-sm rounded-lg bg-blue-600 text-white border border-blue-600 transition-colors';
            } else {
                el.className = 'px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors';
            }
        }
    });

    // Reset month selector if not using month filter
    if (currentFilter !== 'month') {
        document.getElementById('monthSelector').value = '';
    }
}

/* ======================
LOAD DATA
====================== */
async function loadPayments(search = '') {
    try {
        const params = {
            page: currentPage,
            limit: ITEMS_PER_PAGE
        };

        if (search) {
            params.search = search;
        }

        // Add date filter parameters
        const startDate = getStartDateForFilter(currentFilter);
        const endDate = getEndDateForFilter(currentFilter);

        if (startDate && endDate) {
            params.startDate = formatDateForAPI(startDate);
            params.endDate = formatDateForAPI(endDate);
        }

        // Use the correct endpoint: GET /api/payments with pagination
        const res = await apiGet(API_ENDPOINTS.PAYMENTS.GET_ALL, params);

        // Response: { payments: [...], pagination: {...} }
        payments = res.payments || [];
        const pagination = res.pagination || { page: 1, totalPages: 1, totalCount: 0 };
        totalPages = pagination.totalPages || 1;

        // Fetch admission details for each payment to get student/course data
        await enrichPaymentsWithAdmissionData();

        renderTable();
        renderStatsFromDashboard(); // Get stats from dashboard API
        updatePaginationInfoFromServer(pagination);
    } catch (err) {
        showToast('error', 'Failed to load payments');
        renderEmptyState();
    }
}

async function enrichPaymentsWithAdmissionData() {
    // Get unique admission IDs from payments
    const admissionIds = [...new Set(payments.map(p => p.admissionId).filter(id => id))];

    // Fetch each admission
    for (const admId of admissionIds) {
        try {
            const admRes = await apiGet(API_ENDPOINTS.ADMISSIONS.GET_BY_ID(admId));
            // Handle nested response structure: { data: { admission: { admission: {...} } } }
            const admissionWrapper = admRes.data?.admission || admRes.data || admRes;
            const admission = admissionWrapper.admission || admissionWrapper;
            // Store on the payment object for easy access
            payments.forEach(p => {
                if (p.admissionId === admId) {
                    p._admissionData = admission;
                }
            });
        } catch (err) {
            // If admission not found, mark payment as invalid
            payments.forEach(p => {
                if (p.admissionId === admId) {
                    p._admissionData = null;
                }
            });
        }
    }
}

/* ======================
RENDER TABLE
====================== */
function renderTable() {
    const table = document.getElementById('paymentTable');

    // Filter out payments with invalid/missing admission data
    const validPayments = payments.filter(p => p._admissionData !== null);

    if (!validPayments.length) {
        renderEmptyState();
        return;
    }

    // Apply sorting if a column is selected
    let sortedPayments = [...validPayments];
    if (sortColumn) {
        sortedPayments.sort((a, b) => {
            let valueA, valueB;

            switch (sortColumn) {
                case 'student':
                    const admissionA = a._admissionData;
                    const admissionB = b._admissionData;
                    valueA = (admissionA?.enquiryId?.name || 'Unknown').toLowerCase();
                    valueB = (admissionB?.enquiryId?.name || 'Unknown').toLowerCase();
                    break;
                case 'course':
                    valueA = (a._admissionData?.enquiryId?.courseInterested || a._admissionData?.course || '-').toLowerCase();
                    valueB = (b._admissionData?.enquiryId?.courseInterested || b._admissionData?.course || '-').toLowerCase();
                    break;
                case 'amount':
                    valueA = a.amount || 0;
                    valueB = b.amount || 0;
                    break;
                case 'mode':
                    valueA = a.paymentMode || '';
                    valueB = b.paymentMode || '';
                    break;
                case 'date':
                    valueA = new Date(a.paymentDate || a.createdAt);
                    valueB = new Date(b.paymentDate || b.createdAt);
                    break;
                default:
                    return 0;
            }

            if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
            if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    table.innerHTML = sortedPayments.map(p => {
        const mode = p.paymentMode || 'CASH';
        const style = paymentModeStyles[mode] || paymentModeStyles['CASH'];

        // Get admission data from enriched payment
        const admission = p._admissionData;
        const enquiry = admission?.enquiryId || {};

        const studentName = enquiry.name || 'Unknown';
        const mobile = enquiry.mobile || '';
        const course = enquiry.courseInterested || admission?.course || '-';

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

    // Update sort icons
    updateSortIcons();
}

function sortTable(column) {
    if (sortColumn === column) {
        // Toggle direction if same column
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // New column, default to ascending
        sortColumn = column;
        sortDirection = 'asc';
    }
    renderTable();
}

function updateSortIcons() {
    const headers = document.querySelectorAll('th[onclick]');
    headers.forEach(th => {
        const icon = th.querySelector('i');
        if (icon) {
            const column = th.getAttribute('onclick').match(/'([^']+)'/)[1];
            if (column === sortColumn) {
                icon.setAttribute('data-lucide', sortDirection === 'asc' ? 'chevron-up' : 'chevron-down');
                icon.classList.remove('text-gray-400');
                icon.classList.add('text-blue-600');
            } else {
                icon.setAttribute('data-lucide', 'chevrons-up-down');
                icon.classList.remove('text-blue-600');
                icon.classList.add('text-gray-400');
            }
        }
    });
    lucide.createIcons();
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
STATS (from Payments API)
====================== */
async function renderStatsFromDashboard() {
    try {
        // Calculate stats from the loaded payments data instead of dashboard API
        const totalPayments = payments.length;
        
        // Calculate totals by payment mode
        const modeStats = {
            'CASH': { count: 0, amount: 0 },
            'UPI': { count: 0, amount: 0 },
            'CARD': { count: 0, amount: 0 },
            'ONLINE': { count: 0, amount: 0 },
            'CHEQUE': { count: 0, amount: 0 }
        };
        
        let totalAmount = 0;
        
        payments.forEach(p => {
            const mode = p.paymentMode || 'CASH';
            const amount = p.amount || 0;
            
            if (modeStats[mode]) {
                modeStats[mode].count++;
                modeStats[mode].amount += amount;
            }
            totalAmount += amount;
        });

        // Update stats display
        document.getElementById('totalPayments').textContent = totalPayments;
        document.getElementById('totalAmount').textContent = formatCurrency(totalAmount);

        document.getElementById('cashCount').textContent = modeStats.CASH.count;
        document.getElementById('cashAmount').textContent = formatCurrency(modeStats.CASH.amount);

        document.getElementById('upiCount').textContent = modeStats.UPI.count;
        document.getElementById('upiAmount').textContent = formatCurrency(modeStats.UPI.amount);

        document.getElementById('cardCount').textContent = modeStats.CARD.count;
        document.getElementById('cardAmount').textContent = formatCurrency(modeStats.CARD.amount);
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
window.setFilter = setFilter;
