// Audit trail functionality
let currentAuditPage = 1;
let auditPerPage = 50;

async function loadAuditTrail(page = 1) {
    try {
        console.log('Loading audit trail, page:', page);
        currentAuditPage = page;
        
        // Get filter values
        const action = document.getElementById('audit-action-filter')?.value || '';
        const user_id = document.getElementById('audit-user-filter')?.value || '';
        const startDate = document.getElementById('audit-start-date')?.value || '';
        const endDate = document.getElementById('audit-end-date')?.value || '';
        
        console.log('Filters:', { action, user_id, startDate, endDate });
        
        const params = new URLSearchParams({
            page: page,
            limit: auditPerPage,
            ...(action && { action }),
            ...(user_id && { user_id }),
            ...(startDate && { startDate }),
            ...(endDate && { endDate })
        });
        
        console.log('API request URL:', `/audit?${params}`);
        const data = await app.apiRequest(`/audit?${params}`);
        console.log('Audit API response:', data);
        
        if (data.success) {
            console.log('Audit records found:', data.data.length);
            console.log('Pagination:', data.pagination);
            renderAuditTable(data.data);
            renderAuditPagination(data.pagination);
            updateFilterOptions(data.filters);
        } else {
            console.error('Audit API returned error:', data.message);
        }
    } catch (error) {
        console.error('Load audit trail error:', error);
        app.showAlert('Failed to load audit trail', 'error');
    }
}

function renderAuditTable(auditRecords) {
    const tbody = document.getElementById('audit-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (auditRecords.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No audit records found</td>
            </tr>
        `;
        return;
    }
    
    auditRecords.forEach(record => {
        const row = document.createElement('tr');
        
        // Format change details for display
        let changesText = '';
        if (record.change_details && record.change_details.length > 0) {
            changesText = record.change_details.map(change => 
                `${change.field}: "${change.oldValue}" → "${change.newValue}"`
            ).join('; ');
        }
        
        row.innerHTML = `
            <td>${app.formatDate(record.timestamp)}</td>
            <td>${record.username}</td>
            <td>
                <span class="action-badge ${getActionBadgeClass(record.action)}">
                    ${record.action}
                </span>
            </td>
            <td>${record.table_name || '-'}</td>
            <td>${record.ip_address || '-'}</td>
            <td>
                <button class="btn-sm btn-view" onclick="showAuditDetails(${record.id}, '${encodeURIComponent(JSON.stringify(record))}')" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function getActionBadgeClass(action) {
    if (action.includes('LOGIN')) return 'login';
    if (action.includes('CREATE') || action.includes('UPLOAD')) return 'create';
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'update';
    if (action.includes('DELETE')) return 'delete';
    if (action.includes('FAILED') || action.includes('ERROR')) return 'error';
    return 'default';
}

function renderAuditPagination(pagination) {
    const container = document.getElementById('audit-pagination');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (pagination.totalPages <= 1) return;
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '<i class="fas fa-chevron-left"></i>';
    prevButton.disabled = pagination.page === 1;
    prevButton.onclick = () => loadAuditTrail(pagination.page - 1);
    container.appendChild(prevButton);
    
    // Page numbers
    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.totalPages, pagination.page + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = i === pagination.page ? 'active' : '';
        pageButton.onclick = () => loadAuditTrail(i);
        container.appendChild(pageButton);
    }
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.innerHTML = '<i class="fas fa-chevron-right"></i>';
    nextButton.disabled = pagination.page === pagination.totalPages;
    nextButton.onclick = () => loadAuditTrail(pagination.page + 1);
    container.appendChild(nextButton);
    
    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Page ${pagination.page} of ${pagination.totalPages} (${pagination.total} total)`;
    pageInfo.style.marginLeft = '20px';
    pageInfo.style.color = '#666';
    container.appendChild(pageInfo);
}

function filterAuditTrail() {
    loadAuditTrail(1);
}

// Show audit details modal
async function showAuditDetails(recordId, encodedRecord) {
    try {
        const record = JSON.parse(decodeURIComponent(encodedRecord));
        
        let detailsHtml = generateAuditDetailsHtml(record);
        
        const modal = document.createElement('div');
        modal.className = 'audit-details-modal';
        modal.innerHTML = `
            <div class="audit-details-content">
                <div class="audit-details-header">
                    <h3>Audit Record Details</h3>
                    <button class="close-audit-details" onclick="closeAuditDetails()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="audit-details-body">
                    ${detailsHtml}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        window.currentAuditModal = modal;
        
    } catch (error) {
        console.error('Show audit details error:', error);
        app.showAlert('Failed to load audit details', 'error');
    }
}

