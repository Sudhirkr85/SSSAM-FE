/**
 * SSSAM CRM - Admissions Module
 * Indian Institute Style - Production Ready
 */

// ==================== STATE ====================
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let totalPages = 1;
let totalCount = 0;
let admissions = [];
let enquiries = [];
let selectedEnquiryId = null;
let currentAdmissionId = null;
let installmentRows = [];
let admissionInstallmentRows = []; // For add admission modal

// Sorting state
let sortColumn = null;
let sortDirection = 'asc'; // 'asc' or 'desc'

// Date filter state
let currentAdmissionFilter = 'thisMonth';
let currentStatusFilter = 'ALL';
let currentAdmission = null;
let duesFilterActive = false;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initUserInfo();
  initEventListeners();
  setAdmissionDateFilter('thisMonth');
});

function initUserInfo() {
  const user = safeParseLocalStorage('user', {});
  const nameEl = document.getElementById('userName');
  const roleEl = document.getElementById('userRole');
  if (nameEl) nameEl.textContent = user.name || 'User';
  if (roleEl) roleEl.textContent = user.role === 'admin' ? 'Administrator' : 'Counselor';
}

function initEventListeners() {
  // Search debounce
  let searchTimeout;
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      const filters = getActiveFilters();
      loadAdmissions(e.target.value, filters);
    }, 300);
  });

  // Registration amount validation
  document.getElementById('registrationAmountInput')?.addEventListener('input', (e) => {
    const total = parseInt(document.getElementById('totalFeesInput')?.value) || 0;
    const reg = parseInt(e.target.value) || 0;
    const errorEl = document.getElementById('registrationAmountError');
    
    if (reg > total) {
      errorEl.textContent = 'Registration amount cannot exceed total fees';
      errorEl.classList.remove('hidden');
      e.target.classList.add('border-red-500');
    } else {
      errorEl.classList.add('hidden');
      e.target.classList.remove('border-red-500');
    }
  });

  // Total fees validation
  document.getElementById('totalFeesInput')?.addEventListener('input', (e) => {
    const total = parseInt(e.target.value) || 0;
    if (total > 0) {
      e.target.classList.remove('border-red-500');
      document.getElementById('totalFeesError')?.classList.add('hidden');
    }
  });

  }

// ==================== DATE & STATUS FILTER LOGIC ====================
function getDateRangeForFilter(filterType) {
  const today = new Date();
  const startDate = new Date();
  const endDate = new Date();

  switch (filterType) {
    case 'thisMonth':
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'thisYear':
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'allTime':
      startDate.setFullYear(2020, 0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    default:
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
  }

  // Format dates as YYYY-MM-DD in local timezone (not UTC)
  const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    dateFrom: formatDateLocal(startDate),
    dateTo: formatDateLocal(endDate)
  };
}

