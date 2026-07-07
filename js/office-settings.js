let map = null;
let marker = null;
let circle = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Auth check
    checkAuth();
    
    // Ensure only Admin can access
    const user = getCurrentUser();
    if (user.role !== 'admin') {
        window.location.href = 'attendance.html';
        return;
    }
    
    // Set user details
    setUser();
    
    // Load current settings & initialize map
    await initOfficeMap();
});

async function initOfficeMap() {
    const officeLat = document.getElementById('officeLat');
    const officeLng = document.getElementById('officeLng');
    const officeRadius = document.getElementById('officeRadius');
    
    try {
        const res = await getAttendanceOfficeSettings();
        const settings = res.data || { latitude: 28.4595, longitude: 77.0266, radiusMeters: 100 };
        
        const lat = settings.latitude;
        const lng = settings.longitude;
        const radius = settings.radiusMeters;
        
        officeLat.value = lat;
        officeLng.value = lng;
        officeRadius.value = radius;
        
        // Initialize Map
        map = L.map('map').setView([lat, lng], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
        
        // Add Marker (Disabled dragging)
        marker = L.marker([lat, lng], { draggable: false }).addTo(map);
        
        // Add Geofence Circle
        circle = L.circle([lat, lng], {
            color: '#9333ea',
            fillColor: '#c084fc',
            fillOpacity: 0.15,
            radius: radius
        }).addTo(map);
        
        // Dragging and clicking handlers disabled temporarily
        /*
        // Handle Marker Drag
        marker.on('dragend', () => {
            const position = marker.getLatLng();
            updateCoordsFields(position.lat, position.lng);
        });
        
        // Handle Map Click
        map.on('click', (e) => {
            marker.setLatLng(e.latlng);
            updateCoordsFields(e.latlng.lat, e.latlng.lng);
        });
        */
        
        // Handle radius input change
        officeRadius.addEventListener('input', () => {
            const radVal = parseInt(officeRadius.value) || 100;
            circle.setRadius(radVal);
        });
        
    } catch (err) {
        console.error("Failed to initialize geofence map:", err);
        showToast('Error', 'Failed to retrieve geofence configs', 'error');
    }
}

function updateCoordsFields(lat, lng) {
    document.getElementById('officeLat').value = lat;
    document.getElementById('officeLng').value = lng;
    
    // Update Geofence Circle position
    if (circle) {
        circle.setLatLng([lat, lng]);
    }
}

async function saveOfficeLocation() {
    showToast('Info', 'Office location changes are temporarily disabled.', 'info');
    return;
    const lat = parseFloat(document.getElementById('officeLat').value);
    
    const btn = document.getElementById('saveSettingsBtn');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
    lucide.createIcons();
    
    try {
        await updateAttendanceOfficeSettings({
            latitude: lat,
            longitude: lng,
            radiusMeters: radius
        });
        showToast('Success', 'Geofence anchor saved successfully', 'success');
    } catch (err) {
        console.error("Failed to save geofence settings:", err);
        const msg = err.response?.data?.message || err.message || "Failed to update configuration";
        showToast('Error', msg, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
        lucide.createIcons();
    }
}

// Fetch User's Current GPS Location
function getCurrentGPSLocation() {
    showToast('Info', 'Office location changes are temporarily disabled.', 'info');
    return;
    if (!navigator.geolocation) {
        showToast('Error', 'Geolocation is not supported by your browser', 'error');
        return;
    }

    showToast('Info', 'Fetching GPS location...', 'info');

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Center map and update inputs
            if (map && marker) {
                map.setView([lat, lng], 17);
                marker.setLatLng([lat, lng]);
                updateCoordsFields(lat, lng);
                showToast('Success', 'Current location loaded successfully!', 'success');
            }
        },
        (error) => {
            console.error("GPS retrieval failed:", error);
            showToast('Error', 'Unable to retrieve location. Please check browser permissions.', 'error');
        },
        { enableHighAccuracy: true, timeout: 8000 }
    );
}

// Search address using free OpenStreetMap Nominatim API
async function performAddressSearch() {
    showToast('Info', 'Office location changes are temporarily disabled.', 'info');
    return;
    const input = document.getElementById('mapSearchInput');
    const query = input.value.trim();
    
    if (!query) {
        showToast('Error', 'Please enter a search query', 'error');
        return;
    }

    showToast('Info', 'Searching...', 'info');

    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
        const res = await axios.get(url);
        
        if (res.data && res.data.length > 0) {
            const result = res.data[0];
            const lat = parseFloat(result.lat);
            const lng = parseFloat(result.lon);

            // Center map and update fields
            if (map && marker) {
                map.setView([lat, lng], 16);
                marker.setLatLng([lat, lng]);
                updateCoordsFields(lat, lng);
                showToast('Success', `Location found: ${result.display_name.substring(0, 45)}...`, 'success');
            }
        } else {
            showToast('Warning', 'No matching location found', 'warning');
        }
    } catch (err) {
        console.error("Geocoding failed:", err);
        showToast('Error', 'Search request failed', 'error');
    }
}

// Bind Enter key on search input
document.getElementById('mapSearchInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        performAddressSearch();
    }
});

window.getCurrentGPSLocation = getCurrentGPSLocation;
window.performAddressSearch = performAddressSearch;

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
});
