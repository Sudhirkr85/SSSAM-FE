/**
 * Enquiry Module
 * Institute Enquiry Management System
 */

// State
let enquiriesData = [];
let currentPage = 1;
let totalPages = 1;
let filters = {
    search: '',
    status: '',
    course: '',
};

// Simple helper to get course name from ID
function getCourseName(courseId) {
    const course = STATIC_COURSES.find(c => c._id === courseId || c.id === courseId);
    return course?.name || courseId || '-';
}

// DOM Elements
let enquiriesTable, searchInput, statusFilter, courseFilter, resetFiltersBtn;
let prevPageBtn, nextPageBtn, pageNumbers;
let createEnquiryBtn, createEnquiryModal, closeCreateModal, cancelCreateBtn;
let createEnquiryForm, saveEnquiryBtn;
let bulkUploadBtn, bulkUploadModal, closeBulkModal, cancelBulkBtn, uploadBulkBtn;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('enquiriesTable')) return;
    
    initializeElements();
    setupEventListeners();
    loadCourses();
    loadEnquiries();
});

function initializeElements() {
    enquiriesTable = document.getElementById('enquiriesTable');
    searchInput = document.getElementById('searchInput');
    statusFilter = document.getElementById('statusFilter');
    courseFilter = document.getElementById('courseFilter');
    resetFiltersBtn = document.getElementById('resetFilters');
    prevPageBtn = document.getElementById('prevPage');
    nextPageBtn = document.getElementById('nextPage');
    pageNumbers = document.getElementById('pageNumbers');
    
    // Create enquiry modal
    createEnquiryBtn = document.getElementById('createEnquiryBtn');
    createEnquiryModal = document.getElementById('createEnquiryModal');
    closeCreateModal = document.getElementById('closeCreateModal');
    cancelCreateBtn = document.getElementById('cancelCreate');
    createEnquiryForm = document.getElementById('createEnquiryForm');
    saveEnquiryBtn = document.getElementById('saveEnquiry');
    
    // Bulk upload modal
    bulkUploadBtn = document.getElementById('bulkUploadBtn');
    bulkUploadModal = document.getElementById('bulkUploadModal');
    closeBulkModal = document.getElementById('closeBulkModal');
    cancelBulkBtn = document.getElementById('cancelBulk');
    uploadBulkBtn = document.getElementById('uploadBulk');
}

function setupEventListeners() {
    // Search with debounce
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            filters.search = searchInput.value;
            currentPage = 1;
            loadEnquiries();
        }, 300));
    }
    
    // Status filter
    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            filters.status = statusFilter.value;
            currentPage = 1;
            loadEnquiries();
        });
    }
    
    // Course filter
    if (courseFilter) {
        courseFilter.addEventListener('change', () => {
            filters.course = courseFilter.value;
            currentPage = 1;
            loadEnquiries();
        });
    }
    
    // Reset filters
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            filters = { search: '', status: '', course: '' };
            if (searchInput) searchInput.value = '';
            if (statusFilter) statusFilter.value = '';
            if (courseFilter) courseFilter.value = '';
            currentPage = 1;
            loadEnquiries();
        });
    }
    
    // Pagination
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadEnquiries();
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadEnquiries();
            }
        });
    }
    
    // Create enquiry modal
    if (createEnquiryBtn) {
        createEnquiryBtn.addEventListener('click', () => {
            openModal(createEnquiryModal);
        });
    }
    
    if (closeCreateModal) {
        closeCreateModal.addEventListener('click', () => {
            closeModal(createEnquiryModal);
        });
    }
    
    if (cancelCreateBtn) {
        cancelCreateBtn.addEventListener('click', () => {
            closeModal(createEnquiryModal);
        });
    }
    
    if (createEnquiryForm) {
        createEnquiryForm.addEventListener('submit', handleCreateEnquiry);
    }
    
    // Bulk upload modal
    if (bulkUploadBtn) {
        bulkUploadBtn.addEventListener('click', () => {
            openModal(bulkUploadModal);
        });
    }
    
    if (closeBulkModal) {
        closeBulkModal.addEventListener('click', () => {
            closeModal(bulkUploadModal);
        });
    }
    
    if (cancelBulkBtn) {
        cancelBulkBtn.addEventListener('click', () => {
            closeModal(bulkUploadModal);
        });
    }
    
    if (uploadBulkBtn) {
        uploadBulkBtn.addEventListener('click', handleBulkUpload);
    }
    
    // Close modals on overlay click
    [createEnquiryModal, bulkUploadModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeModal(modal);
                }
            });
        }
    });
}

function loadCourses() {
    populateCourseDropdowns(STATIC_COURSES);
}

