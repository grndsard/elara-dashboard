// Dataset management functionality
let tempFileData = null;

async function loadDatasets() {
    try {
        const data = await app.apiRequest('/datasets');
        
        if (data.success) {
            renderDatasetsTable(data.data);
        } else {
            renderDatasetsTable([]);
        }
        
        // Check Python service status
        checkPythonServiceStatus();
    } catch (error) {
        console.error('Load datasets error:', error);
        renderDatasetsTable([]);
    }
}

// Check Python service status
async function checkPythonServiceStatus() {
    try {
        const response = await app.apiRequest('/datasets/python-service/health');
        updateServiceStatusIndicator(response);
    } catch (error) {
        console.error('Python service health check failed:', error);
        updateServiceStatusIndicator({ success: false, status: 'unavailable', error: error.message });
    }
}

// Update service status indicator
function updateServiceStatusIndicator(status) {
    let statusIndicator = document.getElementById('python-service-status');
    
    if (!statusIndicator) {
        // Create status indicator if it doesn't exist
        const header = document.querySelector('.page-header');
        if (header) {
            statusIndicator = document.createElement('div');
            statusIndicator.id = 'python-service-status';
            statusIndicator.style.cssText = 'margin-top: 10px; padding: 8px 12px; border-radius: 4px; font-size: 12px; display: inline-block;';
            header.appendChild(statusIndicator);
        }
    }
    
    if (statusIndicator) {
        if (status.success && status.status === 'healthy') {
            statusIndicator.innerHTML = '<i class="fas fa-check-circle"></i> Python Service: Online';
            statusIndicator.style.background = '#d4edda';
            statusIndicator.style.color = '#155724';
            statusIndicator.style.border = '1px solid #c3e6cb';
        } else {
            statusIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Python Service: Offline';
            statusIndicator.style.background = '#f8d7da';
            statusIndicator.style.color = '#721c24';
            statusIndicator.style.border = '1px solid #f5c6cb';
        }
    }
}

function renderDatasetsTable(datasets) {
    const tbody = document.getElementById('datasets-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!datasets || datasets.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 20px; color: #666;">No datasets available</td>
            </tr>
        `;
        return;
    }
    
    datasets.forEach(dataset => {
        const row = document.createElement('tr');
        let statusContent = '';
        
        if (dataset.status === 'processing') {
            statusContent = `
                <span class="status-badge processing">
                    <i class="fas fa-spinner fa-spin"></i> Processing
                </span>
            `;
        } else {
            statusContent = `
                <span class="status-badge ${dataset.status}">
                    ${dataset.status.charAt(0).toUpperCase() + dataset.status.slice(1)}
                </span>
            `;
        }
        
        row.innerHTML = `
            <td>${dataset.name}</td>
            <td>${dataset.uploader_name}</td>
            <td>${app.formatDate(dataset.upload_time)}</td>
            <td>${dataset.record_count.toLocaleString()}</td>
            <td>${statusContent}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-sm btn-edit" onclick="editDataset(${dataset.id})" title="Edit Dataset">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-sm btn-delete" onclick="deleteDataset(${dataset.id}, '${dataset.name}')" title="Delete Dataset">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Upload dataset modal functions
function showUploadDatasetModal() {
    const modal = document.getElementById('upload-dataset-modal');
    if (modal) {
        modal.style.display = 'block';
        const form = document.getElementById('upload-dataset-form');
        if (form) form.reset();
        
        // Clear any existing file info
        const existingInfo = document.getElementById('file-info');
        if (existingInfo) {
            existingInfo.remove();
        }
        
        // Show file input and hide sheet selection
        const fileInputWrapper = document.querySelector('.file-input-wrapper');
        if (fileInputWrapper) {
            fileInputWrapper.style.display = 'block';
        }
        
        const sheetSelection = document.getElementById('sheet-selection');
        if (sheetSelection) {
            sheetSelection.style.display = 'none';
        }
        
        tempFileData = null;
        
        // Re-initialize file input handler when modal opens
        setTimeout(() => {
            initializeFileInput();
            initializeDatasetNameValidation();
            const nameInput = document.getElementById('dataset-name');
            if (nameInput) nameInput.focus();
        }, 100);
    }
}

// Separate function to initialize file input
function initializeFileInput() {
    const fileInput = document.getElementById('dataset-file');
    if (fileInput) {
        // Remove existing listeners
        fileInput.removeEventListener('change', handleFileChange);
        // Add new listener
        fileInput.addEventListener('change', handleFileChange);
    }
}

// File change handler
async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    console.log('File selected:', file.name);
    
    // Disable upload button while processing
    const uploadBtn = document.querySelector('#upload-dataset-form button[type="submit"]');
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing file...';
    }
    
    // Hide file input after selection
    const fileInputWrapper = document.querySelector('.file-input-wrapper');
    if (fileInputWrapper) {
        fileInputWrapper.style.display = 'none';
    }
    
    // Always display file info first
    displayFileInfo(file);
    
    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) {
        await handleExcelFile(file);
    } else {
        const sheetSelection = document.getElementById('sheet-selection');
        if (sheetSelection) {
            sheetSelection.style.display = 'none';
        }
        tempFileData = null;
        
        // Re-enable upload button for non-Excel files
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Dataset';
        }
    }
}

function closeUploadDatasetModal() {
    const modal = document.getElementById('upload-dataset-modal');
    if (modal) {
        modal.style.display = 'none';
        
        // Clear file info when closing
        const existingInfo = document.getElementById('file-info');
        if (existingInfo) {
            existingInfo.remove();
        }
    }
}

