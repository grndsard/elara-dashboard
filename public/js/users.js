// User management functionality
let currentUsersPage = 1;
let usersPerPage = 10;

async function loadUsers(page = 1) {
    console.log('loadUsers called with page:', page);
    try {
        currentUsersPage = page;
        
        // Get filter values
        const nameFilter = document.getElementById('user-name-filter');
        const departmentFilter = document.getElementById('user-department-filter');
        const divisionFilter = document.getElementById('user-division-filter');
        const statusFilter = document.getElementById('user-status-filter');
        
        const name = nameFilter ? nameFilter.value : '';
        const department = departmentFilter ? departmentFilter.value : '';
        const division = divisionFilter ? divisionFilter.value : '';
        const status = statusFilter ? statusFilter.value : '';
        
        const params = new URLSearchParams({
            page: page,
            limit: usersPerPage,
            ...(name && { name }),
            ...(department && { department }),
            ...(division && { division }),
            ...(status && { status })
        });
        
        console.log('Making API request to:', `/users?${params}`);
        const data = await app.apiRequest(`/users?${params}`);
        console.log('API response:', data);
        
        if (data.success) {
            renderUsersTable(data.data);
            renderUsersPagination(data.pagination);
            updateUserFilters(data.filters);
        } else {
            console.error('API returned success: false', data);
            app.showAlert(data.message || 'Failed to load users', 'error');
        }
    } catch (error) {
        console.error('Load users error:', error);
        app.showAlert('Failed to load users: ' + error.message, 'error');
    }
}

