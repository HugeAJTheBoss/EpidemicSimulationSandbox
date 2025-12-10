// signaling-server.js with automatic matching
// Install: npm install ws
// Run: node signaling-server.js

const WebSocket = require('ws');
const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ 
  port,
  host: '0.0.0.0'
});

const clients = new Map();
const waitingSenders = [];
const waitingReceivers = [];

wss.on('connection', (ws) => {
  const clientId = Math.random().toString(36).substr(2, 9);
  clients.set(clientId, ws);
  
  console.log(`Client connected: ${clientId}`);
  
  // Send client their ID
  ws.send(JSON.stringify({ type: 'id', id: clientId }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Register as sender or receiver
      if (data.type === 'register') {
        const role = data.role;
        
        if (role === 'sender') {
          // Check if there's a waiting receiver
          if (waitingReceivers.length > 0) {
            const receiverId = waitingReceivers.shift();
            const receiverWs = clients.get(receiverId);
            
            if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
              // Pair them immediately
              ws.send(JSON.stringify({
                type: 'paired',
                peerId: receiverId
              }));
              
              receiverWs.send(JSON.stringify({
                type: 'paired',
                peerId: clientId
              }));
              
              console.log(`Auto-paired: sender ${clientId} <-> receiver ${receiverId}`);
            } else {
              // Receiver disconnected, add sender to waiting
              waitingSenders.push(clientId);
              ws.send(JSON.stringify({
                type: 'waiting',
                message: 'Waiting for receiver...'
              }));
            }
          } else {
            // No receivers available, add to waiting list
            waitingSenders.push(clientId);
            ws.send(JSON.stringify({
              type: 'waiting',
              message: 'Waiting for receiver...'
            }));
            console.log(`Sender ${clientId} waiting for receiver`);
          }
        } else if (role === 'receiver') {
          // Check if there's a waiting sender
          if (waitingSenders.length > 0) {
            const senderId = waitingSenders.shift();
            const senderWs = clients.get(senderId);
            
            if (senderWs && senderWs.readyState === WebSocket.OPEN) {
              // Pair them immediately
              ws.send(JSON.stringify({
                type: 'paired',
                peerId: senderId
              }));
              
              senderWs.send(JSON.stringify({
                type: 'paired',
                peerId: clientId
              }));
              
              console.log(`Auto-paired: receiver ${clientId} <-> sender ${senderId}`);
            } else {
              // Sender disconnected, add receiver to waiting
              waitingReceivers.push(clientId);
              ws.send(JSON.stringify({
                type: 'waiting',
                message: 'Waiting for sender...'
              }));
            }
          } else {
            // No senders available, add to waiting list
            waitingReceivers.push(clientId);
            ws.send(JSON.stringify({
              type: 'waiting',
              message: 'Waiting for sender...'
            }));
            console.log(`Receiver ${clientId} waiting for sender`);
          }
        }
      }
      
      // Forward signaling messages to target client
      if (data.target && clients.has(data.target)) {
        const targetWs = clients.get(data.target);
        targetWs.send(JSON.stringify({
          type: data.type,
          from: clientId,
          payload: data.payload
        }));
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  });
  
  ws.on('close', () => {
    clients.delete(clientId);
    
    // Remove from waiting lists
    const senderIndex = waitingSenders.indexOf(clientId);
    if (senderIndex !== -1) {
      waitingSenders.splice(senderIndex, 1);
    }
    
    const receiverIndex = waitingReceivers.indexOf(clientId);
    if (receiverIndex !== -1) {
      waitingReceivers.splice(receiverIndex, 1);
    }
    
    console.log(`Client disconnected: ${clientId}`);
  });
});

console.log(`WebRTC signaling server running on port ${port}`);