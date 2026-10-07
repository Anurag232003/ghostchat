import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions
} from 'react-native';

import {
  fetchQuestionCategories,
  fetchQuestionCards,
  fetchRandomQuestionCard,
  submitQuestionCardAnswer
} from '../services/api';

const CATEGORIES = [
  'All',
  'Deep',
  'Funny',
  'Romantic',
  'Career',
  'Childhood',
  'Future',
  'Weird',
  'Random',
  'Rapid Fire'
];

const CATEGORY_COLORS = {
  'Deep': '#8b5cf6',
  'Funny': '#f59e0b',
  'Romantic': '#ec4899',
  'Career': '#3b82f6',
  'Childhood': '#10b981',
  'Future': '#06b6d4',
  'Weird': '#a855f7',
  'Random': '#f97316',
  'Rapid Fire': '#ef4444',
  'All': '#6366f1'
};

export function QuestionCardsModal({
  visible,
  onClose,
  sessionId,
  currentUserId,
  peerName = 'Match',
  onSendStarterToChat
}) {
  const [loading, setLoading] = useState(true);
  const [categoriesData, setCategoriesData] = useState(null);
  const [cards, setCards] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answering, setAnswering] = useState(false);
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [recentAnswers, setRecentAnswers] = useState({});
  const [viewMode, setViewMode] = useState('deck'); // 'deck' | 'browse'

  useEffect(() => {
    if (visible) {
      loadDeck();
    }
  }, [visible, selectedCategory]);

  async function loadDeck() {
    setLoading(true);
    try {
      const [catData, cardData] = await Promise.all([
        fetchQuestionCategories(),
        fetchQuestionCards(selectedCategory)
      ]);
      setCategoriesData(catData);
      setCards(cardData.cards || []);
      setCurrentIndex(0);
      setAnswering(false);
      setAnswerText('');
    } catch (err) {
      console.warn('Failed to load question cards:', err);
    } finally {
      setLoading(false);
    }
  }

  const currentCard = cards[currentIndex] || null;
  const activeColor = (currentCard && CATEGORY_COLORS[currentCard.category]) || '#6366f1';

  function handleNext() {
    if (cards.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % cards.length);
    setAnswering(false);
    setAnswerText('');
  }

  function handlePrev() {
    if (cards.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
    setAnswering(false);
    setAnswerText('');
  }

  async function handleRandom() {
    try {
      const card = await fetchRandomQuestionCard(selectedCategory);
      if (card) {
        const foundIdx = cards.findIndex((c) => c.id === card.id);
        if (foundIdx !== -1) {
          setCurrentIndex(foundIdx);
        } else {
          setCards([card, ...cards]);
          setCurrentIndex(0);
        }
        setAnswering(false);
        setAnswerText('');
      }
    } catch (err) {
      console.warn('Error fetching random card:', err);
    }
  }

  async function handleSubmitAnswer() {
    if (!answerText.trim() || !currentCard) return;
    setSubmitting(true);
    try {
      const res = await submitQuestionCardAnswer(
        sessionId || 'demo-session',
        currentUserId || 'me',
        currentCard.id,
        answerText.trim()
      );
      setRecentAnswers((prev) => ({
        ...prev,
        [currentCard.id]: answerText.trim()
      }));
      Alert.alert(
        'Card Answered! 🃏',
        `Your answer to Question #${currentCard.number} has been recorded!`,
        [
          {
            text: 'Send to Chat 💬',
            onPress: () => handleSendToChat(answerText.trim())
          },
          { text: 'Done', style: 'cancel' }
        ]
      );
      setAnswering(false);
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleSendToChat(customAnswer = null) {
    if (!currentCard || !onSendStarterToChat) return;
    const ans = customAnswer || recentAnswers[currentCard.id] || answerText.trim();
    let textToSend = `🃏 Question #${currentCard.number} [${currentCard.category}]:\n"${currentCard.question}"`;
    if (ans) {
      textToSend += `\n\n💬 My Answer: ${ans}`;
    } else if (currentCard.chat_starter) {
      textToSend += `\n\n${currentCard.chat_starter}`;
    }
    onSendStarterToChat(textToSend);
    onClose();
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
            <View style={styles.titleRow}>
              <Text style={styles.modalTitle}>🃏 Question Cards Deck</Text>
              <View style={styles.deckCountBadge}>
                <Text style={styles.deckCountText}>
                  {categoriesData ? `${categoriesData.total_cards} Cards` : '50+ Cards'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Category Chips Bar */}
          <View style={styles.categoryScrollWrapper}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryList}
            >
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat;
                const count = cat === 'All'
                  ? (categoriesData?.total_cards || 54)
                  : (categoriesData?.counts?.[cat] || 6);
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      isSelected && {
                        backgroundColor: CATEGORY_COLORS[cat] || '#6366f1',
                        borderColor: CATEGORY_COLORS[cat] || '#6366f1'
                      }
                    ]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextActive
                      ]}
                    >
                      {cat} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Mode Switcher */}
          <View style={styles.modeTabs}>
            <TouchableOpacity
              style={[styles.modeTab, viewMode === 'deck' && styles.modeTabActive]}
              onPress={() => setViewMode('deck')}
            >
              <Text style={[styles.modeTabText, viewMode === 'deck' && styles.modeTabTextActive]}>
                🎴 Swipe Deck
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, viewMode === 'browse' && styles.modeTabActive]}
              onPress={() => setViewMode('browse')}
            >
              <Text style={[styles.modeTabText, viewMode === 'browse' && styles.modeTabTextActive]}>
                📋 Browse All ({cards.length})
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text style={styles.loadingText}>Shuffling the deck...</Text>
            </View>
          ) : viewMode === 'deck' ? (
            /* DECK VIEW MATCHING WIREFRAME */
            <ScrollView contentContainerStyle={styles.deckContent} showsVerticalScrollIndicator={false}>
              {/* Stack Layers for Real Card Deck Feel */}
              <View style={styles.deckStackContainer}>
                <View style={[styles.cardBackdrop2, { borderColor: `${activeColor}33` }]} />
                <View style={[styles.cardBackdrop1, { borderColor: `${activeColor}66` }]} />

                {/* THE MAIN CARD (Matching ASCII Frame) */}
                <View style={[styles.mainCard, { borderColor: activeColor }]}>
                  {/* Card Top Border / Number Banner */}
                  <View style={styles.cardHeaderBanner}>
                    <Text style={[styles.cardHeaderNumber, { color: activeColor }]}>
                      QUESTION #{currentCard ? currentCard.number : '??'}
                    </Text>
                    <View style={[styles.categoryTag, { backgroundColor: `${activeColor}22` }]}>
                      <Text style={[styles.categoryTagText, { color: activeColor }]}>
                        {currentCard ? `${currentCard.emoji} ${currentCard.category}` : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Card Question Body */}
                  <View style={styles.cardPromptContainer}>
                    <Text style={styles.cardPromptText}>
                      {currentCard ? currentCard.question : 'No questions found'}
                    </Text>
                  </View>

                  {/* Existing Answer Badge if answered */}
                  {currentCard && recentAnswers[currentCard.id] && !answering && (
                    <View style={styles.savedAnswerBadge}>
                      <Text style={styles.savedAnswerLabel}>✓ Your recorded answer:</Text>
                      <Text style={styles.savedAnswerText}>{recentAnswers[currentCard.id]}</Text>
                    </View>
                  )}

                  {/* Card Action / Answer Area */}
                  {answering ? (
                    <View style={styles.answerInputContainer}>
                      <Text style={styles.answerInputLabel}>Write your answer:</Text>
                      <TextInput
                        style={styles.answerInput}
                        placeholder="Type what comes to mind..."
                        placeholderTextColor="#6b7280"
                        value={answerText}
                        onChangeText={setAnswerText}
                        multiline
                        autoFocus
                      />
                      <View style={styles.answerButtonsRow}>
                        <TouchableOpacity
                          style={styles.cancelAnswerBtn}
                          onPress={() => setAnswering(false)}
                        >
                          <Text style={styles.cancelAnswerBtnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.submitAnswerBtn, { backgroundColor: activeColor }]}
                          onPress={handleSubmitAnswer}
                          disabled={submitting || !answerText.trim()}
                        >
                          {submitting ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.submitAnswerBtnText}>Submit Answer</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.answerButton, { borderColor: activeColor }]}
                      onPress={() => setAnswering(true)}
                    >
                      <Text style={[styles.answerButtonText, { color: activeColor }]}>
                        [ Answer ]
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Navigation Controls */}
              <View style={styles.controlsRow}>
                <TouchableOpacity
                  style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
                  onPress={handlePrev}
                  disabled={cards.length <= 1}
                >
                  <Text style={styles.navButtonText}>⬅ Prev</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.randomButton}
                  onPress={handleRandom}
                >
                  <Text style={styles.randomButtonText}>🎲 Random</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.navButton}
                  onPress={handleNext}
                  disabled={cards.length <= 1}
                >
                  <Text style={styles.navButtonText}>Next ➔</Text>
                </TouchableOpacity>
              </View>

              {/* Progress & Quick Send to Chat */}
              <View style={styles.footerActions}>
                <Text style={styles.counterText}>
                  Card {cards.length > 0 ? currentIndex + 1 : 0} of {cards.length} ({selectedCategory})
                </Text>

                <TouchableOpacity
                  style={styles.sendChatButton}
                  onPress={() => handleSendToChat()}
                >
                  <Text style={styles.sendChatButtonText}>
                    💬 Send Question to Chat with {peerName}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            /* BROWSE ALL CATALOG VIEW */
            <ScrollView contentContainerStyle={styles.browseList} showsVerticalScrollIndicator={false}>
              <Text style={styles.browseSummary}>
                Showing {cards.length} questions in <Text style={{ color: activeColor, fontWeight: '700' }}>{selectedCategory}</Text>
              </Text>
              {cards.map((card, idx) => {
                const color = CATEGORY_COLORS[card.category] || '#6366f1';
                const hasAnswer = recentAnswers[card.id];
                return (
                  <TouchableOpacity
                    key={card.id}
                    style={[styles.browseCardItem, { borderLeftColor: color }]}
                    onPress={() => {
                      setCurrentIndex(idx);
                      setViewMode('deck');
                    }}
                  >
                    <View style={styles.browseHeader}>
                      <Text style={[styles.browseNumber, { color }]}>
                        QUESTION #{card.number}
                      </Text>
                      <Text style={styles.browseCategory}>
                        {card.emoji} {card.category}
                      </Text>
                    </View>
                    <Text style={styles.browseQuestion}>{card.question}</Text>
                    {hasAnswer && (
                      <Text style={styles.browseAnsweredBadge}>
                        ✓ Answered: "{hasAnswer}"
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
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
    maxWidth: 480,
    maxHeight: '92%',
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 20
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f8fafc',
    letterSpacing: 0.3
  },
  deckCountBadge: {
    backgroundColor: '#3b82f622',
    borderColor: '#3b82f6',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12
  },
  deckCountText: {
    color: '#60a5fa',
    fontSize: 11,
    fontWeight: '700'
  },
  closeButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#1e293b'
  },
  closeButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '700'
  },
  categoryScrollWrapper: {
    marginBottom: 12
  },
  categoryList: {
    gap: 8,
    paddingVertical: 2
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155'
  },
  categoryChipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  categoryChipTextActive: {
    color: '#ffffff',
    fontWeight: '700'
  },
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16
  },
  modeTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8
  },
  modeTabActive: {
    backgroundColor: '#334155'
  },
  modeTabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  modeTabTextActive: {
    color: '#f8fafc',
    fontWeight: '700'
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14
  },
  deckContent: {
    alignItems: 'center',
    paddingBottom: 10
  },
  deckStackContainer: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 10
  },
  cardBackdrop2: {
    position: 'absolute',
    top: -12,
    width: '88%',
    height: '100%',
    backgroundColor: '#131c31',
    borderRadius: 20,
    borderWidth: 1,
    opacity: 0.5
  },
  cardBackdrop1: {
    position: 'absolute',
    top: -6,
    width: '94%',
    height: '100%',
    backgroundColor: '#18243c',
    borderRadius: 20,
    borderWidth: 1,
    opacity: 0.8
  },
  mainCard: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 20,
    borderWidth: 2,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8
  },
  cardHeaderBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 12,
    marginBottom: 16
  },
  cardHeaderNumber: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2
  },
  categoryTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  categoryTagText: {
    fontSize: 12,
    fontWeight: '700'
  },
  cardPromptContainer: {
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6
  },
  cardPromptText: {
    color: '#f8fafc',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28
  },
  savedAnswerBadge: {
    backgroundColor: '#064e3b33',
    borderColor: '#10b981',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 14
  },
  savedAnswerLabel: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4
  },
  savedAnswerText: {
    color: '#e2e8f0',
    fontSize: 13
  },
  answerButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#0f172a88'
  },
  answerButtonText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1
  },
  answerInputContainer: {
    marginTop: 8,
    gap: 8
  },
  answerInputLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  answerInput: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#475569',
    color: '#f8fafc',
    padding: 12,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top'
  },
  answerButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 6
  },
  cancelAnswerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#334155'
  },
  cancelAnswerBtnText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '600'
  },
  submitAnswerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8
  },
  submitAnswerBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 18,
    gap: 10
  },
  navButton: {
    flex: 1,
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center'
  },
  navButtonDisabled: {
    opacity: 0.4
  },
  navButtonText: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '700'
  },
  randomButton: {
    flex: 1,
    backgroundColor: '#312e81',
    borderColor: '#6366f1',
    borderWidth: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center'
  },
  randomButtonText: {
    color: '#a5b4fc',
    fontSize: 13,
    fontWeight: '700'
  },
  footerActions: {
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
    gap: 10
  },
  counterText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600'
  },
  sendChatButton: {
    backgroundColor: '#0284c7',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4
  },
  sendChatButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  browseList: {
    gap: 10,
    paddingBottom: 20
  },
  browseSummary: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 4
  },
  browseCardItem: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6
  },
  browseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  browseNumber: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1
  },
  browseCategory: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600'
  },
  browseQuestion: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20
  },
  browseAnsweredBadge: {
    color: '#34d399',
    fontSize: 11,
    marginTop: 2
  }
});
