import { createSlice } from '@reduxjs/toolkit';
import { getSeededRandom, seededShuffleArray } from '../utils/shuffle';

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
  const displayToOriginal = {};

  orderedAnswers.forEach((answer, index) => {
    const displayKey = displaySlots[index];
    displayAnswerMap[displayKey] = answer.text;
    displayToOriginal[displayKey] = answer.originalKey;
  });

  return {
    displaySlots,
    displayAnswerMap,
    displayToOriginal,
  };
}

const examSlice = createSlice({
  name: 'exam',
  initialState: {
    currentAttempt: null,
    answers: {}, // {questionId: optionId}
    violationCount: 0,
    maxViolations: 3,
    isSubmitting: false,
    timeLeft: 0,
    snapshotQuestions: [], // Questions in shuffled order with displaySlots
  },
  reducers: {
    setAttempt: (state, action) => {
      const { attempt, questions, duration } = action.payload;
      state.currentAttempt = attempt;
      
      const shouldShuffleQuestions = Boolean(attempt.isShuffled && attempt.shuffleQuestions);
      const shouldShuffleAnswers = Boolean(attempt.isShuffled && attempt.shuffleAnswers);
      const randomFunc = getSeededRandom(attempt.id);

      let pool = [...questions];
      if (shouldShuffleQuestions) {
        pool = seededShuffleArray(pool, randomFunc);
      }

      state.snapshotQuestions = pool.map((q) => ({
        ...q,
        ...buildDisplayAnswerMap(q, randomFunc, shouldShuffleAnswers),
      }));

      const resolvedDuration = Number(
        duration
        ?? attempt?.examDurationInMinutes
        ?? attempt?.duration
        ?? 0
      );
      const safeDuration = Number.isFinite(resolvedDuration) && resolvedDuration > 0
        ? resolvedDuration
        : 0;
      
      // Calculate remaining time
      const startTime = new Date(attempt.startedAt).getTime();
      const now = new Date().getTime();
      const elapsedSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
      const totalSeconds = safeDuration * 60;
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
