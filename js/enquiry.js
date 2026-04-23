/**
 * SSSAM CRM - Enquiry Page JavaScript
 * Indian CRM Style - Production Ready
 */

// ==================== STATE ====================
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let totalPages = 1;
let totalCount = 0;
let currentTab = 'all'; // 'all' or 'today'
let enquiries = [];
let selectedFile = null;

// ==================== STATUS MAPPING (Indian CRM Style) ====================
const STATUS_MAP = {
  'NEW': { label: 'New Lead', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'CONTACTED': { label: 'Contacted', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  'NO_RESPONSE': { label: 'Call Not Picked', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  'FOLLOW_UP': { label: 'Call Back', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  'INTERESTED': { label: 'Interested', color: 'bg-green-100 text-green-700 border-green-200' },
  'NOT_INTERESTED': { label: 'Not Interested', color: 'bg-red-100 text-red-700 border-red-200' },
  'ADMISSION_PROCESS': { label: 'Admission In Progress', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  'CONVERTED': { label: 'Admission Done', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' }
};

// ==================== SOURCE MAPPING ====================
const SOURCE_MAP = {
  'website': 'Website',
  'walk_in': 'Walk In',
  'referral': 'Referral',
  'phone_call': 'Phone Call',
  'social_media': 'Social Media',
  'advertisement': 'Advertisement',
  'other': 'Other'
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initUserProfile();
  initEventListeners();
  checkAdminFeatures();
  loadEnquiries();
});

function initUserProfile() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const name = user.name || user.fullName || 'User';
  const role = user.role || 'counselor';
  
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  
  document.getElementById('userName').textContent = name;
  document.getElementById('userRole').textContent = role.charAt(0).toUpperCase() + role.slice(1);
  document.getElementById('userInitials').textContent = initials;
}

function initEventListeners() {
  // Search input
  document.getElementById('searchInput')?.addEventListener('input', debounce(() => {
    currentPage = 1;
    loadEnquiries();
  }, 300));

  // Status filter
  document.getElementById('statusFilter')?.addEventListener('change', () => {
    currentPage = 1;
    loadEnquiries();
  });

  // Course dropdown - show custom input for "Other"
  document.getElementById('addCourse')?.addEventListener('change', handleCourseChange);

  // Source dropdown - show referral fields for "referral"
  document.getElementById('addSource')?.addEventListener('change', handleSourceChange);

  // Mobile input - format with space after 5 digits
  document.getElementById('addMobile')?.addEventListener('input', handleMobileInput);
  document.getElementById('addMobile')?.addEventListener('paste', handleMobilePaste);

  // Reference contact - numbers only
  document.getElementById('addRefContact')?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  });

  // Status change in update modal - handle follow-up date requirement
  document.getElementById('updateStatus')?.addEventListener('change', handleUpdateStatusChange);

  // Bulk upload file selection
  document.getElementById('uploadArea')?.addEventListener('click', () => {
    document.getElementById('bulkFileInput').click();
  });

  document.getElementById('bulkFileInput')?.addEventListener('change', handleFileSelect);

  // Drag and drop for bulk upload
  const uploadArea = document.getElementById('uploadArea');
  if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('border-emerald-500', 'bg-emerald-50');
    });
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('border-emerald-500', 'bg-emerald-50');
    });
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('border-emerald-500', 'bg-emerald-50');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    });
  }
}

function checkAdminFeatures() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.role === 'admin') {
    document.getElementById('bulkUploadBtn')?.classList.remove('hidden');
    document.getElementById('reportsMenu')?.classList.remove('hidden');
  }
}

