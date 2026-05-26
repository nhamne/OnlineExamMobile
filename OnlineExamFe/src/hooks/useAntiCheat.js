import { useEffect, useRef } from 'react';
import { AppState, Alert, Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { incrementViolation } from '../store/useExamStore';
import examApi from '../api/exam.api';

export const useAntiCheat = (attemptId, onAutoSubmit) => {
  const appState = useRef(AppState.currentState);
  const dispatch = useDispatch();
  const { violationCount, maxViolations } = useSelector(state => state.exam);

  const handleViolation = async (reason) => {
    dispatch(incrementViolation());
    try {
      await examApi.logViolation(attemptId, reason);
    } catch (error) {
      console.error('Failed to log violation:', error);
    }
    
    if (Platform.OS === 'web') {
      window.alert(`Cảnh báo vi phạm: ${reason}\nVi phạm: ${violationCount + 1}/${maxViolations}`);
    } else {
      Alert.alert(
        'Cảnh báo vi phạm',
        `Lý do: ${reason}\nVi phạm: ${violationCount + 1}/${maxViolations}`,
        [{ text: 'OK' }]
      );
    }
  };

  useEffect(() => {
    if (!attemptId) return;

    if (Platform.OS === 'web') {
      // 1. Detect tab switch
      const handleVisibilityChange = () => {
        if (document.hidden) {
          handleViolation('TAB_SWITCH');
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // 2. Detect split screen / resize
      const handleResize = () => {
        if (window.innerWidth < window.screen.width * 0.7) {
          handleViolation('SPLIT_SCREEN_OR_RESIZE');
        }
      };
      window.addEventListener('resize', handleResize);

      // 3. Prevent context menu (right click)
      const handleContextMenu = (e) => {
        e.preventDefault();
      };
      document.addEventListener('contextmenu', handleContextMenu);

      // 4. Prevent copy/cut
      const handleCopyCut = (e) => {
        e.preventDefault();
      };
      document.addEventListener('copy', handleCopyCut);
      document.addEventListener('cut', handleCopyCut);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('resize', handleResize);
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('copy', handleCopyCut);
        document.removeEventListener('cut', handleCopyCut);
      };
    } else {
      const subscription = AppState.addEventListener('change', async (nextAppState) => {
        if (
          appState.current.match(/active/) &&
          nextAppState.match(/inactive|background/)
        ) {
          handleViolation('BACKGROUND_TRANSITION');
        }
        appState.current = nextAppState;
      });

      return () => {
        subscription.remove();
      };
    }
  }, [attemptId, violationCount, maxViolations, dispatch]); // Added violationCount and maxViolations so handleViolation gets latest

  useEffect(() => {
    if (violationCount >= maxViolations) {
      if (Platform.OS === 'web') {
        window.alert('Bạn đã vi phạm quá số lần cho phép. Bài thi sẽ được nộp tự động.');
        onAutoSubmit();
      } else {
        Alert.alert(
          'Tự động nộp bài',
          'Bạn đã vi phạm quá số lần cho phép. Bài thi sẽ được nộp tự động.',
          [{ text: 'OK', onPress: onAutoSubmit }]
        );
      }
    }
  }, [violationCount, maxViolations, onAutoSubmit]);
};
