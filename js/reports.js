/**
 * SSSAM CRM - Reports Module
 * Indian Institute Style - Production Ready
 */

// ==================== HELPER FUNCTIONS ====================
function safeParseLocalStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is admin (reports usually admin-only)
  const user = safeParseLocalStorage('user', {});
  if (user.role !== 'admin') {
    showToast('Warning', 'Reports are available for admin users only', 'warning');
  }

  // Set default filter to thisMonth
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

  // Format dates as YYYY-MM-DD in local timezone (not UTC)
  const formatDateLocal = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    dateFrom: formatDateLocal(startDate),
    dateTo: formatDateLocal(endDate)
  };
}

// ==================== LOAD REPORTS ====================
async function loadReports() {
  showLoadingState();

  // Get date range for the selected filter
  const dateRange = getDateRangeForFilter(currentFilter);

  try {
    // Fetch all reports in parallel using date range parameters
    
    const [admissionsRes, feesRes, courseRes, counselorRes, walkinBroughtByRes, alertsRes] = await Promise.all([
      apiGet(API_ENDPOINTS.REPORTS.ADMISSIONS, dateRange).catch(err => {
        return null;
      }),
      apiGet(API_ENDPOINTS.REPORTS.FEES, dateRange).catch(err => {
        return null;
      }),
      apiGet(API_ENDPOINTS.REPORTS.COURSE_PERFORMANCE, dateRange).catch(err => {
        return null;
      }),
      apiGet(API_ENDPOINTS.REPORTS.COUNSELOR_PERFORMANCE, dateRange).catch(err => {
        return null;
      }),
      apiGet(API_ENDPOINTS.ENQUIRIES_REPORTS.WALKIN_BROUGHT_BY, dateRange).catch(err => {
        return null;
      }),
      apiGet(API_ENDPOINTS.ADMISSIONS.INSTALLMENT_ALERTS).catch(err => {
        return null;
      })
    ]);


    // If reports APIs fail, fallback to regular APIs
    if (!admissionsRes && !feesRes && !courseRes && !counselorRes) {
      await loadReportsFromRegularApis(dateRange);
      hideLoadingState();
      return;
    }

    // Build summary data from API responses
    const summaryData = buildSummaryData(admissionsRes, feesRes, alertsRes);
    renderSummaryCards(summaryData);

    // Course performance table
    const courseStats = courseRes?.courseStats || courseRes?.data?.courseStats || [];
    renderCourseTable(courseStats);

    // Payment summary from fees report
    const paymentStats = buildPaymentStats(feesRes);
    renderPaymentTable(paymentStats);

    // Source stats from admissions data
    const sourceStats = buildSourceStats(admissionsRes);
    renderSourceTable(sourceStats);

    // Counselor performance table
    const counselorStats = counselorRes?.counselorStats || counselorRes?.data?.counselorStats || [];
    renderCounselorTable(counselorStats);

    // Walk-in brought by data
    const walkinBroughtByData = walkinBroughtByRes?.data || walkinBroughtByRes || {};
    renderWalkinBroughtBy(walkinBroughtByData);

    // Calculate total revenue from all counselors
    const totalCounselorRevenue = counselorStats.reduce((sum, c) => {
      const period = c.period || c.total || {};
      const revenue = period.totalPaid || period.totalFees || 0;
      return sum + revenue;
    }, 0);

    // Update summary with counselor revenue
    const counselorSummaryData = buildSummaryData(admissionsRes, feesRes);
    counselorSummaryData.totalCounselorRevenue = totalCounselorRevenue;
    renderSummaryCards(counselorSummaryData);

    hideLoadingState();
  } catch (err) {
    hideLoadingState();
    showToast('Error', 'Failed to load reports', 'error');
  }
}

