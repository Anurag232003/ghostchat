import { WS_BASE_URL } from './api';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.userId = null;
    this.listeners = new Map();
    this.reconnectTimer = null;
    this.isConnected = false;
  }

  connect(userId) {
    if (this.socket && this.userId === userId && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.userId = userId;
    const wsUrl = `${WS_BASE_URL}/ws/${encodeURIComponent(userId)}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.emit('connection_change', { isConnected: true });
        console.log('[E2EE WS] Connected securely to blind relay server');
      };

      this.socket.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          this.handleIncomingPacket(packet);
        } catch (e) {
          console.error('[E2EE WS] Message parse error:', e);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.emit('connection_change', { isConnected: false });
        console.log('[E2EE WS] Disconnected. Scheduling reconnect...');
        this.scheduleReconnect();
      };

      this.socket.onerror = (err) => {
        console.warn('[E2EE WS] WebSocket error:', err);
      };
    } catch (err) {
      console.error('[E2EE WS] Connection initiation error:', err);
      this.scheduleReconnect();
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }

  scheduleReconnect() {
    if (this.reconnectTimer || !this.userId) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.userId) {
        this.connect(this.userId);
      }
    }, 3000);
  }

  handleIncomingPacket(packet) {
    const type = packet.type;
    if (type === 'encrypted_message') {
      this.emit('message', packet.message);
    } else if (type === 'chat.sent_ack') {
      this.emit('sent_ack', packet);
    } else if (type === 'signal') {
      this.emit('signal', packet.signal);
    } else if (type === 'presence') {
      this.emit('presence', packet);
    }
  }

  send(type, data) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[E2EE WS] Cannot send packet: socket not open');
      return false;
    }
    this.socket.send(JSON.stringify({ type, data }));
    return true;
  }

  sendEncryptedMessage(messagePacket) {
    return this.send('chat.send', messagePacket);
  }

  sendGroupEncryptedMessage(messagePacket) {
    return this.send('group.send', messagePacket);
  }

  sendSignal(signalPacket) {
    return this.send('chat.signal', signalPacket);
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      for (const cb of this.listeners.get(event)) {
        try {
          cb(data);
        } catch (e) {
          console.error(`[E2EE WS] Error in listener for ${event}:`, e);
        }
      }
    }
  }
}

export const wsClient = new WebSocketService();