function generateAuditDetailsHtml(record) {
    let html = `
        <div class="audit-section">
            <h4><i class="fas fa-info-circle"></i> Basic Information</h4>
            <div class="audit-info-grid">
                <div class="audit-info-item">
                    <label>Record ID:</label>
                    <span>${record.id}</span>
                </div>
                <div class="audit-info-item">
                    <label>User:</label>
                    <span>${record.username} (ID: ${record.user_id})</span>
                </div>
                <div class="audit-info-item">
                    <label>Action:</label>
                    <span class="action-badge ${getActionBadgeClass(record.action)}">${record.action}</span>
                </div>
                <div class="audit-info-item">
                    <label>Table:</label>
                    <span>${record.table_name || 'N/A'}</span>
                </div>
                <div class="audit-info-item">
                    <label>Record ID:</label>
                    <span>${record.record_id || 'N/A'}</span>
                </div>
                <div class="audit-info-item">
                    <label>Timestamp:</label>
                    <span>${app.formatDate(record.timestamp)}</span>
                </div>
                <div class="audit-info-item">
                    <label>IP Address:</label>
                    <span>${record.ip_address || 'N/A'}</span>
                </div>
                <div class="audit-info-item">
                    <label>User Agent:</label>
                    <span class="user-agent">${record.user_agent || 'N/A'}</span>
                </div>
            </div>
        </div>
    `;
    
    // Parse old_values and new_values for detailed change information
    let oldValues = null;
    let newValues = null;
    
    try {
        if (record.old_values) oldValues = JSON.parse(record.old_values);
        if (record.new_values) newValues = JSON.parse(record.new_values);
    } catch (e) {
        console.log('Error parsing values:', e);
    }
    
    // Generate change details based on action type
    if (record.action.includes('CREATE') || record.action.includes('UPLOAD')) {
        html += generateCreationDetails(newValues, record.action);
    } else if (record.action.includes('UPDATE') || record.action.includes('EDIT')) {
        html += generateUpdateDetails(oldValues, newValues, record.action);
    } else if (record.action.includes('DELETE')) {
        html += generateDeletionDetails(oldValues, record.action);
    } else {
        html += generateGenericDetails(oldValues, newValues, record.action);
    }
    
    return html;
}