function renderUsersTable(users) {
    console.log('renderUsersTable called with users:', users);
    const tbody = document.getElementById('users-table-body');
    if (!tbody) {
        console.error('users-table-body element not found');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (!users || users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center">No users found</td>
            </tr>
        `;
        return;
    }
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.fullname || '-'}</td>
            <td>${user.email}</td>
            <td>${user.phone || '-'}</td>
            <td>${user.department || '-'}</td>
            <td>${user.division || '-'}</td>
            <td>
                <span class="status-badge ${user.role || 'user'}">
                    ${(user.role || 'user').charAt(0).toUpperCase() + (user.role || 'user').slice(1)}
                </span>
            </td>
            <td>
                <span class="status-badge ${user.status || 'active'}">
                    ${(user.status || 'active').charAt(0).toUpperCase() + (user.status || 'active').slice(1)}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-sm btn-edit" onclick="editUser(${user.id})" title="Edit User">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-sm btn-delete" onclick="deleteUser(${user.id}, '${user.fullname || user.email}')" title="Delete User">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function renderUsersPagination(pagination) {
    const container = document.getElementById('users-pagination');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (pagination.totalPages <= 1) return;
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevButton.disabled = pagination.page === 1;
    prevButton.onclick = () => loadUsers(pagination.page - 1);
    container.appendChild(prevButton);
    
    // Page numbers
    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.totalPages, pagination.page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = i === pagination.page ? 'active' : '';
        pageButton.onclick = () => loadUsers(i);
        container.appendChild(pageButton);
    }
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextButton.disabled = pagination.page === pagination.totalPages;
    nextButton.onclick = () => loadUsers(pagination.page + 1);
    container.appendChild(nextButton);
    
    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} total)`;
    pageInfo.style.marginLeft = '20px';
    pageInfo.style.color = '#666';
    container.appendChild(pageInfo);
}

function filterUsers() {
    loadUsers(1);
}

// Add user modal functions
async function showAddUserModal() {
    try {
        // Get filter options for dropdowns
        const filtersData = await app.apiRequest('/users?page=1&limit=1');
        
        if (filtersData.success && filtersData.filters) {
            const filters = filtersData.filters;
            
            // Populate department dropdown
            const deptSelect = document.getElementById('add-department');
            if (deptSelect) {
                deptSelect.innerHTML = '<option value="">Select Department</option>';
                if (filters.departments) {
                    filters.departments.forEach(dept => {
                        const option = document.createElement('option');
                        option.value = dept;
                        option.textContent = dept;
                        deptSelect.appendChild(option);
                    });
                }
            }
            
            // Populate division dropdown
            const divSelect = document.getElementById('add-division');
            if (divSelect) {
                divSelect.innerHTML = '<option value="">Select Division</option>';
                if (filters.divisions) {
                    filters.divisions.forEach(div => {
                        const option = document.createElement('option');
                        option.value = div;
                        option.textContent = div;
                        divSelect.appendChild(option);
                    });
                }
            }
        }
        
        // Show modal
        const modal = document.getElementById('add-user-modal');
        if (modal) {
            document.getElementById('add-user-form').reset();
            modal.style.display = 'block';
            modal.classList.add('animate__animated', 'animate__fadeIn');
        }
    } catch (error) {
        console.error('Show add user modal error:', error);
        app.showAlert('Failed to load form data', 'error');
    }
}

function closeAddUserModal() {
    const modal = document.getElementById('add-user-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('animate__animated', 'animate__fadeIn');
    }
}

// Add user form handler (with safety check)
function initializeUserForms() {
    const addUserForm = document.getElementById('add-user-form');
    const editUserForm = document.getElementById('edit-user-form');
    
    if (addUserForm) {
        addUserForm.addEventListener('submit', async function(e) {
            e.preventDefault();
    
    const formData = new FormData(e.target);
    const userData = Object.fromEntries(formData.entries());
    
    // Validate required fields
    if (!userData.fullname || !userData.email) {
        app.showAlert('Please fill in all required fields', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
        app.showAlert('Please enter a valid email address', 'error');
        return;
    }
    
    // Enhanced confirmation dialog
    const result = await Swal.fire({
        title: '<i class="fas fa-user-plus"></i> Add New User?',
        html: `<div class="swal-content">
                 <p>You are about to add <strong>${userData.fullname}</strong> as a new user:</p>
                 <div class="user-changes">
                   <div><i class="fas fa-envelope"></i> Email: ${userData.email}</div>
                   <div><i class="fas fa-phone"></i> Phone: ${userData.phone || 'Not specified'}</div>
                   <div><i class="fas fa-building"></i> Department: ${userData.department || 'Not specified'}</div>
                   <div><i class="fas fa-sitemap"></i> Division: ${userData.division || 'Not specified'}</div>
                   <div><i class="fas fa-user-tag"></i> Role: ${userData.role || 'user'}</div>
                   <div><i class="fas fa-key"></i> Password: Will be sent via email</div>
                 </div>
               </div>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#667eea',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '<i class="fas fa-plus"></i> Add User',
        cancelButtonText: '<i class="fas fa-times"></i> Cancel',
        showClass: {
            popup: 'animate__animated animate__fadeInDown animate__faster'
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOutUp animate__faster'
        },
        customClass: {
            popup: 'swal-edit-user'
        }
    });
    
    if (!result.isConfirmed) return;
    
    const submitButton = e.target.querySelector('button[type="submit"]') || document.querySelector('#add-user-modal button[type="submit"]');
    if (!submitButton) {
        console.error('Submit button not found');
        return;
    }
    const originalText = submitButton.innerHTML;
    
    try {
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
        submitButton.disabled = true;
        
        const data = await app.apiRequest('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        if (data.success) {
            closeAddUserModal();
            loadUsers(currentUsersPage);
            
            // Success animation
            Swal.fire({
                title: '<i class="fas fa-check-circle"></i> User Added!',
                html: `<div class="swal-content">
                         <p><strong>${userData.fullname}</strong> has been added successfully!</p>
                         <div class="user-changes">
                           <div><i class="fas fa-envelope"></i> Login credentials sent to: ${userData.email}</div>
                           <div><i class="fas fa-key"></i> User must change password on first login</div>
                           <div><i class="fas fa-toggle-on"></i> Status: Active</div>
                         </div>
                       </div>`,
                icon: 'success',
                confirmButtonColor: '#28a745',
                showClass: {
                    popup: 'animate__animated animate__bounceIn'
                },
                hideClass: {
                    popup: 'animate__animated animate__fadeOut'
                }
            });
        }
    } catch (error) {
        console.error('Add user error:', error);
        Swal.fire('Error!', error.message || 'Failed to add user', 'error');
    } finally {
        if (submitButton) {
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
        }
    }
        });
    }
    
    if (editUserForm) {
        editUserForm.addEventListener('submit', async function(e) {
            e.preventDefault();
    
    const userId = e.target.dataset.userId;
    const formData = new FormData(e.target);
    const userData = Object.fromEntries(formData.entries());
    
    // Validate required fields
    if (!userData.fullname || !userData.email) {
        app.showAlert('Please fill in all required fields', 'error');
        return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userData.email)) {
        app.showAlert('Please enter a valid email address', 'error');
        return;
    }
    
    // Animated confirmation dialog
    const result = await Swal.fire({
        title: '<i class="fas fa-user-edit"></i> Apply Changes?',
        html: `<div class="swal-content">
                 <p>You are about to update <strong>${userData.fullname}</strong>'s information:</p>
                 <div class="user-changes">
                   <div><i class="fas fa-envelope"></i> Email: ${userData.email}</div>
                   <div><i class="fas fa-phone"></i> Phone: ${userData.phone || 'Not specified'}</div>
                   <div><i class="fas fa-building"></i> Department: ${userData.department || 'Not specified'}</div>
                   <div><i class="fas fa-sitemap"></i> Division: ${userData.division || 'Not specified'}</div>
                   <div><i class="fas fa-user-tag"></i> Role: ${userData.role}</div>
                   <div><i class="fas fa-toggle-on"></i> Status: ${userData.status}</div>
                 </div>
               </div>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#667eea',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '<i class="fas fa-check"></i> Apply Changes',
        cancelButtonText: '<i class="fas fa-times"></i> Cancel',
        showClass: {
            popup: 'animate__animated animate__fadeInDown animate__faster'
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOutUp animate__faster'
        },
        customClass: {
            popup: 'swal-edit-user'
        }
    });
    
    if (!result.isConfirmed) return;
    
    const submitButton = e.target.querySelector('button[type="submit"]') || document.querySelector('#edit-user-modal button[type="submit"]');
    if (!submitButton) {
        console.error('Submit button not found');
        return;
    }
    const originalText = submitButton.innerHTML;
    
    try {
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Applying Changes...';
        submitButton.disabled = true;
        
        const data = await app.apiRequest(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
        
        if (data.success) {
            closeEditUserModal();
            loadUsers(currentUsersPage);
            
            // Success animation
            Swal.fire({
                title: '<i class="fas fa-check-circle"></i> Changes Applied!',
                text: `${userData.fullname}'s information has been updated successfully`,
                icon: 'success',
                confirmButtonColor: '#28a745',
                showClass: {
                    popup: 'animate__animated animate__bounceIn'
                },
                hideClass: {
                    popup: 'animate__animated animate__fadeOut'
                }
            });
        }
    } catch (error) {
        console.error('Update user error:', error);
        Swal.fire({
            title: '<i class="fas fa-exclamation-triangle"></i> Update Failed',
            text: error.message || 'Failed to update user information',
            icon: 'error',
            confirmButtonColor: '#dc3545',
            showClass: {
                popup: 'animate__animated animate__shakeX'
            }
        });
    } finally {
        if (submitButton) {
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
        }
    }
        });
    }
}

// Initialize form handlers when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUserForms);
} else {
    initializeUserForms();
}

// Edit user function
async function editUser(userId) {
    console.log('editUser called with userId:', userId);
    try {
        // Get user data and filter options
        const [userData, filtersData] = await Promise.all([
            app.apiRequest(`/users/${userId}`),
            app.apiRequest('/users?page=1&limit=1')
        ]);
        
        console.log('User data:', userData);
        console.log('Filters data:', filtersData);
        
        if (userData.success && filtersData.success) {
            const user = userData.data;
            const filters = filtersData.filters;
            
            // Check if modal exists
            const modal = document.getElementById('edit-user-modal');
            if (!modal) {
                console.error('Edit user modal not found');
                app.showAlert('Edit modal not found', 'error');
                return;
            }
            
            // Populate department dropdown
            const deptSelect = document.getElementById('edit-department');
            if (deptSelect) {
                deptSelect.innerHTML = '<option value="">Select Department</option>';
                if (filters.departments) {
                    filters.departments.forEach(dept => {
                        const option = document.createElement('option');
                        option.value = dept;
                        option.textContent = dept;
                        deptSelect.appendChild(option);
                    });
                }
            }
            
            // Populate division dropdown
            const divSelect = document.getElementById('edit-division');
            if (divSelect) {
                divSelect.innerHTML = '<option value="">Select Division</option>';
                if (filters.divisions) {
                    filters.divisions.forEach(div => {
                        const option = document.createElement('option');
                        option.value = div;
                        option.textContent = div;
                        divSelect.appendChild(option);
                    });
                }
            }
            
            // Populate edit form
            const fullnameField = document.getElementById('edit-fullname');
            const emailField = document.getElementById('edit-email');
            const phoneField = document.getElementById('edit-phone');
            const statusField = document.getElementById('edit-status');
            const roleField = document.getElementById('edit-role');
            const formElement = document.getElementById('edit-user-form');
            
            if (fullnameField) fullnameField.value = user.fullname || '';
            if (emailField) emailField.value = user.email || '';
            if (phoneField) phoneField.value = user.phone || '';
            if (deptSelect) deptSelect.value = user.department || '';
            if (divSelect) divSelect.value = user.division || '';
            if (statusField) statusField.value = user.status || 'active';
            if (roleField) roleField.value = user.role || 'user';
            
            // Store user ID for form submission
            if (formElement) formElement.dataset.userId = userId;
            
            // Show modal
            console.log('Showing modal...');
            modal.style.display = 'block';
            modal.classList.add('animate__animated', 'animate__fadeIn');
        }
    } catch (error) {
        console.error('Edit user error:', error);
        app.showAlert('Failed to load user data: ' + error.message, 'error');
    }
}

// Cancel edit user with confirmation
async function cancelEditUser() {
    const result = await Swal.fire({
        title: '<i class="fas fa-question-circle"></i> Cancel Changes?',
        text: 'Any unsaved changes will be lost. Are you sure you want to cancel?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '<i class="fas fa-times"></i> Yes, Cancel',
        cancelButtonText: '<i class="fas fa-arrow-left"></i> Continue Editing',
        showClass: {
            popup: 'animate__animated animate__fadeInDown animate__faster'
        },
        hideClass: {
            popup: 'animate__animated animate__fadeOutUp animate__faster'
        }
    });
    
    if (result.isConfirmed) {
        closeEditUserModal();
    }
}

// Close edit user modal
function closeEditUserModal() {
    const modal = document.getElementById('edit-user-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('animate__animated', 'animate__fadeIn');
    }
}

// Delete user function
async function deleteUser(userId, userName) {
    const result = await Swal.fire({
        title: 'Delete User',
        text: `Are you sure you want to delete ${userName}? This action cannot be undone.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete user',
        cancelButtonText: 'Cancel'
    });
    
    if (result.isConfirmed) {
        try {
            const data = await app.apiRequest(`/users/${userId}`, {
                method: 'DELETE'
            });
            
            if (data.success) {
                loadUsers(currentUsersPage);
                Swal.fire('Deleted!', 'User has been deleted successfully.', 'success');
            }
        } catch (error) {
            console.error('Delete user error:', error);
            Swal.fire('Error!', error.message || 'Failed to delete user', 'error');
        }
    }
}

// Search functionality with debounce
const debouncedFilterUsers = app.debounce(filterUsers, 500);

function updateUserFilters(filters) {
    if (!filters) return;
    
    // Update department filter
    const departmentSelect = document.getElementById('user-department-filter');
    if (departmentSelect && filters.departments) {
        const currentValue = departmentSelect.value;
        departmentSelect.innerHTML = '<option value="">All Departments</option>';
        filters.departments.forEach(dept => {
            const option = document.createElement('option');
            option.value = dept;
            option.textContent = dept;
            departmentSelect.appendChild(option);
        });
        if (currentValue) departmentSelect.value = currentValue;
    }
    
    // Update division filter
    const divisionSelect = document.getElementById('user-division-filter');
    if (divisionSelect && filters.divisions) {
        const currentValue = divisionSelect.value;
        divisionSelect.innerHTML = '<option value="">All Divisions</option>';
        filters.divisions.forEach(div => {
            const option = document.createElement('option');
            option.value = div;
            option.textContent = div;
            divisionSelect.appendChild(option);
        });
        if (currentValue) divisionSelect.value = currentValue;
    }
}

// Add event listeners for real-time filtering (with safety checks)
function initializeUserEventListeners() {
    const nameFilter = document.getElementById('user-name-filter');
    const departmentFilter = document.getElementById('user-department-filter');
    const divisionFilter = document.getElementById('user-division-filter');
    const statusFilter = document.getElementById('user-status-filter');
    
    if (nameFilter && !nameFilter.hasAttribute('data-listener-added')) {
        nameFilter.addEventListener('input', debouncedFilterUsers);
        nameFilter.setAttribute('data-listener-added', 'true');
    }
    if (departmentFilter && !departmentFilter.hasAttribute('data-listener-added')) {
        departmentFilter.addEventListener('change', filterUsers);
        departmentFilter.setAttribute('data-listener-added', 'true');
    }
    if (divisionFilter && !divisionFilter.hasAttribute('data-listener-added')) {
        divisionFilter.addEventListener('change', filterUsers);
        divisionFilter.setAttribute('data-listener-added', 'true');
    }
    if (statusFilter && !statusFilter.hasAttribute('data-listener-added')) {
        statusFilter.addEventListener('change', filterUsers);
        statusFilter.setAttribute('data-listener-added', 'true');
    }
}

// Initialize when users page is shown
function initializeUsersPage() {
    initializeUserEventListeners();
    loadUsers(1);
}

// Clear filters function
function clearUserFilters() {
    document.getElementById('user-name-filter').value = '';
    document.getElementById('user-department-filter').value = '';
    document.getElementById('user-division-filter').value = '';
    document.getElementById('user-status-filter').value = '';
    loadUsers(1);
}

// Make functions globally accessible
window.loadUsers = loadUsers;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.showAddUserModal = showAddUserModal;
window.closeAddUserModal = closeAddUserModal;
window.closeEditUserModal = closeEditUserModal;
window.cancelEditUser = cancelEditUser;
window.filterUsers = filterUsers;
window.initializeUsersPage = initializeUsersPage;

// Export user functions
window.users = {
    loadUsers,
    filterUsers,
    showAddUserModal,
    closeAddUserModal,
    editUser,
    deleteUser,
    closeEditUserModal,
    clearUserFilters
};