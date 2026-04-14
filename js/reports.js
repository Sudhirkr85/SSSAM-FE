/* ======================
INIT
====================== */
document.addEventListener('DOMContentLoaded', () => {
    loadReports();
});

/* ======================
LOAD REPORT DATA
====================== */
async function loadReports() {
    try {
        const res = await apiGet(API_ENDPOINTS.REPORTS.GET);


        renderStats(res);
        renderCounselor(res);
        renderCourse(res);


    } catch {
        showToast('error', 'Error', 'Failed to load reports');
    }
}

/* ======================
TOP STATS
====================== */
function renderStats(data) {
    document.getElementById('reportTotalEnquiries').textContent = data.totalEnquiries || 0;
    document.getElementById('reportTotalAdmissions').textContent = data.totalAdmissions || 0;
    document.getElementById('reportConversionRate').textContent = (data.conversionRate || 0) + '%';
    document.getElementById('reportTotalRevenue').textContent = formatCurrency(data.totalRevenue || 0);
}

/* ======================
COUNSELOR PERFORMANCE
====================== */
function renderCounselor(data) {
    const table = document.getElementById('counselorTable');

    if (!data.counselors || !data.counselors.length) {
        table.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-400">No data</td></tr>`;
        return;
    }

    table.innerHTML = data.counselors.map(c => `     <tr>       <td class="px-6 py-4">${c.name}</td>       <td class="px-6 py-4">${c.admissions}</td>       <td class="px-6 py-4 text-green-600">${formatCurrency(c.revenue)}</td>     </tr>
  `).join('');
}

/* ======================
COURSE PERFORMANCE
====================== */
function renderCourse(data) {
    const table = document.getElementById('courseTable');

    if (!data.courses || !data.courses.length) {
        table.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-400">No data</td></tr>`;
        return;
    }

    table.innerHTML = data.courses.map(c => `     <tr>       <td class="px-6 py-4">${c.name}</td>       <td class="px-6 py-4">${c.admissions}</td>       <td class="px-6 py-4 text-green-600">${formatCurrency(c.revenue)}</td>     </tr>
  `).join('');
}
