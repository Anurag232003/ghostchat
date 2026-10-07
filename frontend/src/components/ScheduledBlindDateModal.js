import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Platform,
} from 'react-native';
import {
  fetchScheduledDateSlots,
  fetchScheduledDateStatus,
  bookScheduledDate,
  enterScheduledDate,
  cancelScheduledDate,
  setTestScheduledCountdown,
} from '../services/api';

export default function ScheduledBlindDateModal({ visible, onClose, userId, onEnterEventChamber }) {
  const [loading, setLoading] = useState(false);
  const [slots, setSlots] = useState([]);
  const [eventData, setEventData] = useState(null);
  const [selectedDay, setSelectedDay] = useState('Tonight');
  const [selectedTime, setSelectedTime] = useState('9:00 PM');
  const [countdownSeconds, setCountdownSeconds] = useState(261); // 00:04:21
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Pulsing animation for countdown urgency
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    if (visible && userId) {
      loadInitialData();
    }
  }, [visible, userId]);

  // Live timer interval
  useEffect(() => {
    let timer;
    if (visible && eventData && countdownSeconds > 0) {
      timer = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            loadStatus();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [visible, eventData, countdownSeconds]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [slotsRes, statusRes] = await Promise.all([
        fetchScheduledDateSlots(),
        fetchScheduledDateStatus(userId),
      ]);
      setSlots(slotsRes);
      if (statusRes.has_scheduled_event && statusRes.event) {
        setEventData(statusRes.event);
        setCountdownSeconds(statusRes.event.countdown_seconds);
      } else {
        setEventData(null);
      }
    } catch (e) {
      console.warn('Failed to load scheduled date info:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async () => {
    try {
      const statusRes = await fetchScheduledDateStatus(userId);
      if (statusRes.has_scheduled_event && statusRes.event) {
        setEventData(statusRes.event);
        setCountdownSeconds(statusRes.event.countdown_seconds);
      } else {
        setEventData(null);
      }
    } catch (e) {
      console.warn('Failed to refresh status:', e);
    }
  };

  const handleBookSlot = async () => {
    try {
      setLoading(true);
      // Canonical 261s = 00:04:21
      const res = await bookScheduledDate(userId, selectedDay, selectedTime, 261);
      setEventData(res.event);
      setCountdownSeconds(261);
      setFeedbackMessage(`✨ Matched with ${res.matched_with}! Countdown active.`);
    } catch (e) {
      setFeedbackMessage(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFastForwardDemo = async () => {
    if (!eventData?.booking_id) return;
    try {
      setLoading(true);
      await setTestScheduledCountdown(eventData.booking_id, 5); // 5 seconds
      setCountdownSeconds(5);
      setFeedbackMessage('⚡ Countdown set to 5 seconds for demonstration!');
    } catch (e) {
      setFeedbackMessage(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEnterEvent = async () => {
    if (!eventData?.booking_id) return;
    try {
      setLoading(true);
      const res = await enterScheduledDate(userId, eventData.booking_id);
      setFeedbackMessage('🎉 Entering your scheduled blind date chamber...');
      if (onEnterEventChamber) {
        setTimeout(() => {
          onEnterEventChamber(res.peer_id, res.peer_pseudonym, res.room_id);
          onClose();
        }, 600);
      }
    } catch (e) {
      setFeedbackMessage(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!eventData?.booking_id) return;
    try {
      setLoading(true);
      await cancelScheduledDate(userId, eventData.booking_id);
      setEventData(null);
      setFeedbackMessage('Booking cancelled. You can pick another time.');
    } catch (e) {
      setFeedbackMessage(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatClock = (totalSecs) => {
    const secs = Math.max(0, totalSecs);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const isLive = countdownSeconds <= 0 || eventData?.status === 'live';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerBadge}>🕰️ SCHEDULED BLIND DATE</Text>
              <Text style={styles.headerSubtitle}>
                Creates an actual event rather than an ordinary chat
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {loading && !eventData ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text style={styles.loadingText}>Loading scheduled date appointments...</Text>
              </View>
            ) : (
              <>
                {/* Feedback Banner */}
                {feedbackMessage ? (
                  <View style={styles.feedbackBanner}>
                    <Text style={styles.feedbackText}>{feedbackMessage}</Text>
                  </View>
                ) : null}

                {/* If User has a live booking / active countdown */}
                {eventData ? (
                  <View style={styles.countdownTheaterCard}>
                    <Text style={styles.theaterHeadline}>Your date begins in:</Text>

                    {/* Massive Clock: e.g. 00:04:21 */}
                    <Animated.View
                      style={[
                        styles.clockContainer,
                        { transform: [{ scale: isLive ? 1 : pulseAnim }] },
                      ]}
                    >
                      <Text style={[styles.clockDigits, isLive && styles.clockDigitsLive]}>
                        {formatClock(countdownSeconds)}
                      </Text>
                    </Animated.View>

                    <Text style={styles.clockSub}>
                      {isLive ? '🟢 THE EVENT IS LIVE NOW!' : 'Shared synchronization with your peer'}
                    </Text>

                    {/* Matched Peer Event Card */}
                    <View style={styles.peerMatchCard}>
                      <View style={styles.peerRow}>
                        <View style={styles.peerAvatar}>
                          <Text style={styles.peerAvatarText}>{eventData.peer_avatar || '🌙'}</Text>
                        </View>
                        <View style={styles.peerMeta}>
                          <Text style={styles.peerName}>{eventData.peer_pseudonym}</Text>
                          <Text style={styles.peerVibe}>{eventData.peer_vibe}</Text>
                          <Text style={styles.peerAppointment}>
                            📅 {eventData.scheduled_day} at {eventData.scheduled_time}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.peerNoteBox}>
                        <Text style={styles.peerNoteText}>
                          ✨ The system finds another user who is also available.
                        </Text>
                      </View>
                    </View>

                    {/* Action buttons */}
                    <View style={styles.actionButtonGroup}>
                      {isLive ? (
                        <TouchableOpacity
                          style={styles.enterEventBtn}
                          onPress={handleEnterEvent}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.enterEventBtnText}>❤️ ENTER EVENT CHAMBER</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.enterEventBtn}
                          onPress={handleEnterEvent}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.enterEventBtnText}>🚪 Enter Waiting Lobby</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={handleCancelBooking}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.cancelBtnText}>❌ Cancel This Booking</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* Slot Booking Stage */
                  <View style={styles.bookingBox}>
                    <Text style={styles.boxTitle}>📅 Select Your Date Slot</Text>
                    <Text style={styles.boxDesc}>
                      Pick a time when you will be relaxed and present. The system automatically pairs you with an available anonymous peer.
                    </Text>

                    {/* Day Selector */}
                    <View style={styles.daySelectorRow}>
                      {['Tonight', 'Tomorrow'].map((day) => (
                        <TouchableOpacity
                          key={day}
                          style={[
                            styles.dayTab,
                            selectedDay === day && styles.dayTabActive,
                          ]}
                          onPress={() => setSelectedDay(day)}
                        >
                          <Text
                            style={[
                              styles.dayTabText,
                              selectedDay === day && styles.dayTabTextActive,
                            ]}
                          >
                            {day === 'Tonight' ? '🌙 Tonight' : '☀️ Tomorrow'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Time Slots Chips */}
                    <View style={styles.slotsGrid}>
                      {['8:00 PM', '9:00 PM', '10:00 PM', '11:00 PM'].map((t) => {
                        const isSelected = selectedTime === t;
                        const isRecommended = t === '9:00 PM';
                        return (
                          <TouchableOpacity
                            key={t}
                            style={[
                              styles.slotChip,
                              isSelected && styles.slotChipActive,
                            ]}
                            onPress={() => setSelectedTime(t)}
                          >
                            <Text
                              style={[
                                styles.slotChipText,
                                isSelected && styles.slotChipTextActive,
                              ]}
                            >
                              {t}
                            </Text>
                            {isRecommended && (
                              <View style={styles.recommendedBadge}>
                                <Text style={styles.recommendedBadgeText}>PEAK ⭐</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Peer availability teaser (Real-time count from MongoDB) */}
                    {(() => {
                      const selectedSlot = slots.find(
                        (s) => s.day_label === selectedDay && s.time_label === selectedTime
                      );
                      const peerCount = selectedSlot ? selectedSlot.available_peers_count : 0;
                      return (
                        <View style={styles.availabilityNotice}>
                          <Text style={styles.availabilityNoticeText}>
                            {peerCount > 0
                              ? `🟢 ${peerCount} registered peer${peerCount > 1 ? 's' : ''} available for ${selectedDay} at ${selectedTime}.`
                              : `⏳ 0 other users scheduled yet for ${selectedDay} at ${selectedTime}. Be the first to book this slot!`}
                          </Text>
                        </View>
                      );
                    })()}

                    {/* Book Button */}
                    <TouchableOpacity
                      style={styles.confirmBookBtn}
                      onPress={handleBookSlot}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.confirmBookBtnText}>
                        🕰️ BOOK FOR {selectedDay.toUpperCase()} • {selectedTime}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Purpose Footer Card */}
                <View style={styles.purposeFooter}>
                  <Text style={styles.purposeFooterTitle}>
                    ✨ Why Scheduled Blind Dates?
                  </Text>
                  <Text style={styles.purposeFooterText}>
                    "This creates an actual event rather than an ordinary chat."
                  </Text>
                  <Text style={styles.purposeFooterSub}>
                    Scheduled encounters generate mutual anticipation and presence. Both participants show up simultaneously at the designated hour, knowing the other person made time specifically for this encounter.
                  </Text>
                </View>
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
    maxWidth: 580,
    maxHeight: '92%',
    backgroundColor: '#0b1329',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 50px rgba(56, 189, 248, 0.25)',
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
    fontWeight: '500',
  },
  countdownTheaterCard: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  theaterHeadline: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  clockContainer: {
    backgroundColor: '#030712',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#38bdf8',
    marginBottom: 8,
  },
  clockDigits: {
    color: '#38bdf8',
    fontSize: 42,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 2,
  },
  clockDigitsLive: {
    color: '#10b981',
    borderColor: '#10b981',
  },
  clockSub: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 16,
  },
  peerMatchCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  peerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  peerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  peerAvatarText: {
    fontSize: 24,
  },
  peerMeta: {
    flex: 1,
  },
  peerName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
  },
  peerVibe: {
    color: '#38bdf8',
    fontSize: 11,
    marginTop: 2,
  },
  peerAppointment: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  peerNoteBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  peerNoteText: {
    color: '#94a3b8',
    fontSize: 11,
    fontStyle: 'italic',
  },
  actionButtonGroup: {
    width: '100%',
    gap: 8,
  },
  enterEventBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  enterEventBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  fastForwardBtn: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  fastForwardBtnText: {
    color: '#7dd3fc',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelBtn: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  bookingBox: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
  },
  boxTitle: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  boxDesc: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 14,
  },
  daySelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  dayTab: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  dayTabActive: {
    backgroundColor: '#0284c7',
    borderColor: '#38bdf8',
  },
  dayTabText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 13,
  },
  dayTabTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  slotChip: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotChipActive: {
    borderColor: '#38bdf8',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  slotChipText: {
    color: '#cbd5e1',
    fontWeight: '700',
    fontSize: 13,
  },
  slotChipTextActive: {
    color: '#38bdf8',
  },
  recommendedBadge: {
    backgroundColor: '#f59e0b',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recommendedBadgeText: {
    color: '#0f172a',
    fontSize: 9,
    fontWeight: '900',
  },
  availabilityNotice: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  availabilityNoticeText: {
    color: '#6ee7b7',
    fontSize: 12,
    fontWeight: '600',
  },
  confirmBookBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmBookBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  purposeFooter: {
    backgroundColor: '#0a0f1d',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  purposeFooterTitle: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  purposeFooterText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
    marginBottom: 6,
  },
  purposeFooterSub: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 16,
  },
});
