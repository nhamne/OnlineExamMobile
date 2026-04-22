import { useEffect, useRef } from 'react';
import { AppState, Alert, Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { incrementViolation } from '../store/useExamStore';
import examApi from '../api/exam.api';

export const useAntiCheat = (attemptId, onAutoSubmit) => {
  const appState = useRef(AppState.currentState);
  const dispatch = useDispatch();
  const { violationCount, maxViolations } = useSelector(state => state.exam);

  useEffect(() => {
    if (!attemptId || Platform.OS === 'web') {
      return undefined;
    }

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        appState.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        // App went to background
        dispatch(incrementViolation());
        
        try {
          await examApi.logViolation(attemptId, 'BACKGROUND_TRANSITION');
        } catch (error) {
          console.error('Failed to log violation:', error);
        }

        Alert.alert(
          'Cảnh báo vi phạm',
          `Bạn đã rời khỏi màn hình thi. Vi phạm: ${violationCount + 1}/${maxViolations}`,
          [{ text: 'OK' }]
        );
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [violationCount, maxViolations, attemptId, dispatch]);

  useEffect(() => {
    if (violationCount >= maxViolations) {
      Alert.alert(
        'Tự động nộp bài',
        'Bạn đã vi phạm quá số lần cho phép. Bài thi sẽ được nộp tự động.',
        [{ text: 'OK', onPress: onAutoSubmit }]
      );
    }
  }, [violationCount, maxViolations, onAutoSubmit]);
};
