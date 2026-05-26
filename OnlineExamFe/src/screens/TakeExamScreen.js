import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, Text, ScrollView, TouchableOpacity, 
  StyleSheet, SafeAreaView, Alert, ActivityIndicator 
} from 'react-native';
import { useExamStore } from '../store/useExamStore';
import { useExamTimer } from '../hooks/useExamTimer';
import { useAntiCheat } from '../hooks/useAntiCheat';
import examApi from '../api/exam.api';

const TakeExamScreen = ({ navigation }) => {
  const { 
    questions, activeAttempt, answers, 
    updateAnswer, isSubmitting, setSubmitting, clearExam 
  } = useExamStore();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const timer = useExamTimer(() => handleAutoSubmit());
  const violations = useAntiCheat(activeAttempt?.maxViolations || 3);

  const currentQuestion = useMemo(() => questions[currentIndex], [questions, currentIndex]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSelectOption = async (optionId) => {
    updateAnswer(currentQuestion.id, optionId);
    try {
      // Periodic or per-answer save to server
      await examApi.saveAnswer(activeAttempt.id, {
        questionId: currentQuestion.id,
        optionId
      });
    } catch (e) {
      console.warn('Sync failed, using local save only');
    }
  };

  const handleSubmit = () => {
    const unansweredCount = questions.length - Object.keys(answers).length;
    Alert.alert(
      'Nộp bài',
      `Bạn còn ${unansweredCount} câu chưa làm. Bạn có chắc chắn muốn nộp bài không?`,
      [
        { text: 'Làm tiếp', style: 'cancel' },
        { text: 'Nộp bài', onPress: () => performSubmit() }
      ]
    );
  };

  const handleAutoSubmit = () => {
    Alert.alert('Hết giờ', 'Thời gian làm bài đã hết. Hệ thống sẽ tự động nộp bài.');
    performSubmit();
  };

  const performSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await examApi.submitExam(activeAttempt.id, answers);
      await clearExam();
      navigation.replace('ExamResult', { resultId: result.id });
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể nộp bài. Vui lòng kiểm tra kết nối mạng và thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentQuestion) return <ActivityIndicator size="large" style={{flex: 1}} />;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Timer and Progress */}
      <View style={styles.header}>
        <View>
          <Text style={styles.timerText}>{formatTime(timer)}</Text>
          <Text style={styles.violationText}>Vi phạm: {violations}</Text>
        </View>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isSubmitting}>
          <Text style={styles.submitBtnText}>{isSubmitting ? 'Đang nộp...' : 'Nộp bài'}</Text>
        </TouchableOpacity>
      </View>

      {/* Question Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${((currentIndex + 1) / questions.length) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.questionNumber}>Câu {currentIndex + 1} / {questions.length}</Text>
        <Text style={styles.questionText}>{currentQuestion.content}</Text>

        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option) => (
            <TouchableOpacity 
              key={option.id}
              style={[
                styles.optionItem,
                answers[currentQuestion.id] === option.id && styles.optionSelected
              ]}
              onPress={() => handleSelectOption(option.id)}
            >
              <View style={[
                styles.radio,
                answers[currentQuestion.id] === option.id && styles.radioSelected
              ]} />
              <Text style={[
                styles.optionText,
                answers[currentQuestion.id] === option.id && styles.optionTextSelected
              ]}>
                {option.content}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Navigation Footer */}
      <View style={styles.footer}>
        <TouchableOpacity 
          disabled={currentIndex === 0}
          onPress={() => setCurrentIndex(currentIndex - 1)}
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
        >
          <Text style={styles.navBtnText}>Câu trước</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={() => {
            if (currentIndex < questions.length - 1) {
              setCurrentIndex(currentIndex + 1);
            } else {
              handleSubmit();
            }
          }}
          style={styles.navBtn}
        >
          <Text style={styles.navBtnText}>
            {currentIndex === questions.length - 1 ? 'Hoàn tất' : 'Câu tiếp'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Sheet Question Navigator (Quick Jump) */}
      <View style={styles.gridContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gridScroll}>
          {questions.map((q, idx) => (
            <TouchableOpacity 
              key={q.id}
              style={[
                styles.gridItem,
                currentIndex === idx && styles.gridItemActive,
                answers[q.id] && styles.gridItemAnswered
              ]}
              onPress={() => setCurrentIndex(idx)}
            >
              <Text style={[
                styles.gridItemText,
                (currentIndex === idx || answers[q.id]) && styles.gridItemTextActive
              ]}>{idx + 1}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EEE'
  },
  timerText: { fontSize: 24, fontWeight: '700', color: '#DC3545' },
  violationText: { fontSize: 12, color: '#6C757D' },
  submitBtn: { backgroundColor: '#007BFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  submitBtnText: { color: '#FFF', fontWeight: '600' },
  progressBarContainer: { height: 4, backgroundColor: '#E9ECEF' },
  progressBar: { height: '100%', backgroundColor: '#007BFF' },
  content: { padding: 20 },
  questionNumber: { color: '#6C757D', marginBottom: 8, fontSize: 14 },
  questionText: { fontSize: 18, fontWeight: '600', color: '#212529', marginBottom: 24, lineHeight: 26 },
  optionsContainer: { gap: 12 },
  optionItem: { 
    flexDirection: 'row', alignItems: 'center', padding: 16, 
    borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#DEE2E6'
  },
  optionSelected: { borderColor: '#007BFF', backgroundColor: '#E7F1FF' },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#ADB5BD', marginRight: 12 },
  radioSelected: { borderColor: '#007BFF', backgroundColor: '#007BFF' },
  optionText: { fontSize: 16, color: '#495057', flex: 1 },
  optionTextSelected: { color: '#0056B3', fontWeight: '500' },
  footer: { 
    flexDirection: 'row', justifyContent: 'space-between', padding: 16,
    backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#EEE'
  },
  navBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, backgroundColor: '#F1F3F5' },
  navBtnDisabled: { opacity: 0.5 },
  navBtnText: { fontWeight: '600', color: '#495057' },
  gridContainer: { backgroundColor: '#FFF', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#EEE' },
  gridScroll: { paddingHorizontal: 16, gap: 8 },
  gridItem: { 
    width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#DEE2E6'
  },
  gridItemAnswered: { backgroundColor: '#007BFF', borderColor: '#007BFF' },
  gridItemActive: { borderWidth: 2, borderColor: '#007BFF' },
  gridItemText: { color: '#495057', fontWeight: '600' },
  gridItemTextActive: { color: '#FFF' },
});

export default TakeExamScreen;
