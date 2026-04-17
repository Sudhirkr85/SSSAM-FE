let enquiries = [];
let selectedId = null;
let selectedCurrentStatus = ''; // Track current status for quick update modal
let allEnquiries = []; // Store all for client-side filtering
let filteredEnquiries = []; // After filters applied

// Pagination state
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let totalPages = 1;

// Sorting state
let sortColumn = 'createdAt';
let sortDirection = 'desc';

/* ======================
USER PROFILE DISPLAY
====================== */
function updateUserProfileDisplay() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const name = user.name || user.fullName || 'User';
  const role = user.role || 'counselor';

  // Get initials from name
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  // Update navbar display elements
  const initialsEl = document.getElementById('userInitials');
  const nameEl = document.getElementById('userNameDisplay');
  const roleEl = document.getElementById('userRoleDisplay');

  if (initialsEl) initialsEl.textContent = initials;
  if (nameEl) nameEl.textContent = name;
  if (roleEl) roleEl.textContent = role.charAt(0).toUpperCase() + role.slice(1);
}

/* ======================
INIT
====================== */
document.addEventListener('DOMContentLoaded', () => {
  // Set initial view based on role
  if (isCounselor()) {
    currentView = 'all'; // Counselors now see all enquiries by default
    // Show view tabs for counselors
    const viewTabs = document.getElementById('viewTabs');
    if (viewTabs) {
      viewTabs.classList.remove('hidden');
    }
    // Show "My Leads" tab for counselors to filter to their own
    const myLeadsTab = document.querySelector('[data-view-tab="my-leads"]');
    if (myLeadsTab) {
      myLeadsTab.classList.remove('hidden');
    }
  } else {
    // Admin sees all enquiries by default
    currentView = 'all';
  }

  // Set default status filter to NEW
  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) {
    statusFilter.value = 'NEW';
  }

  // Update user profile display in navbar
  updateUserProfileDisplay();

  // Always load enquiries with default filter
  loadEnquiries();

  document.getElementById('searchInput').addEventListener('input', () => {
    currentPage = 1;
    filterData();
  });
  document.getElementById('statusFilter').addEventListener('change', () => {
    currentPage = 1;
    filterData();
  });
  document.getElementById('resetFilters').addEventListener('click', () => {
    // Reset to default view - both admin and counselor default to 'all'
    currentView = 'all';
    updateViewTabs();
    resetFilters();
  });

  // Close action dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.action-dropdown-container')) {
      closeAllActionDropdowns();
    }
  });

  // Course dropdown change handler (create modal)
  const courseSelect = document.getElementById('course');
  if (courseSelect) {
    courseSelect.addEventListener('change', handleCourseChange);
  }

  // Mobile input - numbers only
  const mobileInput = document.getElementById('mobile');
  if (mobileInput) {
    mobileInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
      validateMobile();
    });
  }

  // Email validation on blur
  const emailInput = document.getElementById('email');
  if (emailInput) {
    emailInput.addEventListener('blur', validateEmail);
  }

  // Name validation on blur
  const nameInput = document.getElementById('name');
  if (nameInput) {
    nameInput.addEventListener('blur', validateName);
  }
});

/* ======================
LOAD DATA - ROLE BASED
====================== */
let paginationData = { page: 1, totalPages: 1, totalCount: 0 };
let currentView = 'all'; // 'all', 'my-leads', 'unassigned'

async function loadEnquiries() {
  try {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const status = document.getElementById('statusFilter').value;

    const params = {
      page: currentPage,
      limit: ITEMS_PER_PAGE,
      sortBy: sortColumn,
      sortOrder: sortDirection
    };

    if (search) params.search = search;
    if (status) params.status = status;

    // Role-based endpoint selection
    let endpoint;
    if (isCounselor()) {
      // Counselor: use assignedTo filter based on current view
      if (currentView === 'unassigned') {
        params.assignedTo = 'null';
      } else if (currentView === 'my-leads') {
        params.assignedTo = 'me';
      }
      // For 'all' or 'all-readonly' view, don't set assignedTo filter - show all enquiries
      endpoint = API_ENDPOINTS.ENQUIRIES.GET_ALL;
    } else {
      // Admin: can view all or use GET_ALL_ADMIN for read-only view
      endpoint = currentView === 'all-readonly'
        ? API_ENDPOINTS.ENQUIRIES.GET_ALL_ADMIN
        : API_ENDPOINTS.ENQUIRIES.GET_ALL;
    }

    const res = await apiGet(endpoint, params);

    // API returns { enquiries: [...], pagination: {...} }
    allEnquiries = res.enquiries || [];
    paginationData = res.pagination || { page: 1, totalPages: 1, totalCount: 0 };
    totalPages = paginationData.totalPages || 1;

    renderTable(allEnquiries);
    updatePaginationInfoFromServer(paginationData);
    updateSortIcons();
  } catch (err) {
    handleEnquiryError(err, 'Failed to load enquiries');
    renderEmptyState();
  }
}

/* ======================
SORTING
====================== */
function sortBy(column) {
  if (sortColumn === column) {
    // Toggle direction if same column
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    // New column, default to ascending
    sortColumn = column;
    sortDirection = 'asc';
  }
  currentPage = 1;
  loadEnquiries();
}

function updateSortIcons() {
  // Reset all sort icons
  document.querySelectorAll('.sort-icon').forEach(icon => {
    icon.className = 'sort-icon inline-block w-3 h-3 ml-1 text-gray-400 transition-transform';
    icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg>';
  });

  // Update active sort icon
  const activeIcon = document.getElementById(`sort-${sortColumn}`);
  if (activeIcon) {
    activeIcon.className = `sort-icon inline-block w-3 h-3 ml-1 text-blue-600 transition-transform ${sortDirection === 'asc' ? 'rotate-180' : ''}`;
    activeIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>';
  }
}