// Fallback: Load reports data from regular APIs
async function loadReportsFromRegularApis(dateRange) {
  try {
    // Fetch from regular APIs
    const [enquiriesRes, admissionsRes] = await Promise.all([
      apiGet(API_ENDPOINTS.ENQUIRIES.LIST, { ...dateRange, limit: 1000 }).catch(() => null),
      listAdmissions({ ...dateRange, limit: 1000 }).catch(() => null)
    ]);

    const enquiries = enquiriesRes?.data || [];
    const admissions = admissionsRes?.data || [];

    // Calculate summary
    const totalAdmissions = admissions.length;
    const totalPaid = admissions.reduce((sum, a) => sum + (a.totalPaid || 0), 0);
    const registrationPaid = admissions.reduce((sum, a) => sum + (a.registrationAmount || 0), 0);
    const installmentPaid = admissions.reduce((sum, a) => sum + Math.max(0, (a.totalPaid || 0) - (a.registrationAmount || 0)), 0);
    const totalPending = admissions.reduce((sum, a) => sum + Math.max(0, a.remainingAmount || 0), 0);

    renderSummaryCards({
      totalAdmissions,
      totalPaid,
      registrationPaid,
      installmentPaid,
      totalPending,
      totalFeesCollectedAndDue: totalPaid + totalPending
    });

    // Course stats
    const courseGroups = {};
    
    // Process enquiries for counts
    if (enquiries && Array.isArray(enquiries)) {
      enquiries.forEach(enq => {
        const course = enq.course || 'Unknown Course';
        if (!courseGroups[course]) {
          courseGroups[course] = { enquiries: 0, admissions: 0, revenue: 0 };
        }
        courseGroups[course].enquiries++;
        if (enq.status === 'ADMITTED' || enq.status === 'CONVERTED') {
          courseGroups[course].admissions++;
        }
      });
    }
    
    // Process admissions for revenue
    if (admissions && Array.isArray(admissions)) {
      admissions.forEach(adm => {
        const course = adm.course || adm.enquiry?.course || 'Unknown Course';
        if (courseGroups[course]) {
          courseGroups[course].revenue += (adm.totalPaid || 0);
        }
      });
    }
    
    const courseStats = Object.entries(courseGroups).map(([course, data]) => ({
      course,
      enquiries: data.enquiries,
      admissions: data.admissions,
      revenue: data.revenue
    }));
    
    renderCourseTable(courseStats);

    // Payment stats (simplified)
    renderPaymentTable([]);

    // Source stats
    const sourceGroups = {};
    enquiries.forEach(enq => {
      const source = enq.source || 'other';
      if (!sourceGroups[source]) sourceGroups[source] = { enquiries: 0, converted: 0 };
      sourceGroups[source].enquiries++;
      if (enq.status === 'ADMITTED' || enq.status === 'CONVERTED') sourceGroups[source].converted++;
    });
    const sourceStats = Object.entries(sourceGroups).map(([source, data]) => ({
      source,
      enquiries: data.enquiries,
      converted: data.converted
    }));
    renderSourceTable(sourceStats);

    // Counselor stats - calculate from admissions data
    const counselorGroups = {};
    
    // Group admissions by counselor
    if (admissions && Array.isArray(admissions)) {
      admissions.forEach(adm => {
        const counselorName = adm.counselorName || adm.counselor?.name || 'Unknown Counselor';
        const counselorId = adm.counselorId || adm.counselor?._id || '';
        
        if (!counselorGroups[counselorName]) {
          counselorGroups[counselorName] = {
            counselorName,
            counselorId,
            assignedEnquiries: 0,
            convertedEnquiries: 0,
            revenue: 0
          };
        }
        
        counselorGroups[counselorName].convertedEnquiries++;
        counselorGroups[counselorName].revenue += (adm.totalPaid || 0);
      });
    }
    
    // Count enquiries per counselor
    if (enquiries && Array.isArray(enquiries)) {
      enquiries.forEach(enq => {
        const counselorName = enq.counselorName || enq.counselor?.name || 'Unknown Counselor';
        if (counselorGroups[counselorName]) {
          counselorGroups[counselorName].assignedEnquiries++;
        }
      });
    }
    
    const counselorStats = Object.values(counselorGroups);
    renderCounselorTable(counselorStats);

  } catch (err) {
  }
}