function populateCourseDropdowns(courseList) {
    const enquiryCourse = document.getElementById('enquiryCourse');
    const courseFilter = document.getElementById('courseFilter');

    if (enquiryCourse) {
        enquiryCourse.innerHTML = '<option value="">Select Course</option>';
        courseList.forEach(course => {
            enquiryCourse.innerHTML += `<option value="${course._id || course.id}">${course.name}</option>`;
        });
        enquiryCourse.innerHTML += '<option value="other">Other</option>';

        // Show/hide custom course input
        enquiryCourse.addEventListener('change', () => {
            const otherInput = document.getElementById('enquiryCourseOther');
            if (enquiryCourse.value === 'other') {
                otherInput.classList.remove('hidden');
                otherInput.required = true;
            } else {
                otherInput.classList.add('hidden');
                otherInput.required = false;
                otherInput.value = '';
            }
        });
    }

    if (courseFilter) {
        courseFilter.innerHTML = '<option value="">All Courses</option>';
        courseList.forEach(course => {
            courseFilter.innerHTML += `<option value="${course._id || course.id}">${course.name}</option>`;
        });
    }
}

async function loadEnquiries() {
    try {
        enquiriesTable.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">Loading...</td></tr>';
        
        const params = {
            page: currentPage,
            limit: 10,
            ...filters,
        };
        
        const response = await apiGet(API_ENDPOINTS.ENQUIRIES.LIST, params);
        
        enquiriesData = response.data || [];
        currentPage = response.currentPage || 1;
        totalPages = response.totalPages || 1;
        
        renderEnquiries();
        updatePagination(response.total || 0);
    } catch (error) {
        enquiriesTable.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-red-500">Failed to load enquiries. Please try again.</td></tr>';
    }
}

function renderEnquiries() {
    if (!enquiriesData.length) {
        enquiriesTable.innerHTML = '<tr><td colspan="7" class="px-6 py-8 text-center text-gray-500">No enquiries found.</td></tr>';
        return;
    }
    
    enquiriesTable.innerHTML = enquiriesData.map(enquiry => {
        const rowClass = getEnquiryRowClass(enquiry);
        
        return `
            <tr class="${rowClass} hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${enquiry.name || '-'}</div>
                </td>
                <td class="px-6 py-4 text-gray-600">${formatPhone(enquiry.mobile)}</td>
                <td class="px-6 py-4 text-gray-600">${getCourseName(enquiry.course)}</td>
                <td class="px-6 py-4">${getStatusBadge(enquiry.status)}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center space-x-1 ${isOverdue(enquiry.followUpDate) ? 'text-red-600 font-medium' : 'text-gray-600'}">
                        ${isOverdue(enquiry.followUpDate) ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' : ''}
                        <span>${formatDate(enquiry.followUpDate, true)}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    ${enquiry.assignedTo ? 
                        `<span class="text-gray-800">${enquiry.assignedTo.name || enquiry.assignedTo}</span>` : 
                        '<span class="text-yellow-600 font-medium">Unassigned</span>'
                    }
                </td>
                <td class="px-6 py-4">
                    <a href="enquiry-detail.html?id=${enquiry._id || enquiry.id}" class="text-blue-600 hover:text-blue-800 font-medium">
                        View Details
                    </a>
                </td>
            </tr>
        `;
    }).join('');
}