function generateCreationDetails(newValues, action) {
    if (!newValues) return '';
    
    return `
        <div class="audit-section creation">
            <h4><i class="fas fa-plus-circle"></i> Creation Details</h4>
            <p class="section-description">The following data was created:</p>
            <div class="data-display created-data">
                ${Object.entries(newValues).map(([key, value]) => `
                    <div class="data-item">
                        <label>${formatFieldName(key)}:</label>
                        <span class="created-value">${formatValue(value)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function generateUpdateDetails(oldValues, newValues, action) {
    if (!oldValues && !newValues) return '';
    
    const changes = [];
    const allKeys = new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})]);
    
    allKeys.forEach(key => {
        const oldVal = oldValues?.[key];
        const newVal = newValues?.[key];
        
        if (oldVal !== newVal) {
            changes.push({ field: key, oldValue: oldVal, newValue: newVal });
        }
    });
    
    if (changes.length === 0) return '';
    
    return `
        <div class="audit-section update">
            <h4><i class="fas fa-edit"></i> Update Details</h4>
            <p class="section-description">The following changes were made:</p>
            <div class="changes-list">
                ${changes.map(change => `
                    <div class="change-item">
                        <div class="field-name">${formatFieldName(change.field)}</div>
                        <div class="value-comparison">
                            <div class="old-value">
                                <label>Before:</label>
                                <span>${formatValue(change.oldValue)}</span>
                            </div>
                            <div class="arrow"><i class="fas fa-arrow-right"></i></div>
                            <div class="new-value">
                                <label>After:</label>
                                <span>${formatValue(change.newValue)}</span>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function generateDeletionDetails(oldValues, action) {
    if (!oldValues) return '';
    
    return `
        <div class="audit-section deletion">
            <h4><i class="fas fa-trash-alt"></i> Deletion Details</h4>
            <p class="section-description">The following data was deleted:</p>
            <div class="data-display deleted-data">
                ${Object.entries(oldValues).map(([key, value]) => `
                    <div class="data-item">
                        <label>${formatFieldName(key)}:</label>
                        <span class="deleted-value">${formatValue(value)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function generateGenericDetails(oldValues, newValues, action) {
    let html = '';
    
    if (newValues) {
        html += `
            <div class="audit-section generic">
                <h4><i class="fas fa-info"></i> Action Details</h4>
                <div class="data-display">
                    ${Object.entries(newValues).map(([key, value]) => `
                        <div class="data-item">
                            <label>${formatFieldName(key)}:</label>
                            <span>${formatValue(value)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    return html;
}

function formatFieldName(field) {
    return field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatValue(value) {
    if (value === null || value === undefined) return '<em>N/A</em>';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (String(value).length > 100) return String(value).substring(0, 100) + '...';
    return String(value);
}

function closeAuditDetails() {
    if (window.currentAuditModal) {
        document.body.removeChild(window.currentAuditModal);
        window.currentAuditModal = null;
    }
}

// Export audit data to Excel
async function exportAuditData() {
    try {
        const result = await Swal.fire({
            title: 'Export Audit Trail',
            text: 'This will export the audit trail data to Excel format with current filters applied.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-file-excel"></i> Export to Excel',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#28a745'
        });
        
        if (result.isConfirmed) {
            // Show loading
            Swal.fire({
                title: 'Exporting...',
                text: 'Please wait while we prepare your audit trail export.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            // Get current filter values
            const action = document.getElementById('audit-action-filter').value;
            const username = document.getElementById('audit-user-filter').value;
            const startDate = document.getElementById('audit-start-date').value;
            const endDate = document.getElementById('audit-end-date').value;
            
            const params = new URLSearchParams({
                ...(action && { action }),
                ...(username && { username }),
                ...(startDate && { startDate }),
                ...(endDate && { endDate })
            });
            
            // Create download request with auth headers
            const response = await fetch(`/api/audit/export?${params}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Export failed');
            }
            
            // Get the blob and create download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `audit_trail_${new Date().toISOString().split('T')[0]}.xlsx`;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            window.URL.revokeObjectURL(url);
            
            Swal.fire({
                title: 'Export Complete',
                text: 'Audit trail has been exported to Excel successfully.',
                icon: 'success',
                timer: 3000
            });
        }
    } catch (error) {
        console.error('Export audit data error:', error);
        Swal.fire({
            title: 'Export Failed',
            text: 'Failed to export audit trail. Please try again.',
            icon: 'error'
        });
    }
}

// Clear audit filters
function clearAuditFilters() {
    document.getElementById('audit-action-filter').value = '';
    document.getElementById('audit-user-filter').value = '';
    document.getElementById('audit-start-date').value = '';
    document.getElementById('audit-end-date').value = '';
    loadAuditTrail(1);
}

// Set default date range (current day only)
function setDefaultDateRange() {
    const today = new Date().toISOString().split('T')[0];
    
    document.getElementById('audit-start-date').value = today;
    document.getElementById('audit-end-date').value = today;
}

// Search functionality with debounce
const debouncedFilterAudit = app.debounce(filterAuditTrail, 500);

// Update filter options
function updateFilterOptions(filters) {
    if (!filters) return;
    
    // Update action filter
    const actionSelect = document.getElementById('audit-action-filter');
    if (actionSelect && filters.actions) {
        const currentValue = actionSelect.value;
        actionSelect.innerHTML = '<option value="">All Actions</option>';
        filters.actions.forEach(action => {
            const option = document.createElement('option');
            option.value = action;
            option.textContent = action;
            actionSelect.appendChild(option);
        });
        if (currentValue) actionSelect.value = currentValue;
    }
    
    // Update user filter
    const userSelect = document.getElementById('audit-user-filter');
    if (userSelect && filters.users) {
        const currentValue = userSelect.value;
        userSelect.innerHTML = '<option value="">All Users</option>';
        filters.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = user.name;
            userSelect.appendChild(option);
        });
        if (currentValue) userSelect.value = currentValue;
    }
}

// Add event listeners for real-time filtering
function initializeAuditEventListeners() {
    const actionFilter = document.getElementById('audit-action-filter');
    const userFilter = document.getElementById('audit-user-filter');
    const startDateFilter = document.getElementById('audit-start-date');
    const endDateFilter = document.getElementById('audit-end-date');
    
    if (actionFilter && !actionFilter.hasAttribute('data-listener-added')) {
        actionFilter.addEventListener('change', filterAuditTrail);
        actionFilter.setAttribute('data-listener-added', 'true');
    }
    if (userFilter && !userFilter.hasAttribute('data-listener-added')) {
        userFilter.addEventListener('change', filterAuditTrail);
        userFilter.setAttribute('data-listener-added', 'true');
    }
    if (startDateFilter && !startDateFilter.hasAttribute('data-listener-added')) {
        startDateFilter.addEventListener('change', filterAuditTrail);
        startDateFilter.setAttribute('data-listener-added', 'true');
    }
    if (endDateFilter && !endDateFilter.hasAttribute('data-listener-added')) {
        endDateFilter.addEventListener('change', filterAuditTrail);
        endDateFilter.setAttribute('data-listener-added', 'true');
    }
}

// Initialize default date range when audit page is first loaded
let auditPageInitialized = false;

function initializeAuditPage() {
    if (!auditPageInitialized) {
        setDefaultDateRange();
        auditPageInitialized = true;
    }
    initializeAuditEventListeners();
    loadAuditTrail(1);
}

// Add CSS for action badges and audit details modal
const auditStyles = `
    <style>
        .action-badge {
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .action-badge.login { background: #e3f2fd; color: #1976d2; }
        .action-badge.create { background: #e8f5e8; color: #2e7d32; }
        .action-badge.update { background: #fff3e0; color: #f57c00; }
        .action-badge.delete { background: #ffebee; color: #d32f2f; }
        .action-badge.error { background: #fce4ec; color: #c2185b; }
        .action-badge.default { background: #f5f5f5; color: #616161; }
        
        .audit-details-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
        }
        
        .audit-details-content {
            background: white;
            border-radius: 15px;
            width: 90%;
            max-width: 800px;
            max-height: 90vh;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }
        
        .audit-details-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .audit-details-header h3 {
            margin: 0;
            font-size: 20px;
        }
        
        .close-audit-details {
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            padding: 5px;
        }
        
        .audit-details-body {
            padding: 20px;
            max-height: calc(90vh - 80px);
            overflow-y: auto;
        }
        
        .audit-section {
            margin-bottom: 25px;
            padding: 20px;
            border-radius: 10px;
            border-left: 4px solid #667eea;
        }
        
        .audit-section.creation {
            background: #f0f9ff;
            border-left-color: #22c55e;
        }
        
        .audit-section.update {
            background: #fffbeb;
            border-left-color: #f59e0b;
        }
        
        .audit-section.deletion {
            background: #fef2f2;
            border-left-color: #ef4444;
        }
        
        .audit-section h4 {
            margin: 0 0 15px 0;
            color: #333;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .section-description {
            margin: 0 0 15px 0;
            color: #666;
            font-style: italic;
        }
        
        .audit-info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 15px;
        }
        
        .audit-info-item {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }
        
        .audit-info-item label {
            font-weight: 600;
            color: #333;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        
        .audit-info-item span {
            color: #666;
            word-break: break-word;
        }
        
        .user-agent {
            font-size: 11px;
            font-family: monospace;
        }
        
        .data-display {
            background: white;
            border-radius: 8px;
            padding: 15px;
            border: 1px solid #e5e7eb;
        }
        
        .data-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #f3f4f6;
        }
        
        .data-item:last-child {
            border-bottom: none;
        }
        
        .data-item label {
            font-weight: 600;
            color: #374151;
            min-width: 120px;
        }
        
        .created-value {
            color: #22c55e;
            font-weight: 500;
        }
        
        .deleted-value {
            color: #ef4444;
            font-weight: 500;
            text-decoration: line-through;
        }
        
        .changes-list {
            background: white;
            border-radius: 8px;
            padding: 15px;
            border: 1px solid #e5e7eb;
        }
        
        .change-item {
            margin-bottom: 20px;
            padding: 15px;
            background: #f9fafb;
            border-radius: 8px;
            border: 1px solid #e5e7eb;
        }
        
        .change-item:last-child {
            margin-bottom: 0;
        }
        
        .field-name {
            font-weight: 600;
            color: #374151;
            margin-bottom: 10px;
            font-size: 14px;
        }
        
        .value-comparison {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 15px;
            align-items: center;
        }
        
        .old-value, .new-value {
            padding: 10px;
            border-radius: 6px;
            text-align: center;
        }
        
        .old-value {
            background: #fef2f2;
            border: 1px solid #fecaca;
        }
        
        .old-value label {
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            color: #dc2626;
            margin-bottom: 5px;
        }
        
        .old-value span {
            color: #dc2626;
            font-weight: 500;
        }
        
        .new-value {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
        }
        
        .new-value label {
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            color: #16a34a;
            margin-bottom: 5px;
        }
        
        .new-value span {
            color: #16a34a;
            font-weight: 500;
        }
        
        .arrow {
            color: #6b7280;
            font-size: 16px;
        }
        
        @media (max-width: 768px) {
            .audit-details-content {
                width: 95%;
                margin: 20px;
            }
            
            .audit-info-grid {
                grid-template-columns: 1fr;
            }
            
            .value-comparison {
                grid-template-columns: 1fr;
                gap: 10px;
            }
            
            .arrow {
                transform: rotate(90deg);
            }
        }
    </style>
`;

// Add styles to head
document.head.insertAdjacentHTML('beforeend', auditStyles);

// Make functions globally accessible
window.initializeAuditPage = initializeAuditPage;
window.showAuditDetails = showAuditDetails;
window.closeAuditDetails = closeAuditDetails;

// Export audit functions
window.audit = {
    loadAuditTrail,
    filterAuditTrail,
    showAuditDetails,
    exportAuditData,
    clearAuditFilters,
    initializeAuditPage
};