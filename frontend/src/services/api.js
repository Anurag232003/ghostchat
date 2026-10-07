const getApiBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    const isLocalOrLan =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      host.startsWith('172.');

    if (isLocalOrLan) {
      return `http://${host}:8000`;
    }
    return window.__API_URL__ || `${window.location.protocol}//${window.location.host}`;
  }
  return 'http://localhost:8000';
};

export const API_BASE_URL = getApiBaseUrl();

export const WS_BASE_URL = (function() {
  if (process.env.EXPO_PUBLIC_WS_URL) {
    return process.env.EXPO_PUBLIC_WS_URL.replace(/\/+$/, '');
  }
  return API_BASE_URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
})();

export async function registerUser(payload) {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ detail: 'Registration failed' }));
    throw new Error(errorData.detail || 'Failed to register identity');
  }
  return await res.json();
}

export async function fetchUsers(excludeId = null) {
  const url = excludeId
    ? `${API_BASE_URL}/api/users/list?exclude_id=${encodeURIComponent(excludeId)}`
    : `${API_BASE_URL}/api/users/list`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch user directory');
  return await res.json();
}

export async function fetchPrekeyBundle(userId) {
  const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(userId)}/prekey-bundle`);
  if (!res.ok) throw new Error('Failed to fetch prekey bundle for peer');
  return await res.json();
}

export async function fetchMessageHistory(conversationId) {
  const res = await fetch(`${API_BASE_URL}/api/messages/history?conversation_id=${encodeURIComponent(conversationId)}`);
  if (!res.ok) throw new Error('Failed to fetch message history');
  return await res.json();
}

export async function deleteMessageForEveryone(messageId, userId) {
  const res = await fetch(`${API_BASE_URL}/api/messages/delete?message_id=${encodeURIComponent(messageId)}&user_id=${encodeURIComponent(userId)}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to delete message');
  return await res.json();
}

export async function createGroupChat({ name, memberIds, creatorId, encryptedSenderKeys = {} }) {
  const res = await fetch(`${API_BASE_URL}/api/groups/create?creator_id=${encodeURIComponent(creatorId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      member_ids: memberIds,
      encrypted_sender_keys: encryptedSenderKeys
    })
  });
  if (!res.ok) throw new Error('Failed to create encrypted group');
  return await res.json();
}

export async function fetchMyGroups(userId) {
  const res = await fetch(`${API_BASE_URL}/api/groups/my-groups?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) return [];
  return await res.json();
}

export async function fetchGroupSenderKey(groupId, userId) {
  const res = await fetch(`${API_BASE_URL}/api/groups/${encodeURIComponent(groupId)}/keys/${encodeURIComponent(userId)}`);
  if (!res.ok) return null;
  return await res.json();
}

export async function uploadEncryptedAttachment(encryptedBlob, uploaderId) {
  const formData = new FormData();
  formData.append('file', encryptedBlob, 'attachment.enc');

  const res = await fetch(`${API_BASE_URL}/api/attachments/upload?uploader_id=${encodeURIComponent(uploaderId)}`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to upload encrypted attachment');
  return await res.json();
}

export async function downloadEncryptedAttachment(attachmentId) {
  const res = await fetch(`${API_BASE_URL}/api/attachments/download/${encodeURIComponent(attachmentId)}`);
  if (!res.ok) throw new Error('Failed to download encrypted attachment');
  const arrayBuffer = await res.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

export async function uploadChatMedia(fileOrBlob, uploaderId = '') {
  const formData = new FormData();
  formData.append('file', fileOrBlob);

  const res = await fetch(`${API_BASE_URL}/api/attachments/upload-media?uploader_id=${encodeURIComponent(uploaderId)}`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to upload media file');
  const data = await res.json();
  // Ensure absolute URL if needed for web
  if (data.url && !data.url.startsWith('http')) {
    data.full_url = `${API_BASE_URL}${data.url}`;
  } else {
    data.full_url = data.url;
  }
  return data;
}

export async function uploadProfileAvatar(fileOrBlob, userId = '') {
  const formData = new FormData();
  formData.append('file', fileOrBlob);

  const res = await fetch(`${API_BASE_URL}/api/attachments/upload-avatar?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error('Failed to upload avatar image');
  const data = await res.json();
  if (data.photo_url && !data.photo_url.startsWith('http')) {
    data.photo_url = `${API_BASE_URL}${data.photo_url}`;
  }
  return data;
}

export async function updateProfile(userId, profile) {
  const res = await fetch(`${API_BASE_URL}/api/auth/profile/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile })
  });
  if (!res.ok) throw new Error('Failed to update identity profile');
  return await res.json();
}

export async function fetchRevealedProfile(targetUserId, viewerId) {
  const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(targetUserId)}/revealed-to/${encodeURIComponent(viewerId)}`);
  if (!res.ok) throw new Error('Failed to fetch revealed profile');
  return await res.json();
}

export async function requestOrGrantLevelUnlock(userId, targetUserId, targetLevel, action = 'grant') {
  const res = await fetch(`${API_BASE_URL}/api/users/unlock-level?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_user_id: targetUserId,
      target_level: targetLevel,
      action: action
    })
  });
  if (!res.ok) throw new Error(`Failed to ${action} level ${targetLevel}`);
  return await res.json();
}