function updatePagination(total) {
    const start = (currentPage - 1) * 10 + 1;
    const end = Math.min(currentPage * 10, total);
    
    document.getElementById('showingStart').textContent = start;
    document.getElementById('showingEnd').textContent = end;
    document.getElementById('totalItems').textContent = total;
    
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
    
    // Generate page numbers
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const activeClass = i === currentPage ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50';
            html += `<button onclick="goToPage(${i})" class="px-3 py-1 border rounded-lg text-sm ${activeClass}">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += `<span class="px-2 text-gray-400">...</span>`;
        }
    }
    pageNumbers.innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    loadEnquiries();
}

async function handleCreateEnquiry(e) {
    e.preventDefault();
    
    saveEnquiryBtn.disabled = true;
    saveEnquiryBtn.innerHTML = '<span class="spinner"></span> Creating...';
    
    try {
        const data = {
            name: document.getElementById('enquiryName').value,
            mobile: document.getElementById('enquiryMobile').value,
            email: document.getElementById('enquiryEmail').value,
            course: document.getElementById('enquiryCourse').value === 'other'
                ? document.getElementById('enquiryCourseOther').value
                : document.getElementById('enquiryCourse').value,
            source: document.getElementById('enquirySource').value,
            notes: document.getElementById('enquiryNotes').value,
        };
        
        await apiPost(API_ENDPOINTS.ENQUIRIES.CREATE, data);
        
        showToast('success', 'Success', 'Enquiry created successfully!');
        closeModal(createEnquiryModal);
        createEnquiryForm.reset();
        loadEnquiries();
    } catch (error) {
        const message = error.response?.data?.message || 'Failed to create enquiry';
        showToast('error', 'Error', message);
    } finally {
        saveEnquiryBtn.disabled = false;
        saveEnquiryBtn.innerHTML = 'Create Enquiry';
    }
}

async function handleBulkUpload() {
    const fileInput = document.getElementById('bulkFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showToast('warning', 'Warning', 'Please select a file to upload');
        return;
    }
    
    uploadBulkBtn.disabled = true;
    uploadBulkBtn.innerHTML = '<span class="spinner"></span> Uploading...';
    
    try {
        await apiUploadFile(API_ENDPOINTS.BULK.UPLOAD, file);
        
        showToast('success', 'Success', 'Bulk upload completed successfully!');
        closeModal(bulkUploadModal);
        fileInput.value = '';
        loadEnquiries();
    } catch (error) {
        const message = error.response?.data?.message || 'Failed to upload file';
        showToast('error', 'Error', message);
    } finally {
        uploadBulkBtn.disabled = false;
        uploadBulkBtn.innerHTML = 'Upload';
    }
}

function openModal(modal) {
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modal) {
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

// ==================== ENQUIRY DETAIL PAGE ====================

let currentEnquiry = null;
let isAssignedToCurrentUser = false;

// Initialize detail page
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on the detail page
    if (!document.getElementById('enquiryTitle')) return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const enquiryId = urlParams.get('id');
    
    if (!enquiryId) {
        showToast('error', 'Error', 'No enquiry ID provided');
        window.location.href = 'enquiries.html';
        return;
    }
    
    loadEnquiryDetail(enquiryId);
    setupDetailPageListeners(enquiryId);
});

async function loadEnquiryDetail(id) {
    try {
        const response = await apiGet(API_ENDPOINTS.ENQUIRIES.DETAIL(id));
        const enquiry = response.data?.enquiry || response.data;
        currentEnquiry = enquiry;

        // Check assignment
        const currentUser = getCurrentUser();
        isAssignedToCurrentUser = !enquiry.assignedTo ||
            (enquiry.assignedTo._id || enquiry.assignedTo) === (currentUser._id || currentUser.id);

        renderEnquiryDetail(enquiry);
        loadTimeline(id);
        loadNotes(id);
        checkPermissions();
    } catch (error) {
        showToast('error', 'Error', 'Failed to load enquiry details');
    }
}

function renderEnquiryDetail(enquiry) {
    // Header
    document.getElementById('enquiryTitle').textContent = enquiry.name || 'Enquiry Details';
    document.getElementById('enquirySubtitle').textContent = `Enquiry #${enquiry._id || enquiry.id}`;
    
    // Info
    document.getElementById('infoName').textContent = enquiry.name || '-';
    document.getElementById('infoMobile').textContent = formatPhone(enquiry.mobile) || '-';
    document.getElementById('infoEmail').textContent = enquiry.email || '-';
    document.getElementById('infoCourse').textContent = getCourseName(enquiry.course);
    document.getElementById('infoSource').textContent = enquiry.source || '-';
    document.getElementById('infoCreated').textContent = formatDate(enquiry.createdAt, true);
    
    // Status badge
    document.getElementById('currentStatus').innerHTML = getStatusBadge(enquiry.status);
    
    // Assigned info
    if (enquiry.assignedTo) {
        document.getElementById('assignedName').textContent = enquiry.assignedTo.name || 'Assigned';
        document.getElementById('assignedRole').textContent = enquiry.assignedTo.role || 'Counselor';
    } else {
        document.getElementById('assignedName').textContent = 'Unassigned';
        document.getElementById('assignedRole').textContent = 'Not assigned yet';
    }
    
    // Status buttons
    const statusButtons = document.querySelectorAll('.status-btn');
    statusButtons.forEach(btn => {
        const status = btn.dataset.status;
        btn.classList.toggle('active', status === enquiry.status);
        btn.classList.add('bg-gray-100', 'text-gray-700', 'border-gray-300');
        
        if (!isAssignedToCurrentUser && !isAdmin()) {
            btn.disabled = true;
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        }
    });
    
    // Follow-up date
    const followUpInput = document.getElementById('followUpDate');
    if (enquiry.followUpDate) {
        const date = new Date(enquiry.followUpDate);
        followUpInput.value = date.toISOString().slice(0, 16);
    }
    
    // Show convert section if interested/follow-up
    const convertSection = document.getElementById('convertSection');
    if (enquiry.status === 'Interested' || enquiry.status === 'Follow-up') {
        convertSection.classList.remove('hidden');
    }
    
    // Locked badge
    if (!isAssignedToCurrentUser && !isAdmin()) {
        document.getElementById('lockedBadge').classList.remove('hidden');
    }
}