// ==================== DEBOUNCE UTILITY ====================
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ==================== API FUNCTIONS ====================
async function loadEnquiries() {
  try {
    showLoadingState();

    const search = document.getElementById('searchInput').value.trim();
    const status = document.getElementById('statusFilter').value;

    const params = {
      page: currentPage,
      limit: ITEMS_PER_PAGE
    };

    if (search) params.search = search;
    
    // For Today Calls tab - fetch both NEW and FOLLOW_UP, then filter client-side
    if (currentTab === 'today') {
      // Don't send status filter - we'll fetch multiple statuses and combine
      delete params.status;
    } else if (status) {
      params.status = status;
    }

    const res = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, params);
    
    let allEnquiries = res.enquiries || [];
    
    // For Today tab, filter to show only NEW and FOLLOW_UP (today/overdue)
    if (currentTab === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      allEnquiries = allEnquiries.filter(e => {
        // Include NEW enquiries
        if (e.status === 'NEW') return true;
        
        // Include FOLLOW_UP if due today or overdue
        if (e.status === 'FOLLOW_UP' && e.followUpDate) {
          const followUpDate = new Date(e.followUpDate);
          followUpDate.setHours(0, 0, 0, 0);
          return followUpDate <= today;
        }
        
        return false;
      });
    }
    
    enquiries = allEnquiries;
    const pagination = res.pagination || {};
    totalPages = pagination.totalPages || 1;
    totalCount = pagination.totalCount || 0;

    renderTable();
    renderMobileCards();
    updatePagination();
    updateCountDisplay();
  } catch (err) {
    console.error('Failed to load enquiries:', err);
    showError('Failed to load enquiries. Please try again.');
    renderEmptyState();
  }
}

