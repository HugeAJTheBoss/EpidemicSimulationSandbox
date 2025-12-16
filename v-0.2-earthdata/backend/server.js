const WebSocket = require('ws');
const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ 
  port,
  host: '0.0.0.0'
});

const clients = new Map(); // clientId -> {ws, role}
const waitingSenders = [];
const waitingReceivers = [];

function logState() {
  console.log(`Active clients: ${clients.size}, Waiting senders: ${waitingSenders.length}, Waiting receivers: ${waitingReceivers.length}`);
}

wss.on('connection', (ws) => {
  const clientId = Math.random().toString(36).substr(2, 9);
  
  console.log(`[${clientId}] Client connected`);
  
  // Send client their ID
  ws.send(JSON.stringify({ type: 'id', id: clientId }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Register as sender or receiver
      if (data.type === 'register') {
        const role = data.role;
        
        // Store client info
        clients.set(clientId, { ws, role });
        
        console.log(`[${clientId}] Registered as ${role}`);
        
        if (role === 'sender') {
          // Check if there's a waiting receiver
          if (waitingReceivers.length > 0) {
            const receiverId = waitingReceivers.shift();
            const receiverClient = clients.get(receiverId);
            
            if (receiverClient && receiverClient.ws.readyState === WebSocket.OPEN) {
              // Pair them immediately
              console.log(`✓ PAIRING: sender ${clientId} <-> receiver ${receiverId}`);
              
              ws.send(JSON.stringify({
                type: 'paired',
                peerId: receiverId
              }));
              
              receiverClient.ws.send(JSON.stringify({
                type: 'paired',
                peerId: clientId
              }));
            } else {
              // Receiver disconnected, add sender to waiting
              console.log(`[${clientId}] Receiver disconnected, adding to waiting list`);
              waitingSenders.push(clientId);
              ws.send(JSON.stringify({
                type: 'waiting',
                message: 'Waiting for receiver...'
              }));
            }
          } else {
            // No receivers available, add to waiting list
            console.log(`[${clientId}] No receivers available, adding to waiting list`);
            waitingSenders.push(clientId);
            ws.send(JSON.stringify({
              type: 'waiting',
              message: 'Waiting for receiver...'
            }));
          }
        } else if (role === 'receiver') {
          // Check if there's a waiting sender
          if (waitingSenders.length > 0) {
            const senderId = waitingSenders.shift();
            const senderClient = clients.get(senderId);
            
            if (senderClient && senderClient.ws.readyState === WebSocket.OPEN) {
              // Pair them immediately
              console.log(`✓ PAIRING: receiver ${clientId} <-> sender ${senderId}`);
              
              ws.send(JSON.stringify({
                type: 'paired',
                peerId: senderId
              }));
              
              senderClient.ws.send(JSON.stringify({
                type: 'paired',
                peerId: clientId
              }));
            } else {
              // Sender disconnected, add receiver to waiting
              console.log(`[${clientId}] Sender disconnected, adding to waiting list`);
              waitingReceivers.push(clientId);
              ws.send(JSON.stringify({
                type: 'waiting',
                message: 'Waiting for sender...'
              }));
            }
          } else {
            // No senders available, add to waiting list
            console.log(`[${clientId}] No senders available, adding to waiting list`);
            waitingReceivers.push(clientId);
            ws.send(JSON.stringify({
              type: 'waiting',
              message: 'Waiting for sender...'
            }));
          }
        }
        
        logState();
      }
      
      // Forward signaling messages to target client
      if (data.target) {
        const targetClient = clients.get(data.target);
        if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
          targetClient.ws.send(JSON.stringify({
            type: data.type,
            from: clientId,
            payload: data.payload
          }));
          console.log(`[${clientId}] Forwarded ${data.type} to ${data.target}`);
        } else {
          console.log(`[${clientId}] Target ${data.target} not found or disconnected`);
        }
      }
    } catch (e) {
      console.error(`[${clientId}] Error parsing message:`, e);
    }
  });
  
  ws.on('close', () => {
    clients.delete(clientId);
    
    // Remove from waiting lists
    const senderIndex = waitingSenders.indexOf(clientId);
    if (senderIndex !== -1) {
      waitingSenders.splice(senderIndex, 1);
      console.log(`[${clientId}] Removed from waiting senders`);
    }
    
    const receiverIndex = waitingReceivers.indexOf(clientId);
    if (receiverIndex !== -1) {
      waitingReceivers.splice(receiverIndex, 1);
      console.log(`[${clientId}] Removed from waiting receivers`);
    }
    
    console.log(`[${clientId}] Client disconnected`);
    logState();
  });
  
  ws.on('error', (err) => {
    console.error(`[${clientId}] WebSocket error:`, err.message);
  });
});

console.log(`WebRTC signaling server running on port ${port}`);
console.log('Waiting for connections...');