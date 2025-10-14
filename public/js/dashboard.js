// Dashboard functionality
let revenueChart = null;
let cogsChart = null;
let ebitdaChart = null;
let nettIncomeChart = null;
let isLoadingDashboard = false;

// Load dashboard data
async function loadDashboardData() {
    if (isLoadingDashboard) return;
    
    isLoadingDashboard = true;
    showDashboardLoading();
    showChartLoading();
    
    try {
        const datasetFilter = document.getElementById('dataset-filter')?.value || 'all';
        const entityFilter = document.getElementById('entity-filter')?.value || 'all';
        const regionFilter = document.getElementById('region-filter')?.value || 'all';
        const monthFilter = document.getElementById('month-filter')?.value || 'all';
        
        const params = new URLSearchParams();
        if (datasetFilter !== 'all') params.append('dataset', datasetFilter);
        if (entityFilter !== 'all') params.append('entity', entityFilter);
        if (regionFilter !== 'all') params.append('region', regionFilter);
        if (monthFilter !== 'all') params.append('month', monthFilter);
        
        const data = await app.apiRequest(`/dashboard/data?${params.toString()}`);
        
        if (data?.success) {
            updateDashboardCards(data.data.cards || {});
            updateDashboardCharts(data.data.charts || {});
            updateDatasetFilter(data.data.filters?.datasets || []);
            updateEntityFilter(data.data.filters?.entities || []);
            updateRegionFilter(data.data.filters?.regions || []);
            updateMonthFilter(data.data.filters?.months || []);
        }
    } catch (error) {
        console.error('Dashboard error:', error);
        app.showAlert('Error loading dashboard data', 'error');
    } finally {
        hideDashboardLoading();
        hideChartLoading();
        isLoadingDashboard = false;
    }
}

function updateDashboardCards(cards) {
    const revenueElement = document.getElementById('total-revenue');
    if (revenueElement && cards.totalRevenue !== undefined) {
        revenueElement.textContent = app.formatCurrency(cards.totalRevenue);
        revenueElement.parentElement.classList.remove('empty-state');
    }
    
    const cogsElement = document.getElementById('total-cogs');
    if (cogsElement && cards.totalCogs !== undefined) {
        cogsElement.textContent = app.formatCurrency(cards.totalCogs);
        cogsElement.parentElement.classList.remove('empty-state');
    }
    
    const ebitdaElement = document.getElementById('total-ebitda');
    if (ebitdaElement && cards.totalEbitda !== undefined) {
        ebitdaElement.textContent = app.formatCurrency(cards.totalEbitda);
        ebitdaElement.parentElement.classList.remove('empty-state');
    }
    
    const nettIncomeElement = document.getElementById('total-nett-income');
    if (nettIncomeElement && cards.totalNettIncome !== undefined) {
        nettIncomeElement.textContent = app.formatCurrency(cards.totalNettIncome);
        nettIncomeElement.parentElement.classList.remove('empty-state');
    }
}

function updateDashboardCharts(charts) {
    if (charts.revenueByEntity) {
        createPieChart('revenue-chart', charts.revenueByEntity, 'Revenue per Entity');
    }
    
    if (charts.cogsByEntity) {
        createPieChart('cogs-chart', charts.cogsByEntity, 'Gross Profit per Entity');
    }
    
    if (charts.ebitdaByEntity) {
        createPieChart('ebitda-chart', charts.ebitdaByEntity, 'EBITDA per Entity');
    }
    
    if (charts.nettIncomeByEntity) {
        createPieChart('nett-income-chart', charts.nettIncomeByEntity, 'Net Income per Entity');
    }
}

// Global color palette for consistent entity colors
const ENTITY_COLORS = {
    // Define consistent colors for entities
    default: ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#ffecd2', '#fcb69f']
};

// Entity color mapping cache
let entityColorMap = {};

function getEntityColor(entityName, index) {
    if (!entityColorMap[entityName]) {
        entityColorMap[entityName] = ENTITY_COLORS.default[Object.keys(entityColorMap).length % ENTITY_COLORS.default.length];
    }
    return entityColorMap[entityName];
}

