const STATUS = {
    NEW: 'NEW',
    CONTACTED: 'CONTACTED',
    NO_RESPONSE: 'NO_RESPONSE',
    FOLLOW_UP: 'FOLLOW_UP',
    INTERESTED: 'INTERESTED',
    NOT_INTERESTED: 'NOT_INTERESTED',
    ADMISSION_PROCESS: 'ADMISSION_PROCESS',
    CONVERTED: 'CONVERTED'
};

const STATUS_FLOW = {
    NEW: ['CONTACTED', 'NO_RESPONSE'],
    CONTACTED: ['FOLLOW_UP', 'INTERESTED', 'NOT_INTERESTED'],
    NO_RESPONSE: ['FOLLOW_UP', 'NOT_INTERESTED'],
    FOLLOW_UP: ['CONTACTED', 'INTERESTED', 'NOT_INTERESTED'],
    INTERESTED: ['ADMISSION_PROCESS', 'NOT_INTERESTED'],
    NOT_INTERESTED: [],
    ADMISSION_PROCESS: ['CONVERTED'],
    CONVERTED: []
};

/* ======================
ROLE CHECK
====================== */

function canAccess(role, feature) {
    const rules = {
        admin: ['all'],
        counselor: ['enquiry', 'admission', 'payment']
    };

    return rules[role]?.includes('all') || rules[role]?.includes(feature);
}

/* ======================
TOAST (LUCIDE BASED)
====================== */

function showToast(type, title, message) {
    const toast = document.getElementById('toast');
    if (!toast) return;

    const icons = {
        success: 'check-circle',
        error: 'x-circle',
        warning: 'alert-triangle',
        info: 'info'
    };

    toast.innerHTML = `     <div class="bg-white shadow-xl rounded-lg px-4 py-3 flex items-center gap-3 border">       <i data-lucide="${icons[type] || 'info'}" class="w-5 h-5 text-blue-500"></i>       <div>         <p class="text-sm font-semibold">${title}</p>         <p class="text-xs text-gray-500">${message}</p>       </div>     </div>
  `;

    toast.classList.remove('hidden');

    lucide.createIcons();

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

/* ======================
FORMATTERS
====================== */

function formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN');
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount || 0);
}

/* ======================
STATUS BADGE
====================== */

function getStatusBadge(status) {
    const map = {
        NEW: 'bg-gray-100 text-gray-600',
        CONTACTED: 'bg-blue-100 text-blue-600',
        FOLLOW_UP: 'bg-yellow-100 text-yellow-600',
        INTERESTED: 'bg-green-100 text-green-600',
        NOT_INTERESTED: 'bg-red-100 text-red-600',
        CONVERTED: 'bg-purple-100 text-purple-600'
    };

    return `     <span class="px-2 py-1 text-xs rounded ${map[status] || 'bg-gray-100'}">
      ${status}     </span>
  `;
}

/* ======================
DEBOUNCE
====================== */

function debounce(func, wait = 300) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

/* ======================
FORM LOADING
====================== */

function setLoading(button, loading = true) {
    if (!button) return;

    button.disabled = loading;
    button.classList.toggle('opacity-50', loading);
}

/* ======================
EXPORT
====================== */

window.showToast = showToast;
window.formatDate = formatDate;
window.formatCurrency = formatCurrency;
window.getStatusBadge = getStatusBadge;
window.debounce = debounce;
window.setLoading = setLoading;
window.STATUS = STATUS;
window.STATUS_FLOW = STATUS_FLOW;
window.canAccess = canAccess;
