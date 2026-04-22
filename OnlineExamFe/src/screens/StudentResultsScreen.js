import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import examApi from '../api/exam.api';
import { COLORS } from '../constants/theme';

const formatDateTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';

  return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })}`;
};

const StudentResultsScreen = ({ navigation, route }) => {
  const userId = route?.params?.userId;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');

  const loadResults = useCallback(async () => {
    if (!userId) {
      setError('Không tìm thấy thông tin học sinh.');
      setResults([]);
      return;
    }

    try {
      setError('');
      const response = await examApi.getStudentResults(userId);
      setResults(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không tải được kết quả thi.');
    }
  }, [userId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadResults();
      setLoading(false);
    })();
  }, [loadResults]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadResults();
    setRefreshing(false);
  }, [loadResults]);

  const summary = useMemo(() => {
    const submittedCount = results.filter((item) => Number(item.Status) === 1).length;
    const avgScoreBase = results.filter((item) => Number(item.Status) === 1);
    const avgScore = avgScoreBase.length
      ? avgScoreBase.reduce((sum, item) => sum + Number(item.Score || 0), 0) / avgScoreBase.length
      : 0;

    return {
      total: results.length,
      submittedCount,
      avgScore,
    };
  }, [results]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-surface-container-low">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-container-low">
      <ScrollView
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 36 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="py-5">
          <TouchableOpacity
            className="flex-row items-center mb-3"
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={20} color={COLORS.primary} />
            <Text className="text-primary font-bold ml-1">Quay lại</Text>
          </TouchableOpacity>

          <Text className="text-3xl font-black text-on-surface tracking-tight">Kết quả thi</Text>
          <Text className="text-on-surface-variant mt-1">Theo dõi điểm số và lịch sử nộp bài thực tế</Text>
        </View>

        <View className="flex-row gap-3 mb-5">
          <View className="flex-1 bg-white rounded-2xl border border-slate-100 p-4">
            <Text className="text-xs text-on-surface-variant font-bold uppercase">Tổng bài</Text>
            <Text className="text-2xl text-on-surface font-black mt-1">{summary.total}</Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl border border-slate-100 p-4">
            <Text className="text-xs text-on-surface-variant font-bold uppercase">Đã nộp</Text>
            <Text className="text-2xl text-green-700 font-black mt-1">{summary.submittedCount}</Text>
          </View>
          <View className="flex-1 bg-white rounded-2xl border border-slate-100 p-4">
            <Text className="text-xs text-on-surface-variant font-bold uppercase">Điểm TB</Text>
            <Text className="text-2xl text-primary font-black mt-1">{summary.avgScore.toFixed(1)}</Text>
          </View>
        </View>

        {error ? (
          <View className="rounded-xl bg-red-100 px-4 py-3 mb-4 border border-red-200">
            <Text className="text-red-700 text-sm font-medium">{error}</Text>
          </View>
        ) : null}

        {results.length === 0 ? (
          <View className="bg-white rounded-2xl border border-slate-100 p-8 items-center">
            <MaterialIcons name="assignment-late" size={46} color="#cbd5e1" />
            <Text className="text-on-surface-variant mt-2">Chưa có kết quả thi nào.</Text>
          </View>
        ) : (
          results.map((item) => {
            const isSubmitted = Number(item.Status) === 1;
            const badgeBg = isSubmitted ? '#dcfce7' : '#fee2e2';
            const badgeText = isSubmitted ? '#166534' : '#b91c1c';
            const statusText = isSubmitted ? 'Đã nộp' : 'Bị kết thúc';

            return (
              <TouchableOpacity
                key={String(item.AttemptId)}
                className="bg-white rounded-2xl border border-slate-100 p-4 mb-3"
                onPress={() => navigation.navigate('StudentExamDetail', { attemptId: item.AttemptId })}
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1 pr-3">
                    <Text className="text-on-surface font-black text-base" numberOfLines={1}>{item.ExamTitle}</Text>
                    <Text className="text-on-surface-variant text-xs mt-1" numberOfLines={1}>{item.SessionName} • {item.ClassName}</Text>
                  </View>
                  <View className="px-2 py-1 rounded-lg" style={{ backgroundColor: badgeBg }}>
                    <Text className="text-xs font-bold" style={{ color: badgeText }}>{statusText}</Text>
                  </View>
                </View>

                <View className="flex-row items-center justify-between mt-1">
                  <Text className="text-sm text-on-surface-variant">Điểm</Text>
                  <Text className="text-base font-black text-on-surface">{Number(item.Score || 0).toFixed(2)}/10</Text>
                </View>

                <View className="flex-row items-center justify-between mt-1">
                  <Text className="text-sm text-on-surface-variant">Số câu đúng</Text>
                  <Text className="text-sm font-bold text-on-surface">{Number(item.CorrectAnswersCount || 0)}/{Number(item.TotalQuestions || 0)}</Text>
                </View>

                <View className="flex-row items-center justify-between mt-1">
                  <Text className="text-sm text-on-surface-variant">Nộp lúc</Text>
                  <Text className="text-sm font-semibold text-on-surface">{formatDateTime(item.SubmittedAt || item.StartedAt)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default StudentResultsScreen;
