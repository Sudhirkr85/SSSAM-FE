let isLoading = false;

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('totalEnquiries')) return;

    loadDashboard();
});

/* ======================
MAIN LOAD
====================== */

async function loadDashboard() {
    if (isLoading) return;
    isLoading = true;

    try {
        const res = await apiGet(API_ENDPOINTS.DASHBOARD);
        const data = res.data || {};

        ```
renderStats(data);
loadRecent();
```

    } catch {
        fallbackStats();
    } finally {
        isLoading = false;
    }
}

/* ======================
STATS
====================== */

function renderStats(data) {
    const enquiries = data.enquiries || {};
    const followUps = data.followUps || {};

    const total = (enquiries.today || 0) + (enquiries.weekly || 0) + (enquiries.monthly || 0);

    setStat('totalEnquiries', total);
    setStat('newEnquiries', enquiries.today || 0);
    setStat('overdueEnquiries', followUps.overdue || 0);
    setStat('convertedEnquiries', data.convertedCount || 0);
}

function setStat(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value || 0;
}

/* ======================
FALLBACK
====================== */

async function fallbackStats() {
    try {
        const res = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, { limit: 1000 });
        const list = res.data.enquiries || [];

        ```
const today = new Date().toISOString().split('T')[0];

const newToday = list.filter(e => 
  new Date(e.createdAt).toISOString().split('T')[0] === today
).length;

const overdue = list.filter(e => 
  e.followUpDate && new Date(e.followUpDate) < new Date()
).length;

const converted = list.filter(e => e.status === 'CONVERTED').length;

setStat('totalEnquiries', list.length);
setStat('newEnquiries', newToday);
setStat('overdueEnquiries', overdue);
setStat('convertedEnquiries', converted);
```

    } catch {
        setStat('totalEnquiries', 0);
        setStat('newEnquiries', 0);
        setStat('overdueEnquiries', 0);
        setStat('convertedEnquiries', 0);
    }
}

/* ======================
RECENT ENQUIRIES
====================== */

async function loadRecent() {
    try {
        const res = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, { limit: 5 });
        const list = res.data.enquiries || [];

        ```
const table = document.getElementById('recentEnquiriesTable');

if (!list.length) {
  table.innerHTML = emptyRow();
  return;
}

table.innerHTML = list.map(e => row(e)).join('');
```

    } catch {
        document.getElementById('recentEnquiriesTable').innerHTML = errorRow();
        showToast('error', 'Error', 'Failed to load recent enquiries');
    }
}

/* ======================
ROW TEMPLATE
====================== */

function row(e) {
    return `     <tr class="hover:bg-gray-50">       <td class="px-6 py-4 font-medium">${e.name || '-'}</td>       <td class="px-6 py-4 text-gray-600">${e.courseInterested || '-'}</td>       <td class="px-6 py-4">${getStatusBadge(e.status)}</td>       <td class="px-6 py-4 ${isOverdue(e.followUpDate) ? 'text-red-600 font-semibold' : ''}">
        ${formatDate(e.followUpDate)}       </td>       <td class="px-6 py-4 text-sm">
        ${e.assignedTo?.name || 'Unassigned'}       </td>     </tr>
  `;
}

/* ======================
UI HELPERS
====================== */

function emptyRow() {
    return `<tr><td colspan="5" class="text-center py-6 text-gray-400">No data</td></tr>`;
}

function errorRow() {
    return `<tr><td colspan="5" class="text-center py-6 text-red-500">Error loading data</td></tr>`;
}
