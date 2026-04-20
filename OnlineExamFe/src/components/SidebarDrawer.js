import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const SidebarDrawer = ({
  visible,
  onClose,
  title,
  items,
  activeKey,
  onSelect,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [slideAnim, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1 }}>
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#111827',
            opacity: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }),
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: 300,
            backgroundColor: '#EEF2F7',
            borderTopRightRadius: 22,
            borderBottomRightRadius: 22,
            paddingHorizontal: 18,
            paddingTop: 30,
            paddingBottom: 22,
            transform: [
              {
                translateX: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-320, 0],
                }),
              },
            ],
          }}
        >
          <View className="flex-row items-center gap-3 mb-8">
            <View className="w-8 h-8 rounded-lg bg-primary items-center justify-center">
              <MaterialIcons name="menu-book" size={18} color="#FFFFFF" />
            </View>
            <Text className="text-primary text-3xl font-black tracking-tight">Online Exam</Text>
          </View>

          <View className="gap-2">
            {items.map((item) => {
              const isActive = activeKey === item.key;

              return (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => onSelect(item)}
                  className="flex-row items-center rounded-xl px-3 h-11"
                  style={{ backgroundColor: isActive ? '#005bbf' : 'transparent' }}
                  activeOpacity={0.88}
                >
                  <MaterialIcons
                    name={item.icon}
                    size={18}
                    color={isActive ? '#FFFFFF' : '#334155'}
                  />
                  <Text
                    className="ml-3 text-base font-semibold"
                    style={{ color: isActive ? '#FFFFFF' : '#1e293b' }}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ flex: 1 }} />
          <Text className="text-sm text-slate-600">{title}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
};

export default SidebarDrawer;