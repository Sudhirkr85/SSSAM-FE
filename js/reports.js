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
        // Fetch all admin-only report data from separate endpoints
        // Use Promise.allSettled to handle partial failures (403s for specific endpoints)
        const [admissionsRes, feesRes, counselorRes, courseRes, alertsRes] = await Promise.allSettled([
            hasAccess('admissions_report') ? apiGet(`${API_ENDPOINTS.REPORTS.ADMISSIONS}?range=monthly`).catch(err => handleRoleError(err, 'admissions_report')) : Promise.resolve({ accessDenied: true }),
            hasAccess('fees_report') ? apiGet(`${API_ENDPOINTS.REPORTS.FEES}?range=monthly`).catch(err => handleRoleError(err, 'fees_report')) : Promise.resolve({ accessDenied: true }),
            hasAccess('counselor_performance') ? apiGet(API_ENDPOINTS.REPORTS.COUNSELOR_PERFORMANCE).catch(err => handleRoleError(err, 'counselor_performance')) : Promise.resolve({ accessDenied: true }),
            hasAccess('course_performance') ? apiGet(API_ENDPOINTS.REPORTS.COURSE_PERFORMANCE).catch(err => handleRoleError(err, 'course_performance')) : Promise.resolve({ accessDenied: true }),
            hasAccess('installment_alerts') ? apiGet(API_ENDPOINTS.REPORTS.INSTALLMENT_ALERTS).catch(err => handleRoleError(err, 'installment_alerts')) : Promise.resolve({ accessDenied: true })
        ]);

        // Extract data from settled promises
        const admissionsData = admissionsRes.status === 'fulfilled' ? admissionsRes.value : {};
        const feesData = feesRes.status === 'fulfilled' ? feesRes.value : {};
        const counselorData = counselorRes.status === 'fulfilled' ? counselorRes.value : {};
        const courseData = courseRes.status === 'fulfilled' ? courseRes.value : {};
        const alertsData = alertsRes.status === 'fulfilled' ? alertsRes.value : {};

        // Render admissions and fees summary
        renderAdmissionsReport(admissionsData);
        renderFeesReport(feesData);
        renderCounselor(counselorData);
        renderCourse(courseData);
        renderInstallmentAlerts(alertsData);
    } catch (error) {
        console.error('Reports load error:', error);
        showToast('error', 'Failed to load reports');
    }
}

/* ======================
ADMISSIONS REPORT
====================== */
function renderAdmissionsReport(data) {
    if (data.accessDenied) {
        document.getElementById('reportTotalEnquiries').textContent = 'N/A';
        document.getElementById('reportTotalAdmissions').textContent = 'N/A';
        return;
    }
    
    const summary = data.summary || data;
    document.getElementById('reportTotalEnquiries').textContent = summary.totalEnquiries || 0;
    document.getElementById('reportTotalAdmissions').textContent = summary.totalAdmissions || summary.admissions?.length || 0;
    document.getElementById('reportConversionRate').textContent = (summary.conversionRate || 0) + '%';
}

/* ======================
FEES REPORT
====================== */
function renderFeesReport(data) {
    if (data.accessDenied) {
        document.getElementById('reportTotalRevenue').textContent = 'N/A';
        return;
    }
    
    const summary = data.summary || data;
    document.getElementById('reportTotalRevenue').textContent = formatCurrency(summary.totalRevenueCollected || summary.totalPaid || summary.totalRevenue || 0);
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

    const counselors = data.counselorStats || data.counselors || [];
    if (!counselors.length) {
        table.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-400">No data</td></tr>`;
        return;
    }

    table.innerHTML = counselors.map(c => `
        <tr>
            <td class="px-6 py-4">${c.counselorName || c.name}</td>
            <td class="px-6 py-4">${c.admissions || c.convertedEnquiries || 0}</td>
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

    const courses = data.courseStats || data.courses || [];
    if (!courses.length) {
        table.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-400">No data</td></tr>`;
        return;
    }

    table.innerHTML = courses.map(c => `
        <tr>
            <td class="px-6 py-4">${c.course || c.name}</td>
            <td class="px-6 py-4">${c.converted || c.admissions || 0}</td>
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