export async function joinBlindDateQueue(userId, vibe = "🌙 Late Night Deep Talks", mode = "mystery", durationMinutes = 20) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, vibe, mode, duration_minutes: durationMinutes })
  });
  if (!res.ok) throw new Error('Failed to join blind date queue');
  return await res.json();
}

export async function leaveBlindDateQueue(userId) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/queue/${encodeURIComponent(userId)}`, {
    method: 'DELETE'
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function fetchBlindDateRoom(roomId) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/room/${encodeURIComponent(roomId)}`);
  if (!res.ok) throw new Error('Failed to fetch blind date chamber');
  return await res.json();
}

export async function submitActivityAnswer(roomId, userId, activityIdx, answer) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/room/${encodeURIComponent(roomId)}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, activity_idx: activityIdx, answer })
  });
  if (!res.ok) throw new Error('Failed to submit activity response');
  return await res.json();
}

export async function submitRevealDecision(roomId, userId, decision) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/room/${encodeURIComponent(roomId)}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, decision })
  });
  if (!res.ok) throw new Error('Failed to submit reveal decision');
  return await res.json();
}

export async function submitEndDateDecision(roomId, userId, choice, reportReason = null) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/room/${encodeURIComponent(roomId)}/end-date-decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, choice, report_reason: reportReason })
  });
  if (!res.ok) throw new Error('Failed to submit end date decision');
  return await res.json();
}

// 15. 🚪 Exit Anytime API Client
export async function exitBlindDateSafely(roomId, userId) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/room/${encodeURIComponent(roomId)}/exit-safely`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  });
  if (!res.ok) throw new Error('Failed to exit blind date safely');
  return await res.json();
}

export async function sendBlindDateChatMessage(roomId, userId, text) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/room/${encodeURIComponent(roomId)}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, text })
  });
  if (!res.ok) throw new Error('Failed to send blind date message');
  return await res.json();
}

export async function requestInstantDemoMatch(userId, vibe = "🌙 Late Night Deep Talks", mode = "mystery", durationMinutes = 20) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/instant-demo-match?user_id=${encodeURIComponent(userId)}&vibe=${encodeURIComponent(vibe)}&mode=${encodeURIComponent(mode)}&duration_minutes=${encodeURIComponent(durationMinutes)}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to spawn demo match');
  return await res.json();
}

export async function fetchPuzzleQuestions() {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/puzzle/questions`);
  if (!res.ok) throw new Error('Failed to fetch compatibility puzzle questions');
  return await res.json();
}

export async function compareCompatibilityPuzzle(user1Answers, user2Answers) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/puzzle/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user1_answers: user1Answers, user2_answers: user2Answers })
  });
  if (!res.ok) throw new Error('Failed to compare compatibility puzzle answers');
  return await res.json();
}

// 7. 👻 Progressive Identity Reveal API Client
export async function fetchProgressiveRevealStatus(userId, peerId) {
  const res = await fetch(`${API_BASE_URL}/api/users/progressive-reveal/status?user_id=${encodeURIComponent(userId)}&peer_id=${encodeURIComponent(peerId)}`);
  if (!res.ok) throw new Error('Failed to fetch progressive reveal status');
  return await res.json();
}

export async function declareProgressiveMutualInterest(userId, peerId, interested = true) {
  const res = await fetch(`${API_BASE_URL}/api/users/progressive-reveal/declare-interest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, peer_id: peerId, interested })
  });
  if (!res.ok) throw new Error('Failed to declare mutual interest');
  return await res.json();
}

export async function requestProgressivePhotoReveal(userId, peerId) {
  const res = await fetch(`${API_BASE_URL}/api/users/progressive-reveal/request-photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, peer_id: peerId })
  });
  if (!res.ok) throw new Error('Failed to request photo reveal');
  return await res.json();
}

export async function consentProgressivePhotoReveal(userId, peerId, consent) {
  const res = await fetch(`${API_BASE_URL}/api/users/progressive-reveal/consent-photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, peer_id: peerId, consent })
  });
  if (!res.ok) throw new Error('Failed to submit photo consent');
  return await res.json();
}

export async function fastForwardProgressiveReveal(userId, peerId, addSeconds = 300) {
  const res = await fetch(`${API_BASE_URL}/api/users/progressive-reveal/fast-forward`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, peer_id: peerId, add_seconds: addSeconds })
  });
  if (!res.ok) throw new Error('Failed to fast forward progressive timer');
  return await res.json();
}

export async function resetProgressiveReveal(userId, peerId) {
  const res = await fetch(`${API_BASE_URL}/api/users/progressive-reveal/reset?user_id=${encodeURIComponent(userId)}&peer_id=${encodeURIComponent(peerId)}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to reset progressive reveal');
  return await res.json();
}

// 8. 🎲 Blind Date Mini Games API Client
export async function fetchMiniGameRounds() {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/mini-games/rounds`);
  if (!res.ok) throw new Error('Failed to fetch mini game rounds');
  return await res.json();
}

export async function fetchMiniGameStatus(userId, peerId) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/mini-games/status?user_id=${encodeURIComponent(userId)}&peer_id=${encodeURIComponent(peerId)}`);
  if (!res.ok) throw new Error('Failed to fetch mini game status');
  return await res.json();
}

