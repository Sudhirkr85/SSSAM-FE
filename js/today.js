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
        const today = new Date().toISOString().split('T')[0];
        const res = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, {
            followUpDate: today,
            page: currentPage,
            limit: ITEMS_PER_PAGE
        });

        enquiries = res.enquiries || [];
        paginationData = res.pagination || { page: 1, totalPages: 1, totalCount: 0 };
        totalPages = paginationData.totalPages || 1;

        renderTable();
        renderStats();
        updatePaginationInfoFromServer(paginationData);
    } catch (err) {
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
                <button onclick="openModal('${e._id}')"
                    class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm">
                    Update
                </button>
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
