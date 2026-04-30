/**
 * SSSAM CRM - Enquiry Page JavaScript
 * Indian CRM Style - Production Ready
 */

// ==================== STATE ====================
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let totalPages = 1;
let totalCount = 0;
let currentQuickFilter = 'all'; // 'all', 'today', or status values
let enquiries = [];
let selectedFile = null;

// Sorting state
let sortColumn = null;
let sortDirection = 'asc'; // 'asc' or 'desc'

// Status counts cache
let statusCounts = {
  all: 0,
  today: 0,
  NEW: 0,
  CONTACTED: 0,
  NO_RESPONSE: 0,
  FOLLOW_UP: 0,
  INTERESTED: 0,
  NOT_INTERESTED: 0,
  CONVERTED: 0
};

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

  if (filterParam === 'today') {
    applyQuickFilter('today');
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
    // Fetch all enquiries - first page with high limit
    const res = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, { page: 1, limit: 100 });
    console.log('API Response:', res);
    
    const allEnquiries = res.enquiries || [];
    console.log('All enquiries count:', allEnquiries.length);
    
    // Get total count from pagination
    const pagination = res.pagination || {};
    const totalCount = pagination.totalCount || allEnquiries.length;
    console.log('Total count from pagination:', totalCount);
    
    // Count by status from available data
    statusCounts.all = totalCount;
    statusCounts.NEW = allEnquiries.filter(e => e.status === 'NEW').length;
    statusCounts.CONTACTED = allEnquiries.filter(e => e.status === 'CONTACTED').length;
    statusCounts.NO_RESPONSE = allEnquiries.filter(e => e.status === 'NO_RESPONSE').length;
    statusCounts.FOLLOW_UP = allEnquiries.filter(e => e.status === 'FOLLOW_UP').length;
    statusCounts.INTERESTED = allEnquiries.filter(e => e.status === 'INTERESTED').length;
    statusCounts.NOT_INTERESTED = allEnquiries.filter(e => e.status === 'NOT_INTERESTED').length;
    statusCounts.CONVERTED = allEnquiries.filter(e => e.status === 'CONVERTED').length;
    
    // Count today calls (NEW enquiries + today follow-ups excluding CONVERTED and NOT_INTERESTED)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayNewCount = allEnquiries.filter(e => e.status === 'NEW').length;
    
    const todayFollowUpCount = allEnquiries.filter(e => {
      if (e.status === 'CONVERTED' || e.status === 'NOT_INTERESTED') return false;
      if (!e.followUpDate) return false;
      const followUpDate = new Date(e.followUpDate);
      followUpDate.setHours(0, 0, 0, 0);
      return followUpDate.getTime() === today.getTime();
    }).length;
    
    // Combine counts, avoiding duplicates (NEW enquiries with today follow-up)
    const newWithTodayFollowUp = allEnquiries.filter(e => 
      e.status === 'NEW' && 
      e.followUpDate && 
      new Date(e.followUpDate).setHours(0, 0, 0, 0) === today.getTime()
    ).length;
    
    statusCounts.today = todayNewCount + todayFollowUpCount - newWithTodayFollowUp;
    
    // Update UI
    updateCountDisplay();
  } catch (err) {
    console.error('Failed to load status counts:', err);
  }
}

function updateCountDisplay() {
  console.log('Updating count display with:', statusCounts);
  
  const countAll = document.getElementById('count-all');
  const countToday = document.getElementById('count-today');
  const countNew = document.getElementById('count-NEW');
  const countContacted = document.getElementById('count-CONTACTED');
  const countNoResponse = document.getElementById('count-NO_RESPONSE');
  const countFollowUp = document.getElementById('count-FOLLOW_UP');
  const countInterested = document.getElementById('count-INTERESTED');
  const countNotInterested = document.getElementById('count-NOT_INTERESTED');
  const countConverted = document.getElementById('count-CONVERTED');
  const totalDisplay = document.getElementById('totalCountDisplay');
  
  console.log('DOM Elements found:', { countAll, countToday, countNew, countContacted, countNoResponse, countFollowUp, countInterested, countNotInterested, countConverted, totalDisplay });
  
  if (countAll) countAll.textContent = statusCounts.all;
  if (countToday) countToday.textContent = statusCounts.today;
  if (countNew) countNew.textContent = statusCounts.NEW;
  if (countContacted) countContacted.textContent = statusCounts.CONTACTED;
  if (countNoResponse) countNoResponse.textContent = statusCounts.NO_RESPONSE;
  if (countFollowUp) countFollowUp.textContent = statusCounts.FOLLOW_UP;
  if (countInterested) countInterested.textContent = statusCounts.INTERESTED;
  if (countNotInterested) countNotInterested.textContent = statusCounts.NOT_INTERESTED;
  if (countConverted) countConverted.textContent = statusCounts.CONVERTED;
  if (totalDisplay) totalDisplay.textContent = `Total: ${statusCounts.all}`;
  
  console.log('Count display updated');
}

