/*
 * ESP32-S3 IoT Environmental Monitor
 * PlatformIO Project for Real-time Temperature & Humidity Monitoring
 * 
 * Hardware Requirements:
 * - ESP32-S3 DevKit
 * - DHT11 or DHT22 Sensor
 * - WiFi Network
 * 
 * Libraries Used:
 * - WiFi (built-in)
 * - WebServer (built-in)
 * - DHT sensor library (include in platformio.ini)
 * 
 * Author: IoT Dashboard Developer
 * Date: 2024
 */

// Include required libraries
#include <WiFi.h>
#include <WebServer.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <time.h>

// WiFi Configuration - Update these with your network details
const char* ssid = "YOUR_WIFI_SSID";           // Replace with your WiFi network name
const char* password = "YOUR_WIFI_PASSWORD";   // Replace with your WiFi password

// DHT Sensor Configuration
#define DHT_PIN 2                              // GPIO pin connected to DHT sensor
#define DHT_TYPE DHT22                         // Change to DHT11 if using DHT11

// Initialize DHT sensor
DHT dht(DHT_PIN, DHT_TYPE);

// Initialize web server on port 80
WebServer server(80);

// Historical data storage - circular buffer for time-series data
struct SensorReading {
    float temperature;
    float humidity;
    unsigned long timestamp;
    bool isValid;
};

#define MAX_READINGS 1000                      // Maximum number of historical readings to store
SensorReading readings[MAX_READINGS];
int currentIndex = 0;
int readingCount = 0;

// Timing configuration
unsigned long lastReading = 0;
const unsigned long READING_INTERVAL = 1000;   // Read sensor every 1 second
const unsigned long WIFI_TIMEOUT = 10000;      // WiFi connection timeout

/*
 * Setup function - runs once when ESP32 starts
 */
void setup() {
    // Initialize serial communication for debugging
    Serial.begin(115200);
    Serial.println("\n=== ESP32-S3 Environmental Monitor Starting ===");
    
    // Initialize DHT sensor
    dht.begin();
    Serial.println("DHT sensor initialized");
    
    // Connect to WiFi
    connectToWiFi();
    
    // Configure time synchronization (for proper timestamps)
    configureTime();
    
    // Setup HTTP server routes
    setupServerRoutes();
    
    // Start the web server
    server.begin();
    Serial.println("Web server started on port 80");
    
    // Initialize historical data buffer
    initializeReadingsBuffer();
    
    Serial.println("=== Setup Complete - Monitor Ready ===");
}

/*
 * Main loop function - runs continuously
 */
void loop() {
    // Handle incoming HTTP requests
    server.handleClient();
    
    // Read sensor data at specified intervals
    unsigned long currentTime = millis();
    if (currentTime - lastReading >= READING_INTERVAL) {
        readAndStoreSensorData();
        lastReading = currentTime;
    }
    
    // Small delay to prevent watchdog issues
    delay(10);
}

/*
 * Connect to WiFi network with timeout and reconnection logic
 */
void connectToWiFi() {
    Serial.printf("Connecting to WiFi network: %s\n", ssid);
    
    WiFi.begin(ssid, password);
    
    unsigned long startTime = millis();
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
        
        // Check for timeout
        if (millis() - startTime > WIFI_TIMEOUT) {
            Serial.println("\nWiFi connection timeout! Check your credentials.");
            Serial.println("Continuing without WiFi - limited functionality");
            return;
        }
    }
    
    Serial.println("\nWiFi connected successfully!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
}

/*
 * Configure NTP time synchronization for proper timestamps
 */
void configureTime() {
    // Configure NTP server for time synchronization
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    Serial.println("Time synchronization configured");
    
    // Wait for time to be set
    time_t nowSecs = time(nullptr);
    while (nowSecs < 8 * 3600 * 2) {
        delay(500);
        yield();
        nowSecs = time(nullptr);
    }
    
    Serial.println("Time synchronized successfully");
}

/*
 * Setup HTTP server routes and their handlers
 */
void setupServerRoutes() {
    // Main data endpoint - returns current and historical sensor readings
    server.on("/data", HTTP_GET, handleGetData);
    
    // Health check endpoint
    server.on("/health", HTTP_GET, handleHealthCheck);
    
    // ESP32 status endpoint
    server.on("/status", HTTP_GET, handleStatus);
    
    // Serve a simple test page
    server.on("/", HTTP_GET, []() {
        server.send(200, "text/html", 
            "<h1>ESP32-S3 Environmental Monitor</h1>"
            "<p>Endpoints available:</p>"
            "<ul>"
            "<li><a href='/data'>/data</a> - Current and historical sensor readings</li>"
            "<li><a href='/health'>/health</a> - Health check</li>"
            "<li><a href='/status'>/status</a> - ESP32 status</li>"
            "</ul>");
    });
    
    // Handle 404 errors
    server.onNotFound([]() {
        server.send(404, "text/plain", "Endpoint not found");
    });
}

