import { x25519, ed25519 } from '@noble/curves/ed25519.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { hkdf } from '@noble/hashes/hkdf.js';

// --- Encoding Utilities ---
export function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hexToBytes(hex) {
  if (hex.length % 2 !== 0) throw new Error('Invalid hex string');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function utf8ToBytes(str) {
  return new TextEncoder().encode(str);
}

export function bytesToUtf8(bytes) {
  return new TextDecoder().decode(bytes);
}

export function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(base64) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function getRandomBytes(len) {
  const bytes = new Uint8Array(len);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

// --- Key Generation ---

export function generateIdentityKeyPair() {
  const kp = ed25519.keygen();
  return {
    privateKeyHex: bytesToHex(kp.secretKey),
    publicKeyHex: bytesToHex(kp.publicKey),
  };
}

export function generateX25519KeyPair() {
  const kp = x25519.keygen();
  return {
    privateKeyHex: bytesToHex(kp.secretKey),
    publicKeyHex: bytesToHex(kp.publicKey),
  };
}

export function generateSignedPrekey(identityPrivHex) {
  const prekey = generateX25519KeyPair();
  const pubKeyBytes = hexToBytes(prekey.publicKeyHex);
  const identityPrivBytes = hexToBytes(identityPrivHex);
  const signature = ed25519.sign(pubKeyBytes, identityPrivBytes);
  return {
    ...prekey,
    signatureHex: bytesToHex(signature)
  };
}

export function generateOneTimePrekeys(count = 10) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const kp = generateX25519KeyPair();
    list.push({
      id: `ot_${i}_${Date.now()}`,
      ...kp
    });
  }
  return list;
}

// --- Verification & Safety Numbers ---