// ==================== QUICK FILTER FUNCTIONS ====================
function applyQuickFilter(filter) {
  currentQuickFilter = filter;
  currentPage = 1;
  
  // Update button active states
  const buttons = [
    'quickBtn-all', 'quickBtn-today', 'quickBtn-NEW', 'quickBtn-CONTACTED',
    'quickBtn-NO_RESPONSE', 'quickBtn-FOLLOW_UP', 'quickBtn-INTERESTED',
    'quickBtn-NOT_INTERESTED', 'quickBtn-CONVERTED'
  ];
  
  buttons.forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.classList.remove('ring-2', 'ring-offset-1', 'ring-gray-400', 'ring-blue-400', 'ring-yellow-400', 
        'ring-purple-400', 'ring-green-400', 'ring-red-400', 'ring-emerald-400');
    }
  });
  
  const activeBtnId = filter === 'all' ? 'quickBtn-all' : 
                      filter === 'today' ? 'quickBtn-today' : 
                      `quickBtn-${filter}`;
  const activeBtn = document.getElementById(activeBtnId);
  if (activeBtn) {
    activeBtn.classList.add('ring-2', 'ring-offset-1');
    
    // Set ring color based on filter
    if (filter === 'all' || filter === 'today') {
      activeBtn.classList.add('ring-gray-400');
    } else if (filter === 'NEW') {
      activeBtn.classList.add('ring-blue-400');
    } else if (filter === 'CONTACTED') {
      activeBtn.classList.add('ring-yellow-400');
    } else if (filter === 'NO_RESPONSE') {
      activeBtn.classList.add('ring-gray-400');
    } else if (filter === 'FOLLOW_UP') {
      activeBtn.classList.add('ring-purple-400');
    } else if (filter === 'INTERESTED') {
      activeBtn.classList.add('ring-green-400');
    } else if (filter === 'NOT_INTERESTED') {
      activeBtn.classList.add('ring-red-400');
    } else if (filter === 'CONVERTED') {
      activeBtn.classList.add('ring-emerald-400');
    }
  }
  
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
    const statusInfo = STATUS_MAP[enquiry.status] || STATUS_MAP['NEW'];
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
      const statusInfo = STATUS_MAP[entry.status] || STATUS_MAP['NEW'];
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

    // For Today Calls filter - fetch both NEW enquiries and today follow-ups
    if (currentQuickFilter === 'today') {
      const [newRes, followUpRes] = await Promise.all([
        apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, {
          page: 1,
          limit: 100,
          status: 'NEW'
        }),
        apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, {
          page: 1,
          limit: 100
        })
      ]);

      const newEnquiries = newRes.enquiries || [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Filter follow-up enquiries for today's date, excluding CONVERTED and NOT_INTERESTED
      const followUpEnquiries = (followUpRes.enquiries || []).filter(e => {
        if (e.status === 'CONVERTED' || e.status === 'NOT_INTERESTED') return false;
        if (!e.followUpDate) return false;
        const followUpDate = new Date(e.followUpDate);
        followUpDate.setHours(0, 0, 0, 0);
        return followUpDate.getTime() === today.getTime();
      });

      // Combine and remove duplicates
      const combined = [...newEnquiries, ...followUpEnquiries];
      const unique = combined.filter((item, index, self) =>
        index === self.findIndex((t) => t._id === item._id)
      );

      // Apply search filter
      let filteredEnquiries = unique;
      if (search) {
        const searchLower = search.toLowerCase();
        filteredEnquiries = filteredEnquiries.filter(e =>
          (e.name && e.name.toLowerCase().includes(searchLower)) ||
          (e.mobile && e.mobile.includes(search)) ||
          (e.email && e.email.toLowerCase().includes(searchLower)) ||
          // Handle both array and string formats for courseInterested
          (e.courseInterested && (
            Array.isArray(e.courseInterested)
              ? e.courseInterested.some(c => c.toLowerCase().includes(searchLower))
              : e.courseInterested.toLowerCase().includes(searchLower)
          ))
        );
      }

      // Apply date range filter
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        filteredEnquiries = filteredEnquiries.filter(e => {
          const createdDate = new Date(e.createdAt);
          createdDate.setHours(0, 0, 0, 0);
          return createdDate >= fromDate;
        });
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        filteredEnquiries = filteredEnquiries.filter(e => {
          const createdDate = new Date(e.createdAt);
          return createdDate <= toDate;
        });
      }

      // Sort: NEW first, then by follow-up date
      let allEnquiries = filteredEnquiries.sort((a, b) => {
        if (a.status === 'NEW' && b.status !== 'NEW') return -1;
        if (a.status !== 'NEW' && b.status === 'NEW') return 1;
        const dateA = a.followUpDate ? new Date(a.followUpDate) : new Date(8640000000000000);
        const dateB = b.followUpDate ? new Date(b.followUpDate) : new Date(8640000000000000);
        return dateA - dateB;
      });

      const totalCount = allEnquiries.length;
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const endIndex = startIndex + ITEMS_PER_PAGE;
      const paginatedEnquiries = allEnquiries.slice(startIndex, endIndex);

      totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;
      enquiries = paginatedEnquiries;

      renderTable();
      renderMobileCards();
      updatePagination(totalCount);
      return;
    }

    // For status filters or all enquiries
    const params = {
      page: currentPage,
      limit: ITEMS_PER_PAGE
    };

    if (search) params.search = search;
    if (currentQuickFilter !== 'all' && currentQuickFilter !== 'today') {
      params.status = currentQuickFilter;
    }
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    const res = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, params);

    enquiries = res.enquiries || [];
    const pagination = res.pagination || {};
    totalPages = pagination.totalPages || 1;
    totalCount = pagination.totalCount || 0;

    renderTable();
    renderMobileCards();
    updatePagination();
  } catch (err) {
    console.error('Failed to load enquiries:', err);
    showError('Failed to load enquiries. Please try again.');
    renderEmptyState();
  }
}

