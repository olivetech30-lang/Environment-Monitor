// Chart instances for real-time and historical data visualization
let temperatureChart = null;
let humidityChart = null;
let historicalChart = null;

// Data storage arrays for time-series data
let temperatureData = [];
let humidityData = [];
let historicalData = [];

// Update intervals and timers
let updateInterval = null;
let connectionCheckInterval = null;

// Configuration settings for Vercel backend communication
const CONFIG = {
    // UPDATE THIS TO YOUR VERCEL BACKEND URL!
    backendEndpoint: 'https://environment-monitor-full.vercel.app',  // Your Vercel backend URL
    deviceId: 'ESP32-S3-001',
    updateInterval: 1000,                   // Update data every 1 second
    connectionCheckInterval: 5000,          // Check connection every 5 seconds
    maxDataPoints: 60,                      // Keep last 60 points for real-time charts
    historicalDataPoints: 1000,             // Maximum historical data points to store
    requestTimeout: 5000,                   // HTTP request timeout in milliseconds
    reconnectAttempts: 3,                   // Number of reconnection attempts
    trendCalculationPoints: 10              // Number of points for trend calculation
};

// Connection status tracking
let connectionState = {
    isConnected: false,
    lastSuccessfulUpdate: 0,
    reconnectAttempts: 0,
    connectionQuality: 'excellent', // excellent, good, poor, disconnected
    backendUrl: CONFIG.backendEndpoint
};

// ========================================
// DASHBOARD INITIALIZATION
// ========================================

/*
 * Initialize dashboard when DOM is fully loaded
 * Sets up charts, event listeners, and starts data updates
 */
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== IoT Dashboard with Vercel Backend Initializing ===');
    console.log('Backend URL:', CONFIG.backendEndpoint);
    
    // Initialize all components
    initializeCharts();
    setupEventListeners();
    startDataUpdates();
    startConnectionMonitoring();
    updateLastUpdatedTime();
    
    console.log('=== Dashboard Initialized Successfully ===');
});

/*
 * Initialize all Chart.js instances for data visualization
 * Creates real-time charts for temperature, humidity, and historical data
 */
function initializeCharts() {
    console.log('Initializing charts...');
    
    // Temperature real-time chart (mini sparkline)
    const tempCtx = document.getElementById('temperature-chart').getContext('2d');
    temperatureChart = new Chart(tempCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: '#3b82f6',           // Blue color for temperature
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            },
            elements: {
                point: { radius: 0 }
            },
            animation: {
                duration: 0 // Disable animations for smooth real-time updates
            }
        }
    });

    // Humidity real-time chart (mini sparkline)
    const humidityCtx = document.getElementById('humidity-chart').getContext('2d');
    humidityChart = new Chart(humidityCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: '#14b8a6',           // Teal color for humidity
                backgroundColor: 'rgba(20, 184, 166, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            scales: {
                x: { display: false },
                y: { display: false }
            },
            elements: {
                point: { radius: 0 }
            },
            animation: {
                duration: 0 // Disable animations for smooth real-time updates
            }
        }
    });

    // Historical data chart (main chart with both temperature and humidity)
    const historicalCtx = document.getElementById('historical-chart').getContext('2d');
    historicalChart = new Chart(historicalCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Temperature (°C)',
                data: [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.4,
                yAxisID: 'y'
            }, {
                label: 'Humidity (%)',
                data: [],
                borderColor: '#14b8a6',
                backgroundColor: 'rgba(20, 184, 166, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.4,
                yAxisID: 'y1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Time'
                    },
                    grid: {
                        display: false
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Humidity (%)'
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
    
    console.log('Charts initialized successfully');
}

// ========================================
// EVENT LISTENERS AND UI INTERACTIONS
// ========================================

/*
 * Setup all event listeners for UI interactions
 * Includes mobile menu, time range buttons, and search functionality
 */
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Mobile sidebar menu functionality
    const menuButton = document.getElementById('menu-button');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-menu-overlay');
    const closeButton = document.getElementById('close-sidebar');

    // Open mobile menu
    menuButton.addEventListener('click', () => {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    });

    // Close mobile menu
    closeButton.addEventListener('click', closeMobileMenu);
    overlay.addEventListener('click', closeMobileMenu);

    // Function to close mobile menu
    function closeMobileMenu() {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    }

    // Time range selector buttons for historical chart
    const timeButtons = document.querySelectorAll('.time-range-btn');
    timeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Remove active state from all buttons
            timeButtons.forEach(btn => {
                btn.classList.remove('bg-blue-100', 'text-blue-600');
                btn.classList.add('bg-gray-100', 'text-gray-600');
            });
            
            // Add active state to clicked button
            e.target.classList.remove('bg-gray-100', 'text-gray-600');
            e.target.classList.add('bg-blue-100', 'text-blue-600');
            
            // Update historical chart with selected time range
            const range = e.target.getAttribute('data-range');
            updateHistoricalChart(range);
        });
    });

    // Search functionality (placeholder - can be extended)
    const searchInput = document.querySelector('input[type="text"]');
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            console.log('Search query:', e.target.value);
            // Implement search functionality here
        }
    });

    // Window resize handler for responsive charts
    window.addEventListener('resize', debounce(() => {
        if (temperatureChart) temperatureChart.resize();
        if (humidityChart) humidityChart.resize();
        if (historicalChart) historicalChart.resize();
    }, 300));

    console.log('Event listeners setup complete');
}

