// Profile management functionality

async function loadProfile() {
    try {
        const data = await app.apiRequest('/profile');
        
        if (data.success) {
            populateProfileForm(data.data);
        }
    } catch (error) {
        console.error('Load profile error:', error);
        app.showAlert('Failed to load profile', 'error');
    }
}

function populateProfileForm(profileData) {
    document.getElementById('profile-fullname').value = profileData.fullname || '';
    document.getElementById('profile-email').value = profileData.email || '';
    document.getElementById('profile-phone').value = profileData.phone || '';
    document.getElementById('profile-role').value = profileData.role || '';
    document.getElementById('profile-department').value = profileData.department || '';
    document.getElementById('profile-division').value = profileData.division || '';
    
    // Update name display
    document.getElementById('profile-name-display').textContent = profileData.fullname || 'No Name Set';
    
    // Add real-time name update
    const nameInput = document.getElementById('profile-fullname');
    nameInput.addEventListener('input', function() {
        const nameDisplay = document.getElementById('profile-name-display');
        nameDisplay.textContent = this.value || 'No Name Set';
    });
    
    // Update profile photo
    if (profileData.profile_photo) {
        document.getElementById('profile-photo').src = profileData.profile_photo;
        document.getElementById('user-avatar').src = profileData.profile_photo;
    }
}

// Profile form handler
document.getElementById('profile-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const profileData = Object.fromEntries(formData.entries());
    
    // Validate required fields
    if (!profileData.fullname) {
        app.showAlert('Full name is required', 'error');
        return;
    }
    
    // Validate phone number if provided
    if (profileData.phone && profileData.phone.trim() !== '' && !/^[\+]?[0-9][\d\s\-\(\)]{0,20}$/.test(profileData.phone.trim())) {
        app.showAlert('Please enter a valid phone number', 'error');
        return;
    }
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    try {
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
        submitButton.disabled = true;
        
        const data = await app.apiRequest('/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
        
        if (data.success) {
            // Update current user data
            currentUser.fullname = profileData.fullname;
            currentUser.phone = profileData.phone;
            currentUser.department = profileData.department;
            currentUser.division = profileData.division;
            
            // Update navigation display
            document.getElementById('user-name').textContent = profileData.fullname;
            
            app.showAlert('Profile updated successfully', 'success');
        }
    } catch (error) {
        console.error('Update profile error:', error);
        app.showAlert(error.message || 'Failed to update profile', 'error');
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
});

// Profile photo upload
document.getElementById('profile-photo').addEventListener('click', function() {
    showPhotoOptions();
});

document.querySelector('.photo-upload').addEventListener('click', function() {
    showPhotoOptions();
});

function showPhotoOptions() {
    const hasPhoto = !document.getElementById('profile-photo').src.includes('default-avatar.svg');
    
    const options = {
        title: 'Profile Photo',
        showCancelButton: true,
        showConfirmButton: false,
        html: `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <button class="swal2-confirm swal2-styled" onclick="selectNewPhoto()" style="margin: 0;">
                    <i class="fas fa-camera"></i> Change Profile Picture
                </button>
                ${hasPhoto ? `
                <button class="swal2-cancel swal2-styled" onclick="removeProfilePhoto()" style="margin: 0; background: #dc3545;">
                    <i class="fas fa-trash"></i> Remove Profile Picture
                </button>
                ` : ''}
            </div>
        `,
        cancelButtonText: 'Cancel'
    };
    
    Swal.fire(options);
}

function selectNewPhoto() {
    Swal.close();
    document.getElementById('photo-input').click();
}

async function removeProfilePhoto() {
    try {
        Swal.close();
        
        const result = await Swal.fire({
            title: 'Remove Profile Photo?',
            text: 'This will remove your current profile photo.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, Remove',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#dc3545'
        });
        
        if (result.isConfirmed) {
            const response = await fetch('/api/profile/remove-photo', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                document.getElementById('profile-photo').src = '/images/default-avatar.svg';
                document.getElementById('user-avatar').src = '/images/default-avatar.svg';
                app.showAlert('Profile photo removed successfully', 'success');
            } else {
                app.showAlert(data.message || 'Failed to remove photo', 'error');
            }
        }
    } catch (error) {
        console.error('Remove photo error:', error);
        app.showAlert('Failed to remove photo', 'error');
    }
}

document.getElementById('photo-input').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file
    if (file.size > 2 * 1024 * 1024) {
        app.showAlert('File size must be less than 2MB', 'error');
        return;
    }
    
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
        app.showAlert('Only JPG, PNG, and GIF images are allowed', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('photo', file);
    
    try {
        // Show loading state
        const photoElement = document.getElementById('profile-photo');
        const originalSrc = photoElement.src;
        photoElement.style.opacity = '0.6';
        
        const response = await fetch('/api/profile/photo', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update photo display
            photoElement.src = data.data.photoUrl;
            document.getElementById('user-avatar').src = data.data.photoUrl;
            
            // Update current user data
            currentUser.profile_photo = data.data.photoUrl;
            
            app.showAlert('Profile photo updated successfully', 'success');
        } else {
            app.showAlert(data.message || 'Failed to update photo', 'error');
        }
        
        photoElement.style.opacity = '1';
    } catch (error) {
        console.error('Upload photo error:', error);
        app.showAlert('Failed to upload photo', 'error');
        document.getElementById('profile-photo').style.opacity = '1';
    }
});

