import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';

import {
  joinBlindDateQueue,
  leaveBlindDateQueue,
  submitActivityAnswer,
  submitRevealDecision,
  submitEndDateDecision,
  sendBlindDateChatMessage,
  requestInstantDemoMatch,
  fetchActiveMissions,
  completeMission,
  unlockNextMission,
  exitBlindDateSafely,
  submitInstantBlock,
  submitSafetyReport,
  reportScreenshotActivity,
  fetchScreenshotPolicy,
  toggleLocationSharing,
  fetchLocationStatus,
  fetchCoarseRegions
} from '../services/api';
import { wsClient } from '../services/socket';

// 6. 🛡️ Safety Layer Report Categories
export const SAFETY_REPORT_CATEGORIES = [
  'Harassment',
  'Spam',
  'Impersonation',
  'Threatening behaviour',
  'Unwanted content',
  'Other'
];

export const BLIND_DATE_MODES = [
  {
    id: 'mystery',
    modeCode: 'MODE A',
    title: 'Mystery Match',
    icon: '🌑',
    tagline: 'Compatible match with zero identity leak.',
    summary: 'Age bracket & interests only. No photo, no real name, no social media.',
    badge: 'Signature Mode',
    accentColor: '#818CF8'
  },
  {
    id: 'speed',
    modeCode: 'MODE B',
    title: 'Speed Blitz',
    icon: '⚡',
    tagline: '5-minute timed encounter.',
    summary: 'High adrenaline countdown. Spark a connection before time runs out.',
    badge: '300s Countdown',
    accentColor: '#F59E0B'
  },
  {
    id: 'vibe',
    modeCode: 'MODE C',
    title: 'Vibe Deep Dive',
    icon: '🔮',
    tagline: 'Philosophical prompts & mind sync.',
    summary: 'Matched by deep intellectual dilemmas and nocturnal worldview alignment.',
    badge: 'Intellectual',
    accentColor: '#EC4899'
  }
];

const VIBES = [
  { id: 'vibe_night', label: '🌙 Late Night Deep Talks', icon: '🌙' },
  { id: 'vibe_gaming', label: '🎮 Gaming & Cyberpunk', icon: '🎮' },
  { id: 'vibe_coffee', label: '☕ Coffee & Spontaneous Banter', icon: '☕' },
  { id: 'vibe_cosmos', label: '🌌 Philosophy & Cosmos', icon: '🌌' }
];

export const DATE_DURATIONS = [
  {
    id: 15,
    minutes: 15,
    title: '15 Minutes',
    badge: '⚡ Quick Spark',
    sub: '15:00 countdown • Fast & spontaneous'
  },
  {
    id: 20,
    minutes: 20,
    title: '20 Minutes',
    badge: '⏳ Deep Date',
    sub: '20:00 countdown • Immersive connection'
  }
];

