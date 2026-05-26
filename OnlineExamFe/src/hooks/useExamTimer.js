import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useExamStore } from '../store/useExamStore';

export const useExamTimer = (onTimeUp) => {
  const { timer, tick, activeAttempt } = useExamStore();
  const appState = useRef(AppState.currentState);
  const lastTickTimestamp = useRef(Date.now());

  useEffect(() => {
    if (!activeAttempt) return;

    const interval = setInterval(() => {
      tick();
      lastTickTimestamp.current = Date.now();
    }, 1000);

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground
        const elapsedSinceLastTick = Math.floor((Date.now() - lastTickTimestamp.current) / 1000);
        if (elapsedSinceLastTick > 1) {
          // Compensate for lost time while in background
          for (let i = 0; i < elapsedSinceLastTick; i++) {
            tick();
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [activeAttempt]);

  useEffect(() => {
    if (timer <= 0 && activeAttempt) {
      onTimeUp && onTimeUp();
    }
  }, [timer, activeAttempt]);

  return timer;
};
