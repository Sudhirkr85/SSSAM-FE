/* ======================
TOAST
====================== */
function showToast(titleOrType, message, type) {
    // Handle both (type, message) and (title, message, type) signatures
    const toastType = type || (titleOrType === 'Success' ? 'success' : titleOrType === 'Error' ? 'error' : titleOrType);
    const toastMessage = message || titleOrType;

    const toast = document.getElementById('toast') || document.getElementById('toastContainer');
    if (!toast) return;

    const bgColor = toastType === 'success' ? 'bg-green-50 border-green-500 text-green-800' : 'bg-red-50 border-red-500 text-red-800';
    const icon = toastType === 'success'
        ? '<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
        : '<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';

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
