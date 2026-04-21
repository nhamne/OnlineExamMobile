import { createSlice } from '@reduxjs/toolkit';

const examSlice = createSlice({
  name: 'exam',
  initialState: {
    currentAttempt: null,
    answers: {}, // {questionId: optionId}
    violationCount: 0,
    maxViolations: 3,
    isSubmitting: false,
    timeLeft: 0,
    snapshotQuestions: [], // Questions in shuffled order
  },
  reducers: {
    setAttempt: (state, action) => {
      const { attempt, questions, duration } = action.payload;
      state.currentAttempt = attempt;
      state.snapshotQuestions = questions;
      
      // Calculate remaining time
      const startTime = new Date(attempt.startedAt).getTime();
      const now = new Date().getTime();
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const totalSeconds = duration * 60;
      state.timeLeft = Math.max(0, totalSeconds - elapsedSeconds);
      
      state.answers = {};
      state.violationCount = 0;
    },
    updateAnswer: (state, action) => {
      const { questionId, optionId } = action.payload;
      state.answers[questionId] = optionId;
    },
    incrementViolation: (state) => {
      state.violationCount += 1;
    },
    updateTimeLeft: (state, action) => {
      state.timeLeft = action.payload;
    },
    setIsSubmitting: (state, action) => {
      state.isSubmitting = action.payload;
    },
    clearExam: (state) => {
      state.currentAttempt = null;
      state.answers = {};
      state.violationCount = 0;
      state.snapshotQuestions = [];
    }
  }
});

export const { 
  setAttempt, 
  updateAnswer, 
  incrementViolation, 
  updateTimeLeft, 
  setIsSubmitting, 
  clearExam 
} = examSlice.actions;

export default examSlice.reducer;
