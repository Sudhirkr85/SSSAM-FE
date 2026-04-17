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
        // Fetch all report data from APIs per documentation
        const [dashboardRes, counselorRes, courseRes, alertsRes] = await Promise.allSettled([
            hasAccess('dashboard') ? apiGet(API_ENDPOINTS.DASHBOARD.GET).catch(err => handleRoleError(err, 'dashboard')) : Promise.resolve({ accessDenied: true }),
            hasAccess('counselor_performance') ? apiGet(`${API_ENDPOINTS.REPORTS.COUNSELOR_PERFORMANCE}?range=monthly`).catch(err => handleRoleError(err, 'counselor_performance')) : Promise.resolve({ accessDenied: true }),
            hasAccess('course_performance') ? apiGet(API_ENDPOINTS.REPORTS.COURSE_PERFORMANCE).catch(err => handleRoleError(err, 'course_performance')) : Promise.resolve({ accessDenied: true }),
            hasAccess('installment_alerts') ? apiGet(API_ENDPOINTS.REPORTS.INSTALLMENT_ALERTS).catch(err => handleRoleError(err, 'installment_alerts')) : Promise.resolve({ accessDenied: true })
        ]);

        // Extract data from settled promises
        const dashboardData = dashboardRes.status === 'fulfilled' ? dashboardRes.value : {};
        const counselorData = counselorRes.status === 'fulfilled' ? counselorRes.value : {};
        const courseData = courseRes.status === 'fulfilled' ? courseRes.value : {};
        const alertsData = alertsRes.status === 'fulfilled' ? alertsRes.value : {};

        // Render all sections
        renderDashboardStats(dashboardData);
        renderCounselor(counselorData);
        renderCourse(courseData);
        renderInstallmentAlerts(alertsData);
    } catch (error) {
        console.error('Reports load error:', error);
        showToast('error', 'Failed to load reports');
    }
}

/* ======================
DASHBOARD STATS (Top Cards)
====================== */
function renderDashboardStats(data) {
    if (data.accessDenied) {
        document.getElementById('reportTotalEnquiries').textContent = 'N/A';
        document.getElementById('reportTotalAdmissions').textContent = 'N/A';
        document.getElementById('reportConversionRate').textContent = 'N/A';
        document.getElementById('reportTotalRevenue').textContent = 'N/A';
        return;
    }

    // Per API docs: data.totalEnquiries, data.totalConversions, data.conversionRate, data.revenue.monthlyRevenue
    document.getElementById('reportTotalEnquiries').textContent = data.totalEnquiries || 0;
    document.getElementById('reportTotalAdmissions').textContent = data.totalConversions || 0;
    document.getElementById('reportConversionRate').textContent = (data.conversionRate || 0) + '%';
    document.getElementById('reportTotalRevenue').textContent = formatCurrency(data.revenue?.monthlyRevenue || 0);
}

/* ======================
COUNSELOR PERFORMANCE
====================== */
function renderCounselor(data) {
    const table = document.getElementById('counselorTable');

    if (data.accessDenied) {
        table.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-400">Access Denied</td></tr>`;
        return;
    }

    // Per API docs: data.counselorStats array
    const counselors = data.counselorStats || [];
    if (!counselors.length) {
        table.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-400">No data</td></tr>`;
        return;
    }

    table.innerHTML = counselors.map(c => `
        <tr>
            <td class="px-6 py-4">${c.counselorName}</td>
            <td class="px-6 py-4">${c.admissions || 0}</td>
            <td class="px-6 py-4 text-green-600">${formatCurrency(c.revenue || 0)}</td>
        </tr>
    `).join('');
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

    // Per API docs: data.courseStats array
    const courses = data.courseStats || [];
    if (!courses.length) {
        table.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-400">No data</td></tr>`;
        return;
    }

    table.innerHTML = courses.map(c => `
        <tr>
            <td class="px-6 py-4">${c.course}</td>
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