function checkPermissions() {
    if (!isAssignedToCurrentUser && !isAdmin()) {
        // Disable all inputs
        setFormDisabled(document.getElementById('statusSection'), true);
        setFormDisabled(document.getElementById('notesSection'), true);
        setFormDisabled(document.getElementById('followUpSection'), true);
        document.getElementById('convertBtn').disabled = true;
    }
}

async function loadTimeline(id) {
    try {
        const timeline = await apiGet(API_ENDPOINTS.ENQUIRIES.TIMELINE(id));
        const container = document.getElementById('timelineList');
        
        if (!timeline || !timeline.length) {
            container.innerHTML = '<p class="text-gray-500 text-center">No activity yet</p>';
            return;
        }
        
        container.innerHTML = timeline.map(item => `
            <div class="timeline-item">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <p class="font-medium text-gray-800">${item.action}</p>
                    <p class="text-sm text-gray-600">${item.description || ''}</p>
                    <p class="text-xs text-gray-400 mt-1">${formatRelativeTime(item.timestamp)} by ${item.user?.name || 'System'}</p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load timeline:', error);
    }
}

async function loadNotes(id) {
    try {
        const response = await apiGet(API_ENDPOINTS.ENQUIRIES.DETAIL(id));
        const enquiry = response.data?.enquiry || response.data;
        const notes = enquiry.notes || [];
        const container = document.getElementById('notesList');
        
        if (!notes.length) {
            container.innerHTML = '<p class="text-gray-500 text-center">No notes yet</p>';
            return;
        }
        
        container.innerHTML = notes.map(note => `
            <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-gray-700">${note.text}</p>
                <p class="text-xs text-gray-400 mt-1">${formatRelativeTime(note.createdAt)} by ${note.createdBy?.name || 'Unknown'}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load notes:', error);
    }
}

function setupDetailPageListeners(enquiryId) {
    // Status buttons
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!isAssignedToCurrentUser && !isAdmin()) return;
            
            const status = btn.dataset.status;
            try {
                await apiPatch(API_ENDPOINTS.ENQUIRIES.UPDATE_STATUS(enquiryId), { status });
                showToast('success', 'Success', `Status updated to ${status}`);
                loadEnquiryDetail(enquiryId);
            } catch (error) {
                showToast('error', 'Error', 'Failed to update status');
            }
        });
    });
    
    // Add note
    document.getElementById('addNoteBtn')?.addEventListener('click', async () => {
        if (!isAssignedToCurrentUser && !isAdmin()) return;
        
        const noteText = document.getElementById('newNote').value.trim();
        if (!noteText) {
            showToast('warning', 'Warning', 'Please enter a note');
            return;
        }
        
        try {
            await apiPost(API_ENDPOINTS.ENQUIRIES.ADD_NOTE(enquiryId), { text: noteText });
            document.getElementById('newNote').value = '';
            showToast('success', 'Success', 'Note added successfully');
            loadNotes(enquiryId);
            loadTimeline(enquiryId);
        } catch (error) {
            showToast('error', 'Error', 'Failed to add note');
        }
    });
    
    // Update follow-up
    document.getElementById('updateFollowUp')?.addEventListener('click', async () => {
        if (!isAssignedToCurrentUser && !isAdmin()) return;
        
        const followUpDate = document.getElementById('followUpDate').value;
        if (!followUpDate) {
            showToast('warning', 'Warning', 'Please select a follow-up date');
            return;
        }
        
        try {
            await apiPatch(API_ENDPOINTS.ENQUIRIES.UPDATE_FOLLOWUP(enquiryId), { followUpDate });
            showToast('success', 'Success', 'Follow-up date updated');
            loadEnquiryDetail(enquiryId);
        } catch (error) {
            showToast('error', 'Error', 'Failed to update follow-up date');
        }
    });
    
    // Convert to admission
    document.getElementById('convertBtn')?.addEventListener('click', async () => {
        if (!isAssignedToCurrentUser && !isAdmin()) return;
        
        try {
            // Create admission from enquiry
            const admission = await apiPost(API_ENDPOINTS.ADMISSIONS.CREATE, { 
                enquiryId: enquiryId,
                admissionDate: new Date().toISOString(),
            });
            
            showToast('success', 'Success', 'Enquiry converted to admission!');
            window.location.href = `admissions.html?id=${admission._id || admission.id}`;
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to convert enquiry';
            showToast('error', 'Error', message);
        }
    });
}

// Export for global access
window.goToPage = goToPage;
window.loadEnquiryDetail = loadEnquiryDetail;
