import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput
} from 'react-native';

import {
  fetchMiniGameRounds,
  fetchMiniGameStatus,
  submitMiniGameAnswer,
  nextMiniGameRound,
  resetMiniGameSession,
  fetchGame2State,
  submitGame2Statements,
  guessGame2Lie,
  fetchGame3Rounds,
  fetchGame3Status,
  submitGame3Answer,
  fetchGame4Prompts,
  fetchGame4Status,
  submitGame4GuessMe
} from '../services/api';

export function MiniGamesModal({
  visible,
  onClose,
  currentUserId,
  peerUserId,
  peerName = 'Partner',
  onSelectTopic
}) {
  const [activeGame, setActiveGame] = useState('game1'); // 'game1' | 'game2' | 'game3' | 'game4'
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ==========================================
  // GAME 1: THIS OR THAT STATE
  // ==========================================
  const [g1Deck, setG1Deck] = useState(null);
  const [g1Status, setG1Status] = useState(null);
  const [g1SelectedOption, setG1SelectedOption] = useState(null);

  // ==========================================
  // GAME 2: TWO TRUTHS & A LIE STATE
  // ==========================================
  const [g2State, setG2State] = useState(null);
  const [g2Statements, setG2Statements] = useState([
    "I've travelled alone.",
    "I hate coffee.",
    "I've broken a bone."
  ]);
  const [g2LieIndex, setG2LieIndex] = useState(1); // default "I hate coffee."
  const [g2GuessedIndex, setG2GuessedIndex] = useState(null);

  // ==========================================
  // GAME 3: WOULD YOU RATHER STATE
  // ==========================================
  const [g3Status, setG3Status] = useState(null);
  const [g3SelectedOption, setG3SelectedOption] = useState(null);

  // ==========================================
  // GAME 4: GUESS ME STATE
  // ==========================================
  const [g4Status, setG4Status] = useState(null);
  const [g4MyActual, setG4MyActual] = useState('Horror');
  const [g4MyGuess, setG4MyGuess] = useState('Horror');

  useEffect(() => {
    if (visible && currentUserId && peerUserId) {
      loadGameData(activeGame);
    }
  }, [visible, activeGame, currentUserId, peerUserId]);

  async function loadGameData(gameId) {
    setLoading(true);
    try {
      if (gameId === 'game1') {
        const [d, s] = await Promise.all([
          fetchMiniGameRounds(),
          fetchMiniGameStatus(currentUserId, peerUserId)
        ]);
        setG1Deck(d);
        setG1Status(s);
        setG1SelectedOption(s.my_answer);
      } else if (gameId === 'game2') {
        const s = await fetchGame2State(currentUserId, peerUserId);
        setG2State(s);
        if (s.my_statements && s.my_statements.length === 3) {
          setG2Statements(s.my_statements);
          setG2LieIndex(s.my_lie_index ?? 1);
        }
      } else if (gameId === 'game3') {
        const s = await fetchGame3Status(currentUserId, peerUserId);
        setG3Status(s);
        setG3SelectedOption(s.my_answer);
      } else if (gameId === 'game4') {
        const s = await fetchGame4Status(currentUserId, peerUserId);
        setG4Status(s);
        if (s.my_actual) setG4MyActual(s.my_actual);
        if (s.my_guess) setG4MyGuess(s.my_guess);
      }
    } catch (err) {
      console.warn('Mini games load error:', err);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // GAME 1 HANDLERS
  // ==========================================
  async function handleG1Answer(option) {
    if (submitting || (g1Status?.both_answered && g1Status?.my_answer)) return;
    setG1SelectedOption(option);
    setSubmitting(true);
    try {
      const res = await submitMiniGameAnswer(
        currentUserId,
        peerUserId,
        g1Status?.round_idx || 0,
        option
      );
      setG1Status((prev) => ({
        ...prev,
        my_answer: res.my_answer,
        both_answered: res.both_answered,
        peer_answer: res.peer_answer,
        is_match: res.is_match,
        spark_topic: res.spark_topic
      }));
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleG1NextRound() {
    setSubmitting(true);
    try {
      await nextMiniGameRound(currentUserId, peerUserId);
      const s = await fetchMiniGameStatus(currentUserId, peerUserId);
      setG1Status(s);
      setG1SelectedOption(null);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleG1Reset() {
    setSubmitting(true);
    try {
      await resetMiniGameSession(currentUserId, peerUserId);
      const s = await fetchMiniGameStatus(currentUserId, peerUserId);
      setG1Status(s);
      setG1SelectedOption(null);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ==========================================
  // GAME 2 HANDLERS
  // ==========================================
  async function handleG2SubmitStatements() {
    if (g2Statements.some((s) => !s.trim())) {
      Alert.alert('Incomplete', 'Please provide all 3 statements.');
      return;
    }
    setSubmitting(true);
    try {
      await submitGame2Statements(currentUserId, peerUserId, g2Statements, g2LieIndex);
      const updated = await fetchGame2State(currentUserId, peerUserId);
      setG2State(updated);
      Alert.alert('Statements Sealed! 🔒', 'Your 2 truths and 1 lie have been saved. Now guess your match\'s lie!');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleG2GuessLie(idx) {
    setG2GuessedIndex(idx);
    setSubmitting(true);
    try {
      const res = await guessGame2Lie(currentUserId, peerUserId, idx);
      const updated = await fetchGame2State(currentUserId, peerUserId);
      setG2State(updated);
      Alert.alert(
        res.is_correct ? '🎯 Lie Detected!' : '🎭 Fooled You!',
        res.reveal_text
      );
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ==========================================
  // GAME 3 HANDLERS
  // ==========================================
  async function handleG3Answer(option) {
    if (submitting || (g3Status?.both_answered && g3Status?.my_answer)) return;
    setG3SelectedOption(option);
    setSubmitting(true);
    try {
      const res = await submitGame3Answer(
        currentUserId,
        peerUserId,
        g3Status?.round_idx || 0,
        option
      );
      setG3Status((prev) => ({
        ...prev,
        my_answer: res.my_answer,
        both_answered: res.both_answered,
        peer_answer: res.peer_answer,
        is_match: res.is_match,
        spark_topic: res.spark_topic
      }));
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ==========================================
  // GAME 4 HANDLERS
  // ==========================================
  async function handleG4Submit() {
    setSubmitting(true);
    try {
      const res = await submitGame4GuessMe(
        currentUserId,
        peerUserId,
        g4Status?.prompt_idx || 0,
        g4MyActual,
        g4MyGuess
      );
      const updated = await fetchGame4Status(currentUserId, peerUserId);
      setG4Status(updated);
      Alert.alert(
        res.is_correct ? '😳 Mind Reader! (+10 Chemistry)' : 'Close Call!',
        res.reveal_card?.formatted_text || `Your guess: ${g4MyGuess}`
      );
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSendTopic(topic) {
    if (onSelectTopic && topic) {
      onSelectTopic(topic);
      onClose();
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header Bar */}
          <View style={styles.modalHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerIcon}>🎲</Text>
              <View>
                <Text style={styles.headerTitle}>Blind Date Mini Games</Text>
                <Text style={styles.headerSubtitle}>
                  Instead of saying "Hi" — play activities with {peerName}!
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* 4 Games Navigation Bar */}
          <View style={styles.gameTabsBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
              <TouchableOpacity
                style={[styles.gameTab, activeGame === 'game1' && styles.gameTabActive]}
                onPress={() => setActiveGame('game1')}
              >
                <Text style={[styles.gameTabText, activeGame === 'game1' && styles.gameTabTextActive]}>
                  🍕 1. This or That
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.gameTab, activeGame === 'game2' && styles.gameTabActive]}
                onPress={() => setActiveGame('game2')}
              >
                <Text style={[styles.gameTabText, activeGame === 'game2' && styles.gameTabTextActive]}>
                  🤥 2. Two Truths & A Lie
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.gameTab, activeGame === 'game3' && styles.gameTabActive]}
                onPress={() => setActiveGame('game3')}
              >
                <Text style={[styles.gameTabText, activeGame === 'game3' && styles.gameTabTextActive]}>
                  🌍 3. Would You Rather
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.gameTab, activeGame === 'game4' && styles.gameTabActive]}
                onPress={() => setActiveGame('game4')}
              >
                <Text style={[styles.gameTabText, activeGame === 'game4' && styles.gameTabTextActive]}>
                  🔮 4. Guess Me
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#F43F5E" />
              <Text style={styles.loadingText}>Syncing game chamber with {peerName}...</Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
              {/* ========================================== */}
              {/* GAME 1: THIS OR THAT                       */}
              {/* ========================================== */}
              {activeGame === 'game1' && (() => {
                const currentRound = g1Status?.current_round || g1Deck?.rounds?.[0] || {
                  title: '🎲 Game 1 — This or That • Round 1',
                  question: 'Pizza 🍕 or Burger 🍔?',
                  options: ['🍕 Pizza', '🍔 Burger'],
                  match_topic: "You both chose Pizza 🍕! Deep dish or thin crust — what's your ultimate topping combination?",
                  clash_topic: 'Playful food clash! Can a smash burger ever beat a fresh hot slice of pizza?',
                  chemistry_boost: 20
                };
                const hasMyAnswer = Boolean(g1Status?.my_answer || g1SelectedOption);
                const bothAnswered = Boolean(g1Status?.both_answered);
                const isMatch = Boolean(g1Status?.is_match);

                return (
                  <View style={styles.gameContainer}>
                    <View style={styles.gameIntroBadge}>
                      <Text style={styles.gameIntroBadgeText}>GAME 1 — THIS OR THAT</Text>
                    </View>
                    <Text style={styles.dilemmaQuestion}>{currentRound.question}</Text>
                    <Text style={styles.dilemmaSub}>
                      Both answer simultaneously. Choices remain sealed until both submit!
                    </Text>

                    {/* Dilemma Option Cards */}
                    <View style={styles.dilemmaGrid}>
                      {currentRound.options?.map((opt, oIdx) => {
                        const isChosen = (g1Status?.my_answer || g1SelectedOption) === opt;
                        return (
                          <TouchableOpacity
                            key={oIdx}
                            style={[styles.dilemmaCard, isChosen && styles.dilemmaCardChosen]}
                            onPress={() => handleG1Answer(opt)}
                            disabled={submitting || (bothAnswered && hasMyAnswer)}
                          >
                            <Text style={styles.dilemmaEmoji}>{opt.split(' ')[0]}</Text>
                            <Text style={[styles.dilemmaLabel, isChosen && styles.dilemmaLabelChosen]}>
                              {opt}
                            </Text>
                            {isChosen && (
                              <View style={styles.chosenTag}>
                                <Text style={styles.chosenTagText}>✓ My Pick</Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Sealing Status Card */}
                    {hasMyAnswer && !bothAnswered && (
                      <View style={styles.sealedCard}>
                        <Text style={styles.sealedIcon}>🔒</Text>
                        <Text style={styles.sealedTitle}>Answer Cryptographically Sealed!</Text>
                        <Text style={styles.sealedText}>
                          Your choice is locked in. Waiting for {peerName} to choose... Once both submit, results unveil simultaneously!
                        </Text>
                      </View>
                    )}

                    {/* Simultaneous Unsealed Reveal */}
                    {bothAnswered && (
                      <View style={[styles.revealBox, isMatch ? styles.matchBox : styles.clashBox]}>
                        <View style={styles.revealHeaderRow}>
                          <Text style={styles.revealEmoji}>{isMatch ? '💖' : '⚡'}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.revealTitle}>
                              {isMatch ? 'Mutual Resonance Match!' : 'Playful Food & Vibe Clash!'}
                            </Text>
                            <Text style={styles.revealSub}>
                              {isMatch
                                ? `Both of you chose ${g1Status.my_answer}! (+${currentRound.chemistry_boost}% Chemistry)`
                                : `You: ${g1Status.my_answer} • ${peerName}: ${g1Status.peer_answer}`}
                            </Text>
                          </View>
                        </View>

                        {g1Status.spark_topic && (
                          <View style={styles.sparkTopicCard}>
                            <Text style={styles.sparkTopicLabel}>UNLOCKED CONVERSATION TOPIC:</Text>
                            <Text style={styles.sparkTopicText}>"{g1Status.spark_topic}"</Text>
                            <TouchableOpacity
                              style={styles.sendTopicBtn}
                              onPress={() => handleSendTopic(g1Status.spark_topic)}
                            >
                              <Text style={styles.sendTopicBtnText}>💬 Send Topic to Chat ➔</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Bottom Action Controls */}
                    <View style={styles.roundActionRow}>
                      <TouchableOpacity style={styles.roundBtn} onPress={handleG1NextRound} disabled={submitting}>
                        <Text style={styles.roundBtnText}>Next Dilemma Round ➔</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.resetBtn} onPress={handleG1Reset} disabled={submitting}>
                        <Text style={styles.resetBtnText}>Restart at Pizza vs Burger 🍕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })()}

              {/* ========================================== */}
              {/* GAME 2: TWO TRUTHS & A LIE                 */}
              {/* ========================================== */}
              {activeGame === 'game2' && (
                <View style={styles.gameContainer}>
                  <View style={styles.gameIntroBadge}>
                    <Text style={styles.gameIntroBadgeText}>GAME 2 — TWO TRUTHS & A LIE</Text>
                  </View>
                  <Text style={styles.dilemmaQuestion}>Two Truths & A Lie</Text>
                  <Text style={styles.dilemmaSub}>
                    Submit 3 statements about yourself (2 true, 1 lie). The other person guesses which one is the lie!
                  </Text>

                  {/* Phase 1: Submit your 3 statements */}
                  <View style={styles.game2Section}>
                    <Text style={styles.sectionHeaderTitle}>1. Your 3 Statements (Pick which is your Lie):</Text>
                    {g2Statements.map((stmt, idx) => {
                      const isLie = g2LieIndex === idx;
                      return (
                        <View key={idx} style={[styles.stmtInputCard, isLie && styles.stmtInputCardLie]}>
                          <View style={styles.stmtHeaderRow}>
                            <Text style={styles.stmtIndexText}>{idx + 1}.</Text>
                            <TouchableOpacity
                              style={[styles.lieTagBtn, isLie && styles.lieTagBtnActive]}
                              onPress={() => setG2LieIndex(idx)}
                            >
                              <Text style={[styles.lieTagBtnText, isLie && styles.lieTagBtnTextActive]}>
                                {isLie ? '🤥 THIS IS MY LIE' : 'Truth'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                          <TextInput
                            style={styles.stmtInput}
                            value={stmt}
                            onChangeText={(text) => {
                              const updated = [...g2Statements];
                              updated[idx] = text;
                              setG2Statements(updated);
                            }}
                            placeholder={`Statement #${idx + 1}`}
                            placeholderTextColor="#64748B"
                          />
                        </View>
                      );
                    })}

                    <TouchableOpacity
                      style={styles.submitStatementsBtn}
                      onPress={handleG2SubmitStatements}
                      disabled={submitting}
                    >
                      <Text style={styles.submitStatementsBtnText}>
                        {g2State?.has_my_submission ? '✓ Update My Statements 🔒' : '🔒 Submit My Statements'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Phase 2: Guess peer's lie */}
                  <View style={styles.game2Section}>
                    <Text style={styles.sectionHeaderTitle}>2. Guess {peerName}'s Lie:</Text>
                    {g2State?.has_peer_submitted && g2State?.peer_statements ? (
                      <View>
                        {g2State.peer_statements.map((stmt, idx) => {
                          const hasGuessed = g2State?.has_user_guessed;
                          const wasGuessed = g2GuessedIndex === idx || g2State?.my_guess === idx;
                          const isActualLie = g2State?.peer_lie_revealed === idx;

                          let cardBorder = styles.guessCard;
                          if (hasGuessed) {
                            if (isActualLie) cardBorder = styles.guessCardActualLie;
                            else if (wasGuessed) cardBorder = styles.guessCardWrongGuess;
                          }

                          return (
                            <TouchableOpacity
                              key={idx}
                              style={[cardBorder, wasGuessed && !hasGuessed && styles.guessCardSelected]}
                              onPress={() => handleG2GuessLie(idx)}
                              disabled={submitting || hasGuessed}
                            >
                              <View style={styles.stmtHeaderRow}>
                                <Text style={styles.guessNumber}>Statement {idx + 1}</Text>
                                {hasGuessed && isActualLie && (
                                  <View style={styles.actualLieBadge}>
                                    <Text style={styles.actualLieBadgeText}>🤥 ACTUAL LIE</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={styles.guessText}>"{stmt}"</Text>
                              {!hasGuessed && (
                                <Text style={styles.tapToGuessNotice}>Tap to guess this is the lie ➔</Text>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={styles.waitingNotice}>
                        <Text style={styles.waitingNoticeText}>
                          ⏳ Waiting for {peerName} to submit their 3 statements...
                        </Text>
                      </View>
                    )}

                    {/* Result / Reveal Banner */}
                    {g2State?.has_user_guessed && (
                      <View style={[styles.revealBox, g2State.is_user_correct ? styles.matchBox : styles.clashBox]}>
                        <Text style={styles.revealTitle}>
                          {g2State.is_user_correct ? '🎯 Lie Detected! (+10 Chemistry)' : '🎭 You Got Fooled! (+5 Chemistry)'}
                        </Text>
                        <Text style={styles.revealSub}>
                          {g2State.is_user_correct
                            ? `You saw right through statement #${(g2State.peer_lie_revealed ?? 0) + 1}!`
                            : `Statement #${(g2State.peer_lie_revealed ?? 0) + 1} was the actual lie!`}
                        </Text>
                        {g2State.spark_topic && (
                          <View style={styles.sparkTopicCard}>
                            <Text style={styles.sparkTopicLabel}>UNLOCKED TOPIC:</Text>
                            <Text style={styles.sparkTopicText}>"{g2State.spark_topic}"</Text>
                            <TouchableOpacity
                              style={styles.sendTopicBtn}
                              onPress={() => handleSendTopic(g2State.spark_topic)}
                            >
                              <Text style={styles.sendTopicBtnText}>💬 Send Topic to Chat ➔</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* ========================================== */}
              {/* GAME 3: WOULD YOU RATHER                   */}
              {/* ========================================== */}
              {activeGame === 'game3' && (() => {
                const currentRound = g3Status?.current_round || {
                  question: 'Would you rather:',
                  option_a: '🌍 Travel the world',
                  option_b: '🏠 Live in your dream city',
                  options: ['🌍 Travel the world', '🏠 Live in your dream city'],
                  match_topic_a: 'You both chose to travel the world 🌍! Which country or continent is first on your bucket list?',
                  clash_topic: 'Wanderlust vs Roots! One wants to travel the world 🌍 while the other wants their dream sanctuary 🏠.',
                  chemistry_boost: 10
                };
                const hasMyAnswer = Boolean(g3Status?.my_answer || g3SelectedOption);
                const bothAnswered = Boolean(g3Status?.both_answered);
                const isMatch = Boolean(g3Status?.is_match);

                return (
                  <View style={styles.gameContainer}>
                    <View style={styles.gameIntroBadge}>
                      <Text style={styles.gameIntroBadgeText}>GAME 3 — WOULD YOU RATHER</Text>
                    </View>
                    <Text style={styles.dilemmaQuestion}>{currentRound.question}</Text>

                    <View style={styles.wyrGrid}>
                      <TouchableOpacity
                        style={[
                          styles.wyrCard,
                          (g3Status?.my_answer || g3SelectedOption) === currentRound.option_a && styles.dilemmaCardChosen
                        ]}
                        onPress={() => handleG3Answer(currentRound.option_a)}
                        disabled={submitting || (bothAnswered && hasMyAnswer)}
                      >
                        <Text style={styles.wyrEmoji}>🌍</Text>
                        <Text style={styles.wyrText}>{currentRound.option_a}</Text>
                        {(g3Status?.my_answer || g3SelectedOption) === currentRound.option_a && (
                          <View style={styles.chosenTag}>
                            <Text style={styles.chosenTagText}>✓ Chosen</Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      <View style={styles.wyrDivider}>
                        <Text style={styles.wyrDividerText}>OR</Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.wyrCard,
                          (g3Status?.my_answer || g3SelectedOption) === currentRound.option_b && styles.dilemmaCardChosen
                        ]}
                        onPress={() => handleG3Answer(currentRound.option_b)}
                        disabled={submitting || (bothAnswered && hasMyAnswer)}
                      >
                        <Text style={styles.wyrEmoji}>🏠</Text>
                        <Text style={styles.wyrText}>{currentRound.option_b}</Text>
                        {(g3Status?.my_answer || g3SelectedOption) === currentRound.option_b && (
                          <View style={styles.chosenTag}>
                            <Text style={styles.chosenTagText}>✓ Chosen</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>

                    {hasMyAnswer && !bothAnswered && (
                      <View style={styles.sealedCard}>
                        <Text style={styles.sealedIcon}>🔒</Text>
                        <Text style={styles.sealedTitle}>Choice Sealed!</Text>
                        <Text style={styles.sealedText}>
                          Waiting for {peerName} to pick... Choices reveal simultaneously.
                        </Text>
                      </View>
                    )}

                    {bothAnswered && (
                      <View style={[styles.revealBox, isMatch ? styles.matchBox : styles.clashBox]}>
                        <Text style={styles.revealTitle}>
                          {isMatch ? 'Resonance Match! (+10 Chemistry)' : 'Perspective Contrast!'}
                        </Text>
                        <Text style={styles.revealSub}>
                          You: {g3Status.my_answer} • {peerName}: {g3Status.peer_answer}
                        </Text>

                        {g3Status.spark_topic && (
                          <View style={styles.sparkTopicCard}>
                            <Text style={styles.sparkTopicLabel}>UNLOCKED TOPIC:</Text>
                            <Text style={styles.sparkTopicText}>"{g3Status.spark_topic}"</Text>
                            <TouchableOpacity
                              style={styles.sendTopicBtn}
                              onPress={() => handleSendTopic(g3Status.spark_topic)}
                            >
                              <Text style={styles.sendTopicBtnText}>💬 Send Topic to Chat ➔</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* ========================================== */}
              {/* GAME 4: GUESS ME                           */}
              {/* ========================================== */}
              {activeGame === 'game4' && (() => {
                const genres = ['Horror', 'Sci-Fi', 'Romance', 'Comedy', 'Thriller', 'Fantasy'];
                const reveal = g4Status?.reveal_card;

                return (
                  <View style={styles.gameContainer}>
                    <View style={styles.gameIntroBadge}>
                      <Text style={styles.gameIntroBadgeText}>GAME 4 — GUESS ME</Text>
                    </View>
                    <Text style={styles.dilemmaQuestion}>Guess your match's favourite genre.</Text>
                    <Text style={styles.dilemmaSub}>
                      Submit your true preference and guess your match's! Match them to score +10 Chemistry!
                    </Text>

                    {/* Step A: Your actual */}
                    <View style={styles.guessMeSection}>
                      <Text style={styles.guessMeLabel}>1. Your actual favourite genre:</Text>
                      <View style={styles.genreChipsRow}>
                        {genres.map((g, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={[styles.genreChip, g4MyActual === g && styles.genreChipActive]}
                            onPress={() => setG4MyActual(g)}
                          >
                            <Text style={[styles.genreChipText, g4MyActual === g && styles.genreChipTextActive]}>
                              {g}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Step B: Your guess for match */}
                    <View style={styles.guessMeSection}>
                      <Text style={styles.guessMeLabel}>2. Guess {peerName}'s favourite genre:</Text>
                      <View style={styles.genreChipsRow}>
                        {genres.map((g, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={[styles.genreChip, g4MyGuess === g && styles.genreChipGuessActive]}
                            onPress={() => setG4MyGuess(g)}
                          >
                            <Text style={[styles.genreChipText, g4MyGuess === g && styles.genreChipTextActive]}>
                              {g}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <TouchableOpacity style={styles.submitGuessMeBtn} onPress={handleG4Submit} disabled={submitting}>
                      <Text style={styles.submitGuessMeBtnText}>
                        {submitting ? 'Revealing...' : '🔮 Lock In Guess & Actual ➔'}
                      </Text>
                    </TouchableOpacity>

                    {/* Exact Reveal Card from Prompt */}
                    {reveal && (
                      <View style={styles.guessMeRevealCard}>
                        <Text style={styles.guessMeRevealHeader}>REVEAL</Text>
                        <View style={styles.guessMeRevealRow}>
                          <Text style={styles.guessMeRevealKey}>Your guess:</Text>
                          <Text style={styles.guessMeRevealVal}>{reveal.your_guess}</Text>
                        </View>
                        <View style={styles.guessMeRevealRow}>
                          <Text style={styles.guessMeRevealKey}>Actual:</Text>
                          <Text style={styles.guessMeRevealVal}>{reveal.actual} 😳</Text>
                        </View>
                        <View style={styles.chemistryBadge}>
                          <Text style={styles.chemistryBadgeText}>+{reveal.chemistry} Chemistry</Text>
                        </View>

                        {g4Status?.spark_topic && (
                          <View style={styles.sparkTopicCard}>
                            <Text style={styles.sparkTopicLabel}>UNLOCKED TOPIC:</Text>
                            <Text style={styles.sparkTopicText}>"{g4Status.spark_topic}"</Text>
                            <TouchableOpacity
                              style={styles.sendTopicBtn}
                              onPress={() => handleSendTopic(g4Status.spark_topic)}
                            >
                              <Text style={styles.sendTopicBtnText}>💬 Send Topic to Chat ➔</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })()}
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
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCard: {
    backgroundColor: '#0F172A',
    width: '100%',
    maxWidth: 620,
    maxHeight: '92%',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1E1B4B',
    borderBottomWidth: 1,
    borderBottomColor: '#312E81'
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  headerIcon: {
    fontSize: 28,
    marginRight: 12
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  closeBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '800'
  },

  // Game Tabs
  gameTabsBar: {
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#1F2937'
  },
  tabsScroll: {
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  gameTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  gameTabActive: {
    backgroundColor: '#BE123C',
    borderColor: '#F43F5E'
  },
  gameTabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700'
  },
  gameTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '900'
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
  scrollBody: {
    padding: 16
  },
  gameContainer: {
    paddingBottom: 20
  },
  gameIntroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#F43F5E',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8
  },
  gameIntroBadgeText: {
    color: '#FB7185',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  dilemmaQuestion: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6
  },
  dilemmaSub: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18
  },

  // Dilemma Cards
  dilemmaGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  dilemmaCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#334155',
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dilemmaCardChosen: {
    borderColor: '#F43F5E',
    backgroundColor: 'rgba(244, 63, 94, 0.12)'
  },
  dilemmaEmoji: {
    fontSize: 36,
    marginBottom: 8
  },
  dilemmaLabel: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '800'
  },
  dilemmaLabelChosen: {
    color: '#FB7185'
  },
  chosenTag: {
    marginTop: 8,
    backgroundColor: '#F43F5E',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  chosenTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800'
  },

  // Sealed Box
  sealedCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    borderStyle: 'dashed',
    padding: 16,
    alignItems: 'center',
    marginBottom: 16
  },
  sealedIcon: {
    fontSize: 28,
    marginBottom: 6
  },
  sealedTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4
  },
  sealedText: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16
  },

  // Reveal Boxes
  revealBox: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16
  },
  matchBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: '#F43F5E'
  },
  clashBox: {
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderColor: '#EAB308'
  },
  revealHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12
  },
  revealEmoji: {
    fontSize: 30,
    marginRight: 12
  },
  revealTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '900'
  },
  revealSub: {
    color: '#CBD5E1',
    fontSize: 13,
    marginTop: 2
  },
  sparkTopicCard: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginTop: 8
  },
  sparkTopicLabel: {
    color: '#FB7185',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4
  },
  sparkTopicText: {
    color: '#FDE047',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 10
  },
  sendTopicBtn: {
    backgroundColor: '#BE123C',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center'
  },
  sendTopicBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800'
  },

  // Game 1 Actions
  roundActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  roundBtn: {
    flex: 1,
    backgroundColor: '#4338CA',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center'
  },
  roundBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  resetBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'center'
  },
  resetBtnText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700'
  },

  // Game 2 (Two Truths)
  game2Section: {
    marginBottom: 20
  },
  sectionHeaderTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 10
  },
  stmtInputCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 10,
    marginBottom: 8
  },
  stmtInputCardLie: {
    borderColor: '#F43F5E',
    backgroundColor: 'rgba(244, 63, 94, 0.08)'
  },
  stmtHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  stmtIndexText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '800'
  },
  lieTagBtn: {
    backgroundColor: '#334155',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  lieTagBtnActive: {
    backgroundColor: '#E11D48'
  },
  lieTagBtnText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800'
  },
  lieTagBtnTextActive: {
    color: '#FFFFFF'
  },
  stmtInput: {
    color: '#FFFFFF',
    fontSize: 13,
    paddingVertical: 4
  },
  submitStatementsBtn: {
    backgroundColor: '#0284C7',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6
  },
  submitStatementsBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800'
  },
  guessCard: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 8
  },
  guessCardSelected: {
    borderColor: '#0284C7',
    backgroundColor: 'rgba(2, 132, 199, 0.1)'
  },
  guessCardActualLie: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)'
  },
  guessCardWrongGuess: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.12)'
  },
  guessNumber: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700'
  },
  guessText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4
  },
  tapToGuessNotice: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6
  },
  actualLieBadge: {
    backgroundColor: '#10B981',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  actualLieBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900'
  },
  waitingNotice: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center'
  },
  waitingNoticeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600'
  },

  // Game 3 (Would You Rather)
  wyrGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16
  },
  wyrCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#334155',
    padding: 16,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center'
  },
  wyrEmoji: {
    fontSize: 32,
    marginBottom: 6
  },
  wyrText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center'
  },
  wyrDivider: {
    paddingHorizontal: 4
  },
  wyrDividerText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900'
  },

  // Game 4 (Guess Me)
  guessMeSection: {
    marginBottom: 14
  },
  guessMeLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8
  },
  genreChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  genreChip: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#334155'
  },
  genreChipActive: {
    backgroundColor: '#0284C7',
    borderColor: '#38BDF8'
  },
  genreChipGuessActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#A78BFA'
  },
  genreChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700'
  },
  genreChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '900'
  },
  submitGuessMeBtn: {
    backgroundColor: '#E11D48',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginVertical: 12
  },
  submitGuessMeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900'
  },
  guessMeRevealCard: {
    backgroundColor: '#1E1B4B',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#818CF8',
    padding: 16,
    alignItems: 'center',
    marginTop: 8
  },
  guessMeRevealHeader: {
    color: '#C7D2FE',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 10
  },
  guessMeRevealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 4
  },
  guessMeRevealKey: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700'
  },
  guessMeRevealVal: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '900'
  },
  chemistryBadge: {
    backgroundColor: '#EC4899',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 12,
    marginBottom: 6
  },
  chemistryBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900'
  }
});
