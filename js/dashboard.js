document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});

async function loadDashboard() {
    try {
        // Use role-based dashboard API endpoint
        const endpoint = getDashboardEndpoint();
        const res = await apiGet(endpoint);

        // Handle API response structure: { success, message, data }
        const data = res.data || res;

        // Update simplified stats (3 cards: Leads, Admissions, Revenue)
        document.getElementById('totalLeads').textContent = data.totalEnquiries || 0;

        const admissionsData = data.admissions || {};
        document.getElementById('totalAdmissions').textContent = admissionsData.totalAdmissions || data.totalConversions || 0;

        const revenueData = data.revenue || {};
        const grossRevenue = revenueData.yearlyRevenue || 0;
        const totalRefunds = revenueData.totalRefunds || 0;
        const netRevenue = grossRevenue - totalRefunds;

        // Show net revenue with refund breakdown if refunds exist
        const revenueElement = document.getElementById('totalRevenue');
        if (totalRefunds > 0) {
            revenueElement.innerHTML = `
                <div class="text-3xl font-bold text-green-600">${formatCurrency(netRevenue)}</div>
                <div class="text-xs text-gray-500">Gross: ${formatCurrency(grossRevenue)} - Refunds: ${formatCurrency(totalRefunds)}</div>
            `;
        } else {
            revenueElement.textContent = formatCurrency(grossRevenue);
        }
    } catch (error) {
        // Check for 403 access denied
        if (error.response?.status === 403) {
            showToast('error', 'Access denied to dashboard');
            return;
        }
        // Fallback: try to fetch from enquiries endpoint
        try {
            const totalRes = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, { limit: 1 });
            document.getElementById('totalLeads').textContent = totalRes.pagination?.totalCount || 0;
            document.getElementById('totalAdmissions').textContent = 0;
            document.getElementById('totalRevenue').textContent = formatCurrency(0);
        } catch {
            showToast('error', 'Dashboard load failed');
        }
    }
}

function isOverdue(date) {
    if (!date) return false;
    return new Date(date) < new Date();
}

function formatCurrency(amount) {
    if (!amount || amount === 0) return '₹0';
    if (typeof amount === 'string') return amount;
    return '₹' + amount.toLocaleString('en-IN');
}
