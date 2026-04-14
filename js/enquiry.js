let enquiries = [];
let selectedId = null;

/* ======================
INIT
====================== */
document.addEventListener('DOMContentLoaded', () => {
  loadEnquiries();

  document.getElementById('searchInput').addEventListener('input', filterData);
  document.getElementById('statusFilter').addEventListener('change', filterData);
  document.getElementById('resetFilters').addEventListener('click', resetFilters);
});

/* ======================
LOAD DATA
====================== */
async function loadEnquiries() {
  try {
    const res = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, {
      limit: 10
    });


    enquiries = res.enquiries || [];
    renderTable(enquiries);


  } catch {
    showToast('error', 'Error', 'Failed to load enquiries');
  }
}

/* ======================
FILTER
====================== */
function filterData() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const status = document.getElementById('statusFilter').value;

  let filtered = enquiries;

  if (search) {
    filtered = filtered.filter(e =>
      e.name.toLowerCase().includes(search) ||
      e.mobile.includes(search)
    );
  }

  if (status) {
    filtered = filtered.filter(e => e.status === status);
  }

  renderTable(filtered);
}

function resetFilters() {
  document.getElementById('searchInput').value = '';
  document.getElementById('statusFilter').value = '';
  renderTable(enquiries);
}

/* ======================
RENDER
====================== */
function renderTable(data) {
  const table = document.getElementById('enquiryTable');

  if (!data.length) {
    table.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-400">No data</td></tr>`;
    return;
  }

  table.innerHTML = data.map(e => ` <tr class="hover:bg-gray-50">


    < td class= "px-6 py-4 font-medium" > ${e.name}</td >

  <td class="px-6 py-4">${e.courseInterested}</td>

  <td class="px-6 py-4">${getStatusBadge(e.status)}</td>

  <td class="px-6 py-4">${formatDate(e.followUpDate)}</td>

  <td class="px-6 py-4 flex gap-2">

    <button onclick="openModal('${e._id}')"
      class="px-3 py-1 bg-blue-600 text-white rounded text-xs">
      Update
    </button>

  </td>

</tr >
    

`).join('');
}

/* ======================
CREATE
====================== */
async function createEnquiry() {
  const name = document.getElementById('name').value;
  const mobile = document.getElementById('mobile').value;
  const courseInterested = document.getElementById('course').value;

  if (!name || !mobile || !courseInterested) {
    return showToast('error', 'All fields required');
  }

  try {
    await apiPost(API_ENDPOINTS.ENQUIRIES.CREATE, {
      name,
      mobile,
      courseInterested
    });


    showToast('success', 'Created');

    closeCreateModal();
    loadEnquiries();


  } catch {
    showToast('error', 'Failed');
  }
}

function openCreateModal() {
  document.getElementById('createModal').classList.remove('hidden');
}

function closeCreateModal() {
  document.getElementById('createModal').classList.add('hidden');
}

/* ======================
UPDATE
====================== */
function openModal(id) {
  selectedId = id;
  document.getElementById('statusModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('statusModal').classList.add('hidden');
}

async function confirmUpdate() {
  const status = document.getElementById('statusSelect').value;
  const note = document.getElementById('statusNote').value;
  const followUpDate = document.getElementById('followUpDate').value;

  if (!note) {
    return showToast('error', 'Note required');
  }

  if (!confirm('Confirm update?')) return;

  try {
    await apiPut(API_ENDPOINTS.ENQUIRIES.UPDATE_STATUS(selectedId), {
      status,
      note,
      followUpDate
    });


    showToast('success', 'Updated');

    closeModal();
    loadEnquiries();


  } catch {
    showToast('error', 'Update failed');
  }
}

/* ======================
EXPORT
====================== */
window.openModal = openModal;
window.closeModal = closeModal;
window.confirmUpdate = confirmUpdate;
window.openCreateModal = openCreateModal;
window.closeCreateModal = closeCreateModal;
window.createEnquiry = createEnquiry;