// Upload dataset form handler
function initializeUploadForm() {
    const form = document.getElementById('upload-dataset-form');
    const fileInput = document.getElementById('dataset-file');
    if (!form) return;
    
    // Initialize file input
    initializeFileInput();
    
    form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const name = formData.get('name');
    const file = formData.get('file');
    
    // Validate required fields
    if (!name || (!file && !tempFileData)) {
        app.showAlert('Please fill in all required fields', 'error');
        return;
    }
    
    // Check for duplicate dataset name
    try {
        const existingDatasets = await app.apiRequest('/datasets');
        if (existingDatasets.success) {
            const duplicateName = existingDatasets.data.find(dataset => 
                dataset.name.toLowerCase() === name.toLowerCase()
            );
            if (duplicateName) {
                app.showAlert('Dataset name already exists. Please choose a different name.', 'error');
                return;
            }
        }
    } catch (error) {
        console.error('Error checking dataset names:', error);
    }
    
    // Check if sheet selection is required but not selected
    const sheetSelection = document.getElementById('sheet-selection');
    const sheetSelect = document.getElementById('dataset-sheet');
    if (sheetSelection && sheetSelection.style.display === 'block' && sheetSelect && !sheetSelect.value) {
        app.showAlert('Please select a sheet to import from the Excel file', 'error');
        return;
    }
    
    const fileName = file ? file.name : tempFileData.filename;
    const fileSize = file ? file.size : 0;
    
    // Validate file format
    const allowedTypes = ['.xls', '.xlsx', '.csv'];
    const maxSize = 300 * 1024 * 1024; // 300MB
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
        app.showAlert('Please select a valid Excel (.xls, .xlsx) or CSV file.', 'error');
        return;
    }
    
    if (fileSize > maxSize) {
        app.showAlert('File size must be less than 300MB.', 'error');
        return;
    }
    
    // Validate file structure
    const structureValidation = await validateFileStructure(file);
    if (!structureValidation.isValid) {
        app.showAlert(`File structure validation failed: ${structureValidation.errors.join(', ')}`, 'error');
        return;
    }
    
    // Show confirmation dialog with dataset details
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    const selectedSheet = getSelectedSheetInfo();
    
    const confirmResult = await Swal.fire({
        title: 'Are you sure you want to upload this dataset?',
        html: `
            <div class="dataset-confirmation">
                <div class="confirmation-header">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f39c12; margin-bottom: 20px;"></i>
                    <h3>Please confirm the dataset upload:</h3>
                </div>
                
                <div class="dataset-details">
                    <div class="detail-item">
                        <i class="fas fa-tag"></i>
                        <span><strong>Dataset Name:</strong> ${name}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-file"></i>
                        <span><strong>File Name:</strong> ${file.name}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-weight-hanging"></i>
                        <span><strong>File Size:</strong> ${fileSizeMB} MB</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-file-alt"></i>
                        <span><strong>File Type:</strong> ${file.type || 'Unknown'}</span>
                    </div>
                    ${selectedSheet ? `
                    <div class="detail-item">
                        <i class="fas fa-table"></i>
                        <span><strong>Selected Sheet:</strong> ${selectedSheet}</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="confirmation-warning">
                    <i class="fas fa-exclamation-circle"></i>
                    <p><strong>Warning:</strong> This will permanently import the data into the system. Make sure the file format and data are correct before proceeding.</p>
                </div>
            </div>
            
            <style>
                .dataset-confirmation { text-align: left; }
                .confirmation-header { text-align: center; margin-bottom: 25px; }
                .dataset-details { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .detail-item { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
                .detail-item:last-child { margin-bottom: 0; }
                .detail-item i { color: #667eea; width: 20px; }
                .confirmation-warning { background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #f39c12; }
                .confirmation-warning i { color: #f39c12; margin-right: 8px; }
                .confirmation-warning p { margin: 0; color: #856404; }
            </style>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f39c12',
        cancelButtonColor: '#6c757d',
        confirmButtonText: '<i class="fas fa-check"></i> Yes, I\'m sure - Upload Dataset',
        cancelButtonText: '<i class="fas fa-times"></i> Cancel',
        width: 600,
        customClass: {
            popup: 'dataset-upload-confirmation'
        }
    });
    
    if (!confirmResult.isConfirmed) {
        return;
    }
    
    // Close upload modal immediately after confirmation
    closeUploadDatasetModal();
    
    // Prepare upload data
    const uploadData = new FormData();
    uploadData.append('name', name);
    
    if (tempFileData) {
        uploadData.append('tempId', tempFileData.tempId);
        const selectedSheet = document.getElementById('dataset-sheet');
        if (selectedSheet && selectedSheet.value) {
            uploadData.append('selectedSheet', selectedSheet.value);
        }
    } else {
        uploadData.append('file', file);
    }
    
    // Start upload with animated progress
    await uploadDatasetWithProgress(uploadData, name, fileName);
    });
}

// Initialize form when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeUploadForm();
});

async function handleExcelFile(file) {
    try {
        // Show loading indicator
        const sheetSelection = document.getElementById('sheet-selection');
        if (sheetSelection) {
            sheetSelection.innerHTML = '<p style="text-align: center; color: #666;"><i class="fas fa-spinner fa-spin"></i> Reading Excel sheets...</p>';
            sheetSelection.style.display = 'block';
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/datasets/sheets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success && result.data.sheets.length > 1) {
            tempFileData = result.data;
            
            // Show sheet selector
            sheetSelection.innerHTML = `
                <label for="dataset-sheet">
                    <i class="fas fa-table"></i>
                    Select Sheet (${result.data.sheets.length} sheets found)
                </label>
                <select id="dataset-sheet" name="sheet" required>
                    <option value="">Choose which sheet to import...</option>
                </select>
                <small class="form-help">This Excel file contains multiple sheets. Please select which one to import.</small>
            `;
            
            const sheetSelect = document.getElementById('dataset-sheet');
            result.data.sheets.forEach((sheet, index) => {
                const option = document.createElement('option');
                option.value = sheet;
                option.textContent = `${sheet} ${index === 0 ? '(first sheet)' : ''}`;
                sheetSelect.appendChild(option);
            });
            
            sheetSelection.style.display = 'block';
        } else if (result.success) {
            tempFileData = result.data;
            if (sheetSelection) {
                sheetSelection.style.display = 'none';
            }
        } else {
            throw new Error(result.message || 'Failed to read Excel sheets');
        }
        
        // Re-enable upload button after processing
        const uploadBtn = document.querySelector('#upload-dataset-form button[type="submit"]');
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Dataset';
        }
    } catch (error) {
        console.error('Error getting sheets:', error);
        const sheetSelection = document.getElementById('sheet-selection');
        if (sheetSelection) {
            sheetSelection.innerHTML = '<p style="color: #dc3545;"><i class="fas fa-exclamation-triangle"></i> Error reading Excel file</p>';
        }
        
        // Re-enable upload button on error
        const uploadBtn = document.querySelector('#upload-dataset-form button[type="submit"]');
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = '<i class="fas fa-upload"></i> Upload Dataset';
        }
        
        app.showAlert('Error reading Excel file: ' + error.message, 'error');
    }
}

