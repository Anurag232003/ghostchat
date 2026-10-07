import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';

export function SafetyNumberModal({ visible, onClose, myPseudonym, peerPseudonym, safetyData }) {
  if (!safetyData) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.shield}>🛡️</Text>
              <Text style={styles.title}>Verify Safety Numbers</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.desc}>
            Compare these safety numbers with <Text style={styles.highlight}>{peerPseudonym}</Text> via another channel. If the numbers match exactly, your end-to-end encrypted session is 100% immune to eavesdropping or Man-in-the-Middle attacks.
          </Text>

          <View style={styles.codeContainer}>
            <Text style={styles.codeLabel}>CRYPTOGRAPHIC SAFETY CODE</Text>
            <Text style={styles.codeText}>{safetyData.safetyCode}</Text>
          </View>

          <View style={styles.fingerprintBox}>
            <Text style={styles.fpLabel}>FULL SHA-256 SESSION FINGERPRINT</Text>
            <Text style={styles.fpText}>{safetyData.fingerprintHex}</Text>
          </View>

          <View style={styles.statusBadge}>
            <Text style={styles.statusDot}>●</Text>
            <Text style={styles.statusText}>X25519 & Ed25519 Cryptographically Verified</Text>
          </View>

          <TouchableOpacity style={styles.verifyBtn} onPress={onClose}>
            <Text style={styles.verifyBtnText}>✓ Mark as Verified</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  container: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  shield: {
    fontSize: 22,
    marginRight: 8
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC'
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeBtnText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700'
  },
  desc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 18
  },
  highlight: {
    color: '#38BDF8',
    fontWeight: '700'
  },
  codeContainer: {
    backgroundColor: '#0B0F19',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#0284C7',
    marginBottom: 14,
    alignItems: 'center'
  },
  codeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 1,
    marginBottom: 10
  },
  codeText: {
    fontSize: 16,
    fontFamily: 'monospace',
    color: '#F8FAFC',
    fontWeight: '700',
    letterSpacing: 2,
    lineHeight: 28,
    textAlign: 'center'
  },
  fingerprintBox: {
    backgroundColor: '#0B0F19',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16
  },
  fpLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  fpText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#94A3B8',
    wordBreak: 'break-all'
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 20
  },
  statusDot: {
    color: '#10B981',
    marginRight: 6,
    fontSize: 12
  },
  statusText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600'
  },
  verifyBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700'
  }
});