// ==================== RENDER FUNCTIONS ====================
function renderTable() {
  const tbody = document.getElementById('enquiriesTableBody');
  
  if (!enquiries.length) {
    renderEmptyState();
    return;
  }

  tbody.innerHTML = enquiries.map(enquiry => {
    const statusInfo = STATUS_MAP[enquiry.status] || STATUS_MAP['NEW'];
    const counselor = enquiry.assignedTo?.name || enquiry.counselorId?.name || 'Unassigned';
    
    return `
      <tr class="enquiry-row border-b border-gray-100 last:border-0 cursor-pointer hover:bg-blue-50/50 transition-colors" onclick="window.location.href='enquiry-detail.html?id=${enquiry._id}'">
        <td class="px-4 py-3">
          <div class="font-medium text-gray-900">${enquiry.name || '-'}</div>
          <div class="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
            <i data-lucide="phone" class="w-3 h-3"></i>
            ${enquiry.mobile || '-'}
          </div>
        </td>
        <td class="px-4 py-3 text-gray-700 text-sm">${enquiry.courseInterested || '-'}</td>
        <td class="px-4 py-3 text-center">
          <span class="status-badge inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}">
            ${statusInfo.label}
          </span>
        </td>
        <td class="px-4 py-3 text-center text-sm text-gray-600">${counselor}</td>
        <td class="px-4 py-3 text-center" onclick="event.stopPropagation()">
          <button 
            onclick="openUpdateModal('${enquiry._id}', '${enquiry.status}')"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium transition-colors"
          >
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
            Action
          </button>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

function renderMobileCards() {
  const container = document.getElementById('mobileCards');
  
  if (!enquiries.length) {
    container.innerHTML = `
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <i data-lucide="inbox" class="w-8 h-8 text-gray-400"></i>
        </div>
        <p class="text-gray-800 font-medium">No enquiries found</p>
        <p class="text-gray-500 text-sm mt-1">Try adjusting your filters</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = enquiries.map(enquiry => {
    const statusInfo = STATUS_MAP[enquiry.status] || STATUS_MAP['NEW'];
    
    return `
      <div class="enquiry-card bg-white rounded-xl shadow-sm p-4 border border-gray-100 cursor-pointer hover:shadow-md transition-all" onclick="window.location.href='enquiry-detail.html?id=${enquiry._id}'">
        <div class="flex items-start justify-between mb-3">
          <div>
            <div class="font-semibold text-gray-800">${enquiry.name || '-'}</div>
            <div class="text-sm text-gray-500">${enquiry.mobile || '-'}</div>
          </div>
          <span class="status-badge inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}">
            ${statusInfo.label}
          </span>
        </div>
        
        <div class="text-sm text-gray-600 mb-3">
          <span class="text-gray-400">Course:</span> ${enquiry.courseInterested || '-'}
        </div>
        
        <div class="flex items-center justify-between pt-3 border-t border-gray-100" onclick="event.stopPropagation();">
          <span class="text-xs text-gray-400">${enquiry.assignedTo?.name || 'Unassigned'}</span>
          <div class="flex items-center gap-2">
            <button onclick="event.stopPropagation(); openUpdateModal('${enquiry._id}', '${enquiry.status}')" class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
              <i data-lucide="refresh-cw" class="w-4 h-4"></i>
            </button>
            <a href="enquiry-detail.html?id=${enquiry._id}" onclick="event.stopPropagation();" class="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <i data-lucide="eye" class="w-4 h-4"></i>
            </a>
          </div>
        </div>
      </div>
    `;
  }).join('');

  lucide.createIcons();
}

function renderEmptyState() {
  const tbody = document.getElementById('enquiriesTableBody');
  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="text-center py-12">
        <div class="flex flex-col items-center gap-3">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <i data-lucide="inbox" class="w-8 h-8 text-gray-400"></i>
          </div>
          <div>
            <p class="text-gray-800 font-medium">No enquiries found</p>
            <p class="text-gray-500 text-sm">Try adjusting your filters or search</p>
          </div>
        </div>
      </td>
    </tr>
  `;
  lucide.createIcons();
}

function showLoadingState() {
  const tbody = document.getElementById('enquiriesTableBody');
  tbody.innerHTML = `
    <tr>
      <td colspan="5" class="text-center py-12">
        <div class="flex flex-col items-center gap-3">
          <div class="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p class="text-gray-500 text-sm">Loading enquiries...</p>
        </div>
      </td>
    </tr>
  `;
}

// ==================== PAGINATION ====================
function updatePagination() {
  const start = totalCount > 0 ? ((currentPage - 1) * ITEMS_PER_PAGE) + 1 : 0;
  const end = Math.min(start + ITEMS_PER_PAGE - 1, totalCount);

  document.getElementById('showingFrom').textContent = start;
  document.getElementById('showingTo').textContent = end;
  document.getElementById('totalItems').textContent = totalCount;

  document.getElementById('firstPage').disabled = currentPage === 1;
  document.getElementById('prevPage').disabled = currentPage === 1;
  document.getElementById('nextPage').disabled = currentPage >= totalPages;
  document.getElementById('lastPage').disabled = currentPage >= totalPages;

  renderPageNumbers();
}

// ==================== COUNT DISPLAY ====================
function updateCountDisplay() {
  const search = document.getElementById('searchInput').value.trim();
  const status = document.getElementById('statusFilter').value;
  const countDisplay = document.getElementById('enquiryCountDisplay');

  // Check if filters are active
  const hasFilters = search || status;

  if (hasFilters) {
    // Show filtered count
    const currentCount = enquiries.length;
    countDisplay.textContent = `Showing ${currentCount} of ${totalCount} Enquiries`;
  } else {
    // Show total count
    countDisplay.textContent = `Total Enquiries: ${totalCount}`;
  }
}

function renderPageNumbers() {
  document.getElementById('lastPage').disabled = currentPage >= totalPages;

  // Page numbers
  const pageNumbers = document.getElementById('pageNumbers');
  let html = '';

  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + 4);

  if (endPage - startPage < 4) {
    startPage = Math.max(1, endPage - 4);
  }

  for (let i = startPage; i <= endPage; i++) {
    if (i === currentPage) {
      html += `<span class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg font-medium">${i}</span>`;
    } else {
      html += `<button onclick="goToPage(${i})" class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">${i}</button>`;
    }
  }

  pageNumbers.innerHTML = html;
}

function changePage(direction) {
  const newPage = currentPage + direction;
  if (newPage >= 1 && newPage <= totalPages) {
    currentPage = newPage;
    loadEnquiries();
  }
}

function goToPage(page) {
  if (page >= 1 && page <= totalPages) {
    currentPage = page;
    loadEnquiries();
  }
}

function goToLastPage() {
  currentPage = totalPages;
  loadEnquiries();
}

