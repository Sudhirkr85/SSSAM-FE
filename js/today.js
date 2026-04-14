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
        // Use dashboard today-calls endpoint (returns { summary: {...}, calls: [...] })
        const res = await apiGet(API_ENDPOINTS.DASHBOARD.TODAY_CALLS);
        const data = res.data || res;

        enquiries = data.todayCalls?.calls || data.calls || data || [];
        paginationData = data.pagination || { page: 1, totalPages: 1, totalCount: enquiries.length };
        totalPages = paginationData.totalPages || 1;

        renderTable();
        renderStats();
        updatePaginationInfoFromServer(paginationData);
    } catch (err) {
        // Fallback to followups endpoint
        try {
            const res = await apiGet(API_ENDPOINTS.DASHBOARD.FOLLOWUPS);

            enquiries = res.data || res.enquiries || res || [];
            paginationData = res.pagination || { page: 1, totalPages: 1, totalCount: enquiries.length };
            totalPages = paginationData.totalPages || 1;

            renderTable();
            renderStats();
            updatePaginationInfoFromServer(paginationData);
        } catch {
            showToast('error', 'Failed to load data');
            renderEmptyState();
        }
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

    table.innerHTML = enquiries.map(e => `
        <tr class="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
            <td class="px-6 py-4">
                <div class="font-medium text-gray-900">${e.name || '-'}</div>
                <div class="text-xs text-gray-500">${e.mobile || ''}</div>
            </td>
            <td class="px-6 py-4 text-gray-700">${e.courseInterested || '-'}</td>
            <td class="px-6 py-4">${getStatusBadge(e.status)}</td>
            <td class="px-6 py-4 ${isOverdue(e.followUpDate) ? 'text-red-600 font-semibold' : 'text-gray-600'}">
                ${formatDate(e.followUpDate)}
                ${isOverdue(e.followUpDate) ? '<span class="ml-1 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Overdue</span>' : ''}
            </td>
            <td class="px-6 py-4 text-center">
                ${getActionButtons(e._id, e.status)}
            </td>
        </tr>
    `).join('');
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

    const pending = enquiries.filter(e =>
        e.status !== 'CONVERTED' && e.status !== 'NOT_INTERESTED'
    ).length;

    const done = enquiries.length - pending;

    document.getElementById('totalCalls').textContent = total;
    document.getElementById('pendingCalls').textContent = pending;
    document.getElementById('doneCalls').textContent = done;
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
    // For today calls, only show next logical action + follow up
    const nextActions = {
        'NEW': { status: 'CONTACTED', label: 'Contacted', color: 'blue' },
        'CONTACTED': { status: 'FOLLOW_UP', label: 'Follow Up', color: 'amber' },
        'FOLLOW_UP': { status: 'INTERESTED', label: 'Interested', color: 'green' },
        'INTERESTED': { status: 'ADMISSION_PROCESS', label: 'Admission', color: 'purple' },
        'ADMISSION_PROCESS': { convert: true, label: 'Convert', color: 'purple' },
        'NO_RESPONSE': { status: 'CONTACTED', label: 'Contacted', color: 'blue' },
        'NOT_INTERESTED': null,
        'CONVERTED': null
    };

    const action = nextActions[status];

    // Always show Add Follow Up button (opens simple modal)
    const followUpBtn = `
        <button onclick="event.stopPropagation(); openFollowUpModal('${id}')"
            class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-xs font-medium transition-colors">
            Add Follow Up
        </button>
    `;

    if (!action) {
        return followUpBtn;
    }

    if (action.convert) {
        return `
            <button onclick="event.stopPropagation(); window.location.href='enquiry-detail.html?id=${id}'"
                class="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium transition-colors mr-1">
                Convert
            </button>
            ${followUpBtn}
        `;
    } else {
        return `
            <button onclick="event.stopPropagation(); openQuickUpdateModal('${id}', '${action.status}', '${status}')"
                class="px-2 py-1 bg-${action.color}-600 hover:bg-${action.color}-700 text-white rounded text-xs font-medium transition-colors mr-1">
                ${action.label}
            </button>
            ${followUpBtn}
        `;
    }
}

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
window.getActionButtons = getActionButtons;
