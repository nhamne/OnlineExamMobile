import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getExams } from '../../services/authService';
import { COLORS } from '../../constants/theme';
import { clearAuthSession } from '../../services/authSession';

const ExamItem = ({ item }) => {
  return (
    <View className="rounded-2xl bg-white p-5 mb-4 shadow-sm border border-slate-100">
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-lg font-black text-on-surface flex-1 pr-2" numberOfLines={2}>
          {item.title}
        </Text>
        <View className="bg-blue-50 px-2 py-1 rounded-lg">
          <Text className="text-xs font-bold text-primary">{item.durationInMinutes}ph</Text>
        </View>
      </View>
      
      <View className="flex-row items-center gap-4 mt-2">
        <View className="flex-row items-center">
          <MaterialIcons name="person" size={14} color={COLORS.textSecondary} />
          <Text className="text-xs text-on-surface-variant ml-1">{item.teacherName}</Text>
        </View>
        <View className="flex-row items-center">
          <MaterialIcons name="calendar-today" size={14} color={COLORS.textSecondary} />
          <Text className="text-xs text-on-surface-variant ml-1">
            {new Date(item.createdAt).toLocaleDateString('vi-VN')}
          </Text>
        </View>
      </View>
    </View>
  );
};

const HomeScreen = ({ route, navigation }) => {
  const user = route.params?.user;
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadExams = useCallback(async () => {
    try {
      setError('');
      const data = await getExams();
      setExams(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không tải được dữ liệu đề thi từ server.');
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadExams();
      setLoading(false);
    })();
  }, [loadExams]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadExams();
    setRefreshing(false);
  }, [loadExams]);

  const handleLogout = () => {
    clearAuthSession();
    navigation.replace('Login');
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface-container-low px-4">
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text className="mt-3 text-on-surface-variant font-medium">Đang tải dữ liệu...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-container-low">
      <View className="px-6 pt-6 pb-4">
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-on-surface-variant font-bold text-xs uppercase tracking-widest">Khám phá</Text>
            <Text className="text-3xl font-black text-on-surface tracking-tight">
              Xin chào, {user?.fullName?.split(' ').pop() || 'bạn'}!
            </Text>
          </View>
          <TouchableOpacity 
            onPress={handleLogout}
            className="w-10 h-10 rounded-full bg-red-50 items-center justify-center"
          >
            <MaterialIcons name="logout" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
        
        <View className="bg-primary/5 p-4 rounded-2xl border border-primary/10 mb-2">
          <Text className="text-primary font-bold">Mẹo học tập</Text>
          <Text className="text-on-surface-variant text-sm mt-1">
            Hãy ôn luyện các đề thi mới nhất để đạt kết quả cao trong kỳ thi sắp tới.
          </Text>
        </View>
      </View>

      {error ? (
        <View className="mx-6 rounded-xl bg-red-100 px-4 py-3 mb-4 border border-red-200">
          <Text className="text-red-700 text-sm font-medium">{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={exams}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ExamItem item={item} />}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View className="items-center py-20">
            <MaterialIcons name="description" size={64} color="#CBD5E1" />
            <Text className="text-on-surface-variant mt-4 font-medium">Chưa có dữ liệu đề thi.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

export default HomeScreen;
