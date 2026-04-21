import { configureStore } from '@reduxjs/toolkit';
import examReducer from './useExamStore';

export const store = configureStore({
  reducer: {
    exam: examReducer,
  },
});

export default store;
