/**
 * SSSAM CRM - Enquiry Page JavaScript
 * Indian CRM Style - Production Ready
 */

// ==================== STATE ====================
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let totalPages = 1;
let totalCount = 0;
let currentQuickFilter = 'all'; // 'all' or status values
let enquiries = [];
let selectedFile = null;

// Sorting state
let sortColumn = null;
let sortDirection = 'asc'; // 'asc' or 'desc'

// Status counts cache
let statusCounts = {
  all: 0,
  NEW: 0,
  CONTACTED: 0,
  NOT_INTERESTED: 0,
  TODAY_FOLLOWUPS: 0,
  PENDING_FOLLOWUPS: 0
};

// ==================== STATUS MAPPING (3 Cases Only) ====================
const STATUS_MAP = {
  'CONTACTED': { label: 'Contacted', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'NOT_INTERESTED': { label: 'Not Interested', color: 'bg-red-100 text-red-700 border-red-200' },
  'null': { label: 'New', color: 'bg-gray-100 text-gray-700 border-gray-200' }
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

// ==================== UTILITY FUNCTIONS ====================
/**
 * Format courses for display - handles both array and string formats
 * @param {string|string[]} courses - Course or array of courses
 * @returns {string} Formatted course string
 */
function formatCourses(courses) {
  if (!courses) return '-';
  if (Array.isArray(courses)) {
    return courses.length > 0 ? courses.join(', ') : '-';
  }
  return courses; // It's already a string
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initUserProfile();
  initEventListeners();
  checkAdminFeatures();
  loadStatusCounts();

  // Check URL parameters for filter
  const urlParams = new URLSearchParams(window.location.search);
  const filterParam = urlParams.get('filter');

  if (filterParam && filterParam !== 'today') {
    applyQuickFilter(filterParam);
  } else {
    // Set initial active state for "all" button
    applyQuickFilter('all');
  }
});

function initUserProfile() {
  const user = safeParseLocalStorage('user', {});
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

  // Date range filters
  document.getElementById('dateFromFilter')?.addEventListener('change', () => {
    currentPage = 1;
    loadEnquiries();
  });

  document.getElementById('dateToFilter')?.addEventListener('change', () => {
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

  // Edit form event listeners
  document.getElementById('editCourse')?.addEventListener('change', handleEditCourseChange);
  document.getElementById('editSource')?.addEventListener('change', handleEditSourceChange);
  document.getElementById('editMobile')?.addEventListener('input', handleMobileInput);
  document.getElementById('editMobile')?.addEventListener('paste', handleMobilePaste);
  document.getElementById('editRefContact')?.addEventListener('input', (e) => {
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
  const user = safeParseLocalStorage('user', {});
  if (user.role === 'admin') {
    document.getElementById('bulkUploadBtn')?.classList.remove('hidden');
    document.getElementById('reportsMenu')?.classList.remove('hidden');
  }
}

// ==================== STATUS COUNTS ====================
async function loadStatusCounts() {
  try {
    console.log('Loading status counts...');
    console.log('API Endpoint:', API_ENDPOINTS.ENQUIRIES.LIST);
    console.log('Token exists:', !!localStorage.getItem('token'));
    
    // Fetch all enquiries without limit to get accurate counts
    const res = await apiGet(API_ENDPOINTS.ENQUIRIES.LIST, { page: 1, limit: 1000 });
    console.log('API Response:', res);
    
    const allEnquiries = res.data || res.enquiries || [];
    console.log('All enquiries count:', allEnquiries.length);
    
    // Get total count from pagination
    const pagination = res.pagination || {};
    const totalCount = pagination.totalCount || allEnquiries.length;
    console.log('Total count from pagination:', totalCount);
    
    // Count by status from available data (3-status system)
    statusCounts.all = totalCount;
    statusCounts.NEW = allEnquiries.filter(e => !e.status || e.status === null).length;
    statusCounts.CONTACTED = allEnquiries.filter(e => e.status === 'CONTACTED').length;
    statusCounts.NOT_INTERESTED = allEnquiries.filter(e => e.status === 'NOT_INTERESTED').length;
    
    // Calculate today followups
    statusCounts.TODAY_FOLLOWUPS = allEnquiries.filter(e => 
      e.followUpDate && isToday(e.followUpDate)
    ).length;
    
    // Calculate pending followups (overdue + no followup + new with no action)
    statusCounts.PENDING_FOLLOWUPS = allEnquiries.filter(e => {
      // A. Overdue followups
      if (e.followUpDate && isPast(e.followUpDate)) return true;
      
      // B. No follow-up date set
      if (!e.followUpDate) return true;
      
      // C. New enquiry created today with no action taken today
      if (isCreatedToday(e) && !hasActionToday(e)) return true;
      
      return false;
    }).length;
    
    console.log('Final status counts:', statusCounts);
    
    // Update UI
    updateCountDisplay();
  } catch (err) {
    console.error('Failed to load status counts:', err);
    // Set default values on error
    statusCounts.all = 0;
    statusCounts.NEW = 0;
    statusCounts.CONTACTED = 0;
    statusCounts.NOT_INTERESTED = 0;
    statusCounts.TODAY_FOLLOWUPS = 0;
    statusCounts.PENDING_FOLLOWUPS = 0;
    updateCountDisplay();
  }
}

function updateStatusCountsFromCurrentData() {
  // Update counts based on currently loaded enquiries
  statusCounts.NEW = enquiries.filter(e => !e.status || e.status === null).length;
  statusCounts.CONTACTED = enquiries.filter(e => e.status === 'CONTACTED').length;
  statusCounts.NOT_INTERESTED = enquiries.filter(e => e.status === 'NOT_INTERESTED').length;
  
  // Calculate today followups
  statusCounts.TODAY_FOLLOWUPS = enquiries.filter(e => 
    e.followUpDate && isToday(e.followUpDate)
  ).length;
  
  // Calculate pending followups
  statusCounts.PENDING_FOLLOWUPS = enquiries.filter(e => {
    // A. Overdue followups
    if (e.followUpDate && isPast(e.followUpDate)) return true;
    
    // B. No follow-up date set
    if (!e.followUpDate) return true;
    
    // C. New enquiry created today with no action taken today
    if (isCreatedToday(e) && !hasActionToday(e)) return true;
    
    return false;
  }).length;
  
  console.log('Updated status counts from current data:', statusCounts);
  updateCountDisplay();
}

function updateCountDisplay() {
  console.log('Updating count display with:', statusCounts);
  
  const countAll = document.getElementById('count-all');
  const countNew = document.getElementById('count-NEW');
  const countContacted = document.getElementById('count-CONTACTED');
  const countNotInterested = document.getElementById('count-NOT_INTERESTED');
  const countTodayFollowups = document.getElementById('count-TODAY_FOLLOWUPS');
  const countPendingFollowups = document.getElementById('count-PENDING_FOLLOWUPS');
  const totalDisplay = document.getElementById('totalCountDisplay');
  
  console.log('DOM Elements found:', { countAll, countContacted, countNotInterested, countTodayFollowups, countPendingFollowups, totalDisplay });
  
  if (countAll) countAll.textContent = statusCounts.all;
  if (countNew) countNew.textContent = statusCounts.NEW;
  if (countContacted) countContacted.textContent = statusCounts.CONTACTED;
  if (countNotInterested) countNotInterested.textContent = statusCounts.NOT_INTERESTED;
  if (countTodayFollowups) countTodayFollowups.textContent = statusCounts.TODAY_FOLLOWUPS;
  if (countPendingFollowups) countPendingFollowups.textContent = statusCounts.PENDING_FOLLOWUPS;
  if (totalDisplay) totalDisplay.textContent = `Total: ${statusCounts.all}`;
  
  console.log('Count display updated');
}

// ==================== QUICK FILTER FUNCTIONS ====================
function applyQuickFilter(filter) {
  // Show loading state immediately
  showLoadingState();
  
  currentQuickFilter = filter;
  currentPage = 1;
  
  // Update button active states
  document.querySelectorAll('[id^="quickBtn-"]').forEach(btn => {
    btn.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50');
  });
  
  const activeBtn = document.getElementById(`quickBtn-${filter}`);
  if (activeBtn) {
    activeBtn.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50');
  }
  
  // Load data with smooth transition
  loadEnquiries();
}

function resetAllFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('dateFromFilter').value = '';
  document.getElementById('dateToFilter').value = '';
  currentQuickFilter = 'all';
  currentPage = 1;
  
  // Reset button states
  applyQuickFilter('all');
}

// ==================== HELPER FUNCTIONS ====================
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-IN', { month: 'short' });
  return `${day} ${month}`;
}

function getFollowUpTooltip(enquiry) {
  let tooltip = '';
  
  // Add current status
  if (enquiry.status) {
    const statusInfo = STATUS_MAP[enquiry.status] || STATUS_MAP['null'];
    tooltip += `Status: ${statusInfo.label}`;
  }
  
  // Add follow-up date if exists
  if (enquiry.followUpDate) {
    const followUpDate = new Date(enquiry.followUpDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    followUpDate.setHours(0, 0, 0, 0);
    
    const diffTime = followUpDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let status = '';
    
    if (diffDays < 0) {
      status = 'Overdue';
    } else if (diffDays === 0) {
      status = 'Today';
    } else if (diffDays === 1) {
      status = 'Tomorrow';
    } else {
      status = formatDate(enquiry.followUpDate);
    }
    
    if (tooltip) tooltip += '\n';
    tooltip += `Follow-up: ${status}`;
  }
  
  // Add full timeline from status history (last 3 entries from end)
  if (enquiry.statusHistory && enquiry.statusHistory.length > 0) {
    if (tooltip) tooltip += '\n';
    tooltip += 'Timeline:';
    
    // Show last 3 status history entries (oldest 3)
    const recentHistory = enquiry.statusHistory.slice(-3);
    recentHistory.forEach((entry, index) => {
      const statusInfo = STATUS_MAP[entry.status] || { label: 'Unknown', color: 'bg-gray-100 text-gray-700 border-gray-200' };
      const dateStr = formatDate(entry.changedAt);
      
      if (tooltip) tooltip += '\n';
      tooltip += `${dateStr}: ${statusInfo.label}`;
      
      if (entry.note) {
        tooltip += ` - ${entry.note}`;
      }
    });
  }
  
  return tooltip ? `title="${tooltip}"` : '';
}

// ==================== DATE UTILITIES FOR FILTERING ====================
function getTodayDateString() {
  const today = new Date();
  return today.toISOString().split('T')[0]; // YYYY-MM-DD format
}

function isToday(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function isPast(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

function isCreatedToday(enquiry) {
  const createdDate = enquiry.createdAt ? new Date(enquiry.createdAt) : (enquiry.created_at ? new Date(enquiry.created_at) : null);
  if (!createdDate) return false;
  const today = new Date();
  return createdDate.toDateString() === today.toDateString();
}

function hasActionToday(enquiry) {
  // Check if any update was done on the same day as creation
  const createdDate = enquiry.createdAt ? new Date(enquiry.createdAt) : (enquiry.created_at ? new Date(enquiry.created_at) : null);
  if (!createdDate || !enquiry.statusHistory) return false;
  
  const createdDateString = createdDate.toDateString();
  return enquiry.statusHistory.some(entry => {
    const actionDate = new Date(entry.changedAt).toDateString();
    return actionDate === createdDateString;
  });
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
    const dateFrom = document.getElementById('dateFromFilter').value;
    const dateTo = document.getElementById('dateToFilter').value;

    // For status filters or all enquiries
    const params = {
      page: currentPage,
      limit: ITEMS_PER_PAGE
    };

    if (search) params.search = search;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    // Handle filter requests (send only filterType, no status)
    if (currentQuickFilter === 'TODAY_FOLLOWUPS') {
      params.filterType = 'today_followups';
    } else if (currentQuickFilter === 'PENDING_FOLLOWUPS') {
      params.filterType = 'pending_followups';
    } else if (currentQuickFilter === 'NEW') {
      params.filterType = 'new';
    } else if (currentQuickFilter === 'CONTACTED') {
      params.filterType = 'contacted';
    } else if (currentQuickFilter === 'NOT_INTERESTED') {
      params.filterType = 'not_interested';
    } else {
      params.filterType = 'all';
    }

    console.log('Loading enquiries with params:', params);
    console.log('Full API URL:', 'https://sssam-r3pz.onrender.com/api' + API_ENDPOINTS.ENQUIRIES.LIST);
    
    const res = await apiGet(API_ENDPOINTS.ENQUIRIES.LIST, params);
    console.log('Load enquiries response:', res);
    console.log('Response data structure:', {
        'res.data': res.data,
        'res.enquiries': res.enquiries,
        'res.pagination': res.pagination,
        'data type': typeof res.data,
        'data isArray': Array.isArray(res.data)
    });

    // Extract data based on response structure
    enquiries = res.data || res.enquiries || [];
    const pagination = res.pagination || {};
    totalPages = pagination.totalPages || 1;
    totalCount = pagination.totalCount || 0;
    
    console.log('Extracted enquiries:', enquiries.length);
    console.log('Pagination:', pagination);

    renderTable();
    renderMobileCards();
    updatePagination();
    
    // Update status counts with current filtered data
    updateStatusCountsFromCurrentData();
    
    // Re-enable filter buttons after loading
    document.querySelectorAll('[id^="quickBtn-"]').forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('opacity-50', 'cursor-not-allowed');
    });
  } catch (err) {
    console.error('Failed to load enquiries:', err);
    showError('Failed to load enquiries. Please try again.');
    renderEmptyState();
    
    // Re-enable filter buttons even on error
    document.querySelectorAll('[id^="quickBtn-"]').forEach(btn => {
      btn.disabled = false;
      btn.classList.remove('opacity-50', 'cursor-not-allowed');
    });
  }
}


function renderTable() {
  const tbody = document.getElementById('enquiriesTableBody');
  
  if (!enquiries.length) {
    renderEmptyState();
    return;
  }

  // Apply sorting if a column is selected
  let sortedEnquiries = [...enquiries];
  if (sortColumn) {
    sortedEnquiries.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortColumn) {
        case 'student':
          valueA = (a.name || '').toLowerCase();
          valueB = (b.name || '').toLowerCase();
          break;
        case 'course':
          // Handle both array and string formats
          valueA = Array.isArray(a.course)
            ? (a.course[0] || '-').toLowerCase()
            : (a.course || '-').toLowerCase();
          valueB = Array.isArray(b.course)
            ? (b.course[0] || '-').toLowerCase()
            : (b.course || '-').toLowerCase();
          break;
        case 'status':
          valueA = a.status || '';
          valueB = b.status || '';
          break;
        case 'counselor':
          valueA = (a.assignedTo?.name || a.counselorId?.name || 'Unassigned').toLowerCase();
          valueB = (b.assignedTo?.name || b.counselorId?.name || 'Unassigned').toLowerCase();
          break;
        case 'followUpDate':
          valueA = a.followUpDate ? new Date(a.followUpDate) : new Date(0);
          valueB = b.followUpDate ? new Date(b.followUpDate) : new Date(0);
          break;
        case 'createdDate':
          valueA = a.createdAt ? new Date(a.createdAt) : (a.created_at ? new Date(a.created_at) : new Date(0));
          valueB = b.createdAt ? new Date(b.createdAt) : (b.created_at ? new Date(b.created_at) : new Date(0));
          break;
        default:
          return 0;
      }
      
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const isUserAdmin = isAdmin();

  tbody.innerHTML = sortedEnquiries.map(enquiry => {
    const statusInfo = STATUS_MAP[enquiry.status] || STATUS_MAP['null'];
    const counselor = enquiry.assignedTo?.name || enquiry.counselorId?.name || 'Unassigned';
    const followUpDate = enquiry.followUpDate ? formatDate(enquiry.followUpDate) : '-';
    const followUpTooltip = getFollowUpTooltip(enquiry);
    const isUnassigned = !enquiry.assignedTo && !enquiry.counselorId;
    const showAssignButton = isUserAdmin && isUnassigned;

    return `
      <tr class="enquiry-row border-b border-gray-100 last:border-0 cursor-pointer hover:bg-blue-50/50 transition-colors" onclick="window.location.href='enquiry-detail.html?id=${enquiry._id}'" ${followUpTooltip}>
        <td class="px-4 py-3">
          <div class="font-medium text-gray-900">${enquiry.name || '-'}</div>
          <div class="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
            <i data-lucide="phone" class="w-3 h-3"></i>
            ${enquiry.mobile || '-'}
          </div>
          <div class="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
            <i data-lucide="mail" class="w-3 h-3"></i>
            ${enquiry.email || '-'}
          </div>
          <div class="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <i data-lucide="calendar" class="w-3 h-3"></i>
            ${enquiry.createdAt ? formatDate(enquiry.createdAt) : (enquiry.created_at ? formatDate(enquiry.created_at) : '-')}
          </div>
        </td>
        <td class="px-4 py-3 text-gray-700 text-sm">${formatCourses(enquiry.course)}</td>
        <td class="px-4 py-3 text-center">
          <span class="status-badge inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}">
            ${statusInfo.label}
          </span>
        </td>
        <td class="px-4 py-3 text-center text-sm text-gray-600">${counselor}</td>
        <td class="px-4 py-3 text-center text-sm text-gray-600">${followUpDate}</td>
        <td class="px-4 py-3 text-center" onclick="event.stopPropagation()">
          <div class="flex items-center justify-center gap-1">
            <button
              onclick="openUpdateModal('${enquiry._id}', '${enquiry.status}')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-sm font-medium transition-colors"
            >
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
              Action
            </button>
            <button
              onclick="openEditModal('${enquiry._id}')"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-sm font-medium transition-colors"
            >
              <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
              Edit
            </button>
            ${showAssignButton ? `
            <button
              onclick="openAssignModal('${enquiry._id}')"
              class="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs font-medium transition-colors"
              title="Assign to Counselor"
            >
              <i data-lucide="user-check" class="w-3.5 h-3.5"></i>
              Assign
            </button>
            ` : ''}
          </div>
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

  const isUserAdmin = isAdmin();

  container.innerHTML = enquiries.map(enquiry => {
    const statusInfo = STATUS_MAP[enquiry.status] || STATUS_MAP['null'];
    const isUnassigned = !enquiry.assignedTo && !enquiry.counselorId;
    const showAssignButton = isUserAdmin && isUnassigned;

    return `
      <div class="enquiry-card bg-white rounded-xl shadow-sm p-4 border border-gray-100 cursor-pointer hover:shadow-md transition-all" onclick="window.location.href='enquiry-detail.html?id=${enquiry._id}'">
        <div class="flex items-start justify-between mb-3">
          <div>
            <div class="font-semibold text-gray-800">${enquiry.name || '-'}</div>
            <div class="text-sm text-gray-500 flex items-center gap-1">
              <i data-lucide="phone" class="w-3 h-3"></i>
              ${enquiry.mobile || '-'}
            </div>
            <div class="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <i data-lucide="mail" class="w-3 h-3"></i>
              ${enquiry.email || '-'}
            </div>
            <div class="text-xs text-gray-400 flex items-center gap-1 mt-1">
              <i data-lucide="calendar" class="w-3 h-3"></i>
              ${enquiry.createdAt ? formatDate(enquiry.createdAt) : (enquiry.created_at ? formatDate(enquiry.created_at) : '-')}
            </div>
          </div>
          <span class="status-badge inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}">
            ${statusInfo.label}
          </span>
        </div>

        <div class="text-sm text-gray-600 mb-3">
          <span class="text-gray-400">Course:</span> ${formatCourses(enquiry.course)}
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-gray-100" onclick="event.stopPropagation();">
          <span class="text-xs text-gray-400">${enquiry.assignedTo?.name || 'Unassigned'}</span>
          <div class="flex items-center gap-2">
            ${showAssignButton ? `
            <button onclick="event.stopPropagation(); openAssignModal('${enquiry._id}')" class="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Assign">
              <i data-lucide="user-check" class="w-4 h-4"></i>
            </button>
            ` : ''}
            <button onclick="event.stopPropagation(); openUpdateModal('${enquiry._id}', '${enquiry.status}')" class="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
              <i data-lucide="refresh-cw" class="w-4 h-4"></i>
            </button>
            <button onclick="event.stopPropagation(); openEditModal('${enquiry._id}')" class="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Edit">
              <i data-lucide="pencil" class="w-4 h-4"></i>
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
  const tbody = document.getElementById('enquiriesTableBody');
  const mobileCards = document.getElementById('mobileCards');
  
  // Empty state for table
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-12">
          <div class="flex flex-col items-center gap-3">
            <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <i data-lucide="inbox" class="w-8 h-8 text-gray-400"></i>
            </div>
            <div>
              <p class="text-gray-800 font-medium">No enquiries found</p>
              <p class="text-gray-500 text-sm mt-1">Try adjusting your filters</p>
            </div>
          </div>
        </td>
      </tr>
    `;
  }
  
  // Empty state for mobile cards
  if (mobileCards) {
    mobileCards.innerHTML = `
      <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <i data-lucide="inbox" class="w-8 h-8 text-gray-400"></i>
        </div>
        <p class="text-gray-800 font-medium">No enquiries found</p>
        <p class="text-gray-500 text-sm mt-1">Try adjusting your filters</p>
      </div>
    `;
  }
  
  lucide.createIcons();
}

function showLoadingState() {
  const tbody = document.getElementById('enquiriesTableBody');
  const mobileCards = document.getElementById('mobileCards');
  
  // Show loading skeleton for table
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-12">
          <div class="flex flex-col items-center gap-3">
            <div class="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p class="text-gray-500 text-sm">Loading enquiries...</p>
          </div>
        </td>
      </tr>
    `;
  }
  
  // Show loading skeleton for mobile
  if (mobileCards) {
    mobileCards.innerHTML = `
      <div class="bg-white rounded-xl shadow-sm p-8 text-center">
        <div class="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
        <p class="text-gray-500 text-sm">Loading enquiries...</p>
      </div>
    `;
  }
  
  // Disable filter buttons during loading
  document.querySelectorAll('[id^="quickBtn-"]').forEach(btn => {
    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');
  });
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
  const referralContainer = document.getElementById('referralContainer');
  const walkInContainer = document.getElementById('walkInContainer');
  
  if (e.target.value === 'referral') {
    referralContainer.classList.remove('hidden');
    walkInContainer.classList.add('hidden');
  } else if (e.target.value === 'walk_in') {
    walkInContainer.classList.remove('hidden');
    referralContainer.classList.add('hidden');
  } else {
    referralContainer.classList.add('hidden');
    walkInContainer.classList.add('hidden');
  }
}

function clearFieldErrors() {
  const fields = ['addName', 'addMobile', 'addEmail', 'addCourse', 'addSource', 'addCustomCourse', 'addRefName', 'addRefContact', 'addWalkInBroughtBy'];
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

  // Course validation - at least one course must be selected
  const courses = getSelectedCourses();
  if (courses.length === 0) {
    document.getElementById('addCourseError').textContent = 'Please select a course';
    document.getElementById('addCourseError').classList.remove('hidden');
    document.getElementById('addCourse').classList.add('border-red-500');
    isValid = false;
  }

  // Custom course validation if "Other" is selected
  if (document.getElementById('addCourse').value === 'Other') {
    const customCourse = document.getElementById('addCustomCourse').value.trim();
    if (!customCourse) {
      document.getElementById('addCourseError').textContent = 'Please enter custom course name';
      document.getElementById('addCourseError').classList.remove('hidden');
      document.getElementById('addCustomCourse').classList.add('border-red-500');
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

  // Walk-in fields validation
  if (source === 'walk_in') {
    const broughtBy = document.getElementById('addWalkInBroughtBy').value.trim();
    
    if (!broughtBy) {
      document.getElementById('addWalkInBroughtByError').textContent = 'Brought by is required';
      showFieldError('addWalkInBroughtBy', 'addWalkInBroughtByError');
      isValid = false;
    }
  }

  return isValid;
}

async function submitAddEnquiry() {
  if (!validateAddForm()) return;

  // Get clean mobile number
  const mobileRaw = document.getElementById('addMobile').value;
  const cleanMobile = getCleanMobile(mobileRaw);
  
  // Check for duplicate mobile number
  // Note: Backend handles duplicate check and returns 409 error if duplicate found

  // Get submit button and show loading state
  const submitBtn = document.querySelector('#addModal button[onclick="submitAddEnquiry()"]');
  const originalBtnContent = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
  lucide.createIcons();

  try {
    const source = document.getElementById('addSource').value;
    const email = document.getElementById('addEmail').value.trim();

    // Get clean mobile number (10 digits only, no +91, no spaces)
    const mobileRaw = document.getElementById('addMobile').value;
    const cleanMobile = getCleanMobile(mobileRaw);

    // Get selected courses as array
    const courses = getSelectedCourses();

    // Build clean payload - only include fields with values
    const payload = {
      name: document.getElementById('addName').value.trim(),
      mobile: cleanMobile,  // Only 10 digits
      course: courses[0] || courses, // Send as string, not array
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

    // Only add walkInBroughtBy if source is walk_in
    if (source === 'walk_in') {
      const broughtBy = document.getElementById('addWalkInBroughtBy').value.trim();
      if (broughtBy) {
        payload.walkInBroughtBy = broughtBy;
      }
    }

    // Add followUpDate if provided
    const followUpDate = document.getElementById('addFollowUpDate')?.value;
    if (followUpDate) {
      payload.followUpDate = formatDateForAPI(followUpDate);
    }

    const res = await apiPost(API_ENDPOINTS.ENQUIRIES.CREATE, payload);
    
    console.log('Create enquiry response:', res);
    
    // Check if response is successful
    if (!res.success) {
        console.log('Create enquiry failed:', res.error?.message);
        
        // Check if it's a duplicate mobile error (409 status)
        if (res.statusCode === 409) {
            console.log('Duplicate mobile detected, fetching existing enquiry...');
            try {
                // Get existing enquiry by mobile number
                const mobile = payload.mobile;
                const checkResponse = await apiGet(API_ENDPOINTS.ENQUIRIES.LIST, { mobile: mobile, limit: 1 });
                
                console.log('Duplicate check response:', checkResponse);
                
                if (checkResponse.success && checkResponse.data && checkResponse.data.length > 0) {
                    const existingEnquiry = checkResponse.data[0];
                    console.log('Found existing enquiry:', existingEnquiry);
                    showDuplicateEnquiryPopup(existingEnquiry);
                    return;
                } else {
                    console.log('No existing enquiry found');
                }
            } catch (checkError) {
                console.log('Error checking for duplicate:', checkError);
            }
        }
        
        const message = res.error?.message || 'Failed to add enquiry';
        showError(message);
        return;
    }
    
    console.log('Create enquiry successful');

    // Reset form
    document.getElementById('addName').value = '';
    document.getElementById('addMobile').value = '';
    document.getElementById('addEmail').value = '';
    document.getElementById('addSource').value = '';
    document.getElementById('addRefName').value = '';
    document.getElementById('addRefContact').value = '';
    document.getElementById('addWalkInBroughtBy').value = '';
    document.getElementById('addCustomCourse').value = '';
    document.getElementById('referralContainer').classList.add('hidden');
    document.getElementById('walkInContainer').classList.add('hidden');
    document.getElementById('customCourseContainer').classList.add('hidden');

    // Reset course dropdown
    document.getElementById('addCourse').value = '';

    clearFieldErrors();

    closeAddModal();
    showToast('Success', 'Enquiry added successfully', 'success');
    loadStatusCounts(); // Refresh counts after adding new enquiry
    loadEnquiries();
  } catch (err) {
    console.error('Failed to create enquiry:', err);
    
    // Check if it's a duplicate mobile error (409 status)
    console.log('=== DUPLICATE DETECTION DEBUG ===');
    console.log('Error response structure:', err.response?.data);
    console.log('Error status:', err.response?.status);
    console.log('Errors object:', err.response?.data?.errors);
    
    if (err.response?.status === 409 && err.response?.data?.errors?.duplicate && err.response?.data?.errors?.existingEnquiry) {
      console.log('Duplicate mobile detected in catch block, showing popup');
      showDuplicateEnquiryPopup(err.response.data.errors.existingEnquiry);
      return;
    }
    
    console.log('Not a duplicate error, showing regular error message');
    
    const message = err.response?.data?.message || err.message || 'Failed to add enquiry';
    showError(message);
  } finally {
    // Restore button state
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnContent;
    lucide.createIcons();
  }
}

// ==================== DUPLICATE ENQUIRY POPUP ====================
function showDuplicateEnquiryPopup(existingEnquiry) {
  console.log('=== DUPLICATE POPUP DEBUG ===');
  console.log('showDuplicateEnquiryPopup called with:', existingEnquiry);
  
  const modal = document.getElementById('duplicateEnquiryModal');
  const content = document.getElementById('duplicateEnquiryModalContent');
  const details = document.getElementById('duplicateEnquiryDetails');
  
  console.log('Modal elements found:', {
    modal: !!modal,
    content: !!content,
    details: !!details
  });
  
  // Populate existing enquiry details
  details.innerHTML = `
    <div class="space-y-3">
      <div class="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-3">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
            <i data-lucide="user-x" class="text-amber-600 w-4 h-4"></i>
          </div>
          <div>
            <h3 class="font-semibold text-amber-800 text-sm">Existing Student</h3>
          </div>
        </div>
      </div>
      
      <div class="bg-white rounded-lg p-3 border border-gray-200">
        <h4 class="font-semibold text-gray-800 mb-3 flex items-center gap-2 text-sm">
          <i data-lucide="file-text" class="w-3.5 h-3.5 text-gray-600"></i>
          Details
        </h4>
        <div class="space-y-2 text-xs">
          <div class="flex justify-between items-center py-2 border-b border-gray-100">
            <span class="text-gray-500">Name</span>
            <span class="font-medium text-gray-900">${existingEnquiry.name}</span>
          </div>
          <div class="flex justify-between items-center py-2 border-b border-gray-100">
            <span class="text-gray-500">Mobile</span>
            <span class="font-medium text-gray-900">${existingEnquiry.mobile}</span>
          </div>
          <div class="flex justify-between items-center py-2 border-b border-gray-100">
            <span class="text-gray-500">Course</span>
            <span class="font-medium text-gray-900">${existingEnquiry.course}</span>
          </div>
          <div class="flex justify-between items-center py-2 border-b border-gray-100">
            <span class="text-gray-500">Status</span>
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              existingEnquiry.status === 'NEW' ? 'bg-blue-100 text-blue-800' :
              existingEnquiry.status === 'CONTACTED' ? 'bg-green-100 text-green-800' :
              existingEnquiry.status === 'CONVERTED' ? 'bg-purple-100 text-purple-800' :
              'bg-gray-100 text-gray-800'
            }">
              ${existingEnquiry.status}
            </span>
          </div>
          <div class="flex justify-between items-center py-2">
            <span class="text-gray-500">Created</span>
            <span class="font-medium text-gray-900">${formatDateForDisplay(existingEnquiry.createdAt)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Store existing enquiry ID for potential update
  const duplicateIdInput = document.getElementById('duplicateEnquiryId');
  if (duplicateIdInput) {
    duplicateIdInput.value = existingEnquiry._id;
    console.log('Set duplicateEnquiryId to:', existingEnquiry._id);
  } else {
    console.error('duplicateEnquiryId input not found');
  }
  
  // Show modal
  console.log('Showing duplicate modal...');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
    console.log('Modal should now be visible');
  }, 10);
  lucide.createIcons();
}

function closeDuplicateModal() {
  const modal = document.getElementById('duplicateEnquiryModal');
  const content = document.getElementById('duplicateEnquiryModalContent');
  
  modal.classList.add('opacity-0');
  content.classList.remove('scale-100');
  content.classList.add('scale-95');
  
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 200);
}

function updateExistingEnquiry() {
  const duplicateIdInput = document.getElementById('duplicateEnquiryId');
  const enquiryId = duplicateIdInput ? duplicateIdInput.value : null;
  
  console.log('=== UPDATE EXISTING ENQUIRY DEBUG ===');
  console.log('User chose to update existing enquiry:', enquiryId);
  
  if (!enquiryId) {
    console.error('No enquiry ID found for update');
    showError('Unable to update enquiry - missing ID');
    return;
  }
  
  // Close duplicate modal
  closeDuplicateModal();
  
  // Close add modal
  closeAddModal();
  
  // Open edit modal with existing enquiry data (same as table row edit)
  console.log('Opening edit modal for enquiry:', enquiryId);
  openEditModal(enquiryId);
}

function createNewEnquiryAnyway() {
  // Close duplicate modal and proceed with creation
  closeDuplicateModal();
  
  // Call submitAddEnquiry again but skip duplicate check
  submitAddEnquirySkipDuplicate();
}

async function submitAddEnquirySkipDuplicate() {
  // Get submit button and show loading state
  const submitBtn = document.querySelector('#addModal button[onclick="submitAddEnquiry()"]');
  const originalBtnContent = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
  lucide.createIcons();

  try {
    const source = document.getElementById('addSource').value;
    const email = document.getElementById('addEmail').value.trim();
    const mobileRaw = document.getElementById('addMobile').value;
    const cleanMobile = getCleanMobile(mobileRaw);
    const courses = getSelectedCourses();

    const payload = {
      name: document.getElementById('addName').value.trim(),
      mobile: cleanMobile,
      course: courses[0] || courses,
      source: source
    };

    if (email) payload.email = email;
    if (source === 'referral') {
      payload.referenceName = document.getElementById('addRefName').value.trim();
      payload.referenceContact = document.getElementById('addRefContact').value.trim();
    }
    if (source === 'walk_in') {
      const broughtBy = document.getElementById('addWalkInBroughtBy').value.trim();
      if (broughtBy) payload.walkInBroughtBy = broughtBy;
    }

    const res = await apiPost(API_ENDPOINTS.ENQUIRIES.CREATE, payload);
    
    if (!res.success) {
      const message = res.error?.message || 'Failed to add enquiry';
      showError(message);
      return;
    }

    // Reset form and close modal
    resetAddForm();
    closeAddModal();
    showToast('Success', 'Enquiry added successfully', 'success');
    loadStatusCounts();
    loadEnquiries();
  } catch (err) {
    console.error('Failed to create enquiry:', err);
    const message = err.response?.data?.message || 'Failed to add enquiry';
    showError(message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnContent;
    lucide.createIcons();
  }
}

function resetAddForm() {
  document.getElementById('addName').value = '';
  document.getElementById('addMobile').value = '';
  document.getElementById('addEmail').value = '';
  document.getElementById('addSource').value = '';
  document.getElementById('addRefName').value = '';
  document.getElementById('addRefContact').value = '';
  document.getElementById('addWalkInBroughtBy').value = '';
  document.getElementById('addCustomCourse').value = '';
  document.getElementById('referralContainer').classList.add('hidden');
  document.getElementById('walkInContainer').classList.add('hidden');
  document.getElementById('customCourseContainer').classList.add('hidden');
  document.querySelectorAll('.course-checkbox').forEach(cb => cb.checked = false);
  selectedCourses = [];
  updateSelectedCoursesDisplay();
  clearFieldErrors();
}

// ==================== EDIT ENQUIRY MODAL ====================
async function openEditModal(enquiryId) {
  try {
    const response = await apiGet(API_ENDPOINTS.ENQUIRIES.GET(enquiryId));
    
    // Handle nested response structure: {success: true, data: {enquiry: {...}}}
    const enquiry = response.data?.enquiry || response.data || response;
    
    if (!enquiry) {
      showToast('Error', 'Failed to load enquiry details', 'error');
      return;
    }
    
    // Set enquiry ID
    document.getElementById('editEnquiryId').value = enquiryId;
    
    // Basic fields
    document.getElementById('editName').value = enquiry.name || '';
    document.getElementById('editMobile').value = enquiry.mobile || '';
    document.getElementById('editEmail').value = enquiry.email || '';
    
    // Course field - handle different data structures
    const courseField = document.getElementById('editCourse');
    const customCourseContainer = document.getElementById('editCustomCourseContainer');
    const customCourseField = document.getElementById('editCustomCourse');
    
    console.log('Course data:', enquiry.course, enquiry.courseInterested);
    
    // Try different possible course field names
    let courseValue = enquiry.course || enquiry.courseInterested || '';
    if (Array.isArray(courseValue)) {
      courseValue = courseValue[0] || '';
    }
    
    courseField.value = courseValue;
    
    // Handle custom course
    if (courseValue === 'Other') {
      customCourseContainer.classList.remove('hidden');
      const customCourse = enquiry.customCourse || (Array.isArray(enquiry.courseInterested) ? enquiry.courseInterested[1] : '') || '';
      customCourseField.value = customCourse;
    } else {
      customCourseContainer.classList.add('hidden');
    }
    
    // Source field
    const sourceField = document.getElementById('editSource');
    sourceField.value = enquiry.source || '';
    
    // Handle referral fields
    const referralContainer = document.getElementById('editReferralContainer');
    const walkInContainer = document.getElementById('editWalkInContainer');
    const refNameField = document.getElementById('editRefName');
    const refContactField = document.getElementById('editRefContact');
    const walkInBroughtByField = document.getElementById('editWalkInBroughtBy');
    
    // Hide all containers first
    referralContainer.classList.add('hidden');
    walkInContainer.classList.add('hidden');
    
    // Show appropriate container based on source
    if (enquiry.source === 'referral') {
      referralContainer.classList.remove('hidden');
      refNameField.value = enquiry.referenceName || enquiry.refName || '';
      refContactField.value = enquiry.referenceContact || enquiry.refContact || '';
    } else if (enquiry.source === 'walk_in') {
      walkInContainer.classList.remove('hidden');
      walkInBroughtByField.value = enquiry.walkInBroughtBy || '';
    }
    
    console.log('All fields populated successfully');
    
    // Show modal
    const modal = document.getElementById('editModal');
    const content = document.getElementById('editModalContent');
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
      modal.classList.remove('opacity-0');
      content.classList.remove('scale-95');
      content.classList.add('scale-100');
    }, 10);
    lucide.createIcons();
  } catch (err) {
    console.error('Failed to load enquiry:', err);
    showToast('Error', 'Failed to load enquiry details', 'error');
  }
}

function closeEditModal() {
  const modal = document.getElementById('editModal');
  const content = document.getElementById('editModalContent');
  modal.classList.add('opacity-0');
  content.classList.remove('scale-100');
  content.classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 200);
}

function clearEditErrors() {
  const fields = ['editName','editMobile','editEmail','editCourse','editSource','editCustomCourse','editRefName','editRefContact','editWalkInBroughtBy'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('border-red-500','focus:border-red-500','focus:ring-red-100');
      el.classList.add('border-gray-200','focus:border-blue-500','focus:ring-blue-100');
    }
  });
  const errors = ['editNameError','editMobileError','editEmailError','editCourseError','editSourceError','editRefNameError','editRefContactError','editWalkInBroughtByError'];
  errors.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

function showEditFieldError(fieldId, errorId) {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(errorId);
  if (field) {
    field.classList.remove('border-gray-200','focus:border-blue-500','focus:ring-blue-100');
    field.classList.add('border-red-500','focus:border-red-500','focus:ring-red-100');
  }
  if (error) error.classList.remove('hidden');
}

function handleEditCourseChange(e) {
  const container = document.getElementById('editCustomCourseContainer');
  if (e.target.value === 'Other') container.classList.remove('hidden');
  else container.classList.add('hidden');
}

function handleEditSourceChange(e) {
  const referralContainer = document.getElementById('editReferralContainer');
  const walkInContainer = document.getElementById('editWalkInContainer');
  
  if (e.target.value === 'referral') {
    referralContainer.classList.remove('hidden');
    walkInContainer?.classList.add('hidden');
  } else if (e.target.value === 'walk_in') {
    walkInContainer?.classList.remove('hidden');
    referralContainer.classList.add('hidden');
  } else {
    referralContainer.classList.add('hidden');
    walkInContainer?.classList.add('hidden');
  }
}

function validateEditForm() {
  clearEditErrors();
  let isValid = true;
  const name = document.getElementById('editName').value.trim();
  const mobileRaw = document.getElementById('editMobile').value;
  const mobile = getCleanMobile(mobileRaw);
  const email = document.getElementById('editEmail').value.trim();
  const source = document.getElementById('editSource').value;
  const course = document.getElementById('editCourse').value;
  if (!name) { showEditFieldError('editName', 'editNameError'); isValid = false; }
  if (!mobile) {
    document.getElementById('editMobileError').textContent = 'Mobile number is required';
    showEditFieldError('editMobile', 'editMobileError');
    isValid = false;
  } else if (mobile.length !== 10) {
    document.getElementById('editMobileError').textContent = `Enter exactly 10 digits (current: ${mobile.length})`;
    showEditFieldError('editMobile', 'editMobileError');
    isValid = false;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showEditFieldError('editEmail', 'editEmailError');
    isValid = false;
  }
  if (!course) { showEditFieldError('editCourse', 'editCourseError'); isValid = false; }
  if (course === 'Other') {
    const customCourse = document.getElementById('editCustomCourse').value.trim();
    if (!customCourse) {
      document.getElementById('editCourseError').textContent = 'Please enter custom course name';
      showEditFieldError('editCustomCourse', 'editCourseError');
      isValid = false;
    }
  }
  if (!source) { showEditFieldError('editSource', 'editSourceError'); isValid = false; }
  if (source === 'referral') {
    const refName = document.getElementById('editRefName').value.trim();
    const refContact = document.getElementById('editRefContact').value.trim();
    if (!refName) {
      document.getElementById('editRefNameError').textContent = 'Reference name is required';
      showEditFieldError('editRefName', 'editRefNameError');
      isValid = false;
    }
    if (!refContact) {
      document.getElementById('editRefContactError').textContent = 'Reference contact is required';
      showEditFieldError('editRefContact', 'editRefContactError');
      isValid = false;
    } else if (!/^\d{10}$/.test(refContact)) {
      document.getElementById('editRefContactError').textContent = 'Enter exactly 10 digits';
      showEditFieldError('editRefContact', 'editRefContactError');
      isValid = false;
    }
  }

  // Walk-in fields validation
  if (source === 'walk_in') {
    const broughtBy = document.getElementById('editWalkInBroughtBy').value.trim();
    
    if (!broughtBy) {
      document.getElementById('editWalkInBroughtByError').textContent = 'Brought by is required';
      showEditFieldError('editWalkInBroughtBy', 'editWalkInBroughtByError');
      isValid = false;
    }
  }
  return isValid;
}

async function submitEditEnquiry() {
  if (!validateEditForm()) return;
  const submitBtn = document.querySelector('#editModal button[onclick="submitEditEnquiry()"]');
  const originalBtnContent = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
  lucide.createIcons();
  try {
    const enquiryId = document.getElementById('editEnquiryId').value;
    const source = document.getElementById('editSource').value;
    const email = document.getElementById('editEmail').value.trim();
    const mobileRaw = document.getElementById('editMobile').value;
    const cleanMobile = getCleanMobile(mobileRaw);
    const course = document.getElementById('editCourse').value;
    const customCourse = course === 'Other' ? document.getElementById('editCustomCourse').value.trim() : null;
    
    const payload = {
      name: document.getElementById('editName').value.trim(),
      mobile: cleanMobile,
      course: customCourse || course, // Send custom course if 'Other', otherwise send selected course
      source: source
    };
    
    if (email) payload.email = email;
    
    if (source === 'referral') {
      payload.referenceName = document.getElementById('editRefName').value.trim();
      payload.referenceContact = document.getElementById('editRefContact').value.trim();
    }
    
    if (source === 'walk_in') {
      const broughtBy = document.getElementById('editWalkInBroughtBy')?.value.trim();
      if (broughtBy) {
        payload.walkInBroughtBy = broughtBy;
      }
    }
    
    await apiPut(API_ENDPOINTS.ENQUIRIES.UPDATE(enquiryId), payload);
    closeEditModal();
    showToast('Success', 'Enquiry updated successfully', 'success');
    loadEnquiries();
  } catch (err) {
    console.error('Failed to update enquiry:', err);
    const message = err.response?.data?.message || 'Failed to update enquiry';
    showToast('Error', message, 'error');
  } finally {
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
  
  // Follow-up rules for 3-status system:
  // CONTACTED → follow-up REQUIRED
  // INTERESTED → follow-up OPTIONAL  
  // NOT_INTERESTED → follow-up NOT ALLOWED
  
  if (status === 'CONTACTED') {
    followUpRequired.classList.remove('hidden');
    followUpDate.required = true;
    followUpDate.disabled = false;
  } else if (status === 'INTERESTED') {
    followUpRequired.classList.add('hidden');
    followUpDate.required = false;
    followUpDate.disabled = false;
  } else if (status === 'NOT_INTERESTED') {
    followUpRequired.classList.add('hidden');
    followUpDate.required = false;
    followUpDate.disabled = true;
    followUpDate.value = ''; // Clear follow-up date
  } else {
    // No status selected
    followUpRequired.classList.add('hidden');
    followUpDate.required = false;
    followUpDate.disabled = false;
  }
  
  document.getElementById('followUpError').classList.add('hidden');
}

// Global flag to prevent duplicate API calls
let isUpdating = false;

async function submitUpdate() {
  // Prevent duplicate calls
  if (isUpdating) return;
  isUpdating = true;

  const enquiryId = document.getElementById('updateEnquiryId').value;
  const status = document.getElementById('updateStatus').value;
  const note = document.getElementById('updateNote').value.trim();
  const followUpDate = document.getElementById('updateFollowUpDate').value;

  // Get submit button and disable it
  const submitBtn = document.querySelector('#updateModal button[onclick="submitUpdate()"]');
  const originalBtnText = submitBtn ? submitBtn.innerHTML : null;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Please wait...';
    lucide.createIcons();
  }

  // Validation for 3-status system
  document.getElementById('updateNoteError').classList.add('hidden');
  document.getElementById('followUpError').classList.add('hidden');

  if (!note) {
    document.getElementById('updateNoteError').classList.remove('hidden');
    document.getElementById('updateNoteError').textContent = 'Note is required';
    isUpdating = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
    return;
  }

  // Follow-up validation rules:
  // CONTACTED → follow-up REQUIRED (throw error if missing)
  // INTERESTED → follow-up OPTIONAL (allow if missing)
  // NOT_INTERESTED → follow-up NOT ALLOWED (always set to null)
  
  if (status === 'CONTACTED' && !followUpDate) {
    document.getElementById('followUpError').classList.remove('hidden');
    document.getElementById('followUpError').textContent = 'Follow-up date required for Contacted';
    isUpdating = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
    return;
  }

  const payload = {
    status: status,
    note: note
  };

  // Handle follow-up date based on status
  if (status === 'NOT_INTERESTED') {
    payload.followUpDate = null; // Always null for NOT_INTERESTED
  } else if (followUpDate) {
    payload.followUpDate = followUpDate;
  }

  try {
    await apiPut(API_ENDPOINTS.ENQUIRIES.UPDATE(enquiryId), payload);
    closeUpdateModal();
    showToast('Success', 'Status updated successfully', 'success');
    loadEnquiries();
  } catch (err) {
    console.error('Failed to update status:', err);
    const message = err.response?.data?.message || 'Failed to update status';
    showError(message);
  } finally {
    // Reset flag and button
    isUpdating = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
      lucide.createIcons();
    }
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
    const res = await apiPost('/bulk-upload/enquiries', formData);
    
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
  // Updated to match new backend response format
  const data = results.data || {};
  const success = data.successCount || 0;
  const failed = data.failedCount || 0;
  const total = data.totalRows || 0;
  const errors = data.errors || [];

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
  console.log('=== TOAST DEBUG ===');
  console.log('showToast called with:', { title, message, type });
  
  const toast = document.getElementById('toast');
  const icon = document.getElementById('toastIcon');
  const titleEl = document.getElementById('toastTitle');
  const messageEl = document.getElementById('toastMessage');
  
  console.log('Toast elements found:', {
    toast: !!toast,
    icon: !!icon,
    titleEl: !!titleEl,
    messageEl: !!messageEl
  });

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

  console.log('Setting toast content and showing...');
  toast.classList.remove('hidden');
  lucide.createIcons();

  console.log('Toast should now be visible');
  
  // Auto hide after 3 seconds
  setTimeout(() => {
    console.log('Auto-hiding toast...');
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

// ==================== ASSIGN ENQUIRY MODAL ====================
let counselorsList = [];

function isAdmin() {
  const user = safeParseLocalStorage('user', {});
  return user.role === 'admin';
}

async function loadCounselors() {
  try {
    // Get counselors from the dedicated endpoint
    const res = await apiGet(API_ENDPOINTS.USERS.GET_COUNSELORS);
    counselorsList = res.users || res.data?.users || res.data || [];

    // Populate dropdown
    const select = document.getElementById('counselorSelect');
    // Keep the first option
    select.innerHTML = '<option value="">Select Counselor</option>';

    counselorsList.forEach(counselor => {
      const option = document.createElement('option');
      option.value = counselor._id;
      option.textContent = counselor.name || counselor.fullName || counselor.email;
      select.appendChild(option);
    });
  } catch (err) {
    console.error('Failed to load counselors:', err);
    // Fallback: show error in dropdown
    const select = document.getElementById('counselorSelect');
    select.innerHTML = '<option value="">Failed to load counselors</option>';
  }
}

function openAssignModal(enquiryId) {
  // Set enquiry ID
  document.getElementById('assignEnquiryId').value = enquiryId;

  // Reset form
  document.getElementById('counselorSelect').value = '';
  document.getElementById('counselorError').classList.add('hidden');
  document.getElementById('assignCurrentStatus').textContent = 'Unassigned';

  // Load counselors
  loadCounselors();

  // Show modal
  const modal = document.getElementById('assignModal');
  const modalContent = document.getElementById('assignModalContent');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    modalContent.classList.remove('scale-95');
    modalContent.classList.add('scale-100');
  }, 10);
  lucide.createIcons();
}

function closeAssignModal() {
  const modal = document.getElementById('assignModal');
  const modalContent = document.getElementById('assignModalContent');
  modal.classList.add('opacity-0');
  modalContent.classList.remove('scale-100');
  modalContent.classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 200);
}

let isAssigning = false;

async function submitAssign() {
  // Prevent duplicate calls
  if (isAssigning) return;

  const enquiryId = document.getElementById('assignEnquiryId').value;
  const counselorId = document.getElementById('counselorSelect').value;

  // Validate
  if (!counselorId) {
    document.getElementById('counselorError').classList.remove('hidden');
    return;
  }
  document.getElementById('counselorError').classList.add('hidden');

  isAssigning = true;

  // Get button and disable it
  const assignBtn = document.querySelector('#assignModal button[onclick="submitAssign()"]');
  const originalBtnText = assignBtn ? assignBtn.innerHTML : null;
  if (assignBtn) {
    assignBtn.disabled = true;
    assignBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Assigning...';
    lucide.createIcons();
  }

  try {
    await apiPut(API_ENDPOINTS.ENQUIRIES.ASSIGN(enquiryId), { counselorId });
    showToast('Success', 'Enquiry assigned successfully');
    closeAssignModal();
    // Reload enquiries to show updated assignment
    loadEnquiries();
  } catch (err) {
    console.error('Failed to assign enquiry:', err);
    showToast('Error', err.response?.data?.message || 'Failed to assign enquiry');
  } finally {
    isAssigning = false;
    if (assignBtn) {
      assignBtn.disabled = false;
      assignBtn.innerHTML = originalBtnText;
      lucide.createIcons();
    }
  }
}

// ==================== MULTI-SELECT COURSE FUNCTIONS ====================
let selectedCourses = [];

function toggleCourseDropdown() {
  const menu = document.getElementById('courseDropdownMenu');
  const icon = document.getElementById('courseDropdownIcon');

  if (menu.classList.contains('hidden')) {
    menu.classList.remove('hidden');
    icon.classList.add('rotate-180');
  } else {
    menu.classList.add('hidden');
    icon.classList.remove('rotate-180');
  }
}

function updateSelectedCoursesDisplay() {
  const display = document.getElementById('selectedCoursesDisplay');
  const checkboxes = document.querySelectorAll('.course-checkbox:checked');
  const otherCheckbox = document.getElementById('otherCourseCheckbox');
  const customCourse = document.getElementById('addCustomCourse').value.trim();

  selectedCourses = [];
  let html = '';

  checkboxes.forEach(checkbox => {
    const course = checkbox.value;
    if (course === 'Other') {
      if (customCourse) {
        selectedCourses.push(customCourse);
        html += `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg">${customCourse}<button onclick="removeCourse('Other')" class="hover:text-blue-900"><i data-lucide="x" class="w-3 h-3"></i></button></span>`;
      }
    } else {
      selectedCourses.push(course);
      html += `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-lg">${course}<button onclick="removeCourse('${course}')" class="hover:text-blue-900"><i data-lucide="x" class="w-3 h-3"></i></button></span>`;
    }
  });

  display.innerHTML = html;
  lucide.createIcons();

  // Update dropdown button text
  const dropdownText = document.getElementById('courseDropdownText');
  if (selectedCourses.length === 0) {
    dropdownText.textContent = 'Click to select courses...';
    dropdownText.classList.add('text-gray-500');
  } else {
    dropdownText.textContent = `${selectedCourses.length} course${selectedCourses.length > 1 ? 's' : ''} selected`;
    dropdownText.classList.remove('text-gray-500');
  }

  // Show/hide custom course container
  const customContainer = document.getElementById('customCourseContainer');
  if (otherCheckbox && otherCheckbox.checked) {
    customContainer.classList.remove('hidden');
  } else {
    customContainer.classList.add('hidden');
    document.getElementById('addCustomCourse').value = '';
  }

  // Clear error
  document.getElementById('addCourseError').classList.add('hidden');
}

function removeCourse(course) {
  if (course === 'Other') {
    const otherCheckbox = document.getElementById('otherCourseCheckbox');
    if (otherCheckbox) otherCheckbox.checked = false;
    document.getElementById('addCustomCourse').value = '';
  } else {
    const checkbox = document.querySelector(`.course-checkbox[value="${course}"]`);
    if (checkbox) checkbox.checked = false;
  }
  updateSelectedCoursesDisplay();
}

function getSelectedCourses() {
  const courseSelect = document.getElementById('addCourse');
  const customCourseInput = document.getElementById('addCustomCourse');
  const customCourseContainer = document.getElementById('customCourseContainer');
  
  if (courseSelect.value === 'Other' && customCourseContainer.classList.contains('hidden') === false) {
    // Other is selected and custom input is visible
    const customCourse = customCourseInput.value.trim();
    return customCourse ? [customCourse] : [];
  } else if (courseSelect.value && courseSelect.value !== 'Other') {
    // Regular course is selected
    return [courseSelect.value];
  }
  
  return [];
}

// Setup event listeners for course checkboxes
document.addEventListener('DOMContentLoaded', () => {
  // Course checkbox listeners
  document.querySelectorAll('.course-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', updateSelectedCoursesDisplay);
  });

  // Custom course input listener
  const customCourseInput = document.getElementById('addCustomCourse');
  if (customCourseInput) {
    customCourseInput.addEventListener('input', updateSelectedCoursesDisplay);
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('courseDropdownBtn');
    const menu = document.getElementById('courseDropdownMenu');
    if (dropdown && menu && !dropdown.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add('hidden');
      const icon = document.getElementById('courseDropdownIcon');
      if (icon) icon.classList.remove('rotate-180');
    }
  });
});
