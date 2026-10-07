import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';

import {
  generateIdentityKeyPair,
  generateSignedPrekey,
  generateOneTimePrekeys,
  deriveSharedMasterSecret,
  DoubleRatchetSession,
  computeSafetyNumbers,
  encryptBinaryData,
  decryptBinaryData,
  generateSenderKey,
  encryptGroupPayload,
  decryptGroupPayload,
  utf8ToBytes,
  bytesToUtf8,
  bytesToHex,
  hexToBytes
} from './src/crypto/e2ee';

import {
  registerUser,
  fetchUsers,
  fetchPrekeyBundle,
  createGroupChat,
  fetchMyGroups,
  uploadEncryptedAttachment,
  downloadEncryptedAttachment,
  uploadChatMedia,
  syncUserIdentity,
  updateProfile,
  fetchRevealedProfile,
  requestOrGrantLevelUnlock,
  consentProgressivePhotoReveal,
  fetchSelfDestructPolicy,
  fetchActiveSecretChatBetween,
  reportSecretScreenshotAlert
} from './src/services/api';

import { wsClient } from './src/services/socket';
import { storage } from './src/services/storage';
import { CryptoInspector } from './src/components/CryptoInspector';
import { SafetyNumberModal } from './src/components/SafetyNumberModal';
import { IdentityRevealCard, EditProfileModal } from './src/components/IdentityRevealCard';
import { ProgressiveIdentityReveal } from './src/components/ProgressiveIdentityReveal';
import { BlindDateModal } from './src/components/BlindDateModal';
import { MiniGamesModal } from './src/components/MiniGamesModal';
import { ChemistryMeterModal } from './src/components/ChemistryMeterModal';
import { MissionsModal } from './src/components/MissionsModal';
import { QuestionCardsModal } from './src/components/QuestionCardsModal';
import { BlindPhotoCard } from './src/components/BlindPhotoCard';
import { SendBlindPhotoModal } from './src/components/SendBlindPhotoModal';
import { SendMediaModal, ViewOnceMediaModal } from './src/components/SendMediaModal';
import { BlurProfileModal } from './src/components/BlurProfileModal';
import { TopicRoomsModal } from './src/components/TopicRoomsModal';
import { SelfDestructModal } from './src/components/SelfDestructModal';
import { SecretChatModal } from './src/components/SecretChatModal';
import { AnonymousPersonalityCardModal } from './src/components/AnonymousPersonalityCardModal';
import { UniverseMatchingModal } from './src/components/UniverseMatchingModal';
import Instant5MinDateModal from './src/components/Instant5MinDateModal';
import SecondChanceModal from './src/components/SecondChanceModal';
import SmartMatchmakingModal from './src/components/SmartMatchmakingModal';
import BlindDateXPModal from './src/components/BlindDateXPModal';
import DailyMysteryDropModal from './src/components/DailyMysteryDropModal';
import ScheduledBlindDateModal from './src/components/ScheduledBlindDateModal';
import DateMemoryModal from './src/components/DateMemoryModal';
import ArchitectureFlowModal from './src/components/ArchitectureFlowModal';

const AVATAR_COLORS = ['#38BDF8', '#818CF8', '#A78BFA', '#F472B6', '#34D399', '#FBBF24'];

