let currentId = null;
let confirmCallback = null;
let selectedStatus = null;
let currentEnquiryData = null;

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

// Status labels - exact mapping as per requirements
const statusLabels = {
    'NEW': { text: 'New Lead', color: 'blue' },
    'CONTACTED': { text: 'Contacted', color: 'blue' },
    'NO_RESPONSE': { text: 'Call Not Picked', color: 'gray' },
    'FOLLOW_UP': { text: 'Call Back', color: 'amber' },
    'INTERESTED': { text: 'Interested', color: 'green' },
    'NOT_INTERESTED': { text: 'Not Interested', color: 'red' },
    'ADMISSION_PROCESS': { text: 'Admission In Progress', color: 'purple' },
    'CONVERTED': { text: 'Admission Done', color: 'green' }
};

// Source mapping for human readable display
const sourceMap = {
    'website': 'Website',
    'facebook': 'Facebook',
    'instagram': 'Instagram',
    'google': 'Google Ads',
    'referral': 'Referral',
    'walk_in': 'Walk-in',
    'other': 'Other'
};

/* ======================
INIT
====================== */
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Loaded - Enquiry Detail Page');
    console.log('Current URL:', window.location.href);
    console.log('URL Search:', window.location.search);

    // Get enquiry ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentId = urlParams.get('id');
    console.log('Extracted ID from URL:', currentId);

    if (currentId) {
        console.log('Calling loadEnquiryDetail with ID:', currentId);
        loadEnquiryDetail(currentId);
    } else {
        console.error('No enquiry ID in URL');
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
    console.log('Loading enquiry detail for ID:', id);
    try {
        const res = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_BY_ID(id));
        console.log('API Response:', res);

        // API returns { success, message, data: { enquiry: {...} } }
        const enquiry = res.data?.enquiry;
        console.log('Extracted enquiry:', enquiry);

        if (!enquiry) {
            console.error('Enquiry not found in response');
            showToast('error', 'Enquiry not found');
            return;
        }

        renderEnquiry(enquiry);
        renderTimeline(enquiry.statusHistory || []);
    } catch (error) {
        console.error('Error loading enquiry details:', error);
        showToast('error', 'Failed to load enquiry details');
    }
}

function renderEnquiry(e) {
    // Store enquiry data for WhatsApp
    window.currentEnquiryData = e;

    // ===== BASIC DETAILS (Always Visible) =====
    
    // Header info
    document.getElementById('detailName').textContent = e.name || '-';
    document.getElementById('detailMobile').querySelector('span').textContent = e.mobile || '-';
    document.getElementById('detailCourse').querySelector('span').textContent = e.courseInterested || '-';

    // Status badge - styled
    const statusBadge = document.getElementById('detailStatusBadge');
    const statusInfo = statusLabels[e.status] || { text: e.status || 'New Lead', color: 'gray' };
    const colorClass = {
        'blue': 'bg-blue-100 text-blue-800',
        'green': 'bg-green-100 text-green-800',
        'amber': 'bg-amber-100 text-amber-800',
        'red': 'bg-red-100 text-red-800',
        'purple': 'bg-purple-100 text-purple-800',
        'gray': 'bg-gray-100 text-gray-800'
    }[statusInfo.color] || 'bg-gray-100 text-gray-800';
    statusBadge.innerHTML = `<span class="px-2 py-1 rounded-full text-xs font-semibold ${colorClass}">${statusInfo.text}</span>`;

    // Assigned To - handle null or isUnassigned
    const assignedTo = (e.assignedTo === null || e.isUnassigned === true)
        ? 'Unassigned'
        : (typeof e.assignedTo === 'string' ? e.assignedTo : e.assignedTo?.name || 'Unassigned');
    document.getElementById('infoAssigned').textContent = assignedTo;

    // Follow-up Date - handle null
    document.getElementById('infoFollowUpDate').textContent = e.followUpDate
        ? formatDateTime(e.followUpDate)
        : 'Not Scheduled';

    // ===== MORE DETAILS (Collapsible) =====
    
    // Email - handle empty
    document.getElementById('infoEmail').textContent = e.email && e.email.trim() !== '' ? e.email : 'Not Provided';
    
    // Source - human readable
    document.getElementById('infoSource').textContent = sourceMap[e.source] || e.source || '-';
    
    // Reference Info - show section only if data exists
    const referralSection = document.getElementById('referralSection');
    if (e.referenceName || e.referenceContact) {
        referralSection.classList.remove('hidden');
        document.getElementById('infoRefName').textContent = e.referenceName || '-';
        document.getElementById('infoRefContact').textContent = e.referenceContact || '-';
    } else {
        referralSection.classList.add('hidden');
    }
    
    // Created By
    document.getElementById('infoCreatedBy').textContent = e.createdBy?.name || '-';
    
    // Created Date - formatted
    document.getElementById('infoCreated').textContent = formatDateTime(e.createdAt);

    // Conditional: Show Convert to Admission button if status is INTERESTED
    const convertBtn = document.getElementById('convertToAdmissionBtn');
    if (e.status === 'INTERESTED') {
        convertBtn.classList.remove('hidden');
    } else {
        convertBtn.classList.add('hidden');
    }

    // Conditional: Show Delete Enquiry button only for admin users
    const deleteBtn = document.getElementById('deleteEnquiryBtn');
    if (isAdmin()) {
        deleteBtn.classList.remove('hidden');
    } else {
        deleteBtn.classList.add('hidden');
    }
}

