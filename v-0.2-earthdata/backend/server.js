// signaling-server.js
// Install: npm install ws
// Run: node signaling-server.js

const WebSocket = require('ws');
const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port });

const clients = new Map();

wss.on('connection', (ws) => {
  const clientId = Math.random().toString(36).substr(2, 9);
  clients.set(clientId, ws);
  
  console.log(`Client connected: ${clientId}`);
  
  // Send client their ID
  ws.send(JSON.stringify({ type: 'id', id: clientId }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Forward signaling messages to target client
      if (data.target && clients.has(data.target)) {
        const targetWs = clients.get(data.target);
        targetWs.send(JSON.stringify({
          type: data.type,
          from: clientId,
          payload: data.payload
        }));
      }
      
      // Broadcast available clients list
      if (data.type === 'list') {
        const clientList = Array.from(clients.keys()).filter(id => id !== clientId);
        ws.send(JSON.stringify({ type: 'clients', clients: clientList }));
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  });
  
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Client disconnected: ${clientId}`);
  });
});

console.log(`WebRTC signaling server running on ws://localhost:${port}`);