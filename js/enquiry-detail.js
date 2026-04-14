let currentId = null;
let confirmCallback = null;

// Status labels - text only, no icons
const statusLabels = {
    'CONTACTED': { text: 'Contacted', color: 'blue' },
    'NO_RESPONSE': { text: 'No Response', color: 'gray' },
    'FOLLOW_UP': { text: 'Follow Up', color: 'amber' },
    'INTERESTED': { text: 'Interested', color: 'green' },
    'NOT_INTERESTED': { text: 'Not Interested', color: 'red' },
    'ADMISSION_PROCESS': { text: 'Admission Process', color: 'purple' },
    'CONVERTED': { text: 'Converted', color: 'green' }
};

/* ======================
INIT
====================== */
document.addEventListener('DOMContentLoaded', () => {
    // Get enquiry ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentId = urlParams.get('id');

    if (currentId) {
        loadEnquiryDetail(currentId);
    } else {
        showToast('error', 'No enquiry ID provided');
    }

    // Note validation on input
    const noteInput = document.getElementById('statusNote');
    if (noteInput) {
        noteInput.addEventListener('input', clearStatusNoteError);
    }
});

/* ======================
LOAD DATA
====================== */
async function loadEnquiryDetail(id) {
    try {
        const res = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_BY_ID(id));
        const enquiry = res.enquiry;

        if (!enquiry) {
            showToast('error', 'Enquiry not found');
            return;
        }

        renderEnquiry(enquiry);
        renderTimeline(enquiry.timeline || []);
    } catch {
        showToast('error', 'Failed to load enquiry details');
    }
}

function renderEnquiry(e) {
    // Header info
    document.getElementById('detailName').textContent = e.name || '-';
    document.getElementById('detailMobile').querySelector('span').textContent = e.mobile || '-';
    document.getElementById('detailCourse').querySelector('span').textContent = e.courseInterested || '-';

    // Status badge
    const statusBadge = document.getElementById('detailStatusBadge');
    statusBadge.innerHTML = getStatusBadge(e.status);

    // Details grid
    document.getElementById('infoEmail').textContent = e.email || '-';
    document.getElementById('infoAssigned').textContent = e.assignedTo?.name || '-';
    document.getElementById('infoStatus').innerHTML = getStatusBadge(e.status);
    document.getElementById('infoCreated').textContent = formatDate(e.createdAt);
}

function renderTimeline(timeline) {
    const container = document.getElementById('timelineList');

    if (!timeline.length) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <i data-lucide="history" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
                <p class="text-sm">No activity recorded yet</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    container.innerHTML = timeline.map(item => `
        <div class="timeline-item pb-4">
            <div class="flex items-start justify-between">
                <div>
                    <p class="font-medium text-gray-800">${item.action || 'Status Update'}</p>
                    <p class="text-gray-500 text-xs mt-0.5">${item.note || ''}</p>
                </div>
                <span class="text-xs text-gray-400 whitespace-nowrap">${formatDate(item.date)}</span>
            </div>
        </div>
    `).join('');

    lucide.createIcons();
}

