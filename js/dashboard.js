/**
 * Dashboard Module
 * Institute Enquiry Management System
 */

// Simple helper to get course name from ID
function getCourseName(courseId) {
    const course = STATIC_COURSES.find(c => c._id === courseId || c.id === courseId);
    return course?.name || courseId || '-';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('totalEnquiries')) return;
    
    loadDashboardStats();
    loadRecentEnquiries();
});

async function loadDashboardStats() {
    try {
        // Use /enquiries endpoint instead of non-existent /reports/dashboard
        const response = await apiGet(API_ENDPOINTS.ENQUIRIES.LIST, { limit: 1000 });
        const enquiries = response.data || [];
        const pagination = response.pagination || {};

        // Calculate stats from enquiries data
        const totalEnquiries = pagination.totalCount || enquiries.length;
        const today = new Date().toISOString().split('T')[0];
        const newToday = enquiries.filter(e => {
            const created = new Date(e.createdAt).toISOString().split('T')[0];
            return created === today;
        }).length;
        const overdue = enquiries.filter(e => {
            if (!e.followUpDate) return false;
            const followUp = new Date(e.followUpDate);
            return followUp < new Date() && e.status !== 'Converted' && e.status !== 'Lost';
        }).length;
        const converted = enquiries.filter(e => e.status === 'Converted').length;

        // Update stat cards
        animateValue('totalEnquiries', 0, totalEnquiries, 1000);
        animateValue('newEnquiries', 0, newToday, 1000);
        animateValue('overdueEnquiries', 0, overdue, 1000);
        animateValue('convertedEnquiries', 0, converted, 1000);
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        // Set defaults on error
        animateValue('totalEnquiries', 0, 0, 1000);
        animateValue('newEnquiries', 0, 0, 1000);
        animateValue('overdueEnquiries', 0, 0, 1000);
        animateValue('convertedEnquiries', 0, 0, 1000);
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
                <td class="px-6 py-4 text-gray-600">${getCourseName(enquiry.course)}</td>
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
