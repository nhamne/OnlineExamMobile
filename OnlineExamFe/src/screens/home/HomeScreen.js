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

const ExamItem = ({ item }) => {
  return (
    <View className="rounded-xl bg-surface-container-lowest p-4 mb-3">
      <Text className="text-base font-bold text-on-surface mb-1">{item.title}</Text>
      <Text className="text-sm text-on-surface-variant mb-1">Giảng viên: {item.teacherName}</Text>
      <View className="flex-row items-center gap-1">
        <MaterialIcons name="schedule" size={16} color="#727785" />
        <Text className="text-sm text-on-surface-variant">{item.durationInMinutes} phút</Text>
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

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface-container-low px-4">
        <ActivityIndicator size="large" color="#005bbf" />
        <Text className="mt-3 text-on-surface-variant">Đang tải dữ liệu...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-container-low px-4 pt-4">
      <View className="mb-4">
        <Text className="text-xl font-black text-on-surface">Xin chào, {user?.fullName || 'bạn'}!</Text>
        <Text className="text-on-surface-variant">Danh sách đề thi từ cơ sở dữ liệu SQL Server</Text>
      </View>

      {error ? (
        <View className="rounded-lg bg-red-100 px-3 py-2 mb-3">
          <Text className="text-red-700 text-sm">{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={exams}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ExamItem item={item} />}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View className="items-center py-10">
            <Text className="text-on-surface-variant">Chưa có dữ liệu đề thi.</Text>
          </View>
        }
      />

      <TouchableOpacity
        className="absolute right-4 bottom-6 bg-primary rounded-full px-5 py-3"
        onPress={() => navigation.replace('Login')}
      >
        <Text className="text-white font-bold">Đăng xuất</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

export default HomeScreen;
