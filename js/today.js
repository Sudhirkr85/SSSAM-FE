let enquiries = [];
let selectedId = null;

// Pagination state
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let totalPages = 1;
let paginationData = { page: 1, totalPages: 1, totalCount: 0 };

/* ======================
INIT
====================== */
document.addEventListener('DOMContentLoaded', () => {
    loadTodayCalls();
});

/* ======================
LOAD DATA
====================== */
async function loadTodayCalls() {
    try {
        // Load both NEW enquiries and FOLLOW_UP enquiries
        const [newRes, followUpRes] = await Promise.all([
            // NEW enquiries - fresh leads to call
            apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, {
                page: 1,
                limit: 100,
                status: 'NEW'
            }),
            // FOLLOW_UP enquiries - all of them (we'll filter client-side)
            apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, {
                page: 1,
                limit: 100,
                status: 'FOLLOW_UP'
            })
        ]);

        // Get all NEW enquiries
        const newEnquiries = newRes.enquiries || [];
        
        // Filter FOLLOW_UP enquiries for today or overdue (client-side filtering)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const followUpEnquiries = (followUpRes.enquiries || []).filter(e => {
            if (!e.followUpDate) return false;
            const followUpDate = new Date(e.followUpDate);
            followUpDate.setHours(0, 0, 0, 0);
            // Show if follow-up date is today or in the past (overdue)
            return followUpDate <= today;
        });
        
        console.log('NEW enquiries:', newEnquiries.length);
        console.log('FOLLOW_UP enquiries (today/overdue):', followUpEnquiries.length);
        
        // Merge and remove duplicates (by _id)
        const combined = [...newEnquiries, ...followUpEnquiries];
        const unique = combined.filter((item, index, self) => 
            index === self.findIndex((t) => t._id === item._id)
        );
        
        // Sort: NEW first, then by follow-up date (overdue first, then today)
        enquiries = unique.sort((a, b) => {
            // NEW status comes first
            if (a.status === 'NEW' && b.status !== 'NEW') return -1;
            if (a.status !== 'NEW' && b.status === 'NEW') return 1;
            
            // Then sort by follow-up date (overdue first, then today)
            const dateA = a.followUpDate ? new Date(a.followUpDate) : new Date(8640000000000000);
            const dateB = b.followUpDate ? new Date(b.followUpDate) : new Date(8640000000000000);
            return dateA - dateB;
        });

        // Simple pagination (client-side since we have all data)
        const totalCount = enquiries.length;
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const paginatedEnquiries = enquiries.slice(startIndex, endIndex);
        
        totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE) || 1;
        paginationData = { 
            page: currentPage, 
            totalPages: totalPages, 
            totalCount: totalCount 
        };

        // Use paginated data for display
        enquiries = paginatedEnquiries;

        renderTable();
        renderStats();
        updatePaginationInfoFromServer(paginationData);
    } catch (err) {
        console.error('Error loading today calls:', err);
        showToast('error', 'Failed to load data');
        renderEmptyState();
    }
}

/* ======================
RENDER TABLE
====================== */
function renderTable() {
    const table = document.getElementById('todayCallsTable');

    if (!enquiries.length) {
        renderEmptyState();
        return;
    }

    table.innerHTML = enquiries.map(e => {
        const isNew = e.status === 'NEW';
        const followUpDisplay = isNew 
            ? '<span class="text-blue-600 font-medium">New Lead</span>' 
            : `${formatDate(e.followUpDate)}${isOverdue(e.followUpDate) ? '<span class="ml-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Overdue</span>' : ''}`;
        
        return `
        <tr onclick="window.location.href='enquiry-detail.html?id=${e._id}'" class="cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
            <td class="px-6 py-4">
                <div class="font-medium text-gray-900">${e.name || '-'}</div>
                <div class="text-xs text-gray-500">${e.mobile || ''}</div>
            </td>
            <td class="px-6 py-4 text-gray-700">${e.courseInterested || '-'}</td>
            <td class="px-6 py-4">${getStatusBadge(e.status)}</td>
            <td class="px-6 py-4 ${!isNew && isOverdue(e.followUpDate) ? 'text-red-600 font-semibold' : 'text-gray-600'}">
                ${followUpDisplay}
            </td>
            <td class="px-6 py-4 text-center" onclick="event.stopPropagation();">
                ${getActionButtons(e._id, e.status)}
            </td>
        </tr>
    `}).join('');
}

function renderEmptyState() {
    const table = document.getElementById('todayCallsTable');
    table.innerHTML = `
        <tr>
            <td colspan="5" class="text-center py-12">
                <div class="flex flex-col items-center gap-3">
                    <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                        <i data-lucide="check-circle" class="w-8 h-8 text-green-500"></i>
                    </div>
                    <div>
                        <p class="text-gray-800 font-medium">No calls for today!</p>
                        <p class="text-gray-500 text-sm">You're all caught up</p>
                    </div>
                </div>
            </td>
        </tr>
    `;
}