function setAdmissionDateFilter(filterType) {
  currentAdmissionFilter = filterType;

  // Update tab styles
  document.querySelectorAll('.admission-filter-tab').forEach(tab => {
    if (tab.dataset.filter === filterType) {
      tab.classList.remove('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
      tab.classList.add('bg-blue-600', 'text-white');
    } else {
      tab.classList.remove('bg-blue-600', 'text-white');
      tab.classList.add('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
    }
  });

  // Reload admissions with new filter
  currentPage = 1;
  const filters = getActiveFilters();
  loadAdmissions(document.getElementById('searchInput')?.value || '', filters);
}

function setAdmissionStatusFilter(status) {
  currentStatusFilter = status;

  // Update status tab styles
  document.querySelectorAll('.admission-status-tab').forEach(tab => {
    if ((tab.dataset.status || '').toLowerCase() === (status || '').toLowerCase()) {
      tab.classList.remove('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
      tab.classList.add('bg-blue-600', 'text-white');
    } else {
      tab.classList.remove('bg-blue-600', 'text-white');
      tab.classList.add('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
    }
  });

  // Reload admissions with new status filter
  currentPage = 1;
  const filters = getActiveFilters();
  loadAdmissions(document.getElementById('searchInput')?.value || '', filters);
}
window.setAdmissionStatusFilter = setAdmissionStatusFilter;

function getActiveFilters() {
  const filters = {};
  
  // Add date range filters
  const dateRange = getDateRangeForFilter(currentAdmissionFilter);
  filters.dateFrom = dateRange.dateFrom;
  filters.dateTo = dateRange.dateTo;
  
  // Add status filter
  if (currentStatusFilter && currentStatusFilter.toUpperCase() !== 'ALL') {
    filters.status = currentStatusFilter.toLowerCase();
  }
  
  const courseFilter = document.getElementById('courseFilter')?.value?.trim();
  if (courseFilter) {
    filters.course = courseFilter;
  }
  
  // Pending dues filter
  if (duesFilterActive) {
    filters.hasDues = 'true';
  }
  
  const sortBy = document.getElementById('sortBy')?.value;
  if (sortBy) {
    filters.sortBy = sortBy;
  }
  
  return filters;
}

function toggleDuesFilter() {
  duesFilterActive = !duesFilterActive;
  
  const btn = document.getElementById('duesFilterBtn');
  if (btn) {
    if (duesFilterActive) {
      btn.classList.remove('bg-gray-100', 'text-gray-700', 'border-gray-200', 'hover:bg-gray-200');
      btn.classList.add('bg-amber-600', 'text-white', 'border-amber-600', 'hover:bg-amber-700', 'shadow-md', 'shadow-amber-600/20');
      btn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> Pending Dues & Upcoming Sort: ON`;
      
      // Auto-set sorting state to nextDue asc
      sortColumn = 'nextDue';
      sortDirection = 'asc';
    } else {
      btn.classList.remove('bg-amber-600', 'text-white', 'border-amber-600', 'hover:bg-amber-700', 'shadow-md', 'shadow-amber-600/20');
      btn.classList.add('bg-gray-100', 'text-gray-700', 'border-gray-200', 'hover:bg-gray-200');
      btn.innerHTML = `<i data-lucide="filter" class="w-4 h-4"></i> Filter: Pending Dues & Upcoming Sort`;
      
      // Reset sorting state
      sortColumn = null;
      sortDirection = 'asc';
    }
    
    // Refresh icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  // Reload admissions
  currentPage = 1;
  const filters = getActiveFilters();
  loadAdmissions(document.getElementById('searchInput')?.value || '', filters);
}

// Expose globally
window.toggleDuesFilter = toggleDuesFilter;

// ==================== API CALLS ====================
async function loadAdmissions(search = '', filters = {}) {
  try {
    const params = {
      page: currentPage,
      limit: ITEMS_PER_PAGE,
      ...filters
    };

    if (search) {
      params.search = search;
    }

    // Send sort params to backend (backend must support these for cross-page sorting)
    if (sortColumn) {
      params.sortBy = sortColumn === 'student' ? 'name' : sortColumn;
      params.sortOrder = sortDirection;
    }

    const response = await apiGet(API_ENDPOINTS.ADMISSIONS.LIST, params);
    console.log('=== DEBUG: Admissions API response:', response);
    
    // Handle different response structures
    admissions = response.data || response.admissions || [];
    console.log('=== DEBUG: Admissions array length:', admissions.length);
    console.log('=== DEBUG: First admission:', admissions[0]);
    const pagination = response.pagination || {};
    totalPages = pagination.totalPages || 1;
    totalCount = pagination.totalCount || 0;

    console.log('=== DEBUG: Calling render functions ===');
    renderTable();
    renderMobileCards();
    updatePagination();
  } catch (err) {
    console.error('Failed to load admissions:', err);
    showToast('Error', 'Failed to load admissions', 'error');
    renderEmptyState();
  }
}

async function loadEnquiriesForModal() {
  try {
    const response = await apiGet(API_ENDPOINTS.ENQUIRIES.LIST, { page: 1, limit: 100 });
    enquiries = response.data || response.enquiries || [];
    renderEnquiryDropdown('');
  } catch (err) {
    console.error('Failed to load enquiries for modal:', err);
  }
}

// Expose globally
window.loadEnquiriesForModal = loadEnquiriesForModal;

// ==================== RENDER FUNCTIONS ====================
function renderTable() {
  const table = document.getElementById('admissionTable');
  
  if (!admissions.length) {
    renderEmptyState();
    return;
  }

  document.getElementById('emptyState')?.classList.add('hidden');

  // Apply sorting if a column is selected
  let sortedAdmissions = [...admissions];
  if (sortColumn) {
    sortedAdmissions.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortColumn) {
        case 'student':
          valueA = (a.name || 'Unknown').toLowerCase();
          valueB = (b.name || 'Unknown').toLowerCase();
          break;
        case 'totalFees':
          valueA = a.totalFees || 0;
          valueB = b.totalFees || 0;
          break;
        case 'paid':
          const remainingA = a.remainingAmount ?? ((a.totalFees || 0) - (a.paidAmount || 0));
          const remainingB = b.remainingAmount ?? ((b.totalFees || 0) - (b.paidAmount || 0));
          valueA = (a.totalFees || 0) - remainingA;
          valueB = (b.totalFees || 0) - remainingB;
          break;
        case 'remaining':
          valueA = a.remainingAmount ?? ((a.totalFees || 0) - (a.paidAmount || 0));
          valueB = b.remainingAmount ?? ((b.totalFees || 0) - (b.paidAmount || 0));
          break;
        case 'type':
          valueA = a.paymentType || '';
          valueB = b.paymentType || '';
          break;
        case 'nextDue':
          const nextA = calculateNextDue(a);
          const nextB = calculateNextDue(b);
          valueA = nextA.date ? new Date(nextA.date).getTime() : Infinity;
          valueB = nextB.date ? new Date(nextB.date).getTime() : Infinity;
          break;
        default:
          return 0;
      }
      
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  table.innerHTML = sortedAdmissions.map(admission => {
    const name = admission.name || 'Unknown';
    const mobile = admission.mobile || '';
    const course = admission.course || '-';
    const statusLower = (admission.status || 'active').toLowerCase();
    const isDropped = statusLower === 'dropped';
    const isCancelled = statusLower === 'cancelled';
    const totalFees = admission.totalFees || 0;
    // Backend sends remainingAmount, calculate paid from it
    const remaining = isDropped ? 0 : (admission.remainingAmount ?? (totalFees - (admission.paidAmount || 0)));
    const paidAmount = totalFees - (admission.remainingAmount ?? (totalFees - (admission.paidAmount || 0)));
    const paymentType = admission.paymentType || 'ONE_TIME';
    const nextDue = calculateNextDue(admission);

    // Status Badge HTML
    let statusBadgeHtml = '';
    if (isDropped) {
      statusBadgeHtml = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 text-red-700 border border-red-200"><i data-lucide="user-x" class="w-3.5 h-3.5"></i> Dropped</span>';
    } else if (isCancelled) {
      statusBadgeHtml = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200"><i data-lucide="x-circle" class="w-3.5 h-3.5"></i> Cancelled</span>';
    } else {
      statusBadgeHtml = '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200"><i data-lucide="check-circle" class="w-3.5 h-3.5 text-teal-600"></i> Active</span>';
    }

    return `
      <tr class="finance-row border-b border-gray-50 last:border-0 cursor-pointer hover:bg-indigo-50/50 transition-colors ${isDropped ? 'bg-red-50/20' : ''}" onclick="window.location.href='admission-detail.html?id=${admission._id}'">
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 ${isDropped ? 'bg-red-100' : 'bg-blue-100'} rounded-xl flex items-center justify-center flex-shrink-0">
              <i data-lucide="${isDropped ? 'user-x' : 'user'}" class="w-5 h-5 ${isDropped ? 'text-red-600' : 'text-blue-600'}"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-800 ${isDropped ? 'line-through text-gray-500' : ''}">${escapeHtml(name)}</span>
              </div>
              <div class="text-xs text-gray-500">${mobile}</div>
              <div class="text-xs text-blue-600">${escapeHtml(course)}</div>
            </div>
          </div>
        </td>
        <td class="px-4 py-4 text-center">
          ${statusBadgeHtml}
        </td>
        <td class="px-6 py-4 text-right font-medium text-gray-800">${formatCurrency(totalFees)}</td>
        <td class="px-6 py-4 text-right font-medium text-green-600">${formatCurrency(paidAmount)}</td>
        <td class="px-6 py-4 text-right font-medium ${isDropped ? 'text-gray-400' : remaining > 0 ? 'text-red-600' : 'text-gray-400'}">${isDropped ? '<span class="text-xs italic text-gray-400">Dropped</span>' : remaining > 0 ? formatCurrency(remaining) : 'Paid'}</td>
        <td class="px-6 py-4 text-center">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${getPaymentTypeBadgeClass(paymentType)}">
            ${getPaymentTypeIcon(paymentType)}
            ${paymentType === 'ONE_TIME' ? 'One Time' : 'Installment'}
          </span>
        </td>
        <td class="px-6 py-4 text-center">
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${nextDue.isOverdue ? 'bg-red-100 text-red-700' : nextDue.isUpcoming ? 'bg-amber-100 text-amber-700' : nextDue.text === 'Paid' ? 'bg-green-100 text-green-700' : nextDue.text === 'Dropped' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-600'}">
            ${nextDue.isOverdue ? '<i data-lucide="alert-circle" class="w-3 h-3"></i>' : nextDue.isUpcoming ? '<i data-lucide="clock" class="w-3 h-3"></i>' : ''}
            ${nextDue.text}
          </span>
        </td>
        <td class="px-6 py-4" onclick="event.stopPropagation();">
          <div class="flex items-center justify-center gap-2">
            <a href="admission-detail.html?id=${admission._id}" onclick="event.stopPropagation();" class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View Detail">
              <i data-lucide="eye" class="w-4 h-4"></i>
            </a>
            ${!isDropped ? `
            <button onclick="event.stopPropagation(); openPaymentPlanModal('${admission._id}')" class="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit Installment Plan">
              <i data-lucide="calendar" class="w-4 h-4"></i>
            </button>
            <button onclick="event.stopPropagation(); openPaymentModal('${admission._id}')" class="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Add Payment">
              <i data-lucide="plus-circle" class="w-4 h-4"></i>
            </button>
            ` : ''}
            <button onclick="event.stopPropagation(); openViewPaymentsModal('${admission._id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Payments">
              <i data-lucide="receipt" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

function renderMobileCards() {
  const container = document.getElementById('mobileCards');
  
  if (!admissions.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = admissions.map(admission => {
    const name = admission.name || 'Unknown';
    const mobile = admission.mobile || '';
    const course = admission.course || '-';
    const totalFees = admission.totalFees || 0;
    const statusLower = (admission.status || 'active').toLowerCase();
    const isDropped = statusLower === 'dropped';
    const isCancelled = statusLower === 'cancelled';
    const remaining = isDropped ? 0 : (admission.remainingAmount ?? (totalFees - (admission.paidAmount || 0)));
    const paidAmount = totalFees - (admission.remainingAmount ?? (totalFees - (admission.paidAmount || 0)));
    const paymentType = admission.paymentType || 'ONE_TIME';
    const nextDue = calculateNextDue(admission);

    return `
      <div class="bg-white rounded-xl shadow-sm p-4 space-y-3 cursor-pointer hover:shadow-md transition-all ${isDropped ? 'border-l-4 border-red-500 bg-red-50/10' : ''}" onclick="window.location.href='admission-detail.html?id=${admission._id}'">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 ${isDropped ? 'bg-red-100' : 'bg-blue-100'} rounded-xl flex items-center justify-center">
              <i data-lucide="${isDropped ? 'user-x' : 'user'}" class="w-5 h-5 ${isDropped ? 'text-red-600' : 'text-blue-600'}"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-800 ${isDropped ? 'line-through text-gray-500' : ''}">${escapeHtml(name)}</span>
                ${isDropped ? '<span class="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-700 border border-red-200 rounded font-bold">Dropped</span>' : isCancelled ? '<span class="px-1.5 py-0.5 text-[10px] bg-gray-100 text-gray-700 rounded font-bold">Cancelled</span>' : '<span class="px-1.5 py-0.5 text-[10px] bg-teal-50 text-teal-700 border border-teal-200 rounded font-bold">Active</span>'}
              </div>
              <div class="text-xs text-gray-500">${mobile}</div>
            </div>
          </div>
          <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${getPaymentTypeBadgeClass(paymentType)}">
            ${paymentType === 'ONE_TIME' ? 'One Time' : 'Installment'}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="bg-gray-50 rounded-lg p-2">
            <div class="text-xs text-gray-500">Total</div>
            <div class="font-medium text-sm">${formatCurrency(totalFees)}</div>
          </div>
          <div class="bg-green-50 rounded-lg p-2">
            <div class="text-xs text-green-600">Paid</div>
            <div class="font-medium text-sm text-green-700">${formatCurrency(paidAmount)}</div>
          </div>
          <div class="bg-blue-50 rounded-lg p-2">
            <div class="text-xs text-blue-600">Remaining</div>
            <div class="font-medium text-sm text-blue-700">${isDropped ? '<span class="text-xs italic text-gray-400">Dropped</span>' : remaining > 0 ? formatCurrency(remaining) : 'Paid'}</div>
          </div>
        </div>

        <div class="flex items-center justify-between text-xs pt-1 border-t border-dashed border-gray-100">
          <span class="text-gray-500 font-medium flex items-center gap-1">
            <i data-lucide="calendar" class="w-3.5 h-3.5 text-amber-600"></i> Next Due Date:
          </span>
          <span class="font-semibold ${nextDue.isOverdue ? 'bg-red-100 text-red-700 px-2 py-0.5 rounded-md border border-red-200' : nextDue.isUpcoming ? 'bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200' : nextDue.text === 'Paid' ? 'bg-green-100 text-green-700 px-2 py-0.5 rounded-md' : nextDue.text === 'Dropped' ? 'bg-red-50 text-red-600 px-2 py-0.5 rounded-md' : 'bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md'}">
            ${nextDue.isOverdue ? '<i data-lucide="alert-circle" class="w-3 h-3 inline mr-1"></i>' : ''}${nextDue.text}
          </span>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-gray-100" onclick="event.stopPropagation();">
          <div class="text-sm text-gray-600">${escapeHtml(course)}</div>
          <div class="flex items-center gap-1">
            <a href="admission-detail.html?id=${admission._id}" onclick="event.stopPropagation();" class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View Detail">
              <i data-lucide="eye" class="w-4 h-4"></i>
            </a>
            ${!isDropped ? `
            <button onclick="event.stopPropagation(); openPaymentPlanModal('${admission._id}')" class="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit Installment Plan">
              <i data-lucide="calendar" class="w-4 h-4"></i>
            </button>
            <button onclick="event.stopPropagation(); openPaymentModal('${admission._id}')" class="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Add Payment">
              <i data-lucide="plus-circle" class="w-4 h-4"></i>
            </button>
            ` : ''}
            <button onclick="event.stopPropagation(); openViewPaymentsModal('${admission._id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Payments">
              <i data-lucide="receipt" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
  
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
  currentPage = 1;
  const search = document.getElementById('searchInput')?.value || '';
  const filters = getActiveFilters();
  loadAdmissions(search, filters);
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
  document.getElementById('admissionTable').innerHTML = `
    <tr>
      <td colspan="8" class="text-center py-12">
        <div class="flex flex-col items-center gap-3">
          <div class="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
            <i data-lucide="inbox" class="w-6 h-6 text-gray-400"></i>
          </div>
          <p class="text-gray-500">No admissions found</p>
        </div>
      </td>
    </tr>
  `;
  document.getElementById('emptyState')?.classList.remove('hidden');
  document.getElementById('mobileCards').innerHTML = '';
  lucide.createIcons();
}

function updatePagination() {
  const from = totalCount === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const to = Math.min(currentPage * ITEMS_PER_PAGE, totalCount);
  
  document.getElementById('showingFrom').textContent = from;
  document.getElementById('showingTo').textContent = to;
  document.getElementById('totalItems').textContent = totalCount;

  document.getElementById('firstPage').disabled = currentPage === 1;
  document.getElementById('prevPage').disabled = currentPage === 1;
  document.getElementById('nextPage').disabled = currentPage === totalPages;
  document.getElementById('lastPage').disabled = currentPage === totalPages;

  // Page numbers
  const pageNumbers = document.getElementById('pageNumbers');
  let html = '';
  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage) {
      html += `<span class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-medium">${i}</span>`;
    } else if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      html += `<button onclick="goToPage(${i})" class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">${i}</button>`;
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      html += `<span class="px-2 text-gray-400">...</span>`;
    }
  }
  pageNumbers.innerHTML = html;
}

// ==================== HELPER FUNCTIONS ====================
function formatCurrency(amount) {
  if (!amount || amount === 0) return '₹0';
  return '₹' + amount.toLocaleString('en-IN');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getPaymentTypeBadgeClass(type) {
  return type === 'ONE_TIME' ? 'badge-onetime' : 'badge-installment';
}

function getPaymentTypeIcon(type) {
  return type === 'ONE_TIME'
    ? '<i data-lucide="check-circle" class="w-3.5 h-3.5"></i>'
    : '<i data-lucide="calendar" class="w-3.5 h-3.5"></i>';
}

// ==================== DATE & INSTALLMENT HELPERS ====================
function formatDateDisplay(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function calculateNextDue(admission) {
  const statusLower = (admission.status || '').toLowerCase();
  if (statusLower === 'dropped') {
    return { text: 'Dropped', date: null, isOverdue: false, isUpcoming: false, amount: 0 };
  }

  const totalFees = admission.totalFees || 0;
  const remaining = admission.remainingAmount ?? (totalFees - (admission.paidAmount || 0));

  if (remaining <= 0) {
    return { text: 'Paid', date: null, isOverdue: false, isUpcoming: false, amount: 0 };
  }

  // One time payment with no installments
  if (admission.paymentType === 'ONE_TIME') {
    return {
      text: admission.fullPaymentDueDate ? formatDateDisplay(admission.fullPaymentDueDate) : '-',
      date: admission.fullPaymentDueDate || null,
      isOverdue: false,
      isUpcoming: false,
      amount: remaining
    };
  }

  const installments = admission.installments || [];
  if (installments.length === 0) {
    return { text: '-', date: null, isOverdue: false, isUpcoming: false, amount: remaining };
  }

  const paidAmount = totalFees - remaining;
  let cumulativeAmount = admission.registrationAmount || 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const inst of installments) {
    cumulativeAmount += inst.amount;
    if (paidAmount < cumulativeAmount) {
      const dueDate = new Date(inst.dueDate);
      const isOverdue = dueDate < today;
      const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      const isUpcoming = !isOverdue && daysUntil <= 7;
      return {
        text: formatDateDisplay(inst.dueDate),
        date: inst.dueDate,
        isOverdue,
        isUpcoming,
        amount: inst.amount
      };
    }
  }

  return { text: 'On Demand', date: null, isOverdue: false, isUpcoming: false, amount: remaining };
}

// ==================== FILTER HELPER FUNCTIONS ====================

function applyFilters() {
  currentPage = 1;
  const search = document.getElementById('searchInput')?.value || '';
  const filters = getActiveFilters();
  loadAdmissions(search, filters);
}

// ==================== PAGINATION CONTROLS ====================
function changePage(delta) {
  const newPage = currentPage + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    const search = document.getElementById('searchInput')?.value || '';
    const filters = getActiveFilters();
    loadAdmissions(search, filters);
  }
}

function goToPage(page) {
  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    const search = document.getElementById('searchInput')?.value || '';
    const filters = getActiveFilters();
    loadAdmissions(search, filters);
  }
}

function goToLastPage() {
  currentPage = totalPages;
  const search = document.getElementById('searchInput')?.value || '';
  const filters = getActiveFilters();
  loadAdmissions(search, filters);
}

// ==================== ADD ADMISSION MODAL ====================
function openAddModal() {
  const getEl = (id) => document.getElementById(id);
  const safeSetVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

  // Reset form safely
  safeSetVal('directStudentName', '');
  safeSetVal('directStudentMobile', '');
  safeSetVal('courseInput', '');
  safeSetVal('totalFeesInput', '');
  safeSetVal('registrationAmountInput', '');

  const oneTimeRadio = document.querySelector('input[name="paymentType"][value="ONE_TIME"]');
  if (oneTimeRadio) oneTimeRadio.checked = true;

  // Set default payment date to today
  safeSetVal('paymentDateInput', new Date().toISOString().split('T')[0]);
  safeSetVal('initialPaymentInput', '');
  safeSetVal('paymentModeInput', 'CASH');

  // Reset installments
  admissionInstallmentRows = [{ amount: '', dueDate: '' }];
  if (typeof renderAdmissionInstallmentRows === 'function') {
    try { renderAdmissionInstallmentRows(); } catch (_) {}
  }
  getEl('installmentsSection')?.classList.add('hidden');

  // Clear errors
  clearAddErrors();

  // Show modal safely
  const modal = getEl('addModal');
  const content = getEl('addModalContent');

  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
      modal.classList.remove('opacity-0');
      if (content) {
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
      }
    }, 10);
  }

  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

window.openAddModal = openAddModal;
window.openAdmissionModal = openAddModal;

function closeAddModal() {
  const modal = document.getElementById('addModal');
  const content = document.getElementById('addModalContent');
  
  modal.classList.add('opacity-0');
  content.classList.remove('scale-100');
  content.classList.add('scale-95');
  
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.getElementById('enquiryDropdown')?.classList.add('hidden');
  }, 200);
}

let currentAdmissionMode = 'enquiry'; // 'enquiry' or 'direct'

function switchAdmissionMode(mode) {
  currentAdmissionMode = mode;
  const tabEnquiry = document.getElementById('tabSelectEnquiry');
  const tabDirect = document.getElementById('tabDirectWalkIn');
  const sectionEnquiry = document.getElementById('enquirySelectSection');
  const sectionDirect = document.getElementById('directWalkInSection');

  if (mode === 'direct') {
    if (tabEnquiry) tabEnquiry.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all text-gray-500 hover:text-gray-800';
    if (tabDirect) tabDirect.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all bg-white text-gray-800 shadow-sm';
    if (sectionEnquiry) sectionEnquiry.classList.add('hidden');
    if (sectionDirect) sectionDirect.classList.remove('hidden');
  } else {
    if (tabEnquiry) tabEnquiry.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all bg-white text-gray-800 shadow-sm';
    if (tabDirect) tabDirect.className = 'flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all text-gray-500 hover:text-gray-800';
    if (sectionEnquiry) sectionEnquiry.classList.remove('hidden');
    if (sectionDirect) sectionDirect.classList.add('hidden');
  }
}

window.switchAdmissionMode = switchAdmissionMode;

function clearAddErrors() {
  ['enquiry', 'course', 'totalFees', 'registrationAmount', 'paymentDate', 'initialPayment', 'paymentMode', 'directName', 'directMobile'].forEach(id => {
    document.getElementById(`${id}Error`)?.classList.add('hidden');
    document.getElementById(`${id}Input`)?.classList.remove('border-red-500');
  });
  document.getElementById('installmentsError')?.classList.add('hidden');
}

function toggleEnquiryDropdown() {
  const dropdown = document.getElementById('enquiryDropdown');
  dropdown.classList.toggle('hidden');
  if (!dropdown.classList.contains('hidden')) {
    document.getElementById('enquirySearch')?.focus();
  }
}

function filterEnquiries(search) {
  renderEnquiryDropdown(search);
}

function renderEnquiryDropdown(search = '') {
  const list = document.getElementById('enquiryList') || document.getElementById('enquiryOptionsList');
  if (!list) return;
  
  const filtered = search 
    ? enquiries.filter(e => 
        e.name?.toLowerCase().includes(search.toLowerCase()) ||
        e.mobile?.includes(search)
      )
    : enquiries;
  
  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="p-4 text-center text-gray-500 text-sm">
        No enquiries found
      </div>
    `;
    return;
  }
  
  list.innerHTML = filtered.map(e => {
    const isSelected = selectedEnquiryId === e._id;
    const courseName = e.course || e.courseInterested || '';
    return `
      <div 
        class="enquiry-option p-3 cursor-pointer ${isSelected ? 'selected' : ''} hover:bg-gray-50 flex items-center justify-between"
        onclick="selectEnquiry('${e._id}', '${escapeHtml(e.name)}', '${e.mobile || ''}', '${escapeHtml(courseName)}')"
      >
        <div>
          <div class="font-medium text-gray-800 text-sm">${escapeHtml(e.name)}</div>
          <div class="text-xs text-gray-500">📱 ${e.mobile || 'No mobile'}</div>
        </div>
        ${courseName ? `<span class="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">${escapeHtml(courseName)}</span>` : ''}
      </div>
    `;
  }).join('');
}

function selectEnquiry(id, name, mobile, courseParam = '') {
  selectedEnquiryId = id;
  const selInput = document.getElementById('selectedEnquiryId');
  if (selInput) selInput.value = id;
  
  const displayText = mobile ? `${name} (${mobile})` : name;
  const textEl = document.getElementById('enquirySelectText');
  if (textEl) {
    textEl.textContent = displayText;
    textEl.classList.remove('text-gray-500');
    textEl.classList.add('text-gray-800');
  }
  
  document.getElementById('enquiryDropdown')?.classList.add('hidden');
  document.getElementById('enquiryError')?.classList.add('hidden');
  
  // Auto-fill course if available
  const enquiry = enquiries.find(e => e._id === id);
  const matchedCourse = courseParam || enquiry?.course || enquiry?.courseInterested || '';
  const courseInp = document.getElementById('courseInput');
  if (matchedCourse && courseInp) {
    courseInp.value = matchedCourse;
  }
}

function calcRemainingAdmissionAmount() {
  const totalFees = parseInt(document.getElementById('totalFeesInput')?.value) || 0;
  const initialPayment = parseInt(document.getElementById('registrationAmountInput')?.value) || 0;
  const remaining = Math.max(0, totalFees - initialPayment);

  const displayEl = document.getElementById('remainingAmountDisplay');
  if (displayEl) {
    displayEl.textContent = `₹${remaining.toLocaleString('en-IN')}`;
  }

  const paymentType = document.getElementById('paymentTypeSelect')?.value || 'ONE_TIME';
  const pendingSection = document.getElementById('pendingAmountSection');
  const pendingAmountInput = document.getElementById('pendingAmount');

  if (paymentType === 'ONE_TIME') {
    if (remaining > 0) {
      pendingSection?.classList.remove('hidden');
      if (pendingAmountInput) pendingAmountInput.value = remaining;
    } else {
      pendingSection?.classList.add('hidden');
    }
  } else {
    pendingSection?.classList.add('hidden');
  }

  validateAdmissionInstallmentTotals();
}

function onAdmissionPaymentTypeChange(type) {
  const installmentsSection = document.getElementById('installmentsSection');
  const pendingSection = document.getElementById('pendingAmountSection');

  if (type === 'INSTALLMENT') {
    pendingSection?.classList.add('hidden');
    installmentsSection?.classList.remove('hidden');
    if (!admissionInstallmentRows || admissionInstallmentRows.length === 0) {
      admissionInstallmentRows = [{ amount: '', dueDate: '' }];
    }
    renderAdmissionInstallmentRows();
  } else {
    installmentsSection?.classList.add('hidden');
    calcRemainingAdmissionAmount();
  }
  if (window.lucide) lucide.createIcons();
}

function validateAdmissionInstallmentTotals() {
  const paymentType = document.getElementById('paymentTypeSelect')?.value || 'ONE_TIME';
  if (paymentType !== 'INSTALLMENT') return;

  const totalFees = parseInt(document.getElementById('totalFeesInput')?.value) || 0;
  const initialPayment = parseInt(document.getElementById('registrationAmountInput')?.value) || 0;
  const remaining = Math.max(0, totalFees - initialPayment);

  const instTotal = admissionInstallmentRows.reduce((sum, r) => sum + (parseInt(r.amount) || 0), 0);
  const errEl = document.getElementById('installmentsTotalError');

  if (errEl) {
    if (instTotal !== remaining) {
      const diff = Math.abs(remaining - instTotal);
      const isLess = instTotal < remaining;
      errEl.textContent = `Installments total (₹${instTotal.toLocaleString('en-IN')}) is ₹${diff.toLocaleString('en-IN')} ${isLess ? 'less' : 'more'} than remaining amount (₹${remaining.toLocaleString('en-IN')}). Please add installments to cover the full remaining amount.`;
      errEl.classList.remove('hidden');
    } else {
      errEl.classList.add('hidden');
    }
  }
}

// Expose globally
window.calcRemainingAdmissionAmount = calcRemainingAdmissionAmount;
window.onAdmissionPaymentTypeChange = onAdmissionPaymentTypeChange;

// ==================== ADMISSION INSTALLMENT ROWS ====================
function renderAdmissionInstallmentRows() {
  const container = document.getElementById('admissionInstallmentRows');
  if (!container) return;

  container.innerHTML = admissionInstallmentRows.map((row, index) => `
    <div class="installment-row grid grid-cols-[1fr_1fr_auto] gap-2 p-2 bg-gray-50 rounded-lg items-center">
      <div class="relative">
        <input
          type="number"
          value="${row.amount}"
          placeholder="Amount"
          min="0"
          step="1"
          oninput="updateAdmissionInstallmentRow(${index}, 'amount', this.value)"
          class="w-full px-3 py-2 h-[40px] rounded-lg border-2 border-gray-200 text-gray-800 text-sm focus:outline-none focus:border-purple-500"
        >
      </div>
      <div class="relative">
        <input
          type="date"
          value="${row.dueDate}"
          onchange="updateAdmissionInstallmentRow(${index}, 'dueDate', this.value)"
          class="w-full px-3 py-2 h-[40px] rounded-lg border-2 border-gray-200 text-gray-800 text-sm focus:outline-none focus:border-purple-500"
        >
      </div>
      <button
        type="button"
        onclick="removeAdmissionInstallmentRow(${index})"
        class="text-red-500 hover:text-red-700 px-2 h-[40px] flex items-center justify-center"
      >
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
  validateAdmissionInstallmentTotals();
}

function addAdmissionInstallmentRow() {
  admissionInstallmentRows.push({ amount: '', dueDate: '' });
  renderAdmissionInstallmentRows();
}

function removeAdmissionInstallmentRow(index) {
  admissionInstallmentRows.splice(index, 1);
  renderAdmissionInstallmentRows();
}

function updateAdmissionInstallmentRow(index, field, value) {
  admissionInstallmentRows[index][field] = value;
  validateAdmissionInstallmentTotals();
}

async function submitAddAdmission() {
  clearAddErrors();

  const name = document.getElementById('directStudentName')?.value.trim() || '';
  const mobile = document.getElementById('directStudentMobile')?.value.trim().replace(/\D/g, '') || '';
  const course = document.getElementById('courseInput')?.value.trim() || '';
  const totalFees = parseInt(document.getElementById('totalFeesInput')?.value) || 0;
  const registrationAmount = parseInt(document.getElementById('registrationAmountInput')?.value) || 0;
  const paymentType = document.getElementById('paymentTypeSelect')?.value || 'ONE_TIME';
  const admissionDate = document.getElementById('paymentDateInput')?.value || new Date().toISOString().split('T')[0];
  const initialPaymentMode = document.getElementById('paymentModeInput')?.value || 'CASH';
  const pendingDueDate = document.getElementById('pendingDueDate')?.value || null;

  let hasError = false;

  if (!name) {
    document.getElementById('directNameError')?.classList.remove('hidden');
    hasError = true;
  }

  if (mobile.length !== 10) {
    document.getElementById('directMobileError')?.classList.remove('hidden');
    hasError = true;
  }

  if (!course) {
    document.getElementById('courseError')?.classList.remove('hidden');
    document.getElementById('courseInput')?.classList.add('border-red-500');
    hasError = true;
  }

  if (totalFees <= 0) {
    document.getElementById('totalFeesError')?.classList.remove('hidden');
    document.getElementById('totalFeesInput')?.classList.add('border-red-500');
    hasError = true;
  }

  if (registrationAmount > totalFees) {
    const regErr = document.getElementById('registrationAmountError');
    if (regErr) {
      regErr.textContent = 'Registration amount cannot exceed total fees';
      regErr.classList.remove('hidden');
    }
    document.getElementById('registrationAmountInput')?.classList.add('border-red-500');
    hasError = true;
  }

  // Validate installments for INSTALLMENT type
  let installments = null;
  if (paymentType === 'INSTALLMENT') {
    installments = [];
    for (const row of admissionInstallmentRows) {
      if (!row.amount || parseInt(row.amount) <= 0) {
        const errorEl = document.getElementById('installmentsError');
        if (errorEl) {
          errorEl.textContent = 'All installments must have a valid amount';
          errorEl.classList.remove('hidden');
        }
        hasError = true;
        break;
      }
      if (!row.dueDate) {
        const errorEl = document.getElementById('installmentsError');
        if (errorEl) {
          errorEl.textContent = 'All installments must have a due date';
          errorEl.classList.remove('hidden');
        }
        hasError = true;
        break;
      }
      installments.push({
        amount: parseInt(row.amount),
        dueDate: row.dueDate
      });
    }

    // Validate total matches
    if (!hasError) {
      const totalInstallments = installments.reduce((sum, inst) => sum + inst.amount, 0);
      const expectedRemaining = Math.max(0, totalFees - registrationAmount);
      if (totalInstallments !== expectedRemaining) {
        const errorEl = document.getElementById('installmentsTotalError') || document.getElementById('installmentsError');
        if (errorEl) {
          errorEl.textContent = `Installments total (${formatCurrency(totalInstallments)}) must equal remaining amount (${formatCurrency(expectedRemaining)})`;
          errorEl.classList.remove('hidden');
        }
        hasError = true;
      }
    }
  }

  if (hasError) return;

  // Submit
  const submitBtn = document.getElementById('submitAddBtn') || document.getElementById('addSubmitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
  }
  if (window.lucide) lucide.createIcons();

  try {
    const payload = {
      name,
      mobile,
      course,
      admissionDate,
      totalFees,
      registrationAmount: registrationAmount || 0,
      paymentMode: initialPaymentMode,
      installments: paymentType === 'INSTALLMENT' ? installments : undefined,
      fullPaymentDueDate: paymentType === 'ONE_TIME' && (totalFees - registrationAmount > 0) ? pendingDueDate : undefined
    };

    const response = await apiPost(API_ENDPOINTS.ADMISSIONS.CREATE, payload);

    closeAddModal();
    showToast('Success', 'Admission created successfully', 'success');

    // Reload admissions table
    loadAdmissions();
  } catch (err) {
    console.error('Failed to create admission:', err);
    showToast('Error', err.message || 'Failed to create admission', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Save Admission';
      if (window.lucide) lucide.createIcons();
    }
  }
}

// ==================== PAYMENT PLAN MODAL (INSTALLMENTS) ====================
function openPaymentPlanModal(admissionId) {
  currentAdmissionId = admissionId;
  const admission = admissions.find(a => a._id === admissionId);
  
  if (!admission) return;
  
  // Set summary values
  const totalFees = admission.totalFees || 0;
  const registrationAmount = admission.registrationAmount || 0;
  const remaining = totalFees - registrationAmount;
  
  document.getElementById('planTotalFees').textContent = formatCurrency(totalFees);
  document.getElementById('planRegistration').textContent = formatCurrency(registrationAmount);
  document.getElementById('planRemaining').textContent = formatCurrency(remaining);
  
  // Initialize installment rows
  if (admission.installments && admission.installments.length > 0) {
    installmentRows = admission.installments.map(inst => ({
      amount: inst.amount || '',
      dueDate: inst.dueDate ? new Date(inst.dueDate).toISOString().split('T')[0] : ''
    }));
  } else {
    installmentRows = [{ amount: remaining > 0 ? remaining : '', dueDate: '' }];
  }
  renderInstallmentRows();
  
  document.getElementById('planError').classList.add('hidden');
  
  // Show modal
  const modal = document.getElementById('paymentPlanModal');
  const content = document.getElementById('paymentPlanModalContent');
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
  }, 10);
  
  lucide.createIcons();
}

function closePaymentPlanModal() {
  const modal = document.getElementById('paymentPlanModal');
  const content = document.getElementById('paymentPlanModalContent');
  
  modal.classList.add('opacity-0');
  content.classList.remove('scale-100');
  content.classList.add('scale-95');
  
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 200);
}