// ========================================
// DATA FETCHING AND MANAGEMENT
// ========================================

/*
 * Start the main data update cycle
 * Fetches sensor data from Vercel backend at regular intervals
 */
function startDataUpdates() {
    console.log('Starting data updates from Vercel backend...');
    
    // Initial data fetch
    fetchSensorData();
    
    // Set up periodic data updates
    updateInterval = setInterval(() => {
        fetchSensorData();
    }, CONFIG.updateInterval);
}

/*
 * Fetch sensor data from Vercel backend API
 * Handles both successful responses and error scenarios
 */
async function fetchSensorData() {
    try {
        console.log('Fetching sensor data from Vercel backend...');
        
        const apiUrl = `${CONFIG.backendEndpoint}/api/readings/${CONFIG.deviceId}`;
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(CONFIG.requestTimeout)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Process the received data
        processSensorData(data);
        
        // Update connection status
        updateConnectionStatus(true);
        
        console.log('Sensor data fetched successfully from backend:', data.current);
        
    } catch (error) {
        console.error('Error fetching sensor data:', error);
        updateConnectionStatus(false);
        
        // Generate simulated data for demonstration when backend is not available
        if (connectionState.reconnectAttempts === 0) {
            console.log('Using simulated data for demonstration');
            const simulatedData = generateSimulatedData();
            processSensorData(simulatedData);
        }
    }
}

/*
 * Process sensor data and update dashboard
 * Updates UI elements, charts, and calculations
 */
function processSensorData(data) {
    if (!data.current) {
        console.error('Invalid sensor data format');
        return;
    }

    const { temperature, humidity, timestamp } = data.current;
    const currentTime = timestamp ? new Date(timestamp) : new Date();

    // Update main value displays
    updateValueDisplays(temperature, humidity);
    
    // Update trend indicators and calculations
    updateTrendAnalysis(temperature, humidity);
    
    // Update real-time charts
    updateRealTimeCharts(temperature, humidity, currentTime);
    
    // Store and update historical data
    updateHistoricalData(temperature, humidity, currentTime);
    
    // Update environmental insights
    updateEnvironmentalInsights(temperature, humidity);
    
    // Update last updated timestamp
    updateLastUpdatedTime();
}

/*
 * Update the main temperature and humidity value displays
 */
function updateValueDisplays(temperature, humidity) {
    // Update main sensor cards
    document.getElementById('temperature-value').textContent = temperature.toFixed(1);
    document.getElementById('humidity-value').textContent = humidity.toFixed(1);
    
    // Update current status panel
    document.getElementById('current-temp').textContent = `${temperature.toFixed(1)}°C`;
    document.getElementById('current-humidity').textContent = `${humidity.toFixed(1)}%`;
}

/*
 * Generate simulated sensor data for demonstration purposes
 * Creates realistic temperature and humidity variations
 */