// Build summary data from admissions, fees, and alerts responses
function buildSummaryData(admissionsRes, feesRes, alertsRes) {
  const admissionsData = admissionsRes?.data || admissionsRes || {};
  const feesData = feesRes?.data || feesRes || {};
  const feeSummary = feesData.summary || {};

  const totalAdmissions = admissionsData.summary?.totalAdmissions || (admissionsData.admissions ? admissionsData.admissions.length : 0);

  return {
    totalAdmissions,
    totalPaid: feeSummary.totalPaid || 0,
    registrationPaid: feeSummary.registrationPaid || 0,
    installmentPaid: feeSummary.installmentPaid || 0,
    totalPending: feeSummary.totalPending || 0,
    totalFeesCollectedAndDue: (feeSummary.totalPaid || 0) + (feeSummary.totalPending || 0)
  };
}

// Build payment stats from fees report data
function buildPaymentStats(feesRes) {
  const periodPayments = feesRes?.periodPayments || feesRes?.data?.periodPayments || [];

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
  const sourceStats = admissionsRes?.sourceStats || admissionsRes?.data?.sourceStats;
  if (sourceStats && Array.isArray(sourceStats)) {
    return sourceStats;
  }

  // Otherwise, return empty - will show "No data available"
  return [];
}

// ==================== RENDER FUNCTIONS ====================
function renderSummaryCards(data) {
  // 1. Total Admissions
  const convertedCountEl = document.getElementById('convertedCount');
  if (convertedCountEl) {
    convertedCountEl.textContent = data.totalAdmissions || 0;
  }
  
  // 2. Total Paid (Collected)
  const totalCollectedEl = document.getElementById('totalCollected');
  if (totalCollectedEl) {
    totalCollectedEl.textContent = formatCurrency(data.totalPaid || 0);
  }
  
  // 3. Total Baaki (Due)
  const totalDueEl = document.getElementById('totalDue');
  if (totalDueEl) {
    totalDueEl.textContent = formatCurrency(data.totalPending || 0);
  }
  
  // 4. Total Fees (Collected + Due)
  const totalRevenueEl = document.getElementById('totalRevenue');
  if (totalRevenueEl) {
    totalRevenueEl.textContent = formatCurrency(data.totalFeesCollectedAndDue || 0);
  }

  // 5. Collection Breakdown Rendering
  const breakdownRegEl = document.getElementById('breakdownReg');
  if (breakdownRegEl) {
    breakdownRegEl.textContent = formatCurrency(data.registrationPaid || 0);
  }
  const breakdownInstEl = document.getElementById('breakdownInst');
  if (breakdownInstEl) {
    breakdownInstEl.textContent = formatCurrency(data.installmentPaid || 0);
  }
  const breakdownTotalEl = document.getElementById('breakdownTotal');
  if (breakdownTotalEl) {
    breakdownTotalEl.textContent = formatCurrency(data.totalPaid || 0);
  }
}