function renderTimeline(statusHistory) {
    const container = document.getElementById('timelineList');

    // Status labels mapping
    const statusLabels = {
        'NEW': 'New Lead',
        'CONTACTED': 'Contacted',
        'NO_RESPONSE': 'Call Not Picked',
        'FOLLOW_UP': 'Follow Up',
        'INTERESTED': 'Interested',
        'NOT_INTERESTED': 'Not Interested',
        'ADMISSION_PROCESS': 'Admission Process',
        'CONVERTED': 'Converted',
        'CREATED': 'Enquiry Created'
    };

    // Status colors for badges
    const statusColors = {
        'NEW': 'bg-blue-100 text-blue-800 border-blue-200',
        'CONTACTED': 'bg-blue-50 text-blue-700 border-blue-200',
        'NO_RESPONSE': 'bg-gray-100 text-gray-700 border-gray-200',
        'FOLLOW_UP': 'bg-amber-100 text-amber-800 border-amber-200',
        'INTERESTED': 'bg-green-100 text-green-800 border-green-200',
        'NOT_INTERESTED': 'bg-red-100 text-red-800 border-red-200',
        'ADMISSION_PROCESS': 'bg-purple-100 text-purple-800 border-purple-200',
        'CONVERTED': 'bg-emerald-100 text-emerald-800 border-emerald-200',
        'CREATED': 'bg-indigo-100 text-indigo-800 border-indigo-200'
    };

    // Status colors for timeline dots
    const dotColors = {
        'NEW': 'bg-blue-500',
        'CONTACTED': 'bg-blue-400',
        'NO_RESPONSE': 'bg-gray-400',
        'FOLLOW_UP': 'bg-amber-500',
        'INTERESTED': 'bg-green-500',
        'NOT_INTERESTED': 'bg-red-500',
        'ADMISSION_PROCESS': 'bg-purple-500',
        'CONVERTED': 'bg-emerald-500',
        'CREATED': 'bg-indigo-500'
    };

    // Build timeline array - always include "Enquiry Created"
    let timelineItems = [];
    
    // Add "Enquiry Created" entry
    if (currentEnquiryData && currentEnquiryData.createdAt) {
        timelineItems.push({
            status: 'CREATED',
            note: 'Enquiry created',
            changedAt: currentEnquiryData.createdAt
        });
    }
    
    // Add status history entries
    if (statusHistory && statusHistory.length) {
        timelineItems = timelineItems.concat(statusHistory);
    }

    // Sort timeline by changedAt descending (most recent first)
    const sortedHistory = timelineItems.sort((a, b) => {
        const dateA = new Date(a.changedAt);
        const dateB = new Date(b.changedAt);
        return dateB - dateA;
    });

    let html = '<div class="relative pl-6 border-l-2 border-gray-200 space-y-6">';

    sortedHistory.forEach((item, index) => {
        const statusLabel = statusLabels[item.status] || item.status;
        const statusColor = statusColors[item.status] || 'bg-gray-100 text-gray-700 border-gray-200';
        const dotColor = dotColors[item.status] || 'bg-gray-400';
        const formattedDate = formatDateTime(item.changedAt);

        html += `
            <div class="relative">
                <!-- Timeline dot -->
                <div class="absolute -left-[31px] w-4 h-4 rounded-full border-2 border-white ${dotColor} shadow-sm"></div>
                
                <!-- Timeline content -->
                <div class="bg-gray-50 rounded-xl p-4">
                    <div class="flex items-center justify-between mb-2">
                        <span class="px-3 py-1 rounded-full text-xs font-semibold border ${statusColor}">${statusLabel}</span>
                        <span class="text-xs text-gray-500">${formattedDate}</span>
                    </div>
                    
                    ${item.note ? `<p class="text-sm text-gray-700 mt-2">${item.note}</p>` : ''}
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
    lucide.createIcons();
}

// Format date as "23 Apr, 01:51 PM"
function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleDateString('en-IN', { month: 'short' });
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${day} ${month}, ${hours12}:${minutes} ${ampm}`;
}

// Toggle More Details section
function toggleMoreDetails() {
    const content = document.getElementById('moreDetailsContent');
    const icon = document.getElementById('moreDetailsIcon');
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.classList.add('rotate-180');
    } else {
        content.classList.add('hidden');
        icon.classList.remove('rotate-180');
    }
}

// WhatsApp message function
function sendWhatsAppMessage() {
    const e = window.currentEnquiryData;
    if (!e || !e.mobile) {
        showToast('error', 'No mobile number available');
        return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const counselorName = user.name || 'SSSAM Academy';

    const message = `Hi ${e.name},

This is ${counselorName} from SSSAM Academy, Gurgaon.

Regarding your ${e.courseInterested} enquiry, please let me know a convenient time to connect.`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/91${e.mobile}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
}

/* ====================
WHATSAPP MODAL
==================== */
function openWhatsAppModal() {
    const modal = document.getElementById('whatsappModal');
    const modalContent = document.getElementById('whatsappModalContent');
    const mobileDisplay = document.getElementById('whatsappMobileDisplay');
    const enquiry = window.currentEnquiryData;

    // Populate mobile number
    if (mobileDisplay && enquiry?.mobile) {
        mobileDisplay.querySelector('span').textContent = enquiry.mobile;
    }

    // Setup template change listener (ensure it works)
    const templateSelect = document.getElementById('whatsappTemplate');
    if (templateSelect) {
        templateSelect.removeEventListener('change', generateEnquiryWhatsAppMessage);
        templateSelect.addEventListener('change', generateEnquiryWhatsAppMessage);
    }

    // Generate initial message
    generateEnquiryWhatsAppMessage();

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
    lucide.createIcons();
}

function closeWhatsAppModal() {
    const modal = document.getElementById('whatsappModal');
    const modalContent = document.getElementById('whatsappModalContent');
    
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function selectWhatsAppMessage(type) {
    const e = currentEnquiryData;
    if (!e || !e.mobile) {
        showToast('error', 'No mobile number available');
        closeWhatsAppModal();
        return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const counselorName = user.name || 'SSSAM Academy';
    let message = '';

    switch (type) {
        case 'followup':
            message = `Hi ${e.name},

This is ${counselorName} from SSSAM Academy, Gurgaon.

Regarding your ${e.courseInterested} enquiry, please let me know a convenient time to connect.`;
            break;
        case 'fee_reminder':
            message = `Hi ${e.name},

This is ${counselorName} from SSSAM Academy, Gurgaon.

Regarding your ${e.courseInterested} enquiry, please let me know a convenient time to connect.`;
            break;
        case 'admission_confirmation':
            message = `Hi ${e.name},

This is ${counselorName} from SSSAM Academy, Gurgaon.

Regarding your ${e.courseInterested} enquiry, please let me know a convenient time to connect.`;
            break;
        case 'custom':
            const customMessage = prompt('Enter your custom message:');
            if (customMessage) {
                message = `Hi ${e.name},

This is ${counselorName} from SSSAM Academy, Gurgaon.

${customMessage}`;
            } else {
                closeWhatsAppModal();
                return;
            }
            break;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/91${e.mobile}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
    closeWhatsAppModal();
}

/* ====================
STATUS UPDATE MODAL
==================== */
function openStatusUpdateModal() {
    document.getElementById('statusUpdateEnquiryId').value = currentId;

    // Reset form
    document.getElementById('statusUpdateStatus').value = '';
    document.getElementById('statusUpdateNote').value = '';
    document.getElementById('statusUpdateFollowUpDate').value = '';
    document.getElementById('followUpDateContainer').classList.add('hidden');
    document.getElementById('followUpRequired').classList.add('hidden');
    document.getElementById('statusUpdateNoteError').classList.add('hidden');
    document.getElementById('followUpDateError').classList.add('hidden');

    // Setup status change listener
    const statusSelect = document.getElementById('statusUpdateStatus');
    statusSelect.onchange = function() {
        const isFollowUp = this.value === 'FOLLOW_UP';
        document.getElementById('followUpDateContainer').classList.toggle('hidden', !isFollowUp);
        document.getElementById('followUpRequired').classList.toggle('hidden', !isFollowUp);
    };

    // Show modal
    const modal = document.getElementById('statusUpdateModal');
    const modalContent = document.getElementById('statusUpdateModalContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
    lucide.createIcons();
}

function closeStatusUpdateModal() {
    const modal = document.getElementById('statusUpdateModal');
    const modalContent = document.getElementById('statusUpdateModalContent');
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

// Note: selectStatus function removed - using dropdown instead

function submitStatusUpdate() {
    const status = document.getElementById('statusUpdateStatus').value;
    const note = document.getElementById('statusUpdateNote').value.trim();
    const followUpDate = document.getElementById('statusUpdateFollowUpDate').value;

    // Validate status
    if (!status) {
        showToast('error', 'Please select a status');
        return;
    }

    // Validate note
    if (!note) {
        document.getElementById('statusUpdateNoteError').classList.remove('hidden');
        return;
    }
    document.getElementById('statusUpdateNoteError').classList.add('hidden');

    // Validate follow-up date if status is FOLLOW_UP
    if (status === 'FOLLOW_UP' && !followUpDate) {
        document.getElementById('followUpDateError').classList.remove('hidden');
        return;
    }
    document.getElementById('followUpDateError').classList.add('hidden');

    // Build payload
    const payload = {
        status: status,
        note: note
    };

    if (followUpDate) {
        payload.followUpDate = followUpDate;
    }

    // Execute update
    executeStatusUpdate(currentId, payload);
}

/* ====================
DELETE ENQUIRY MODAL
==================== */
function openDeleteEnquiryModal() {
    const modal = document.getElementById('deleteEnquiryModal');
    const modalContent = document.getElementById('deleteEnquiryModalContent');
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
    lucide.createIcons();
}

function closeDeleteEnquiryModal() {
    const modal = document.getElementById('deleteEnquiryModal');
    const modalContent = document.getElementById('deleteEnquiryModalContent');
    
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

// Global flag to prevent duplicate API calls for delete
let isDeleting = false;

async function confirmDeleteEnquiry() {
    // Prevent duplicate calls
    if (isDeleting) return;
    isDeleting = true;

    // Get delete button and disable it
    const deleteBtn = document.querySelector('#deleteEnquiryModal button[onclick="confirmDeleteEnquiry()"]');
    const originalBtnText = deleteBtn ? deleteBtn.innerHTML : null;
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Deleting...';
        lucide.createIcons();
    }

    try {
        await apiDelete(API_ENDPOINTS.ENQUIRIES.DELETE(currentId));
        showToast('success', 'Enquiry deleted successfully');
        closeDeleteEnquiryModal();
        // Redirect to enquiries list after successful deletion
        window.location.href = 'enquiries.html';
    } catch (error) {
        showToast('error', 'Failed to delete enquiry');
        closeDeleteEnquiryModal();
    } finally {
        // Reset flag and button (in case redirect fails or for future use)
        isDeleting = false;
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = originalBtnText;
            lucide.createIcons();
        }
    }
}

/* ======================
OLD STATUS MODAL (DEPRECATED - KEPT FOR REFERENCE)
====================== */
function openStatusModal(id, status) {
    currentId = id;
    document.getElementById('statusEnquiryId').value = id;
    document.getElementById('statusTargetStatus').value = status;

    // Show status display - text only
    const statusDisplay = document.getElementById('statusDisplay');
    statusDisplay.innerHTML = getStatusBadge(status);

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

// Global flag to prevent duplicate API calls for status update
let isStatusUpdating = false;

async function executeStatusUpdate(id, payload) {
    // Prevent duplicate calls
    if (isStatusUpdating) return;
    isStatusUpdating = true;

    // Get update button and disable it
    const updateBtn = document.querySelector('#statusUpdateModal button[onclick="submitStatusUpdate()"]');
    const originalBtnText = updateBtn ? updateBtn.innerHTML : null;
    if (updateBtn) {
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Updating...';
        lucide.createIcons();
    }

    try {
        await apiPut(API_ENDPOINTS.ENQUIRIES.UPDATE_STATUS(id), payload);
        showToast('success', 'Status updated successfully');
        closeStatusUpdateModal();
        loadEnquiryDetail(id);
    } catch {
        showToast('error', 'Failed to update status');
    } finally {
        // Reset flag and button
        isStatusUpdating = false;
        if (updateBtn) {
            updateBtn.disabled = false;
            updateBtn.innerHTML = originalBtnText;
            lucide.createIcons();
        }
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
    // Use provided id or fall back to currentId from page context
    const enquiryId = id || currentId;
    console.log('Opening setup fees modal for enquiry:', enquiryId);

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

    enquiryIdField.value = enquiryId;

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

// Replace dynamic placeholders in message
function replaceMessagePlaceholders(message, name, course, counselorName) {
    return message
        .replace(/\{name\}/g, name)
        .replace(/\{course\}/g, course)
        .replace(/\{counselorName\}/g, counselorName);
}

const ENQUIRY_WHATSAPP_TEMPLATES = {
    enquiry: (name, course, counselorName) => `Hi ${name},

This is ${counselorName} from SSSAM Academy, Gurgaon.

Regarding your ${course} enquiry, please let me know a convenient time to connect.`,

    followup: (name, course, counselorName) => `Hi ${name},

This is ${counselorName} from SSSAM Academy.

Following up on your ${course} enquiry. Are you still interested?`,

    interested: (name, course, counselorName) => `Hi ${name},

This is ${counselorName} from SSSAM Academy.

Great to know you're interested in ${course}! Let's proceed with admission.`,

    notinterested: (name, course, counselorName) => `Hi ${name},

This is ${counselorName} from SSSAM Academy.

Thank you for your time. If you need any assistance in future, feel free to reach out.`,

    custom: (name, course, counselorName) => `Hi ${name},

This is ${counselorName} from SSSAM Academy, Gurgaon.

I'd like to discuss your ${course} enquiry...`
};

function setupWhatsAppForEnquiry() {
    const templateSelect = document.getElementById('whatsappTemplate');

    // Setup template change listener for modal
    templateSelect?.addEventListener('change', generateEnquiryWhatsAppMessage);
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

    // Show mobile number in modal header
    if (mobileDisplay) {
        const span = mobileDisplay.querySelector('span');
        if (span) span.textContent = mobile !== '-' ? mobile : '';
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
            message = ENQUIRY_WHATSAPP_TEMPLATES.custom(name, course, counselorName);
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
    closeWhatsAppModal();
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
