/* ======================
STATE
====================== */
let currentRange = 'all';
let allTimeData = {
    admissions: null,
    fees: null,
    counselor: null
};

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

    // Setup range selector listener
    setupRangeSelector();

    // Load initial reports
    loadReports();
});

/* ======================
RANGE SELECTOR SETUP
====================== */
function setupRangeSelector() {
    const selector = document.getElementById('rangeSelector');
    if (selector) {
        selector.value = currentRange;
        selector.addEventListener('change', (e) => {
            currentRange = e.target.value;
            loadReports();
        });
    }
}

/* ======================
LOAD REPORT DATA
====================== */
async function loadReports() {
    try {
        showLoadingState();

        // If not all-time, first fetch all-time data for comparison
        if (currentRange !== 'all' && !allTimeData.admissions) {
            await fetchAllTimeData();
        }

        // Fetch all report data from new APIs per documentation
        const [admissionsRes, feesRes, counselorRes, courseRes, alertsRes] = await Promise.allSettled([
            hasAccess('admissions_report') ? apiGet(`${API_ENDPOINTS.REPORTS.ADMISSIONS}?range=${currentRange}`).catch(err => handleRoleError(err, 'admissions_report')) : Promise.resolve({ accessDenied: true }),
            hasAccess('fees_report') ? apiGet(`${API_ENDPOINTS.REPORTS.FEES}?range=${currentRange}`).catch(err => handleRoleError(err, 'fees_report')) : Promise.resolve({ accessDenied: true }),
            hasAccess('counselor_performance') ? apiGet(`${API_ENDPOINTS.REPORTS.COUNSELOR_PERFORMANCE}?range=${currentRange}`).catch(err => handleRoleError(err, 'counselor_performance')) : Promise.resolve({ accessDenied: true }),
            hasAccess('course_performance') ? apiGet(API_ENDPOINTS.REPORTS.COURSE_PERFORMANCE).catch(err => handleRoleError(err, 'course_performance')) : Promise.resolve({ accessDenied: true }),
            hasAccess('installment_alerts') ? apiGet(API_ENDPOINTS.REPORTS.INSTALLMENT_ALERTS).catch(err => handleRoleError(err, 'installment_alerts')) : Promise.resolve({ accessDenied: true })
        ]);

        // Extract data from settled promises
        const admissionsData = admissionsRes.status === 'fulfilled' ? admissionsRes.value : {};
        const feesData = feesRes.status === 'fulfilled' ? feesRes.value : {};
        const counselorData = counselorRes.status === 'fulfilled' ? counselorRes.value : {};
        const courseData = courseRes.status === 'fulfilled' ? courseRes.value : {};
        const alertsData = alertsRes.status === 'fulfilled' ? alertsRes.value : {};

        // Cache all-time data when fetched
        if (currentRange === 'all') {
            allTimeData.admissions = admissionsData;
            allTimeData.fees = feesData;
            allTimeData.counselor = counselorData;
        }

        // Render all sections
        renderDateRange(admissionsData);
        renderDashboardStats(admissionsData, feesData);
        renderCounselor(counselorData);
        renderCourse(courseData);
        renderInstallmentAlerts(alertsData);
    } catch (error) {
        console.error('Reports load error:', error);
        showToast('error', 'Failed to load reports');
    }
}

/* ======================
FETCH ALL-TIME DATA (for comparison)
====================== */
async function fetchAllTimeData() {
    try {
        const [admissionsRes, feesRes, counselorRes] = await Promise.allSettled([
            apiGet(`${API_ENDPOINTS.REPORTS.ADMISSIONS}?range=all`).catch(() => ({})),
            apiGet(`${API_ENDPOINTS.REPORTS.FEES}?range=all`).catch(() => ({})),
            apiGet(`${API_ENDPOINTS.REPORTS.COUNSELOR_PERFORMANCE}?range=all`).catch(() => ({}))
        ]);

        allTimeData.admissions = admissionsRes.status === 'fulfilled' ? admissionsRes.value : {};
        allTimeData.fees = feesRes.status === 'fulfilled' ? feesRes.value : {};
        allTimeData.counselor = counselorRes.status === 'fulfilled' ? counselorRes.value : {};
    } catch (error) {
        console.warn('Failed to fetch all-time data for comparison:', error);
    }
}

/* ======================
SHOW LOADING STATE
====================== */
function showLoadingState() {
    document.getElementById('reportTotalEnquiries').textContent = '...';
    document.getElementById('reportTotalAdmissions').textContent = '...';
    document.getElementById('reportConversionRate').textContent = '...';
    document.getElementById('reportTotalRevenue').textContent = '...';
}

