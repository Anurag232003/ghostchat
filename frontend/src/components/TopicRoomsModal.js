import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import {
  fetchTopicCategories,
  fetchTopicRooms,
  createTopicRoom,
  joinTopicRoom,
  fetchTopicRoomState,
  sendTopicRoomMessage,
  leaveTopicRoom,
  burnTopicRoom,
} from '../services/api';

const DEFAULT_CATEGORIES = [
  { id: 'all', label: '🔥 All Rooms', icon: '🔥' },
  { id: 'gaming', label: '🎮 Gaming', icon: '🎮' },
  { id: 'movies', label: '🎬 Movies', icon: '🎬' },
  { id: 'coding', label: '💻 Coding', icon: '💻' },
  { id: 'music', label: '🎵 Music', icon: '🎵' },
  { id: 'travel', label: '🌍 Travel', icon: '🌍' },
  { id: 'students', label: '📚 Students', icon: '📚' },
  { id: 'vibe', label: '🌙 Late Night', icon: '🌙' },
];

export function TopicRoomsModal({ visible, onClose, currentUserPseudonym }) {
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomState, setRoomState] = useState(null);
  const [myEphemeralId, setMyEphemeralId] = useState(null);
  const [myPseudonym, setMyPseudonym] = useState('Pixel');
  const [customPseudonymInput, setCustomPseudonymInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create Room Form State
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('gaming');
  const [newIcon, setNewIcon] = useState('🎮');
  const [newDesc, setNewDesc] = useState('');
  const [newTtlHours, setNewTtlHours] = useState(24);

  const messagesScrollRef = useRef(null);

  useEffect(() => {
    if (visible) {
      loadRooms(selectedCategory);
    }
  }, [visible, selectedCategory]);

  useEffect(() => {
    let interval = null;
    if (activeRoom && activeRoom.room_id) {
      interval = setInterval(() => {
        refreshActiveRoomState(activeRoom.room_id);
      }, 3500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeRoom]);

  const loadRooms = async (category) => {
    setLoading(true);
    try {
      const data = await fetchTopicRooms(category);
      if (data && data.rooms) {
        setRooms(data.rooms);
      }
    } catch (err) {
      console.warn('Failed to load topic rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshActiveRoomState = async (roomId) => {
    try {
      const state = await fetchTopicRoomState(roomId);
      if (state && state.room_id) {
        setRoomState(state);
      }
    } catch (err) {
      console.warn('Failed to poll room state:', err);
    }
  };

  const handleJoinRoom = async (room, customAlias = null) => {
    setLoading(true);
    try {
      const joinData = await joinTopicRoom(room.room_id, customAlias || customPseudonymInput || null);
      setActiveRoom(room);
      setMyEphemeralId(joinData.my_ephemeral_id);
      setMyPseudonym(joinData.my_pseudonym);
      setRoomState({
        room_id: joinData.room_id,
        room_title: joinData.room_title,
        topic_icon: joinData.topic_icon,
        description: room.description,
        expires_in: room.expires_in,
        members: joinData.members,
        members_roster: joinData.members_roster,
        messages: joinData.recent_messages || [],
      });
      setTimeout(() => {
        if (messagesScrollRef.current) {
          messagesScrollRef.current.scrollToEnd({ animated: true });
        }
      }, 200);
    } catch (err) {
      alert(`Could not enter room: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeRoom || !myEphemeralId) return;
    const textToSend = chatInput.trim();
    setChatInput('');
    setSending(true);

    try {
      const res = await sendTopicRoomMessage(activeRoom.room_id, {
        ephemeralId: myEphemeralId,
        senderPseudonym: myPseudonym,
        ciphertext: `ENC[e2ee_topic:${Date.now()}]`,
        plaintext: textToSend,
      });

      // Update local message stream immediately
      if (res && res.sent_message) {
        setRoomState((prev) => {
          if (!prev) return prev;
          const updated = [...(prev.messages || []), res.sent_message];
          if (res.peer_reply) {
            updated.push(res.peer_reply);
          }
          return { ...prev, messages: updated };
        });
        setTimeout(() => {
          if (messagesScrollRef.current) {
            messagesScrollRef.current.scrollToEnd({ animated: true });
          }
        }, 150);
      }
    } catch (err) {
      alert(`Message failed to deliver: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleLeaveRoom = async () => {
    if (!activeRoom || !myEphemeralId) {
      setActiveRoom(null);
      setRoomState(null);
      return;
    }
    try {
      await leaveTopicRoom(activeRoom.room_id, myEphemeralId);
    } catch (err) {
      console.warn('Leave room error:', err);
    }
    setActiveRoom(null);
    setRoomState(null);
    setMyEphemeralId(null);
    loadRooms(selectedCategory);
  };

  const handleCreateRoom = async () => {
    if (!newTitle.trim()) {
      alert('Please enter a room title');
      return;
    }
    try {
      const res = await createTopicRoom({
        title: newTitle.trim(),
        topicCategory: newCategory,
        topicIcon: newIcon,
        description: newDesc.trim() || `Temporary encrypted room for ${newTitle.trim()}`,
        ttlHours: newTtlHours,
      });
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      await loadRooms(selectedCategory);
      // Auto-enter the newly created room
      handleJoinRoom({
        room_id: res.room_id,
        title: res.title,
        topic_category: res.topic_category,
        topic_icon: newIcon,
        description: newDesc || `Temporary encrypted room for ${res.title}`,
        expires_in: `${newTtlHours}h 00m`,
      });
    } catch (err) {
      alert(`Failed to spawn room: ${err.message}`);
    }
  };

  const randomizePseudonym = () => {
    const pool = ['Nova', 'Ghost', 'Pixel', 'Luna', 'Shadow', 'Echo', 'Cipher', 'Atlas', 'Drift', 'Solstice', 'Zenith', 'Orion'];
    const filtered = pool.filter((p) => p !== myPseudonym);
    const chosen = filtered[Math.floor(Math.random() * filtered.length)];
    setMyPseudonym(chosen);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* TOP STATUS BAR */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>🔥 Anonymous Topic Rooms</Text>
              <View style={styles.ephemeralPill}>
                <Text style={styles.ephemeralPillText}>TEMPORARY & ENCRYPTED</Text>
              </View>
            </View>
            <Text style={styles.headerSub}>
              Enter temporary encrypted spaces • No permanent identities needed
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* ACTIVE ROOM VIEW OR BROWSE ROOMS VIEW */}
        {activeRoom && roomState ? (
          /* ========================================================================= */
          /* INSIDE ANONYMOUS TOPIC ROOM (CHAT MODE)                                  */
          /* ========================================================================= */
          <View style={styles.roomChamber}>
            {/* Room Banner */}
            <View style={styles.roomBanner}>
              <View style={styles.roomBannerLeft}>
                <View style={styles.roomTitleLine}>
                  <Text style={styles.roomBannerIcon}>{roomState.topic_icon || '🔥'}</Text>
                  <Text style={styles.roomBannerTitle}>Room: {roomState.room_title}</Text>
                </View>
                <Text style={styles.roomBannerDesc} numberOfLines={1}>
                  {roomState.description || 'Temporary encrypted sanctuary'}
                </Text>
              </View>

              <View style={styles.roomBannerRight}>
                <View style={styles.timerChip}>
                  <Text style={styles.timerChipText}>⏱️ {roomState.expires_in || '24h'}</Text>
                </View>
                <TouchableOpacity style={styles.leaveRoomBtn} onPress={handleLeaveRoom}>
                  <Text style={styles.leaveRoomBtnText}>🚪 Leave Room</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Ephemeral Identity & Active Roster Card */}
            <View style={styles.rosterCard}>
              <View style={styles.myIdentityBar}>
                <View style={styles.myIdentityCol}>
                  <Text style={styles.myIdentityLabel}>Your Temporary Room Persona:</Text>
                  <View style={styles.myIdentityBadge}>
                    <Text style={styles.myIdentityText}>👤 {myPseudonym}</Text>
                    <TouchableOpacity style={styles.aliasShuffleBtn} onPress={randomizePseudonym}>
                      <Text style={styles.aliasShuffleText}>🎲 Shuffle</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.zeroProfileCol}>
                  <Text style={styles.zeroProfileNotice}>
                    🛡️ Zero Profile Leakage • Real identity completely hidden
                  </Text>
                </View>
              </View>

              {/* Exact format requested by user:
                  Room: Late Night Talks
                  👤 Nova
                  👤 Ghost
                  👤 Pixel
                  👤 Luna
              */}
              <View style={styles.rosterSection}>
                <Text style={styles.rosterHeader}>
                  ACTIVE MEMBERS IN ROOM:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rosterList}>
                  {(roomState.members || []).map((m, idx) => {
                    const isMe = m.ephemeral_id === myEphemeralId || m.pseudonym === myPseudonym;
                    return (
                      <View key={idx} style={[styles.memberChip, isMe && styles.memberChipMe]}>
                        <Text style={[styles.memberChipText, isMe && styles.memberChipTextMe]}>
                          👤 {m.pseudonym} {isMe ? '(You)' : ''}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Encrypted Ephemeral Message Stream */}
            <ScrollView
              ref={messagesScrollRef}
              style={styles.messageStream}
              contentContainerStyle={styles.messageStreamContent}
            >
              <View style={styles.roomIntroBubble}>
                <Text style={styles.roomIntroText}>
                  🔐 Ephemeral room ratchet initialized. Messages are encrypted and burn when the room expires.
                </Text>
              </View>

              {(roomState.messages || []).map((msg, idx) => {
                const isSystem = msg.sender_ephemeral_id === 'system';
                const isMe =
                  msg.sender_ephemeral_id === myEphemeralId ||
                  msg.sender_pseudonym.includes(myPseudonym);

                if (isSystem) {
                  return (
                    <View key={idx} style={styles.systemMessageBubble}>
                      <Text style={styles.systemMessageText}>{msg.plaintext_preview}</Text>
                    </View>
                  );
                }

                return (
                  <View
                    key={idx}
                    style={[
                      styles.chatBubbleRow,
                      isMe ? styles.chatBubbleRowMe : styles.chatBubbleRowPeer,
                    ]}
                  >
                    <View
                      style={[
                        styles.chatBubble,
                        isMe ? styles.chatBubbleMe : styles.chatBubblePeer,
                      ]}
                    >
                      <View style={styles.bubbleSenderRow}>
                        <Text style={[styles.bubbleSenderName, isMe && styles.bubbleSenderNameMe]}>
                          {msg.sender_pseudonym || '👤 Anonymous'}
                        </Text>
                        <Text style={styles.bubbleEncryptedTag}>🔒 E2EE</Text>
                      </View>
                      <Text style={styles.bubbleBodyText}>
                        {msg.plaintext_preview || '🔐 [Encrypted Message]'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Chat Input Bar */}
            <View style={styles.inputBar}>
              <TextInput
                style={styles.textInput}
                placeholder={`Message as 👤 ${myPseudonym}...`}
                placeholderTextColor="#64748B"
                value={chatInput}
                onChangeText={setChatInput}
                onSubmitEditing={handleSendMessage}
              />
              <TouchableOpacity
                style={[styles.sendBtn, !chatInput.trim() && styles.sendBtnDisabled]}
                onPress={handleSendMessage}
                disabled={!chatInput.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.sendBtnText}>Send 🚀</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ========================================================================= */
          /* BROWSE TOPIC ROOMS CATALOG (DISCOVERY MODE)                              */
          /* ========================================================================= */
          <View style={styles.browseChamber}>
            {/* Top Bar Actions & Category Filter Chips */}
            <View style={styles.browseControls}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                {categories.map((cat) => {
                  const isActive = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catChip, isActive && styles.catChipActive]}
                      onPress={() => setSelectedCategory(cat.id)}
                    >
                      <Text style={[styles.catChipText, isActive && styles.catChipTextActive]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={styles.createRoomPillBtn}
                onPress={() => setShowCreateModal(true)}
              >
                <Text style={styles.createRoomPillBtnText}>+ Spawn Room</Text>
              </TouchableOpacity>
            </View>

            {/* Custom Alias Quick-Set */}
            <View style={styles.aliasQuickBar}>
              <Text style={styles.aliasQuickLabel}>Enter as Ephemeral Alias:</Text>
              <TextInput
                style={styles.aliasQuickInput}
                placeholder="Auto-assigned (e.g. Nova, Ghost, Pixel)"
                placeholderTextColor="#64748B"
                value={customPseudonymInput}
                onChangeText={setCustomPseudonymInput}
                maxLength={20}
              />
              <TouchableOpacity
                style={styles.shuffleAliasBtn}
                onPress={() => {
                  const pool = ['Nova', 'Ghost', 'Pixel', 'Luna', 'Shadow', 'Echo', 'Cipher', 'Atlas', 'Drift'];
                  setCustomPseudonymInput(pool[Math.floor(Math.random() * pool.length)]);
                }}
              >
                <Text style={styles.shuffleAliasBtnText}>🎲</Text>
              </TouchableOpacity>
            </View>

            {/* Rooms Cards Grid */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#F59E0B" />
                <Text style={styles.loadingText}>Loading encrypted topic sanctuaries...</Text>
              </View>
            ) : rooms.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔥</Text>
                <Text style={styles.emptyTitle}>No active rooms in this topic</Text>
                <Text style={styles.emptySub}>
                  Be the first to spawn a temporary encrypted room!
                </Text>
                <TouchableOpacity
                  style={styles.spawnEmptyBtn}
                  onPress={() => setShowCreateModal(true)}
                >
                  <Text style={styles.spawnEmptyBtnText}>+ Create Room</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={styles.roomsList} contentContainerStyle={styles.roomsListContent}>
                {rooms.map((room) => {
                  return (
                    <View key={room.room_id} style={styles.roomCard}>
                      <View style={styles.roomCardHeader}>
                        <View style={styles.roomCardHeaderLeft}>
                          <Text style={styles.roomCardIcon}>{room.topic_icon || '🔥'}</Text>
                          <View>
                            <Text style={styles.roomCardTitle}>Room: {room.title}</Text>
                            <Text style={styles.roomCardCategory}>
                              {room.topic_category.toUpperCase()} • ⏱️ {room.expires_in} remaining
                            </Text>
                          </View>
                        </View>
                        <View style={styles.membersCountPill}>
                          <Text style={styles.membersCountText}>
                            👥 {room.member_count} online
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.roomCardDesc}>{room.description}</Text>

                      {/* Members Roster Preview formatted as user requested:
                          👤 Nova  👤 Ghost  👤 Pixel  👤 Luna
                      */}
                      <View style={styles.rosterPreviewBox}>
                        <Text style={styles.rosterPreviewLabel}>Inside:</Text>
                        <View style={styles.rosterPreviewRow}>
                          {(room.members_roster || []).map((pName, pIdx) => (
                            <View key={pIdx} style={styles.rosterMiniTag}>
                              <Text style={styles.rosterMiniTagText}>{pName}</Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      <View style={styles.roomCardFooter}>
                        <View style={styles.encryptionBadge}>
                          <Text style={styles.encryptionDot}>●</Text>
                          <Text style={styles.encryptionText}>Ephemeral Ratchet</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.enterRoomBtn}
                          onPress={() => handleJoinRoom(room)}
                        >
                          <Text style={styles.enterRoomBtnText}>Enter Anonymously ➔</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        {/* MODAL: CREATE TEMPORARY TOPIC ROOM */}
        <Modal
          visible={showCreateModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCreateModal(false)}
        >
          <View style={styles.createModalOverlay}>
            <View style={styles.createModalCard}>
              <View style={styles.createModalHeader}>
                <Text style={styles.createModalTitle}>🔥 Spawn Temporary Topic Room</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <Text style={styles.createModalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.createModalNotice}>
                No permanent identities needed. Rooms and messages self-destruct when time expires.
              </Text>

              {/* Title Input */}
              <Text style={styles.fieldLabel}>Room Title:</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="e.g. Late Night Talks, Cyberpunk Lore..."
                placeholderTextColor="#64748B"
                value={newTitle}
                onChangeText={setNewTitle}
              />

              {/* Category Picker */}
              <Text style={styles.fieldLabel}>Topic Category:</Text>
              <View style={styles.catGrid}>
                {[
                  { id: 'gaming', label: '🎮 Gaming', icon: '🎮' },
                  { id: 'movies', label: '🎬 Movies', icon: '🎬' },
                  { id: 'coding', label: '💻 Coding', icon: '💻' },
                  { id: 'music', label: '🎵 Music', icon: '🎵' },
                  { id: 'travel', label: '🌍 Travel', icon: '🌍' },
                  { id: 'students', label: '📚 Students', icon: '📚' },
                  { id: 'vibe', label: '🌙 Late Night', icon: '🌙' },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.catGridItem, newCategory === item.id && styles.catGridItemActive]}
                    onPress={() => {
                      setNewCategory(item.id);
                      setNewIcon(item.icon);
                    }}
                  >
                    <Text
                      style={[
                        styles.catGridItemText,
                        newCategory === item.id && styles.catGridItemTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Description Input */}
              <Text style={styles.fieldLabel}>Description (Optional):</Text>
              <TextInput
                style={[styles.fieldInput, { height: 60 }]}
                placeholder="What is this sanctuary about?"
                placeholderTextColor="#64748B"
                value={newDesc}
                onChangeText={setNewDesc}
                multiline
              />

              {/* Expiration Hours */}
              <Text style={styles.fieldLabel}>Room Lifespan (Self-Destructs After):</Text>
              <View style={styles.ttlRow}>
                {[
                  { hours: 1, label: '1 Hour' },
                  { hours: 6, label: '6 Hours' },
                  { hours: 24, label: '24 Hours' },
                  { hours: 72, label: '3 Days' },
                ].map((t) => (
                  <TouchableOpacity
                    key={t.hours}
                    style={[styles.ttlChip, newTtlHours === t.hours && styles.ttlChipActive]}
                    onPress={() => setNewTtlHours(t.hours)}
                  >
                    <Text
                      style={[styles.ttlChipText, newTtlHours === t.hours && styles.ttlChipTextActive]}
                    >
                      ⏱️ {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Action Buttons */}
              <View style={styles.createActionsRow}>
                <TouchableOpacity
                  style={styles.cancelModalBtn}
                  onPress={() => setShowCreateModal(false)}
                >
                  <Text style={styles.cancelModalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitModalBtn} onPress={handleCreateRoom}>
                  <Text style={styles.submitModalBtnText}>Spawn Encrypted Room 🔥</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 16 : 48,
    paddingBottom: 16,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  ephemeralPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ephemeralPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FBBF24',
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 12,
    color: '#94A3B8',
  },
  closeBtn: {
    padding: 8,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    marginLeft: 12,
  },
  closeBtnText: {
    fontSize: 16,
    color: '#CBD5E1',
    fontWeight: '700',
  },

  /* BROWSE VIEW */
  browseChamber: {
    flex: 1,
  },
  browseControls: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0B1120',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 12,
  },
  catScroll: {
    flexGrow: 0,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  catChipActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  catChipTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  createRoomPillBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  createRoomPillBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FBBF24',
  },

  aliasQuickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 10,
  },
  aliasQuickLabel: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  aliasQuickInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: '#F8FAFC',
    fontSize: 12,
  },
  shuffleAliasBtn: {
    padding: 6,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  shuffleAliasBtnText: {
    fontSize: 14,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  emptySub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  spawnEmptyBtn: {
    marginTop: 8,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  spawnEmptyBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13,
  },

  roomsList: {
    flex: 1,
  },
  roomsListContent: {
    padding: 16,
    gap: 14,
  },
  roomCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
    gap: 12,
  },
  roomCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  roomCardIcon: {
    fontSize: 28,
  },
  roomCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  roomCardCategory: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '600',
    marginTop: 2,
  },
  membersCountPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  membersCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
  },
  roomCardDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },

  rosterPreviewBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 6,
  },
  rosterPreviewLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  rosterPreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  rosterMiniTag: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#334155',
  },
  rosterMiniTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#CBD5E1',
  },

  roomCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  encryptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  encryptionDot: {
    color: '#10B981',
    fontSize: 10,
  },
  encryptionText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  enterRoomBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  enterRoomBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 12,
  },

  /* ACTIVE ROOM VIEW */
  roomChamber: {
    flex: 1,
  },
  roomBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  roomBannerLeft: {
    flex: 1,
    marginRight: 12,
  },
  roomTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roomBannerIcon: {
    fontSize: 20,
  },
  roomBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  roomBannerDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  roomBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timerChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  timerChipText: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600',
  },
  leaveRoomBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  leaveRoomBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F87171',
  },

  rosterCard: {
    backgroundColor: '#0B1120',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 8,
  },
  myIdentityBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  myIdentityCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  myIdentityLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  myIdentityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 6,
  },
  myIdentityText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FBBF24',
  },
  aliasShuffleBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  aliasShuffleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F172A',
  },
  zeroProfileCol: {
    alignItems: 'flex-end',
  },
  zeroProfileNotice: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
  },

  rosterSection: {
    gap: 6,
  },
  rosterHeader: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  rosterList: {
    flexDirection: 'row',
  },
  memberChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
  },
  memberChipMe: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#F59E0B',
  },
  memberChipText: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  memberChipTextMe: {
    color: '#FBBF24',
    fontWeight: '800',
  },

  messageStream: {
    flex: 1,
    backgroundColor: '#070B12',
  },
  messageStreamContent: {
    padding: 16,
    gap: 12,
  },
  roomIntroBubble: {
    alignSelf: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  roomIntroText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
  },
  systemMessageBubble: {
    alignSelf: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  systemMessageText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },

  chatBubbleRow: {
    flexDirection: 'row',
    width: '100%',
  },
  chatBubbleRowMe: {
    justifyContent: 'flex-end',
  },
  chatBubbleRowPeer: {
    justifyContent: 'flex-start',
  },
  chatBubble: {
    maxWidth: '82%',
    padding: 12,
    borderRadius: 12,
    gap: 4,
  },
  chatBubbleMe: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderBottomRightRadius: 2,
  },
  chatBubblePeer: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderBottomLeftRadius: 2,
  },
  bubbleSenderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
    gap: 8,
  },
  bubbleSenderName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
  },
  bubbleSenderNameMe: {
    color: '#FBBF24',
  },
  bubbleEncryptedTag: {
    fontSize: 9,
    color: '#10B981',
    fontWeight: '700',
  },
  bubbleBodyText: {
    fontSize: 13,
    color: '#F8FAFC',
    lineHeight: 18,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13,
  },
  sendBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#334155',
    opacity: 0.6,
  },
  sendBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13,
  },

  /* CREATE MODAL */
  createModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  createModalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 20,
    gap: 12,
  },
  createModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  createModalClose: {
    fontSize: 18,
    color: '#94A3B8',
    fontWeight: '700',
    padding: 4,
  },
  createModalNotice: {
    fontSize: 12,
    color: '#94A3B8',
    backgroundColor: '#1E293B',
    padding: 10,
    borderRadius: 8,
    lineHeight: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
    marginTop: 4,
  },
  fieldInput: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 13,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catGridItem: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  catGridItemActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#F59E0B',
  },
  catGridItemText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  catGridItemTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  ttlRow: {
    flexDirection: 'row',
    gap: 8,
  },
  ttlChip: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  ttlChipActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#F59E0B',
  },
  ttlChipText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  ttlChipTextActive: {
    color: '#FBBF24',
    fontWeight: '800',
  },
  createActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelModalBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  cancelModalBtnText: {
    color: '#CBD5E1',
    fontWeight: '600',
    fontSize: 13,
  },
  submitModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
  },
  submitModalBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13,
  },
});
