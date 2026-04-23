let currentId = null;
let confirmCallback = null;

/* ======================
ROLE CHECK HELPERS
====================== */
function isAdmin() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role === 'admin';
}

function isCounselor() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role === 'counselor' || user.role === 'user';
}

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

    // Setup WhatsApp integration
    setupWhatsAppForEnquiry();
});

/* ======================
LOAD DATA
====================== */
async function loadEnquiryDetail(id) {
    try {
        const res = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_BY_ID(id));
        const enquiry = res.data?.enquiry || res.enquiry;

        if (!enquiry) {
            showToast('error', 'Enquiry not found');
            return;
        }

        renderEnquiry(enquiry);
        renderTimeline(enquiry.timeline || [], enquiry.notes || []);
    } catch {
        showToast('error', 'Failed to load enquiry details');
    }
}

function renderEnquiry(e) {
    // Store enquiry data for WhatsApp
    window.currentEnquiryData = e;

    // Header info
    document.getElementById('detailName').textContent = e.name || '-';
    document.getElementById('detailMobile').textContent = e.mobile || '-';
    document.getElementById('detailCourse').querySelector('span').textContent = e.courseInterested || '-';

    // Status badge
    const statusBadge = document.getElementById('detailStatusBadge');
    statusBadge.innerHTML = getStatusBadge(e.status);

    // Details grid
    document.getElementById('infoEmail').textContent = e.email || '-';

    // Get assigned counselor name from various possible fields
    const counselor = e.assignedTo || e.counselorId || e.counselor;
    const counselorName = typeof counselor === 'string' ? counselor : (counselor?.name || counselor?.fullName || '-');
    document.getElementById('infoAssigned').textContent = counselorName;

    document.getElementById('infoStatus').innerHTML = getStatusBadge(e.status);
    document.getElementById('infoCreated').textContent = formatDate(e.createdAt);
}