/* ======================
ERROR HANDLING - PRODUCTION READY
====================== */
function handleEnquiryError(error, defaultMessage = 'An error occurred') {
  const status = error.response?.status;
  const message = error.response?.data?.message || defaultMessage;

  switch (status) {
    case 403:
      // Access denied - show proper popup
      showErrorPopup(
        'Access Denied',
        message,
        'You do not have permission to perform this action. Only admins or assigned counselors can modify enquiries.'
      );
      break;

    case 400:
      // Validation error
      showErrorPopup(
        'Validation Error',
        message,
        'Please check your input and try again. Ensure all required fields are filled correctly.'
      );
      break;

    case 404:
      showErrorPopup(
        'Not Found',
        'Enquiry not found',
        'The enquiry you are looking for may have been deleted or does not exist.'
      );
      break;

    case 409:
      // Conflict - already converted or invalid status transition
      showErrorPopup(
        'Action Not Allowed',
        message,
        'This enquiry may already be converted or in a terminal state that cannot be modified.'
      );
      break;

    default:
      // Network or server error
      showErrorPopup(
        'Error',
        message,
        'Please check your internet connection and try again. If the problem persists, contact support.'
      );
  }
}

function showErrorPopup(title, message, description = '') {
  // Create and show a proper error modal for production
  const modal = document.createElement('div');
  modal.id = 'errorPopup';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
      <div class="flex items-center gap-4 mb-4">
        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
          <i data-lucide="alert-circle" class="text-red-600 w-6 h-6"></i>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-800">${title}</h3>
          <p class="text-sm text-red-600 font-medium">${message}</p>
        </div>
      </div>
      ${description ? `<p class="text-sm text-gray-500 mb-5 bg-gray-50 p-3 rounded-lg">${description}</p>` : ''}
      <div class="flex gap-3">
        <button onclick="closeErrorPopup()" class="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors font-medium">
          Dismiss
        </button>
        ${status === 403 && isCounselor() ? `
        <button onclick="closeErrorPopup(); window.location.href='dashboard.html'" class="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium">
          Go to Dashboard
        </button>
        ` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  lucide.createIcons();
}

function closeErrorPopup() {
  const modal = document.getElementById('errorPopup');
  if (modal) {
    modal.remove();
  }
}

/* ======================
VIEW SWITCHERS (Role Based)
====================== */
function switchToMyLeads() {
  currentView = 'my-leads';
  currentPage = 1;
  // Keep status filter as is (NEW by default)
  loadEnquiries();
  updateViewTabs();
}

function switchToUnassigned() {
  if (!isCounselor() && !isAdmin()) {
    showErrorPopup('Access Denied', 'You do not have permission to view unassigned leads');
    return;
  }
  currentView = 'unassigned';
  currentPage = 1;
  // Keep status filter as is (NEW by default)
  loadEnquiries();
  updateViewTabs();
}

function switchToAll() {
  // Both admin and counselor can view all enquiries
  currentView = 'all';
  currentPage = 1;
  loadEnquiries();
  updateViewTabs();
}

function switchToAllReadonly() {
  // Redirect to regular all view - deprecated, use switchToAll
  switchToAll();
}

function updateViewTabs() {
  // Update tab styling based on current view
  document.querySelectorAll('[data-view-tab]').forEach(tab => {
    const view = tab.dataset.viewTab;
    if (view === currentView) {
      tab.classList.add('bg-blue-600', 'text-white');
      tab.classList.remove('bg-gray-100', 'text-gray-600');
    } else {
      tab.classList.remove('bg-blue-600', 'text-white');
      tab.classList.add('bg-gray-100', 'text-gray-600');
    }
  });
}

/* ======================
FILTER
====================== */
function filterData() {
  // Server-side filtering - just reset to page 1 and reload
  currentPage = 1;
  loadEnquiries();
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('statusFilter').value = 'NEW';
  currentPage = 1;
  filterData();
}

/* ======================
PAGINATION
====================== */
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
RENDER
====================== */
function renderTable(data) {
  const table = document.getElementById('enquiryTable');

  if (!data.length) {
    renderEmptyState();
    return;
  }

  table.innerHTML = data.map(e => {
    const isConverted = e.status === 'CONVERTED';
    const counselor = e.assignedTo || e.counselorId || e.counselor;
    const counselorName = counselor?.name || counselor?.fullName || 'Unassigned';

    return `
    <tr class="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 cursor-pointer" onclick="window.location.href='enquiry-detail.html?id=${e._id}'">
      <td class="px-6 py-4">
        <div class="font-medium text-gray-900">${e.name || '-'}</div>
        <div class="text-xs text-gray-500">${e.mobile || ''}</div>
      </td>
      <td class="px-6 py-4 text-gray-700">${e.courseInterested || '-'}</td>
      <td class="px-6 py-4 text-gray-600">${counselorName}</td>
      <td class="px-6 py-4">${getStatusBadge(e.status)}</td>
      <td class="px-6 py-4 text-gray-600">${!isConverted && e.followUpDate ? formatDate(e.followUpDate) : '-'}</td>
      <td class="px-6 py-4 text-center" onclick="event.stopPropagation()">
        ${getActionButtons(e._id, e.status, e.assignedTo?._id || e.assignedTo || e.counselorId?._id || e.counselorId)}
      </td>
    </tr>
  `}).join('');
}

function renderEmptyState() {
  const table = document.getElementById('enquiryTable');
  table.innerHTML = `
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
}

/* ======================
CREATE
====================== */
function openCreateModal() {
  const modal = document.getElementById('createModal');
  const modalContent = document.getElementById('createModalContent');
  modal.classList.remove('hidden');
  // Trigger animation
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    modalContent.classList.remove('scale-95');
    modalContent.classList.add('scale-100');
  }, 10);
  lucide.createIcons();
}

function closeCreateModal() {
  const modal = document.getElementById('createModal');
  const modalContent = document.getElementById('createModalContent');
  modal.classList.add('opacity-0');
  modalContent.classList.remove('scale-100');
  modalContent.classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
    resetCreateForm();
  }, 300);
}

function resetCreateForm() {
  document.getElementById('createEnquiryForm').reset();
  document.getElementById('customCourseContainer').classList.add('hidden');
  // Clear all errors
  document.querySelectorAll('[id$="Error"]').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('input, select').forEach(el => {
    el.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
    el.classList.add('border-gray-200', 'focus:border-blue-500', 'focus:ring-blue-100');
  });
}

function handleCourseChange(e) {
  const customContainer = document.getElementById('customCourseContainer');
  if (e.target.value === 'Other') {
    customContainer.classList.remove('hidden');
  } else {
    customContainer.classList.add('hidden');
    document.getElementById('customCourse').value = '';
  }
}

/* ======================
VALIDATION
====================== */
function validateName() {
  const name = document.getElementById('name');
  const error = document.getElementById('nameError');
  if (!name.value.trim()) {
    showFieldError(name, error, 'Name is required');
    return false;
  }
  clearFieldError(name, error);
  return true;
}

function validateMobile() {
  const mobile = document.getElementById('mobile');
  const error = document.getElementById('mobileError');
  const mobileRegex = /^\d{10}$/;
  if (!mobileRegex.test(mobile.value)) {
    showFieldError(mobile, error, 'Enter valid 10-digit number');
    return false;
  }
  clearFieldError(mobile, error);
  return true;
}

function validateEmail() {
  const email = document.getElementById('email');
  const error = document.getElementById('emailError');
  if (!email.value.trim()) {
    clearFieldError(email, error);
    return true;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.value)) {
    showFieldError(email, error, 'Enter valid email');
    return false;
  }
  clearFieldError(email, error);
  return true;
}

function validateCourse() {
  const course = document.getElementById('course');
  const error = document.getElementById('courseError');
  if (!course.value) {
    showFieldError(course, error, 'Select a course');
    return false;
  }
  clearFieldError(course, error);

  // If Other, validate custom course
  if (course.value === 'Other') {
    const customCourse = document.getElementById('customCourse');
    const customError = document.getElementById('customCourseError');
    if (!customCourse.value.trim()) {
      showFieldError(customCourse, customError, 'Enter course name');
      return false;
    }
    clearFieldError(customCourse, customError);
  }
  return true;
}

function showFieldError(input, errorEl, message) {
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
  input.classList.remove('border-gray-200', 'focus:border-blue-500', 'focus:ring-blue-100');
  input.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
}

function clearFieldError(input, errorEl) {
  errorEl.classList.add('hidden');
  input.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
  input.classList.add('border-gray-200', 'focus:border-blue-500', 'focus:ring-blue-100');
}

async function createEnquiry() {
  // Run all validations
  const isNameValid = validateName();
  const isMobileValid = validateMobile();
  const isEmailValid = validateEmail();
  const isCourseValid = validateCourse();

  if (!isNameValid || !isMobileValid || !isEmailValid || !isCourseValid) {
    showErrorPopup(
      'Validation Required',
      'Please fill in all required fields correctly',
      'Name, mobile number (10 digits), email, and course selection are required.'
    );
    return;
  }

  const name = document.getElementById('name').value.trim();
  const mobile = document.getElementById('mobile').value;
  const email = document.getElementById('email').value.trim();
  let course = document.getElementById('course').value;

  // If Other, use custom course
  if (course === 'Other') {
    course = document.getElementById('customCourse').value.trim();
  }

  try {
    const response = await apiPost(API_ENDPOINTS.ENQUIRIES.CREATE, {
      name,
      mobile,
      email: email || undefined,
      courseInterested: course
    });

    showToast('success', 'Enquiry created successfully');
    closeCreateModal();
    loadEnquiries();
  } catch (err) {
    handleEnquiryError(err, 'Failed to create enquiry');
  }
}

/* ======================
UPDATE STATUS
====================== */
function openModal(id) {
  selectedId = id;
  const modal = document.getElementById('statusModal');
  const modalContent = document.getElementById('statusModalContent');

  // Reset form
  document.getElementById('statusSelect').value = 'CONTACTED';
  document.getElementById('statusNote').value = '';
  document.getElementById('followUpDate').value = '';
  clearStatusErrors();

  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    modalContent.classList.remove('scale-95');
    modalContent.classList.add('scale-100');
  }, 10);
  lucide.createIcons();
}

function closeModal() {
  const modal = document.getElementById('statusModal');
  const modalContent = document.getElementById('statusModalContent');
  modal.classList.add('opacity-0');
  modalContent.classList.remove('scale-100');
  modalContent.classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

function clearStatusErrors() {
  const noteError = document.getElementById('statusNoteError');
  const noteInput = document.getElementById('statusNote');
  noteError.classList.add('hidden');
  noteInput.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
  noteInput.classList.add('border-gray-200', 'focus:border-blue-500', 'focus:ring-blue-100');
}

function validateStatusNote() {
  const note = document.getElementById('statusNote');
  const error = document.getElementById('statusNoteError');
  if (!note.value.trim()) {
    error.classList.remove('hidden');
    note.classList.remove('border-gray-200', 'focus:border-blue-500', 'focus:ring-blue-100');
    note.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
    return false;
  }
  error.classList.add('hidden');
  note.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
  note.classList.add('border-gray-200', 'focus:border-blue-500', 'focus:ring-blue-100');
  return true;
}

function openConfirmModal() {
  // First validate
  if (!validateStatusNote()) {
    showToast('error', 'Please add a note');
    return;
  }

  // Get values
  const status = document.getElementById('statusSelect');
  const note = document.getElementById('statusNote').value;
  const statusText = status.options[status.selectedIndex].text;

  // Populate confirm modal
  document.getElementById('confirmStatusText').textContent = statusText;
  document.getElementById('confirmNoteText').textContent = note;

  // Show confirm modal
  const modal = document.getElementById('confirmModal');
  const modalContent = document.getElementById('confirmModalContent');
  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    modalContent.classList.remove('scale-95');
    modalContent.classList.add('scale-100');
  }, 10);
}

function closeConfirmModal() {
  const modal = document.getElementById('confirmModal');
  const modalContent = document.getElementById('confirmModalContent');
  modal.classList.add('opacity-0');
  modalContent.classList.remove('scale-100');
  modalContent.classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

async function executeUpdate() {
  const status = document.getElementById('statusSelect').value;
  const note = document.getElementById('statusNote').value;
  const followUpDate = document.getElementById('followUpDate').value;

  // Validate follow-up date if status is FOLLOW_UP
  if (status === 'FOLLOW_UP' && !followUpDate) {
    showErrorPopup(
      'Follow-up Date Required',
      'Please select a follow-up date',
      'When setting status to "Follow Up", a follow-up date is mandatory.'
    );
    return;
  }

  try {
    const response = await apiPut(API_ENDPOINTS.ENQUIRIES.UPDATE_STATUS(selectedId), {
      status,
      note,
      followUpDate
    });

    // Handle auto-assignment response
    const responseData = response.data || response;
    if (responseData?.autoAssigned) {
      showSuccessPopup(
        'Lead Assigned!',
        'This lead has been auto-assigned to you',
        'You are now the assigned counselor for this enquiry. You can track it in your "My Leads" section.'
      );
    }

    // Handle conversion requiring payment setup
    if (responseData?.requiresPaymentSetup) {
      showConfirmPopup(
        'Student Converted!',
        'The student has been marked as converted. Set up payment details now?',
        'This will create an admission record and allow you to collect fees.',
        () => {
          // Navigate to admission creation
          window.location.href = `admission-detail.html?enquiryId=${selectedId}`;
        },
        () => {
          // User declined, just close and refresh
          closeConfirmModal();
          closeModal();
          loadEnquiries();
        }
      );
      return;
    }

    showToast('success', 'Status updated successfully');
    closeConfirmModal();
    closeModal();
    loadEnquiries();
  } catch (err) {
    handleEnquiryError(err, 'Failed to update status');
  }
}

/* ======================
SUCCESS & CONFIRM POPUPS
====================== */
function showSuccessPopup(title, message, description = '') {
  const modal = document.createElement('div');
  modal.id = 'successPopup';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
      <div class="flex items-center gap-4 mb-4">
        <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
          <i data-lucide="check-circle" class="text-green-600 w-6 h-6"></i>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-800">${title}</h3>
          <p class="text-sm text-green-600 font-medium">${message}</p>
        </div>
      </div>
      ${description ? `<p class="text-sm text-gray-500 mb-5 bg-gray-50 p-3 rounded-lg">${description}</p>` : ''}
      <button onclick="closeSuccessPopup()" class="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors font-medium">
        Great!
      </button>
    </div>
  `;
  document.body.appendChild(modal);
  lucide.createIcons();
}

function closeSuccessPopup() {
  const modal = document.getElementById('successPopup');
  if (modal) {
    modal.remove();
  }
}

function showConfirmPopup(title, message, description, onConfirm, onCancel) {
  const modal = document.createElement('div');
  modal.id = 'confirmActionPopup';
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl transform scale-100 animate-in fade-in zoom-in duration-200">
      <div class="flex items-center gap-4 mb-4">
        <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
          <i data-lucide="help-circle" class="text-blue-600 w-6 h-6"></i>
        </div>
        <div>
          <h3 class="text-lg font-semibold text-gray-800">${title}</h3>
          <p class="text-sm text-blue-600 font-medium">${message}</p>
        </div>
      </div>
      ${description ? `<p class="text-sm text-gray-500 mb-5 bg-gray-50 p-3 rounded-lg">${description}</p>` : ''}
      <div class="flex gap-3">
        <button id="confirmActionBtn" class="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors font-medium">
          Yes, Proceed
        </button>
        <button id="cancelActionBtn" class="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors font-medium">
          Not Now
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Attach event listeners
  document.getElementById('confirmActionBtn').addEventListener('click', () => {
    closeConfirmActionPopup();
    if (onConfirm) onConfirm();
  });
  document.getElementById('cancelActionBtn').addEventListener('click', () => {
    closeConfirmActionPopup();
    if (onCancel) onCancel();
  });

  lucide.createIcons();
}

function closeConfirmActionPopup() {
  const modal = document.getElementById('confirmActionPopup');
  if (modal) {
    modal.remove();
  }
}

/* ======================
QUICK UPDATE MODAL (Direct Notes)
====================== */
function openQuickUpdateModal(id, targetStatus, currentStatus = '') {
  selectedId = id;
  const modal = document.getElementById('quickUpdateModal');
  const modalContent = document.getElementById('quickUpdateModalContent');

  // Store current status for reference
  selectedCurrentStatus = currentStatus;

  // Update header to show target status
  const statusLabels = {
    'NEW': 'New',
    'CONTACTED': 'Contacted',
    'NO_RESPONSE': 'No Response',
    'FOLLOW_UP': 'Follow Up',
    'INTERESTED': 'Interested',
    'NOT_INTERESTED': 'Not Interested',
    'ADMISSION_PROCESS': 'Admission Process',
    'CONVERTED': 'Converted'
  };
  const targetLabel = statusLabels[targetStatus] || targetStatus;
  document.getElementById('quickCurrentStatus').textContent = `Update to: ${targetLabel}`;

  // Set target status in hidden field
  document.getElementById('quickTargetStatus').value = targetStatus;

  // Show/hide date field based on target status
  const dateContainer = document.getElementById('quickFollowUpDateContainer');
  if (targetStatus === 'FOLLOW_UP') {
    dateContainer.classList.remove('hidden');
    document.getElementById('quickFollowUpDate').required = true;
  } else {
    dateContainer.classList.add('hidden');
    document.getElementById('quickFollowUpDate').required = false;
    document.getElementById('quickFollowUpDate').value = '';
  }

  // Reset form
  document.getElementById('quickNote').value = '';
  clearQuickStatusErrors();

  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    modalContent.classList.remove('scale-95');
    modalContent.classList.add('scale-100');
  }, 10);
  lucide.createIcons();
}

