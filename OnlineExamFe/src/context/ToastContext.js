import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ToastContext = createContext(null);

const TOAST_DURATION = 2200;

const toastStyles = {
  success: {
    backgroundColor: '#E8F5EE',
    borderColor: '#7CC89B',
    titleColor: '#116B3A',
  },
  error: {
    backgroundColor: '#FDECEC',
    borderColor: '#F08A8A',
    titleColor: '#A51E1E',
  },
  info: {
    backgroundColor: '#EAF1FF',
    borderColor: '#8DB0F5',
    titleColor: '#005BBF',
  },
};

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef(null);
  const insets = useSafeAreaInsets();
  const topOffset = Math.max((insets?.top || 0) + 24, 44);

  const hideToast = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, [anim]);

  const showToast = useCallback(
    (message, type = 'info') => {
      if (!message) return;

      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }

      setToast({ message, type });
      Animated.timing(anim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();

      hideTimerRef.current = setTimeout(() => {
        hideToast();
      }, TOAST_DURATION);
    },
    [anim, hideToast]
  );

  const value = useMemo(() => ({ showToast, hideToast }), [showToast, hideToast]);
  const currentStyle = toast ? toastStyles[toast.type] || toastStyles.info : toastStyles.info;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: topOffset,
            left: 16,
            right: 16,
            alignItems: 'center',
            zIndex: 9999,
            elevation: 9999,
          }}
        >
          <Animated.View
            style={{
              maxWidth: 520,
              width: '100%',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: currentStyle.borderColor,
              backgroundColor: currentStyle.backgroundColor,
              paddingHorizontal: 16,
              paddingVertical: 12,
              opacity: anim,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0],
                  }),
                },
              ],
            }}
          >
            <Text
              style={{
                color: currentStyle.titleColor,
                fontSize: 14,
                fontWeight: '700',
                textAlign: 'center',
              }}
            >
              {toast.message}
            </Text>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
};