// Get selected sheet information for confirmation
function getSelectedSheetInfo() {
    const sheetSelect = document.getElementById('dataset-sheet');
    if (sheetSelect && sheetSelect.value) {
        const selectedOption = sheetSelect.options[sheetSelect.selectedIndex];
        return selectedOption.textContent;
    }
    return null;
}

// Enhanced upload function with time estimates and step tracking
async function uploadDatasetWithProgress(formData, name, fileName) {
    // Store upload info globally for completion dialog
    window.uploadStartTime = Date.now();
    window.uploadRecordCount = 0;
    
    // Create custom progress modal
    const progressModal = document.createElement('div');
    progressModal.id = 'custom-progress-modal';
    progressModal.className = 'custom-modal-overlay';
    progressModal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999;';
    progressModal.innerHTML = `
        <div class="custom-modal-content upload-progress-modal" style="position: relative; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); max-width: 500px; width: 90%; max-height: 90vh; overflow-y: auto;">
            <div class="upload-progress-container">
                <div class="progress-header">
                    <div class="upload-icon">
                        <i class="fas fa-cloud-upload-alt"></i>
                    </div>
                    <div class="dataset-info">
                        <h3>${name}</h3>
                        <p>${fileName}</p>
                    </div>
                </div>
                
                <div class="progress-steps">
                    <div class="step-indicator">
                        <div class="step-circle">
                            <span class="step-number">1</span>
                        </div>
                        <div class="step-content">
                            <span class="step-text" id="current-step-text">Initializing upload...</span>
                        </div>
                    </div>
                    
                    <div class="steps-timeline">
                        <div class="timeline-step active" data-step="1">
                            <div class="timeline-dot"></div>
                            <span>Upload</span>
                        </div>
                        <div class="timeline-step" data-step="2">
                            <div class="timeline-dot"></div>
                            <span>Process</span>
                        </div>
                        <div class="timeline-step" data-step="3">
                            <div class="timeline-dot"></div>
                            <span>Validate</span>
                        </div>
                        <div class="timeline-step" data-step="4">
                            <div class="timeline-dot"></div>
                            <span>Complete</span>
                        </div>
                    </div>
                </div>
                
                <div class="progress-section">
                    <div class="progress-bar">
                        <div class="progress-fill" id="upload-progress-fill"></div>
                    </div>
                    <div class="progress-info">
                        <span class="progress-percentage" id="progress-percentage">0%</span>
                        <span class="progress-status" id="progress-status">Preparing upload...</span>
                    </div>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-tachometer-alt"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">Speed</span>
                            <span class="stat-value" id="upload-speed">-</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-clock"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">Remaining</span>
                            <span class="stat-value" id="time-remaining">Calculating...</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-database"></i></div>
                        <div class="stat-content">
                            <span class="stat-label">Records</span>
                            <span class="stat-value" id="records-processed">0</span>
                        </div>
                    </div>
                </div>
                
                <div class="progress-actions" id="progress-actions">
                    <button class="btn-action btn-cancel" onclick="cancelUpload()">
                        <i class="fas fa-times"></i>
                        <span>Cancel Upload</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(progressModal);
    
    try {
        const startTime = Date.now();
        let lastLoaded = 0;
        let lastTime = startTime;
        
        const xhr = new XMLHttpRequest();
        window.currentUploadXHR = xhr; // Store for cancellation
        
        xhr.upload.addEventListener('progress', function(e) {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 30); // Upload is 30% of total process
                const currentTime = Date.now();
                const timeDiff = (currentTime - lastTime) / 1000;
                const bytesDiff = e.loaded - lastLoaded;
                
                let status = 'Uploading file...';
                let speed = '-';
                let timeRemaining = 'Calculating...';
                
                // Update step indicator
                updateStepIndicator(1, 'Uploading file...');
                
                // Calculate and display speed with better accuracy
                if (timeDiff > 0.5 && bytesDiff > 0) {
                    const speedBytes = bytesDiff / timeDiff;
                    speed = formatBytes(speedBytes) + '/s';
                    
                    // Enhanced time remaining calculation
                    const remainingBytes = e.total - e.loaded;
                    const uploadTimeRemaining = remainingBytes / speedBytes;
                    
                    // Estimate total time including processing (upload is ~30% of total)
                    const totalEstimatedTime = uploadTimeRemaining / 0.3;
                    timeRemaining = formatTime(totalEstimatedTime);
                    
                    lastLoaded = e.loaded;
                    lastTime = currentTime;
                }
                
                updateProgress(percentComplete, status, speed, timeRemaining, 0);
            }
        });
        
        xhr.addEventListener('load', function() {
            console.log('XHR load event - Status:', xhr.status);
            console.log('Response text:', xhr.responseText);
            
            if (xhr.status === 200 || xhr.status === 201) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    console.log('Parsed response data:', data);
                    
                    if (data.success) {
                        // Store record count for completion dialog
                        window.uploadRecordCount = data.data.recordCount || 0;
                        
                        // Start processing simulation after upload completes
                        updateStepIndicator(2, 'Processing file data...');
                        updateProgress(35, 'Processing file data...', '-', 'Processing...', 0);
                        
                        // Simulate processing steps
                        setTimeout(() => {
                            updateStepIndicator(3, 'Inserting records into database...');
                            updateProgress(70, 'Inserting records...', '-', 'Finalizing...', Math.floor(data.data.recordCount * 0.5));
                        }, 1000);
                        
                        setTimeout(() => {
                            updateStepIndicator(4, 'Validating data integrity...');
                            updateProgress(95, 'Validating data...', '-', 'Completing...', Math.floor(data.data.recordCount * 0.9));
                        }, 2000);
                        
                        setTimeout(() => {
                            // Upload completed successfully
                            updateStepIndicator(4, 'Upload completed successfully!');
                            updateProgress(100, 'Upload completed!', '-', 'Done!', data.data.recordCount);
                            
                            // Replace action buttons with close button
                            const actionsDiv = document.getElementById('progress-actions');
                            if (actionsDiv) {
                                actionsDiv.innerHTML = `
                                    <button class="btn-action btn-primary" onclick="closeCompletedUpload()">
                                        <i class="fas fa-check"></i>
                                        <span>Close</span>
                                    </button>
                                `;
                            }
                            
                            // Auto-close after 3 seconds
                            setTimeout(() => {
                                closeCompletedUpload();
                            }, 3000);
                        }, 3000);
                        
                    } else {
                        throw new Error(data.message || 'Upload failed');
                    }
                } catch (parseError) {
                    console.error('Error parsing server response:', parseError);
                    console.error('Raw response:', xhr.responseText);
                    throw new Error('Invalid server response: ' + parseError.message);
                }
            } else {
                console.error('Upload failed with status:', xhr.status);
                console.error('Response text:', xhr.responseText);
                
                // Try to parse error response
                let errorMessage = `Upload failed with status: ${xhr.status}`;
                let errorDetails = xhr.responseText;
                
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    console.error('Server error details:', errorData);
                    errorMessage = errorData.message || errorMessage;
                    errorDetails = errorData.error || errorData.details || xhr.responseText;
                } catch (parseError) {
                    console.error('Failed to parse error response:', parseError);
                    errorDetails = xhr.responseText.substring(0, 500);
                }
                
                throw new Error(JSON.stringify({ message: errorMessage, details: errorDetails, status: xhr.status }));
            }
        });
        
        xhr.addEventListener('error', function() {
            console.error('XHR error occurred');
            if (progressModal && progressModal.parentNode) {
                progressModal.parentNode.removeChild(progressModal);
            }
            throw new Error(JSON.stringify({ 
                message: 'Upload failed. Please check your connection and try again.',
                details: 'Network error occurred during upload',
                status: 'network_error'
            }));
        });
        
        xhr.addEventListener('abort', function() {
            console.log('Upload was cancelled');
            if (progressModal && progressModal.parentNode) {
                progressModal.parentNode.removeChild(progressModal);
            }
        });
        
        xhr.open('POST', '/api/datasets/upload');
        xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('authToken')}`);
        xhr.send(formData);
        
    } catch (error) {
        console.error('Upload dataset error:', error);
        
        // Clean up progress elements
        if (progressModal && progressModal.parentNode) {
            progressModal.parentNode.removeChild(progressModal);
        }
        
        // Parse error details if available
        let errorInfo = { message: error.message, details: null, status: null };
        try {
            const parsed = JSON.parse(error.message);
            errorInfo = parsed;
        } catch (e) {
            // Use original message if not JSON
        }
        
        Swal.fire({
            title: 'Upload Failed',
            html: `
                <div style="text-align: center;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 64px; color: #dc3545; margin-bottom: 20px;"></i>
                    <h3>Dataset upload failed</h3>
                    <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: left;">
                        <div style="margin-bottom: 10px;"><i class="fas fa-times-circle" style="color: #dc3545; margin-right: 8px;"></i><strong>Error:</strong> ${errorInfo.message}</div>
                        ${errorInfo.status ? `<div style="margin-bottom: 10px;"><i class="fas fa-info-circle" style="color: #dc3545; margin-right: 8px;"></i><strong>Status:</strong> ${errorInfo.status}</div>` : ''}
                        <div style="margin-bottom: 10px;"><i class="fas fa-database" style="color: #dc3545; margin-right: 8px;"></i><strong>Dataset Table:</strong> No changes made</div>
                        <div><i class="fas fa-table" style="color: #dc3545; margin-right: 8px;"></i><strong>Records Table:</strong> No data imported</div>
                        ${errorInfo.details ? `
                        <div style="margin-top: 15px; padding: 10px; background: #fff; border: 1px solid #dc3545; border-radius: 4px;">
                            <strong style="color: #dc3545;">Technical Details:</strong>
                            <pre style="font-size: 11px; color: #666; margin: 5px 0 0 0; white-space: pre-wrap; word-break: break-word;">${errorInfo.details}</pre>
                        </div>
                        ` : ''}
                    </div>
                    <p style="color: #666; font-size: 14px;">Please check your file format and try again. If the problem persists, contact support.</p>
                </div>
            `,
            icon: 'error',
            confirmButtonColor: '#dc3545',
            width: 600,
            customClass: {
                popup: 'upload-error-modal'
            }
        });
    }
}