/* ======================
PAGINATION
====================== */
function changePage(direction) {
    const newPage = currentPage + direction;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        loadTodayCalls();
    }
}

function goToPage(page) {
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        loadTodayCalls();
    }
}

function goToLastPage() {
    currentPage = totalPages;
    loadTodayCalls();
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
STATS
====================== */
function renderStats() {
    const total = paginationData.totalCount || 0;
    
    // Count NEW enquiries (fresh leads)
    const newCount = enquiries.filter(e => e.status === 'NEW').length;
    
    // Count FOLLOW_UP enquiries (today + overdue)
    const followUpCount = enquiries.filter(e => e.status === 'FOLLOW_UP').length;

    document.getElementById('totalCalls').textContent = total;
    document.getElementById('pendingCalls').textContent = newCount;
    document.getElementById('doneCalls').textContent = followUpCount;
    
    // Update labels
    const pendingLabel = document.getElementById('pendingLabel');
    const doneLabel = document.getElementById('doneLabel');
    if (pendingLabel) pendingLabel.textContent = 'New Leads';
    if (doneLabel) doneLabel.textContent = 'Follow-ups';
}

/* ======================
MODAL
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
        loadTodayCalls();
    } catch {
        showToast('error', 'Failed to update status');
    }
}

/* ======================
ACTION BUTTONS
====================== */
function getActionButtons(id, status) {
    // Generate unique dropdown ID for each row
    const dropdownId = `action-dropdown-${id}`;
    
    // Status options for the dropdown
    const statusOptions = [
        { value: 'CONTACTED', label: 'Contacted', icon: 'phone' },
        { value: 'NO_RESPONSE', label: 'Call Not Picked', icon: 'phone-off' },
        { value: 'FOLLOW_UP', label: 'Follow Up', icon: 'calendar-clock' },
        { value: 'INTERESTED', label: 'Interested', icon: 'thumbs-up' },
        { value: 'NOT_INTERESTED', label: 'Not Interested', icon: 'thumbs-down' },
        { value: 'ADMISSION_PROCESS', label: 'Admission Process', icon: 'graduation-cap' }
    ];

    // Filter out current status from options
    const availableOptions = statusOptions.filter(opt => opt.value !== status);

    return `
        <div class="relative inline-block text-left" onclick="event.stopPropagation();">
            <button onclick="toggleActionDropdown('${dropdownId}')" 
                class="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors">
                <span>Action</span>
                <i data-lucide="chevron-down" class="w-4 h-4"></i>
            </button>
            <div id="${dropdownId}" class="hidden absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-50 py-1">
                ${availableOptions.map(opt => `
                    <button onclick="handleAction('${id}', '${opt.value}'); hideAllDropdowns();"
                        class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                        <i data-lucide="${opt.icon}" class="w-4 h-4 text-gray-500"></i>
                        ${opt.label}
                    </button>
                `).join('')}

                <div class="border-t border-gray-100 my-1"></div>
                <button onclick="event.stopPropagation(); openFollowUpModal('${id}'); hideAllDropdowns();"
                    class="w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 flex items-center gap-2 transition-colors">
                    <i data-lucide="calendar-plus" class="w-4 h-4"></i>
                    Add Follow Up
                </button>
                <button onclick="event.stopPropagation(); window.location.href='enquiry-detail.html?id=${id}'; hideAllDropdowns();"
                    class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors">
                    <i data-lucide="eye" class="w-4 h-4 text-gray-500"></i>
                    View Details
                </button>
            </div>
        </div>
    `;
}

// Toggle dropdown visibility
function toggleActionDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    // Hide all other dropdowns first
    hideAllDropdowns();
    
    // Toggle this dropdown
    dropdown.classList.toggle('hidden');
    
    // Re-create icons inside dropdown
    if (!dropdown.classList.contains('hidden') && typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Hide all dropdowns
function hideAllDropdowns() {
    document.querySelectorAll('[id^="action-dropdown-"]').forEach(el => {
        el.classList.add('hidden');
    });
}

// Handle action selection
function handleAction(id, newStatus) {
    // Set the status in the dropdown and open the modal
    const statusSelect = document.getElementById('statusSelect');
    if (statusSelect) {
        statusSelect.value = newStatus;
    }
    openModal(id);
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.relative.inline-block')) {
        hideAllDropdowns();
    }
});

/* ======================
SIMPLE FOLLOW UP MODAL (No Status Change)
====================== */
let followUpId = null;

function openFollowUpModal(id) {
    followUpId = id;
    const modal = document.getElementById('followUpModal');
    const modalContent = document.getElementById('followUpModalContent');

    // Reset form
    document.getElementById('followUpNote').value = '';
    document.getElementById('followUpDateInput').value = '';
    clearFollowUpErrors();

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
}

