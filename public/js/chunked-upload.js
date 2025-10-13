// Chunked Upload Utility
class ChunkedUploader {
    constructor(options = {}) {
        this.chunkSize = options.chunkSize || 10 * 1024 * 1024; // 10MB chunks
        this.maxRetries = options.maxRetries || 3;
        this.onProgress = options.onProgress || (() => {});
        this.onComplete = options.onComplete || (() => {});
        this.onError = options.onError || (() => {});
    }

    async uploadFile(file, datasetName, selectedSheet = null) {
        try {
            const totalChunks = Math.ceil(file.size / this.chunkSize);
            
            // Initialize upload session
            const initResponse = await fetch('/api/datasets/upload/init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    fileName: file.name,
                    fileSize: file.size,
                    totalChunks,
                    datasetName
                })
            });

            if (!initResponse.ok) {
                throw new Error('Failed to initialize upload');
            }

            const { uploadId, datasetId } = await initResponse.json();
            
            // Upload chunks
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                await this.uploadChunk(file, uploadId, chunkIndex, totalChunks);
            }

            // Complete upload
            const completeResponse = await fetch('/api/datasets/upload/complete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    uploadId,
                    selectedSheet
                })
            });

            if (!completeResponse.ok) {
                throw new Error('Failed to complete upload');
            }

            const result = await completeResponse.json();
            this.onComplete(result);
            return result;

        } catch (error) {
            this.onError(error);
            throw error;
        }
    }

    async uploadChunk(file, uploadId, chunkIndex, totalChunks) {
        const start = chunkIndex * this.chunkSize;
        const end = Math.min(start + this.chunkSize, file.size);
        const chunk = file.slice(start, end);

        let retries = 0;
        while (retries < this.maxRetries) {
            try {
                const formData = new FormData();
                formData.append('chunk', chunk);
                formData.append('uploadId', uploadId);
                formData.append('chunkIndex', chunkIndex);

                const response = await fetch('/api/datasets/upload/chunk', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`Chunk ${chunkIndex} upload failed`);
                }

                const result = await response.json();
                this.onProgress({
                    chunkIndex,
                    totalChunks,
                    progress: result.progress,
                    uploadedChunks: result.uploadedChunks
                });

                return result;

            } catch (error) {
                retries++;
                if (retries >= this.maxRetries) {
                    throw error;
                }
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * retries));
            }
        }
    }
}

