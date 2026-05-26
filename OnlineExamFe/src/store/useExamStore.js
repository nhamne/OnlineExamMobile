import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const EXAM_STORAGE_KEY = '@exam_attempt_state';

export const useExamStore = create((set, get) => ({
  activeAttempt: null,
  questions: [],
  answers: {}, // { questionId: selectedOptionId }
  violations: 0,
  timer: 0, // seconds remaining
  isSubmitting: false,

  startExam: (attemptData, shuffledQuestions) => {
    set({
      activeAttempt: attemptData,
      questions: shuffledQuestions,
      answers: attemptData.savedAnswers || {},
      timer: attemptData.remainingSeconds,
      violations: attemptData.violationCount || 0,
    });
    get().saveToLocal();
  },

  updateAnswer: (questionId, optionId) => {
    set((state) => ({
      answers: { ...state.answers, [questionId]: optionId },
    }));
    get().saveToLocal();
  },

  incrementViolations: () => {
    set((state) => ({ violations: state.violations + 1 }));
    get().saveToLocal();
  },

  tick: () => {
    set((state) => ({ 
      timer: Math.max(0, state.timer - 1) 
    }));
  },

  saveToLocal: async () => {
    const { activeAttempt, answers, violations, timer } = get();
    if (activeAttempt) {
      await AsyncStorage.setItem(EXAM_STORAGE_KEY, JSON.stringify({
        attemptId: activeAttempt.id,
        answers,
        violations,
        lastSaved: Date.now(),
        remainingTime: timer
      }));
    }
  },

  clearExam: async () => {
    set({ activeAttempt: null, questions: [], answers: {}, violations: 0, timer: 0 });
    await AsyncStorage.removeItem(EXAM_STORAGE_KEY);
  },

  setSubmitting: (val) => set({ isSubmitting: val }),
}));
