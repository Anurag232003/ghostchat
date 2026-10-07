import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  fetchDateMemoriesList,
  updateDateMemoryNotes,
  deleteDateMemory,
  resetDateMemoryDemo,
  createDateMemory,
} from '../services/api';

export default function DateMemoryModal({ visible, onClose, userId }) {
  const [loading, setLoading] = useState(false);
  const [memories, setMemories] = useState([]);
  const [selectedMemory, setSelectedMemory] = useState(null);
  const [editingNotes, setEditingNotes] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  useEffect(() => {
    if (visible && userId) {
      loadMemories();
    }
  }, [visible, userId]);

  const loadMemories = async () => {
    try {
      setLoading(true);
      const res = await fetchDateMemoriesList(userId);
      setMemories(res.memories || []);
      if (res.memories && res.memories.length > 0) {
        setSelectedMemory(res.memories[0]);
        setEditingNotes(res.memories[0].encrypted_notes || '');
      } else {
        setSelectedMemory(null);
      }
    } catch (e) {
      console.warn('Failed to load date memories:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMemory = (mem) => {
    setSelectedMemory(mem);
    setEditingNotes(mem.encrypted_notes || '');
    setFeedbackMessage('');
  };

  const handleSaveNotes = async () => {
    if (!selectedMemory?.memory_id) return;
    try {
      setLoading(true);
      await updateDateMemoryNotes(userId, selectedMemory.memory_id, editingNotes);
      setFeedbackMessage('🔒 Private reflection encrypted and saved.');
      await loadMemories();
    } catch (e) {
      setFeedbackMessage(`Error saving notes: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMemory = async () => {
    if (!selectedMemory?.memory_id) return;
    try {
      setLoading(true);
      await deleteDateMemory(userId, selectedMemory.memory_id);
      setFeedbackMessage('Memory deleted.');
      await loadMemories();
    } catch (e) {
      setFeedbackMessage(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDemo = async () => {
    try {
      setLoading(true);
      await resetDateMemoryDemo(userId);
      setFeedbackMessage('✨ Reset to canonical 🌙 Nova memory.');
      await loadMemories();
    } catch (e) {
      setFeedbackMessage(`Error: ${e.message}`);
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
              <Text style={styles.headerBadge}>💎 DATE MEMORY</Text>
              <Text style={styles.headerSubtitle}>
                After a successful date: private encrypted 'date memory'
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {loading && memories.length === 0 ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={styles.loadingText}>Unsealing your date memories vault...</Text>
              </View>
            ) : (
              <>
                {/* Feedback message banner */}
                {feedbackMessage ? (
                  <View style={styles.feedbackBanner}>
                    <Text style={styles.feedbackText}>{feedbackMessage}</Text>
                  </View>
                ) : null}

                {/* Canonical Card Showcase */}
                {selectedMemory ? (
                  <View style={styles.canonicalCard}>
                    {/* Card Ribbon */}
                    <View style={styles.cardRibbon}>
                      <Text style={styles.cardRibbonText}>YOUR BLIND DATE</Text>
                    </View>

                    {/* Partner Header: e.g. 🌙 Nova */}
                    <View style={styles.partnerHeaderRow}>
                      <Text style={styles.partnerPseudonym}>{selectedMemory.peer_pseudonym}</Text>
                    </View>

                    {/* Section: Topics */}
                    <View style={styles.metricSection}>
                      <Text style={styles.metricSectionLabel}>Topics:</Text>
                      <View style={styles.topicsStack}>
                        {selectedMemory.topics?.map((topic, idx) => (
                          <Text key={idx} style={styles.topicItemText}>
                            {topic}
                          </Text>
                        ))}
                      </View>
                    </View>

                    {/* Section: Games */}
                    <View style={styles.metricSection}>
                      <Text style={styles.metricSectionLabel}>Games:</Text>
                      <Text style={styles.metricValueLarge}>{selectedMemory.games_count}</Text>
                    </View>

                    {/* Section: Date duration */}
                    <View style={styles.metricSection}>
                      <Text style={styles.metricSectionLabel}>Date duration:</Text>
                      <Text style={styles.metricValueLarge}>{selectedMemory.date_duration_str}</Text>
                    </View>

                    {/* Section: Mutual reveal */}
                    <View style={styles.metricSection}>
                      <Text style={styles.metricSectionLabel}>Mutual reveal:</Text>
                      <Text style={styles.revealCheckmark}>{selectedMemory.mutual_reveal_icon}</Text>
                    </View>

                    {/* Zero-Knowledge Disclaimer */}
                    <View style={styles.guaranteeTag}>
                      <Text style={styles.guaranteeText}>
                        🔒 {selectedMemory.tagline}
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyCardText}>No date memories saved yet.</Text>
                  </View>
                )}

                {/* Vault Gallery of Memories */}
                {memories.length > 1 && (
                  <View style={styles.vaultSection}>
                    <Text style={styles.vaultTitle}>💎 Memories Vault ({memories.length})</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vaultScroll}>
                      {memories.map((mem) => {
                        const isSelected = selectedMemory?.memory_id === mem.memory_id;
                        return (
                          <TouchableOpacity
                            key={mem.memory_id}
                            style={[styles.vaultItem, isSelected && styles.vaultItemActive]}
                            onPress={() => handleSelectMemory(mem)}
                          >
                            <Text style={styles.vaultItemName}>{mem.peer_pseudonym}</Text>
                            <Text style={styles.vaultItemDuration}>{mem.date_duration_str}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Private Encrypted Reflection / Diary Note */}
                {selectedMemory && (
                  <View style={styles.reflectionBox}>
                    <Text style={styles.reflectionTitle}>📝 Private Encrypted Reflection</Text>
                    <Text style={styles.reflectionDesc}>
                      Only you can view or edit this. Zero server leakage.
                    </Text>
                    <TextInput
                      style={styles.reflectionInput}
                      value={editingNotes}
                      onChangeText={setEditingNotes}
                      placeholder="Write your private memories, favorite moments, or thoughts..."
                      placeholderTextColor="#64748b"
                      multiline
                      numberOfLines={3}
                    />
                    <View style={styles.reflectionBtnRow}>
                      <TouchableOpacity
                        style={styles.saveNotesBtn}
                        onPress={handleSaveNotes}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.saveNotesBtnText}>🔒 Save Reflection</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteBtn}
                        onPress={handleDeleteMemory}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.deleteBtnText}>🗑️ Purge</Text>
                      </TouchableOpacity>
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
    maxWidth: 540,
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
  feedbackBanner: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38bdf8',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  feedbackText: {
    color: '#7dd3fc',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
  },
  canonicalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    padding: 24,
    marginBottom: 16,
  },
  cardRibbon: {
    marginBottom: 8,
  },
  cardRibbonText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  partnerHeaderRow: {
    marginBottom: 20,
  },
  partnerPseudonym: {
    color: '#f8fafc',
    fontSize: 26,
    fontWeight: '900',
  },
  metricSection: {
    marginBottom: 16,
  },
  metricSectionLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  topicsStack: {
    paddingLeft: 4,
  },
  topicItemText: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  metricValueLarge: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '800',
    paddingLeft: 4,
  },
  revealCheckmark: {
    color: '#34d399',
    fontSize: 22,
    fontWeight: '900',
    paddingLeft: 4,
  },
  guaranteeTag: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  guaranteeText: {
    color: '#7dd3fc',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '600',
    fontStyle: 'italic',
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
  },
  emptyCardText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  vaultSection: {
    marginBottom: 16,
  },
  vaultTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vaultScroll: {
    flexDirection: 'row',
  },
  vaultItem: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  vaultItemActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
  },
  vaultItemName: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 13,
  },
  vaultItemDuration: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  reflectionBox: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
  },
  reflectionTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  reflectionDesc: {
    color: '#64748b',
    fontSize: 11,
    marginBottom: 10,
  },
  reflectionInput: {
    backgroundColor: '#030712',
    borderRadius: 10,
    padding: 12,
    color: '#f8fafc',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 70,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  reflectionBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  saveNotesBtn: {
    flex: 2,
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveNotesBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  deleteBtnText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '600',
  },
  demoResetBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  demoResetBtnText: {
    color: '#64748b',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
