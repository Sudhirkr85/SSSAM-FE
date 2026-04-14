/* ===========================
FINAL ENQUIRY.JS (PREMIUM UI)
Icon-based • Clean • Production
=========================== */

let enquiries = [];
let filters = {
page: 1,
limit: 10,
status: '',
search: ''
};

/* ===========================
INIT
=========================== */

document.addEventListener('DOMContentLoaded', () => {
loadEnquiries();
});

/* ===========================
FETCH
=========================== */

async function loadEnquiries() {
try {
const params = cleanParams(filters);
const res = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, params);

```
enquiries = res.data.enquiries || [];
renderEnquiries();

if (window.lucide) lucide.createIcons();
```

} catch {
showToast('error', 'Error', 'Failed to load enquiries');
}
}

function cleanParams(params) {
const clean = {};
Object.keys(params).forEach(k => {
if (params[k]) clean[k] = params[k];
});
return clean;
}

/* ===========================
RENDER
=========================== */

function renderEnquiries() {
const tbody = document.getElementById('enquiryTableBody');
if (!tbody) return;

if (!enquiries.length) {
tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-400">No enquiries found</td></tr>`;
return;
}

tbody.innerHTML = enquiries.map(e => `     <tr class="hover:bg-gray-50 transition-all duration-150">       <td class="py-3 font-medium">${e.name}</td>       <td>${e.courseInterested}</td>       <td>${statusBadge(e.status)}</td>       <td>${formatDate(e.followUpDate)}</td>       <td>         <div class="flex gap-2">
          ${renderActions(e)}         </div>       </td>     </tr>
  `).join('');
}

/* ===========================
STATUS BADGE
=========================== */

function statusBadge(status) {
const styles = {
NEW: 'bg-gray-100 text-gray-600',
CONTACTED: 'bg-blue-100 text-blue-600',
FOLLOW_UP: 'bg-yellow-100 text-yellow-700',
INTERESTED: 'bg-green-100 text-green-600',
NOT_INTERESTED: 'bg-red-100 text-red-600',
CONVERTED: 'bg-purple-100 text-purple-600'
};

return `<span class="px-2 py-1 text-xs rounded ${styles[status] || 'bg-gray-100'}">${status}</span>`;
}

/* ===========================
ACTION BUTTONS (ICON BASED)
=========================== */

function actionBtn(icon, action, title) {
return `     <button 
      onclick="${action}" 
      class="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 transition"
      title="${title}">       <i data-lucide="${icon}" class="w-4 h-4"></i>     </button>
  `;
}

function renderActions(e) {
let btns = `    ${actionBtn('phone',`openStatusModal('${e._id}','CONTACTED')`, 'Contacted')}
    ${actionBtn('calendar', `openStatusModal('${e._id}','FOLLOW_UP')`, 'Follow Up')}
    ${actionBtn('thumbs-up', `openStatusModal('${e._id}','INTERESTED')`, 'Interested')}
    ${actionBtn('x-circle', `openStatusModal('${e._id}','NOT_INTERESTED')`, 'Not Interested')}
  `;

if (e.status === 'INTERESTED') {
btns += actionBtn('graduation-cap', `openConvertModal('${e._id}')`, 'Convert');
}

return btns;
}

/* ===========================
MODAL
=========================== */

function openStatusModal(id, status) {
document.getElementById('statusEnquiryId').value = id;
document.getElementById('statusTargetStatus').value = status;
document.getElementById('statusModal').classList.remove('hidden');
}

function closeStatusModal() {
document.getElementById('statusModal').classList.add('hidden');
}

/* ===========================
UPDATE
=========================== */

async function handleStatusSubmit(e) {
e.preventDefault();

const id = document.getElementById('statusEnquiryId').value;
const status = document.getElementById('statusTargetStatus').value;
const note = document.getElementById('statusNote').value.trim();
const date = document.getElementById('statusFollowUpDate').value;

if (!note) {
showToast('error', 'Error', 'Note required');
return;
}

const payload = { status, note };

if (status === 'FOLLOW_UP' && date) {
payload.followUpDate = new Date(date).toISOString();
}

try {
await apiPut(API_ENDPOINTS.ENQUIRIES.UPDATE_STATUS(id), payload);

```
showToast('success', 'Success', 'Updated');
closeStatusModal();
loadEnquiries();
```

} catch (err) {
showToast('error', 'Error', err.response?.data?.message || 'Failed');
}
}

/* ===========================
CONVERT
=========================== */

function openConvertModal(id) {
document.getElementById('convertEnquiryId').value = id;
document.getElementById('convertModal').classList.remove('hidden');
}

function closeConvertModal() {
document.getElementById('convertModal').classList.add('hidden');
}

async function handleConvertSubmit(e) {
e.preventDefault();

const id = document.getElementById('convertEnquiryId').value;
const course = document.getElementById('convertCourse').value;
const totalFees = document.getElementById('convertFees').value;

if (!course || !totalFees) {
showToast('error', 'Error', 'All fields required');
return;
}

try {
await apiPost(API_ENDPOINTS.ADMISSIONS.FROM_ENQUIRY(id), {
course,
totalFees
});

```
showToast('success', 'Converted');
closeConvertModal();
loadEnquiries();
```

} catch {
showToast('error', 'Error', 'Conversion failed');
}
}

/* ===========================
SEARCH
=========================== */

let timeout;

function handleSearch(value) {
clearTimeout(timeout);
timeout = setTimeout(() => {
filters.search = value;
loadEnquiries();
}, 300);
}

/* ===========================
UTIL
=========================== */

function formatDate(date) {
if (!date) return '-';
return new Date(date).toLocaleDateString();
}
