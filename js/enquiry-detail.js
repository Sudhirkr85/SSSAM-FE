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
    // Check role and hide timeline for non-admin users
    const timelineSection = document.getElementById('timelineSection');
    if (timelineSection && !isAdmin()) {
        timelineSection.classList.add('hidden');
    }

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

    // Create a map of notes by timestamp for quick lookup
    const notesByTimestamp = {};
    notes.forEach(note => {
        const key = new Date(note.createdAt).getTime();
        notesByTimestamp[key] = note.text;
    });

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

    // Activity type configuration with icons and colors
    const activityConfig = {
        'created': {
            icon: 'user-plus',
            iconBg: 'bg-blue-500',
            iconColor: 'text-white',
            cardBorder: 'border-l-4 border-blue-500',
            bgColor: 'bg-white',
            label: 'Enquiry Created',
            labelColor: 'text-blue-600'
        },
        'status_change': {
            icon: 'refresh-cw',
            iconBg: 'bg-amber-500',
            iconColor: 'text-white',
            cardBorder: 'border-l-4 border-amber-500',
            bgColor: 'bg-white',
            label: 'Status Updated',
            labelColor: 'text-amber-600'
        },
        'note': {
            icon: 'message-square',
            iconBg: 'bg-green-500',
            iconColor: 'text-white',
            cardBorder: 'border-l-4 border-green-500',
            bgColor: 'bg-white',
            label: 'Note Added',
            labelColor: 'text-green-600'
        },
        'assigned': {
            icon: 'user-check',
            iconBg: 'bg-purple-500',
            iconColor: 'text-white',
            cardBorder: 'border-l-4 border-purple-500',
            bgColor: 'bg-white',
            label: 'Assigned',
            labelColor: 'text-purple-600'
        },
        'follow_up': {
            icon: 'calendar-clock',
            iconBg: 'bg-cyan-500',
            iconColor: 'text-white',
            cardBorder: 'border-l-4 border-cyan-500',
            bgColor: 'bg-white',
            label: 'Follow-up Updated',
            labelColor: 'text-cyan-600'
        }
    };

    // Sort timeline by timestamp descending (most recent first)
    const sortedTimeline = [...timeline].sort((a, b) => {
        const dateA = new Date(a.timestamp || a.createdAt);
        const dateB = new Date(b.timestamp || b.createdAt);
        return dateB - dateA;
    });

    // Group by date
    const groupedByDate = {};
    sortedTimeline.forEach(item => {
        const dateObj = new Date(item.timestamp || item.createdAt);
        const dateKey = dateObj.toDateString();
        if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push(item);
    });

    let html = '';

    Object.entries(groupedByDate).forEach(([dateKey, items]) => {
        const dateObj = new Date(dateKey);
        const today = new Date();
        const isToday = dateObj.toDateString() === today.toDateString();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = dateObj.toDateString() === yesterday.toDateString();

        const dateLabel = isToday ? 'Today' : isYesterday ? 'Yesterday' : dateObj.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });

        html += `
            <div class="mb-4">
                <!-- Date Header -->
                <div class="flex items-center gap-3 mb-3">
                    <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-100 px-3 py-1 rounded-full">
                        ${dateLabel}
                    </span>
                    <div class="flex-1 h-px bg-gray-200"></div>
                </div>

                <!-- Activity Cards -->
                <div class="space-y-3">
        `;

        items.forEach((item) => {
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

            const userName = item.userName || 'System';
            const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

            // Build card content based on type
            let cardContent = '';

            if (type === 'created') {
                cardContent = `
                    <p class="text-sm text-gray-600">
                        New enquiry created by <span class="font-medium text-gray-800">${userName}</span>
                    </p>
                `;
            } else if (type === 'status_change' && item.metadata) {
                const prevStatus = item.metadata.previousStatus || item.metadata.from;
                const newStatus = item.metadata.newStatus || item.metadata.to;
                const prevLabel = statusLabels[prevStatus] || prevStatus || 'New';
                const newLabel = statusLabels[newStatus] || newStatus || 'Updated';
                const prevColor = statusColors[prevStatus] || 'bg-gray-100 text-gray-700 border-gray-200';
                const newColor = statusColors[newStatus] || 'bg-gray-100 text-gray-700 border-gray-200';

                cardContent = `
                    <div class="flex flex-col gap-2">
                        <div class="flex items-center gap-3 flex-wrap">
                            <span class="px-3 py-1 rounded-lg text-xs font-semibold border ${prevColor}">
                                ${prevLabel}
                            </span>
                            <div class="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
                                <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-gray-500"></i>
                            </div>
                            <span class="px-3 py-1 rounded-lg text-xs font-semibold border ${newColor}">
                                ${newLabel}
                            </span>
                        </div>
                        ${item.metadata.note ? `
                            <div class="bg-gray-50 rounded-lg p-2.5 mt-1">
                                <p class="text-xs text-gray-500 mb-1">Note:</p>
                                <p class="text-sm text-gray-700">${item.metadata.note}</p>
                            </div>
                        ` : ''}
                    </div>
                `;
            } else if (type === 'note') {
                const itemTime = new Date(item.timestamp || item.createdAt).getTime();
                const noteText = notesByTimestamp[itemTime] || item.message || item.note || 'Note added';
                cardContent = `
                    <div class="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p class="text-sm text-gray-700 leading-relaxed">${noteText}</p>
                    </div>
                `;
            } else if (type === 'assigned') {
                const assignedTo = item.metadata?.assignedToName || item.metadata?.to || item.message || 'Someone';
                cardContent = `
                    <p class="text-sm text-gray-600">
                        Assigned to <span class="font-semibold text-purple-600">${assignedTo}</span>
                    </p>
                `;
            } else if (type === 'follow_up') {
                const prevDate = item.metadata?.previousDate || item.metadata?.from;
                const newDate = item.metadata?.newDate || item.metadata?.to;

                if (prevDate && !newDate) {
                    cardContent = `
                        <p class="text-sm text-gray-600">
                            Follow-up date <span class="font-medium text-gray-800">${formatDate(prevDate)}</span> cleared
                        </p>
                    `;
                } else if (!prevDate && newDate) {
                    cardContent = `
                        <p class="text-sm text-gray-600">
                            Follow-up scheduled for <span class="font-semibold text-cyan-600">${formatDate(newDate)}</span>
                        </p>
                    `;
                } else {
                    cardContent = `
                        <div class="flex flex-col gap-1">
                            <p class="text-sm text-gray-600">Follow-up date changed:</p>
                            <div class="flex items-center gap-2">
                                <span class="text-sm text-gray-500 line-through">${formatDate(prevDate)}</span>
                                <i data-lucide="arrow-right" class="w-3 h-3 text-gray-400"></i>
                                <span class="text-sm font-medium text-cyan-600">${formatDate(newDate)}</span>
                            </div>
                        </div>
                    `;
                }
            } else if (item.message) {
                cardContent = `
                    <div class="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p class="text-sm text-gray-700 leading-relaxed">${item.message}</p>
                    </div>
                `;
            }

            html += `
                <!-- Activity Card -->
                <div class="${config.bgColor} rounded-xl shadow-sm border border-gray-100 ${config.cardBorder} p-4 hover:shadow-md transition-shadow">
                    <div class="flex gap-3">
                        <!-- Icon -->
                        <div class="flex-shrink-0">
                            <div class="w-10 h-10 ${config.iconBg} rounded-xl flex items-center justify-center shadow-sm">
                                <i data-lucide="${config.icon}" class="w-5 h-5 ${config.iconColor}"></i>
                            </div>
                        </div>

                        <!-- Content -->
                        <div class="flex-1 min-w-0">
                            <!-- Header -->
                            <div class="flex items-start justify-between gap-2 mb-2">
                                <div>
                                    <span class="text-xs font-semibold ${config.labelColor} uppercase tracking-wider">
                                        ${config.label}
                                    </span>
                                </div>
                                <span class="text-xs text-gray-400 font-medium whitespace-nowrap flex items-center gap-1">
                                    <i data-lucide="calendar" class="w-3 h-3"></i>
                                    ${dateStr}, ${timeStr}
                                </span>
                            </div>

                            <!-- Body -->
                            ${cardContent}

                            <!-- Footer - User -->
                            <div class="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                                <div class="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold">
                                    ${userInitials}
                                </div>
                                <span class="text-xs text-gray-500">by <span class="font-medium text-gray-700">${userName}</span></span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
    });

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
    const paymentDateField = document.getElementById('paymentDate');
    const paymentModeField = document.getElementById('paymentMode');
    const paymentTypeField = document.getElementById('paymentType');

    if (!enquiryIdField || !totalFeesField) {
        console.error('Required form fields not found');
        showToast('error', 'Form error - please refresh');
        return;
    }

    enquiryIdField.value = id;

    // Reset form
    totalFeesField.value = '';
    if (paymentDateField) paymentDateField.value = '';
    if (paymentModeField) paymentModeField.value = 'CASH';
    if (paymentTypeField) paymentTypeField.value = 'ONE_TIME';

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
            if (dateInput) dateInput.value = '';
        }
    }

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

    if (paymentType === 'INSTALLMENT') {
        installmentsSection.classList.remove('hidden');
    } else {
        installmentsSection.classList.add('hidden');
    }
}

// Add Installment Row
function addInstallmentRow() {
    const container = document.getElementById('installmentRows');
    const row = document.createElement('div');
    row.className = 'installment-row grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl';
    row.innerHTML = `
        <div class="relative">
            <input type="number" class="installment-amount w-full px-3 py-2 rounded-lg border-2 border-gray-200 text-gray-800 text-sm focus:outline-none focus:border-purple-500"
                placeholder="Amount" min="0" step="0.01" required oninput="onInstallmentAmountChange()">
        </div>
        <div class="relative flex gap-2">
            <input type="date" class="installment-date w-full px-3 py-2 rounded-lg border-2 border-gray-200 text-gray-800 text-sm focus:outline-none focus:border-purple-500"
                required>
            <button type="button" onclick="removeInstallmentRow(this)" class="text-red-500 hover:text-red-700 px-2">
                <i data-lucide="x" class="w-4 h-4"></i>
            </button>
        </div>
    `;
    container.appendChild(row);
    lucide.createIcons();
}

// Remove Installment Row
function removeInstallmentRow(btn) {
    const row = btn.closest('.installment-row');
    const container = document.getElementById('installmentRows');
    if (container.children.length > 1) {
        row.remove();
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

// Handle installment amount change - re-validate totals
function onInstallmentAmountChange() {
    const paymentType = document.getElementById('paymentType').value;
    if (paymentType !== 'INSTALLMENT') return;

    const totalFees = document.getElementById('totalFees');
    const installments = getInstallmentsData();
    const totalInstallments = installments.reduce((sum, inst) => sum + inst.amount, 0);
    const feeValue = parseFloat(totalFees.value) || 0;
    const totalMismatchError = document.getElementById('installmentsTotalError');
    const allInstallmentInputs = document.querySelectorAll('.installment-amount');

    if (Math.abs(totalInstallments - feeValue) < 0.01 && totalMismatchError) {
        // Totals match - clear errors
        totalMismatchError.classList.add('hidden');
        totalFees.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        totalFees.classList.add('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
        allInstallmentInputs.forEach(input => {
            input.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
            input.classList.add('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
        });
    }
}

function validateSetupFeesForm() {
    let valid = true;

    const totalFees = document.getElementById('totalFees');
    const paymentType = document.getElementById('paymentType').value;

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

    if (paymentType === 'INSTALLMENT') {
        // For INSTALLMENT, validate installments
        const installments = getInstallmentsData();
        if (installments.length === 0) {
            document.getElementById('installmentsError').classList.remove('hidden');
            valid = false;
        } else {
            document.getElementById('installmentsError').classList.add('hidden');
        }

        // Check if total installments equals total fees
        const totalInstallments = installments.reduce((sum, inst) => sum + inst.amount, 0);
        const totalMismatchError = document.getElementById('installmentsTotalError');
        const feeValue = parseFloat(totalFees.value);
        const allInstallmentInputs = document.querySelectorAll('.installment-amount');

        if (Math.abs(totalInstallments - feeValue) > 0.01) {
            const errorMsg = `Installments total must equal total fees (₹${feeValue})`;
            if (totalMismatchError) {
                totalMismatchError.textContent = errorMsg;
                totalMismatchError.classList.remove('hidden');
            }
            // Add red border to total fees field
            totalFees.classList.remove('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
            totalFees.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
            // Add red border to all installment amount inputs
            allInstallmentInputs.forEach(input => {
                input.classList.remove('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
                input.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
            });
            showToast('error', errorMsg);
            valid = false;
        } else {
            if (totalMismatchError) totalMismatchError.classList.add('hidden');
            // Clear red borders
            totalFees.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
            totalFees.classList.add('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
            allInstallmentInputs.forEach(input => {
                input.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
                input.classList.add('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
            });
        }
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
    const paymentType = document.getElementById('paymentType').value;

    // Get payment mode (required for ONE_TIME)
    const paymentMode = document.getElementById('paymentMode')?.value || 'CASH';

    try {
        // Build request payload based on payment type
        const payload = {
            totalFees: totalFees,
            paymentType: paymentType
        };

        // For INSTALLMENT, add installments array
        if (paymentType === 'INSTALLMENT') {
            payload.installments = getInstallmentsData();
        } else {
            // ONE_TIME: add paymentMethod (required by backend API)
            payload.paymentMethod = paymentMode;
        }

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
const ENQUIRY_WHATSAPP_TEMPLATES = {
    enquiry: (name, course, counselorName) => `Hi ${name}, ${counselorName} from SSSAM Academy. You enquired about ${course}. Can I help?`,
    followup: (name, course, counselorName) => `Hi ${name}, ${counselorName} from SSSAM Academy. Following up on ${course}. Any questions?`,
    interested: (name, course, counselorName) => `Hi ${name}, ${counselorName} from SSSAM Academy. Glad you're interested in ${course}! Next steps?`,
    notinterested: (name, course, counselorName) => `Hi ${name}, ${counselorName} from SSSAM Academy. Thanks for considering ${course}. Let us know if things change!`,
    custom: (name, counselorName) => `Hi ${name}, ${counselorName} from SSSAM Academy. `
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

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const counselorName = user.name?.split(' ')[0] || 'Counselor';
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
window.onInstallmentAmountChange = onInstallmentAmountChange;
window.addInstallmentRow = addInstallmentRow;
window.removeInstallmentRow = removeInstallmentRow;
window.closeConfirmModal = closeConfirmModal;
window.executeConfirmAction = executeConfirmAction;
window.showErrorModal = showErrorModal;
window.closeErrorModal = closeErrorModal;
