import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert
} from 'react-native';

import { submitBlindPhotoConsent, fetchBlindPhotoStatus } from '../services/api';

export function BlindPhotoCard({
  photoData,
  currentUserId,
  peerName = 'Partner',
  onConsentChanged
}) {
  const [loading, setLoading] = useState(false);
  const [photoState, setPhotoState] = useState(photoData);
  const [fullscreenVisible, setFullscreenVisible] = useState(false);

  useEffect(() => {
    setPhotoState(photoData);
  }, [photoData]);

  const isUnlocked = photoState?.unlocked === true;
  const consents = photoState?.consents || {};
  const myConsent = consents[currentUserId] === true;
  const peerConsent = Object.entries(consents).find(([uid, val]) => uid !== currentUserId && val === true);
  const totalConsents = Object.values(consents).filter(Boolean).length;

  async function handleToggleConsent(agree) {
    if (!photoState?.photo_id) return;
    setLoading(true);
    try {
      const res = await submitBlindPhotoConsent(photoState.photo_id, currentUserId, agree);
      const updated = {
        ...photoState,
        unlocked: res.unlocked,
        locked: res.locked,
        consents: {
          ...photoState.consents,
          [currentUserId]: agree
        },
        full_photo_url: res.full_photo_url || photoState.full_photo_url
      };
      setPhotoState(updated);
      if (onConsentChanged) {
        onConsentChanged(updated);
      }
      if (res.unlocked) {
        Alert.alert('🔓 Photo Unlocked!', 'Both of you agreed to reveal the photo!');
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.cardContainer, isUnlocked ? styles.cardUnlocked : styles.cardLocked]}>
      {/* Header Banner */}
      <View style={styles.cardHeader}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerIcon}>{isUnlocked ? '🔓' : '🔒'}</Text>
          <Text style={[styles.headerTitle, isUnlocked && styles.headerTitleUnlocked]}>
            {isUnlocked ? 'Photo Unlocked' : 'Photo Locked 🔒'}
          </Text>
        </View>
        <View style={[styles.statusPill, isUnlocked ? styles.statusPillUnlocked : styles.statusPillLocked]}>
          <Text style={[styles.statusPillText, isUnlocked ? styles.statusPillTextUnlocked : styles.statusPillTextLocked]}>
            {isUnlocked ? 'Mutual Consent ✓✓' : `${totalConsents}/2 Agreed`}
          </Text>
        </View>
      </View>

      {/* Photo Preview Container */}
      <View style={styles.imageWrapper}>
        {isUnlocked ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setFullscreenVisible(true)}
            style={styles.imageTouchable}
          >
            <Image
              source={{ uri: photoState.full_photo_url || photoState.preview_blur_url }}
              style={styles.fullImage}
              resizeMode="cover"
            />
            <View style={styles.expandOverlay}>
              <Text style={styles.expandText}>🔍 Tap to View Fullscreen</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.blurredContainer}>
            {photoState.preview_blur_url ? (
              <Image
                source={{ uri: photoState.preview_blur_url }}
                style={styles.blurredImage}
                blurRadius={28}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.lockFrostedOverlay}>
              <Text style={styles.largeLockEmoji}>🔒</Text>
              <Text style={styles.frostedTitle}>Confidential Photo</Text>
              <Text style={styles.frostedSubtitle}>
                Encrypted & hidden until both users agree to reveal
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Caption if provided */}
      {photoState.caption ? (
        <Text style={styles.captionText}>{photoState.caption}</Text>
      ) : null}

      {/* Mutual Consent Action Box (When Locked) */}
      {!isUnlocked && (
        <View style={styles.agreementBox}>
          <Text style={styles.agreementTitle}>Both users can mutually agree:</Text>
          <Text style={styles.agreementQuestion}>Reveal photo?</Text>

          {/* Consent Status Details */}
          <View style={styles.consentStateRow}>
            {myConsent ? (
              <Text style={styles.myAgreedText}>✓ You agreed to reveal (awaiting {peerName})</Text>
            ) : peerConsent ? (
              <Text style={styles.peerAgreedText}>🔔 {peerName} wants to reveal this photo!</Text>
            ) : (
              <Text style={styles.awaitingText}>Neither user has revealed yet</Text>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[
                styles.agreeButton,
                myConsent && styles.agreeButtonActive,
                loading && styles.buttonDisabled
              ]}
              onPress={() => handleToggleConsent(true)}
              disabled={loading || myConsent}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.agreeButtonText}>
                  {myConsent ? '✓ Reveal Accepted' : '🔓 Accept Reveal'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.declineButton, loading && styles.buttonDisabled]}
              onPress={() => handleToggleConsent(false)}
              disabled={loading || !myConsent}
            >
              <Text style={styles.declineButtonText}>🔒 Keep Locked</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Unlocked Footer info */}
      {isUnlocked && (
        <View style={styles.unlockedFooter}>
          <Text style={styles.unlockedFooterText}>
            ✨ Mutual consent confirmed. Photo decrypted & safe to view.
          </Text>
        </View>
      )}

      {/* Fullscreen Photo Modal */}
      {isUnlocked && (
        <Modal
          visible={fullscreenVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setFullscreenVisible(false)}
        >
          <View style={styles.fullscreenOverlay}>
            <TouchableOpacity
              style={styles.fullscreenCloseBtn}
              onPress={() => setFullscreenVisible(false)}
            >
              <Text style={styles.fullscreenCloseText}>✕ Close</Text>
            </TouchableOpacity>

            <Image
              source={{ uri: photoState.full_photo_url || photoState.preview_blur_url }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />

            {photoState.caption && (
              <View style={styles.fullscreenCaptionBox}>
                <Text style={styles.fullscreenCaptionText}>{photoState.caption}</Text>
              </View>
            )}
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    borderWidth: 1.5,
    marginVertical: 8,
    padding: 14,
    maxWidth: 340,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8
  },
  cardLocked: {
    borderColor: '#e11d48'
  },
  cardUnlocked: {
    borderColor: '#10b981'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  headerIcon: {
    fontSize: 16
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fb7185',
    letterSpacing: 0.3
  },
  headerTitleUnlocked: {
    color: '#34d399'
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10
  },
  statusPillLocked: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: '#e11d48',
    borderWidth: 1
  },
  statusPillUnlocked: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: '#10b981',
    borderWidth: 1
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700'
  },
  statusPillTextLocked: {
    color: '#fda4af'
  },
  statusPillTextUnlocked: {
    color: '#6ee7b7'
  },
  imageWrapper: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1e293b'
  },
  imageTouchable: {
    width: '100%',
    height: '100%'
  },
  fullImage: {
    width: '100%',
    height: '100%'
  },
  expandOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  expandText: {
    color: '#f8fafc',
    fontSize: 10,
    fontWeight: '700'
  },
  blurredContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#131b2e'
  },
  blurredImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0.35
  },
  lockFrostedOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16
  },
  largeLockEmoji: {
    fontSize: 34,
    marginBottom: 6
  },
  frostedTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2
  },
  frostedSubtitle: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16
  },
  captionText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4
  },
  agreementBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center'
  },
  agreementTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2
  },
  agreementQuestion: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8
  },
  consentStateRow: {
    marginBottom: 10
  },
  myAgreedText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700'
  },
  peerAgreedText: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '700'
  },
  awaitingText: {
    color: '#64748b',
    fontSize: 11
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%'
  },
  agreeButton: {
    flex: 1.2,
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  agreeButtonActive: {
    backgroundColor: '#059669'
  },
  agreeButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  declineButtonText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600'
  },
  buttonDisabled: {
    opacity: 0.5
  },
  unlockedFooter: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1e293b'
  },
  unlockedFooterText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center'
  },
  fullscreenOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 7, 15, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  fullscreenCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: '#1e293b',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    zIndex: 10
  },
  fullscreenCloseText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '700'
  },
  fullscreenImage: {
    width: '95%',
    height: '75%',
    borderRadius: 16
  },
  fullscreenCaptionBox: {
    marginTop: 14,
    backgroundColor: '#1e293b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12
  },
  fullscreenCaptionText: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600'
  }
});
