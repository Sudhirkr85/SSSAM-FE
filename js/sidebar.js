/**
 * Sidebar Toggle Functionality for SSSAM CRM
 * Works on both mobile and desktop
 */

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initSidebar);

function initSidebar() {
    // Mobile menu elements
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const mobileCloseBtn = document.getElementById('mobileCloseBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const sidebar = document.getElementById('sidebar');

    // Mobile menu handlers
    mobileMenuToggle?.addEventListener('click', openMobileMenu);
    mobileCloseBtn?.addEventListener('click', closeMobileMenu);
    mobileOverlay?.addEventListener('click', closeMobileMenu);

    // Close on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMobileMenu();
        }
    });

    function openMobileMenu() {
        sidebar?.classList.remove('-translate-x-full');
        mobileOverlay?.classList.remove('hidden');
        setTimeout(() => mobileOverlay?.classList.remove('opacity-0'), 10);
        document.body.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
        sidebar?.classList.add('-translate-x-full');
        mobileOverlay?.classList.add('opacity-0');
        setTimeout(() => mobileOverlay?.classList.add('hidden'), 300);
        document.body.style.overflow = '';
    }
}

// Desktop Sidebar Toggle
let sidebarCollapsed = false;

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');

    if (!sidebar) return;

    sidebarCollapsed = !sidebarCollapsed;

    if (sidebarCollapsed) {
        sidebar.classList.add('-translate-x-full');
        if (toggleBtn) {
            toggleBtn.innerHTML = '<i data-lucide="panel-right" class="w-5 h-5 text-gray-600"></i>';
            toggleBtn.title = 'Show Sidebar';
        }
    } else {
        sidebar.classList.remove('-translate-x-full');
        if (toggleBtn) {
            toggleBtn.innerHTML = '<i data-lucide="panel-left" class="w-5 h-5 text-gray-600"></i>';
            toggleBtn.title = 'Hide Sidebar';
        }
    }

    // Re-initialize icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Expose to window
window.toggleSidebar = toggleSidebar;
