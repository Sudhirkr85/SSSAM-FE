/**
 * SSSAM CRM - Admission Detail Page
 * Indian Institute Style - Production Ready
 */

// ==================== STATE ====================
let admissionId = null;
let admissionData = null;
let payments = [];
let installmentRows = [];

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  // Get admission ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  admissionId = urlParams.get('id');
  
  if (!admissionId) {
    showErrorState('No admission ID provided');
    return;
  }
  
  loadAdmissionDetail();
});

// ==================== DATA LOADING ====================
async function loadAdmissionDetail() {
  showLoadingState();

  try {
    // Load admission details
    const admissionRes = await apiGet(API_ENDPOINTS.ADMISSIONS.GET_BY_ID(admissionId));

    // Backend now returns: { success, message, data: { admission: {...}, totalPaid, remainingAmount } }
    const data = admissionRes.data;
    admissionData = data.admission;
    // Store calculated totals from backend
    admissionData.totalPaid = data.totalPaid;
    admissionData.remainingAmount = data.remainingAmount;

    // Load payments
    const paymentsRes = await apiGet(API_ENDPOINTS.PAYMENTS.GET_BY_ADMISSION(admissionId));
    // API returns { success, message, data: { payments: [...] } }
    payments = paymentsRes.data?.payments || paymentsRes.payments || [];

    renderAdmissionDetail();
    showContentState();
  } catch (err) {
    console.error('Failed to load admission detail:', err);
    showErrorState('Failed to load admission details');
  }
}

// Activity configuration for timeline
const activityConfig = {
  'created': { icon: 'file-plus', color: 'text-blue-600', bg: 'bg-blue-100' },
  'payment': { icon: 'credit-card', color: 'text-green-600', bg: 'bg-green-100' },
  'installment_set': { icon: 'calendar', color: 'text-amber-600', bg: 'bg-amber-100' },
  'refund': { icon: 'arrow-left', color: 'text-red-600', bg: 'bg-red-100' },
  'note': { icon: 'message-square', color: 'text-gray-600', bg: 'bg-gray-100' }
};

// ==================== RENDER FUNCTIONS ====================
function renderAdmissionDetail() {
  if (!admissionData) return;
  
  const enquiry = admissionData.enquiryId || {};
  const studentName = enquiry.name || 'Unknown';
  const studentMobile = enquiry.mobile || '--';
  const course = admissionData.course || '--';
  const paymentType = admissionData.paymentType || 'ONE_TIME';
  
  const totalFees = admissionData.totalFees || 0;
  // Calculate total paid from payments array (excluding refunds)
  const calculatedPaid = payments
    .filter(p => p.type !== 'refund')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  // Use calculated paid amount, fallback to backend totalPaid
  const paidAmount = calculatedPaid || (admissionData.totalPaid ?? 0);
  const remaining = admissionData.remainingAmount ?? (totalFees - paidAmount);
  
  // Student info
  document.getElementById('studentName').textContent = studentName;
  document.getElementById('studentMobile').textContent = `Mobile: ${studentMobile}`;
  document.getElementById('courseBadge').textContent = course;
  
  const typeBadge = document.getElementById('paymentTypeBadge');
  if (paymentType === 'ONE_TIME') {
    typeBadge.className = 'px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium';
    typeBadge.textContent = 'One Time';
  } else {
    typeBadge.className = 'px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium';
    typeBadge.textContent = 'Installment';
  }
  
  // Fully paid badge
  const fullyPaidBadge = document.getElementById('fullyPaidBadge');
  if (remaining <= 0) {
    fullyPaidBadge.classList.remove('hidden');
  } else {
    fullyPaidBadge.classList.add('hidden');
  }
  
  // Finance summary cards
  document.getElementById('totalFees').textContent = formatCurrency(totalFees);
  document.getElementById('totalPaid').textContent = formatCurrency(paidAmount);
  document.getElementById('remainingAmount').textContent = formatCurrency(Math.max(0, remaining));
  
  // Calculate next due
  const nextDue = calculateNextDue(admissionData, payments);
  document.getElementById('nextDueAmount').textContent = formatCurrency(nextDue.amount);
  document.getElementById('nextDueDate').textContent = nextDue.date || '--';
  
  // Action buttons - disable add payment if fully paid
  const addPaymentBtn = document.getElementById('addPaymentBtn');
  if (remaining <= 0) {
    addPaymentBtn.disabled = true;
    addPaymentBtn.classList.add('opacity-50', 'cursor-not-allowed');
    addPaymentBtn.title = 'Admission is fully paid';
  } else {
    addPaymentBtn.disabled = false;
    addPaymentBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    addPaymentBtn.title = '';
  }
  
  // Installment table
  renderInstallmentTable();
  
  // Payment history
  renderPaymentHistory();
  
  // Timeline
  renderTimeline();
}

