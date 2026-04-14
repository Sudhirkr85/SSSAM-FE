let currentId = null;
let confirmCallback = null;

// Status labels with icons
const statusLabels = {
    'CONTACTED': { text: 'Contacted', icon: '📞', color: 'blue' },
    'NO_RESPONSE': { text: 'No Response', icon: '🔕', color: 'gray' },
    'FOLLOW_UP': { text: 'Follow Up', icon: '📅', color: 'amber' },
    'INTERESTED': { text: 'Interested', icon: '👍', color: 'green' },
    'NOT_INTERESTED': { text: 'Not Interested', icon: '👎', color: 'red' },
    'ADMISSION_PROCESS': { text: 'Admission Process', icon: '🎓', color: 'purple' },
    'CONVERTED': { text: 'Converted', icon: '✅', color: 'green' }
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

    // Show status display
    const statusInfo = statusLabels[status] || { text: status, icon: '', color: 'gray' };
    document.getElementById('statusDisplay').innerHTML = `
        <span class="text-2xl">${statusInfo.icon}</span>
        <span class="${statusInfo.color === 'blue' ? 'text-blue-600' : statusInfo.color === 'green' ? 'text-green-600' : statusInfo.color === 'red' ? 'text-red-600' : statusInfo.color === 'amber' ? 'text-amber-600' : 'text-gray-600'}">${statusInfo.text}</span>
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
CONVERT MODAL
====================== */
function openConvertModal(id) {
    currentId = id;
    document.getElementById('convertEnquiryId').value = id;

    // Reset form
    document.getElementById('convertCourse').value = '';
    document.getElementById('convertFees').value = '';
    clearConvertErrors();

    // Show modal with animation
    const modal = document.getElementById('convertModal');
    const modalContent = document.getElementById('convertModalContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
}

function closeConvertModal() {
    const modal = document.getElementById('convertModal');
    const modalContent = document.getElementById('convertModalContent');
    modal.classList.add('opacity-0');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function clearConvertErrors() {
    document.getElementById('convertCourseError').classList.add('hidden');
    document.getElementById('convertFeesError').classList.add('hidden');

    const courseInput = document.getElementById('convertCourse');
    const feesInput = document.getElementById('convertFees');

    courseInput.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
    courseInput.classList.add('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');

    feesInput.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
    feesInput.classList.add('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
}

function validateConvertForm() {
    let valid = true;

    const course = document.getElementById('convertCourse');
    const fees = document.getElementById('convertFees');
    const courseError = document.getElementById('convertCourseError');
    const feesError = document.getElementById('convertFeesError');

    if (!course.value.trim()) {
        courseError.classList.remove('hidden');
        course.classList.remove('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
        course.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        valid = false;
    } else {
        courseError.classList.add('hidden');
        course.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        course.classList.add('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
    }

    if (!fees.value || parseFloat(fees.value) < 0) {
        feesError.classList.remove('hidden');
        fees.classList.remove('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
        fees.classList.add('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        valid = false;
    } else {
        feesError.classList.add('hidden');
        fees.classList.remove('border-red-500', 'focus:border-red-500', 'focus:ring-red-100');
        fees.classList.add('border-gray-200', 'focus:border-purple-500', 'focus:ring-purple-100');
    }

    return valid;
}

function submitConvert() {
    if (!validateConvertForm()) {
        showToast('error', 'Please fill all required fields');
        return;
    }

    const course = document.getElementById('convertCourse').value;
    const fees = document.getElementById('convertFees').value;

    // Open confirm modal
    document.getElementById('confirmActionText').textContent = 'Convert to Admission';
    document.getElementById('confirmDetailsText').textContent = `${course} - ₹${fees}`;

    confirmCallback = () => executeConvert(currentId, course, fees);

    const modal = document.getElementById('confirmModal');
    const modalContent = document.getElementById('confirmModalContent');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalContent.classList.remove('scale-95');
        modalContent.classList.add('scale-100');
    }, 10);
}

async function executeConvert(id, course, fees) {
    try {
        await apiPost(API_ENDPOINTS.ADMISSIONS.CREATE, {
            enquiryId: id,
            course,
            fees: parseFloat(fees)
        });

        showToast('success', 'Converted to admission successfully');
        closeConfirmModal();
        closeConvertModal();
        loadEnquiryDetail(id);
    } catch {
        showToast('error', 'Failed to convert');
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
window.closeConvertModal = closeConvertModal;
window.submitConvert = submitConvert;
window.closeConfirmModal = closeConfirmModal;
window.executeConfirmAction = executeConfirmAction;
