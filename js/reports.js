/**
 * Reports Module
 * Institute Enquiry Management System
 */

// State
let currentPeriod = 'daily';
let startDate = '';
let endDate = '';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('reportsDashboard')) return;
    
    // Check if user is admin
    if (!isAdmin()) {
        document.getElementById('accessDenied').classList.remove('hidden');
        document.getElementById('reportsDashboard').classList.add('hidden');
        return;
    }
    
    initializeElements();
    setupEventListeners();
    setDefaultDates();
    loadReports();
});

function initializeElements() {
    // Period buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => {
                b.classList.remove('bg-blue-600', 'text-white', 'border-blue-600');
                b.classList.add('border-gray-300', 'text-gray-700');
            });
            btn.classList.remove('border-gray-300', 'text-gray-700');
            btn.classList.add('bg-blue-600', 'text-white', 'border-blue-600');
            
            currentPeriod = btn.dataset.period;
            setDefaultDates();
            loadReports();
        });
    });
    
    // Apply date filter
    document.getElementById('applyDateFilter')?.addEventListener('click', () => {
        startDate = document.getElementById('startDate').value;
        endDate = document.getElementById('endDate').value;
        loadReports();
    });
}

function setupEventListeners() {
    // Additional listeners
}

function setDefaultDates() {
    const today = new Date();
    let start = new Date();
    
    switch (currentPeriod) {
        case 'daily':
            start = new Date(today);
            break;
        case 'weekly':
            start = new Date(today.setDate(today.getDate() - 7));
            break;
        case 'monthly':
            start = new Date(today.setMonth(today.getMonth() - 1));
            break;
    }
    
    const end = new Date();
    
    startDate = start.toISOString().split('T')[0];
    endDate = end.toISOString().split('T')[0];
    
    document.getElementById('startDate').value = startDate;
    document.getElementById('endDate').value = endDate;
}

async function loadReports() {
    try {
        const params = {
            period: currentPeriod,
            startDate,
            endDate,
        };

        // Load all reports in parallel (using available endpoints only)
        const [admissions, fees, installments, payments] = await Promise.all([
            apiGet(API_ENDPOINTS.REPORTS.ADMISSIONS, { range: currentPeriod }).catch(() => ({ data: { summary: {}, admissions: [] } })),
            apiGet(API_ENDPOINTS.REPORTS.FEES, { range: currentPeriod }).catch(() => ({ data: { summary: {}, periodPayments: [] } })),
            apiGet(API_ENDPOINTS.REPORTS.INSTALLMENTS).catch(() => ({ data: { summary: { upcomingCount: 0, overdueCount: 0 }, upcoming: [], overdue: [] } })),
            apiGet(API_ENDPOINTS.PAYMENTS.LIST, { ...params, limit: 1000 }).catch(() => ({ data: [] }))
        ]);

        // Store payments data for accurate revenue calculation
        const paymentsData = payments.data || [];
        window.reportsPaymentsData = paymentsData;

        renderDashboardStats(admissions, fees, installments, paymentsData);
        renderFeesOverview(fees, paymentsData);
        renderInstallments(installments);
    } catch (error) {
        showToast('error', 'Error', 'Failed to load reports');
    }
}

function renderDashboardStats(admissions, fees, installments, paymentsData = []) {
    const admissionsData = admissions.data || {};
    const feesData = fees.data || {};

    const summary = admissionsData.summary || {};
    const totalAdmissions = summary.totalAdmissions || 0;
    const prevAdmissions = summary.previousPeriodAdmissions || 0;
    const admissionsGrowth = summary.growth || 0;

    const feesSummary = feesData.summary || {};

    // Calculate revenue from payments data (using payment date, NOT enquiry date)
    const totalRevenue = paymentsData.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const expectedRevenue = feesSummary.totalFeesExpected || 0;
    const collectionRate = expectedRevenue > 0 ? ((totalRevenue / expectedRevenue) * 100).toFixed(1) : 0;

    // Calculate enquiries from admissions data (enquiriesConverted)
    const totalEnquiries = summary.enquiriesConverted || totalAdmissions;

    // Update Total Enquiries
    document.getElementById('reportTotalEnquiries').textContent = totalEnquiries;
    const enquiryTrendEl = document.getElementById('enquiriesTrend');
    enquiryTrendEl.textContent = '- vs previous period';
    enquiryTrendEl.className = 'text-xs text-gray-500 mt-1';

    // Update Total Admissions
    document.getElementById('reportTotalAdmissions').textContent = totalAdmissions;
    const admissionTrendEl = document.getElementById('admissionsTrend');
    if (admissionsGrowth > 0) {
        admissionTrendEl.textContent = `↑ ${admissionsGrowth}% vs previous period`;
        admissionTrendEl.className = 'text-xs text-green-600 mt-1';
    } else if (admissionsGrowth < 0) {
        admissionTrendEl.textContent = `↓ ${Math.abs(admissionsGrowth)}% vs previous period`;
        admissionTrendEl.className = 'text-xs text-red-600 mt-1';
    } else {
        admissionTrendEl.textContent = prevAdmissions > 0 ? '0% vs previous period' : '- vs previous period';
        admissionTrendEl.className = 'text-xs text-gray-500 mt-1';
    }

    // Conversion Rate (simplified - use 100% if all enquiries converted)
    const conversionRate = totalEnquiries > 0 ? (totalAdmissions / totalEnquiries * 100) : 0;
    document.getElementById('reportConversionRate').textContent = conversionRate.toFixed(1) + '%';

    // Total Revenue - calculated from payments using payment date
    document.getElementById('reportTotalRevenue').textContent = formatCurrency(totalRevenue);
    const revenueTrendEl = document.getElementById('revenueTrend');
    revenueTrendEl.textContent = `Collection rate: ${collectionRate}%`;
    revenueTrendEl.className = 'text-xs text-blue-600 mt-1';
}

