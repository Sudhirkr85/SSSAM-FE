let admissions = [];
let selectedAdmissionId = null;

/* ======================
INIT
====================== */
document.addEventListener('DOMContentLoaded', () => {
    loadAdmissions();
});

/* ======================
LOAD DATA
====================== */
async function loadAdmissions() {
    try {
        const res = await apiGet(API_ENDPOINTS.ADMISSIONS.GET_ALL, {
            limit: 10
        });


        admissions = res.admissions || [];
        renderTable();


    } catch {
        showToast('error', 'Error', 'Failed to load admissions');
    }
}

/* ======================
RENDER
====================== */
function renderTable() {
    const table = document.getElementById('admissionTable');

    if (!admissions.length) {
        table.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-400">No data</td></tr>`;
        return;
    }

    table.innerHTML = admissions.map(a => {
        const paid = a.paidAmount || 0;
        const total = a.totalFees || 0;
        const pending = total - paid;


        return `
            < tr class="hover:bg-gray-50" >

    <td class="px-6 py-4 font-medium">${a.enquiryId?.name || '-'}</td>

    <td class="px-6 py-4">${a.enquiryId?.courseInterested || '-'}</td>

    <td class="px-6 py-4">${formatCurrency(total)}</td>

    <td class="px-6 py-4 text-green-600">${formatCurrency(paid)}</td>

    <td class="px-6 py-4 text-red-600">${formatCurrency(pending)}</td>

    <td class="px-6 py-4">

      ${pending > 0 ? `
        <button onclick="openPaymentModal('${a._id}')"
          class="px-3 py-1 bg-blue-600 text-white rounded text-xs">
          Pay
        </button>
      ` : `<span class="text-green-600 text-xs">Completed</span>`}

    </td>

  </tr >
            `;


    }).join('');
}

/* ======================
PAYMENT MODAL
====================== */
function openPaymentModal(id) {
    selectedAdmissionId = id;
    document.getElementById('paymentModal').classList.remove('hidden');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
}

/* ======================
SUBMIT PAYMENT
====================== */
async function submitPayment() {
    const amount = Number(document.getElementById('amount').value);
    const paymentMode = document.getElementById('paymentMode').value;

    if (!amount || amount <= 0) {
        return showToast('error', 'Enter valid amount');
    }

    try {
        await apiPost(API_ENDPOINTS.PAYMENTS.CREATE, {
            admissionId: selectedAdmissionId,
            amount,
            paymentMode
        });


        showToast('success', 'Payment added');

        closePaymentModal();
        loadAdmissions();


    } catch (err) {
        showToast('error', err?.message || 'Payment failed');
    }
}

/* ======================
EXPORT
====================== */
window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.submitPayment = submitPayment;