function createPieChart(canvasId, data, title) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    // Destroy existing chart
    if (window[canvasId + '_instance']) {
        window[canvasId + '_instance'].destroy();
    }
    
    if (!data || data.length === 0) {
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        const context = ctx.getContext('2d');
        context.font = '14px Arial';
        context.fillStyle = '#666';
        context.textAlign = 'center';
        context.fillText('No data available', ctx.width / 2, ctx.height / 2);
        return;
    }
    
    const chartConfig = {
        type: 'pie',
        data: {
            labels: data.map(item => item.name),
            datasets: [{
                data: data.map(item => Math.abs(item.value)),
                backgroundColor: data.map((item, index) => getEntityColor(item.name, index)),
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                animateRotate: true,
                duration: 800
            },
            plugins: {
                legend: { 
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: { size: 11, weight: '600' },
                        color: '#333',
                        usePointStyle: true,
                        pointStyle: 'circle',
                        generateLabels: function(chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    return {
                                        text: label,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        strokeStyle: data.datasets[0].borderColor,
                                        lineWidth: data.datasets[0].borderWidth,
                                        pointStyle: 'circle',
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${app.formatCurrency ? app.formatCurrency(value) : value} (${percentage}%)`;
                        }
                    }
                }
            },
            layout: {
                padding: {
                    top: 10,
                    bottom: 20,
                    left: 10,
                    right: 10
                }
            }
        }
    };
    
    window[canvasId + '_instance'] = new Chart(ctx, chartConfig);
}

// Filter functions
function applyFilters() {
    loadDashboardData();
}

function clearFilters() {
    document.getElementById('dataset-filter').value = 'all';
    document.getElementById('entity-filter').value = 'all';
    document.getElementById('region-filter').value = 'all';
    document.getElementById('month-filter').value = 'all';
    loadDashboardData();
}

function updateDatasetFilter(datasets) {
    const select = document.getElementById('dataset-filter');
    if (!select) return;
    
    const currentValue = select.value;
    select.innerHTML = '<option value="all">All Datasets</option>';
    
    datasets.forEach(dataset => {
        const option = document.createElement('option');
        option.value = dataset.id;
        option.textContent = dataset.name;
        select.appendChild(option);
    });
    
    if (currentValue && [...select.options].some(opt => opt.value === currentValue)) {
        select.value = currentValue;
    }
}

function updateEntityFilter(entities) {
    const select = document.getElementById('entity-filter');
    if (!select) return;
    
    const currentValue = select.value;
    select.innerHTML = '<option value="all">All Entities</option>';
    
    entities.forEach(entity => {
        const option = document.createElement('option');
        option.value = entity.id;
        option.textContent = entity.name;
        select.appendChild(option);
    });
    
    if (currentValue && [...select.options].some(opt => opt.value === currentValue)) {
        select.value = currentValue;
    }
}

function updateRegionFilter(regions) {
    const select = document.getElementById('region-filter');
    if (!select) return;
    
    const currentValue = select.value;
    select.innerHTML = '<option value="all">All Regions</option>';
    
    regions.forEach(region => {
        const option = document.createElement('option');
        option.value = region.id;
        option.textContent = region.name;
        select.appendChild(option);
    });
    
    if (currentValue && [...select.options].some(opt => opt.value === currentValue)) {
        select.value = currentValue;
    }
}

function updateMonthFilter(months) {
    const select = document.getElementById('month-filter');
    if (!select) return;
    
    const currentValue = select.value;
    select.innerHTML = '<option value="all">All Months</option>';
    
    months.forEach(month => {
        const option = document.createElement('option');
        option.value = month.id;
        option.textContent = month.name;
        select.appendChild(option);
    });
    
    if (currentValue && [...select.options].some(opt => opt.value === currentValue)) {
        select.value = currentValue;
    }
}



function updateCompanyFilter(companies) {
    const select = document.getElementById('company-filter');
    if (!select) return;
    
    // Store current selection
    const currentValue = select.value;
    
    // Clear existing options except "All Companies"
    select.innerHTML = '<option value="all">All Companies</option>';
    
    // Add company options
    companies.forEach(company => {
        const option = document.createElement('option');
        option.value = company.code;
        option.textContent = company.name;
        select.appendChild(option);
    });
    
    // Restore selection if it still exists
    if (currentValue && [...select.options].some(opt => opt.value === currentValue)) {
        select.value = currentValue;
    }
}



// Show empty state when no dataset selected
function showEmptyDashboardState() {
    // Only show if user is logged in and on dashboard page
    if (!currentUser || !authToken) {
        return;
    }
    
    const dashboardPage = document.getElementById('dashboard-page');
    if (!dashboardPage || dashboardPage.style.display === 'none') {
        return;
    }
    
    const cards = document.querySelectorAll('.dashboard-cards .card');
    const charts = document.querySelectorAll('.chart-container canvas');
    
    if (!document.getElementById('empty-state-styles')) {
        const style = document.createElement('style');
        style.id = 'empty-state-styles';
        style.textContent = `
            .empty-state {
                position: relative;
                opacity: 0.7;
            }
            .empty-state .card-value {
                color: #999 !important;
                font-style: italic;
            }
            .empty-state::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(45deg, transparent 40%, rgba(102, 126, 234, 0.1) 50%, transparent 60%);
                animation: pulse 2s ease-in-out infinite;
                pointer-events: none;
            }
            @keyframes pulse {
                0%, 100% { opacity: 0; }
                50% { opacity: 1; }
            }
            .select-prompt {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px 30px;
                border-radius: 15px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                text-align: center;
                z-index: 1000;
                animation: bounce 2s ease-in-out infinite;
                font-size: 16px;
                font-weight: 500;
            }
            @keyframes bounce {
                0%, 20%, 50%, 80%, 100% { transform: translate(-50%, -50%) translateY(0); }
                40% { transform: translate(-50%, -50%) translateY(-10px); }
                60% { transform: translate(-50%, -50%) translateY(-5px); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Add empty state to cards
    cards.forEach(card => {
        card.classList.add('empty-state');
        const valueElement = card.querySelector('.card-value');
        if (valueElement) {
            valueElement.textContent = '- -';
        }
    });
    
    // Clear charts
    charts.forEach(canvas => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = '14px Arial';
        ctx.fillStyle = '#999';
        ctx.textAlign = 'center';
        ctx.fillText('Pilih dataset terlebih dahulu', canvas.width / 2, canvas.height / 2);
    });
}

function showDatasetSelectionPrompt() {
    // Only show if user is logged in and on dashboard page
    if (!currentUser || !authToken) {
        return;
    }
    
    const dashboardPage = document.getElementById('dashboard-page');
    if (!dashboardPage || dashboardPage.style.display === 'none') {
        return;
    }
    
    // Check if dataset filter has options (other than "All Datasets")
    const datasetFilter = document.getElementById('dataset-filter');
    if (!datasetFilter || datasetFilter.options.length <= 1) {
        return; // Don't show prompt if no datasets available
    }
    
    // Remove existing prompt
    const existingPrompt = document.getElementById('dataset-prompt');
    if (existingPrompt) existingPrompt.remove();
    
    const prompt = document.createElement('div');
    prompt.id = 'dataset-prompt';
    prompt.className = 'select-prompt';
    prompt.innerHTML = `
        <div style="margin-bottom: 10px;">📊</div>
        <div>Silakan pilih <strong>Dataset</strong> untuk melihat data dashboard</div>
        <div style="font-size: 14px; margin-top: 8px; opacity: 0.9;">Gunakan filter di atas untuk memulai</div>
    `;
    
    document.body.appendChild(prompt);
    
    // Auto-hide after 8 seconds
    setTimeout(() => {
        if (prompt && prompt.parentNode) {
            prompt.style.animation = 'fadeOut 0.5s ease-out';
            setTimeout(() => prompt.remove(), 500);
        }
    }, 8000);
}

// Add loading states for dashboard cards only
function showDashboardLoading() {
    const cards = document.querySelectorAll('.dashboard-cards .card');
    
    if (!document.getElementById('card-loading-styles')) {
        const style = document.createElement('style');
        style.id = 'card-loading-styles';
        style.textContent = `
            .card-loading {
                position: relative;
                overflow: hidden;
            }
            .card-loading::after {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
                animation: shimmer 1.5s infinite;
            }
            @keyframes shimmer {
                0% { left: -100%; }
                100% { left: 100%; }
            }
            @keyframes fadeOut {
                from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                to { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Remove empty state and prompt
    cards.forEach(card => {
        card.classList.remove('empty-state');
        card.classList.add('card-loading');
        const valueElement = card.querySelector('.card-value');
        if (valueElement) {
            valueElement.textContent = 'Loading...';
        }
    });
    
    const prompt = document.getElementById('dataset-prompt');
    if (prompt) prompt.remove();
}

function hideDashboardLoading() {
    const cards = document.querySelectorAll('.dashboard-cards .card');
    cards.forEach(card => {
        card.classList.remove('card-loading');
    });
}

// Chart loading animations
function showChartLoading() {
    const charts = document.querySelectorAll('.chart-container');
    
    if (!document.getElementById('chart-loading-styles')) {
        const style = document.createElement('style');
        style.id = 'chart-loading-styles';
        style.textContent = `
            .chart-loading {
                position: relative;
                overflow: hidden;
            }
            .chart-loading::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255,255,255,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
            }
            .chart-loading::before {
                content: 'Loading chart...';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                z-index: 11;
                color: #666;
                font-size: 14px;
            }
        `;
        document.head.appendChild(style);
    }
    
    charts.forEach(chart => {
        chart.classList.add('chart-loading');
    });
}

function hideChartLoading() {
    const charts = document.querySelectorAll('.chart-container');
    charts.forEach(chart => {
        chart.classList.remove('chart-loading');
    });
}

// Load dashboard data with loading states
async function loadDashboardDataWithLoading() {
    showDashboardLoading();
    try {
        await loadDashboardData();
    } finally {
        hideDashboardLoading();
    }
}

// Auto-refresh dashboard data (disabled to prevent looping)
let dashboardRefreshInterval = null;

function startDashboardAutoRefresh() {
    // Disabled auto-refresh to prevent chart looping
    // Can be enabled later if needed
}

function stopDashboardAutoRefresh() {
    if (dashboardRefreshInterval) {
        clearInterval(dashboardRefreshInterval);
        dashboardRefreshInterval = null;
    }
}

// Responsive chart handling
function handleChartResize() {
    if (window['revenue-chart_instance']) {
        window['revenue-chart_instance'].resize();
    }
    if (window['cogs-chart_instance']) {
        window['cogs-chart_instance'].resize();
    }
    if (window['ebitda-chart_instance']) {
        window['ebitda-chart_instance'].resize();
    }
    if (window['nett-income-chart_instance']) {
        window['nett-income-chart_instance'].resize();
    }
}

window.addEventListener('resize', app.debounce(handleChartResize, 250));

// Add event listeners for immediate filtering
function initializeDashboardFilters() {
    const datasetFilter = document.getElementById('dataset-filter');
    const entityFilter = document.getElementById('entity-filter');
    const regionFilter = document.getElementById('region-filter');
    const monthFilter = document.getElementById('month-filter');
    
    if (datasetFilter) datasetFilter.addEventListener('change', applyFilters);
    if (entityFilter) entityFilter.addEventListener('change', applyFilters);
    if (regionFilter) regionFilter.addEventListener('change', applyFilters);
    if (monthFilter) monthFilter.addEventListener('change', applyFilters);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeDashboardFilters();
    });
} else {
    initializeDashboardFilters();
}

// Export dashboard functions
window.dashboard = {
    loadDashboardData,
    updateDashboardCards,
    updateDashboardCharts,
    startDashboardAutoRefresh,
    stopDashboardAutoRefresh
};

// Make functions globally available for HTML onclick handlers
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;