function closeQuickUpdateModal() {
  const modal = document.getElementById('quickUpdateModal');
  const modalContent = document.getElementById('quickUpdateModalContent');
  modal.classList.add('opacity-0');
  modalContent.classList.remove('scale-100');
  modalContent.classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

function clearQuickStatusErrors() {
  const noteError = document.getElementById('quickNoteError');
  const noteInput = document.getElementById('quickNote');
  const apiError = document.getElementById('quickErrorMessage');

  noteError.classList.add('hidden');
  noteInput.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
  noteInput.classList.add('border-gray-200', 'focus:border-blue-500', 'focus:ring-blue-100');

  // Hide API error message
  if (apiError) {
    apiError.classList.add('hidden');
  }
}

function validateQuickNote() {
  const note = document.getElementById('quickNote');
  const error = document.getElementById('quickNoteError');
  if (!note.value.trim()) {
    error.classList.remove('hidden');
    note.classList.remove('border-gray-200', 'focus:border-blue-500', 'focus:ring-blue-100');
    note.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
    return false;
  }
  error.classList.add('hidden');
  note.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
  note.classList.add('border-gray-200', 'focus:border-blue-500', 'focus:ring-blue-100');
  return true;
}

async function submitQuickUpdate() {
  // Validate note
  if (!validateQuickNote()) {
    showErrorPopup(
      'Note Required',
      'Please add a note before updating',
      'A note is mandatory when updating enquiry status for tracking purposes.'
    );
    return;
  }

  // Read status from hidden field
  const status = document.getElementById('quickTargetStatus').value;
  const note = document.getElementById('quickNote').value;
  const followUpDate = document.getElementById('quickFollowUpDate').value;

  // Validate follow-up date if required
  if (status === 'FOLLOW_UP' && !followUpDate) {
    showErrorPopup(
      'Follow-up Date Required',
      'Please select a follow-up date',
      'When setting status to "Follow Up", a follow-up date is mandatory.'
    );
    return;
  }

  // Build payload
  const payload = { status, note };
  if (status === 'FOLLOW_UP' && followUpDate) {
    payload.followUpDate = followUpDate;
  }

  try {
    const response = await apiPut(API_ENDPOINTS.ENQUIRIES.UPDATE_STATUS(selectedId), payload);
    const responseData = response.data || response;

    // Handle auto-assignment response
    if (responseData?.autoAssigned) {
      showSuccessPopup(
        'Lead Assigned!',
        'This lead has been auto-assigned to you',
        'You are now the assigned counselor for this enquiry. Track it in your "My Leads" section.'
      );
    }

    // Handle conversion requiring payment setup
    if (responseData?.requiresPaymentSetup) {
      closeQuickUpdateModal();
      showConfirmPopup(
        'Student Converted!',
        'The student has been marked as converted. Set up payment details now?',
        'This will create an admission record and allow you to collect fees.',
        () => {
          window.location.href = `admission-detail.html?enquiryId=${selectedId}`;
        },
        () => {
          loadEnquiries();
        }
      );
      return;
    }

    showToast('success', 'Status updated successfully');
    closeQuickUpdateModal();
    loadEnquiries();
  } catch (err) {
    // Show specific error in modal
    const errorDiv = document.getElementById('quickErrorMessage');
    const errorText = document.getElementById('quickErrorText');

    if (errorDiv && errorText) {
      let message = 'Failed to update status';
      let description = '';

      if (err.response?.status === 403) {
        message = 'Access Denied';
        description = 'You can only modify enquiries assigned to you. Unassigned enquiries will be auto-assigned on your first action.';
      } else if (err.response?.status === 400) {
        message = 'Invalid Action';
        description = err.response?.data?.message || 'Please check your input and try again.';
      } else if (err.response?.status === 409) {
        message = 'Action Not Allowed';
        description = err.response?.data?.message || 'This enquiry may already be converted.';
      } else if (err.response?.data?.message) {
        message = err.response.data.message;
      }

      errorText.textContent = message;
      errorDiv.classList.remove('hidden');

      // Also show popup for critical errors
      if (err.response?.status === 403 || err.response?.status === 409) {
        showErrorPopup(message, description);
      }
    } else {
      handleEnquiryError(err, 'Failed to update status');
    }
  }
}

/* ======================
BULK UPLOAD
====================== */
let selectedBulkFile = null;

function openBulkUploadModal() {
  const modal = document.getElementById('bulkUploadModal');
  const modalContent = document.getElementById('bulkUploadModalContent');

  // Reset state
  selectedBulkFile = null;
  resetBulkUploadUI();

  modal.classList.remove('hidden');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    modalContent.classList.remove('scale-95');
    modalContent.classList.add('scale-100');
  }, 10);
}

