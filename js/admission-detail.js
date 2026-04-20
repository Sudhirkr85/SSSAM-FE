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
    setupWhatsAppIntegration();

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

        // Re-setup WhatsApp after dynamic button is created
        setupWhatsAppIntegration();
    } catch (err) {
        showToast('error', 'Failed to load admission details');
        console.error(err);
    }
}

/* ======================
STATUS CALCULATION
====================== */
function getAdmissionStatus(paid, total, dueDate) {
    const remaining = total - paid;

    if (remaining <= 0) {
        return { status: 'Paid', color: 'green', bgClass: 'bg-green-100', textClass: 'text-green-700', icon: 'check-circle' };
    }

    if (paid > 0 && paid < total) {
        return { status: 'Partial', color: 'amber', bgClass: 'bg-amber-100', textClass: 'text-amber-700', icon: 'clock' };
    }

    // Check if overdue
    if (dueDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDate);
        due.setHours(0, 0, 0, 0);

        if (today > due) {
            const daysOverdue = Math.floor((today - due) / (1000 * 60 * 60 * 24));
            return { status: 'Overdue', color: 'red', bgClass: 'bg-red-100', textClass: 'text-red-700', icon: 'alert-circle', daysOverdue };
        }
    }

    return { status: 'Pending', color: 'gray', bgClass: 'bg-gray-100', textClass: 'text-gray-600', icon: 'circle' };
}

