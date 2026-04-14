document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    loadTodayCalls();
    loadRecentEnquiries();
});

async function loadDashboard() {
    try {
        // Use the proper dashboard API endpoint
        const res = await apiGet(API_ENDPOINTS.DASHBOARD.GET);
        const data = res.data || res;

        // Update dashboard counts from API response
        // Main dashboard returns: totalEnquiries, totalConversions, overdueFollowUps, todayFollowUps
        document.getElementById('totalEnquiries').textContent = data.totalEnquiries || 0;
        document.getElementById('newEnquiries').textContent = data.todayFollowUps || data.todayEnquiries || 0;
        document.getElementById('overdueEnquiries').textContent = data.overdueFollowUps || data.overdueEnquiries || 0;
        document.getElementById('convertedEnquiries').textContent = data.totalConversions || data.convertedEnquiries || 0;
    } catch {
        // Fallback: try to fetch from enquiries endpoint
        try {
            const totalRes = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, { limit: 1 });
            document.getElementById('totalEnquiries').textContent = totalRes.pagination?.totalCount || 0;
            document.getElementById('newEnquiries').textContent = totalRes.pagination?.todayCount || 0;
            document.getElementById('overdueEnquiries').textContent = 0;
            document.getElementById('convertedEnquiries').textContent = 0;
        } catch {
            showToast('error', 'Dashboard load failed');
        }
    }
}

async function loadTodayCalls() {
    try {
        // Use dashboard today-calls endpoint (returns { summary: {...}, calls: [...] })
        const res = await apiGet(API_ENDPOINTS.DASHBOARD.TODAY_CALLS);
        const data = res.data || res;
        const calls = data.todayCalls?.calls || data.calls || data || [];
        const table = document.getElementById('todayTable');

        if (!calls.length) {
            table.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-8">
                        <p class="text-gray-400">No calls scheduled for today</p>
                    </td>
                </tr>
            `;
            return;
        }

        table.innerHTML = calls.map(e => `
            <tr class="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                <td class="px-4 py-3">
                    <div class="font-medium text-gray-900">${e.name || '-'}</div>
                </td>
                <td class="px-4 py-3 text-gray-700">${e.courseInterested || '-'}</td>
                <td class="px-4 py-3">${getStatusBadge(e.status)}</td>
                <td class="px-4 py-3 ${e.followUpDate && new Date(e.followUpDate) < new Date() ? 'text-red-600 font-medium' : 'text-gray-600'}">
                    ${e.followUpDate ? formatDate(e.followUpDate) : '-'}
                </td>
            </tr>
        `).join('');
    } catch {
        // Fallback to followups endpoint
        try {
            const res = await apiGet(API_ENDPOINTS.DASHBOARD.FOLLOWUPS);
            const enquiries = res.data || res.enquiries || res || [];
            const table = document.getElementById('todayTable');

            if (!enquiries.length) {
                table.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center py-8">
                            <p class="text-gray-400">No calls scheduled for today</p>
                        </td>
                    </tr>
                `;
                return;
            }

            table.innerHTML = enquiries.map(e => `
                <tr class="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                    <td class="px-4 py-3">
                        <div class="font-medium text-gray-900">${e.name || '-'}</div>
                    </td>
                    <td class="px-4 py-3 text-gray-700">${e.courseInterested || '-'}</td>
                    <td class="px-4 py-3">${getStatusBadge(e.status)}</td>
                    <td class="px-4 py-3 ${e.followUpDate && new Date(e.followUpDate) < new Date() ? 'text-red-600 font-medium' : 'text-gray-600'}">
                        ${e.followUpDate ? formatDate(e.followUpDate) : '-'}
                    </td>
                </tr>
            `).join('');
        } catch {
            document.getElementById('todayTable').innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-4 text-gray-400">Failed to load</td>
                </tr>
            `;
        }
    }
}

async function loadRecentEnquiries() {
    try {
        const res = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, {
            limit: 5,
            sort: '-createdAt'
        });

        const enquiries = res.enquiries || [];
        const table = document.getElementById('recentEnquiriesTable');

        if (!enquiries.length) {
            table.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-8">
                        <p class="text-gray-400">No enquiries yet</p>
                    </td>
                </tr>
            `;
            return;
        }

        table.innerHTML = enquiries.map(e => `
            <tr class="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                <td class="px-4 py-3">
                    <div class="font-medium text-gray-900">${e.name || '-'}</div>
                </td>
                <td class="px-4 py-3 text-gray-700">${e.courseInterested || '-'}</td>
                <td class="px-4 py-3">${getStatusBadge(e.status)}</td>
                <td class="px-4 py-3 text-gray-600">${e.followUpDate ? formatDate(e.followUpDate) : '-'}</td>
            </tr>
        `).join('');
    } catch {
        document.getElementById('recentEnquiriesTable').innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-4 text-gray-400">Failed to load</td>
            </tr>
        `;
    }
}

function isOverdue(date) {
    if (!date) return false;
    return new Date(date) < new Date();
}