function renderTimeline(timeline, notes = []) {
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

    // Status labels mapping
    const statusLabels = {
        'NEW': 'New',
        'CONTACTED': 'Contacted',
        'NO_RESPONSE': 'No Response',
        'FOLLOW_UP': 'Follow Up',
        'INTERESTED': 'Interested',
        'NOT_INTERESTED': 'Not Interested',
        'ADMISSION_PROCESS': 'Admission Process',
        'CONVERTED': 'Converted'
    };

    // Status colors for badges
    const statusColors = {
        'NEW': 'bg-gray-100 text-gray-700 border-gray-200',
        'CONTACTED': 'bg-blue-50 text-blue-700 border-blue-200',
        'NO_RESPONSE': 'bg-red-50 text-red-700 border-red-200',
        'FOLLOW_UP': 'bg-amber-50 text-amber-700 border-amber-200',
        'INTERESTED': 'bg-green-50 text-green-700 border-green-200',
        'NOT_INTERESTED': 'bg-slate-100 text-slate-700 border-slate-200',
        'ADMISSION_PROCESS': 'bg-purple-50 text-purple-700 border-purple-200',
        'CONVERTED': 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };

    // Activity config - simple icons
    const activityConfig = {
        'created': { icon: 'user-plus', color: 'text-blue-600' },
        'status_change': { icon: 'refresh-cw', color: 'text-amber-600' },
        'note': { icon: 'message-square', color: 'text-green-600' },
        'assigned': { icon: 'user-check', color: 'text-purple-600' },
        'follow_up': { icon: 'calendar-clock', color: 'text-cyan-600' }
    };

    // Sort timeline by timestamp descending (most recent first)
    const sortedTimeline = [...timeline].sort((a, b) => {
        const dateA = new Date(a.timestamp || a.createdAt);
        const dateB = new Date(b.timestamp || b.createdAt);
        return dateB - dateA;
    });

    let html = '<div class="space-y-3">';

    sortedTimeline.forEach((item) => {
        const type = item.type || 'note';
        const config = activityConfig[type] || activityConfig['note'];

        const dateObj = new Date(item.timestamp || item.createdAt);
        const dateStr = dateObj.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short'
        });
        const timeStr = dateObj.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        const userName = item.userName || item.user?.name || item.performedBy?.name || 'System';

        // Build content based on activity type
        let bodyContent = '';
        let headerText = '';

        if (type === 'created') {
            headerText = 'Enquiry Created';
            bodyContent = `<p class="text-sm text-gray-600">New enquiry created</p>`;
        } else if (type === 'status_change' && item.metadata) {
            const prevStatus = item.metadata.previousStatus || item.metadata.from;
            const newStatus = item.metadata.newStatus || item.metadata.to;
            const prevLabel = statusLabels[prevStatus] || prevStatus || 'New';
            const newLabel = statusLabels[newStatus] || newStatus || 'Updated';
            const prevColor = statusColors[prevStatus] || 'bg-gray-100 text-gray-700 border-gray-200';
            const newColor = statusColors[newStatus] || 'bg-gray-100 text-gray-700 border-gray-200';

            headerText = 'Status Updated';
            bodyContent = `
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="px-2 py-1 rounded text-xs font-semibold border ${prevColor}">${prevLabel}</span>
                    <i data-lucide="arrow-right" class="w-4 h-4 text-gray-400"></i>
                    <span class="px-2 py-1 rounded text-xs font-semibold border ${newColor}">${newLabel}</span>
                </div>
                ${item.metadata.note ? `<p class="text-sm text-gray-600 mt-2"><span class="text-gray-400">Note:</span> ${item.metadata.note}</p>` : ''}
            `;
        } else if (type === 'note') {
            const noteText = item.metadata?.note || item.message || item.note || 'Note added';
            headerText = 'Note Added';
            bodyContent = `<p class="text-sm text-gray-700">${noteText}</p>`;
        } else if (type === 'assigned') {
            const assignedTo = item.metadata?.assignedToName || item.metadata?.to || item.message || 'Someone';
            headerText = 'Assigned';
            bodyContent = `<p class="text-sm text-gray-600">Assigned to <span class="font-medium text-purple-600">${assignedTo}</span></p>`;
        } else if (type === 'follow_up') {
            const prevDate = item.metadata?.previousDate || item.metadata?.from;
            const newDate = item.metadata?.newDate || item.metadata?.to;
            headerText = 'Follow-up Updated';
            if (prevDate && !newDate) {
                bodyContent = `<p class="text-sm text-gray-600">Follow-up cleared</p>`;
            } else if (!prevDate && newDate) {
                bodyContent = `<p class="text-sm text-gray-600">Follow-up: <span class="font-medium">${formatDate(newDate)}</span></p>`;
            } else {
                bodyContent = `<p class="text-sm text-gray-600">Changed: ${formatDate(prevDate)} → ${formatDate(newDate)}</p>`;
            }
        } else {
            headerText = 'Activity';
            bodyContent = `<p class="text-sm text-gray-700">${item.message || item.note || ''}</p>`;
        }

        // === SIMPLE BLOCK ===
        html += `
            <div class="bg-white rounded-lg border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                <!-- Header: Icon + Type + Time -->
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                        <i data-lucide="${config.icon}" class="w-4 h-4 ${config.color}"></i>
                        <span class="font-medium text-gray-800">${headerText}</span>
                    </div>
                    <span class="text-xs text-gray-400">${dateStr} • ${timeStr}</span>
                </div>

                <!-- Body: Status/Note -->
                <div class="mb-2">
                    ${bodyContent}
                </div>

                <!-- Footer: User -->
                <div class="text-xs text-gray-400">
                    by <span class="text-gray-600">${userName}</span>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
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

    // Show/hide follow-up date based on status
    const followUpDateContainer = document.getElementById('statusFollowUpDate').closest('.relative');
    if (status === 'FOLLOW_UP') {
        followUpDateContainer.classList.remove('hidden');
    } else {
        followUpDateContainer.classList.add('hidden');
    }

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

    // Directly execute status update without confirmation modal
    executeStatusUpdate(currentId, status, note, followUpDate);
}

async function executeStatusUpdate(id, status, note, followUpDate) {
    try {
        await apiPut(API_ENDPOINTS.ENQUIRIES.UPDATE_STATUS(id), {
            status,
            note,
            followUpDate
        });

        showToast('success', 'Status updated successfully');
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

// Step 1: Open Setup Fees Modal directly (skip confirmation)
function openConvertModal(id) {
    console.log('openConvertModal called with id:', id);
    currentId = id;
    pendingConvertData = null;
    // Open Setup Fees modal directly
    openSetupFeesModal(id);
}

// Step 2: Setup Fees Modal
function openSetupFeesModal(id) {
    console.log('Opening setup fees modal for enquiry:', id);

    const enquiryIdField = document.getElementById('setupFeesEnquiryId');
    const totalFeesField = document.getElementById('totalFees');
    const paymentTypeField = document.getElementById('paymentType');
    const initialPaymentField = document.getElementById('initialPayment');
    const initialPaymentDateField = document.getElementById('initialPaymentDate');
    const initialPaymentModeField = document.getElementById('initialPaymentMode');
    const pendingDueDateField = document.getElementById('pendingDueDate');

    if (!enquiryIdField || !totalFeesField) {
        console.error('Required form fields not found');
        showToast('error', 'Form error - please refresh');
        return;
    }

    enquiryIdField.value = id;

    // Reset form
    totalFeesField.value = '';
    if (paymentTypeField) paymentTypeField.value = 'ONE_TIME';
    if (initialPaymentField) initialPaymentField.value = '';
    if (initialPaymentModeField) initialPaymentModeField.value = 'CASH';
    if (initialPaymentDateField) {
        const today = new Date().toISOString().split('T')[0];
        initialPaymentDateField.value = today;
        initialPaymentDateField.min = today;
    }
    if (pendingDueDateField) pendingDueDateField.value = '';

    // Reset installments - remove extra rows, keep only one
    const container = document.getElementById('installmentRows');
    if (container) {
        while (container.children.length > 1) {
            container.removeChild(container.lastChild);
        }
        // Clear the first row values
        const firstRow = container.querySelector('.installment-row');
        if (firstRow) {
            const amountInput = firstRow.querySelector('.installment-amount');
            const dateInput = firstRow.querySelector('.installment-date');
            if (amountInput) amountInput.value = '';
            if (dateInput) {
                dateInput.value = '';
                const today = new Date().toISOString().split('T')[0];
                dateInput.min = today;
            }
        }
    }

    // Reset remaining display
    const remainingDisplay = document.getElementById('remainingAmountDisplay');
    if (remainingDisplay) remainingDisplay.textContent = '₹0';

    // Show/hide sections based on default ONE_TIME
    onPaymentTypeChange();
    clearSetupFeesErrors();

    // Show modal with animation
    const modal = document.getElementById('setupFeesModal');
    const modalContent = document.getElementById('setupFeesModalContent');

    if (!modal || !modalContent) {
        console.error('Modal elements not found');
        showToast('error', 'Modal error - please refresh');
        return;
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
        lucide.createIcons();
    }, 10);

    console.log('Modal opened successfully');
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
    const totalFees = document.getElementById('totalFees');
    const totalFeesError = document.getElementById('totalFeesError');
    if (totalFeesError) totalFeesError.classList.add('hidden');
    if (totalFees) {
        totalFees.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        totalFees.classList.add('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
    }
    // Also clear installments errors
    const instError = document.getElementById('installmentsError');
    if (instError) instError.classList.add('hidden');
    const instTotalError = document.getElementById('installmentsTotalError');
    if (instTotalError) instTotalError.classList.add('hidden');
    // Clear red borders from installment inputs
    document.querySelectorAll('.installment-amount').forEach(input => {
        input.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        input.classList.add('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
    });
}

// Handle Payment Type Change
function onPaymentTypeChange() {
    const paymentType = document.getElementById('paymentType').value;
    const installmentsSection = document.getElementById('installmentsSection');
    const pendingAmountSection = document.getElementById('pendingAmountSection');

    if (paymentType === 'INSTALLMENT') {
        installmentsSection.classList.remove('hidden');
        if (pendingAmountSection) pendingAmountSection.classList.add('hidden');
    } else {
        installmentsSection.classList.add('hidden');
        // For ONE_TIME, show pending amount section if there will be remaining
        updatePendingAmountSection();
    }

    // Recalculate remaining amount
    updateRemainingAmount();
}

// Handle Total Fees Change
function onTotalFeesChange() {
    updateRemainingAmount();
}

// Update Pending Amount Section visibility and value (for ONE_TIME payment)
function updatePendingAmountSection() {
    const paymentType = document.getElementById('paymentType').value;
    const pendingAmountSection = document.getElementById('pendingAmountSection');
    const pendingAmountField = document.getElementById('pendingAmount');
    const initialPayment = parseFloat(document.getElementById('initialPayment')?.value) || 0;
    const totalFees = parseFloat(document.getElementById('totalFees')?.value) || 0;

    if (paymentType === 'ONE_TIME' && pendingAmountSection && pendingAmountField) {
        const remaining = Math.max(0, totalFees - initialPayment);
        pendingAmountField.value = remaining > 0 ? remaining : '';

        if (remaining > 0) {
            pendingAmountSection.classList.remove('hidden');
        } else {
            pendingAmountSection.classList.add('hidden');
        }
    } else if (pendingAmountSection) {
        pendingAmountSection.classList.add('hidden');
    }
}

// Handle Initial Payment Change - Update remaining amount display
function onInitialPaymentChange() {
    updateRemainingAmount();
}

// Calculate and update remaining amount (Total - Initial - Installments)
function updateRemainingAmount() {
    const totalFees = parseFloat(document.getElementById('totalFees')?.value) || 0;
    const initialPayment = parseFloat(document.getElementById('initialPayment')?.value) || 0;

    // Calculate total installments
    const installments = getInstallmentsData();
    const totalInstallments = installments.reduce((sum, inst) => sum + inst.amount, 0);

    // Remaining = Total - Initial - Installments
    const remaining = Math.max(0, totalFees - initialPayment - totalInstallments);

    // Update remaining display
    const remainingDisplay = document.getElementById('remainingAmountDisplay');
    if (remainingDisplay) {
        remainingDisplay.textContent = '₹' + remaining.toLocaleString('en-IN');
    }

    // Update pending amount section for ONE_TIME payments
    updatePendingAmountSection();

    // Validate that total doesn't exceed
    validateTotalAmount();
}

// Add Installment Row
function addInstallmentRow() {
    const container = document.getElementById('installmentRows');
    const row = document.createElement('div');

    // Get the last installment date and set min to next day
    const rows = container.querySelectorAll('.installment-row');
    let minDate = new Date().toISOString().split('T')[0];

    if (rows.length > 0) {
        const lastRow = rows[rows.length - 1];
        const lastDateInput = lastRow.querySelector('.installment-date');
        if (lastDateInput && lastDateInput.value) {
            const lastDate = new Date(lastDateInput.value);
            lastDate.setDate(lastDate.getDate() + 1); // Next day after last installment
            minDate = lastDate.toISOString().split('T')[0];
        }
    }

    row.className = 'installment-row grid grid-cols-[1fr_1fr_auto] gap-2 p-2 bg-gray-50 rounded-lg items-center';
    row.innerHTML = `
        <div class="relative">
            <input type="number" class="installment-amount w-full px-3 py-2 h-[40px] rounded-lg border-2 border-gray-200 text-gray-800 text-sm focus:outline-none focus:border-purple-500"
                placeholder="Amount" min="0" step="0.01" oninput="onInstallmentAmountChange()">
        </div>
        <div class="relative">
            <input type="date" class="installment-date w-full px-3 py-2 h-[40px] rounded-lg border-2 border-gray-200 text-gray-800 text-sm focus:outline-none focus:border-purple-500"
                min="${minDate}" onchange="onInstallmentDateChange(this)">
        </div>
        <button type="button" onclick="removeInstallmentRow(this)" class="text-red-500 hover:text-red-700 px-2 h-[40px] flex items-center justify-center">
            <i data-lucide="x" class="w-4 h-4"></i>
        </button>
    `;
    container.appendChild(row);
    lucide.createIcons();
    updateRemainingAmount();
}

// Handle date change - update subsequent rows' min dates
function onInstallmentDateChange(changedInput) {
    const container = document.getElementById('installmentRows');
    const rows = Array.from(container.querySelectorAll('.installment-row'));
    const changedRowIndex = rows.findIndex(row => row.contains(changedInput));

    // Update all subsequent rows
    for (let i = changedRowIndex + 1; i < rows.length; i++) {
        const prevRow = rows[i - 1];
        const currentRow = rows[i];
        const prevDateInput = prevRow.querySelector('.installment-date');
        const currentDateInput = currentRow.querySelector('.installment-date');

        if (prevDateInput && prevDateInput.value && currentDateInput) {
            const prevDate = new Date(prevDateInput.value);
            prevDate.setDate(prevDate.getDate() + 1);
            const newMinDate = prevDate.toISOString().split('T')[0];
            currentDateInput.min = newMinDate;

            // If current value is before new min, clear it
            if (currentDateInput.value && currentDateInput.value < newMinDate) {
                currentDateInput.value = '';
            }
        }
    }
}

// Remove Installment Row
function removeInstallmentRow(btn) {
    const row = btn.closest('.installment-row');
    const container = document.getElementById('installmentRows');
    if (container.children.length > 1) {
        row.remove();
        updateRemainingAmount();
        onInstallmentAmountChange();
    }
}

// Get Installments Data
function getInstallmentsData() {
    const rows = document.querySelectorAll('.installment-row');
    const installments = [];
    rows.forEach(row => {
        const amount = row.querySelector('.installment-amount').value;
        const date = row.querySelector('.installment-date').value;
        if (amount && date) {
            installments.push({ amount: parseFloat(amount), dueDate: date });
        }
    });
    return installments;
}

// Handle installment amount change - validate total not exceeded
function onInstallmentAmountChange() {
    updateRemainingAmount();
}

// Validate that total amount (initial + installments) doesn't exceed total fees
function validateTotalAmount() {
    const totalFees = parseFloat(document.getElementById('totalFees')?.value) || 0;
    const initialPayment = parseFloat(document.getElementById('initialPayment')?.value) || 0;
    const installments = getInstallmentsData();
    const totalInstallments = installments.reduce((sum, inst) => sum + inst.amount, 0);
    const totalEntered = initialPayment + totalInstallments;

    const totalMismatchError = document.getElementById('installmentsTotalError');
    const totalFeesField = document.getElementById('totalFees');
    const initialPaymentField = document.getElementById('initialPayment');
    const allInstallmentInputs = document.querySelectorAll('.installment-amount');

    if (totalEntered > totalFees) {
        const excess = totalEntered - totalFees;
        const errorMsg = `Total amount exceeds fees by ₹${excess.toLocaleString('en-IN')}`;
        if (totalMismatchError) {
            totalMismatchError.textContent = errorMsg;
            totalMismatchError.classList.remove('hidden');
        }
        // Add red borders
        if (totalFeesField) {
            totalFeesField.classList.remove('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
            totalFeesField.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        }
        if (initialPaymentField) {
            initialPaymentField.classList.remove('border-blue-200', 'focus:border-blue-500');
            initialPaymentField.classList.add('border-red-500', 'focus:border-red-500');
        }
        allInstallmentInputs.forEach(input => {
            input.classList.remove('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
            input.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        });
        return false;
    } else {
        // Clear errors
        if (totalMismatchError) totalMismatchError.classList.add('hidden');
        if (totalFeesField) {
            totalFeesField.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
            totalFeesField.classList.add('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
        }
        if (initialPaymentField) {
            initialPaymentField.classList.remove('border-red-500', 'focus:border-red-500');
            initialPaymentField.classList.add('border-blue-200', 'focus:border-blue-500');
        }
        allInstallmentInputs.forEach(input => {
            input.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
            input.classList.add('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
        });
        return true;
    }
}

function validateSetupFeesForm() {
    let valid = true;

    const totalFees = document.getElementById('totalFees');
    const paymentType = document.getElementById('paymentType').value;
    const initialPaymentField = document.getElementById('initialPayment');
    const initialPaymentDateField = document.getElementById('initialPaymentDate');
    const initialPaymentModeField = document.getElementById('initialPaymentMode');
    const initialPayment = parseFloat(initialPaymentField?.value) || 0;

    // Validate Total Fees (always required)
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

    // Validate Initial Payment (always required now)
    if (initialPaymentField && (!initialPaymentField.value || initialPayment < 0)) {
        document.getElementById('initialPaymentError')?.classList.remove('hidden');
        document.getElementById('initialPaymentError').textContent = 'Initial payment is required';
        initialPaymentField.classList.remove('border-blue-200', 'focus:border-blue-500');
        initialPaymentField.classList.add('border-red-500', 'focus:border-red-500');
        valid = false;
    } else if (initialPayment > parseFloat(totalFees.value || 0)) {
        document.getElementById('initialPaymentError')?.classList.remove('hidden');
        document.getElementById('initialPaymentError').textContent = 'Cannot exceed total fees';
        initialPaymentField.classList.remove('border-blue-200', 'focus:border-blue-500');
        initialPaymentField.classList.add('border-red-500', 'focus:border-red-500');
        valid = false;
    } else {
        document.getElementById('initialPaymentError')?.classList.add('hidden');
        if (initialPaymentField) {
            initialPaymentField.classList.remove('border-red-500', 'focus:border-red-500');
            initialPaymentField.classList.add('border-blue-200', 'focus:border-blue-500');
        }
    }

    // Validate Initial Payment Date (required)
    if (initialPaymentDateField && !initialPaymentDateField.value) {
        initialPaymentDateField.classList.add('border-red-500', 'focus:border-red-500');
        valid = false;
    } else if (initialPaymentDateField) {
        initialPaymentDateField.classList.remove('border-red-500', 'focus:border-red-500');
    }

    // Validate Initial Payment Mode (required)
    if (initialPaymentModeField && !initialPaymentModeField.value) {
        initialPaymentModeField.classList.add('border-red-500', 'focus:border-red-500');
        valid = false;
    } else if (initialPaymentModeField) {
        initialPaymentModeField.classList.remove('border-red-500', 'focus:border-red-500');
    }

    // Validate that total entered amount doesn't exceed total fees
    if (!validateTotalAmount()) {
        valid = false;
    }

    if (paymentType === 'INSTALLMENT') {
        // For INSTALLMENT, validate installments exist
        const installments = getInstallmentsData();
        if (installments.length === 0) {
            document.getElementById('installmentsError').classList.remove('hidden');
            valid = false;
        } else {
            document.getElementById('installmentsError').classList.add('hidden');
        }
    }

    return valid;
}

async function submitSetupFees() {
    if (!validateSetupFeesForm()) {
        showToast('error', 'Please fill all required fields correctly');
        return;
    }

    // Get submit button and show loading state
    const submitBtn = document.getElementById('setupFeesSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Creating...';
        lucide.createIcons();
    }

    const id = document.getElementById('setupFeesEnquiryId').value;
    const totalFees = parseFloat(document.getElementById('totalFees').value);
    const paymentType = document.getElementById('paymentType').value;

    // Get initial payment details (always required now)
    const initialPaymentField = document.getElementById('initialPayment');
    const initialPaymentModeField = document.getElementById('initialPaymentMode');
    const initialPayment = initialPaymentField ? parseFloat(initialPaymentField.value) || 0 : 0;
    const initialPaymentMode = initialPaymentModeField?.value || 'CASH';

    try {
        // Build request payload - match API contract
        const payload = {
            totalFees: totalFees,
            paymentType: paymentType,
            registrationAmount: initialPayment,
            paymentMethod: initialPaymentMode
        };

        // For INSTALLMENT, add installments array
        if (paymentType === 'INSTALLMENT') {
            payload.installments = getInstallmentsData();
        }
        // Note: ONE_TIME payments don't send remaining amount - backend handles this

        // DEBUG: Log exact payload being sent
        console.log('Sending payload:', JSON.stringify(payload, null, 2));

        // Create Admission with payment plan in one call
        const admissionRes = await apiPost(API_ENDPOINTS.ADMISSIONS.CREATE_FROM_ENQUIRY(id), payload);

        // Handle response: { success: true, data: { admission: {...} } }
        const admission = admissionRes.data?.admission || admissionRes.admission || admissionRes;
        const admissionId = admission?._id;

        if (!admissionId) {
            throw new Error('Failed to create admission');
        }

        showToast('success', 'Admission created successfully');
        closeSetupFeesModal();
        loadEnquiryDetail(id);
    } catch (err) {
        // Extract specific error message from backend response
        const backendMessage = err.response?.data?.message || err.message || 'Please try again';
        const backendErrors = err.response?.data?.errors;
        let errorMsg = backendMessage;
        if (backendErrors && backendErrors.length > 0) {
            errorMsg = backendErrors.map(e => e.message).join(', ');
        }
        console.error('Error:', err);

        // Close setup modal and show error in centered popup
        closeSetupFeesModal();
        setTimeout(() => {
            showErrorModal(errorMsg);
        }, 300);
    } finally {
        // Reset button state
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Create Admission';
            lucide.createIcons();
        }
    }
}

// Error Modal - centered popup for errors
function showErrorModal(message) {
    const modal = document.getElementById('errorModal');
    const modalContent = document.getElementById('errorModalContent');
    const errorText = document.getElementById('errorModalText');

    if (errorText) errorText.textContent = message;

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
}

function closeErrorModal() {
    const modal = document.getElementById('errorModal');
    const modalContent = document.getElementById('errorModalContent');
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
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
WHATSAPP INTEGRATION
====================== */
// Get logged-in user name from localStorage
function getLoggedInUserName() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.name || user.fullName || user.userName || 'Counselor';
}

const ENQUIRY_WHATSAPP_TEMPLATES = {
    enquiry: (name, course, counselorName) => `Hi ${name},

This is ${counselorName} from SSSAM Academy Gurgaon.

We noticed your enquiry about ${course}. I'd be happy to answer any questions you may have.

Please let me know a convenient time to connect.

Best regards,
${counselorName}
SSSAM Academy`,

    followup: (name, course, counselorName) => `Hi ${name},

This is ${counselorName} from SSSAM Academy Gurgaon.

I'm following up on your enquiry for ${course}. Have you had a chance to think about it?

Please let me know if you have any questions or if you'd like to visit our center.

Best regards,
${counselorName}
SSSAM Academy`,

    interested: (name, course, counselorName) => `Hi ${name},

This is ${counselorName} from SSSAM Academy Gurgaon.

I'm glad you're interested in ${course}! I can help you with the admission process.

Would you like to schedule a visit to our center or discuss the course details?

Best regards,
${counselorName}
SSSAM Academy`,

    notinterested: (name, course, counselorName) => `Hi ${name},

This is ${counselorName} from SSSAM Academy Gurgaon.

Thank you for your interest in ${course}. If your plans change in the future, please don't hesitate to reach out.

Wishing you all the best!

Best regards,
${counselorName}
SSSAM Academy`,

    custom: (name, counselorName) => `Hi ${name},

This is ${counselorName} from SSSAM Academy Gurgaon.

[Your message here]

Best regards,
${counselorName}
SSSAM Academy`
};

function setupWhatsAppForEnquiry() {
    const btn = document.getElementById('whatsappBtn');
    const menu = document.getElementById('whatsappMenu');
    const templateSelect = document.getElementById('whatsappTemplate');
    const sendBtn = document.getElementById('sendWhatsappBtn');

    if (!btn || !menu) {
        console.log('WhatsApp elements not found');
        return;
    }

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        menu.classList.toggle('hidden');
        if (!menu.classList.contains('hidden')) {
            generateEnquiryWhatsAppMessage();
        }
    });

    menu.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !btn.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });

    templateSelect?.addEventListener('change', generateEnquiryWhatsAppMessage);
    sendBtn?.addEventListener('click', openEnquiryWhatsApp);
}

function generateEnquiryWhatsAppMessage() {
    const templateSelect = document.getElementById('whatsappTemplate');
    const textarea = document.getElementById('whatsappMessage');
    const mobileDisplay = document.getElementById('whatsappMobileDisplay');
    const enquiry = window.currentEnquiryData;

    if (!enquiry || !templateSelect || !textarea) return;

    const counselorName = getLoggedInUserName();
    const name = enquiry.name || 'Student';
    const mobile = enquiry.mobile || '-';
    const course = enquiry.courseInterested || 'Course';

    // Show mobile number in menu header
    if (mobileDisplay) {
        mobileDisplay.textContent = mobile !== '-' ? `📞 ${mobile}` : '';
    }

    const template = templateSelect.value;
    let message = '';

    switch (template) {
        case 'enquiry':
            message = ENQUIRY_WHATSAPP_TEMPLATES.enquiry(name, course, counselorName);
            break;
        case 'followup':
            message = ENQUIRY_WHATSAPP_TEMPLATES.followup(name, course, counselorName);
            break;
        case 'interested':
            message = ENQUIRY_WHATSAPP_TEMPLATES.interested(name, course, counselorName);
            break;
        case 'notinterested':
            message = ENQUIRY_WHATSAPP_TEMPLATES.notinterested(name, course, counselorName);
            break;
        case 'custom':
            message = ENQUIRY_WHATSAPP_TEMPLATES.custom(name, counselorName);
            break;
    }

    textarea.value = message;
}

function openEnquiryWhatsApp() {
    const textarea = document.getElementById('whatsappMessage');
    const mobileSpan = document.getElementById('detailMobile');

    if (!textarea || !mobileSpan) return;

    const message = textarea.value.trim();
    const mobile = mobileSpan.textContent.trim().replace(/\D/g, '');

    if (!mobile || mobile === '-') {
        showToast('error', 'No mobile number');
        return;
    }

    if (!message) {
        showToast('error', 'Please enter message');
        return;
    }

    const formattedMobile = mobile.startsWith('91') ? mobile : '91' + mobile;
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${formattedMobile}?text=${encodedMessage}`;

    window.open(url, '_blank');
    document.getElementById('whatsappMenu')?.classList.add('hidden');
    showToast('success', 'WhatsApp opened');
}

/* ======================
EXPORT
====================== */
window.isAdmin = isAdmin;
window.isCounselor = isCounselor;
window.openStatusModal = openStatusModal;
window.closeStatusModal = closeStatusModal;
window.submitStatusUpdate = submitStatusUpdate;
window.openConvertModal = openConvertModal;
window.closeSetupFeesModal = closeSetupFeesModal;
window.submitSetupFees = submitSetupFees;
window.onPaymentTypeChange = onPaymentTypeChange;
window.onTotalFeesChange = onTotalFeesChange;
window.onInitialPaymentChange = onInitialPaymentChange;
window.onInstallmentAmountChange = onInstallmentAmountChange;
window.addInstallmentRow = addInstallmentRow;
window.removeInstallmentRow = removeInstallmentRow;
window.onInstallmentDateChange = onInstallmentDateChange;
window.updateRemainingAmount = updateRemainingAmount;
window.updatePendingAmountSection = updatePendingAmountSection;
window.validateTotalAmount = validateTotalAmount;
window.closeConfirmModal = closeConfirmModal;
window.executeConfirmAction = executeConfirmAction;
window.showErrorModal = showErrorModal;
window.closeErrorModal = closeErrorModal;
