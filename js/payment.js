let payments = [];
let filters = { search: '', date: '' };

/* ======================
INIT
====================== */

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('paymentsTable')) return;

    setupFilters();
    loadPayments();
    loadAdmissions();
});

/* ======================
LOAD PAYMENTS
====================== */

async function loadPayments() {
    try {
        const res = await apiGet(API_ENDPOINTS.PAYMENTS.GET_ALL, filters);


        payments = res.payments || [];
        renderPayments();


    } catch {
        showToast('error', 'Error', 'Failed to load payments');
    }
}

/* ======================
FILTERS
====================== */

function setupFilters() {
    document.getElementById('searchInput')?.addEventListener('input', debounce(e => {
        filters.search = e.target.value;
        loadPayments();
    }, 300));

    document.getElementById('dateFilter')?.addEventListener('change', e => {
        filters.date = e.target.value;
        loadPayments();
    });

    document.getElementById('resetFilters')?.addEventListener('click', () => {
        filters = { search: '', date: '' };
        loadPayments();
    });
}

/* ======================
RENDER
====================== */

function renderPayments() {
    const table = document.getElementById('paymentsTable');

    if (!payments.length) {
        table.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-400">No data</td></tr>`;
        return;
    }

    table.innerHTML = payments.map(p => {
        const e = p.admissionId?.enquiryId || {};


        return `
            < tr class="hover:bg-gray-50" >
    <td class="px-6 py-4">${p._id.slice(-6)}</td>
    <td class="px-6 py-4">${e.name || '-'}</td>
    <td class="px-6 py-4">${e.courseInterested || '-'}</td>
    <td class="px-6 py-4 text-green-600">${formatCurrency(p.amount)}</td>
    <td class="px-6 py-4">${formatDate(p.paymentDate)}</td>
    <td class="px-6 py-4">${p.paymentMode || '-'}</td>
    <td class="px-6 py-4">
      <button onclick="printReceipt('${p._id}')" class="text-blue-600">
        Print
      </button>
    </td>
  </tr >
            `;


    }).join('');
}

/* ======================
LOAD ADMISSIONS
====================== */

async function loadAdmissions() {
    try {
        const res = await apiGet(API_ENDPOINTS.ADMISSIONS.GET_ALL, {});

        const list = res.admissions || [];
        const select = document.getElementById('paymentAdmission');

        if (!select) return;

        select.innerHTML = '<option value="">Select Admission</option>';

        list.forEach(a => {
            const pending = (a.totalFees || 0) - (a.paidAmount || 0);

            if (pending > 0) {
                select.innerHTML += `
            < option value = "${a._id}" >
                ${a.enquiryId?.name} (${formatCurrency(pending)})
      </option >
        `;
            }
        });


    } catch { }
}

/* ======================
ADD PAYMENT
====================== */

document.getElementById('paymentForm')?.addEventListener('submit', async e => {
    e.preventDefault();

    const btn = document.getElementById('savePayment');
    setLoading(btn, true);

    try {
        await apiPost(API_ENDPOINTS.PAYMENTS.CREATE, {
            admissionId: document.getElementById('paymentAdmission').value,
            amount: Number(document.getElementById('paymentAmount').value),
            paymentMode: document.getElementById('paymentMode').value,
            paymentDate: document.getElementById('paymentDate').value
        });


        showToast('success', 'Payment added');

        closePaymentModal();
        loadPayments();
        loadAdmissions();


    } catch {
        showToast('error', 'Error adding payment');
    }

    setLoading(btn, false);
});

/* ======================
MODAL
====================== */

function openPaymentModal() {
    document.getElementById('paymentModal').classList.remove('hidden');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
}

/* ======================
PRINT
====================== */

function printReceipt(id) {
    window.open(`${API_BASE_URL}/payments/${id}/receipt`, '_blank');
}

/* ======================
EXPORT
====================== */

window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.printReceipt = printReceipt;
