import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const DashboardTopBar = ({
  searchText,
  onChangeSearch,
  upcomingCount = 0,
  initials = '--',
  onPressAvatar,
}) => {
  return (
    <View className="flex-row items-center justify-between px-4 py-4 bg-white z-10 border-b border-outline-variant/20">
      <View className="flex-1 flex-row items-center bg-surface-container-high rounded-full px-4 h-10 mr-4">
        <MaterialIcons name="search" size={20} color="#414754" />
        <TextInput
          className="flex-1 ml-2 text-sm text-on-surface font-medium"
          placeholder="Tìm kiếm lớp, đề, ca thi..."
          placeholderTextColor="#727785"
          value={searchText}
          onChangeText={onChangeSearch}
        />
      </View>

      <View className="flex-row items-center">
        <TouchableOpacity className="relative">
          <MaterialIcons name="notifications" size={24} color="#414754" />
          {Number(upcomingCount ?? 0) > 0 ? (
            <View className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface-container-low" />
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          className="w-9 h-9 rounded-full bg-primary flex items-center justify-center ml-4"
          onPress={onPressAvatar}
        >
          <Text className="text-white font-bold text-xs">{initials}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default DashboardTopBar;
