// State to hold current calendar parameters
let currentYear = 2026;
let currentMonth = 6; // July (0-indexed: 6)
let selectedCustomMonth = '2026-07';
let allUsersList = [];
let attendanceLogs = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Auth check
    checkAuth();
    
    // Ensure only Admin can access
    const user = getCurrentUser();
    if (user.role !== 'admin') {
        window.location.href = 'attendance.html';
        return;
    }
    
    // Set user stats
    setUser();
    
    // Set default month in month picker input
    const monthPicker = document.getElementById('adminMonthPicker');
    if (monthPicker) {
        monthPicker.value = '2026-07';
    }

    // Load users list first
    try {
        const res = await listAllUsers();
        allUsersList = res.data?.users || res.users || [];
        populateEmployeeSelect();
    } catch (e) {
        console.error("Failed to load users list", e);
    }
    
    // Load Admin data
    loadAdminHistory();
});

function populateEmployeeSelect() {
    const select = document.getElementById('adminEmployeeSelect');
    if (!select) return;

    // Display all users, including Administrators
    const employees = allUsersList;
    
    let html = '<option value="">-- Select Employee --</option>';
    employees.forEach(emp => {
        html += `<option value="${emp._id}">${emp.name} (${emp.role.toUpperCase()})</option>`;
    });
    select.innerHTML = html;
}

async function loadAdminHistory() {
    const selectedUserId = document.getElementById('adminEmployeeSelect').value;
    const summariesContainer = document.getElementById('summariesContainer');
    const gridBody = document.getElementById('attendanceGridBody');
    
    if (!selectedUserId) {
        summariesContainer.innerHTML = `<div class="col-span-full text-center py-4 text-gray-400">Please select an employee to view details</div>`;
        gridBody.innerHTML = `<div class="col-span-7 text-center py-12 text-gray-400">Please select an employee to view calendar</div>`;
        return;
    }

    const selectedEmp = allUsersList.find(u => u._id === selectedUserId);
    if (!selectedEmp) return;

    let queryParam = 'thisMonth';
    if (selectedCustomMonth) {
        queryParam = `custom_${selectedCustomMonth}`;
        const [y, m] = selectedCustomMonth.split('-');
        currentYear = parseInt(y);
        currentMonth = parseInt(m) - 1;
    } else {
        const today = new Date();
        currentYear = today.getFullYear();
        currentMonth = today.getMonth();
    }

    // We can narrow down history retrieval to this specific user
    const params = { range: queryParam };
    
    try {
        const res = await getAdminAttendanceHistory(params);
        const { history, summary } = res.data || { history: [], summary: [] };
        attendanceLogs = history || [];
        
        // Render Summary for Selected Employee
        const empSummary = summary.find(s => s.name === selectedEmp.name) || {
            name: selectedEmp.name,
            role: selectedEmp.role,
            daysPresent: 0,
            totalHours: 0
        };

        const roleColors = {
            admin: 'bg-indigo-50 text-indigo-700',
            counselor: 'bg-emerald-50 text-emerald-700',
            employee: 'bg-amber-50 text-amber-700'
        };
        const roleClass = roleColors[empSummary.role?.toLowerCase()] || 'bg-gray-50 text-gray-700';

        summariesContainer.innerHTML = `
            <div class="stats-card bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col justify-between col-span-full max-w-sm">
                <div>
                    <h3 class="font-bold text-gray-800 text-sm truncate">${empSummary.name}</h3>
                    <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider mt-1 ${roleClass}">${empSummary.role}</span>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-200/50">
                    <div>
                        <p class="text-[10px] text-gray-400 uppercase font-semibold">Days Present</p>
                        <p class="text-sm font-bold text-gray-700">${empSummary.daysPresent} days</p>
                    </div>
                    <div>
                        <p class="text-[10px] text-gray-400 uppercase font-semibold">Total Hours</p>
                        <p class="text-sm font-bold text-gray-700">${empSummary.totalHours}h</p>
                    </div>
                </div>
            </div>
        `;

        // Render Calendar Grid matrix
        // Find which day of the week the 1st of this month starts on
        // JS Date.getDay() gives 0 (Sunday) to 6 (Saturday). We align it so Monday is index 0.
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
        let startDayIndex = firstDayOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
        // Convert to Mon=0, Tue=1, ..., Sun=6
        startDayIndex = startDayIndex === 0 ? 6 : startDayIndex - 1;

        const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        let gridHtml = '';

        // 1. Add blank padding blocks for previous month overflow (offset days)
        for (let i = 0; i < startDayIndex; i++) {
            gridHtml += `<div class="bg-gray-50 border border-dashed border-gray-100 rounded-xl min-h-[75px] opacity-40"></div>`;
        }

        // 2. Generate Days
        for (let day = 1; day <= totalDays; day++) {
            const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const matchingLog = attendanceLogs.find(log => log.userId === selectedUserId && log.date === dateString);

            let dayColorClass = 'bg-gray-100 text-gray-500 hover:bg-purple-50 hover:text-purple-600 border border-gray-200/60';
            let titleAttr = `Date: ${day}/${currentMonth+1}/${currentYear} - Absent/No Record. Click to configure.`;
            let timeSummary = '';

            if (matchingLog) {
                if (matchingLog.specialStatus === 'LEAVE') {
                    dayColorClass = 'bg-amber-500 text-white border-amber-600';
                    titleAttr = `Date: ${day}/${currentMonth+1}/${currentYear} - LEAVE. Click to edit.`;
                    timeSummary = `<div class="text-[10px] mt-1 font-semibold uppercase tracking-wider text-amber-100 opacity-90">Leave</div>`;
                } else if (matchingLog.specialStatus === 'WEEKOFF') {
                    dayColorClass = 'bg-indigo-500 text-white border-indigo-600';
                    titleAttr = `Date: ${day}/${currentMonth+1}/${currentYear} - WEEKOFF. Click to edit.`;
                    timeSummary = `<div class="text-[10px] mt-1 font-semibold uppercase tracking-wider text-indigo-100 opacity-90">Weekoff</div>`;
                } else if (matchingLog.punchIn) {
                    dayColorClass = 'bg-emerald-500 text-white border-emerald-600';
                    const inStr = new Date(matchingLog.punchIn).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'});
                    const outStr = matchingLog.punchOut ? new Date(matchingLog.punchOut).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}) : 'Active';
                    titleAttr = `Date: ${day}/${currentMonth+1}/${currentYear} - Present\nIn: ${inStr}\nOut: ${outStr}`;
                    timeSummary = `
                        <div class="text-[9px] mt-1 text-emerald-50 font-medium">In: ${inStr}</div>
                        <div class="text-[9px] text-emerald-50 font-medium">Out: ${outStr}</div>
                    `;
                }
            } else {
                timeSummary = `<div class="text-[10px] mt-1 text-gray-400 font-medium">Absent</div>`;
            }

            gridHtml += `
                <div onclick="openStatusModal('${selectedUserId}', '${selectedEmp.name}', '${dateString}', '${matchingLog ? (matchingLog.specialStatus || 'PRESENT') : 'ABSENT'}', '${matchingLog && matchingLog.punchIn ? new Date(matchingLog.punchIn).toTimeString().substring(0, 5) : ''}', '${matchingLog && matchingLog.punchOut ? new Date(matchingLog.punchOut).toTimeString().substring(0, 5) : ''}')" 
                     title="${titleAttr}" 
                     class="min-h-[60px] rounded-lg flex flex-col justify-between p-1.5 font-bold cursor-pointer transition-all shadow-sm ${dayColorClass}">
                    <span class="text-xs">${day}</span>
                    <div class="text-left w-full mt-auto">${timeSummary}</div>
                </div>
            `;
        }

        gridBody.innerHTML = gridHtml;
        lucide.createIcons();
    } catch (err) {
        console.error("Failed to load visual calendar grid matrix:", err);
        gridBody.innerHTML = `<div class="col-span-7 text-center py-12 text-rose-500">Failed to retrieve attendance logs database records.</div>`;
    }
}