function getInstallmentStatus(inst, index, paidAmount, previousCumulative) {
    const cumulativeForThis = previousCumulative + inst.amount;
    const isPaid = paidAmount >= cumulativeForThis;
    const isPartial = paidAmount > previousCumulative && paidAmount < cumulativeForThis;

    if (isPaid) {
        return { status: 'Paid', color: 'green', bgClass: 'bg-green-100', textClass: 'text-green-700', icon: 'check-circle', isPaid: true };
    }

    if (isPartial) {
        const paidForThis = paidAmount - previousCumulative;
        const remaining = inst.amount - paidForThis;
        return { status: 'Partial', color: 'blue', bgClass: 'bg-blue-100', textClass: 'text-blue-700', icon: 'clock', isPaid: false, paidForThis, remaining };
    }

    // Check if overdue
    if (inst.dueDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(inst.dueDate);
        due.setHours(0, 0, 0, 0);

        if (today > due) {
            const daysOverdue = Math.floor((today - due) / (1000 * 60 * 60 * 24));
            return { status: 'Overdue', color: 'red', bgClass: 'bg-red-100', textClass: 'text-red-700', icon: 'alert-circle', isPaid: false, daysOverdue };
        }
    }

    return { status: 'Pending', color: 'gray', bgClass: 'bg-gray-100', textClass: 'text-gray-600', icon: 'circle', isPaid: false };
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

    // Mobile number - check multiple possible locations in data
    console.log('Admission data:', currentAdmission);
    console.log('Enquiry data:', enquiry);
    const mobile = enquiry.mobile || currentAdmission.mobile || currentAdmission.studentMobile || enquiry.phone || '-';
    console.log('Found mobile:', mobile);
    const mobileEl = document.getElementById('studentMobile');
    if (mobileEl) {
        mobileEl.textContent = mobile;
        // Store mobile in a data attribute for WhatsApp to use
        mobileEl.dataset.mobile = mobile !== '-' ? mobile.replace(/\D/g, '') : '';
    }

    document.getElementById('studentCourse').querySelector('span').textContent = currentAdmission.course || enquiry.courseInterested || '-';

    // Counselor Info
    document.getElementById('counselorName').textContent = counselor.name || 'Unassigned';

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

    // Get due date for status calculation
    const dueDate = currentAdmission.installments?.[0]?.dueDate || currentAdmission.dueDate || currentAdmission.createdAt;
    const statusInfo = getAdmissionStatus(paidAmount, totalFees, dueDate);

    // Payment Status Badge
    const badgeContainer = document.getElementById('paymentStatusBadge');
    let extraText = '';
    if (statusInfo.status === 'Overdue' && statusInfo.daysOverdue) {
        extraText = ` (${statusInfo.daysOverdue}d)`;
    }

    badgeContainer.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-4 py-2 ${statusInfo.bgClass} ${statusInfo.textClass} rounded-xl text-sm font-medium">
            <i data-lucide="${statusInfo.icon}" class="w-4 h-4"></i>
            ${statusInfo.status}${extraText}
        </span>
    `;
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

        // Update Pay Full button visibility
        const payFullBtn = document.getElementById('payFullBtn');
        if (payFullBtn) {
            payFullBtn.style.display = remaining > 0 ? 'flex' : 'none';
        }
    }

    // Re-attach WhatsApp event listener since button was dynamically created
    setupWhatsAppIntegration();
}

/* ======================
RENDER INSTALLMENTS
====================== */
function renderInstallments(installments, paidAmount) {
    const container = document.getElementById('installmentList');

    let cumulativePaid = 0;

    const html = installments.map((inst, index) => {
        const statusInfo = getInstallmentStatus(inst, index, paidAmount, cumulativePaid);
        cumulativePaid += inst.amount;

        // Build status text with extra info
        let statusText = statusInfo.status;
        let extraInfo = '';

        if (statusInfo.status === 'Partial' && statusInfo.paidForThis !== undefined) {
            extraInfo = `<span class="text-xs text-blue-600">Paid: ${formatCurrency(statusInfo.paidForThis)} / Rem: ${formatCurrency(statusInfo.remaining)}</span>`;
        } else if (statusInfo.status === 'Overdue' && statusInfo.daysOverdue) {
            extraInfo = `<span class="text-xs text-red-600">Overdue by ${statusInfo.daysOverdue} days</span>`;
        }

        // Row background based on status
        const rowBgClass = statusInfo.status === 'Overdue' ? 'bg-red-50/50' :
                          statusInfo.status === 'Paid' ? 'bg-green-50/50' :
                          statusInfo.status === 'Partial' ? 'bg-blue-50/50' : '';

        // Action button
        let actionButton = '';
        if (!statusInfo.isPaid) {
            const amountToPay = statusInfo.status === 'Partial' ? statusInfo.remaining : inst.amount;
            actionButton = `
                <button onclick="event.stopPropagation(); openPaymentModalForInstallment(${index}, ${amountToPay})"
                    class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm">
                    Pay
                </button>
            `;
        } else {
            actionButton = `<span class="text-gray-400 text-xs">-</span>`;
        }

        return `
            <tr class="${rowBgClass} border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                <td class="px-4 py-3 text-gray-800 font-medium">${index + 1}</td>
                <td class="px-4 py-3 text-gray-600">${formatDate(inst.dueDate)}</td>
                <td class="px-4 py-3 font-medium text-gray-800">${formatCurrency(inst.amount)}</td>
                <td class="px-4 py-3 text-center">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 ${statusInfo.bgClass} ${statusInfo.textClass} rounded-lg text-xs font-medium">
                        <i data-lucide="${statusInfo.icon}" class="w-3.5 h-3.5"></i>
                        ${statusText}
                    </span>
                    ${extraInfo ? `<div class="mt-1">${extraInfo}</div>` : ''}
                </td>
                <td class="px-4 py-3 text-center">
                    ${actionButton}
                </td>
            </tr>
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
let currentInstallmentIndex = null;

function openPaymentModal() {
    currentInstallmentIndex = null;

    // Reset form
    document.getElementById('amount').value = '';
    const paymentModeField = document.getElementById('paymentMode');
    if (paymentModeField) paymentModeField.value = 'CASH';
    document.getElementById('installmentIndex').value = '';
    clearAmountError();

    // Reset modal title and hide installment info
    document.getElementById('paymentModalTitle').textContent = 'Add Payment';
    document.getElementById('paymentModalSubtitle').textContent = 'Enter payment details';
    document.getElementById('installmentInfo').classList.add('hidden');

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

function openPaymentModalForInstallment(index, amount) {
    currentInstallmentIndex = index;

    // Pre-fill amount
    document.getElementById('amount').value = amount;
    const paymentModeField = document.getElementById('paymentMode');
    if (paymentModeField) paymentModeField.value = 'CASH';
    document.getElementById('installmentIndex').value = index;
    clearAmountError();

    // Update modal title and show installment info
    document.getElementById('paymentModalTitle').textContent = 'Pay Installment';
    document.getElementById('paymentModalSubtitle').textContent = `Installment #${index + 1}`;
    document.getElementById('installmentNumber').textContent = index + 1;
    document.getElementById('installmentAmountDue').textContent = formatCurrency(amount);
    document.getElementById('installmentInfo').classList.remove('hidden');

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

function openPayFullModal() {
    if (!currentAdmission) return;

    const totalFees = currentAdmission.totalFees || 0;
    const paidAmount = currentAdmission.paidAmount || 0;
    const remaining = Math.max(0, totalFees - paidAmount);

    if (remaining <= 0) {
        showToast('info', 'Payment already complete');
        return;
    }

    currentInstallmentIndex = null;

    // Pre-fill with remaining amount
    document.getElementById('amount').value = remaining;
    const paymentModeField = document.getElementById('paymentMode');
    if (paymentModeField) paymentModeField.value = 'CASH';
    document.getElementById('installmentIndex').value = '';
    clearAmountError();

    // Update modal title
    document.getElementById('paymentModalTitle').textContent = 'Pay Full Amount';
    document.getElementById('paymentModalSubtitle').textContent = `Clear remaining balance: ${formatCurrency(remaining)}`;
    document.getElementById('installmentInfo').classList.add('hidden');

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
    const paymentDate = document.getElementById('paymentDate')?.value;
    const nextInstallmentDate = document.getElementById('nextInstallmentDate')?.value;

    if (!validateAmount()) {
        showToast('error', 'Enter a valid amount');
        return;
    }

    try {
        const payload = {
            admissionId: currentAdmissionId,
            amount,
            paymentMode: paymentMode.toUpperCase()
        };

        // Add optional payment date if provided
        if (paymentDate) {
            payload.paymentDate = paymentDate;
        }

        // Add installment index if paying specific installment
        if (currentInstallmentIndex !== null && currentInstallmentIndex !== undefined) {
            payload.installmentIndex = currentInstallmentIndex;
        }

        // Add optional next installment date
        if (nextInstallmentDate) {
            payload.nextInstallmentDate = nextInstallmentDate;
        }

        await apiPost(API_ENDPOINTS.PAYMENTS.CREATE, payload);

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
WHATSAPP INTEGRATION
====================== */
const WHATSAPP_TEMPLATES = {
    enquiry: (name, course, counselorName) => `Hi ${name}, ${counselorName} from SSSAM Academy. You enquired about ${course}. Can I help?`,
    confirm: (name, course, counselorName) => `Hi ${name}, ${counselorName} from SSSAM Academy. Your ${course} admission confirmed! 🎉`,
    payment: (name, course, amount, date, counselorName) => `Hi ${name}, ${counselorName} from SSSAM Academy. ₹${amount} pending for ${course}. Please pay by ${date}.`,
    installment: (name, amount, counselorName) => `Hi ${name}, ${counselorName} from SSSAM Academy. Installment ₹${amount} due. Pay now?`,
    followup: (name, course, counselorName) => `Hi ${name}, ${counselorName} from SSSAM Academy. Following up on ${course}. Any questions?`,
    custom: (name, counselorName) => `Hi ${name}, ${counselorName} from SSSAM Academy. `
};

function setupWhatsAppIntegration() {
    const mobileBtn = document.getElementById('studentMobileBtn');
    const whatsappMenu = document.getElementById('whatsappMenu');
    const templateSelect = document.getElementById('whatsappTemplate');
    const messageTextarea = document.getElementById('whatsappMessage');
    const sendBtn = document.getElementById('sendWhatsappBtn');

    if (!mobileBtn || !whatsappMenu) {
        console.warn('WhatsApp elements not found');
        return;
    }

    console.log('WhatsApp integration setup complete');

    // Toggle menu on button click
    mobileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Mobile button clicked');

        const isHidden = whatsappMenu.classList.contains('hidden');

        // Hide all other menus first
        document.querySelectorAll('.whatsapp-menu').forEach(m => m.classList.add('hidden'));

        if (isHidden) {
            whatsappMenu.classList.remove('hidden');
            generateWhatsAppMessage();
        } else {
            whatsappMenu.classList.add('hidden');
        }
    });

    // Prevent menu from closing when clicking inside it
    whatsappMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!whatsappMenu.contains(e.target) && !mobileBtn.contains(e.target)) {
            whatsappMenu.classList.add('hidden');
        }
    });

    // Generate message when template changes
    templateSelect?.addEventListener('change', generateWhatsAppMessage);

    // Send WhatsApp
    sendBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        openWhatsApp();
    });
}

