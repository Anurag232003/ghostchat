import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';

import {
  fetchProgressiveRevealStatus,
  declareProgressiveMutualInterest,
  requestProgressivePhotoReveal,
  consentProgressivePhotoReveal,
  fastForwardProgressiveReveal,
  resetProgressiveReveal
} from '../services/api';

export const PROGRESSIVE_STAGES = [
  { stage: 0, label: 'Mystery Person', icon: '🌑', timeHint: 'At beginning (0m)', desc: 'Pure masked shadow. All traits hidden.' },
  { stage: 1, label: 'Interest #1', icon: '🎮', timeHint: 'After 5 minutes', desc: 'First core interest emerges from shadows.' },
  { stage: 2, label: 'Nickname', icon: '🏷️', timeHint: 'After 10 minutes', desc: 'Real pseudonym & handle unveiled.' },
  { stage: 3, label: 'Avatar', icon: '🎨', timeHint: 'After Mutual Interest', desc: 'Curated aesthetic avatar & palette bloom.' },
  { stage: 4, label: 'Photo Reveal', icon: '📸', timeHint: 'Mutual Consent', desc: 'Full authentic photo & profile unblurred.' },
];

export function ProgressiveIdentityReveal({
  currentUserId,
  peerUserId,
  peerFallbackName = 'Nova',
  onStageChanged,
  onPhotoRevealed
}) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [showTestControls, setShowTestControls] = useState(false);
  const [simulatedPromptVisible, setSimulatedPromptVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (currentUserId && peerUserId) {
      loadStatus();
    }
  }, [currentUserId, peerUserId]);

  // Live timer tick every 10 seconds to update time progress
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentUserId && peerUserId && !loading) {
        loadStatus(true);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [currentUserId, peerUserId, loading]);

  async function loadStatus(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetchProgressiveRevealStatus(currentUserId, peerUserId);
      setStatus(res);
      if (onStageChanged) onStageChanged(res.stage);
      if (res.photo_unlocked && onPhotoRevealed) {
        onPhotoRevealed(res.photo_url);
      }
    } catch (err) {
      console.warn('Progressive reveal status load failed:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function handleToggleMutualInterest() {
    if (!status) return;
    setActionLoading(true);
    try {
      const nextState = !status.my_interest_declared;
      const res = await declareProgressiveMutualInterest(currentUserId, peerUserId, nextState);
      await loadStatus(true);
      if (res.mutual_interest) {
        Alert.alert('✨ Mutual Spark!', 'Both of you expressed mutual interest! Avatar has been revealed!');
      } else if (nextState) {
        Alert.alert('💖 Interest Expressed', `You expressed interest in ${status.nickname || status.ghost_id}. Waiting for peer to reciprocate!`);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRequestPhotoReveal() {
    setActionLoading(true);
    try {
      await requestProgressivePhotoReveal(currentUserId, peerUserId);
      await loadStatus(true);
      Alert.alert('Photo Reveal Requested 🔒', `A reveal consent request has been sent to ${status?.nickname || 'your peer'}. Both must consent to lift the veil!`);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConsentResponse(consent) {
    setActionLoading(true);
    try {
      const res = await consentProgressivePhotoReveal(currentUserId, peerUserId, consent);
      setSimulatedPromptVisible(false);
      await loadStatus(true);
      if (res.outcome === 'mutual_reveal') {
        Alert.alert('🎉 Veil Lifted!', 'Both participants consented! Authentic photo & profile are now revealed!');
      } else if (res.outcome === 'declined') {
        Alert.alert('🔒 Kept Anonymous', 'Photo reveal declined. Profile remains anonymous and protected.');
      } else {
        Alert.alert('✓ Consent Recorded', 'Waiting for peer to make their decision...');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleFastForward(seconds) {
    setActionLoading(true);
    try {
      await fastForwardProgressiveReveal(currentUserId, peerUserId, seconds);
      await loadStatus(true);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResetSession() {
    setActionLoading(true);
    try {
      await resetProgressiveReveal(currentUserId, peerUserId);
      setSimulatedPromptVisible(false);
      await loadStatus(true);
      Alert.alert('Reset Complete', 'Progressive reveal session reset back to 00:00 (🌑 Mystery Person).');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading && !status) {
    return (
      <View style={styles.cardContainer}>
        <ActivityIndicator color="#818CF8" style={{ padding: 12 }} />
      </View>
    );
  }

  const elapsed = status?.elapsed_seconds || 0;
  const currentStage = status?.stage || 0;
  const peerName = status?.nickname || peerFallbackName || 'Nova';
  const showPromptCard = status?.photo_consent_status === 'requested_by_peer' || simulatedPromptVisible;

  // Format time remaining for milestones
  function getMilestoneText() {
    if (currentStage === 0) {
      const left = Math.max(0, 300 - Math.floor(elapsed));
      const m = Math.floor(left / 60);
      const s = left % 60;
      return `⏱️ ${m}:${s.toString().padStart(2, '0')} to Interest #1 reveal`;
    }
    if (currentStage === 1) {
      const left = Math.max(0, 600 - Math.floor(elapsed));
      const m = Math.floor(left / 60);
      const s = left % 60;
      return `⏱️ ${m}:${s.toString().padStart(2, '0')} to Nickname reveal`;
    }
    if (currentStage === 2) {
      return status?.mutual_interest_unlocked
        ? '✓ Mutual interest active'
        : '💖 Declare mutual interest to reveal Avatar';
    }
    if (currentStage === 3) {
      return '🔒 Ready for Mutual Photo Reveal';
    }
    return '✨ Authentic Photo & Profile Revealed';
  }

  return (
    <View style={styles.cardContainer}>
      {/* Top Header Bar */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.ghostBadgeIcon}>👻</Text>
          <View>
            <View style={styles.stageTagRow}>
              <Text style={styles.headerTitle}>PROGRESSIVE IDENTITY</Text>
              <View style={[styles.stageBadge, { backgroundColor: getStageColor(currentStage) }]}>
                <Text style={styles.stageBadgeText}>STAGE {currentStage}: {status?.stage_name?.toUpperCase() || 'MYSTERY PERSON'}</Text>
              </View>
            </View>
            <Text style={styles.milestoneText}>{getMilestoneText()}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.expandBtn}>
          <Text style={styles.expandBtnText}>{expanded ? '▲ Close' : '▼ Details'}</Text>
        </TouchableOpacity>
      </View>

      {/* 5-Step Visual Timeline (0m -> 5m -> 10m -> Mutual -> Photo) */}
      <View style={styles.timelineRow}>
        {PROGRESSIVE_STAGES.map((stg) => {
          const isDone = currentStage >= stg.stage;
          const isCurrent = currentStage === stg.stage;
          return (
            <View key={stg.stage} style={styles.timelineStep}>
              <View style={[
                styles.stepCircle,
                isDone && styles.stepCircleDone,
                isCurrent && styles.stepCircleCurrent
              ]}>
                <Text style={styles.stepCircleIcon}>{stg.icon}</Text>
              </View>
              <Text style={[styles.stepLabel, isDone && styles.stepLabelDone]}>
                {stg.label}
              </Text>
              <Text style={styles.stepSubHint}>
                {stg.stage === 0 ? '0m' : stg.stage === 1 ? '5m' : stg.stage === 2 ? '10m' : stg.stage === 3 ? 'Mutual' : 'Consent'}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Persona Showcase Banner */}
      <View style={styles.personaCard}>
        {/* Avatar Presentation */}
        <View style={styles.avatarWrapper}>
          {status?.photo_unlocked && status?.photo_url ? (
            <View style={styles.photoContainer}>
              <Image source={{ uri: status.photo_url }} style={styles.realPhoto} />
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedIcon}>✓</Text>
              </View>
            </View>
          ) : (
            <View style={[
              styles.avatarPlaceholder,
              currentStage >= 3
                ? { backgroundColor: status?.avatar_color || '#38BDF8', borderColor: '#38BDF8' }
                : { backgroundColor: '#1E293B', borderColor: '#475569' }
            ]}>
              <Text style={styles.avatarPlaceholderText}>
                {currentStage >= 3 ? (status?.avatar_emoji || '🌙') : '🌑'}
              </Text>
            </View>
          )}

          <View style={styles.stageLevelPill}>
            <Text style={styles.stageLevelPillText}>S{currentStage}</Text>
          </View>
        </View>

        {/* Identity Traits Box */}
        <View style={styles.identityDetails}>
          {/* Identity Name Row */}
          <View style={styles.nameRow}>
            <Text style={styles.displayName}>
              {currentStage >= 2 ? (status?.nickname || '🌙 Nova') : (status?.ghost_id || 'Shadow#0000')}
            </Text>
            {currentStage < 2 && (
              <View style={styles.mysteryPill}>
                <Text style={styles.mysteryPillText}>🌑 Mystery Person</Text>
              </View>
            )}
            {currentStage >= 4 && status?.first_name && (
              <Text style={styles.realNameBadge}>({status.first_name})</Text>
            )}
          </View>

          {/* Interest #1 Showcase (Unlocked after 5 min) */}
          <View style={styles.interestsContainer}>
            {currentStage >= 1 && status?.interest_1 ? (
              <View style={styles.unlockedInterestChip}>
                <Text style={styles.interestSparkle}>✨</Text>
                <Text style={styles.unlockedInterestText}>Interest #1: {status.interest_1}</Text>
                <View style={styles.unlocked5mTag}>
                  <Text style={styles.unlocked5mTagText}>5m Unlocked</Text>
                </View>
              </View>
            ) : (
              <View style={styles.lockedInterestChip}>
                <Text style={styles.lockedInterestText}>🔒 Interest #1 revealed after 5 minutes</Text>
              </View>
            )}
          </View>

          {/* Status Subtitle */}
          <Text style={styles.identitySubtitle}>
            {currentStage === 0 && 'Identity shrouded. Chat 5 mins to unveil first interest.'}
            {currentStage === 1 && 'First interest unlocked! Chat 10 mins to unveil nickname.'}
            {currentStage === 2 && 'Nickname unlocked! Express mutual interest to unlock avatar.'}
            {currentStage === 3 && 'Avatar bloomed! Both must consent for mutual photo reveal.'}
            {currentStage === 4 && 'Authentic photo & verified profile mutually unlocked!'}
          </Text>
        </View>
      </View>

      {/* ========================================================================= */}
      {/* 🔒 THE MUTUAL CONSENT PHOTO REVEAL PROMPT DIALOG (EXACT SPECIFICATION) */}
      {/* ========================================================================= */}
      {showPromptCard && (
        <View style={styles.consentPromptBox}>
          <View style={styles.consentHeader}>
            <Text style={styles.consentTitle}>
              {status?.requester_nickname || peerName} wants to reveal their profile.
            </Text>
          </View>

          {/* Big Centered Lock */}
          <View style={styles.lockContainer}>
            <View style={styles.lockGlowRing}>
              <Text style={styles.bigLockIcon}>🔒</Text>
            </View>
          </View>

          <Text style={styles.consentQuestion}>Reveal to each other?</Text>
          <Text style={styles.consentSubNotice}>
            Both users must consent before mutual reveal. If either chooses to keep anonymous, identities stay 100% encrypted and sealed.
          </Text>

          {/* Action Buttons: [ Reveal ]  [ Keep Anonymous ] */}
          <View style={styles.consentButtonsRow}>
            <TouchableOpacity
              style={styles.revealBtn}
              onPress={() => handleConsentResponse(true)}
              disabled={actionLoading}
            >
              <Text style={styles.revealBtnText}>[ Reveal ]</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.keepAnonymousBtn}
              onPress={() => handleConsentResponse(false)}
              disabled={actionLoading}
            >
              <Text style={styles.keepAnonymousBtnText}>[ Keep Anonymous ]</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Interactive Actions Row */}
      <View style={styles.actionBar}>
        {/* Button 1: Express Mutual Interest */}
        <TouchableOpacity
          style={[
            styles.interestActionBtn,
            status?.my_interest_declared && styles.interestActionBtnActive
          ]}
          onPress={handleToggleMutualInterest}
          disabled={actionLoading}
        >
          <Text style={styles.interestActionBtnText}>
            {status?.mutual_interest_unlocked
              ? '✨ Mutual Interest Confirmed'
              : status?.my_interest_declared
              ? '💖 Interest Declared (Waiting for Peer)'
              : '💖 Express Mutual Interest'}
          </Text>
        </TouchableOpacity>

        {/* Button 2: Request Photo Reveal */}
        {currentStage >= 3 && !status?.photo_unlocked && !showPromptCard && (
          <TouchableOpacity
            style={styles.requestPhotoBtn}
            onPress={handleRequestPhotoReveal}
            disabled={actionLoading || status?.photo_consent_status === 'requested_by_me'}
          >
            <Text style={styles.requestPhotoBtnText}>
              {status?.photo_consent_status === 'requested_by_me'
                ? '⏳ Awaiting Consent...'
                : '📸 Request Photo Reveal'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Expanded Details Section */}
      {expanded && (
        <View style={styles.expandedSection}>
          <Text style={styles.expandedHeading}>PROGRESSIVE IDENTITY STATUS DETAILS</Text>

          {/* Stage 1 Breakdown */}
          <View style={styles.detailRow}>
            <Text style={styles.detailStageNum}>5 MINS:</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>Interest #1 Reveal</Text>
              <Text style={styles.detailValue}>
                {status?.interest_1_unlocked ? `✓ Unlocked: ${status.interest_1}` : '🔒 Locked (Unlocks at 5:00 of chat)'}
              </Text>
            </View>
          </View>

          {/* Stage 2 Breakdown */}
          <View style={styles.detailRow}>
            <Text style={styles.detailStageNum}>10 MINS:</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>Nickname Reveal</Text>
              <Text style={styles.detailValue}>
                {status?.nickname_unlocked ? `✓ Unlocked: ${status.nickname}` : '🔒 Locked (Unlocks at 10:00 of chat)'}
              </Text>
            </View>
          </View>

          {/* Stage 3 Breakdown */}
          <View style={styles.detailRow}>
            <Text style={styles.detailStageNum}>SPARK:</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>Avatar Reveal</Text>
              <Text style={styles.detailValue}>
                {status?.mutual_interest_unlocked
                  ? `✓ Unlocked: Avatar ${status.avatar_emoji || '🌙'}`
                  : '🔒 Locked (Requires both users to declare mutual interest)'}
              </Text>
            </View>
          </View>

          {/* Stage 4 Breakdown */}
          <View style={styles.detailRow}>
            <Text style={styles.detailStageNum}>MUTUAL:</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>Photo Reveal (Strict Mutual Consent)</Text>
              <Text style={styles.detailValue}>
                {status?.photo_unlocked
                  ? '✓ Unlocked: Authentic photo revealed'
                  : '🔒 Locked (Requires both to click [ Reveal ])'}
              </Text>
            </View>
          </View>

          {/* Full Traits if Photo Unlocked */}
          {status?.photo_unlocked && (
            <View style={styles.fullTraitsBox}>
              <Text style={styles.fullTraitsTitle}>AUTHENTIC PROFILE REVEALED</Text>
              <Text style={styles.fullTraitItem}>🏷️ Name: {status.first_name || peerName}</Text>
              {status.age && <Text style={styles.fullTraitItem}>🎂 Age: {status.age}</Text>}
              {status.vibe && <Text style={styles.fullTraitItem}>🌌 Vibe: {status.vibe}</Text>}
              {status.all_interests && (
                <Text style={styles.fullTraitItem}>
                  🎯 All Interests: {status.all_interests.join(' • ')}
                </Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function getStageColor(stage) {
  switch (stage) {
    case 1: return '#818CF8';
    case 2: return '#38BDF8';
    case 3: return '#EC4899';
    case 4: return '#10B981';
    default: return '#64748B';
  }
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1
  },
  ghostBadgeIcon: {
    fontSize: 22
  },
  stageTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap'
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8
  },
  stageBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  stageBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0F172A'
  },
  milestoneText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
    marginTop: 2
  },
  expandBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155'
  },
  expandBtnText: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '600'
  },
  timelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 10
  },
  timelineStep: {
    alignItems: 'center',
    flex: 1
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2
  },
  stepCircleDone: {
    backgroundColor: '#0F172A',
    borderColor: '#10B981',
    borderWidth: 2
  },
  stepCircleCurrent: {
    borderColor: '#38BDF8',
    borderWidth: 2,
    backgroundColor: '#0369A1'
  },
  stepCircleIcon: {
    fontSize: 13
  },
  stepLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center'
  },
  stepLabelDone: {
    color: '#E2E8F0'
  },
  stepSubHint: {
    fontSize: 8,
    color: '#475569'
  },
  personaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10
  },
  avatarWrapper: {
    position: 'relative'
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2
  },
  avatarPlaceholderText: {
    fontSize: 22
  },
  photoContainer: {
    position: 'relative'
  },
  realPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#10B981'
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#10B981',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  verifiedIcon: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900'
  },
  stageLevelPill: {
    position: 'absolute',
    top: -4,
    left: -4,
    backgroundColor: '#0F172A',
    borderColor: '#38BDF8',
    borderWidth: 1,
    paddingHorizontal: 4,
    borderRadius: 6
  },
  stageLevelPillText: {
    color: '#38BDF8',
    fontSize: 8,
    fontWeight: '800'
  },
  identityDetails: {
    flex: 1
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap'
  },
  displayName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF'
  },
  mysteryPill: {
    backgroundColor: '#334155',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4
  },
  mysteryPillText: {
    fontSize: 10,
    color: '#CBD5E1',
    fontWeight: '600'
  },
  realNameBadge: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600'
  },
  interestsContainer: {
    marginVertical: 4
  },
  unlockedInterestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 4
  },
  interestSparkle: {
    fontSize: 11
  },
  unlockedInterestText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8'
  },
  unlocked5mTag: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 4
  },
  unlocked5mTagText: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: '800'
  },
  lockedInterestChip: {
    backgroundColor: 'rgba(51, 65, 85, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start'
  },
  lockedInterestText: {
    fontSize: 10,
    color: '#94A3B8',
    fontStyle: 'italic'
  },
  identitySubtitle: {
    fontSize: 10,
    color: '#94A3B8'
  },

  /* Consent Box (Prompt Card) */
  consentPromptBox: {
    backgroundColor: '#090D16',
    borderWidth: 2,
    borderColor: '#38BDF8',
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6
  },
  consentHeader: {
    alignItems: 'center',
    marginBottom: 8
  },
  consentTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center'
  },
  lockContainer: {
    marginVertical: 8,
    alignItems: 'center'
  },
  lockGlowRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 2,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center'
  },
  bigLockIcon: {
    fontSize: 26
  },
  consentQuestion: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
    marginVertical: 4
  },
  consentSubNotice: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 12
  },
  consentButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center'
  },
  revealBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 8,
    shadowColor: '#10B981',
    shadowOpacity: 0.4,
    shadowRadius: 8
  },
  revealBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5
  },
  keepAnonymousBtn: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569'
  },
  keepAnonymousBtnText: {
    color: '#F1F5F9',
    fontWeight: '700',
    fontSize: 13
  },

  /* Action Buttons Bar */
  actionBar: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10
  },
  interestActionBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#EC4899',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center'
  },
  interestActionBtnActive: {
    backgroundColor: '#831843',
    borderColor: '#F472B6'
  },
  interestActionBtnText: {
    color: '#F472B6',
    fontWeight: '700',
    fontSize: 11
  },
  requestPhotoBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center'
  },
  requestPhotoBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11
  },

  /* Expanded Section */
  expandedSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#334155'
  },
  expandedHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 4,
    gap: 8
  },
  detailStageNum: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
    width: 60
  },
  detailTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E2E8F0'
  },
  detailValue: {
    fontSize: 10,
    color: '#94A3B8'
  },
  fullTraitsBox: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#10B981',
    marginTop: 8
  },
  fullTraitsTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
    marginBottom: 4
  },
  fullTraitItem: {
    fontSize: 11,
    color: '#E2E8F0',
    marginVertical: 1
  },
  testToggleBtn: {
    marginTop: 10,
    paddingVertical: 6,
    alignItems: 'center'
  },
  testToggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A78BFA'
  },
  testBarContainer: {
    backgroundColor: '#1E1B4B',
    borderRadius: 8,
    padding: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#4338CA'
  },
  testBarTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C4B5FD',
    marginBottom: 2
  },
  testBarDesc: {
    fontSize: 9,
    color: '#A5B4FC',
    marginBottom: 8
  },
  testBtnsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  testBtn: {
    backgroundColor: '#3730A3',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6
  },
  testBtnText: {
    color: '#EDE9FE',
    fontSize: 10,
    fontWeight: '700'
  }
});