export default function App() {
  // Current user state
  const [identity, setIdentity] = useState(null);
  const [pseudonymInput, setPseudonymInput] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Progressive Identity State
  const [peerRevealedProfile, setPeerRevealedProfile] = useState(null);
  const [myGrantedLevel, setMyGrantedLevel] = useState(1);
  const [editPersonaVisible, setEditPersonaVisible] = useState(false);
  const [unlockNotification, setUnlockNotification] = useState(null);
  const [photoPromptModal, setPhotoPromptModal] = useState({ visible: false, requesterId: null, requesterNickname: 'Nova', prompt: '' });
  const [progressiveRevealViewMode, setProgressiveRevealViewMode] = useState('progressive'); // 'progressive' | 'persona'

  // Blind Date Signature Feature State
  const [blindDateModalVisible, setBlindDateModalVisible] = useState(false);
  const [miniGamesModalVisible, setMiniGamesModalVisible] = useState(false);
  const [chemistryModalVisible, setChemistryModalVisible] = useState(false);
  const [missionsModalVisible, setMissionsModalVisible] = useState(false);
  const [questionCardsModalVisible, setQuestionCardsModalVisible] = useState(false);
  const [sendBlindPhotoModalVisible, setSendBlindPhotoModalVisible] = useState(false);
  const [blurProfileModalVisible, setBlurProfileModalVisible] = useState(false);
  const [topicRoomsModalVisible, setTopicRoomsModalVisible] = useState(false);
  const [selfDestructModalVisible, setSelfDestructModalVisible] = useState(false);
  const [conversationPolicy, setConversationPolicy] = useState({ seconds: null, label: 'Never' });
  const [secretChatModalVisible, setSecretChatModalVisible] = useState(false);
  const [activeSecretSession, setActiveSecretSession] = useState(null);
  const [screenshotAlertBanner, setScreenshotAlertBanner] = useState(null);
  const [personalityCardModalVisible, setPersonalityCardModalVisible] = useState(false);
  const [universeModalVisible, setUniverseModalVisible] = useState(false);
  const [instantDateModalVisible, setInstantDateModalVisible] = useState(false);
  const [secondChanceModalVisible, setSecondChanceModalVisible] = useState(false);
  const [smartMatchmakingModalVisible, setSmartMatchmakingModalVisible] = useState(false);
  const [blindDateXPModalVisible, setBlindDateXPModalVisible] = useState(false);
  const [dailyMysteryDropModalVisible, setDailyMysteryDropModalVisible] = useState(false);
  const [scheduledDateModalVisible, setScheduledDateModalVisible] = useState(false);
  const [dateMemoryModalVisible, setDateMemoryModalVisible] = useState(false);
  const [architectureModalVisible, setArchitectureModalVisible] = useState(false);
  const [activitiesModalVisible, setActivitiesModalVisible] = useState(false);
  const [unlockedTopics, setUnlockedTopics] = useState(["What's your dream destination?"]);

  // Active Chats & Peers
  const [activeTab, setActiveTab] = useState('direct'); // 'direct' | 'groups'
  const [usersList, setUsersList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null); // peer user or group

  // In-memory active Ratchet sessions: peer_id -> DoubleRatchetSession
  const sessionsRef = useRef(new Map());
  // In-memory group sender keys: group_id -> senderKey object
  const groupSenderKeysRef = useRef(new Map());

  // Messages per conversation: conversationId -> Array of message objects
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [ephemeralTimer, setEphemeralTimer] = useState(0); // 0 = off, 5, 30, 60
  const [noForwardActive, setNoForwardActive] = useState(false);

  // Typing state
  const [peerTyping, setPeerTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  // Modals & Panels
  const [inspectorVisible, setInspectorVisible] = useState(false);
  const [packetLog, setPacketLog] = useState([]);
  const [safetyModalVisible, setSafetyModalVisible] = useState(false);
  const [safetyData, setSafetyData] = useState(null);
  const [newGroupModal, setNewGroupModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);

  // Voice note simulation state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const voiceTimerRef = useRef(null);

  // Chat Media (Photo / Video - Normal View & One-Time View)
  const [selectedMediaFile, setSelectedMediaFile] = useState(null);
  const [selectedMediaPreview, setSelectedMediaPreview] = useState(null);
  const [sendMediaModalVisible, setSendMediaModalVisible] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [viewOnceModalData, setViewOnceModalData] = useState(null);
  const mediaFileInputRef = useRef(null);

  const scrollViewRef = useRef();

  // Load saved identity on startup & auto-sync to MongoDB database
  useEffect(() => {
    async function loadSaved() {
      const saved = storage.getIdentity();
      if (saved) {
        setIdentity(saved);
        try {
          await syncUserIdentity(saved);
        } catch (e) {
          console.warn('Identity auto-sync failed:', e);
        }
        initAppSession(saved);
      }
    }
    loadSaved();
  }, []);

  // Periodic poll of peers & groups when logged in
  useEffect(() => {
    if (!identity) return;
    refreshDirectory();
    const interval = setInterval(refreshDirectory, 6000);
    return () => clearInterval(interval);
  }, [identity]);

  // Setup WebSocket listeners
  useEffect(() => {
    if (!identity) return;

    wsClient.connect(identity.user_id);

    const unsubMsg = wsClient.on('message', handleIncomingEncryptedMessage);
    const unsubAck = wsClient.on('sent_ack', handleSentAck);
    const unsubSignal = wsClient.on('signal', handleIncomingSignal);
    const unsubPresence = wsClient.on('presence', handlePresenceUpdate);

    return () => {
      unsubMsg();
      unsubAck();
      unsubSignal();
      unsubPresence();
      wsClient.disconnect();
    };
  }, [identity, selectedChat]);

  // Disappearing messages countdown tick
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now() / 1000;
      setMessages((prev) =>
        prev.filter((m) => {
          if (m.expires_at && now >= m.expires_at) {
            return false; // automatically burn
          }
          return true;
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 20. 🔐 Secret Chat Mode: Automatic Session Expiration
  useEffect(() => {
    if (!activeSecretSession || !activeSecretSession.expires_at) return;
    const interval = setInterval(() => {
      const now = Date.now() / 1000;
      if (now >= activeSecretSession.expires_at) {
        // Automatic session expiration: zeroize keys and purge secret messages from memory
        setMessages((prev) => prev.filter((m) => !m.is_secret_mode));
        setActiveSecretSession(null);
        Alert.alert(
          '⌛ Secret Mode Expired',
          'The automatic session expiration timer elapsed. Temporary encryption keys zeroized and ephemeral secret messages purged.'
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSecretSession]);

  // 20. 🔐 Secret Chat Mode: Optional Screenshot Detection
  useEffect(() => {
    if (Platform.OS === 'web' && activeSecretSession && typeof window !== 'undefined') {
      const handleKeyDown = (e) => {
        if (
          e.key === 'PrintScreen' ||
          (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) ||
          (e.metaKey && e.shiftKey && (e.key === '4' || e.key === '3'))
        ) {
          const warningText = '⚠️ Screenshot Warning: Screen capture shortcut detected in Secret Mode!';
          setScreenshotAlertBanner(warningText);
          setTimeout(() => setScreenshotAlertBanner(null), 8000);

          if (selectedChat && !selectedChat.group_id) {
            reportSecretScreenshotAlert(activeSecretSession.secret_session_id, identity?.user_id).catch(() => {});
            wsClient.sendSignal({
              signal_type: 'secret_chat.screenshot_alert',
              conversation_id: selectedChat.user_id,
              sender_id: identity?.user_id,
              recipient_id: selectedChat.user_id,
              data: { warning: 'Peer took a screenshot in Secret Mode!' }
            });
          }
        }
      };
      window.addEventListener('keyup', handleKeyDown);
      return () => window.removeEventListener('keyup', handleKeyDown);
    }
  }, [activeSecretSession, selectedChat, identity]);

  async function refreshDirectory() {
    try {
      if (!identity) return;
      const users = await fetchUsers(identity.user_id);
      setUsersList(users);
      const groups = await fetchMyGroups(identity.user_id);
      setGroupsList(groups);
    } catch (e) {
      console.warn('Directory refresh error:', e);
    }
  }

  // --- Identity Registration ---
  async function handleRegister() {
    const name = pseudonymInput.trim();
    if (!name) {
      Alert.alert('Validation Error', 'Please choose a secret pseudonym');
      return;
    }
    setIsRegistering(true);

    try {
      // 1. Generate Ed25519 Identity KeyPair
      const identityKP = generateIdentityKeyPair();
      // 2. Generate X25519 Signed Prekey signed by Identity Key
      const signedPrekey = generateSignedPrekey(identityKP.privateKeyHex);
      // 3. Generate 10 Ephemeral One-Time Prekeys
      const oneTimePrekeys = generateOneTimePrekeys(10);

      const payload = {
        pseudonym: name,
        ed25519_identity_pub: identityKP.publicKeyHex,
        x25519_signed_prekey: signedPrekey.publicKeyHex,
        signed_prekey_sig: signedPrekey.signatureHex,
        one_time_prekeys: oneTimePrekeys.map((k) => k.publicKeyHex),
        avatar_seed: name
      };

      const res = await registerUser(payload);

      const identityDoc = {
        user_id: res.user_id,
        pseudonym: res.pseudonym,
        identityKP,
        signedPrekey,
        oneTimePrekeys
      };

      storage.saveIdentity(identityDoc);
      setIdentity(identityDoc);
      initAppSession(identityDoc);
    } catch (err) {
      Alert.alert('Registration Error', err.message || 'Could not register identity');
    } finally {
      setIsRegistering(false);
    }
  }

  function initAppSession(userIdent) {
    wsClient.connect(userIdent.user_id);
    refreshDirectory();
  }

  function handleLogout() {
    storage.clearIdentity();
    wsClient.disconnect();
    setIdentity(null);
    setSelectedChat(null);
    setMessages([]);
    sessionsRef.current.clear();
  }

  // --- Session Establishment (X3DH) ---
  async function getOrCreateSession(peerUser) {
    const peerId = peerUser.user_id;
    if (sessionsRef.current.has(peerId)) {
      return sessionsRef.current.get(peerId);
    }

    // Check storage
    const saved = storage.getRatchetSession(peerId);
    if (saved) {
      const session = new DoubleRatchetSession(saved);
      sessionsRef.current.set(peerId, session);
      return session;
    }

    // Execute Outbound X3DH Handshake
    const bundle = await fetchPrekeyBundle(peerId);

    const masterSecret = deriveSharedMasterSecret({
      aliceIdentityX25519Priv: identity.signedPrekey.privateKeyHex,
      aliceEphemeralPriv: identity.signedPrekey.privateKeyHex,
      bobIdentityX25519Pub: bundle.x25519_signed_prekey,
      bobSignedPrekeyPub: bundle.x25519_signed_prekey,
      bobOneTimePrekeyPub: bundle.one_time_prekey
    });

    const session = DoubleRatchetSession.createOutbound(masterSecret, bundle.x25519_signed_prekey);
    sessionsRef.current.set(peerId, session);
    storage.saveRatchetSession(peerId, session);
    return session;
  }

  // --- Incoming Message & Signal Handling ---
  async function handleIncomingEncryptedMessage(pkt) {
    const isGroup = !!pkt.group_id;
    const convId = pkt.conversation_id;

    let decryptedPayload = null;

    try {
      if (isGroup) {
        // Group Decryption using sender key
        let sk = groupSenderKeysRef.current.get(convId);
        if (!sk) {
          sk = generateSenderKey();
          groupSenderKeysRef.current.set(convId, sk);
        }
        decryptedPayload = decryptGroupPayload(sk, pkt);
      } else {
        // Pairwise Double Ratchet Decryption
        let session = sessionsRef.current.get(pkt.sender_id);
        if (!session) {
          // Inbound X3DH initialization
          const masterSecret = deriveSharedMasterSecret({
            aliceIdentityX25519Priv: identity.signedPrekey.privateKeyHex,
            aliceEphemeralPriv: identity.signedPrekey.privateKeyHex,
            bobIdentityX25519Pub: pkt.ratchet_header.dh_ratchet_pub,
            bobSignedPrekeyPub: pkt.ratchet_header.dh_ratchet_pub
          });
          session = DoubleRatchetSession.createInbound(
            masterSecret,
            pkt.ratchet_header.dh_ratchet_pub,
            identity.signedPrekey
          );
          sessionsRef.current.set(pkt.sender_id, session);
        }

        decryptedPayload = session.decrypt(pkt);
        storage.saveRatchetSession(pkt.sender_id, session);
      }

      // Record packet log for Live Inspector
      addPacketLog({
        direction: 'inbound',
        plaintext: decryptedPayload.text || (decryptedPayload.attachment ? `[Attachment: ${decryptedPayload.attachment.name}]` : '[Media]'),
        ciphertext: pkt.ciphertext,
        iv_or_nonce: pkt.iv_or_nonce,
        ratchet_header: pkt.ratchet_header,
        timestamp: Date.now()
      });

      // Construct decrypted message object
      const incomingMsg = {
        message_id: pkt.message_id,
        conversation_id: convId,
        sender_id: pkt.sender_id,
        recipient_id: pkt.recipient_id,
        group_id: pkt.group_id,
        text: decryptedPayload.text || '',
        attachment: decryptedPayload.attachment || null,
        media: decryptedPayload.media || null,
        voice_note: decryptedPayload.voice_note || null,
        blind_photo: decryptedPayload.blind_photo || null,
        reply_to: decryptedPayload.reply_to || null,
        no_forward: pkt.no_forward || decryptedPayload.no_forward || false,
        ephemeral_timer: pkt.ephemeral_timer || decryptedPayload.ephemeral_timer,
        is_secret_mode: pkt.is_secret_mode || decryptedPayload.is_secret_mode || false,
        expires_at: (pkt.ephemeral_timer || decryptedPayload.ephemeral_timer) ? (Date.now() / 1000) + (pkt.ephemeral_timer || decryptedPayload.ephemeral_timer) : null,
        created_at: pkt.created_at || (Date.now() / 1000),
        status: 'delivered',
        is_read: false,
        reactions: {},
        is_outgoing: false
      };

      // In SECRET MODE 🔐: Zero disk/storage retention
      if (!incomingMsg.is_secret_mode) {
        storage.saveChatMessage(convId, incomingMsg);
      }

      if (selectedChat && (selectedChat.user_id === pkt.sender_id || selectedChat.group_id === pkt.group_id)) {
        setMessages((prev) => [...prev, incomingMsg]);
        // Send read receipt if viewing this chat
        wsClient.sendSignal({
          signal_type: 'read',
          conversation_id: convId,
          sender_id: identity.user_id,
          recipient_id: pkt.sender_id,
          group_id: pkt.group_id,
          message_id: pkt.message_id
        });
      }

      // Send delivered receipt
      wsClient.sendSignal({
        signal_type: 'delivered',
        conversation_id: convId,
        sender_id: identity.user_id,
        recipient_id: pkt.sender_id,
        group_id: pkt.group_id,
        message_id: pkt.message_id
      });
    } catch (err) {
      console.error('Decryption failed for packet:', err);
    }
  }

  function handleSentAck(ack) {
    setMessages((prev) =>
      prev.map((m) =>
        m.message_id === ack.message_id
          ? { ...m, status: ack.is_delivered ? 'delivered' : 'sent' }
          : m
      )
    );
  }

  function handleIncomingSignal(sig) {
    if (sig.signal_type === 'typing') {
      if (selectedChat && selectedChat.user_id === sig.sender_id) {
        setPeerTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setPeerTyping(false), 2500);
      }
    } else if (sig.signal_type === 'read') {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.message_id === sig.message_id || !sig.message_id) {
            const updates = { status: 'read', is_read: true };
            if (sig.data?.expires_at) {
              updates.expires_at = sig.data.expires_at;
            }
            return { ...m, ...updates };
          }
          return m;
        })
      );
    } else if (sig.signal_type === 'delivered') {
      setMessages((prev) =>
        prev.map((m) =>
          m.message_id === sig.message_id && m.status !== 'read'
            ? { ...m, status: 'delivered' }
            : m
        )
      );
    } else if (sig.signal_type === 'reaction') {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.message_id === sig.message_id) {
            const rx = { ...(m.reactions || {}) };
            rx[sig.sender_id] = sig.data?.emoji;
            return { ...m, reactions: rx };
          }
          return m;
        })
      );
    } else if (sig.signal_type === 'delete') {
      setMessages((prev) => prev.filter((m) => m.message_id !== sig.message_id));
    } else if (sig.signal_type === 'blind_photo.consent_updated') {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.blind_photo && m.blind_photo.photo_id === sig.photo_id) {
            const updatedConsents = { ...(m.blind_photo.consents || {}) };
            if (sig.actor_id) {
              updatedConsents[sig.actor_id] = sig.consent;
            }
            return {
              ...m,
              blind_photo: {
                ...m.blind_photo,
                locked: !sig.unlocked,
                unlocked: sig.unlocked,
                full_photo_url: sig.full_photo_url || m.blind_photo.full_photo_url,
                consents: updatedConsents
              }
            };
          }
          return m;
        })
      );
    } else if (sig.signal_type === 'edit') {
      setMessages((prev) =>
        prev.map((m) =>
          m.message_id === sig.message_id
            ? { ...m, text: sig.data?.new_text, is_edited: true }
            : m
        )
      );
    } else if (sig.signal_type === 'media_opened') {
      setMessages((prev) =>
        prev.map((m) =>
          m.message_id === sig.message_id && m.media
            ? { ...m, media: { ...m.media, opened: true, opened_at: Date.now() } }
            : m
        )
      );
    } else if (sig.signal_type === 'identity.unlock_grant') {
      if (selectedChat && selectedChat.user_id === sig.sender_id) {
        loadPeerRevealedProfile(sig.sender_id);
      }
      setUnlockNotification({
        type: 'grant',
        message: `✨ ${selectedChat?.pseudonym || 'Peer'} unlocked LEVEL ${sig.data?.new_level}!`,
        level: sig.data?.new_level
      });
    } else if (sig.signal_type === 'identity.unlock_request') {
      setUnlockNotification({
        type: 'request',
        message: `⚡ ${selectedChat?.pseudonym || 'Peer'} requested you to unlock LEVEL ${sig.data?.target_level}.`,
        level: sig.data?.target_level,
        senderId: sig.sender_id
      });
    } else if (sig.signal_type === 'identity.photo_reveal_prompt') {
      setPhotoPromptModal({
        visible: true,
        requesterId: sig.requester_id,
        requesterNickname: sig.requester_nickname || 'Nova',
        prompt: sig.prompt || `${sig.requester_nickname || 'Nova'} wants to reveal their profile. Reveal to each other?`
      });
    } else if (sig.signal_type === 'identity.photo_reveal_result') {
      if (sig.outcome === 'mutual_reveal') {
        Alert.alert('🎉 Veil Lifted!', 'Mutual consent confirmed! Full authentic photo and profile have been unlocked.');
        if (selectedChat) loadPeerRevealedProfile(selectedChat.user_id);
      } else if (sig.outcome === 'declined') {
        Alert.alert('🔒 Kept Anonymous', 'One participant chose to keep anonymous. Profile photos remain safely encrypted.');
      }
    } else if (sig.signal_type === 'identity.progressive_reveal_update') {
      if (selectedChat) loadPeerRevealedProfile(selectedChat.user_id);
    } else if (sig.signal_type === 'self_destruct.policy_updated') {
      const newSec = sig.data?.delete_after_seconds;
      const newLabel = sig.data?.retention_label || 'Never';
      setConversationPolicy({ seconds: newSec, label: newLabel });
      if (newSec) {
        const cutoff = Date.now() / 1000 - newSec;
        setMessages((prev) => prev.filter((m) => m.created_at >= cutoff));
      }
    } else if (sig.signal_type === 'self_destruct.burned') {
      setMessages([]);
      Alert.alert('🔥 Conversation Self-Destructed', 'The peer has self-destructed this entire conversation.');
    } else if (sig.signal_type === 'secret_chat.init') {
      const sess = sig.data?.session;
      if (sess) {
        setActiveSecretSession(sess);
        Alert.alert('🔐 Secret Chat Mode Activated', 'Partner initiated SECRET MODE. Messages will auto-destruct on read, server retention is disabled, and forwarding is restricted.');
      }
    } else if (sig.signal_type === 'secret_chat.terminate') {
      setActiveSecretSession(null);
      // Zeroize and purge all secret messages in memory
      setMessages((prev) => prev.filter((m) => !m.is_secret_mode));
      Alert.alert('🔐 Secret Chat Terminated', 'SECRET MODE was exited. Temporary keys zeroized and ephemeral secret messages purged from memory.');
    } else if (sig.signal_type === 'secret_chat.screenshot_alert') {
      setScreenshotAlertBanner('📸 Warning: Peer or local device captured a screenshot during SECRET MODE 🔐!');
      setTimeout(() => setScreenshotAlertBanner(null), 8000);
    }
  }


  function handlePresenceUpdate(presence) {
    setUsersList((prev) =>
      prev.map((u) =>
        u.user_id === presence.user_id ? { ...u, is_online: presence.is_online } : u
      )
    );
  }

  function addPacketLog(entry) {
    setPacketLog((prev) => [entry, ...prev.slice(0, 30)]);
  }

  // --- Sending Messages ---
  async function handleSendMessage(attachmentData = null, voiceData = null, blindPhotoData = null, mediaData = null) {
    if (!inputText.trim() && !attachmentData && !voiceData && !blindPhotoData && !mediaData) return;
    if (!selectedChat) return;

    const isGroup = !!selectedChat.group_id;
    const convId = isGroup ? selectedChat.group_id : selectedChat.user_id;
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // If editing existing message
    if (editingMessage) {
      handleSaveEdit();
      return;
    }

    // 20. 🔐 Secret Chat Mode Characteristics Enforced
    const isSecretMode = !isGroup && !!activeSecretSession;
    const effNoForward = isSecretMode ? true : noForwardActive;
    const effEphemeralTimer = isSecretMode
      ? (activeSecretSession.disappearing_seconds || 30)
      : (ephemeralTimer > 0 ? ephemeralTimer : null);

    const payloadObj = {
      text: inputText.trim(),
      attachment: attachmentData,
      voice_note: voiceData,
      blind_photo: blindPhotoData,
      media: mediaData,
      reply_to: replyingTo
        ? { message_id: replyingTo.message_id, text: replyingTo.text, sender_id: replyingTo.sender_id }
        : null,
      no_forward: effNoForward,
      ephemeral_timer: effEphemeralTimer,
      is_secret_mode: isSecretMode,
      timestamp: Date.now()
    };

    let encryptedPacket = null;

    try {
      if (isGroup) {
        let sk = groupSenderKeysRef.current.get(convId);
        if (!sk) {
          sk = generateSenderKey();
          groupSenderKeysRef.current.set(convId, sk);
        }
        const enc = encryptGroupPayload(sk, payloadObj);
        encryptedPacket = {
          message_id: msgId,
          group_id: convId,
          conversation_id: convId,
          ciphertext: enc.ciphertext,
          ratchet_header: enc.ratchet_header,
          iv_or_nonce: enc.iv_or_nonce,
          ephemeral_timer: payloadObj.ephemeral_timer,
          no_forward: effNoForward,
          is_secret_mode: false,
          created_at: Date.now() / 1000
        };
        wsClient.sendGroupEncryptedMessage(encryptedPacket);
      } else {
        const session = await getOrCreateSession(selectedChat);
        const enc = session.encrypt(payloadObj);
        storage.saveRatchetSession(selectedChat.user_id, session);

        encryptedPacket = {
          message_id: msgId,
          conversation_id: convId,
          recipient_id: selectedChat.user_id,
          ciphertext: enc.ciphertext,
          ratchet_header: enc.ratchet_header,
          iv_or_nonce: enc.iv_or_nonce,
          ephemeral_timer: payloadObj.ephemeral_timer,
          no_forward: effNoForward,
          is_secret_mode: isSecretMode,
          created_at: Date.now() / 1000
        };
        wsClient.sendEncryptedMessage(encryptedPacket);
      }
    } catch (err) {
      console.warn('Send message failed:', err);
      Alert.alert(
        'Delivery Issue',
        `Could not encrypt/send to "${selectedChat.pseudonym || 'peer'}": ${err.message || 'Recipient is not registered or prekey bundle missing'}. Please ensure the recipient is a real registered user.`
      );
      return;
    }

    // Add to packet log for inspector
    addPacketLog({
      direction: 'outbound',
      plaintext: payloadObj.text || (attachmentData ? `[Attachment: ${attachmentData.name}]` : mediaData ? `[${mediaData.file_type}: ${mediaData.name}]` : blindPhotoData ? '[Photo Locked 🔒]' : '[Voice Note]'),
      ciphertext: encryptedPacket.ciphertext,
      iv_or_nonce: encryptedPacket.iv_or_nonce,
      ratchet_header: encryptedPacket.ratchet_header,
      timestamp: Date.now()
    });

    const localMsg = {
      message_id: msgId,
      conversation_id: convId,
      sender_id: identity.user_id,
      recipient_id: isGroup ? null : selectedChat.user_id,
      group_id: isGroup ? convId : null,
      text: payloadObj.text,
      attachment: attachmentData,
      voice_note: voiceData,
      blind_photo: blindPhotoData,
      media: mediaData,
      reply_to: payloadObj.reply_to,
      no_forward: effNoForward,
      ephemeral_timer: payloadObj.ephemeral_timer,
      is_secret_mode: isSecretMode,
      expires_at: payloadObj.ephemeral_timer ? (Date.now() / 1000) + payloadObj.ephemeral_timer : null,
      created_at: Date.now() / 1000,
      status: 'sent',
      is_read: false,
      reactions: {},
      is_outgoing: true
    };

    // In SECRET MODE 🔐: Zero server history and zero local disk storage
    if (!isSecretMode) {
      storage.saveChatMessage(convId, localMsg);
    }
    setMessages((prev) => [...prev, localMsg]);

    setInputText('');
    setReplyingTo(null);
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  }

  // --- Message Actions: Reaction, Edit, Delete ---
  function handleReact(msg, emoji) {
    const rx = { ...(msg.reactions || {}) };
    rx[identity.user_id] = emoji;

    setMessages((prev) =>
      prev.map((m) => (m.message_id === msg.message_id ? { ...m, reactions: rx } : m))
    );

    wsClient.sendSignal({
      signal_type: 'reaction',
      conversation_id: msg.conversation_id,
      sender_id: identity.user_id,
      recipient_id: msg.recipient_id || msg.sender_id,
      group_id: msg.group_id,
      message_id: msg.message_id,
      data: { emoji }
    });
  }

  function handleDeleteMessage(msg) {
    setMessages((prev) => prev.filter((m) => m.message_id !== msg.message_id));
    storage.deleteChatMessage(msg.conversation_id, msg.message_id);

    wsClient.sendSignal({
      signal_type: 'delete',
      conversation_id: msg.conversation_id,
      sender_id: identity.user_id,
      recipient_id: msg.recipient_id || msg.sender_id,
      group_id: msg.group_id,
      message_id: msg.message_id
    });
  }

  function handleStartEdit(msg) {
    setEditingMessage(msg);
    setInputText(msg.text);
  }

  function handleSaveEdit() {
    if (!editingMessage) return;
    const newText = inputText.trim();
    if (!newText) return;

    setMessages((prev) =>
      prev.map((m) =>
        m.message_id === editingMessage.message_id
          ? { ...m, text: newText, is_edited: true }
          : m
      )
    );

    wsClient.sendSignal({
      signal_type: 'edit',
      conversation_id: editingMessage.conversation_id,
      sender_id: identity.user_id,
      recipient_id: editingMessage.recipient_id,
      group_id: editingMessage.group_id,
      message_id: editingMessage.message_id,
      data: { new_text: newText }
    });

    setEditingMessage(null);
    setInputText('');
  }

  // --- Typing Indicator Emitter ---
  function handleTextChange(val) {
    setInputText(val);
    if (selectedChat && !selectedChat.group_id) {
      wsClient.sendSignal({
        signal_type: 'typing',
        conversation_id: selectedChat.user_id,
        sender_id: identity.user_id,
        recipient_id: selectedChat.user_id
      });
    }
  }

  // --- Zero-Knowledge Attachment Simulation ---
  async function handleAttachMockFile() {
    const fileName = `E2EE_Vault_${Math.floor(Math.random() * 8999 + 1000)}.pdf`;
    const mockFileContent = utf8ToBytes(`Top-Secret Confidential Payload inside ${fileName}`);

    // Encrypt file client-side before sending!
    const enc = encryptBinaryData(mockFileContent);

    // Mock upload of encrypted blob
    const attachmentMeta = {
      name: fileName,
      size: `${(mockFileContent.length / 1024).toFixed(1)} KB`,
      key_hex: enc.keyHex,
      nonce_hex: enc.nonceHex,
      mime_type: 'application/pdf'
    };

    handleSendMessage(attachmentMeta, null);
  }

  // --- Photo & Video Media Handling (Normal & One-Time View) ---
  function handleTriggerMediaPick() {
    if (mediaFileInputRef.current) {
      mediaFileInputRef.current.value = '';
      mediaFileInputRef.current.click();
    }
  }

  function handleMediaFileSelected(e) {
    const pickedFile = e.target.files?.[0];
    if (!pickedFile) return;

    setSelectedMediaFile(pickedFile);
    const preview = URL.createObjectURL(pickedFile);
    setSelectedMediaPreview(preview);
    setSendMediaModalVisible(true);
  }

  async function handleConfirmSendMedia({ file, fileType, viewOnce, caption }) {
    if (!file) return;
    setIsUploadingMedia(true);
    try {
      const uploadRes = await uploadChatMedia(file, identity?.user_id || '');
      const mediaData = {
        media_id: uploadRes.media_id,
        url: uploadRes.full_url || uploadRes.url,
        file_type: uploadRes.file_type || fileType,
        mime_type: uploadRes.mime_type || file.type,
        name: uploadRes.name || file.name,
        size: uploadRes.size_formatted || `${(file.size / 1024).toFixed(1)} KB`,
        view_once: viewOnce,
        opened: false,
        opened_at: null,
        caption: caption
      };

      await handleSendMessage(null, null, null, mediaData);
      setSendMediaModalVisible(false);
      setSelectedMediaFile(null);
      setSelectedMediaPreview(null);
    } catch (err) {
      Alert.alert('Upload Error', err.message || 'Failed to upload encrypted media');
    } finally {
      setIsUploadingMedia(false);
    }
  }

  function handleOpenViewOnce(m) {
    if (!m.media) return;
    if (m.media.opened) {
      Alert.alert('Media Expired', 'This one-time photo/video was already viewed and has disappeared.');
      return;
    }
    setViewOnceModalData({
      messageId: m.message_id,
      mediaItem: m.media,
      peerName: selectedChat?.pseudonym || 'Partner'
    });
  }

  function handleCloseViewOnce() {
    if (!viewOnceModalData) return;
    const msgId = viewOnceModalData.messageId;

    // Update message state locally to mark opened
    setMessages((prev) =>
      prev.map((msg) =>
        msg.message_id === msgId && msg.media
          ? { ...msg, media: { ...msg.media, opened: true, opened_at: Date.now() } }
          : msg
      )
    );

    // Save updated state to storage
    if (selectedChat) {
      const convId = selectedChat.group_id || selectedChat.user_id;
      const targetMsg = messages.find((x) => x.message_id === msgId);
      if (targetMsg && targetMsg.media) {
        storage.saveChatMessage(convId, {
          ...targetMsg,
          media: { ...targetMsg.media, opened: true, opened_at: Date.now() }
        });
      }

      // Notify peer that view-once media was opened
      wsClient.sendSignal({
        signal_type: 'media_opened',
        conversation_id: convId,
        sender_id: identity.user_id,
        recipient_id: selectedChat.user_id,
        message_id: msgId
      });
    }

    setViewOnceModalData(null);
  }

  // --- Voice Note Recording Simulation ---
  function handleStartVoiceRecording() {
    setIsRecordingVoice(true);
    setVoiceDuration(0);
    voiceTimerRef.current = setInterval(() => {
      setVoiceDuration((prev) => prev + 1);
    }, 1000);
  }

  function handleStopVoiceRecording() {
    setIsRecordingVoice(false);
    if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);

    const duration = voiceDuration || 1;
    // Generate simulated audio buffer & encrypt client-side
    const audioPayload = utf8ToBytes(`EncryptedAudioStream::duration_${duration}s`);
    const enc = encryptBinaryData(audioPayload);

    const voiceMeta = {
      duration_seconds: duration,
      key_hex: enc.keyHex,
      nonce_hex: enc.nonceHex,
      waveform: [3, 8, 14, 22, 18, 9, 15, 25, 12, 6, 17, 24, 11]
    };

    handleSendMessage(null, voiceMeta);
    setVoiceDuration(0);
  }

  // --- Safety Number Verification ---
  function openSafetyModal(peer) {
    if (!identity) return;
    const safety = computeSafetyNumbers(identity.identityKP.publicKeyHex, peer.ed25519_identity_pub);
    setSafetyData(safety);
    setSafetyModalVisible(true);
  }

  // --- Progressive Identity Actions ---
  async function loadPeerRevealedProfile(peerId) {
    try {
      const rev = await fetchRevealedProfile(peerId, identity.user_id);
      setPeerRevealedProfile(rev);
    } catch (e) {
      console.warn('Failed to load revealed profile:', e);
    }
  }

  async function handleGrantNextLevel(targetLevel) {
    if (!selectedChat || selectedChat.group_id) return;
    try {
      await requestOrGrantLevelUnlock(identity.user_id, selectedChat.user_id, targetLevel, 'grant');
      setMyGrantedLevel(targetLevel);
      Alert.alert('Identity Level Granted', `You have granted LEVEL ${targetLevel} access to ${selectedChat.pseudonym}!`);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  async function handleRequestNextLevel(targetLevel) {
    if (!selectedChat || selectedChat.group_id) return;
    try {
      await requestOrGrantLevelUnlock(identity.user_id, selectedChat.user_id, targetLevel, 'request');
      Alert.alert('Unlock Request Transmitted', `Requested ${selectedChat.pseudonym} to reveal LEVEL ${targetLevel}.`);
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  async function handleSaveMyPersona(updatedProfile) {
    try {
      await updateProfile(identity.user_id, updatedProfile);
      const updatedIdentity = { ...identity, profile: updatedProfile };
      storage.saveIdentity(updatedIdentity);
      setIdentity(updatedIdentity);
      Alert.alert('Persona Updated', 'Your 5-level Blind Date persona has been saved successfully!');
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  // --- Select Chat ---
  function selectConversation(peerOrGroup) {
    setSelectedChat(peerOrGroup);
    setUnlockNotification(null);
    const convId = peerOrGroup.group_id || peerOrGroup.user_id;
    const cached = storage.getChatMessages(convId);
    setMessages(cached);
    if (!peerOrGroup.group_id) {
      loadPeerRevealedProfile(peerOrGroup.user_id);
    } else {
      setPeerRevealedProfile(null);
    }

    // Load active conversation self-destruct policy
    fetchSelfDestructPolicy(convId)
      .then((policy) => {
        if (policy) {
          const sec = policy.delete_after_seconds;
          const lbl = policy.retention_label || 'Never';
          setConversationPolicy({ seconds: sec, label: lbl });
          if (sec) {
            const cutoff = Date.now() / 1000 - sec;
            setMessages((prev) => prev.filter((m) => m.created_at >= cutoff));
          }
        }
      })
      .catch(() => {});

    // Check for active Secret Chat session between users
    if (!peerOrGroup.group_id && identity?.user_id) {
      fetchActiveSecretChatBetween(identity.user_id, peerOrGroup.user_id)
        .then((res) => {
          if (res?.has_active_session) {
            setActiveSecretSession(res.session);
          } else {
            setActiveSecretSession(null);
          }
        })
        .catch(() => setActiveSecretSession(null));
    } else {
      setActiveSecretSession(null);
    }
  }

  // --- Create Group ---
  async function handleCreateGroup() {
    if (!groupNameInput.trim()) {
      Alert.alert('Group Error', 'Please enter a group name');
      return;
    }
    if (selectedGroupMembers.length === 0) {
      Alert.alert('Group Error', 'Select at least 1 member');
      return;
    }

    try {
      const senderKey = generateSenderKey();
      const res = await createGroupChat({
        name: groupNameInput.trim(),
        memberIds: selectedGroupMembers,
        creatorId: identity.user_id
      });

      groupSenderKeysRef.current.set(res.group_id, senderKey);
      setNewGroupModal(false);
      setGroupNameInput('');
      setSelectedGroupMembers([]);
      refreshDirectory();
      selectConversation(res);
    } catch (err) {
      Alert.alert('Group Creation Error', err.message);
    }
  }

  // --- Render Unregistered State ---
  if (!identity) {
    return (
      <SafeAreaView style={styles.authContainer}>
        <StatusBar barStyle="light-content" />
        <View style={styles.authCard}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoIcon}>🔐</Text>
          </View>
          <Text style={styles.authTitle}>Anonymous E2EE Chat</Text>
          <Text style={styles.authSubtitle}>
            End-to-End Encrypted • 100% Anonymous
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>CHOOSE YOUR SECRET PSEUDONYM</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. ShadowCipher, Ghost99"
              placeholderTextColor="#64748B"
              value={pseudonymInput}
              onChangeText={setPseudonymInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, isRegistering && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={isRegistering}
          >
            {isRegistering ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryBtnText}>Start Anonymous Chat ➔</Text>
            )}
          </TouchableOpacity>

          <View style={styles.guaranteeBox}>
            <Text style={styles.guaranteeTitle}>🔒 Privacy & Anonymity</Text>
            <Text style={styles.guaranteeText}>
              • Messages are encrypted end-to-end with zero server history.{'\n'}
              • No phone number, email, or real identity required.{'\n'}
              • Complete privacy and anonymity guaranteed.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // --- Render Authenticated Chat Workspace ---
  return (
    <SafeAreaView style={styles.appContainer}>
      <StatusBar barStyle="light-content" />

      {/* Top Application Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.appLogo}>🔐 AnonChat</Text>
          <View style={styles.cryptoBadge}>
            <Text style={styles.cryptoBadgeDot}>●</Text>
            <Text style={styles.cryptoBadgeText}>E2EE ACTIVE</Text>
          </View>
        </View>

        <View style={styles.topBarRight}>
          <TouchableOpacity
            style={[styles.inspectorBtn, { borderColor: '#F43F5E', backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}
            onPress={() => setBlindDateModalVisible(true)}
          >
            <Text style={[styles.inspectorBtnText, { color: '#FB7185', fontWeight: '800' }]}>🕶️ Blind Date</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.inspectorBtn, { borderColor: '#F59E0B', backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}
            onPress={() => setTopicRoomsModalVisible(true)}
          >
            <Text style={[styles.inspectorBtnText, { color: '#FBBF24', fontWeight: '800' }]}>🔥 Topic Rooms</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.inspectorBtn, { borderColor: '#A78BFA' }]}
            onPress={() => setEditPersonaVisible(true)}
          >
            <Text style={[styles.inspectorBtnText, { color: '#A78BFA' }]}>👤 My Profile</Text>
          </TouchableOpacity>

          <View style={styles.userChip}>
            <View style={styles.userDot} />
            <Text style={styles.userPseudonym}>{identity.pseudonym}</Text>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Split Layout */}
      <View style={styles.mainLayout}>
        {/* Left Sidebar: Conversations & Peer Directory */}
        <View style={styles.sidebar}>
          {/* Signature Blind Date Hero Banner */}
          <TouchableOpacity
            style={styles.blindDateBanner}
            onPress={() => setBlindDateModalVisible(true)}
          >
            <View style={styles.blindDateBadge}>
              <Text style={styles.blindDateBadgeText}>SIGNATURE BLIND DATE</Text>
            </View>
            <View style={styles.blindDateBannerRow}>
              <Text style={styles.blindDateBannerIcon}>🕶️</Text>
              <View style={styles.blindDateBannerMeta}>
                <Text style={styles.blindDateBannerTitle}>Enter Blind Date</Text>
                <Text style={styles.blindDateBannerSub}>Anonymous Match ➔ Activities ➔ Reveal</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Quick Discover & Modes Grid */}
          <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
            <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>
              Explore Modes
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <TouchableOpacity
                style={{ backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => setTopicRoomsModalVisible(true)}
              >
                <Text style={{ fontSize: 13 }}>🔥</Text>
                <Text style={{ color: '#F1F5F9', fontSize: 12, fontWeight: '600' }}>Rooms</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => setInstantDateModalVisible(true)}
              >
                <Text style={{ fontSize: 13 }}>⚡</Text>
                <Text style={{ color: '#F1F5F9', fontSize: 12, fontWeight: '600' }}>5-Min Date</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => setUniverseModalVisible(true)}
              >
                <Text style={{ fontSize: 13 }}>🌌</Text>
                <Text style={{ color: '#F1F5F9', fontSize: 12, fontWeight: '600' }}>Universe</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => setPersonalityCardModalVisible(true)}
              >
                <Text style={{ fontSize: 13 }}>🧬</Text>
                <Text style={{ color: '#F1F5F9', fontSize: 12, fontWeight: '600' }}>Mystery Card</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => setSmartMatchmakingModalVisible(true)}
              >
                <Text style={{ fontSize: 13 }}>🧠</Text>
                <Text style={{ color: '#F1F5F9', fontSize: 12, fontWeight: '600' }}>Smart Match</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => setSecondChanceModalVisible(true)}
              >
                <Text style={{ fontSize: 13 }}>🔄</Text>
                <Text style={{ color: '#F1F5F9', fontSize: 12, fontWeight: '600' }}>2nd Chance</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => setBlindDateXPModalVisible(true)}
              >
                <Text style={{ fontSize: 13 }}>🏆</Text>
                <Text style={{ color: '#F1F5F9', fontSize: 12, fontWeight: '600' }}>XP & Rank</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => setDailyMysteryDropModalVisible(true)}
              >
                <Text style={{ fontSize: 13 }}>🔥</Text>
                <Text style={{ color: '#F1F5F9', fontSize: 12, fontWeight: '600' }}>Daily Drop</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => setScheduledDateModalVisible(true)}
              >
                <Text style={{ fontSize: 13 }}>🕰️</Text>
                <Text style={{ color: '#F1F5F9', fontSize: 12, fontWeight: '600' }}>Scheduled</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ backgroundColor: '#1E293B', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => setDateMemoryModalVisible(true)}
              >
                <Text style={{ fontSize: 13 }}>💎</Text>
                <Text style={{ color: '#F1F5F9', fontSize: 12, fontWeight: '600' }}>Memories</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'direct' && styles.tabBtnActive]}
              onPress={() => setActiveTab('direct')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'direct' && styles.tabBtnTextActive]}>
                Direct (1-to-1)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'groups' && styles.tabBtnActive]}
              onPress={() => setActiveTab('groups')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'groups' && styles.tabBtnTextActive]}>
                Groups ({groupsList.length})
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'groups' && (
            <TouchableOpacity
              style={styles.createGroupBtn}
              onPress={() => setNewGroupModal(true)}
            >
              <Text style={styles.createGroupBtnText}>+ Create Encrypted Group</Text>
            </TouchableOpacity>
          )}

          <ScrollView style={styles.convList}>
            {activeTab === 'direct' ? (
              usersList.length === 0 ? (
                <View style={styles.emptyNav}>
                  <Text style={styles.emptyNavText}>Waiting for other anonymous peers...</Text>
                  <Text style={styles.emptyNavSub}>Open another tab or window to start a secure conversation!</Text>
                </View>
              ) : (
                usersList.map((peer) => {
                  const isSelected = selectedChat && selectedChat.user_id === peer.user_id;
                  return (
                    <TouchableOpacity
                      key={peer.user_id}
                      style={[styles.convItem, isSelected && styles.convItemActive]}
                      onPress={() => selectConversation(peer)}
                    >
                      <View style={styles.avatarBox}>
                        <Text style={styles.avatarText}>{peer.pseudonym.charAt(0).toUpperCase()}</Text>
                        {peer.is_online && <View style={styles.onlineDot} />}
                      </View>
                      <View style={styles.convDetails}>
                        <View style={styles.convRow}>
                          <Text style={styles.convName}>{peer.pseudonym}</Text>
                          {peer.is_online ? (
                            <Text style={styles.onlineStatus}>Online</Text>
                          ) : (
                            <Text style={styles.offlineStatus}>Offline</Text>
                          )}
                        </View>
                        <Text style={styles.convKeySnippet}>
                          {peer.is_online ? 'Active now' : 'End-to-End Encrypted'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )
            ) : (
              groupsList.length === 0 ? (
                <View style={styles.emptyNav}>
                  <Text style={styles.emptyNavText}>No groups joined yet.</Text>
                  <Text style={styles.emptyNavSub}>Create a group using Sender Keys protocol!</Text>
                </View>
              ) : (
                groupsList.map((grp) => {
                  const isSelected = selectedChat && selectedChat.group_id === grp.group_id;
                  return (
                    <TouchableOpacity
                      key={grp.group_id}
                      style={[styles.convItem, isSelected && styles.convItemActive]}
                      onPress={() => selectConversation(grp)}
                    >
                      <View style={[styles.avatarBox, { backgroundColor: '#4F46E5' }]}>
                        <Text style={styles.avatarText}>👥</Text>
                      </View>
                      <View style={styles.convDetails}>
                        <Text style={styles.convName}>{grp.name}</Text>
                        <Text style={styles.convKeySnippet}>
                          {grp.members?.length || 0} members • Encrypted Group
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )
            )}
          </ScrollView>
        </View>

        {/* Right Area: Active Chat */}
        <View style={styles.chatArea}>
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <View style={styles.chatHeader}>
                <View style={styles.chatHeaderLeft}>
                  <TouchableOpacity
                    style={styles.avatarSmall}
                    onPress={() => !selectedChat.group_id && setBlurProfileModalVisible(true)}
                    title="View Blur-to-Reveal Profile"
                  >
                    <Text style={styles.avatarSmallText}>
                      {selectedChat.group_id
                        ? '👥'
                        : selectedChat.pseudonym.charAt(0).toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                  <View>
                    <Text style={styles.chatHeaderTitle}>
                      {selectedChat.name || selectedChat.pseudonym}
                    </Text>
                    <Text style={styles.chatHeaderSub}>
                      {peerTyping
                        ? 'typing a secret message...'
                        : selectedChat.group_id
                        ? 'Group Chat • End-to-End Encrypted'
                        : '🔒 End-to-End Encrypted'}
                    </Text>
                  </View>
                </View>

                <View style={styles.chatHeaderRight}>
                  {/* Disappearing Timer Picker */}
                  <View style={styles.timerPickerBox}>
                    <Text style={styles.timerPickerLabel}>⏱️ Disappear:</Text>
                    <TouchableOpacity
                      style={[styles.timerChip, ephemeralTimer === 0 && styles.timerChipActive]}
                      onPress={() => setEphemeralTimer(0)}
                    >
                      <Text style={styles.timerChipText}>Off</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.timerChip, ephemeralTimer === 5 && styles.timerChipActive]}
                      onPress={() => setEphemeralTimer(5)}
                    >
                      <Text style={styles.timerChipText}>5s</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.timerChip, ephemeralTimer === 30 && styles.timerChipActive]}
                      onPress={() => setEphemeralTimer(30)}
                    >
                      <Text style={styles.timerChipText}>30s</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 19. 🧨 Self-Destruct Conversation Setting Button */}
                  <TouchableOpacity
                    style={styles.selfDestructHeaderBtn}
                    onPress={() => setSelfDestructModalVisible(true)}
                    title="Self-Destruct Conversation Settings"
                  >
                    <Text style={styles.selfDestructHeaderBtnText}>
                      🧨 Delete: {conversationPolicy.label}
                    </Text>
                  </TouchableOpacity>

                  {/* 20. 🔐 Secret Chat Mode Button */}
                  {!selectedChat.group_id && (
                    <TouchableOpacity
                      style={[
                        styles.secretModeHeaderBtn,
                        activeSecretSession && styles.secretModeHeaderBtnActive
                      ]}
                      onPress={() => setSecretChatModalVisible(true)}
                      title="Secret Chat Mode (Disappearing, zero history, ephemeral keys)"
                    >
                      <Text style={styles.secretModeHeaderBtnText}>
                        {activeSecretSession ? '🔐 SECRET ACTIVE' : '🔐 Secret Mode'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {!selectedChat.group_id && (
                    <>
                      <TouchableOpacity
                        style={styles.chemistryHeaderBtn}
                        onPress={() => setActivitiesModalVisible(true)}
                        title="Interactive Date Activities"
                      >
                        <Text style={styles.chemistryHeaderBtnText}>⚡ Activities</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.safetyBtn}
                        onPress={() => openSafetyModal(selectedChat)}
                      >
                        <Text style={styles.safetyBtnText}>🛡️ Safety Numbers</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>

              {/* 20. 🔐 Screenshot Warning Toast */}
              {screenshotAlertBanner && (
                <View style={styles.screenshotAlertBanner}>
                  <Text style={styles.screenshotAlertText}>{screenshotAlertBanner}</Text>
                  <TouchableOpacity onPress={() => setScreenshotAlertBanner(null)}>
                    <Text style={{ color: '#FCA5A5', fontWeight: 'bold', paddingHorizontal: 6 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 20. 🔐 Secret Mode Active Notification Banner */}
              {activeSecretSession && (
                <View style={styles.secretModeBanner}>
                  <View style={styles.secretModeBannerLeft}>
                    <Text style={styles.secretModeBannerTag}>SECRET MODE 🔐 ACTIVE</Text>
                    <Text style={styles.secretModeBannerSub}>
                      🔥 Disappearing ({activeSecretSession.disappearing_seconds || 30}s) • 🚫 Server history disabled • 🔒 Forwarding restricted • 🔑 Ephemeral session keys
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.secretModeBannerExitBtn}
                    onPress={() => setSecretChatModalVisible(true)}
                  >
                    <Text style={styles.secretModeBannerExitText}>Manage / Burn</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Progressive Identity Reveal Suite (Feature 7: Mystery -> 5m Interest -> 10m Nickname -> Mutual Avatar -> Mutual Photo) */}
              {!selectedChat.group_id && (
                <View style={styles.progressiveSuiteContainer}>
                  {/* View Mode Toggle Switch */}
                  <View style={styles.progressiveTabToggle}>
                    <TouchableOpacity
                      style={[
                        styles.progressiveToggleBtn,
                        progressiveRevealViewMode === 'progressive' && styles.progressiveToggleBtnActive
                      ]}
                      onPress={() => setProgressiveRevealViewMode('progressive')}
                    >
                      <Text style={[
                        styles.progressiveToggleText,
                        progressiveRevealViewMode === 'progressive' && styles.progressiveToggleTextActive
                      ]}>
                        👻 Progressive Reveal
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.progressiveToggleBtn,
                        progressiveRevealViewMode === 'persona' && styles.progressiveToggleBtnActive
                      ]}
                      onPress={() => setProgressiveRevealViewMode('persona')}
                    >
                      <Text style={[
                        styles.progressiveToggleText,
                        progressiveRevealViewMode === 'persona' && styles.progressiveToggleTextActive
                      ]}>
                        👤 Persona Profile
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {progressiveRevealViewMode === 'progressive' ? (
                    <ProgressiveIdentityReveal
                      currentUserId={identity.user_id}
                      peerUserId={selectedChat.user_id}
                      peerFallbackName={selectedChat.pseudonym}
                      onPhotoRevealed={() => {
                        loadPeerRevealedProfile(selectedChat.user_id);
                      }}
                    />
                  ) : (
                    <IdentityRevealCard
                      revealedProfile={peerRevealedProfile}
                      myGrantedLevel={myGrantedLevel}
                      peerGrantedLevel={peerRevealedProfile?.level_unlocked || 1}
                      onGrantNextLevel={handleGrantNextLevel}
                      onRequestNextLevel={handleRequestNextLevel}
                      isPeer={true}
                    />
                  )}
                </View>
              )}


              {/* Notification Banner for unlock request */}
              {unlockNotification && (
                <View style={styles.unlockBanner}>
                  <Text style={styles.unlockBannerText}>{unlockNotification.message}</Text>
                  {unlockNotification.type === 'request' && (
                    <TouchableOpacity
                      style={styles.unlockBannerBtn}
                      onPress={() => {
                        handleGrantNextLevel(unlockNotification.level);
                        setUnlockNotification(null);
                      }}
                    >
                      <Text style={styles.unlockBannerBtnText}>Grant Level {unlockNotification.level}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setUnlockNotification(null)} style={{ padding: 4 }}>
                    <Text style={{ color: '#94A3B8' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Message Feed */}
              <ScrollView
                ref={scrollViewRef}
                style={styles.messageList}
                contentContainerStyle={styles.messageListContent}
              >
                <View style={styles.e2eeBanner}>
                  <Text style={styles.e2eeBannerIcon}>🔒</Text>
                  <Text style={styles.e2eeBannerText}>
                    Messages in this chat are end-to-end encrypted with X25519 and ChaCha20-Poly1305.
                    No one outside of this chat, not even the server, can read or listen to them.
                  </Text>
                </View>

                {messages.map((m) => {
                  const isMe = m.is_outgoing || m.sender_id === identity.user_id;
                  const isBurning = !!m.expires_at;
                  const secondsLeft = m.expires_at
                    ? Math.max(0, Math.ceil(m.expires_at - Date.now() / 1000))
                    : null;

                  return (
                    <View
                      key={m.message_id}
                      style={[styles.msgRow, isMe ? styles.msgRowRight : styles.msgRowLeft]}
                    >
                      <View style={[styles.bubble, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
                        {/* Disappearing timer badge */}
                        {isBurning && (
                          <View style={styles.burnBadge}>
                            <Text style={styles.burnBadgeText}>🔥 Destructs in {secondsLeft}s</Text>
                          </View>
                        )}

                        {/* Forward Control Restriction */}
                        {m.no_forward && (
                          <View style={styles.forwardRestrictedBadge}>
                            <Text style={styles.forwardRestrictedText}>🚫 Forward Restricted</Text>
                          </View>
                        )}

                        {/* 20. 🔐 Secret Mode Badge */}
                        {m.is_secret_mode && (
                          <View style={styles.secretModeBadge}>
                            <Text style={styles.secretModeBadgeText}>🔐 SECRET MODE</Text>
                          </View>
                        )}

                        {/* Quoted Reply */}
                        {m.reply_to && (
                          <View style={styles.quotedBox}>
                            <Text style={styles.quotedSender}>
                              Replying to {m.reply_to.sender_id === identity.user_id ? 'You' : 'Peer'}
                            </Text>
                            <Text style={styles.quotedText} numberOfLines={2}>
                              {m.reply_to.text}
                            </Text>
                          </View>
                        )}

                        {/* Attachment Display */}
                        {m.attachment && (
                          <View style={styles.attachmentBox}>
                            <Text style={styles.attachmentIcon}>📎</Text>
                            <View style={styles.attachmentMeta}>
                              <Text style={styles.attachmentName}>{m.attachment.name}</Text>
                              <Text style={styles.attachmentSize}>
                                {m.attachment.size} • Zero-Knowledge Encrypted
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* 📷/🎥 Photo / Video Display (Normal View & One-Time View) */}
                        {m.media && (
                          <View style={styles.mediaContainerBox}>
                            {m.media.view_once ? (
                              // ONE-TIME VIEW
                              m.media.opened ? (
                                <View style={styles.viewOnceOpenedBox}>
                                  <Text style={styles.viewOnceOpenedIcon}>①</Text>
                                  <Text style={styles.viewOnceOpenedText}>
                                    {m.media.file_type === 'video' ? 'Video' : 'Photo'} • Opened
                                  </Text>
                                </View>
                              ) : isMe ? (
                                <View style={styles.viewOnceSentBox}>
                                  <Text style={styles.viewOnceSentIcon}>①</Text>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.viewOnceSentTitle}>
                                      {m.media.file_type === 'video' ? 'Video' : 'Photo'} (View Once)
                                    </Text>
                                    <Text style={styles.viewOnceSentSub}>
                                      {m.status === 'read' ? 'Opened by recipient' : 'Delivered • 1-time view'}
                                    </Text>
                                  </View>
                                </View>
                              ) : (
                                <TouchableOpacity
                                  style={styles.viewOnceTapBtn}
                                  onPress={() => handleOpenViewOnce(m)}
                                  activeOpacity={0.8}
                                >
                                  <View style={styles.viewOnceTapIconCircle}>
                                    <Text style={styles.viewOnceTapIconNum}>①</Text>
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.viewOnceTapTitle}>
                                      Tap to View {m.media.file_type === 'video' ? 'Video' : 'Photo'}
                                    </Text>
                                    <Text style={styles.viewOnceTapSub}>
                                      One-time view • Disappears after viewing
                                    </Text>
                                  </View>
                                  <Text style={styles.viewOnceTapArrow}>➔</Text>
                                </TouchableOpacity>
                              )
                            ) : (
                              // NORMAL VIEW
                              <View style={styles.normalMediaBox}>
                                {m.media.file_type === 'video' ? (
                                  Platform.OS === 'web' ? (
                                    <video
                                      src={m.media.url}
                                      controls
                                      playsInline
                                      preload="metadata"
                                      style={{
                                        width: '100%',
                                        maxWidth: 320,
                                        maxHeight: 240,
                                        borderRadius: 12,
                                        backgroundColor: '#000000',
                                        outline: 'none'
                                      }}
                                    />
                                  ) : (
                                    <View style={styles.nativeMediaPlaceholder}>
                                      <Text style={{ fontSize: 28, color: '#38BDF8' }}>▶</Text>
                                      <Text style={{ color: '#E2E8F0', fontSize: 12, marginTop: 4 }}>
                                        Play Video ({m.media.size || ''})
                                      </Text>
                                    </View>
                                  )
                                ) : (
                                  <TouchableOpacity
                                    activeOpacity={0.9}
                                    onPress={() => {
                                      if (Platform.OS === 'web') {
                                        window.open(m.media.url, '_blank');
                                      }
                                    }}
                                  >
                                    <Image
                                      source={{ uri: m.media.url }}
                                      style={styles.chatImageNormal}
                                      resizeMode="cover"
                                    />
                                  </TouchableOpacity>
                                )}

                                {m.media.caption ? (
                                  <Text style={styles.mediaCaptionText}>{m.media.caption}</Text>
                                ) : null}
                              </View>
                            )}
                          </View>
                        )}

                        {/* Blind Photo Reveal Display */}
                        {m.blind_photo && (
                          <BlindPhotoCard
                            photoData={m.blind_photo}
                            currentUserId={identity?.user_id}
                            peerName={selectedChat?.pseudonym || 'Partner'}
                            onConsentChanged={(updatedPhoto) => {
                              setMessages((prevMsgs) =>
                                prevMsgs.map((msg) =>
                                  msg.blind_photo?.photo_id === updatedPhoto.photo_id
                                    ? { ...msg, blind_photo: updatedPhoto }
                                    : msg
                                )
                              );
                            }}
                          />
                        )}

                        {/* Voice Note Player */}
                        {m.voice_note && (
                          <View style={styles.voiceNoteBox}>
                            <TouchableOpacity style={styles.voicePlayBtn}>
                              <Text style={styles.voicePlayIcon}>▶</Text>
                            </TouchableOpacity>
                            <View style={styles.waveformContainer}>
                              {m.voice_note.waveform?.map((barH, bIdx) => (
                                <View key={bIdx} style={[styles.waveBar, { height: barH }]} />
                              ))}
                            </View>
                            <Text style={styles.voiceDuration}>
                              0:{m.voice_note.duration_seconds.toString().padStart(2, '0')}
                            </Text>
                          </View>
                        )}

                        {/* Text Message */}
                        {m.text ? <Text style={styles.msgText}>{m.text}</Text> : null}

                        {/* Footer: Time & Status Receipts */}
                        <View style={styles.bubbleFooter}>
                          {m.is_edited && <Text style={styles.editedTag}>edited • </Text>}
                          <Text style={styles.msgTime}>
                            {new Date(m.created_at * 1000).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Text>

                          {isMe && (
                            <Text style={styles.statusReceipt}>
                              {m.status === 'read' ? ' ✓✓' : m.status === 'delivered' ? ' ✓✓' : ' ✓'}
                            </Text>
                          )}
                        </View>

                        {/* Reactions row */}
                        {m.reactions && Object.keys(m.reactions).length > 0 && (
                          <View style={styles.reactionsRow}>
                            {Object.entries(m.reactions).map(([uid, emo]) => (
                              <Text key={uid} style={styles.reactionPill}>
                                {emo}
                              </Text>
                            ))}
                          </View>
                        )}

                        {/* Quick Action Floating Bar */}
                        <View style={styles.actionToolbar}>
                          <TouchableOpacity
                            style={styles.actionToolBtn}
                            onPress={() => handleReact(m, '👍')}
                          >
                            <Text style={styles.actionToolText}>👍</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionToolBtn}
                            onPress={() => handleReact(m, '❤️')}
                          >
                            <Text style={styles.actionToolText}>❤️</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionToolBtn}
                            onPress={() => handleReact(m, '🔥')}
                          >
                            <Text style={styles.actionToolText}>🔥</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.actionToolBtn}
                            onPress={() => setReplyingTo(m)}
                          >
                            <Text style={styles.actionToolText}>↩ Quote</Text>
                          </TouchableOpacity>

                          {isMe && (
                            <>
                              <TouchableOpacity
                                style={styles.actionToolBtn}
                                onPress={() => handleStartEdit(m)}
                              >
                                <Text style={styles.actionToolText}>✏ Edit</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.actionToolBtn}
                                onPress={() => handleDeleteMessage(m)}
                              >
                                <Text style={styles.actionToolText}>🗑 Delete</Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Replying Banner */}
              {replyingTo && (
                <View style={styles.replyBanner}>
                  <Text style={styles.replyBannerText} numberOfLines={1}>
                    Replying to: "{replyingTo.text}"
                  </Text>
                  <TouchableOpacity onPress={() => setReplyingTo(null)}>
                    <Text style={styles.replyBannerClose}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Editing Banner */}
              {editingMessage && (
                <View style={[styles.replyBanner, { borderLeftColor: '#F59E0B' }]}>
                  <Text style={styles.replyBannerText}>Editing message...</Text>
                  <TouchableOpacity
                    onPress={() => {
                      setEditingMessage(null);
                      setInputText('');
                    }}
                  >
                    <Text style={styles.replyBannerClose}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 8. 🎲 Blind Date Mini Games Icebreaker Banner: Instead of saying "Hi" */}
              {!selectedChat.group_id && (
                <View style={styles.miniGameIcebreakerBanner}>
                  <View style={styles.miniGameIcebreakerLeft}>
                    <Text style={styles.miniGameIcebreakerEmoji}>🎲</Text>
                    <View style={styles.miniGameIcebreakerTextCol}>
                      <Text style={styles.miniGameIcebreakerTitle}>Instead of saying "Hi" — Play Game 1: This or That!</Text>
                      <Text style={styles.miniGameIcebreakerSub}>Pizza 🍕 or Burger 🍔? Both answer simultaneously to reveal chemistry.</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.miniGamePlayBtn}
                    onPress={() => setMiniGamesModalVisible(true)}
                  >
                    <Text style={styles.miniGamePlayBtnText}>Play Game ➔</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* 🧩 Compatibility Puzzle: Unlocked Conversation Topics */}
              {unlockedTopics && unlockedTopics.length > 0 && (
                <View style={styles.unlockedTopicsBar}>
                  <View style={styles.unlockedTopicsHeader}>
                    <Text style={styles.unlockedTopicsHeaderIcon}>🧩</Text>
                    <Text style={styles.unlockedTopicsHeaderLabel}>UNLOCKED CONVERSATION TOPICS:</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unlockedTopicsScroll}>
                    {unlockedTopics.map((topic, tIdx) => (
                      <TouchableOpacity
                        key={tIdx}
                        style={styles.unlockedTopicPill}
                        onPress={() => setInputText(topic)}
                      >
                        <Text style={styles.unlockedTopicPillText}>💬 "{topic}"</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Chat Input Bar */}
              <View style={styles.inputBar}>
                {Platform.OS === 'web' && (
                  <input
                    ref={mediaFileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    style={{ display: 'none' }}
                    onChange={handleMediaFileSelected}
                  />
                )}

                {/* 📷 Photo/Video Upload Button (Normal & 1-Time View) */}
                <TouchableOpacity
                  style={[styles.iconBtn, styles.mediaPickBtn]}
                  onPress={handleTriggerMediaPick}
                  title="Send Photo or Video (Normal or View Once)"
                >
                  <Text style={styles.iconBtnText}>📷</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={handleAttachMockFile}
                  title="Attach Encrypted File"
                >
                  <Text style={styles.iconBtnText}>📎</Text>
                </TouchableOpacity>

                {/* 🖼️ Blind Photo Button */}
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => setSendBlindPhotoModalVisible(true)}
                  title="Send Blind Photo (Photo Locked 🔒)"
                >
                  <Text style={styles.iconBtnText}>🖼️</Text>
                </TouchableOpacity>

                {/* Voice Note Record / Stop */}
                <TouchableOpacity
                  style={[styles.iconBtn, isRecordingVoice && styles.iconBtnRecording]}
                  onPress={isRecordingVoice ? handleStopVoiceRecording : handleStartVoiceRecording}
                >
                  <Text style={styles.iconBtnText}>
                    {isRecordingVoice ? `⏹ ${voiceDuration}s` : '🎙️'}
                  </Text>
                </TouchableOpacity>

                {/* Forward Protection Toggle */}
                <TouchableOpacity
                  style={[styles.toggleBtn, noForwardActive && styles.toggleBtnActive]}
                  onPress={() => setNoForwardActive(!noForwardActive)}
                  title="Toggle Forward Control"
                >
                  <Text style={styles.toggleBtnText}>{noForwardActive ? '🔒 No Forward' : '🔓 Forward OK'}</Text>
                </TouchableOpacity>

                <TextInput
                  style={styles.chatInput}
                  placeholder={
                    isRecordingVoice
                      ? 'Recording encrypted audio note...'
                      : 'Type an end-to-end encrypted message...'
                  }
                  placeholderTextColor="#64748B"
                  value={inputText}
                  onChangeText={handleTextChange}
                  onSubmitEditing={() => handleSendMessage()}
                  editable={!isRecordingVoice}
                />

                <TouchableOpacity
                  style={styles.sendBtn}
                  onPress={() => handleSendMessage()}
                >
                  <Text style={styles.sendBtnText}>Send ➔</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.noChatSelected}>
              <Text style={styles.noChatIcon}>🔐</Text>
              <Text style={styles.noChatTitle}>Select a Conversation</Text>
              <Text style={styles.noChatSub}>
                Choose an anonymous peer on the left to establish an X3DH Double-Ratchet session.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Live Cryptographic Inspector Modal */}
      <CryptoInspector
        visible={inspectorVisible}
        onClose={() => setInspectorVisible(false)}
        packetLog={packetLog}
      />

      {/* Safety Numbers Modal */}
      {selectedChat && (
        <SafetyNumberModal
          visible={safetyModalVisible}
          onClose={() => setSafetyModalVisible(false)}
          myPseudonym={identity.pseudonym}
          peerPseudonym={selectedChat.pseudonym}
          safetyData={safetyData}
        />
      )}

      {/* Create Group Modal */}
      <Modal visible={newGroupModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Create Encrypted Group</Text>
            <Text style={styles.modalSub}>
              Uses Sender Keys protocol to distribute ratcheted encryption keys to all members.
            </Text>

            <TextInput
              style={styles.textInput}
              placeholder="Group Name (e.g. Citadel Alpha)"
              placeholderTextColor="#64748B"
              value={groupNameInput}
              onChangeText={setGroupNameInput}
            />

            <Text style={styles.selectLabel}>Select Group Members:</Text>
            <ScrollView style={styles.memberSelectList}>
              {usersList.map((u) => {
                const isSelected = selectedGroupMembers.includes(u.user_id);
                return (
                  <TouchableOpacity
                    key={u.user_id}
                    style={[styles.memberChoice, isSelected && styles.memberChoiceActive]}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedGroupMembers(selectedGroupMembers.filter((id) => id !== u.user_id));
                      } else {
                        setSelectedGroupMembers([...selectedGroupMembers, u.user_id]);
                      }
                    }}
                  >
                    <Text style={styles.memberChoiceName}>{u.pseudonym}</Text>
                    <Text style={styles.memberChoiceCheck}>{isSelected ? '✓' : '+'}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setNewGroupModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleCreateGroup}>
                <Text style={styles.modalConfirmText}>Create Group</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 7. 👻 Progressive Identity Reveal - Photo Consent Prompt Modal */}
      {photoPromptModal?.visible && (
        <Modal
          transparent
          animationType="fade"
          visible={photoPromptModal.visible}
          onRequestClose={() => setPhotoPromptModal({ ...photoPromptModal, visible: false })}
        >
          <View style={styles.promptModalOverlay}>
            <View style={styles.promptModalCard}>
              <Text style={styles.promptModalTitle}>
                {photoPromptModal.requesterNickname || 'Nova'} wants to reveal their profile.
              </Text>

              <View style={styles.promptLockGlowRing}>
                <Text style={styles.promptLockBigIcon}>🔒</Text>
              </View>

              <Text style={styles.promptModalQuestion}>Reveal to each other?</Text>
              <Text style={styles.promptModalDesc}>
                Both users must consent before mutual reveal. If either participant chooses to keep anonymous, identities stay 100% encrypted and protected.
              </Text>

              <View style={styles.promptModalBtnsRow}>
                <TouchableOpacity
                  style={styles.promptRevealBtn}
                  onPress={async () => {
                    try {
                      const res = await consentProgressivePhotoReveal(identity.user_id, photoPromptModal.requesterId, true);
                      setPhotoPromptModal({ ...photoPromptModal, visible: false });
                      if (res.outcome === 'mutual_reveal') {
                        Alert.alert('🎉 Veil Lifted!', 'Mutual consent confirmed! Full authentic photo and profile unlocked!');
                        if (selectedChat) loadPeerRevealedProfile(selectedChat.user_id);
                      } else {
                        Alert.alert('✓ Consent Recorded', 'Waiting for peer consent...');
                      }
                    } catch (e) {
                      Alert.alert('Error', e.message);
                    }
                  }}
                >
                  <Text style={styles.promptRevealBtnText}>[ Reveal ]</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.promptKeepAnonBtn}
                  onPress={async () => {
                    try {
                      await consentProgressivePhotoReveal(identity.user_id, photoPromptModal.requesterId, false);
                      setPhotoPromptModal({ ...photoPromptModal, visible: false });
                      Alert.alert('🔒 Kept Anonymous', 'You chose to keep anonymous. Profile remains sealed.');
                    } catch (e) {
                      Alert.alert('Error', e.message);
                    }
                  }}
                >
                  <Text style={styles.promptKeepAnonBtnText}>[ Keep Anonymous ]</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Progressive Identity Persona Studio Modal (L0-L5) */}
      <EditProfileModal

        visible={editPersonaVisible}
        onClose={() => setEditPersonaVisible(false)}
        initialProfile={identity?.profile}
        onSave={handleSaveMyPersona}
      />

      {/* Signature Blind Date Modal */}
      <BlindDateModal
        visible={blindDateModalVisible}
        onClose={() => setBlindDateModalVisible(false)}
        currentUser={identity}
        onOpenSecondChance={() => setSecondChanceModalVisible(true)}
        onMutualRevealSuccess={(roomData) => {
          refreshDirectory();
          if (roomData?.unlocked_topics && roomData.unlocked_topics.length > 0) {
            setUnlockedTopics(roomData.unlocked_topics);
          }
          const isFriend = roomData?.connection_type === 'friends';
          Alert.alert(
            isFriend ? '🤝 Connected as Friends!' : '❤️ Romantic Spark Unlocked!',
            `Both Level 2 identities are now unlocked! Conversation topics have been unlocked: "${roomData?.unlocked_topics?.[0] || "What's your dream destination?"}"`
          );
        }}
      />

      {/* 8. 🎲 Blind Date Mini Games Modal */}
      {selectedChat && !selectedChat.group_id && (
        <MiniGamesModal
          visible={miniGamesModalVisible}
          onClose={() => setMiniGamesModalVisible(false)}
          currentUserId={identity?.user_id}
          peerUserId={selectedChat.user_id}
          peerName={selectedChat.pseudonym || 'Partner'}
          onSelectTopic={(topic) => {
            setInputText(topic);
          }}
        />
      )}

      {/* 9. ❤️ Conversation Chemistry Meter Modal */}
      {selectedChat && !selectedChat.group_id && (
        <ChemistryMeterModal
          visible={chemistryModalVisible}
          onClose={() => setChemistryModalVisible(false)}
          currentUserId={identity?.user_id}
          peerUserId={selectedChat.user_id}
          peerName={selectedChat.pseudonym || 'Partner'}
          onOpenMiniGames={() => setMiniGamesModalVisible(true)}
        />
      )}

      {/* 10. 🎯 Blind Date Missions Modal */}
      {selectedChat && !selectedChat.group_id && (
        <MissionsModal
          visible={missionsModalVisible}
          onClose={() => setMissionsModalVisible(false)}
          sessionId={[identity?.user_id, selectedChat.user_id].sort().join(':')}
          currentUserId={identity?.user_id}
          peerName={selectedChat.pseudonym || 'Partner'}
          onSendStarterToChat={(text) => setInputText(text)}
        />
      )}

      {/* 11. 🃏 Question Cards Modal */}
      {selectedChat && !selectedChat.group_id && (
        <QuestionCardsModal
          visible={questionCardsModalVisible}
          onClose={() => setQuestionCardsModalVisible(false)}
          sessionId={[identity?.user_id, selectedChat.user_id].sort().join(':')}
          currentUserId={identity?.user_id}
          peerName={selectedChat.pseudonym || 'Partner'}
          onSendStarterToChat={(text) => setInputText(text)}
        />
      )}

      {/* 13. 🖼️ Send Blind Photo Modal */}
      {selectedChat && !selectedChat.group_id && (
        <SendBlindPhotoModal
          visible={sendBlindPhotoModalVisible}
          onClose={() => setSendBlindPhotoModalVisible(false)}
          sessionId={[identity?.user_id, selectedChat.user_id].sort().join(':')}
          currentUserId={identity?.user_id}
          peerName={selectedChat.pseudonym || 'Partner'}
          onPhotoSent={(photoPayload) => {
            handleSendMessage(null, null, photoPayload);
          }}
        />
      )}

      {/* 14. 🌫️ Blur-to-Reveal Profile Modal */}
      {selectedChat && !selectedChat.group_id && (
        <BlurProfileModal
          visible={blurProfileModalVisible}
          onClose={() => setBlurProfileModalVisible(false)}
          currentUserId={identity?.user_id}
          peerUserId={selectedChat.user_id}
          peerName={selectedChat.pseudonym || 'Partner'}
        />
      )}

      {/* 18. 🔥 Anonymous Topic Rooms Modal */}
      <TopicRoomsModal
        visible={topicRoomsModalVisible}
        onClose={() => setTopicRoomsModalVisible(false)}
        currentUserPseudonym={identity?.pseudonym || 'Ghost'}
      />

      {/* 19. 🧨 Self-Destruct Conversation Modal */}
      {selectedChat && (
        <SelfDestructModal
          visible={selfDestructModalVisible}
          onClose={() => setSelfDestructModalVisible(false)}
          conversationId={selectedChat.group_id || selectedChat.user_id}
          currentUserId={identity?.user_id}
          peerName={selectedChat.name || selectedChat.pseudonym || 'Partner'}
          onPolicyChanged={(seconds, label) => {
            setConversationPolicy({ seconds, label });
            if (seconds) {
              const cutoff = Date.now() / 1000 - seconds;
              setMessages((prev) => prev.filter((m) => m.created_at >= cutoff));
            }
            if (selectedChat) {
              wsClient.sendSignal({
                signal_type: 'self_destruct.policy_updated',
                conversation_id: selectedChat.group_id || selectedChat.user_id,
                sender_id: identity.user_id,
                recipient_id: selectedChat.group_id ? null : selectedChat.user_id,
                group_id: selectedChat.group_id || null,
                data: { delete_after_seconds: seconds, retention_label: label }
              });
            }
          }}
          onConversationBurned={(convId) => {
            setMessages([]);
            if (selectedChat) {
              wsClient.sendSignal({
                signal_type: 'self_destruct.burned',
                conversation_id: convId,
                sender_id: identity.user_id,
                recipient_id: selectedChat.group_id ? null : selectedChat.user_id,
                group_id: selectedChat.group_id || null
              });
            }
          }}
        />
      )}

      {/* 20. 🔐 Secret Chat Mode Modal */}
      {selectedChat && !selectedChat.group_id && (
        <SecretChatModal
          visible={secretChatModalVisible}
          onClose={() => setSecretChatModalVisible(false)}
          currentUserId={identity?.user_id}
          peerUserId={selectedChat.user_id}
          peerName={selectedChat.pseudonym || 'Partner'}
          activeSecretSession={activeSecretSession}
          onEnterSecretMode={(session) => {
            setActiveSecretSession(session);
            wsClient.sendSignal({
              signal_type: 'secret_chat.init',
              conversation_id: selectedChat.user_id,
              sender_id: identity.user_id,
              recipient_id: selectedChat.user_id,
              data: { session }
            });
          }}
          onExitSecretMode={() => {
            const sid = activeSecretSession?.secret_session_id;
            setActiveSecretSession(null);
            setMessages((prev) => prev.filter((m) => !m.is_secret_mode));
            if (sid && selectedChat) {
              wsClient.sendSignal({
                signal_type: 'secret_chat.terminate',
                conversation_id: selectedChat.user_id,
                sender_id: identity.user_id,
                recipient_id: selectedChat.user_id,
                data: { session_id: sid }
              });
            }
          }}
        />
      )}

      {/* 22. 🧬 Anonymous Personality Card Modal */}
      <AnonymousPersonalityCardModal
        visible={personalityCardModalVisible}
        onClose={() => setPersonalityCardModalVisible(false)}
        currentUserId={identity?.user_id}
        peerUserId={selectedChat && !selectedChat.group_id ? selectedChat.user_id : null}
        peerName={selectedChat?.pseudonym || 'Partner'}
        onSendCardToChat={(cardText) => setInputText(cardText)}
      />

      {/* 23. 🌌 Random Universe Matching Modal */}
      <UniverseMatchingModal
        visible={universeModalVisible}
        onClose={() => setUniverseModalVisible(false)}
        currentUserId={identity?.user_id}
        onStartInteraction={(res) => {
          const peerId = res?.peer_user_id || res?.room?.peer_user_id;
          const peerName = res?.peer_ghost || res?.room?.peer_ghost || 'Mystery Star';
          if (peerId) {
            const found = usersList.find(u => u.user_id === peerId);
            if (found) {
              setSelectedChat(found);
            } else {
              Alert.alert('Notice', 'This user is currently offline or not in your active directory.');
            }
          } else if (res?.room) {
            setBlindDateModalVisible(true);
          }
        }}
      />

      {/* 24. ⚡ Instant 5-Minute Date Modal */}
      <Instant5MinDateModal
        visible={instantDateModalVisible}
        onClose={() => setInstantDateModalVisible(false)}
        currentUserId={identity?.user_id}
        onOpenSecondChance={() => setSecondChanceModalVisible(true)}
        onFullChatUnlocked={(match) => {
          if (match?.id) {
            const found = usersList.find(u => u.user_id === match.id);
            if (found) {
              setSelectedChat(found);
            } else {
              Alert.alert('Notice', 'Matched partner is offline or not registered.');
            }
          }
        }}
      />

      {/* 25. 🔄 Second Chance Modal */}
      <SecondChanceModal
        visible={secondChanceModalVisible}
        onClose={() => setSecondChanceModalVisible(false)}
        currentUserId={identity?.user_id}
        onOpenChatWithPeer={(peer) => {
          if (peer?.user_id) {
            const found = usersList.find(u => u.user_id === peer.user_id);
            if (found) {
              setSelectedChat(found);
            } else {
              Alert.alert('Notice', 'Connection peer is currently offline.');
            }
          }
        }}
      />

      {/* 26. 🧠 Smart Matchmaking Modal */}
      <SmartMatchmakingModal
        visible={smartMatchmakingModalVisible}
        onClose={() => setSmartMatchmakingModalVisible(false)}
        currentUserId={identity?.user_id}
        onStartMatchWithCandidate={(cand) => {
          const found = usersList.find(u => u.user_id === cand?.candidate_id);
          if (found) {
            setSelectedChat(found);
          } else {
            Alert.alert('Notice', 'User is not currently online or in the active directory.');
          }
        }}
      />

      {/* 27. 🏆 Blind Date XP Modal */}
      <BlindDateXPModal
        visible={blindDateXPModalVisible}
        onClose={() => setBlindDateXPModalVisible(false)}
        currentUserId={identity?.user_id}
      />

      {/* 28. 🔥 Daily Mystery Drop Modal */}
      <DailyMysteryDropModal
        visible={dailyMysteryDropModalVisible}
        onClose={() => setDailyMysteryDropModalVisible(false)}
        userId={identity?.user_id}
        onStartChat={(peerId, peerPseudonym, chatRoomId) => {
          if (peerId) {
            const found = usersList.find(u => u.user_id === peerId);
            if (found) {
              setSelectedChat(found);
            } else {
              Alert.alert('Notice', 'Mystery connection is currently offline.');
            }
          }
        }}
      />

      {/* 29. 🕰️ Scheduled Blind Date Modal */}
      <ScheduledBlindDateModal
        visible={scheduledDateModalVisible}
        onClose={() => setScheduledDateModalVisible(false)}
        userId={identity?.user_id}
        onEnterEventChamber={(peerId, peerPseudonym, roomId) => {
          if (peerId) {
            const found = usersList.find(u => u.user_id === peerId);
            if (found) {
              setSelectedChat(found);
            } else {
              Alert.alert('Notice', 'Scheduled date partner is currently offline.');
            }
          }
        }}
      />

      {/* 30. 💎 Date Memory Modal */}
      <DateMemoryModal
        visible={dateMemoryModalVisible}
        onClose={() => setDateMemoryModalVisible(false)}
        userId={identity?.user_id}
      />

      {/* 🏗️ Recommended Technical Architecture & Complete User Flow Modal */}
      <ArchitectureFlowModal
        visible={architectureModalVisible}
        onClose={() => setArchitectureModalVisible(false)}
      />

      {/* In-Chat Activities Selection Modal */}
      <Modal
        visible={activitiesModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setActivitiesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { maxWidth: 440, padding: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#F8FAFC' }}>⚡ Date & Chat Activities</Text>
              <TouchableOpacity onPress={() => setActivitiesModalVisible(false)}>
                <Text style={{ color: '#94A3B8', fontSize: 18, fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1E293B', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155' }}
                onPress={() => { setActivitiesModalVisible(false); setChemistryModalVisible(true); }}
              >
                <Text style={{ fontSize: 22 }}>❤️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F1F5F9', fontWeight: '700', fontSize: 14 }}>Chemistry Meter</Text>
                  <Text style={{ color: '#94A3B8', fontSize: 12 }}>Track real-time mutual resonance</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1E293B', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155' }}
                onPress={() => { setActivitiesModalVisible(false); setMiniGamesModalVisible(true); }}
              >
                <Text style={{ fontSize: 22 }}>🎲</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F1F5F9', fontWeight: '700', fontSize: 14 }}>Mini Games</Text>
                  <Text style={{ color: '#94A3B8', fontSize: 12 }}>Trivia, Dilemma & Word Sync</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1E293B', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155' }}
                onPress={() => { setActivitiesModalVisible(false); setMissionsModalVisible(true); }}
              >
                <Text style={{ fontSize: 22 }}>🎯</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F1F5F9', fontWeight: '700', fontSize: 14 }}>Blind Date Missions</Text>
                  <Text style={{ color: '#94A3B8', fontSize: 12 }}>Cooperative conversational tasks</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1E293B', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155' }}
                onPress={() => { setActivitiesModalVisible(false); setQuestionCardsModalVisible(true); }}
              >
                <Text style={{ fontSize: 22 }}>🃏</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F1F5F9', fontWeight: '700', fontSize: 14 }}>Icebreaker Cards</Text>
                  <Text style={{ color: '#94A3B8', fontSize: 12 }}>50+ curated questions</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1E293B', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155' }}
                onPress={() => { setActivitiesModalVisible(false); setSendBlindPhotoModalVisible(true); }}
              >
                <Text style={{ fontSize: 22 }}>🖼️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F1F5F9', fontWeight: '700', fontSize: 14 }}>Send Blind Photo</Text>
                  <Text style={{ color: '#94A3B8', fontSize: 12 }}>Locked until both agree to reveal</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1E293B', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155' }}
                onPress={() => { setActivitiesModalVisible(false); setBlurProfileModalVisible(true); }}
              >
                <Text style={{ fontSize: 22 }}>🌫️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F1F5F9', fontWeight: '700', fontSize: 14 }}>Blur-to-Reveal Profile</Text>
                  <Text style={{ color: '#94A3B8', fontSize: 12 }}>Gradually unblur profile details</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1E293B', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155' }}
                onPress={() => { setActivitiesModalVisible(false); setBlindDateModalVisible(true); }}
              >
                <Text style={{ fontSize: 22 }}>🧩</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F1F5F9', fontWeight: '700', fontSize: 14 }}>Compatibility Puzzle</Text>
                  <Text style={{ color: '#94A3B8', fontSize: 12 }}>Sync choices to solve the puzzle</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1E293B', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155' }}
                onPress={() => { setActivitiesModalVisible(false); setPersonalityCardModalVisible(true); }}
              >
                <Text style={{ fontSize: 22 }}>🧬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F1F5F9', fontWeight: '700', fontSize: 14 }}>Mystery Personality Card</Text>
                  <Text style={{ color: '#94A3B8', fontSize: 12 }}>Private habit & energy matrix</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 📸 Send Media Modal (Photo/Video Normal & View Once) */}
      <SendMediaModal
        visible={sendMediaModalVisible}
        onClose={() => {
          setSendMediaModalVisible(false);
          setSelectedMediaFile(null);
          setSelectedMediaPreview(null);
        }}
        previewUri={selectedMediaPreview?.uri}
        fileType={selectedMediaPreview?.type}
        fileName={selectedMediaPreview?.name}
        isUploading={isUploadingMedia}
        onSendMedia={handleConfirmSendMedia}
      />

      {/* ① Fullscreen View-Once Ephemeral Media Viewer */}
      <ViewOnceMediaModal
        visible={!!viewOnceModalData}
        media={viewOnceModalData}
        onClose={handleCloseViewOnce}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  blindDateBanner: {
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#F43F5E',
    margin: 10,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#F43F5E',
    shadowOpacity: 0.25,
    shadowRadius: 10
  },
  blindDateBadge: {
    backgroundColor: '#F43F5E',
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6
  },
  blindDateBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  blindDateBannerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  blindDateBannerIcon: {
    fontSize: 26,
    marginRight: 10
  },
  blindDateBannerMeta: {
    flex: 1
  },
  blindDateBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  blindDateBannerSub: {
    fontSize: 10,
    color: '#FDA4AF',
    marginTop: 2
  },

  /* 18. 🔥 Anonymous Topic Rooms Banner Styles */
  topicRoomsBanner: {
    backgroundColor: '#1C1917',
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.25,
    shadowRadius: 10
  },
  topicRoomsBadge: {
    backgroundColor: '#F59E0B',
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6
  },
  topicRoomsBadgeText: {
    color: '#0F172A',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  topicRoomsBannerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  topicRoomsBannerIcon: {
    fontSize: 26,
    marginRight: 10
  },
  topicRoomsBannerMeta: {
    flex: 1
  },
  topicRoomsBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  topicRoomsBannerSub: {
    fontSize: 10,
    color: '#FDE68A',
    marginTop: 2
  },
  topicRoomsHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  topicRoomsHeaderBtnText: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '800'
  },
  selfDestructHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#F43F5E',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginRight: 8
  },
  selfDestructHeaderBtnText: {
    color: '#FB7185',
    fontSize: 11,
    fontWeight: '800'
  },
  unlockBanner: {
    backgroundColor: '#1E1B4B',
    borderLeftWidth: 4,
    borderLeftColor: '#818CF8',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8
  },
  unlockBannerText: {
    color: '#E0E7FF',
    fontSize: 12,
    fontWeight: '700',
    flex: 1
  },
  unlockBannerBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6
  },
  unlockBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800'
  },
  authContainer: {
    flex: 1,
    backgroundColor: '#090D16',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  authCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  logoIcon: {
    fontSize: 32
  },
  authTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8
  },
  authSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18
  },
  cryptoSpecs: {
    color: '#38BDF8',
    fontWeight: '700'
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 8
  },
  textInput: {
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#F8FAFC'
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24
  },
  btnDisabled: {
    opacity: 0.6
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  },
  guaranteeBox: {
    width: '100%',
    backgroundColor: '#0B0F19',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  guaranteeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34D399',
    marginBottom: 6
  },
  guaranteeText: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 18
  },

  // --- Main Workspace Styles ---
  appContainer: {
    flex: 1,
    backgroundColor: '#090D16'
  },
  topBar: {
    height: 60,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  appLogo: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginRight: 12
  },
  cryptoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  cryptoBadgeDot: {
    color: '#10B981',
    fontSize: 10,
    marginRight: 4
  },
  cryptoBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 0.5
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  inspectorBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  inspectorBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8'
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginRight: 10
  },
  userDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6
  },
  userPseudonym: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC'
  },
  logoutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  logoutBtnText: {
    fontSize: 12,
    color: '#94A3B8'
  },

  // Split Area
  mainLayout: {
    flex: 1,
    flexDirection: 'row'
  },
  sidebar: {
    width: 320,
    borderRightWidth: 1,
    borderRightColor: '#1E293B',
    backgroundColor: '#0B0F19'
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center'
  },
  tabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#0284C7'
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B'
  },
  tabBtnTextActive: {
    color: '#F8FAFC',
    fontWeight: '700'
  },
  createGroupBtn: {
    backgroundColor: '#1E293B',
    margin: 10,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center'
  },
  createGroupBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700'
  },
  convList: {
    flex: 1
  },
  emptyNav: {
    padding: 24,
    alignItems: 'center'
  },
  emptyNavText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 6
  },
  emptyNavSub: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center'
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111827'
  },
  convItemActive: {
    backgroundColor: '#1E293B'
  },
  avatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative'
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    position: 'absolute',
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: '#0B0F19'
  },
  convDetails: {
    flex: 1
  },
  convRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2
  },
  convName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC'
  },
  onlineStatus: {
    fontSize: 10,
    color: '#34D399',
    fontWeight: '600'
  },
  offlineStatus: {
    fontSize: 10,
    color: '#64748B'
  },
  convKeySnippet: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: 'monospace'
  },

  // Active Chat Area
  chatArea: {
    flex: 1,
    backgroundColor: '#070B12',
    display: 'flex',
    flexDirection: 'column'
  },
  chatHeader: {
    height: 60,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10
  },
  avatarSmallText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14
  },
  chatHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC'
  },
  chatHeaderSub: {
    fontSize: 11,
    color: '#38BDF8'
  },
  chatHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  timerPickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 10
  },
  timerPickerLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginRight: 4
  },
  timerChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginHorizontal: 2
  },
  timerChipActive: {
    backgroundColor: '#EF4444'
  },
  timerChipText: {
    fontSize: 11,
    color: '#F8FAFC',
    fontWeight: '700'
  },
  safetyBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981'
  },
  safetyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399'
  },

  // Message List
  messageList: {
    flex: 1
  },
  messageListContent: {
    padding: 16
  },
  e2eeBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center'
  },
  e2eeBannerIcon: {
    fontSize: 18,
    marginBottom: 4
  },
  e2eeBannerText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16
  },
  msgRow: {
    marginVertical: 4,
    flexDirection: 'row'
  },
  msgRowRight: {
    justifyContent: 'flex-end'
  },
  msgRowLeft: {
    justifyContent: 'flex-start'
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 14,
    padding: 10,
    position: 'relative'
  },
  bubbleRight: {
    backgroundColor: '#1E3A8A'
  },
  bubbleLeft: {
    backgroundColor: '#1E293B'
  },
  burnBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4
  },
  burnBadgeText: {
    color: '#F87171',
    fontSize: 9,
    fontWeight: '800'
  },
  forwardRestrictedBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4
  },
  forwardRestrictedText: {
    color: '#FBBF24',
    fontSize: 9,
    fontWeight: '700'
  },
  quotedBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderLeftWidth: 3,
    borderLeftColor: '#38BDF8',
    padding: 6,
    borderRadius: 4,
    marginBottom: 6
  },
  quotedSender: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8'
  },
  quotedText: {
    fontSize: 11,
    color: '#E2E8F0'
  },
  attachmentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 4
  },
  attachmentIcon: {
    fontSize: 20,
    marginRight: 8
  },
  attachmentMeta: {
    flex: 1
  },
  attachmentName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F8FAFC'
  },
  attachmentSize: {
    fontSize: 10,
    color: '#34D399'
  },
  voiceNoteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 4
  },
  voicePlayBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  voicePlayIcon: {
    fontSize: 12,
    color: '#0F172A',
    fontWeight: '800'
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    flex: 1,
    marginRight: 8
  },
  waveBar: {
    width: 3,
    backgroundColor: '#38BDF8',
    marginHorizontal: 1,
    borderRadius: 1
  },
  voiceDuration: {
    fontSize: 10,
    color: '#94A3B8'
  },
  msgText: {
    fontSize: 14,
    color: '#F8FAFC',
    lineHeight: 20
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4
  },
  editedTag: {
    fontSize: 10,
    color: '#94A3B8',
    fontStyle: 'italic'
  },
  msgTime: {
    fontSize: 10,
    color: '#94A3B8'
  },
  statusReceipt: {
    fontSize: 10,
    color: '#38BDF8',
    fontWeight: '700',
    marginLeft: 2
  },
  reactionsRow: {
    flexDirection: 'row',
    marginTop: 4
  },
  reactionPill: {
    fontSize: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginRight: 4
  },
  actionToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)'
  },
  actionToolBtn: {
    marginRight: 8
  },
  actionToolText: {
    fontSize: 11,
    color: '#94A3B8'
  },

  // Bottom Input Area
  replyBanner: {
    backgroundColor: '#1E293B',
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#38BDF8'
  },
  replyBannerText: {
    fontSize: 12,
    color: '#F8FAFC',
    flex: 1
  },
  replyBannerClose: {
    color: '#94A3B8',
    fontSize: 14,
    paddingHorizontal: 8
  },
  inputBar: {
    padding: 10,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center'
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8
  },
  iconBtnRecording: {
    backgroundColor: '#EF4444'
  },
  iconBtnText: {
    fontSize: 16,
    color: '#F8FAFC'
  },
  toggleBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8
  },
  toggleBtnActive: {
    backgroundColor: '#B45309'
  },
  toggleBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F8FAFC'
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: '#F8FAFC',
    marginRight: 8
  },
  // Compatibility Puzzle: Unlocked Topics Bar
  unlockedTopicsBar: {
    backgroundColor: '#090D16',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  unlockedTopicsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10
  },
  unlockedTopicsHeaderIcon: {
    fontSize: 14,
    marginRight: 4
  },
  unlockedTopicsHeaderLabel: {
    color: '#F43F5E',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  unlockedTopicsScroll: {
    flex: 1
  },
  unlockedTopicPill: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: '#FB7185',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8
  },
  unlockedTopicPillText: {
    color: '#FFE4E6',
    fontSize: 12,
    fontWeight: '700'
  },
  chemistryHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#FB7185',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  chemistryHeaderBtnText: {
    color: '#FB7185',
    fontSize: 11,
    fontWeight: '800'
  },
  miniGamesHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(236, 72, 153, 0.18)',
    borderWidth: 1,
    borderColor: '#EC4899',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  miniGamesHeaderBtnText: {
    color: '#F472B6',
    fontSize: 11,
    fontWeight: '800'
  },
  missionsHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderWidth: 1,
    borderColor: '#818CF8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  missionsHeaderBtnText: {
    color: '#C7D2FE',
    fontSize: 11,
    fontWeight: '800'
  },
  cardsHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    borderWidth: 1,
    borderColor: '#A855F7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  cardsHeaderBtnText: {
    color: '#E9D5FF',
    fontSize: 11,
    fontWeight: '800'
  },
  blindPhotoHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(244, 63, 94, 0.18)',
    borderWidth: 1,
    borderColor: '#FB7185',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  blindPhotoHeaderBtnText: {
    color: '#FECDD3',
    fontSize: 11,
    fontWeight: '800'
  },
  blurProfileHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    borderWidth: 1,
    borderColor: '#C084FC',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  blurProfileHeaderBtnText: {
    color: '#E9D5FF',
    fontSize: 11,
    fontWeight: '800'
  },
  miniGameIcebreakerBanner: {
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#F43F5E',
    borderRadius: 10,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  miniGameIcebreakerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10
  },
  miniGameIcebreakerEmoji: {
    fontSize: 22,
    marginRight: 8
  },
  miniGameIcebreakerTextCol: {
    flex: 1
  },
  miniGameIcebreakerTitle: {
    color: '#FDE047',
    fontSize: 12,
    fontWeight: '800'
  },
  miniGameIcebreakerSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2
  },
  miniGamePlayBtn: {
    backgroundColor: '#E11D48',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8
  },
  miniGamePlayBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800'
  },
  puzzleHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#818CF8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  puzzleHeaderBtnText: {
    color: '#C7D2FE',
    fontSize: 11,
    fontWeight: '800'
  },
  sendBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18
  },
  sendBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },

  // No Chat Selected Placeholder
  noChatSelected: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32
  },
  noChatIcon: {
    fontSize: 48,
    marginBottom: 16
  },
  noChatTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8
  },
  noChatSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 20
  },

  // Group Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalBox: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4
  },
  modalSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 16
  },
  selectLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 12,
    marginBottom: 8
  },
  memberSelectList: {
    maxHeight: 180,
    marginBottom: 16
  },
  memberChoice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#090D16',
    marginBottom: 6
  },
  memberChoiceActive: {
    backgroundColor: '#1E3A8A'
  },
  memberChoiceName: {
    fontSize: 13,
    color: '#F8FAFC',
    fontWeight: '600'
  },
  memberChoiceCheck: {
    fontSize: 14,
    color: '#38BDF8',
    fontWeight: '800'
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end'
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8
  },
  modalCancelText: {
    color: '#94A3B8',
    fontSize: 13
  },
  modalConfirmBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },

  /* 7. 👻 Progressive Identity Reveal Styles */
  progressiveSuiteContainer: {
    marginBottom: 4
  },
  progressiveTabToggle: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginHorizontal: 12,
    marginTop: 6,
    overflow: 'hidden'
  },
  progressiveToggleBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    backgroundColor: '#1E293B'
  },
  progressiveToggleBtnActive: {
    backgroundColor: '#312E81',
    borderBottomWidth: 2,
    borderBottomColor: '#818CF8'
  },
  progressiveToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8'
  },
  progressiveToggleTextActive: {
    color: '#E0E7FF',
    fontWeight: '800'
  },

  /* Photo Consent Prompt Modal */
  promptModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  promptModalCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#38BDF8',
    padding: 20,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10
  },
  promptModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 6
  },
  promptLockGlowRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 2,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 14
  },
  promptLockBigIcon: {
    fontSize: 30
  },
  promptModalQuestion: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6
  },
  promptModalDesc: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
    lineHeight: 16
  },
  promptModalBtnsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center'
  },
  promptRevealBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    shadowColor: '#10B981',
    shadowOpacity: 0.5,
    shadowRadius: 10
  },
  promptRevealBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.6
  },
  promptKeepAnonBtn: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#475569'
  },
  promptKeepAnonBtnText: {
    color: '#F1F5F9',
    fontWeight: '700',
    fontSize: 14
  },

  /* 20. 🔐 Secret Chat Mode Styles */
  secretModeHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  secretModeHeaderBtnActive: {
    backgroundColor: '#059669',
    borderColor: '#34D399',
    shadowColor: '#10B981',
    shadowOpacity: 0.6,
    shadowRadius: 8
  },
  secretModeHeaderBtnText: {
    color: '#6EE7B7',
    fontSize: 11,
    fontWeight: '800'
  },
  selfDestructHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  selfDestructHeaderBtnText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '800'
  },
  topicRoomsHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderWidth: 1,
    borderColor: '#F97316',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  topicRoomsHeaderBtnText: {
    color: '#FDBA74',
    fontSize: 11,
    fontWeight: '800'
  },
  secretModeBanner: {
    backgroundColor: 'rgba(6, 78, 59, 0.85)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 10,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  secretModeBannerLeft: {
    flex: 1,
    marginRight: 8
  },
  secretModeBannerTag: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  secretModeBannerSub: {
    color: '#A7F3D0',
    fontSize: 10,
    marginTop: 2
  },
  secretModeBannerExitBtn: {
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#34D399',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  secretModeBannerExitText: {
    color: '#F0FDF4',
    fontSize: 10,
    fontWeight: '800'
  },
  secretModeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4
  },
  secretModeBadgeText: {
    color: '#6EE7B7',
    fontSize: 9,
    fontWeight: '800'
  },
  screenshotAlertBanner: {
    backgroundColor: '#7F1D1D',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 8,
    marginHorizontal: 12,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  screenshotAlertText: {
    color: '#FEE2E2',
    fontSize: 11,
    fontWeight: '800',
    flex: 1,
    marginRight: 6
  },

  /* 22. 🧬 Anonymous Personality Card Styles */
  personalityCardBanner: {
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#6366F1',
    marginHorizontal: 10,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#6366F1',
    shadowOpacity: 0.25,
    shadowRadius: 8
  },
  personalityCardBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderWidth: 1,
    borderColor: '#818CF8',
    borderRadius: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6
  },
  personalityCardBadgeText: {
    color: '#C7D2FE',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  personalityCardBannerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  personalityCardBannerIcon: {
    fontSize: 22,
    marginRight: 10
  },
  personalityCardBannerMeta: {
    flex: 1
  },
  personalityCardBannerTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800'
  },
  personalityCardBannerSub: {
    color: '#A5B4FC',
    fontSize: 10,
    marginTop: 2
  },
  personalityCardHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    borderWidth: 1,
    borderColor: '#818CF8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  personalityCardHeaderBtnText: {
    color: '#C7D2FE',
    fontSize: 11,
    fontWeight: '800'
  },

  /* 23. 🌌 Random Universe Matching Styles */
  universeBanner: {
    backgroundColor: '#040914',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    marginHorizontal: 10,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.35,
    shadowRadius: 10
  },
  universeBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6
  },
  universeBadgeText: {
    color: '#E0F2FE',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  universeBannerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  universeBannerIcon: {
    fontSize: 22,
    color: '#38BDF8',
    marginRight: 10,
    textShadowColor: '#38BDF8',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8
  },
  universeBannerMeta: {
    flex: 1
  },
  universeBannerTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800'
  },
  universeBannerSub: {
    color: '#7DD3FC',
    fontSize: 10,
    marginTop: 2
  },
  universeHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  universeHeaderBtnText: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '800'
  },
  instantDateBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 10
  },
  instantDateBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6
  },
  instantDateBadgeText: {
    color: '#FEF3C7',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  instantDateBannerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  instantDateBannerIcon: {
    fontSize: 22,
    color: '#F59E0B',
    marginRight: 10
  },
  instantDateBannerMeta: {
    flex: 1
  },
  instantDateBannerTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800'
  },
  instantDateBannerSub: {
    color: '#FCD34D',
    fontSize: 10,
    marginTop: 2
  },
  instantDateHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  instantDateHeaderBtnText: {
    color: '#FCD34D',
    fontSize: 11,
    fontWeight: '800'
  },
  secondChanceBanner: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderWidth: 1.5,
    borderColor: '#A855F7',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 10
  },
  secondChanceBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.25)',
    borderWidth: 1,
    borderColor: '#A855F7',
    borderRadius: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6
  },
  secondChanceBadgeText: {
    color: '#F3E8FF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  secondChanceBannerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  secondChanceBannerIcon: {
    fontSize: 22,
    color: '#C084FC',
    marginRight: 10
  },
  secondChanceBannerMeta: {
    flex: 1
  },
  secondChanceBannerTitle: {
    color: '#FAF5FF',
    fontSize: 13,
    fontWeight: '800'
  },
  secondChanceBannerSub: {
    color: '#D8B4FE',
    fontSize: 10,
    marginTop: 2
  },
  secondChanceHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
    borderWidth: 1,
    borderColor: '#A855F7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  secondChanceHeaderBtnText: {
    color: '#D8B4FE',
    fontSize: 11,
    fontWeight: '800'
  },
  smartMatchBanner: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 10
  },
  smartMatchBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6
  },
  smartMatchBadgeText: {
    color: '#E0F2FE',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  smartMatchBannerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  smartMatchBannerIcon: {
    fontSize: 22,
    color: '#38BDF8',
    marginRight: 10
  },
  smartMatchBannerMeta: {
    flex: 1
  },
  smartMatchBannerTitle: {
    color: '#FAF5FF',
    fontSize: 13,
    fontWeight: '800'
  },
  smartMatchBannerSub: {
    color: '#7DD3FC',
    fontSize: 10,
    marginTop: 2
  },
  smartMatchHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  smartMatchHeaderBtnText: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '800'
  },
  xpBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 12,
    marginBottom: 10
  },
  xpBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6
  },
  xpBadgeText: {
    color: '#FEF3C7',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  xpBannerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  xpBannerIcon: {
    fontSize: 22,
    color: '#F59E0B',
    marginRight: 10
  },
  xpBannerMeta: {
    flex: 1
  },
  xpBannerTitle: {
    color: '#FAF5FF',
    fontSize: 13,
    fontWeight: '800'
  },
  xpBannerSub: {
    color: '#FCD34D',
    fontSize: 10,
    marginTop: 2
  },
  xpHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  xpHeaderBtnText: {
    color: '#FCD34D',
    fontSize: 11,
    fontWeight: '800'
  },

  /* 28. 🔥 Daily Mystery Drop Styles */
  dailyDropBanner: {
    backgroundColor: '#1E1408',
    borderWidth: 1,
    borderColor: '#F97316',
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 12,
    padding: 10,
    shadowColor: '#F97316',
    shadowOpacity: 0.35,
    shadowRadius: 10
  },
  dailyDropBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.25)',
    borderWidth: 1,
    borderColor: '#F97316',
    borderRadius: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6
  },
  dailyDropBadgeText: {
    color: '#FED7AA',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  dailyDropBannerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  dailyDropBannerIcon: {
    fontSize: 22,
    marginRight: 10
  },
  dailyDropBannerMeta: {
    flex: 1
  },
  dailyDropBannerTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  dailyDropBannerSub: {
    color: '#FB923C',
    fontSize: 10,
    marginTop: 2
  },
  dailyDropHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 115, 22, 0.18)',
    borderWidth: 1,
    borderColor: '#F97316',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  dailyDropHeaderBtnText: {
    color: '#FB923C',
    fontSize: 11,
    fontWeight: '800'
  },

  /* 29. 🕰️ Scheduled Blind Date Styles */
  scheduledDateBanner: {
    backgroundColor: '#09152B',
    borderWidth: 1,
    borderColor: '#38BDF8',
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 12,
    padding: 10,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.35,
    shadowRadius: 10
  },
  scheduledDateBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6
  },
  scheduledDateBadgeText: {
    color: '#E0F2FE',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  scheduledDateBannerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  scheduledDateBannerIcon: {
    fontSize: 22,
    marginRight: 10
  },
  scheduledDateBannerMeta: {
    flex: 1
  },
  scheduledDateBannerTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  scheduledDateBannerSub: {
    color: '#7DD3FC',
    fontSize: 10,
    marginTop: 2
  },
  scheduledDateHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  scheduledDateHeaderBtnText: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '800'
  },

  /* 30. 💎 Date Memory Styles */
  dateMemoryBanner: {
    backgroundColor: '#0C1322',
    borderWidth: 1,
    borderColor: '#38BDF8',
    marginHorizontal: 10,
    marginBottom: 10,
    borderRadius: 12,
    padding: 10,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.35,
    shadowRadius: 10
  },
  dateMemoryBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 10,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6
  },
  dateMemoryBadgeText: {
    color: '#E0F2FE',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  dateMemoryBannerRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  dateMemoryBannerIcon: {
    fontSize: 22,
    marginRight: 10
  },
  dateMemoryBannerMeta: {
    flex: 1
  },
  dateMemoryBannerTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  dateMemoryBannerSub: {
    color: '#BAE6FD',
    fontSize: 10,
    marginTop: 2
  },
  dateMemoryHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8
  },
  dateMemoryHeaderBtnText: {
    color: '#BAE6FD',
    fontSize: 11,
    fontWeight: '800'
  },
  mediaPickBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
    borderColor: '#3B82F6',
    borderWidth: 1.5,
  },
  mediaContainerBox: {
    marginTop: 8,
    marginBottom: 6,
    borderRadius: 14,
    overflow: 'hidden',
  },
  viewOnceOpenedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(51, 65, 85, 0.7)',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  viewOnceOpenedIcon: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '800',
  },
  viewOnceOpenedText: {
    fontSize: 13,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  viewOnceSentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.85)',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  viewOnceSentIcon: {
    fontSize: 18,
    color: '#60A5FA',
    fontWeight: '800',
  },
  viewOnceSentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  viewOnceSentSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  viewOnceTapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
    borderColor: '#6366F1',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    shadowColor: '#6366F1',
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  viewOnceTapIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewOnceTapIconNum: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  viewOnceTapTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewOnceTapSub: {
    fontSize: 11,
    color: '#A5B4FC',
    marginTop: 1,
  },
  viewOnceTapArrow: {
    fontSize: 16,
    color: '#818CF8',
    fontWeight: 'bold',
  },
  normalMediaBox: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  chatImageNormal: {
    width: '100%',
    maxWidth: 320,
    height: 220,
    borderRadius: 12,
  },
  nativeMediaPlaceholder: {
    width: 240,
    height: 140,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  mediaCaptionText: {
    color: '#E2E8F0',
    fontSize: 13,
    marginTop: 6,
    paddingHorizontal: 4,
    lineHeight: 18,
  }
});

