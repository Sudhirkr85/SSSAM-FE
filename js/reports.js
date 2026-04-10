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
        
        // Load all reports in parallel
        const [dashboard, enquiries, admissions, revenue, counselor, course] = await Promise.all([
            apiGet(API_ENDPOINTS.REPORTS.DASHBOARD, params).catch(() => ({})),
            apiGet(API_ENDPOINTS.REPORTS.ENQUIRIES, params).catch(() => ({})),
            apiGet(API_ENDPOINTS.REPORTS.ADMISSIONS, params).catch(() => ({})),
            apiGet(API_ENDPOINTS.REPORTS.REVENUE, params).catch(() => ({})),
            apiGet(API_ENDPOINTS.REPORTS.COUNSELOR, params).catch(() => []),
            apiGet(API_ENDPOINTS.REPORTS.COURSE, params).catch(() => []),
        ]);
        
        renderDashboardStats(dashboard, enquiries, admissions, revenue);
        renderFeesOverview(revenue);
        renderStatusDistribution(enquiries);
        renderCounselorTable(counselor);
        renderCourseTable(course);
    } catch (error) {
        showToast('error', 'Error', 'Failed to load reports');
    }
}

function renderDashboardStats(dashboard, enquiries, admissions, revenue) {
    // Total Enquiries
    const totalEnquiries = enquiries.total || dashboard.totalEnquiries || 0;
    document.getElementById('reportTotalEnquiries').textContent = totalEnquiries;
    
    // Enquiries trend
    const enquiryTrend = enquiries.trend || 0;
    const enquiryTrendEl = document.getElementById('enquiriesTrend');
    if (enquiryTrend > 0) {
        enquiryTrendEl.textContent = `↑ ${enquiryTrend}% vs previous period`;
        enquiryTrendEl.className = 'text-xs text-green-600 mt-1';
    } else if (enquiryTrend < 0) {
        enquiryTrendEl.textContent = `↓ ${Math.abs(enquiryTrend)}% vs previous period`;
        enquiryTrendEl.className = 'text-xs text-red-600 mt-1';
    } else {
        enquiryTrendEl.textContent = '- vs previous period';
        enquiryTrendEl.className = 'text-xs text-gray-500 mt-1';
    }
    
    // Total Admissions
    const totalAdmissions = admissions.total || dashboard.totalAdmissions || 0;
    document.getElementById('reportTotalAdmissions').textContent = totalAdmissions;
    
    // Admissions trend
    const admissionTrend = admissions.trend || 0;
    const admissionTrendEl = document.getElementById('admissionsTrend');
    if (admissionTrend > 0) {
        admissionTrendEl.textContent = `↑ ${admissionTrend}% vs previous period`;
        admissionTrendEl.className = 'text-xs text-green-600 mt-1';
    } else if (admissionTrend < 0) {
        admissionTrendEl.textContent = `↓ ${Math.abs(admissionTrend)}% vs previous period`;
        admissionTrendEl.className = 'text-xs text-red-600 mt-1';
    } else {
        admissionTrendEl.textContent = '- vs previous period';
        admissionTrendEl.className = 'text-xs text-gray-500 mt-1';
    }
    
    // Conversion Rate
    const conversionRate = enquiries.conversionRate || (totalAdmissions / totalEnquiries * 100) || 0;
    document.getElementById('reportConversionRate').textContent = conversionRate.toFixed(1) + '%';
    
    // Total Revenue
    const totalRevenue = revenue.total || dashboard.totalRevenue || 0;
    document.getElementById('reportTotalRevenue').textContent = formatCurrency(totalRevenue);
    
    // Revenue trend
    const revenueTrend = revenue.trend || 0;
    const revenueTrendEl = document.getElementById('revenueTrend');
    if (revenueTrend > 0) {
        revenueTrendEl.textContent = `↑ ${revenueTrend}% vs previous period`;
        revenueTrendEl.className = 'text-xs text-green-600 mt-1';
    } else if (revenueTrend < 0) {
        revenueTrendEl.textContent = `↓ ${Math.abs(revenueTrend)}% vs previous period`;
        revenueTrendEl.className = 'text-xs text-red-600 mt-1';
    } else {
        revenueTrendEl.textContent = '- vs previous period';
        revenueTrendEl.className = 'text-xs text-gray-500 mt-1';
    }
}

function renderFeesOverview(revenue) {
    const totalExpected = revenue.totalExpected || 0;
    const totalCollected = revenue.totalCollected || 0;
    const totalPending = totalExpected - totalCollected;
    
    document.getElementById('totalFeesExpected').textContent = formatCurrency(totalExpected);
    document.getElementById('totalFeesCollected').textContent = formatCurrency(totalCollected);
    document.getElementById('totalPendingFees').textContent = formatCurrency(totalPending);
}

function renderStatusDistribution(enquiries) {
    const distribution = enquiries.statusDistribution || {};
    const total = enquiries.total || 1; // Avoid division by zero
    
    const statusColors = {
        'New': 'bg-blue-500',
        'Attempted': 'bg-yellow-500',
        'Connected': 'bg-green-500',
        'Interested': 'bg-purple-500',
        'Follow-up': 'bg-pink-500',
        'Converted': 'bg-green-600',
        'Lost': 'bg-red-500',
    };
    
    const container = document.getElementById('statusDistribution');
    
    if (Object.keys(distribution).length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">No data available</p>';
        return;
    }
    
    container.innerHTML = Object.entries(distribution).map(([status, count]) => {
        const percentage = (count / total * 100).toFixed(1);
        const color = statusColors[status] || 'bg-gray-500';
        
        return `
            <div class="flex items-center space-x-3">
                <div class="w-24 text-sm text-gray-600">${status}</div>
                <div class="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div class="${color} h-full rounded-full transition-all duration-500" style="width: ${percentage}%"></div>
                </div>
                <div class="w-16 text-right text-sm font-medium">${count} (${percentage}%)</div>
            </div>
        `;
    }).join('');
}

function renderCounselorTable(counselors) {
    const tbody = document.getElementById('counselorTable');
    
    if (!counselors || !counselors.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">No data available</td></tr>';
        return;
    }
    
    tbody.innerHTML = counselors.map(counselor => {
        const conversionRate = counselor.totalEnquiries > 0 
            ? (counselor.converted / counselor.totalEnquiries * 100).toFixed(1)
            : 0;
        
        return `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${counselor.name}</div>
                    <div class="text-sm text-gray-500">${counselor.email}</div>
                </td>
                <td class="px-6 py-4 text-gray-600">${counselor.totalEnquiries}</td>
                <td class="px-6 py-4 text-green-600 font-medium">${counselor.converted}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div class="bg-blue-500 h-2 rounded-full" style="width: ${conversionRate}%"></div>
                        </div>
                        <span class="text-sm">${conversionRate}%</span>
                    </div>
                </td>
                <td class="px-6 py-4 font-medium text-gray-800">${formatCurrency(counselor.revenueGenerated)}</td>
            </tr>
        `;
    }).join('');
}

function renderCourseTable(courses) {
    const tbody = document.getElementById('courseTable');
    
    if (!courses || !courses.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">No data available</td></tr>';
        return;
    }
    
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
