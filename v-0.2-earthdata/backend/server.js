// signaling-server.js
// WebSocket relay server for EarthData
// Install: npm install ws
// Run: node signaling-server.js

const WebSocket = require('ws');
const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port, host: '0.0.0.0' });

const clients = new Map();
const waitingSenders = [];
const waitingReceivers = [];

wss.on('connection', (ws) => {
  const clientId = Math.random().toString(36).substr(2, 9);
  ws.peerId = null;
  clients.set(clientId, ws);
  console.log(`Client connected: ${clientId}`);

  ws.send(JSON.stringify({ type: 'id', id: clientId }));

  ws.on('message', (message, isBinary) => {
    // Forward binary directly to peer
    if (isBinary) {
      if (ws.peerId && clients.has(ws.peerId)) {
        const peerWs = clients.get(ws.peerId);
        if (peerWs.readyState === WebSocket.OPEN) {
          peerWs.send(message, { binary: true });
        }
      }
      return;
    }

    let data;
    try { data = JSON.parse(message); } catch { return; }

    // Register role
    if (data.type === 'register') {
      const role = data.role;

      if (role === 'sender') {
        if (waitingReceivers.length > 0) {
          const receiverId = waitingReceivers.shift();
          const receiverWs = clients.get(receiverId);
          if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
            ws.peerId = receiverId;
            receiverWs.peerId = clientId;

            ws.send(JSON.stringify({ type: 'paired', peerId: receiverId }));
            receiverWs.send(JSON.stringify({ type: 'paired', peerId: clientId }));
            console.log(`Auto-paired: sender ${clientId} <-> receiver ${receiverId}`);
          } else {
            waitingSenders.push(clientId);
            ws.send(JSON.stringify({ type: 'waiting', message: 'Waiting for receiver...' }));
          }
        } else {
          waitingSenders.push(clientId);
          ws.send(JSON.stringify({ type: 'waiting', message: 'Waiting for receiver...' }));
          console.log(`Sender ${clientId} waiting for receiver`);
        }
      } else if (role === 'receiver') {
        if (waitingSenders.length > 0) {
          const senderId = waitingSenders.shift();
          const senderWs = clients.get(senderId);
          if (senderWs && senderWs.readyState === WebSocket.OPEN) {
            ws.peerId = senderId;
            senderWs.peerId = clientId;

            ws.send(JSON.stringify({ type: 'paired', peerId: senderId }));
            senderWs.send(JSON.stringify({ type: 'paired', peerId: clientId }));
            console.log(`Auto-paired: receiver ${clientId} <-> sender ${senderId}`);
          } else {
            waitingReceivers.push(clientId);
            ws.send(JSON.stringify({ type: 'waiting', message: 'Waiting for sender...' }));
          }
        } else {
          waitingReceivers.push(clientId);
          ws.send(JSON.stringify({ type: 'waiting', message: 'Waiting for sender...' }));
          console.log(`Receiver ${clientId} waiting for sender`);
        }
      }
    }
  });

  ws.on('close', () => {
    clients.delete(clientId);
    let idx = waitingSenders.indexOf(clientId);
    if (idx !== -1) waitingSenders.splice(idx, 1);
    idx = waitingReceivers.indexOf(clientId);
    if (idx !== -1) waitingReceivers.splice(idx, 1);
    console.log(`Client disconnected: ${clientId}`);
  });
});

console.log(`WebSocket relay server running on port ${port}`);