// File structure validation
async function validateFileStructure(file) {
    // Based on server-side column mapping, these are the key columns needed
    const requiredColumns = [
        'account_group_name', 'balance', 'debit', 'credit'
    ];
    
    return new Promise((resolve) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                let headers = [];
                const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
                
                if (fileExtension === '.csv') {
                    const text = e.target.result;
                    const firstLine = text.split('\n')[0];
                    headers = firstLine.split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
                } else if (['.xls', '.xlsx'].includes(fileExtension)) {
                    // Skip validation for Excel files since we can't easily read them client-side
                    // Let the server handle validation
                    resolve({
                        isValid: true,
                        requiredColumns,
                        errors: []
                    });
                    return;
                }
                
                const errors = [];
                // Check for essential columns with flexible matching
                const missingColumns = requiredColumns.filter(col => {
                    const variations = [
                        col,
                        col.replace('_', ' '),
                        col.replace('_', ''),
                        col.toUpperCase(),
                        col.toUpperCase().replace('_', ' '),
                        // Specific variations
                        col === 'account_group_name' ? 'account group' : null,
                        col === 'account_group_name' ? 'account group name' : null
                    ].filter(Boolean);
                    
                    return !headers.some(header => 
                        variations.some(variation => 
                            header.includes(variation.toLowerCase()) || 
                            header === variation.toLowerCase()
                        )
                    );
                });
                
                if (missingColumns.length > 0) {
                    errors.push(`Missing columns: ${missingColumns.join(', ')}`);
                }
                
                resolve({
                    isValid: errors.length === 0,
                    requiredColumns,
                    errors
                });
            } catch (error) {
                resolve({
                    isValid: false,
                    requiredColumns,
                    errors: ['Unable to read file structure']
                });
            }
        };
        
        reader.onerror = function() {
            resolve({
                isValid: false,
                requiredColumns,
                errors: ['Unable to read file']
            });
        };
        
        reader.readAsText(file);
    });
}

