const STORAGE_PREFIX = '@anon_e2ee:';

class SecureStorageService {
  constructor() {
    this.memoryStore = new Map();
  }

  getItem(key) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(STORAGE_PREFIX + key);
      }
    } catch (e) {}
    return this.memoryStore.get(key) || null;
  }

  setItem(key, value) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_PREFIX + key, value);
        return;
      }
    } catch (e) {}
    this.memoryStore.set(key, value);
  }

  removeItem(key) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(STORAGE_PREFIX + key);
        return;
      }
    } catch (e) {}
    this.memoryStore.delete(key);
  }

  getJSON(key, defaultValue = null) {
    const val = this.getItem(key);
    if (!val) return defaultValue;
    try {
      return JSON.parse(val);
    } catch (e) {
      return defaultValue;
    }
  }

  setJSON(key, value) {
    this.setItem(key, JSON.stringify(value));
  }

  // --- Identity Management ---
  saveIdentity(identityData) {
    this.setJSON('my_identity', identityData);
  }

  getIdentity() {
    return this.getJSON('my_identity');
  }

  clearIdentity() {
    this.removeItem('my_identity');
  }

  // --- Double Ratchet Sessions ---
  saveRatchetSession(peerId, sessionData) {
    this.setJSON(`session:${peerId}`, sessionData);
  }

  getRatchetSession(peerId) {
    return this.getJSON(`session:${peerId}`);
  }

  // --- Decrypted Chat Message Cache ---
  getChatMessages(conversationId) {
    return this.getJSON(`messages:${conversationId}`, []);
  }

  saveChatMessage(conversationId, messageObj) {
    const list = this.getChatMessages(conversationId);
    const existingIndex = list.findIndex(m => m.message_id === messageObj.message_id);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...messageObj };
    } else {
      list.push(messageObj);
    }
    this.setJSON(`messages:${conversationId}`, list);
    return list;
  }

  updateChatMessage(conversationId, messageId, updates) {
    const list = this.getChatMessages(conversationId);
    const updated = list.map(m => m.message_id === messageId ? { ...m, ...updates } : m);
    this.setJSON(`messages:${conversationId}`, updated);
    return updated;
  }

  deleteChatMessage(conversationId, messageId) {
    const list = this.getChatMessages(conversationId);
    const filtered = list.filter(m => m.message_id !== messageId);
    this.setJSON(`messages:${conversationId}`, filtered);
    return filtered;
  }
}

export const storage = new SecureStorageService();