function calculateNextDue(admission, paymentsList) {
  const totalFees = admission.totalFees || 0;
  // Calculate total paid from payments array (excluding refunds)
  const calculatedPaid = paymentsList
    .filter(p => p.type !== 'refund')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const paidAmount = calculatedPaid || (admission.totalPaid ?? 0);
  const remaining = admission.remainingAmount ?? (totalFees - paidAmount);
  
  if (remaining <= 0) {
    return { amount: 0, date: 'Paid' };
  }
  
  // Check if there are installments
  const installments = admission.installments || [];
  if (installments.length === 0) {
    // For ONE_TIME payments, use fullPaymentDueDate if available, otherwise use admission creation date
    const dueDate = admission.fullPaymentDueDate || admission.createdAt;
    return { amount: remaining, date: dueDate ? formatDate(dueDate) : 'Not Specified' };
  }
  
  // Find first unpaid installment
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Calculate how much has been paid toward installments
  let paidTowardInstallments = admission.registrationAmount || 0;
  const installmentPayments = paymentsList.filter(p => p.type === 'installment');
  paidTowardInstallments += installmentPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  
  let cumulativeAmount = admission.registrationAmount || 0;
  
  for (const inst of installments) {
    cumulativeAmount += inst.amount;
    
    if (paidAmount < cumulativeAmount) {
      const dueDate = new Date(inst.dueDate);
      const isOverdue = dueDate < today;
      
      return {
        amount: Math.min(remaining, inst.amount),
        date: formatDate(inst.dueDate),
        isOverdue
      };
    }
  }
  
  // All installments covered but still remaining (shouldn't happen with proper validation)
  return { amount: remaining, date: 'On Demand' };
}

function renderInstallmentTable() {
  const table = document.getElementById('installmentTable');
  const section = document.getElementById('installmentSection');
  const noInstallments = document.getElementById('noInstallments');

  const installments = admissionData?.installments || [];
  const totalFees = admissionData?.totalFees || 0;
  // Calculate total paid from payments array (excluding refunds)
  const calculatedPaid = payments
    .filter(p => p.type !== 'refund')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const paidAmount = calculatedPaid || (admissionData?.totalPaid ?? 0);
  const remaining = admissionData?.remainingAmount ?? (totalFees - paidAmount);
  const registrationAmount = admissionData?.registrationAmount || 0;
  
  document.getElementById('installmentCount').textContent = `${installments.length} installments`;
  
  if (installments.length === 0) {
    section.classList.add('hidden');
    noInstallments.classList.remove('hidden');
    return;
  }
  
  section.classList.remove('hidden');
  noInstallments.classList.add('hidden');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let cumulativeAmount = registrationAmount;
  
  table.innerHTML = installments.map((inst, index) => {
    cumulativeAmount += inst.amount;
    
    const isPaid = paidAmount >= cumulativeAmount;
    const dueDate = new Date(inst.dueDate);
    const isOverdue = !isPaid && dueDate < today;
    
    let statusClass, statusText, statusIcon;
    if (isPaid) {
      statusClass = 'status-paid';
      statusText = 'Paid';
      statusIcon = 'check-circle';
    } else if (isOverdue) {
      statusClass = 'status-overdue';
      statusText = 'Overdue';
      statusIcon = 'alert-circle';
    } else {
      statusClass = 'status-pending';
      statusText = 'Pending';
      statusIcon = 'clock';
    }
    
    return `
      <tr class="${isOverdue ? 'bg-red-50/50' : ''}">
        <td class="px-4 py-3 text-gray-800 font-medium">${index + 1}</td>
        <td class="px-4 py-3 text-right font-medium text-gray-800">${formatCurrency(inst.amount)}</td>
        <td class="px-4 py-3 text-center text-gray-600">${formatDate(inst.dueDate)}</td>
        <td class="px-4 py-3 text-center">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${statusClass}">
            <i data-lucide="${statusIcon}" class="w-3.5 h-3.5"></i>
            ${statusText}
          </span>
        </td>
      </tr>
    `;
  }).join('');
  
  lucide.createIcons();
}