function generateSimulatedData() {
    const now = Date.now();
    
    // Create realistic temperature variation (base 23°C ± 3°C)
    const baseTemp = 23 + Math.sin(now / 300000) * 2; // 5-minute cycle
    const tempVariation = (Math.random() - 0.5) * 1.5; // Random variation
    const temperature = baseTemp + tempVariation;
    
    // Create realistic humidity variation (base 45% ± 20%)
    const baseHumidity = 45 + Math.sin(now / 400000) * 15; // Slightly different cycle
    const humidityVariation = (Math.random() - 0.5) * 5; // Random variation
    const humidity = Math.max(20, Math.min(80, baseHumidity + humidityVariation));
    
    return {
        current: {
            temperature: +temperature.toFixed(1),
            humidity: +humidity.toFixed(1),
            timestamp: now,
            timestamp_iso: new Date(now).toISOString()
        },
        history: [], // Will be populated with simulated historical data if needed
        metadata: {
            total_readings: Math.floor(now / 1000),
            buffer_size: 1000,
            uptime_seconds: Math.floor(now / 1000),
            wifi_connected: true,
            backend_url: CONFIG.backendEndpoint
        }
    };
}

// ========================================
// CHART UPDATES AND VISUALIZATION
// ========================================

/*
 * Update real-time mini charts with new sensor readings
 * Maintains rolling window of recent data for trend visualization
 */
function updateRealTimeCharts(temperature, humidity, timestamp) {
    const timeLabel = timestamp.toLocaleTimeString();
    
    // Update temperature chart
    temperatureData.push(temperature);
    if (temperatureData.length > CONFIG.maxDataPoints) {
        temperatureData.shift();
    }
    
    temperatureChart.data.labels = temperatureData.map(() => '');
    temperatureChart.data.datasets[0].data = temperatureData;
    temperatureChart.update('none'); // Update without animation for smooth real-time updates

    // Update humidity chart
    humidityData.push(humidity);
    if (humidityData.length > CONFIG.maxDataPoints) {
        humidityData.shift();
    }
    
    humidityChart.data.labels = humidityData.map(() => '');
    humidityChart.data.datasets[0].data = humidityData;
    humidityChart.update('none'); // Update without animation for smooth real-time updates
}

/*
 * Update historical data storage and visualization
 * Maintains time-series data for trend analysis
 */
function updateHistoricalData(temperature, humidity, timestamp) {
    const dataPoint = {
        temperature,
        humidity,
        timestamp: timestamp.getTime()
    };
    
    historicalData.push(dataPoint);
    
    // Limit historical data to prevent memory issues
    if (historicalData.length > CONFIG.historicalDataPoints) {
        historicalData.shift();
    }
    
    // Update historical chart (show last 50 points for readability)
    updateHistoricalChartDisplay();
}

/*
 * Update the historical chart display with current data
 */
function updateHistoricalChartDisplay() {
    if (historicalData.length === 0) return;
    
    const maxPoints = 50; // Limit points for better visualization
    const startIndex = Math.max(0, historicalData.length - maxPoints);
    const displayData = historicalData.slice(startIndex);
    
    const labels = displayData.map(d => new Date(d.timestamp).toLocaleTimeString());
    const temperatures = displayData.map(d => d.temperature);
    const humidities = displayData.map(d => d.humidity);
    
    historicalChart.data.labels = labels;
    historicalChart.data.datasets[0].data = temperatures;
    historicalChart.data.datasets[1].data = humidities;
    historicalChart.update();
}

/*
 * Update historical chart based on selected time range
 * Filters historical data to show specified time period
 */
function updateHistoricalChart(range) {
    console.log(`Updating historical chart for range: ${range}`);
    
    let timePoints;
    switch(range) {
        case '1H':
            timePoints = 60;
            break;
        case '6H':
            timePoints = 360;
            break;
        case '24H':
            timePoints = 1440;
            break;
        default:
            timePoints = 60;
    }
    
    const cutoffTime = Date.now() - (timePoints * 60 * 1000);
    const filteredData = historicalData.filter(d => d.timestamp >= cutoffTime);
    
    const labels = filteredData.map(d => new Date(d.timestamp).toLocaleTimeString());
    const temperatures = filteredData.map(d => d.temperature);
    const humidities = filteredData.map(d => d.humidity);
    
    historicalChart.data.labels = labels;
    historicalChart.data.datasets[0].data = temperatures;
    historicalChart.data.datasets[1].data = humidities;
    historicalChart.update();
    
    console.log(`Historical chart updated with ${filteredData.length} data points`);
}

// ========================================
// TREND ANALYSIS AND CALCULATIONS
// ========================================

/*
 * Calculate and display trend indicators
 * Compares current readings with recent data to determine direction
 */