export async function submitMiniGameAnswer(userId, peerId, roundIdx, answer) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/mini-games/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, peer_id: peerId, round_idx: roundIdx, answer })
  });
  if (!res.ok) throw new Error('Failed to submit mini game answer');
  return await res.json();
}

export async function nextMiniGameRound(userId, peerId, nextRoundIdx = null) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/mini-games/next-round`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, peer_id: peerId, next_round_idx: nextRoundIdx })
  });
  if (!res.ok) throw new Error('Failed to advance mini game round');
  return await res.json();
}

export async function resetMiniGameSession(userId, peerId) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/mini-games/reset?user_id=${encodeURIComponent(userId)}&peer_id=${encodeURIComponent(peerId)}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to reset mini game session');
  return await res.json();
}

// Full 4-Game Suite Definitions
export async function fetchMiniGamesFullSuite() {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/mini-games/full-suite`);
  if (!res.ok) throw new Error('Failed to fetch mini games suite');
  return await res.json();
}

// Game 2: Two Truths & A Lie
export async function fetchGame2State(userId, peerId) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/mini-games/game2/state?user_id=${encodeURIComponent(userId)}&peer_id=${encodeURIComponent(peerId)}`);
  if (!res.ok) throw new Error('Failed to fetch Game 2 state');
  return await res.json();
}

export async function submitGame2Statements(userId, peerId, statements, lieIndex) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/mini-games/game2/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, peer_id: peerId, statements, lie_index: lieIndex })
  });
  if (!res.ok) throw new Error('Failed to submit Game 2 statements');
  return await res.json();
}

export async function guessGame2Lie(userId, peerId, guessedLieIndex) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/mini-games/game2/guess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, peer_id: peerId, guessed_lie_index: guessedLieIndex })
  });
  if (!res.ok) throw new Error('Failed to submit Game 2 guess');
  return await res.json();
}

// Game 3: Would You Rather
export async function fetchGame3Rounds() {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/mini-games/game3/rounds`);
  if (!res.ok) throw new Error('Failed to fetch Game 3 rounds');
  return await res.json();
}

export async function fetchGame3Status(userId, peerId) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/mini-games/game3/status?user_id=${encodeURIComponent(userId)}&peer_id=${encodeURIComponent(peerId)}`);
  if (!res.ok) throw new Error('Failed to fetch Game 3 status');
  return await res.json();
}

export async function submitGame3Answer(userId, peerId, roundIdx, answer) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/mini-games/game3/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, peer_id: peerId, round_idx: roundIdx, answer })
  });
  if (!res.ok) throw new Error('Failed to submit Game 3 answer');
  return await res.json();
}

// Game 4: Guess Me
export async function fetchGame4Prompts() {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/mini-games/game4/prompts`);
  if (!res.ok) throw new Error('Failed to fetch Game 4 prompts');
  return await res.json();
}

export async function fetchGame4Status(userId, peerId) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/mini-games/game4/status?user_id=${encodeURIComponent(userId)}&peer_id=${encodeURIComponent(peerId)}`);
  if (!res.ok) throw new Error('Failed to fetch Game 4 status');
  return await res.json();
}

export async function submitGame4GuessMe(userId, peerId, promptIdx, myActual, myGuessForPeer) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/mini-games/game4/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      peer_id: peerId,
      prompt_idx: promptIdx,
      my_actual: myActual,
      my_guess_for_peer: myGuessForPeer
    })
  });
  if (!res.ok) throw new Error('Failed to submit Game 4 guess');
  return await res.json();
}

// 9. ❤️ Conversation Chemistry Meter API Client
export async function fetchConversationChemistry(userId, peerId) {
  const res = await fetch(`${API_BASE_URL}/api/chemistry/meter?user_id=${encodeURIComponent(userId)}&peer_id=${encodeURIComponent(peerId)}`);
  if (!res.ok) throw new Error('Failed to fetch conversation chemistry');
  return await res.json();
}

export async function simulateChemistryInteraction(userId, peerId, bonusType = 'reaction') {
  const res = await fetch(`${API_BASE_URL}/api/chemistry/simulate-interaction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, peer_id: peerId, bonus_type: bonusType })
  });
  if (!res.ok) throw new Error('Failed to simulate chemistry interaction');
  return await res.json();
}

// 10. 🎯 Blind Date Missions API Client
export async function fetchMissionsCatalog() {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/missions/catalog`);
  if (!res.ok) throw new Error('Failed to fetch missions catalog');
  return await res.json();
}

export async function fetchActiveMissions(sessionId, userId) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/missions/active?session_id=${encodeURIComponent(sessionId)}&user_id=${encodeURIComponent(userId || '')}`);
  if (!res.ok) throw new Error('Failed to fetch active missions');
  return await res.json();
}

export async function completeMission(sessionId, userId, missionId, note = null) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/missions/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, user_id: userId, mission_id: missionId, note: note })
  });
  if (!res.ok) throw new Error('Failed to complete mission');
  return await res.json();
}

