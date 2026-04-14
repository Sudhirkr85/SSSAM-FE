/* ======================
TOAST
====================== */
function showToast(type, message) {
    const toast = document.getElementById('toast');

    toast.innerHTML = `     <div class="bg-white shadow-lg rounded-lg px-4 py-3 border-l-4 ${type === 'success' ? 'border-green-500' : 'border-red-500'
        }">       <p class="text-sm">${message}</p>     </div>
  `;

    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
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