function updateTrendAnalysis(temperature, humidity) {
    if (temperatureData.length < CONFIG.trendCalculationPoints) {
        return; // Not enough data for trend calculation
    }
    
    // Calculate temperature trend
    const recentTemp = temperatureData.slice(-CONFIG.trendCalculationPoints);
    const tempTrend = calculateTrend(recentTemp);
    updateTrendIcon('temp-trend', tempTrend);
    
    // Calculate humidity trend
    const recentHumidity = humidityData.slice(-CONFIG.trendCalculationPoints);
    const humidityTrend = calculateTrend(recentHumidity);
    updateTrendIcon('humidity-trend', humidityTrend);
}

/*
 * Calculate trend direction from data array
 * Returns: 'up', 'down', or 'stable'
 */
function calculateTrend(data) {
    if (data.length < 2) return 'stable';
    
    const firstValue = data[0];
    const lastValue = data[data.length - 1];
    const threshold = 0.1; // Minimum change to consider as trend
    
    const change = lastValue - firstValue;
    
    if (change > threshold) return 'up';
    if (change < -threshold) return 'down';
    return 'stable';
}

/*
 * Update trend icon based on calculated trend
 */
function updateTrendIcon(elementId, trend) {
    const element = document.getElementById(elementId);
    
    // Remove existing trend classes
    element.classList.remove('fa-arrow-up', 'fa-arrow-down', 'fa-minus', 'trend-up', 'trend-down', 'text-green-500', 'text-red-500');
    
    // Add new trend classes
    if (trend === 'up') {
        element.classList.add('fa-arrow-up', 'trend-up');
    } else if (trend === 'down') {
        element.classList.add('fa-arrow-down', 'trend-down');
    } else {
        element.classList.add('fa-minus', 'text-gray-400');
    }
}

// ========================================
// ENVIRONMENTAL INSIGHTS
// ========================================

/*
 * Update environmental insights based on current readings
 * Provides comfort level indicators and recommendations
 */
function updateEnvironmentalInsights(temperature, humidity) {
    // Temperature comfort assessment
    updateTemperatureComfort(temperature);
    
    // Air quality estimation (based on temperature and humidity)
    updateAirQuality(temperature, humidity);
    
    // Heat index calculation and assessment
    updateHeatIndex(temperature, humidity);
    
    // Humidity level assessment
    updateHumidityLevel(humidity);
}

/*
 * Assess temperature comfort level
 */
function updateTemperatureComfort(temperature) {
    const element = document.getElementById('temp-comfort');
    const icon = element.previousElementSibling;
    
    let comfortLevel, iconClass, colorClass;
    
    if (temperature >= 20 && temperature <= 25) {
        comfortLevel = 'Comfortable';
        iconClass = 'fas fa-sun text-yellow-500';
        colorClass = 'text-yellow-500';
    } else if (temperature > 25 && temperature <= 30) {
        comfortLevel = 'Warm';
        iconClass = 'fas fa-thermometer-half text-orange-500';
        colorClass = 'text-orange-500';
    } else if (temperature > 30) {
        comfortLevel = 'Hot';
        iconClass = 'fas fa-thermometer-full text-red-500';
        colorClass = 'text-red-500';
    } else if (temperature < 18) {
        comfortLevel = 'Cool';
        iconClass = 'fas fa-snowflake text-blue-500';
        colorClass = 'text-blue-500';
    } else {
        comfortLevel = 'Mild';
        iconClass = 'fas fa-thermometer-quarter text-green-500';
        colorClass = 'text-green-500';
    }
    
    element.textContent = comfortLevel;
    icon.className = iconClass + ' text-2xl mb-2';
}

/*
 * Estimate air quality based on temperature and humidity
 */
function updateAirQuality(temperature, humidity) {
    const element = document.getElementById('air-quality');
    
    // Simple air quality estimation based on comfort parameters
    let quality;
    if (temperature >= 20 && temperature <= 25 && humidity >= 40 && humidity <= 60) {
        quality = 'Excellent';
    } else if (temperature >= 18 && temperature <= 28 && humidity >= 30 && humidity <= 70) {
        quality = 'Good';
    } else {
        quality = 'Fair';
    }
    
    element.textContent = quality;
}

/*
 * Calculate and assess heat index
 */
function updateHeatIndex(temperature, humidity) {
    const element = document.getElementById('heat-index');
    
    // Simplified heat index calculation (for temperatures above 27°C)
    let heatIndex = temperature;
    if (temperature > 27) {
        heatIndex = temperature + (humidity * 0.5);
    }
    
    let level;
    if (heatIndex < 30) {
        level = 'Low';
    } else if (heatIndex < 35) {
        level = 'Moderate';
    } else if (heatIndex < 40) {
        level = 'High';
    } else {
        level = 'Extreme';
    }
    
    element.textContent = level;
}

