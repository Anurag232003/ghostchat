import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator
} from 'react-native';
import { uploadProfileAvatar } from '../services/api';

export { ProgressiveIdentityReveal } from './ProgressiveIdentityReveal';


const LEVEL_DEFINITIONS = [
  { level: 0, title: 'Anonymous', icon: '👤', desc: 'Pure ghost pseudonym & shrouded identity' },
  { level: 1, title: 'Nickname + Avatar', icon: '🌙', desc: 'Curated handle & aesthetic avatar' },
  { level: 2, title: 'Interests & Vibe', icon: '☕', desc: 'Age, tags, and lifestyle interests' },
  { level: 3, title: 'First Name', icon: '🏷️', desc: 'Personal first name revelation' },
  { level: 4, title: 'Real Photo', icon: '📸', desc: 'Blur filter lifted from profile photo' },
  { level: 5, title: 'Social / Contact', icon: '🔗', desc: 'Instagram, Telegram, or personal contact' },
];

export function IdentityRevealCard({
  revealedProfile,
  myGrantedLevel,
  peerGrantedLevel,
  onGrantNextLevel,
  onRequestNextLevel,
  isPeer = true
}) {
  const [expanded, setExpanded] = useState(false);
  const currentLevel = revealedProfile?.level_unlocked ?? 1;

  return (
    <View style={styles.cardContainer}>
      {/* Top Level Bar */}
      <View style={styles.headerRow}>
        <View style={styles.levelBadge}>
          <Text style={styles.levelBadgeText}>LEVEL {currentLevel} UNLOCKED</Text>
        </View>

        <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.expandToggle}>
          <Text style={styles.expandToggleText}>
            {expanded ? '▲ Hide Identity Details' : '▼ Blind Date Profile'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Progress Dots 0 to 5 */}
      <View style={styles.progressRow}>
        {[0, 1, 2, 3, 4, 5].map((lvl) => {
          const isUnlocked = currentLevel >= lvl;
          return (
            <View key={lvl} style={styles.stepWrapper}>
              <View style={[styles.stepDot, isUnlocked ? styles.stepDotActive : styles.stepDotLocked]}>
                <Text style={styles.stepNumber}>{isUnlocked ? '✓' : lvl}</Text>
              </View>
              <Text style={[styles.stepLabel, isUnlocked && styles.stepLabelActive]}>
                L{lvl}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Persona Header: Nova, 23, Interests */}
      <View style={styles.profileBanner}>
        {/* Avatar: If Level 4 is unlocked, show real photo; else show emoji avatar */}
        <View style={styles.avatarContainer}>
          {currentLevel >= 4 && revealedProfile?.photo_url ? (
            <Image
              source={{ uri: revealedProfile.photo_url }}
              style={styles.realPhoto}
            />
          ) : (
            <View style={[styles.emojiAvatar, { backgroundColor: revealedProfile?.avatar_color || '#0284C7' }]}>
              <Text style={styles.emojiAvatarText}>
                {currentLevel >= 1 ? (revealedProfile?.avatar_emoji || '🌙') : '👤'}
              </Text>
            </View>
          )}

          {/* Level Badge Pill */}
          <View style={styles.avatarLvlPill}>
            <Text style={styles.avatarLvlText}>L{currentLevel}</Text>
          </View>
        </View>

        {/* Core Info */}
        <View style={styles.infoMeta}>
          {/* Level 1: Nickname or Ghost ID */}
          <View style={styles.nameRow}>
            <Text style={styles.displayName}>
              {currentLevel >= 1 ? (revealedProfile?.nickname || '🌙 Nova') : (revealedProfile?.ghost_id || 'Shadow#0000')}
            </Text>
            {/* Level 2: Age */}
            {currentLevel >= 2 && revealedProfile?.age && (
              <Text style={styles.ageBadge}> {revealedProfile.age}</Text>
            )}
          </View>

          {/* Level 2: Interests Badges */}
          {currentLevel >= 2 ? (
            <View>
              <View style={styles.interestsRow}>
                {(revealedProfile?.interests || ['☕ Coffee', '🎮 Gaming', '🎵 Music']).map((tag, idx) => (
                  <View key={idx} style={styles.interestTag}>
                    <Text style={styles.interestText}>{tag}</Text>
                  </View>
                ))}
              </View>

              {/* 17. 📍 Approximate Location Sharing (Opt-in only) */}
              <View style={styles.locationContainer}>
                {revealedProfile?.location_sharing_enabled ? (
                  <View style={styles.locationOptInPill}>
                    <Text style={styles.locationOptInText}>
                      {revealedProfile.approximate_distance_str || '📍 ~8 km away'} • {revealedProfile.approximate_region || '📍 Delhi NCR'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.locationHiddenPill}>
                    <Text style={styles.locationHiddenPillText}>
                      📍 Location Hidden (Opt-in only)
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <Text style={styles.lockedHint}>
              🔒 Level 2 Locked (Interests, Location & Age hidden)
            </Text>
          )}
        </View>
      </View>

      {/* Expanded Accordion: Details for Levels 3, 4, 5 */}
      {expanded && (
        <View style={styles.detailsContainer}>
          {/* Level 2 Vibe */}
          {currentLevel >= 2 && revealedProfile?.vibe && (
            <View style={styles.detailSection}>
              <Text style={styles.sectionLabel}>LIFESTYLE & VIBE (L2)</Text>
              <Text style={styles.vibeText}>"{revealedProfile.vibe}"</Text>
            </View>
          )}

          {/* Level 3: First Name */}
          <View style={styles.detailSection}>
            <Text style={styles.sectionLabel}>REAL FIRST NAME (L3)</Text>
            {currentLevel >= 3 ? (
              <Text style={styles.unlockedVal}>
                👤 {revealedProfile?.first_name || 'Verified First Name'}
              </Text>
            ) : (
              <View style={styles.lockedBlock}>
                <Text style={styles.lockedText}>🔒 Hidden until Level 3</Text>
              </View>
            )}
          </View>

          {/* Level 4: Photo */}
          <View style={styles.detailSection}>
            <Text style={styles.sectionLabel}>AUTHENTIC PHOTO (L4)</Text>
            {currentLevel >= 4 && revealedProfile?.photo_url ? (
              <View style={styles.photoContainer}>
                <Image
                  source={{ uri: revealedProfile.photo_url }}
                  style={styles.unblurredPhotoPreview}
                />
                <Text style={styles.photoVerifiedText}>✓ Authentic Unblurred Photo Revealed</Text>
              </View>
            ) : (
              <View style={styles.photoBlurPlaceholder}>
                <Text style={styles.lockedText}>🔒 Profile Photo is Blurred (Level 4)</Text>
              </View>
            )}
          </View>

          {/* Level 5: Social / Contact */}
          <View style={styles.detailSection}>
            <Text style={styles.sectionLabel}>SOCIAL & DIRECT CONTACT (L5)</Text>
            {currentLevel >= 5 && revealedProfile?.socials ? (
              <View style={styles.socialsGrid}>
                {Object.entries(revealedProfile.socials).map(([net, handle]) => (
                  <View key={net} style={styles.socialRow}>
                    <Text style={styles.socialNet}>{net.toUpperCase()}:</Text>
                    <Text style={styles.socialHandle}>{handle}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.lockedBlock}>
                <Text style={styles.lockedText}>🔒 Social / Contact Hidden (Level 5)</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Unlock Next Level Buttons (For 1-to-1 chats) */}
      {isPeer && (
        <View style={styles.actionsBar}>
          <TouchableOpacity
            style={[styles.grantBtn, myGrantedLevel >= 5 && styles.actionDisabled]}
            onPress={() => onGrantNextLevel && onGrantNextLevel(Math.min(5, myGrantedLevel + 1))}
            disabled={myGrantedLevel >= 5}
          >
            <Text style={styles.grantBtnText}>
              {myGrantedLevel >= 5
                ? '★ Fully Revealed to Peer'
                : `🔓 Grant Level ${myGrantedLevel + 1} to Peer`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.requestBtn, currentLevel >= 5 && styles.actionDisabled]}
            onPress={() => onRequestNextLevel && onRequestNextLevel(Math.min(5, currentLevel + 1))}
            disabled={currentLevel >= 5}
          >
            <Text style={styles.requestBtnText}>
              {currentLevel >= 5
                ? '✓ All Levels Unlocked'
                : `⚡ Request Level ${currentLevel + 1}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// Modal for editing the user's own progressive profile
export function EditProfileModal({ visible, onClose, initialProfile, onSave }) {
  const [profile, setProfile] = useState(
    initialProfile || {
      ghost_id: '',
      nickname: '',
      avatar_emoji: '👤',
      avatar_color: '#6366F1',
      age: '',
      interests: [],
      vibe: '',
      first_name: '',
      photo_url: '',
      socials: { instagram: '', telegram: '' }
    }
  );

  const [interestInput, setInterestInput] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);

  function triggerFilePicker() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  async function handleAvatarPicked(e) {
    const pickedFile = e.target.files?.[0];
    if (!pickedFile) return;
    setUploadingAvatar(true);
    try {
      const res = await uploadProfileAvatar(pickedFile);
      setProfile((prev) => ({ ...prev, photo_url: res.photo_url }));
    } catch (err) {
      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        setProfile((prev) => ({ ...prev, photo_url: loadEvt.target.result }));
      };
      reader.readAsDataURL(pickedFile);
    } finally {
      setUploadingAvatar(false);
    }
  }

  function addInterest() {
    if (!interestInput.trim()) return;
    if (!profile.interests.includes(interestInput.trim())) {
      setProfile({ ...profile, interests: [...profile.interests, interestInput.trim()] });
    }
    setInterestInput('');
  }

  function removeInterest(item) {
    setProfile({ ...profile, interests: profile.interests.filter((i) => i !== item) });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>👤 Progressive Persona Studio</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSub}>
            Configure each level of your Blind Date identity. You choose when to reveal each level during conversations.
          </Text>

          <ScrollView style={styles.modalForm}>
            {/* LEVEL 1 */}
            <Text style={styles.formSectionHeader}>LEVEL 1: NICKNAME & AVATAR</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Nickname (Handle)</Text>
              <TextInput
                style={styles.input}
                value={profile.nickname}
                onChangeText={(v) => setProfile({ ...profile, nickname: v })}
                placeholder="e.g. 🌙 Nova"
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Avatar Emoji Icon</Text>
              <TextInput
                style={styles.input}
                value={profile.avatar_emoji}
                onChangeText={(v) => setProfile({ ...profile, avatar_emoji: v })}
                placeholder="e.g. 🌙, ⚡, 🦊, 🚀"
                placeholderTextColor="#64748B"
              />
            </View>

            {/* LEVEL 2 */}
            <Text style={styles.formSectionHeader}>LEVEL 2: AGE & INTERESTS</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Age</Text>
              <TextInput
                style={styles.input}
                value={profile.age ? profile.age.toString() : ''}
                onChangeText={(v) => setProfile({ ...profile, age: parseInt(v, 10) || 18 })}
                keyboardType="numeric"
                placeholder="e.g. 23"
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Interests Badges</Text>
              <View style={styles.tagInputRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                  value={interestInput}
                  onChangeText={setInterestInput}
                  placeholder="e.g. 📚 Books, 🍕 Food"
                  placeholderTextColor="#64748B"
                />
                <TouchableOpacity style={styles.addTagBtn} onPress={addInterest}>
                  <Text style={styles.addTagBtnText}>+ Add</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.interestsTagsWrap}>
                {profile.interests.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={styles.interestTagPill}
                    onPress={() => removeInterest(tag)}
                  >
                    <Text style={styles.interestTagPillText}>{tag} ✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Lifestyle Vibe</Text>
              <TextInput
                style={styles.input}
                value={profile.vibe}
                onChangeText={(v) => setProfile({ ...profile, vibe: v })}
                placeholder="Night owl • Indie hacker • Synthwave listener"
                placeholderTextColor="#64748B"
              />
            </View>

            {/* LEVEL 3 */}
            <Text style={styles.formSectionHeader}>LEVEL 3: REAL FIRST NAME</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>First Name</Text>
              <TextInput
                style={styles.input}
                value={profile.first_name}
                onChangeText={(v) => setProfile({ ...profile, first_name: v })}
                placeholder="Your first name"
                placeholderTextColor="#64748B"
              />
            </View>

            {/* LEVEL 4 */}
            <Text style={styles.formSectionHeader}>LEVEL 4: AUTHENTIC PROFILE PHOTO</Text>

            {Platform.OS === 'web' && (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleAvatarPicked}
              />
            )}

            <View style={styles.avatarUploadCard}>
              {profile.photo_url ? (
                <View style={styles.avatarPreviewContainer}>
                  <Image source={{ uri: profile.photo_url }} style={styles.avatarCirclePreview} />
                  <View style={styles.avatarMetaCol}>
                    <Text style={styles.avatarActiveLabel}>✓ Photo Selected</Text>
                    <View style={styles.avatarBtnRow}>
                      <TouchableOpacity style={styles.changePhotoBtn} onPress={triggerFilePicker}>
                        <Text style={styles.changePhotoBtnText}>Change Photo</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removePhotoBtn}
                        onPress={() => setProfile({ ...profile, photo_url: '' })}
                      >
                        <Text style={styles.removePhotoBtnText}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadPhotoPlaceholder}
                  onPress={triggerFilePicker}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <ActivityIndicator color="#38BDF8" />
                  ) : (
                    <>
                      <Text style={styles.uploadPhotoCameraIcon}>📸</Text>
                      <Text style={styles.uploadPhotoTitle}>Choose Photo from Device</Text>
                      <Text style={styles.uploadPhotoSubtitle}>JPG, PNG, WebP • Tap to select file</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Or Enter Photo URL Directly:</Text>
              <TextInput
                style={styles.input}
                value={profile.photo_url}
                onChangeText={(v) => setProfile({ ...profile, photo_url: v })}
                placeholder="https://..."
                placeholderTextColor="#64748B"
              />
            </View>

            {/* LEVEL 5 */}
            <Text style={styles.formSectionHeader}>LEVEL 5: SOCIAL / CONTACT (OPTIONAL)</Text>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Instagram Handle</Text>
              <TextInput
                style={styles.input}
                value={profile.socials?.instagram || ''}
                onChangeText={(v) =>
                  setProfile({
                    ...profile,
                    socials: { ...profile.socials, instagram: v }
                  })
                }
                placeholder="@username"
                placeholderTextColor="#64748B"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Telegram Handle</Text>
              <TextInput
                style={styles.input}
                value={profile.socials?.telegram || ''}
                onChangeText={(v) =>
                  setProfile({
                    ...profile,
                    socials: { ...profile.socials, telegram: v }
                  })
                }
                placeholder="@telegram_handle"
                placeholderTextColor="#64748B"
              />
            </View>
          </ScrollView>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={() => {
                onSave(profile);
                onClose();
              }}
            >
              <Text style={styles.saveBtnText}>Save Persona</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  levelBadge: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0284C7'
  },
  levelBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  expandToggle: {
    padding: 4
  },
  expandToggleText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600'
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
    paddingHorizontal: 4
  },
  stepWrapper: {
    alignItems: 'center'
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2
  },
  stepDotActive: {
    backgroundColor: '#0284C7'
  },
  stepDotLocked: {
    backgroundColor: '#1E293B'
  },
  stepNumber: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800'
  },
  stepLabel: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600'
  },
  stepLabelActive: {
    color: '#38BDF8',
    fontWeight: '700'
  },
  profileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12
  },
  emojiAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emojiAvatarText: {
    fontSize: 24
  },
  realPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#38BDF8'
  },
  avatarLvlPill: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#0284C7',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1
  },
  avatarLvlText: {
    fontSize: 9,
    color: '#38BDF8',
    fontWeight: '800'
  },
  infoMeta: {
    flex: 1
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4
  },
  displayName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC'
  },
  ageBadge: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '600',
    marginLeft: 4
  },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  interestTag: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
    marginBottom: 2
  },
  interestText: {
    fontSize: 10,
    color: '#E2E8F0',
    fontWeight: '600'
  },
  locationContainer: {
    marginTop: 6
  },
  locationOptInPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start'
  },
  locationOptInText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FCD34D'
  },
  locationHiddenPill: {
    backgroundColor: 'rgba(100, 116, 139, 0.15)',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start'
  },
  locationHiddenPillText: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#94A3B8'
  },
  lockedHint: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic'
  },

  // Accordion Details
  detailsContainer: {
    backgroundColor: '#090D16',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#1E293B'
  },
  detailSection: {
    marginBottom: 10
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  vibeText: {
    fontSize: 12,
    color: '#38BDF8',
    fontStyle: 'italic'
  },
  unlockedVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC'
  },
  lockedBlock: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    padding: 6,
    alignItems: 'center'
  },
  lockedText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600'
  },
  photoContainer: {
    alignItems: 'center'
  },
  unblurredPhotoPreview: {
    width: 140,
    height: 140,
    borderRadius: 12,
    marginBottom: 4
  },
  photoVerifiedText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '700'
  },
  photoBlurPlaceholder: {
    height: 60,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  socialsGrid: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 8
  },
  socialRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  socialNet: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
    width: 90
  },
  socialHandle: {
    fontSize: 11,
    color: '#F8FAFC',
    fontWeight: '600'
  },

  // Action Buttons
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10
  },
  grantBtn: {
    flex: 1,
    backgroundColor: '#0284C7',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 6
  },
  grantBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700'
  },
  requestBtn: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 6
  },
  requestBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700'
  },
  actionDisabled: {
    opacity: 0.5
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 15, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalContent: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F8FAFC'
  },
  modalCloseText: {
    fontSize: 16,
    color: '#94A3B8',
    fontWeight: '700'
  },
  modalSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 16,
    lineHeight: 18
  },
  modalForm: {
    maxHeight: 400
  },
  formSectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 8
  },
  fieldGroup: {
    marginBottom: 10
  },
  fieldLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 4
  },
  input: {
    backgroundColor: '#090D16',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#F8FAFC'
  },
  tagInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6
  },
  addTagBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8
  },
  addTagBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  interestsTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  interestTagPill: {
    backgroundColor: '#1E293B',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4
  },
  interestTagPillText: {
    fontSize: 11,
    color: '#38BDF8',
    fontWeight: '600'
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B'
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 13
  },
  saveBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13
  },
  avatarUploadCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.25)',
    padding: 12,
    marginBottom: 12
  },
  uploadPhotoPlaceholder: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#38BDF8',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(56, 189, 248, 0.05)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  uploadPhotoCameraIcon: {
    fontSize: 32,
    marginBottom: 6
  },
  uploadPhotoTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2
  },
  uploadPhotoSubtitle: {
    color: '#94A3B8',
    fontSize: 11
  },
  avatarPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14
  },
  avatarCirclePreview: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: '#38BDF8'
  },
  avatarMetaCol: {
    flex: 1
  },
  avatarActiveLabel: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8
  },
  avatarBtnRow: {
    flexDirection: 'row',
    gap: 8
  },
  changePhotoBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  changePhotoBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700'
  },
  removePhotoBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6
  },
  removePhotoBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700'
  }
});
