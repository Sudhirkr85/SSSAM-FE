/* ======================
INIT
====================== */
document.addEventListener('DOMContentLoaded', () => {
    // Check role-based access - only admin can view reports
    if (!isAdmin()) {
        showToast('error', 'Access denied. Admin privileges required.');
        window.location.href = 'dashboard.html';
        return;
    }
    loadReports();
});

/* ======================
LOAD REPORT DATA
====================== */
async function loadReports() {
    try {
        // Fetch dashboard data + actual payments for accurate revenue
        const [dashboardRes, paymentsRes, counselorRes, courseRes, alertsRes] = await Promise.allSettled([
            hasAccess('dashboard') ? apiGet(API_ENDPOINTS.DASHBOARD.GET).catch(err => handleRoleError(err, 'dashboard')) : Promise.resolve({ accessDenied: true }),
            hasAccess('dashboard') ? fetchAllPayments().catch(() => []) : Promise.resolve([]),
            hasAccess('counselor_performance') ? apiGet(`${API_ENDPOINTS.REPORTS.COUNSELOR_PERFORMANCE}?range=monthly`).catch(err => handleRoleError(err, 'counselor_performance')) : Promise.resolve({ accessDenied: true }),
            hasAccess('course_performance') ? apiGet(API_ENDPOINTS.REPORTS.COURSE_PERFORMANCE).catch(err => handleRoleError(err, 'course_performance')) : Promise.resolve({ accessDenied: true }),
            hasAccess('installment_alerts') ? apiGet(API_ENDPOINTS.REPORTS.INSTALLMENT_ALERTS).catch(err => handleRoleError(err, 'installment_alerts')) : Promise.resolve({ accessDenied: true })
        ]);

        // Extract data from settled promises
        const dashboardData = dashboardRes.status === 'fulfilled' ? dashboardRes.value : {};
        const allPayments = paymentsRes.status === 'fulfilled' ? paymentsRes.value : [];
        const counselorData = counselorRes.status === 'fulfilled' ? counselorRes.value : {};
        const courseData = courseRes.status === 'fulfilled' ? courseRes.value : {};
        const alertsData = alertsRes.status === 'fulfilled' ? alertsRes.value : {};

        // Calculate actual revenue from payments
        const actualRevenue = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        // Render dashboard stats for top cards with actual revenue
        renderDashboardStats(dashboardData, actualRevenue);
        renderCounselor(counselorData, allPayments);
        renderCourse(courseData);
        renderInstallmentAlerts(alertsData);
    } catch (error) {
        console.error('Reports load error:', error);
        showToast('error', 'Failed to load reports');
    }
}

/* ======================
FETCH ALL PAYMENTS (for accurate revenue)
====================== */
async function fetchAllPayments() {
    // Get all admissions first
    const admissionsRes = await apiGet(API_ENDPOINTS.ADMISSIONS.GET_ALL, { page: 1, limit: 1000 });
    const admissions = admissionsRes.admissions || [];

    // Fetch payments for each admission
    const paymentPromises = admissions.map(a =>
        apiGet(API_ENDPOINTS.PAYMENTS.GET_BY_ADMISSION(a._id))
            .then(res => res.payments || [])
            .catch(() => [])
    );

    const paymentArrays = await Promise.all(paymentPromises);
    return paymentArrays.flat();
}

/* ======================
DASHBOARD STATS (Top Cards)
====================== */
function renderDashboardStats(data, actualRevenue) {
    if (data.accessDenied) {
        document.getElementById('reportTotalEnquiries').textContent = 'N/A';
        document.getElementById('reportTotalAdmissions').textContent = 'N/A';
        document.getElementById('reportConversionRate').textContent = 'N/A';
        document.getElementById('reportTotalRevenue').textContent = 'N/A';
        return;
    }

    // Per API docs: data.totalEnquiries, data.admissions.totalAdmissions, data.conversionRate
    // Use actualRevenue calculated from real payments (backend revenue is incorrect)
    document.getElementById('reportTotalEnquiries').textContent = data.totalEnquiries || 0;
    document.getElementById('reportTotalAdmissions').textContent = data.admissions?.totalAdmissions || 0;
    document.getElementById('reportConversionRate').textContent = (data.conversionRate || 0) + '%';
    document.getElementById('reportTotalRevenue').textContent = formatCurrency(actualRevenue || data.revenue?.monthlyRevenue || 0);
}

/* ======================
COUNSELOR PERFORMANCE
====================== */
function renderCounselor(data, allPayments) {
    const table = document.getElementById('counselorTable');

    if (data.accessDenied) {
        table.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-400">Access Denied</td></tr>`;
        return;
    }

    const counselors = data.counselorStats || data.counselors || [];
    if (!counselors.length) {
        table.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-400">No data</td></tr>`;
        return;
    }

    table.innerHTML = counselors.map(c => {
        // Calculate actual revenue from payments for this counselor
        const counselorRevenue = c.revenue || 0;
        return `
            <tr>
                <td class="px-6 py-4">${c.counselorName || c.name}</td>
                <td class="px-6 py-4">${c.admissions || c.convertedEnquiries || 0}</td>
                <td class="px-6 py-4 text-green-600">${formatCurrency(counselorRevenue)}</td>
            </tr>
        `;
    }).join('');
}

/* ======================
COURSE PERFORMANCE
====================== */
function renderCourse(data) {
    const table = document.getElementById('courseTable');

    if (data.accessDenied) {
        table.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-400">Access Denied</td></tr>`;
        return;
    }

    const courses = data.courseStats || data.courses || [];
    if (!courses.length) {
        table.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-400">No data</td></tr>`;
        return;
    }

    table.innerHTML = courses.map(c => `
        <tr>
            <td class="px-6 py-4">${c.course || c.name}</td>
            <td class="px-6 py-4">${c.admissions || 0}</td>
            <td class="px-6 py-4 text-green-600">${formatCurrency(c.revenue || 0)}</td>
        </tr>
    `).join('');
}

/* ======================
INSTALLMENT ALERTS
====================== */
function renderInstallmentAlerts(data) {
    // This can be used to show alerts section in reports page
    // For now, just log if data is available
    if (data.accessDenied) {
        console.log('Installment alerts: Access denied');
        return;
    }
    
    const summary = data.summary || {};
    console.log('Installment alerts:', {
        upcoming: summary.upcomingCount || 0,
        overdue: summary.overdueCount || 0
    });
}
