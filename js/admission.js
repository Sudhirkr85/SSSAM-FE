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

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initUserInfo();
  initEventListeners();
  loadAdmissions();
  loadEnquiriesForDropdown();
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
      loadAdmissions(e.target.value);
    }, 300);
  });

  // Registration amount validation
  document.getElementById('registrationAmountInput')?.addEventListener('input', (e) => {
    const total = parseFloat(document.getElementById('totalFeesInput')?.value) || 0;
    const reg = parseFloat(e.target.value) || 0;
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
    const total = parseFloat(e.target.value) || 0;
    if (total > 0) {
      e.target.classList.remove('border-red-500');
      document.getElementById('totalFeesError')?.classList.add('hidden');
    }
  });
}

// ==================== API CALLS ====================
async function loadAdmissions(search = '') {
  try {
    const params = {
      page: currentPage,
      limit: ITEMS_PER_PAGE
    };
    
    if (search) {
      params.search = search;
    }

    const response = await apiGet(API_ENDPOINTS.ADMISSIONS.GET_ALL, params);
    
    admissions = response.admissions || [];
    const pagination = response.pagination || {};
    totalPages = pagination.totalPages || 1;
    totalCount = pagination.totalCount || 0;

    renderTable();
    renderMobileCards();
    updatePagination();
  } catch (err) {
    console.error('Failed to load admissions:', err);
    showToast('Error', 'Failed to load admissions', 'error');
    renderEmptyState();
  }
}

