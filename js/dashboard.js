document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});

async function loadDashboard() {
    try {
        // Use role-based dashboard API endpoint
        const endpoint = getDashboardEndpoint();
        const res = await apiGet(endpoint);
        const data = res.data || res;

        // Update simplified stats (3 cards: Leads, Admissions, Revenue)
        document.getElementById('totalLeads').textContent = data.totalEnquiries || 0;
        document.getElementById('totalAdmissions').textContent = data.totalAdmissions || 0;
        document.getElementById('totalRevenue').textContent = formatCurrency(data.totalRevenue || 0);
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
