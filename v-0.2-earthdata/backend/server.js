const WebSocket = require('ws');
const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ 
  port,
  host: '0.0.0.0'
});

const clients = new Map();
const senders = [];
const receivers = [];

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
          if (receivers.length > 0) {
            const receiverId = receivers.shift();
            const receiverSocket = clients.get(receiverId);
            
            if (receiverSocket && receiverSocket.readyState === WebSocket.OPEN) {
              // Pair them immediately
              ws.send(JSON.stringify({
                type: 'paired',
                peerId: receiverId
              }));
              
              receiverSocket.send(JSON.stringify({
                type: 'paired',
                peerId: clientId
              }));
              
              console.log(`Auto-paired: sender ${clientId} <-> receiver ${receiverId}`);
            } 
            else {
              // Receiver disconnected, add sender to waiting
              senders.push(clientId);
              ws.send(JSON.stringify({
                type: 'waiting',
                message: 'Waiting for receiver...'
              }));
            }
          } 
          else {
            // No receivers available, add to waiting list
            senders.push(clientId);
            ws.send(JSON.stringify({
              type: 'waiting',
              message: 'Waiting for receiver...'
            }));
            console.log(`Sender ${clientId} waiting for receiver`);
          }
        } 
        else if (role === 'receiver') {
          // Check if there's a waiting sender
          if (senders.length > 0) {
            const senderId = senders.shift();
            const senderSocket = clients.get(senderId);
            
            if (senderSocket && senderSocket.readyState === WebSocket.OPEN) {
              // Pair them immediately
              ws.send(JSON.stringify({
                type: 'paired',
                peerId: senderId
              }));
              
              senderSocket.send(JSON.stringify({
                type: 'paired',
                peerId: clientId
              }));
              
              console.log(`Auto-paired: receiver ${clientId} <-> sender ${senderId}`);
            } 
            else {
              // Sender disconnected, add receiver to waiting
              receivers.push(clientId);
              ws.send(JSON.stringify({
                type: 'waiting',
                message: 'Waiting for sender...'
              }));
            }
          } 
          else {
            // No senders available, add to waiting list
            receivers.push(clientId);
            ws.send(JSON.stringify({
              type: 'waiting',
              message: 'Waiting for sender...'
            }));
            console.log(`Receiver ${clientId} waiting for sender`);
          }
        }
      }
      
      if (data.target && clients.has(data.target)) {
        const targetSocket = clients.get(data.target);
        targetSocket.send(JSON.stringify({
          type: data.type,
          from: clientId,
          payload: data.payload
        }));
      }
    } 
    catch (e) {
      console.error('Error parsing message:', e);
    }
  });
  
  ws.on('close', () => {
    clients.delete(clientId);
    
    // Remove from waiting lists
    const senderIndex = senders.indexOf(clientId);
    if (senderIndex !== -1) {
      senders.splice(senderIndex, 1);
    }
    
    const receiverIndex = receivers.indexOf(clientId);
    if (receiverIndex !== -1) {
      receivers.splice(receiverIndex, 1);
    }
    
    console.log(`Client disconnected: ${clientId}`);
  });
});

console.log(`WebRTC signaling server running on port ${port}`);