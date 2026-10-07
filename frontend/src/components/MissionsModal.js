import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';

import {
  fetchActiveMissions,
  completeMission,
  unlockNextMission,
  fetchMissionsCatalog
} from '../services/api';

export function MissionsModal({
  visible,
  onClose,
  sessionId, // room_id or pair_id
  currentUserId,
  peerName = 'Partner',
  onSendStarterToChat
}) {
  const [loading, setLoading] = useState(true);
  const [activeData, setActiveData] = useState(null);
  const [allCatalog, setAllCatalog] = useState(null);
  const [viewTab, setViewTab] = useState('active'); // 'active' | 'catalog'
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (visible && sessionId) {
      loadMissions();
    }
  }, [visible, sessionId]);

  async function loadMissions() {
    setLoading(true);
    try {
      const [act, cat] = await Promise.all([
        fetchActiveMissions(sessionId, currentUserId),
        fetchMissionsCatalog()
      ]);
      setActiveData(act);
      setAllCatalog(cat);
    } catch (err) {
      console.warn('Failed to load missions:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteMission(mission) {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await completeMission(sessionId, currentUserId, mission.id);
      Alert.alert(
        '✨ Mission Accomplished!',
        `You completed "${mission.title}: ${mission.prompt}"!\n\n✨ Date XP +${res.xp_awarded} awarded!\nTotal Date XP: ${res.total_date_xp}`
      );
      const updated = await fetchActiveMissions(sessionId, currentUserId);
      setActiveData(updated);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnlockNext() {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await unlockNextMission(sessionId, currentUserId);
      if (res.unlocked_mission) {
        Alert.alert(
          '🎯 New Mission Unlocked!',
          `${res.unlocked_mission.title}: "${res.unlocked_mission.prompt}"`
        );
      } else {
        Alert.alert('Notice', res.message || 'All missions unlocked!');
      }
      const updated = await fetchActiveMissions(sessionId, currentUserId);
      setActiveData(updated);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  }

  function handleSendToChat(mission) {
    const text = mission.chat_starter || `🎯 Mission: ${mission.prompt}`;
    if (onSendStarterToChat) {
      onSendStarterToChat(text);
      onClose();
    }
  }

  const dateXp = activeData?.date_xp ?? 0;
  const rank = activeData?.rank ?? { level: 1, title: 'Curious Spark', badge: '🌱' };
  const unlocked = activeData?.unlocked_missions || [];
  const completed = activeData?.completed_missions || [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerIcon}>🎯</Text>
              <View>
                <Text style={styles.headerTitle}>Blind Date Missions</Text>
                <Text style={styles.headerSubtitle}>
                  Interactive challenges with {peerName} • {allCatalog?.total_missions || 36} Missions Available
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Date XP Level Status Ribbon */}
          <View style={styles.xpRibbon}>
            <View style={styles.xpLeft}>
              <Text style={styles.xpBadge}>{rank.badge}</Text>
              <View>
                <Text style={styles.xpTitle}>{rank.title} (Level {rank.level})</Text>
                <Text style={styles.xpSub}>Completing missions gives ✨ Date XP +20</Text>
              </View>
            </View>
            <View style={styles.xpPill}>
              <Text style={styles.xpPillText}>✨ {dateXp} XP</Text>
            </View>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, viewTab === 'active' && styles.tabBtnActive]}
              onPress={() => setViewTab('active')}
            >
              <Text style={[styles.tabBtnText, viewTab === 'active' && styles.tabBtnTextActive]}>
                Active Missions ({unlocked.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, viewTab === 'catalog' && styles.tabBtnActive]}
              onPress={() => setViewTab('catalog')}
            >
              <Text style={[styles.tabBtnText, viewTab === 'catalog' && styles.tabBtnTextActive]}>
                All 36 Missions Deck
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#F43F5E" />
              <Text style={styles.loadingText}>Syncing missions deck...</Text>
            </View>
          ) : (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              {/* TAB 1: ACTIVE MISSIONS */}
              {viewTab === 'active' && (
                <View>
                  <View style={styles.actionHeaderRow}>
                    <Text style={styles.sectionHeading}>CURRENTLY UNLOCKED</Text>
                    <TouchableOpacity
                      style={styles.drawBtn}
                      onPress={handleUnlockNext}
                      disabled={actionLoading}
                    >
                      <Text style={styles.drawBtnText}>🎲 Unlock Another ➔</Text>
                    </TouchableOpacity>
                  </View>

                  {unlocked.length === 0 ? (
                    <View style={styles.emptyCard}>
                      <Text style={styles.emptyIcon}>🎉</Text>
                      <Text style={styles.emptyTitle}>All Active Missions Completed!</Text>
                      <Text style={styles.emptySub}>Draw another mission below to keep the sparks flying.</Text>
                      <TouchableOpacity
                        style={styles.drawHeroBtn}
                        onPress={handleUnlockNext}
                        disabled={actionLoading}
                      >
                        <Text style={styles.drawHeroBtnText}>🎲 Draw New Random Mission (+20 XP)</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    unlocked.map((m) => (
                      <View key={m.id} style={styles.missionCard}>
                        <View style={styles.missionHeader}>
                          <View style={styles.missionBadge}>
                            <Text style={styles.missionBadgeText}>
                              {m.emoji} {m.title}
                            </Text>
                          </View>
                          <View style={styles.rewardTag}>
                            <Text style={styles.rewardTagText}>✨ +20 Date XP</Text>
                          </View>
                        </View>

                        <Text style={styles.missionPrompt}>{m.prompt}</Text>

                        {m.requires_voice && (
                          <View style={styles.voiceNotePill}>
                            <Text style={styles.voiceNotePillText}>🎙️ Requires Encrypted Voice Note</Text>
                          </View>
                        )}

                        <View style={styles.missionActionsRow}>
                          <TouchableOpacity
                            style={styles.chatActionBtn}
                            onPress={() => handleSendToChat(m)}
                          >
                            <Text style={styles.chatActionBtnText}>💬 Send to Chat</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.completeBtn}
                            onPress={() => handleCompleteMission(m)}
                            disabled={actionLoading}
                          >
                            <Text style={styles.completeBtnText}>✓ Mark Completed ➔</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}

                  {/* Completed Missions Section */}
                  {completed.length > 0 && (
                    <View style={styles.completedSection}>
                      <Text style={styles.sectionHeading}>
                        COMPLETED MISSIONS ({completed.length})
                      </Text>
                      {completed.map((m) => (
                        <View key={m.id} style={styles.completedCard}>
                          <Text style={styles.completedCheck}>✓</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.completedTitle}>{m.title}: {m.prompt}</Text>
                          </View>
                          <Text style={styles.completedXpText}>+20 XP</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* TAB 2: ALL 36 MISSIONS CATALOG */}
              {viewTab === 'catalog' && (
                <View>
                  <Text style={styles.sectionHeading}>
                    FULL 36-MISSION CURATED CATALOG
                  </Text>
                  <Text style={styles.catalogIntro}>
                    These interactive missions unlock progressively as the date timer advances or when either user draws a challenge:
                  </Text>

                  {(allCatalog?.missions || []).map((m) => {
                    const isDone = completed.some((c) => c.id === m.id);
                    const isActive = unlocked.some((u) => u.id === m.id);

                    return (
                      <View key={m.id} style={[styles.catalogCard, isDone && styles.catalogCardDone]}>
                        <View style={styles.catalogTopRow}>
                          <Text style={styles.catalogTitle}>
                            {m.emoji} {m.title}
                          </Text>
                          {isDone ? (
                            <View style={styles.doneBadge}>
                              <Text style={styles.doneBadgeText}>✓ DONE</Text>
                            </View>
                          ) : isActive ? (
                            <View style={styles.activeBadge}>
                              <Text style={styles.activeBadgeText}>ACTIVE</Text>
                            </View>
                          ) : (
                            <View style={styles.lockedBadge}>
                              <Text style={styles.lockedBadgeText}>🔒 IN DECK</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.catalogPrompt}>{m.prompt}</Text>
                        <Text style={styles.catalogCategory}>Category: {m.category} • ✨ +20 XP</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  card: {
    backgroundColor: '#0F172A',
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1E1B4B',
    borderBottomWidth: 1,
    borderBottomColor: '#312E81'
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerIcon: {
    fontSize: 28,
    marginRight: 10
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2
  },
  closeBtn: {
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  closeBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '800'
  },

  // XP Ribbon
  xpRibbon: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#334155'
  },
  xpLeft: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  xpBadge: {
    fontSize: 26,
    marginRight: 10
  },
  xpTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800'
  },
  xpSub: {
    color: '#CBD5E1',
    fontSize: 11,
    marginTop: 2
  },
  xpPill: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    borderWidth: 1,
    borderColor: '#FB7185',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  xpPillText: {
    color: '#FFE4E6',
    fontSize: 13,
    fontWeight: '900'
  },

  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabBtnActive: {
    borderBottomColor: '#F43F5E',
    backgroundColor: 'rgba(244, 63, 94, 0.05)'
  },
  tabBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700'
  },
  tabBtnTextActive: {
    color: '#F43F5E',
    fontWeight: '900'
  },

  loadingBox: {
    padding: 40,
    alignItems: 'center'
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 12
  },
  body: {
    padding: 16
  },

  actionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionHeading: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  drawBtn: {
    backgroundColor: '#312E81',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  drawBtnText: {
    color: '#C7D2FE',
    fontSize: 11,
    fontWeight: '800'
  },

  missionCard: {
    backgroundColor: '#1E1B4B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#6366F1',
    padding: 16,
    marginBottom: 14
  },
  missionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  missionBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  missionBadgeText: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: '900'
  },
  rewardTag: {
    backgroundColor: '#E11D48',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3
  },
  rewardTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900'
  },
  missionPrompt: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 24,
    marginVertical: 8
  },
  voiceNotePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 10
  },
  voiceNotePillText: {
    color: '#7DD3FC',
    fontSize: 11,
    fontWeight: '700'
  },
  missionActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6
  },
  chatActionBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center'
  },
  chatActionBtnText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '800'
  },
  completeBtn: {
    flex: 1,
    backgroundColor: '#BE123C',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center'
  },
  completeBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },

  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    marginVertical: 12
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10
  },
  emptyTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800'
  },
  emptySub: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center'
  },
  drawHeroBtn: {
    backgroundColor: '#BE123C',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  drawHeroBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },

  completedSection: {
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B'
  },
  completedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 10,
    padding: 10,
    marginVertical: 4
  },
  completedCheck: {
    color: '#10B981',
    fontSize: 16,
    fontWeight: '900',
    marginRight: 10
  },
  completedTitle: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '600'
  },
  completedXpText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '800'
  },

  catalogIntro: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18
  },
  catalogCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 8
  },
  catalogCardDone: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: '#10B981'
  },
  catalogTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  catalogTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800'
  },
  catalogPrompt: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
    marginVertical: 4
  },
  catalogCategory: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700'
  },
  doneBadge: {
    backgroundColor: '#10B981',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  doneBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900'
  },
  activeBadge: {
    backgroundColor: '#6366F1',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  activeBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900'
  },
  lockedBadge: {
    backgroundColor: '#334155',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  lockedBadgeText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800'
  }
});
