let userCoords = null;
let lastPunchType = 'OUT';
let miniMap = null;
let userMarker = null;
let officeCircle = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Auth Check
    checkAuth();
    
    // Set UI Details
    setUser();
    setupSidebarLinks();
    
    // Start Live Clock
    startClock();
    
    // Load Personal History & Punch States first so UI doesn't block
    loadPersonalHistory().then(() => {
        // Fetch user coords asynchronously after UI is interactive
        requestLocation();
    }).catch(err => {
        console.error("Initialization history load failed:", err);
        requestLocation();
    });
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

// Helper: Setup/Update Leaflet mini map for live visualization
function updateMiniMap(userLat, userLng, officeLat, officeLng, radius) {
    try {
        if (!miniMap) {
            // Initial map instance targeting center
            miniMap = L.map('miniMap', { zoomControl: false }).setView([userLat, userLng], 16);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
            }).addTo(miniMap);

            userMarker = L.marker([userLat, userLng]).addTo(miniMap)
                .bindPopup('Your Current Location').openPopup();

            // Circular Geofence marker zone
            officeCircle = L.circle([officeLat, officeLng], {
                color: '#9333ea',
                fillColor: '#c084fc',
                fillOpacity: 0.15,
                radius: radius
            }).addTo(miniMap);
        } else {
            // Re-center maps view and move markers
            userMarker.setLatLng([userLat, userLng]);
            officeCircle.setLatLng([officeLat, officeLng]);
            officeCircle.setRadius(radius);
            
            // Adjust bounds to show both user and geofence anchor circle
            const group = new L.featureGroup([userMarker, officeCircle]);
            miniMap.fitBounds(group.getBounds().pad(0.15));
        }
    } catch (e) {
        console.error("Leaflet rendering error: ", e);
    }
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
        async (position) => {
            userCoords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
            
            coordLat.textContent = userCoords.latitude.toFixed(6);
            coordLng.textContent = userCoords.longitude.toFixed(6);
            
            // Calculate and show distance from office if settings exist
            try {
                const settingsRes = await getAttendanceOfficeSettings();
                const settings = settingsRes.data || settingsRes;
                if (settings && settings.latitude) {
                    // Haversine on Client-side
                    const R = 6371000; // meters
                    const lat1 = userCoords.latitude;
                    const lon1 = userCoords.longitude;
                    const lat2 = settings.latitude;
                    const lon2 = settings.longitude;
                    
                    const dLat = (lat2 - lat1) * Math.PI / 180;
                    const dLon = (lon2 - lon1) * Math.PI / 180;
                    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                              Math.sin(dLon / 2) * Math.sin(dLon / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    const distanceMeters = R * c;

                    // Display distance
                    document.getElementById('coordDistance').textContent = `${Math.round(distanceMeters)}m`;
                    
                    if (distanceMeters <= settings.radiusMeters) {
                        geoStatus.textContent = `Within geofence range (${Math.round(distanceMeters)}m from office)`;
                        geoStatus.className = "text-xs text-emerald-600 mt-1 font-medium";
                    } else {
                        geoStatus.textContent = `Out of range (${Math.round(distanceMeters)}m from office. Max: ${settings.radiusMeters}m)`;
                        geoStatus.className = "text-xs text-rose-500 mt-1 font-medium";
                    }

                    // Render mini dynamic geofence map
                    updateMiniMap(lat1, lon1, lat2, lon2, settings.radiusMeters);
                }
            } catch (err) {
                console.error("Failed to compute client-side distance:", err);
                geoStatus.textContent = "Location locked inside office geofence range";
                geoStatus.className = "text-xs text-emerald-600 mt-1 font-medium";
            }
            
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

// Update Radial Progress Rings Dashoffset parameter
function setStatusProgress(percentage) {
    const circle = document.getElementById('statusProgressCircle');
    if (!circle) return;
    const radius = circle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius; // ~301.6
    const offset = circumference - (percentage / 100) * circumference;
    circle.style.strokeDashoffset = offset;
}

function disablePunchButtons() {
    const btn = document.getElementById('punchActionBtn');
    if (btn) btn.disabled = true;
}

function togglePunchButtons() {
    const btn = document.getElementById('punchActionBtn');
    const statusText = document.getElementById('punchStatusText');
    const circleStatus = document.getElementById('circleStatusShort');
    if (!btn) return;

    if (!userCoords) {
        disablePunchButtons();
        setStatusProgress(0);
        if (circleStatus) circleStatus.textContent = "LOCK";
        return;
    }
    
    // Check if user already finished dynamic transaction session
    if (window.hasCompletedToday) {
        btn.disabled = true;
        btn.className = "w-full py-3.5 px-4 bg-gray-200 text-gray-400 font-semibold rounded-xl cursor-not-allowed flex items-center justify-center gap-2";
        btn.innerHTML = '<i data-lucide="check-circle" class="w-5 h-5"></i> <span>Daily Session Completed</span>';
        
        statusText.textContent = "Attendance Session Completed for Today";
        statusText.className = "text-sm font-semibold text-purple-600";
        
        if (circleStatus) circleStatus.textContent = "DONE";
        setStatusProgress(100);
        lucide.createIcons();
        return;
    }
    
    btn.disabled = false;
    
    if (lastPunchType === 'IN') {
        // Active status IN -> Next action OUT (Red Button)
        btn.className = "w-full py-3.5 px-4 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg shadow-rose-600/20 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2";
        btn.innerHTML = '<i data-lucide="log-out" class="w-5 h-5"></i> <span>Punch Out</span>';
        
        statusText.textContent = "You are currently PUNCHED IN";
        statusText.className = "text-lg font-bold text-emerald-600";
        
        if (circleStatus) circleStatus.textContent = "IN";
        setStatusProgress(60); // 60% dynamic ring completed
    } else {
        // Active status OUT -> Next action IN (Green Button)
        btn.className = "w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2";
        btn.innerHTML = '<i data-lucide="log-in" class="w-5 h-5"></i> <span>Punch In</span>';
        
        statusText.textContent = "You are currently PUNCHED OUT";
        statusText.className = "text-lg font-bold text-gray-500";
        
        if (circleStatus) circleStatus.textContent = "OUT";
        setStatusProgress(20); // 20% dynamic ring completed
    }
    lucide.createIcons();
}

async function handlePunchClick() {
    if (!userCoords) {
        showToast('Error', 'Location access is required to punch in/out. Please enable location access and try again.', 'error');
        return;
    }

    const type = lastPunchType === 'IN' ? 'OUT' : 'IN';
    
    // Add confirmation warning dialog specifically for Punch Out
    if (type === 'OUT') {
        const confirmPunchOut = confirm("Are you sure you want to Punch Out? This will end your attendance session for today.");
        if (!confirmPunchOut) {
            return; // Cancel execution
        }
    }

    const btn = document.getElementById('punchActionBtn');
    const originalContent = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Processing...';
    lucide.createIcons();
    
    try {
        await punchAttendance(userCoords);
        showToast('Success', `Successfully punched ${type === 'IN' ? 'In' : 'Out'}!`, 'success');
        
        // Reload details
        await loadPersonalHistory();
    } catch (err) {
        console.error("Punch failed:", err);
        const msg = err.response?.data?.message || err.message || "Failed to record punch";
        showToast('Error', msg, 'error');
        
        // Restore buttons
        togglePunchButtons();
    } finally {
        btn.disabled = false;
        togglePunchButtons();
    }
}

window.handlePunchClick = handlePunchClick;

let selectedCustomMonth = '';

function onAttendanceMonthChange(value) {
    if (!value) return;
    selectedCustomMonth = value;
    document.getElementById('dateFilter').value = 'thisMonth'; // Reset dropdown selection visually
    loadPersonalHistory();
}

window.onAttendanceMonthChange = onAttendanceMonthChange;

// Load personal history table
async function loadPersonalHistory() {
    let range = document.getElementById('dateFilter').value;
    const tableBody = document.getElementById('logsTableBody');
    
    // If a custom month is selected, construct custom range filters
    let queryParam = range;
    if (selectedCustomMonth) {
        queryParam = `custom_${selectedCustomMonth}`;
    }

    try {
        const res = await getPersonalAttendanceHistory(queryParam);
        const data = res.data || [];
        
        // Find latest log of today to determine state
        const todayStr = new Date().toISOString().split('T')[0];
        const todayLog = data.find(log => log.date === todayStr);
        
        let hasCompletedToday = false;
        if (todayLog) {
            if (todayLog.punchIn && !todayLog.punchOut) {
                lastPunchType = 'IN';
            } else if (todayLog.punchIn && todayLog.punchOut) {
                lastPunchType = 'OUT';
                hasCompletedToday = true; // Block punch action for today
            } else {
                lastPunchType = 'OUT';
            }
        } else {
            lastPunchType = 'OUT';
        }
        
        window.hasCompletedToday = hasCompletedToday;
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

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
});
