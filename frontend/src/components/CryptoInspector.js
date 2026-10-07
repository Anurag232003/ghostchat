import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';

export function CryptoInspector({ visible, onClose, packetLog }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.shieldIcon}>🔐</Text>
              <Text style={styles.title}>Live Cryptographic Wire Inspector</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.diagramBox}>
            <Text style={styles.diagramTitle}>ZERO-KNOWLEDGE WIRE ARCHITECTURE</Text>
            <View style={styles.diagramRow}>
              <View style={styles.diagNode}>
                <Text style={styles.diagNodeTitle}>Sender (User A)</Text>
                <Text style={styles.diagNodeSub}>Plaintext: "Hey, how are you?"</Text>
                <Text style={styles.diagBadge}>Noble X25519 + ChaCha20</Text>
              </View>
              <Text style={styles.diagArrow}>➔</Text>
              <View style={[styles.diagNode, styles.serverNode]}>
                <Text style={styles.diagNodeTitle}>Blind Server</Text>
                <Text style={styles.diagNodeSub}>Ciphertext only ("8fA92...xK29")</Text>
                <Text style={[styles.diagBadge, styles.serverBadge]}>Zero Plaintext Access</Text>
              </View>
              <Text style={styles.diagArrow}>➔</Text>
              <View style={styles.diagNode}>
                <Text style={styles.diagNodeTitle}>Receiver (User B)</Text>
                <Text style={styles.diagNodeSub}>Decrypted: "Hey, how are you?"</Text>
                <Text style={styles.diagBadge}>Double Ratchet</Text>
              </View>
            </View>
          </View>

          <Text style={styles.subtitle}>Recent Encrypted Wire Packets (Live)</Text>
          <ScrollView style={styles.logList}>
            {(!packetLog || packetLog.length === 0) ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No wire packets intercepted yet. Send or receive a message to inspect the encrypted payload in real-time!</Text>
              </View>
            ) : (
              packetLog.map((pkt, idx) => (
                <View key={idx} style={styles.packetCard}>
                  <View style={styles.packetMeta}>
                    <Text style={styles.packetType}>{pkt.direction === 'outbound' ? '📤 OUTBOUND CIPHERTEXT' : '📥 INBOUND CIPHERTEXT'}</Text>
                    <Text style={styles.packetTime}>{new Date(pkt.timestamp).toLocaleTimeString()}</Text>
                  </View>

                  <View style={styles.sectionRow}>
                    <Text style={styles.fieldLabel}>Original Plaintext:</Text>
                    <Text style={styles.plaintextVal}>"{pkt.plaintext || pkt.summary}"</Text>
                  </View>

                  <View style={styles.sectionRow}>
                    <Text style={styles.fieldLabel}>Encrypted Ciphertext on Wire:</Text>
                    <Text style={styles.hexVal}>{pkt.ciphertext}</Text>
                  </View>

                  <View style={styles.sectionRow}>
                    <Text style={styles.fieldLabel}>ChaCha20 Nonce / IV:</Text>
                    <Text style={styles.monoSmall}>{pkt.iv_or_nonce || 'N/A'}</Text>
                  </View>

                  <View style={styles.sectionRow}>
                    <Text style={styles.fieldLabel}>Ratchet Ephemeral DH Key:</Text>
                    <Text style={styles.monoSmall}>{pkt.ratchet_header?.dh_ratchet_pub || pkt.ratchet_header?.signing_pub || 'N/A'}</Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
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
    maxWidth: 780,
    maxHeight: '90%',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingBottom: 14
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  shieldIcon: {
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
  diagramBox: {
    backgroundColor: '#090D16',
    borderRadius: 12,
    padding: 14,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  diagramTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: 'center'
  },
  diagramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  diagNode: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center'
  },
  serverNode: {
    backgroundColor: '#172554',
    borderColor: '#2563EB',
    borderWidth: 1
  },
  diagNodeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F1F5F9',
    marginBottom: 4
  },
  diagNodeSub: {
    fontSize: 10,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 6
  },
  diagBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#22D3EE',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  serverBadge: {
    color: '#60A5FA',
    backgroundColor: 'rgba(37, 99, 235, 0.2)'
  },
  diagArrow: {
    color: '#64748B',
    fontSize: 18,
    paddingHorizontal: 6
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8
  },
  logList: {
    maxHeight: 360
  },
  emptyState: {
    padding: 24,
    alignItems: 'center'
  },
  emptyText: {
    color: '#64748B',
    textAlign: 'center',
    fontSize: 13
  },
  packetCard: {
    backgroundColor: '#090D16',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  packetMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  packetType: {
    fontSize: 11,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 0.5
  },
  packetTime: {
    fontSize: 11,
    color: '#64748B'
  },
  sectionRow: {
    marginBottom: 6
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 2
  },
  plaintextVal: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F8FAFC',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 4,
    borderRadius: 4
  },
  hexVal: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#38BDF8',
    backgroundColor: '#0B0F19',
    padding: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  monoSmall: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#E2E8F0',
    backgroundColor: '#0B0F19',
    padding: 4,
    borderRadius: 4
  }
});