function renderInstallmentRows() {
  const container = document.getElementById('installmentRows');
  
  container.innerHTML = installmentRows.map((row, index) => `
    <div class="installment-row flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
      <div class="flex-1">
        <label class="text-xs text-gray-500 mb-1 block">Amount (₹)</label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
          <input 
            type="number" 
            value="${row.amount}"
            onchange="updateInstallmentRow(${index}, 'amount', this.value)"
            class="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            placeholder="Amount"
            min="1"
          >
        </div>
      </div>
      <div class="flex-1">
        <label class="text-xs text-gray-500 mb-1 block">Due Date</label>
        <input 
          type="date" 
          value="${row.dueDate}"
          onchange="updateInstallmentRow(${index}, 'dueDate', this.value)"
          class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
        >
      </div>
      <button 
        onclick="removeInstallmentRow(${index})"
        class="mt-5 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        ${installmentRows.length === 1 ? 'disabled' : ''}
      >
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    </div>
  `).join('');
  
  lucide.createIcons();
}

function addInstallmentRow() {
  installmentRows.push({ amount: '', dueDate: '' });
  renderInstallmentRows();
}

function removeInstallmentRow(index) {
  if (installmentRows.length > 1) {
    installmentRows.splice(index, 1);
    renderInstallmentRows();
  }
}