// Change password modal functions
function showChangePasswordModal() {
    app.showModal('change-password-modal');
    document.getElementById('change-password-form').reset();
}

function closeChangePasswordModal() {
    app.hideModal('change-password-modal');
}

// Change password form handler
document.getElementById('change-password-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('change-current-password').value;
    const password = document.getElementById('change-new-password').value;
    const confirmPassword = document.getElementById('change-confirm-password').value;
    
    if (!currentPassword || !password || !confirmPassword) {
        app.showAlert('Please fill in all fields', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        app.showAlert('New passwords do not match', 'error');
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
        
        const data = await app.apiRequest('/profile/change-password', {
            method: 'POST',
            body: JSON.stringify({ currentPassword, password })
        });
        
        if (data.success) {
            closeChangePasswordModal();
            app.showAlert('Password changed successfully', 'success');
        }
    } catch (error) {
        console.error('Change password error:', error);
        app.showAlert(error.message || 'Failed to change password', 'error');
    } finally {
        submitButton.innerHTML = originalText;
        submitButton.disabled = false;
    }
});

// Password strength indicator for change password form
document.getElementById('change-new-password').addEventListener('input', function(e) {
    const password = e.target.value;
    showPasswordStrength(password);
});

function showPasswordStrength(password) {
    // Remove existing strength indicator
    const existingIndicator = document.getElementById('password-strength-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    if (!password) return;
    
    const validation = app.validatePassword(password);
    const strength = calculatePasswordStrength(password);
    
    const indicator = document.createElement('div');
    indicator.id = 'password-strength-indicator';
    indicator.style.marginTop = '8px';
    indicator.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <div style="flex: 1; background: #e0e0e0; height: 4px; border-radius: 2px; overflow: hidden;">
                <div style="height: 100%; background: ${strength.color}; width: ${strength.width}%; transition: all 0.3s ease;"></div>
            </div>
            <span style="font-size: 12px; color: ${strength.color}; font-weight: 600;">${strength.text}</span>
        </div>
    `;
    
    if (!validation.isValid) {
        const errors = document.createElement('div');
        errors.style.marginTop = '5px';
        errors.style.fontSize = '12px';
        errors.style.color = '#dc3545';
        errors.innerHTML = validation.errors.map(error => `• ${error}`).join('<br>');
        indicator.appendChild(errors);
    }
    
    document.getElementById('change-new-password').parentNode.parentNode.appendChild(indicator);
}

function calculatePasswordStrength(password) {
    let score = 0;
    
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[@$!%*?&]/.test(password)) score++;
    
    const strengths = [
        { text: 'Very Weak', color: '#dc3545', width: 20 },
        { text: 'Weak', color: '#fd7e14', width: 40 },
        { text: 'Fair', color: '#ffc107', width: 60 },
        { text: 'Good', color: '#20c997', width: 80 },
        { text: 'Strong', color: '#28a745', width: 100 }
    ];
    
    return strengths[Math.min(score, 4)];
}

// Auto-save draft functionality (optional enhancement)
let profileDraftTimeout;

function saveDraft() {
    const formData = new FormData(document.getElementById('profile-form'));
    const draftData = Object.fromEntries(formData.entries());
    localStorage.setItem('profileDraft', JSON.stringify(draftData));
}

function loadDraft() {
    const draft = localStorage.getItem('profileDraft');
    if (draft) {
        try {
            const draftData = JSON.parse(draft);
            Object.keys(draftData).forEach(key => {
                const field = document.getElementById(`profile-${key}`);
                if (field && field.value !== draftData[key]) {
                    field.value = draftData[key];
                    field.style.borderColor = '#ffc107'; // Indicate draft data
                }
            });
        } catch (error) {
            console.error('Error loading draft:', error);
        }
    }
}

function clearDraft() {
    localStorage.removeItem('profileDraft');
}

// Add auto-save listeners
['profile-fullname', 'profile-phone', 'profile-department', 'profile-division'].forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
        field.addEventListener('input', function() {
            clearTimeout(profileDraftTimeout);
            profileDraftTimeout = setTimeout(saveDraft, 1000);
        });
    }
});

// Clear draft on successful save
document.getElementById('profile-form').addEventListener('submit', function() {
    clearDraft();
});

// Export profile functions
window.profile = {
    loadProfile,
    showChangePasswordModal,
    closeChangePasswordModal,
    saveDraft,
    loadDraft,
    clearDraft
};