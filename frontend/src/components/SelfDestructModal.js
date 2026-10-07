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
  fetchSelfDestructOptions,
  fetchSelfDestructPolicy,
  setSelfDestructPolicy,
  burnConversationNow,
} from '../services/api';

const DEFAULT_OPTIONS = [
  { id: '5m', seconds: 300, label: '5 minutes', badge: '⚡ 5m', desc: 'Ultra-ephemeral: messages vanish 5 minutes after transmission.' },
  { id: '1h', seconds: 3600, label: '1 hour', badge: '⏱️ 1h', desc: 'Short retention: messages automatically burn after 1 hour.' },
  { id: '24h', seconds: 86400, label: '24 hours', badge: '🌙 24h', desc: 'Daily wipe: all messages burn 24 hours after transmission.' },
  { id: '7d', seconds: 604800, label: '7 days', badge: '📅 7d', desc: 'Weekly retention: automatic cleanup after 7 days.' },
  { id: 'never', seconds: null, label: 'Never', badge: '♾️ Never', desc: 'Standard E2EE: messages persist until manually cleared.' },
];

export function SelfDestructModal({
  visible,
  onClose,
  conversationId,
  currentUserId,
  peerName = 'Partner',
  onPolicyChanged,
  onConversationBurned,
}) {
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [selectedSeconds, setSelectedSeconds] = useState(null);
  const [selectedLabel, setSelectedLabel] = useState('Never');
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [burning, setBurning] = useState(false);

  useEffect(() => {
    if (visible && conversationId) {
      loadPolicy();
    }
  }, [visible, conversationId]);

  const loadPolicy = async () => {
    setLoading(true);
    try {
      const data = await fetchSelfDestructPolicy(conversationId);
      if (data) {
        setSelectedSeconds(data.delete_after_seconds);
        setSelectedLabel(data.retention_label || 'Never');
      }
      const optData = await fetchSelfDestructOptions().catch(() => null);
      if (optData && optData.options) {
        setOptions(optData.options);
      }
    } catch (err) {
      console.warn('Failed to load self-destruct policy:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = async (opt) => {
    setUpdating(true);
    try {
      const res = await setSelfDestructPolicy({
        conversationId,
        userId: currentUserId,
        deleteAfterSeconds: opt.seconds,
        retentionLabel: opt.label,
      });
      setSelectedSeconds(opt.seconds);
      setSelectedLabel(opt.label);
      if (onPolicyChanged) {
        onPolicyChanged(opt.seconds, opt.label);
      }
      if (res.purged_messages_count > 0) {
        Alert.alert(
          '🧨 Policy Updated & Messages Purged',
          `Retention set to "${opt.label}". ${res.purged_messages_count} older messages exceeded this window and were permanently deleted.`
        );
      }
    } catch (err) {
      Alert.alert('Update Failed', err.message || 'Could not update self-destruct policy.');
    } finally {
      setUpdating(false);
    }
  };

  const handleBurnNow = () => {
    const executeBurn = async () => {
      setBurning(true);
      try {
        const res = await burnConversationNow({
          conversationId,
          userId: currentUserId,
        });
        if (onConversationBurned) {
          onConversationBurned(conversationId);
        }
        Alert.alert(
          '🔥 Conversation Self-Destructed',
          `All messages in this conversation have been permanently purged from server relays and local devices.`
        );
        onClose();
      } catch (err) {
        Alert.alert('Burn Failed', err.message || 'Failed to burn conversation.');
      } finally {
        setBurning(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`⚠️ Permanently self-destruct ALL messages in this conversation right now? This cannot be undone.`)) {
        executeBurn();
      }
    } else {
      Alert.alert(
        '🧨 Self-Destruct Entire Conversation?',
        `Are you sure you want to permanently delete all messages and session history with ${peerName}? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Burn Now 🔥', style: 'destructive', onPress: executeBurn },
        ]
      );
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
                <Text style={styles.headerTitle}>🧨 Self-Destruct Conversations</Text>
                <View style={styles.retentionBadge}>
                  <Text style={styles.retentionBadgeText}>{selectedLabel.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.headerSub}>
                Conversation with <Text style={styles.peerHighlight}>@{peerName}</Text>
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* CRITICAL TRANSPARENCY NOTICE (Exact User Requirement) */}
          <View style={styles.transparencyBox}>
            <View style={styles.transparencyHeaderRow}>
              <Text style={styles.transparencyIcon}>⚠️</Text>
              <Text style={styles.transparencyTitle}>E2EE SECURITY NOTICE</Text>
            </View>
            <Text style={styles.transparencyQuote}>
              "For E2EE, remember that 'deleted from the app' does not guarantee the recipient hasn't copied or captured the content."
            </Text>
            <Text style={styles.transparencyDetail}>
              While cryptographic ciphertexts, local storage, and blind server relays are permanently purged, no software can prevent a recipient from photographing their screen with an external device, saving text to external clipboards, or transcribing content prior to expiration.
            </Text>
          </View>

          {/* Retention Options Section */}
          <Text style={styles.sectionHeading}>DELETE AFTER:</Text>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#F43F5E" />
              <Text style={styles.loadingText}>Fetching active retention policy...</Text>
            </View>
          ) : (
            <ScrollView style={styles.optionsList}>
              {options.map((opt) => {
                const isSelected =
                  opt.seconds === selectedSeconds ||
                  (opt.seconds === null && selectedSeconds === null) ||
                  (opt.seconds === null && selectedSeconds === 0);

                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.optionCard, isSelected && styles.optionCardActive]}
                    onPress={() => handleSelectOption(opt)}
                    disabled={updating}
                  >
                    <View style={styles.optionLeft}>
                      <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                        {isSelected && <View style={styles.radioInner} />}
                      </View>
                      <View style={styles.optionTextCol}>
                        <View style={styles.optionLabelRow}>
                          <Text style={[styles.optionLabel, isSelected && styles.optionLabelActive]}>
                            {opt.label}
                          </Text>
                          <View style={[styles.optBadge, isSelected && styles.optBadgeActive]}>
                            <Text style={[styles.optBadgeText, isSelected && styles.optBadgeTextActive]}>
                              {opt.badge || opt.label}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.optionDesc}>{opt.description || opt.desc}</Text>
                      </View>
                    </View>
                    {isSelected && (
                      <View style={styles.activeCheckMark}>
                        <Text style={styles.activeCheckMarkText}>✓ Active</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Emergency Immediate Burn Button */}
          <View style={styles.emergencyBox}>
            <Text style={styles.emergencyNotice}>
              Need to clear this chat immediately?
            </Text>
            <TouchableOpacity
              style={[styles.burnNowBtn, burning && styles.burnNowBtnDisabled]}
              onPress={handleBurnNow}
              disabled={burning}
            >
              {burning ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.burnNowBtnText}>🧨 Self-Destruct Conversation Now</Text>
              )}
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
    backgroundColor: 'rgba(5, 8, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 20,
    gap: 14,
    shadowColor: '#F43F5E',
    shadowOpacity: 0.2,
    shadowRadius: 15,
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
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.3,
  },
  retentionBadge: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#F43F5E',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  retentionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FB7185',
  },
  headerSub: {
    fontSize: 12,
    color: '#94A3B8',
  },
  peerHighlight: {
    color: '#38BDF8',
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

  transparencyBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  transparencyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transparencyIcon: {
    fontSize: 14,
  },
  transparencyTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FB7185',
    letterSpacing: 0.5,
  },
  transparencyQuote: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFE4E6',
    lineHeight: 17,
    fontStyle: 'italic',
  },
  transparencyDetail: {
    fontSize: 10,
    color: '#94A3B8',
    lineHeight: 14,
  },

  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  loadingBox: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#94A3B8',
  },

  optionsList: {
    maxHeight: 260,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 8,
  },
  optionCardActive: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: '#F43F5E',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#64748B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: '#F43F5E',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F43F5E',
  },
  optionTextCol: {
    flex: 1,
  },
  optionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  optionLabelActive: {
    color: '#FFE4E6',
    fontWeight: '800',
  },
  optBadge: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  optBadgeActive: {
    backgroundColor: '#F43F5E',
  },
  optBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  optBadgeTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  optionDesc: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 15,
  },
  activeCheckMark: {
    backgroundColor: 'rgba(244, 63, 94, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeCheckMarkText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FB7185',
  },

  emergencyBox: {
    backgroundColor: '#090D16',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  emergencyNotice: {
    fontSize: 11,
    color: '#94A3B8',
  },
  burnNowBtn: {
    width: '100%',
    backgroundColor: '#E11D48',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#E11D48',
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  burnNowBtnDisabled: {
    backgroundColor: '#475569',
    opacity: 0.6,
  },
  burnNowBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.4,
  },
});