export async function unlockNextMission(sessionId, userId) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/missions/unlock-next`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, user_id: userId })
  });
  if (!res.ok) throw new Error('Failed to unlock next mission');
  return await res.json();
}

export async function resetMissionsSession(sessionId) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date/missions/reset?session_id=${encodeURIComponent(sessionId)}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to reset missions session');
  return await res.json();
}

// 11. 🃏 Question Cards API Client
export async function fetchQuestionCategories() {
  const res = await fetch(`${API_BASE_URL}/api/question-cards/categories`);
  if (!res.ok) throw new Error('Failed to fetch question categories');
  return await res.json();
}

export async function fetchQuestionCards(category = null) {
  const query = category && category !== 'All' ? `?category=${encodeURIComponent(category)}` : '';
  const res = await fetch(`${API_BASE_URL}/api/question-cards/catalog${query}`);
  if (!res.ok) throw new Error('Failed to fetch question cards');
  return await res.json();
}

export async function fetchRandomQuestionCard(category = null) {
  const query = category && category !== 'All' ? `?category=${encodeURIComponent(category)}` : '';
  const res = await fetch(`${API_BASE_URL}/api/question-cards/random${query}`);
  if (!res.ok) throw new Error('Failed to fetch random question card');
  return await res.json();
}

export async function submitQuestionCardAnswer(sessionId, userId, cardId, answer) {
  const res = await fetch(`${API_BASE_URL}/api/question-cards/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, user_id: userId, card_id: cardId, answer: answer })
  });
  if (!res.ok) throw new Error('Failed to submit question card answer');
  return await res.json();
}

// 13. 🖼️ Blind Photo Reveal API Client
export async function fetchBlindPhotoPresets() {
  const res = await fetch(`${API_BASE_URL}/api/blind-photo/presets`);
  if (!res.ok) throw new Error('Failed to fetch blind photo presets');
  return await res.json();
}

export async function createBlindPhoto(uploaderId, sessionId, fullPhotoUrl, previewBlurUrl = null, caption = 'Confidential Photo') {
  const res = await fetch(`${API_BASE_URL}/api/blind-photo/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploader_id: uploaderId,
      session_id: sessionId,
      full_photo_url: fullPhotoUrl,
      preview_blur_url: previewBlurUrl,
      caption: caption,
      auto_consent_uploader: true
    })
  });
  if (!res.ok) throw new Error('Failed to create blind photo');
  return await res.json();
}

export async function fetchBlindPhotoStatus(photoId, userId = '') {
  const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
  const res = await fetch(`${API_BASE_URL}/api/blind-photo/status/${encodeURIComponent(photoId)}${query}`);
  if (!res.ok) throw new Error('Failed to fetch blind photo status');
  return await res.json();
}

export async function submitBlindPhotoConsent(photoId, userId, consent = true) {
  const res = await fetch(`${API_BASE_URL}/api/blind-photo/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      photo_id: photoId,
      user_id: userId,
      consent: consent
    })
  });
  if (!res.ok) throw new Error('Failed to submit blind photo consent');
  return await res.json();
}

export async function resetBlindPhoto(photoId) {
  const res = await fetch(`${API_BASE_URL}/api/blind-photo/reset?photo_id=${encodeURIComponent(photoId)}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to reset blind photo');
  return await res.json();
}

// 14. 🌫️ Blur-to-Reveal Profile API Client
export async function fetchBlurProfileStatus(userId, peerId) {
  const res = await fetch(`${API_BASE_URL}/api/blur-profile/status?user_id=${encodeURIComponent(userId)}&peer_id=${encodeURIComponent(peerId)}`);
  if (!res.ok) throw new Error('Failed to fetch blur profile status');
  return await res.json();
}

export async function submitBlurConsent(userId, peerId, agree = true) {
  const res = await fetch(`${API_BASE_URL}/api/blur-profile/consent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, peer_id: peerId, agree: agree })
  });
  if (!res.ok) throw new Error('Failed to submit blur consent');
  return await res.json();
}

export async function stepBlurStage(userId, peerId, targetStage = null) {
  const res = await fetch(`${API_BASE_URL}/api/blur-profile/step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, peer_id: peerId, target_stage: targetStage })
  });
  if (!res.ok) throw new Error('Failed to step blur stage');
  return await res.json();
}

export async function resetBlurProfile(userId, peerId) {
  const res = await fetch(`${API_BASE_URL}/api/blur-profile/reset?user_id=${encodeURIComponent(userId)}&peer_id=${encodeURIComponent(peerId)}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to reset blur profile');
  return await res.json();
}

// 6. 🛡️ Safety Layer API Client
export async function fetchReportCategories() {
  const res = await fetch(`${API_BASE_URL}/api/safety/report-categories`);
  if (!res.ok) throw new Error('Failed to fetch report categories');
  return await res.json();
}

export async function fetchScreenshotPolicy() {
  const res = await fetch(`${API_BASE_URL}/api/safety/screenshot-policy`);
  if (!res.ok) throw new Error('Failed to fetch screenshot policy');
  return await res.json();
}

export async function submitInstantBlock(userId, targetUserId, roomId = null, reason = 'Instant one-tap block') {
  const res = await fetch(`${API_BASE_URL}/api/safety/instant-block`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      target_user_id: targetUserId,
      room_id: roomId,
      reason: reason
    })
  });
  if (!res.ok) throw new Error('Failed to execute instant block');
  return await res.json();
}

