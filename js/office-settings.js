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
        
        // Add Marker
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);
        
        // Add Geofence Circle
        circle = L.circle([lat, lng], {
            color: '#9333ea',
            fillColor: '#c084fc',
            fillOpacity: 0.15,
            radius: radius
        }).addTo(map);
        
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
    const lat = parseFloat(document.getElementById('officeLat').value);
    const lng = parseFloat(document.getElementById('officeLng').value);
    const radius = parseInt(document.getElementById('officeRadius').value) || 100;
    
    if (isNaN(lat) || isNaN(lng)) {
        showToast('Error', 'Please pin a coordinate on the map first', 'error');
        return;
    }
    
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

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
});
