/**
 * Dashboard Module
 * Institute Enquiry Management System
 * Uses /api/dashboard endpoint as per specification
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

/**
 * Load dashboard stats from /api/dashboard endpoint
 * Expected response format per spec:
 * {
 *   revenue: { today, weekly, monthly, yearly },
 *   enquiries: { today, weekly, monthly },
 *   followUps: { today, overdue }
 * }
 */
async function loadDashboardStats() {
    if (isLoadingStats) return;
    isLoadingStats = true;

    try {
        // Use the dashboard endpoint as per specification
        const response = await apiGet(API_ENDPOINTS.DASHBOARD);
        const data = response.data || {};

        // Extract revenue stats
        const revenue = data.revenue || {};
        const enquiries = data.enquiries || {};
        const followUps = data.followUps || {};

        // Calculate totals for display
        const totalEnquiries = (enquiries.today || 0) + (enquiries.weekly || 0) + (enquiries.monthly || 0);
        const newToday = enquiries.today || 0;
        const overdue = followUps.overdue || 0;
        
        // Get converted count from enquiries data or calculate from list
        let converted = data.convertedCount || 0;
        
        // If not provided by dashboard endpoint, fall back to calculating
        if (!converted && data.enquiryList) {
            converted = data.enquiryList.filter(e => e.status?.toUpperCase() === STATUS.CONVERTED).length;
        }

        // Update stat cards
        animateValue('totalEnquiries', 0, totalEnquiries, 1000);
        animateValue('newEnquiries', 0, newToday, 1000);
        animateValue('overdueEnquiries', 0, overdue, 1000);
        animateValue('convertedEnquiries', 0, converted, 1000);

        // Store full dashboard data for potential extended display
        window.dashboardData = data;

    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        // Silent fail - don't show toast on initial load to avoid annoying user
        // Fall back to calculating from enquiries list
        await loadDashboardStatsFallback();
    } finally {
        isLoadingStats = false;
    }
}

/**
 * Fallback method if dashboard endpoint fails
 * Calculates stats from enquiries list
 */
async function loadDashboardStatsFallback() {
    try {
        const params = { limit: 1000 };
        // For counselors, only get their assigned + unassigned per spec
        if (isCounselor() && !isAdmin()) {
            params.assigned = 'me,unassigned';
        } else if (isAdmin()) {
            params.assigned = 'all';
        }

        const response = await apiGet(API_ENDPOINTS.ENQUIRIES.LIST, params);
        const enquiries = response.data || [];

        const today = new Date().toISOString().split('T')[0];
        const newToday = enquiries.filter(e => {
            const created = new Date(e.createdAt).toISOString().split('T')[0];
            return created === today;
        }).length;

        // Count overdue follow-ups (excluding terminal statuses)
        const terminalStatuses = [STATUS.CONVERTED, STATUS.NOT_INTERESTED];
        const overdue = enquiries.filter(e => {
            if (!e.followUpDate) return false;
            const followUp = new Date(e.followUpDate);
            const status = e.status?.toUpperCase();
            return followUp < new Date() && !terminalStatuses.includes(status);
        }).length;

        const converted = enquiries.filter(e => e.status?.toUpperCase() === STATUS.CONVERTED).length;

        animateValue('totalEnquiries', 0, enquiries.length, 1000);
        animateValue('newEnquiries', 0, newToday, 1000);
        animateValue('overdueEnquiries', 0, overdue, 1000);
        animateValue('convertedEnquiries', 0, converted, 1000);
    } catch (error) {
        console.error('Fallback stats load failed:', error);
        animateValue('totalEnquiries', 0, 0, 1000);
        animateValue('newEnquiries', 0, 0, 1000);
        animateValue('overdueEnquiries', 0, 0, 1000);
        animateValue('convertedEnquiries', 0, 0, 1000);
    }
}

async function loadRecentEnquiries() {
    try {
        // For counselors, filter to show only assigned + unassigned per spec
        const params = { limit: 5 };
        if (isCounselor() && !isAdmin()) {
            params.assigned = 'me,unassigned';
        } else if (isAdmin()) {
            params.assigned = 'all';
        }

        const response = await apiGet(API_ENDPOINTS.ENQUIRIES.LIST, params);
        let enquiries = response.data || [];

        // Extra safety: filter by canView permission
        enquiries = enquiries.filter(enquiry => canView(enquiry));

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

            // Enhanced overdue highlighting
            const followUpOverdue = isOverdue(enquiry.followUpDate);
            const followUpClass = followUpOverdue ? 'text-red-600 font-bold bg-red-50 px-2 py-1 rounded' : 'text-gray-600';
            const overdueLabel = followUpOverdue ? '<span class="text-xs text-red-500 ml-1">(Overdue)</span>' : '';

            return `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="px-6 py-4">
                        <div class="font-medium text-gray-900">${enquiry.name || '-'}</div>
                    </td>
                    <td class="px-6 py-4 text-gray-600">${getCourseName(enquiry.course)}</td>
                    <td class="px-6 py-4">${getStatusBadge(enquiry.status)}</td>
                    <td class="px-6 py-4 ${followUpClass}">
                        ${formatDate(enquiry.followUpDate, true)}${overdueLabel}
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
