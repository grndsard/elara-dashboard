// Global variables
let currentUser = null;
let authToken = null;

// API base URL
const API_BASE = '/api';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    showLoading();
    
    // Minimum loading time for better UX
    const minLoadTime = 1500;
    const startTime = Date.now();
    
    // Check for password reset token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');
    
    if (resetToken) {
        await ensureMinLoadTime(startTime, minLoadTime);
        showResetPasswordPage(resetToken);
        hideLoading();
        return;
    }
    
    const token = localStorage.getItem('authToken');
    if (token) {
        try {
            const response = await fetch(`${API_BASE}/profile`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                currentUser = data.data;
                authToken = token;
                
                console.log('User loaded:', currentUser);
                
                await ensureMinLoadTime(startTime, minLoadTime);
                
                if (currentUser.force_password_change) {
                    showForcePasswordChangeModal();
                    showMainApp();
                } else {
                    showMainApp();
                }
            } else {
                localStorage.removeItem('authToken');
                await ensureMinLoadTime(startTime, minLoadTime);
                showLoginPage();
            }
        } catch (error) {
            localStorage.removeItem('authToken');
            await ensureMinLoadTime(startTime, minLoadTime);
            showLoginPage();
        }
    } else {
        await ensureMinLoadTime(startTime, minLoadTime);
        showLoginPage();
    }
    
    hideLoading();
}

async function ensureMinLoadTime(startTime, minTime) {
    const elapsed = Date.now() - startTime;
    if (elapsed < minTime) {
        await new Promise(resolve => setTimeout(resolve, minTime - elapsed));
    }
}

function showLoading() {
    document.getElementById('loading-spinner').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-spinner').style.display = 'none';
}

function showLoginPage() {
    hideAllPages();
    document.getElementById('login-page').style.display = 'flex';
}

function showResetPasswordPage(token) {
    hideAllPages();
    const resetPage = document.getElementById('reset-password-page');
    resetPage.style.display = 'flex';
    resetPage.dataset.token = token;
    
    // Clear URL parameters after storing token
    window.history.replaceState({}, document.title, window.location.pathname);
}

function showMainApp() {
    hideAllPages();
    document.getElementById('main-app').style.display = 'flex';
    
    if (currentUser) {
        document.getElementById('user-name').textContent = currentUser.fullname;
        if (currentUser.profile_photo) {
            document.getElementById('user-avatar').src = currentUser.profile_photo;
        }
        
        console.log('showMainApp - Current user:', currentUser);
        
        // Update menu visibility based on role
        setTimeout(() => {
            updateMenuVisibility();
        }, 100);
    }
    
    const path = window.location.pathname.slice(1);
    const pageId = path && document.getElementById(`${path}-page`) ? path : 'dashboard';
    showPage(pageId);
}

function hideAllPages() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('reset-password-page').style.display = 'none';
    document.getElementById('main-app').style.display = 'none';
}

let currentPageId = null;

function showPage(pageId) {
    // Check access permissions
    if (!hasPageAccess(pageId)) {
        showAlert('Access Denied: You do not have permission to access this page', 'error');
        showPage('dashboard'); // Redirect to dashboard
        return;
    }
    
    if (currentPageId === pageId) return;
    currentPageId = pageId;
    
    const pages = document.querySelectorAll('.page-content');
    pages.forEach(page => page.style.display = 'none');
    
    const popupButtons = document.querySelectorAll('.dataset-popup-button, .user-popup-button');
    popupButtons.forEach(btn => btn.style.display = 'none');
    
    if (pageId === 'datasets') {
        const datasetBtn = document.querySelector('.dataset-popup-button');
        if (datasetBtn) datasetBtn.style.display = 'block';
    } else if (pageId === 'users') {
        const userBtn = document.querySelector('.user-popup-button');
        if (userBtn) userBtn.style.display = 'block';
    }
    
    const targetPage = document.getElementById(`${pageId}-page`);
    if (targetPage) {
        targetPage.style.display = 'block';
    }
    
    updateActiveMenu(pageId);
    
    setTimeout(() => {
        switch(pageId) {
            case 'dashboard':
                if (typeof loadDashboardData === 'function') loadDashboardData();
                break;
            case 'users':
                if (typeof initializeUsersPage === 'function') {
                    initializeUsersPage();
                } else if (typeof loadUsers === 'function') {
                    loadUsers();
                }
                break;
            case 'datasets':
                if (typeof loadDatasets === 'function') loadDatasets();
                break;
            case 'audit':
                if (typeof initializeAuditPage === 'function') {
                    initializeAuditPage();
                } else if (typeof loadAuditTrail === 'function') {
                    loadAuditTrail();
                }
                break;
            case 'profile':
                if (typeof loadProfile === 'function') loadProfile();
                break;
        }
    }, 100);
}

function updateActiveMenu(pageId) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    // Handle dropdown menu items
    if (['users', 'datasets', 'audit'].includes(pageId)) {
        const dropdownParent = document.querySelector('.nav-dropdown .nav-item');
        if (dropdownParent) dropdownParent.classList.add('active');
    } else {
        const activeItem = document.querySelector(`[data-page="${pageId}"]`);
        if (activeItem) activeItem.classList.add('active');
    }
    
    history.pushState(null, '', `/${pageId}`);
}

async function logout() {
    // Clear authentication data
    localStorage.removeItem('authToken');
    currentUser = null;
    authToken = null;
    
    // Clear any cached data
    clearCache();
    
    // Reset form states
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.reset();
    
    // Close any open modals
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.display = 'none';
        modal.classList.remove('animate__animated', 'animate__fadeIn');
    });
    
    // Reset page state
    currentPageId = null;
    
    // Show login page
    showLoginPage();
    
    // Clear URL
    window.history.replaceState({}, document.title, '/');
}