/*
 * Handle GET request for sensor data
 * Returns JSON with current reading and historical data
 */
void handleGetData() {
    // Create JSON document for response
    StaticJsonDocument<2048> doc;
    
    // Add current reading
    float currentTemp = getCurrentTemperature();
    float currentHumidity = getCurrentHumidity();
    
    doc["current"]["temperature"] = currentTemp;
    doc["current"]["humidity"] = currentHumidity;
    doc["current"]["timestamp"] = millis();
    doc["current"]["timestamp_iso"] = getCurrentTimestampISO();
    
    // Add historical readings
    JsonArray history = doc.createNestedArray("history");
    
    int count = (readingCount < 100) ? readingCount : 100; // Send last 100 readings
    int startIndex = (currentIndex - count + MAX_READINGS) % MAX_READINGS;
    
    for (int i = 0; i < count; i++) {
        int idx = (startIndex + i) % MAX_READINGS;
        if (readings[idx].isValid) {
            JsonObject reading = history.createNestedObject();
            reading["temperature"] = readings[idx].temperature;
            reading["humidity"] = readings[idx].humidity;
            reading["timestamp"] = readings[idx].timestamp;
            reading["timestamp_iso"] = timestampToISO(readings[idx].timestamp);
        }
    }
    
    // Add metadata
    doc["metadata"]["total_readings"] = readingCount;
    doc["metadata"]["buffer_size"] = MAX_READINGS;
    doc["metadata"]["uptime_seconds"] = millis() / 1000;
    doc["metadata"]["wifi_connected"] = (WiFi.status() == WL_CONNECTED);
    
    // Send JSON response
    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
}

/*
 * Handle health check endpoint
 */
void handleHealthCheck() {
    StaticJsonDocument<200> doc;
    doc["status"] = "healthy";
    doc["uptime_seconds"] = millis() / 1000;
    doc["free_heap"] = ESP.getFreeHeap();
    doc["wifi_connected"] = (WiFi.status() == WL_CONNECTED);
    doc["dht_status"] = (isDHTWorking() ? "ok" : "error");
    
    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
}

/*
 * Handle status endpoint
 */
void handleStatus() {
    StaticJsonDocument<300> doc;
    doc["device"] = "ESP32-S3 Environmental Monitor";
    doc["firmware_version"] = "1.0.0";
    doc["wifi_ssid"] = ssid;
    doc["ip_address"] = WiFi.localIP().toString();
    doc["uptime_seconds"] = millis() / 1000;
    doc["total_readings"] = readingCount;
    doc["last_reading"] = getCurrentTimestampISO();
    
    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
}

/*
 * Read sensor data and store in circular buffer
 */
void readAndStoreSensorData() {
    float temperature = dht.readTemperature();  // Temperature in Celsius
    float humidity = dht.readHumidity();        // Humidity percentage
    
    // Check if readings are valid (DHT sensors can occasionally return NaN)
    if (isnan(temperature) || isnan(humidity)) {
        Serial.println("Failed to read from DHT sensor!");
        return;
    }
    
    // Store reading in circular buffer
    readings[currentIndex].temperature = temperature;
    readings[currentIndex].humidity = humidity;
    readings[currentIndex].timestamp = millis();
    readings[currentIndex].isValid = true;
    
    // Update circular buffer index
    currentIndex = (currentIndex + 1) % MAX_READINGS;
    if (readingCount < MAX_READINGS) {
        readingCount++;
    }
    
    // Print readings to serial for debugging
    Serial.printf("Reading %d: %.1f°C, %.1f%%\n", readingCount, temperature, humidity);
}

/*
 * Initialize the readings buffer with invalid data
 */
void initializeReadingsBuffer() {
    for (int i = 0; i < MAX_READINGS; i++) {
        readings[i].isValid = false;
    }
    currentIndex = 0;
    readingCount = 0;
    Serial.println("Readings buffer initialized");
}

/*
 * Get current temperature reading
 */
float getCurrentTemperature() {
    return dht.readTemperature();
}

/*
 * Get current humidity reading
 */
float getCurrentHumidity() {
    return dht.readHumidity();
}

/*
 * Check if DHT sensor is working
 */
bool isDHTWorking() {
    float temp = dht.readTemperature();
    return !isnan(temp);
}

/*
 * Get current timestamp in ISO format
 */
String getCurrentTimestampISO() {
    time_t now = time(nullptr);
    struct tm* timeinfo = localtime(&now);
    char buffer[30];
    strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%S", timeinfo);
    return String(buffer);
}

/*
 * Convert timestamp to ISO format
 */
String timestampToISO(unsigned long timestamp) {
    time_t now = timestamp / 1000;  // Convert milliseconds to seconds
    struct tm* timeinfo = localtime(&now);
    char buffer[30];
    strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%S", timeinfo);
    return String(buffer);
}