// Helper functions
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTime(seconds) {
    if (seconds < 60) return Math.round(seconds) + 's';
    if (seconds < 3600) return Math.round(seconds / 60) + 'm';
    return Math.round(seconds / 3600) + 'h';
}

// Edit dataset function
async function editDataset(datasetId) {
    try {
        // Get dataset details first
        const dataset = await app.apiRequest(`/datasets/${datasetId}`);
        if (!dataset.success) {
            throw new Error(dataset.message || 'Failed to load dataset details');
        }
        
        const data = dataset.data;
        
        const result = await Swal.fire({
            title: 'Edit Dataset',
            html: `
                <div class="dataset-edit-form">
                    <div class="form-group">
                        <label for="dataset-name-edit">Dataset Name</label>
                        <input type="text" id="dataset-name-edit" value="${data.name}" class="dataset-name-input">
                    </div>
                    
                    <div class="dataset-info">
                        <div class="info-row">
                            <span class="label">Records:</span>
                            <span class="value">${data.record_count?.toLocaleString() || 0}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Uploaded:</span>
                            <span class="value">${app.formatDate(data.upload_time)}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Uploader:</span>
                            <span class="value">${data.uploader_name}</span>
                        </div>
                        <div class="info-row">
                            <span class="label">Status:</span>
                            <span class="status-badge ${data.status}">${data.status}</span>
                        </div>
                    </div>
                </div>
                
                <style>
                    .dataset-edit-form { text-align: left; padding: 0; }
                    .form-group { margin-bottom: 20px; }
                    .form-group label { display: block; margin-bottom: 8px; font-weight: 600; color: #333; text-align: left; }
                    .dataset-name-input { 
                        width: 100% !important; 
                        max-width: 100% !important; 
                        margin: 0 !important; 
                        padding: 12px 16px !important; 
                        border: 2px solid #e1e5e9 !important; 
                        border-radius: 8px !important; 
                        font-size: 14px !important; 
                        box-sizing: border-box !important;
                        background: #fff !important;
                        transition: border-color 0.2s ease !important;
                    }
                    .dataset-name-input:focus {
                        border-color: #667eea !important;
                        outline: none !important;
                        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
                    }
                    .dataset-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px; }
                    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
                    .info-row:last-child { margin-bottom: 0; }
                    .label { font-weight: 500; color: #666; }
                    .value { color: #333; }
                    .status-badge { padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
                    .status-badge.completed { background: #d4edda; color: #155724; }
                    .status-badge.processing { background: #fff3cd; color: #856404; }
                    .status-badge.failed { background: #f8d7da; color: #721c24; }
                </style>
            `,
            width: 450,
            showCancelButton: true,
            confirmButtonText: 'Save',
            cancelButtonText: 'Cancel',
            preConfirm: async () => {
                const name = document.getElementById('dataset-name-edit').value;
                
                if (!name.trim()) {
                    Swal.showValidationMessage('Dataset name is required');
                    return false;
                }
                
                // Check if name actually changed
                if (name.trim() === data.name) {
                    Swal.showValidationMessage('No changes made to dataset name');
                    return false;
                }
                
                // Show confirmation dialog
                const confirmResult = await Swal.fire({
                    title: 'Confirm Changes',
                    html: `
                        <div style="text-align: left;">
                            <p>Are you sure you want to update this dataset?</p>
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                                <div style="margin-bottom: 10px;"><strong>Current Name:</strong> ${data.name}</div>
                                <div><strong>New Name:</strong> ${name.trim()}</div>
                            </div>
                            <p style="color: #666; font-size: 14px;">This will update the dataset name in the system.</p>
                        </div>
                    `,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, Update Dataset',
                    cancelButtonText: 'Cancel',
                    confirmButtonColor: '#667eea'
                });
                
                if (!confirmResult.isConfirmed) {
                    return false;
                }
                
                return { name: name.trim() };
            }
        });
        
        if (result.isConfirmed) {
            const updateData = await app.apiRequest(`/datasets/${datasetId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: result.value.name, description: null })
            });
            
            if (updateData.success) {
                app.showAlert('Dataset updated successfully', 'success');
                loadDatasets();
            } else {
                throw new Error(updateData.message || 'Failed to update dataset');
            }
        }
    } catch (error) {
        console.error('Edit dataset error:', error);
        app.showAlert(error.message || 'Failed to edit dataset', 'error');
    }
}

// Reprocess dataset function
async function reprocessDataset(datasetId) {
    const result = await Swal.fire({
        title: 'Reprocess Dataset',
        text: 'This will delete all existing records and reprocess the original file. Continue?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f39c12',
        confirmButtonText: 'Yes, reprocess'
    });
    
    if (result.isConfirmed) {
        try {
            const response = await app.apiRequest(`/datasets/${datasetId}/reprocess`, {
                method: 'POST'
            });
            
            if (response.success) {
                app.showAlert('Dataset reprocessing started', 'success');
                loadDatasets();
            }
        } catch (error) {
            app.showAlert(error.message || 'Failed to reprocess dataset', 'error');
        }
    }
}

// Delete dataset function
async function deleteDataset(datasetId, datasetName) {
    const result = await Swal.fire({
        title: 'Delete Dataset',
        html: `
            <p>Are you sure you want to delete <strong>${datasetName}</strong>?</p>
            <p style="color: #dc3545; font-size: 14px;">
                <i class="fas fa-exclamation-triangle"></i>
                This will permanently delete all associated records and cannot be undone.
            </p>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc3545',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, delete dataset',
        cancelButtonText: 'Cancel'
    });
    
    if (result.isConfirmed) {
        // Show deletion progress
        const progressModal = Swal.fire({
            title: 'Deleting Dataset',
            html: `
                <div style="text-align: center;">
                    <i class="fas fa-trash-alt" style="font-size: 48px; color: #dc3545; margin-bottom: 20px; animation: pulse 2s infinite;"></i>
                    <h4>${datasetName}</h4>
                    <div class="progress-wrapper" style="margin: 20px 0;">
                        <div class="progress-bar" style="background: #e9ecef; height: 8px; border-radius: 4px; overflow: hidden;">
                            <div class="progress-fill" id="delete-progress-fill" style="background: #dc3545; height: 100%; width: 0%; transition: width 0.3s ease;"></div>
                        </div>
                    </div>
                    <p id="delete-status" style="color: #666; margin: 10px 0;">Preparing deletion...</p>
                    <p id="delete-time" style="color: #999; font-size: 12px; margin: 5px 0;"></p>
                </div>
                <style>
                    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                </style>
            `,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            width: 450
        });
        
        try {
            // Update progress steps
            const updateProgress = (percent, status) => {
                const progressFill = document.getElementById('delete-progress-fill');
                const statusEl = document.getElementById('delete-status');
                if (progressFill) progressFill.style.width = percent + '%';
                if (statusEl) statusEl.textContent = status;
            };
            
            const startTime = Date.now();
            updateProgress(10, 'Connecting to database...');
            
            // Get dataset info first to estimate time
            const datasetInfo = await app.apiRequest(`/datasets/${datasetId}`);
            const recordCount = datasetInfo.data?.record_count || 0;
            const estimatedTime = Math.max(2, Math.ceil(recordCount / 5000)); // ~5000 records per second
            
            updateProgress(20, `Preparing to delete ${recordCount.toLocaleString()} records...`);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            updateProgress(30, `Estimated time: ${estimatedTime} seconds`);
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Start deletion with progress simulation
            const deletePromise = app.apiRequest(`/datasets/${datasetId}`, {
                method: 'DELETE'
            });
            
            // Simulate progress based on estimated time
            const progressInterval = setInterval(() => {
                const elapsed = (Date.now() - startTime) / 1000;
                const progress = Math.min(95, 30 + (elapsed / estimatedTime) * 60);
                const remaining = Math.max(0, estimatedTime - elapsed);
                
                if (remaining > 0) {
                    updateProgress(progress, `Deleting records... ${remaining.toFixed(0)}s remaining`);
                } else {
                    updateProgress(95, 'Finalizing deletion...');
                }
            }, 500);
            
            const data = await deletePromise;
            clearInterval(progressInterval);
            
            updateProgress(100, 'Deletion completed!');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            progressModal.close();
            
            if (data.success) {
                await loadDatasets();
                Swal.fire({
                    title: 'Deleted!',
                    text: `Dataset "${datasetName}" and all its records have been deleted successfully.`,
                    icon: 'success',
                    timer: 3000,
                    showConfirmButton: false
                });
            } else {
                throw new Error(data.message || 'Failed to delete dataset');
            }
        } catch (error) {
            progressModal.close();
            console.error('Delete dataset error:', error);
            Swal.fire({
                title: 'Delete Failed',
                text: error.message || 'Failed to delete dataset',
                icon: 'error'
            });
        }
    }
}

// Remove duplicate file input handler since it's now in initializeUploadForm

function displayFileInfo(file) {
    const fileSize = (file.size / 1024 / 1024).toFixed(2);
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    let fileIcon = 'fas fa-file';
    if (['.xls', '.xlsx'].includes(fileExtension)) {
        fileIcon = 'fas fa-file-excel';
    } else if (fileExtension === '.csv') {
        fileIcon = 'fas fa-file-csv';
    }
    
    // Remove existing file info
    const existingInfo = document.getElementById('file-info');
    if (existingInfo) {
        existingInfo.remove();
    }
    
    const fileInfo = document.createElement('div');
    fileInfo.id = 'file-info';
    fileInfo.style.cssText = 'margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px; border: 1px solid #dee2e6;';
    fileInfo.innerHTML = `
        <div class="file-details" style="display: flex; align-items: center; gap: 10px;">
            <i class="${fileIcon}" style="font-size: 24px; color: #28a745;"></i>
            <div>
                <div class="file-name" style="font-weight: bold; color: #333;">${file.name}</div>
                <div class="file-size" style="font-size: 12px; color: #666;">${fileSize} MB • ${file.type || 'Unknown type'}</div>
            </div>
        </div>
    `;
    
    // Add new file info after the file input wrapper
    const wrapper = document.querySelector('.file-input-wrapper');
    if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.insertBefore(fileInfo, wrapper.nextSibling);
    }
}

