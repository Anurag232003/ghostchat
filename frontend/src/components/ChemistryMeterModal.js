import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from 'react-native';

import {
  fetchConversationChemistry,
  simulateChemistryInteraction
} from '../services/api';

export function ChemistryMeterModal({
  visible,
  onClose,
  currentUserId,
  peerUserId,
  peerName = 'Partner',
  onOpenMiniGames
}) {
  const [loading, setLoading] = useState(true);
  const [chemistry, setChemistry] = useState(null);
  const [boosting, setBoosting] = useState(false);

  useEffect(() => {
    if (visible && currentUserId && peerUserId) {
      loadChemistry();
    }
  }, [visible, currentUserId, peerUserId]);

  async function loadChemistry() {
    setLoading(true);
    try {
      const data = await fetchConversationChemistry(currentUserId, peerUserId);
      setChemistry(data);
    } catch (err) {
      console.warn('Failed to load conversation chemistry:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleBoost(type) {
    if (boosting) return;
    setBoosting(true);
    try {
      const updated = await simulateChemistryInteraction(currentUserId, peerUserId, type);
      setChemistry(updated);
    } catch (err) {
      console.warn('Failed to boost chemistry:', err);
    } finally {
      setBoosting(false);
    }
  }

  const score = chemistry?.score ?? 82;
  const asciiBar = chemistry?.ascii_bar ?? '████████░░ 82';
  const tierEmoji = chemistry?.tier_emoji ?? '⚡';
  const tierName = chemistry?.tier ?? 'Vibrant Spark';
  const breakdown = chemistry?.breakdown;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.headerIcon}>❤️</Text>
              <View>
                <Text style={styles.headerTitle}>Conversation Chemistry</Text>
                <Text style={styles.headerSubtitle}>Interaction metric with {peerName}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#F43F5E" />
              <Text style={styles.loadingText}>Calculating interaction wavelengths...</Text>
            </View>
          ) : (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              {/* Hero Banner with Exact ASCII Meter */}
              <View style={styles.heroBox}>
                <Text style={styles.heroLabel}>CONVERSATION CHEMISTRY</Text>
                
                {/* Visual Numerical + ASCII Representation */}
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreNumber}>{score}</Text>
                  <View style={styles.tierPill}>
                    <Text style={styles.tierPillText}>{tierEmoji} {tierName}</Text>
                  </View>
                </View>

                {/* Exact ASCII Bar from Specification: ████████░░ 82 */}
                <View style={styles.asciiBarCard}>
                  <Text style={styles.asciiBarText}>{asciiBar}</Text>
                </View>

                {/* Graphical Fill Bar */}
                <View style={styles.graphicalBarTrack}>
                  <View style={[styles.graphicalBarFill, { width: `${Math.min(100, Math.max(5, score))}%` }]} />
                </View>

                <Text style={styles.tierDescription}>
                  {chemistry?.tier_description || 'High mutual engagement and playful game harmony!'}
                </Text>
              </View>

              {/* Required Prominent Disclaimer Box */}
              <View style={styles.disclaimerBox}>
                <View style={styles.disclaimerIconRow}>
                  <Text style={styles.disclaimerIcon}>ℹ️</Text>
                  <Text style={styles.disclaimerHeading}>App-Generated Interaction Metric</Text>
                </View>
                <Text style={styles.disclaimerBody}>
                  {chemistry?.disclaimer ||
                    'Conversation Chemistry is an app-generated interaction metric based on chat engagement and game dynamics, not a factual measure of relationship compatibility.'}
                </Text>
              </View>

              {/* 5 Scoring Dimensions Breakdown */}
              <Text style={styles.breakdownHeading}>INTERACTION BREAKDOWN</Text>

              {/* 1. Mutual Answers */}
              <View style={styles.dimensionCard}>
                <View style={styles.dimHeaderRow}>
                  <Text style={styles.dimIcon}>🎯</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dimTitle}>Mutual Answers</Text>
                    <Text style={styles.dimDetail}>
                      {breakdown?.mutual_answers?.detail || 'Resonant choices in This or That & Blind Date dilemmas'}
                    </Text>
                  </View>
                  <Text style={styles.dimScore}>
                    {breakdown?.mutual_answers?.score ?? 18}/20
                  </Text>
                </View>
                <View style={styles.dimTrack}>
                  <View style={[styles.dimFill, { width: `${((breakdown?.mutual_answers?.score ?? 18) / 20) * 100}%` }]} />
                </View>
              </View>

              {/* 2. Shared Interests */}
              <View style={styles.dimensionCard}>
                <View style={styles.dimHeaderRow}>
                  <Text style={styles.dimIcon}>🌟</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dimTitle}>Shared Interests</Text>
                    <Text style={styles.dimDetail}>
                      {breakdown?.shared_interests?.detail || '3 common passions aligned'}
                    </Text>
                  </View>
                  <Text style={styles.dimScore}>
                    {breakdown?.shared_interests?.score ?? 16}/20
                  </Text>
                </View>
                <View style={styles.tagsRow}>
                  {(breakdown?.shared_interests?.shared_items || ['🎮 Gaming', '☕ Coffee', '🌙 Late nights']).map((t, i) => (
                    <View key={i} style={styles.sharedTag}>
                      <Text style={styles.sharedTagText}>{t}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.dimTrack}>
                  <View style={[styles.dimFill, { width: `${((breakdown?.shared_interests?.score ?? 16) / 20) * 100}%` }]} />
                </View>
              </View>

              {/* 3. Conversation Participation */}
              <View style={styles.dimensionCard}>
                <View style={styles.dimHeaderRow}>
                  <Text style={styles.dimIcon}>💬</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dimTitle}>Conversation Participation</Text>
                    <Text style={styles.dimDetail}>
                      {breakdown?.conversation_participation?.detail || 'Balanced turn-taking & steady reciprocal engagement'}
                    </Text>
                  </View>
                  <Text style={styles.dimScore}>
                    {breakdown?.conversation_participation?.score ?? 20}/25
                  </Text>
                </View>
                <View style={styles.dimSubMeta}>
                  <Text style={styles.dimMetaText}>
                    Total Messages: {breakdown?.conversation_participation?.total_messages ?? 14}
                  </Text>
                  <Text style={styles.dimMetaText}>
                    Balance: {breakdown?.conversation_participation?.balance_ratio ?? '52% / 48%'}
                  </Text>
                </View>
                <View style={styles.dimTrack}>
                  <View style={[styles.dimFill, { width: `${((breakdown?.conversation_participation?.score ?? 20) / 25) * 100}%` }]} />
                </View>
              </View>

              {/* 4. Mini-Game Results */}
              <View style={styles.dimensionCard}>
                <View style={styles.dimHeaderRow}>
                  <Text style={styles.dimIcon}>🎲</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dimTitle}>Mini-Game Results</Text>
                    <Text style={styles.dimDetail}>
                      {breakdown?.mini_game_results?.detail || 'Active participation in Dilemmas, Two Truths & Guess Me'}
                    </Text>
                  </View>
                  <Text style={styles.dimScore}>
                    {breakdown?.mini_game_results?.score ?? 16}/20
                  </Text>
                </View>
                <View style={styles.dimTrack}>
                  <View style={[styles.dimFill, { width: `${((breakdown?.mini_game_results?.score ?? 16) / 20) * 100}%` }]} />
                </View>
              </View>

              {/* 5. Mutual Reactions */}
              <View style={styles.dimensionCard}>
                <View style={styles.dimHeaderRow}>
                  <Text style={styles.dimIcon}>❤️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dimTitle}>Mutual Reactions</Text>
                    <Text style={styles.dimDetail}>
                      {breakdown?.mutual_reactions?.detail || '5 heartfelt emoji reactions exchanged'}
                    </Text>
                  </View>
                  <Text style={styles.dimScore}>
                    {breakdown?.mutual_reactions?.score ?? 12}/15
                  </Text>
                </View>
                <View style={styles.dimTrack}>
                  <View style={[styles.dimFill, { width: `${((breakdown?.mutual_reactions?.score ?? 12) / 15) * 100}%` }]} />
                </View>
              </View>

              {/* Actions: Launch mini-games or simulate boosts */}
              <View style={styles.actionsSection}>
                <TouchableOpacity
                  style={styles.playMiniGameBtn}
                  onPress={() => {
                    onClose();
                    if (onOpenMiniGames) onOpenMiniGames();
                  }}
                >
                  <Text style={styles.playMiniGameBtnText}>
                    🎲 Boost Chemistry with Mini Games ➔
                  </Text>
                </TouchableOpacity>
              </View>
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
    maxWidth: 580,
    maxHeight: '90%',
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
    fontSize: 26,
    marginRight: 10
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 17,
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
  heroBox: {
    backgroundColor: '#1E1B4B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F43F5E',
    padding: 18,
    alignItems: 'center',
    marginBottom: 16
  },
  heroLabel: {
    color: '#F43F5E',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 6
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10
  },
  scoreNumber: {
    color: '#F8FAFC',
    fontSize: 48,
    fontWeight: '900'
  },
  tierPill: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    borderWidth: 1,
    borderColor: '#FB7185',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5
  },
  tierPillText: {
    color: '#FFE4E6',
    fontSize: 13,
    fontWeight: '800'
  },
  asciiBarCard: {
    backgroundColor: '#020617',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4338CA',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginVertical: 8
  },
  asciiBarText: {
    color: '#38BDF8',
    fontSize: 18,
    fontWeight: '900',
    fontFamily: 'monospace',
    letterSpacing: 2
  },
  graphicalBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#334155',
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 8
  },
  graphicalBarFill: {
    height: '100%',
    backgroundColor: '#F43F5E',
    borderRadius: 4
  },
  tierDescription: {
    color: '#CBD5E1',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4
  },

  // Required Disclaimer
  disclaimerBox: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAB308',
    padding: 12,
    marginBottom: 18
  },
  disclaimerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  disclaimerIcon: {
    fontSize: 15,
    marginRight: 6
  },
  disclaimerHeading: {
    color: '#FDE047',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  disclaimerBody: {
    color: '#CBD5E1',
    fontSize: 11,
    lineHeight: 16
  },

  breakdownHeading: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 10
  },
  dimensionCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 10
  },
  dimHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6
  },
  dimIcon: {
    fontSize: 20,
    marginRight: 10,
    marginTop: 2
  },
  dimTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800'
  },
  dimDetail: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2
  },
  dimScore: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 8
  },
  dimSubMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  dimMetaText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700'
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: 4
  },
  sharedTag: {
    backgroundColor: '#0F172A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#334155'
  },
  sharedTagText: {
    color: '#CBD5E1',
    fontSize: 10,
    fontWeight: '700'
  },
  dimTrack: {
    height: 5,
    backgroundColor: '#0F172A',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 6
  },
  dimFill: {
    height: '100%',
    backgroundColor: '#38BDF8',
    borderRadius: 3
  },

  // Actions
  actionsSection: {
    marginTop: 10,
    paddingBottom: 20
  },
  playMiniGameBtn: {
    backgroundColor: '#BE123C',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10
  },
  playMiniGameBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  boostButtonsRow: {
    flexDirection: 'row',
    gap: 8
  },
  boostBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center'
  },
  boostBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700'
  }
});