function renderCourseTable(courses) {
  const table = document.getElementById('courseTable');
  
  if (!courses || courses.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="4" class="px-4 py-8 text-center text-gray-500">
          No data available
        </td>
      </tr>
    `;
    return;
  }
  
  table.innerHTML = courses.map(c => {
    const revenue = c.paidAmount || c.totalFees || 0;
    return `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-4 py-3 font-medium text-gray-800">${escapeHtml(c.course)}</td>
      <td class="px-4 py-3 text-center text-gray-600">${c.totalEnquiries || 0}</td>
      <td class="px-4 py-3 text-center text-gray-600">${c.admissions || 0}</td>
      <td class="px-4 py-3 text-right font-medium text-gray-800">${formatCurrency(revenue)}</td>
    </tr>
  `;
  }).join('');
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
    renderPaymentChart([]);
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

  renderPaymentChart(payments);
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
    renderSourceChart([]);
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

  renderSourceChart(sources);
}


// ==================== CHART FUNCTIONS ====================
let paymentChartInstance = null;
let sourceChartInstance = null;

function renderPaymentChart(payments) {
  const canvas = document.getElementById('paymentChart');
  if (!canvas) return;

  if (paymentChartInstance) {
    paymentChartInstance.destroy();
  }

  if (payments.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const modeColors = {
    'CASH': '#22c55e',
    'UPI': '#a855f7',
    'CARD': '#f59e0b',
    'ONLINE': '#3b82f6',
    'CHEQUE': '#6b7280',
    'BANK_TRANSFER': '#6366f1'
  };

  const labels = payments.map(p => p.mode);
  const data = payments.map(p => p.amount || 0);
  const colors = payments.map(p => modeColors[p.mode] || '#94a3b8');

  paymentChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 10,
            font: { size: 11 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': ₹' + (context.raw || 0).toLocaleString('en-IN');
            }
          }
        }
      }
    }
  });
}

function renderSourceChart(sources) {
  const canvas = document.getElementById('sourceChart');
  if (!canvas) return;

  if (sourceChartInstance) {
    sourceChartInstance.destroy();
  }

  if (sources.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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

  const sourceColors = [
    '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#6b7280'
  ];

  const labels = sources.map(s => sourceLabels[s.source] || s.source);
  const data = sources.map(s => s.enquiries || 0);
  const colors = sources.map((_, i) => sourceColors[i % sourceColors.length]);

  sourceChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 10,
            font: { size: 11 }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.label + ': ' + (context.raw || 0) + ' enquiries';
            }
          }
        }
      }
    }
  });
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
    const period = c.period || c.total || {};
    return `
    <tr class="hover:bg-gray-50 transition-colors cursor-pointer" onclick="navigateToCounselorStudents('${escapeHtml(c.counselorName)}', '${escapeHtml(c.counselorId || '')}')">
      <td class="px-4 py-3 font-medium text-gray-800">${escapeHtml(c.counselorName)}</td>
      <td class="px-4 py-3 text-center text-gray-600">${period.assignedEnquiries || 0}</td>
      <td class="px-4 py-3 text-center text-gray-600">${period.convertedEnquiries || 0}</td>
      <td class="px-4 py-3 text-right font-medium text-gray-800">${formatCurrency(period.revenue || 0)}</td>
    </tr>
  `}).join('');
}

function renderWalkinBroughtBy(data) {
  const summary = data.summary || [];
  const totalEnquiries = data.totalEnquiries || 0;
  const withWalkInBroughtBy = data.withWalkInBroughtBy || 0;
  const withoutWalkInBroughtBy = data.withoutWalkInBroughtBy || 0;

  // Update summary cards
  document.getElementById('walkinTotal').textContent = totalEnquiries;
  document.getElementById('walkinWithInfo').textContent = withWalkInBroughtBy;
  document.getElementById('walkinWithoutInfo').textContent = withoutWalkInBroughtBy;

  // Render table
  const table = document.getElementById('walkinBroughtByTable');

  if (!summary || summary.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="3" class="px-4 py-8 text-center text-gray-500">
          No data available
        </td>
      </tr>
    `;
    return;
  }

  table.innerHTML = summary.map(item => {
    const broughtBy = item.broughtBy || 'Not Specified';
    const count = item.count || 0;
    const courses = item.courses || [];

    // Format courses as badges
    const coursesHtml = courses.length > 0
      ? courses.map(course => `
          <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-teal-100 text-teal-700 mr-1 mb-1">
            ${escapeHtml(course)}
          </span>
        `).join('')
      : '<span class="text-gray-400 text-xs">No courses</span>';

    return `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="px-4 py-3 font-medium text-gray-800">
          ${broughtBy === 'Not Specified' ? '<span class="text-gray-400 italic">Not Specified</span>' : escapeHtml(broughtBy)}
        </td>
        <td class="px-4 py-3 text-center text-gray-600 font-medium">${count}</td>
        <td class="px-4 py-3 text-gray-600">
          <div class="flex flex-wrap">
            ${coursesHtml}
          </div>
        </td>
      </tr>
    `;
  }).join('');
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

// ==================== EXPOSE TO WINDOW ====================
window.setDateFilter = setDateFilter;
