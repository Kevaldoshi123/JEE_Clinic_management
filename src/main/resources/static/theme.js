/**
 * Care Core Clinic — Global Theme Manager (Light & Dark Mode Sync)
 */

(function () {
    // 1. Initialize Theme on Script Load
    const savedTheme = localStorage.getItem('carecore_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Apply when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        updateThemeToggleUI(savedTheme);
    });
})();

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('carecore_theme', newTheme);
    
    updateThemeToggleUI(newTheme);
}

function updateThemeToggleUI(theme) {
    const btn = document.getElementById('themeToggleBtn');
    if (!btn) return;

    if (theme === 'dark') {
        btn.innerHTML = '<i class="bi bi-sun-fill" style="color:#f59e0b;"></i> Light Mode';
    } else {
        btn.innerHTML = '<i class="bi bi-moon-fill" style="color:#6366f1;"></i> Dark Mode';
    }
}
