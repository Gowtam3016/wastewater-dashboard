# 🌊 IoT Wastewater Treatment & Classification Dashboard

> Real-time monitoring and intelligent water quality classification system powered by ESP32, Node.js, WebSockets, and a Random Forest ML model.

**Live Demo →** [wastewater-dashboard.vercel.app](https://wastewater-dashboard.vercel.app)

---

## Overview

This project is a full-stack IoT system that monitors wastewater quality in real time using an ESP32 microcontroller and classifies water treatment status using a machine learning model. The dashboard streams live sensor data via WebSockets, logs historical readings, and supports manual override of treatment actuators — all from a browser.

---

## Features

- **Real-time sensor monitoring** — pH level, turbidity (voltage), and temperature streamed live via WebSocket
- **ML water quality classification** — Random Forest model classifies each reading into treatment categories
- **Actuator control panel** — manual override for Acid Pump, Base Pump, and Coagulant Pump (ON/OFF per pump)
- **Session log** — tabular record of all readings with timestamp, sensor values, and predicted class
- **Historical analytics** — fetch and visualize past pH, temperature, and turbidity trends with charts
- **ML model evaluation** — compare Random Forest performance against alternative models
- **Live connection status** — real-time clock and last-update indicator

---

## Tech Stack

| Layer | Technology |
|---|---|
| Hardware | ESP32 microcontroller (C++/Arduino) |
| Backend | Node.js + WebSocket server |
| Frontend | HTML, CSS, JavaScript (Chart.js for graphs) |
| ML Model | Random Forest classifier |
| Deployment | Vercel (frontend) |

---

## Project Structure

```
wastewater-dashboard/
├── backend/                  # Node.js WebSocket server
├── frontend/                 # Dashboard UI (HTML/JS/CSS)
└── hardware/
    └── ESP32_Wastewater_Node/ # Arduino firmware for ESP32
```

---

## How It Works

```
ESP32 Sensors
(pH, Turbidity, Temp)
        │
        ▼
  Node.js Backend
  (WebSocket Server)
        │
        ▼
  Browser Dashboard
  ├── Live readings
  ├── ML classification
  ├── Actuator controls
  └── Historical charts
```

1. The **ESP32** reads pH, turbidity, and temperature sensors at regular intervals and sends the data to the backend over Wi-Fi.
2. The **Node.js server** receives the data, runs it through the ML classification model, and broadcasts results to all connected clients via WebSocket.
3. The **frontend dashboard** displays live readings, logs each session entry, and visualizes trends. Operators can manually trigger treatment pumps directly from the UI.

---

## Getting Started

### Prerequisites

- Node.js v18+
- Arduino IDE with ESP32 board support
- ESP32 development board
- pH sensor, turbidity sensor, temperature sensor (DS18B20 or similar)

### 1. Backend

```bash
cd backend
npm install
node server.js
```

The WebSocket server will start on the configured port.

### 2. Frontend

Open `frontend/index.html` in a browser, or deploy the `frontend/` folder to Vercel.

### 3. Hardware (ESP32)

Open `hardware/ESP32_Wastewater_Node/` in Arduino IDE, configure your Wi-Fi credentials and server IP in the sketch, then flash to your ESP32.

---

## Dashboard Tabs

| Tab | Description |
|---|---|
| **Live Dashboard** | Real-time sensor gauges, actuator controls, session log |
| **Historical Analytics** | Fetch and chart past pH, temperature, turbidity data |
| **ML Model Evaluation** | Random Forest accuracy vs. alternative model comparisons |

---

## Sensors & Actuators

**Sensors (read by ESP32)**
- pH sensor — measures acidity/alkalinity of wastewater
- Turbidity sensor — measures water clarity (output in volts)
- Temperature sensor — ambient/water temperature in °C

**Actuators (controlled from dashboard)**
- Acid Pump — lowers pH
- Base Pump — raises pH
- Coagulant Pump — removes suspended particles

---

## ML Classification

The system uses a **Random Forest classifier** trained on wastewater quality datasets. Each incoming sensor reading is classified into a treatment category, displayed live in the session log and evaluated against alternative models in the ML tab.

---

## License

MIT License — feel free to fork, adapt, and build on this.

---

## Author

**Gowtam** — [GitHub](https://github.com/Gowtam3016)
