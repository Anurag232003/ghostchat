import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import {
  fetchDailyMysteryDropStatus,
  openDailyMysteryDrop,
  connectDailyMysteryDrop,
  passDailyMysteryDrop,
  resetDailyMysteryDropDemo,
} from '../services/api';

export default function DailyMysteryDropModal({ visible, onClose, userId, onStartChat }) {
  const [loading, setLoading] = useState(false);
  const [dropData, setDropData] = useState(null);
  const [secondsRemaining, setSecondsRemaining] = useState(1800);
  const [nextDropSeconds, setNextDropSeconds] = useState(43200);
  const [actionMessage, setActionMessage] = useState('');

  // Pulse animation for daily mystery chest/star
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  // Load status whenever modal becomes visible
  useEffect(() => {
    if (visible && userId) {
      loadDropStatus();
    }
  }, [visible, userId]);

  // Live timer interval
  useEffect(() => {
    let timer;
    if (visible && secondsRemaining > 0 && dropData?.status === 'active') {
      timer = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            loadDropStatus();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [visible, secondsRemaining, dropData?.status]);

  // Next drop countdown interval
  useEffect(() => {
    let nextTimer;
    if (visible && nextDropSeconds > 0) {
      nextTimer = setInterval(() => {
        setNextDropSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (nextTimer) clearInterval(nextTimer);
    };
  }, [visible, nextDropSeconds]);

  const loadDropStatus = async () => {
    try {
      setLoading(true);
      const res = await fetchDailyMysteryDropStatus(userId);
      setDropData(res);
      setSecondsRemaining(res.time_remaining_seconds || 0);
      setNextDropSeconds(res.next_drop_countdown_seconds || 43200);
    } catch (e) {
      console.warn('Failed to load daily mystery drop:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDrop = async () => {
    try {
      setLoading(true);
      const res = await openDailyMysteryDrop(userId);
      setSecondsRemaining(res.time_remaining_seconds);
      setActionMessage('🔥 Today\'s 30-minute mystery window is now live!');
      await loadDropStatus();
    } catch (e) {
      setActionMessage(`Error opening drop: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!dropData?.match?.drop_id) return;
    try {
      setLoading(true);
      const res = await connectDailyMysteryDrop(userId, dropData.match.drop_id);
      setActionMessage('🎉 Mystery connection accepted! Launching confidential chat...');
      await loadDropStatus();
      if (onStartChat) {
        setTimeout(() => {
          onStartChat(res.peer_id, res.peer_pseudonym, res.chat_room_id);
          onClose();
        }, 800);
      }
    } catch (e) {
      setActionMessage(`Could not connect: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePass = async () => {
    if (!dropData?.match?.drop_id) return;
    try {
      setLoading(true);
      await passDailyMysteryDrop(userId, dropData.match.drop_id);
      setActionMessage('👋 Passed for today. Next mystery drop arrives tomorrow!');
      await loadDropStatus();
    } catch (e) {
      setActionMessage(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDemo = async () => {
    try {
      setLoading(true);
      await resetDailyMysteryDropDemo(userId);
      setActionMessage('🔄 Daily drop reset for testing.');
      await loadDropStatus();
    } catch (e) {
      setActionMessage(`Error resetting: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTimer = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatNextDropTimer = (totalSecs) => {
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hours}h ${mins}m ${secs}s`;
  };

  const match = dropData?.match;
  const isAvailable = dropData?.status === 'ready' || dropData?.status === 'active';
  const isExpired = dropData?.status === 'expired' || (dropData?.status === 'active' && secondsRemaining <= 0);
  const isConnected = dropData?.status === 'connected';
  const isPassed = dropData?.status === 'passed';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerBadge}>🔥 DAILY MYSTERY DROP</Text>
              <Text style={styles.headerSubtitle}>
                Every day: ONE MYSTERY MATCH • Available for 30 minutes
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {loading && !dropData ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#f97316" />
                <Text style={styles.loadingText}>Fetching today's mystery drop...</Text>
              </View>
            ) : (
              <>
                {/* Hero Headline Box */}
                <View style={styles.heroBox}>
                  <Animated.View style={[styles.avatarGlowCircle, { transform: [{ scale: pulseAnim }] }]}>
                    <Text style={styles.avatarEmoji}>{match?.avatar_symbol || '🔥'}</Text>
                  </Animated.View>
                  <Text style={styles.heroHeadline}>Your mystery connection is waiting.</Text>
                  <Text style={styles.heroPurpose}>
                    ✨ This gives users a reason to return.
                  </Text>

                  {/* 30-Minute Window Status Ribbon */}
                  <View style={styles.timerBadgeContainer}>
                    {dropData?.status === 'ready' && (
                      <View style={[styles.timerPill, styles.timerReady]}>
                        <Text style={styles.timerPillText}>⏳ 30:00 Window Unopened</Text>
                      </View>
                    )}
                    {dropData?.status === 'active' && !isExpired && (
                      <View
                        style={[
                          styles.timerPill,
                          secondsRemaining < 300 ? styles.timerUrgent : styles.timerActive,
                        ]}
                      >
                        <Text style={styles.timerPillText}>
                          ⚡ EXPIRES IN {formatTimer(secondsRemaining)}
                        </Text>
                      </View>
                    )}
                    {isExpired && (
                      <View style={[styles.timerPill, styles.timerExpired]}>
                        <Text style={styles.timerPillText}>⌛ 30-Minute Window Expired</Text>
                      </View>
                    )}
                    {isConnected && (
                      <View style={[styles.timerPill, styles.timerConnected]}>
                        <Text style={styles.timerPillText}>❤️ Connected & Unlocked</Text>
                      </View>
                    )}
                    {isPassed && (
                      <View style={[styles.timerPill, styles.timerPassed]}>
                        <Text style={styles.timerPillText}>👋 Passed for Today</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Action Feedback Message */}
                {actionMessage ? (
                  <View style={styles.messageBanner}>
                    <Text style={styles.messageBannerText}>{actionMessage}</Text>
                  </View>
                ) : null}

                {/* No Candidates / Empty State */}
                {(!match || dropData?.status === 'no_candidates') && (
                  <View style={styles.emptyStateCard}>
                    <Text style={{ fontSize: 44, marginBottom: 12 }}>🔥</Text>
                    <Text style={styles.emptyStateTitle}>No other registered users yet</Text>
                    <Text style={styles.emptyStateSub}>
                      All demo profiles (Solar Mirage, Celestial Wanderer, etc.) have been removed. Daily Mystery Drops connect ONLY real registered users from MongoDB.
                    </Text>
                    <View style={styles.emptyTipBox}>
                      <Text style={styles.emptyTipTitle}>💡 How to receive a real mystery match:</Text>
                      <Text style={styles.emptyTipText}>• Open http://localhost:8081 in another browser window or incognito tab.</Text>
                      <Text style={styles.emptyTipText}>• Once another user joins, today's mystery connection will pair you together!</Text>
                    </View>
                  </View>
                )}

                {/* Ready to open state */}
                {match && dropData?.status === 'ready' && (
                  <View style={styles.revealPromptCard}>
                    <Text style={styles.revealPromptTitle}>🎁 Today's Mystery Box Ready</Text>
                    <Text style={styles.revealPromptDesc}>
                      Your daily curated mystery connection is sealed. Tapping reveal activates your confidential 30-minute matching window.
                    </Text>
                    <TouchableOpacity
                      style={styles.revealBtn}
                      onPress={handleOpenDrop}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.revealBtnText}>🔥 REVEAL TODAY'S MATCH (30 MIN)</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Mystery Match Details Card (Visible once opened or active) */}
                {match && dropData?.status !== 'ready' && (
                  <View style={styles.matchCard}>
                    <View style={styles.matchCardHeader}>
                      <View>
                        <Text style={styles.peerPseudonym}>{match.peer_pseudonym}</Text>
                        <Text style={styles.matchVibe}>{match.vibe_signature}</Text>
                      </View>
                      <View style={styles.matchScoreBadge}>
                        <Text style={styles.matchScoreVal}>{match.compatibility_score}%</Text>
                        <Text style={styles.matchScoreLabel}>MATCH</Text>
                      </View>
                    </View>

                    <Text style={styles.teaserText}>"{match.teaser_summary}"</Text>

                    {/* Common Topics */}
                    <View style={styles.tagsContainer}>
                      {match.common_topics?.map((topic, idx) => (
                        <View key={idx} style={styles.tagPill}>
                          <Text style={styles.tagText}>{topic}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Location & Style Metrics */}
                    <View style={styles.metricsBox}>
                      <View style={styles.metricRow}>
                        <Text style={styles.metricKey}>Approx. Location</Text>
                        <Text style={styles.metricVal}>{match.approx_location}</Text>
                      </View>
                      <View style={styles.metricRow}>
                        <Text style={styles.metricKey}>Conversation Style</Text>
                        <Text style={styles.metricBar}>{match.conversation_style_bar}</Text>
                      </View>
                      <View style={styles.metricRow}>
                        <Text style={styles.metricKey}>Energy Level</Text>
                        <Text style={styles.metricBar}>{match.energy_bar}</Text>
                      </View>
                    </View>

                    {/* Action Buttons */}
                    {dropData?.status === 'active' && !isExpired && (
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          style={styles.connectBtn}
                          onPress={handleConnect}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.connectBtnText}>❤️ CONNECT NOW</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.passBtn}
                          onPress={handlePass}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.passBtnText}>👋 Pass</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {isConnected && (
                      <View style={styles.statusBannerBox}>
                        <Text style={styles.statusBannerText}>
                          🎉 Connected! Chat chamber is unlocked and ready.
                        </Text>
                      </View>
                    )}

                    {isExpired && (
                      <View style={styles.statusBannerBox}>
                        <Text style={styles.statusBannerText}>
                          ⏰ The 30-minute window for today's match has ended.
                        </Text>
                      </View>
                    )}

                    {isPassed && (
                      <View style={styles.statusBannerBox}>
                        <Text style={styles.statusBannerText}>
                          👋 You passed on today's drop. See you tomorrow!
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Next Drop Countdown Banner */}
                <View style={styles.nextDropCard}>
                  <Text style={styles.nextDropTitle}>🌙 Next Mystery Drop In:</Text>
                  <Text style={styles.nextDropCountdown}>
                    {formatNextDropTimer(nextDropSeconds)}
                  </Text>
                  <Text style={styles.nextDropSub}>
                    A fresh, highly compatible mystery match lands every day at 00:00 UTC.
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 580,
    maxHeight: '92%',
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 45px rgba(249, 115, 22, 0.25)',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#111827',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerBadge: {
    color: '#f97316',
    fontWeight: '800',
    fontSize: 17,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 20,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  heroBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  avatarGlowCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderWidth: 2,
    borderColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarEmoji: {
    fontSize: 34,
  },
  heroHeadline: {
    color: '#f8fafc',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroPurpose: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  timerBadgeContainer: {
    marginTop: 12,
  },
  timerPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  timerReady: {
    backgroundColor: '#3b82f6',
  },
  timerActive: {
    backgroundColor: '#10b981',
  },
  timerUrgent: {
    backgroundColor: '#ef4444',
  },
  timerExpired: {
    backgroundColor: '#64748b',
  },
  timerConnected: {
    backgroundColor: '#8b5cf6',
  },
  timerPassed: {
    backgroundColor: '#475569',
  },
  timerPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  messageBanner: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderColor: '#f97316',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  messageBannerText: {
    color: '#fdba74',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  revealPromptCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  revealPromptTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  revealPromptDesc: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  revealBtn: {
    backgroundColor: '#f97316',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
  },
  revealBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  matchCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  matchCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  peerPseudonym: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
  },
  matchVibe: {
    color: '#f97316',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  matchScoreBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  matchScoreVal: {
    color: '#10b981',
    fontSize: 15,
    fontWeight: '800',
  },
  matchScoreLabel: {
    color: '#6ee7b7',
    fontSize: 9,
    fontWeight: '700',
  },
  teaserText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  tagPill: {
    backgroundColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    color: '#93c5fd',
    fontSize: 11,
    fontWeight: '600',
  },
  metricsBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  metricKey: {
    color: '#94a3b8',
    fontSize: 12,
  },
  metricVal: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '600',
  },
  metricBar: {
    color: '#f59e0b',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  connectBtn: {
    flex: 2,
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  connectBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  passBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  passBtnText: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBannerBox: {
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  statusBannerText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '500',
  },
  nextDropCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 14,
  },
  nextDropTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  nextDropCountdown: {
    color: '#f97316',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  nextDropSub: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  demoResetBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  demoResetBtnText: {
    color: '#64748b',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  emptyStateCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyStateTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSub: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    maxWidth: 440,
  },
  emptyTipBox: {
    width: '100%',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    gap: 6,
  },
  emptyTipTitle: {
    color: '#f97316',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  emptyTipText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 16,
  },
});