/* ======================
RENDER DATE RANGE
====================== */
function renderDateRange(admissionsData) {
    const dateRangeEl = document.getElementById('dateRangeDisplay');

    if (admissionsData.accessDenied || !admissionsData.dateRange) {
        if (currentRange === 'all') {
            dateRangeEl.textContent = 'All time data';
        } else {
            dateRangeEl.textContent = '';
        }
        return;
    }

    const { startDate, endDate } = admissionsData.dateRange;
    const start = new Date(startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const end = new Date(endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    dateRangeEl.textContent = `${start} - ${end}`;
}

/* ======================
DASHBOARD STATS (Top Cards)
====================== */
function renderDashboardStats(admissionsData, feesData) {
    if (admissionsData.accessDenied && feesData.accessDenied) {
        document.getElementById('reportTotalEnquiries').textContent = 'N/A';
        document.getElementById('reportTotalAdmissions').textContent = 'N/A';
        document.getElementById('reportConversionRate').textContent = 'N/A';
        document.getElementById('reportTotalRevenue').textContent = 'N/A';
        hideGrowthIndicators();
        return;
    }

    // Extract summary data from new API structure
    const admissionsSummary = admissionsData.summary || {};
    const feesSummary = feesData.summary || {};

    // Get period vs all-time values based on current range
    const isAllTime = currentRange === 'all';

    // Enquiries: period total vs all-time
    const periodEnquiries = admissionsSummary.totalEnquiries || 0;
    const allTimeEnquiries = admissionsSummary.allTimeEnquiries || periodEnquiries;

    // Admissions: period total vs all-time
    const periodAdmissions = admissionsSummary.totalAdmissions || 0;
    const allTimeAdmissions = admissionsSummary.allTimeAdmissions || periodAdmissions;

    // Conversion rate: period vs all-time
    const periodConversionRate = admissionsSummary.conversionRate || '0.00';
    const allTimeConversionRate = isAllTime ? periodConversionRate : (allTimeData.admissions?.summary?.conversionRate || periodConversionRate);

    // Revenue: period vs all-time
    const periodRevenue = isAllTime ? (feesSummary.totalRevenueCollected || 0) : (feesSummary.revenueInPeriod || 0);
    const allTimeRevenue = feesSummary.totalRevenueCollected || periodRevenue;

    // Update main stats
    document.getElementById('reportTotalEnquiries').textContent = periodEnquiries;
    document.getElementById('reportTotalAdmissions').textContent = periodAdmissions;
    document.getElementById('reportConversionRate').textContent = periodConversionRate + '%';
    document.getElementById('reportTotalRevenue').textContent = formatCurrency(periodRevenue);

    // Handle growth indicators and all-time context
    if (isAllTime) {
        // All-time mode: hide growth, show all-time context if different
        hideGrowthIndicators();
        document.getElementById('allTimeConversion').textContent = 'All-time conversion rate';
    } else {
        // Period mode: show growth indicators and all-time comparison
        const enquiriesGrowth = admissionsSummary.growth;
        const admissionsGrowth = admissionsSummary.growth; // Same growth for both from admissions API

        // Show growth for enquiries (use admissions growth as proxy if not available)
        renderGrowthIndicator('reportEnquiriesGrowth', enquiriesGrowth);

        // Show growth for admissions
        renderGrowthIndicator('reportAdmissionsGrowth', admissionsGrowth);

        // Show growth for revenue (calculate if not provided)
        const revenueGrowth = calculateRevenueGrowth(periodRevenue, allTimeRevenue);
        renderGrowthIndicator('reportRevenueGrowth', revenueGrowth);

        // Show all-time context
        document.getElementById('reportTotalEnquiriesAllTime').textContent = `(all: ${allTimeEnquiries})`;
        document.getElementById('reportTotalEnquiriesAllTime').classList.remove('hidden');

        document.getElementById('reportTotalAdmissionsAllTime').textContent = `(all: ${allTimeAdmissions})`;
        document.getElementById('reportTotalAdmissionsAllTime').classList.remove('hidden');

        document.getElementById('reportTotalRevenueAllTime').textContent = `(all: ${formatCurrency(allTimeRevenue)})`;
        document.getElementById('reportTotalRevenueAllTime').classList.remove('hidden');

        document.getElementById('allTimeConversion').textContent = `All-time: ${allTimeConversionRate}%`;
    }
}

/* ======================
GROWTH INDICATOR HELPERS
====================== */
function hideGrowthIndicators() {
    document.getElementById('reportEnquiriesGrowth').classList.add('hidden');
    document.getElementById('reportAdmissionsGrowth').classList.add('hidden');
    document.getElementById('reportRevenueGrowth').classList.add('hidden');
    document.getElementById('reportTotalEnquiriesAllTime').classList.add('hidden');
    document.getElementById('reportTotalAdmissionsAllTime').classList.add('hidden');
    document.getElementById('reportTotalRevenueAllTime').classList.add('hidden');
}

function renderGrowthIndicator(elementId, growthValue) {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (growthValue === null || growthValue === undefined) {
        el.classList.add('hidden');
        return;
    }

    const numValue = parseFloat(growthValue);
    const isPositive = numValue >= 0;
    const arrow = isPositive ? '↑' : '↓';
    const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
    const sign = isPositive ? '+' : '';

    el.textContent = `${arrow} ${sign}${numValue.toFixed(2)}% vs prev period`;
    el.className = `text-xs mt-1 ${colorClass}`;
    el.classList.remove('hidden');
}

function calculateRevenueGrowth(periodRevenue, allTimeRevenue) {
    // If we don't have explicit growth, estimate based on period vs all-time proportion
    if (!periodRevenue || !allTimeRevenue) return null;

    // This is a simplified calculation - in production, you'd want actual previous period comparison
    return null; // Let API provide proper growth data
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

    // Per API docs: data.counselorStats array with nested total/period structure
    const counselors = data.counselorStats || [];
    if (!counselors.length) {
        table.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-400">No data</td></tr>`;
        return;
    }

    const isAllTime = currentRange === 'all';

    table.innerHTML = counselors.map(c => {
        // Handle new nested structure: total (all-time) + period (if specified)
        const totalStats = c.total || {};
        const periodStats = c.period || null;

        // Show period stats prominently, all-time as context
        const displayAdmissions = isAllTime
            ? (totalStats.admissions || 0)
            : (periodStats ? (periodStats.admissions || 0) : (totalStats.admissions || 0));

        const displayRevenue = isAllTime
            ? (totalStats.revenue || 0)
            : (periodStats ? (periodStats.revenue || 0) : (totalStats.revenue || 0));

        const allTimeAdmissions = totalStats.admissions || 0;
        const allTimeRevenue = totalStats.revenue || 0;

        // Show all-time context when in period mode
        const allTimeContext = (!isAllTime && periodStats && allTimeAdmissions !== displayAdmissions)
            ? `<div class="text-xs text-gray-400">(all-time: ${allTimeAdmissions} / ${formatCurrency(allTimeRevenue)})</div>`
            : '';

        return `
            <tr class="border-b border-gray-50 last:border-0">
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${c.counselorName || 'Unknown'}</div>
                    <div class="text-xs text-gray-500">${c.email || ''}</div>
                    ${allTimeContext}
                </td>
                <td class="px-6 py-4 text-center">${displayAdmissions}</td>
                <td class="px-6 py-4 text-green-600 font-medium">${formatCurrency(displayRevenue)}</td>
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

    // Per API docs: data.courseStats array (all-time only, no date filter)
    const courses = data.courseStats || [];
    if (!courses.length) {
        table.innerHTML = `<tr><td colspan="3" class="text-center py-6 text-gray-400">No data</td></tr>`;
        return;
    }

    table.innerHTML = courses.map(c => `
        <tr class="border-b border-gray-50 last:border-0 hover:bg-gray-50">
            <td class="px-6 py-4">
                <div class="font-medium text-gray-900">${c.course || 'Unknown'}</div>
                <div class="text-xs text-gray-500">${c.totalEnquiries || 0} enquiries, ${c.converted || 0} converted</div>
            </td>
            <td class="px-6 py-4 text-center">
                <span class="font-semibold">${c.admissions || 0}</span>
                <span class="text-xs text-gray-400 ml-1">(${c.conversionRate || '0.00'}%)</span>
            </td>
            <td class="px-6 py-4">
                <div class="text-green-600 font-medium">${formatCurrency(c.revenue || 0)}</div>
                <div class="text-xs text-gray-500">Paid: ${formatCurrency(c.paidAmount || 0)} | Pending: ${formatCurrency(c.pendingAmount || 0)}</div>
            </td>
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
    const upcoming = summary.upcomingCount || 0;
    const overdue = summary.overdueCount || 0;

    console.log('Installment alerts:', { upcoming, overdue });

    // Could show toast notification if there are overdue installments
    if (overdue > 0) {
        showToast('warning', `${overdue} overdue installment(s) require attention`);
    }
}