function onAdminMonthChange(value) {
    if (!value) return;
    selectedCustomMonth = value;
    loadAdminHistory();
}

// Modal Toggle and Setting status Handlers
function openStatusModal(userId, name, dateString, currentStatus, inTime, outTime) {
    const selectedEmp = allUsersList.find(u => u._id === userId);
    if (selectedEmp && selectedEmp.role === 'admin') {
        showToast('Info', 'Attendance logs for Administrator accounts cannot be modified.', 'info');
        return;
    }

    document.getElementById('statusUserId').value = userId;
    document.getElementById('statusDate').value = dateString;
    document.getElementById('statusModalSub').textContent = `${name} (${formatDateForDisplay(dateString)})`;
    
    const statusSelect = document.getElementById('dayStatusSelect');
    statusSelect.value = currentStatus;
    
    document.getElementById('statusPunchIn').value = inTime || '';
    document.getElementById('statusPunchOut').value = outTime || '';

    toggleTimeFields(currentStatus);

    const modal = document.getElementById('statusModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.add('opacity-100'), 10);
    lucide.createIcons();
}

function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    modal.classList.remove('opacity-100');
    setTimeout(() => {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }, 200);
}

function toggleTimeFields(val) {
    const timeFields = document.getElementById('timeFields');
    if (val === 'PRESENT') {
        timeFields.classList.remove('hidden');
    } else {
        timeFields.classList.add('hidden');
    }
}

async function submitStatusUpdate(e) {
    e.preventDefault();
    const userId = document.getElementById('statusUserId').value;
    const date = document.getElementById('statusDate').value;
    const statusVal = document.getElementById('dayStatusSelect').value;
    const punchInTime = document.getElementById('statusPunchIn').value;
    const punchOutTime = document.getElementById('statusPunchOut').value;

    const payload = {
        userId,
        date,
        status: statusVal
    };

    if (statusVal === 'PRESENT') {
        payload.punchInTime = punchInTime || undefined;
        payload.punchOutTime = punchOutTime || undefined;
        payload.status = undefined; // Trigger default IN/OUT creation
    }

    try {
        await updateAttendanceRecord(payload);
        showToast('Success', 'Attendance status board updated successfully!', 'success');
        closeStatusModal();
        await loadAdminHistory();
    } catch (err) {
        console.error("Failed to update status board log:", err);
        showToast('Error', err.response?.data?.message || err.message || 'Failed to update record status', 'error');
    }
}

// Expose handlers globally for HTML onClick
window.onAdminMonthChange = onAdminMonthChange;
window.openStatusModal = openStatusModal;
window.closeStatusModal = closeStatusModal;
window.toggleTimeFields = toggleTimeFields;
window.submitStatusUpdate = submitStatusUpdate;

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
});
