import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { fetchArchitectureBlueprint } from '../services/api';

export default function ArchitectureFlowModal({ visible, onClose }) {
  const [loading, setLoading] = useState(false);
  const [blueprint, setBlueprint] = useState(null);
  const [activeTab, setActiveTab] = useState('architecture'); // 'architecture' | 'flow' | 'database' | 'encryption'

  useEffect(() => {
    if (visible) {
      loadBlueprint();
    }
  }, [visible]);

  const loadBlueprint = async () => {
    try {
      setLoading(true);
      const res = await fetchArchitectureBlueprint();
      setBlueprint(res);
    } catch (e) {
      console.warn('Failed to load architecture blueprint:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerBadge}>🏗️ RECOMMENDED TECHNICAL ARCHITECTURE</Text>
              <Text style={styles.headerSubtitle}>
                College & Production Project Blueprint • E2EE Boundary & User Flow
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabsRow}>
            {[
              { id: 'architecture', label: '🏗️ Stack' },
              { id: 'flow', label: '🧪 User Flow' },
              { id: 'database', label: '🧩 Database' },
              { id: 'encryption', label: '🔐 E2EE Layer' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabItem, activeTab === tab.id && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.id)}
              >
                <Text style={[styles.tabItemText, activeTab === tab.id && styles.tabItemTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {loading && !blueprint ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={styles.loadingText}>Rendering architecture blueprints...</Text>
              </View>
            ) : (
              <>
                {/* Tab: Architecture Stack */}
                {activeTab === 'architecture' && (
                  <View style={styles.cardBox}>
                    <Text style={styles.cardTitle}>System Architecture Diagram</Text>
                    <View style={styles.codeBlock}>
                      <Text style={styles.codeText}>{blueprint?.architecture_tree}</Text>
                    </View>

                    <View style={styles.infoGrid}>
                      <View style={styles.infoCol}>
                        <Text style={styles.infoHeading}>Frontend</Text>
                        <Text style={styles.infoBody}>• React / React Native (Expo Web + Mobile)</Text>
                        <Text style={styles.infoBody}>• Noble Cryptography client-side (@noble/curves)</Text>
                        <Text style={styles.infoBody}>• Resilient auto-reconnecting WebSocket client</Text>
                      </View>
                      <View style={styles.infoCol}>
                        <Text style={styles.infoHeading}>Backend & Queuing</Text>
                        <Text style={styles.infoBody}>• FastAPI / Node.js blind relay server</Text>
                        <Text style={styles.infoBody}>• Redis for real-time presence & match queues</Text>
                        <Text style={styles.infoBody}>• PostgreSQL / MongoDB for encrypted persistence</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Tab: Complete User Flow */}
                {activeTab === 'flow' && (
                  <View style={styles.cardBox}>
                    <Text style={styles.cardTitle}>🧪 Blind Date Complete User Flow</Text>
                    <View style={styles.codeBlock}>
                      <Text style={styles.codeText}>{blueprint?.complete_user_flow?.diagram}</Text>
                    </View>

                    <View style={styles.modesContainer}>
                      <Text style={styles.modesTitle}>Available Date Modes:</Text>
                      <View style={styles.tagsRow}>
                        {blueprint?.complete_user_flow?.available_modes?.map((m, idx) => (
                          <View key={idx} style={styles.modePill}>
                            <Text style={styles.modePillText}>{m}</Text>
                          </View>
                        ))}
                      </View>
                    </View>

                    <View style={styles.decisionsContainer}>
                      <Text style={styles.modesTitle}>Date Conclusion Decisions:</Text>
                      <View style={styles.tagsRow}>
                        {blueprint?.complete_user_flow?.date_end_actions?.map((a, idx) => (
                          <View key={idx} style={styles.decisionPill}>
                            <Text style={styles.decisionPillText}>{a}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                {/* Tab: Database Structure */}
                {activeTab === 'database' && (
                  <View style={styles.cardBox}>
                    <Text style={styles.cardTitle}>🧩 Recommended Database Schema (6 Tables)</Text>
                    <Text style={styles.cardSubtitle}>
                      Optimized for PostgreSQL / MongoDB college or production implementation:
                    </Text>

                    {blueprint?.database_structure &&
                      Object.entries(blueprint.database_structure).map(([tbl, meta]) => (
                        <View key={tbl} style={styles.tableCard}>
                          <View style={styles.tableHeader}>
                            <Text style={styles.tableName}>📋 {tbl}</Text>
                            <Text style={styles.tableDesc}>{meta.description}</Text>
                          </View>
                          <View style={styles.fieldsContainer}>
                            {meta.fields.map((f, i) => (
                              <View key={i} style={styles.fieldBadge}>
                                <Text style={styles.fieldText}>{f}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ))}
                  </View>
                )}

                {/* Tab: Encryption Layer */}
                {activeTab === 'encryption' && (
                  <View style={styles.cardBox}>
                    <Text style={styles.cardTitle}>🔐 Encryption Layer Sequence</Text>
                    <View style={styles.codeBlock}>
                      <Text style={styles.codeText}>{blueprint?.encryption_layer?.flow}</Text>
                    </View>

                    <View style={styles.securityGuaranteesBox}>
                      <Text style={styles.guaranteeHeading}>Server Boundary Guarantee:</Text>
                      <Text style={styles.guaranteeNote}>
                        Server should primarily handle:
                      </Text>
                      {blueprint?.encryption_layer?.server_responsibilities?.map((item, idx) => (
                        <Text key={idx} style={styles.responsibilityItem}>
                          ✓ {item}
                        </Text>
                      ))}
                      <View style={styles.forbiddenBox}>
                        <Text style={styles.forbiddenText}>
                          🚫 STRICTLY FORBIDDEN: {blueprint?.encryption_layer?.server_forbidden}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    backgroundColor: '#0c1222',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#38bdf8',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 25px 60px rgba(56, 189, 248, 0.35)',
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    backgroundColor: '#0f172a',
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerBadge: {
    color: '#38bdf8',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#090e1a',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  tabItemText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  tabItemTextActive: {
    color: '#38bdf8',
    fontWeight: '800',
  },
  scrollContent: {
    padding: 20,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 14,
  },
  cardBox: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 18,
  },
  cardTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 14,
  },
  codeBlock: {
    backgroundColor: '#030712',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
  },
  codeText: {
    color: '#38bdf8',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
  infoGrid: {
    gap: 12,
  },
  infoCol: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
  },
  infoHeading: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
  },
  infoBody: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 18,
  },
  modesContainer: {
    marginTop: 12,
  },
  decisionsContainer: {
    marginTop: 14,
  },
  modesTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modePill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  modePillText: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '700',
  },
  decisionPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  decisionPillText: {
    color: '#6ee7b7',
    fontSize: 11,
    fontWeight: '700',
  },
  tableCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tableHeader: {
    marginBottom: 8,
  },
  tableName: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
  },
  tableDesc: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  fieldsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  fieldBadge: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  fieldText: {
    color: '#e2e8f0',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  securityGuaranteesBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
  },
  guaranteeHeading: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  guaranteeNote: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 8,
  },
  responsibilityItem: {
    color: '#a7f3d0',
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '600',
  },
  forbiddenBox: {
    marginTop: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  forbiddenText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '700',
  },
});