// Enhanced drag and drop functionality
function initializeDragAndDrop() {
    const fileInput = document.getElementById('dataset-file');
    const wrapper = document.querySelector('.file-input-wrapper');
    
    if (!fileInput || !wrapper) return;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        wrapper.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        wrapper.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        wrapper.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight(e) {
        wrapper.classList.add('dragover');
    }
    
    function unhighlight(e) {
        wrapper.classList.remove('dragover');
    }
    
    wrapper.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            const file = files[0];
            // Validate file type
            const allowedTypes = ['.xls', '.xlsx', '.csv'];
            const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
            
            if (allowedTypes.includes(fileExtension)) {
                fileInput.files = files;
                fileInput.dispatchEvent(new Event('change'));
            } else {
                app.showAlert('Please select a valid Excel (.xls, .xlsx) or CSV file.', 'error');
            }
        }
    }
}

// Initialize drag and drop when modal is shown
function initializeModalObserver() {
    const modal = document.getElementById('upload-dataset-modal');
    if (modal) {
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (modal.style.display === 'block') {
                        setTimeout(initializeDragAndDrop, 100);
                    }
                }
            });
        });
        
        observer.observe(modal, { attributes: true });
    }
}

// Dataset name validation
function initializeDatasetNameValidation() {
    const nameInput = document.getElementById('dataset-name');
    if (!nameInput) return;
    
    let validationTimeout;
    
    nameInput.addEventListener('input', function() {
        clearTimeout(validationTimeout);
        const existingError = document.getElementById('dataset-name-error');
        if (existingError) existingError.remove();
        
        const name = this.value.trim();
        if (!name) return;
        
        validationTimeout = setTimeout(async () => {
            try {
                const existingDatasets = await app.apiRequest('/datasets');
                if (existingDatasets.success) {
                    const duplicateName = existingDatasets.data.find(dataset => 
                        dataset.name.toLowerCase() === name.toLowerCase()
                    );
                    
                    if (duplicateName) {
                        const errorDiv = document.createElement('div');
                        errorDiv.id = 'dataset-name-error';
                        errorDiv.style.cssText = 'color: #dc3545; font-size: 12px; margin-top: 5px; display: flex; align-items: center; gap: 5px;';
                        errorDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Dataset name already exists';
                        nameInput.parentNode.appendChild(errorDiv);
                        nameInput.style.borderColor = '#dc3545';
                    } else {
                        nameInput.style.borderColor = '#28a745';
                    }
                }
            } catch (error) {
                console.error('Error validating dataset name:', error);
            }
        }, 500);
    });
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeModalObserver();
});

