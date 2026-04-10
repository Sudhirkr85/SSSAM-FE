/**
 * Dashboard Module
 * Institute Enquiry Management System
 */

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('totalEnquiries')) return;
    
    loadDashboardStats();
    loadRecentEnquiries();
});

async function loadDashboardStats() {
    try {
        const stats = await apiGet(API_ENDPOINTS.REPORTS.DASHBOARD);
        
        // Update stat cards
        animateValue('totalEnquiries', 0, stats.totalEnquiries || 0, 1000);
        animateValue('newEnquiries', 0, stats.newToday || 0, 1000);
        animateValue('overdueEnquiries', 0, stats.overdue || 0, 1000);
        animateValue('convertedEnquiries', 0, stats.converted || 0, 1000);
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
    }
}

async function loadRecentEnquiries() {
    try {
        const response = await apiGet(API_ENDPOINTS.ENQUIRIES.LIST, { limit: 5 });
        const enquiries = response.data || [];
        
        const table = document.getElementById('recentEnquiriesTable');
        
        if (!enquiries.length) {
            table.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">No recent enquiries</td></tr>';
            return;
        }
        
        table.innerHTML = enquiries.map(enquiry => `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4">
                    <div class="font-medium text-gray-900">${enquiry.name || '-'}</div>
                </td>
                <td class="px-6 py-4 text-gray-600">${enquiry.course?.name || enquiry.course || '-'}</td>
                <td class="px-6 py-4">${getStatusBadge(enquiry.status)}</td>
                <td class="px-6 py-4 ${isOverdue(enquiry.followUpDate) ? 'text-red-600 font-medium' : 'text-gray-600'}">
                    ${formatDate(enquiry.followUpDate, true)}
                </td>
                <td class="px-6 py-4">
                    ${enquiry.assignedTo ? 
                        `<span class="text-gray-800">${enquiry.assignedTo.name || 'Assigned'}</span>` : 
                        '<span class="text-yellow-600 font-medium">Unassigned</span>'
                    }
                </td>
            </tr>
        `).join('');
    } catch (error) {
        document.getElementById('recentEnquiriesTable').innerHTML = 
            '<tr><td colspan="5" class="px-6 py-8 text-center text-red-500">Failed to load recent enquiries</td></tr>';
    }
}

// Animate number counting
function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    
    const range = end - start;
    const minTimer = 50;
    let stepTime = Math.abs(Math.floor(duration / range));
    stepTime = Math.max(stepTime, minTimer);
    
    let startTime = new Date().getTime();
    let endTime = startTime + duration;
    let timer;
    
    function run() {
        let now = new Date().getTime();
        let remaining = Math.max((endTime - now) / duration, 0);
        let value = Math.round(end - (remaining * range));
        obj.textContent = value;
        if (value == end) {
            clearInterval(timer);
        }
    }
    
    timer = setInterval(run, stepTime);
    run();
}
