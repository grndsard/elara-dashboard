// Dashboard functionality
let revenueChart = null;
let cogsChart = null;
let isLoadingDashboard = false;

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
        
        const queryString = params.toString();
        const endpoint = queryString ? `/dashboard/data?${queryString}` : '/dashboard/data';
        
        const data = await app.apiRequest(endpoint);
        
        if (data?.success) {
            updateDashboardCards(data.data.cards || {});
            updatePerformanceCards(data.data.performance || {});
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
    }
    
    const cogsElement = document.getElementById('total-cogs');
    if (cogsElement && cards.totalCogs !== undefined) {
        cogsElement.textContent = app.formatCurrency(cards.totalCogs);
    }
    
    const ebitdaElement = document.getElementById('total-ebitda');
    if (ebitdaElement && cards.totalEbitda !== undefined) {
        ebitdaElement.textContent = app.formatCurrency(cards.totalEbitda);
    }
    
    const nettIncomeElement = document.getElementById('total-nett-income');
    if (nettIncomeElement && cards.totalNettIncome !== undefined) {
        nettIncomeElement.textContent = app.formatCurrency(cards.totalNettIncome);
    }
}

function updatePerformanceCards(performance) {
    // Performance cards removed - function kept for compatibility
}

function updateDashboardCharts(charts) {
    if (charts.revenueByEntity) {
        createSimpleChart('revenue-chart', charts.revenueByEntity, 'pie');
    }
    
    if (charts.cogsByEntity) {
        createSimpleChart('cogs-chart', charts.cogsByEntity, 'pie');
    }
    
    if (charts.ebitdaByEntity) {
        createSimpleChart('ebitda-chart', charts.ebitdaByEntity, 'pie');
    }
    
    if (charts.nettIncomeByEntity) {
        createSimpleChart('nett-income-chart', charts.nettIncomeByEntity, 'pie');
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

function createSimpleChart(canvasId, data, type = 'pie') {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    
    if (window[canvasId + '_chart']) {
        window[canvasId + '_chart'].destroy();
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
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    const chartConfig = {
        type: type,
        data: {
            labels: data.map(item => item.name || item.label),
            datasets: [{
                data: data.map(item => item.value),
                backgroundColor: data.map((item, index) => getEntityColor(item.name || item.label, index)),
                borderColor: '#ffffff',
                borderWidth: 2,
                hoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: {
                animateRotate: true,
                duration: 800
            },
            plugins: {
                legend: { 
                    position: 'bottom',
                    labels: {
                        boxWidth: 14,
                        padding: 18,
                        font: { size: 13, weight: 'bold' },
                        color: '#333',
                        usePointStyle: true,
                        pointStyle: 'circle'
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
                    top: 15,
                    bottom: 35,
                    left: 15,
                    right: 15
                }
            }
        }
    };
    
    window[canvasId + '_chart'] = new Chart(ctx, chartConfig);
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
        `;
        document.head.appendChild(style);
    }
    
    cards.forEach(card => {
        card.classList.add('card-loading');
        const valueElement = card.querySelector('.card-value');
        if (valueElement) {
            valueElement.textContent = 'Loading...';
        }
    });
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
    if (revenueChart) {
        revenueChart.resize();
    }
    if (cogsChart) {
        cogsChart.resize();
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
    document.addEventListener('DOMContentLoaded', initializeDashboardFilters);
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