function updateInstallmentRow(index, field, value) {
  installmentRows[index][field] = value;
}

async function submitPaymentPlan() {
  const errorEl = document.getElementById('planError');
  
  // Validate all rows
  for (const row of installmentRows) {
    if (!row.amount || parseInt(row.amount) <= 0) {
      errorEl.textContent = 'All installments must have a valid amount';
      errorEl.classList.remove('hidden');
      return;
    }
  }

  const admission = admissions.find(a => a._id === currentAdmissionId);
  const remaining = (admission.totalFees || 0) - (admission.registrationAmount || 0);
  const totalInstallments = installmentRows.reduce((sum, row) => sum + (parseInt(row.amount) || 0), 0);
  
  if (totalInstallments !== remaining) {
    errorEl.textContent = `Installments total (${formatCurrency(totalInstallments)}) must equal remaining amount (${formatCurrency(remaining)})`;
    errorEl.classList.remove('hidden');
    return;
  }
  
  // Submit
  const submitBtn = document.getElementById('planSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
  lucide.createIcons();
  
  try {
    const payload = {
      paymentType: 'INSTALLMENT',
      installments: installmentRows.map(row => ({
        amount: parseInt(row.amount),
        dueDate: row.dueDate
      }))
    };
    
    await apiPut(API_ENDPOINTS.ADMISSIONS.UPDATE(currentAdmissionId), payload);
    
    closePaymentPlanModal();
    showToast('Success', 'Payment plan saved successfully', 'success');
    loadAdmissions();
  } catch (err) {
    console.error('Failed to save payment plan:', err);
    const message = err.response?.data?.message || 'Failed to save payment plan';
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Save Plan';
    lucide.createIcons();
  }
}

// ==================== ADD PAYMENT MODAL ====================
async function openPaymentModal(admissionId) {
  currentAdmissionId = admissionId;
  
  // Reset form
  document.getElementById('paymentAmount').value = '';
  document.getElementById('paymentMode').value = 'CASH';
  document.getElementById('paymentType').value = 'installment';
  document.getElementById('paymentNote').value = '';
  document.getElementById('paymentAmountError')?.classList.add('hidden');
  document.getElementById('paymentAmount')?.classList.remove('border-red-500');
  
  const overviewEl = document.getElementById('paymentModalOverview');
  const instsEl = document.getElementById('paymentModalInstallments');
  
  if (overviewEl) overviewEl.classList.add('hidden');
  if (instsEl) instsEl.classList.add('hidden');
  
  // Show modal
  const modal = document.getElementById('paymentModal');
  const content = document.getElementById('paymentModalContent');
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
  }, 10);
  
  lucide.createIcons();

  // Load admission details to show snapshot and installments
  try {
    const res = await getAdmission(admissionId);
    const admission = res?.data?.admission || res?.admission || res?.data || res;
    if (!admission) return;
    currentAdmission = admission;

    const totalFees = admission.totalFees || 0;
    const totalPaid = admission.totalPaid ?? (totalFees - (admission.remainingAmount ?? 0));
    const remaining = admission.remainingAmount ?? (totalFees - totalPaid);

    if (overviewEl) {
      overviewEl.innerHTML = `
        <div><span class="text-gray-400">Total:</span> <span class="font-bold">${formatCurrency(totalFees)}</span></div>
        <div><span class="text-gray-400">Paid:</span> <span class="font-bold text-emerald-600">${formatCurrency(totalPaid)}</span></div>
        <div><span class="text-gray-400">Balance:</span> <span class="font-bold text-rose-600">${formatCurrency(remaining)}</span></div>
      `;
      overviewEl.classList.remove('hidden');
    }

    if (instsEl && admission.installments && admission.installments.length > 0) {
      instsEl.innerHTML = `
        <h3 class="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Installment Schedule</h3>
        <div class="space-y-1.5">
          ${admission.installments.map((inst, index) => {
            const label = inst.status === 'PAID' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-700' 
              : inst.status === 'OVERDUE' 
                ? 'bg-rose-50 border-rose-100 text-rose-700' 
                : 'bg-slate-50 border-slate-100 text-slate-700';
            
            return `
              <div class="flex justify-between items-center p-2.5 rounded-lg border text-xs ${label}">
                <div class="font-medium">
                  Installment ${index + 1}: ${formatCurrency(inst.amount)}
                  <span class="text-[10px] text-gray-400 font-normal">(Due: ${new Date(inst.dueDate).toLocaleDateString('en-IN')})</span>
                </div>
                ${inst.status !== 'PAID' 
                  ? `<button type="button" onclick="autofillPaymentAmount(${inst.amount})" class="px-2 py-1 text-[10px] bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors font-medium text-gray-700 shadow-sm">Pay This</button>` 
                  : '<span class="text-[10px] font-semibold text-emerald-600">✓ Paid</span>'
                }
              </div>
            `;
          }).join('')}
        </div>
      `;
      instsEl.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Failed to load admission overview:', err);
  }
}

