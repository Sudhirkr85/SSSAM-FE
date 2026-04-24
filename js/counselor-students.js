/**
 * SSSAM CRM - Counselor Students Page
 * Displays comprehensive student details for a counselor
 */

// Global state
let allStudents = [];
let counselorId = '';
let counselorName = '';

// Sorting state
let sortColumn = null;
let sortDirection = 'asc'; // 'asc' or 'desc'

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  counselorId = urlParams.get('counselorId') || '';
  counselorName = urlParams.get('counselorName') || 'Counselor';

  // Update page title
  document.getElementById('counselorName').textContent = `${counselorName} - Students`;

  // Load student data
  loadCounselorStudents();
});

// ==================== LOAD STUDENTS ====================
async function loadCounselorStudents() {
  try {
    // TODO: Replace with actual API call when available
    // const students = await apiGet(`/reports/counselor/${counselorId}/students`);
    
    // For now, use mock data
    const students = getMockStudents();
    allStudents = students;
    
    renderSummaryCards(students);
    renderStudentsTable(students);
    
    // Show content, hide loading
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('summaryCards').classList.remove('hidden');
    document.getElementById('studentsSection').classList.remove('hidden');
  } catch (err) {
    console.error('Failed to load counselor students:', err);
    showToast('Error', 'Failed to load students', 'error');
    
    document.getElementById('loadingState').innerHTML = `
      <div class="flex flex-col items-center justify-center py-12">
        <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <i data-lucide="x-circle" class="w-6 h-6 text-red-500"></i>
        </div>
        <p class="text-gray-500">Failed to load students</p>
      </div>
    `;
  }
}

// ==================== RENDER FUNCTIONS ====================
function renderSummaryCards(students) {
  const totalStudents = students.length;
  const admitted = students.filter(s => s.hasAdmission).length;
  const pending = students.filter(s => s.status === 'Follow-up' || s.status === 'New').length;
  const revenue = students.reduce((sum, s) => sum + (s.feesPaid || 0), 0);

  document.getElementById('totalStudents').textContent = totalStudents;
  document.getElementById('admittedCount').textContent = admitted;
  document.getElementById('pendingCount').textContent = pending;
  document.getElementById('totalRevenue').textContent = formatCurrency(revenue);
}

function renderStudentsTable(students) {
  const table = document.getElementById('studentsTable');

  if (students.length === 0) {
    table.innerHTML = `
      <tr>
        <td colspan="8" class="px-4 py-8 text-center text-gray-500">
          No students found
        </td>
      </tr>
    `;
    return;
  }

  // Apply sorting if a column is selected
  let sortedStudents = [...students];
  if (sortColumn) {
    sortedStudents.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortColumn) {
        case 'name':
          valueA = (a.name || '').toLowerCase();
          valueB = (b.name || '').toLowerCase();
          break;
        case 'phone':
          valueA = (a.phone || '').toLowerCase();
          valueB = (b.phone || '').toLowerCase();
          break;
        case 'course':
          valueA = (a.course || '-').toLowerCase();
          valueB = (b.course || '-').toLowerCase();
          break;
        case 'status':
          valueA = (a.status || '').toLowerCase();
          valueB = (b.status || '').toLowerCase();
          break;
        case 'admission':
          valueA = a.hasAdmission ? 1 : 0;
          valueB = b.hasAdmission ? 1 : 0;
          break;
        case 'feesPaid':
          valueA = a.feesPaid || 0;
          valueB = b.feesPaid || 0;
          break;
        case 'pending':
          valueA = a.pendingFees || 0;
          valueB = b.pendingFees || 0;
          break;
        case 'followup':
          valueA = (a.lastFollowup || '').toLowerCase();
          valueB = (b.lastFollowup || '').toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  table.innerHTML = sortedStudents.map(s => `
    <tr class="hover:bg-gray-50 transition-colors cursor-pointer" onclick="navigateToStudentDetail('${escapeHtml(s.enquiryId)}', '${escapeHtml(s.admissionId)}', ${s.hasAdmission})">
      <td class="px-4 py-3">
        <div class="font-medium text-gray-800">${escapeHtml(s.name)}</div>
        <div class="text-xs text-gray-500">${escapeHtml(s.email || '')}</div>
      </td>
      <td class="px-4 py-3 text-gray-600">${escapeHtml(s.phone || '-')}</td>
      <td class="px-4 py-3 text-gray-600">${escapeHtml(s.course)}</td>
      <td class="px-4 py-3 text-center">
        <span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${getStatusColor(s.status)}">
          ${escapeHtml(s.status)}
        </span>
      </td>
      <td class="px-4 py-3 text-center">
        ${s.hasAdmission ? '<span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-700">Yes</span>' : '<span class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">No</span>'}
      </td>
      <td class="px-4 py-3 text-right font-medium text-gray-800">${formatCurrency(s.feesPaid || 0)}</td>
      <td class="px-4 py-3 text-right">
        <span class="${s.pendingFees > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}">${formatCurrency(s.pendingFees || 0)}</span>
      </td>
      <td class="px-4 py-3 text-gray-600 text-xs">${escapeHtml(s.lastFollowup || '-')}</td>
    </tr>
  `).join('');
  
  // Update sort icons
  updateSortIcons();
}

function sortTable(column) {
  if (sortColumn === column) {
    // Toggle direction if same column
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    // New column, default to ascending
    sortColumn = column;
    sortDirection = 'asc';
  }
  renderStudentsTable(allStudents);
}

function updateSortIcons() {
  const headers = document.querySelectorAll('th[onclick]');
  headers.forEach(th => {
    const icon = th.querySelector('i');
    if (icon) {
      const column = th.getAttribute('onclick').match(/'([^']+)'/)[1];
      if (column === sortColumn) {
        icon.setAttribute('data-lucide', sortDirection === 'asc' ? 'chevron-up' : 'chevron-down');
        icon.classList.remove('text-gray-400');
        icon.classList.add('text-blue-600');
      } else {
        icon.setAttribute('data-lucide', 'chevrons-up-down');
        icon.classList.remove('text-blue-600');
        icon.classList.add('text-gray-400');
      }
    }
  });
  lucide.createIcons();
}

