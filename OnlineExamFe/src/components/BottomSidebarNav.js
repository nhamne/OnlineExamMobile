import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const BottomSidebarNav = ({ items, activeKey, onSelect }) => {
  return (
    <View
      style={{
        width: '100%',
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#0F172A',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }}
    >
      <View style={{ width: '100%', paddingHorizontal: 8, paddingVertical: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {items.map((item) => {
            const isActive = item.key === activeKey;

            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => onSelect(item)}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  height: 56,
                  marginHorizontal: 3,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isActive ? '#EEF4FF' : 'transparent',
                }}
              >
                <MaterialIcons
                  name={item.icon}
                  size={18}
                  color={isActive ? '#2563EB' : '#94A3B8'}
                />
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 11,
                    fontWeight: isActive ? '700' : '600',
                    color: isActive ? '#2563EB' : '#94A3B8',
                  }}
                >
                  {item.label || item.shortLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
};

export default BottomSidebarNav;