export function BlindDateModal({
  visible,
  onClose,
  currentUser,
  onMutualRevealSuccess,
  onOpenSecondChance
}) {
  const [stage, setStage] = useState('lobby'); // 'lobby' | 'searching' | 'chamber' | 'decision' | 'outcome'
  const [selectedMode, setSelectedMode] = useState('mystery');
  const [selectedDuration, setSelectedDuration] = useState(20); // 15 or 20 minutes
  const [selectedVibe, setSelectedVibe] = useState(VIBES[0].label);
  const [chamberTab, setChamberTab] = useState('chat'); // 'chat' | 'activities' | 'mystery'
  const [room, setRoom] = useState(null);
  const [peerGhost, setPeerGhost] = useState('Phantom#0000');
  const [mysteryCard, setMysteryCard] = useState(null);
  const [countdownSeconds, setCountdownSeconds] = useState(1200);
  const [puzzleResults, setPuzzleResults] = useState(null);

  // In-Chamber Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInputText, setChatInputText] = useState('');

  // 6. 🛡️ Safety Layer State (Instant Block, Report, Screenshot Warning, Contact Protection)
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [selectedReportCategory, setSelectedReportCategory] = useState(SAFETY_REPORT_CATEGORIES[0]);
  const [customReportNote, setCustomReportNote] = useState('');
  const [screenshotBanner, setScreenshotBanner] = useState(null);
  const [safetyPolicyModalVisible, setSafetyPolicyModalVisible] = useState(false);
  const [isInstantBlocking, setIsInstantBlocking] = useState(false);

  // 17. 📍 Approximate Location State
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false);
  const [userCoarseRegion, setUserCoarseRegion] = useState('Delhi NCR');
  const [fuzzedDistanceKm, setFuzzedDistanceKm] = useState(8);
  const [locationModalVisible, setLocationModalVisible] = useState(false);

  // Activity state
  const [myAnswerInput, setMyAnswerInput] = useState('');
  const [selectedOption, setSelectedOption] = useState(null);
  const [hasSubmittedCurrent, setHasSubmittedCurrent] = useState(false);
  const [decisionSubmitted, setDecisionSubmitted] = useState(null);
  const [outcome, setOutcome] = useState(null); // 'continue' | 'friends' | 'ended' | 'blocked' | 'mutual_reveal' | 'faded'

  // 7. 👻 Progressive Identity Reveal State in Date Chamber
  const [chamberMutualInterest, setChamberMutualInterest] = useState(false);
  const [chamberPhotoConsentPrompt, setChamberPhotoConsentPrompt] = useState(false);
  const [chamberPhotoUnlocked, setChamberPhotoUnlocked] = useState(false);
  const [chamberSimulatedBonusSec, setChamberSimulatedBonusSec] = useState(0);

  // 10. 🎯 Blind Date Missions State in Chamber
  const [chamberMissions, setChamberMissions] = useState([]);
  const [chamberDateXp, setChamberDateXp] = useState(0);

  // 15. 🚪 Exit Anytime State
  const [exitMenuVisible, setExitMenuVisible] = useState(false);
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false);
  const [exitNotice, setExitNotice] = useState(null);
  const [isLeavingSafely, setIsLeavingSafely] = useState(false);

  useEffect(() => {
    if (!visible) {
      handleExit();
    }
  }, [visible]);

  // 15. 🚪 WebSocket Listener for Safe Exit & 6. 🛡️ Safety Signals
  useEffect(() => {
    const unsub = wsClient.on('signal', (sig) => {
      if (sig.signal_type === 'blind_date.ended_safely' && sig.room_id === room?.room_id) {
        if (sig.is_leaver) {
          setExitNotice('You left the date safely. All session keys burned.');
        } else {
          setExitNotice('The Blind Date has ended.');
        }
        setStage('ended');
      } else if (sig.signal_type === 'safety.screenshot_warning' && sig.room_id === room?.room_id) {
        setScreenshotBanner(sig.message || '⚠️ Screenshot activity detected from your date partner.');
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, [room?.room_id]);

  // 6. 🛡️ Screenshot Key Detection Listener on supported platforms
  useEffect(() => {
    if (typeof window !== 'undefined' && window.addEventListener) {
      const handleScreenshotKeys = (e) => {
        const isPrintScreen = e.key === 'PrintScreen';
        const isSnippet = (e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S' || e.key === '3' || e.key === '4');
        if (isPrintScreen || isSnippet) {
          triggerScreenshotDetected('web_keyboard');
        }
      };
      window.addEventListener('keyup', handleScreenshotKeys);
      return () => window.removeEventListener('keyup', handleScreenshotKeys);
    }
  }, [room?.room_id, currentUser?.user_id]);

  // 6. ⏳ Blind Date Timer (15 min or 20 min real-time countdown)
  useEffect(() => {
    let timer = null;
    if (stage === 'chamber') {
      timer = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            // Date duration expired! Transition to End-of-Date decisions
            setStage('decision');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [stage]);

  function formatTimeRemaining(seconds) {
    const s = Math.max(0, seconds || 0);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} remaining`;
  }

  function handleExit() {
    if (stage === 'searching' && currentUser) {
      leaveBlindDateQueue(currentUser.user_id).catch(() => {});
    }
    setStage('lobby');
    setRoom(null);
    setMysteryCard(null);
    setPuzzleResults(null);
    setCountdownSeconds(selectedDuration * 60);
    setHasSubmittedCurrent(false);
    setSelectedOption(null);
    setMyAnswerInput('');
    setDecisionSubmitted(null);
    setOutcome(null);
    setChatMessages([]);
    setChatInputText('');
    setReportModalVisible(false);
    setChamberMutualInterest(false);
    setChamberPhotoConsentPrompt(false);
    setChamberPhotoUnlocked(false);
    setChamberSimulatedBonusSec(0);
    setChamberMissions([]);
    setChamberDateXp(0);
    setExitMenuVisible(false);
    setExitConfirmVisible(false);
    setExitNotice(null);
    setIsLeavingSafely(false);
  }

  // 15. 🚪 Handle Confirm Leave Safely
  async function handleConfirmLeaveSafely() {
    if (!room?.room_id || !currentUser?.user_id) return;
    setIsLeavingSafely(true);
    try {
      await exitBlindDateSafely(room.room_id, currentUser.user_id);
      setExitConfirmVisible(false);
      setExitMenuVisible(false);
      setExitNotice('You left the date safely. All session keys burned.');
      setStage('ended');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setIsLeavingSafely(false);
    }
  }

  async function loadChamberMissions(roomId) {
    if (!roomId) return;
    try {
      const data = await fetchActiveMissions(roomId, currentUser?.user_id);
      setChamberMissions(data.unlocked_missions || []);
      setChamberDateXp(data.date_xp || 0);
    } catch (e) {
      console.warn('Failed to load chamber missions', e);
    }
  }

  async function handleCompleteChamberMission(m) {
    if (!room?.room_id) return;
    try {
      const res = await completeMission(room.room_id, currentUser?.user_id, m.id);
      setChamberDateXp(res.total_date_xp || 0);
      loadChamberMissions(room.room_id);
      Alert.alert(
        '✨ Mission Completed!',
        `You completed "${m.title}: ${m.prompt}"!\n\n✨ Date XP +${res.xp_awarded} awarded!\nTotal: ${res.total_date_xp} XP`
      );
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }

  async function handleUnlockChamberMission() {
    if (!room?.room_id) return;
    try {
      const res = await unlockNextMission(room.room_id, currentUser?.user_id);
      loadChamberMissions(room.room_id);
      if (res.unlocked_mission) {
        Alert.alert(
          '🎯 New Mission Unlocked!',
          `${res.unlocked_mission.title}: "${res.unlocked_mission.prompt}"`
        );
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  }


  async function handleStartMatchmaking(isDemo = false) {
    if (!currentUser) return;
    setStage('searching');

    try {
      if (isDemo) {
        const res = await requestInstantDemoMatch(currentUser.user_id, selectedVibe, selectedMode, selectedDuration);
        enterChamber(res.room, res.peer_ghost, res.mystery_card, res.puzzle_results, selectedDuration);
      } else {
        const res = await joinBlindDateQueue(currentUser.user_id, selectedVibe, selectedMode, selectedDuration);
        if (res.status === 'matched') {
          enterChamber(res.room, res.peer_ghost, res.mystery_card, res.room?.puzzle_results, selectedDuration);
        }
      }
    } catch (err) {
      Alert.alert('Matchmaking Error', err.message);
      setStage('lobby');
    }
  }

  function enterChamber(roomData, peerGhostHandle, mysteryCardData = null, puzzleData = null, durMins = 20) {
    setRoom(roomData);
    setPeerGhost(peerGhostHandle);
    const card = mysteryCardData || roomData?.mystery_card_for_user1 || {
      card_title: 'Your Mystery Match',
      handle: '🌑 Unknown',
      age_bracket: 'Age: 20–24',
      interests: ['🎮 Gaming', '🎵 Music', '☕ Coffee'],
      compatibility: 'Hidden',
      no_photo: true,
      no_real_name: true,
      no_social_media: true
    };
    setMysteryCard(card);
    setPuzzleResults(puzzleData || roomData?.puzzle_results || {
      common_choices: ['🎮 Gaming', '🌙 Late nights', '✈️ Travel'],
      unlocked_topics: ["What's your dream destination?"],
      spark_summary: "You both chose: 🎮 Gaming • 🌙 Late nights • ✈️ Travel"
    });
    const dur = roomData?.duration_minutes || durMins || selectedDuration || 20;
    const initialSecs = (selectedMode === 'speed' || roomData?.mode === 'speed') ? 300 : dur * 60;
    setCountdownSeconds(initialSecs);
    setChatMessages(roomData?.chat_messages && roomData.chat_messages.length > 0 ? roomData.chat_messages : [
      {
        message_id: 'init_msg_1',
        sender_id: 'peer',
        ghost_sender: peerGhostHandle,
        text: `Hey! 🕶️ Welcome to our ${dur}-minute blind date. So curious to see what we have in common!`,
        timestamp: Date.now() / 1000
      }
    ]);
    setStage('chamber');
    setChamberTab('chat');
    setHasSubmittedCurrent(false);
    if (roomData?.room_id) {
      loadChamberMissions(roomData.room_id);
    }
  }

  async function handleOptionSelect(option) {
    setSelectedOption(option);
    setHasSubmittedCurrent(true);

    try {
      const res = await submitActivityAnswer(
        room.room_id,
        currentUser.user_id,
        room.current_activity_idx,
        option
      );
      updateRoomProgress(res);
    } catch (e) {
      console.warn('Error submitting answer:', e);
    }
  }

  async function handlePromptSubmit() {
    if (!myAnswerInput.trim()) return;
    setHasSubmittedCurrent(true);

    try {
      const res = await submitActivityAnswer(
        room.room_id,
        currentUser.user_id,
        room.current_activity_idx,
        myAnswerInput.trim()
      );
      updateRoomProgress(res);
    } catch (e) {
      console.warn('Error submitting answer:', e);
    }
  }

  function updateRoomProgress(res) {
    if (res.puzzle_results) {
      setPuzzleResults(res.puzzle_results);
    }
    setRoom((prev) => ({
      ...prev,
      chemistry: res.chemistry,
      current_activity_idx: res.next_activity_idx,
      status: res.room_status,
      puzzle_results: res.puzzle_results || prev?.puzzle_results
    }));

    if (res.room_status === 'decision') {
      setStage('decision');
    } else if (res.both_answered) {
      setHasSubmittedCurrent(false);
      setSelectedOption(null);
      setMyAnswerInput('');
    }
  }

  async function handleSendChatMessage(customText = null) {
    const text = (customText || chatInputText).trim();
    if (!text || !room || !currentUser) return;
    setChatInputText('');
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      message_id: tempId,
      sender_id: currentUser.user_id,
      ghost_sender: 'You (Shadow)',
      text,
      timestamp: Date.now() / 1000
    };
    setChatMessages((prev) => [...prev, optimisticMsg]);

    try {
      const res = await sendBlindDateChatMessage(room.room_id, currentUser.user_id, text);
      if (res && res.message) {
        setChatMessages((prev) => {
          const filtered = prev.filter((m) => m.message_id !== tempId);
          const updated = [...filtered, res.message];
          if (res.bot_reply) {
            updated.push(res.bot_reply);
          }
          return updated;
        });
      }
    } catch (e) {
      console.warn('Error sending chat message:', e);
    }
  }

  async function handleDecision(choice, reason = null) {
    setDecisionSubmitted(choice);
    if (choice === 'block_report') {
      setReportModalVisible(false);
    }

    try {
      const res = await submitEndDateDecision(room.room_id, currentUser.user_id, choice, reason);
      if (res.puzzle_results) {
        setPuzzleResults(res.puzzle_results);
      }
      if (res.is_complete) {
        setOutcome(res.outcome);
        setStage('outcome');
      }
    } catch (e) {
      console.warn('Error submitting decision:', e);
    }
  }

  // 6. 🛡️ One-Tap Instant Block
  async function handleInstantBlockOneTap() {
    if (!currentUser || !room) return;
    setIsInstantBlocking(true);
    const partnerId = room.user1?.user_id === currentUser.user_id ? room.user2?.user_id : room.user1?.user_id;
    try {
      await submitInstantBlock(currentUser.user_id, partnerId, room.room_id, 'Instant one-tap block');
      setOutcome('blocked');
      setExitNotice('User blocked instantly with one tap. All communication severed.');
      setStage('ended');
    } catch (e) {
      console.warn('Instant block fallback:', e);
      handleDecision('block_report', 'Instant block');
    } finally {
      setIsInstantBlocking(false);
    }
  }

  // 6. 🛡️ Formal Safety Report with 6 Categories
  async function handleSafetyReportSubmit() {
    if (!currentUser || !room) return;
    const partnerId = room.user1?.user_id === currentUser.user_id ? room.user2?.user_id : room.user1?.user_id;
    try {
      await submitSafetyReport(
        currentUser.user_id,
        partnerId,
        selectedReportCategory,
        customReportNote,
        room.room_id,
        true
      );
      setReportModalVisible(false);
      setOutcome('blocked');
      setExitNotice(`Report logged under "${selectedReportCategory}". User permanently blocked.`);
      setStage('ended');
    } catch (e) {
      console.warn('Safety report error:', e);
      handleDecision('block_report', selectedReportCategory);
    }
  }

  // 6. 🛡️ Screenshot Detected Trigger
  async function triggerScreenshotDetected(platform = 'web') {
    if (!currentUser || !room) return;
    const partnerId = room.user1?.user_id === currentUser.user_id ? room.user2?.user_id : room.user1?.user_id;
    setScreenshotBanner('⚠️ Screenshot activity detected. Notice: Screenshots cannot always be prevented, but mutual anonymity protects your safety.');
    try {
      await reportScreenshotActivity(currentUser.user_id, partnerId, room.room_id, platform);
    } catch (e) {
      // quiet catch
    }
    setTimeout(() => setScreenshotBanner(null), 8000);
  }

  function handleFinishAndConnect() {
    if (onMutualRevealSuccess && room) {
      onMutualRevealSuccess({
        ...room,
        connection_type: outcome === 'friends' ? 'friends' : 'dating',
        puzzle_results: puzzleResults,
        unlocked_topics: puzzleResults?.unlocked_topics || ["What's your dream destination?"]
      });
    }
    onClose();
  }

  // 17. 📍 Approximate Location Helpers
  function formatApproximateDistance(km) {
    if (!km || km <= 2) return '📍 < 2 km away';
    return `📍 ~${km} km away`;
  }

  async function handleToggleLocation(newVal, newRegion = null) {
    const reg = newRegion || userCoarseRegion;
    setLocationSharingEnabled(newVal);
    if (newRegion) setUserCoarseRegion(newRegion);
    if (currentUser) {
      try {
        await toggleLocationSharing(currentUser.user_id, newVal, reg, fuzzedDistanceKm);
      } catch (e) {
        console.warn('Error toggling location sharing:', e);
      }
    }
  }

  const currentAct = room?.activities?.[room?.current_activity_idx] || room?.activities?.[0];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Text style={styles.badgeIcon}>🕶️</Text>
              <Text style={styles.title}>ANONYMOUS BLIND DATE</Text>
            </View>
            <View style={styles.headerRightControls}>
              {/* 17. 📍 Approximate Location Trigger */}
              <TouchableOpacity
                style={[
                  styles.locationHeaderBtn,
                  locationSharingEnabled && styles.locationHeaderBtnActive
                ]}
                onPress={() => setLocationModalVisible(true)}
                title="Approximate Location Privacy (Never 123 Main Street)"
              >
                <Text style={[
                  styles.locationHeaderText,
                  locationSharingEnabled && styles.locationHeaderTextActive
                ]}>
                  {locationSharingEnabled ? `📍 ${userCoarseRegion}` : '📍 Location'}
                </Text>
              </TouchableOpacity>

              {stage === 'chamber' && (
                <TouchableOpacity
                  style={styles.safetyShieldHeaderBtn}
                  onPress={() => setSafetyPolicyModalVisible(true)}
                  title="Safety Layer: Contact Protection & Screenshot Policy"
                >
                  <Text style={styles.safetyShieldHeaderText}>🛡️ Safety</Text>
                </TouchableOpacity>
              )}
              {stage === 'chamber' && (
                <View style={{ position: 'relative' }}>
                  <TouchableOpacity
                    style={styles.moreMenuBtn}
                    onPress={() => setExitMenuVisible(!exitMenuVisible)}
                    title="Options Menu"
                  >
                    <Text style={styles.moreMenuBtnText}>⋮</Text>
                  </TouchableOpacity>
                  {exitMenuVisible && (
                    <View style={styles.dropdownMenu}>
                      <TouchableOpacity
                        style={styles.dropdownItem}
                        onPress={() => {
                          setExitMenuVisible(false);
                          setExitConfirmVisible(true);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>🚪 Leave Date</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dropdownItem, { borderTopWidth: 1, borderTopColor: '#334155' }]}
                        onPress={() => {
                          setExitMenuVisible(false);
                          handleInstantBlockOneTap();
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: '#F87171' }]}>🛡️ Instant Block (1 Tap)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dropdownItem, { borderTopWidth: 1, borderTopColor: '#334155' }]}
                        onPress={() => {
                          setExitMenuVisible(false);
                          setReportModalVisible(true);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: '#F87171' }]}>⚠️ Report Peer</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.dropdownItem, { borderTopWidth: 1, borderTopColor: '#334155' }]}
                        onPress={() => {
                          setExitMenuVisible(false);
                          setSafetyPolicyModalVisible(true);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: '#38BDF8' }]}>📸 Screenshot & Policy</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 1. LOBBY STAGE */}
          {stage === 'lobby' && (
            <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.heroBox}>
                <Text style={styles.heroTag}>THE SHADOW PROTOCOL</Text>
                <Text style={styles.heroTitle}>Match on Vibe, Not on Looks</Text>
                <Text style={styles.heroDesc}>
                  Enter the Blind Date chamber as a masked shadow. Complete interactive activities, feel the mutual chemistry, and decide together whether to lift the veil.
                </Text>
              </View>

              {/* Mode Selection */}
              <Text style={styles.sectionHeading}>1. SELECT BLIND DATE MODE</Text>
              <View style={styles.modeCardsContainer}>
                {BLIND_DATE_MODES.map((m) => {
                  const isSel = selectedMode === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.modeCard,
                        isSel && styles.modeCardSelected,
                        isSel && { borderColor: m.accentColor }
                      ]}
                      onPress={() => setSelectedMode(m.id)}
                    >
                      <View style={styles.modeCardHeader}>
                        <View style={[styles.modeCodeBadge, { backgroundColor: isSel ? m.accentColor : '#1E293B' }]}>
                          <Text style={[styles.modeCodeBadgeText, isSel && { color: '#0F172A' }]}>
                            {m.modeCode}
                          </Text>
                        </View>
                        <Text style={styles.modeIcon}>{m.icon}</Text>
                        <View style={styles.modeBadgeTag}>
                          <Text style={styles.modeBadgeTagText}>{m.badge}</Text>
                        </View>
                      </View>
                      <Text style={[styles.modeTitle, isSel && { color: '#FFFFFF' }]}>
                        {m.title}
                      </Text>
                      <Text style={styles.modeTagline}>{m.tagline}</Text>
                      {isSel && (
                        <View style={styles.modeSummaryBox}>
                          <Text style={styles.modeSummaryText}>✨ {m.summary}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 2. DATE DURATION SELECTOR */}
              <Text style={[styles.sectionHeading, { marginTop: 14 }]}>2. SELECT DATE DURATION</Text>
              <View style={styles.durationSelectorRow}>
                {DATE_DURATIONS.map((d) => {
                  const isSel = selectedDuration === d.minutes;
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={[
                        styles.durationCard,
                        isSel && styles.durationCardSelected
                      ]}
                      onPress={() => setSelectedDuration(d.minutes)}
                    >
                      <View style={styles.durationCardHeader}>
                        <Text style={styles.durationIcon}>{d.minutes === 15 ? '⏱️' : '⏳'}</Text>
                        <View style={[styles.durationBadge, isSel && styles.durationBadgeSelected]}>
                          <Text style={[styles.durationBadgeText, isSel && { color: '#0F172A' }]}>
                            {d.badge}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.durationTitle, isSel && { color: '#FFFFFF' }]}>
                        {d.title}
                      </Text>
                      <Text style={styles.durationSub}>{d.sub}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.sectionHeading, { marginTop: 14 }]}>3. SELECT YOUR AMBIENT VIBE</Text>
              <View style={styles.vibeList}>
                {VIBES.map((v) => {
                  const isSel = selectedVibe === v.label;
                  return (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.vibeCard, isSel && styles.vibeCardSelected]}
                      onPress={() => setSelectedVibe(v.label)}
                    >
                      <Text style={styles.vibeIcon}>{v.icon}</Text>
                      <Text style={[styles.vibeLabel, isSel && styles.vibeLabelSelected]}>
                        {v.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.flowExplainer}>
                <Text style={styles.flowStep}>① Masked Match ➔ ② {selectedDuration}-Min Timed Date & Chat ➔ ③ Continue, Friends, End or Block</Text>
              </View>

              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => handleStartMatchmaking(false)}
              >
                <Text style={styles.primaryActionBtnText}>
                  Enter {selectedDuration}-Min {selectedMode === 'mystery' ? 'Mystery Match' : selectedMode === 'speed' ? 'Speed Blitz' : 'Vibe Deep Dive'} ➔
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* 2. SEARCHING / RADAR STAGE */}
          {stage === 'searching' && (
            <View style={styles.centerBox}>
              <View style={styles.radarPulse}>
                <Text style={styles.radarIcon}>📡</Text>
              </View>
              <Text style={styles.searchingTitle}>
                {selectedMode === 'mystery' ? 'Matching Mystery Shadow...' : selectedMode === 'speed' ? 'Connecting Speed Blitz...' : 'Synchronizing Nocturnal Vibe...'}
              </Text>
              <Text style={styles.searchingVibe}>{selectedVibe}</Text>
              <ActivityIndicator color="#38BDF8" style={{ marginVertical: 16 }} />
              <Text style={styles.searchingSub}>
                {selectedMode === 'mystery'
                  ? 'Finding a compatible soul. Identities are 100% shrouded: No photo, no real name, no social media.'
                  : 'Your identity is completely encrypted. Matching with active anonymous soulmates...'}
              </Text>

              <TouchableOpacity
                style={styles.cancelSearchBtn}
                onPress={() => handleExit()}
              >
                <Text style={styles.cancelSearchText}>Cancel Search</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* 3. CHAMBER: ACTIVE DATE SESSION STAGE */}
          {stage === 'chamber' && room && (
            <View style={styles.chamberWrapper}>
              {/* 6. ⏳ SIGNATURE BLIND DATE TIMER BAR */}
              {(() => {
                const totalSec = (selectedMode === 'speed' || room?.mode === 'speed') ? 300 : (room?.duration_minutes || selectedDuration || 20) * 60;
                const elapsedPercent = Math.min(100, Math.max(0, Math.round(((totalSec - countdownSeconds) / totalSec) * 100)));
                const isUrgent = countdownSeconds <= 120;
                const isWarning = countdownSeconds <= 300 && countdownSeconds > 120;

                return (
                  <View style={[
                    styles.timerHeaderCard,
                    isUrgent && styles.timerHeaderUrgent,
                    isWarning && styles.timerHeaderWarning
                  ]}>
                    <View style={styles.timerTopRow}>
                      <View style={styles.timerDisplayGroup}>
                        <Text style={[styles.timerIconPulse, isUrgent && { transform: [{ scale: 1.1 }] }]}>⏳</Text>
                        <View>
                          <View style={styles.timerLabelRow}>
                            <Text style={styles.timerSmallLabel}>BLIND DATE TIMER</Text>
                            <View style={[
                              styles.timerStatusDot,
                              isUrgent ? { backgroundColor: '#F43F5E' } : isWarning ? { backgroundColor: '#F59E0B' } : { backgroundColor: '#10B981' }
                            ]} />
                            <Text style={[
                              styles.timerStatusText,
                              isUrgent ? { color: '#FB7185' } : isWarning ? { color: '#FCD34D' } : { color: '#6EE7B7' }
                            ]}>
                              {isUrgent ? 'FINAL MOMENTS' : isWarning ? '5-MIN WARNING' : 'SESSION ACTIVE'}
                            </Text>
                          </View>
                          {/* Exact format required: "19:42 remaining" */}
                          <Text style={[
                            styles.timerClockText,
                            isUrgent && styles.timerClockUrgent,
                            isWarning && styles.timerClockWarning
                          ]}>
                            {formatTimeRemaining(countdownSeconds)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.timerActionControls}>
                        {/* 15. 🚪 Exit Anytime quick button */}
                        <TouchableOpacity
                          style={styles.timerLeaveBtn}
                          onPress={() => setExitConfirmVisible(true)}
                          title="Leave Date Safely (No Explanation Required)"
                        >
                          <Text style={styles.timerLeaveText}>🚪 Leave Date</Text>
                        </TouchableOpacity>

                        {/* 6. 🛡️ One-Tap Instant Block */}
                        <TouchableOpacity
                          style={styles.timerInstantBlockBtn}
                          onPress={handleInstantBlockOneTap}
                          disabled={isInstantBlocking}
                          title="Instant Block (One Tap)"
                        >
                          <Text style={styles.timerInstantBlockText}>
                            {isInstantBlocking ? 'Blocking...' : '🛡️ Instant Block'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.timerDecideEarlyBtn}
                          onPress={() => setStage('decision')}
                        >
                          <Text style={styles.timerDecideEarlyText}>Wrap Up ➔</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Visual Progress Bar */}
                    <View style={styles.timerProgressTrack}>
                      <View
                        style={[
                          styles.timerProgressFill,
                          { width: `${elapsedPercent}%` },
                          isUrgent ? { backgroundColor: '#F43F5E' } : isWarning ? { backgroundColor: '#F59E0B' } : { backgroundColor: '#818CF8' }
                        ]}
                      />
                    </View>

                    <View style={styles.timerBottomMeta}>
                      <Text style={styles.timerSubHint}>
                        {countdownSeconds > 300
                          ? `✨ Total ${room?.duration_minutes || selectedDuration || 20}-minute date • Keep chatting & discovering resonance!`
                          : countdownSeconds > 120
                          ? '⚡ 5 minutes remaining • Connection deepening!'
                          : '🚨 Under 2 minutes • Prepare for the Continue, Friends, End or Block decision!'}
                      </Text>
                      <Text style={styles.timerPercentLabel}>{elapsedPercent}% elapsed</Text>
                    </View>
                  </View>
                );
              })()}

              {/* Chamber Status Bar */}
              <View style={styles.chamberBar}>
                <View style={styles.chamberUser}>
                  <Text style={styles.ghostIcon}>👤</Text>
                  <Text style={styles.ghostName}>You (Shadow)</Text>
                </View>

                {/* Chemistry Progress */}
                <View style={styles.chemistryContainer}>
                  <Text style={styles.chemistryTitle}>🔥 Chemistry: {room.chemistry}%</Text>
                  <View style={styles.chemTrack}>
                    <View style={[styles.chemFill, { width: `${room.chemistry}%` }]} />
                  </View>
                </View>

                <View style={styles.chamberUser}>
                  <Text style={styles.ghostIcon}>🎭</Text>
                  <Text style={styles.ghostName}>{peerGhost}</Text>
                </View>
              </View>

              {/* Interactive Chamber Tabs */}
              <View style={styles.chamberTabBar}>
                <TouchableOpacity
                  style={[styles.chamberTabBtn, chamberTab === 'chat' && styles.chamberTabBtnActive]}
                  onPress={() => setChamberTab('chat')}
                >
                  <Text style={[styles.chamberTabBtnText, chamberTab === 'chat' && styles.chamberTabBtnTextActive]}>
                    💬 Live Date Chat ({chatMessages.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chamberTabBtn, chamberTab === 'activities' && styles.chamberTabBtnActive]}
                  onPress={() => setChamberTab('activities')}
                >
                  <Text style={[styles.chamberTabBtnText, chamberTab === 'activities' && styles.chamberTabBtnTextActive]}>
                    🧩 Activities ({room.current_activity_idx + 1}/{room.activities.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chamberTabBtn, chamberTab === 'missions' && styles.chamberTabBtnActive]}
                  onPress={() => {
                    setChamberTab('missions');
                    loadChamberMissions(room.room_id);
                  }}
                >
                  <Text style={[styles.chamberTabBtnText, chamberTab === 'missions' && styles.chamberTabBtnTextActive]}>
                    🎯 Missions ({chamberMissions.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chamberTabBtn, chamberTab === 'mystery' && styles.chamberTabBtnActive]}
                  onPress={() => setChamberTab('mystery')}
                >
                  <Text style={[styles.chamberTabBtnText, chamberTab === 'mystery' && styles.chamberTabBtnTextActive]}>
                    ✨ Mystery Profile
                  </Text>
                </TouchableOpacity>
              </View>

              {/* TAB 1: LIVE IN-CHAMBER DATE CHAT */}
              {chamberTab === 'chat' && (
                <View style={styles.dateChatContainer}>
                  <ScrollView style={styles.dateChatScroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.dateChatPillNotice}>
                      <Text style={styles.dateChatNoticeText}>
                        🔒 Zero-Knowledge Date Chat • Session expires when timer reaches 00:00
                      </Text>
                    </View>

                    {/* 6. 🛡️ Contact Protection Notice */}
                    <View style={styles.contactProtectionBanner}>
                      <View style={styles.contactProtectionTitleRow}>
                        <Text style={styles.contactProtectionIcon}>🛡️</Text>
                        <Text style={styles.contactProtectionTitle}>Contact Protection Active</Text>
                        <View style={styles.contactProtectionBadge}>
                          <Text style={styles.contactProtectionBadgeText}>ZERO EXPOSURE</Text>
                        </View>
                      </View>
                      <Text style={styles.contactProtectionNoticeText}>
                        Don't expose: phone number, email, exact location, or device information.
                      </Text>
                    </View>

                    {/* 6. 📸 Screenshot Detection Warning Alert */}
                    {screenshotBanner && (
                      <View style={styles.screenshotBannerCard}>
                        <View style={styles.screenshotBannerHeader}>
                          <Text style={styles.screenshotBannerIcon}>📸</Text>
                          <Text style={styles.screenshotBannerTitle}>Screenshot Activity Warning</Text>
                          <TouchableOpacity onPress={() => setScreenshotBanner(null)} style={{ marginLeft: 'auto', padding: 2 }}>
                            <Text style={{ color: '#FCA5A5', fontSize: 13, fontWeight: '700' }}>✕</Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={styles.screenshotBannerText}>{screenshotBanner}</Text>
                        <Text style={styles.screenshotBannerSub}>
                          Notice: Screenshot detection is attempted on supported platforms, but screenshots cannot always be prevented.
                        </Text>
                      </View>
                    )}

                    {chatMessages.map((msg, idx) => {
                      const isMe = msg.sender_id === currentUser.user_id;
                      return (
                        <View
                          key={msg.message_id || idx}
                          style={[styles.chatBubbleRow, isMe ? styles.chatBubbleRowMe : styles.chatBubbleRowPeer]}
                        >
                          <View style={[styles.chatBubble, isMe ? styles.chatBubbleMe : styles.chatBubblePeer]}>
                            <Text style={styles.chatSenderTag}>
                              {isMe ? 'You (Shadow)' : msg.ghost_sender || peerGhost}
                            </Text>
                            <Text style={styles.chatMessageText}>{msg.text}</Text>
                            {msg.is_contact_protected && (
                              <View style={styles.shieldedContactTag}>
                                <Text style={styles.shieldedContactTagText}>🛡️ Contact Information Shielded</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>

                  {/* Icebreaker topic chips */}
                  <View style={styles.icebreakerChipRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <TouchableOpacity
                        style={styles.icebreakerChip}
                        onPress={() => handleSendChatMessage("What thoughts keep your mind alive during late midnight hours?")}
                      >
                        <Text style={styles.icebreakerChipText}>🌙 Midnight thoughts?</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.icebreakerChip}
                        onPress={() => handleSendChatMessage("What's your go-to song or album right now?")}
                      >
                        <Text style={styles.icebreakerChipText}>🎵 Current favorite music?</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.icebreakerChip}
                        onPress={() => handleSendChatMessage("If you had ₹10 lakh, what's the first thing you'd do?")}
                      >
                        <Text style={styles.icebreakerChipText}>💰 The ₹10 Lakh dilemma?</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.icebreakerChip}
                        onPress={() => handleSendChatMessage("What game or world do you find yourself lost in?")}
                      >
                        <Text style={styles.icebreakerChipText}>🎮 Favorite games?</Text>
                      </TouchableOpacity>
                    </ScrollView>
                  </View>

                  {/* Chat Input Bar */}
                  <View style={styles.dateChatInputBar}>
                    <TextInput
                      style={styles.dateChatInputField}
                      placeholder="Say something to your blind match..."
                      placeholderTextColor="#64748B"
                      value={chatInputText}
                      onChangeText={setChatInputText}
                      onSubmitEditing={() => handleSendChatMessage()}
                    />
                    <TouchableOpacity
                      style={[styles.dateChatSendBtn, !chatInputText.trim() && styles.dateChatSendBtnDisabled]}
                      onPress={() => handleSendChatMessage()}
                      disabled={!chatInputText.trim()}
                    >
                      <Text style={styles.dateChatSendBtnText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* TAB 2: ACTIVITIES STAGE */}
              {chamberTab === 'activities' && (
                <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.activityBox}>
                    <View style={styles.activityHeader}>
                      <Text style={styles.activityStepLabel}>
                        ROUND {room.current_activity_idx + 1} OF {room.activities.length}
                      </Text>
                      <Text style={styles.activityTitle}>{currentAct.title}</Text>
                      <Text style={styles.activityQuestion}>{currentAct.question}</Text>
                    </View>

                    {/* Question Type: This or That */}
                    {currentAct.type === 'this_or_that' || currentAct.type === 'vibe_check' ? (
                      <View style={styles.optionsGrid}>
                        {currentAct.options.map((opt, oIdx) => {
                          const isChosen = selectedOption === opt;
                          return (
                            <TouchableOpacity
                              key={oIdx}
                              style={[styles.optCard, isChosen && styles.optCardChosen]}
                              onPress={() => handleOptionSelect(opt)}
                              disabled={hasSubmittedCurrent}
                            >
                              <Text style={[styles.optCardText, isChosen && styles.optCardTextChosen]}>
                                {opt}
                              </Text>
                              {isChosen && <Text style={styles.checkMark}>✓</Text>}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : (
                      /* Question Type: Deep Blind Prompt */
                      <View style={styles.promptArea}>
                        <TextInput
                          style={styles.promptInput}
                          placeholder={currentAct.placeholder}
                          placeholderTextColor="#64748B"
                          value={myAnswerInput}
                          onChangeText={setMyAnswerInput}
                          multiline
                          editable={!hasSubmittedCurrent}
                        />
                        <TouchableOpacity
                          style={[styles.submitPromptBtn, hasSubmittedCurrent && styles.btnDisabled]}
                          onPress={handlePromptSubmit}
                          disabled={hasSubmittedCurrent || !myAnswerInput.trim()}
                        >
                          <Text style={styles.submitPromptBtnText}>
                            {hasSubmittedCurrent ? 'Answer Sealed 🔒' : 'Submit Secret Answer ➔'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {hasSubmittedCurrent && (
                      <View style={styles.waitingNotice}>
                        <Text style={styles.waitingNoticeText}>
                          ✓ Your answer is sealed! Waiting for {peerGhost} to complete round...
                        </Text>
                      </View>
                    )}
                  </View>
                </ScrollView>
              )}

              {/* TAB: 🎯 BLIND DATE MISSIONS */}
              {chamberTab === 'missions' && (
                <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.activityBox}>
                    <View style={styles.activityHeader}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={styles.activityStepLabel}>
                          BLIND DATE MISSIONS
                        </Text>
                        <View style={{ backgroundColor: 'rgba(244, 63, 94, 0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                          <Text style={{ color: '#FB7185', fontWeight: '900', fontSize: 12 }}>✨ Date XP: {chamberDateXp}</Text>
                        </View>
                      </View>
                      <Text style={styles.activityTitle}>Random Interactive Missions</Text>
                      <Text style={styles.activityQuestion}>
                        Complete missions with {peerGhost} to keep the conversation dynamic and earn ✨ Date XP +20!
                      </Text>
                    </View>

                    {chamberMissions.map((m) => (
                      <View key={m.id} style={{ backgroundColor: '#1E1B4B', borderWidth: 1, borderColor: '#6366F1', borderRadius: 14, padding: 16, marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text style={{ color: '#A5B4FC', fontWeight: '900', fontSize: 12 }}>{m.emoji} {m.title}</Text>
                          <Text style={{ color: '#E11D48', fontWeight: '900', fontSize: 11 }}>✨ +20 Date XP</Text>
                        </View>
                        <Text style={{ color: '#F8FAFC', fontSize: 16, fontWeight: '800', lineHeight: 22, marginVertical: 6 }}>{m.prompt}</Text>
                        {m.requires_voice && (
                          <Text style={{ color: '#38BDF8', fontSize: 11, fontWeight: '700', marginBottom: 8 }}>🎙️ Requires Encrypted Voice Note</Text>
                        )}
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                          <TouchableOpacity
                            style={{ flex: 1, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#475569', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
                            onPress={() => {
                              setChatInputText(m.chat_starter || `🎯 Mission: ${m.prompt}`);
                              setChamberTab('chat');
                            }}
                          >
                            <Text style={{ color: '#CBD5E1', fontSize: 12, fontWeight: '800' }}>💬 Send to Chat</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={{ flex: 1, backgroundColor: '#BE123C', borderRadius: 8, paddingVertical: 8, alignItems: 'center' }}
                            onPress={() => handleCompleteChamberMission(m)}
                          >
                            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>✓ Mark Done ➔</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}

                    <TouchableOpacity
                      style={{ backgroundColor: '#312E81', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 6 }}
                      onPress={handleUnlockChamberMission}
                    >
                      <Text style={{ color: '#C7D2FE', fontSize: 13, fontWeight: '800' }}>🎲 Unlock New Random Mission (+20 XP)</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}

              {/* TAB 3: 👻 PROGRESSIVE IDENTITY REVEAL CARD */}
              {chamberTab === 'mystery' && (() => {
                const totalDurationSec = (selectedMode === 'speed' || room?.mode === 'speed') ? 300 : (room?.duration_minutes || selectedDuration || 20) * 60;
                const dateElapsedSec = Math.max(0, (totalDurationSec - countdownSeconds) + chamberSimulatedBonusSec);

                let bdStage = 0;
                let bdStageName = 'Mystery Person';
                if (dateElapsedSec >= 300) {
                  bdStage = 1;
                  bdStageName = 'Interest #1 Revealed';
                }
                if (dateElapsedSec >= 600) {
                  bdStage = 2;
                  bdStageName = 'Nickname Revealed';
                }
                if (chamberMutualInterest || (room?.chemistry || 0) >= 60) {
                  bdStage = Math.max(bdStage, 3);
                  bdStageName = 'Avatar Revealed';
                }
                if (chamberPhotoUnlocked) {
                  bdStage = 4;
                  bdStageName = 'Photo Revealed';
                }

                const interests = mysteryCard?.interests || ['🎮 Gaming', '🎵 Music', '☕ Coffee'];
                const interestOne = interests[0] || '🎮 Gaming';
                const peerRealName = mysteryCard?.handle !== '🌑 Unknown' ? mysteryCard?.handle : (peerGhost || 'Nova');

                return (
                  <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
                    {/* Progressive Reveal Header */}
                    <View style={styles.progRevealHeader}>
                      <View style={styles.progRevealTitleRow}>
                        <Text style={styles.progGhostIcon}>👻</Text>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.progHeaderTitle}>PROGRESSIVE IDENTITY REVEAL</Text>
                            <View style={[styles.progStageBadge, { backgroundColor: bdStage === 0 ? '#64748B' : bdStage === 1 ? '#818CF8' : bdStage === 2 ? '#38BDF8' : bdStage === 3 ? '#EC4899' : '#10B981' }]}>
                              <Text style={styles.progStageBadgeText}>STAGE {bdStage}: {bdStageName.toUpperCase()}</Text>
                            </View>
                          </View>
                          <Text style={styles.progMilestoneHint}>
                            {bdStage === 0 && `⏱️ ${Math.max(0, Math.floor((300 - dateElapsedSec) / 60))}:${(Math.max(0, 300 - dateElapsedSec) % 60).toString().padStart(2, '0')} to Interest #1 reveal`}
                            {bdStage === 1 && `⏱️ ${Math.max(0, Math.floor((600 - dateElapsedSec) / 60))}:${(Math.max(0, 600 - dateElapsedSec) % 60).toString().padStart(2, '0')} to Nickname reveal`}
                            {bdStage === 2 && '💖 Express mutual interest to reveal Avatar'}
                            {bdStage === 3 && '🔒 Ready for Photo Reveal (Mutual Consent Required)'}
                            {bdStage === 4 && '✨ Authentic Photo & Profile Revealed!'}
                          </Text>
                        </View>
                      </View>

                      {/* 5-Step Visual Timeline */}
                      <View style={styles.progTimelineRow}>
                        {[
                          { s: 0, label: 'Mystery', icon: '🌑', sub: '0m' },
                          { s: 1, label: 'Interest #1', icon: '🎮', sub: '5m' },
                          { s: 2, label: 'Nickname', icon: '🏷️', sub: '10m' },
                          { s: 3, label: 'Avatar', icon: '🎨', sub: 'Mutual' },
                          { s: 4, label: 'Photo', icon: '📸', sub: 'Consent' }
                        ].map((step) => {
                          const isDone = bdStage >= step.s;
                          const isCur = bdStage === step.s;
                          return (
                            <View key={step.s} style={styles.progTimelineStep}>
                              <View style={[
                                styles.progStepCircle,
                                isDone && styles.progStepCircleDone,
                                isCur && styles.progStepCircleCur
                              ]}>
                                <Text style={styles.progStepIcon}>{step.icon}</Text>
                              </View>
                              <Text style={[styles.progStepLabel, isDone && styles.progStepLabelDone]}>
                                {step.label}
                              </Text>
                              <Text style={styles.progStepSub}>{step.sub}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>

                    {/* Mystery Match Card with Progressive Unveiling */}
                    <View style={styles.mysteryCard}>
                      <View style={styles.mysteryTopRow}>
                        <View style={styles.mysteryTagPill}>
                          <Text style={styles.mysteryTagText}>✨ YOUR MYSTERY MATCH</Text>
                        </View>
                        <View style={styles.compatPill}>
                          <Text style={styles.compatPillText}>
                            {bdStage >= 3 ? 'Compatibility: High (88%) ✨' : 'Compatibility: Hidden 🔒'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.mysteryProfileRow}>
                        {/* Avatar */}
                        {bdStage >= 4 && chamberPhotoUnlocked ? (
                          <View style={styles.progPhotoContainer}>
                            <Image
                              source={{ uri: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80' }}
                              style={styles.progRealPhoto}
                            />
                            <View style={styles.progVerifiedBadge}>
                              <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '900' }}>✓</Text>
                            </View>
                          </View>
                        ) : (
                          <View style={[
                            styles.mysteryAvatar,
                            bdStage >= 3 && { backgroundColor: '#818CF8', borderColor: '#C7D2FE', borderWidth: 2 }
                          ]}>
                            <Text style={styles.mysteryAvatarIcon}>
                              {bdStage >= 3 ? '🌙' : '🌑'}
                            </Text>
                          </View>
                        )}

                        <View style={styles.mysteryNameCol}>
                          <Text style={styles.mysteryUnknownText}>
                            {bdStage >= 2 ? '✨ Lyra (Nova)' : (mysteryCard?.handle || '🌑 Unknown')}
                          </Text>
                          <Text style={styles.mysteryAgeText}>
                            {mysteryCard?.age_bracket || 'Age: 20–24'}
                          </Text>
                          {/* 17. 📍 Approximate Location */}
                          {mysteryCard?.location_sharing_enabled ? (
                            <View style={styles.mysteryLocationBadge}>
                              <Text style={styles.mysteryLocationText}>
                                {mysteryCard.approximate_distance || '📍 ~8 km away'} • {mysteryCard.approximate_region || '📍 Delhi NCR'}
                              </Text>
                            </View>
                          ) : (
                            <View style={styles.mysteryLocationHiddenBadge}>
                              <Text style={styles.mysteryLocationHiddenText}>
                                📍 Location Hidden (Opt-in only)
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Interest #1 Progressive Tag */}
                      <View style={styles.mysteryInterestsSection}>
                        <Text style={styles.mysteryInterestsLabel}>Interests:</Text>
                        {bdStage >= 1 ? (
                          <View style={styles.progUnlockedInterestBox}>
                            <View style={styles.progInterestChipActive}>
                              <Text style={styles.progSparkleIcon}>✨</Text>
                              <Text style={styles.progInterestChipText}>Interest #1: {interestOne}</Text>
                              <View style={styles.prog5mPill}>
                                <Text style={styles.prog5mPillText}>5m Unlocked</Text>
                              </View>
                            </View>
                            {bdStage >= 2 && interests.slice(1).map((tag, idx) => (
                              <View key={idx} style={styles.mysteryInterestBadge}>
                                <Text style={styles.mysteryInterestBadgeText}>{tag}</Text>
                              </View>
                            ))}
                          </View>
                        ) : (
                          <View style={styles.progLockedInterestBox}>
                            <Text style={styles.progLockedInterestText}>
                              🔒 Interest #1 revealed after 5 minutes of dating
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Guarantees / Status Row */}
                      <View style={styles.mysteryGuaranteesRow}>
                        <View style={styles.mysteryGuaranteeItem}>
                          <Text style={styles.mysteryGuaranteeText}>
                            {bdStage >= 4 ? '✓ Photo Revealed' : '🔒 No photo (Until consent)'}
                          </Text>
                        </View>
                        <View style={styles.mysteryGuaranteeItem}>
                          <Text style={styles.mysteryGuaranteeText}>
                            {bdStage >= 2 ? '✓ Nickname Revealed' : '🔒 No real name (Until 10m)'}
                          </Text>
                        </View>
                        <View style={styles.mysteryGuaranteeItem}>
                          <Text style={styles.mysteryGuaranteeText}>🔒 No social media.</Text>
                        </View>
                      </View>
                    </View>

                    {/* ========================================================= */}
                    {/* 🔒 THE MUTUAL CONSENT PHOTO REVEAL PROMPT DIALOG */}
                    {/* ========================================================= */}
                    {chamberPhotoConsentPrompt && !chamberPhotoUnlocked && (
                      <View style={styles.bdConsentCard}>
                        <Text style={styles.bdConsentTitle}>
                          Nova wants to reveal their profile.
                        </Text>

                        <View style={styles.bdLockRing}>
                          <Text style={styles.bdBigLock}>🔒</Text>
                        </View>

                        <Text style={styles.bdConsentQuestion}>Reveal to each other?</Text>
                        <Text style={styles.bdConsentSub}>
                          Both users must consent before mutual reveal. If either chooses to keep anonymous, identities stay 100% encrypted.
                        </Text>

                        <View style={styles.bdConsentBtnsRow}>
                          <TouchableOpacity
                            style={styles.bdRevealBtn}
                            onPress={() => {
                              setChamberPhotoUnlocked(true);
                              setChamberPhotoConsentPrompt(false);
                              Alert.alert('🎉 Veil Lifted!', 'Mutual consent confirmed! Full authentic photo has been revealed!');
                            }}
                          >
                            <Text style={styles.bdRevealBtnText}>[ Reveal ]</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.bdKeepAnonBtn}
                            onPress={() => {
                              setChamberPhotoConsentPrompt(false);
                              Alert.alert('🔒 Kept Anonymous', 'You chose to keep anonymous. Profile photo remains protected.');
                            }}
                          >
                            <Text style={styles.bdKeepAnonBtnText}>[ Keep Anonymous ]</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Progressive Interactive Buttons */}
                    <View style={styles.progActionsContainer}>
                      {/* Button: Declare Mutual Interest */}
                      <TouchableOpacity
                        style={[styles.progInterestBtn, chamberMutualInterest && styles.progInterestBtnActive]}
                        onPress={() => {
                          const next = !chamberMutualInterest;
                          setChamberMutualInterest(next);
                          if (next) {
                            Alert.alert('✨ Mutual Spark!', 'Both of you expressed mutual interest! Avatar has been revealed!');
                          }
                        }}
                      >
                        <Text style={styles.progInterestBtnText}>
                          {chamberMutualInterest
                            ? '✨ Mutual Interest Confirmed (Avatar Revealed)'
                            : '💖 Express Mutual Interest'}
                        </Text>
                      </TouchableOpacity>

                      {/* Button: Request Photo Reveal */}
                      {bdStage >= 3 && !chamberPhotoUnlocked && !chamberPhotoConsentPrompt && (
                        <TouchableOpacity
                          style={styles.progRequestPhotoBtn}
                          onPress={() => setChamberPhotoConsentPrompt(true)}
                        >
                          <Text style={styles.progRequestPhotoBtnText}>
                            📸 Request Mutual Photo Reveal
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </ScrollView>
                );
              })()}

            </View>
          )}

          {/* 4. END OF DATE DECISION STAGE (The 4 Options) */}
          {stage === 'decision' && (
            <ScrollView style={styles.contentScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.decisionContainer}>
                {/* Timer Expired Banner */}
                <View style={styles.dateConcludedBanner}>
                  <Text style={styles.dateConcludedIcon}>⏳</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dateConcludedTitle}>BLIND DATE CONCLUDED</Text>
                    <Text style={styles.dateConcludedSub}>
                      Your {room?.duration_minutes || selectedDuration || 20}-minute date session has ended. Chemistry: {room?.chemistry || 30}%
                    </Text>
                  </View>
                </View>

                {/* 🧩 Compatibility Puzzle Results */}
                {puzzleResults && (
                  <View style={styles.puzzleResultCard}>
                    <View style={styles.puzzleResultHeader}>
                      <Text style={styles.puzzleBadgeIcon}>🧩</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.puzzleResultBadge}>COMPATIBILITY PUZZLE UNLOCKED</Text>
                        <Text style={styles.puzzleResultSub}>Common resonance discovered during the date</Text>
                      </View>
                    </View>

                    <View style={styles.commonChoicesSection}>
                      <Text style={styles.commonChoicesLabel}>✨ You both chose:</Text>
                      <View style={styles.commonChoicesRow}>
                        {(puzzleResults.common_choices || ['🎮 Gaming', '🌙 Late nights', '✈️ Travel']).map((choice, cIdx) => (
                          <View key={cIdx} style={styles.commonChoiceChip}>
                            <Text style={styles.commonChoiceChipText}>{choice}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.decisionHero}>
                  <Text style={styles.decisionBadge}>THE 4 END-OF-DATE CHOICES</Text>
                  <Text style={styles.decisionTitle}>How was your date with {peerGhost}?</Text>
                  <Text style={styles.decisionDesc}>
                    Both users make their choice in complete confidentiality:
                  </Text>
                </View>

                {!decisionSubmitted ? (
                  <View style={styles.fourChoicesGrid}>
                    {/* OPTION 1: ❤️ Continue */}
                    <TouchableOpacity
                      style={[styles.fourChoiceCard, styles.choiceCardContinue]}
                      onPress={() => handleDecision('continue')}
                    >
                      <View style={styles.fourChoiceTopRow}>
                        <Text style={styles.fourChoiceIcon}>❤️</Text>
                        <View style={[styles.fourChoiceBadge, { backgroundColor: 'rgba(244, 63, 94, 0.2)' }]}>
                          <Text style={[styles.fourChoiceBadgeText, { color: '#FB7185' }]}>ROMANTIC SPARK</Text>
                        </View>
                      </View>
                      <Text style={styles.fourChoiceTitle}>Continue</Text>
                      <Text style={styles.fourChoiceDesc}>
                        Felt a romantic connection? Keep dating and transition into permanent 1-on-1 E2EE encrypted chat.
                      </Text>
                    </TouchableOpacity>

                    {/* OPTION 2: 🤝 Become Friends */}
                    <TouchableOpacity
                      style={[styles.fourChoiceCard, styles.choiceCardFriends]}
                      onPress={() => handleDecision('friends')}
                    >
                      <View style={styles.fourChoiceTopRow}>
                        <Text style={styles.fourChoiceIcon}>🤝</Text>
                        <View style={[styles.fourChoiceBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                          <Text style={[styles.fourChoiceBadgeText, { color: '#34D399' }]}>PLATONIC BOND</Text>
                        </View>
                      </View>
                      <Text style={styles.fourChoiceTitle}>Become Friends</Text>
                      <Text style={styles.fourChoiceDesc}>
                        Enjoyed the conversation and common vibe? Stay connected as friends with zero romantic pressure.
                      </Text>
                    </TouchableOpacity>

                    {/* OPTION 3: 🔄 Maybe Later */}
                    <TouchableOpacity
                      style={[styles.fourChoiceCard, { borderColor: '#A855F7', backgroundColor: 'rgba(168, 85, 247, 0.1)' }]}
                      onPress={() => handleDecision('maybe_later')}
                    >
                      <View style={styles.fourChoiceTopRow}>
                        <Text style={styles.fourChoiceIcon}>🔄</Text>
                        <View style={[styles.fourChoiceBadge, { backgroundColor: 'rgba(168, 85, 247, 0.2)' }]}>
                          <Text style={[styles.fourChoiceBadgeText, { color: '#C084FC' }]}>SECOND CHANCE</Text>
                        </View>
                      </View>
                      <Text style={styles.fourChoiceTitle}>Maybe Later</Text>
                      <Text style={styles.fourChoiceDesc}>
                        Not sure right now? If both select Maybe later, connection is placed into Second Chance to reopen independently later.
                      </Text>
                    </TouchableOpacity>

                    {/* OPTION 4: 👋 End Date */}
                    <TouchableOpacity
                      style={[styles.fourChoiceCard, styles.choiceCardEnd]}
                      onPress={() => handleDecision('end_date')}
                    >
                      <View style={styles.fourChoiceTopRow}>
                        <Text style={styles.fourChoiceIcon}>👋</Text>
                        <View style={[styles.fourChoiceBadge, { backgroundColor: 'rgba(100, 116, 139, 0.2)' }]}>
                          <Text style={[styles.fourChoiceBadgeText, { color: '#94A3B8' }]}>POLITE FAREWELL</Text>
                        </View>
                      </View>
                      <Text style={styles.fourChoiceTitle}>End Date</Text>
                      <Text style={styles.fourChoiceDesc}>
                        Say goodbye amicably. All temporary chamber data and keys self-destruct cleanly into the shadows.
                      </Text>
                    </TouchableOpacity>

                    {/* OPTION 4: 🚫 Report / Block */}
                    <TouchableOpacity
                      style={[styles.fourChoiceCard, styles.choiceCardReport]}
                      onPress={() => setReportModalVisible(true)}
                    >
                      <View style={styles.fourChoiceTopRow}>
                        <Text style={styles.fourChoiceIcon}>🚫</Text>
                        <View style={[styles.fourChoiceBadge, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                          <Text style={[styles.fourChoiceBadgeText, { color: '#F87171' }]}>SAFETY GUARD</Text>
                        </View>
                      </View>
                      <Text style={styles.fourChoiceTitle}>Report / Block</Text>
                      <Text style={styles.fourChoiceDesc}>
                        Report inappropriate conduct, flag violation, and permanently block this user from future matchmaking.
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.waitingDecisionBox}>
                    <ActivityIndicator color="#F43F5E" />
                    <Text style={styles.waitingDecisionText}>
                      You selected: <Text style={styles.chemHighlight}>{
                        decisionSubmitted === 'continue' ? '❤️ CONTINUE' :
                        decisionSubmitted === 'friends' ? '🤝 BECOME FRIENDS' :
                        decisionSubmitted === 'maybe_later' ? '🔄 MAYBE LATER' :
                        decisionSubmitted === 'end_date' ? '👋 END DATE' : '🚫 REPORT/BLOCK'
                      }</Text>
                      {'\n'}Awaiting {peerGhost}'s secret response...
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          )}

          {/* 5. OUTCOME STAGE */}
          {stage === 'outcome' && (
            <View style={styles.outcomeContainer}>
              {outcome === 'continue' || outcome === 'mutual_reveal' ? (
                <View style={styles.mutualRevealCard}>
                  <Text style={styles.outcomeIcon}>❤️ ✨ ❤️</Text>
                  <Text style={styles.outcomeTitle}>ROMANTIC SPARK UNLOCKED!</Text>
                  <Text style={styles.outcomeSub}>
                    Both of you chose to Continue! The veil has lifted. You have both unlocked Level 2 (Nicknames, Aesthetic Avatars & Verified Interests) in permanent E2EE chat.
                  </Text>

                  {puzzleResults?.unlocked_topics && (
                    <View style={styles.outcomeTopicBox}>
                      <Text style={styles.outcomeTopicTag}>🧩 UNLOCKED CONVERSATION STARTER:</Text>
                      <Text style={styles.outcomeTopicText}>
                        "{puzzleResults.unlocked_topics[0] || "What's your dream destination?"}"
                      </Text>
                    </View>
                  )}

                  <View style={styles.matchPersonaBox}>
                    <Text style={styles.matchPersonaTitle}>YOUR MATCH IS REVEALED:</Text>
                    <Text style={styles.matchPersonaName}>✨ Lyra (22)</Text>
                    <Text style={styles.matchPersonaInterests}>🌌 Astronomy | 🎮 Cyberpunk | 🎧 Lo-Fi Beats</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.continueToChatBtn}
                    onPress={handleFinishAndConnect}
                  >
                    <Text style={styles.continueToChatBtnText}>Open Permanent Encrypted Dating Chat ➔</Text>
                  </TouchableOpacity>
                </View>
              ) : outcome === 'friends' ? (
                <View style={[styles.mutualRevealCard, { borderColor: '#10B981' }]}>
                  <Text style={styles.outcomeIcon}>🤝 ✨ 🤝</Text>
                  <Text style={[styles.outcomeTitle, { color: '#34D399' }]}>CONNECTED AS FRIENDS!</Text>
                  <Text style={styles.outcomeSub}>
                    You both chose to Become Friends! No romantic pressure — stay in touch, share music, and vibe together in secure E2EE chat.
                  </Text>

                  <View style={[styles.matchPersonaBox, { backgroundColor: '#064E3B' }]}>
                    <Text style={[styles.matchPersonaTitle, { color: '#6EE7B7' }]}>FRIEND CONNECTION REVEALED:</Text>
                    <Text style={styles.matchPersonaName}>✨ Lyra (22)</Text>
                    <Text style={styles.matchPersonaInterests}>🎮 Gaming | ☕ Coffee | 🎵 Lo-Fi Beats</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.continueToChatBtn, { backgroundColor: '#10B981' }]}
                    onPress={handleFinishAndConnect}
                  >
                    <Text style={styles.continueToChatBtnText}>Open Permanent Friends Chat ➔</Text>
                  </TouchableOpacity>
                </View>
              ) : outcome === 'second_chance' ? (
                <View style={[styles.mutualRevealCard, { borderColor: '#A855F7', backgroundColor: '#1E143F' }]}>
                  <Text style={styles.outcomeIcon}>🔄 ✨ 🔄</Text>
                  <Text style={[styles.outcomeTitle, { color: '#C084FC' }]}>PLACED IN SECOND CHANCE!</Text>
                  <Text style={styles.outcomeSub}>
                    Both of you selected "Maybe later"! The connection is securely stored in your Second Chance vault. You can reconnect later if both independently choose to reopen it.
                  </Text>
                  <TouchableOpacity
                    style={[styles.continueToChatBtn, { backgroundColor: '#9333EA' }]}
                    onPress={() => {
                      handleExit();
                      if (onOpenSecondChance) onOpenSecondChance();
                    }}
                  >
                    <Text style={styles.continueToChatBtnText}>Open Second Chance Vault ➔</Text>
                  </TouchableOpacity>
                </View>
              ) : outcome === 'blocked' ? (
                <View style={[styles.fadeCard, { borderColor: '#EF4444' }]}>
                  <Text style={styles.outcomeIcon}>🚫 🛡️</Text>
                  <Text style={[styles.fadeTitle, { color: '#F87171' }]}>User Reported & Blocked</Text>
                  <Text style={styles.fadeSub}>
                    This user has been blocked and reported. They have been blacklisted and will never be matched with you again.
                  </Text>
                  <TouchableOpacity style={styles.returnLobbyBtn} onPress={handleExit}>
                    <Text style={styles.returnLobbyBtnText}>Return to Lobby</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.fadeCard}>
                  <Text style={styles.outcomeIcon}>👋 💨</Text>
                  <Text style={styles.fadeTitle}>Date Ended Amicably</Text>
                  <Text style={styles.fadeSub}>
                    You parted ways gracefully. All temporary chamber packets and ephemeral keys have self-destructed with zero trace left.
                  </Text>
                  <TouchableOpacity style={styles.returnLobbyBtn} onPress={handleExit}>
                    <Text style={styles.returnLobbyBtnText}>Return to Lobby</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* 15. 🚪 STAGE: ENDED (When either user exits safely) */}
          {stage === 'ended' && (
            <View style={styles.outcomeContainer}>
              <View style={[styles.fadeCard, { borderColor: '#F43F5E' }]}>
                <Text style={styles.outcomeIcon}>🌑</Text>
                <Text style={[styles.fadeTitle, { color: '#FDA4AF' }]}>
                  {exitNotice || 'The Blind Date has ended.'}
                </Text>
                <Text style={styles.fadeSub}>
                  {exitNotice?.includes('You left')
                    ? 'No explanation was required. All temporary chamber packets and ephemeral keys have self-destructed with zero trace left.'
                    : 'The other person has exited the date. No explanation required. All temporary chamber data has self-destructed.'}
                </Text>
                <TouchableOpacity style={styles.returnLobbyBtn} onPress={handleExit}>
                  <Text style={styles.returnLobbyBtnText}>Return to Lobby</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 15. 🚪 Exit Anytime Confirmation Modal */}
          <Modal
            visible={exitConfirmVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={() => setExitConfirmVisible(false)}
          >
            <View style={styles.exitModalOverlay}>
              <View style={styles.exitModalCard}>
                <Text style={styles.exitModalIcon}>⋮</Text>
                <Text style={styles.exitModalHeader}>Leave Date</Text>
                <Text style={styles.exitModalSub}>↓</Text>
                <Text style={styles.exitModalPrompt}>Are you sure?</Text>

                <TouchableOpacity
                  style={[styles.leaveSafelyBtn, isLeavingSafely && styles.btnDisabled]}
                  onPress={handleConfirmLeaveSafely}
                  disabled={isLeavingSafely}
                >
                  {isLeavingSafely ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.leaveSafelyBtnText}>[ Leave Safely ]</Text>
                  )}
                </TouchableOpacity>

                <Text style={styles.noExplanationNotice}>
                  No explanation required.
                </Text>

                <TouchableOpacity
                  style={styles.cancelExitBtn}
                  onPress={() => setExitConfirmVisible(false)}
                  disabled={isLeavingSafely}
                >
                  <Text style={styles.cancelExitBtnText}>Stay in Date</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* 6. 🛡️ REPORT & BLOCK MODAL (6 Categories) */}
          <Modal visible={reportModalVisible} transparent animationType="fade">
            <View style={styles.reportModalOverlay}>
              <View style={styles.reportModalCard}>
                <View style={styles.reportModalHeader}>
                  <Text style={styles.reportModalIcon}>🚫</Text>
                  <Text style={styles.reportModalTitle}>Report Peer (Safety Layer)</Text>
                </View>
                <Text style={styles.reportModalSub}>
                  Are you sure you want to report and block {peerGhost}? They will be immediately disconnected and blacklisted from your account.
                </Text>

                <Text style={styles.reportReasonLabel}>SELECT CATEGORY (6 REQUIRED SAFETY CATEGORIES):</Text>
                {SAFETY_REPORT_CATEGORIES.map((category, rIdx) => {
                  const isSel = selectedReportCategory === category;
                  return (
                    <TouchableOpacity
                      key={rIdx}
                      style={[styles.reportReasonOption, isSel && styles.reportReasonOptionSel]}
                      onPress={() => setSelectedReportCategory(category)}
                    >
                      <Text style={[styles.reportReasonText, isSel && styles.reportReasonTextSel]}>
                        {isSel ? '● ' : '○ '}{category}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TextInput
                  style={styles.reportCustomInput}
                  placeholder="Optional details or context..."
                  placeholderTextColor="#64748B"
                  value={customReportNote}
                  onChangeText={setCustomReportNote}
                />

                <View style={styles.reportModalBtnRow}>
                  <TouchableOpacity
                    style={styles.reportCancelBtn}
                    onPress={() => setReportModalVisible(false)}
                  >
                    <Text style={styles.reportCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.reportConfirmBtn}
                    onPress={handleSafetyReportSubmit}
                  >
                    <Text style={styles.reportConfirmBtnText}>Submit Report & Block</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* 6. 🛡️ SAFETY & SCREENSHOT POLICY MODAL */}
          <Modal visible={safetyPolicyModalVisible} transparent animationType="fade">
            <View style={styles.reportModalOverlay}>
              <View style={[styles.reportModalCard, { borderColor: '#38BDF8' }]}>
                <View style={styles.reportModalHeader}>
                  <Text style={styles.reportModalIcon}>🛡️</Text>
                  <Text style={[styles.reportModalTitle, { color: '#38BDF8' }]}>Safety Layer & Policy</Text>
                </View>
                <Text style={styles.reportModalSub}>
                  Essential protections for your anonymous blind-date experience.
                </Text>

                <View style={styles.safetyPolicySection}>
                  <Text style={styles.safetyPolicyHeading}>📸 Screenshot Warning & Transparency</Text>
                  <Text style={styles.safetyPolicyText}>
                    You can attempt to detect screenshots on supported platforms, but screenshots cannot always be prevented.
                    We monitor key combinations and capture events to warn both parties. Mutual pseudonymity and zero-knowledge encryption provide your real shielding.
                  </Text>
                </View>

                <View style={styles.safetyPolicySection}>
                  <Text style={styles.safetyPolicyHeading}>🛡️ Contact Protection</Text>
                  <Text style={styles.safetyPolicyText}>
                    To prevent harassment and unwanted contact, we strictly do NOT expose:
                    {'\n'}• Phone number
                    {'\n'}• Email address
                    {'\n'}• Exact location coordinates
                    {'\n'}• Device information & telemetry
                  </Text>
                </View>

                <View style={styles.safetyPolicySection}>
                  <Text style={styles.safetyPolicyHeading}>⚡ Instant Block</Text>
                  <Text style={styles.safetyPolicyText}>
                    One tap immediately breaks the blind date connection, burns ephemeral room keys, and ensures this user can never match with you again.
                  </Text>
                </View>

                <View style={styles.reportModalBtnRow}>
                  <TouchableOpacity
                    style={[styles.reportConfirmBtn, { backgroundColor: '#0284C7' }]}
                    onPress={() => setSafetyPolicyModalVisible(false)}
                  >
                    <Text style={styles.reportConfirmBtnText}>Understood</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* 17. 📍 APPROXIMATE LOCATION PRIVACY MODAL */}
          <Modal visible={locationModalVisible} transparent animationType="fade">
            <View style={styles.reportModalOverlay}>
              <View style={[styles.reportModalCard, { borderColor: '#F59E0B', maxWidth: 460 }]}>
                <View style={styles.reportModalHeader}>
                  <Text style={styles.reportModalIcon}>📍</Text>
                  <Text style={[styles.reportModalTitle, { color: '#FCD34D' }]}>Approximate Location</Text>
                </View>

                {/* Principle Guarantee Card */}
                <View style={styles.locPrincipleCard}>
                  <View style={styles.locNeverRow}>
                    <Text style={styles.locNeverCross}>✕ Never show:</Text>
                    <Text style={styles.locNeverText}>123 Main Street</Text>
                  </View>
                  <View style={styles.locInsteadRow}>
                    <Text style={styles.locInsteadCheck}>✓ Instead:</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.locInsteadItem}>📍 ~8 km away</Text>
                      <Text style={styles.locOrText}>or:</Text>
                      <Text style={styles.locInsteadItem}>📍 Delhi NCR</Text>
                    </View>
                  </View>
                  <Text style={styles.locConsentNotice}>
                    Only if the user explicitly enables location sharing.
                  </Text>
                </View>

                {/* Explicit Enable Toggle */}
                <TouchableOpacity
                  style={[
                    styles.locToggleBtn,
                    locationSharingEnabled ? styles.locToggleBtnActive : styles.locToggleBtnInactive
                  ]}
                  onPress={() => handleToggleLocation(!locationSharingEnabled)}
                >
                  <Text style={styles.locToggleIcon}>
                    {locationSharingEnabled ? '🟢' : '⚪'}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.locToggleTitle}>
                      {locationSharingEnabled ? 'Location Sharing: ENABLED' : 'Location Sharing: DISABLED'}
                    </Text>
                    <Text style={styles.locToggleSub}>
                      {locationSharingEnabled
                        ? `Displaying ${formatApproximateDistance(fuzzedDistanceKm)} • ${userCoarseRegion}`
                        : 'Your approximate location is hidden from all matches.'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Coarse Region Selector (when enabled) */}
                {locationSharingEnabled && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.reportReasonLabel}>SELECT COARSE REGION (NEVER STREET ADDRESSES):</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginVertical: 6 }}>
                      {[
                        'Delhi NCR',
                        'South Mumbai',
                        'Bengaluru Central',
                        'Hyderabad Metro',
                        'Pune West',
                        'Greater London',
                        'NYC Metro',
                        'SF Bay Area'
                      ].map((reg, idx) => {
                        const isSel = userCoarseRegion === reg;
                        return (
                          <TouchableOpacity
                            key={idx}
                            style={[styles.locRegionChip, isSel && styles.locRegionChipSel]}
                            onPress={() => handleToggleLocation(true, reg)}
                          >
                            <Text style={[styles.locRegionChipText, isSel && styles.locRegionChipTextSel]}>
                              📍 {reg}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    {/* Fuzzed Distance Bucket Buttons */}
                    <Text style={[styles.reportReasonLabel, { marginTop: 6 }]}>FUZZED DISTANCE BUCKET:</Text>
                    <View style={styles.fuzzedDistanceRow}>
                      {[3, 5, 8, 12, 15].map((km) => (
                        <TouchableOpacity
                          key={km}
                          style={[styles.fuzzedDistChip, fuzzedDistanceKm === km && styles.fuzzedDistChipSel]}
                          onPress={() => {
                            setFuzzedDistanceKm(km);
                            if (currentUser) {
                              toggleLocationSharing(currentUser.user_id, true, userCoarseRegion, km).catch(() => {});
                            }
                          }}
                        >
                          <Text style={[styles.fuzzedDistText, fuzzedDistanceKm === km && styles.fuzzedDistTextSel]}>
                            ~{km} km away
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.reportModalBtnRow}>
                  <TouchableOpacity
                    style={[styles.reportConfirmBtn, { backgroundColor: '#D97706' }]}
                    onPress={() => setLocationModalVisible(false)}
                  >
                    <Text style={styles.reportConfirmBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  container: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '92%',
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 28
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  badgeIcon: {
    fontSize: 22,
    marginRight: 8
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 1
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
  contentScroll: {
    marginTop: 14
  },
  heroBox: {
    backgroundColor: '#090D16',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16
  },
  heroTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F43F5E',
    letterSpacing: 1,
    marginBottom: 4
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6
  },
  heroDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 10
  },
  modeCardsContainer: {
    marginBottom: 14
  },
  modeCard: {
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8
  },
  modeCardSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    borderColor: '#818CF8'
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  modeCodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8
  },
  modeCodeBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 0.5
  },
  modeIcon: {
    fontSize: 18,
    marginRight: 8
  },
  modeBadgeTag: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10
  },
  modeBadgeTagText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8'
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#E2E8F0',
    marginBottom: 2
  },
  modeTagline: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16
  },
  modeSummaryBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)'
  },
  modeSummaryText: {
    fontSize: 11,
    color: '#C7D2FE',
    fontWeight: '600',
    lineHeight: 16
  },
  vibeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16
  },
  vibeCard: {
    width: '48%',
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    marginRight: '2%',
    alignItems: 'center'
  },
  vibeCardSelected: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)'
  },
  vibeIcon: {
    fontSize: 22,
    marginBottom: 6
  },
  vibeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center'
  },
  vibeLabelSelected: {
    color: '#F8FAFC',
    fontWeight: '700'
  },
  flowExplainer: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 16
  },
  flowStep: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700'
  },
  primaryActionBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  },
  instantMatchBtn: {
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#818CF8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 14
  },
  instantMatchBtnText: {
    color: '#A5B4FC',
    fontSize: 12,
    fontWeight: '700'
  },

  // Searching Stage
  centerBox: {
    alignItems: 'center',
    paddingVertical: 40
  },
  radarPulse: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 2,
    borderColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  radarIcon: {
    fontSize: 36
  },
  searchingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4
  },
  searchingVibe: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '600'
  },
  searchingSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: 20
  },
  cancelSearchBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16
  },
  cancelSearchText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700'
  },

  // Chamber Stage
  chamberContainer: {
    marginTop: 14
  },
  chamberBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#090D16',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16
  },
  chamberUser: {
    alignItems: 'center',
    width: 80
  },
  ghostIcon: {
    fontSize: 22,
    marginBottom: 2
  },
  ghostName: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '700'
  },
  chemistryContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16
  },
  chemistryTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F43F5E',
    marginBottom: 4
  },
  chemTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    overflow: 'hidden'
  },
  chemFill: {
    height: '100%',
    backgroundColor: '#F43F5E',
    borderRadius: 4
  },
  speedBlitzBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  speedBlitzIcon: {
    fontSize: 16,
    marginRight: 6
  },
  speedBlitzText: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  mysteryCard: {
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#3730A3',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#4338CA',
    shadowOpacity: 0.25,
    shadowRadius: 12
  },
  mysteryTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  mysteryTagPill: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: '#818CF8',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  mysteryTagText: {
    color: '#C7D2FE',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  compatPill: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  compatPillText: {
    color: '#FDA4AF',
    fontSize: 10,
    fontWeight: '700'
  },
  mysteryProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14
  },
  mysteryAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1E1B4B',
    borderWidth: 1.5,
    borderColor: '#6366F1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  mysteryAvatarIcon: {
    fontSize: 22
  },
  mysteryNameCol: {
    flex: 1
  },
  mysteryUnknownText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.4
  },
  mysteryAgeText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2
  },
  mysteryInterestsSection: {
    marginBottom: 14
  },
  mysteryInterestsLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6
  },
  mysteryInterestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  mysteryInterestBadge: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 6
  },
  mysteryInterestBadgeText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600'
  },
  mysteryGuaranteesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)'
  },
  mysteryGuaranteeItem: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4
  },
  mysteryGuaranteeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700'
  },
  activityBox: {
    backgroundColor: '#090D16',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  activityHeader: {
    alignItems: 'center',
    marginBottom: 16
  },
  activityStepLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 1,
    marginBottom: 4
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6
  },
  activityQuestion: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18
  },
  optionsGrid: {
    marginTop: 8
  },
  optCard: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  optCardChosen: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)'
  },
  optCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0'
  },
  optCardTextChosen: {
    color: '#FFFFFF',
    fontWeight: '700'
  },
  checkMark: {
    color: '#38BDF8',
    fontWeight: '800',
    fontSize: 16
  },
  promptArea: {
    marginTop: 8
  },
  promptInput: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    color: '#F8FAFC',
    fontSize: 13,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12
  },
  submitPromptBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center'
  },
  submitPromptBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700'
  },
  waitingNotice: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    alignItems: 'center'
  },
  waitingNoticeText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600'
  },
  btnDisabled: {
    opacity: 0.5
  },

  // Decision Stage
  decisionContainer: {
    paddingVertical: 14
  },
  puzzleResultCard: {
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
    shadowColor: '#4F46E5',
    shadowOpacity: 0.3,
    shadowRadius: 14
  },
  puzzleResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)'
  },
  puzzleBadgeIcon: {
    fontSize: 26,
    marginRight: 10
  },
  puzzleResultBadge: {
    fontSize: 12,
    fontWeight: '900',
    color: '#818CF8',
    letterSpacing: 1
  },
  puzzleResultSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2
  },
  commonChoicesSection: {
    marginBottom: 14
  },
  commonChoicesLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#34D399',
    marginBottom: 8
  },
  commonChoicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  commonChoiceChip: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#059669',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8
  },
  commonChoiceChipText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '700'
  },
  unlockedTopicsSection: {
    marginTop: 4
  },
  unlockedTopicsLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F43F5E',
    marginBottom: 8
  },
  unlockedTopicCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center'
  },
  unlockedTopicQuote: {
    fontSize: 20,
    color: '#FB7185',
    marginRight: 8,
    fontWeight: '900'
  },
  unlockedTopicText: {
    color: '#FFE4E6',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18
  },
  outcomeTopicBox: {
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#818CF8',
    borderRadius: 10,
    padding: 12,
    width: '100%',
    marginBottom: 14,
    alignItems: 'center'
  },
  outcomeTopicTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A5B4FC',
    letterSpacing: 1,
    marginBottom: 4
  },
  outcomeTopicText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
    fontStyle: 'italic'
  },
  decisionHero: {
    alignItems: 'center',
    marginBottom: 24
  },
  decisionBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#34D399',
    letterSpacing: 1,
    marginBottom: 6
  },
  decisionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8
  },
  decisionDesc: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20
  },
  chemHighlight: {
    color: '#F43F5E',
    fontWeight: '800'
  },
  decisionChoicesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  decisionChoiceBtn: {
    width: '48%',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1
  },
  revealBtn: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: '#F43F5E'
  },
  fadeBtn: {
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderColor: '#475569'
  },
  choiceIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 6
  },
  choiceSub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16
  },
  waitingDecisionBox: {
    backgroundColor: '#090D16',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center'
  },
  waitingDecisionText: {
    color: '#F8FAFC',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20
  },

  // Outcome Stage
  outcomeContainer: {
    paddingVertical: 24,
    alignItems: 'center'
  },
  mutualRevealCard: {
    backgroundColor: '#090D16',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#EC4899',
    alignItems: 'center',
    width: '100%'
  },
  outcomeIcon: {
    fontSize: 40,
    marginBottom: 8
  },
  outcomeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F472B6',
    marginBottom: 8
  },
  outcomeSub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16
  },
  matchPersonaBox: {
    backgroundColor: '#1E1B4B',
    borderRadius: 10,
    padding: 14,
    width: '100%',
    alignItems: 'center',
    marginBottom: 18
  },
  matchPersonaTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A5B4FC',
    letterSpacing: 1,
    marginBottom: 4
  },
  matchPersonaName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 2
  },
  matchPersonaInterests: {
    fontSize: 12,
    color: '#38BDF8'
  },
  continueToChatBtn: {
    backgroundColor: '#EC4899',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%'
  },
  continueToChatBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800'
  },
  fadeCard: {
    alignItems: 'center',
    padding: 20
  },
  fadeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 8
  },
  fadeSub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 360,
    marginBottom: 20
  },
  returnLobbyBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20
  },
  returnLobbyBtnText: {
    color: '#F8FAFC',
    fontWeight: '700',
    fontSize: 13
  },

  // 6. ⏳ Blind Date Duration Selector Styles
  durationSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  durationCard: {
    width: '48%',
    backgroundColor: '#090D16',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#1E293B'
  },
  durationCardSelected: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.08)'
  },
  durationCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  durationIcon: {
    fontSize: 22
  },
  durationBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  durationBadgeSelected: {
    backgroundColor: '#38BDF8'
  },
  durationBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8'
  },
  durationTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#E2E8F0',
    marginBottom: 4
  },
  durationSub: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 14
  },

  // Chamber Layout & Signature Date Timer
  chamberWrapper: {
    flex: 1
  },
  timerHeaderCard: {
    backgroundColor: '#090D16',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#818CF8',
    padding: 14,
    marginBottom: 14,
    shadowColor: '#818CF8',
    shadowOpacity: 0.25,
    shadowRadius: 10
  },
  timerHeaderWarning: {
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B'
  },
  timerHeaderUrgent: {
    borderColor: '#F43F5E',
    shadowColor: '#F43F5E'
  },
  timerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  timerDisplayGroup: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  timerIconPulse: {
    fontSize: 28,
    marginRight: 10
  },
  timerLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2
  },
  timerSmallLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 1,
    marginRight: 6
  },
  timerStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4
  },
  timerStatusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  timerClockText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 1,
    fontVariant: ['tabular-nums']
  },
  timerClockWarning: {
    color: '#FCD34D'
  },
  timerClockUrgent: {
    color: '#FB7185'
  },
  timerActionControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  timerFastForwardBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  timerFastForwardText: {
    fontSize: 11,
    color: '#E2E8F0',
    fontWeight: '700'
  },
  timerDecideEarlyBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  timerDecideEarlyText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '800'
  },
  timerProgressTrack: {
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8
  },
  timerProgressFill: {
    height: '100%',
    borderRadius: 3
  },
  timerBottomMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  timerSubHint: {
    fontSize: 11,
    color: '#94A3B8',
    flex: 1,
    marginRight: 8
  },
  timerPercentLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700'
  },

  // Chamber Tabs
  chamberTabBar: {
    flexDirection: 'row',
    backgroundColor: '#090D16',
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  chamberTabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8
  },
  chamberTabBtnActive: {
    backgroundColor: '#1E293B'
  },
  chamberTabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B'
  },
  chamberTabBtnTextActive: {
    color: '#F8FAFC',
    fontWeight: '800'
  },

  // Live Date Chat
  dateChatContainer: {
    backgroundColor: '#090D16',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 12,
    minHeight: 280,
    maxHeight: 360,
    display: 'flex',
    flexDirection: 'column'
  },
  dateChatScroll: {
    flex: 1,
    marginBottom: 10
  },
  dateChatPillNotice: {
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)'
  },
  dateChatNoticeText: {
    fontSize: 10,
    color: '#7DD3FC',
    fontWeight: '600'
  },
  chatBubbleRow: {
    flexDirection: 'row',
    marginBottom: 10
  },
  chatBubbleRowMe: {
    justifyContent: 'flex-end'
  },
  chatBubbleRowPeer: {
    justifyContent: 'flex-start'
  },
  chatBubble: {
    maxWidth: '82%',
    borderRadius: 12,
    padding: 10
  },
  chatBubbleMe: {
    backgroundColor: '#4F46E5',
    borderBottomRightRadius: 2
  },
  chatBubblePeer: {
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#334155'
  },
  chatSenderTag: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 2
  },
  chatMessageText: {
    fontSize: 13,
    color: '#F8FAFC',
    lineHeight: 18
  },
  icebreakerChipRow: {
    marginBottom: 8,
    paddingTop: 4
  },
  icebreakerChip: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  icebreakerChipText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600'
  },
  dateChatInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#1E293B'
  },
  dateChatInputField: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#F8FAFC',
    fontSize: 13
  },
  dateChatSendBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    alignItems: 'center'
  },
  dateChatSendBtnDisabled: {
    opacity: 0.4
  },
  dateChatSendBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12
  },

  // Date Concluded & 4 Choices
  dateConcludedBanner: {
    backgroundColor: '#1E1B4B',
    borderWidth: 1,
    borderColor: '#818CF8',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16
  },
  dateConcludedIcon: {
    fontSize: 26,
    marginRight: 12
  },
  dateConcludedTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#A5B4FC',
    letterSpacing: 1
  },
  dateConcludedSub: {
    fontSize: 11,
    color: '#C7D2FE',
    marginTop: 2
  },
  fourChoicesGrid: {
    gap: 12
  },
  fourChoiceCard: {
    backgroundColor: '#090D16',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8
  },
  choiceCardContinue: {
    borderColor: '#F43F5E',
    backgroundColor: 'rgba(244, 63, 94, 0.06)'
  },
  choiceCardFriends: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.06)'
  },
  choiceCardEnd: {
    borderColor: '#64748B',
    backgroundColor: 'rgba(100, 116, 139, 0.06)'
  },
  choiceCardReport: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.06)'
  },
  fourChoiceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  fourChoiceIcon: {
    fontSize: 24
  },
  fourChoiceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  fourChoiceBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  fourChoiceTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4
  },
  fourChoiceDesc: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16
  },

  // Report & Block Modal Styles
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  reportModalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EF4444',
    padding: 20
  },
  reportModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8
  },
  reportModalIcon: {
    fontSize: 24,
    marginRight: 8
  },
  reportModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F87171'
  },
  reportModalSub: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
    marginBottom: 16
  },
  reportReasonLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 8
  },
  reportReasonOption: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent'
  },
  reportReasonOptionSel: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)'
  },
  reportReasonText: {
    fontSize: 12,
    color: '#94A3B8'
  },
  reportReasonTextSel: {
    color: '#F8FAFC',
    fontWeight: '700'
  },
  reportModalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16
  },
  reportCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1E293B'
  },
  reportCancelBtnText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 13
  },
  reportConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#EF4444'
  },
  reportConfirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13
  },
  reportCustomInput: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
    color: '#F8FAFC',
    fontSize: 12,
    marginTop: 6
  },

  // 6. 🛡️ Safety Layer Header and Action Bar Styles
  safetyShieldHeaderBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6
  },
  safetyShieldHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8'
  },
  timerInstantBlockBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginLeft: 6
  },
  timerInstantBlockText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F87171'
  },

  // 6. 🛡️ Contact Protection Banner Styles
  contactProtectionBanner: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10
  },
  contactProtectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  contactProtectionIcon: {
    fontSize: 14,
    marginRight: 6
  },
  contactProtectionTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.5
  },
  contactProtectionBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 'auto'
  },
  contactProtectionBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#7DD3FC'
  },
  contactProtectionNoticeText: {
    fontSize: 10,
    color: '#94A3B8',
    lineHeight: 14
  },

  // 6. 📸 Screenshot Banner Alert Styles
  screenshotBannerCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: '#F87171',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10
  },
  screenshotBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4
  },
  screenshotBannerIcon: {
    fontSize: 15,
    marginRight: 6
  },
  screenshotBannerTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FCA5A5'
  },
  screenshotBannerText: {
    fontSize: 11,
    color: '#FEE2E2',
    lineHeight: 15,
    marginBottom: 4
  },
  screenshotBannerSub: {
    fontSize: 9.5,
    color: '#FCA5A5',
    fontStyle: 'italic'
  },
  shieldedContactTag: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    alignSelf: 'flex-start'
  },
  shieldedContactTagText: {
    fontSize: 9.5,
    color: '#FCA5A5',
    fontWeight: '700'
  },

  // Safety Policy Section in Modal
  safetyPolicySection: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155'
  },
  safetyPolicyHeading: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4
  },
  safetyPolicyText: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16
  },

  /* 7. 👻 Progressive Identity Reveal Styles in Blind Date Chamber */
  progRevealHeader: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 12
  },
  progRevealTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10
  },
  progGhostIcon: {
    fontSize: 22
  },
  progHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8
  },
  progStageBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  progStageBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0F172A'
  },
  progMilestoneHint: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600',
    marginTop: 2
  },
  progTimelineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#1E293B'
  },
  progTimelineStep: {
    alignItems: 'center',
    flex: 1
  },
  progStepCircle: {
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
  progStepCircleDone: {
    borderColor: '#10B981',
    borderWidth: 2,
    backgroundColor: '#064E3B'
  },
  progStepCircleCur: {
    borderColor: '#38BDF8',
    borderWidth: 2,
    backgroundColor: '#0369A1'
  },
  progStepIcon: {
    fontSize: 12
  },
  progStepLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center'
  },
  progStepLabelDone: {
    color: '#F8FAFC'
  },
  progStepSub: {
    fontSize: 8,
    color: '#475569'
  },
  progPhotoContainer: {
    position: 'relative'
  },
  progRealPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#10B981'
  },
  progVerifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#10B981',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center'
  },
  progUnlockedInterestBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  progInterestChipActive: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderColor: '#38BDF8',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4
  },
  progSparkleIcon: {
    fontSize: 12
  },
  progInterestChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38BDF8'
  },
  prog5mPill: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3
  },
  prog5mPillText: {
    fontSize: 8,
    color: '#FFF',
    fontWeight: '800'
  },
  progLockedInterestBox: {
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    padding: 8,
    borderRadius: 6
  },
  progLockedInterestText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic'
  },

  /* Consent Box in Blind Date */
  bdConsentCard: {
    backgroundColor: '#090D16',
    borderWidth: 2,
    borderColor: '#38BDF8',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    alignItems: 'center',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6
  },
  bdConsentTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center'
  },
  bdLockRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 2,
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10
  },
  bdBigLock: {
    fontSize: 26
  },
  bdConsentQuestion: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 4
  },
  bdConsentSub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 10
  },
  bdConsentBtnsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center'
  },
  bdRevealBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 8
  },
  bdRevealBtnText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 13
  },
  bdKeepAnonBtn: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#475569'
  },
  bdKeepAnonBtnText: {
    color: '#F1F5F9',
    fontWeight: '700',
    fontSize: 13
  },

  progActionsContainer: {
    marginVertical: 12,
    gap: 8
  },
  progInterestBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#EC4899',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center'
  },
  progInterestBtnActive: {
    backgroundColor: '#831843',
    borderColor: '#F472B6'
  },
  progInterestBtnText: {
    color: '#F472B6',
    fontWeight: '700',
    fontSize: 12
  },
  progRequestPhotoBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center'
  },
  progRequestPhotoBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12
  },

  progTestBar: {
    backgroundColor: '#1E1B4B',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#4338CA',
    marginTop: 6
  },
  progTestBarTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C4B5FD',
    marginBottom: 6
  },
  progTestGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  progTestBtn: {
    backgroundColor: '#3730A3',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6
  },
  progTestBtnText: {
    color: '#EDE9FE',
    fontSize: 10,
    fontWeight: '700'
  },

  // 15. 🚪 Exit Anytime Styles
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  moreMenuBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155'
  },
  moreMenuBtnText: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 22
  },
  dropdownMenu: {
    position: 'absolute',
    top: 36,
    right: 0,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 12,
    padding: 6,
    zIndex: 100,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  dropdownItemText: {
    color: '#F43F5E',
    fontSize: 13,
    fontWeight: '700'
  },
  timerLeaveBtn: {
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#64748B',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 6
  },
  timerLeaveText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700'
  },
  exitModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 15, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  exitModalCard: {
    backgroundColor: '#0F172A',
    borderWidth: 1.5,
    borderColor: '#F43F5E',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12
  },
  exitModalIcon: {
    color: '#94A3B8',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4
  },
  exitModalHeader: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800'
  },
  exitModalSub: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '900',
    marginVertical: 4
  },
  exitModalPrompt: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 16
  },
  leaveSafelyBtn: {
    backgroundColor: '#E11D48',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  leaveSafelyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  noExplanationNotice: {
    color: '#94A3B8',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 14
  },
  cancelExitBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#1E293B'
  },
  cancelExitBtnText: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600'
  },

  // 17. 📍 Approximate Location Styles
  locationHeaderBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: '#D97706',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginRight: 6
  },
  locationHeaderBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10B981'
  },
  locationHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FCD34D'
  },
  locationHeaderTextActive: {
    color: '#6EE7B7'
  },
  mysteryLocationBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    alignSelf: 'flex-start'
  },
  mysteryLocationText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FCD34D'
  },
  mysteryLocationHiddenBadge: {
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 4,
    alignSelf: 'flex-start'
  },
  mysteryLocationHiddenText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94A3B8'
  },

  // Location Principle Card (Never 123 Main Street; Instead: 📍 ~8 km away or 📍 Delhi NCR)
  locPrincipleCard: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12
  },
  locNeverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  locNeverCross: {
    fontSize: 12,
    fontWeight: '900',
    color: '#F87171',
    marginRight: 6
  },
  locNeverText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FCA5A5',
    textDecorationLine: 'line-through'
  },
  locInsteadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  locInsteadCheck: {
    fontSize: 12,
    fontWeight: '900',
    color: '#34D399',
    marginRight: 6,
    marginTop: 2
  },
  locInsteadItem: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6EE7B7'
  },
  locOrText: {
    fontSize: 10,
    color: '#94A3B8',
    marginVertical: 1
  },
  locConsentNotice: {
    fontSize: 10,
    color: '#FCD34D',
    fontStyle: 'italic',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingTop: 6,
    marginTop: 2
  },

  // Toggle button
  locToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginBottom: 6
  },
  locToggleBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981'
  },
  locToggleBtnInactive: {
    backgroundColor: '#1E293B',
    borderColor: '#475569'
  },
  locToggleIcon: {
    fontSize: 18,
    marginRight: 10
  },
  locToggleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#F8FAFC'
  },
  locToggleSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2
  },

  // Region Chips
  locRegionChip: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6
  },
  locRegionChipSel: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)'
  },
  locRegionChipText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600'
  },
  locRegionChipTextSel: {
    color: '#FCD34D',
    fontWeight: '800'
  },

  // Distance row
  fuzzedDistanceRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4
  },
  fuzzedDistChip: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center'
  },
  fuzzedDistChipSel: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.15)'
  },
  fuzzedDistText: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600'
  },
  fuzzedDistTextSel: {
    color: '#6EE7B7',
    fontWeight: '800'
  }
});

