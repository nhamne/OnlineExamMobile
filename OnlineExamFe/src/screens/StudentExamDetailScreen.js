import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import examApi from '../api/exam.api';
import { getSeededRandom, seededShuffleArray } from '../utils/shuffle';

const COLORS = {
  primary: '#005BBF',
  primaryContainer: '#004aad',
  surface: '#f7f9fb',
  surfaceContainerLow: '#f2f4f6',
  surfaceContainerLowest: '#ffffff',
  onSurface: '#191c1e',
  onSurfaceVariant: '#434653',
  outlineVariant: 'rgba(195, 198, 213, 0.4)',
  errorContainer: '#ffdad6',
  onErrorContainer: '#410002',
};

const ambientShadow = {
  elevation: 2,
  shadowColor: '#005bbf',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
};

function buildDisplayAnswerMap(question, randomFunc, shouldShuffleAnswers) {
  const baseAnswers = [
    { originalKey: 'A', text: question.optionA },
    { originalKey: 'B', text: question.optionB },
    { originalKey: 'C', text: question.optionC },
    { originalKey: 'D', text: question.optionD },
  ];
  const orderedAnswers = shouldShuffleAnswers ? seededShuffleArray(baseAnswers, randomFunc) : baseAnswers;
  const displaySlots = ['A', 'B', 'C', 'D'];
  const displayAnswerMap = {};
  let selectedDisplayOption = question.selectedOption || null;
  let correctDisplayOption = question.correctOption || null;

  orderedAnswers.forEach((answer, index) => {
    const displayKey = displaySlots[index];
    displayAnswerMap[displayKey] = answer.text;

    if (question.selectedOption === answer.originalKey) {
      selectedDisplayOption = displayKey;
    }

    if (question.correctOption === answer.originalKey) {
      correctDisplayOption = displayKey;
    }
  });

  return {
    displaySlots,
    displayAnswerMap,
    selectedDisplayOption,
    correctDisplayOption,
  };
}

function buildFallbackExplanation(item) {
  const optionsObj = item.displayAnswerMap || {};
  const studentOption = item.selectedDisplayOption || 'Không chọn';
  const correctOption = item.correctDisplayOption || item.correctOption;
  const studentAnswerText = item.selectedDisplayOption ? optionsObj[item.selectedDisplayOption] : '';
  const correctAnswerText = correctOption ? optionsObj[correctOption] : '';
  const teacherExplanation = String(item.explanation || '').trim();

  if (teacherExplanation) {
    return `Em chọn ${studentOption}${studentAnswerText ? ` (${studentAnswerText})` : ''} chưa đúng. Đáp án đúng là ${correctOption}${correctAnswerText ? ` (${correctAnswerText})` : ''}. ${teacherExplanation}`;
  }

  return `Em chọn ${studentOption}${studentAnswerText ? ` (${studentAnswerText})` : ''} chưa đúng. Đáp án đúng là ${correctOption}${correctAnswerText ? ` (${correctAnswerText})` : ''}. Em xem lại ý nghĩa của đáp án đúng để rút kinh nghiệm cho câu sau nhé.`;
}

