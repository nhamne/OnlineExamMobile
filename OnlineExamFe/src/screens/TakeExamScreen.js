import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useExamTimer } from '../hooks/useExamTimer';
import { useAntiCheat } from '../hooks/useAntiCheat';
import { updateAnswer, setIsSubmitting, clearExam } from '../store/useExamStore';
import examApi from '../api/exam.api';
import { MaterialIcons } from '@expo/vector-icons';

const TakeExamScreen = ({ navigation, route }) => {
  const dispatch = useDispatch();
  const { currentAttempt, snapshotQuestions, answers, isSubmitting } = useSelector(
    (state) => state.exam
  );
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);
  const allowExitRef = useRef(false);

  // Prevention of accidental exit and force 0 score on exit
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (allowExitRef.current) return;
      if (isSubmitting) return;

      // Prevent default behavior
      e.preventDefault();

      Alert.alert(
        'Thoát bài thi?',
        'Nếu bạn thoát ra bây giờ, bài thi sẽ kết thúc và bạn sẽ nhận điểm 0. Bạn có chắc chắn muốn thoát?',
        [
          { text: 'Tiếp tục làm bài', style: 'cancel', onPress: () => {} },
          {
            text: 'Thoát và chấp nhận 0 điểm',
            style: 'destructive',
            onPress: async () => {
              try {
                setLoading(true);
                allowExitRef.current = true;
                await examApi.forceSubmit(currentAttempt.id);
                dispatch(clearExam());
                // After clearing, we can allow the navigation
                navigation.dispatch(e.data.action);
              } catch (error) {
                allowExitRef.current = false;
                Alert.alert('Lỗi', 'Không thể kết thúc bài thi. Vui lòng thử lại.');
              } finally {
                setLoading(false);
              }
            },
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, isSubmitting, currentAttempt, dispatch]);

  const handleFinalSubmit = useCallback(async () => {
    if (isSubmitting) return;

    dispatch(setIsSubmitting(true));
    try {
      const response = await examApi.submitExam(currentAttempt.id);
      allowExitRef.current = true;
      dispatch(clearExam());
      navigation.replace('StudentExamDetail', {
        attemptId: response.data.attemptId,
        submittedScore: response.data.score,
      });
    } catch (error) {
      console.error('Final submit error:', error.response?.data || error.message);
      Alert.alert('Lỗi', 'Không thể nộp bài. Vui lòng kiểm tra kết nối mạng và thử lại.');
    } finally {
      dispatch(setIsSubmitting(false));
    }
  }, [currentAttempt, isSubmitting, dispatch, navigation]);

  const { formatTime, timeLeft } = useExamTimer(handleFinalSubmit);
  useAntiCheat(currentAttempt?.id, handleFinalSubmit);

  const openSubmitConfirmation = useCallback(() => {
    if (Platform.OS === 'web') {
      setShowSubmitConfirmModal(true);
      return;
    }

    Alert.alert('Xác nhận nộp bài', 'Bạn có chắc chắn muốn nộp bài ngay bây giờ?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Nộp bài', onPress: handleFinalSubmit },
    ]);
  }, [handleFinalSubmit]);

  const handleSelectOption = async (questionId, optionId) => {
    dispatch(updateAnswer({ questionId, optionId }));
    try {
      await examApi.saveAnswer(currentAttempt.id, questionId, optionId);
    } catch (error) {
      console.warn('Autosave failed:', error);
    }
  };

  if (!currentAttempt || snapshotQuestions.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text>Đang tải đề thi...</Text>
      </View>
    );
  }

  const currentQuestion = snapshotQuestions[currentIndex];

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        transparent
        animationType="fade"
        visible={showSubmitConfirmModal}
        onRequestClose={() => setShowSubmitConfirmModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSubmitConfirmModal(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Xác nhận nộp bài</Text>
            <Text style={styles.modalMessage}>Bạn có chắc chắn muốn nộp bài ngay bây giờ?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={() => setShowSubmitConfirmModal(false)}
              >
                <Text style={styles.modalBtnSecondaryText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={() => {
                  setShowSubmitConfirmModal(false);
                  handleFinalSubmit();
                }}
              >
                <Text style={styles.modalBtnPrimaryText}>Nộp bài</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.timerTitle}>Thời gian còn lại</Text>
          <Text style={[styles.timerText, timeLeft < 60 && styles.timerUrgent]}>
            {formatTime(timeLeft)}
          </Text>
        </View>
        <TouchableOpacity style={styles.submitBtn} onPress={openSubmitConfirmation}>
          <Text style={styles.submitBtnText}>Nộp bài</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Palette */}
      <View style={styles.paletteContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.paletteScroll}>
          {snapshotQuestions.map((q, idx) => (
            <TouchableOpacity
              key={q.id}
              style={[
                styles.paletteItem,
                currentIndex === idx && styles.paletteActive,
                answers[q.id] && styles.paletteDone,
              ]}
              onPress={() => setCurrentIndex(idx)}
            >
              <Text style={[
                styles.paletteText,
                (currentIndex === idx || answers[q.id]) && styles.paletteTextActive
              ]}>
                {idx + 1}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Question Content */}
      <ScrollView style={styles.questionContent}>
        <Text style={styles.questionIndex}>Câu hỏi {currentIndex + 1}:</Text>
        <Text style={styles.questionText}>{currentQuestion.content}</Text>

        {['A', 'B', 'C', 'D'].map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[
              styles.optionItem,
              answers[currentQuestion.id] === opt && styles.optionSelected,
            ]}
            onPress={() => handleSelectOption(currentQuestion.id, opt)}
          >
            <View style={[
              styles.optionRadio,
              answers[currentQuestion.id] === opt && styles.optionRadioActive
            ]}>
              {answers[currentQuestion.id] === opt && <View style={styles.optionRadioInner} />}
            </View>
            <Text style={styles.optionText}>{currentQuestion[`option${opt}`]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Footer Navigation */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
          onPress={() => setCurrentIndex(prev => prev - 1)}
          disabled={currentIndex === 0}
        >
          <MaterialIcons name="chevron-left" size={24} color={currentIndex === 0 ? '#CCC' : '#4A90E2'} />
          <Text style={[styles.navBtnText, currentIndex === 0 && styles.navBtnTextDisabled]}>Câu trước</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navBtn, currentIndex === snapshotQuestions.length - 1 && styles.navBtnDisabled]}
          onPress={() => setCurrentIndex(prev => prev + 1)}
          disabled={currentIndex === snapshotQuestions.length - 1}
        >
          <Text style={[styles.navBtnText, currentIndex === snapshotQuestions.length - 1 && styles.navBtnTextDisabled]}>Câu sau</Text>
          <MaterialIcons name="chevron-right" size={24} color={currentIndex === snapshotQuestions.length - 1 ? '#CCC' : '#4A90E2'} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    elevation: 2,
  },
  timerTitle: { fontSize: 12, color: '#666' },
  timerText: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  timerUrgent: { color: '#E74C3C' },
  submitBtn: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  submitBtnText: { color: '#FFF', fontWeight: 'bold' },
  paletteContainer: { backgroundColor: '#FFF', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  paletteScroll: { paddingHorizontal: 10 },
  paletteItem: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DDD',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  paletteActive: { borderColor: '#4A90E2', borderWidth: 2 },
  paletteDone: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  paletteText: { color: '#666', fontWeight: '500' },
  paletteTextActive: { color: '#FFF' },
  questionContent: { flex: 1, padding: 16 },
  questionIndex: { fontSize: 14, color: '#4A90E2', fontWeight: 'bold', marginBottom: 8 },
  questionText: { fontSize: 18, color: '#333', lineHeight: 26, marginBottom: 24 },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EEE',
    elevation: 1,
  },
  optionSelected: { borderColor: '#4A90E2', backgroundColor: '#F0F7FF' },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#DDD',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionRadioActive: { borderColor: '#4A90E2' },
  optionRadioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4A90E2' },
  optionText: { fontSize: 16, color: '#444', flex: 1 },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  navBtn: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  navBtnDisabled: { opacity: 0.5 },
  navBtnText: { fontSize: 16, color: '#4A90E2', fontWeight: '500', marginHorizontal: 4 },
  navBtnTextDisabled: { color: '#CCC' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalMessage: {
    marginTop: 8,
    fontSize: 15,
    color: '#334155',
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  modalBtn: {
    minWidth: 96,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  modalBtnSecondary: {
    backgroundColor: '#F1F5F9',
  },
  modalBtnPrimary: {
    backgroundColor: '#2563EB',
  },
  modalBtnSecondaryText: {
    color: '#334155',
    fontWeight: '700',
  },
  modalBtnPrimaryText: {
    color: '#FFF',
    fontWeight: '800',
  },
});

export default TakeExamScreen;
