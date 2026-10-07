import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Platform,
  ScrollView
} from 'react-native';

export function SendMediaModal({
  visible,
  onClose,
  file,
  previewUrl,
  fileType, // 'image' | 'video'
  onSend,
  isUploading = false
}) {
  const [viewMode, setViewMode] = useState('normal'); // 'normal' | 'view_once'
  const [caption, setCaption] = useState('');

  if (!file && !previewUrl) return null;

  const isVideo = fileType === 'video' || (file && file.type?.startsWith('video'));
  const fileSizeFormatted = file?.size
    ? file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`
    : '';

  function handleSend() {
    onSend({
      file,
      previewUrl,
      fileType: isVideo ? 'video' : 'image',
      viewOnce: viewMode === 'view_once',
      caption: caption.trim()
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerIcon}>{isVideo ? '🎥' : '📷'}</Text>
              <View>
                <Text style={styles.headerTitle}>
                  Send {isVideo ? 'Encrypted Video' : 'Encrypted Photo'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  {file?.name || (isVideo ? 'Video' : 'Photo')} {fileSizeFormatted ? `• ${fileSizeFormatted}` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} disabled={isUploading}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Media Preview Stage */}
          <View style={styles.previewStage}>
            {isVideo ? (
              Platform.OS === 'web' ? (
                <video
                  src={previewUrl}
                  controls
                  style={{
                    width: '100%',
                    maxHeight: 240,
                    borderRadius: 12,
                    backgroundColor: '#020617',
                    outline: 'none'
                  }}
                />
              ) : (
                <View style={styles.nativeVideoPlaceholder}>
                  <Text style={styles.videoPlayIcon}>▶</Text>
                  <Text style={styles.videoLabel}>Video Preview Ready</Text>
                </View>
              )
            ) : (
              <Image
                source={{ uri: previewUrl }}
                style={styles.imagePreview}
                resizeMode="contain"
              />
            )}

            {/* View Mode Indicator Badge on preview */}
            <View style={[styles.viewModeOverlayBadge, viewMode === 'view_once' && styles.viewOnceActiveBadge]}>
              <Text style={styles.viewModeBadgeText}>
                {viewMode === 'view_once' ? '① ONE-TIME VIEW' : '♾️ NORMAL VIEW'}
              </Text>
            </View>
          </View>

          {/* View Mode Selection Controls */}
          <View style={styles.viewModeSelectorContainer}>
            <Text style={styles.viewModeSectionTitle}>VIEWING PERMISSION:</Text>
            <View style={styles.viewModeTabs}>
              {/* Option 1: Normal View */}
              <TouchableOpacity
                style={[
                  styles.viewModeOption,
                  viewMode === 'normal' && styles.viewModeOptionActive
                ]}
                onPress={() => setViewMode('normal')}
              >
                <Text style={styles.viewModeOptionIcon}>♾️</Text>
                <View style={styles.viewModeOptionTextCol}>
                  <Text style={[styles.viewModeOptionTitle, viewMode === 'normal' && styles.viewModeTitleActive]}>
                    Normal View
                  </Text>
                  <Text style={styles.viewModeOptionDesc}>
                    Viewable anytime in chat history
                  </Text>
                </View>
                <View style={[styles.radioCircle, viewMode === 'normal' && styles.radioCircleActive]}>
                  {viewMode === 'normal' && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>

              {/* Option 2: One-Time View */}
              <TouchableOpacity
                style={[
                  styles.viewModeOption,
                  viewMode === 'view_once' && styles.viewModeOptionActiveOneTime
                ]}
                onPress={() => setViewMode('view_once')}
              >
                <Text style={styles.viewModeOptionIcon}>①</Text>
                <View style={styles.viewModeOptionTextCol}>
                  <Text style={[styles.viewModeOptionTitle, viewMode === 'view_once' && styles.viewModeTitleActiveOneTime]}>
                    One-Time View (View Once)
                  </Text>
                  <Text style={styles.viewModeOptionDesc}>
                    Expires & disappears after opening once
                  </Text>
                </View>
                <View style={[styles.radioCircle, viewMode === 'view_once' && styles.radioCircleActiveOneTime]}>
                  {viewMode === 'view_once' && <View style={styles.radioDotOneTime} />}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Caption Input */}
          <View style={styles.captionContainer}>
            <TextInput
              style={styles.captionInput}
              placeholder="Add a secret caption (optional)..."
              placeholderTextColor="#64748B"
              value={caption}
              onChangeText={setCaption}
              maxLength={200}
            />
          </View>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={isUploading}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sendBtn, isUploading && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={isUploading}
            >
              {isUploading ? (
                <View style={styles.sendingRow}>
                  <ActivityIndicator size="small" color="#030712" />
                  <Text style={styles.sendBtnText}>  Encrypting & Sending...</Text>
                </View>
              ) : (
                <Text style={styles.sendBtnText}>
                  Send {viewMode === 'view_once' ? '① View Once' : ''} ➔
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Fullscreen Viewer for View Once media
export function ViewOnceMediaModal({
  visible,
  onClose,
  mediaItem, // { url, file_type, caption }
  peerName = 'Partner'
}) {
  if (!visible || !mediaItem) return null;

  const isVideo = mediaItem.file_type === 'video' || mediaItem.mime_type?.startsWith('video');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewOnceOverlay}>
        {/* Top Header */}
        <View style={styles.viewOnceTopBar}>
          <View style={styles.viewOnceTopMeta}>
            <View style={styles.viewOnceBadgePill}>
              <Text style={styles.viewOnceBadgePillText}>① ONE-TIME VIEW</Text>
            </View>
            <Text style={styles.viewOnceSenderText}>From {peerName}</Text>
          </View>
          <TouchableOpacity style={styles.viewOnceCloseBtn} onPress={onClose}>
            <Text style={styles.viewOnceCloseBtnText}>✕ Close</Text>
          </TouchableOpacity>
        </View>

        {/* Notice Banner */}
        <View style={styles.viewOnceNoticeBanner}>
          <Text style={styles.viewOnceNoticeIcon}>⚠️</Text>
          <Text style={styles.viewOnceNoticeText}>
            This photo/video will disappear permanently once you close this window.
          </Text>
        </View>

        {/* Media Container */}
        <View style={styles.viewOnceMediaBox}>
          {isVideo ? (
            Platform.OS === 'web' ? (
              <video
                src={mediaItem.url}
                autoPlay
                controls
                playsInline
                style={{
                  width: '100%',
                  maxHeight: '70vh',
                  borderRadius: 16,
                  backgroundColor: '#000000',
                  outline: 'none'
                }}
              />
            ) : (
              <Text style={{ color: '#fff' }}>Playing video...</Text>
            )
          ) : (
            <Image
              source={{ uri: mediaItem.url }}
              style={styles.viewOnceFullImage}
              resizeMode="contain"
            />
          )}

          {mediaItem.caption ? (
            <View style={styles.viewOnceCaptionBox}>
              <Text style={styles.viewOnceCaptionText}>{mediaItem.caption}</Text>
            </View>
          ) : null}
        </View>

        {/* Bottom Close Button */}
        <TouchableOpacity style={styles.viewOnceDoneBtn} onPress={onClose}>
          <Text style={styles.viewOnceDoneBtnText}>Done Viewing (Disappear)</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 7, 18, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#334155',
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  headerIcon: {
    fontSize: 26
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800'
  },
  headerSubtitle: {
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
  previewStage: {
    backgroundColor: '#020617',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    maxHeight: 240,
    position: 'relative',
    marginBottom: 14
  },
  imagePreview: {
    width: '100%',
    height: 220
  },
  nativeVideoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30
  },
  videoPlayIcon: {
    fontSize: 40,
    color: '#38BDF8',
    marginBottom: 8
  },
  videoLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600'
  },
  viewModeOverlayBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#38BDF8'
  },
  viewOnceActiveBadge: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.25)'
  },
  viewModeBadgeText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  viewModeSelectorContainer: {
    marginBottom: 12
  },
  viewModeSectionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8
  },
  viewModeTabs: {
    gap: 8
  },
  viewModeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#334155',
    padding: 10
  },
  viewModeOptionActive: {
    borderColor: '#38BDF8',
    backgroundColor: 'rgba(56, 189, 248, 0.1)'
  },
  viewModeOptionActiveOneTime: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)'
  },
  viewModeOptionIcon: {
    fontSize: 20,
    marginRight: 10,
    color: '#F8FAFC'
  },
  viewModeOptionTextCol: {
    flex: 1
  },
  viewModeOptionTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700'
  },
  viewModeTitleActive: {
    color: '#38BDF8'
  },
  viewModeTitleActiveOneTime: {
    color: '#FBBF24'
  },
  viewModeOptionDesc: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  radioCircleActive: {
    borderColor: '#38BDF8'
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#38BDF8'
  },
  radioCircleActiveOneTime: {
    borderColor: '#F59E0B'
  },
  radioDotOneTime: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F59E0B'
  },
  captionContainer: {
    marginBottom: 14
  },
  captionInput: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    color: '#F8FAFC',
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155'
  },
  cancelBtnText: {
    color: '#CBD5E1',
    fontWeight: '700',
    fontSize: 13
  },
  sendBtn: {
    flex: 2,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendBtnDisabled: {
    opacity: 0.6
  },
  sendBtnText: {
    color: '#022C22',
    fontWeight: '800',
    fontSize: 13
  },
  sendingRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },

  /* View Once Modal Styles */
  viewOnceOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 16,
    justifyContent: 'space-between'
  },
  viewOnceTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 40 : 10,
    paddingBottom: 10
  },
  viewOnceTopMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  viewOnceBadgePill: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  viewOnceBadgePillText: {
    color: '#0F172A',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 0.5
  },
  viewOnceSenderText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700'
  },
  viewOnceCloseBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  viewOnceCloseBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  viewOnceNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginVertical: 10
  },
  viewOnceNoticeIcon: {
    fontSize: 16
  },
  viewOnceNoticeText: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '600',
    flex: 1
  },
  viewOnceMediaBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  viewOnceFullImage: {
    width: '100%',
    height: '100%',
    maxHeight: '75vh'
  },
  viewOnceCaptionBox: {
    position: 'absolute',
    bottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: '90%'
  },
  viewOnceCaptionText: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center'
  },
  viewOnceDoneBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 12
  },
  viewOnceDoneBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5
  }
});