// Minimizable progress bar functions
function createMinimizableProgressBar(name, fileName) {
    // Remove existing progress bar if any
    const existing = document.getElementById('minimized-progress-bar');
    if (existing) existing.remove();
    
    const progressBar = document.createElement('div');
    progressBar.id = 'minimized-progress-bar';
    progressBar.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 300px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        border: 1px solid #e1e5e9;
        z-index: 1000;
        display: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    progressBar.innerHTML = `
        <div style="padding: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h4 style="margin: 0; font-size: 14px; color: #333;">${name}</h4>
                <div>
                    <button onclick="maximizeProgress()" style="background: none; border: none; color: #666; cursor: pointer; margin-right: 5px;" title="Maximize">
                        <i class="fas fa-window-maximize"></i>
                    </button>
                    <button onclick="cancelUpload()" style="background: none; border: none; color: #dc3545; cursor: pointer;" title="Cancel">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div style="font-size: 12px; color: #666; margin-bottom: 8px;">${fileName}</div>
            <div style="font-size: 11px; color: #667eea; margin-bottom: 8px; font-weight: 500;" id="mini-current-step">Step 1: Initializing...</div>
            <div style="background: #e9ecef; height: 6px; border-radius: 3px; overflow: hidden;">
                <div id="mini-progress-fill" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); height: 100%; width: 0%; transition: width 0.3s ease;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #666;">
                <span id="mini-progress-text">0%</span>
                <span id="mini-progress-status">Preparing...</span>
            </div>
        </div>
    `;
    
    document.body.appendChild(progressBar);
}

function minimizeProgress() {
    const modal = document.querySelector('.upload-progress-modal');
    const miniBar = document.getElementById('minimized-progress-bar');
    
    if (modal && modal.parentElement) {
        modal.parentElement.style.display = 'none';
    }
    if (miniBar) {
        miniBar.style.display = 'block';
    }
}

function maximizeProgress() {
    const modal = document.querySelector('.upload-progress-modal');
    const miniBar = document.getElementById('minimized-progress-bar');
    
    if (modal && modal.parentElement) {
        modal.parentElement.style.display = 'flex';
    }
    if (miniBar) {
        miniBar.style.display = 'none';
    }
}

function cancelUpload() {
    if (window.currentUploadXHR) {
        window.currentUploadXHR.abort();
    }
    const modal = document.getElementById('custom-progress-modal');
    if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
    }
}

function closeCompletedUpload() {
    const modal = document.getElementById('custom-progress-modal');
    if (modal && modal.parentNode) {
        modal.parentNode.removeChild(modal);
    }
    
    setTimeout(() => {
        const processingTime = (Date.now() - window.uploadStartTime) / 1000;
        
        // Create custom success modal
        const successModal = document.createElement('div');
        successModal.className = 'custom-modal-overlay';
        successModal.innerHTML = `
            <div class="custom-modal-content success-modal">
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-check-circle" style="font-size: 64px; color: #28a745; margin-bottom: 20px;"></i>
                    <h3 style="margin: 0 0 20px 0; color: #333;">Upload Successful!</h3>
                    <p style="margin: 0 0 20px 0; color: #666;">Dataset uploaded and processed successfully</p>
                    <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: left;">
                        <div style="margin-bottom: 10px;"><i class="fas fa-database"></i> <strong>Records:</strong> ${window.uploadRecordCount ? window.uploadRecordCount.toLocaleString() : 'N/A'}</div>
                        <div style="margin-bottom: 10px;"><i class="fas fa-tachometer-alt"></i> <strong>Processing Rate:</strong> ${window.uploadRecordCount ? Math.round(window.uploadRecordCount / processingTime).toLocaleString() : 'N/A'} records/sec</div>
                        <div><i class="fas fa-clock"></i> <strong>Completed:</strong> ${new Date().toLocaleString()}</div>
                    </div>
                    <button class="btn-primary" onclick="closeSuccessModal()" style="padding: 12px 24px; border: none; border-radius: 8px; background: #28a745; color: white; cursor: pointer; font-size: 14px; font-weight: 500;">
                        Continue
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(successModal);
    }, 300);
}

function updateProgress(percentage, status, speed, timeRemaining, recordsProcessed) {
    // Update main modal
    const progressFill = document.getElementById('upload-progress-fill');
    const progressPercentage = document.getElementById('progress-percentage');
    const progressStatus = document.getElementById('progress-status');
    const uploadSpeed = document.getElementById('upload-speed');
    const timeRemainingEl = document.getElementById('time-remaining');
    const recordsEl = document.getElementById('records-processed');
    
    if (progressFill) progressFill.style.width = percentage + '%';
    if (progressPercentage) progressPercentage.textContent = percentage + '%';
    if (progressStatus) progressStatus.textContent = status;
    if (uploadSpeed) uploadSpeed.textContent = speed;
    if (timeRemainingEl) timeRemainingEl.textContent = timeRemaining;
    if (recordsEl) recordsEl.textContent = recordsProcessed ? recordsProcessed.toLocaleString() : '0';
}

// Real-time progress polling
async function pollProcessingProgress(datasetId, expectedRecords, startTime) {
    let pollCount = 0;
    const maxPolls = 120; // 2 minutes max
    
    const pollInterval = setInterval(async () => {
        try {
            pollCount++;
            const response = await fetch(`/api/datasets/${datasetId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
            });
            
            if (response.ok) {
                const result = await response.json();
                const dataset = result.data;
                
                if (dataset.status === 'completed') {
                    clearInterval(pollInterval);
                    completeUpload(dataset.record_count, startTime);
                } else if (dataset.status === 'failed') {
                    clearInterval(pollInterval);
                    throw new Error('Processing failed');
                } else {
                    // Update progress based on current record count
                    const currentRecords = dataset.record_count || 0;
                    const progress = Math.min(95, 45 + (currentRecords / expectedRecords) * 50);
                    updateProgress(progress, `Processing... ${currentRecords.toLocaleString()} records`, '-', 'Processing...', currentRecords);
                }
            }
            
            if (pollCount >= maxPolls) {
                clearInterval(pollInterval);
                simulateProgress(expectedRecords, startTime);
            }
        } catch (error) {
            clearInterval(pollInterval);
            simulateProgress(expectedRecords, startTime);
        }
    }, 1000);
}