// ==================== TAB SWITCHING ====================
function switchTab(tab) {
  currentTab = tab;
  currentPage = 1;

  // Update tab styles
  const tabAll = document.getElementById('tabAll');
  const tabToday = document.getElementById('tabToday');

  if (tab === 'all') {
    tabAll.classList.add('bg-blue-600', 'text-white');
    tabAll.classList.remove('text-gray-600', 'hover:bg-gray-100');
    tabToday.classList.remove('bg-blue-600', 'text-white');
    tabToday.classList.add('text-gray-600', 'hover:bg-gray-100');
    
    // Reset status filter to NEW for All Enquiries
    document.getElementById('statusFilter').value = 'NEW';
  } else {
    tabToday.classList.add('bg-blue-600', 'text-white');
    tabToday.classList.remove('text-gray-600', 'hover:bg-gray-100');
    tabAll.classList.remove('bg-blue-600', 'text-white');
    tabAll.classList.add('text-gray-600', 'hover:bg-gray-100');
    
    // Clear status filter for Today Calls
    document.getElementById('statusFilter').value = '';
  }

  loadEnquiries();
}

// ==================== FILTER FUNCTIONS ====================
function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('statusFilter').value = currentTab === 'all' ? 'NEW' : '';
  currentPage = 1;
  loadEnquiries();
}

// ==================== ADD ENQUIRY MODAL ====================
function openAddModal() {
  const modal = document.getElementById('addModal');
  const content = document.getElementById('addModalContent');
  
  // Reset form
  document.getElementById('addName').value = '';
  document.getElementById('addMobile').value = '';
  document.getElementById('addEmail').value = '';
  document.getElementById('addCourse').value = '';
  document.getElementById('addSource').value = '';  // NO default - user must select
  document.getElementById('addCustomCourse').value = '';
  document.getElementById('addRefName').value = '';
  document.getElementById('addRefContact').value = '';
  
  // Hide custom fields
  document.getElementById('customCourseContainer').classList.add('hidden');
  document.getElementById('referralContainer').classList.add('hidden');
  
  // Reset field styling
  clearFieldErrors();
  
  // Hide errors
  hideAddErrors();
  
  // Show modal
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
  }, 200);
}

function handleCourseChange(e) {
  const container = document.getElementById('customCourseContainer');
  if (e.target.value === 'Other') {
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }
}

function handleSourceChange(e) {
  const container = document.getElementById('referralContainer');
  if (e.target.value === 'referral') {
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }
}

function clearFieldErrors() {
  const fields = ['addName', 'addMobile', 'addEmail', 'addCourse', 'addSource', 'addCustomCourse', 'addRefName', 'addRefContact'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
      el.classList.add('border-gray-200', 'focus:border-blue-500', 'focus:ring-blue-100');
    }
  });
}

function showFieldError(fieldId, errorId) {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(errorId);
  
  if (field) {
    field.classList.remove('border-gray-200', 'focus:border-blue-500', 'focus:ring-blue-100');
    field.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
  }
  if (error) {
    error.classList.remove('hidden');
  }
}

function hideAddErrors() {
  document.getElementById('addNameError')?.classList.add('hidden');
  document.getElementById('addMobileError')?.classList.add('hidden');
  document.getElementById('addEmailError')?.classList.add('hidden');
  document.getElementById('addCourseError')?.classList.add('hidden');
  document.getElementById('addSourceError')?.classList.add('hidden');
  document.getElementById('addRefNameError')?.classList.add('hidden');
  document.getElementById('addRefContactError')?.classList.add('hidden');
}

/**
 * Format mobile number with space after 5 digits
 * Input: 9876543210 → Output: 98765 43210
 */
function formatMobileDisplay(value) {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  // Limit to 10 digits
  const limited = digits.slice(0, 10);
  // Add space after 5 digits
  if (limited.length > 5) {
    return limited.slice(0, 5) + ' ' + limited.slice(5);
  }
  return limited;
}

/**
 * Get clean mobile number (10 digits only)
 * Input: +91 98765 43210 → Output: 9876543210
 */
function getCleanMobile(inputValue) {
  if (!inputValue) return '';
  // Remove everything except digits
  return inputValue.replace(/\D/g, '').slice(0, 10);
}

/**
 * Handle mobile input - format as user types
 */
function handleMobileInput(e) {
  const input = e.target;
  const rawValue = input.value;
  
  // Get current cursor position
  const cursorPos = input.selectionStart;
  const wasAddingSpace = rawValue.length === 6 && cursorPos === 6;
  
  // Clean and format
  const cleanDigits = rawValue.replace(/\D/g, '').slice(0, 10);
  const formatted = formatMobileDisplay(cleanDigits);
  
  // Update value
  input.value = formatted;
  
  // Adjust cursor position
  if (wasAddingSpace && cursorPos === 6) {
    input.setSelectionRange(7, 7);
  }
}

