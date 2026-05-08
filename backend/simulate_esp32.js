const http = require('http');

function sendData() {
  const data = JSON.stringify({
    ph: +(5.0 + Math.random() * 5.0).toFixed(2),
    turbidity: +(Math.random() * 3.3).toFixed(3),
    temp: +(10 + Math.random() * 30).toFixed(2)
  });

  const req = http.request({
    hostname: 'localhost',
    port: 3001,
    path: '/api/data',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    }
  }, (res) => {
    // Keep connection alive/clean
    res.on('data', () => {});
  });

  req.on('error', (e) => {
    console.error('Error connecting to backend:', e.message);
  });

  req.write(data);
  req.end();
}

console.log('📡 Simulating ESP32 sending data every 2 seconds to localhost:3001...');
setInterval(sendData, 2000);