// Enhanced file upload function with chunked upload support
async function uploadDatasetWithChunks(file, datasetName, selectedSheet = null) {
    const fileSize = file.size;
    const useLargeFileUpload = fileSize > 50 * 1024 * 1024; // Use chunked upload for files > 50MB

    if (useLargeFileUpload) {
        console.log('🚀 Using chunked upload for large file:', file.name, `(${(fileSize/1024/1024).toFixed(1)}MB)`);
        
        // Show chunked upload progress
        showToast('Starting chunked upload for large file...', 'info');
        
        const uploader = new ChunkedUploader({
            chunkSize: 10 * 1024 * 1024, // 10MB chunks
            onProgress: (progress) => {
                const percent = progress.progress;
                updateUploadProgress(percent, `Uploading chunk ${progress.uploadedChunks}/${progress.totalChunks} (${percent}%)`);
            },
            onComplete: (result) => {
                hideUploadProgress();
                showToast(result.message, 'success');
                loadDatasets(); // Refresh dataset list
            },
            onError: (error) => {
                hideUploadProgress();
                
                // Show detailed error with SweetAlert
                Swal.fire({
                    title: 'Chunked Upload Failed',
                    html: `
                        <div style="text-align: center;">
                            <i class="fas fa-exclamation-triangle" style="font-size: 64px; color: #dc3545; margin-bottom: 20px;"></i>
                            <h3>Large file upload failed</h3>
                            <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: left;">
                                <div style="margin-bottom: 10px;"><i class="fas fa-times-circle" style="color: #dc3545; margin-right: 8px;"></i><strong>Error:</strong> ${error.message}</div>
                                <div style="margin-bottom: 10px;"><i class="fas fa-file" style="color: #dc3545; margin-right: 8px;"></i><strong>File:</strong> ${file.name} (${(file.size/1024/1024).toFixed(1)}MB)</div>
                                <div style="margin-bottom: 10px;"><i class="fas fa-database" style="color: #dc3545; margin-right: 8px;"></i><strong>Upload Method:</strong> Chunked upload (large file)</div>
                                <div><i class="fas fa-table" style="color: #dc3545; margin-right: 8px;"></i><strong>Status:</strong> Upload incomplete</div>
                            </div>
                            <p style="color: #666; font-size: 14px;">Large file uploads may fail due to network issues or server timeouts. Try again or use a smaller file.</p>
                        </div>
                    `,
                    icon: 'error',
                    confirmButtonColor: '#dc3545',
                    width: 550
                });
            }
        });

        return await uploader.uploadFile(file, datasetName, selectedSheet);
    } else {
        // Use regular upload for smaller files
        console.log('📄 Using regular upload for file:', file.name);
        try {
            return await uploadDatasetRegular(file, datasetName, selectedSheet);
        } catch (error) {
            // Parse error details if available
            let errorInfo = { message: error.message, details: null, status: null };
            try {
                const parsed = JSON.parse(error.message);
                errorInfo = parsed;
            } catch (e) {
                // Use original message if not JSON
            }
            
            // Show detailed error with SweetAlert
            Swal.fire({
                title: 'Upload Failed',
                html: `
                    <div style="text-align: center;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 64px; color: #dc3545; margin-bottom: 20px;"></i>
                        <h3>Regular upload failed</h3>
                        <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: left;">
                            <div style="margin-bottom: 10px;"><i class="fas fa-times-circle" style="color: #dc3545; margin-right: 8px;"></i><strong>Error:</strong> ${errorInfo.message}</div>
                            <div style="margin-bottom: 10px;"><i class="fas fa-file" style="color: #dc3545; margin-right: 8px;"></i><strong>File:</strong> ${file.name} (${(file.size/1024/1024).toFixed(1)}MB)</div>
                            ${errorInfo.status ? `<div style="margin-bottom: 10px;"><i class="fas fa-info-circle" style="color: #dc3545; margin-right: 8px;"></i><strong>Status:</strong> ${errorInfo.status}</div>` : ''}
                            <div style="margin-bottom: 10px;"><i class="fas fa-database" style="color: #dc3545; margin-right: 8px;"></i><strong>Upload Method:</strong> Regular upload</div>
                            <div><i class="fas fa-table" style="color: #dc3545; margin-right: 8px;"></i><strong>Status:</strong> Upload failed</div>
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
                width: 600
            });
            
            throw error;
        }
    }
}

// Regular upload function (existing logic)
async function uploadDatasetRegular(file, datasetName, selectedSheet = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', datasetName);
    if (selectedSheet) {
        formData.append('selectedSheet', selectedSheet);
    }

    const response = await fetch('/api/datasets/upload', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
    });

    if (!response.ok) {
        let errorMessage = 'Upload failed';
        let errorDetails = null;
        
        try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
            errorDetails = errorData.details || `HTTP ${response.status}: ${response.statusText}`;
        } catch (e) {
            errorDetails = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        throw new Error(JSON.stringify({ message: errorMessage, details: errorDetails, status: response.status }));
    }

    return await response.json();
}

// Progress UI functions
function updateUploadProgress(percent, message) {
    const progressContainer = document.getElementById('upload-progress');
    if (!progressContainer) {
        // Create progress container if it doesn't exist
        const container = document.createElement('div');
        container.id = 'upload-progress';
        container.className = 'upload-progress-container';
        container.innerHTML = `
            <div class="upload-progress-bar">
                <div class="upload-progress-fill" style="width: 0%"></div>
            </div>
            <div class="upload-progress-text">Preparing upload...</div>
        `;
        document.body.appendChild(container);
    }
    
    const progressFill = document.querySelector('.upload-progress-fill');
    const progressText = document.querySelector('.upload-progress-text');
    
    if (progressFill) progressFill.style.width = `${percent}%`;
    if (progressText) progressText.textContent = message;
}

function hideUploadProgress() {
    const progressContainer = document.getElementById('upload-progress');
    if (progressContainer) {
        progressContainer.remove();
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChunkedUploader, uploadDatasetWithChunks };
}