/**
 * Handle paste - clean any pasted format
 */
function handleMobilePaste(e) {
  e.preventDefault();
  const pastedText = (e.clipboardData || window.clipboardData).getData('text');
  const cleanNumber = getCleanMobile(pastedText);
  
  const input = e.target;
  const formatted = formatMobileDisplay(cleanNumber);
  input.value = formatted;
}

/**
 * Validate mobile number
 */
function validateMobile(inputValue) {
  const clean = getCleanMobile(inputValue);
  return clean.length === 10;
}

function validateAddForm() {
  clearFieldErrors();
  hideAddErrors();
  let isValid = true;

  const name = document.getElementById('addName').value.trim();
  const mobileRaw = document.getElementById('addMobile').value;
  const mobile = getCleanMobile(mobileRaw);
  const email = document.getElementById('addEmail').value.trim();
  const course = document.getElementById('addCourse').value;
  const source = document.getElementById('addSource').value;

  // Name validation
  if (!name) {
    showFieldError('addName', 'addNameError');
    isValid = false;
  }

  // Mobile validation - exactly 10 digits
  if (!mobile) {
    document.getElementById('addMobileError').textContent = 'Mobile number is required';
    showFieldError('addMobile', 'addMobileError');
    isValid = false;
  } else if (mobile.length !== 10) {
    document.getElementById('addMobileError').textContent = `Enter exactly 10 digits (current: ${mobile.length})`;
    showFieldError('addMobile', 'addMobileError');
    isValid = false;
  }

  // Email validation - optional but must be valid if entered
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError('addEmail', 'addEmailError');
    isValid = false;
  }

  // Course validation
  if (!course) {
    showFieldError('addCourse', 'addCourseError');
    isValid = false;
  }

  // Custom course validation if "Other" selected
  if (course === 'Other') {
    const customCourse = document.getElementById('addCustomCourse').value.trim();
    if (!customCourse) {
      document.getElementById('addCourseError').textContent = 'Please enter custom course name';
      showFieldError('addCustomCourse', 'addCourseError');
      isValid = false;
    }
  }

  // Source validation - REQUIRED, no default
  if (!source) {
    showFieldError('addSource', 'addSourceError');
    isValid = false;
  }

  // Referral fields validation
  if (source === 'referral') {
    const refName = document.getElementById('addRefName').value.trim();
    const refContact = document.getElementById('addRefContact').value.trim();
    
    if (!refName) {
      document.getElementById('addRefNameError').textContent = 'Reference name is required';
      showFieldError('addRefName', 'addRefNameError');
      isValid = false;
    }
    
    if (!refContact) {
      document.getElementById('addRefContactError').textContent = 'Reference contact is required';
      showFieldError('addRefContact', 'addRefContactError');
      isValid = false;
    } else if (!/^\d{10}$/.test(refContact)) {
      document.getElementById('addRefContactError').textContent = 'Enter exactly 10 digits';
      showFieldError('addRefContact', 'addRefContactError');
      isValid = false;
    }
  }

  return isValid;
}

