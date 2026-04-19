import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Text, TouchableOpacity, View } from 'react-native';

const RoleSegmentedControl = ({ value, onChange }) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const insets = 4;

  const itemWidth = useMemo(() => {
    if (!containerWidth) return 0;
    return (containerWidth - insets * 2) / 2;
  }, [containerWidth]);

  const indicatorWidth = itemWidth > 0 ? itemWidth : '50%';

  useEffect(() => {
    const target = value === 'teacher' ? itemWidth : 0;
    Animated.timing(translateX, {
      toValue: target,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [itemWidth, translateX, value]);

  return (
    <View
      className="mt-4 relative flex-row bg-surface-container-highest rounded-2xl mb-6 overflow-hidden border border-outline-variant"
      style={{ padding: insets, position: 'relative' }}
      onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View
        pointerEvents="none"
        className="rounded-xl"
        style={{
          borderRadius: 12,
          position: 'absolute',
          top: insets,
          left: insets,
          height: 44,
          width: indicatorWidth,
          backgroundColor: 'white',
          transform: [{ translateX }],
        }}
      />

      <TouchableOpacity
        onPress={() => onChange('student')}
        className="flex-1 h-11 items-center justify-center rounded-xl"
        style={{ zIndex: 1 }}
        activeOpacity={0.9}
      >
        <Text
          style={{
            color: value === 'student' ? '#005bbf' : '#414754',
            fontWeight: 'bold',
            fontSize: 14,
          }}
        >
          Học sinh
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => onChange('teacher')}
        className="flex-1 h-11 items-center justify-center rounded-xl"
        style={{ zIndex: 1 }}
        activeOpacity={0.9}
      >
        <Text
          style={{
            color: value === 'teacher' ? '#005bbf' : '#414754',
            fontWeight: 'bold',
            fontSize: 14,
          }}
        >
          Giáo viên
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default RoleSegmentedControl;
