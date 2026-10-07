import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import {
  fetchPersonalityCardOptions,
  fetchUserPersonalityCard,
  fetchPeerMysteryProfile,
  updateUserPersonalityCard
} from '../services/api';

export function AnonymousPersonalityCardModal({
  visible,
  onClose,
  currentUserId,
  peerUserId = null,
  peerName = 'Partner',
  onSendCardToChat = null
}) {
  const [activeTab, setActiveTab] = useState(peerUserId ? 'peer' : 'mine'); // 'peer' | 'mine' | 'edit'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Card options catalog
  const [options, setOptions] = useState(null);

  // User's own card
  const [myCard, setMyCard] = useState({
    card_title: 'MYSTERY PROFILE',
    vibes: ['☕ Coffee', '🎮 Gaming', '🌌 Night Owl', '🎵 Indie Music'],
    conversation_style_val: 8,
    conversation_style_bar: '████████░░',
    conversation_style_label: 'Deep & Reflective',
    energy_val: 7,
    energy_bar: '███████░░░',
    energy_label: 'Warm & Engaging',
    topics: ['Technology', 'Travel', 'Movies'],
    privacy_notice: 'These can be generated from user-selected preferences rather than secretly profiling them.'
  });

  // Peer's card
  const [peerCard, setPeerCard] = useState(null);

  // Edit draft state
  const [draftVibes, setDraftVibes] = useState(['☕ Coffee', '🎮 Gaming', '🌌 Night Owl', '🎵 Indie Music']);
  const [draftStyleVal, setDraftStyleVal] = useState(8);
  const [draftEnergyVal, setDraftEnergyVal] = useState(7);
  const [draftTopics, setDraftTopics] = useState(['Technology', 'Travel', 'Movies']);

  useEffect(() => {
    if (visible) {
      loadCardData();
    }
  }, [visible, peerUserId]);

  const loadCardData = async () => {
    setLoading(true);
    try {
      const opts = await fetchPersonalityCardOptions().catch(() => null);
      if (opts) setOptions(opts);

      if (currentUserId) {
        const mine = await fetchUserPersonalityCard(currentUserId).catch(() => null);
        if (mine) {
          setMyCard(mine);
          setDraftVibes(mine.vibes || ['☕ Coffee', '🎮 Gaming', '🌌 Night Owl', '🎵 Indie Music']);
          setDraftStyleVal(mine.conversation_style_val || 8);
          setDraftEnergyVal(mine.energy_val || 7);
          setDraftTopics(mine.topics || ['Technology', 'Travel', 'Movies']);
        }
      }

      if (peerUserId) {
        const peer = await fetchPeerMysteryProfile(peerUserId).catch(() => null);
        if (peer) setPeerCard(peer);
        setActiveTab('peer');
      } else {
        setActiveTab('mine');
      }
    } catch (err) {
      console.warn('Failed to load personality card data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async () => {
    if (draftVibes.length === 0) {
      Alert.alert('Selection Required', 'Please select at least 1 vibe badge.');
      return;
    }
    if (draftTopics.length === 0) {
      Alert.alert('Selection Required', 'Please choose at least 1 topic of interest.');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateUserPersonalityCard(currentUserId, {
        vibes: draftVibes,
        conversation_style_val: draftStyleVal,
        energy_val: draftEnergyVal,
        topics: draftTopics
      });
      setMyCard(updated);
      setActiveTab('mine');
      Alert.alert('Preferences Saved ✨', 'Your Mystery Profile has been updated from your choices. Zero secret profiling was used.');
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const toggleDraftVibe = (vibeLabel) => {
    if (draftVibes.includes(vibeLabel)) {
      setDraftVibes(draftVibes.filter((v) => v !== vibeLabel));
    } else {
      if (draftVibes.length >= 6) {
        Alert.alert('Limit Reached', 'You can pick up to 6 vibe badges.');
        return;
      }
      setDraftVibes([...draftVibes, vibeLabel]);
    }
  };

  const toggleDraftTopic = (topic) => {
    if (draftTopics.includes(topic)) {
      setDraftTopics(draftTopics.filter((t) => t !== topic));
    } else {
      if (draftTopics.length >= 6) {
        Alert.alert('Limit Reached', 'You can pick up to 6 topics.');
        return;
      }
      setDraftTopics([...draftTopics, topic]);
    }
  };

  const handleShareToChat = (cardToShare) => {
    if (!onSendCardToChat) return;
    const vibesText = (cardToShare.vibes || []).join(' • ');
    const topicsText = (cardToShare.topics || []).join(', ');
    const text = `🧬 MYSTERY PROFILE\n${vibesText}\nConversation Style:\n${cardToShare.conversation_style_bar}\nEnergy:\n${cardToShare.energy_bar}\nTopics:\n${topicsText}`;
    onSendCardToChat(text);
    onClose();
  };

  const renderCardDisplay = (card, isPeer = false) => {
    return (
      <View style={styles.cardContainer}>
        {/* Card Header Tag */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardTitleBadge}>
            <Text style={styles.cardTitleBadgeText}>🧬 {card.card_title || 'MYSTERY PROFILE'}</Text>
          </View>
          <Text style={styles.cardOwnerLabel}>
            {isPeer ? `👤 ${peerName}` : '👤 You (Anonymous)'}
          </Text>
        </View>

        {/* User-selected Vibe Badges */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeaderLabel}>VIBES & HABITS</Text>
          <View style={styles.vibesGrid}>
            {(card.vibes || []).map((v, i) => (
              <View key={i} style={styles.vibeCardPill}>
                <Text style={styles.vibeCardText}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Conversation Style Meter */}
        <View style={styles.sectionBlock}>
          <View style={styles.meterHeaderRow}>
            <Text style={styles.sectionHeaderLabel}>Conversation Style:</Text>
            {card.conversation_style_label && (
              <Text style={styles.meterSubLabel}>{card.conversation_style_label}</Text>
            )}
          </View>
          <View style={styles.blockBarBox}>
            <Text style={styles.blockBarMonospace}>{card.conversation_style_bar || '████████░░'}</Text>
          </View>
        </View>

        {/* Energy Meter */}
        <View style={styles.sectionBlock}>
          <View style={styles.meterHeaderRow}>
            <Text style={styles.sectionHeaderLabel}>Energy:</Text>
            {card.energy_label && (
              <Text style={styles.meterSubLabel}>{card.energy_label}</Text>
            )}
          </View>
          <View style={styles.blockBarBox}>
            <Text style={styles.blockBarMonospace}>{card.energy_bar || '███████░░░'}</Text>
          </View>
        </View>

        {/* Topics List */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionHeaderLabel}>Topics:</Text>
          <View style={styles.topicsColumn}>
            {(card.topics || []).map((t, idx) => (
              <View key={idx} style={styles.topicItemRow}>
                <Text style={styles.topicBullet}>◆</Text>
                <Text style={styles.topicItemText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Transparent Privacy Guarantee Notice */}
        <View style={styles.privacyNoticeBanner}>
          <Text style={styles.privacyNoticeIcon}>🛡️</Text>
          <Text style={styles.privacyNoticeText}>
            These are generated from user-selected preferences rather than secretly profiling them. Zero surveillance algorithms.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.cardActionsRow}>
          {!isPeer && (
            <TouchableOpacity
              style={styles.editPrefsBtn}
              onPress={() => setActiveTab('edit')}
            >
              <Text style={styles.editPrefsBtnText}>✏️ Edit Preferences</Text>
            </TouchableOpacity>
          )}

          {onSendCardToChat && (
            <TouchableOpacity
              style={styles.shareChatBtn}
              onPress={() => handleShareToChat(card)}
            >
              <Text style={styles.shareChatBtnText}>💬 Share to Chat</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderEditPreferences = () => {
    const presetVibes = options?.preset_vibes || [
      { label: '☕ Coffee' },
      { label: '🎮 Gaming' },
      { label: '🌌 Night Owl' },
      { label: '🎵 Indie Music' },
      { label: '🍵 Matcha' },
      { label: '📚 Bookworm' },
      { label: '🧗 Bouldering' },
      { label: '🌱 Plant Parent' },
      { label: '🍣 Foodie' },
      { label: '🏕️ Camping' },
      { label: '🎨 Creative Arts' },
      { label: '🧘 Mindfulness' }
    ];

    const presetTopics = options?.preset_topics || [
      'Technology',
      'Travel',
      'Movies',
      'Music',
      'Gaming',
      'Philosophy',
      'Science',
      'Startups',
      'Art & Design',
      'Psychology'
    ];

    const styleLevels = [
      { val: 2, label: 'Quiet Observer', bar: '██░░░░░░░░' },
      { val: 4, label: 'Gentle & Balanced', bar: '████░░░░░░' },
      { val: 6, label: 'Curious Explorer', bar: '██████░░░░' },
      { val: 8, label: 'Deep & Reflective', bar: '████████░░' },
      { val: 10, label: 'Expressive Flow', bar: '██████████' }
    ];

    const energyLevels = [
      { val: 2, label: 'Tranquil & Soft', bar: '██░░░░░░░░' },
      { val: 4, label: 'Chill & Mellow', bar: '████░░░░░░' },
      { val: 7, label: 'Warm & Engaging', bar: '███████░░░' },
      { val: 9, label: 'Dynamic & Electric', bar: '█████████░' },
      { val: 10, label: 'High Voltage', bar: '██████████' }
    ];

    return (
      <ScrollView style={styles.editScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.editSection}>
          <Text style={styles.editSectionTitle}>1. Choose Your Vibe Badges (Pick 1–6)</Text>
          <Text style={styles.editSectionSubtitle}>These define your aesthetic without revealing identity.</Text>
          <View style={styles.pillChoiceGrid}>
            {presetVibes.map((item, idx) => {
              const lbl = item.label || item;
              const isSelected = draftVibes.includes(lbl);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.vibeChoicePill, isSelected && styles.vibeChoicePillActive]}
                  onPress={() => toggleDraftVibe(lbl)}
                >
                  <Text style={[styles.vibeChoiceText, isSelected && styles.vibeChoiceTextActive]}>
                    {lbl} {isSelected ? '✓' : '+'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.editSection}>
          <Text style={styles.editSectionTitle}>2. Conversation Style Meter</Text>
          <Text style={styles.editSectionSubtitle}>How you enjoy communicating in an anonymous exchange.</Text>
          <View style={styles.levelsColumn}>
            {styleLevels.map((lvl) => {
              const isSelected = draftStyleVal === lvl.val;
              return (
                <TouchableOpacity
                  key={lvl.val}
                  style={[styles.levelRow, isSelected && styles.levelRowActive]}
                  onPress={() => setDraftStyleVal(lvl.val)}
                >
                  <View style={styles.levelLeft}>
                    <Text style={[styles.levelLabel, isSelected && styles.levelLabelActive]}>
                      {lvl.label}
                    </Text>
                    <Text style={styles.levelBarText}>{lvl.bar}</Text>
                  </View>
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.editSection}>
          <Text style={styles.editSectionTitle}>3. Energy Meter</Text>
          <Text style={styles.editSectionSubtitle}>Your conversational tempo and rhythm.</Text>
          <View style={styles.levelsColumn}>
            {energyLevels.map((lvl) => {
              const isSelected = draftEnergyVal === lvl.val;
              return (
                <TouchableOpacity
                  key={lvl.val}
                  style={[styles.levelRow, isSelected && styles.levelRowActive]}
                  onPress={() => setDraftEnergyVal(lvl.val)}
                >
                  <View style={styles.levelLeft}>
                    <Text style={[styles.levelLabel, isSelected && styles.levelLabelActive]}>
                      {lvl.label}
                    </Text>
                    <Text style={styles.levelBarText}>{lvl.bar}</Text>
                  </View>
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.editSection}>
          <Text style={styles.editSectionTitle}>4. Favorite Topics (Pick 1–6)</Text>
          <Text style={styles.editSectionSubtitle}>Topics you love discussing without small-talk.</Text>
          <View style={styles.pillChoiceGrid}>
            {presetTopics.map((topic, idx) => {
              const isSelected = draftTopics.includes(topic);
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.topicChoicePill, isSelected && styles.topicChoicePillActive]}
                  onPress={() => toggleDraftTopic(topic)}
                >
                  <Text style={[styles.topicChoiceText, isSelected && styles.topicChoiceTextActive]}>
                    {topic} {isSelected ? '✓' : '+'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.saveActionsRow}>
          <TouchableOpacity
            style={styles.cancelEditBtn}
            onPress={() => setActiveTab('mine')}
          >
            <Text style={styles.cancelEditBtnText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.savePrefsBtn}
            onPress={handleSavePreferences}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#0F172A" />
            ) : (
              <Text style={styles.savePrefsBtnText}>💾 Save Mystery Profile</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerIcon}>🧬</Text>
              <View>
                <Text style={styles.headerTitle}>Anonymous Personality Card</Text>
                <Text style={styles.headerSubtitle}>User-selected preferences • Zero secret profiling</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Navigation Tabs */}
          <View style={styles.tabBar}>
            {peerUserId && (
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'peer' && styles.tabBtnActive]}
                onPress={() => setActiveTab('peer')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'peer' && styles.tabBtnTextActive]}>
                  👤 {peerName}'s Card
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'mine' && styles.tabBtnActive]}
              onPress={() => setActiveTab('mine')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'mine' && styles.tabBtnTextActive]}>
                ✨ My Mystery Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'edit' && styles.tabBtnActive]}
              onPress={() => setActiveTab('edit')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'edit' && styles.tabBtnTextActive]}>
                ⚙️ Edit Preferences
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content Body */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text style={styles.loadingText}>Loading Anonymous Personality...</Text>
            </View>
          ) : (
            <View style={styles.bodyContainer}>
              {activeTab === 'peer' && renderCardDisplay(peerCard || myCard, true)}
              {activeTab === 'mine' && renderCardDisplay(myCard, false)}
              {activeTab === 'edit' && renderEditPreferences()}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalBox: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: '#0A0F1D',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.35,
    shadowRadius: 25,
    elevation: 10
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  headerIcon: {
    fontSize: 24,
    marginRight: 10
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800'
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 1
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
    fontSize: 14,
    fontWeight: '700'
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0D1527',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabBtnActive: {
    borderBottomColor: '#8B5CF6',
    backgroundColor: 'rgba(139, 92, 246, 0.12)'
  },
  tabBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700'
  },
  tabBtnTextActive: {
    color: '#C4B5FD',
    fontWeight: '800'
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 12
  },
  bodyContainer: {
    padding: 16
  },
  /* Card Design */
  cardContainer: {
    backgroundColor: '#0F182E',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#6366F1',
    padding: 18,
    shadowColor: '#6366F1',
    shadowOpacity: 0.25,
    shadowRadius: 15
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99, 102, 241, 0.25)',
    paddingBottom: 10
  },
  cardTitleBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#818CF8'
  },
  cardTitleBadgeText: {
    color: '#E0E7FF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1
  },
  cardOwnerLabel: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700'
  },
  sectionBlock: {
    marginBottom: 14
  },
  sectionHeaderLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  vibesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  vibeCardPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  vibeCardText: {
    color: '#E0F2FE',
    fontSize: 13,
    fontWeight: '700'
  },
  meterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  meterSubLabel: {
    color: '#A78BFA',
    fontSize: 11,
    fontWeight: '700'
  },
  blockBarBox: {
    backgroundColor: '#070C18',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  blockBarMonospace: {
    color: '#34D399',
    fontSize: 18,
    fontFamily: 'monospace',
    letterSpacing: 2,
    fontWeight: '900'
  },
  topicsColumn: {
    gap: 4
  },
  topicItemRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  topicBullet: {
    color: '#F59E0B',
    fontSize: 10,
    marginRight: 8
  },
  topicItemText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600'
  },
  privacyNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    marginBottom: 14
  },
  privacyNoticeIcon: {
    fontSize: 16,
    marginRight: 8
  },
  privacyNoticeText: {
    color: '#A7F3D0',
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
    fontWeight: '600'
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end'
  },
  editPrefsBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#8B5CF6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  editPrefsBtnText: {
    color: '#C4B5FD',
    fontSize: 12,
    fontWeight: '800'
  },
  shareChatBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  shareChatBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },
  /* Edit Section Styles */
  editScroll: {
    maxHeight: 460
  },
  editSection: {
    marginBottom: 18
  },
  editSectionTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2
  },
  editSectionSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 8
  },
  pillChoiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  vibeChoicePill: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10
  },
  vibeChoicePillActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.25)',
    borderColor: '#38BDF8'
  },
  vibeChoiceText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700'
  },
  vibeChoiceTextActive: {
    color: '#E0F2FE',
    fontWeight: '800'
  },
  levelsColumn: {
    gap: 6
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  levelRowActive: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)'
  },
  levelLeft: {
    flex: 1
  },
  levelLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2
  },
  levelLabelActive: {
    color: '#A7F3D0',
    fontWeight: '800'
  },
  levelBarText: {
    color: '#34D399',
    fontFamily: 'monospace',
    fontSize: 14,
    letterSpacing: 1
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioCircleActive: {
    borderColor: '#10B981'
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981'
  },
  topicChoicePill: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10
  },
  topicChoicePillActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: '#F59E0B'
  },
  topicChoiceText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700'
  },
  topicChoiceTextActive: {
    color: '#FEF3C7',
    fontWeight: '800'
  },
  saveActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 10,
    marginBottom: 20
  },
  cancelEditBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1E293B'
  },
  cancelEditBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700'
  },
  savePrefsBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#10B981'
  },
  savePrefsBtnText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900'
  }
});
