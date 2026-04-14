let enquiries = [];
let selectedId = null;
let allEnquiries = []; // Store all for client-side filtering
let filteredEnquiries = []; // After filters applied

// Pagination state
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let totalPages = 1;

/* ======================
INIT
====================== */
document.addEventListener('DOMContentLoaded', () => {
  loadEnquiries();

  document.getElementById('searchInput').addEventListener('input', () => {
    currentPage = 1;
    filterData();
  });
  document.getElementById('statusFilter').addEventListener('change', () => {
    currentPage = 1;
    filterData();
  });
  document.getElementById('courseFilter').addEventListener('change', () => {
    currentPage = 1;
    filterData();
  });
  document.getElementById('resetFilters').addEventListener('click', resetFilters);

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
LOAD DATA
====================== */
let paginationData = { page: 1, totalPages: 1, totalCount: 0 };

async function loadEnquiries() {
  try {
    const search = document.getElementById('searchInput').value.toLowerCase().trim();
    const status = document.getElementById('statusFilter').value;
    const course = document.getElementById('courseFilter').value;

    const params = {
      page: currentPage,
      limit: ITEMS_PER_PAGE
    };

    if (search) params.search = search;
    if (status) params.status = status;
    if (course) params.course = course;

    const res = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, params);

    // API returns { enquiries: [...], pagination: {...} }
    allEnquiries = res.enquiries || [];
    paginationData = res.pagination || { page: 1, totalPages: 1, totalCount: 0 };
    totalPages = paginationData.totalPages || 1;

    renderTable(allEnquiries);
    updatePaginationInfoFromServer(paginationData);
  } catch (err) {
    showToast('error', 'Failed to load enquiries');
    renderEmptyState();
  }
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
  document.getElementById('statusFilter').value = '';
  document.getElementById('courseFilter').value = '';
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

  table.innerHTML = data.map(e => `
    <tr class="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
      <td class="px-6 py-4">
        <div class="font-medium text-gray-900">${e.name || '-'}</div>
        <div class="text-xs text-gray-500">${e.mobile || ''}</div>
      </td>
      <td class="px-6 py-4 text-gray-700">${e.courseInterested || '-'}</td>
      <td class="px-6 py-4">${getStatusBadge(e.status)}</td>
      <td class="px-6 py-4 text-gray-600">${formatDate(e.followUpDate)}</td>
      <td class="px-6 py-4 text-center">
        <button onclick="openModal('${e._id}')"
          class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm">
          Update
        </button>
      </td>
    </tr>
  `).join('');
}

function renderEmptyState() {
  const table = document.getElementById('enquiryTable');
  table.innerHTML = `
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
    showToast('error', 'Please fix the errors');
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
    await apiPost(API_ENDPOINTS.ENQUIRIES.CREATE, {
      name,
      mobile,
      email: email || undefined,
      courseInterested: course
    });

    showToast('success', 'Enquiry created successfully');
    closeCreateModal();
    loadEnquiries();
  } catch {
    showToast('error', 'Failed to create enquiry');
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

  try {
    await apiPut(API_ENDPOINTS.ENQUIRIES.UPDATE_STATUS(selectedId), {
      status,
      note,
      followUpDate
    });

    showToast('success', 'Status updated successfully');
    closeConfirmModal();
    closeModal();
    loadEnquiries();
  } catch {
    showToast('error', 'Failed to update status');
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
  if (!selectedBulkFile) {
    showToast('error', 'Please select a file');
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

    // Show results
    showUploadResults(res);

    // Refresh enquiries list
    loadEnquiries();

  } catch (err) {
    clearInterval(progressInterval);
    showToast('error', err?.message || 'Upload failed');

    // Show error in results
    showUploadResults({ success: 0, failed: 1, total: 1, errors: [err?.message || 'Upload failed'] });
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
