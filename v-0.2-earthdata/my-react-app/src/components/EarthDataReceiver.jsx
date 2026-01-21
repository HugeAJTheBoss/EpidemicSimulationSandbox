import React, { useState, useEffect, useRef, useCallback } from 'react';

const EarthDataReceiver = ({ onDataReceived }) => {
    const [status, setStatus] = useState('Connecting...');
    const [statusClass, setStatusClass] = useState('');
    const [serverUrl, setServerUrl] = useState('https://epidemicsimulationsandbox.onrender.com');
    const [turnUrl, setTurnUrl] = useState('');
    const [turnUser, setTurnUser] = useState('');
    const [turnPass, setTurnPass] = useState('');
    const [logs, setLogs] = useState([]);
    const [frameStats, setFrameStats] = useState('');

    const signalingWsRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const dataChannelRef = useRef(null);
    const myIdRef = useRef(null);
    const peerIdRef = useRef(null);

    // Frame tracking
    const currentFrameRef = useRef(null);
    const frameChunksRef = useRef(new Map());
    const expectedChunksRef = useRef(0);
    const messageQueueRef = useRef([]);
    const processingQueueRef = useRef(false);

    const log = useCallback((msg) => {
        const time = new Date().toLocaleTimeString();
        const logEntry = `[${time}] ${msg}`;
        console.log(msg);
        setLogs((prev) => [...prev, logEntry]);
    }, []);

    const processEarthData = useCallback((arrayBuffer, frameNum) => {
        const uint8View = new Uint8Array(arrayBuffer);

        // Verify size
        const expectedSize = 3110400;
        if (arrayBuffer.byteLength !== expectedSize) {
            log(`⚠ Size mismatch! Expected ${expectedSize}, got ${arrayBuffer.byteLength}`);
        } else {
            log(`✓ Size correct: ${arrayBuffer.byteLength} bytes`);
        }

        // Call the callback if provided
        if (onDataReceived) {
            onDataReceived(uint8View, frameNum);
        }

        // Save first frame to verify it works
        if (frameNum === 1) {
            const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'received_earthdata.bin';
            a.click();
            URL.revokeObjectURL(url);
            log('✓ First frame saved as received_earthdata.bin');
        }
    }, [log, onDataReceived]);

    const reassembleFrame = useCallback(() => {
        const frameChunks = frameChunksRef.current;
        const expectedChunks = expectedChunksRef.current;
        const currentFrame = currentFrameRef.current;

        if (frameChunks.size !== expectedChunks) {
            log(`⚠ Frame ${currentFrame} incomplete: ${frameChunks.size}/${expectedChunks} chunks`);
            frameChunks.clear();
            return;
        }

        // Calculate total size
        let totalSize = 0;
        frameChunks.forEach(chunk => {
            totalSize += chunk.length;
        });

        // Reassemble in order
        const completeData = new Uint8Array(totalSize);
        let offset = 0;

        for (let i = 0; i < expectedChunks; i++) {
            const chunk = frameChunks.get(i);
            if (chunk) {
                completeData.set(chunk, offset);
                offset += chunk.length;
            } else {
                log(`⚠ Missing chunk ${i} in frame ${currentFrame}`);
                frameChunks.clear();
                return;
            }
        }

        log(`✓ Frame ${currentFrame}: ${totalSize.toLocaleString()} bytes complete`);
        processEarthData(completeData.buffer, currentFrame);

        frameChunks.clear();
    }, [log, processEarthData]);

    const processMessageQueue = useCallback(async () => {
        if (processingQueueRef.current || messageQueueRef.current.length === 0) return;

        processingQueueRef.current = true;

        while (messageQueueRef.current.length > 0) {
            const data = messageQueueRef.current.shift();

            if (data.byteLength === 12) {
                const header = new Uint32Array(data);
                const frameNum = header[0];
                const chunkIndex = header[1];
                const totalChunks = header[2];

                if (currentFrameRef.current !== frameNum) {
                    if (currentFrameRef.current !== null && frameChunksRef.current.size > 0) {
                        reassembleFrame();
                    }

                    currentFrameRef.current = frameNum;
                    frameChunksRef.current.clear();
                    expectedChunksRef.current = totalChunks;

                    log(`Starting frame ${frameNum} (expecting ${totalChunks} chunks)`);
                }

                if (messageQueueRef.current.length > 0) {
                    const chunkData = messageQueueRef.current.shift();
                    frameChunksRef.current.set(chunkIndex, new Uint8Array(chunkData));

                    setFrameStats(`Frame ${currentFrameRef.current}: ${frameChunksRef.current.size}/${expectedChunksRef.current} chunks received`);

                    if (frameChunksRef.current.size === expectedChunksRef.current) {
                        reassembleFrame();
                    }
                }
            }
        }

        processingQueueRef.current = false;
    }, [log, reassembleFrame]);

    const handleOffer = useCallback(async (senderId, offer) => {
        const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];

        // Add custom ICE server if provided
        if (turnUrl.trim()) {
            const iceServer = { urls: turnUrl.trim() };
            if (turnUser.trim() && turnPass.trim()) {
                iceServer.username = turnUser.trim();
                iceServer.credential = turnPass.trim();
            }
            iceServers.unshift(iceServer);
            log(`Added custom ICE server: ${turnUrl.trim()}`);
        }

        log(`Creating PeerConnection with ${iceServers.length} ICE server(s)`);

        peerConnectionRef.current = new RTCPeerConnection({
            iceServers: iceServers
        });

        peerConnectionRef.current.oniceconnectionstatechange = () => {
            const state = peerConnectionRef.current.iceConnectionState;
            log(`ICE State Change: ${state}`);
            if (state === 'failed' || state === 'disconnected') {
                setStatus('❌ Connection Failed (NAT/Firewall)');
                log('⚠️ Connection failed! Likely need a TURN server for this network.');
            }
        };

        peerConnectionRef.current.ondatachannel = (event) => {
            dataChannelRef.current = event.channel;
            dataChannelRef.current.binaryType = 'arraybuffer';

            dataChannelRef.current.onopen = () => {
                log('✓ Data channel opened! Receiving data...');
                setStatus('✓ Receiving Data');
                setStatusClass('connected');
            };

            dataChannelRef.current.onmessage = (event) => {
                messageQueueRef.current.push(event.data);
                processMessageQueue();
            };

            dataChannelRef.current.onclose = () => {
                log('Data channel closed');
                setStatus('Connection closed');
                setStatusClass('waiting');
            };
        };

        peerConnectionRef.current.onicecandidate = (event) => {
            if (event.candidate) {
                signalingWsRef.current.send(JSON.stringify({
                    type: 'ice-candidate',
                    target: senderId,
                    payload: event.candidate
                }));
            }
        };

        await peerConnectionRef.current.setRemoteDescription(offer);
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        signalingWsRef.current.send(JSON.stringify({
            type: 'answer',
            target: senderId,
            payload: answer
        }));

        log('Answer sent to sender');
    }, [log, processMessageQueue, turnUrl, turnUser, turnPass]);

    const connect = useCallback(() => {
        log('Connecting to signaling server...');
        setStatus('Connecting...');

        signalingWsRef.current = new WebSocket(serverUrl);

        signalingWsRef.current.onopen = () => {
            log('✓ Connected to signaling server');
            setStatus('Waiting for sender...');
            setStatusClass('waiting');
        };

        signalingWsRef.current.onmessage = async (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'id') {
                myIdRef.current = data.id;
                log(`My ID: ${data.id}`);

                signalingWsRef.current.send(JSON.stringify({
                    type: 'register',
                    role: 'receiver'
                }));
                log('Registered as receiver, waiting for sender...');
            } else if (data.type === 'waiting') {
                log('Waiting for a sender to connect...');
                setStatus('⏳ Waiting for sender...');
            } else if (data.type === 'paired') {
                peerIdRef.current = data.peerId;
                log(`✓ Paired with sender: ${data.peerId}`);
                setStatus('Paired! Establishing connection...');
            } else if (data.type === 'offer') {
                log('Received offer from sender');
                await handleOffer(data.from, data.payload);
            } else if (data.type === 'ice-candidate') {
                if (peerConnectionRef.current) {
                    await peerConnectionRef.current.addIceCandidate(data.payload);
                }
            }
        };

        signalingWsRef.current.onerror = (err) => {
            log('Signaling error - check server URL');
            setStatus('❌ Connection error');
        };

        signalingWsRef.current.onclose = () => {
            log('Disconnected from signaling server');
            setStatus('❌ Disconnected');

            setTimeout(() => {
                log('Attempting to reconnect...');
                connect();
            }, 3000);
        };
    }, [serverUrl, log, handleOffer]);

    useEffect(() => {
        connect();

        return () => {
            if (signalingWsRef.current) {
                signalingWsRef.current.close();
            }
            if (peerConnectionRef.current) {
                peerConnectionRef.current.close();
            }
        };
    }, [connect]);

    return (
        <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '50px auto', padding: '20px' }}>
            <h1>EarthData Receiver (Auto-Connect)</h1>

            <div className={`status ${statusClass}`} style={{
                padding: '20px',
                margin: '20px 0',
                borderRadius: '5px',
                background: statusClass === 'connected' ? '#d4edda' : statusClass === 'waiting' ? '#fff3cd' : '#f0f0f0',
                color: statusClass === 'connected' ? '#155724' : statusClass === 'waiting' ? '#856404' : '#000',
                fontSize: '24px',
                textAlign: 'center'
            }}>
                {status}
            </div>

            {frameStats && (
                <div style={{
                    background: '#f8f9fa',
                    padding: '10px',
                    margin: '10px 0',
                    borderRadius: '5px',
                    fontFamily: 'monospace'
                }}>
                    {frameStats}
                </div>
            )}

            <div style={{ background: '#e7f3ff', padding: '15px', borderRadius: '5px', margin: '20px 0' }}>
                <strong>Server URL:</strong><br />
                <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="https://epidemicsimulationsandbox.onrender.com"
                    style={{ padding: '10px', width: '400px', fontSize: '14px', marginTop: '5px' }}
                />

                <div style={{ marginTop: '15px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
                    <strong>Advanced: ICE/TURN Settings</strong> <small>(for Eduroam/Enterprise)</small><br />
                    <input
                        type="text"
                        value={turnUrl}
                        onChange={(e) => setTurnUrl(e.target.value)}
                        placeholder="turn:your-turn-server.com:3478"
                        style={{ marginTop: '5px', width: '300px', padding: '10px', fontSize: '14px' }}
                    /><br />
                    <input
                        type="text"
                        value={turnUser}
                        onChange={(e) => setTurnUser(e.target.value)}
                        placeholder="username"
                        style={{ marginTop: '5px', width: '145px', padding: '10px', fontSize: '14px' }}
                    />
                    <input
                        type="password"
                        value={turnPass}
                        onChange={(e) => setTurnPass(e.target.value)}
                        placeholder="password"
                        style={{ marginTop: '5px', width: '145px', padding: '10px', fontSize: '14px' }}
                    />
                </div>

                <p style={{ fontSize: '12px', color: '#666' }}>Auto-connects on page load. Waiting for sender...</p>
            </div>

            <div style={{
                background: '#000',
                color: '#0f0',
                padding: '15px',
                height: '400px',
                overflowY: 'auto',
                fontFamily: 'monospace',
                marginTop: '20px'
            }}>
                {logs.map((log, index) => (
                    <div key={index}>{log}</div>
                ))}
            </div>
        </div>
    );
};

export default EarthDataReceiver;