async function submitAddEnquiry() {
  if (!validateAddForm()) return;

  // Get submit button and show loading state
  const submitBtn = document.querySelector('#addModal button[onclick="submitAddEnquiry()"]');
  const originalBtnContent = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
  lucide.createIcons();

  try {
    const course = document.getElementById('addCourse').value;
    const finalCourse = course === 'Other' ? document.getElementById('addCustomCourse').value.trim() : course;
    const source = document.getElementById('addSource').value;
    const email = document.getElementById('addEmail').value.trim();
    
    // Get clean mobile number (10 digits only, no +91, no spaces)
    const mobileRaw = document.getElementById('addMobile').value;
    const cleanMobile = getCleanMobile(mobileRaw);
    
    // Build clean payload - only include fields with values
    const payload = {
      name: document.getElementById('addName').value.trim(),
      mobile: cleanMobile,  // Only 10 digits
      courseInterested: finalCourse,
      source: source
    };

    // Only add email if it has a value
    if (email) {
      payload.email = email;
    }

    // Only add referral info if source is referral
    if (source === 'referral') {
      payload.referenceName = document.getElementById('addRefName').value.trim();
      payload.referenceContact = document.getElementById('addRefContact').value.trim();
    }

    await apiPost(API_ENDPOINTS.ENQUIRIES.CREATE, payload);
    
    // Reset form
    document.getElementById('addName').value = '';
    document.getElementById('addMobile').value = '';
    document.getElementById('addEmail').value = '';
    document.getElementById('addCourse').value = '';
    document.getElementById('addSource').value = '';
    document.getElementById('addCustomCourse').value = '';
    document.getElementById('addRefName').value = '';
    document.getElementById('addRefContact').value = '';
    document.getElementById('customCourseContainer').classList.add('hidden');
    document.getElementById('referralContainer').classList.add('hidden');
    clearFieldErrors();
    
    closeAddModal();
    showToast('Success', 'Enquiry added successfully', 'success');
    loadEnquiries();
  } catch (err) {
    console.error('Failed to create enquiry:', err);
    const message = err.response?.data?.message || 'Failed to add enquiry';
    showError(message);
  } finally {
    // Restore button state
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnContent;
    lucide.createIcons();
  }
}

// ==================== UPDATE MODAL ====================
function openUpdateModal(enquiryId, currentStatus) {
  const modal = document.getElementById('updateModal');
  const content = document.getElementById('updateModalContent');

  // Set values
  document.getElementById('updateEnquiryId').value = enquiryId;
  document.getElementById('updateStatus').value = ''; // Reset to placeholder
  document.getElementById('updateNote').value = '';
  document.getElementById('updateFollowUpDate').value = '';

  // Hide errors
  document.getElementById('updateNoteError').classList.add('hidden');
  document.getElementById('followUpError').classList.add('hidden');

  // Handle follow-up date visibility
  handleUpdateStatusChange();

  // Show modal
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
  }, 10);
  
  lucide.createIcons();
}

function closeUpdateModal() {
  const modal = document.getElementById('updateModal');
  const content = document.getElementById('updateModalContent');
  
  modal.classList.add('opacity-0');
  content.classList.remove('scale-100');
  content.classList.add('scale-95');
  
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 200);
}

function handleUpdateStatusChange() {
  const status = document.getElementById('updateStatus').value;
  const followUpRequired = document.getElementById('followUpRequired');
  const followUpDate = document.getElementById('updateFollowUpDate');
  
  if (status === 'FOLLOW_UP') {
    followUpRequired.classList.remove('hidden');
    followUpDate.required = true;
  } else {
    followUpRequired.classList.add('hidden');
    followUpDate.required = false;
    document.getElementById('followUpError').classList.add('hidden');
  }
}

async function submitUpdate() {
  const enquiryId = document.getElementById('updateEnquiryId').value;
  const status = document.getElementById('updateStatus').value;
  const note = document.getElementById('updateNote').value.trim();
  const followUpDate = document.getElementById('updateFollowUpDate').value;

  // Validation
  document.getElementById('updateNoteError').classList.add('hidden');
  document.getElementById('followUpError').classList.add('hidden');

  if (!note) {
    document.getElementById('updateNoteError').classList.remove('hidden');
    return;
  }

  if (status === 'FOLLOW_UP' && !followUpDate) {
    document.getElementById('followUpError').classList.remove('hidden');
    return;
  }

  const payload = {
    status: status,
    note: note
  };

  if (followUpDate) {
    payload.followUpDate = followUpDate;
  }

  try {
    await apiPut(API_ENDPOINTS.ENQUIRIES.UPDATE_STATUS(enquiryId), payload);
    closeUpdateModal();
    showToast('Success', 'Status updated successfully', 'success');
    loadEnquiries();
  } catch (err) {
    console.error('Failed to update status:', err);
    const message = err.response?.data?.message || 'Failed to update status';
    showError(message);
  }
}

// ==================== BULK UPLOAD MODAL ====================
function openBulkUploadModal() {
  const modal = document.getElementById('bulkUploadModal');
  const content = document.getElementById('bulkUploadModalContent');
  
  // Reset state
  selectedFile = null;
  document.getElementById('bulkFileInput').value = '';
  document.getElementById('selectedFileArea').classList.add('hidden');
  document.getElementById('uploadProgressArea').classList.add('hidden');
  document.getElementById('uploadResultsArea').classList.add('hidden');
  document.getElementById('uploadButton').disabled = true;
  
  // Show modal
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
  }, 10);
  
  lucide.createIcons();
}

