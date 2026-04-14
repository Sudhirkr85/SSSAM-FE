let payments = [];

/* ======================
INIT
====================== */
document.addEventListener('DOMContentLoaded', () => {
    loadPayments();
});

/* ======================
LOAD DATA
====================== */
async function loadPayments() {
    try {
        const res = await apiGet(API_ENDPOINTS.PAYMENTS.GET_ALL, {
            limit: 10
        });


        payments = res.payments || [];
        renderTable();


    } catch {
        showToast('error', 'Error', 'Failed to load payments');
    }
}

/* ======================
RENDER TABLE
====================== */
function renderTable() {
    const table = document.getElementById('paymentTable');

    if (!payments.length) {
        table.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-gray-400">No payments found</td></tr>`;
        return;
    }

    table.innerHTML = payments.map(p => ` <tr class="hover:bg-gray-50">


        < td class= "px-6 py-4 font-medium" >
        ${p.admissionId?.enquiryId?.name || '-'}
  </td >

  <td class="px-6 py-4">
    ${p.admissionId?.enquiryId?.courseInterested || '-'}
  </td>

  <td class="px-6 py-4 text-green-600 font-semibold">
    ${formatCurrency(p.amount)}
  </td>

  <td class="px-6 py-4">
    ${p.paymentMode || '-'}
  </td>

  <td class="px-6 py-4">
    ${formatDate(p.createdAt)}
  </td>

</tr >
        

`).join('');
}
