document.addEventListener('DOMContentLoaded', () => {
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
    
    // Load Admin data
    loadAdminHistory();
});

async function loadAdminHistory() {
    const search = document.getElementById('adminSearch').value.trim();
    const role = document.getElementById('adminRoleFilter').value;
    const range = document.getElementById('adminDateFilter').value;
    
    const logsTableBody = document.getElementById('adminLogsTableBody');
    const summariesContainer = document.getElementById('summariesContainer');
    
    const params = { range };
    if (search) params.search = search;
    if (role) params.role = role;
    
    try {
        const res = await getAdminAttendanceHistory(params);
        const { history, summary } = res.data || { history: [], summary: [] };
        
        // Render Summary Cards
        if (summary.length === 0) {
            summariesContainer.innerHTML = `
                <div class="col-span-full text-center py-4 text-gray-400">No summaries available for this period.</div>
            `;
        } else {
            summariesContainer.innerHTML = summary.map(userSum => {
                const roleColors = {
                    admin: 'bg-indigo-50 text-indigo-700',
                    counselor: 'bg-emerald-50 text-emerald-700',
                    employee: 'bg-amber-50 text-amber-700'
                };
                const roleClass = roleColors[userSum.role?.toLowerCase()] || 'bg-gray-50 text-gray-700';
                
                return `
                    <div class="stats-card bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col justify-between">
                        <div>
                            <h3 class="font-bold text-gray-800 text-sm truncate">${userSum.name}</h3>
                            <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider mt-1 ${roleClass}">${userSum.role}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-200/50">
                            <div>
                                <p class="text-[10px] text-gray-400 uppercase font-semibold">Days Present</p>
                                <p class="text-sm font-bold text-gray-700">${userSum.daysPresent} days</p>
                            </div>
                            <div>
                                <p class="text-[10px] text-gray-400 uppercase font-semibold">Total Hours</p>
                                <p class="text-sm font-bold text-gray-700">${userSum.totalHours}h</p>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        // Render Records Table
        if (history.length === 0) {
            logsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-12 text-gray-400">No attendance logs match the selected filters.</td>
                </tr>
            `;
            return;
        }
        
        logsTableBody.innerHTML = history.map(log => {
            const punchInTime = log.punchIn ? new Date(log.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-';
            const punchOutTime = log.punchOut ? new Date(log.punchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-';
            
            const roleColors = {
                admin: 'bg-indigo-50 text-indigo-700 border-indigo-100',
                counselor: 'bg-emerald-50 text-emerald-700 border-emerald-100',
                employee: 'bg-amber-50 text-amber-700 border-amber-100'
            };
            const roleClass = roleColors[log.userRole?.toLowerCase()] || 'bg-gray-50 text-gray-700 border-gray-100';

            return `
                <tr class="hover:bg-gray-50/50 transition-colors">
                    <td class="py-3.5 px-4 font-semibold text-gray-800">${log.userName}</td>
                    <td class="py-3.5 px-4">
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleClass}">${log.userRole}</span>
                    </td>
                    <td class="py-3.5 px-4 text-gray-600">${formatDateForDisplay(log.date)}</td>
                    <td class="py-3.5 px-4 text-emerald-600 font-semibold">${punchInTime}</td>
                    <td class="py-3.5 px-4 text-rose-600 font-semibold">${punchOutTime}</td>
                    <td class="py-3.5 px-4 text-right font-bold text-gray-700">${log.totalHours}</td>
                </tr>
            `;
        }).join('');
        
    } catch (err) {
        console.error("Failed to load team attendance logs:", err);
        logsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-12 text-red-500">Failed to retrieve team attendance database records.</td>
            </tr>
        `;
    }
}

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
});
