let currentAdmissionId = null;
let currentAdmission = null;
let payments = [];

/* ======================
INIT
====================== */
document.addEventListener('DOMContentLoaded', () => {
    // Get admission ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentAdmissionId = urlParams.get('id');

    if (!currentAdmissionId) {
        showToast('error', 'No admission ID provided');
        window.location.href = 'admissions.html';
        return;
    }

    loadAdmissionDetails();
    checkAdminAccess();

    // Amount validation on input
    const amountInput = document.getElementById('amount');
    if (amountInput) {
        amountInput.addEventListener('input', clearAmountError);
    }
});

/* ======================
CHECK ADMIN ACCESS
====================== */
function checkAdminAccess() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (user.role === 'admin') {
        document.getElementById('editBtn')?.classList.remove('hidden');
    }
}

/* ======================
LOAD DATA
====================== */
async function loadAdmissionDetails() {
    try {
        // Load admission details
        const response = await apiGet(API_ENDPOINTS.ADMISSIONS.GET_BY_ID(currentAdmissionId));
        // Handle response wrapper or direct data
        currentAdmission = response.admission || response.data?.admission || response;

        // Load payments
        const paymentsResponse = await apiGet(API_ENDPOINTS.PAYMENTS.GET_BY_ADMISSION(currentAdmissionId));
        payments = paymentsResponse.payments || paymentsResponse.data?.payments || paymentsResponse || [];

        renderAdmissionDetails();
        renderPaymentHistory();
    } catch (err) {
        showToast('error', 'Failed to load admission details');
        console.error(err);
    }
}

/* ======================
RENDER ADMISSION DETAILS
====================== */
function renderAdmissionDetails() {
    if (!currentAdmission) return;

    const enquiry = currentAdmission.enquiryId || {};
    const counselor = currentAdmission.counselorId || {};

    // Student Info
    document.getElementById('studentName').textContent = enquiry.name || '-';
    document.getElementById('studentMobile').querySelector('span').textContent = enquiry.mobile || '-';
    document.getElementById('studentCourse').querySelector('span').textContent = currentAdmission.course || enquiry.courseInterested || '-';

    // Counselor Info
    document.getElementById('counselorName').textContent = counselor.name || 'Unassigned';
    document.getElementById('counselorEmail').textContent = counselor.email || '-';

    // Payment Summary
    const totalFees = currentAdmission.totalFees || 0;
    const paidAmount = currentAdmission.paidAmount || 0;
    const remaining = currentAdmission.pendingAmount !== undefined
        ? currentAdmission.pendingAmount
        : Math.max(0, totalFees - paidAmount);
    const isComplete = remaining <= 0;

    document.getElementById('totalFees').textContent = formatCurrency(totalFees);
    document.getElementById('paidAmount').textContent = formatCurrency(paidAmount);
    document.getElementById('remainingAmount').textContent = formatCurrency(remaining);
    document.getElementById('admissionDate').textContent = formatDate(currentAdmission.createdAt);

    // Payment Type & Method
    const paymentType = currentAdmission.paymentType || 'ONE_TIME';
    const paymentMethod = currentAdmission.paymentMethod || '-';
    document.getElementById('paymentMode').textContent = paymentType === 'ONE_TIME'
        ? paymentMethod
        : `${paymentType} (Installment)`;

    // Payment Status Badge
    const badgeContainer = document.getElementById('paymentStatusBadge');
    if (isComplete) {
        badgeContainer.innerHTML = `
            <span class="inline-flex items-center gap-1.5 px-4 py-2 bg-green-100 text-green-700 rounded-xl text-sm font-medium">
                <i data-lucide="check-circle" class="w-4 h-4"></i>
                Fully Paid
            </span>
        `;
    } else {
        badgeContainer.innerHTML = `
            <span class="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-100 text-amber-700 rounded-xl text-sm font-medium">
                <i data-lucide="clock" class="w-4 h-4"></i>
                Payment Pending
            </span>
        `;
    }
    lucide.createIcons();

    // Payment Status Section
    const fullyPaidSection = document.getElementById('fullyPaidSection');
    const pendingPaymentSection = document.getElementById('pendingPaymentSection');

    if (isComplete) {
        fullyPaidSection.classList.remove('hidden');
        pendingPaymentSection.classList.add('hidden');

        // Find completion date (date of last payment)
        const lastPayment = payments.length > 0
            ? payments.reduce((latest, p) => new Date(p.createdAt) > new Date(latest.createdAt) ? p : latest)
            : null;
        document.getElementById('completionDate').textContent = lastPayment
            ? formatDate(lastPayment.createdAt)
            : formatDate(currentAdmission.updatedAt);

        // Show payment method for ONE_TIME payments
        const pmDisplay = document.getElementById('paymentMethodDisplay');
        if (pmDisplay && currentAdmission.paymentType === 'ONE_TIME' && currentAdmission.paymentMethod) {
            pmDisplay.textContent = currentAdmission.paymentMethod;
        } else if (pmDisplay) {
            pmDisplay.textContent = 'N/A';
        }
    } else {
        fullyPaidSection.classList.add('hidden');
        pendingPaymentSection.classList.remove('hidden');
        document.getElementById('pendingRemaining').textContent = formatCurrency(remaining);

        // Show installments if available
        const installmentSection = document.getElementById('installmentSection');
        if (currentAdmission.installments?.length > 0) {
            installmentSection.classList.remove('hidden');
            renderInstallments(currentAdmission.installments, paidAmount);
        } else {
            installmentSection.classList.add('hidden');
        }
    }
}