function generateWhatsAppMessage() {
    const templateSelect = document.getElementById('whatsappTemplate');
    const messageTextarea = document.getElementById('whatsappMessage');
    const mobileDisplay = document.getElementById('whatsappMobileDisplay');

    if (!currentAdmission || !templateSelect || !messageTextarea) return;

    const enquiry = currentAdmission.enquiryId || {};
    const counselor = getCurrentUser();
    const counselorName = counselor.name?.split(' ')[0] || 'Counselor';

    const name = enquiry.name || 'Student';
    // Check multiple possible locations for mobile
    const mobile = enquiry.mobile || currentAdmission.mobile || currentAdmission.studentMobile || enquiry.phone || '-';
    const course = currentAdmission.course || enquiry.courseInterested || 'Course';
    const remaining = currentAdmission.pendingAmount || 0;
    const dueDate = currentAdmission.installments?.[0]?.dueDate || new Date();
    const formattedDate = new Date(dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

    // Show mobile number in menu header
    if (mobileDisplay) {
        mobileDisplay.textContent = mobile !== '-' ? `📞 ${mobile}` : '';
    }

    const template = templateSelect.value;
    let message = '';

    switch (template) {
        case 'enquiry':
            message = WHATSAPP_TEMPLATES.enquiry(name, course, counselorName);
            break;
        case 'confirm':
            message = WHATSAPP_TEMPLATES.confirm(name, course, counselorName);
            break;
        case 'payment':
            message = WHATSAPP_TEMPLATES.payment(name, course, remaining, formattedDate, counselorName);
            break;
        case 'installment':
            message = WHATSAPP_TEMPLATES.installment(name, remaining, counselorName);
            break;
        case 'followup':
            message = WHATSAPP_TEMPLATES.followup(name, course, counselorName);
            break;
        case 'custom':
            message = WHATSAPP_TEMPLATES.custom(name, counselorName);
            break;
    }

    messageTextarea.value = message;
}

function openWhatsApp() {
    const messageTextarea = document.getElementById('whatsappMessage');
    const mobileSpan = document.getElementById('studentMobile');

    if (!messageTextarea || !mobileSpan) return;

    const message = messageTextarea.value.trim();
    // Get mobile from data attribute (clean number) or fall back to textContent
    const mobile = mobileSpan.dataset.mobile || mobileSpan.textContent.trim().replace(/\D/g, '');

    if (!mobile || mobile === '' || mobile === '-') {
        showToast('error', 'No mobile number available');
        return;
    }

    if (!message) {
        showToast('error', 'Please enter a message');
        return;
    }

    // Format mobile for WhatsApp (add country code if needed)
    const formattedMobile = mobile.startsWith('91') ? mobile : '91' + mobile;

    // Encode message for URL
    const encodedMessage = encodeURIComponent(message);

    // Open WhatsApp
    const whatsappUrl = `https://wa.me/${formattedMobile}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');

    // Hide menu
    document.getElementById('whatsappMenu')?.classList.add('hidden');
    showToast('success', 'WhatsApp opened');
}

/* ======================
EXPORT
====================== */
window.openPaymentModal = openPaymentModal;
window.openPaymentModalForInstallment = openPaymentModalForInstallment;
window.openPayFullModal = openPayFullModal;
window.closePaymentModal = closePaymentModal;
window.submitPayment = submitPayment;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.submitEdit = submitEdit;