function closeBulkUploadModal() {
  const modal = document.getElementById('bulkUploadModal');
  const modalContent = document.getElementById('bulkUploadModalContent');
  modal.classList.add('opacity-0');
  modalContent.classList.remove('scale-100');
  modalContent.classList.add('scale-95');
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

function resetBulkUploadUI() {
  // Hide areas
  document.getElementById('selectedFileArea').classList.add('hidden');
  document.getElementById('uploadProgressArea').classList.add('hidden');
  document.getElementById('uploadResultsArea').classList.add('hidden');
  document.getElementById('uploadArea').classList.remove('hidden');

  // Reset file input
  document.getElementById('bulkFileInput').value = '';

  // Reset button
  const uploadButton = document.getElementById('uploadButton');
  uploadButton.disabled = true;
  uploadButton.innerHTML = '<i data-lucide="upload" class="w-4 h-4"></i> Upload File';
  lucide.createIcons();
}

// File input handlers
document.addEventListener('DOMContentLoaded', () => {
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('bulkFileInput');

  if (uploadArea && fileInput) {
    // Click to browse
    uploadArea.addEventListener('click', () => fileInput.click());

    // File selected
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
      }
    });

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('border-indigo-500', 'bg-indigo-50');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('border-indigo-500', 'bg-indigo-50');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('border-indigo-500', 'bg-indigo-50');
      if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    });
  }
});