export function verifySignedPrekey(identityPubHex, prekeyPubHex, signatureHex) {
  try {
    const pubBytes = hexToBytes(prekeyPubHex);
    const idPubBytes = hexToBytes(identityPubHex);
    const sigBytes = hexToBytes(signatureHex);
    return ed25519.verify(sigBytes, pubBytes, idPubBytes);
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

export function computeSafetyNumbers(myIdentityPubHex, peerIdentityPubHex) {
  // Deterministic lexicographical sorting ensures Alice and Bob compute the exact same fingerprint
  const sorted = [myIdentityPubHex, peerIdentityPubHex].sort();
  const combined = utf8ToBytes(sorted.join('::'));
  const hash = sha256(combined);
  const hex = bytesToHex(hash);

  // Group into 12 blocks of 5 digits
  let digits = '';
  for (let i = 0; i < hex.length && digits.length < 60; i += 2) {
    const val = parseInt(hex.substr(i, 2), 16) % 100;
    digits += val.toString().padStart(2, '0');
  }
  const chunks = [];
  for (let i = 0; i < 60; i += 5) {
    chunks.push(digits.substr(i, 5));
  }
  return {
    fingerprintHex: hex,
    safetyCode: chunks.join(' ')
  };
}

// --- X3DH & Master Secret Derivation ---

export function deriveSharedMasterSecret({
  aliceIdentityX25519Priv,
  aliceEphemeralPriv,
  bobIdentityX25519Pub,
  bobSignedPrekeyPub,
  bobOneTimePrekeyPub = null
}) {
  // DH1 = X25519(aliceIdentityX25519Priv, bobSignedPrekeyPub)
  const dh1 = x25519.getSharedSecret(hexToBytes(aliceIdentityX25519Priv), hexToBytes(bobSignedPrekeyPub));
  // DH2 = X25519(aliceEphemeralPriv, bobIdentityX25519Pub)
  const dh2 = x25519.getSharedSecret(hexToBytes(aliceEphemeralPriv), hexToBytes(bobIdentityX25519Pub));
  // DH3 = X25519(aliceEphemeralPriv, bobSignedPrekeyPub)
  const dh3 = x25519.getSharedSecret(hexToBytes(aliceEphemeralPriv), hexToBytes(bobSignedPrekeyPub));

  let totalSecret = new Uint8Array(dh1.length + dh2.length + dh3.length + (bobOneTimePrekeyPub ? 32 : 0));
  totalSecret.set(dh1, 0);
  totalSecret.set(dh2, dh1.length);
  totalSecret.set(dh3, dh1.length + dh2.length);

  if (bobOneTimePrekeyPub) {
    const dh4 = x25519.getSharedSecret(hexToBytes(aliceEphemeralPriv), hexToBytes(bobOneTimePrekeyPub));
    totalSecret.set(dh4, dh1.length + dh2.length + dh3.length);
  }

  // Derive master 32-byte secret using HKDF-SHA256
  const salt = new Uint8Array(32); // zero-salt
  const masterKey = hkdf(sha256, totalSecret, salt, utf8ToBytes('AnonChat-X3DH-Master-Secret'), 32);
  return bytesToHex(masterKey);
}

// --- Double-Ratchet State Machine ---

export class DoubleRatchetSession {
  constructor(initialState = {}) {
    this.rootKey = initialState.rootKey || null; // Hex
    this.sendChainKey = initialState.sendChainKey || null; // Hex
    this.recvChainKey = initialState.recvChainKey || null; // Hex
    this.localDH = initialState.localDH || generateX25519KeyPair(); // { privateKeyHex, publicKeyHex }
    this.remoteDHPub = initialState.remoteDHPub || null; // Hex
    this.sendCount = initialState.sendCount || 0;
    this.recvCount = initialState.recvCount || 0;
    this.prevChainLength = initialState.prevChainLength || 0;
  }

  static createOutbound(masterSecretHex, remoteDHPubHex) {
    // Split master key into root key and send chain key
    const masterBytes = hexToBytes(masterSecretHex);
    const kdfOutput = hkdf(sha256, masterBytes, new Uint8Array(32), utf8ToBytes('AnonChat-DoubleRatchet-Init'), 64);
    const rk = bytesToHex(kdfOutput.slice(0, 32));
    const ck = bytesToHex(kdfOutput.slice(32, 64));

    const session = new DoubleRatchetSession({
      rootKey: rk,
      sendChainKey: ck,
      recvChainKey: null,
      remoteDHPub: remoteDHPubHex,
      sendCount: 0,
      recvCount: 0,
      prevChainLength: 0
    });
    return session;
  }

  static createInbound(masterSecretHex, remoteDHPubHex, localDH) {
    const masterBytes = hexToBytes(masterSecretHex);
    const kdfOutput = hkdf(sha256, masterBytes, new Uint8Array(32), utf8ToBytes('AnonChat-DoubleRatchet-Init'), 64);
    const rk = bytesToHex(kdfOutput.slice(0, 32));
    const ck = bytesToHex(kdfOutput.slice(32, 64));

    const session = new DoubleRatchetSession({
      rootKey: rk,
      sendChainKey: null,
      recvChainKey: ck,
      localDH: localDH,
      remoteDHPub: remoteDHPubHex,
      sendCount: 0,
      recvCount: 0,
      prevChainLength: 0
    });
    return session;
  }

  // Advances symmetric KDF sending chain to encrypt
  encrypt(payloadObj) {
    if (!this.sendChainKey) {
      // Step DH ratchet if needed
      this.stepDHRatchetSend();
    }

    const currentCK = hexToBytes(this.sendChainKey);
    // KDF step: output 32-byte next CK + 32-byte MessageKey
    const step = hkdf(sha256, currentCK, new Uint8Array(32), utf8ToBytes(`Ratchet-MsgKey-${this.sendCount}`), 64);
    this.sendChainKey = bytesToHex(step.slice(0, 32));
    const messageKey = step.slice(32, 64);

    // 12-byte random nonce for ChaCha20-Poly1305
    const nonce = getRandomBytes(12);
    const cipher = chacha20poly1305(messageKey, nonce);

    const plaintextBytes = utf8ToBytes(JSON.stringify(payloadObj));
    const ciphertextBytes = cipher.encrypt(plaintextBytes);

    const ratchetHeader = {
      dh_ratchet_pub: this.localDH.publicKeyHex,
      pn: this.prevChainLength,
      n: this.sendCount
    };

    this.sendCount++;

    return {
      ciphertext: bytesToBase64(ciphertextBytes),
      ratchet_header: ratchetHeader,
      iv_or_nonce: bytesToHex(nonce)
    };
  }

  stepDHRatchetSend() {
    this.prevChainLength = this.sendCount;
    this.sendCount = 0;
    this.localDH = generateX25519KeyPair();

    const dhShared = x25519.getSharedSecret(
      hexToBytes(this.localDH.privateKeyHex),
      hexToBytes(this.remoteDHPub)
    );

    const rkBytes = hexToBytes(this.rootKey);
    const kdfOutput = hkdf(sha256, dhShared, rkBytes, utf8ToBytes('AnonChat-Ratchet-Step'), 64);
    this.rootKey = bytesToHex(kdfOutput.slice(0, 32));
    this.sendChainKey = bytesToHex(kdfOutput.slice(32, 64));
  }

  stepDHRatchetRecv(newRemoteDHPub) {
    this.remoteDHPub = newRemoteDHPub;
    this.recvCount = 0;

    const dhShared = x25519.getSharedSecret(
      hexToBytes(this.localDH.privateKeyHex),
      hexToBytes(this.remoteDHPub)
    );

    const rkBytes = hexToBytes(this.rootKey);
    const kdfOutput = hkdf(sha256, dhShared, rkBytes, utf8ToBytes('AnonChat-Ratchet-Step'), 64);
    this.rootKey = bytesToHex(kdfOutput.slice(0, 32));
    this.recvChainKey = bytesToHex(kdfOutput.slice(32, 64));
  }

  // Advances symmetric KDF receiving chain to decrypt
  decrypt({ ciphertext, ratchet_header, iv_or_nonce }) {
    const { dh_ratchet_pub } = ratchet_header || {};

    // If sender presented a new DH ratchet key, advance receiving ratchet!
    if (dh_ratchet_pub && dh_ratchet_pub !== this.remoteDHPub) {
      this.stepDHRatchetRecv(dh_ratchet_pub);
    }

    if (!this.recvChainKey) {
      throw new Error('No receiving chain key established for ratchet');
    }

    const currentCK = hexToBytes(this.recvChainKey);
    const step = hkdf(sha256, currentCK, new Uint8Array(32), utf8ToBytes(`Ratchet-MsgKey-${this.recvCount}`), 64);
    this.recvChainKey = bytesToHex(step.slice(0, 32));
    const messageKey = step.slice(32, 64);

    const nonce = hexToBytes(iv_or_nonce);
    const cipher = chacha20poly1305(messageKey, nonce);

    const ciphertextBytes = base64ToBytes(ciphertext);
    const decryptedBytes = cipher.decrypt(ciphertextBytes);
    const decryptedStr = bytesToUtf8(decryptedBytes);

    this.recvCount++;

    return JSON.parse(decryptedStr);
  }
}

// --- Zero-Knowledge File & Audio Encryption ---

export function encryptBinaryData(uint8Bytes) {
  const symmetricKey = getRandomBytes(32);
  const nonce = getRandomBytes(12);
  const cipher = chacha20poly1305(symmetricKey, nonce);
  const encrypted = cipher.encrypt(uint8Bytes);

  return {
    encryptedBytes: encrypted,
    keyHex: bytesToHex(symmetricKey),
    nonceHex: bytesToHex(nonce)
  };
}

export function decryptBinaryData(encryptedBytes, keyHex, nonceHex) {
  const symmetricKey = hexToBytes(keyHex);
  const nonce = hexToBytes(nonceHex);
  const cipher = chacha20poly1305(symmetricKey, nonce);
  return cipher.decrypt(encryptedBytes);
}

// --- Group Encryption (Sender Keys Protocol) ---

export function generateSenderKey() {
  const chainKey = getRandomBytes(32);
  const signingKp = ed25519.keygen();

  return {
    chainKeyHex: bytesToHex(chainKey),
    signingPrivHex: bytesToHex(signingKp.secretKey),
    signingPubHex: bytesToHex(signingKp.publicKey),
    messageCount: 0
  };
}

export function encryptGroupPayload(senderKeyState, payloadObj) {
  const currentCK = hexToBytes(senderKeyState.chainKeyHex);
  const step = hkdf(sha256, currentCK, new Uint8Array(32), utf8ToBytes(`Group-MsgKey-${senderKeyState.messageCount}`), 64);
  senderKeyState.chainKeyHex = bytesToHex(step.slice(0, 32));
  const messageKey = step.slice(32, 64);

  const nonce = getRandomBytes(12);
  const cipher = chacha20poly1305(messageKey, nonce);
  const plaintext = utf8ToBytes(JSON.stringify(payloadObj));
  const ciphertextBytes = cipher.encrypt(plaintext);

  // Sign ciphertext with sender's signing key
  const signature = ed25519.sign(ciphertextBytes, hexToBytes(senderKeyState.signingPrivHex));
  senderKeyState.messageCount++;

  return {
    ciphertext: bytesToBase64(ciphertextBytes),
    ratchet_header: {
      signing_pub: senderKeyState.signingPubHex,
      signature: bytesToHex(signature),
      n: senderKeyState.messageCount - 1
    },
    iv_or_nonce: bytesToHex(nonce)
  };
}

export function decryptGroupPayload(senderKeyState, { ciphertext, ratchet_header, iv_or_nonce }) {
  const ciphertextBytes = base64ToBytes(ciphertext);

  // Verify signature if signing public key is present
  if (ratchet_header && ratchet_header.signing_pub && ratchet_header.signature) {
    const isValid = ed25519.verify(
      hexToBytes(ratchet_header.signature),
      ciphertextBytes,
      hexToBytes(ratchet_header.signing_pub)
    );
    if (!isValid) throw new Error('Group message signature verification failed');
  }

  const currentCK = hexToBytes(senderKeyState.chainKeyHex);
  const step = hkdf(sha256, currentCK, new Uint8Array(32), utf8ToBytes(`Group-MsgKey-${senderKeyState.messageCount}`), 64);
  senderKeyState.chainKeyHex = bytesToHex(step.slice(0, 32));
  const messageKey = step.slice(32, 64);

  const nonce = hexToBytes(iv_or_nonce);
  const cipher = chacha20poly1305(messageKey, nonce);
  const decryptedBytes = cipher.decrypt(ciphertextBytes);

  senderKeyState.messageCount++;
  return JSON.parse(bytesToUtf8(decryptedBytes));
}
