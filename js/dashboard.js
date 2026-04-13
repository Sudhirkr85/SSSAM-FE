/**
 * Dashboard Module
 * Institute Enquiry Management System
 */

// State
let isLoadingStats = false;

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
    if (isLoadingStats) return;
    isLoadingStats = true;

    try {
        // Fetch enquiries and payments in parallel
        const [enquiriesRes, paymentsRes] = await Promise.all([
            apiGet(API_ENDPOINTS.ENQUIRIES.LIST, { limit: 1000 }).catch(() => ({ data: [], pagination: {} })),
            apiGet(API_ENDPOINTS.PAYMENTS.LIST, { limit: 1000 }).catch(() => ({ data: [] }))
        ]);

        const enquiries = enquiriesRes.data || [];
        const enquiriesPagination = enquiriesRes.pagination || {};
        const payments = paymentsRes.data || [];

        // Calculate stats from enquiries data
        const totalEnquiries = enquiriesPagination.totalCount || enquiries.length;
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

        // Calculate revenue from payments (using payment date, NOT enquiry date)
        const totalRevenue = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
        const todayRevenue = payments.filter(p => {
            const paymentDate = new Date(p.paymentDate || p.createdAt).toISOString().split('T')[0];
            return paymentDate === today;
        }).reduce((sum, p) => sum + (p.amount || 0), 0);

        // Update stat cards
        animateValue('totalEnquiries', 0, totalEnquiries, 1000);
        animateValue('newEnquiries', 0, newToday, 1000);
        animateValue('overdueEnquiries', 0, overdue, 1000);
        animateValue('convertedEnquiries', 0, converted, 1000);

        // Store revenue for display (can be shown in a new card if needed)
        window.dashboardRevenue = { total: totalRevenue, today: todayRevenue };

    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        showToast('error', 'Error', 'Failed to load dashboard statistics');
        // Set defaults on error
        animateValue('totalEnquiries', 0, 0, 1000);
        animateValue('newEnquiries', 0, 0, 1000);
        animateValue('overdueEnquiries', 0, 0, 1000);
        animateValue('convertedEnquiries', 0, 0, 1000);
    } finally {
        isLoadingStats = false;
    }
}

async function loadRecentEnquiries() {
    try {
        // For counselors, filter to show only assigned + unassigned
        const params = { limit: 5 };
        if (isCounselor() && !isAdmin()) {
            params.assignedToMe = true;
            params.includeUnassigned = true;
        }

        const response = await apiGet(API_ENDPOINTS.ENQUIRIES.LIST, params);
        const enquiries = response.data || [];

        const table = document.getElementById('recentEnquiriesTable');

        if (!enquiries.length) {
            table.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">No recent enquiries</td></tr>';
            return;
        }

        const currentUserId = getCurrentUserId();

        table.innerHTML = enquiries.map(enquiry => {
            const isUnassigned = !enquiry.assignedTo;
            const isMine = enquiry.assignedTo?._id === currentUserId || enquiry.assignedTo?.id === currentUserId;

            let assignmentDisplay;
            if (isUnassigned) {
                assignmentDisplay = '<span class="text-yellow-600 font-medium">Unassigned</span>';
            } else if (isMine) {
                assignmentDisplay = `<span class="text-green-600 font-medium">${enquiry.assignedTo?.name || 'You'}</span>`;
            } else {
                assignmentDisplay = `<span class="text-gray-800">${enquiry.assignedTo?.name || 'Assigned'}</span>`;
            }

            return `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4">
                        <div class="font-medium text-gray-900">${enquiry.name || '-'}</div>
                    </td>
                    <td class="px-6 py-4 text-gray-600">${getCourseName(enquiry.course)}</td>
                    <td class="px-6 py-4">${getStatusBadge(enquiry.status)}</td>
                    <td class="px-6 py-4 ${isOverdue(enquiry.followUpDate) ? 'text-red-600 font-medium' : 'text-gray-600'}">
                        ${formatDate(enquiry.followUpDate, true)}
                    </td>
                    <td class="px-6 py-4">${assignmentDisplay}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        document.getElementById('recentEnquiriesTable').innerHTML =
            '<tr><td colspan="5" class="px-6 py-8 text-center text-red-500">Failed to load recent enquiries</td></tr>';
        showToast('error', 'Error', 'Failed to load recent enquiries');
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