function handleFileSelect(file) {
  // Validate file type
  const validTypes = ['.csv', '.xlsx', '.xls'];
  const fileExt = '.' + file.name.split('.').pop().toLowerCase();

  if (!validTypes.includes(fileExt)) {
    showToast('error', 'Please select a CSV or Excel file');
    return;
  }

  // Validate file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    showToast('error', 'File size must be less than 5MB');
    return;
  }

  selectedBulkFile = file;

  // Show file info
  document.getElementById('selectedFileName').textContent = file.name;
  document.getElementById('selectedFileSize').textContent = formatFileSize(file.size);

  document.getElementById('uploadArea').classList.add('hidden');
  document.getElementById('selectedFileArea').classList.remove('hidden');

  // Enable upload button
  document.getElementById('uploadButton').disabled = false;
}

function clearSelectedFile() {
  selectedBulkFile = null;
  document.getElementById('bulkFileInput').value = '';
  document.getElementById('selectedFileArea').classList.add('hidden');
  document.getElementById('uploadArea').classList.remove('hidden');
  document.getElementById('uploadButton').disabled = true;
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function submitBulkUpload() {
  // Check admin access first
  if (!isAdmin()) {
    showErrorPopup(
      'Access Denied',
      'Bulk upload is restricted to administrators only',
      'Counselors can create individual enquiries using the "Add Enquiry" button.'
    );
    closeBulkUploadModal();
    return;
  }

  if (!selectedBulkFile) {
    showErrorPopup(
      'File Required',
      'Please select a file to upload',
      'Choose an Excel (.xlsx) or CSV (.csv) file containing enquiry data.'
    );
    return;
  }

  const uploadButton = document.getElementById('uploadButton');
  const progressArea = document.getElementById('uploadProgressArea');
  const progressBar = document.getElementById('uploadProgressBar');
  const progressPercent = document.getElementById('uploadProgressPercent');

  // Disable button and show progress
  uploadButton.disabled = true;
  uploadButton.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Uploading...';
  lucide.createIcons();

  progressArea.classList.remove('hidden');

  // Simulate progress (since we can't track actual progress easily with fetch)
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += Math.random() * 15;
    if (progress > 90) progress = 90;
    progressBar.style.width = progress + '%';
    progressPercent.textContent = Math.round(progress) + '%';
  }, 200);

  try {
    const formData = new FormData();
    formData.append('file', selectedBulkFile);

    const res = await apiPost(API_ENDPOINTS.ENQUIRIES.BULK_UPLOAD, formData);

    clearInterval(progressInterval);
    progressBar.style.width = '100%';
    progressPercent.textContent = '100%';

    // Show results - extract data from API response
    const resultData = res.data || res;
    showUploadResults(resultData);

    // Refresh enquiries list
    loadEnquiries();

  } catch (err) {
    clearInterval(progressInterval);

    // Handle specific error cases
    let errorTitle = 'Upload Failed';
    let errorMessage = err?.message || 'Failed to upload enquiries';
    let errorDescription = '';

    if (err.response?.status === 403) {
      errorTitle = 'Access Denied';
      errorMessage = err.response?.data?.message || 'You do not have permission to perform bulk uploads';
      errorDescription = 'Only administrators can perform bulk uploads. Please contact your admin if you need to add multiple enquiries.';
    } else if (err.response?.status === 400) {
      errorTitle = 'Invalid File';
      errorMessage = err.response?.data?.message || 'The file format is invalid';
      errorDescription = 'Please ensure your file is a valid Excel (.xlsx) or CSV (.csv) file with the correct column headers.';
    }

    // Show error popup for critical errors
    if (err.response?.status === 403) {
      showErrorPopup(errorTitle, errorMessage, errorDescription);
      closeBulkUploadModal();
    } else {
      // Show error in results area for file-related errors
      showUploadResults({
        success: 0,
        failed: 1,
        total: 1,
        errors: [errorMessage]
      });
    }
  }
}