async function loadEnquiriesForDropdown() {
  try {
    // Get enquiries that can be converted (NEW, INTERESTED, CONTACTED)
    const response = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, { 
      limit: 100,
      status: 'NEW,INTERESTED,CONTACTED,FOLLOW_UP'
    });
    enquiries = response.enquiries || [];
    renderEnquiryDropdown();
  } catch (err) {
    console.error('Failed to load enquiries:', err);
  }
}

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
          valueA = (a.enquiryId?.name || 'Unknown').toLowerCase();
          valueB = (b.enquiryId?.name || 'Unknown').toLowerCase();
          break;
        case 'course':
          valueA = (a.course || '-').toLowerCase();
          valueB = (b.course || '-').toLowerCase();
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
        default:
          return 0;
      }
      
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  table.innerHTML = sortedAdmissions.map(admission => {
    const student = admission.enquiryId || {};
    const name = student.name || 'Unknown';
    const mobile = student.mobile || '';
    const course = admission.course || '-';
    const totalFees = admission.totalFees || 0;
    // Backend sends remainingAmount, calculate paid from it
    const remaining = admission.remainingAmount ?? (totalFees - (admission.paidAmount || 0));
    const paidAmount = totalFees - remaining;
    const paymentType = admission.paymentType || 'ONE_TIME';

    return `
      <tr class="finance-row border-b border-gray-50 last:border-0 cursor-pointer hover:bg-indigo-50/50 transition-colors" onclick="window.location.href='admission-detail.html?id=${admission._id}'">
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <i data-lucide="user" class="w-5 h-5 text-blue-600"></i>
            </div>
            <div>
              <div class="font-medium text-gray-800">${escapeHtml(name)}</div>
              <div class="text-xs text-gray-500">${mobile}</div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4 text-gray-600">${escapeHtml(course)}</td>
        <td class="px-6 py-4 text-right font-medium text-gray-800">${formatCurrency(totalFees)}</td>
        <td class="px-6 py-4 text-right font-medium text-green-600">${formatCurrency(paidAmount)}</td>
        <td class="px-6 py-4 text-right font-medium ${remaining > 0 ? 'text-red-600' : 'text-gray-400'}">${remaining > 0 ? formatCurrency(remaining) : 'Paid'}</td>
        <td class="px-6 py-4 text-center">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${getPaymentTypeBadgeClass(paymentType)}">
            ${getPaymentTypeIcon(paymentType)}
            ${paymentType === 'ONE_TIME' ? 'One Time' : 'Installment'}
          </span>
        </td>
        <td class="px-6 py-4" onclick="event.stopPropagation();">
          <div class="flex items-center justify-center gap-2">
            <a href="admission-detail.html?id=${admission._id}" onclick="event.stopPropagation();" class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View Detail">
              <i data-lucide="eye" class="w-4 h-4"></i>
            </a>
            <button onclick="event.stopPropagation(); openPaymentModal('${admission._id}')" class="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Add Payment">
              <i data-lucide="plus-circle" class="w-4 h-4"></i>
            </button>
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
    const student = admission.enquiryId || {};
    const name = student.name || 'Unknown';
    const mobile = student.mobile || '';
    const course = admission.course || '-';
    const totalFees = admission.totalFees || 0;
    // Backend sends remainingAmount, calculate paid from it
    const remaining = admission.remainingAmount ?? (totalFees - (admission.paidAmount || 0));
    const paidAmount = totalFees - remaining;
    const paymentType = admission.paymentType || 'ONE_TIME';

    return `
      <div class="bg-white rounded-xl shadow-sm p-4 space-y-3 cursor-pointer hover:shadow-md transition-all" onclick="window.location.href='admission-detail.html?id=${admission._id}'">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <i data-lucide="user" class="w-5 h-5 text-blue-600"></i>
            </div>
            <div>
              <div class="font-medium text-gray-800">${escapeHtml(name)}</div>
              <div class="text-xs text-gray-500">${mobile}</div>
            </div>
          </div>
          <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${getPaymentTypeBadgeClass(paymentType)}">
            ${paymentType === 'ONE Time' ? 'One Time' : 'Installment'}
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
            <div class="font-medium text-sm text-blue-700">${remaining > 0 ? formatCurrency(remaining) : 'Paid'}</div>
          </div>
        </div>
        
        <div class="flex items-center justify-between pt-2 border-t border-gray-100" onclick="event.stopPropagation();">
          <div class="text-sm text-gray-600">${escapeHtml(course)}</div>
          <div class="flex items-center gap-1">
            <a href="admission-detail.html?id=${admission._id}" onclick="event.stopPropagation();" class="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
              <i data-lucide="eye" class="w-4 h-4"></i>
            </a>
            <button onclick="event.stopPropagation(); openPaymentModal('${admission._id}')" class="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
              <i data-lucide="plus-circle" class="w-4 h-4"></i>
            </button>
            <button onclick="event.stopPropagation(); openViewPaymentsModal('${admission._id}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
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
  document.getElementById('admissionTable').innerHTML = `
    <tr>
      <td colspan="7" class="text-center py-12">
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

// ==================== PAGINATION CONTROLS ====================
function changePage(delta) {
  const newPage = currentPage + delta;
  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    loadAdmissions(document.getElementById('searchInput')?.value || '');
  }
}

function goToPage(page) {
  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    loadAdmissions(document.getElementById('searchInput')?.value || '');
  }
}

function goToLastPage() {
  currentPage = totalPages;
  loadAdmissions(document.getElementById('searchInput')?.value || '');
}

// ==================== ADD ADMISSION MODAL ====================
function openAddModal() {
  // Reset form
  document.getElementById('selectedEnquiryId').value = '';
  document.getElementById('enquirySelectText').textContent = 'Select an enquiry...';
  document.getElementById('enquirySelectText').classList.add('text-gray-500');
  document.getElementById('courseInput').value = '';
  document.getElementById('totalFeesInput').value = '';
  document.getElementById('registrationAmountInput').value = '';
  document.querySelector('input[name="paymentType"][value="ONE_TIME"]').checked = true;

  // Set default payment date to today
  document.getElementById('paymentDateInput').value = new Date().toISOString().split('T')[0];
  document.getElementById('initialPaymentInput').value = '';
  document.getElementById('paymentModeInput').value = 'CASH';

  // Reset installments
  admissionInstallmentRows = [{ amount: '', dueDate: '' }];
  renderAdmissionInstallmentRows();
  document.getElementById('installmentsSection').classList.add('hidden');

  // Clear errors
  clearAddErrors();

  // Show modal
  const modal = document.getElementById('addModal');
  const content = document.getElementById('addModalContent');

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
  }, 10);

  lucide.createIcons();
}

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

function clearAddErrors() {
  ['enquiry', 'course', 'totalFees', 'registrationAmount', 'paymentDate', 'initialPayment', 'paymentMode'].forEach(id => {
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
  const list = document.getElementById('enquiryList');
  
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
    return `
      <div 
        class="enquiry-option p-3 cursor-pointer ${isSelected ? 'selected' : ''}"
        onclick="selectEnquiry('${e._id}', '${escapeHtml(e.name)}', '${e.mobile || ''}')"
      >
        <div class="font-medium text-gray-800">${escapeHtml(e.name)}</div>
        <div class="text-xs text-gray-500 flex items-center gap-2">
          <span>${e.mobile || 'No mobile'}</span>
          ${e.courseInterested ? `<span class="text-blue-600">• ${escapeHtml(e.courseInterested)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function selectEnquiry(id, name, mobile) {
  selectedEnquiryId = id;
  document.getElementById('selectedEnquiryId').value = id;
  
  const displayText = mobile ? `${name} (${mobile})` : name;
  const textEl = document.getElementById('enquirySelectText');
  textEl.textContent = displayText;
  textEl.classList.remove('text-gray-500');
  textEl.classList.add('text-gray-800');
  
  document.getElementById('enquiryDropdown').classList.add('hidden');
  document.getElementById('enquiryError')?.classList.add('hidden');
  
  // Auto-fill course if enquiry has courseInterested
  const enquiry = enquiries.find(e => e._id === id);
  if (enquiry?.courseInterested) {
    document.getElementById('courseInput').value = enquiry.courseInterested;
  }
}

function handlePaymentTypeChange(value) {
  const installmentsSection = document.getElementById('installmentsSection');
  if (value === 'INSTALLMENT') {
    installmentsSection.classList.remove('hidden');
    if (admissionInstallmentRows.length === 0) {
      admissionInstallmentRows = [{ amount: '', dueDate: '' }];
    }
    renderAdmissionInstallmentRows();
  } else {
    installmentsSection.classList.add('hidden');
  }
  lucide.createIcons();
}

// ==================== ADMISSION INSTALLMENT ROWS ====================
function renderAdmissionInstallmentRows() {
  const container = document.getElementById('admissionInstallmentRows');
  if (!container) return;

  container.innerHTML = admissionInstallmentRows.map((row, index) => `
    <div class="installment-row flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
      <div class="flex-1">
        <label class="text-xs text-gray-500 mb-1 block">Amount (₹)</label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
          <input
            type="number"
            value="${row.amount}"
            onchange="updateAdmissionInstallmentRow(${index}, 'amount', this.value)"
            class="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
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
          onchange="updateAdmissionInstallmentRow(${index}, 'dueDate', this.value)"
          class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
        >
      </div>
      <button
        onclick="removeAdmissionInstallmentRow(${index})"
        class="mt-5 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        ${admissionInstallmentRows.length === 1 ? 'disabled' : ''}
      >
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    </div>
  `).join('');

  lucide.createIcons();
}

function addAdmissionInstallmentRow() {
  admissionInstallmentRows.push({ amount: '', dueDate: '' });
  renderAdmissionInstallmentRows();
}

function removeAdmissionInstallmentRow(index) {
  if (admissionInstallmentRows.length > 1) {
    admissionInstallmentRows.splice(index, 1);
    renderAdmissionInstallmentRows();
  }
}

function updateAdmissionInstallmentRow(index, field, value) {
  admissionInstallmentRows[index][field] = value;
}

async function submitAddAdmission() {
  clearAddErrors();

  const enquiryId = document.getElementById('selectedEnquiryId').value;
  const course = document.getElementById('courseInput').value.trim();
  const totalFees = parseFloat(document.getElementById('totalFeesInput').value) || 0;
  const registrationAmount = parseFloat(document.getElementById('registrationAmountInput').value) || 0;
  const paymentType = document.querySelector('input[name="paymentType"]:checked')?.value || 'ONE_TIME';
  const paymentDate = document.getElementById('paymentDateInput').value;
  const initialPayment = parseFloat(document.getElementById('initialPaymentInput').value) || 0;
  const initialPaymentMode = document.getElementById('paymentModeInput').value;

  let hasError = false;

  if (!enquiryId) {
    document.getElementById('enquiryError').classList.remove('hidden');
    hasError = true;
  }

  if (!course) {
    document.getElementById('courseError').classList.remove('hidden');
    document.getElementById('courseInput').classList.add('border-red-500');
    hasError = true;
  }

  if (totalFees <= 0) {
    document.getElementById('totalFeesError').classList.remove('hidden');
    document.getElementById('totalFeesInput').classList.add('border-red-500');
    hasError = true;
  }

  if (registrationAmount > totalFees) {
    document.getElementById('registrationAmountError').textContent = 'Registration amount cannot exceed total fees';
    document.getElementById('registrationAmountError').classList.remove('hidden');
    document.getElementById('registrationAmountInput').classList.add('border-red-500');
    hasError = true;
  }

  if (!paymentDate) {
    document.getElementById('paymentDateError').classList.remove('hidden');
    document.getElementById('paymentDateInput').classList.add('border-red-500');
    hasError = true;
  }

  if (initialPayment <= 0) {
    document.getElementById('initialPaymentError').textContent = 'Initial payment is required and must be greater than 0';
    document.getElementById('initialPaymentError').classList.remove('hidden');
    document.getElementById('initialPaymentInput').classList.add('border-red-500');
    hasError = true;
  }

  if (initialPayment > totalFees) {
    document.getElementById('initialPaymentError').textContent = 'Initial payment cannot exceed total fees';
    document.getElementById('initialPaymentError').classList.remove('hidden');
    document.getElementById('initialPaymentInput').classList.add('border-red-500');
    hasError = true;
  }

  if (!initialPaymentMode) {
    document.getElementById('paymentModeError').classList.remove('hidden');
    document.getElementById('paymentModeInput').classList.add('border-red-500');
    hasError = true;
  }

  // Validate installments for INSTALLMENT type
  let installments = null;
  if (paymentType === 'INSTALLMENT') {
    installments = [];
    for (const row of admissionInstallmentRows) {
      if (!row.amount || parseFloat(row.amount) <= 0) {
        const errorEl = document.getElementById('installmentsError');
        errorEl.textContent = 'All installments must have a valid amount';
        errorEl.classList.remove('hidden');
        hasError = true;
        break;
      }
      if (!row.dueDate) {
        const errorEl = document.getElementById('installmentsError');
        errorEl.textContent = 'All installments must have a due date';
        errorEl.classList.remove('hidden');
        hasError = true;
        break;
      }
      installments.push({
        amount: parseFloat(row.amount),
        dueDate: row.dueDate
      });
    }

    // Validate total matches
    if (!hasError && installments.length > 0) {
      const totalInstallments = installments.reduce((sum, inst) => sum + inst.amount, 0);
      const expectedRemaining = totalFees - initialPayment;
      if (totalInstallments !== expectedRemaining) {
        const errorEl = document.getElementById('installmentsError');
        errorEl.textContent = `Installments total (${formatCurrency(totalInstallments)}) must equal remaining amount (${formatCurrency(expectedRemaining)})`;
        errorEl.classList.remove('hidden');
        hasError = true;
      }
    }
  }

  if (hasError) return;

  // Submit
  const submitBtn = document.getElementById('addSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
  lucide.createIcons();

  try {
    // Build payload per API contract
    const payload = {
      course,
      paymentType,
      totalFees,
      registrationAmount,
      paymentDate,
      initialPayment,
      initialPaymentMode
    };

    // Add paymentMethod for ONE_TIME (required)
    if (paymentType === 'ONE_TIME') {
      payload.paymentMethod = initialPaymentMode;
    }

    // Add installments for INSTALLMENT type
    if (paymentType === 'INSTALLMENT' && installments && installments.length > 0) {
      payload.installments = installments;
    }

    const response = await apiPost(API_ENDPOINTS.ADMISSIONS.CREATE_FROM_ENQUIRY(enquiryId), payload);

    closeAddModal();

    // Handle already exists case
    if (response?.data?.alreadyExists) {
      showToast('Info', 'Admission already exists for this enquiry', 'success');
    } else {
      showToast('Success', 'Admission created successfully', 'success');
    }

    loadAdmissions();
    loadEnquiriesForDropdown(); // Refresh dropdown
  } catch (err) {
    console.error('Failed to create admission:', err);
    const message = err.response?.data?.message || err.message || 'Failed to create admission';
    showToast('Error', message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Save Admission';
    lucide.createIcons();
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
  installmentRows = [{ amount: '', dueDate: '' }];
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
    if (!row.amount || parseFloat(row.amount) <= 0) {
      errorEl.textContent = 'All installments must have a valid amount';
      errorEl.classList.remove('hidden');
      return;
    }
    if (!row.dueDate) {
      errorEl.textContent = 'All installments must have a due date';
      errorEl.classList.remove('hidden');
      return;
    }
  }
  
  // Check sum matches remaining
  const admission = admissions.find(a => a._id === currentAdmissionId);
  const remaining = (admission.totalFees || 0) - (admission.registrationAmount || 0);
  const totalInstallments = installmentRows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  
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
        amount: parseFloat(row.amount),
        dueDate: row.dueDate
      }))
    };
    
    await apiPut(API_ENDPOINTS.ADMISSIONS.PAYMENT_PLAN(currentAdmissionId), payload);
    
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
function openPaymentModal(admissionId) {
  currentAdmissionId = admissionId;
  
  // Reset form
  document.getElementById('paymentAmount').value = '';
  document.getElementById('paymentMode').value = 'CASH';
  document.getElementById('paymentType').value = 'installment';
  document.getElementById('paymentNote').value = '';
  document.getElementById('paymentAmountError')?.classList.add('hidden');
  document.getElementById('paymentAmount')?.classList.remove('border-red-500');
  
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
}

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
  const amount = parseFloat(document.getElementById('paymentAmount').value) || 0;
  const mode = document.getElementById('paymentMode').value;
  const type = document.getElementById('paymentType').value;
  const note = document.getElementById('paymentNote').value.trim();
  
  // Get current admission data for validation
  const admission = admissions.find(a => a._id === currentAdmissionId);
  const totalFees = admission?.totalFees || 0;
  const paidAmount = admission?.paidAmount || 0;
  const remaining = totalFees - paidAmount;
  
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
    const payload = {
      admissionId: currentAdmissionId,
      amount: amount,
      paymentMode: mode,
      type: type
    };
    
    if (note) {
      payload.note = note;
    }
    
    await apiPost(API_ENDPOINTS.PAYMENTS.CREATE, payload);
    
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
    const payments = await apiGet(API_ENDPOINTS.PAYMENTS.GET_BY_ADMISSION(admissionId));
    renderPaymentsList(payments.payments || []);
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
          ${typeLabels[p.type] || p.type}
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

