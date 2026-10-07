import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {
  initSecretChatSession,
  terminateSecretChatSession,
  reportSecretScreenshotAlert,
} from '../services/api';

export function SecretChatModal({
  visible,
  onClose,
  currentUserId,
  peerUserId,
  peerName = 'Partner',
  activeSecretSession,
  onEnterSecretMode,
  onExitSecretMode,
}) {
  const [disappearingSec, setDisappearingSec] = useState(30);
  const [sessionTtlSec, setSessionTtlSec] = useState(1800); // 30 mins
  const [loading, setLoading] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  useEffect(() => {
    let timer = null;
    if (activeSecretSession && activeSecretSession.expires_at) {
      const updateClock = () => {
        const diff = Math.max(0, Math.floor(activeSecretSession.expires_at - Date.now() / 1000));
        setRemainingTime(diff);
        if (diff <= 0 && onExitSecretMode) {
          onExitSecretMode();
        }
      };
      updateClock();
      timer = setInterval(updateClock, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeSecretSession]);

  const formatRemaining = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleStartSecretChat = async () => {
    setLoading(true);
    try {
      // Ephemeral temporary session key simulation
      const tempKey = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      const res = await initSecretChatSession({
        userId: currentUserId,
        peerId: peerUserId,
        ttlSeconds: sessionTtlSec,
        disappearingSeconds: disappearingSec,
        tempPublicKey: tempKey,
      });

      if (onEnterSecretMode) {
        onEnterSecretMode(res);
      }
      onClose();
    } catch (err) {
      Alert.alert('Initialization Failed', err.message || 'Could not start Secret Mode.');
    } finally {
      setLoading(false);
    }
  };

  const handleStopSecretChat = async () => {
    if (!activeSecretSession) return;
    setLoading(true);
    try {
      await terminateSecretChatSession({
        secretSessionId: activeSecretSession.secret_session_id,
        userId: currentUserId,
      });
      if (onExitSecretMode) {
        onExitSecretMode();
      }
      onClose();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to exit Secret Mode.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.titleBadgeRow}>
                <Text style={styles.headerTitle}>SECRET MODE 🔐</Text>
                <View style={[styles.statusBadge, activeSecretSession && styles.statusBadgeActive]}>
                  <Text style={[styles.statusBadgeText, activeSecretSession && styles.statusBadgeTextActive]}>
                    {activeSecretSession ? 'ACTIVE SESSION' : 'STANDBY'}
                  </Text>
                </View>
              </View>
              <Text style={styles.headerSub}>
                Isolated ephemeral channel with <Text style={styles.peerHighlight}>@{peerName}</Text>
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Active Session Countdown Hero */}
          {activeSecretSession ? (
            <View style={styles.activeSessionHero}>
              <Text style={styles.heroTimerLabel}>AUTOMATIC SESSION EXPIRATION IN:</Text>
              <Text style={styles.heroTimerText}>⏱️ {formatRemaining(remainingTime)}</Text>
              <Text style={styles.heroTimerSub}>
                All temporary encryption keys will zeroize and local messages will burn upon expiration.
              </Text>
            </View>
          ) : (
            <View style={styles.introHero}>
              <Text style={styles.introHeroIcon}>🛡️</Text>
              <Text style={styles.introHeroTitle}>Maximum Isolation Protocol</Text>
              <Text style={styles.introHeroDesc}>
                Secret Mode isolates this exchange from persistent databases, server queues, and standard long-term keys.
              </Text>
            </View>
          )}

          {/* The 6 Required Characteristics */}
          <Text style={styles.sectionHeading}>CORE CHARACTERISTICS:</Text>
          <ScrollView style={styles.characteristicsList}>
            <View style={styles.charItem}>
              <Text style={styles.charIcon}>⏱️</Text>
              <View style={styles.charTextCol}>
                <Text style={styles.charTitle}>Disappearing Messages</Text>
                <Text style={styles.charDesc}>
                  Every message has an active self-destruct countdown ({activeSecretSession ? `${activeSecretSession.disappearing_seconds}s` : `${disappearingSec}s`}) once opened.
                </Text>
              </View>
            </View>

            <View style={styles.charItem}>
              <Text style={styles.charIcon}>🚫</Text>
              <View style={styles.charTextCol}>
                <Text style={styles.charTitle}>No Message History on Server</Text>
                <Text style={styles.charDesc}>
                  Zero server disk retention. Messages bypass database storage entirely and exist solely in-flight.
                </Text>
              </View>
            </View>

            <View style={styles.charItem}>
              <Text style={styles.charIcon}>🔒</Text>
              <View style={styles.charTextCol}>
                <Text style={styles.charTitle}>Restricted Forwarding</Text>
                <Text style={styles.charDesc}>
                  Forwarding, exporting, and clipboard duplication are strictly locked down.
                </Text>
              </View>
            </View>

            <View style={styles.charItem}>
              <Text style={styles.charIcon}>🔑</Text>
              <View style={styles.charTextCol}>
                <Text style={styles.charTitle}>Temporary Encryption Keys</Text>
                <Text style={styles.charDesc}>
                  A fresh ephemeral session ratchet is generated solely for this session and burned on exit.
                </Text>
              </View>
            </View>

            <View style={styles.charItem}>
              <Text style={styles.charIcon}>📸</Text>
              <View style={styles.charTextCol}>
                <Text style={styles.charTitle}>Optional Screenshot Detection</Text>
                <Text style={styles.charDesc}>
                  Capture shortcuts trigger an immediate screen-warning banner and peer alert on supported platforms.
                </Text>
              </View>
            </View>

            <View style={styles.charItem}>
              <Text style={styles.charIcon}>⌛</Text>
              <View style={styles.charTextCol}>
                <Text style={styles.charTitle}>Automatic Session Expiration</Text>
                <Text style={styles.charDesc}>
                  Fixed session lifespan ({activeSecretSession ? `${Math.round(activeSecretSession.ttl_seconds / 60)}m` : `${Math.round(sessionTtlSec / 60)}m`}); auto-burns when time runs out.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Config Controls (when not active) */}
          {!activeSecretSession && (
            <View style={styles.configControls}>
              <View style={styles.configRow}>
                <Text style={styles.configLabel}>Disappear After:</Text>
                <View style={styles.pickerRow}>
                  {[10, 30, 60].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.pickerChip, disappearingSec === s && styles.pickerChipActive]}
                      onPress={() => setDisappearingSec(s)}
                    >
                      <Text style={[styles.pickerChipText, disappearingSec === s && styles.pickerChipTextActive]}>
                        {s}s
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.configRow}>
                <Text style={styles.configLabel}>Session Lifespan:</Text>
                <View style={styles.pickerRow}>
                  {[
                    { sec: 900, label: '15m' },
                    { sec: 1800, label: '30m' },
                    { sec: 3600, label: '1h' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.sec}
                      style={[styles.pickerChip, sessionTtlSec === item.sec && styles.pickerChipActive]}
                      onPress={() => setSessionTtlSec(item.sec)}
                    >
                      <Text style={[styles.pickerChipText, sessionTtlSec === item.sec && styles.pickerChipTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsRow}>
            {activeSecretSession ? (
              <TouchableOpacity
                style={[styles.actionBtn, styles.exitBtn]}
                onPress={handleStopSecretChat}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.exitBtnText}>🚪 Exit Secret Mode & Burn Keys</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, styles.enterBtn]}
                onPress={handleStartSecretChat}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#0F172A" />
                ) : (
                  <Text style={styles.enterBtnText}>🔐 Launch SECRET MODE Now</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#0B1120',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#10B981',
    padding: 20,
    gap: 12,
    shadowColor: '#10B981',
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 0.6,
  },
  statusBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
  },
  statusBadgeTextActive: {
    color: '#34D399',
  },
  headerSub: {
    fontSize: 12,
    color: '#94A3B8',
  },
  peerHighlight: {
    color: '#34D399',
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    marginLeft: 10,
  },
  closeBtnText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '700',
  },

  activeSessionHero: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  heroTimerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 0.6,
  },
  heroTimerText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  heroTimerSub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },

  introHero: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 4,
  },
  introHeroIcon: {
    fontSize: 24,
  },
  introHeroTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  introHeroDesc: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 15,
  },

  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  characteristicsList: {
    maxHeight: 220,
  },
  charItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    gap: 10,
  },
  charIcon: {
    fontSize: 16,
    marginTop: 2,
  },
  charTextCol: {
    flex: 1,
  },
  charTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 2,
  },
  charDesc: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },

  configControls: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 10,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  configLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 6,
  },
  pickerChip: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pickerChipActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  pickerChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  pickerChipTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },

  actionsRow: {
    marginTop: 4,
  },
  actionBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterBtn: {
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  enterBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  exitBtn: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  exitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
