import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';

import { fetchBlindPhotoPresets, createBlindPhoto } from '../services/api';

export function SendBlindPhotoModal({
  visible,
  onClose,
  sessionId,
  currentUserId,
  peerName = 'Partner',
  onPhotoSent
}) {
  const [presets, setPresets] = useState([]);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [caption, setCaption] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [loadingPresets, setLoadingPresets] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) {
      loadPresets();
    }
  }, [visible]);

  async function loadPresets() {
    setLoadingPresets(true);
    try {
      const data = await fetchBlindPhotoPresets();
      setPresets(data.presets || []);
      if (data.presets && data.presets.length > 0) {
        setSelectedPreset(data.presets[0]);
        setCaption(data.presets[0].caption || '');
      }
    } catch (err) {
      console.warn('Failed to load blind photo presets:', err);
    } finally {
      setLoadingPresets(false);
    }
  }

  function handleSelectPreset(p) {
    setSelectedPreset(p);
    setCaption(p.caption || '');
    setCustomUrl('');
  }

  async function handleSend() {
    const photoUrl = customUrl.trim() || selectedPreset?.full_url;
    if (!photoUrl) {
      Alert.alert('Missing Photo', 'Please choose a preset or provide an image URL');
      return;
    }

    setSending(true);
    try {
      const blurUrl = selectedPreset?.blur_url || photoUrl;
      const res = await createBlindPhoto(
        currentUserId || 'me',
        sessionId || 'demo-session',
        photoUrl,
        blurUrl,
        caption.trim() || 'Confidential Photo'
      );

      const blindPhotoPayload = {
        type: 'blind_photo',
        photo_id: res.photo_id,
        uploader_id: currentUserId,
        session_id: sessionId,
        full_photo_url: photoUrl,
        preview_blur_url: blurUrl,
        caption: caption.trim() || 'Confidential Photo',
        locked: true,
        unlocked: false,
        consents: res.consents
      };

      if (onPhotoSent) {
        onPhotoSent(blindPhotoPayload);
      }
      onClose();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>🖼️ Send Blind Photo</Text>
              <Text style={styles.subtitle}>
                Photo sends locked 🔒. Revealed only when both agree.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loadingPresets ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#f43f5e" />
              <Text style={styles.loadingText}>Loading privacy photo gallery...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Privacy Callout Banner */}
              <View style={styles.privacyBanner}>
                <Text style={styles.privacyIcon}>🔒</Text>
                <Text style={styles.privacyBannerText}>
                  Your match will only see a blurred silhouette with "Photo Locked 🔒" until both of you click [ Accept Reveal ].
                </Text>
              </View>

              {/* Presets Gallery */}
              <Text style={styles.sectionHeading}>Choose Aesthetic Photo Preset:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetsList}
              >
                {presets.map((p) => {
                  const isSelected = selectedPreset?.id === p.id && !customUrl;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.presetCard, isSelected && styles.presetCardSelected]}
                      onPress={() => handleSelectPreset(p)}
                    >
                      <Image source={{ uri: p.blur_url || p.full_url }} style={styles.presetThumb} />
                      <Text style={styles.presetTitle} numberOfLines={1}>{p.title}</Text>
                      <Text style={styles.presetCategory} numberOfLines={1}>{p.category}</Text>
                      {isSelected && (
                        <View style={styles.selectedCheck}>
                          <Text style={styles.selectedCheckText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Caption Input */}
              <Text style={styles.inputHeading}>Optional Caption / Hint:</Text>
              <TextInput
                style={styles.captionInput}
                placeholder="Give a mystery hint about this photo..."
                placeholderTextColor="#64748b"
                value={caption}
                onChangeText={setCaption}
              />

              {/* Custom Image URL Option */}
              <Text style={styles.inputHeading}>Or Custom Image URL:</Text>
              <TextInput
                style={styles.captionInput}
                placeholder="https://..."
                placeholderTextColor="#64748b"
                value={customUrl}
                onChangeText={(text) => {
                  setCustomUrl(text);
                  if (text) setSelectedPreset(null);
                }}
              />

              {/* Send Action */}
              <TouchableOpacity
                style={[styles.sendButton, sending && styles.buttonDisabled]}
                onPress={handleSend}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>
                    Send as Blind Photo 🔒
                  </Text>
                )}
              </TouchableOpacity>
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
    backgroundColor: 'rgba(5, 7, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  container: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.3
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2
  },
  closeBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#1e293b'
  },
  closeBtnText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700'
  },
  loadingBox: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 12
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 13
  },
  privacyBanner: {
    backgroundColor: '#88133722',
    borderWidth: 1,
    borderColor: '#f43f5e55',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16
  },
  privacyIcon: {
    fontSize: 20
  },
  privacyBannerText: {
    color: '#fecdd3',
    fontSize: 12,
    lineHeight: 18,
    flex: 1
  },
  sectionHeading: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10
  },
  presetsList: {
    gap: 12,
    paddingBottom: 6
  },
  presetCard: {
    width: 120,
    backgroundColor: '#1e293b',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 8,
    alignItems: 'center',
    position: 'relative'
  },
  presetCardSelected: {
    borderColor: '#f43f5e',
    backgroundColor: '#1e1b4b'
  },
  presetThumb: {
    width: 100,
    height: 90,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#0f172a'
  },
  presetTitle: {
    color: '#f8fafc',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center'
  },
  presetCategory: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2
  },
  selectedCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#f43f5e',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  selectedCheckText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900'
  },
  inputHeading: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6
  },
  captionInput: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    color: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13
  },
  sendButton: {
    backgroundColor: '#e11d48',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
    shadowColor: '#e11d48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  buttonDisabled: {
    opacity: 0.6
  }
});
