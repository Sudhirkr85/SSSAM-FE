let userCoords = null;
let lastPunchType = 'OUT';

document.addEventListener('DOMContentLoaded', async () => {
    // Auth Check
    checkAuth();
    
    // Set UI Details
    setUser();
    setupSidebarLinks();
    
    // Start Live Clock
    startClock();
    
    // Fetch user coords
    requestLocation();
    
    // Load Personal History & Punch States
    await loadPersonalHistory();
});

// Update sidebar visibility based on user role
function setupSidebarLinks() {
    const user = getCurrentUser();
    const isUserAdmin = user.role === 'admin';
    const isUserCounselor = user.role === 'counselor';
    
    if (isUserAdmin || isUserCounselor) {
        document.getElementById('dashboardLink')?.classList.remove('hidden');
        document.getElementById('enquiriesLink')?.classList.remove('hidden');
        document.getElementById('admissionsLink')?.classList.remove('hidden');
        
        if (isUserAdmin) {
            document.getElementById('paymentsLink')?.classList.remove('hidden');
            document.getElementById('reportsLink')?.classList.remove('hidden');
            document.getElementById('adminAttendanceLink')?.classList.remove('hidden');
            document.getElementById('officeSettingsLink')?.classList.remove('hidden');
        }
    } else {
        // Employee: hide everything
        document.getElementById('dashboardLink')?.classList.add('hidden');
        document.getElementById('enquiriesLink')?.classList.add('hidden');
        document.getElementById('admissionsLink')?.classList.add('hidden');
        document.getElementById('paymentsLink')?.classList.add('hidden');
        document.getElementById('reportsLink')?.classList.add('hidden');
    }

    if (document.getElementById('headerUserName')) {
        document.getElementById('headerUserName').textContent = user.name || 'User';
    }
}

// Clock Ticker
function startClock() {
    const clockEl = document.getElementById('liveClock');
    setInterval(() => {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('en-IN');
    }, 1000);
}

// Geolocation Handling
function requestLocation() {
    const geoStatus = document.getElementById('geoStatusText');
    const coordLat = document.getElementById('coordLat');
    const coordLng = document.getElementById('coordLng');
    
    if (!navigator.geolocation) {
        geoStatus.textContent = "Geolocation is not supported by your browser";
        disablePunchButtons();
        return;
    }

    geoStatus.textContent = "Locating...";
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            userCoords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
            
            coordLat.textContent = userCoords.latitude.toFixed(6);
            coordLng.textContent = userCoords.longitude.toFixed(6);
            geoStatus.textContent = "Location locked inside office geofence range";
            geoStatus.className = "text-xs text-emerald-600 mt-1 font-medium";
            
            // Re-evaluate button state based on last punch type
            togglePunchButtons();
        },
        (error) => {
            console.error("GPS access failed:", error);
            geoStatus.textContent = "Location access is required to punch in/out. Please enable location access and try again.";
            geoStatus.className = "text-xs text-red-500 mt-1 font-medium";
            disablePunchButtons();
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}

function disablePunchButtons() {
    document.getElementById('punchInBtn').disabled = true;
    document.getElementById('punchOutBtn').disabled = true;
}

function togglePunchButtons() {
    if (!userCoords) {
        disablePunchButtons();
        return;
    }
    
    const inBtn = document.getElementById('punchInBtn');
    const outBtn = document.getElementById('punchOutBtn');
    const statusText = document.getElementById('punchStatusText');
    
    if (lastPunchType === 'IN') {
        inBtn.disabled = true;
        outBtn.disabled = false;
        statusText.textContent = "You are currently PUNCHED IN";
        statusText.className = "text-lg font-bold text-emerald-600";
    } else {
        inBtn.disabled = false;
        outBtn.disabled = true;
        statusText.textContent = "You are currently PUNCHED OUT";
        statusText.className = "text-lg font-bold text-gray-500";
    }
}

// Load personal history table
async function loadPersonalHistory() {
    const range = document.getElementById('dateFilter').value;
    const tableBody = document.getElementById('logsTableBody');
    
    try {
        const res = await getPersonalAttendanceHistory(range);
        const data = res.data || [];
        
        // Find latest log of today to determine state
        const todayStr = new Date().toISOString().split('T')[0];
        const todayLog = data.find(log => log.date === todayStr);
        
        if (todayLog) {
            if (todayLog.punchIn && !todayLog.punchOut) {
                lastPunchType = 'IN';
            } else {
                lastPunchType = 'OUT';
            }
        } else {
            lastPunchType = 'OUT';
        }
        
        togglePunchButtons();
        
        if (data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-8 text-gray-400">No attendance logs found for this period.</td>
                </tr>
            `;
            return;
        }
        
        tableBody.innerHTML = data.map(log => {
            const punchInTime = log.punchIn ? new Date(log.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-';
            const punchOutTime = log.punchOut ? new Date(log.punchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-';
            
            return `
                <tr class="hover:bg-gray-50 transition-colors">
                    <td class="py-3 px-4 font-medium text-gray-800">${formatDateForDisplay(log.date)}</td>
                    <td class="py-3 px-4 text-emerald-600 font-semibold">${punchInTime}</td>
                    <td class="py-3 px-4 text-rose-600 font-semibold">${punchOutTime}</td>
                    <td class="py-3 px-4 text-right font-bold text-gray-700">${log.totalHours}</td>
                </tr>
            `;
        }).join('');
        
    } catch (err) {
        console.error("Failed to load attendance logs:", err);
        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center py-8 text-red-500">Failed to load attendance log history.</td>
            </tr>
        `;
    }
}

// Trigger punch
async function triggerPunch(type) {
    if (!userCoords) {
        showToast('Error', 'Location access is required to punch in/out. Please enable location access and try again.', 'error');
        return;
    }
    
    const btn = type === 'IN' ? document.getElementById('punchInBtn') : document.getElementById('punchOutBtn');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Processing...';
    lucide.createIcons();
    
    try {
        await punchAttendance(userCoords);
        showToast('Success', `Successfully punched ${type}!`, 'success');
        
        // Reload details
        await loadPersonalHistory();
    } catch (err) {
        console.error("Punch failed:", err);
        const msg = err.response?.data?.message || err.message || "Failed to record punch";
        showToast('Error', msg, 'error');
        
        // Restore buttons
        togglePunchButtons();
    } finally {
        btn.innerHTML = originalText;
        lucide.createIcons();
    }
}

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
});