// Simplified progress simulation for linear progress
function simulateLinearProgress(recordCount, startTime) {
    console.log('Starting linear progress simulation for', recordCount, 'records');
    
    let currentProgress = 45; // Start after upload (40%) + initial processing (5%)
    const targetProgress = 100;
    const progressIncrement = 2; // 2% per step
    const stepInterval = 200; // 200ms per step
    
    const progressInterval = setInterval(() => {
        currentProgress += progressIncrement;
        
        if (currentProgress <= 60) {
            updateStepIndicator(2, 'Processing file data...');
            updateProgress(currentProgress, 'Reading and parsing file...', '-', 'Processing...', Math.floor(recordCount * 0.3));
        } else if (currentProgress <= 85) {
            updateStepIndicator(3, 'Inserting records into database...');
            const processedRecords = Math.floor(recordCount * ((currentProgress - 60) / 25));
            updateProgress(currentProgress, `Inserting records... ${processedRecords.toLocaleString()}/${recordCount.toLocaleString()}`, '-', 'Finalizing...', processedRecords);
        } else if (currentProgress < 100) {
            updateStepIndicator(4, 'Validating data integrity...');
            updateProgress(currentProgress, 'Validating data...', '-', 'Completing...', Math.floor(recordCount * 0.95));
        } else {
            clearInterval(progressInterval);
            updateStepIndicator(4, 'Upload completed successfully!');
            updateProgress(100, 'Upload completed!', '-', 'Done!', recordCount);
            
            // Replace action buttons with close button
            const actionsDiv = document.getElementById('progress-actions');
            if (actionsDiv) {
                actionsDiv.innerHTML = `
                    <button class="btn-action btn-primary" onclick="closeCompletedUpload()">
                        <i class="fas fa-check"></i>
                        <span>Close</span>
                    </button>
                `;
            }
        }
    }, stepInterval);
}

// Fallback simulated progress
function simulateProgress(recordCount, startTime) {
    simulateLinearProgress(recordCount, startTime);
}

// Complete upload function
function completeUpload(recordCount, startTime) {
    updateStepIndicator(4, 'Upload completed successfully!');
    updateProgress(100, 'Upload completed!', '-', 'Done!', recordCount);
    
    // Replace action buttons with close button
    const actionsDiv = document.getElementById('progress-actions');
    if (actionsDiv) {
        actionsDiv.innerHTML = `
            <button class="btn-action btn-primary" onclick="closeCompletedUpload()">
                <i class="fas fa-check"></i>
                <span>Close</span>
            </button>
        `;
    }
}

// New function to update step indicators
function updateStepIndicator(currentStep, stepText) {
    const stepNumber = document.querySelector('.step-number');
    const stepTextEl = document.getElementById('current-step-text');
    const timelineSteps = document.querySelectorAll('.timeline-step');
    
    if (stepNumber) stepNumber.textContent = currentStep;
    if (stepTextEl) stepTextEl.textContent = stepText;
    
    // Update timeline step indicators
    timelineSteps.forEach((step, index) => {
        const stepNum = index + 1;
        step.classList.remove('active', 'completed');
        
        if (stepNum < currentStep) {
            step.classList.add('completed');
        } else if (stepNum === currentStep) {
            step.classList.add('active');
        }
    });
}

// Ensure functions are globally available
if (typeof window !== 'undefined') {
    window.showUploadDatasetModal = showUploadDatasetModal;
    window.closeUploadDatasetModal = closeUploadDatasetModal;
    window.editDataset = editDataset;
    window.deleteDataset = deleteDataset;
    window.loadDatasets = loadDatasets;
    window.reprocessDataset = reprocessDataset;
    window.minimizeProgress = minimizeProgress;
    window.maximizeProgress = maximizeProgress;
    window.cancelUpload = cancelUpload;
    window.closeCompletedUpload = closeCompletedUpload;
    window.closeSuccessModal = function() {
        const modal = document.querySelector('.success-modal');
        if (modal && modal.parentNode && modal.parentNode.parentNode) {
            modal.parentNode.parentNode.removeChild(modal.parentNode);
        }
        loadDatasets();
    };
    
    // Ensure datasets object is available
    window.datasets = {
        loadDatasets,
        showUploadDatasetModal,
        closeUploadDatasetModal,
        editDataset,
        deleteDataset,
        reprocessDataset
    };
    
    console.log('Datasets functions exported:', Object.keys(window.datasets));
}