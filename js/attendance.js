let userCoords = null;
let lastPunchType = 'OUT';
let miniMap = null;
let userMarker = null;
let officeCircle = null;

const _initDate = new Date();
let currentYear = _initDate.getFullYear();
let currentMonth = _initDate.getMonth(); // 0-indexed
let selectedCustomMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

document.addEventListener('DOMContentLoaded', async () => {
    // Auth Check
    checkAuth();
    
    // Set UI Details
    setUser();
    setupSidebarLinks();
    
    // Start Live Clock
    startClock();
    
    // Set default month in month picker input
    const monthPicker = document.getElementById('attendanceMonthPicker');
    if (monthPicker) {
        monthPicker.value = selectedCustomMonth;
    }
    
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
            document.getElementById('reportsLink')?.classList.remove('hidden');
            document.getElementById('adminAttendanceLink')?.classList.remove('hidden');
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
                        window.isWithinGeofence = true;
                    } else {
                        geoStatus.textContent = `Out of range (${Math.round(distanceMeters)}m from office. Max: ${settings.radiusMeters}m)`;
                        geoStatus.className = "text-xs text-rose-500 mt-1 font-medium";
                        window.isWithinGeofence = false;
                    }


                }
            } catch (err) {
                console.error("Failed to compute client-side distance:", err);
                geoStatus.textContent = "Location locked inside office geofence range";
                geoStatus.className = "text-xs text-emerald-600 mt-1 font-medium";
                window.isWithinGeofence = true;
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

    // Dynamic Geofence disabling check
    if (window.isWithinGeofence === false) {
        btn.disabled = true;
        btn.className = "w-full py-3.5 px-4 bg-rose-100 text-rose-500 font-semibold rounded-xl cursor-not-allowed flex items-center justify-center gap-2 border border-rose-200";
        btn.innerHTML = '<i data-lucide="map-pin-off" class="w-5 h-5"></i> <span>Out of Geofence Range</span>';
        
        statusText.textContent = "Punch Action Disabled: Out of Geofence";
        statusText.className = "text-sm font-semibold text-rose-600";
        
        if (circleStatus) circleStatus.textContent = "OUT";
        setStatusProgress(0);
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
        const isResume = Boolean(window.hasPunchedOutToday);
        btn.className = "w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2";
        btn.innerHTML = `<i data-lucide="log-in" class="w-5 h-5"></i> <span>${isResume ? 'Punch In Again (Resume)' : 'Punch In'}</span>`;
        
        statusText.textContent = isResume ? "Punched Out — Click to Resume / Punch In Again" : "You are currently PUNCHED OUT";
        statusText.className = isResume ? "text-sm font-bold text-indigo-600" : "text-lg font-bold text-gray-500";
        
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
    
    // Confirmation specifically when punching Out
    if (type === 'OUT') {
        const confirmPunchOut = confirm("Are you sure you want to Punch Out? (You can punch in again anytime today to resume your shift).");
        if (!confirmPunchOut) {
            return; // Cancel execution
        }
    }

    const btn = document.getElementById('punchActionBtn');
    
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Processing...';
    lucide.createIcons();
    
    try {
        const res = await punchAttendance(userCoords);
        const serverMsg = res.message || res.data?.message;
        const msg = serverMsg || `Successfully punched ${type === 'IN' ? 'In' : 'Out'}!`;
        showToast('Success', msg, 'success');
        
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

function switchAttendanceMainTab(tabName) {
    const punchTabBtn = document.getElementById('mainTabPunch');
    const logsTabBtn = document.getElementById('mainTabLogs');
    const punchPanel = document.getElementById('attendancePunchTab');
    const logsPanel = document.getElementById('attendanceLogsTab');

    if (tabName === 'logs') {
        punchTabBtn?.classList.remove('bg-purple-600', 'text-white', 'shadow-md', 'shadow-purple-600/10');
        punchTabBtn?.classList.add('text-gray-500', 'hover:text-gray-800', 'hover:bg-gray-50');
        
        logsTabBtn?.classList.add('bg-purple-600', 'text-white', 'shadow-md', 'shadow-purple-600/10');
        logsTabBtn?.classList.remove('text-gray-500', 'hover:text-gray-800', 'hover:bg-gray-50');

        punchPanel?.classList.replace('block', 'hidden');
        logsPanel?.classList.replace('hidden', 'block');
    } else {
        logsTabBtn?.classList.remove('bg-purple-600', 'text-white', 'shadow-md', 'shadow-purple-600/10');
        logsTabBtn?.classList.add('text-gray-500', 'hover:text-gray-800', 'hover:bg-gray-50');
        
        punchTabBtn?.classList.add('bg-purple-600', 'text-white', 'shadow-md', 'shadow-purple-600/10');
        punchTabBtn?.classList.remove('text-gray-500', 'hover:text-gray-800', 'hover:bg-gray-50');

        logsPanel?.classList.replace('block', 'hidden');
        punchPanel?.classList.replace('hidden', 'block');
    }
}

window.switchAttendanceMainTab = switchAttendanceMainTab;



function onAttendanceMonthChange(value) {
    if (!value) return;
    selectedCustomMonth = value;
    loadPersonalHistory();
}

window.onAttendanceMonthChange = onAttendanceMonthChange;

let activePersonalView = 'table'; // 'table' or 'calendar'

function switchPersonalView(viewType) {
    activePersonalView = viewType;
    
    const tableTab = document.getElementById('viewTabTable');
    const calendarTab = document.getElementById('viewTabCalendar');
    const tableViewEl = document.getElementById('personalTableView');
    const calendarViewEl = document.getElementById('personalCalendarView');

    if (viewType === 'calendar') {
        tableTab?.classList.remove('bg-white', 'text-purple-600', 'shadow-sm');
        tableTab?.classList.add('text-gray-500', 'hover:text-gray-800');
        
        calendarTab?.classList.add('bg-white', 'text-purple-600', 'shadow-sm');
        calendarTab?.classList.remove('text-gray-500', 'hover:text-gray-800');

        tableViewEl?.classList.add('hidden');
        calendarViewEl?.classList.remove('hidden');
        calendarViewEl?.classList.add('flex');
    } else {
        calendarTab?.classList.remove('bg-white', 'text-purple-600', 'shadow-sm');
        calendarTab?.classList.add('text-gray-500', 'hover:text-gray-800');
        
        tableTab?.classList.add('bg-white', 'text-purple-600', 'shadow-sm');
        tableTab?.classList.remove('text-gray-500', 'hover:text-gray-800');

        calendarViewEl?.classList.add('hidden');
        tableViewEl?.classList.remove('hidden');
    }
    loadPersonalHistory();
}

window.switchPersonalView = switchPersonalView;

// Load personal history table and calendar visual grid
async function loadPersonalHistory() {
    const tableBody = document.getElementById('logsTableBody');
    const calendarGrid = document.getElementById('personalCalendarGrid');
    
    // Always use selectedCustomMonth (from month picker)
    if (selectedCustomMonth) {
        const [y, m] = selectedCustomMonth.split('-');
        currentYear = parseInt(y);
        currentMonth = parseInt(m) - 1;
    } else {
        const today = new Date();
        currentYear = today.getFullYear();
        currentMonth = today.getMonth();
    }
    const queryParam = `custom_${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    try {
        const res = await getPersonalAttendanceHistory(queryParam);
        const data = res.data || [];
        
        // Find latest log of today to determine state
        const todayStr = new Date().toISOString().split('T')[0];
        let todayLog = data.find(log => log.date === todayStr);

        // If currently viewing a different month in table/calendar, fetch today's actual status for the live punch console
        const actualCurMonthStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        if (!todayLog && selectedCustomMonth !== actualCurMonthStr) {
            try {
                const curRes = await getPersonalAttendanceHistory(`custom_${actualCurMonthStr}`);
                const curData = curRes.data || [];
                todayLog = curData.find(log => log.date === todayStr);
            } catch (e) {
                console.warn("Could not fetch current month today log:", e);
            }
        }
        
        let hasPunchedOutToday = false;
        if (todayLog) {
            if (todayLog.punchIn && !todayLog.punchOut) {
                lastPunchType = 'IN';
            } else if (todayLog.punchIn && todayLog.punchOut) {
                lastPunchType = 'OUT';
                hasPunchedOutToday = true; // Recorded OUT, but can re-punch in (First IN to Last OUT)
            } else {
                lastPunchType = 'OUT';
            }
        } else {
            lastPunchType = 'OUT';
        }

        // Scan yesterday's log to check for missing punch-out
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const yesterdayLog = data.find(log => log.date === yesterdayStr);

        if (yesterdayLog && yesterdayLog.punchIn && !yesterdayLog.punchOut) {
            // Display alert banner or warning toast
            setTimeout(() => {
                showToast('Warning', 'You forgot to Punch Out yesterday! Please inform your Admin to rectify the logs.', 'error');
            }, 1000);
        }
        
        window.hasPunchedOutToday = hasPunchedOutToday;
        togglePunchButtons();
        
        // 1. Populate Table List View
        if (data.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-8 text-gray-400">No attendance logs found for this period.</td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = data.map(log => {
                let punchInTime = log.punchIn ? new Date(log.punchIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-';
                let punchOutTime = log.punchOut ? new Date(log.punchOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-';
                let totalHoursText = log.totalHours || '-';

                if (log.specialStatus === 'LEAVE') {
                    punchInTime = `<span class="inline-flex px-2 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-100 uppercase tracking-wider">Leave</span>`;
                    punchOutTime = `-`;
                    totalHoursText = `-`;
                } else if (log.specialStatus === 'WEEKOFF') {
                    punchInTime = `<span class="inline-flex px-2 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-wider">Weekoff</span>`;
                    punchOutTime = `-`;
                    totalHoursText = `-`;
                } else if (!log.punchIn && !log.punchOut) {
                    punchInTime = `<span class="inline-flex px-2 py-1 rounded-md text-xs font-semibold bg-gray-50 text-gray-500 border border-gray-100 uppercase tracking-wider">Absent</span>`;
                    punchOutTime = `-`;
                    totalHoursText = `-`;
                }
                
                return `
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="py-3 px-4 font-medium text-gray-800">${formatDateForDisplay(log.date)}</td>
                        <td class="py-3 px-4 font-semibold">${punchInTime}</td>
                        <td class="py-3 px-4 font-semibold">${punchOutTime}</td>
                        <td class="py-3 px-4 text-right font-bold text-gray-700">${totalHoursText}</td>
                    </tr>
                `;
            }).join('');
        }

        // 2. Populate Calendar Grid View (If Calendar is Active)
        if (calendarGrid) {
            const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
            let startDayIndex = firstDayOfMonth.getDay(); // 0-6 (Sun-Sat)
            startDayIndex = startDayIndex === 0 ? 6 : startDayIndex - 1; // Align Mon=0, Sun=6

            const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
            let gridHtml = '';
            
            let presentCount = 0;
            let absentCount = 0;
            let leaveCount = 0;
            let weekoffCount = 0;

            const todayLimit = new Date();
            todayLimit.setHours(23, 59, 59, 999);

            // Blank padding offset days
            for (let i = 0; i < startDayIndex; i++) {
                gridHtml += `<div class="bg-gray-50 border border-dashed border-gray-100 rounded-lg min-h-[60px] opacity-40"></div>`;
            }

            // Days blocks
            const weekdaysShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            for (let day = 1; day <= totalDays; day++) {
                const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const matchingLog = data.find(log => log.date === dateString);

                // Determine weekday name for this specific day
                const currentDayOfWeek = new Date(currentYear, currentMonth, day).getDay(); // 0 (Sun) - 6 (Sat)
                const alignedIndex = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
                const weekdayLabel = weekdaysShort[alignedIndex];

                let dayColorClass = 'bg-gray-100 text-gray-500 hover:bg-purple-50 hover:text-purple-600 border border-gray-200/60';
                let timeSummary = '';

                if (matchingLog) {
                    const isUpdated = matchingLog.updatedByAdmin === true;
                    if (matchingLog.specialStatus === 'LEAVE') {
                        leaveCount++;
                        dayColorClass = isUpdated ? 'bg-sky-600 text-white border-sky-700 shadow-sm' : 'bg-amber-500 text-white border-amber-600';
                        timeSummary = `<div class="text-[10px] mt-1 font-semibold uppercase tracking-wider text-amber-100 opacity-90">Leave${isUpdated ? ' (Admin)' : ''}</div>`;
                    } else if (matchingLog.specialStatus === 'WEEKOFF') {
                        weekoffCount++;
                        dayColorClass = isUpdated ? 'bg-sky-700 text-white border-sky-800 shadow-sm' : 'bg-indigo-500 text-white border-indigo-600';
                        timeSummary = `<div class="text-[10px] mt-1 font-semibold uppercase tracking-wider text-indigo-100 opacity-90">Weekoff${isUpdated ? ' (Admin)' : ''}</div>`;
                    } else if (matchingLog.punchIn) {
                        presentCount++;
                        dayColorClass = isUpdated ? 'bg-sky-500 text-white border-sky-600 shadow-sm' : 'bg-emerald-500 text-white border-emerald-600';
                        const inStr = new Date(matchingLog.punchIn).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'});
                        const todayStr = new Date().toISOString().split('T')[0];
                        const isPastDate = matchingLog.date < todayStr;
                        const outStr = matchingLog.punchOut 
                            ? new Date(matchingLog.punchOut).toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'}) 
                            : (isPastDate ? '<span class="text-red-200 font-bold">Missing</span>' : 'Active');
                        timeSummary = `
                            <div class="text-[9px] mt-0.5 text-emerald-50 font-medium">In: ${inStr}</div>
                            <div class="text-[9px] text-emerald-50 font-medium">Out: ${outStr}</div>
                            ${isUpdated ? '<div class="text-[8px] font-bold text-sky-100 uppercase tracking-widest mt-0.5">Admin Edit</div>' : ''}
                        `;
                    }
                } else {
                    const checkDate = new Date(currentYear, currentMonth, day);
                    if (checkDate <= todayLimit) {
                        absentCount++;
                    }
                    timeSummary = `<div class="text-[10px] mt-1 text-gray-400 font-medium">Absent</div>`;
                }

                gridHtml += `
                    <div class="min-h-[65px] rounded-lg flex flex-col justify-between p-1.5 font-bold transition-all shadow-sm ${dayColorClass}">
                        <div class="flex justify-between w-full text-[10px] opacity-90">
                            <span>${day}</span>
                            <span class="font-normal text-[9px] uppercase tracking-wider">${weekdayLabel}</span>
                        </div>
                        <div class="text-left w-full mt-auto">${timeSummary}</div>
                    </div>
                `;
            }

            calendarGrid.innerHTML = gridHtml;

            // Update Summary Stats DOM Elements
            const statPresent = document.getElementById('statPresent');
            const statAbsent = document.getElementById('statAbsent');
            const statLeave = document.getElementById('statLeave');
            const statWeekoff = document.getElementById('statWeekoff');

            if (statPresent) statPresent.textContent = `${presentCount} ${presentCount === 1 ? 'Day' : 'Days'}`;
            if (statAbsent) statAbsent.textContent = `${absentCount} ${absentCount === 1 ? 'Day' : 'Days'}`;
            if (statLeave) statLeave.textContent = `${leaveCount} ${leaveCount === 1 ? 'Day' : 'Days'}`;
            if (statWeekoff) statWeekoff.textContent = `${weekoffCount} ${weekoffCount === 1 ? 'Day' : 'Days'}`;
        }
        
    } catch (err) {
        console.error("Failed to load attendance history:", err);
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-red-500">Failed to load logs.</td></tr>`;
        if (calendarGrid) {
            calendarGrid.innerHTML = `<div class="col-span-7 text-center py-12 text-rose-500">Failed to load calendar grid.</div>`;
        }
    }
}

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
});