// Global helper for click-to-autofill in payment modal
window.autofillPaymentAmount = function(amount) {
  const amountInput = document.getElementById('paymentAmount');
  if (amountInput) {
    amountInput.value = amount;
    document.getElementById('paymentAmountError')?.classList.add('hidden');
    amountInput.classList.remove('border-red-500');
  }
};

function closePaymentModal() {
  const modal = document.getElementById('paymentModal');
  const content = document.getElementById('paymentModalContent');
  
  modal.classList.add('opacity-0');
  content.classList.remove('scale-100');
  content.classList.add('scale-95');
  
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 200);
}

async function submitPayment() {
  const amount = parseInt(document.getElementById('paymentAmount').value) || 0;
  const mode = document.getElementById('paymentMode').value;
  const type = document.getElementById('paymentType').value;
  const note = document.getElementById('paymentNote').value.trim();
  
  // Get current admission data for validation
  const admission = currentAdmission || admissions.find(a => a._id === currentAdmissionId);
  const totalFees = admission?.totalFees || 0;
  const totalPaid = admission?.totalPaid ?? (totalFees - (admission?.remainingAmount ?? totalFees));
  const remaining = totalFees - totalPaid;
  
  // Validate
  if (amount <= 0) {
    document.getElementById('paymentAmountError').textContent = 'Please enter a valid amount';
    document.getElementById('paymentAmountError').classList.remove('hidden');
    document.getElementById('paymentAmount').classList.add('border-red-500');
    return;
  }
  
  // Overpayment validation
  if (amount > remaining) {
    document.getElementById('paymentAmountError').textContent = `Amount cannot exceed remaining balance (${formatCurrency(remaining)})`;
    document.getElementById('paymentAmountError').classList.remove('hidden');
    document.getElementById('paymentAmount').classList.add('border-red-500');
    return;
  }
  
  // Clear error
  document.getElementById('paymentAmountError').classList.add('hidden');
  document.getElementById('paymentAmount').classList.remove('border-red-500');
  
  // Submit
  const submitBtn = document.getElementById('paymentSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
  lucide.createIcons();
  
  try {
    // Validate admission exists
    if (!admission) {
      showToast('Error', 'Admission not found', 'error');
      return;
    }
    
    // Validate payment mode
    if (!mode || mode === '') {
      showToast('Error', 'Please select a payment mode', 'error');
      return;
    }
    
    // Validate payment type
    if (!type || type === '') {
      showToast('Error', 'Please select a payment type', 'error');
      return;
    }
    
    const payload = {
      admissionId: currentAdmissionId,
      amount: amount,
      paymentMode: mode,
      type: type,
      paymentDate: new Date().toISOString()
    };
    
    if (note) {
      payload.note = note;
    }
    
    await recordPayment(currentAdmissionId, payload);
    
    closePaymentModal();
    showToast('Success', 'Payment recorded successfully', 'success');
    loadAdmissions();
  } catch (err) {
    console.error('Failed to record payment:', err);
    const message = err.response?.data?.message || 'Failed to record payment';
    showToast('Error', message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Save Payment';
    lucide.createIcons();
  }
}

// ==================== VIEW PAYMENTS MODAL ====================
async function openViewPaymentsModal(admissionId) {
  currentAdmissionId = admissionId;
  const admission = admissions.find(a => a._id === admissionId);
  
  if (!admission) return;
  
  const student = admission.enquiryId || {};
  document.getElementById('viewPaymentsStudent').textContent = student.name || 'Unknown';
  
  // Set summary
  const total = admission.totalFees || 0;
  const remaining = admission.remainingAmount ?? (total - (admission.paidAmount || 0));
  const paid = total - remaining;
  
  document.getElementById('viewTotal').textContent = formatCurrency(total);
  document.getElementById('viewPaid').textContent = formatCurrency(paid);
  document.getElementById('viewRemaining').textContent = formatCurrency(remaining);
  
  // Load payments
  const list = document.getElementById('paymentsList');
  list.innerHTML = `
    <div class="flex justify-center py-4">
      <i data-lucide="loader-2" class="w-6 h-6 text-gray-400 animate-spin"></i>
    </div>
  `;
  document.getElementById('noPaymentsState').classList.add('hidden');
  
  // Show modal
  const modal = document.getElementById('viewPaymentsModal');
  const content = document.getElementById('viewPaymentsModalContent');
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
  }, 10);
  
  lucide.createIcons();
  
  try {
    const payments = await listAdmissionPayments(admissionId);
    renderPaymentsList(payments.data?.payments || []);
  } catch (err) {
    console.error('Failed to load payments:', err);
    list.innerHTML = `
      <div class="text-center py-4 text-red-500 text-sm">
        Failed to load payments
      </div>
    `;
  }
}