function showUploadResults(results) {
  const resultsArea = document.getElementById('uploadResultsArea');
  const resultIcon = document.getElementById('resultIcon');
  const resultTitle = document.getElementById('resultTitle');
  const resultSubtitle = document.getElementById('resultSubtitle');
  const errorDetails = document.getElementById('errorDetails');
  const errorList = document.getElementById('errorList');

  document.getElementById('uploadProgressArea').classList.add('hidden');
  resultsArea.classList.remove('hidden');

  // Update counts
  document.getElementById('successCount').textContent = results.success || 0;
  document.getElementById('errorCount').textContent = results.failed || 0;
  document.getElementById('totalCount').textContent = results.total || 0;

  // Set icon and title based on results
  const hasErrors = (results.failed || 0) > 0;
  const allSuccess = (results.success || 0) === (results.total || 0);

  if (allSuccess) {
    resultIcon.className = 'w-10 h-10 bg-green-100 rounded-full flex items-center justify-center';
    resultIcon.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5 text-green-600"></i>';
    resultTitle.textContent = 'Upload Complete!';
    resultSubtitle.textContent = 'All enquiries uploaded successfully';
    showToast('success', `Uploaded ${results.success} enquiries successfully`);
  } else if (hasErrors) {
    resultIcon.className = 'w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center';
    resultIcon.innerHTML = '<i data-lucide="alert-circle" class="w-5 h-5 text-amber-600"></i>';
    resultTitle.textContent = 'Partial Upload';
    resultSubtitle.textContent = `${results.success} succeeded, ${results.failed} failed`;

    // Show error details
    if (results.errors && results.errors.length > 0) {
      errorDetails.classList.remove('hidden');
      errorList.innerHTML = results.errors.map(e => `<li>${e}</li>`).join('');
    }
  } else {
    resultIcon.className = 'w-10 h-10 bg-red-100 rounded-full flex items-center justify-center';
    resultIcon.innerHTML = '<i data-lucide="x-circle" class="w-5 h-5 text-red-600"></i>';
    resultTitle.textContent = 'Upload Failed';
    resultSubtitle.textContent = 'Something went wrong';
  }

  lucide.createIcons();

  // Update button
  const uploadButton = document.getElementById('uploadButton');
  uploadButton.innerHTML = '<i data-lucide="refresh-cw" class="w-4 h-4"></i> Upload Another';
  uploadButton.disabled = false;
  uploadButton.onclick = () => {
    resetBulkUploadUI();
    uploadButton.onclick = submitBulkUpload; // Reset handler
  };
  lucide.createIcons();
}

