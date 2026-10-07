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
  Dimensions
} from 'react-native';
import {
  scanUniverseRadar,
  enterUniverseMatching,
  connectUniverseStar
} from '../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function UniverseMatchingModal({
  visible,
  onClose,
  currentUserId,
  onStartInteraction = null
}) {
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [radarData, setRadarData] = useState(null);
  const [selectedStar, setSelectedStar] = useState(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (visible) {
      loadRadar();
    }
  }, [visible]);

  const loadRadar = async () => {
    setLoading(true);
    setSelectedStar(null);
    try {
      const data = await scanUniverseRadar(currentUserId);
      setRadarData(data);
    } catch (err) {
      console.warn('Failed to scan universe radar:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnterUniverse = async () => {
    if (!currentUserId) {
      Alert.alert('Cosmic Signal', 'Please set up your secret handle / nickname on the home screen first.');
      return;
    }
    setScanning(true);
    try {
      const res = await enterUniverseMatching(currentUserId);
      setScanning(false);
      if (res.status === 'no_signals' || !res.peer_user_id) {
        Alert.alert('🌌 Cosmic Radar', res.message || 'No other celestial signals in orbital range right now.');
        return;
      }
      if (onStartInteraction) {
        onStartInteraction(res);
      }
      onClose();
    } catch (err) {
      setScanning(false);
      Alert.alert('Cosmic Signal Error', err.message || 'Could not lock onto celestial frequency');
    }
  };

  const handleConnectStar = async (star) => {
    if (!currentUserId) {
      Alert.alert('Cosmic Signal', 'Please set up your secret handle / nickname on the home screen first.');
      return;
    }
    setConnecting(true);
    try {
      const res = await connectUniverseStar(currentUserId, star.star_id || star.user_id);
      setConnecting(false);
      if (onStartInteraction) {
        onStartInteraction(res);
      }
      onClose();
    } catch (err) {
      setConnecting(false);
      Alert.alert('Connection Failed', err.message || 'Star frequency lost in deep space');
    }
  };

  const stars = radarData?.stars || [];
  const totalSignals = radarData?.total_signals !== undefined ? radarData.total_signals : stars.length;

  const starZenith = stars[0] || null;
  const starWest = stars[1] || null;
  const starCore = stars[2] || null;
  const starEast = stars[3] || null;
  const starSouthWest = stars[4] || null;
  const starSouthEast = stars[5] || null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.topHeader}>
            <View style={styles.topHeaderLeft}>
              <Text style={styles.galaxyLogo}>🌌</Text>
              <View>
                <Text style={styles.topHeaderTitle}>RANDOM UNIVERSE MATCHING</Text>
                <Text style={styles.topHeaderSubtitle}>Deep space anonymous celestial radar</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#38BDF8" />
              <Text style={styles.loadingText}>Calibrating Deep Space Telescope & Radar...</Text>
            </View>
          ) : (
            <ScrollView style={styles.cosmosScroll} showsVerticalScrollIndicator={false}>
              {/* Cosmic Stage Container */}
              <View style={styles.cosmosStage}>
                {/* Orbital concentric rings */}
                <View style={[styles.orbitRing, styles.orbitOuter]} />
                <View style={[styles.orbitRing, styles.orbitMiddle]} />
                <View style={[styles.orbitRing, styles.orbitInner]} />

                {/* Subtle Coordinate Axis Lines */}
                <View style={styles.axisH} />
                <View style={styles.axisV} />

                {/* --- Row 1: Apex Star (✦) --- */}
                <View style={styles.constellationRowCenter}>
                  {starZenith && (
                    <TouchableOpacity
                      style={[
                        styles.starNodeButton,
                        selectedStar?.star_id === starZenith.star_id && styles.starNodeSelected
                      ]}
                      onPress={() => setSelectedStar(starZenith)}
                    >
                      <Text style={[styles.starSymbolBig, styles.starGlowCyan]}>
                        {starZenith.symbol || '✦'}
                      </Text>
                      <Text style={styles.starLabelMini}>{starZenith.pseudonym}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* --- Row 2: Hero Core Title 🌌 DISCOVER --- */}
                <View style={styles.coreDiscoverHeader}>
                  <View style={styles.coreGlowPill}>
                    <Text style={styles.coreDiscoverText}>🌌 DISCOVER</Text>
                  </View>
                </View>

                {/* --- Row 3: Middle Constellation Row (✦     ○     ✦) --- */}
                <View style={styles.constellationRowMiddle}>
                  {starWest && (
                    <TouchableOpacity
                      style={[
                        styles.starNodeButton,
                        selectedStar?.star_id === starWest.star_id && styles.starNodeSelected
                      ]}
                      onPress={() => setSelectedStar(starWest)}
                    >
                      <Text style={[styles.starSymbolBig, styles.starGlowBlue]}>
                        {starWest.symbol || '✦'}
                      </Text>
                      <Text style={styles.starLabelMini}>{starWest.pseudonym}</Text>
                    </TouchableOpacity>
                  )}

                  {starCore && (
                    <TouchableOpacity
                      style={[
                        styles.starNodeButton,
                        selectedStar?.star_id === starCore.star_id && styles.starNodeSelected
                      ]}
                      onPress={() => setSelectedStar(starCore)}
                    >
                      <Text style={[styles.starSymbolCircle, styles.starGlowWhite]}>
                        {starCore.symbol || '○'}
                      </Text>
                      <Text style={styles.starLabelMini}>{starCore.pseudonym}</Text>
                    </TouchableOpacity>
                  )}

                  {starEast && (
                    <TouchableOpacity
                      style={[
                        styles.starNodeButton,
                        selectedStar?.star_id === starEast.star_id && styles.starNodeSelected
                      ]}
                      onPress={() => setSelectedStar(starEast)}
                    >
                      <Text style={[styles.starSymbolBig, styles.starGlowPurple]}>
                        {starEast.symbol || '✦'}
                      </Text>
                      <Text style={styles.starLabelMini}>{starEast.pseudonym}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* --- Row 4: Lower Constellation Row (○       ○) --- */}
                <View style={styles.constellationRowBottom}>
                  {starSouthWest && (
                    <TouchableOpacity
                      style={[
                        styles.starNodeButton,
                        selectedStar?.star_id === starSouthWest.star_id && styles.starNodeSelected
                      ]}
                      onPress={() => setSelectedStar(starSouthWest)}
                    >
                      <Text style={[styles.starSymbolCircle, styles.starGlowAmber]}>
                        {starSouthWest.symbol || '○'}
                      </Text>
                      <Text style={styles.starLabelMini}>{starSouthWest.pseudonym}</Text>
                    </TouchableOpacity>
                  )}

                  {starSouthEast && (
                    <TouchableOpacity
                      style={[
                        styles.starNodeButton,
                        selectedStar?.star_id === starSouthEast.star_id && styles.starNodeSelected
                      ]}
                      onPress={() => setSelectedStar(starSouthEast)}
                    >
                      <Text style={[styles.starSymbolCircle, styles.starGlowRose]}>
                        {starSouthEast.symbol || '○'}
                      </Text>
                      <Text style={styles.starLabelMini}>{starSouthEast.pseudonym}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Empty radar info when 0 active peers */}
                {stars.length === 0 && (
                  <View style={styles.emptyCosmosNotice}>
                    <Text style={styles.emptyCosmosNoticeIcon}>📡</Text>
                    <Text style={styles.emptyCosmosNoticeTitle}>RADAR SWEEPING DEEP SPACE</Text>
                    <Text style={styles.emptyCosmosNoticeText}>
                      No other anonymous wanderers are currently in celestial range.
                    </Text>
                    <Text style={styles.emptyCosmosNoticeSub}>
                      As real users join or register, their glowing stars will illuminate this radar map.
                    </Text>
                  </View>
                )}

                {/* Instruction Callout: Tap a star -> start mystery interaction */}
                <Text style={styles.instructionFootnote}>
                  {stars.length > 0
                    ? 'Each anonymous user appears as a "star." Tap a star → start a mystery interaction.'
                    : 'Tap [ ENTER ] to scan deep space or connect when signals appear.'}
                </Text>

                {/* Mystery signals detected indicator */}
                <View style={styles.signalsBadgeContainer}>
                  <View style={styles.pulseGreenDot} />
                  <Text style={styles.signalsDetectedText}>
                    {totalSignals} Mystery signals detected
                  </Text>
                </View>

                {/* Hero [ENTER] Action Button */}
                <TouchableOpacity
                  style={[styles.enterUniverseBtn, scanning && styles.enterUniverseBtnScanning]}
                  onPress={handleEnterUniverse}
                  disabled={scanning}
                >
                  {scanning ? (
                    <View style={styles.scanningRow}>
                      <ActivityIndicator color="#030712" />
                      <Text style={styles.enterUniverseBtnText}>  SWEEPING COSMOS...</Text>
                    </View>
                  ) : (
                    <Text style={styles.enterUniverseBtnText}>[ ENTER ]</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Selected Star Details Card */}
              {selectedStar && (
                <View style={styles.starDetailCard}>
                  <View style={styles.starDetailHeader}>
                    <View style={styles.starDetailBadge}>
                      <Text style={styles.starDetailBadgeSymbol}>{selectedStar.symbol || '✦'}</Text>
                      <Text style={styles.starDetailBadgeName}>{selectedStar.pseudonym}</Text>
                    </View>
                    <Text style={styles.constellationTag}>{selectedStar.constellation}</Text>
                  </View>

                  <Text style={styles.spectralText}>
                    📡 {selectedStar.spectral_type} • {selectedStar.frequency_mhz}
                  </Text>
                  <Text style={styles.approxLocText}>{selectedStar.approx_location}</Text>

                  {/* Vibe Signals */}
                  <View style={styles.starVibesGrid}>
                    {(selectedStar.vibe_signals || []).map((vibe, vIdx) => (
                      <View key={vIdx} style={styles.starVibeChip}>
                        <Text style={styles.starVibeChipText}>{vibe}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Meters */}
                  <View style={styles.miniMetersContainer}>
                    <View style={styles.miniMeterRow}>
                      <Text style={styles.miniMeterLabel}>Style:</Text>
                      <Text style={styles.miniMeterBar}>{selectedStar.conversation_style_bar}</Text>
                    </View>
                    <View style={styles.miniMeterRow}>
                      <Text style={styles.miniMeterLabel}>Energy:</Text>
                      <Text style={styles.miniMeterBar}>{selectedStar.energy_bar}</Text>
                    </View>
                  </View>

                  {/* Connect to Star Action */}
                  <TouchableOpacity
                    style={styles.connectStarBtn}
                    onPress={() => handleConnectStar(selectedStar)}
                    disabled={connecting}
                  >
                    {connecting ? (
                      <ActivityIndicator color="#030712" />
                    ) : (
                      <Text style={styles.connectStarBtnText}>💫 Start Mystery Interaction</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '92%',
    backgroundColor: '#030712',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    overflow: 'hidden',
    shadowColor: '#38BDF8',
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 12
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: '#0B0F19',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  galaxyLogo: {
    fontSize: 26,
    marginRight: 10
  },
  topHeaderTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.6
  },
  topHeaderSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2
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
  loadingBox: {
    padding: 50,
    alignItems: 'center',
    justifyContent: 'center'
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 14
  },
  cosmosScroll: {
    padding: 16
  },
  /* Cosmos Interactive Stage */
  cosmosStage: {
    backgroundColor: '#040914',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#0284C7',
    shadowOpacity: 0.3,
    shadowRadius: 20
  },
  /* Concentric Orbit Rings */
  orbitRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.12)'
  },
  orbitOuter: {
    width: 380,
    height: 380,
    top: -40
  },
  orbitMiddle: {
    width: 270,
    height: 270,
    top: 15
  },
  orbitInner: {
    width: 170,
    height: 170,
    top: 65
  },
  axisH: {
    position: 'absolute',
    top: 150,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.08)'
  },
  axisV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1,
    backgroundColor: 'rgba(56, 189, 248, 0.08)'
  },
  /* Star Positions following user prompt */
  constellationRowCenter: {
    alignItems: 'center',
    marginBottom: 8
  },
  coreDiscoverHeader: {
    marginVertical: 12,
    alignItems: 'center'
  },
  coreGlowPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 8,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.6,
    shadowRadius: 15
  },
  coreDiscoverText: {
    color: '#F0F9FF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 2
  },
  constellationRowMiddle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginVertical: 12,
    alignItems: 'center'
  },
  constellationRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 30,
    marginTop: 8,
    marginBottom: 20
  },
  /* Star Node Buttons */
  starNodeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 16
  },
  starNodeSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  starSymbolBig: {
    fontSize: 32,
    lineHeight: 36
  },
  starSymbolCircle: {
    fontSize: 26,
    lineHeight: 32
  },
  starGlowCyan: {
    color: '#38BDF8',
    textShadowColor: '#38BDF8',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12
  },
  starGlowBlue: {
    color: '#60A5FA',
    textShadowColor: '#3B82F6',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12
  },
  starGlowWhite: {
    color: '#F8FAFC',
    textShadowColor: '#E2E8F0',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10
  },
  starGlowPurple: {
    color: '#C084FC',
    textShadowColor: '#A855F7',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12
  },
  starGlowAmber: {
    color: '#FBBF24',
    textShadowColor: '#F59E0B',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12
  },
  starGlowRose: {
    color: '#FB7185',
    textShadowColor: '#F43F5E',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12
  },
  starLabelMini: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2
  },
  /* Footnotes and Buttons */
  instructionFootnote: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
    lineHeight: 16
  },
  signalsBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16
  },
  pulseGreenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
    marginRight: 8
  },
  signalsDetectedText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  enterUniverseBtn: {
    backgroundColor: '#38BDF8',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 36,
    shadowColor: '#38BDF8',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 8,
    width: '80%',
    alignItems: 'center'
  },
  enterUniverseBtnScanning: {
    backgroundColor: '#0284C7'
  },
  enterUniverseBtnText: {
    color: '#030712',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.5
  },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  /* Star Detail Popover Card */
  starDetailCard: {
    marginTop: 16,
    backgroundColor: '#0A1224',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#60A5FA',
    padding: 16,
    shadowColor: '#60A5FA',
    shadowOpacity: 0.3,
    shadowRadius: 15
  },
  starDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  starDetailBadge: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  starDetailBadgeSymbol: {
    fontSize: 20,
    color: '#38BDF8',
    marginRight: 6
  },
  starDetailBadgeName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800'
  },
  constellationTag: {
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700'
  },
  spectralText: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 4
  },
  approxLocText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 10
  },
  starVibesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10
  },
  starVibeChip: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  starVibeChipText: {
    color: '#E0F2FE',
    fontSize: 11,
    fontWeight: '600'
  },
  miniMetersContainer: {
    backgroundColor: '#040813',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14
  },
  miniMeterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2
  },
  miniMeterLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700'
  },
  miniMeterBar: {
    color: '#34D399',
    fontFamily: 'monospace',
    fontSize: 13,
    letterSpacing: 1
  },
  connectStarBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.4,
    shadowRadius: 10
  },
  connectStarBtnText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  emptyCosmosNotice: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
    marginVertical: 14,
    width: '90%'
  },
  emptyCosmosNoticeIcon: {
    fontSize: 32,
    marginBottom: 8
  },
  emptyCosmosNoticeTitle: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
    textAlign: 'center'
  },
  emptyCosmosNoticeText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4
  },
  emptyCosmosNoticeSub: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16
  }
});