/*
 * Assess humidity level
 */
function updateHumidityLevel(humidity) {
    const element = document.getElementById('humidity-level');
    
    let level;
    if (humidity < 30) {
        level = 'Dry';
    } else if (humidity >= 30 && humidity <= 60) {
        level = 'Optimal';
    } else if (humidity > 60 && humidity <= 80) {
        level = 'High';
    } else {
        level = 'Very High';
    }
    
    element.textContent = level;
}

// ========================================
// CONNECTION MANAGEMENT
// ========================================

/*
 * Start connection monitoring to Vercel backend
 * Checks connection status periodically
 */
function startConnectionMonitoring() {
    connectionCheckInterval = setInterval(() => {
        checkConnectionStatus();
    }, CONFIG.connectionCheckInterval);
}

/*
 * Check connection status to Vercel backend
 */
async function checkConnectionStatus() {
    try {
        const healthUrl = `${CONFIG.backendEndpoint}/api/health`;
        const response = await fetch(healthUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(3000)
        });
        
        if (response.ok) {
            const healthData = await response.json();
            updateConnectionStatus(true, healthData);
        } else {
            updateConnectionStatus(false);
        }
    } catch (error) {
        updateConnectionStatus(false);
    }
}

/*
 * Update connection status indicators
 */
function updateConnectionStatus(isConnected, healthData = null) {
    connectionState.isConnected = isConnected;
    
    if (isConnected) {
        connectionState.lastSuccessfulUpdate = Date.now();
        connectionState.reconnectAttempts = 0;
        
        // Update connection indicator
        const statusElement = document.getElementById('connection-status');
        const textElement = document.getElementById('connection-text');
        const qualityElement = document.getElementById('backend-status');
        
        statusElement.className = 'w-3 h-3 bg-green-500 rounded-full connection-indicator';
        textElement.textContent = 'Vercel Backend Connected';
        textElement.className = 'ml-2 text-sm text-green-600';
        qualityElement.textContent = 'Connected';
        qualityElement.className = 'text-sm font-medium text-green-600';
    } else {
        connectionState.reconnectAttempts++;
        
        // Update connection indicator
        const statusElement = document.getElementById('connection-status');
        const textElement = document.getElementById('connection-text');
        const qualityElement = document.getElementById('backend-status');
        
        statusElement.className = 'w-3 h-3 bg-red-500 rounded-full';
        textElement.textContent = 'Backend Disconnected';
        textElement.className = 'ml-2 text-sm text-red-600';
        qualityElement.textContent = 'Disconnected';
        qualityElement.className = 'text-sm font-medium text-red-600';
        
        // Attempt reconnection
        if (connectionState.reconnectAttempts < CONFIG.reconnectAttempts) {
            console.log(`Attempting reconnection (${connectionState.reconnectAttempts}/${CONFIG.reconnectAttempts})`);
            setTimeout(() => {
                fetchSensorData();
            }, 2000 * connectionState.reconnectAttempts);
        }
    }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/*
 * Update the last updated timestamp display
 */
function updateLastUpdatedTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    document.getElementById('last-updated').textContent = timeString;
}

/*
 * Debounce function to limit function call frequency
 * Useful for window resize and other frequent events
 */
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

/*
 * Format number to specified decimal places
 */
function formatNumber(number, decimals = 1) {
    return parseFloat(number).toFixed(decimals);
}

// ========================================
// CLEANUP AND ERROR HANDLING
// ========================================

/*
 * Cleanup function called when page is unloaded
 * Clears intervals and cleans up resources
 */
window.addEventListener('beforeunload', () => {
    console.log('Cleaning up dashboard resources...');
    
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
    }
    
    // Destroy charts to free memory
    if (temperatureChart) temperatureChart.destroy();
    if (humidityChart) humidityChart.destroy();
    if (historicalChart) historicalChart.destroy();
});

/*
 * Global error handler for uncaught JavaScript errors
 */
window.addEventListener('error', (event) => {
    console.error('Global error caught:', event.error);
    // Could implement error reporting here
});

/*
 * Handle unhandled promise rejections
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Could implement error reporting here
});

console.log('=== IoT Dashboard JavaScript with Vercel Backend Loaded Successfully ===');