/* ======================
STATUS MODAL
====================== */
function openStatusModal(id, status) {
    currentId = id;
    document.getElementById('statusEnquiryId').value = id;
    document.getElementById('statusTargetStatus').value = status;

    // Show status display - text only, no icon
    const statusInfo = statusLabels[status] || { text: status, color: 'gray' };
    const colorClass = statusInfo.color === 'blue' ? 'text-blue-600' : statusInfo.color === 'green' ? 'text-green-600' : statusInfo.color === 'red' ? 'text-red-600' : statusInfo.color === 'amber' ? 'text-amber-600' : statusInfo.color === 'purple' ? 'text-purple-600' : 'text-gray-600';
    document.getElementById('statusDisplay').innerHTML = `
        <span class="${colorClass} font-medium">${statusInfo.text}</span>
    `;

    // Reset form
    document.getElementById('statusNote').value = '';
    document.getElementById('statusFollowUpDate').value = '';
    clearStatusNoteError();

    // Show modal with animation
    const modal = document.getElementById('statusModal');
    const modalContent = document.getElementById('statusModalContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
}

function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    const modalContent = document.getElementById('statusModalContent');
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function clearStatusNoteError() {
    const error = document.getElementById('statusNoteError');
    const input = document.getElementById('statusNote');
    error.classList.add('hidden');
    input.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
    input.classList.add('border-gray-200', 'focus:border-blue-500', 'focus:ring-blue-100');
}

function validateStatusNote() {
    const note = document.getElementById('statusNote');
    const error = document.getElementById('statusNoteError');
    if (!note.value.trim()) {
        error.classList.remove('hidden');
        note.classList.remove('border-gray-200', 'focus:border-blue-500', 'focus:ring-blue-100');
        note.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        return false;
    }
    error.classList.add('hidden');
    note.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
    note.classList.add('border-gray-200', 'focus:border-blue-500', 'focus:ring-blue-100');
    return true;
}

function submitStatusUpdate() {
    if (!validateStatusNote()) {
        showToast('error', 'Please add a note');
        return;
    }

    const status = document.getElementById('statusTargetStatus').value;
    const note = document.getElementById('statusNote').value;
    const followUpDate = document.getElementById('statusFollowUpDate').value;
    const statusInfo = statusLabels[status] || { text: status };

    // Open confirm modal
    document.getElementById('confirmActionText').textContent = `Update to ${statusInfo.text}`;
    document.getElementById('confirmDetailsText').textContent = note;

    confirmCallback = () => executeStatusUpdate(currentId, status, note, followUpDate);

    const modal = document.getElementById('confirmModal');
    const modalContent = document.getElementById('confirmModalContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
}

async function executeStatusUpdate(id, status, note, followUpDate) {
    try {
        await apiPut(API_ENDPOINTS.ENQUIRIES.UPDATE_STATUS(id), {
            status,
            note,
            followUpDate
        });

        showToast('success', 'Status updated successfully');
        closeConfirmModal();
        closeStatusModal();
        loadEnquiryDetail(id);
    } catch {
        showToast('error', 'Failed to update status');
    }
}

/* ======================
CONVERT TO ADMISSION FLOW
====================== */
let pendingConvertData = null;

// Step 1: Show Convert Confirmation
function openConvertModal(id) {
    currentId = id;
    pendingConvertData = null;

    // Show confirmation modal directly
    document.getElementById('confirmActionText').textContent = 'Convert to Admission';
    document.getElementById('confirmDetailsText').textContent = 'Are you sure you want to convert this enquiry to admission?';

    confirmCallback = () => {
        closeConfirmModal();
        // After confirmation, show Setup Fees modal
        openSetupFeesModal(id);
    };

    const modal = document.getElementById('confirmModal');
    const modalContent = document.getElementById('confirmModalContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
}

// Step 2: Setup Fees Modal
function openSetupFeesModal(id) {
    document.getElementById('setupFeesEnquiryId').value = id;

    // Reset form
    document.getElementById('totalFees').value = '';
    document.getElementById('installmentAmount').value = '';
    document.getElementById('paymentDate').value = '';
    document.getElementById('paymentMode').value = 'CASH';
    clearSetupFeesErrors();

    // Show modal with animation
    const modal = document.getElementById('setupFeesModal');
    const modalContent = document.getElementById('setupFeesModalContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
        lucide.createIcons();
    }, 10);
}

function closeSetupFeesModal() {
    const modal = document.getElementById('setupFeesModal');
    const modalContent = document.getElementById('setupFeesModalContent');
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function clearSetupFeesErrors() {
    const fields = ['totalFees', 'installmentAmount', 'paymentDate'];
    fields.forEach(field => {
        const error = document.getElementById(field + 'Error');
        const input = document.getElementById(field);
        if (error) error.classList.add('hidden');
        if (input) {
            input.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
            input.classList.add('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
        }
    });
}

function validateSetupFeesForm() {
    let valid = true;

    const totalFees = document.getElementById('totalFees');
    const installmentAmount = document.getElementById('installmentAmount');
    const paymentDate = document.getElementById('paymentDate');

    // Validate Total Fees
    if (!totalFees.value || parseFloat(totalFees.value) <= 0) {
        document.getElementById('totalFeesError').classList.remove('hidden');
        totalFees.classList.remove('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
        totalFees.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        valid = false;
    } else {
        document.getElementById('totalFeesError').classList.add('hidden');
        totalFees.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        totalFees.classList.add('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
    }

    // Validate Installment Amount
    if (!installmentAmount.value || parseFloat(installmentAmount.value) <= 0) {
        document.getElementById('installmentAmountError').classList.remove('hidden');
        installmentAmount.classList.remove('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
        installmentAmount.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        valid = false;
    } else if (parseFloat(installmentAmount.value) > parseFloat(totalFees.value || 0)) {
        document.getElementById('installmentAmountError').textContent = 'Cannot exceed total fees';
        document.getElementById('installmentAmountError').classList.remove('hidden');
        installmentAmount.classList.remove('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
        installmentAmount.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        valid = false;
    } else {
        document.getElementById('installmentAmountError').classList.add('hidden');
        installmentAmount.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        installmentAmount.classList.add('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
    }

    // Validate Payment Date
    if (!paymentDate.value) {
        document.getElementById('paymentDateError').classList.remove('hidden');
        paymentDate.classList.remove('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
        paymentDate.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        valid = false;
    } else {
        document.getElementById('paymentDateError').classList.add('hidden');
        paymentDate.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        paymentDate.classList.add('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
    }

    return valid;
}

async function submitSetupFees() {
    if (!validateSetupFeesForm()) {
        showToast('error', 'Please fill all required fields correctly');
        return;
    }

    const id = document.getElementById('setupFeesEnquiryId').value;
    const totalFees = parseFloat(document.getElementById('totalFees').value);
    const installmentAmount = parseFloat(document.getElementById('installmentAmount').value);
    const paymentDate = document.getElementById('paymentDate').value;
    const paymentMode = document.getElementById('paymentMode').value;

    try {
        // Step 1: Create Admission using correct endpoint
        const admissionRes = await apiPost(API_ENDPOINTS.ADMISSIONS.CREATE_FROM_ENQUIRY(id), {
            totalFees: totalFees,
            finalStatus: 'JOINED'
        });

        const admissionId = admissionRes.admission?._id || admissionRes._id;

        // Step 2: Create First Payment
        if (admissionId && installmentAmount > 0) {
            await apiPost(API_ENDPOINTS.PAYMENTS.CREATE, {
                admissionId: admissionId,
                amount: installmentAmount,
                paymentDate: paymentDate,
                paymentMode: paymentMode,
                paymentType: 'INSTALLMENT',
                notes: 'First installment payment'
            });
        }

        showToast('success', 'Admission created with payment successfully');
        closeSetupFeesModal();
        loadEnquiryDetail(id);
    } catch (err) {
        showToast('error', 'Failed to create admission');
        // Show error popup
        setTimeout(() => {
            alert('Failed to create admission: ' + (err.message || 'Please try again'));
        }, 100);
    }
}

/* ======================
CONFIRM MODAL
====================== */
function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    const modalContent = document.getElementById('confirmModalContent');
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
    confirmCallback = null;
}

function executeConfirmAction() {
    if (confirmCallback) {
        confirmCallback();
    }
}

/* ======================
EXPORT
====================== */
window.openStatusModal = openStatusModal;
window.closeStatusModal = closeStatusModal;
window.submitStatusUpdate = submitStatusUpdate;
window.openConvertModal = openConvertModal;
window.closeSetupFeesModal = closeSetupFeesModal;
window.submitSetupFees = submitSetupFees;
window.closeConfirmModal = closeConfirmModal;
window.executeConfirmAction = executeConfirmAction;
