import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Platform,
  Alert
} from 'react-native';
import {
  fetchSmartMatchmakingManifest,
  fetchSmartMatchmakingProfile,
  updateSmartMatchmakingProfile,
  searchSmartMatches
} from '../services/api';

const FACTOR_METADATA = [
  {
    key: 'use_age_preference',
    title: 'Age preference',
    emoji: '🎂',
    desc: 'Considers preferred age brackets. Turn off to match across all age groups.'
  },
  {
    key: 'use_interests',
    title: 'Interests',
    emoji: '🎨',
    desc: 'Compares shared hobbies and passions (Coffee, Gaming, Music, etc.).'
  },
  {
    key: 'use_conversation_preferences',
    title: 'Conversation preferences',
    emoji: '💬',
    desc: 'Matches conversation cadence: Deep talks, Spontaneous banter, Slow burn, etc.'
  },
  {
    key: 'use_language',
    title: 'Language',
    emoji: '🗣️',
    desc: 'Ensures conversational language alignment (English, Spanish, Hindi, etc.).'
  },
  {
    key: 'use_availability',
    title: 'Availability',
    emoji: '⏰',
    desc: 'Aligns peak active windows: Right now, Evening, Weekends, or Late night.'
  },
  {
    key: 'use_date_mode',
    title: 'Date mode',
    emoji: '⚡',
    desc: 'Matches preferred format: Mystery Match, Speed Blitz 5-Min, Vibe, or Chemistry.'
  },
  {
    key: 'use_shared_topics',
    title: 'Shared topics',
    emoji: '📚',
    desc: 'Considers favorite conversational topics: Technology, Philosophy, Movies, etc.'
  },
  {
    key: 'use_past_interactions',
    title: 'Past mutual interactions',
    emoji: '🤝',
    desc: 'Considers interaction history, prioritizing fresh connections and positive vibes.'
  }
];