/* ======================
RENDER INSTALLMENTS
====================== */
function renderInstallments(installments, paidAmount) {
    const container = document.getElementById('installmentList');

    let cumulativePaid = 0;

    const html = installments.map((inst, index) => {
        cumulativePaid += inst.amount;
        const isPaid = paidAmount >= cumulativePaid;
        const status = isPaid ? 'Paid' : (paidAmount >= cumulativePaid - inst.amount ? 'Partial' : 'Pending');

        const statusColors = {
            'Paid': 'bg-green-100 text-green-700',
            'Partial': 'bg-blue-100 text-blue-700',
            'Pending': 'bg-gray-100 text-gray-600'
        };

        const statusIcons = {
            'Paid': 'check-circle',
            'Partial': 'clock',
            'Pending': 'circle'
        };

        return `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-sm font-semibold text-gray-600">
                        ${index + 1}
                    </div>
                    <div>
                        <p class="font-medium text-gray-800">${formatCurrency(inst.amount)}</p>
                        <p class="text-xs text-gray-500">Due: ${formatDate(inst.dueDate)}</p>
                    </div>
                </div>
                <span class="inline-flex items-center gap-1.5 px-3 py-1 ${statusColors[status]} rounded-lg text-xs font-medium">
                    <i data-lucide="${statusIcons[status]}" class="w-3 h-3"></i>
                    ${status}
                </span>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
    lucide.createIcons();
}

/* ======================
RENDER PAYMENT HISTORY
====================== */
function renderPaymentHistory() {
    const container = document.getElementById('paymentHistory');

    if (!payments || payments.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i data-lucide="credit-card" class="w-8 h-8 text-gray-400"></i>
                </div>
                <p>No payments recorded yet</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    // Sort payments by date (newest first)
    const sortedPayments = [...payments].sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
    );

    const html = sortedPayments.map((p, index) => `
        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <i data-lucide="wallet" class="w-5 h-5 text-green-600"></i>
                </div>
                <div>
                    <p class="font-medium text-gray-800">${formatCurrency(p.amount)}</p>
                    <p class="text-xs text-gray-500">${p.paymentMode || 'Cash'} • ${formatDate(p.createdAt)}</p>
                </div>
            </div>
            <span class="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                Payment #${sortedPayments.length - index}
            </span>
        </div>
    `).join('');

    container.innerHTML = html;
    lucide.createIcons();
}

/* ======================
PAYMENT MODAL
====================== */
function openPaymentModal() {
    // Reset form
    document.getElementById('amount').value = '';
    document.getElementById('paymentMode').value = 'Cash';
    clearAmountError();

    // Show modal with animation
    const modal = document.getElementById('paymentModal');
    const modalContent = document.getElementById('paymentModalContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    const modalContent = document.getElementById('paymentModalContent');
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function clearAmountError() {
    const error = document.getElementById('amountError');
    const input = document.getElementById('amount');
    error.classList.add('hidden');
    input.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
    input.classList.add('border-gray-200', 'focus:border-green-500', 'focus:ring-green-100');
}

function validateAmount() {
    const amount = document.getElementById('amount');
    const error = document.getElementById('amountError');
    const value = Number(amount.value);

    if (!value || value <= 0) {
        error.classList.remove('hidden');
        amount.classList.remove('border-gray-200', 'focus:border-green-500', 'focus:ring-green-100');
        amount.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        return false;
    }

    // Check if amount exceeds remaining
    const totalFees = currentAdmission?.totalFees || 0;
    const paidAmount = currentAdmission?.paidAmount || 0;
    const remaining = totalFees - paidAmount;

    if (value > remaining) {
        error.textContent = `Amount cannot exceed remaining ₹${remaining}`;
        error.classList.remove('hidden');
        amount.classList.remove('border-gray-200', 'focus:border-green-500', 'focus:ring-green-100');
        amount.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        return false;
    }

    error.classList.add('hidden');
    amount.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
    amount.classList.add('border-gray-200', 'focus:border-green-500', 'focus:ring-green-100');
    return true;
}

async function submitPayment() {
    const amount = Number(document.getElementById('amount').value);
    const paymentMode = document.getElementById('paymentMode').value;

    if (!validateAmount()) {
        showToast('error', 'Enter a valid amount');
        return;
    }

    try {
        await apiPost(API_ENDPOINTS.PAYMENTS.CREATE, {
            admissionId: currentAdmissionId,
            amount,
            paymentMode
        });

        showToast('success', 'Payment added successfully');
        closePaymentModal();

        // Reload data
        await loadAdmissionDetails();
    } catch (err) {
        showToast('error', err?.message || 'Payment failed');
    }
}

/* ======================
EDIT MODAL (Admin Only)
====================== */
function openEditModal() {
    if (!currentAdmission) return;

    // Populate form
    document.getElementById('editTotalFees').value = currentAdmission.totalFees || '';
    document.getElementById('editPaymentType').value = currentAdmission.paymentType || 'ONE_TIME';

    // Show modal with animation
    const modal = document.getElementById('editModal');
    const modalContent = document.getElementById('editModalContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    const modalContent = document.getElementById('editModalContent');
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

async function submitEdit() {
    const totalFees = Number(document.getElementById('editTotalFees').value);
    const paymentType = document.getElementById('editPaymentType').value;

    if (!totalFees || totalFees <= 0) {
        showToast('error', 'Enter valid total fees');
        return;
    }

    try {
        await apiPut(API_ENDPOINTS.ADMISSIONS.UPDATE_FEES(currentAdmissionId), {
            totalFees,
            paymentType
        });

        showToast('success', 'Admission updated successfully');
        closeEditModal();

        // Reload data
        await loadAdmissionDetails();
    } catch (err) {
        showToast('error', err?.message || 'Failed to update admission');
    }
}

/* ======================
EXPORT
====================== */
window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.submitPayment = submitPayment;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.submitEdit = submitEdit;