export async function submitSafetyReport(reporterId, targetUserId, category, details = '', roomId = null, autoBlock = true) {
  const res = await fetch(`${API_BASE_URL}/api/safety/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reporter_id: reporterId,
      target_user_id: targetUserId,
      category: category,
      details: details,
      room_id: roomId,
      auto_block: autoBlock
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit safety report');
  }
  return await res.json();
}

export async function reportScreenshotActivity(userId, peerId = null, roomId = null, platform = 'web') {
  const res = await fetch(`${API_BASE_URL}/api/safety/screenshot-warning`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      peer_id: peerId,
      room_id: roomId,
      platform: platform
    })
  });
  if (!res.ok) throw new Error('Failed to log screenshot activity');
  return await res.json();
}

export async function checkContentSafety(text) {
  const res = await fetch(`${API_BASE_URL}/api/safety/check-content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text })
  });
  if (!res.ok) throw new Error('Failed to check content safety');
  return await res.json();
}

export async function fetchBlockedUsers(userId) {
  const res = await fetch(`${API_BASE_URL}/api/safety/blocked-list?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch blocked users');
  return await res.json();
}

export async function unblockUser(userId, targetUserId) {
  const res = await fetch(`${API_BASE_URL}/api/safety/unblock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, target_user_id: targetUserId })
  });
  if (!res.ok) throw new Error('Failed to unblock user');
  return await res.json();
}

// 17. 📍 Approximate Location API Client
export async function fetchCoarseRegions() {
  const res = await fetch(`${API_BASE_URL}/api/location/regions`);
  if (!res.ok) throw new Error('Failed to fetch coarse regions');
  return await res.json();
}

export async function fetchLocationStatus(userId, peerId = null) {
  const url = peerId
    ? `${API_BASE_URL}/api/location/status?user_id=${encodeURIComponent(userId)}&peer_id=${encodeURIComponent(peerId)}`
    : `${API_BASE_URL}/api/location/status?user_id=${encodeURIComponent(userId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch location status');
  return await res.json();
}

export async function toggleLocationSharing(userId, enabled, region = 'Delhi NCR', fuzzedDistanceKm = 8) {
  const res = await fetch(`${API_BASE_URL}/api/location/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      enabled: enabled,
      region: region,
      fuzzed_distance_km: fuzzedDistanceKm
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to toggle location sharing');
  }
  return await res.json();
}

export async function calculatePeerApproximateDistance(userId, peerId, peerRegion = 'Delhi NCR', simulatedKm = 8) {
  const res = await fetch(
    `${API_BASE_URL}/api/location/calculate-peer-distance?user_id=${encodeURIComponent(userId)}&peer_id=${encodeURIComponent(peerId)}&peer_region=${encodeURIComponent(peerRegion)}&simulated_km=${simulatedKm}`,
    { method: 'POST' }
  );
  if (!res.ok) throw new Error('Failed to calculate approximate distance');
  return await res.json();
}

// 18. 🔥 Anonymous Topic Rooms API Client
export async function fetchTopicCategories() {
  const res = await fetch(`${API_BASE_URL}/api/topic-rooms/categories`);
  if (!res.ok) throw new Error('Failed to fetch topic categories');
  return await res.json();
}

export async function fetchTopicRooms(category = null) {
  const url = category && category !== 'all'
    ? `${API_BASE_URL}/api/topic-rooms?category=${encodeURIComponent(category)}`
    : `${API_BASE_URL}/api/topic-rooms`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch topic rooms');
  return await res.json();
}

