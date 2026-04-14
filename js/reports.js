let period = 'daily';

/* ======================
INIT
====================== */

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('reportsDashboard')) return;

    if (!isAdmin()) {
        document.getElementById('accessDenied').classList.remove('hidden');
        document.getElementById('reportsDashboard').classList.add('hidden');
        return;
    }

    setupPeriodButtons();
    loadReports();
});

/* ======================
PERIOD SWITCH
====================== */

function setupPeriodButtons() {
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('bg-blue-600', 'text-white'));
            btn.classList.add('bg-blue-600', 'text-white');


            period = btn.dataset.period;
            loadReports();
        });


    });
}

/* ======================
LOAD REPORTS
====================== */

async function loadReports() {
    try {
        const [enqRes, admRes, payRes] = await Promise.all([
            apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, { limit: 1000 }),
            apiGet(API_ENDPOINTS.ADMISSIONS.GET_ALL, { limit: 1000 }),
            apiGet(API_ENDPOINTS.PAYMENTS.GET_ALL, { limit: 1000 })
        ]);


        const enquiries = enqRes.enquiries || [];
        const admissions = admRes.admissions || [];
        const payments = payRes.payments || [];

        renderStats(enquiries, admissions, payments);
        renderCounselor(admissions);
        renderCourse(admissions);


    } catch {
        showToast('error', 'Error', 'Failed to load reports');
    }
}

/* ======================
STATS
====================== */

function renderStats(enquiries, admissions, payments) {

    const totalEnquiries = enquiries.length;
    const totalAdmissions = admissions.length;

    const revenue = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    const conversion = totalEnquiries > 0
        ? ((totalAdmissions / totalEnquiries) * 100).toFixed(1)
        : 0;

    document.getElementById('reportTotalEnquiries').textContent = totalEnquiries;
    document.getElementById('reportTotalAdmissions').textContent = totalAdmissions;
    document.getElementById('reportConversionRate').textContent = conversion + '%';
    document.getElementById('reportTotalRevenue').textContent = formatCurrency(revenue);
}

/* ======================
COUNSELOR TABLE
====================== */

function renderCounselor(admissions) {
    const table = document.getElementById('counselorTable');

    if (!admissions.length) {
        table.innerHTML = emptyRow();
        return;
    }

    const map = {};

    admissions.forEach(a => {
        const name = a.createdBy?.name || 'Unknown';


        if (!map[name]) {
            map[name] = { name, count: 0, revenue: 0 };
        }

        map[name].count++;
        map[name].revenue += a.totalFees || 0;


    });

    const list = Object.values(map);

    table.innerHTML = list.map(c => `     <tr>       <td class="px-6 py-4">${c.name}</td>       <td class="px-6 py-4">${c.count}</td>       <td class="px-6 py-4 text-green-600">${c.count}</td>       <td class="px-6 py-4">100%</td>       <td class="px-6 py-4">${formatCurrency(c.revenue)}</td>     </tr>
  `).join('');
}

/* ======================
COURSE TABLE
====================== */

function renderCourse(admissions) {
    const table = document.getElementById('courseTable');

    if (!admissions.length) {
        table.innerHTML = emptyRow();
        return;
    }

    const map = {};

    admissions.forEach(a => {
        const course = a.enquiryId?.courseInterested || 'Unknown';


        if (!map[course]) {
            map[course] = { name: course, count: 0, revenue: 0 };
        }

        map[course].count++;
        map[course].revenue += a.totalFees || 0;


    });

    const list = Object.values(map);

    table.innerHTML = list.map(c => `     <tr>       <td class="px-6 py-4">${c.name}</td>       <td class="px-6 py-4">${c.count}</td>       <td class="px-6 py-4 text-green-600">${c.count}</td>       <td class="px-6 py-4">100%</td>       <td class="px-6 py-4">${formatCurrency(c.revenue)}</td>     </tr>
  `).join('');
}

/* ======================
HELPERS
====================== */

function emptyRow() {
    return `<tr><td colspan="5" class="text-center py-6 text-gray-400">No data</td></tr>`;
}