function downloadTemplate() {
  const headers = ['name', 'mobile', 'email', 'course', 'followUpDate'];
  const sample = ['John Doe', '9876543210', 'john@example.com', 'Python Programming', '2024-01-15'];

  let csv = headers.join(',') + '\n';
  csv += sample.join(',') + '\n';

  // Add more sample rows
  csv += 'Jane Smith,9876543211,jane@example.com,Data Science,2024-01-20\n';
  csv += 'Bob Wilson,9876543212,bob@example.com,Web Designing,2024-01-18\n';

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'enquiry_upload_template.csv';
  a.click();
  window.URL.revokeObjectURL(url);

  showToast('success', 'Template downloaded');
}

function showFormatGuide() {
  const guide = `
Format Guide:

Required Columns:
• name - Full name of the enquiry (required)
• mobile - 10-digit mobile number (required)
• email - Email address (optional)
• course - Course interested in (required)
• followUpDate - Follow-up date in YYYY-MM-DD format (optional)

Notes:
• Mobile numbers should be 10 digits without country code
• Dates should be in YYYY-MM-DD format
• Course names should match the available courses
• Email is optional but recommended
• Maximum file size: 5MB
• Supported formats: CSV, Excel (.xlsx, .xls)
  `;

  alert(guide);
}

/* ======================
ACTION BUTTONS HELPER
====================== */
// Button configuration with primary, secondary and more options
const actionConfig = {
  'NEW': {
    primary: { status: 'CONTACTED', label: 'Contacted', color: 'blue' },
    secondary: { status: 'FOLLOW_UP', label: 'Follow Up', color: 'amber' },
    more: [
      { status: 'INTERESTED', label: 'Interested' },
      { status: 'NOT_INTERESTED', label: 'Not Interested' }
    ]
  },
  'CONTACTED': {
    primary: { status: 'FOLLOW_UP', label: 'Follow Up', color: 'amber' },
    secondary: { status: 'INTERESTED', label: 'Interested', color: 'green' },
    more: [
      { status: 'CONTACTED', label: 'Contacted (Again)' },
      { status: 'NOT_INTERESTED', label: 'Not Interested' }
    ]
  },
  'FOLLOW_UP': {
    primary: { status: 'INTERESTED', label: 'Interested', color: 'green' },
    secondary: { status: 'ADMISSION_PROCESS', label: 'Admission', color: 'purple' },
    more: [
      { status: 'CONTACTED', label: 'Contacted' },
      { status: 'NOT_INTERESTED', label: 'Not Interested' }
    ]
  },
  'INTERESTED': {
    primary: { status: 'ADMISSION_PROCESS', label: 'Admission', color: 'purple' },
    secondary: { status: 'FOLLOW_UP', label: 'Follow Up', color: 'amber' },
    more: [
      { status: 'INTERESTED', label: 'Interested (Reconfirm)' },
      { status: 'NOT_INTERESTED', label: 'Not Interested' }
    ]
  },
  'ADMISSION_PROCESS': {
    primary: { status: 'CONVERTED', label: 'Convert', color: 'emerald', isConvert: true },
    secondary: null,
    more: [
      { status: 'FOLLOW_UP', label: 'Follow Up' },
      { status: 'NOT_INTERESTED', label: 'Not Interested' }
    ]
  },
  'NO_RESPONSE': {
    primary: { status: 'CONTACTED', label: 'Contacted', color: 'blue' },
    secondary: { status: 'FOLLOW_UP', label: 'Follow Up', color: 'amber' },
    more: [
      { status: 'NOT_INTERESTED', label: 'Not Interested' }
    ]
  },
  'NOT_INTERESTED': {
    primary: { status: 'CONTACTED', label: 'Contacted', color: 'blue' },
    secondary: { status: 'FOLLOW_UP', label: 'Follow Up', color: 'amber' },
    more: [
      { status: 'INTERESTED', label: 'Interested' }
    ]
  },
  'CONVERTED': {
    primary: null,
    secondary: null,
    more: []
  }
};

function getActionButtons(id, status, assignedToId) {
  const config = actionConfig[status];
  if (!config) return '';

  // Get current user info
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdminUser = user.role === 'admin';
  const currentUserId = user._id || user.id;

  // Check if counselor can take action on this enquiry
  const isUnassigned = !assignedToId;
  const isOwnEnquiry = assignedToId === currentUserId;
  const canTakeAction = isAdminUser || isUnassigned || isOwnEnquiry;

  // Admin-only delete - only for enquiries NOT in admission process or converted
  const isInAdmissionProcess = status === 'ADMISSION_PROCESS' || status === 'CONVERTED';
  const canDelete = isAdminUser && !isInAdmissionProcess;

  // For CONVERTED status, show no action buttons
  if (status === 'CONVERTED') {
    return '';
  }

  // If counselor cannot take action, show no buttons
  if (!canTakeAction) {
    return '';
  }

  // Build buttons
  let buttonsHtml = '';
  const dropdownId = `dropdown-${id}`;

  // Primary button (colored, filled)
  if (config.primary) {
    const primary = config.primary;
    if (primary.isConvert) {
      buttonsHtml += `
        <button onclick="event.stopPropagation(); window.location.href='enquiry-detail.html?id=${id}'"
          class="px-3 py-1.5 bg-${primary.color}-600 hover:bg-${primary.color}-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm hover:shadow">
          ${primary.label}
        </button>
      `;
    } else {
      buttonsHtml += `
        <button onclick="event.stopPropagation(); openQuickUpdateModal('${id}', '${primary.status}', '${status}')"
          class="px-3 py-1.5 bg-${primary.color}-600 hover:bg-${primary.color}-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm hover:shadow">
          ${primary.label}
        </button>
      `;
    }
  }

  // Secondary button (outline style)
  if (config.secondary) {
    const secondary = config.secondary;
    buttonsHtml += `
      <button onclick="event.stopPropagation(); openQuickUpdateModal('${id}', '${secondary.status}', '${status}')"
        class="px-3 py-1.5 border-2 border-${secondary.color}-500 text-${secondary.color}-700 hover:bg-${secondary.color}-50 rounded-lg text-xs font-semibold transition-all">
        ${secondary.label}
      </button>
    `;
  }

  // More dropdown button (if there are more options or delete is available)
  const hasMoreOptions = config.more && config.more.length > 0;
  if (hasMoreOptions || canDelete) {
    let dropdownItems = '';
    
    if (hasMoreOptions) {
      config.more.forEach(item => {
        dropdownItems += `
          <button onclick="event.stopPropagation(); openQuickUpdateModal('${id}', '${item.status}', '${status}'); closeActionDropdown('${dropdownId}')"
            class="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
            ${item.label}
          </button>
        `;
      });
    }

    // Add divider if both more options and delete exist
    if (hasMoreOptions && canDelete) {
      dropdownItems += `<div class="h-px bg-gray-200 my-1"></div>`;
    }

    // Delete option (admin only)
    if (canDelete) {
      dropdownItems += `
        <button onclick="event.stopPropagation(); closeActionDropdown('${dropdownId}'); confirmDeleteEnquiry('${id}')"
          class="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          Delete
        </button>
      `;
    }

    buttonsHtml += `
      <div class="relative action-dropdown-container" id="container-${dropdownId}">
        <button onclick="event.stopPropagation(); toggleActionDropdown('${dropdownId}')"
          class="px-2 py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-gray-800 rounded-lg text-xs font-medium transition-all flex items-center gap-1">
          More
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="dropdown-arrow"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div id="${dropdownId}" class="hidden absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
          ${dropdownItems}
        </div>
      </div>
    `;
  }

  return `<div class="flex items-center gap-1.5 flex-wrap justify-center">${buttonsHtml}</div>`;
}

