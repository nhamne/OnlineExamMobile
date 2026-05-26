import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import examApi from '../api/exam.api';
import { COLORS } from '../constants/theme';
import { MaterialIcons } from '@expo/vector-icons';

const StatisticsScreen = ({ route }) => {
  const { userId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const screenWidth = Dimensions.get('window').width;

  const fetchStats = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const response = await examApi.getStatistics(userId);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-surface">
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!stats) {
    return (
      <View className="flex-1 justify-center items-center bg-surface px-6">
        <MaterialIcons name="error-outline" size={48} color={COLORS.textSecondary} />
        <Text className="text-on-surface-variant mt-4 text-center">Không có dữ liệu thống kê.</Text>
      </View>
    );
  }

  const lineChartData = {
    labels: stats.history?.length > 0 ? stats.history.map(item => item.date) : ["-"],
    datasets: [
      {
        data: stats.history?.length > 0 ? stats.history.map(item => item.score) : [0],
        color: (opacity = 1) => `rgba(0, 91, 191, ${opacity})`,
        strokeWidth: 2
      }
    ],
    legend: ["Tiến trình điểm số"]
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-container-low">
      <ScrollView 
        className="flex-1 px-4"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="py-6">
          <Text className="text-3xl font-black text-on-surface tracking-tight">Thống kê học tập</Text>
          <Text className="text-on-surface-variant mt-1">Theo dõi tiến độ và kết quả của bạn</Text>
        </View>

        {/* Summary Cards */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-blue-50 p-4 rounded-2xl border border-blue-100 items-center">
            <Text className="text-2xl font-black text-primary">{stats.avgScore?.toFixed(1) || 0}</Text>
            <Text className="text-xs text-blue-700 font-bold uppercase mt-1">Điểm TB</Text>
          </View>
          <View className="flex-1 bg-green-50 p-4 rounded-2xl border border-green-100 items-center">
            <Text className="text-2xl font-black text-green-700">{stats.totalExams || 0}</Text>
            <Text className="text-xs text-green-700 font-bold uppercase mt-1">Bài đã thi</Text>
          </View>
          <View className="flex-1 bg-orange-50 p-4 rounded-2xl border border-orange-100 items-center">
            <Text className="text-2xl font-black text-orange-700">{stats.correctRate || 0}%</Text>
            <Text className="text-xs text-orange-700 font-bold uppercase mt-1">Tỷ lệ đúng</Text>
          </View>
        </View>

        {/* Line Chart */}
        <View className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <Text className="text-base font-bold text-on-surface mb-4">Biểu đồ tiến độ</Text>
          <LineChart
            data={lineChartData}
            width={screenWidth - 64}
            height={220}
            chartConfig={chartConfig}
            bezier
            style={{ marginVertical: 8, borderRadius: 16 }}
          />
        </View>

        {/* Additional Stats */}
        <View className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <View className="p-4 border-b border-slate-50">
            <Text className="text-base font-bold text-on-surface">Chi tiết hiệu năng</Text>
          </View>
          
          <DetailRow label="Bài điểm cao nhất" value={stats.highestScore || 0} icon="trending-up" color="#2ECC71" />
          <DetailRow label="Bài điểm thấp nhất" value={stats.lowestScore || 0} icon="trending-down" color="#E74C3C" />
          <DetailRow label="Thời gian làm bài TB" value={`${stats.avgDuration || 0} phút`} icon="schedule" color="#3498DB" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const DetailRow = ({ label, value, icon, color }) => (
  <View className="flex-row items-center justify-between p-4 border-b border-slate-50">
    <View className="flex-row items-center">
      <View className="w-8 h-8 rounded-full items-center justify-center mr-3" style={{ backgroundColor: `${color}15` }}>
        <MaterialIcons name={icon} size={18} color={color} />
      </View>
      <Text className="text-on-surface-variant">{label}</Text>
    </View>
    <Text className="font-bold text-on-surface">{value}</Text>
  </View>
);

const chartConfig = {
  backgroundColor: "#FFF",
  backgroundGradientFrom: "#FFF",
  backgroundGradientTo: "#FFF",
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(0, 91, 191, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(102, 102, 102, ${opacity})`,
  style: {
    borderRadius: 16
  },
  propsForDots: {
    r: "4",
    strokeWidth: "2",
    stroke: "#005BBF"
  }
};

export default StatisticsScreen;