function navigateToStudentDetail(enquiryId, admissionId, hasAdmission) {
  if (hasAdmission && admissionId) {
    // Navigate to admission detail page
    window.location.href = `admission-detail.html?id=${admissionId}`;
  } else if (enquiryId) {
    // Navigate to enquiry detail page
    window.location.href = `enquiry-detail.html?id=${enquiryId}`;
  } else {
    showToast('Info', 'No details available', 'info');
  }
}

// ==================== FILTER FUNCTION ====================
function filterStudents(searchTerm) {
  const term = searchTerm.toLowerCase();
  const filtered = allStudents.filter(s => 
    s.name.toLowerCase().includes(term) ||
    s.phone?.includes(term) ||
    s.course.toLowerCase().includes(term) ||
    s.email?.toLowerCase().includes(term)
  );
  renderStudentsTable(filtered);
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

function getStatusColor(status) {
  const colors = {
    'New': 'bg-blue-100 text-blue-700',
    'Follow-up': 'bg-amber-100 text-amber-700',
    'Converted': 'bg-green-100 text-green-700',
    'Lost': 'bg-red-100 text-red-700',
    'Closed': 'bg-gray-100 text-gray-700',
    'Admitted': 'bg-green-100 text-green-700'
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
}

// ==================== MOCK DATA ====================
function getMockStudents() {
  return [
    {
      id: '1',
      enquiryId: 'enq_001',
      admissionId: 'adm_001',
      name: 'Aarav Sharma',
      email: 'aarav.sharma@email.com',
      phone: '9876543210',
      course: 'Python Programming',
      status: 'Admitted',
      hasAdmission: true,
      feesPaid: 25000,
      pendingFees: 0,
      lastFollowup: '2024-01-15'
    },
    {
      id: '2',
      enquiryId: 'enq_002',
      admissionId: null,
      name: 'Diya Patel',
      email: 'diya.patel@email.com',
      phone: '9876543211',
      course: 'Data Science',
      status: 'Follow-up',
      hasAdmission: false,
      feesPaid: 0,
      pendingFees: 45000,
      lastFollowup: '2024-01-18'
    },
    {
      id: '3',
      enquiryId: 'enq_003',
      admissionId: 'adm_002',
      name: 'Arjun Singh',
      email: 'arjun.singh@email.com',
      phone: '9876543212',
      course: 'Web Development',
      status: 'Admitted',
      hasAdmission: true,
      feesPaid: 30000,
      pendingFees: 15000,
      lastFollowup: '2024-01-10'
    },
    {
      id: '4',
      enquiryId: 'enq_004',
      admissionId: null,
      name: 'Kavya Reddy',
      email: 'kavya.reddy@email.com',
      phone: '9876543213',
      course: 'Digital Marketing',
      status: 'New',
      hasAdmission: false,
      feesPaid: 0,
      pendingFees: 20000,
      lastFollowup: '2024-01-20'
    },
    {
      id: '5',
      enquiryId: 'enq_005',
      admissionId: null,
      name: 'Rohan Mehta',
      email: 'rohan.mehta@email.com',
      phone: '9876543214',
      course: 'Python Programming',
      status: 'Lost',
      hasAdmission: false,
      feesPaid: 0,
      pendingFees: 25000,
      lastFollowup: '2024-01-12'
    },
    {
      id: '6',
      enquiryId: 'enq_006',
      admissionId: null,
      name: 'Sneha Gupta',
      email: 'sneha.gupta@email.com',
      phone: '9876543215',
      course: 'Cyber Security',
      status: 'Follow-up',
      hasAdmission: false,
      feesPaid: 5000,
      pendingFees: 35000,
      lastFollowup: '2024-01-19'
    },
    {
      id: '7',
      enquiryId: 'enq_007',
      admissionId: 'adm_003',
      name: 'Vikram Joshi',
      email: 'vikram.joshi@email.com',
      phone: '9876543216',
      course: 'Data Science',
      status: 'Admitted',
      hasAdmission: true,
      feesPaid: 45000,
      pendingFees: 0,
      lastFollowup: '2024-01-14'
    },
    {
      id: '8',
      enquiryId: 'enq_008',
      admissionId: null,
      name: 'Priya Nair',
      email: 'priya.nair@email.com',
      phone: '9876543217',
      course: 'Web Development',
      status: 'New',
      hasAdmission: false,
      feesPaid: 0,
      pendingFees: 45000,
      lastFollowup: '2024-01-21'
    },
    {
      id: '9',
      enquiryId: 'enq_009',
      admissionId: 'adm_004',
      name: 'Aditya Kumar',
      email: 'aditya.kumar@email.com',
      phone: '9876543218',
      course: 'Python Programming',
      status: 'Admitted',
      hasAdmission: true,
      feesPaid: 20000,
      pendingFees: 5000,
      lastFollowup: '2024-01-16'
    },
    {
      id: '10',
      enquiryId: 'enq_010',
      admissionId: null,
      name: 'Meera Desai',
      email: 'meera.desai@email.com',
      phone: '9876543219',
      course: 'Digital Marketing',
      status: 'Follow-up',
      hasAdmission: false,
      feesPaid: 10000,
      pendingFees: 10000,
      lastFollowup: '2024-01-17'
    }
  ];
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