function renderFeesOverview(fees, paymentsData = []) {
    const feesData = fees.data || {};
    const summary = feesData.summary || {};

    const totalExpected = summary.totalFeesExpected || 0;

    // Calculate collected from actual payments data (using payment date)
    const totalCollected = paymentsData.reduce((sum, payment) => sum + (payment.amount || 0), 0);
    const totalPending = Math.max(0, totalExpected - totalCollected);

    document.getElementById('totalFeesExpected').textContent = formatCurrency(totalExpected);
    document.getElementById('totalFeesCollected').textContent = formatCurrency(totalCollected);
    document.getElementById('totalPendingFees').textContent = formatCurrency(totalPending);
}

function renderInstallments(installments) {
    const data = installments.data || {};
    const summary = data.summary || { upcomingCount: 0, overdueCount: 0 };
    const upcoming = data.upcoming || [];
    const overdue = data.overdue || [];

    const container = document.getElementById('statusDistribution');
    if (!container) return;

    // Show installment alerts summary
    const totalAlerts = summary.upcomingCount + summary.overdueCount;
    if (totalAlerts === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">No installment alerts</p>';
        return;
    }

    // Calculate percentages
    const overduePercent = (summary.overdueCount / totalAlerts * 100).toFixed(1);
    const upcomingPercent = (summary.upcomingCount / totalAlerts * 100).toFixed(1);

    container.innerHTML = `
        <div class="flex items-center space-x-3 mb-2">
            <div class="w-24 text-sm text-gray-600">Overdue</div>
            <div class="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                <div class="bg-red-500 h-full rounded-full transition-all duration-500" style="width: ${overduePercent}%"></div>
            </div>
            <div class="w-20 text-right text-sm font-medium">${summary.overdueCount} (${overduePercent}%)</div>
        </div>
        <div class="flex items-center space-x-3">
            <div class="w-24 text-sm text-gray-600">Upcoming</div>
            <div class="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                <div class="bg-blue-500 h-full rounded-full transition-all duration-500" style="width: ${upcomingPercent}%"></div>
            </div>
            <div class="w-20 text-right text-sm font-medium">${summary.upcomingCount} (${upcomingPercent}%)</div>
        </div>
    `;
}

function renderCounselorTable(admissionsData) {
    const tbody = document.getElementById('counselorTable');
    const admissions = admissionsData.data?.admissions || [];

    if (!admissions.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">No admissions data available</td></tr>';
        return;
    }

    // Group by counselor (if counselor info available in admissions)
    const counselorMap = {};
    admissions.forEach(admission => {
        const counselorName = admission.createdBy?.name || 'Unknown';
        if (!counselorMap[counselorName]) {
            counselorMap[counselorName] = { name: counselorName, email: admission.createdBy?.email || '', totalAdmissions: 0, revenue: 0 };
        }
        counselorMap[counselorName].totalAdmissions++;
        counselorMap[counselorName].revenue += admission.totalFees || 0;
    });

    const counselors = Object.values(counselorMap);

    tbody.innerHTML = counselors.map(counselor => {
        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${counselor.name}</div>
                    <div class="text-sm text-gray-500">${counselor.email}</div>
                </td>
                <td class="px-6 py-4 text-gray-600">${counselor.totalAdmissions}</td>
                <td class="px-6 py-4 text-green-600 font-medium">${counselor.totalAdmissions}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div class="bg-blue-500 h-2 rounded-full" style="width: 100%"></div>
                        </div>
                        <span class="text-sm">100%</span>
                    </div>
                </td>
                <td class="px-6 py-4 font-medium text-gray-800">${formatCurrency(counselor.revenue)}</td>
            </tr>
        `;
    }).join('');
}

function renderCourseTable(admissionsData) {
    const tbody = document.getElementById('courseTable');
    const admissions = admissionsData.data?.admissions || [];

    if (!admissions.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">No admissions data available</td></tr>';
        return;
    }

    // Group by course
    const courseMap = {};
    admissions.forEach(admission => {
        const courseName = admission.enquiryId?.course || 'Unknown Course';
        if (!courseMap[courseName]) {
            courseMap[courseName] = { name: courseName, enquiries: 0, admissions: 0, revenue: 0 };
        }
        courseMap[courseName].admissions++;
        courseMap[courseName].revenue += admission.totalFees || 0;
        // Enquiries count would need separate data, using admissions as proxy
        courseMap[courseName].enquiries++;
    });

    const courses = Object.values(courseMap);

    tbody.innerHTML = courses.map(course => {
        const conversionRate = course.enquiries > 0
            ? (course.admissions / course.enquiries * 100).toFixed(1)
            : 0;

        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 font-medium text-gray-900">${course.name}</td>
                <td class="px-6 py-4 text-gray-600">${course.enquiries}</td>
                <td class="px-6 py-4 text-green-600 font-medium">${course.admissions}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div class="bg-purple-500 h-2 rounded-full" style="width: ${conversionRate}%"></div>
                        </div>
                        <span class="text-sm">${conversionRate}%</span>
                    </div>
                </td>
                <td class="px-6 py-4 font-medium text-gray-800">${formatCurrency(course.revenue)}</td>
            </tr>
        `;
    }).join('');
}
