// =====================
// MAIN.JS — Page switching
// =====================

function switchPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // Show selected
    document.getElementById('page-' + pageId).classList.add('active');
    // Update nav
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector(`.nav-link[data-page="${pageId}"]`).classList.add('active');
    // Scroll to top
    window.scrollTo(0, 0);
    // Redraw charts
    if (pageId === 'fines')  { if (typeof applyFinesFilters  === 'function') applyFinesFilters(); }
    if (pageId === 'drugs')  { if (typeof applyDrugFilters   === 'function') applyDrugFilters(); }
    if (pageId === 'breath') { if (typeof applyBreathFilters === 'function') applyBreathFilters(); }
}

// Nav click handlers
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        switchPage(this.dataset.page);
    });
});

// Resize — redraw active page
window.addEventListener('resize', () => {
    const active = document.querySelector('.page.active');
    if (active) {
        const pageId = active.id.replace('page-', '');
        if (pageId === 'fines')  { if (typeof applyFinesFilters  === 'function') applyFinesFilters(); }
        if (pageId === 'drugs')  { if (typeof applyDrugFilters   === 'function') applyDrugFilters(); }
        if (pageId === 'breath') { if (typeof applyBreathFilters === 'function') applyBreathFilters(); }
    }
});