export default function SmartMatchmakingModal({
  visible,
  onClose,
  currentUserId,
  onStartMatchWithCandidate
}) {
  const [activeTab, setActiveTab] = useState('matches'); // 'matches' | 'controls' | 'preferences'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manifest, setManifest] = useState(null);
  const [controls, setControls] = useState({
    use_age_preference: true,
    use_interests: true,
    use_conversation_preferences: true,
    use_language: true,
    use_availability: true,
    use_date_mode: true,
    use_shared_topics: true,
    use_past_interactions: true
  });
  const [preferences, setPreferences] = useState({
    age_preference: '21-30',
    interests: ['Coffee', 'Gaming', 'Indie Music'],
    conversation_preference: 'Deep talks',
    language: 'English',
    availability: 'Right now 🟢',
    date_mode: 'mystery',
    shared_topics: ['Technology', 'Philosophy', 'Movies'],
    past_interactions_preference: 'prefer_fresh_or_positive'
  });
  const [matches, setMatches] = useState([]);
  const [expandedCandidateId, setExpandedCandidateId] = useState(null);

  useEffect(() => {
    if (visible) {
      loadProfileAndSearch();
    }
  }, [visible]);

  const loadProfileAndSearch = async () => {
    try {
      setLoading(true);
      const [manRes, profRes] = await Promise.all([
        fetchSmartMatchmakingManifest().catch(() => ({ manifest: null })),
        fetchSmartMatchmakingProfile(currentUserId || 'user_demo_me')
      ]);
      setManifest(manRes.manifest);
      if (profRes.config) {
        setControls(profRes.config.controls || controls);
        setPreferences(profRes.config.preferences || preferences);
      }

      // Fetch matches
      const searchRes = await searchSmartMatches(currentUserId || 'user_demo_me', 6);
      setMatches(searchRes.ranked_matches || []);
      setLoading(false);
    } catch (err) {
      console.warn('Failed to load smart matchmaking:', err);
      setLoading(false);
    }
  };

  const handleToggleControl = async (key) => {
    const updated = { ...controls, [key]: !controls[key] };
    setControls(updated);
    try {
      setSaving(true);
      await updateSmartMatchmakingProfile(currentUserId || 'user_demo_me', updated, preferences);
      const searchRes = await searchSmartMatches(currentUserId || 'user_demo_me', 6);
      setMatches(searchRes.ranked_matches || []);
      setSaving(false);
    } catch (err) {
      console.warn('Failed to update control:', err);
      setSaving(false);
    }
  };

  const enabledCount = Object.values(controls).filter(Boolean).length;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerBadge}>🧠 8-FACTOR COMPATIBILITY ENGINE</Text>
              <Text style={styles.headerTitle}>Smart Matchmaking</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Privacy Guarantee Pill */}
          <View style={styles.guaranteeBanner}>
            <Text style={styles.guaranteeTitle}>User Data Controls:</Text>
            <Text style={styles.guaranteeSub}>
              {enabledCount} of 8 factors enabled • You decide which data signals influence matches.
            </Text>
          </View>

          {/* Tab Switcher */}
          <View style={styles.tabNav}>
            <TouchableOpacity
              style={[styles.tabNavItem, activeTab === 'matches' && styles.tabNavItemActive]}
              onPress={() => setActiveTab('matches')}
            >
              <Text style={[styles.tabNavText, activeTab === 'matches' && styles.tabNavTextActive]}>
                🎯 Smart Matches ({matches.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabNavItem, activeTab === 'controls' && styles.tabNavItemActive]}
              onPress={() => setActiveTab('controls')}
            >
              <Text style={[styles.tabNavText, activeTab === 'controls' && styles.tabNavTextActive]}>
                🛡️ Privacy Controls ({enabledCount}/8)
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#38bdf8" />
              <Text style={styles.loadingText}>Running 8-factor compatibility matrix...</Text>
            </View>
          ) : activeTab === 'matches' ? (
            /* Tab 1: Matches */
            <ScrollView style={styles.contentScroll} contentContainerStyle={styles.scrollContent}>
              {saving && (
                <View style={styles.recalculatingPill}>
                  <ActivityIndicator size="small" color="#38bdf8" />
                  <Text style={styles.recalculatingText}>Recalculating compatibility scores...</Text>
                </View>
              )}

              {matches.length === 0 ? (
                <View style={styles.emptyStateBox}>
                  <Text style={{ fontSize: 44, marginBottom: 12 }}>👥</Text>
                  <Text style={styles.emptyStateTitle}>No other users registered yet</Text>
                  <Text style={styles.emptyStateSub}>
                    All demo profiles (Astra Nova, Echo Pulse, etc.) have been removed. This system matches ONLY real registered users from MongoDB.
                  </Text>
                  <View style={styles.emptyTipCard}>
                    <Text style={styles.emptyTipTitle}>💡 How to test real matchmaking:</Text>
                    <Text style={styles.emptyTipText}>1. Open http://localhost:8081 in an Incognito window or second browser.</Text>
                    <Text style={styles.emptyTipText}>2. Choose a pseudonym and set your interests in Persona Studio.</Text>
                    <Text style={styles.emptyTipText}>3. Click "Re-scan" to see your real 8-factor compatibility breakdown!</Text>
                  </View>
                </View>
              ) : (
                matches.map((cand, idx) => {
                  const isExpanded = expandedCandidateId === cand.candidate_id;
                  const scoreColor =
                    cand.compatibility_score >= 80 ? '#10b981' :
                    cand.compatibility_score >= 60 ? '#38bdf8' : '#f59e0b';

                return (
                  <View key={cand.candidate_id} style={styles.candidateCard}>
                    {/* Top Row */}
                    <View style={styles.candHeaderRow}>
                      <View style={styles.candAvatarWrap}>
                        <Text style={styles.candAvatar}>{cand.avatar_symbol || '👤'}</Text>
                        <View>
                          <Text style={styles.candPseudonym}>{cand.pseudonym}</Text>
                          <Text style={styles.candVibeQuote}>"{cand.vibe_quote}"</Text>
                        </View>
                      </View>

                      <View style={[styles.scoreBadge, { borderColor: scoreColor }]}>
                        <Text style={[styles.scoreNum, { color: scoreColor }]}>
                          {Math.round(cand.compatibility_score)}%
                        </Text>
                        <Text style={styles.scoreLabel}>MATCH</Text>
                      </View>
                    </View>

                    {/* Transparency Signal Bar */}
                    <View style={styles.transparencyBar}>
                      <Text style={styles.transparencyText}>
                        Signals: {cand.enabled_factors_count} active
                        {cand.disabled_factors_count > 0 ? ` • ${cand.disabled_factors_count} excluded by your privacy rules` : ''}
                      </Text>
                      <TouchableOpacity
                        style={styles.expandBreakdownBtn}
                        onPress={() => setExpandedCandidateId(isExpanded ? null : cand.candidate_id)}
                      >
                        <Text style={styles.expandBreakdownText}>
                          {isExpanded ? 'Hide Factor Breakdown ▲' : 'View Transparency Breakdown ▼'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Detailed Factor Breakdown */}
                    {isExpanded && (
                      <View style={styles.breakdownBox}>
                        <Text style={styles.breakdownHeading}>Factor Transparency Matrix:</Text>
                        {Object.entries(cand.breakdown || {}).map(([key, item]) => {
                          const meta = FACTOR_METADATA.find(m => m.key.replace('use_', '') === key) || { title: key, emoji: '🔹' };
                          return (
                            <View key={key} style={styles.breakdownRow}>
                              <View style={styles.breakdownFactorLeft}>
                                <Text style={styles.factorEmoji}>{meta.emoji}</Text>
                                <Text style={styles.factorTitleText}>{meta.title}</Text>
                              </View>
                              <View style={styles.breakdownFactorRight}>
                                {item.enabled ? (
                                  <View style={styles.factorActiveBadge}>
                                    <Text style={styles.factorActiveStatus}>{item.status}</Text>
                                    <Text style={styles.factorActivePts}>+{item.score} pts</Text>
                                  </View>
                                ) : (
                                  <View style={styles.factorDisabledBadge}>
                                    <Text style={styles.factorDisabledText}>🔒 Ignored by user controls</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Action Button */}
                    <TouchableOpacity
                      style={styles.startDateBtn}
                      onPress={() => {
                        onClose();
                        if (onStartMatchWithCandidate) {
                          onStartMatchWithCandidate(cand);
                        }
                      }}
                    >
                      <Text style={styles.startDateBtnText}>
                        ⚡ Start Anonymous Interaction ({Math.round(cand.compatibility_score)}% Match)
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
                })
              )}
            </ScrollView>
          ) : (
            /* Tab 2: Privacy Controls */
            <ScrollView style={styles.contentScroll} contentContainerStyle={styles.scrollContent}>
              <View style={styles.controlsIntro}>
                <Text style={styles.controlsIntroTitle}>What data is used for matchmaking?</Text>
                <Text style={styles.controlsIntroSub}>
                  Toggle each factor on or off. When turned off, that factor is strictly excluded from scoring and candidate ranking.
                </Text>
              </View>

              {FACTOR_METADATA.map((f) => {
                const isEnabled = controls[f.key];
                return (
                  <View key={f.key} style={[styles.controlItemCard, !isEnabled && styles.controlItemCardDisabled]}>
                    <View style={styles.controlItemLeft}>
                      <Text style={styles.controlItemEmoji}>{f.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.controlItemTitle}>{f.title}</Text>
                        <Text style={styles.controlItemDesc}>{f.desc}</Text>
                      </View>
                    </View>

                    <Switch
                      value={isEnabled}
                      onValueChange={() => handleToggleControl(f.key)}
                      trackColor={{ false: '#334155', true: '#0284c7' }}
                      thumbColor={isEnabled ? '#38bdf8' : '#94a3b8'}
                    />
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.footerRefreshBtn} onPress={loadProfileAndSearch}>
              <Text style={styles.footerRefreshText}>🔄 Re-scan Anonymous Universe</Text>
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
    maxWidth: 600,
    height: '92%',
    maxHeight: 760,
    backgroundColor: '#070f1e',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#38bdf844',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 60px rgba(56, 189, 248, 0.2)'
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
    backgroundColor: '#0c182c'
  },
  headerTitleWrap: {
    flexDirection: 'column'
  },
  headerBadge: {
    color: '#38bdf8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2
  },
  headerTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800'
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
  guaranteeBanner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0e2338',
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a5f',
    alignItems: 'center'
  },
  guaranteeTitle: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase'
  },
  guaranteeSub: {
    color: '#e0f2fe',
    fontSize: 12,
    marginTop: 2
  },
  tabNav: {
    flexDirection: 'row',
    backgroundColor: '#091528',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b'
  },
  tabNavItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabNavItemActive: {
    borderBottomColor: '#38bdf8',
    backgroundColor: '#0f243e'
  },
  tabNavText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700'
  },
  tabNavTextActive: {
    color: '#38bdf8'
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  loadingText: {
    color: '#bae6fd',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14
  },
  contentScroll: {
    flex: 1,
    backgroundColor: '#050a14'
  },
  scrollContent: {
    padding: 16,
    gap: 14
  },
  recalculatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0c2340',
    paddingVertical: 6,
    borderRadius: 12,
    gap: 8,
    marginBottom: 4
  },
  recalculatingText: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '600'
  },
  candidateCard: {
    backgroundColor: '#0d1829',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16
  },
  candHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  candAvatarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 10
  },
  candAvatar: {
    fontSize: 32
  },
  candPseudonym: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800'
  },
  candVibeQuote: {
    color: '#94a3b8',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2
  },
  scoreBadge: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: '#091322'
  },
  scoreNum: {
    fontSize: 18,
    fontWeight: '900'
  },
  scoreLabel: {
    color: '#94a3b8',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  transparencyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#08101d',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginVertical: 8
  },
  transparencyText: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '600',
    flex: 1
  },
  expandBreakdownBtn: {
    paddingLeft: 8
  },
  expandBreakdownText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '700'
  },
  breakdownBox: {
    backgroundColor: '#08101d',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  breakdownHeading: {
    color: '#bae6fd',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 8
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#172234'
  },
  breakdownFactorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  factorEmoji: {
    fontSize: 14
  },
  factorTitleText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600'
  },
  breakdownFactorRight: {
    alignItems: 'flex-end'
  },
  factorActiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  factorActiveStatus: {
    color: '#94a3b8',
    fontSize: 11
  },
  factorActivePts: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800'
  },
  factorDisabledBadge: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  factorDisabledText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700'
  },
  startDateBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6
  },
  startDateBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  controlsIntro: {
    paddingHorizontal: 4,
    marginBottom: 8
  },
  controlsIntroTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800'
  },
  controlsIntroSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18
  },
  controlItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0d1829',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 14
  },
  controlItemCardDisabled: {
    opacity: 0.6,
    borderColor: '#172234'
  },
  controlItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 12
  },
  controlItemEmoji: {
    fontSize: 22
  },
  controlItemTitle: {
    color: '#f1f5f9',
    fontSize: 14,
    fontWeight: '800'
  },
  controlItemDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 16
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    backgroundColor: '#0c182c',
    alignItems: 'center'
  },
  footerRefreshBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155'
  },
  footerRefreshText: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '700'
  },
  emptyStateBox: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20
  },
  emptyStateTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center'
  },
  emptyStateSub: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    maxWidth: 440
  },
  emptyTipCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 16,
    gap: 6
  },
  emptyTipTitle: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4
  },
  emptyTipText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 16
  }
});