function closeBulkUploadModal() {
  const modal = document.getElementById('bulkUploadModal');
  const content = document.getElementById('bulkUploadModalContent');
  
  modal.classList.add('opacity-0');
  content.classList.remove('scale-100');
  content.classList.add('scale-95');
  
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 200);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    handleFile(file);
  }
}

function handleFile(file) {
  // Validate file type
  const validTypes = ['.csv', '.xlsx', '.xls'];
  const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
  
  if (!validTypes.includes(fileExtension)) {
    showError('Please upload a CSV or Excel file');
    return;
  }

  // Validate file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    showError('File size should be less than 5MB');
    return;
  }

  selectedFile = file;

  // Show selected file
  document.getElementById('selectedFileName').textContent = file.name;
  document.getElementById('selectedFileSize').textContent = formatFileSize(file.size);
  document.getElementById('selectedFileArea').classList.remove('hidden');
  
  // Enable upload button
  document.getElementById('uploadButton').disabled = false;
  
  // Hide results area
  document.getElementById('uploadResultsArea').classList.add('hidden');
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function clearSelectedFile() {
  selectedFile = null;
  document.getElementById('bulkFileInput').value = '';
  document.getElementById('selectedFileArea').classList.add('hidden');
  document.getElementById('uploadButton').disabled = true;
}

async function submitBulkUpload() {
  if (!selectedFile) {
    showError('Please select a file first');
    return;
  }

  const formData = new FormData();
  formData.append('file', selectedFile);

  // Show progress
  document.getElementById('uploadProgressArea').classList.remove('hidden');
  document.getElementById('uploadButton').disabled = true;

  // Simulate progress
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += 10;
    if (progress <= 90) {
      document.getElementById('uploadProgressPercent').textContent = progress + '%';
      document.getElementById('uploadProgressBar').style.width = progress + '%';
    }
  }, 200);

  try {
    const res = await apiPost(API_ENDPOINTS.ENQUIRIES.BULK_UPLOAD, formData);
    
    clearInterval(progressInterval);
    document.getElementById('uploadProgressPercent').textContent = '100%';
    document.getElementById('uploadProgressBar').style.width = '100%';

    // Show results
    showUploadResults(res);
    loadEnquiries();
  } catch (err) {
    clearInterval(progressInterval);
    console.error('Bulk upload failed:', err);
    const message = err.response?.data?.message || 'Bulk upload failed';
    showError(message);
    document.getElementById('uploadButton').disabled = false;
  }
}