function renderPaymentHistory() {
  const section = document.getElementById('paymentHistorySection');
  const noPayments = document.getElementById('noPayments');
  
  document.getElementById('paymentCount').textContent = `${payments.length} payments`;
  
  if (payments.length === 0) {
    section.innerHTML = '';
    noPayments.classList.remove('hidden');
    return;
  }
  
  noPayments.classList.add('hidden');
  
  // Sort by date (newest first)
  const sortedPayments = [...payments].sort((a, b) => 
    new Date(b.createdAt) - new Date(a.createdAt)
  );
  
  section.innerHTML = sortedPayments.map(p => {
    const date = formatDateTime(p.createdAt);
    
    const typeColors = {
      'initial': 'bg-blue-100 text-blue-700 border-blue-200',
      'installment': 'bg-amber-100 text-amber-700 border-amber-200',
      'full': 'bg-green-100 text-green-700 border-green-200',
      'refund': 'bg-red-100 text-red-700 border-red-200'
    };
    
    const typeLabels = {
      'initial': 'Registration',
      'installment': 'Installment',
      'full': 'Full Payment',
      'refund': 'Refund'
    };
    
    const typeClass = typeColors[p.type] || 'bg-gray-100 text-gray-700';
    const typeLabel = typeLabels[p.type] || p.type;
    
    return `
      <div class="payment-row px-6 py-4 border-b border-gray-50 last:border-0">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 ${typeClass.split(' ')[0]} rounded-lg flex items-center justify-center">
              <i data-lucide="${getPaymentIcon(p.type)}" class="w-4 h-4 ${typeClass.split(' ')[1]}"></i>
            </div>
            <div>
              <div class="font-semibold text-gray-800">${formatCurrency(p.amount)}</div>
              <div class="text-xs text-gray-500">${date}</div>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-lg text-xs font-medium border ${typeClass}">
            ${typeLabel}
          </span>
        </div>
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-500">${p.paymentMode}</span>
          ${p.note ? `<span class="text-gray-400 italic">${escapeHtml(p.note)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

function renderTimeline() {
  const container = document.getElementById('timelineList');
  
  // Build timeline from payments and admission data
  const timeline = [];
  
  // Add admission creation
  timeline.push({
    type: 'created',
    title: 'Admission Created',
    description: `Course: ${admissionData?.course || '-'}`,
    date: admissionData?.createdAt,
    user: 'System'
  });
  
  // Add installments setup if exists
  if (admissionData?.installments?.length > 0) {
    timeline.push({
      type: 'installment_set',
      title: 'Installment Plan Set',
      description: `${admissionData.installments.length} installments configured`,
      date: admissionData.updatedAt || admissionData.createdAt,
      user: 'System'
    });
  }
  
  // Add payments
  payments.forEach(p => {
    const typeLabels = {
      'initial': 'Registration Payment',
      'installment': 'Installment Payment',
      'full': 'Full Payment',
      'refund': 'Refund Processed'
    };
    
    timeline.push({
      type: p.type === 'refund' ? 'refund' : 'payment',
      title: typeLabels[p.type] || 'Payment',
      description: `${formatCurrency(p.amount)} via ${p.paymentMode}`,
      date: p.createdAt,
      user: 'System'
    });
  });
  
  // Sort by date (newest first)
  timeline.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (timeline.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        No activity recorded
      </div>
    `;
    return;
  }
  
  container.innerHTML = timeline.map((item, index) => {
    const config = activityConfig[item.type] || activityConfig['note'];
    const date = formatDateTime(item.date);
    
    return `
      <div class="flex gap-4">
        <div class="flex flex-col items-center">
          <div class="w-10 h-10 ${config.bg} rounded-xl flex items-center justify-center flex-shrink-0">
            <i data-lucide="${config.icon}" class="w-5 h-5 ${config.color}"></i>
          </div>
          ${index < timeline.length - 1 ? '<div class="w-0.5 flex-1 bg-gray-200 my-2"></div>' : ''}
        </div>
        <div class="flex-1 pb-6">
          <div class="flex items-center justify-between mb-1">
            <h4 class="font-medium text-gray-800">${item.title}</h4>
            <span class="text-xs text-gray-400">${date}</span>
          </div>
          <p class="text-sm text-gray-600 mb-1">${item.description}</p>
          <span class="text-xs text-gray-400">by ${item.user}</span>
        </div>
      </div>
    `;
  }).join('');
  
  lucide.createIcons();
}

// ==================== ADD PAYMENT MODAL ====================
function openAddPaymentModal() {
  const remaining = admissionData?.remainingAmount ?? ((admissionData?.totalFees || 0) - (admissionData?.totalPaid || 0));
  
  if (remaining <= 0) {
    showToast('Info', 'This admission is fully paid', 'info');
    return;
  }
  
  // Reset form
  document.getElementById('paymentAmount').value = '';
  document.getElementById('paymentMode').value = 'CASH';
  document.getElementById('paymentTypeSelect').value = 'installment';
  document.getElementById('paymentNote').value = '';
  document.getElementById('paymentAmountError').classList.add('hidden');
  
  // Set remaining info
  document.getElementById('modalRemaining').textContent = formatCurrency(remaining);
  
  // Show modal
  const modal = document.getElementById('addPaymentModal');
  const content = document.getElementById('addPaymentModalContent');
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
  }, 10);
  
  lucide.createIcons();
}

function closeAddPaymentModal() {
  const modal = document.getElementById('addPaymentModal');
  const content = document.getElementById('addPaymentModalContent');
  
  modal.classList.add('opacity-0');
  content.classList.remove('scale-100');
  content.classList.add('scale-95');
  
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 200);
}

async function submitAddPayment() {
  const amount = parseFloat(document.getElementById('paymentAmount').value) || 0;
  const mode = document.getElementById('paymentMode').value;
  const type = document.getElementById('paymentTypeSelect').value;
  const note = document.getElementById('paymentNote').value.trim();
  
  const remaining = admissionData?.remainingAmount ?? ((admissionData?.totalFees || 0) - (admissionData?.totalPaid || 0));

  // Validation
  const errorEl = document.getElementById('paymentAmountError');
  
  if (amount <= 0) {
    errorEl.textContent = 'Please enter a valid amount';
    errorEl.classList.remove('hidden');
    return;
  }
  
  if (amount > remaining) {
    errorEl.textContent = `Amount cannot exceed remaining balance (${formatCurrency(remaining)})`;
    errorEl.classList.remove('hidden');
    return;
  }
  
  // Block full payment if it's not actually full
  if (type === 'full' && amount < remaining) {
    errorEl.textContent = 'For "Full Payment" type, amount must equal remaining balance';
    errorEl.classList.remove('hidden');
    return;
  }
  
  errorEl.classList.add('hidden');
  
  // Submit
  const submitBtn = document.getElementById('addPaymentSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
  lucide.createIcons();
  
  try {
    const payload = {
      admissionId: admissionId,
      amount: amount,
      paymentMode: mode,
      type: type
    };
    
    // Only add note if it has a value
    if (note) {
      payload.note = note;
    }
    
    await apiPost(API_ENDPOINTS.PAYMENTS.CREATE, payload);
    
    closeAddPaymentModal();
    showToast('Success', 'Payment recorded successfully', 'success');
    
    // Reload data
    await loadAdmissionDetail();
  } catch (err) {
    console.error('Failed to record payment:', err);
    const message = err.response?.data?.message || 'Failed to record payment';
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Save Payment';
    lucide.createIcons();
  }
}

// ==================== SET INSTALLMENTS MODAL ====================
function openSetInstallmentsModal() {
  if (!admissionData) return;
  
  const totalFees = admissionData.totalFees || 0;
  const registrationAmount = admissionData.registrationAmount || 0;
  const remaining = totalFees - registrationAmount;
  
  // Set summary
  document.getElementById('planTotalFees').textContent = formatCurrency(totalFees);
  document.getElementById('planRegistration').textContent = formatCurrency(registrationAmount);
  document.getElementById('planRemaining').textContent = formatCurrency(remaining);
  
  // Initialize rows (default 2 installments)
  installmentRows = [
    { amount: Math.floor(remaining / 2), dueDate: '' },
    { amount: Math.ceil(remaining / 2), dueDate: '' }
  ];
  
  renderInstallmentRows();
  document.getElementById('planError').classList.add('hidden');
  
  // Show modal
  const modal = document.getElementById('setInstallmentsModal');
  const content = document.getElementById('setInstallmentsModalContent');
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
  }, 10);
  
  lucide.createIcons();
}

function closeSetInstallmentsModal() {
  const modal = document.getElementById('setInstallmentsModal');
  const content = document.getElementById('setInstallmentsModalContent');
  
  modal.classList.add('opacity-0');
  content.classList.remove('scale-100');
  content.classList.add('scale-95');
  
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 200);
}

function renderInstallmentRows() {
  const container = document.getElementById('installmentRows');
  
  container.innerHTML = installmentRows.map((row, index) => `
    <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
      <div class="flex-1">
        <label class="text-xs text-gray-500 mb-1 block">Amount (₹)</label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₹</span>
          <input 
            type="number" 
            value="${row.amount || ''}"
            onchange="updateInstallmentRow(${index}, 'amount', this.value)"
            class="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
            placeholder="Amount"
            min="1"
          >
        </div>
      </div>
      <div class="flex-1">
        <label class="text-xs text-gray-500 mb-1 block">Due Date</label>
        <input 
          type="date" 
          value="${row.dueDate}"
          onchange="updateInstallmentRow(${index}, 'dueDate', this.value)"
          class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-amber-500"
        >
      </div>
      <button 
        onclick="removeInstallmentRow(${index})"
        class="mt-5 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        ${installmentRows.length === 1 ? 'disabled style="opacity:0.3"' : ''}
      >
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    </div>
  `).join('');
  
  lucide.createIcons();
}

function addInstallmentRow() {
  installmentRows.push({ amount: '', dueDate: '' });
  renderInstallmentRows();
}

function removeInstallmentRow(index) {
  if (installmentRows.length > 1) {
    installmentRows.splice(index, 1);
    renderInstallmentRows();
  }
}

function updateInstallmentRow(index, field, value) {
  installmentRows[index][field] = value;
}

async function submitInstallmentPlan() {
  const errorEl = document.getElementById('planError');
  
  const totalFees = admissionData.totalFees || 0;
  const registrationAmount = admissionData.registrationAmount || 0;
  const remaining = totalFees - registrationAmount;
  
  // Validate all rows
  for (let i = 0; i < installmentRows.length; i++) {
    const row = installmentRows[i];
    if (!row.amount || parseFloat(row.amount) <= 0) {
      errorEl.textContent = `Installment ${i + 1}: Please enter a valid amount`;
      errorEl.classList.remove('hidden');
      return;
    }
    if (!row.dueDate) {
      errorEl.textContent = `Installment ${i + 1}: Please select a due date`;
      errorEl.classList.remove('hidden');
      return;
    }
    
    // Check date is in future
    const dueDate = new Date(row.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dueDate < today) {
      errorEl.textContent = `Installment ${i + 1}: Due date must be in the future`;
      errorEl.classList.remove('hidden');
      return;
    }
  }
  
  // Check sum matches remaining
  const totalInstallments = installmentRows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
  
  if (totalInstallments !== remaining) {
    errorEl.textContent = `Total installments (${formatCurrency(totalInstallments)}) must equal remaining amount (${formatCurrency(remaining)})`;
    errorEl.classList.remove('hidden');
    return;
  }
  
  errorEl.classList.add('hidden');
  
  // Submit
  const submitBtn = document.getElementById('planSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
  lucide.createIcons();
  
  try {
    const payload = {
      paymentType: 'INSTALLMENT',
      installments: installmentRows.map(row => ({
        amount: parseFloat(row.amount),
        dueDate: row.dueDate
      }))
    };
    
    await apiPut(API_ENDPOINTS.ADMISSIONS.PAYMENT_PLAN(admissionId), payload);
    
    closeSetInstallmentsModal();
    showToast('Success', 'Installment plan saved successfully', 'success');
    
    // Reload data
    await loadAdmissionDetail();
  } catch (err) {
    console.error('Failed to save payment plan:', err);
    const message = err.response?.data?.message || 'Failed to save payment plan';
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Save Plan';
    lucide.createIcons();
  }
}

// ==================== REFUND MODAL ====================
function openRefundModal() {
  if (!admissionData) return;
  
  // Calculate total paid from payments array (excluding refunds)
  const calculatedPaid = payments
    .filter(p => p.type !== 'refund')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const paidAmount = calculatedPaid || (admissionData?.totalPaid ?? 0);
  const refundPayments = payments.filter(p => p.type === 'refund');
  const totalRefunded = refundPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const maxRefundable = paidAmount - totalRefunded;
  
  if (maxRefundable <= 0) {
    showToast('Info', 'No amount available for refund', 'info');
    return;
  }
  
  // Reset form
  document.getElementById('refundAmount').value = '';
  document.getElementById('refundMode').value = 'CASH';
  document.getElementById('refundNote').value = '';
  document.getElementById('refundAmountError').classList.add('hidden');
  
  // Set info
  document.getElementById('refundTotalPaid').textContent = formatCurrency(paidAmount);
  document.getElementById('refundMaxAmount').textContent = formatCurrency(maxRefundable);
  
  // Show modal
  const modal = document.getElementById('refundModal');
  const content = document.getElementById('refundModalContent');
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
  }, 10);
  
  lucide.createIcons();
}

function closeRefundModal() {
  const modal = document.getElementById('refundModal');
  const content = document.getElementById('refundModalContent');
  
  modal.classList.add('opacity-0');
  content.classList.remove('scale-100');
  content.classList.add('scale-95');
  
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 200);
}

async function submitRefund() {
  const amount = parseFloat(document.getElementById('refundAmount').value) || 0;
  const mode = document.getElementById('refundMode').value;
  const note = document.getElementById('refundNote').value.trim();
  
  const paidAmount = admissionData?.totalPaid || 0;
  const refundPayments = payments.filter(p => p.type === 'refund');
  const totalRefunded = refundPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const maxRefundable = paidAmount - totalRefunded;

  // Validation
  const errorEl = document.getElementById('refundAmountError');
  
  if (amount <= 0) {
    errorEl.textContent = 'Please enter a valid refund amount';
    errorEl.classList.remove('hidden');
    return;
  }
  
  if (amount > maxRefundable) {
    errorEl.textContent = `Refund cannot exceed maximum refundable amount (${formatCurrency(maxRefundable)})`;
    errorEl.classList.remove('hidden');
    return;
  }
  
  errorEl.classList.add('hidden');
  
  // Submit
  const submitBtn = document.getElementById('refundSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Processing...';
  lucide.createIcons();
  
  try {
    const payload = {
      admissionId: admissionId,
      amount: amount,
      paymentMode: mode,
      type: 'refund',
      refundReason: note,
      paymentDate: new Date().toISOString().split('T')[0]
    };
    
    await apiPost(API_ENDPOINTS.PAYMENTS.CREATE, payload);
    
    closeRefundModal();
    showToast('Success', 'Refund processed successfully', 'success');
    
    // Reload data
    await loadAdmissionDetail();
  } catch (err) {
    console.error('Failed to process refund:', err);
    const message = err.response?.data?.message || 'Failed to process refund';
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Process Refund';
    lucide.createIcons();
  }
}

// ==================== HELPER FUNCTIONS ====================
function formatCurrency(amount) {
  if (!amount || amount === 0) return '₹0';
  return '₹' + amount.toLocaleString('en-IN');
}

function formatDate(dateString) {
  if (!dateString) return '--';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatDateTime(dateString) {
  if (!dateString) return '--';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getPaymentIcon(type) {
  const icons = {
    'initial': 'wallet',
    'installment': 'calendar',
    'full': 'check-circle',
    'refund': 'arrow-left'
  };
  return icons[type] || 'credit-card';
}

// ==================== UI STATE FUNCTIONS ====================
function showLoadingState() {
  document.getElementById('loadingState').classList.remove('hidden');
  document.getElementById('errorState').classList.add('hidden');
  document.getElementById('detailContent').classList.add('hidden');
}

function showErrorState(message) {
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('errorState').classList.remove('hidden');
  document.getElementById('detailContent').classList.add('hidden');
  
  if (message) {
    document.querySelector('#errorState p').textContent = message;
  }
}

function showContentState() {
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('errorState').classList.add('hidden');
  document.getElementById('detailContent').classList.remove('hidden');
}

// ==================== WHATSAPP MESSAGING ====================
// Get logged-in user name from localStorage
function getLoggedInUserName() {
  const user = safeParseLocalStorage('user', {});
  return user.name || user.fullName || user.userName || 'Counselor';
}

const WHATSAPP_TEMPLATES = {
  followup: (data) => `Hi ${data.name},

This is ${data.counselorName} from SSSAM Academy, Gurgaon.

Regarding your ${data.course} enquiry, please let me know a convenient time to connect.`,

  fee_reminder: (data) => `Hi ${data.name},

This is ${data.counselorName} from SSSAM Academy, Gurgaon.

Regarding your ${data.course} enquiry, please let me know a convenient time to connect.`,

  admission_confirm: (data) => `Hi ${data.name},

This is ${data.counselorName} from SSSAM Academy, Gurgaon.

Regarding your ${data.course} enquiry, please let me know a convenient time to connect.`,

  custom: (data) => `Hi ${data.name},

This is ${data.counselorName} from SSSAM Academy, Gurgaon.

${data.customMessage || '[Your message here]'}`
};

function openWhatsAppModal() {
  if (!admissionData) return;
  
  const enquiry = admissionData.enquiryId || {};
  const mobile = enquiry.mobile;
  
  if (!mobile) {
    showToast('Error', 'No mobile number available for this student', 'error');
    return;
  }
  
  // Set recipient info
  document.getElementById('whatsappRecipient').textContent = `${enquiry.name || 'Student'} (${mobile})`;
  
  // Reset template and update message
  document.getElementById('whatsappTemplate').value = 'followup';
  updateWhatsAppMessage();
  
  // Show modal
  const modal = document.getElementById('whatsappModal');
  const content = document.getElementById('whatsappModalContent');
  
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  setTimeout(() => {
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
  }, 10);
  
  lucide.createIcons();
}

function closeWhatsAppModal() {
  const modal = document.getElementById('whatsappModal');
  const content = document.getElementById('whatsappModalContent');
  
  modal.classList.add('opacity-0');
  content.classList.remove('scale-100');
  content.classList.add('scale-95');
  
  setTimeout(() => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }, 200);
}

function updateWhatsAppMessage() {
  const template = document.getElementById('whatsappTemplate').value;
  const enquiry = admissionData?.enquiryId || {};
  
  // Get next due info
  const nextDue = calculateNextDue(admissionData, payments);
  
  const data = {
    name: enquiry.name || 'Student',
    course: admissionData?.course || 'Course',
    amount: nextDue.amount > 0 ? formatCurrency(nextDue.amount) : formatCurrency(admissionData?.totalFees || 0),
    dueDate: nextDue.date !== '--' ? nextDue.date : 'As discussed',
    totalFees: formatCurrency(admissionData?.totalFees || 0),
    paidAmount: formatCurrency(admissionData?.totalPaid || 0),
    remaining: formatCurrency(Math.max(0, admissionData?.remainingAmount ?? ((admissionData?.totalFees || 0) - (admissionData?.totalPaid || 0)))),
    counselorName: getLoggedInUserName()
  };
  
  const message = WHATSAPP_TEMPLATES[template](data);
  document.getElementById('whatsappMessage').value = message;
}

function sendWhatsAppMessage() {
  const enquiry = admissionData?.enquiryId || {};
  const mobile = enquiry.mobile;
  
  if (!mobile) {
    showToast('Error', 'No mobile number available', 'error');
    return;
  }
  
  // Get message from textarea (user may have edited it)
  const message = document.getElementById('whatsappMessage').value;
  
  // Clean mobile number (remove spaces, +91 prefix if present)
  const cleanMobile = mobile.replace(/\s/g, '').replace(/^\+91/, '').replace(/^0/, '');
  
  // Encode message for URL
  const encodedMessage = encodeURIComponent(message);
  
  // Open WhatsApp
  const whatsappUrl = `https://wa.me/91${cleanMobile}?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank');
  
  closeWhatsAppModal();
  showToast('Success', 'WhatsApp opened with message', 'success');
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
  const duration = type === 'error' ? 5000 : 3000;
  setTimeout(() => {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
