// =====================
// MAIN.JS
// Page switching logic
// =====================

function switchPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // Show selected page
    document.getElementById('page-' + pageId).classList.add('active');

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`.nav-link[data-page="${pageId}"]`).classList.add('active');

    // Redraw charts for the active page
    if (pageId === 'age') { if (typeof applyAgeFilters === 'function') applyAgeFilters(); }
    if (pageId === 'location') { if (typeof applyLocFilters === 'function') applyLocFilters(); }
    if (pageId === 'drugs') { if (typeof applyDrugFilters === 'function') applyDrugFilters(); }
    if (pageId === 'state') { if (typeof applyFilters === 'function') applyFilters(); }
}

// Nav link click handlers
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        switchPage(this.dataset.page);
    });
});

// Resize — redraw active page charts
window.addEventListener('resize', () => {
    const activePage = document.querySelector('.page.active').id.replace('page-', '');
    switchPage(activePage);
});