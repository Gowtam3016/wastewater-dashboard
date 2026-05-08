#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h> // Ensure you install ArduinoJson via Library Manager

// ==============================================================================
// 🌐 CONFIGURATION
// ==============================================================================
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Replace with your computer's local IP address (e.g., 192.168.1.100)
const String serverUrl = "http://192.168.1.XXX:3001/api/data"; 

// ==============================================================================
// 🔌 HARDWARE PINS (Adjust based on your wiring)
// ==============================================================================
// Sensors
const int PIN_PH        = 34; // Analog input for pH Sensor
const int PIN_TURBIDITY = 35; // Analog input for Turbidity Sensor
const int PIN_TEMP      = 32; // Analog input for Temp Sensor (e.g., LM35 or NTC)
                              // If using DS18B20, you will need OneWire library

// Relay Module for Peristaltic Pumps
const int RELAY_ACID      = 25; // Pump 1
const int RELAY_BASE      = 26; // Pump 2
const int RELAY_COAGULANT = 27; // Pump 3

// Calibration variables (Adjust these after testing your sensors)
float phCalibration_offset = 0.0;
float turbidity_offset = 0.0;

void setup() {
  Serial.begin(115200);
  
  // Initialize Relays as OUTPUT and turn them OFF initially
  // Note: Most relay modules are ACTIVE LOW. Change to LOW if yours is ACTIVE HIGH.
  pinMode(RELAY_ACID, OUTPUT);
  pinMode(RELAY_BASE, OUTPUT);
  pinMode(RELAY_COAGULANT, OUTPUT);
  
  digitalWrite(RELAY_ACID, HIGH); // HIGH = OFF on Active-Low Relays
  digitalWrite(RELAY_BASE, HIGH);
  digitalWrite(RELAY_COAGULANT, HIGH);

  // Connect to Wi-Fi
  Serial.println();
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nWiFi Connected!");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    
    // 1. Read Sensor Data
    float phValue = readPhSensor(PIN_PH);
    float turbidityV = readTurbiditySensor(PIN_TURBIDITY);
    float tempC = readTemperatureSensor(PIN_TEMP);

    Serial.println("--- Sensor Readings ---");
    Serial.printf("pH: %.2f | Turbidity: %.2fV | Temp: %.2f°C\n", phValue, turbidityV, tempC);

    // 2. Prepare JSON payload
    StaticJsonDocument<200> doc;
    doc["ph"] = phValue;
    doc["turbidity"] = turbidityV;
    doc["temp"] = tempC;
    
    String jsonPayload;
    serializeJson(doc, jsonPayload);

    // 3. Send HTTP POST request to Dashboard
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    int httpResponseCode = http.POST(jsonPayload);

    // 4. Handle Response and control pumps
    if (httpResponseCode > 0) {
      String responseStr = http.getString();
      Serial.print("Server Response: ");
      Serial.println(responseStr);

      // Parse JSON response to get pump statuses
      StaticJsonDocument<300> responseDoc;
      DeserializationError error = deserializeJson(responseDoc, responseStr);

      if (!error) {
        int acid_pump = responseDoc["pumps"]["acid_pump"];
        int base_pump = responseDoc["pumps"]["base_pump"];
        int coagulant_pump = responseDoc["pumps"]["coagulant_pump"];

        // Control Relays based on backend response (Active LOW assumed)
        digitalWrite(RELAY_ACID, acid_pump ? LOW : HIGH);
        digitalWrite(RELAY_BASE, base_pump ? LOW : HIGH);
        digitalWrite(RELAY_COAGULANT, coagulant_pump ? LOW : HIGH);
        
        Serial.printf("Pumps -> Acid:%d, Base:%d, Coagulant:%d\n", acid_pump, base_pump, coagulant_pump);
      } else {
        Serial.println("Failed to parse JSON response");
      }
    } else {
      Serial.print("Error sending POST: ");
      Serial.println(httpResponseCode);
    }
    
    http.end();
  } else {
    Serial.println("WiFi Disconnected. Attempting to reconnect...");
    WiFi.disconnect();
    WiFi.begin(ssid, password);
  }

  // Send data every 3 seconds
  delay(3000);
}

// ==============================================================================
// 🧪 SENSOR READING FUNCTIONS (Customize based on your specific sensor models)
// ==============================================================================

float readPhSensor(int pin) {
  int analogValue = analogRead(pin);
  float voltage = analogValue * (3.3 / 4095.0);
  // Example mapping for standard pH sensor (needs calibration)
  // pH = 7.0 + ((voltage - 1.65) * slope)
  float ph = 3.3 * voltage + phCalibration_offset; 
  // Safety clamp
  if(ph < 0) ph = 0; if(ph > 14) ph = 14;
  return ph;
}

float readTurbiditySensor(int pin) {
  int analogValue = analogRead(pin);
  // Convert ADC value (0-4095) to Voltage (0-3.3V)
  float voltage = analogValue * (3.3 / 4095.0);
  return voltage;
}

float readTemperatureSensor(int pin) {
  // If using an analog sensor like LM35 (which natively outputs 10mV/°C)
  // For DS18B20 you need DallasTemperature library instead of analogRead.
  int analogValue = analogRead(pin);
  float voltage = analogValue * (3.3 / 4095.0);
  float tempC = voltage * 100.0; // Approximation for LM35
  
  // Just returning a dummy baseline if reading is 0 (unconnected pin)
  if(tempC < 1) return 25.0; 
  return tempC;
}
