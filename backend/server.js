const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// ─── Data Storage (In-Memory array) ──
let sensor_readings = [];
let alerts = [];
let nextReadingId = 1;
let nextAlertId = 1;

// Manual Pump Override State
let manualOverride = {
    active: false,
    acid_pump: 0,
    base_pump: 0,
    coagulant_pump: 0
};

// ─── Classification Logic ─────────────────────────────────────────────────────
function classify(ph, turbidity, temp) {
  if (ph < 6.0 || ph > 8.5 || turbidity < 0.10 || temp < 10 || temp > 35) {
    return { class: 3, label: 'Not Reusable', emoji: '🔴', color: '#ef4444', desc: 'Water requires full treatment before any use.' };
  } else if (turbidity > 2.5 && ph >= 6.0 && ph <= 8.5) {
    return { class: 0, label: 'Irrigation', emoji: '🟢', color: '#10b981', desc: 'Suitable for agricultural irrigation.' };
  } else if (turbidity > 1.5) {
    return { class: 1, label: 'River Discharge', emoji: '🔵', color: '#3b82f6', desc: 'Meets standards for safe river discharge.' };
  } else {
    return { class: 2, label: 'Household Use', emoji: '🟡', color: '#f59e0b', desc: 'Suitable for non-potable household applications.' };
  }
}

function getPumpStatus(ph, turbidity) {
  return {
    acid_pump:      ph > 8.5 ? 1 : 0,
    base_pump:      ph < 6.5 ? 1 : 0,
    coagulant_pump: turbidity < 0.50 ? 1 : 0
  };
}

// ─── ESP32 Data Endpoint ────────────────────────────────────────────────────────
app.post('/api/data', (req, res) => {
  const { ph, turbidity, temp } = req.body;
  
  if (ph === undefined || turbidity === undefined || temp === undefined) {
    return res.status(400).json({ error: 'Missing sensor data' });
  }

  const cls = classify(ph, turbidity, temp);
  let pumps = getPumpStatus(ph, turbidity);

  // Apply Manual Override if active
  if (manualOverride.active) {
      pumps = {
          acid_pump: manualOverride.acid_pump,
          base_pump: manualOverride.base_pump,
          coagulant_pump: manualOverride.coagulant_pump
      };
  }

  const timestamp = new Date().toISOString();

  const reading = {
    id: nextReadingId++,
    timestamp, temp, ph, turbidity,
    classification: cls,
    class_label: cls.label,
    pumps,
    acid_pump: pumps.acid_pump,
    base_pump: pumps.base_pump,
    coagulant_pump: pumps.coagulant_pump,
    is_manual_override: manualOverride.active
  };

  sensor_readings.push(reading);
  if (sensor_readings.length > 5000) sensor_readings.shift(); // Increased to 5000 for history

  // Alert detection
  if (cls.class === 3) {
    const alert = {
      id: nextAlertId++,
      timestamp,
      type: 'CLASSIFICATION',
      message: `⚠️ Critical: Water classified as Not Reusable (pH:${ph}, Turb:${turbidity}, Temp:${temp}°C)`,
      severity: 'critical'
    };
    alerts.push(alert);
    if (alerts.length > 200) alerts.shift();
  }

  // Broadcast to all connected WebSockets (Frontend)
  broadcast({ type: 'reading', data: reading });

  // Send back pump commands to the ESP32
  res.json({ success: true, pumps, override_active: manualOverride.active });
});

// ─── Manual Override Endpoint ──────────────────────────────────────────────────
app.post('/api/override', (req, res) => {
    const { active, acid_pump, base_pump, coagulant_pump } = req.body;
    
    if (active !== undefined) manualOverride.active = active;
    if (acid_pump !== undefined) manualOverride.acid_pump = acid_pump ? 1 : 0;
    if (base_pump !== undefined) manualOverride.base_pump = base_pump ? 1 : 0;
    if (coagulant_pump !== undefined) manualOverride.coagulant_pump = coagulant_pump ? 1 : 0;
    
    broadcast({ type: 'override_state', data: manualOverride });
    res.json({ success: true, manualOverride });
});

// ─── WebSocket Broadcasting ───────────────────────────────────────────────────
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

wss.on('connection', ws => {
  console.log('📡 Client connected via WebSocket');
  
  // Send last 60 readings on connect for the charts
  const recent = sensor_readings.slice(-60);
  const formattedRecent = recent.map(r => ({
    timestamp: r.timestamp,
    temperature: r.temp,
    ph: r.ph,
    turbidity: r.turbidity,
    classification: r.classification.class,
    class_label: r.class_label,
    acid_pump: r.acid_pump,
    base_pump: r.base_pump,
    coagulant_pump: r.coagulant_pump,
    is_manual_override: r.is_manual_override
  }));
  ws.send(JSON.stringify({ type: 'history', data: formattedRecent }));
  
  // Send current override state
  ws.send(JSON.stringify({ type: 'override_state', data: manualOverride }));

  ws.on('close', () => console.log('📡 Client disconnected'));
});

// ─── REST API ─────────────────────────────────────────────────────────────────
app.get('/api/readings', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const start = req.query.start; // ISO timestamp
  const end = req.query.end;     // ISO timestamp
  
  let rows = sensor_readings;
  if (start && end) {
      rows = rows.filter(r => r.timestamp >= start && r.timestamp <= end);
  }
  
  rows = rows.slice(-limit).reverse();
  res.json({ success: true, data: rows });
});

app.get('/api/stats', (req, res) => {
  let total = sensor_readings.length;
  if (total === 0) return res.json({ success: true, data: null });
  
  let avg_temp = 0, avg_ph = 0, avg_turbidity = 0;
  let irrigation = 0, river = 0, household = 0, not_reusable = 0;

  sensor_readings.forEach(r => {
    avg_temp += r.temp;
    avg_ph += r.ph;
    avg_turbidity += r.turbidity;
    if (r.classification.class === 0) irrigation++;
    else if (r.classification.class === 1) river++;
    else if (r.classification.class === 2) household++;
    else if (r.classification.class === 3) not_reusable++;
  });

  res.json({ success: true, data: {
    total,
    avg_temp: avg_temp / total,
    avg_ph: avg_ph / total,
    avg_turbidity: avg_turbidity / total,
    irrigation, river, household, not_reusable
  }});
});

app.delete('/api/readings', (req, res) => {
  sensor_readings = [];
  alerts = [];
  res.json({ success: true, message: 'All readings cleared.' });
});

app.get('/api/export/csv', (req, res) => {
  const header = 'id,timestamp,temperature,ph,turbidity,classification,class_label,acid_pump,base_pump,coagulant_pump\n';
  const csv = header + sensor_readings.map(r =>
    `${r.id},"${r.timestamp}",${r.temp},${r.ph},${r.turbidity},${r.classification.class},"${r.class_label}",${r.acid_pump},${r.base_pump},${r.coagulant_pump}`
  ).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=wastewater_log.csv');
  res.send(csv);
});

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🌊 Wastewater Dashboard Backend running on ${PORT}\n`);
});
