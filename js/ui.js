/* ======================
TOAST
====================== */
function showToast(titleOrType, message, type) {
    // Handle both (type, message) and (title, message, type) signatures
    const toastType = type || (titleOrType === 'Success' ? 'success' : titleOrType === 'Error' ? 'error' : titleOrType === 'Info' ? 'info' : titleOrType);
    const toastMessage = message || titleOrType;

    const toast = document.getElementById('toast') || document.getElementById('toastContainer');
    if (!toast) return;

    const colors = {
        success: 'bg-green-50 border-green-500 text-green-800',
        error: 'bg-red-50 border-red-500 text-red-800',
        info: 'bg-blue-50 border-blue-500 text-blue-800'
    };
    const icons = {
        success: '<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
        error: '<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>',
        info: '<svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
    };

    const bgColor = colors[toastType] || colors.info;
    const icon = icons[toastType] || icons.info;

    const toastEl = document.createElement('div');
    toastEl.className = `flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 shadow-lg ${bgColor} toast-enter`;
    toastEl.innerHTML = `
        ${icon}
        <p class="text-sm font-medium">${toastMessage}</p>
    `;

    toast.appendChild(toastEl);

    setTimeout(() => {
        toastEl.classList.remove('toast-enter');
        toastEl.classList.add('toast-exit');
        setTimeout(() => toastEl.remove(), 300);
    }, 3000);
}

/* ======================
DATE FORMAT
====================== */
function formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString();
}

/* ======================
CURRENCY
====================== */
function formatCurrency(amount) {
    return '₹' + (amount || 0);
}

/* ======================
STATUS BADGE
====================== */
function getStatusBadge(status) {
    const colors = {
        NEW: 'bg-gray-200',
        CONTACTED: 'bg-blue-200',
        NO_RESPONSE: 'bg-red-200',
        FOLLOW_UP: 'bg-yellow-200',
        INTERESTED: 'bg-green-200',
        NOT_INTERESTED: 'bg-red-300',
        ADMISSION_PROCESS: 'bg-purple-200',
        CONVERTED: 'bg-green-400 text-white'
    };

    return `<span class="px-2 py-1 text-xs rounded ${colors[status] || 'bg-gray-200'}">${status}</span>`;
}
