/**
 * SSSAM CRM - Reports Module
 * Indian Institute Style - Production Ready
 */

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is admin (reports usually admin-only)
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (user.role !== 'admin') {
    showToast('Warning', 'Reports are available for admin users only', 'warning');
  }

  // Set default filter to this month
  setDateFilter('thisMonth');
});

// ==================== DATE FILTER LOGIC ====================
let currentFilter = 'thisMonth';

function setDateFilter(filterType) {
  currentFilter = filterType;

  // Update tab styles
  document.querySelectorAll('.filter-tab').forEach(tab => {
    if (tab.dataset.filter === filterType) {
      tab.classList.remove('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
      tab.classList.add('bg-blue-600', 'text-white');
    } else {
      tab.classList.remove('bg-blue-600', 'text-white');
      tab.classList.add('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
    }
  });

  // Load reports with new filter
  loadReports();
}

function getDateRangeForFilter(filterType) {
  const today = new Date();
  const startDate = new Date();
  const endDate = new Date();

  switch (filterType) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'last7days':
      startDate.setDate(today.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'thisMonth':
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'thisYear':
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'allTime':
      startDate.setFullYear(2020, 0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    default:
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  };
}

// ==================== LOAD REPORTS ====================
async function loadReports() {
  showLoadingState();

  // Map filter to API range parameter
  const rangeMap = {
    'today': 'daily',
    'last7days': 'weekly',
    'thisMonth': 'monthly',
    'thisYear': 'yearly',
    'allTime': 'all'
  };
  const range = rangeMap[currentFilter] || 'monthly';

  try {
    // Fetch all reports in parallel using correct API endpoints
    const [admissionsRes, feesRes, courseRes, counselorRes] = await Promise.all([
      apiGet(API_ENDPOINTS.REPORTS.ADMISSIONS, { range }).catch(() => null),
      apiGet(API_ENDPOINTS.REPORTS.FEES, { range }).catch(() => null),
      apiGet(API_ENDPOINTS.REPORTS.COURSE_PERFORMANCE).catch(() => null),
      apiGet(API_ENDPOINTS.REPORTS.COUNSELOR_PERFORMANCE, { range }).catch(() => null)
    ]);

    // Build summary data from API responses
    const summaryData = buildSummaryData(admissionsRes, feesRes);
    renderSummaryCards(summaryData);

    // Course performance table
    const courseStats = courseRes?.data?.courseStats || [];
    renderCourseTable(courseStats);

    // Payment summary from fees report
    const paymentStats = buildPaymentStats(feesRes);
    renderPaymentTable(paymentStats);

    // Source stats from admissions data
    const sourceStats = buildSourceStats(admissionsRes);
    renderSourceTable(sourceStats);

    // Counselor performance table
    const counselorStats = counselorRes?.data?.counselorStats || [];
    renderCounselorTable(counselorStats);

    hideLoadingState();
  } catch (err) {
    console.error('Failed to load reports:', err);
    hideLoadingState();
    showToast('Error', 'Failed to load reports', 'error');
  }
}

// Build summary data from admissions and fees responses
function buildSummaryData(admissionsRes, feesRes) {
  const admissionsData = admissionsRes?.data || {};
  const feesData = feesRes?.data || {};
  const summary = admissionsData.summary || {};
  const feeSummary = feesData.summary || {};
  const periodPayments = feesData.periodPayments || [];

  // Calculate totalPaid from periodPayments if backend returns null
  let totalPaid = feeSummary.totalPaid;
  if (totalPaid === null || totalPaid === undefined) {
    totalPaid = periodPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }

  // Calculate totalPending if backend returns null
  let totalPending = feeSummary.totalPending;
  if (totalPending === null || totalPending === undefined) {
    const totalFeesExpected = feeSummary.totalFeesExpected || 0;
    totalPending = Math.max(0, totalFeesExpected - totalPaid);
  }

  return {
    totalEnquiries: summary.totalEnquiries || 0,
    convertedEnquiries: summary.totalAdmissions || 0,
    totalRevenue: totalPaid || 0,
    pendingAmount: totalPending || 0,
    overdueAmount: 0 // Will be fetched from installment alerts
  };
}

// Build payment stats from fees report data
function buildPaymentStats(feesRes) {
  const periodPayments = feesRes?.data?.periodPayments || [];

  // Group by payment mode
  const modeStats = {};
  periodPayments.forEach(p => {
    const mode = p.paymentMode || 'CASH';
    if (!modeStats[mode]) {
      modeStats[mode] = { count: 0, amount: 0 };
    }
    modeStats[mode].count++;
    modeStats[mode].amount += p.amount || 0;
  });

  return Object.entries(modeStats).map(([mode, stats]) => ({
    mode,
    count: stats.count,
    amount: stats.amount
  }));
}

// Build source stats from admissions/enquiries data
function buildSourceStats(admissionsRes) {
  // If API provides source stats directly, use them
  const sourceStats = admissionsRes?.data?.sourceStats;
  if (sourceStats && Array.isArray(sourceStats)) {
    return sourceStats;
  }

  // Otherwise, return empty - will show "No data available"
  return [];
}

// ==================== RENDER FUNCTIONS ====================
function renderSummaryCards(data) {
  document.getElementById('totalEnquiries').textContent = data.totalEnquiries || 0;
  document.getElementById('convertedCount').textContent = data.convertedEnquiries || 0;
  document.getElementById('totalRevenue').textContent = formatCurrency(data.totalRevenue || 0);
  document.getElementById('pendingAmount').textContent = formatCurrency(data.pendingAmount || 0);
  document.getElementById('overdueAmount').textContent = formatCurrency(data.overdueAmount || 0);
}

function renderCourseTable(courses) {
  const table = document.getElementById('courseTable');
  
  if (courses.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="4" class="px-4 py-8 text-center text-gray-500">
          No data available
        </td>
      </tr>
    `;
    return;
  }
  
  table.innerHTML = courses.map(c => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-4 py-3 font-medium text-gray-800">${escapeHtml(c.course)}</td>
      <td class="px-4 py-3 text-center text-gray-600">${c.enquiries || 0}</td>
      <td class="px-4 py-3 text-center text-gray-600">${c.admissions || 0}</td>
      <td class="px-4 py-3 text-right font-medium text-gray-800">${formatCurrency(c.revenue || 0)}</td>
    </tr>
  `).join('');
}

function renderPaymentTable(payments) {
  const table = document.getElementById('paymentTable');
  
  if (payments.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="3" class="px-4 py-8 text-center text-gray-500">
          No data available
        </td>
      </tr>
    `;
    return;
  }
  
  const modeIcons = {
    'CASH': '💵',
    'UPI': '📱',
    'CARD': '💳',
    'ONLINE': '🏦',
    'CHEQUE': '📋',
    'BANK_TRANSFER': '🏛️'
  };
  
  table.innerHTML = payments.map(p => `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-4 py-3">
        <span class="mr-2">${modeIcons[p.mode] || '💰'}</span>
        <span class="font-medium text-gray-800">${p.mode}</span>
      </td>
      <td class="px-4 py-3 text-center text-gray-600">${p.count || 0}</td>
      <td class="px-4 py-3 text-right font-medium text-gray-800">${formatCurrency(p.amount || 0)}</td>
    </tr>
  `).join('');
}

function renderSourceTable(sources) {
  const table = document.getElementById('sourceTable');

  if (sources.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="4" class="px-4 py-8 text-center text-gray-500">
          No data available
        </td>
      </tr>
    `;
    return;
  }

  const sourceLabels = {
    'website': 'Website',
    'walk_in': 'Walk In',
    'referral': 'Referral',
    'phone_call': 'Phone Call',
    'social_media': 'Social Media',
    'advertisement': 'Advertisement',
    'other': 'Other'
  };

  table.innerHTML = sources.map(s => {
    const conversionRate = s.enquiries > 0 ? ((s.converted / s.enquiries) * 100).toFixed(1) : 0;
    return `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="px-4 py-3 font-medium text-gray-800">${sourceLabels[s.source] || s.source}</td>
        <td class="px-4 py-3 text-center text-gray-600">${s.enquiries || 0}</td>
        <td class="px-4 py-3 text-center text-gray-600">${s.converted || 0}</td>
        <td class="px-4 py-3 text-right">
          <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${conversionRate > 30 ? 'bg-green-100 text-green-700' : conversionRate > 15 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'}">
            ${conversionRate}%
          </span>
        </td>
      </tr>
    `;
  }).join('');
}


function renderCounselorTable(counselors) {
  const table = document.getElementById('counselorTable');

  if (!counselors || counselors.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="4" class="px-4 py-8 text-center text-gray-500">
          No data available
        </td>
      </tr>
    `;
    return;
  }

  table.innerHTML = counselors.map(c => {
    const period = c.period || {};
    return `
    <tr class="hover:bg-gray-50 transition-colors cursor-pointer" onclick="navigateToCounselorStudents('${escapeHtml(c.counselorName)}', '${escapeHtml(c.counselorId || '')}')">
      <td class="px-4 py-3 font-medium text-gray-800">${escapeHtml(c.counselorName)}</td>
      <td class="px-4 py-3 text-center text-gray-600">${period.assignedEnquiries || 0}</td>
      <td class="px-4 py-3 text-center text-gray-600">${period.convertedEnquiries || 0}</td>
      <td class="px-4 py-3 text-right font-medium text-gray-800">${formatCurrency(period.revenue || 0)}</td>
    </tr>
  `}).join('');
}

function navigateToCounselorStudents(counselorName, counselorId) {
  const params = new URLSearchParams({
    counselorName: counselorName,
    counselorId: counselorId
  });
  window.location.href = `counselor-students.html?${params.toString()}`;
}


// ==================== HELPER FUNCTIONS ====================
function formatCurrency(amount) {
  if (!amount || amount === 0) return '₹0';
  return '₹' + amount.toLocaleString('en-IN');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showLoadingState() {
  document.getElementById('loadingState').classList.remove('hidden');
  document.getElementById('summaryCards').classList.add('opacity-50');
}

function hideLoadingState() {
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('summaryCards').classList.remove('opacity-50');
}

// ==================== TOAST SYSTEM ====================
function showToast(title, message, type = 'success') {
  const container = document.getElementById('toastContainer');
  
  const colors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500'
  };
  
  const icons = {
    success: 'check-circle',
    error: 'x-circle',
    warning: 'alert-triangle',
    info: 'info'
  };
  
  const toast = document.createElement('div');
  toast.className = `${colors[type]} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[300px] max-w-[400px] toast-enter`;
  toast.innerHTML = `
    <i data-lucide="${icons[type]}" class="w-5 h-5 flex-shrink-0"></i>
    <div class="flex-1">
      <div class="font-medium text-sm">${title}</div>
      <div class="text-xs opacity-90">${message}</div>
    </div>
    <button onclick="this.parentElement.remove()" class="opacity-70 hover:opacity-100">
      <i data-lucide="x" class="w-4 h-4"></i>
    </button>
  `;
  
  container.appendChild(toast);
  lucide.createIcons();
  
  // Auto remove
  const duration = type === 'error' ? 4000 : type === 'warning' ? 4000 : 3000;
  setTimeout(() => {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