// Toggle dropdown visibility
function toggleActionDropdown(dropdownId) {
  // Close all other dropdowns first
  document.querySelectorAll('[id^="dropdown-"]').forEach(el => {
    if (el.id !== dropdownId) {
      el.classList.add('hidden');
    }
  });
  document.querySelectorAll('.dropdown-arrow').forEach(arrow => {
    arrow.style.transform = '';
  });

  const dropdown = document.getElementById(dropdownId);
  const arrow = dropdown.previousElementSibling.querySelector('.dropdown-arrow');
  
  if (dropdown.classList.contains('hidden')) {
    dropdown.classList.remove('hidden');
    if (arrow) arrow.style.transform = 'rotate(180deg)';
  } else {
    dropdown.classList.add('hidden');
    if (arrow) arrow.style.transform = '';
  }
}

// Close specific dropdown
function closeActionDropdown(dropdownId) {
  const dropdown = document.getElementById(dropdownId);
  const arrow = dropdown?.previousElementSibling?.querySelector('.dropdown-arrow');
  if (dropdown) dropdown.classList.add('hidden');
  if (arrow) arrow.style.transform = '';
}

// Close all dropdowns when clicking outside
function closeAllActionDropdowns() {
  document.querySelectorAll('[id^="dropdown-"]').forEach(el => {
    el.classList.add('hidden');
  });
  document.querySelectorAll('.dropdown-arrow').forEach(arrow => {
    arrow.style.transform = '';
  });
}

/* ======================
DELETE ENQUIRY
====================== */
function confirmDeleteEnquiry(id) {
  const enquiry = allEnquiries.find(e => e._id === id);
  const name = enquiry?.name || 'this enquiry';

  showConfirmPopup(
    'Delete Enquiry?',
    `Are you sure you want to delete "${name}"?`,
    'This action cannot be undone. The enquiry will be permanently removed from the system.',
    () => {
      executeDeleteEnquiry(id);
    },
    () => {
      // User cancelled, do nothing
      closeConfirmActionPopup();
    }
  );
}

async function executeDeleteEnquiry(id) {
  try {
    await apiDelete(API_ENDPOINTS.ENQUIRIES.DELETE(id));

    showToast('success', 'Enquiry deleted successfully');
    closeConfirmActionPopup();
    loadEnquiries();
  } catch (err) {
    handleEnquiryError(err, 'Failed to delete enquiry');
  }
}

/* ======================
EXPORT
====================== */
window.openModal = openModal;
window.closeModal = closeModal;
window.openConfirmModal = openConfirmModal;
window.closeConfirmModal = closeConfirmModal;
window.executeUpdate = executeUpdate;
window.openCreateModal = openCreateModal;
window.closeCreateModal = closeCreateModal;
window.createEnquiry = createEnquiry;
window.handleCourseChange = handleCourseChange;
window.changePage = changePage;
window.goToPage = goToPage;
window.goToLastPage = goToLastPage;
window.renderEmptyState = renderEmptyState;
window.openBulkUploadModal = openBulkUploadModal;
window.closeBulkUploadModal = closeBulkUploadModal;
window.submitBulkUpload = submitBulkUpload;
window.clearSelectedFile = clearSelectedFile;
window.downloadTemplate = downloadTemplate;
window.showFormatGuide = showFormatGuide;
window.openQuickUpdateModal = openQuickUpdateModal;
window.closeQuickUpdateModal = closeQuickUpdateModal;
window.submitQuickUpdate = submitQuickUpdate;
window.getActionButtons = getActionButtons;
window.confirmDeleteEnquiry = confirmDeleteEnquiry;
window.executeDeleteEnquiry = executeDeleteEnquiry;
window.toggleActionDropdown = toggleActionDropdown;
window.closeActionDropdown = closeActionDropdown;
window.closeAllActionDropdowns = closeAllActionDropdowns;
window.sortBy = sortBy;

// Error handling exports
window.closeErrorPopup = closeErrorPopup;
window.closeSuccessPopup = closeSuccessPopup;
window.closeConfirmActionPopup = closeConfirmActionPopup;

// View switcher exports
window.switchToAll = switchToAll;
window.switchToMyLeads = switchToMyLeads;
window.switchToUnassigned = switchToUnassigned;
window.switchToAllReadonly = switchToAllReadonly;

// User profile exports
window.updateUserProfileDisplay = updateUserProfileDisplay;

// Logout function
window.logout = function() {
  localStorage.clear();
  window.location.href = 'index.html';
};
