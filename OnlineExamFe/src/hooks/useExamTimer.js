import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateTimeLeft } from '../store/useExamStore';

export const useExamTimer = (onTimeUp) => {
  const dispatch = useDispatch();
  const { timeLeft, currentAttempt } = useSelector(state => state.exam);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timeLeft > 0 && currentAttempt) {
      timerRef.current = setInterval(() => {
        dispatch(updateTimeLeft(timeLeft - 1));
      }, 1000);
    } else if (timeLeft <= 0 && currentAttempt) {
      if (timerRef.current) clearInterval(timerRef.current);
      onTimeUp && onTimeUp();
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, currentAttempt, onTimeUp]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return { timeLeft, formatTime };
};