const StudentExamDetailScreen = ({ route, navigation }) => {
  const { attemptId, sessionName } = route?.params || {};
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState('');

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const response = await examApi.getResultDetail(attemptId);
        const data = response.data;
        
        // Apply deterministic shuffle using attemptId as seed
        const randomFunc = getSeededRandom(attemptId);
        let pool = [...(data.questions || [])];
        if (data.isShuffled && data.shuffleQuestions) {
          pool = seededShuffleArray(pool, randomFunc);
        }
        
        data.questions = pool.map((q) => ({
          ...q,
          ...buildDisplayAnswerMap(q, randomFunc, Boolean(data.isShuffled && data.shuffleAnswers)),
        }));

        setDetail(data);
      } catch (error) {
        console.error('Failed to fetch result detail:', error);
      } finally {
        setLoading(false);
      }
    };
    if (attemptId) {
      fetchDetail();
    }
  }, [attemptId]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-container-lowest justify-center items-center">
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text className="text-on-surface-variant mt-2">Đang tải chi tiết kết quả...</Text>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView className="flex-1 bg-surface-container-lowest justify-center items-center">
        <Text className="text-on-surface-variant text-center">Không tìm thấy thông tin chi tiết bài làm.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-4 px-4 py-2 bg-surface-container-high rounded-xl">
          <Text className="text-primary font-bold">Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const handleAskAI = async (item) => {
    setAiExplanation('');
    setAiLoading(true);
    setAiModalVisible(true);

    try {
      const optionsObj = item.displayAnswerMap || {};
      const studentOption = item.selectedDisplayOption || 'Không chọn';
      const correctOption = item.correctDisplayOption || item.correctOption;

      const payload = {
        questionContent: item.content,
        options: optionsObj,
        studentOption,
        studentAnswerText: item.selectedDisplayOption ? optionsObj[item.selectedDisplayOption] : null,
        correctOption,
        correctAnswerText: correctOption ? optionsObj[correctOption] : null,
        teacherExplanation: item.explanation || null
      };

      const res = await examApi.askAiExplain(payload);
      setAiExplanation(res.data.explanation);
    } catch (error) {
      console.error('AI Explain Error:', error);
      setAiExplanation(buildFallbackExplanation(item));
    } finally {
      setAiLoading(false);
    }
  };

  const renderQuestion = (item, index) => {
    const isCorrect = item.selectedDisplayOption === item.correctDisplayOption;
    const canViewExplanation = detail.allowViewExplanation !== false;
    
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.questionLabel}>CÂU {index + 1}</Text>
            {canViewExplanation && (
              <Text style={[styles.questionLabel, { marginLeft: 4, color: isCorrect ? '#166534' : '#dc2626' }]}>
                ({isCorrect ? 'Đúng' : 'Sai'})
              </Text>
            )}
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {canViewExplanation && !isCorrect && (
              <TouchableOpacity style={styles.aiButton} onPress={() => handleAskAI(item)}>
                <Text style={styles.aiButtonText}>🤖 Hỏi AI giải thích</Text>
              </TouchableOpacity>
            )}
            {canViewExplanation && (
              <MaterialIcons 
                name={isCorrect ? "check-circle" : "cancel"} 
                size={18} 
                color={isCorrect ? '#166534' : '#dc2626'} 
              />
            )}
          </View>
        </View>
        <Text style={styles.questionText}>{item.content}</Text>
        
        <View style={styles.optionsList}>
          {(item.displaySlots || ['A', 'B', 'C', 'D']).map(opt => {
            const isSelected = item.selectedDisplayOption === opt;
            const isCorrectOpt = item.correctDisplayOption === opt;
            
            let itemStyle = [styles.optionItem];
            let dotStyle = [styles.optionDot];
            let labelStyle = [styles.optionLabel];
            let textStyle = [styles.optionText];
            let icon = null;

            if (isSelected) {
              itemStyle.push({ borderColor: COLORS.primary, borderWidth: 1 });
            }

            if (canViewExplanation && isCorrectOpt) {
              itemStyle.push(styles.optionItemCorrect);
              dotStyle.push(styles.optionDotCorrect);
              labelStyle.push(styles.optionLabelCorrect);
              textStyle.push(styles.optionTextCorrect);
              icon = <MaterialIcons name="check" size={16} color="#166534" />;
            } else if (canViewExplanation && isSelected && !isCorrectOpt) {
              itemStyle.push(styles.optionItemIncorrect);
              dotStyle.push(styles.optionDotIncorrect);
              labelStyle.push(styles.optionLabelIncorrect);
              textStyle.push(styles.optionTextIncorrect);
              icon = <MaterialIcons name="close" size={16} color="#991b1b" />;
            }

            return (
              <View key={opt} style={itemStyle}>
                <View style={dotStyle} />
                <Text style={labelStyle}>{opt}.</Text>
                <Text style={textStyle}>{item.displayAnswerMap?.[opt]}</Text>
                {icon}
              </View>
            );
          })}
        </View>
        
        {canViewExplanation && item.explanation && (
          <View style={styles.explanationBox}>
            <Text style={styles.explanationTitle}>Giải thích:</Text>
            <Text style={styles.explanationText}>{item.explanation}</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Kết quả chi tiết</Text>
          <Text style={styles.headerSubtitle}>Xem kết quả thi</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {sessionName ? (
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tên ca thi</Text>
              <View style={styles.infoInputBlock}>
                <Text style={styles.infoInputText}>{sessionName}</Text>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tổng quan kết quả</Text>
              <View style={[styles.infoInputBlock, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: 'rgba(0, 91, 191, 0.05)', borderColor: 'rgba(0, 91, 191, 0.1)', borderWidth: 1 }]}>
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: '900', color: COLORS.primary }}>{Number(detail.score).toFixed(2)}</Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', marginTop: 2 }}>Điểm số</Text>
                </View>
                <View style={{ width: 1, height: 32, backgroundColor: COLORS.outlineVariant }} />
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 24, fontWeight: '900', color: '#16a34a' }}>
                    {detail.correctCount}<Text style={{ fontSize: 14, color: COLORS.onSurfaceVariant }}>/{detail.totalQuestions}</Text>
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', marginTop: 2 }}>Đúng</Text>
                </View>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.listHeaderRow}>
          <Text style={styles.listTitle}>Chi tiết bài làm</Text>
        </View>

        <View style={styles.listSection}>
          {Array.isArray(detail?.questions)
            ? detail.questions.map((item, index) => (
                <View key={String(item.id || index)}>{renderQuestion(item, index)}</View>
              ))
            : null}
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent={true}
        visible={aiModalVisible}
        onRequestClose={() => setAiModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Giải thích của Giáo viên AI 🤖</Text>
            
            <ScrollView style={styles.modalScroll}>
              {aiLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={{ marginTop: 12, color: COLORS.onSurfaceVariant }}>Đang phân tích câu trả lời...</Text>
                </View>
              ) : (
                <View style={styles.aiChatBubble}>
                  <View style={styles.aiAvatar}>
                    <Text style={{ fontSize: 20 }}>🤖</Text>
                  </View>
                  <View style={styles.aiMessageContainer}>
                    <Text style={styles.aiMessageLabel}>[Lời giải thích của Giáo viên AI]:</Text>
                    <Text style={styles.aiMessageText}>{aiExplanation}</Text>
                  </View>
                </View>
              )}
            </ScrollView>
            
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setAiModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default StudentExamDetailScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    minHeight: 56,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitleContainer: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.onSurface },
  headerSubtitle: { fontSize: 12, color: COLORS.onSurfaceVariant },
  
  scrollContent: { paddingBottom: 60 },
  
  infoSection: {
    margin: 16,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    gap: 12,
  },
  infoRow: { gap: 6 },
  infoLabel: { fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase' },
  infoInputBlock: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  infoInputText: {
    fontSize: 13,
    color: COLORS.onSurface,
    fontWeight: '700',
  },

  listHeaderRow: {
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listTitle: { fontSize: 16, fontWeight: '700', color: COLORS.onSurface },
  listSection: { paddingHorizontal: 16 },

  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8 }, android: { elevation: 2 } }),
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  questionLabel: { fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant, opacity: 0.6 },
  questionText: { fontSize: 15, color: COLORS.onSurface, lineHeight: 22, fontWeight: '600', marginBottom: 16 },
  
  optionsList: { gap: 12 },
  optionItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8,
    backgroundColor: COLORS.surfaceContainerLow,
    padding: 10,
    borderRadius: 10,
  },
  optionItemCorrect: { backgroundColor: 'rgba(22, 163, 74, 0.08)', borderWidth: 1, borderColor: '#16a34a' },
  optionItemIncorrect: { backgroundColor: 'rgba(220, 38, 38, 0.08)', borderWidth: 1, borderColor: '#dc2626' },
  optionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.primary, opacity: 0.4 },
  optionDotCorrect: { backgroundColor: '#16a34a', opacity: 1 },
  optionDotIncorrect: { backgroundColor: '#dc2626', opacity: 1 },
  optionLabel: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant },
  optionLabelCorrect: { color: '#166534' },
  optionLabelIncorrect: { color: '#991b1b' },
  optionText: { fontSize: 13, color: COLORS.onSurfaceVariant, flex: 1 },
  optionTextCorrect: { color: '#166534', fontWeight: '600' },
  optionTextIncorrect: { color: '#991b1b', fontWeight: '600' },

  explanationBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0, 91, 191, 0.05)',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  explanationTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: COLORS.primary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  explanationText: {
    fontSize: 13,
    color: COLORS.onSurfaceVariant,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  aiButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  aiButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.onSurface,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalScroll: {
    maxHeight: 400,
  },
  aiChatBubble: {
    flexDirection: 'row',
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bae6fd',
    gap: 12,
  },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  aiMessageContainer: {
    flex: 1,
  },
  aiMessageLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369a1',
    marginBottom: 4,
  },
  aiMessageText: {
    fontSize: 14,
    color: '#0f172a',
    lineHeight: 22,
  },
  modalCloseButton: {
    marginTop: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.onSurfaceVariant,
  }
});
