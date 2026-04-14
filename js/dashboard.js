document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
});

async function loadDashboard() {
    try {
        const res = await apiGet(API_ENDPOINTS.ENQUIRIES.GET_ALL, { limit: 1000 });

        
const data = res.enquiries || [];

document.getElementById('totalEnquiries').textContent = data.length;

const today = new Date().toDateString();

const todayCount = data.filter(e =>
  new Date(e.createdAt).toDateString() === today
).length;

document.getElementById('newEnquiries').textContent = todayCount;

const overdue = data.filter(e =>
  e.followUpDate && new Date(e.followUpDate) < new Date()
).length;

document.getElementById('overdueEnquiries').textContent = overdue;

const converted = data.filter(e => e.status === 'CONVERTED').length;

document.getElementById('convertedEnquiries').textContent = converted;


    } catch {
        showToast('error', 'Dashboard load failed');
    }
}