// Pagination update for Today tab (client-side pagination)
function updatePaginationToday(totalCount) {
  const start = totalCount > 0 ? ((currentPage - 1) * ITEMS_PER_PAGE) + 1 : 0;
  const end = Math.min(start + ITEMS_PER_PAGE - 1, totalCount);

  document.getElementById('showingFrom').textContent = start;
  document.getElementById('showingTo').textContent = end;
  document.getElementById('totalItems').textContent = totalCount;

  document.getElementById('firstPage').disabled = currentPage === 1;
  document.getElementById('prevPage').disabled = currentPage === 1;
  document.getElementById('nextPage').disabled = currentPage >= totalPages;
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

function updateCountDisplayToday(totalCount) {
  const countDisplay = document.getElementById('enquiryCountDisplay');
  countDisplay.textContent = `Total Calls: ${totalCount}`;
}

// ==================== RENDER FUNCTIONS ====================
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
          valueA = Array.isArray(a.courseInterested)
            ? (a.courseInterested[0] || '-').toLowerCase()
            : (a.courseInterested || '-').toLowerCase();
          valueB = Array.isArray(b.courseInterested)
            ? (b.courseInterested[0] || '-').toLowerCase()
            : (b.courseInterested || '-').toLowerCase();
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
    const statusInfo = STATUS_MAP[enquiry.status] || STATUS_MAP['NEW'];
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
        </td>
        <td class="px-4 py-3 text-gray-700 text-sm">${formatCourses(enquiry.courseInterested)}</td>
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
              class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium transition-colors"
            >
              <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>
              Action
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
    const statusInfo = STATUS_MAP[enquiry.status] || STATUS_MAP['NEW'];
    const isUnassigned = !enquiry.assignedTo && !enquiry.counselorId;
    const showAssignButton = isUserAdmin && isUnassigned;

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
          <span class="text-gray-400">Course:</span> ${formatCourses(enquiry.courseInterested)}
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-gray-100" onclick="event.stopPropagation();">
          <span class="text-xs text-gray-400">${enquiry.assignedTo?.name || 'Unassigned'}</span>
          <div class="flex items-center gap-2">
            ${showAssignButton ? `
            <button onclick="event.stopPropagation(); openAssignModal('${enquiry._id}')" class="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Assign">
              <i data-lucide="user-check" class="w-4 h-4"></i>
            </button>
            ` : ''}
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
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="text-center py-12">
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
      <td colspan="6" class="text-center py-12">
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
    document.getElementById('addCourseError').textContent = 'Please select at least one course';
    document.getElementById('addCourseError').classList.remove('hidden');
    document.getElementById('courseDropdownBtn').classList.add('border-red-500');
    isValid = false;
  }

  // Custom course validation if "Other" is selected
  const otherCheckbox = document.getElementById('otherCourseCheckbox');
  if (otherCheckbox && otherCheckbox.checked) {
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
      courseInterested: courses, // Now sends as array
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

    await apiPost(API_ENDPOINTS.ENQUIRIES.CREATE, payload);

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

    // Reset course checkboxes
    document.querySelectorAll('.course-checkbox').forEach(cb => cb.checked = false);
    selectedCourses = [];
    updateSelectedCoursesDisplay();

    clearFieldErrors();

    closeAddModal();
    showToast('Success', 'Enquiry added successfully', 'success');
    loadStatusCounts(); // Refresh counts after adding new enquiry
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

  // Validation
  document.getElementById('updateNoteError').classList.add('hidden');
  document.getElementById('followUpError').classList.add('hidden');

  if (!note) {
    document.getElementById('updateNoteError').classList.remove('hidden');
    isUpdating = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
    return;
  }

  if (status === 'FOLLOW_UP' && !followUpDate) {
    document.getElementById('followUpError').classList.remove('hidden');
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
  return selectedCourses;
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