function showUploadResults(results) {
  const success = results.success || 0;
  const failed = results.failed || 0;
  const total = results.total || 0;
  const errors = results.errors || [];

  document.getElementById('successCount').textContent = success;
  document.getElementById('errorCount').textContent = failed;
  document.getElementById('totalCount').textContent = total;

  const resultIcon = document.getElementById('resultIcon');
  const resultTitle = document.getElementById('resultTitle');
  const resultSubtitle = document.getElementById('resultSubtitle');

  // Handle ZERO case - no valid records found
  if (total === 0) {
    resultIcon.className = 'w-9 h-9 bg-red-100 rounded-full flex items-center justify-center';
    resultIcon.innerHTML = '<i data-lucide="x-circle" class="w-4 h-4 text-red-600"></i>';
    resultTitle.textContent = 'No Valid Records';
    resultSubtitle.textContent = 'No valid records found in file';
  }
  // Handle SUCCESS case - all records uploaded successfully
  else if (success > 0 && failed === 0) {
    resultIcon.className = 'w-9 h-9 bg-green-100 rounded-full flex items-center justify-center';
    resultIcon.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4 text-green-600"></i>';
    resultTitle.textContent = 'All Records Uploaded';
    resultSubtitle.textContent = 'All records uploaded successfully';
  }
  // Handle FAILURE case - all records failed
  else if (success === 0 && failed > 0) {
    resultIcon.className = 'w-9 h-9 bg-red-100 rounded-full flex items-center justify-center';
    resultIcon.innerHTML = '<i data-lucide="x-circle" class="w-4 h-4 text-red-600"></i>';
    resultTitle.textContent = 'All Records Failed';
    resultSubtitle.textContent = 'All records failed to upload';
  }
  // Handle PARTIAL SUCCESS case - some uploaded, some failed
  else if (success > 0 && failed > 0) {
    resultIcon.className = 'w-9 h-9 bg-yellow-100 rounded-full flex items-center justify-center';
    resultIcon.innerHTML = '<i data-lucide="alert-circle" class="w-4 h-4 text-yellow-600"></i>';
    resultTitle.textContent = 'Some Records Uploaded';
    resultSubtitle.textContent = `${success} uploaded, ${failed} failed`;
  }
  // Fallback
  else {
    resultIcon.className = 'w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center';
    resultIcon.innerHTML = '<i data-lucide="info" class="w-4 h-4 text-gray-600"></i>';
    resultTitle.textContent = 'Upload Complete';
    resultSubtitle.textContent = 'Upload process completed';
  }

  // Show error details with row numbers
  if (errors.length > 0) {
    const errorList = document.getElementById('errorList');
    errorList.innerHTML = errors.map(err => {
      // Format error with row number if available
      if (err.row && err.message) {
        return `<li class="flex items-start gap-2"><span class="font-medium">Row ${err.row}:</span><span>${err.message}</span></li>`;
      } else if (typeof err === 'string') {
        // Try to extract row number from string like "Row 3: Invalid mobile number"
        const rowMatch = err.match(/Row\s+(\d+):\s*(.+)/);
        if (rowMatch) {
          return `<li class="flex items-start gap-2"><span class="font-medium">Row ${rowMatch[1]}:</span><span>${rowMatch[2]}</span></li>`;
        }
        return `<li>${err}</li>`;
      } else {
        return `<li>${JSON.stringify(err)}</li>`;
      }
    }).join('');
    document.getElementById('errorDetails').classList.remove('hidden');
  } else {
    document.getElementById('errorDetails').classList.add('hidden');
  }

  document.getElementById('uploadResultsArea').classList.remove('hidden');
  lucide.createIcons();
}

function downloadTemplate() {
  const csvContent = 'Name,Mobile,Email,Course Interested,Source,Reference Name,Reference Contact\nJohn Doe,9876543210,john@example.com,Python Programming,walk_in,,\nJane Smith,9876543211,jane@example.com,Data Science,referral,Friend Name,9876543212';
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'enquiry_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// ==================== UTILITY FUNCTIONS ====================
function viewEnquiryDetail(enquiryId) {
  window.location.href = `enquiry-detail.html?id=${enquiryId}`;
}

function showToast(title, message, type = 'success') {
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toastIcon');
  const titleEl = document.getElementById('toastTitle');
  const messageEl = document.getElementById('toastMessage');

  // Set icon based on type
  if (type === 'success') {
    icon.className = 'w-8 h-8 bg-green-100 rounded-full flex items-center justify-center';
    icon.innerHTML = '<i data-lucide="check-circle" class="w-4 h-4 text-green-600"></i>';
  } else if (type === 'error') {
    icon.className = 'w-8 h-8 bg-red-100 rounded-full flex items-center justify-center';
    icon.innerHTML = '<i data-lucide="x-circle" class="w-4 h-4 text-red-600"></i>';
  }

  titleEl.textContent = title;
  messageEl.textContent = message;

  toast.classList.remove('hidden');
  lucide.createIcons();

  // Auto hide after 3 seconds
  setTimeout(() => {
    hideToast();
  }, 3000);
}

function hideToast() {
  document.getElementById('toast').classList.add('hidden');
}

function showError(message) {
  // Create error modal
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl mx-4">
      <div class="flex items-center gap-4 mb-4">
        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
          <i data-lucide="alert-circle" class="text-red-600 w-6 h-6"></i>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-800">Error</h3>
          <p class="text-sm text-red-600 font-medium">${message}</p>
        </div>
      </div>
      <button onclick="this.closest('.fixed').remove()" class="w-full px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors font-medium">
        Dismiss
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  lucide.createIcons();
}