function clearCache() {
    localStorage.removeItem('dashboardData');
    localStorage.removeItem('userData');
}

async function apiRequest(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        }
    };
    
    const finalOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, finalOptions);
        
        if (response.status === 401) {
            localStorage.removeItem('authToken');
            showLoginPage();
            throw new Error('Authentication required');
        }
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Non-JSON response:', text);
            throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

function showAlert(message, type = 'info', duration = 5000) {
    const alertTypes = {
        success: 'success',
        error: 'error',
        warning: 'warning',
        info: 'info'
    };
    
    Swal.fire({
        title: type.charAt(0).toUpperCase() + type.slice(1),
        text: message,
        icon: alertTypes[type] || 'info',
        timer: duration,
        showConfirmButton: duration === 0,
        toast: true,
        position: 'top-end'
    });
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR'
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showUploadDatasetModal() {
    document.getElementById('upload-dataset-modal').style.display = 'block';
}

function closeUploadDatasetModal() {
    document.getElementById('upload-dataset-modal').style.display = 'none';
}

function showForcePasswordChangeModal() {
    document.getElementById('force-password-change-modal').style.display = 'block';
}

function hideForcePasswordChangeModal() {
    document.getElementById('force-password-change-modal').style.display = 'none';
}

// Add event listeners for navigation
document.addEventListener('DOMContentLoaded', function() {
    // Navigation event listeners
    document.addEventListener('click', function(e) {
        if (e.target.matches('[data-page]')) {
            e.preventDefault();
            const pageId = e.target.dataset.page;
            showPage(pageId);
        }
        if (e.target.matches('[data-action="logout"]')) {
            e.preventDefault();
            logout();
        }
        if (e.target.matches('[data-action="upload-dataset"]')) {
            e.preventDefault();
            console.log('Upload dataset button clicked');
            console.log('window.datasets:', window.datasets);
            console.log('showUploadDatasetModal function:', typeof showUploadDatasetModal);
            
            if (typeof window.datasets?.showUploadDatasetModal === 'function') {
                console.log('Using window.datasets.showUploadDatasetModal');
                window.datasets.showUploadDatasetModal();
            } else if (typeof showUploadDatasetModal === 'function') {
                console.log('Using global showUploadDatasetModal');
                showUploadDatasetModal();
            } else {
                console.error('No upload modal function found');
                // Fallback - directly show modal
                const modal = document.getElementById('upload-dataset-modal');
                if (modal) {
                    modal.style.display = 'block';
                } else {
                    console.error('Upload modal element not found');
                }
            }
        }
    });
    
    // Handle popstate for browser navigation
    window.addEventListener('popstate', function() {
        const path = window.location.pathname.slice(1);
        if (path && document.getElementById(`${path}-page`)) {
            showPage(path);
        } else {
            showPage('dashboard');
        }
    });
    
    // Prevent direct URL access to unauthorized pages
    window.addEventListener('beforeunload', function() {
        if (currentUser && currentUser.role === 'user') {
            const currentPath = window.location.pathname.slice(1);
            if (!hasPageAccess(currentPath)) {
                window.history.replaceState({}, '', '/dashboard');
            }
        }
    });
});

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Password validation function
function validatePassword(password) {
    const errors = [];
    
    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
    }
    if (!/[@$!%*?&]/.test(password)) {
        errors.push('Password must contain at least one special character (@$!%*?&)');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// Modal helper functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        modal.classList.add('animate__animated', 'animate__fadeIn');
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('animate__animated', 'animate__fadeIn');
    }
}

// Password visibility toggle
function togglePassword(fieldId) {
    const field = document.getElementById(fieldId);
    const button = field.nextElementSibling;
    const icon = button.querySelector('i');
    
    if (field.type === 'password') {
        field.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        field.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// Export functions
window.app = {
    apiRequest,
    showAlert,
    formatCurrency,
    formatDate,
    showPage,
    logout,
    debounce,
    validatePassword,
    showModal,
    hideModal
};

// Role-based access control
function hasPageAccess(pageId) {
    if (!currentUser) return false;
    
    // Admin has access to all pages
    if (currentUser.role === 'admin') return true;
    
    // Regular users only have access to dashboard and ask-data
    const userAllowedPages = ['dashboard', 'ask-data', 'profile'];
    return userAllowedPages.includes(pageId);
}

function updateMenuVisibility() {
    if (!currentUser) {
        console.log('No current user found');
        return;
    }
    
    console.log('updateMenuVisibility - Current user:', currentUser);
    console.log('updateMenuVisibility - User role:', currentUser.role);
    
    const masterDataDropdown = document.getElementById('master-data-menu');
    console.log('Master data menu element:', masterDataDropdown);
    
    if (masterDataDropdown) {
        // Always show for admin, hide for regular users
        if (currentUser.role === 'admin') {
            masterDataDropdown.style.display = '';
            masterDataDropdown.style.visibility = 'visible';
            console.log('✅ Master Data menu SHOWN for admin');
        } else {
            masterDataDropdown.style.display = 'none';
            console.log('❌ Master Data menu HIDDEN for user');
        }
    } else {
        console.error('❌ Master Data menu element NOT FOUND');
    }
}

// Debug function to test menu visibility
function testMenuVisibility() {
    console.log('=== MENU VISIBILITY TEST ===');
    console.log('Current user:', currentUser);
    const menu = document.getElementById('master-data-menu');
    console.log('Menu element:', menu);
    if (menu) {
        menu.style.display = 'block';
        menu.style.visibility = 'visible';
        console.log('Menu forced to show');
    }
}

// Make functions globally available
window.togglePassword = togglePassword;
window.testMenuVisibility = testMenuVisibility;