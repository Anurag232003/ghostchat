import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert
} from 'react-native';
import {
  fetchSecondChanceList,
  fetchSecondChanceManifest,
  reopenSecondChanceConnection,
  placeInSecondChance,
  archiveSecondChanceConnection
} from '../services/api';

export default function SecondChanceModal({
  visible,
  onClose,
  currentUserId,
  onOpenChatWithPeer
}) {
  const [loading, setLoading] = useState(false);
  const [manifest, setManifest] = useState(null);
  const [connections, setConnections] = useState([]);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [celebrationId, setCelebrationId] = useState(null);

  useEffect(() => {
    if (visible) {
      loadData();
    } else {
      setCelebrationId(null);
    }
  }, [visible]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [manifestRes, listRes] = await Promise.all([
        fetchSecondChanceManifest().catch(() => ({ manifest: null })),
        fetchSecondChanceList(currentUserId || 'user_demo_me')
      ]);
      setManifest(manifestRes.manifest);
      setConnections(listRes.connections || []);
      setLoading(false);
    } catch (err) {
      console.warn('Failed to load Second Chance data:', err);
      setLoading(false);
    }
  };

  const handleReopen = async (secondChanceId, simulatePeer = false) => {
    try {
      setActionLoadingId(secondChanceId);
      const res = await reopenSecondChanceConnection(secondChanceId, currentUserId || 'user_demo_me', simulatePeer);
      
      // Update local connection state
      setConnections(prev => prev.map(c => {
        if (c.second_chance_id === secondChanceId) {
          return {
            ...c,
            my_reopen_status: true,
            is_reconnected: res.is_reconnected,
            status: res.is_reconnected ? 'reopened' : 'dormant'
          };
        }
        return c;
      }));

      if (res.is_reconnected) {
        setCelebrationId(secondChanceId);
      }
      setActionLoadingId(null);
    } catch (err) {
      console.warn('Failed to reopen connection:', err);
      setActionLoadingId(null);
    }
  };

  const handleArchive = async (secondChanceId) => {
    try {
      await archiveSecondChanceConnection(secondChanceId, currentUserId || 'user_demo_me');
      setConnections(prev => prev.filter(c => c.second_chance_id !== secondChanceId));
    } catch (err) {
      console.warn('Failed to archive connection:', err);
    }
  };

  const handleCreateDemoConnection = async () => {
    try {
      setLoading(true);
      const demoPeerId = `anon_peer_${Math.random().toString(36).substring(2, 7)}`;
      await placeInSecondChance(
        currentUserId || 'user_demo_me',
        demoPeerId,
        `⚡ Spark#${demoPeerId.slice(-4)}`,
        'instant_date'
      );
      await loadData();
    } catch (err) {
      console.warn('Failed to create demo connection:', err);
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerBadge}>🔄 ZERO PRESSURE RECONNECT</Text>
              <Text style={styles.headerTitle}>Second Chance</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Philosophy Banner */}
          <View style={styles.manifestCard}>
            <View style={styles.manifestHeader}>
              <Text style={styles.manifestRuleTitle}>If both users select: Maybe later</Text>
              <Text style={styles.manifestRuleSub}>the app places the connection into Second Chance</Text>
            </View>
            <View style={styles.manifestQuoteBox}>
              <Text style={styles.manifestQuoteText}>
                "They can reconnect later if both independently choose to reopen it."
              </Text>
            </View>
            <Text style={styles.manifestPrivacyNotice}>
              🛡️ Zero pressure. Neither person is informed of your choice until both independently choose to reconnect.
            </Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#a855f7" />
              <Text style={styles.loadingText}>Accessing Second Chance Vault...</Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollList} contentContainerStyle={styles.scrollContent}>
              {connections.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyEmoji}>🔄</Text>
                  <Text style={styles.emptyTitle}>Vault is Empty</Text>
                  <Text style={styles.emptySub}>
                    When you and your match both choose "Maybe later" at the end of a date, your connection rests here safely.
                  </Text>
                </View>
              ) : (
                connections.map((conn) => {
                  const isActing = actionLoadingId === conn.second_chance_id;
                  const isCelebrated = celebrationId === conn.second_chance_id || conn.is_reconnected;

                  return (
                    <View
                      key={conn.second_chance_id}
                      style={[
                        styles.connectionCard,
                        isCelebrated && styles.connectionCardCelebrated
                      ]}
                    >
                      {/* Top Row of Card */}
                      <View style={styles.cardHeaderRow}>
                        <View style={styles.avatarPill}>
                          <Text style={styles.avatarIcon}>👤</Text>
                          <View>
                            <Text style={styles.peerNameText}>{conn.peer_name}</Text>
                            <Text style={styles.sourceTag}>
                              Origin: {conn.source === 'instant_date' ? '⚡ 5-Min Date' : 'Blind Date'}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={styles.archiveBtn}
                          onPress={() => handleArchive(conn.second_chance_id)}
                          title="Remove from vault"
                        >
                          <Text style={styles.archiveBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Celebration / Status View */}
                      {isCelebrated ? (
                        <View style={styles.reopenedCelebrationBox}>
                          <Text style={styles.reopenedEmoji}>🎉✨❤️</Text>
                          <Text style={styles.reopenedTitle}>MUTUAL REOPEN ACHIEVED!</Text>
                          <Text style={styles.reopenedDesc}>
                            Both of you independently chose to reopen. Full connection and direct chat unlocked!
                          </Text>
                          <TouchableOpacity
                            style={styles.openChatBtn}
                            onPress={() => {
                              if (onOpenChatWithPeer) {
                                onOpenChatWithPeer({
                                  user_id: conn.peer_id,
                                  pseudonym: conn.peer_name,
                                  avatar_index: 0
                                });
                              }
                              onClose();
                            }}
                          >
                            <Text style={styles.openChatBtnText}>💬 Open Full Chat Now</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.cardActionArea}>
                          <Text style={styles.privacyNote}>
                            {conn.my_reopen_status
                              ? "⏳ You chose to reopen. Waiting for your match to independently choose to reopen as well."
                              : "🔒 Neither of you knows what the other chosen. Press below if you'd like to give this connection another shot."}
                          </Text>

                          <View style={styles.buttonActionRow}>
                            {conn.my_reopen_status ? (
                              <View style={styles.waitingContainer}>
                                <View style={styles.waitingBadge}>
                                  <Text style={styles.waitingBadgeText}>⏳ Reopen Requested</Text>
                                </View>
                              </View>
                            ) : (
                              <TouchableOpacity
                                style={styles.reopenActionBtn}
                                onPress={() => handleReopen(conn.second_chance_id, false)}
                                disabled={isActing}
                              >
                                {isActing ? (
                                  <ActivityIndicator size="small" color="#030712" />
                                ) : (
                                  <Text style={styles.reopenActionBtnText}>
                                    🔄 Reopen Connection
                                  </Text>
                                )}
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}

          {/* Footer Bar */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.closeFooterBtn}
              onPress={onClose}
            >
              <Text style={styles.closeFooterText}>Close Vault</Text>
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
    maxWidth: 580,
    height: '90%',
    maxHeight: 720,
    backgroundColor: '#0c0a1f',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#a855f755',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 60px rgba(168, 85, 247, 0.25)'
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
    borderBottomColor: '#2e1065',
    backgroundColor: '#130e2e'
  },
  headerTitleWrap: {
    flexDirection: 'column'
  },
  headerBadge: {
    color: '#c084fc',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 2
  },
  headerTitle: {
    color: '#faf5ff',
    fontSize: 18,
    fontWeight: '800'
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2e1065',
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeBtnText: {
    color: '#d8b4fe',
    fontSize: 15,
    fontWeight: 'bold'
  },
  manifestCard: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#1e143f',
    borderBottomWidth: 1,
    borderBottomColor: '#3b1d75'
  },
  manifestHeader: {
    alignItems: 'center',
    marginBottom: 6
  },
  manifestRuleTitle: {
    color: '#e9d5ff',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  manifestRuleSub: {
    color: '#c084fc',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2
  },
  manifestQuoteBox: {
    backgroundColor: '#2e106588',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginVertical: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#c084fc'
  },
  manifestQuoteText: {
    color: '#f3e8ff',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center'
  },
  manifestPrivacyNotice: {
    color: '#a855f7',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  loadingText: {
    color: '#e9d5ff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14
  },
  scrollList: {
    flex: 1,
    backgroundColor: '#090717'
  },
  scrollContent: {
    padding: 16,
    gap: 14
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12
  },
  emptyTitle: {
    color: '#f3e8ff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6
  },
  emptySub: {
    color: '#a855f7',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20
  },
  demoAddBtn: {
    backgroundColor: '#6b21a8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#c084fc'
  },
  demoAddBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  connectionCard: {
    backgroundColor: '#171133',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#3b1d75',
    padding: 16
  },
  connectionCardCelebrated: {
    borderColor: '#ec4899',
    backgroundColor: '#3b0764'
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  avatarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  avatarIcon: {
    fontSize: 24
  },
  peerNameText: {
    color: '#faf5ff',
    fontSize: 15,
    fontWeight: '800'
  },
  sourceTag: {
    color: '#a855f7',
    fontSize: 11,
    fontWeight: '600'
  },
  archiveBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2e1065',
    alignItems: 'center',
    justifyContent: 'center'
  },
  archiveBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: 'bold'
  },
  cardActionArea: {
    marginTop: 4
  },
  privacyNote: {
    color: '#c084fc',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12
  },
  buttonActionRow: {
    width: '100%'
  },
  reopenActionBtn: {
    backgroundColor: '#9333ea',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center'
  },
  reopenActionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  waitingContainer: {
    gap: 8
  },
  waitingBadge: {
    backgroundColor: '#3b1d75',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#a855f7'
  },
  waitingBadgeText: {
    color: '#e9d5ff',
    fontSize: 13,
    fontWeight: '700'
  },
  simulatePeerBtn: {
    backgroundColor: '#2e1065',
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7e22ce'
  },
  simulatePeerBtnText: {
    color: '#d8b4fe',
    fontSize: 12,
    fontWeight: '600'
  },
  reopenedCelebrationBox: {
    alignItems: 'center',
    backgroundColor: '#581c8744',
    borderWidth: 1.5,
    borderColor: '#ec4899',
    borderRadius: 14,
    padding: 16,
    marginTop: 6
  },
  reopenedEmoji: {
    fontSize: 32,
    marginBottom: 4
  },
  reopenedTitle: {
    color: '#f43f5e',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1
  },
  reopenedDesc: {
    color: '#f3e8ff',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 8,
    lineHeight: 18
  },
  openChatBtn: {
    backgroundColor: '#ec4899',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginTop: 4
  },
  openChatBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#2e1065',
    backgroundColor: '#130e2e',
    alignItems: 'center'
  },
  simulateDemoFooterBtn: {
    backgroundColor: '#2e1065',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12
  },
  simulateDemoFooterText: {
    color: '#c084fc',
    fontSize: 12,
    fontWeight: '700'
  }
});
