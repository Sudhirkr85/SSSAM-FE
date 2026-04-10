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

    // Setup phone input with +91 prefix and 10-digit limit
    setupPhoneInput('enquiryMobile');
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

    // Course dropdown - show/hide Other text input
    const enquiryCourse = document.getElementById('enquiryCourse');
    if (enquiryCourse) {
        enquiryCourse.addEventListener('change', () => {
            const otherInput = document.getElementById('enquiryCourseOther');
            if (otherInput) {
                if (enquiryCourse.value === 'other') {
                    otherInput.classList.remove('hidden');
                    otherInput.required = true;
                } else {
                    otherInput.classList.add('hidden');
                    otherInput.required = false;
                    otherInput.value = '';
                }
            }
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
        const pagination = response.pagination || {};
        currentPage = pagination.page || 1;
        totalPages = pagination.totalPages || 1;

        renderEnquiries();
        updatePagination(pagination.totalCount || 0);
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
                    <div class="flex items-center space-x-3">
                        <a href="enquiry-detail.html?id=${enquiry._id || enquiry.id}" class="text-blue-600 hover:text-blue-800 font-medium">
                            View Details
                        </a>
                        ${isAdmin() ? `
                            <button onclick="deleteEnquiry('${enquiry._id || enquiry.id}')" class="text-red-600 hover:text-red-800" title="Delete">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
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
            mobile: getCleanPhoneNumber(document.getElementById('enquiryMobile').value),
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

        // Reset phone input with +91 prefix if enquiryMobile exists
        const mobileInput = document.getElementById('enquiryMobile');
        if (mobileInput) {
            mobileInput.value = '+91 ';
        }
    }
}

// ==================== ENQUIRY DETAIL PAGE ====================

let currentEnquiry = null;
let isAssignedToCurrentUser = false;

// Payment Selection Modal State
let modalEnquiryId = null;
let modalSelectedPaymentType = '';
let modalInstallments = [];
let modalTotalFees = 0;

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
        renderTimeline(enquiry.timeline);
        renderNotes(enquiry.notes);
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
    
    // Show convert section if interested/follow-up/converted (but not yet admitted)
    const convertSection = document.getElementById('convertSection');
    if (enquiry.status === 'Interested' || enquiry.status === 'Follow-up' || 
        (enquiry.status === 'Converted' && !enquiry.admissionId)) {
        convertSection.classList.remove('hidden');
    } else {
        convertSection.classList.add('hidden');
    }
    
    // Update convert button text based on status
    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) {
        if (enquiry.status === 'Converted') {
            convertBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
                <span>Complete Admission Setup</span>
            `;
        } else {
            convertBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>Convert Now</span>
            `;
        }
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

function renderTimeline(timeline) {
    const container = document.getElementById('timelineList');

    if (!timeline || !timeline.length) {
        container.innerHTML = '<p class="text-gray-500 text-center">No activity yet</p>';
        return;
    }

    container.innerHTML = timeline.map(item => `
        <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <p class="font-medium text-gray-800">${item.message}</p>
                ${item.metadata?.notePreview ? `<p class="text-sm text-gray-600">${item.metadata.notePreview}</p>` : ''}
                ${item.metadata?.previousStatus ? `<p class="text-sm text-gray-600">${item.metadata.previousStatus} → ${item.metadata.newStatus}</p>` : ''}
                <p class="text-xs text-gray-400 mt-1">${formatRelativeTime(item.timestamp)} by ${item.userName || 'System'}</p>
            </div>
        </div>
    `).join('');
}

function renderNotes(notesString) {
    const container = document.getElementById('notesList');

    if (!notesString) {
        container.innerHTML = '<p class="text-gray-500 text-center">No notes yet</p>';
        return;
    }

    // Parse notes string - split by newlines
    const notes = notesString.split('\n').filter(n => n.trim());

    container.innerHTML = notes.map(note => {
        // Check if note has format: [timestamp] User: message
        const match = note.match(/^\[(.+?)\]\s*(.+?):\s*(.+)$/);
        if (match) {
            const [, timestamp, user, message] = match;
            return `
                <div class="bg-gray-50 rounded-lg p-3">
                    <p class="text-gray-700">${message}</p>
                    <p class="text-xs text-gray-400 mt-1">${timestamp} by ${user}</p>
                </div>
            `;
        }
        // Plain note (initial note)
        return `
            <div class="bg-gray-50 rounded-lg p-3">
                <p class="text-gray-700">${note}</p>
            </div>
        `;
    }).join('');
}

function setupDetailPageListeners(enquiryId) {
    // Status buttons
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!isAssignedToCurrentUser && !isAdmin()) return;

            const status = btn.dataset.status;
            if (!confirm(`Are you sure you want to change status to "${status}"?`)) {
                return;
            }
            try {
                const response = await apiPatch(API_ENDPOINTS.ENQUIRIES.UPDATE_STATUS(enquiryId), { status });
                
                // Check if payment setup is required (for Converted status)
                if (status === 'Converted' && response.data?.requiresPaymentSetup) {
                    showToast('success', 'Success', 'Status updated to Converted. Please configure payment plan.');
                    // Open payment selection modal
                    openPaymentSelectionModal(enquiryId, response.data?.enquiry);
                } else {
                    showToast('success', 'Success', `Status updated to ${status}`);
                }
                
                loadEnquiryDetail(enquiryId);
            } catch (error) {
                showToast('error', 'Error', 'Failed to update status');
            }
        });
    });
    
    // Payment Selection Modal Listeners
    document.getElementById('closePaymentSelectionModal')?.addEventListener('click', closePaymentSelectionModal);
    document.getElementById('cancelPaymentSelection')?.addEventListener('click', closePaymentSelectionModal);
    document.getElementById('paymentSelectionModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closePaymentSelectionModal();
    });
    
    // Add Installment Sub-Modal Listeners
    document.getElementById('closeAddInstallmentSubModal')?.addEventListener('click', closeAddInstallmentSubModal);
    document.getElementById('addInstallmentSubModal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeAddInstallmentSubModal();
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
            loadEnquiryDetail(enquiryId);
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
    
    // Convert to admission - now opens payment selection modal
    document.getElementById('convertBtn')?.addEventListener('click', async () => {
        if (!isAssignedToCurrentUser && !isAdmin()) return;
        
        // First update status to Converted, then check if payment setup is required
        try {
            const response = await apiPatch(API_ENDPOINTS.ENQUIRIES.UPDATE_STATUS(enquiryId), { status: 'Converted' });
            
            if (response.data?.requiresPaymentSetup) {
                showToast('success', 'Success', 'Status updated. Please configure payment plan.');
                openPaymentSelectionModal(enquiryId, response.data?.enquiry);
                loadEnquiryDetail(enquiryId);
            } else {
                // If no payment setup required, redirect to admission
                showToast('success', 'Success', 'Enquiry converted to admission!');
                if (response.data?.admission?._id) {
                    window.location.href = `admissions.html?id=${response.data.admission._id}`;
                }
            }
        } catch (error) {
            const message = error.response?.data?.message || 'Failed to convert enquiry';
            showToast('error', 'Error', message);
        }
    });
}

// ==================== PAYMENT SELECTION MODAL FUNCTIONS ====================

function openPaymentSelectionModal(enquiryId, enquiryData) {
    modalEnquiryId = enquiryId;
    modalSelectedPaymentType = '';
    modalInstallments = [];
    
    // Get course fees from enquiry data
    const course = STATIC_COURSES.find(c => c._id === enquiryData?.course || c.id === enquiryData?.course);
    modalTotalFees = course?.fees || 0;
    
    // Reset form
    document.querySelectorAll('input[name="paymentType"]').forEach(radio => {
        radio.checked = false;
    });
    document.getElementById('oneTimeSection')?.classList.add('hidden');
    document.getElementById('installmentSetupSection')?.classList.add('hidden');
    document.getElementById('modalValidationError')?.classList.add('hidden');
    document.getElementById('createAdmissionBtn').disabled = true;
    
    // Display total fees
    document.getElementById('modalTotalFees').textContent = formatCurrency(modalTotalFees);
    
    // Show modal
    const modal = document.getElementById('paymentSelectionModal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closePaymentSelectionModal() {
    const modal = document.getElementById('paymentSelectionModal');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    
    // Reset state
    modalEnquiryId = null;
    modalSelectedPaymentType = '';
    modalInstallments = [];
}

function handlePaymentTypeSelection() {
    const selected = document.querySelector('input[name="paymentType"]:checked');
    if (!selected) return;
    
    modalSelectedPaymentType = selected.value;
    
    // Update radio visual state
    document.querySelectorAll('input[name="paymentType"]').forEach(radio => {
        const label = radio.closest('label');
        const dot = label?.querySelector('.radio-dot');
        if (radio.checked) {
            label?.classList.add('border-blue-500', 'bg-blue-50');
            dot?.classList.remove('hidden');
        } else {
            label?.classList.remove('border-blue-500', 'bg-blue-50');
            dot?.classList.add('hidden');
        }
    });
    
    // Show/hide sections
    if (modalSelectedPaymentType === 'ONE_TIME') {
        document.getElementById('oneTimeSection')?.classList.remove('hidden');
        document.getElementById('installmentSetupSection')?.classList.add('hidden');
        document.getElementById('createAdmissionBtn').disabled = false;
    } else if (modalSelectedPaymentType === 'INSTALLMENT') {
        document.getElementById('oneTimeSection')?.classList.add('hidden');
        document.getElementById('installmentSetupSection')?.classList.remove('hidden');
        renderModalInstallments();
        validateModalInstallments();
    }
    
    document.getElementById('modalValidationError')?.classList.add('hidden');
}

function renderModalInstallments() {
    const container = document.getElementById('modalInstallmentList');
    const summary = document.getElementById('installmentSummary');
    
    if (!modalInstallments.length) {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">No installments added. Click "Add Installment" to create one.</p>';
        summary?.classList.add('hidden');
        return;
    }
    
    container.innerHTML = modalInstallments.map((inst, index) => `
        <div class="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div class="flex items-center space-x-3">
                <span class="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">${index + 1}</span>
                <div>
                    <p class="font-medium text-gray-800">${formatCurrency(inst.amount)}</p>
                    <p class="text-xs text-gray-500">Due: ${formatDate(inst.dueDate)}</p>
                </div>
            </div>
            <button type="button" onclick="removeModalInstallment(${index})" class="text-red-500 hover:text-red-700 p-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
            </button>
        </div>
    `).join('');
    
    // Show summary
    summary?.classList.remove('hidden');
    const total = modalInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
    document.getElementById('modalTotalInstallments').textContent = formatCurrency(total);
    
    validateModalInstallments();
}

function validateModalInstallments() {
    const createBtn = document.getElementById('createAdmissionBtn');
    const validationMsg = document.getElementById('installmentValidationMessage');
    
    if (modalSelectedPaymentType !== 'INSTALLMENT') {
        createBtn.disabled = false;
        return;
    }
    
    if (!modalInstallments.length) {
        createBtn.disabled = true;
        validationMsg?.classList.add('hidden');
        return;
    }
    
    const total = modalInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
    const difference = modalTotalFees - total;
    
    if (Math.abs(difference) < 0.01) {
        createBtn.disabled = false;
        if (validationMsg) {
            validationMsg.innerHTML = '<span class="text-green-600 flex items-center"><svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>Total matches course fees</span>';
            validationMsg.classList.remove('hidden');
        }
    } else {
        createBtn.disabled = true;
        if (validationMsg) {
            const msg = difference > 0 
                ? `Short by ${formatCurrency(difference)}` 
                : `Exceeds by ${formatCurrency(Math.abs(difference))}`;
            validationMsg.innerHTML = `<span class="text-red-600">${msg}</span>`;
            validationMsg.classList.remove('hidden');
        }
    }
}

function addModalInstallment() {
    // Set default due date to next month
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    document.getElementById('modalInstallmentDueDate').value = nextMonth.toISOString().split('T')[0];
    document.getElementById('modalInstallmentAmount').value = '';
    document.getElementById('modalInstallmentError')?.classList.add('hidden');
    
    const subModal = document.getElementById('addInstallmentSubModal');
    subModal.classList.remove('hidden');
}

function closeAddInstallmentSubModal() {
    document.getElementById('addInstallmentSubModal').classList.add('hidden');
}

function handleAddModalInstallment(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('modalInstallmentAmount').value);
    const dueDate = document.getElementById('modalInstallmentDueDate').value;
    const errorDiv = document.getElementById('modalInstallmentError');
    
    // Validation
    if (!amount || amount <= 0) {
        errorDiv.textContent = 'Amount must be greater than 0';
        errorDiv?.classList.remove('hidden');
        return;
    }
    
    if (!dueDate) {
        errorDiv.textContent = 'Due date is required';
        errorDiv?.classList.remove('hidden');
        return;
    }
    
    // Check if total would exceed fees
    const currentTotal = modalInstallments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
    if (currentTotal + amount > modalTotalFees * 1.5) {
        errorDiv.textContent = 'Installment amounts seem too high. Please verify the total.';
        errorDiv?.classList.remove('hidden');
        return;
    }
    
    modalInstallments.push({
        amount: amount,
        dueDate: dueDate,
        status: 'Pending',
        paidAmount: 0
    });
    
    closeAddInstallmentSubModal();
    renderModalInstallments();
}

function removeModalInstallment(index) {
    modalInstallments.splice(index, 1);
    renderModalInstallments();
}

async function submitAdmissionWithPayment() {
    if (!modalEnquiryId || !modalSelectedPaymentType) return;
    
    const createBtn = document.getElementById('createAdmissionBtn');
    createBtn.disabled = true;
    createBtn.innerHTML = '<span class="spinner"></span> Creating...';
    
    try {
        const payload = {
            paymentType: modalSelectedPaymentType,
            installments: modalSelectedPaymentType === 'INSTALLMENT' ? modalInstallments : []
        };
        
        const response = await apiPost(API_ENDPOINTS.ADMISSIONS.FROM_ENQUIRY(modalEnquiryId), payload);
        
        showToast('success', 'Success', 'Admission created successfully!');
        closePaymentSelectionModal();
        
        // Redirect to admission detail page
        const admissionId = response.data?.admission?._id || response.data?._id;
        if (admissionId) {
            window.location.href = `admissions.html?id=${admissionId}`;
        }
    } catch (error) {
        const message = error.response?.data?.message || 'Failed to create admission';
        const errorDiv = document.getElementById('modalValidationError');
        if (errorDiv) {
            errorDiv.querySelector('p').textContent = message;
            errorDiv.classList.remove('hidden');
        }
        showToast('error', 'Error', message);
    } finally {
        createBtn.disabled = false;
        createBtn.innerHTML = '<span>Create Admission</span>';
    }
}

// Export for global access
window.goToPage = goToPage;
window.loadEnquiryDetail = loadEnquiryDetail;
window.openPaymentSelectionModal = openPaymentSelectionModal;
window.closePaymentSelectionModal = closePaymentSelectionModal;
window.handlePaymentTypeSelection = handlePaymentTypeSelection;
window.addModalInstallment = addModalInstallment;
window.closeAddInstallmentSubModal = closeAddInstallmentSubModal;
window.handleAddModalInstallment = handleAddModalInstallment;
window.removeModalInstallment = removeModalInstallment;
window.submitAdmissionWithPayment = submitAdmissionWithPayment;

// Delete enquiry (admin only)
async function deleteEnquiry(id) {
    if (!isAdmin()) {
        showToast('error', 'Error', 'Only admin can delete enquiries');
        return;
    }
    if (!confirm('Are you sure you want to delete this enquiry? This action cannot be undone.')) {
        return;
    }
    try {
        await apiDelete(API_ENDPOINTS.ENQUIRIES.DELETE(id));
        showToast('success', 'Success', 'Enquiry deleted successfully');
        loadEnquiries();
    } catch (error) {
        showToast('error', 'Error', 'Failed to delete enquiry');
    }
}
window.deleteEnquiry = deleteEnquiry;
