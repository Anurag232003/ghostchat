import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform
} from 'react-native';
import {
  fetchXPManifest,
  fetchUserXPProfile,
  awardUserXP,
  unlockUserAchievement
} from '../services/api';

export default function BlindDateXPModal({
  visible,
  onClose,
  currentUserId
}) {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [awardingAction, setAwardingAction] = useState(null);

  useEffect(() => {
    if (visible) {
      loadXPData();
    }
  }, [visible]);

  const loadXPData = async () => {
    try {
      setLoading(true);
      const res = await fetchUserXPProfile(currentUserId || 'user_demo_me');
      setProfile(res.profile);
      setAchievements(res.achievements || []);
      setLoading(false);
    } catch (err) {
      console.warn('Failed to load Blind Date XP profile:', err);
      setLoading(false);
    }
  };

  const handleEarnXP = async (actionType) => {
    try {
      setAwardingAction(actionType);
      const res = await awardUserXP(currentUserId || 'user_demo_me', actionType);
      setProfile(res.profile);
      // Re-fetch mapped achievements status
      const updated = await fetchUserXPProfile(currentUserId || 'user_demo_me');
      setAchievements(updated.achievements || []);
      setAwardingAction(null);
    } catch (err) {
      console.warn('Failed to award XP:', err);
      setAwardingAction(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerBadge}>🏆 ANONYMOUS GAMIFICATION</Text>
              <Text style={styles.headerTitle}>Blind Date XP</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading || !profile ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#f59e0b" />
              <Text style={styles.loadingText}>Fetching Mystery Explorer stats...</Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
              {/* Canonical Rank & Level Hero Banner */}
              <View style={styles.heroCard}>
                <View style={styles.heroGlowIcon}>
                  <Text style={styles.heroEmoji}>🎭</Text>
                </View>
                <Text style={styles.heroTitle}>{profile.title}</Text>
                <View style={styles.heroLevelPill}>
                  <Text style={styles.heroLevelText}>Lv. {profile.level}</Text>
                </View>

                {/* XP Progress Bar */}
                <View style={styles.xpBarContainer}>
                  <View style={styles.xpBarBackground}>
                    <View
                      style={[
                        styles.xpBarFill,
                        { width: `${Math.min(100, Math.max(8, profile.level_progress_pct))}%` }
                      ]}
                    />
                  </View>
                  <View style={styles.xpBarMeta}>
                    <Text style={styles.xpBarText}>XP: {profile.current_xp} / {profile.xp_for_next_level}</Text>
                    <Text style={styles.xpBarPct}>{profile.level_progress_pct}% to Lv. {profile.level + 1}</Text>
                  </View>
                </View>
              </View>

              {/* 3 Core Progression Counters */}
              <View style={styles.statsCard}>
                <Text style={styles.sectionHeader}>Activity Counters</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statIcon}>📅</Text>
                    <Text style={styles.statValue}>{profile.stats.dates_completed}</Text>
                    <Text style={styles.statLabel}>Dates completed</Text>
                  </View>

                  <View style={styles.statBox}>
                    <Text style={styles.statIcon}>🎮</Text>
                    <Text style={styles.statValue}>{profile.stats.games_played}</Text>
                    <Text style={styles.statLabel}>Games played</Text>
                  </View>

                  <View style={styles.statBox}>
                    <Text style={styles.statIcon}>❓</Text>
                    <Text style={styles.statValue}>{profile.stats.questions_answered}</Text>
                    <Text style={styles.statLabel}>Questions answered</Text>
                  </View>
                </View>
              </View>

              {/* Achievements Showcase */}
              <View style={styles.achievementsCard}>
                <View style={styles.achievementsHeaderRow}>
                  <Text style={styles.sectionHeader}>Achievements</Text>
                  <Text style={styles.achievementsBadgeCount}>
                    {achievements.filter(a => a.unlocked).length} / {achievements.length} Unlocked
                  </Text>
                </View>

                <View style={styles.achievementsGrid}>
                  {achievements.map((ach) => (
                    <View
                      key={ach.id}
                      style={[
                        styles.achievementItem,
                        ach.unlocked ? styles.achievementUnlocked : styles.achievementLocked
                      ]}
                    >
                      <View style={styles.achievementLeft}>
                        <Text style={styles.achievementEmoji}>{ach.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.achievementName, !ach.unlocked && styles.textMuted]}>
                            {ach.name}
                          </Text>
                          <Text style={styles.achievementDesc}>{ach.description}</Text>
                        </View>
                      </View>
                      <View style={ach.unlocked ? styles.badgeUnlockedPill : styles.badgeLockedPill}>
                        <Text style={ach.unlocked ? styles.badgeUnlockedText : styles.badgeLockedText}>
                          {ach.unlocked ? '🌟 UNLOCKED' : '🔒 LOCKED'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* How to Earn XP Info Box */}
              <View style={styles.quickEarnCard}>
                <Text style={styles.quickEarnTitle}>💡 How to Earn XP</Text>
                <Text style={{ color: '#94A3B8', fontSize: 13, lineHeight: 20 }}>
                  • 🎮 Play Blind Date Mini Games (+25 XP){'\n'}
                  • 💬 Answer Question Icebreaker Cards (+15 XP){'\n'}
                  • 🏆 Complete a Full Blind Date (+100 XP){'\n'}
                  • ❤️ Mutual Reveal Unlock (+50 XP)
                </Text>
              </View>
            </ScrollView>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.closeFooterBtn} onPress={onClose}>
              <Text style={styles.closeFooterText}>Close XP Dashboard</Text>
            </TouchableOpacity>
          </View>
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
    maxHeight: 760,
    backgroundColor: '#0c0a1a',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#f59e0b55',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 60px rgba(245, 158, 11, 0.22)'
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
    borderBottomColor: '#272010',
    backgroundColor: '#161208'
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
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800'
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#29200f',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeBtnText: {
    color: '#fbbf24',
    fontSize: 15,
    fontWeight: 'bold'
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  loadingText: {
    color: '#fde68a',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14
  },
  scrollContent: {
    flex: 1,
    backgroundColor: '#070510'
  },
  scrollInner: {
    padding: 16,
    gap: 14
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: '#191307',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(245, 158, 11, 0.15)'
      }
    })
  },
  heroGlowIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#78350f44',
    borderWidth: 1,
    borderColor: '#f59e0b88',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  heroEmoji: {
    fontSize: 32
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1
  },
  heroLevelPill: {
    backgroundColor: '#78350f',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 14,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#f59e0b'
  },
  heroLevelText: {
    color: '#fef3c7',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1
  },
  xpBarContainer: {
    width: '100%',
    marginTop: 6
  },
  xpBarBackground: {
    width: '100%',
    height: 10,
    backgroundColor: '#272010',
    borderRadius: 5,
    overflow: 'hidden'
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 5
  },
  xpBarMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6
  },
  xpBarText: {
    color: '#d1d5db',
    fontSize: 11,
    fontWeight: '700'
  },
  xpBarPct: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '800'
  },
  statsCard: {
    backgroundColor: '#110d24',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2e2554'
  },
  sectionHeader: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 12
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8
  },
  statBox: {
    flex: 1,
    backgroundColor: '#181432',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#372f68'
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4
  },
  statValue: {
    color: '#fef08a',
    fontSize: 20,
    fontWeight: '900'
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2
  },
  achievementsCard: {
    backgroundColor: '#110d24',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2e2554'
  },
  achievementsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  achievementsBadgeCount: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '800'
  },
  achievementsGrid: {
    gap: 10
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1
  },
  achievementUnlocked: {
    backgroundColor: '#1a143b',
    borderColor: '#6366f1'
  },
  achievementLocked: {
    backgroundColor: '#0d0a1b',
    borderColor: '#1e1a38',
    opacity: 0.6
  },
  achievementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8
  },
  achievementEmoji: {
    fontSize: 22
  },
  achievementName: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800'
  },
  achievementDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2
  },
  textMuted: {
    color: '#64748b'
  },
  badgeUnlockedPill: {
    backgroundColor: '#312e81',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6366f1'
  },
  badgeUnlockedText: {
    color: '#a5b4fc',
    fontSize: 9,
    fontWeight: '900'
  },
  badgeLockedPill: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  badgeLockedText: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700'
  },
  quickEarnCard: {
    backgroundColor: '#17112c',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#372f68'
  },
  quickEarnTitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center'
  },
  quickEarnButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center'
  },
  earnBtn: {
    backgroundColor: '#272047',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#433878'
  },
  earnBtnGold: {
    backgroundColor: '#78350f',
    borderColor: '#f59e0b'
  },
  earnBtnText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700'
  },
  earnBtnTextGold: {
    color: '#fef3c7',
    fontSize: 11,
    fontWeight: '800'
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#272010',
    backgroundColor: '#161208',
    alignItems: 'center'
  },
  closeFooterBtn: {
    backgroundColor: '#29200f',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12
  },
  closeFooterText: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '700'
  }
});
