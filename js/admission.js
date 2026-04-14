let admissions = [];
let filters = { search: '', course: '' };

/* ======================
INIT
====================== */

document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('admissionsTable')) return;

    loadAdmissions();
    setupFilters();
});

/* ======================
LOAD
====================== */

async function loadAdmissions() {
    try {
        const res = await apiGet(API_ENDPOINTS.ADMISSIONS.GET_ALL, filters);


        admissions = res.admissions || [];
        renderAdmissions();


    } catch {
        showToast('error', 'Error', 'Failed to load admissions');
    }
}

/* ======================
FILTERS
====================== */

function setupFilters() {
    document.getElementById('searchInput')?.addEventListener('input', debounce(e => {
        filters.search = e.target.value;
        loadAdmissions();
    }, 300));

    document.getElementById('courseFilter')?.addEventListener('change', e => {
        filters.course = e.target.value;
        loadAdmissions();
    });

    document.getElementById('resetFilters')?.addEventListener('click', () => {
        filters = { search: '', course: '' };
        loadAdmissions();
    });
}

/* ======================
RENDER
====================== */

function renderAdmissions() {
    const table = document.getElementById('admissionsTable');

    if (!admissions.length) {
        table.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-gray-400">No data</td></tr>`;
        return;
    }

    table.innerHTML = admissions.map(a => {
        const pending = (a.totalFees || 0) - (a.paidAmount || 0);


        return `
            < tr class="hover:bg-gray-50" >
    <td class="px-6 py-4 font-medium">${a.enquiryId?.name || '-'}</td>
    <td class="px-6 py-4">${a.enquiryId?.courseInterested || '-'}</td>
    <td class="px-6 py-4">${formatCurrency(a.totalFees)}</td>
    <td class="px-6 py-4 text-green-600">${formatCurrency(a.paidAmount || 0)}</td>
    <td class="px-6 py-4 ${pending > 0 ? 'text-red-600 font-medium' : ''}">
      ${formatCurrency(pending)}
    </td>
    <td class="px-6 py-4">
      <button onclick="openAdmission('${a._id}')" class="text-blue-600 hover:underline">
        View
      </button>
    </td>
  </tr >
            `;


    }).join('');
}

/* ======================
VIEW MODAL
====================== */

async function openAdmission(id) {
    try {
        const res = await apiGet(API_ENDPOINTS.ADMISSIONS.UPDATE(id));
        const a = res.admission || res;


        const pending = (a.totalFees || 0) - (a.paidAmount || 0);

        const html = `
            < div class="space-y-4" >

    <div>
      <p><b>Name:</b> ${a.enquiryId?.name}</p>
      <p><b>Course:</b> ${a.enquiryId?.courseInterested}</p>
    </div>

    <div class="grid grid-cols-3 gap-4 text-center">
      <div>
        <p>Total</p>
        <p class="font-bold">${formatCurrency(a.totalFees)}</p>
      </div>
      <div>
        <p>Paid</p>
        <p class="font-bold text-green-600">${formatCurrency(a.paidAmount || 0)}</p>
      </div>
      <div>
        <p>Pending</p>
        <p class="font-bold ${pending > 0 ? 'text-red-600' : 'text-green-600'}">${formatCurrency(pending)}</p>
      </div>
    </div>

    ${pending > 0 ? `
      <button onclick="payFull('${a._id}', ${pending})"
        class="w-full bg-green-600 text-white py-2 rounded-lg">
        Pay Full
      </button>
    ` : `
      <p class="text-center text-green-600 font-medium">Fully Paid</p>
    `}
  </div >
            `;

        showModal('Admission Details', html);


    } catch {
        showToast('error', 'Error', 'Failed to load');
    }
}

/* ======================
PAY FULL
====================== */

async function payFull(id, amount) {
    try {
        await apiPost(API_ENDPOINTS.PAYMENTS.CREATE, {
            admissionId: id,
            amount
        });


        showToast('success', 'Paid successfully');
        loadAdmissions();


    } catch {
        showToast('error', 'Error', 'Payment failed');
    }
}

/* ======================
EXPORT
====================== */

window.openAdmission = openAdmission;
window.payFull = payFull;
