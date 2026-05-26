import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import examApi from '../../api/exam.api';
import { COLORS } from '../../constants/theme';
import { StyleSheet } from 'react-native';

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

const styles = StyleSheet.create({
  ambientShadow: {
    elevation: 2,
    shadowColor: '#005bbf',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  }
});

const StudentResultsContent = ({ userId, onSelectAttempt }) => {
  const [loading, setLoading] = useState(true);
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
      <View className="py-12 items-center justify-center">
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text className="text-on-surface-variant mt-2">Đang tải kết quả thi...</Text>
      </View>
    );
  }

  return (
    <View className="mb-10">
      <View className="flex-row gap-3 mb-6">
        <View className="flex-1 bg-white rounded-2xl p-4" style={styles.ambientShadow}>
          <Text className="text-xs text-on-surface-variant font-bold uppercase">Tổng bài</Text>
          <Text className="text-2xl text-on-surface font-black mt-1">{summary.total}</Text>
        </View>
        <View className="flex-1 bg-white rounded-2xl p-4" style={styles.ambientShadow}>
          <Text className="text-xs text-on-surface-variant font-bold uppercase">Đã nộp</Text>
          <Text className="text-2xl text-green-700 font-black mt-1">{summary.submittedCount}</Text>
        </View>
        <View className="flex-1 bg-white rounded-2xl p-4" style={styles.ambientShadow}>
          <Text className="text-xs text-on-surface-variant font-bold uppercase">Điểm TB</Text>
          <Text className="text-2xl text-primary font-black mt-1">{summary.avgScore.toFixed(1)}</Text>
        </View>
      </View>

      {error ? (
        <View className="rounded-xl bg-red-100 px-4 py-3 mb-4 border border-red-200">
          <Text className="text-red-700 text-sm font-medium">{error}</Text>
        </View>
      ) : null}

      <Text className="text-xl font-bold text-on-surface mb-4">Lịch sử bài làm</Text>

      {results.length === 0 ? (
        <View className="bg-surface-container-lowest rounded-2xl p-8 items-center" style={styles.ambientShadow}>
          <MaterialIcons name="assignment-late" size={46} color="#cbd5e1" />
          <Text className="text-on-surface-variant mt-2 font-medium">Chưa có kết quả thi nào.</Text>
        </View>
      ) : (
        <View className="flex-col gap-3">
          {results.map((item) => {
            const isSubmitted = Number(item.Status) === 1;
            const badgeBg = isSubmitted ? '#dcfce7' : '#fee2e2';
            const badgeText = isSubmitted ? '#166534' : '#b91c1c';
            const statusText = isSubmitted ? 'Đã nộp' : 'Bị kết thúc';

            return (
              <TouchableOpacity
                key={String(item.AttemptId)}
                className="bg-surface-container-lowest rounded-2xl p-4 flex-row justify-between"
                style={styles.ambientShadow}
                onPress={() => onSelectAttempt && onSelectAttempt(item.AttemptId, item.SessionName)}
              >
                <View className="flex-1 pr-3">
                  <Text className="text-on-surface font-bold text-lg" numberOfLines={1}>{item.ExamTitle}</Text>
                  <Text className="text-on-surface-variant text-xs mt-1" numberOfLines={1}>{item.SessionName} • {item.ClassName}</Text>
                  <View className="flex-row items-center mt-3 gap-4">
                    <View>
                      <Text className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Điểm</Text>
                      <Text className="text-base font-black text-primary">{Number(item.Score || 0).toFixed(2)}</Text>
                    </View>
                    <View>
                      <Text className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Số câu đúng</Text>
                      <Text className="text-base font-black text-on-surface">{Number(item.CorrectAnswersCount || 0)}/{Number(item.TotalQuestions || 0)}</Text>
                    </View>
                  </View>
                </View>

                <View className="items-end justify-between">
                  <View className="px-2 py-1 rounded-lg" style={{ backgroundColor: badgeBg }}>
                    <Text className="text-[10px] font-bold" style={{ color: badgeText }}>{statusText}</Text>
                  </View>
                  <Text className="text-xs font-semibold text-on-surface-variant text-right">
                    {formatDateTime(item.SubmittedAt || item.StartedAt)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

export default StudentResultsContent;
