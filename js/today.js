let enquiries = [];
let selectedId = null;

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
            followUpDate: today
        });

        enquiries = res.enquiries || [];

        renderTable();
        renderStats();


    } catch {
        showToast('error', 'Error', 'Failed to load data');
    }
}

/* ======================
RENDER TABLE
====================== */
function renderTable() {
    const table = document.getElementById('todayCallsTable');

    if (!enquiries.length) {
        table.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-400">No calls today</td></tr>`;
        return;
    }

    table.innerHTML = enquiries.map(e => ` <tr class="hover:bg-gray-50">


        < td class= "px-6 py-4 font-medium" > ${e.name}</td >

  <td class="px-6 py-4">${e.courseInterested}</td>

  <td class="px-6 py-4">
    ${getStatusBadge(e.status)}
  </td>

  <td class="px-6 py-4 ${isOverdue(e.followUpDate) ? 'text-red-600 font-semibold' : ''}">
    ${formatDate(e.followUpDate)}
  </td>

  <td class="px-6 py-4 flex gap-2">

    <button onclick="openModal('${e._id}')"
      class="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">
      Update
    </button>

  </td>

</tr >
        

`).join('');
}

/* ======================
STATS
====================== */
function renderStats() {
    const total = enquiries.length;

    const pending = enquiries.filter(e =>
        e.status !== 'CONVERTED' && e.status !== 'NOT_INTERESTED'
    ).length;

    const done = total - pending;

    document.getElementById('totalCalls').textContent = total;
    document.getElementById('pendingCalls').textContent = pending;
    document.getElementById('doneCalls').textContent = done;
}

/* ======================
MODAL
====================== */
function openModal(id) {
    selectedId = id;
    document.getElementById('statusModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('statusModal').classList.add('hidden');
}

/* ======================
CONFIRM UPDATE
====================== */
async function confirmUpdate() {
    const status = document.getElementById('statusSelect').value;
    const note = document.getElementById('statusNote').value;
    const followUpDate = document.getElementById('followUpDate').value;

    if (!note) {
        return showToast('error', 'Note required');
    }

    const confirmAction = confirm('Are you sure you want to update status?');
    if (!confirmAction) return;

    try {
        await apiPut(API_ENDPOINTS.ENQUIRIES.UPDATE_STATUS(selectedId), {
            status,
            note,
            followUpDate
        });


        showToast('success', 'Updated');

        closeModal();
        loadTodayCalls();


    } catch {
        showToast('error', 'Update failed');
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
window.confirmUpdate = confirmUpdate;