function closeFollowUpModal() {
    const modal = document.getElementById('followUpModal');
    const modalContent = document.getElementById('followUpModalContent');
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function clearFollowUpErrors() {
    const noteError = document.getElementById('followUpNoteError');
    const noteInput = document.getElementById('followUpNote');
    const apiError = document.getElementById('followUpApiError');

    noteError.classList.add('hidden');
    noteInput.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
    noteInput.classList.add('border-gray-200', 'focus:border-blue-500', 'focus:ring-blue-100');

    if (apiError) {
        apiError.classList.add('hidden');
    }
}

function validateFollowUpNote() {
    const note = document.getElementById('followUpNote');
    const error = document.getElementById('followUpNoteError');
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

async function submitFollowUp() {
    if (!validateFollowUpNote()) {
        showToast('error', 'Please add a note');
        return;
    }

    const note = document.getElementById('followUpNote').value;
    const followUpDate = document.getElementById('followUpDateInput').value;

    try {
        // Use FOLLOW_UP status and only update note + date
        await apiPut(API_ENDPOINTS.ENQUIRIES.UPDATE_STATUS(followUpId), {
            status: 'FOLLOW_UP',
            note,
            followUpDate
        });

        showToast('success', 'Follow up added successfully');
        closeFollowUpModal();
        loadTodayCalls();
    } catch (err) {
        // Show error in modal
        const errorDiv = document.getElementById('followUpApiError');
        const errorText = document.getElementById('followUpErrorText');

        if (errorDiv && errorText) {
            let message = 'Failed to add follow up';
            if (err.response?.data?.message) {
                message = err.response.data.message;
            } else if (err.message) {
                message = err.message;
            }
            errorText.textContent = message;
            errorDiv.classList.remove('hidden');
        } else {
            showToast('error', 'Failed to add follow up');
        }
    }
}

/* ======================
QUICK UPDATE MODAL (for action buttons)
====================== */
let quickUpdateId = null;
let quickTargetStatus = '';

function openQuickUpdateModal(id, targetStatus, currentStatus = '') {
    quickUpdateId = id;
    quickTargetStatus = targetStatus;

    const modal = document.getElementById('quickUpdateModal');
    const modalContent = document.getElementById('quickUpdateModalContent');

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
    document.getElementById('quickCurrentStatus').textContent = targetLabel;

    // Set target status in hidden field
    document.getElementById('quickTargetStatus').value = targetStatus;

    // Show/hide date field based on target status
    const dateContainer = document.getElementById('quickFollowUpDateContainer');
    if (targetStatus === 'FOLLOW_UP') {
        dateContainer.classList.remove('hidden');
    } else {
        dateContainer.classList.add('hidden');
        document.getElementById('quickFollowUpDate').value = '';
    }

    // Reset form
    document.getElementById('quickNote').value = '';
    clearQuickUpdateErrors();

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
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

function clearQuickUpdateErrors() {
    const noteError = document.getElementById('quickNoteError');
    const noteInput = document.getElementById('quickNote');
    const apiError = document.getElementById('quickErrorMessage');

    noteError.classList.add('hidden');
    noteInput.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
    noteInput.classList.add('border-gray-200', 'focus:border-blue-500', 'focus:ring-blue-100');

    if (apiError) {
        apiError.classList.add('hidden');
    }
}

function validateQuickUpdateNote() {
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
    if (!validateQuickUpdateNote()) {
        showToast('error', 'Please add a note');
        return;
    }

    const status = document.getElementById('quickTargetStatus').value;
    const note = document.getElementById('quickNote').value;
    const followUpDate = document.getElementById('quickFollowUpDate').value;

    // Build payload
    const payload = { status, note };
    if (status === 'FOLLOW_UP' && followUpDate) {
        payload.followUpDate = followUpDate;
    }

    try {
        await apiPut(API_ENDPOINTS.ENQUIRIES.UPDATE_STATUS(quickUpdateId), payload);

        showToast('success', 'Status updated successfully');
        closeQuickUpdateModal();
        loadTodayCalls();
    } catch (err) {
        const errorDiv = document.getElementById('quickErrorMessage');
        const errorText = document.getElementById('quickErrorText');

        if (errorDiv && errorText) {
            let message = 'Failed to update status';
            if (err.response?.data?.message) {
                message = err.response.data.message;
            } else if (err.message) {
                message = err.message;
            }
            errorText.textContent = message;
            errorDiv.classList.remove('hidden');
        } else {
            showToast('error', 'Failed to update status');
        }
    }
}

/* ======================
HELPERS
====================== */
function isOverdue(date) {
    if (!date) return false;
    return new Date(date) < new Date();
}

/* ======================
EXPORT
====================== */
window.openModal = openModal;
window.closeModal = closeModal;
window.openConfirmModal = openConfirmModal;
window.closeConfirmModal = closeConfirmModal;
window.executeUpdate = executeUpdate;
window.changePage = changePage;
window.goToPage = goToPage;
window.goToLastPage = goToLastPage;
window.openFollowUpModal = openFollowUpModal;
window.closeFollowUpModal = closeFollowUpModal;
window.submitFollowUp = submitFollowUp;
window.openQuickUpdateModal = openQuickUpdateModal;
window.closeQuickUpdateModal = closeQuickUpdateModal;
window.submitQuickUpdate = submitQuickUpdate;
window.getActionButtons = getActionButtons;
