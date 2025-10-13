// Authentication handling

// Login form handler
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        app.showAlert('Please fill in all fields', 'error');
        return;
    }
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    try {
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
        submitButton.disabled = true;
        
        console.log('Attempting login with:', { email, password: '***' });
        console.log('API URL:', '/api/auth/login');
        console.log('Current location:', window.location.href);
        
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        console.log('Login response status:', response.status);
        console.log('Login response headers:', Object.fromEntries(response.headers));
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('authToken', data.token);
            currentUser = data.user;
            authToken = data.token;
            
            console.log('Login successful, user:', currentUser);
            
            // Check if password change is required
            if (data.user.forcePasswordChange) {
                showForcePasswordChangeModal();
            } else {
                showMainApp();
                app.showAlert('Welcome back!', 'success');
                loadDashboardData();
            }
        } else {
            app.showAlert(data.message || 'Login failed', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        app.showAlert('Login failed. Please try again.', 'error');
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
});

// Forgot password form handler
document.getElementById('forgot-password-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('forgot-email').value;
    
    if (!email) {
        app.showAlert('Please enter your email address', 'error');
        return;
    }
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    try {
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        submitButton.disabled = true;
        
        const response = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });
        
        const data = await response.json();
        
        if (data.success) {
            closeForgotPassword();
            app.showAlert('If the email exists, a reset link has been sent', 'success');
        } else {
            app.showAlert(data.message || 'Failed to send reset link', 'error');
        }
    } catch (error) {
        console.error('Forgot password error:', error);
        app.showAlert('Failed to send reset link. Please try again.', 'error');
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
});

// Reset password form handler
document.getElementById('reset-password-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const password = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const token = document.getElementById('reset-password-page').dataset.token;
    
    if (!password || !confirmPassword) {
        app.showAlert('Please fill in all fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        app.showAlert('Passwords do not match', 'error');
        return;
    }
    
    // Validate password strength
    const passwordValidation = app.validatePassword(password);
    if (!passwordValidation.isValid) {
        app.showAlert(passwordValidation.errors.join('\n'), 'error');
        return;
    }
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    try {
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Resetting...';
        submitButton.disabled = true;
        
        const response = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            app.showAlert('Password reset successfully. Please login with your new password.', 'success');
            
            // Clear form and redirect to login
            document.getElementById('reset-password-form').reset();
            setTimeout(() => {
                window.history.replaceState({}, document.title, window.location.pathname);
                if (typeof showLoginPage === 'function') {
                    showLoginPage();
                } else {
                    // Fallback: reload page to show login
                    window.location.reload();
                }
            }, 2000);
        } else {
            app.showAlert(data.message || 'Failed to reset password', 'error');
        }
    } catch (error) {
        console.error('Reset password error:', error);
        app.showAlert('Failed to reset password. Please try again.', 'error');
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
});

// Force password change form handler
document.getElementById('force-password-change-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const password = document.getElementById('force-new-password').value;
    const confirmPassword = document.getElementById('force-confirm-password').value;
    
    if (!currentPassword || !password || !confirmPassword) {
        app.showAlert('Please fill in all fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        app.showAlert('Passwords do not match', 'error');
        return;
    }
    
    // Validate password strength
    const passwordValidation = app.validatePassword(password);
    if (!passwordValidation.isValid) {
        app.showAlert(passwordValidation.errors.join('\n'), 'error');
        return;
    }
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    try {
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Changing...';
        submitButton.disabled = true;
        
        const response = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ currentPassword, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            hideForcePasswordChangeModal();
            showMainApp();
            app.showAlert('Password changed successfully!', 'success');
            loadDashboardData();
        } else {
            app.showAlert(data.message || 'Failed to change password', 'error');
        }
    } catch (error) {
        console.error('Change password error:', error);
        app.showAlert('Failed to change password. Please try again.', 'error');
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
});

// Modal functions
function showForgotPassword() {
    const modal = document.getElementById('forgot-password-modal');
    if (modal) {
        modal.style.display = 'block';
        modal.classList.add('animate__animated', 'animate__fadeIn');
        
        // Focus on email input
        setTimeout(() => {
            const emailInput = document.getElementById('forgot-email');
            if (emailInput) emailInput.focus();
        }, 100);
    }
}

function closeForgotPassword() {
    const modal = document.getElementById('forgot-password-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('animate__animated', 'animate__fadeIn');
    }
    document.getElementById('forgot-password-form').reset();
}

function showForcePasswordChangeModal() {
    app.showModal('force-password-change-modal');
}

function hideForcePasswordChangeModal() {
    app.hideModal('force-password-change-modal');
    document.getElementById('force-password-change-form').reset();
}

// Auto-focus on email field when login page is shown
function focusEmailField() {
    setTimeout(() => {
        const emailField = document.getElementById('email');
        if (emailField && emailField.offsetParent !== null) {
            emailField.focus();
        }
    }, 100);
}

// Call focus function when login page is shown
const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const loginPage = document.getElementById('login-page');
            if (loginPage && loginPage.style.display !== 'none') {
                focusEmailField();
            }
        }
    });
});

observer.observe(document.getElementById('login-page'), {
    attributes: true,
    attributeFilter: ['style']
});

// Handle Enter key in login form
document.getElementById('email').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('password').focus();
    }
});

document.getElementById('password').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        document.getElementById('login-form').dispatchEvent(new Event('submit'));
    }
});

// Clear form errors on input
function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.style.borderColor = '#e1e5e9';
    }
}

// Add event listeners to clear errors
['email', 'password', 'forgot-email', 'new-password', 'confirm-password', 
 'current-password', 'force-new-password', 'force-confirm-password'].forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
        field.addEventListener('input', () => clearFieldError(fieldId));
    }
});

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'forgot-password-modal') {
            closeForgotPassword();
        }
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const forgotModal = document.getElementById('forgot-password-modal');
        if (forgotModal && forgotModal.style.display === 'block') {
            closeForgotPassword();
        }
    }
});

// Make functions globally accessible
window.showForgotPassword = showForgotPassword;
window.closeForgotPassword = closeForgotPassword;

// Password strength indicator (optional enhancement)
function showPasswordStrength(password, indicatorId) {
    const indicator = document.getElementById(indicatorId);
    if (!indicator) return;
    
    const validation = app.validatePassword(password);
    const strength = calculatePasswordStrength(password);
    
    indicator.className = `password-strength ${strength.class}`;
    indicator.textContent = strength.text;
    indicator.style.display = password ? 'block' : 'none';
}

function calculatePasswordStrength(password) {
    let score = 0;
    
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[@$!%*?&]/.test(password)) score++;
    
    const strengths = [
        { class: 'very-weak', text: 'Very Weak' },
        { class: 'weak', text: 'Weak' },
        { class: 'fair', text: 'Fair' },
        { class: 'good', text: 'Good' },
        { class: 'strong', text: 'Strong' }
    ];
    
    return strengths[Math.min(score, 4)];
}