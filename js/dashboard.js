document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    loadTodayCalls();
    loadRecentEnquiries();
});

async function loadDashboard() {
    try {
        const res = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL);
        const data = res.enquiries || [];

        document.getElementById('totalEnquiries').textContent = data.length;

        const today = new Date().toDateString();
        const todayCount = data.filter(e =>
            new Date(e.createdAt).toDateString() === today
        ).length;
        document.getElementById('newEnquiries').textContent = todayCount;

        const overdue = data.filter(e =>
            e.followUpDate && new Date(e.followUpDate) < new Date() && e.status !== 'CONVERTED'
        ).length;
        document.getElementById('overdueEnquiries').textContent = overdue;

        const converted = data.filter(e => e.status === 'CONVERTED').length;
        document.getElementById('convertedEnquiries').textContent = converted;
    } catch {
        showToast('error', 'Dashboard load failed');
    }
}

async function loadTodayCalls() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const res = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, {
            followUpDate: today,
            limit: 5
        });

        const enquiries = res.enquiries || [];
        const table = document.getElementById('todayTable');

        if (!enquiries.length) {
            table.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-8">
                        <div class="flex flex-col items-center gap-2 text-gray-400">
                            <i data-lucide="check-circle" class="w-8 h-8 text-green-500"></i>
                            <p>No calls scheduled for today</p>
                        </div>
                    </td>
                </tr>
            `;
            lucide.createIcons();
            return;
        }

        table.innerHTML = enquiries.map(e => `
            <tr class="hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                <td class="px-4 py-3">
                    <div class="font-medium text-gray-900">${e.name || '-'}</div>
                </td>
                <td class="px-4 py-3 text-gray-700">${e.courseInterested || '-'}</td>
                <td class="px-4 py-3">${getStatusBadge(e.status)}</td>
                <td class="px-4 py-3 ${isOverdue(e.followUpDate) ? 'text-red-600 font-medium' : 'text-gray-600'}">
                    ${formatDate(e.followUpDate)}
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
                <td class="px-4 py-3 text-gray-600">${formatDate(e.followUpDate)}</td>
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
