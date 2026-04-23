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
  
  // Load initial reports
  loadReports();
});

// ==================== LOAD REPORTS ====================
async function loadReports() {
  showLoadingState();
  
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  
  try {
    // Build params
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    
    // Fetch summary from backend
    const response = await apiGet(API_ENDPOINTS.REPORTS.SUMMARY, params);
    
    renderSummaryCards(response);
    renderCourseTable(response.courseStats || []);
    renderPaymentTable(response.paymentStats || []);
    renderSourceTable(response.sourceStats || []);
    
    hideLoadingState();
  } catch (err) {
    console.error('Failed to load reports:', err);
    hideLoadingState();
    showToast('Error', 'Failed to load reports', 'error');
    
    // Use mock data for demo if API fails
    useMockData();
  }
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

// ==================== MOCK DATA (FOR DEMO) ====================
function useMockData() {
  const mockData = {
    totalEnquiries: 156,
    convertedEnquiries: 42,
    totalRevenue: 485000,
    pendingAmount: 125000,
    overdueAmount: 35000,
    courseStats: [
      { course: 'Python Programming', enquiries: 45, admissions: 18, revenue: 180000 },
      { course: 'Data Science', enquiries: 32, admissions: 12, revenue: 144000 },
      { course: 'Web Development', enquiries: 28, admissions: 8, revenue: 96000 },
      { course: 'Digital Marketing', enquiries: 18, admissions: 3, revenue: 45000 },
      { course: 'Cyber Security', enquiries: 15, admissions: 1, revenue: 20000 }
    ],
    paymentStats: [
      { mode: 'CASH', count: 25, amount: 125000 },
      { mode: 'UPI', count: 18, amount: 108000 },
      { mode: 'CARD', count: 8, amount: 72000 },
      { mode: 'ONLINE', count: 12, amount: 180000 }
    ],
    sourceStats: [
      { source: 'walk_in', enquiries: 60, converted: 20 },
      { source: 'website', enquiries: 45, converted: 12 },
      { source: 'referral', enquiries: 30, converted: 8 },
      { source: 'social_media', enquiries: 15, converted: 2 },
      { source: 'phone_call', enquiries: 6, converted: 0 }
    ]
  };
  
  renderSummaryCards(mockData);
  renderCourseTable(mockData.courseStats);
  renderPaymentTable(mockData.paymentStats);
  renderSourceTable(mockData.sourceStats);
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