function renderPaymentsList(payments) {
  const list = document.getElementById('paymentsList');
  
  if (payments.length === 0) {
    list.innerHTML = '';
    document.getElementById('noPaymentsState').classList.remove('hidden');
    return;
  }
  
  document.getElementById('noPaymentsState').classList.add('hidden');
  
  // Sort by date (newest first)
  payments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  list.innerHTML = payments.map(p => {
    const date = new Date(p.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    
    const typeColors = {
      'initial': 'bg-blue-100 text-blue-700',
      'installment': 'bg-amber-100 text-amber-700',
      'full': 'bg-green-100 text-green-700',
      'refund': 'bg-red-100 text-red-700'
    };
    
    const typeLabels = {
      'initial': 'Registration',
      'installment': 'Installment',
      'full': 'Full Payment',
      'refund': 'Refund'
    };
    
    return `
      <div class="payment-card bg-gray-50 rounded-xl p-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 ${typeColors[p.type] || 'bg-gray-100 text-gray-600'} rounded-xl flex items-center justify-center">
            <i data-lucide="${getPaymentIcon(p.type)}" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="font-medium text-gray-800">${formatCurrency(p.amount)}</div>
            <div class="text-xs text-gray-500">${date} • ${p.paymentMode}</div>
            ${p.note ? `<div class="text-xs text-gray-400 mt-0.5">${escapeHtml(p.note)}</div>` : ''}
          </div>
        </div>
        <span class="px-2.5 py-1 rounded-lg text-xs font-medium ${typeColors[p.type] || 'bg-gray-100 text-gray-600'}">
          ${typeLabels[p.type] || p.type || p.paymentMode || 'Payment'}
        </span>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

function getPaymentIcon(type) {
  const icons = {
    'initial': 'wallet',
    'installment': 'calendar',
    'full': 'check-circle',
    'refund': 'arrow-left'
  };
  return icons[type] || 'credit-card';
}

function closeViewPaymentsModal() {
  const modal = document.getElementById('viewPaymentsModal');
  const content = document.getElementById('viewPaymentsModalContent');
  
  modal.classList.add('opacity-0');
  content.classList.remove('scale-100');
  content.classList.add('scale-95');
  
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 200);
}


// ==================== TOAST SYSTEM ====================
function showToast(title, message, type = 'success') {
  const container = document.getElementById('toastContainer');
  
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500'
  };
  
  const icons = {
    success: 'check-circle',
    error: 'x-circle',
    warning: 'alert-triangle',
    info: 'info'
  };
  
  const toast = document.createElement('div');
  toast.className = `${colors[type]} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[300px] max-w-[400px] toast-enter`;
  toast.innerHTML = `
    <i data-lucide="${icons[type]}" class="w-5 h-5 flex-shrink-0"></i>
    <div class="flex-1">
      <div class="font-medium text-sm">${title}</div>
      <div class="text-xs opacity-90">${message}</div>
    </div>
    <button onclick="this.parentElement.remove()" class="opacity-70 hover:opacity-100">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;
  
  container.appendChild(toast);
  lucide.createIcons();
  
  // Auto remove
  setTimeout(() => {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, type === 'error' ? 4000 : 3000);
}

