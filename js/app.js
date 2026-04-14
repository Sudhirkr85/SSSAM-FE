/* ======================
GLOBAL APP INIT
====================== */

document.addEventListener('DOMContentLoaded', () => {
    highlightActiveMenu();
});

/* ======================
ACTIVE MENU
====================== */
function highlightActiveMenu() {
    const path = window.location.pathname.split('/').pop();

    document.querySelectorAll('.nav-item').forEach(link => {
        const href = link.getAttribute('href');

        
if (href === path) {
  link.classList.add('bg-blue-600', 'text-white');
} else {
  link.classList.remove('bg-blue-600', 'text-white');
}


    });
}

/* ======================
CLICK ROW NAVIGATION (OPTIONAL)
====================== */
function goToEnquiry(id) {
    window.location.href = `enquiry-detail.html?id=${id}`;
}

/* ======================
SAFE PARSE JSON
====================== */
function safeJSONParse(data) {
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

window.goToEnquiry = goToEnquiry;
