import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  Platform
} from 'react-native';
import {
  fetchInstantDateManifest,
  startInstant5MinDate,
  fetchInstantDateRoom,
  sendInstantDateMessage,
  submitInstantDateDecision,
  cancelInstantDateQueue
} from '../services/api';

export default function Instant5MinDateModal({
  visible,
  onClose,
  currentUserId,
  onFullChatUnlocked,
  onOpenSecondChance
}) {
  const [loading, setLoading] = useState(false);
  const [manifest, setManifest] = useState(null);
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes = 300s
  const [showDecisionView, setShowDecisionView] = useState(false);
  const [userDecision, setUserDecision] = useState(null);
  const [decisionResult, setDecisionResult] = useState(null);
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [starterPrompts, setStarterPrompts] = useState([]);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef(null);

  // Pulsing glow animation for the 5-min timer
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 900,
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true
        })
      ])
    ).start();
  }, [pulseAnim]);

  // Load manifest & auto-start if opened
  useEffect(() => {
    if (visible) {
      loadManifestAndStart();
    } else {
      // reset state on close
      setRoom(null);
      setMessages([]);
      setInputText('');
      setShowDecisionView(false);
      setUserDecision(null);
      setDecisionResult(null);
    }
  }, [visible]);

  // Timer countdown
  // Timer countdown (only runs when active)
  useEffect(() => {
    if (!room || room.status !== 'active' || showDecisionView || decisionResult) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setShowDecisionView(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [room, showDecisionView, decisionResult]);

  // Real-time synchronization poll for queue matching and live messages between real users
  useEffect(() => {
    if (!room || !visible || showDecisionView || decisionResult) return;

    const pollInterval = setInterval(async () => {
      try {
        const update = await fetchInstantDateRoom(room.room_id);
        if (update && update.room) {
          if (update.room.status === 'active' && room.status === 'waiting') {
            setRoom(update.room);
            setTimeLeft(update.remaining_seconds || 300);
            setMessages(update.messages || []);
          } else if (update.messages && update.messages.length > messages.length) {
            setMessages(update.messages);
            setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
          }
        }
      } catch (err) {
        // silent sync error
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [room, visible, showDecisionView, decisionResult, messages.length]);

  const loadManifestAndStart = async () => {
    try {
      setLoading(true);
      const manifestRes = await fetchInstantDateManifest();
      setManifest(manifestRes.manifest);
      setStarterPrompts(manifestRes.starter_prompts || []);

      // Start or join instant date chamber
      const startRes = await startInstant5MinDate(currentUserId || 'user_demo_me');
      setRoom(startRes.room);
      setTimeLeft(startRes.duration_seconds || 300);
      setMessages(startRes.room?.messages || []);
      setLoading(false);
    } catch (err) {
      console.warn('Error starting 5-minute date:', err);
      setLoading(false);
    }
  };

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text || !text.trim() || !room || sending) return;

    try {
      setSending(true);
      setInputText('');
      const res = await sendInstantDateMessage(room.room_id, currentUserId || 'user_demo_me', text.trim());
      if (res.sent_message) {
        // Real user message only, no fake bot reply
        setMessages(prev => [...prev, res.sent_message]);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 120);
      }
      setSending(false);
    } catch (err) {
      console.warn('Failed to send instant date message:', err);
      setSending(false);
    }
  };

  const handleDecision = async (decisionKey) => {
    if (!room || submittingDecision) return;
    try {
      setSubmittingDecision(true);
      setUserDecision(decisionKey);
      const res = await submitInstantDateDecision(room.room_id, currentUserId || 'user_demo_me', decisionKey);
      setDecisionResult(res);
      setSubmittingDecision(false);
    } catch (err) {
      console.warn('Failed to submit decision:', err);
      setSubmittingDecision(false);
    }
  };

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isUrgent = timeLeft < 60;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          {/* Top Bar Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerBadge}>⚡ INSTANT DATE</Text>
              <Text style={styles.headerTitle}>Quick Date Chamber</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ⚡ Quick Date 4-Pillar Spec Banner */}
          <View style={styles.specCard}>
            <Text style={styles.specTitle}>Quick Date</Text>
            <View style={styles.specBadgesRow}>
              <View style={[styles.specPill, styles.specPillTimer]}>
                <Text style={styles.specPillEmoji}>⏱️</Text>
                <Text style={styles.specPillText}>5 MINUTES</Text>
              </View>
              <View style={styles.specPill}>
                <Text style={styles.specPillEmoji}>🎯</Text>
                <Text style={styles.specPillText}>ONE MATCH</Text>
              </View>
              <View style={styles.specPill}>
                <Text style={styles.specPillEmoji}>👤</Text>
                <Text style={styles.specPillText}>NO PROFILE</Text>
              </View>
              <View style={styles.specPill}>
                <Text style={styles.specPillEmoji}>📷</Text>
                <Text style={styles.specPillText}>NO PHOTO</Text>
              </View>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#f59e0b" />
              <Text style={styles.loadingText}>Searching for real online partner...</Text>
              <Text style={styles.loadingSub}>Zero profiles. Zero photos. Pure conversation.</Text>
            </View>
          ) : room?.status === 'waiting' ? (
            /* Real User Waiting Queue Screen */
            <View style={styles.waitingContainer}>
              <View style={styles.waitingRadarBox}>
                <Text style={{ fontSize: 48, marginBottom: 12 }}>⚡</Text>
                <Text style={styles.waitingTitle}>Waiting for an Anonymous Partner...</Text>
                <Text style={styles.waitingSub}>
                  Zero demo bots. The chamber begins the 5-minute countdown as soon as another real user joins.
                </Text>
                <View style={styles.waitingInfoCard}>
                  <Text style={styles.waitingInfoBullet}>🟢 Queue status: Active & searching...</Text>
                  <Text style={styles.waitingInfoBullet}>⚡ Pure anonymous: No profiles or photos revealed.</Text>
                  <Text style={styles.waitingInfoBullet}>💡 Tip: Open this app in another window or incognito tab to test instant pairing!</Text>
                </View>
                <ActivityIndicator size="large" color="#F43F5E" style={{ marginVertical: 22 }} />
                <TouchableOpacity
                  style={styles.cancelQueueBtn}
                  onPress={async () => {
                    await cancelInstantDateQueue(currentUserId || 'user_demo_me');
                    onClose();
                  }}
                >
                  <Text style={styles.cancelQueueText}>✕ Cancel Queue Search</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : decisionResult ? (
            /* Outcome Resolution Screen */
            <View style={styles.outcomeContainer}>
              {decisionResult.outcome === 'full_chat_unlocked' ? (
                <View style={styles.outcomeSuccessBox}>
                  <Text style={styles.outcomeEmoji}>❤️✨❤️</Text>
                  <Text style={styles.outcomeTitle}>MUTUAL CONTINUE!</Text>
                  <Text style={styles.outcomeHighlight}>Full Chat Unlocked</Text>
                  <Text style={styles.outcomeDescription}>
                    Both you and your match chose ❤️ Continue. The 5-minute barrier has melted away.
                  </Text>
                  <View style={styles.peerIdBadge}>
                    <Text style={styles.peerIdLabel}>Matched With</Text>
                    <Text style={styles.peerIdVal}>{room?.peer_ghost || '⚡ Anonymous Spark'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.openChatBtn}
                    onPress={() => {
                      if (onFullChatUnlocked && room) {
                        onFullChatUnlocked({
                          id: room.peer_user_id,
                          name: room.peer_ghost,
                          is_date: true
                        });
                      }
                      onClose();
                    }}
                  >
                    <Text style={styles.openChatBtnText}>💬 Open Full Chat Now</Text>
                  </TouchableOpacity>
                </View>
              ) : decisionResult.outcome === 'friends_connected' ? (
                <View style={styles.outcomeFriendBox}>
                  <Text style={styles.outcomeEmoji}>🤝</Text>
                  <Text style={styles.outcomeTitle}>Friends Connected</Text>
                  <Text style={styles.outcomeDescription}>
                    You both chose 🤝 Friends! You can continue messaging as casual anonymous friends.
                  </Text>
                  <TouchableOpacity
                    style={styles.friendBtn}
                    onPress={() => {
                      if (onFullChatUnlocked && room) {
                        onFullChatUnlocked({
                          id: room.peer_user_id,
                          name: room.peer_ghost,
                          is_friend: true
                        });
                      }
                      onClose();
                    }}
                  >
                    <Text style={styles.openChatBtnText}>🤝 Message Friend</Text>
                  </TouchableOpacity>
                </View>
              ) : decisionResult.outcome === 'second_chance' ? (
                <View style={styles.outcomeSecondChanceBox}>
                  <Text style={styles.outcomeEmoji}>🔄</Text>
                  <Text style={styles.outcomeTitle}>SECOND CHANCE</Text>
                  <Text style={styles.outcomeHighlightPurple}>Connection Safely Saved</Text>
                  <Text style={styles.outcomeDescription}>
                    Both you and your match chose "Maybe later". The connection has been safely placed into Second Chance.
                  </Text>
                  <View style={styles.peerIdBadge}>
                    <Text style={styles.peerIdLabel}>Dormant Match</Text>
                    <Text style={styles.peerIdVal}>{room?.peer_ghost || '⚡ Anonymous Spark'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.secondChanceVaultBtn}
                    onPress={() => {
                      onClose();
                      if (onOpenSecondChance) onOpenSecondChance();
                    }}
                  >
                    <Text style={styles.secondChanceVaultBtnText}>🔄 View Second Chance Vault</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.exitCloseBtn} onPress={onClose}>
                    <Text style={styles.exitCloseBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.outcomeExitBox}>
                  <Text style={styles.outcomeEmoji}>👋</Text>
                  <Text style={styles.outcomeTitle}>Date Ended</Text>
                  <Text style={styles.outcomeDescription}>
                    The 5-Minute Date has ended safely. No personal info, photos, or logs were exposed.
                  </Text>
                  <TouchableOpacity
                    style={styles.restartBtn}
                    onPress={() => loadManifestAndStart()}
                  >
                    <Text style={styles.restartBtnText}>⚡ Try Another 5-Minute Date</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.exitCloseBtn} onPress={onClose}>
                    <Text style={styles.exitCloseBtnText}>Close</Text>
                  </TouchableOpacity>
                </View>
              )}

            </View>
          ) : showDecisionView ? (
            /* Decision Selection Modal View */
            <View style={styles.decisionModalView}>
              <View style={styles.decisionHeader}>
                <Text style={styles.decisionClockIcon}>⚡</Text>
                <Text style={styles.decisionClockTitle}>5 MINUTES COMPLETE</Text>
                <Text style={styles.decisionClockSub}>Time is up! Choose your connection path:</Text>
              </View>

              <View style={styles.decisionRuleNotice}>
                <Text style={styles.decisionRuleBold}>Rule:</Text>
                <Text style={styles.decisionRuleText}>
                  "If both select Continue: Full chat unlocked"
                </Text>
              </View>

              {submittingDecision ? (
                <View style={styles.submittingDecisionBox}>
                  <ActivityIndicator size="small" color="#ec4899" />
                  <Text style={styles.submittingDecisionText}>Exchanging anonymous decisions...</Text>
                </View>
              ) : (
                <View style={styles.decisionButtonsContainer}>
                  {/* ❤️ Continue */}
                  <TouchableOpacity
                    style={[styles.decisionActionBtn, styles.btnContinue]}
                    onPress={() => handleDecision('continue')}
                  >
                    <View style={styles.decisionBtnLeft}>
                      <Text style={styles.decisionActionEmoji}>❤️</Text>
                      <View>
                        <Text style={styles.decisionActionTitle}>Continue</Text>
                        <Text style={styles.decisionActionSub}>Both select = Full chat unlocked</Text>
                      </View>
                    </View>
                    <Text style={styles.decisionActionArrow}>→</Text>
                  </TouchableOpacity>

                  {/* 🤝 Friends */}
                  <TouchableOpacity
                    style={[styles.decisionActionBtn, styles.btnFriends]}
                    onPress={() => handleDecision('friends')}
                  >
                    <View style={styles.decisionBtnLeft}>
                      <Text style={styles.decisionActionEmoji}>🤝</Text>
                      <View>
                        <Text style={styles.decisionActionTitle}>Friends</Text>
                        <Text style={styles.decisionActionSub}>Keep connecting as platonic pals</Text>
                      </View>
                    </View>
                    <Text style={styles.decisionActionArrow}>→</Text>
                  </TouchableOpacity>

                  {/* 🔄 Maybe later */}
                  <TouchableOpacity
                    style={[styles.decisionActionBtn, styles.btnMaybeLater]}
                    onPress={() => handleDecision('maybe_later')}
                  >
                    <View style={styles.decisionBtnLeft}>
                      <Text style={styles.decisionActionEmoji}>🔄</Text>
                      <View>
                        <Text style={styles.decisionActionTitle}>Maybe later</Text>
                        <Text style={styles.decisionActionSub}>Both select = Placed into Second Chance</Text>
                      </View>
                    </View>
                    <Text style={styles.decisionActionArrow}>→</Text>
                  </TouchableOpacity>

                  {/* 👋 Exit */}
                  <TouchableOpacity
                    style={[styles.decisionActionBtn, styles.btnExit]}
                    onPress={() => handleDecision('exit')}
                  >
                    <View style={styles.decisionBtnLeft}>
                      <Text style={styles.decisionActionEmoji}>👋</Text>
                      <View>
                        <Text style={styles.decisionActionTitle}>Exit</Text>
                        <Text style={styles.decisionActionSub}>No explanation required. Zero trace.</Text>
                      </View>
                    </View>
                    <Text style={styles.decisionActionArrow}>→</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            /* Active 5-Minute Date Chamber */
            <View style={styles.chamberContainer}>
              {/* Top Countdown & Status Strip */}
              <View style={styles.timerStrip}>
                <View style={styles.matchPill}>
                  <View style={styles.activeDot} />
                  <Text style={styles.matchPillText}>{room?.peer_ghost || '⚡ Anonymous Spark'}</Text>
                </View>

                <Animated.View
                  style={[
                    styles.countdownBadge,
                    isUrgent && styles.countdownBadgeUrgent,
                    { transform: [{ scale: isUrgent ? pulseAnim : 1 }] }
                  ]}
                >
                  <Text style={styles.countdownIcon}>{isUrgent ? '🔥' : '⏳'}</Text>
                  <Text style={[styles.countdownText, isUrgent && styles.countdownTextUrgent]}>
                    {formatTimer(timeLeft)}
                  </Text>
                </Animated.View>

                <TouchableOpacity
                  style={styles.decideEarlyBtn}
                  onPress={() => setShowDecisionView(true)}
                >
                  <Text style={styles.decideEarlyBtnText}>Decide Now</Text>
                </TouchableOpacity>
              </View>

              {/* Chat Message Scroll */}
              <ScrollView
                ref={scrollViewRef}
                style={styles.chatScroll}
                contentContainerStyle={styles.chatScrollContent}
              >
                {messages.map((m) => {
                  const isMe = m.sender_id === (currentUserId || 'user_demo_me');
                  const isSystem = m.sender_id === 'system';

                  if (isSystem) {
                    return (
                      <View key={m.msg_id} style={styles.systemBubble}>
                        <Text style={styles.systemBubbleText}>{m.text}</Text>
                      </View>
                    );
                  }

                  return (
                    <View
                      key={m.msg_id}
                      style={[
                        styles.messageRow,
                        isMe ? styles.messageRowMe : styles.messageRowPeer
                      ]}
                    >
                      <View
                        style={[
                          styles.messageBubble,
                          isMe ? styles.messageBubbleMe : styles.messageBubblePeer
                        ]}
                      >
                        <Text style={styles.senderGhost}>{m.sender_ghost}</Text>
                        <Text style={styles.messageText}>{m.text}</Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Icebreaker Prompts Row */}
              <View style={styles.icebreakerBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.promptScroll}>
                  {starterPrompts.map((prompt, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.promptChip}
                      onPress={() => handleSendMessage(prompt)}
                    >
                      <Text style={styles.promptChipText}>💡 {prompt}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Input Bar */}
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Say anything... 5 minutes only"
                  placeholderTextColor="#64748b"
                  value={inputText}
                  onChangeText={setInputText}
                  onSubmitEditing={() => handleSendMessage()}
                  returnKeyType="send"
                />
                <TouchableOpacity
                  style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                  onPress={() => handleSendMessage()}
                  disabled={!inputText.trim() || sending}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#030712" />
                  ) : (
                    <Text style={styles.sendBtnText}>⚡</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  container: {
    width: '100%',
    maxWidth: 580,
    height: '92%',
    maxHeight: 740,
    backgroundColor: '#090d16',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#f59e0b44',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 60px rgba(245, 158, 11, 0.2)'
      }
    })
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0d1322'
  },
  headerTitleWrap: {
    flexDirection: 'column'
  },
  headerBadge: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700'
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: 'bold'
  },
  specCard: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  specTitle: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
    textAlign: 'center'
  },
  specBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6
  },
  specPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  specPillTimer: {
    backgroundColor: '#78350f44',
    borderColor: '#f59e0b88'
  },
  specPillEmoji: {
    fontSize: 11,
    marginRight: 4
  },
  specPillText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  loadingText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    textAlign: 'center'
  },
  loadingSub: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center'
  },
  chamberContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  timerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0a0f1d',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6
  },
  matchPillText: {
    color: '#f1f5f9',
    fontSize: 12,
    fontWeight: '600'
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#172554',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3b82f6'
  },
  countdownBadgeUrgent: {
    backgroundColor: '#7f1d1d',
    borderColor: '#ef4444'
  },
  countdownIcon: {
    fontSize: 13,
    marginRight: 5
  },
  countdownText: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
  },
  countdownTextUrgent: {
    color: '#fca5a5'
  },
  decideEarlyBtn: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12
  },
  decideEarlyBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700'
  },
  chatScroll: {
    flex: 1,
    backgroundColor: '#050811'
  },
  chatScrollContent: {
    padding: 16,
    gap: 12
  },
  systemBubble: {
    alignSelf: 'center',
    backgroundColor: '#1e293b88',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  systemBubbleText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center'
  },
  messageRow: {
    flexDirection: 'row',
    width: '100%'
  },
  messageRowMe: {
    justifyContent: 'flex-end'
  },
  messageRowPeer: {
    justifyContent: 'flex-start'
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16
  },
  messageBubbleMe: {
    backgroundColor: '#d97706',
    borderBottomRightRadius: 4
  },
  messageBubblePeer: {
    backgroundColor: '#1e293b',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#334155'
  },
  senderGhost: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    opacity: 0.8
  },
  messageText: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 19
  },
  icebreakerBar: {
    paddingVertical: 8,
    backgroundColor: '#0a0f1d',
    borderTopWidth: 1,
    borderTopColor: '#1e293b'
  },
  promptScroll: {
    paddingHorizontal: 12
  },
  promptChip: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  promptChipText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#0d1322',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    gap: 8
  },
  textInput: {
    flex: 1,
    height: 42,
    backgroundColor: '#172033',
    borderRadius: 21,
    paddingHorizontal: 16,
    color: '#f8fafc',
    fontSize: 14
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendBtnDisabled: {
    backgroundColor: '#475569',
    opacity: 0.5
  },
  sendBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#030712'
  },
  decisionModalView: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#090d16'
  },
  decisionClockIcon: {
    fontSize: 42,
    textAlign: 'center',
    marginBottom: 8
  },
  decisionClockTitle: {
    color: '#fbbf24',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center'
  },
  decisionClockSub: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center'
  },
  decisionRuleNotice: {
    backgroundColor: '#1e1b4b',
    borderColor: '#6366f1',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 18,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center'
  },
  decisionRuleBold: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  decisionRuleText: {
    color: '#e0e7ff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center'
  },
  decisionButtonsContainer: {
    width: '100%',
    gap: 12
  },
  decisionActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5
  },
  decisionBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  decisionActionEmoji: {
    fontSize: 26
  },
  decisionActionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff'
  },
  decisionActionSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2
  },
  decisionActionArrow: {
    color: '#64748b',
    fontSize: 18,
    fontWeight: 'bold'
  },
  btnContinue: {
    backgroundColor: '#83184333',
    borderColor: '#ec4899'
  },
  btnFriends: {
    backgroundColor: '#1e3a8a33',
    borderColor: '#3b82f6'
  },
  btnExit: {
    backgroundColor: '#33415533',
    borderColor: '#64748b'
  },
  btnMaybeLater: {
    backgroundColor: '#581c8733',
    borderColor: '#a855f7'
  },
  outcomeSecondChanceBox: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#3b076433',
    borderWidth: 2,
    borderColor: '#a855f7',
    borderRadius: 20,
    padding: 24
  },
  outcomeHighlightPurple: {
    color: '#c084fc',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center'
  },
  secondChanceVaultBtn: {
    width: '100%',
    backgroundColor: '#9333ea',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8
  },
  secondChanceVaultBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  submittingDecisionBox: {
    padding: 30,
    alignItems: 'center'
  },
  submittingDecisionText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12
  },
  outcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  outcomeSuccessBox: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#50072433',
    borderWidth: 2,
    borderColor: '#ec4899',
    borderRadius: 20,
    padding: 24
  },
  outcomeFriendBox: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#17255433',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 20,
    padding: 24
  },
  outcomeExitBox: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#1e293b33',
    borderWidth: 2,
    borderColor: '#475569',
    borderRadius: 20,
    padding: 24
  },
  outcomeEmoji: {
    fontSize: 44,
    marginBottom: 8
  },
  outcomeTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'center'
  },
  outcomeHighlight: {
    color: '#f43f5e',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center'
  },
  outcomeDescription: {
    color: '#cbd5e1',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20
  },
  peerIdBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 16,
    alignItems: 'center'
  },
  peerIdLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase'
  },
  peerIdVal: {
    color: '#38bdf8',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2
  },
  openChatBtn: {
    width: '100%',
    backgroundColor: '#ec4899',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8
  },
  openChatBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800'
  },
  friendBtn: {
    width: '100%',
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 18
  },
  restartBtn: {
    width: '100%',
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 18
  },
  restartBtnText: {
    color: '#030712',
    fontSize: 14,
    fontWeight: '800'
  },
  exitCloseBtn: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 20
  },
  exitCloseBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600'
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  waitingRadarBox: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 24,
    alignItems: 'center'
  },
  waitingTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8
  },
  waitingSub: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20
  },
  waitingInfoCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  waitingInfoBullet: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 16
  },
  cancelQueueBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#f43f5e',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center'
  },
  cancelQueueText: {
    color: '#fda4af',
    fontSize: 13,
    fontWeight: '700'
  }
});