export async function createTopicRoom({ title, topicCategory, topicIcon = '🔥', description = '', ttlHours = 24 }) {
  const res = await fetch(`${API_BASE_URL}/api/topic-rooms/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title,
      topic_category: topicCategory,
      topic_icon: topicIcon,
      description,
      ttl_hours: ttlHours
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to create topic room');
  }
  return await res.json();
}

export async function joinTopicRoom(roomId, customPseudonym = null) {
  const res = await fetch(`${API_BASE_URL}/api/topic-rooms/${encodeURIComponent(roomId)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      custom_pseudonym: customPseudonym
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to join topic room');
  }
  return await res.json();
}

export async function fetchTopicRoomState(roomId) {
  const res = await fetch(`${API_BASE_URL}/api/topic-rooms/${encodeURIComponent(roomId)}/state`);
  if (!res.ok) throw new Error('Failed to fetch topic room state');
  return await res.json();
}

export async function sendTopicRoomMessage(roomId, { ephemeralId, senderPseudonym, ciphertext, plaintext }) {
  const res = await fetch(`${API_BASE_URL}/api/topic-rooms/${encodeURIComponent(roomId)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ephemeral_id: ephemeralId,
      sender_pseudonym: senderPseudonym,
      ciphertext: ciphertext || `ENC[e2ee_topic:${Date.now()}]`,
      plaintext: plaintext
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to send topic room message');
  }
  return await res.json();
}

export async function leaveTopicRoom(roomId, ephemeralId) {
  const res = await fetch(`${API_BASE_URL}/api/topic-rooms/${encodeURIComponent(roomId)}/leave?ephemeral_id=${encodeURIComponent(ephemeralId)}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to leave topic room');
  return await res.json();
}

export async function burnTopicRoom(roomId) {
  const res = await fetch(`${API_BASE_URL}/api/topic-rooms/${encodeURIComponent(roomId)}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to burn topic room');
  return await res.json();
}

// 19. 🧨 Self-Destruct Conversations API Client
export async function fetchSelfDestructOptions() {
  const res = await fetch(`${API_BASE_URL}/api/self-destruct/options`);
  if (!res.ok) throw new Error('Failed to fetch self-destruct options');
  return await res.json();
}

export async function fetchSelfDestructPolicy(conversationId) {
  const res = await fetch(`${API_BASE_URL}/api/self-destruct/policy/${encodeURIComponent(conversationId)}`);
  if (!res.ok) throw new Error('Failed to fetch conversation self-destruct policy');
  return await res.json();
}

export async function setSelfDestructPolicy({ conversationId, userId, deleteAfterSeconds, retentionLabel }) {
  const res = await fetch(`${API_BASE_URL}/api/self-destruct/policy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_id: conversationId,
      user_id: userId,
      delete_after_seconds: deleteAfterSeconds,
      retention_label: retentionLabel
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update conversation self-destruct policy');
  }
  return await res.json();
}

export async function burnConversationNow({ conversationId, userId }) {
  const res = await fetch(`${API_BASE_URL}/api/self-destruct/burn-now`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversation_id: conversationId,
      user_id: userId
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to burn conversation');
  }
  return await res.json();
}

// 20. 🔐 Secret Chat Mode API Client
export async function fetchSecretModeCharacteristics() {
  const res = await fetch(`${API_BASE_URL}/api/secret-chat/characteristics`);
  if (!res.ok) throw new Error('Failed to fetch Secret Mode characteristics');
  return await res.json();
}

export async function initSecretChatSession({ userId, peerId, ttlSeconds = 1800, disappearingSeconds = 30, tempPublicKey = null }) {
  const res = await fetch(`${API_BASE_URL}/api/secret-chat/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      peer_id: peerId,
      ttl_seconds: ttlSeconds,
      disappearing_seconds: disappearingSeconds,
      temp_public_key: tempPublicKey
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to initialize Secret Chat session');
  }
  return await res.json();
}

export async function fetchSecretChatStatus(secretSessionId) {
  const res = await fetch(`${API_BASE_URL}/api/secret-chat/${encodeURIComponent(secretSessionId)}`);
  if (!res.ok) throw new Error('Failed to fetch Secret Chat session status');
  return await res.json();
}

export async function fetchActiveSecretChatBetween(userA, userB) {
  const res = await fetch(`${API_BASE_URL}/api/secret-chat/active-between/${encodeURIComponent(userA)}/${encodeURIComponent(userB)}`);
  if (!res.ok) return { has_active_session: false };
  return await res.json();
}

export async function reportSecretScreenshotAlert(secretSessionId, reporterId) {
  const res = await fetch(`${API_BASE_URL}/api/secret-chat/screenshot-alert?secret_session_id=${encodeURIComponent(secretSessionId)}&reporter_id=${encodeURIComponent(reporterId)}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to report screenshot alert');
  return await res.json();
}

export async function terminateSecretChatSession({ secretSessionId, userId }) {
  const res = await fetch(`${API_BASE_URL}/api/secret-chat/terminate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret_session_id: secretSessionId,
      user_id: userId
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to terminate Secret Chat');
  }
  return await res.json();
}

// 22. 🧬 Anonymous Personality Card API Client
export async function fetchPersonalityCardOptions() {
  const res = await fetch(`${API_BASE_URL}/api/personality-card/options`);
  if (!res.ok) throw new Error('Failed to fetch personality card options');
  return await res.json();
}

export async function fetchUserPersonalityCard(userId) {
  const res = await fetch(`${API_BASE_URL}/api/personality-card/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch user personality card');
  return await res.json();
}

export async function fetchPeerMysteryProfile(peerId) {
  const res = await fetch(`${API_BASE_URL}/api/personality-card/peer/${encodeURIComponent(peerId)}`);
  if (!res.ok) throw new Error('Failed to fetch peer mystery profile');
  return await res.json();
}

export async function updateUserPersonalityCard(userId, updateData) {
  const res = await fetch(`${API_BASE_URL}/api/personality-card/${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updateData)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update personality card');
  }
  return await res.json();
}

// 23. 🌌 Random Universe Matching API Client
export async function scanUniverseRadar(userId = null) {
  const url = userId
    ? `${API_BASE_URL}/api/universe/radar?user_id=${encodeURIComponent(userId)}`
    : `${API_BASE_URL}/api/universe/radar`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to scan universe radar');
  return await res.json();
}

export async function enterUniverseMatching(userId) {
  const res = await fetch(`${API_BASE_URL}/api/universe/enter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to enter universe matching');
  }
  return await res.json();
}

export async function connectUniverseStar(userId, starId) {
  const res = await fetch(`${API_BASE_URL}/api/universe/connect-star`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, star_id: starId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to connect with star node');
  }
  return await res.json();
}

// 24. ⚡ Instant 5-Minute Date API Client
export async function fetchInstantDateManifest() {
  const res = await fetch(`${API_BASE_URL}/api/instant-date/manifest`);
  if (!res.ok) throw new Error('Failed to fetch Instant Date manifest');
  return await res.json();
}

export async function syncUserIdentity(identityDoc) {
  if (!identityDoc || !identityDoc.user_id) return null;
  const res = await fetch(`${API_BASE_URL}/api/auth/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: identityDoc.user_id,
      pseudonym: identityDoc.pseudonym,
      ed25519_identity_pub: identityDoc.identityKP?.publicKeyHex,
      x25519_signed_prekey: identityDoc.signedPrekey?.publicKeyHex,
      signed_prekey_sig: identityDoc.signedPrekey?.signatureHex,
      one_time_prekeys: (identityDoc.oneTimePrekeys || []).map(k => k.publicKeyHex),
      profile: identityDoc.profile
    })
  });
  return await res.json().catch(() => ({}));
}

export async function startInstant5MinDate(userId) {
  const res = await fetch(`${API_BASE_URL}/api/instant-date/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to start 5-minute date');
  }
  return await res.json();
}

export async function cancelInstantDateQueue(userId) {
  const res = await fetch(`${API_BASE_URL}/api/instant-date/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  });
  return await res.json().catch(() => ({}));
}

export async function fetchInstantDateRoom(roomId) {
  const res = await fetch(`${API_BASE_URL}/api/instant-date/room/${encodeURIComponent(roomId)}`);
  if (!res.ok) throw new Error('Failed to fetch 5-minute date room status');
  return await res.json();
}

export async function sendInstantDateMessage(roomId, userId, text) {
  const res = await fetch(`${API_BASE_URL}/api/instant-date/room/${encodeURIComponent(roomId)}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room_id: roomId, user_id: userId, text })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to send message in 5-minute date');
  }
  return await res.json();
}

export async function submitInstantDateDecision(roomId, userId, decision) {
  const res = await fetch(`${API_BASE_URL}/api/instant-date/room/${encodeURIComponent(roomId)}/decision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room_id: roomId, user_id: userId, decision })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit 5-minute date decision');
  }
  return await res.json();
}

// 25. 🔄 Second Chance API Client
export async function fetchSecondChanceManifest() {
  const res = await fetch(`${API_BASE_URL}/api/second-chance/manifest`);
  if (!res.ok) throw new Error('Failed to fetch Second Chance manifest');
  return await res.json();
}

export async function fetchSecondChanceList(userId) {
  const res = await fetch(`${API_BASE_URL}/api/second-chance/list?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch Second Chance connections');
  return await res.json();
}

export async function placeInSecondChance(userId, peerId, peerPseudonym = null, source = 'blind_date', sourceRoomId = null) {
  const res = await fetch(`${API_BASE_URL}/api/second-chance/place`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      peer_id: peerId,
      peer_pseudonym: peerPseudonym,
      source: source,
      source_room_id: sourceRoomId
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to place connection into Second Chance');
  }
  return await res.json();
}

export async function reopenSecondChanceConnection(secondChanceId, userId, simulatePeerReopen = false) {
  const res = await fetch(`${API_BASE_URL}/api/second-chance/reopen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      second_chance_id: secondChanceId,
      user_id: userId,
      simulate_peer_reopen: simulatePeerReopen
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to reopen Second Chance connection');
  }
  return await res.json();
}

export async function archiveSecondChanceConnection(secondChanceId, userId) {
  const res = await fetch(`${API_BASE_URL}/api/second-chance/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      second_chance_id: secondChanceId,
      user_id: userId
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to archive Second Chance connection');
  }
  return await res.json();
}

// 26. 🧠 Smart Matchmaking API Client
export async function fetchSmartMatchmakingManifest() {
  const res = await fetch(`${API_BASE_URL}/api/smart-matchmaking/manifest`);
  if (!res.ok) throw new Error('Failed to fetch Smart Matchmaking manifest');
  return await res.json();
}

export async function fetchSmartMatchmakingProfile(userId) {
  const res = await fetch(`${API_BASE_URL}/api/smart-matchmaking/profile/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch user matchmaking profile');
  return await res.json();
}

export async function updateSmartMatchmakingProfile(userId, controls, preferences) {
  const res = await fetch(`${API_BASE_URL}/api/smart-matchmaking/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      controls: controls,
      preferences: preferences
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update Smart Matchmaking profile');
  }
  return await res.json();
}

export async function searchSmartMatches(userId, limit = 5) {
  const res = await fetch(`${API_BASE_URL}/api/smart-matchmaking/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      limit: limit
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to search smart matches');
  }
  return await res.json();
}

// 27. 🏆 Blind Date XP API Client
export async function fetchXPManifest() {
  const res = await fetch(`${API_BASE_URL}/api/blind-date-xp/manifest`);
  if (!res.ok) throw new Error('Failed to fetch Blind Date XP manifest');
  return await res.json();
}

export async function fetchUserXPProfile(userId) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date-xp/profile/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch user XP profile');
  return await res.json();
}

export async function awardUserXP(userId, actionType, customXp = null) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date-xp/add-xp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      action_type: actionType,
      custom_xp: customXp
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to award XP');
  }
  return await res.json();
}

export async function unlockUserAchievement(userId, achievementId) {
  const res = await fetch(`${API_BASE_URL}/api/blind-date-xp/unlock-achievement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      achievement_id: achievementId
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to unlock achievement');
  }
  return await res.json();
}

// 28. 🔥 Daily Mystery Drop API Client
export async function fetchDailyMysteryDropManifest() {
  const res = await fetch(`${API_BASE_URL}/api/daily-mystery-drop/manifest`);
  if (!res.ok) throw new Error('Failed to fetch Daily Mystery Drop manifest');
  return await res.json();
}

export async function fetchDailyMysteryDropStatus(userId) {
  const res = await fetch(`${API_BASE_URL}/api/daily-mystery-drop/status/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch daily mystery drop status');
  return await res.json();
}

export async function openDailyMysteryDrop(userId) {
  const res = await fetch(`${API_BASE_URL}/api/daily-mystery-drop/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to open daily mystery drop');
  }
  return await res.json();
}

export async function connectDailyMysteryDrop(userId, dropId) {
  const res = await fetch(`${API_BASE_URL}/api/daily-mystery-drop/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, drop_id: dropId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to connect with mystery drop');
  }
  return await res.json();
}

export async function passDailyMysteryDrop(userId, dropId) {
  const res = await fetch(`${API_BASE_URL}/api/daily-mystery-drop/pass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, drop_id: dropId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to pass on daily mystery drop');
  }
  return await res.json();
}

export async function resetDailyMysteryDropDemo(userId) {
  const res = await fetch(`${API_BASE_URL}/api/daily-mystery-drop/reset-demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  });
  if (!res.ok) throw new Error('Failed to reset daily mystery drop demo');
  return await res.json();
}

// 29. 🕰️ Scheduled Blind Date API Client
export async function fetchScheduledDateManifest() {
  const res = await fetch(`${API_BASE_URL}/api/scheduled-blind-date/manifest`);
  if (!res.ok) throw new Error('Failed to fetch Scheduled Blind Date manifest');
  return await res.json();
}

export async function fetchScheduledDateSlots() {
  const res = await fetch(`${API_BASE_URL}/api/scheduled-blind-date/slots`);
  if (!res.ok) throw new Error('Failed to fetch scheduled date slots');
  return await res.json();
}

export async function fetchScheduledDateStatus(userId) {
  const res = await fetch(`${API_BASE_URL}/api/scheduled-blind-date/status/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch scheduled date status');
  return await res.json();
}

export async function bookScheduledDate(userId, day = 'Tonight', time = '9:00 PM', demoCountdown = null) {
  const res = await fetch(`${API_BASE_URL}/api/scheduled-blind-date/book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      scheduled_day: day,
      scheduled_time: time,
      demo_countdown_seconds: demoCountdown
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to book scheduled blind date');
  }
  return await res.json();
}

export async function enterScheduledDate(userId, bookingId) {
  const res = await fetch(`${API_BASE_URL}/api/scheduled-blind-date/enter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, booking_id: bookingId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to enter scheduled blind date');
  }
  return await res.json();
}

export async function cancelScheduledDate(userId, bookingId) {
  const res = await fetch(`${API_BASE_URL}/api/scheduled-blind-date/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, booking_id: bookingId })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to cancel scheduled blind date');
  }
  return await res.json();
}

export async function setTestScheduledCountdown(bookingId, seconds = 261) {
  const res = await fetch(`${API_BASE_URL}/api/scheduled-blind-date/test-countdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ booking_id: bookingId, countdown_seconds: seconds })
  });
  if (!res.ok) throw new Error('Failed to set test countdown');
  return await res.json();
}

// 30. 💎 Date Memory API Client
export async function fetchDateMemoryManifest() {
  const res = await fetch(`${API_BASE_URL}/api/date-memory/manifest`);
  if (!res.ok) throw new Error('Failed to fetch Date Memory manifest');
  return await res.json();
}

export async function fetchDateMemoriesList(userId) {
  const res = await fetch(`${API_BASE_URL}/api/date-memory/list/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Failed to fetch date memories');
  return await res.json();
}

export async function createDateMemory(userId, peerId, peerPseudonym, topics, gamesCount, durationMinutes, mutualReveal, notes = null) {
  const res = await fetch(`${API_BASE_URL}/api/date-memory/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      peer_id: peerId,
      peer_pseudonym: peerPseudonym,
      topics: topics,
      games_count: gamesCount,
      date_duration_minutes: durationMinutes,
      mutual_reveal: mutualReveal,
      encrypted_notes: notes
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to save date memory');
  }
  return await res.json();
}

export async function updateDateMemoryNotes(userId, memoryId, encryptedNotes) {
  const res = await fetch(`${API_BASE_URL}/api/date-memory/update-notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      memory_id: memoryId,
      encrypted_notes: encryptedNotes
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update date memory notes');
  }
  return await res.json();
}

export async function deleteDateMemory(userId, memoryId) {
  const res = await fetch(`${API_BASE_URL}/api/date-memory/${encodeURIComponent(memoryId)}?user_id=${encodeURIComponent(userId)}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to delete date memory');
  }
  return await res.json();
}

export async function resetDateMemoryDemo(userId) {
  const res = await fetch(`${API_BASE_URL}/api/date-memory/reset-demo?user_id=${encodeURIComponent(userId)}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to reset date memories demo');
  return await res.json();
}

// 🏗️ Recommended Technical Architecture API Client
export async function fetchArchitectureBlueprint() {
  const res = await fetch(`${API_BASE_URL}/api/architecture/blueprint`);
  if (!res.ok) throw new Error('Failed to fetch architecture blueprint');
  return await res.json();
}












