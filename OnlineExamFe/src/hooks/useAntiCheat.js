import { useEffect, useRef } from 'react';
import { AppState, Alert } from 'react-native';
import { useExamStore } from '../store/useExamStore';
import examApi from '../api/exam.api';

export const useAntiCheat = (maxViolations = 3) => {
  const { activeAttempt, incrementViolations, violations } = useExamStore();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!activeAttempt) return;

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        appState.current === 'active' &&
        nextAppState.match(/inactive|background/)
      ) {
        // User left the app
        incrementViolations();
        
        try {
          await examApi.logViolation(activeAttempt.id, {
            type: 'APP_MINIMIZED',
            timestamp: new Date().toISOString(),
            currentViolationCount: violations + 1
          });
        } catch (error) {
          console.error('Failed to log violation', error);
        }
      }

      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // User returned
        Alert.alert(
          'Cảnh báo vi phạm',
          `Bạn đã thoát khỏi ứng dụng. Đây là lần vi phạm thứ ${violations + 1}. Nếu vượt quá ${maxViolations} lần, bài thi sẽ tự động nộp.`,
          [{ text: 'Tôi đã hiểu' }]
        );
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [activeAttempt, violations]);

  return violations;
};
