import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';

import {
  fetchBlurProfileStatus,
  submitBlurConsent,
  stepBlurStage,
  resetBlurProfile
} from '../services/api';

const DEFAULT_AVATAR_IMAGE = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80';

export function BlurProfileModal({
  visible,
  onClose,
  currentUserId,
  peerUserId,
  peerName = 'Match',
  onStageChange
}) {
  const [loading, setLoading] = useState(true);
  const [blurData, setBlurData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (visible && currentUserId && peerUserId) {
      loadStatus();
    }
  }, [visible, currentUserId, peerUserId]);

  async function loadStatus() {
    setLoading(true);
    try {
      const data = await fetchBlurProfileStatus(currentUserId, peerUserId);
      setBlurData(data);
      if (onStageChange) {
        onStageChange(data.current_stage);
      }
    } catch (err) {
      console.warn('Failed to fetch blur profile status:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConsent(agree) {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const res = await submitBlurConsent(currentUserId, peerUserId, agree);
      await loadStatus();
      if (res.advanced) {
        Alert.alert(
          '✨ Blur Level Advanced!',
          `Both users agreed! Profile transitioned to: ${res.stage_label}`
        );
      } else if (agree) {
        Alert.alert(
          '✓ Consent Registered',
          `You agreed to reveal the next blur level. Waiting for ${peerName} to reciprocate!`
        );
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDirectStep(targetStage) {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await stepBlurStage(currentUserId, peerUserId, targetStage);
      await loadStatus();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReset() {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      await resetBlurProfile(currentUserId, peerUserId);
      await loadStatus();
      Alert.alert('Profile Re-veiled 🔒', 'Blur level reset to Blur 100% (Mystery Person).');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setActionLoading(false);
    }
  }

  const currentStage = blurData?.current_stage ?? 0;
  const blurPercent = blurData?.blur_percent ?? 100;
  const blurRadius = blurData?.blur_radius ?? 30;
  const myConsent = blurData?.my_consent ?? false;
  const peerConsent = blurData?.peer_consent ?? false;
  const isClear = currentStage === 3;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.modalTitle}>🌫️ Blur-to-Reveal Profile</Text>
              <Text style={styles.modalSub}>
                Controlled strictly by mutual consent
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#a855f7" />
              <Text style={styles.loadingText}>Loading progressive veil state...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              {/* Vertical Blur Stages Pipeline */}
              <View style={styles.pipelineContainer}>
                <View style={[styles.pipelineStep, currentStage === 0 && styles.pipelineStepActive]}>
                  <Text style={[styles.pipelineStepText, currentStage === 0 && styles.pipelineStepTextActive]}>
                    Blur 100%
                  </Text>
                </View>
                <Text style={styles.pipelineArrow}>↓</Text>

                <View style={[styles.pipelineStep, currentStage === 1 && styles.pipelineStepActive]}>
                  <Text style={[styles.pipelineStepText, currentStage === 1 && styles.pipelineStepTextActive]}>
                    Blur 70%
                  </Text>
                </View>
                <Text style={styles.pipelineArrow}>↓</Text>

                <View style={[styles.pipelineStep, currentStage === 2 && styles.pipelineStepActive]}>
                  <Text style={[styles.pipelineStepText, currentStage === 2 && styles.pipelineStepTextActive]}>
                    Blur 40%
                  </Text>
                </View>
                <Text style={styles.pipelineArrow}>↓</Text>

                <View style={[styles.pipelineStep, currentStage === 3 && styles.pipelineStepActiveClear]}>
                  <Text style={[styles.pipelineStepText, currentStage === 3 && styles.pipelineStepTextActiveClear]}>
                    Clear ✨
                  </Text>
                </View>
              </View>

              {/* Central Avatar Visual Stage */}
              <View style={styles.avatarShowcase}>
                <View style={[styles.avatarGlowRing, isClear ? styles.ringClear : styles.ringBlurred]}>
                  <View style={styles.avatarFrame}>
                    <Image
                      source={{ uri: blurData?.photo_url || DEFAULT_AVATAR_IMAGE }}
                      style={styles.avatarImage}
                      blurRadius={blurRadius}
                    />

                    {/* Stage 0 ASCII Art Overlay */}
                    {currentStage === 0 && (
                      <View style={styles.asciiOverlay}>
                        <Text style={styles.asciiArtText}>{blurData?.ascii_art}</Text>
                        <Text style={styles.mysteryPersonLabel}>Mystery Person</Text>
                      </View>
                    )}

                    {/* Stage 1 Soft Silhouette Tag */}
                    {currentStage === 1 && (
                      <View style={styles.softOverlay}>
                        <Text style={styles.stageTag}>70% Veiled Contour</Text>
                      </View>
                    )}

                    {/* Stage 2 Ambient Outline Tag */}
                    {currentStage === 2 && (
                      <View style={styles.softOverlay}>
                        <Text style={styles.stageTag}>40% Ambient Lighting</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Stage Title Banner */}
                <View style={styles.stageTitleBadge}>
                  <Text style={styles.stageTitleText}>
                    {blurData?.stage_label}: {blurData?.stage_title}
                  </Text>
                </View>
                <Text style={styles.stageDescription}>
                  {blurData?.stage_description}
                </Text>
              </View>

              {/* Mutual Agreement Status Card */}
              <View style={styles.consentCard}>
                <Text style={styles.consentCardTitle}>Mutual Consent Verification</Text>
                <View style={styles.consentGrid}>
                  <View style={styles.consentItem}>
                    <Text style={styles.consentUserLabel}>You</Text>
                    <Text style={[styles.consentStatusVal, myConsent ? styles.statusAgreed : styles.statusPending]}>
                      {myConsent ? '✓ Agreed' : '○ Not yet'}
                    </Text>
                  </View>
                  <View style={styles.consentDivider} />
                  <View style={styles.consentItem}>
                    <Text style={styles.consentUserLabel}>{peerName}</Text>
                    <Text style={[styles.consentStatusVal, peerConsent ? styles.statusAgreed : styles.statusPending]}>
                      {peerConsent ? '✓ Agreed' : '○ Waiting'}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                {!isClear ? (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.agreeBtn, myConsent && styles.agreeBtnActive, actionLoading && styles.btnDisabled]}
                      onPress={() => handleConsent(true)}
                      disabled={actionLoading || myConsent}
                    >
                      <Text style={styles.agreeBtnText}>
                        {myConsent ? '✓ Reveal Consent Sent' : '🔓 Agree to Next Blur Reveal'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.keepLockedBtn, actionLoading && styles.btnDisabled]}
                      onPress={() => handleConsent(false)}
                      disabled={actionLoading || !myConsent}
                    >
                      <Text style={styles.keepLockedBtnText}>🔒 Keep Current Blur</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.clearBadgeBox}>
                    <Text style={styles.clearBadgeText}>
                      🎉 Mutual Consent Completed! Profile is 100% Clear.
                    </Text>
                  </View>
                )}
              </View>

              {/* CRITICAL PRIVACY DISCLAIMER */}
              <View style={styles.disclaimerBox}>
                <Text style={styles.disclaimerIcon}>🛡️</Text>
                <Text style={styles.disclaimerText}>
                  Don't use this to infer anything about the person; it's purely an interface effect controlled by mutual consent.
                </Text>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 15, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  container: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.3
  },
  modalSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2
  },
  closeBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#1e293b'
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700'
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14
  },
  scrollContent: {
    paddingBottom: 10
  },
  pipelineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#334155'
  },
  pipelineStep: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: '#0f172a'
  },
  pipelineStepActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8',
    borderWidth: 1
  },
  pipelineStepActiveClear: {
    backgroundColor: '#059669',
    borderColor: '#34d399',
    borderWidth: 1
  },
  pipelineStepText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700'
  },
  pipelineStepTextActive: {
    color: '#ffffff'
  },
  pipelineStepTextActiveClear: {
    color: '#ffffff'
  },
  pipelineArrow: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '900'
  },
  avatarShowcase: {
    alignItems: 'center',
    marginVertical: 10
  },
  avatarGlowRing: {
    width: 170,
    height: 170,
    borderRadius: 85,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    elevation: 12
  },
  ringBlurred: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#818cf8',
    borderWidth: 2,
    shadowColor: '#818cf8'
  },
  ringClear: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: '#10b981',
    borderWidth: 2.5,
    shadowColor: '#10b981'
  },
  avatarFrame: {
    width: '100%',
    height: '100%',
    borderRadius: 80,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0f172a'
  },
  avatarImage: {
    width: '100%',
    height: '100%'
  },
  asciiOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  asciiArtText: {
    color: '#818cf8',
    fontSize: 15,
    fontFamily: 'monospace',
    fontWeight: '900',
    lineHeight: 18,
    textAlign: 'center'
  },
  mysteryPersonLabel: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6
  },
  softOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center'
  },
  stageTag: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  stageTitleBadge: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    marginTop: 14,
    marginBottom: 6
  },
  stageTitleText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800'
  },
  stageDescription: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20
  },
  consentCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginTop: 18
  },
  consentCardTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center'
  },
  consentGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 14
  },
  consentItem: {
    alignItems: 'center',
    gap: 4
  },
  consentUserLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  consentStatusVal: {
    fontSize: 13,
    fontWeight: '700'
  },
  statusAgreed: {
    color: '#34d399'
  },
  statusPending: {
    color: '#e2e8f0'
  },
  consentDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#334155'
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10
  },
  agreeBtn: {
    flex: 1.3,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  agreeBtnActive: {
    backgroundColor: '#059669'
  },
  agreeBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },
  keepLockedBtn: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  keepLockedBtnText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600'
  },
  btnDisabled: {
    opacity: 0.5
  },
  clearBadgeBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center'
  },
  clearBadgeText: {
    color: '#34d399',
    fontSize: 13,
    fontWeight: '700'
  },
  quickStepsContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#131b2e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  quickStepsLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8
  },
  quickStepsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between'
  },
  quickStepBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  quickStepBtnActive: {
    backgroundColor: '#6366f1',
    borderColor: '#818cf8'
  },
  quickStepBtnText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700'
  },
  quickStepBtnTextActive: {
    color: '#ffffff'
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#334155',
    alignItems: 'center'
  },
  resetBtnText: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700'
  },
  disclaimerBox: {
    marginTop: 18,
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center'
  },
  disclaimerIcon: {
    fontSize: 18
  },
  disclaimerText: {
    color: '#fda4af',
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
    fontWeight: '600'
  }
});
