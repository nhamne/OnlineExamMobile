import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getStudentDashboard } from '../../services/authService';
import BottomSidebarNav from '../../components/BottomSidebarNav';
import DashboardTopBar from '../../components/DashboardTopBar';
import { useToast } from '../../context/ToastContext';
import { clearAuthSession } from '../../services/authSession';

const studentMenuItems = [
  { key: 'home', label: 'Trang chủ', shortLabel: 'Trang chủ', icon: 'home' },
  { key: 'classes', label: 'Lớp học', shortLabel: 'Lớp học', icon: 'groups' },
  { key: 'sessions', label: 'Ca thi', shortLabel: 'Ca thi', icon: 'assignment' },
  { key: 'results', label: 'Kết quả', shortLabel: 'Kết quả', icon: 'person-outline' },
];

const StatCard = ({ icon, label, value, tone = 'default' }) => {
  const toneClasses =
    tone === 'highlight'
      ? 'bg-blue-50 border-blue-200'
      : 'bg-surface-container-lowest border-outline-variant/30';

  return (
    <View className={`flex-1 rounded-2xl border p-4 ${toneClasses}`}>
      <View className="flex-row items-center gap-2 mb-2">
        <MaterialIcons name={icon} size={18} color="#005bbf" />
        <Text className="text-xs text-on-surface-variant font-semibold tracking-wide">{label}</Text>
      </View>
      <Text className="text-2xl font-black text-on-surface">{value}</Text>
    </View>
  );
};

const SessionCard = ({ item }) => (
  <View className="bg-surface-container-lowest border border-outline-variant/25 rounded-2xl p-4 mb-3">
    <View className="flex-row items-center justify-between">
      <Text className="font-extrabold text-on-surface flex-1 pr-3">{item.SessionName}</Text>
      <View className="bg-blue-50 px-2 py-1 rounded-lg">
        <Text className="text-xs font-bold text-primary">Ca thi</Text>
      </View>
    </View>
    <Text className="text-sm text-on-surface-variant mt-2">Lớp: {item.ClassName}</Text>
    <Text className="text-sm text-on-surface-variant">Bài thi: {item.ExamTitle}</Text>
  </View>
);

const StudentDashboardScreen = ({ route, navigation }) => {
  const user = route.params?.user;
  const { showToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeMenu, setActiveMenu] = useState('home');
  const [searchText, setSearchText] = useState('');

  const initials = useMemo(() => {
    const fullName = user?.fullName || '';
    if (!fullName.trim()) return 'HS';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[parts.length - 2][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }, [user?.fullName]);

  const loadData = useCallback(async () => {
    try {
      setError('');
      const data = await getStudentDashboard(user?.id);
      setSummary(data?.summary || null);
      setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không tải được dashboard học sinh.');
    }
  }, [user?.id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const onMenuSelect = (item) => {
    setActiveMenu(item.key);
  };

  const onPressAvatar = () => {
    setActiveMenu('profile');
  };

  const onLogout = () => {
    clearAuthSession();
    showToast('Bạn đã đăng xuất.', 'info');
    navigation.replace('Login');
  };

  const filterKeyword = searchText.trim().toLowerCase();
  const filteredSessions = useMemo(
    () =>
      sessions.filter((item) =>
        `${item.SessionName || ''} ${item.ClassName || ''} ${item.ExamTitle || ''}`
          .toLowerCase()
          .includes(filterKeyword)
      ),
    [sessions, filterKeyword]
  );

  const renderOverview = () => (
    <>
      <View className="flex-row gap-3 mb-3">
        <StatCard
          icon="class"
          label="Lớp đã tham gia"
          value={summary?.JoinedClassroomCount ?? 0}
          tone="highlight"
        />
        <StatCard
          icon="assignment-turned-in"
          label="Bài đã nộp"
          value={summary?.SubmittedCount ?? 0}
        />
      </View>
      <View className="mb-5">
        <StatCard
          icon="event-note"
          label="Ca thi chưa kết thúc"
          value={summary?.UpcomingSessionCount ?? 0}
        />
      </View>

      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-lg font-black text-on-surface">Lịch thi gần đây</Text>
        <Text className="text-sm text-primary font-bold">{filteredSessions.length} mục</Text>
      </View>

      {filteredSessions.slice(0, 4).map((item) => (
        <SessionCard key={String(item.Id)} item={item} />
      ))}

      {filteredSessions.length === 0 ? (
        <View className="items-center py-8">
          <Text className="text-on-surface-variant">Chưa có dữ liệu lịch thi.</Text>
        </View>
      ) : null}
    </>
  );

  const renderJoinClass = () => (
    <View className="bg-surface-container-lowest border border-outline-variant/25 rounded-2xl p-5">
      <Text className="text-xl font-black text-on-surface mb-2">Tham gia lớp học</Text>
      <Text className="text-on-surface-variant mb-4 leading-6">
        Nhập mã lớp do giáo viên cung cấp để tham gia lớp, nhận lịch thi và theo dõi kết quả học tập.
      </Text>
      <TouchableOpacity
        className="bg-primary rounded-xl h-12 items-center justify-center"
        onPress={() => showToast('Tính năng nhập mã lớp sẽ được cập nhật tiếp theo.', 'info')}
      >
        <Text className="text-white font-bold text-base">Nhập mã lớp</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSessions = () => (
    <>
      <Text className="text-xl font-black text-on-surface mb-3">Danh sách ca thi</Text>
      {filteredSessions.length > 0 ? (
        filteredSessions.map((item) => <SessionCard key={String(item.Id)} item={item} />)
      ) : (
        <View className="bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 items-center">
          <Text className="text-on-surface-variant">Hiện chưa có ca thi nào được phân công.</Text>
        </View>
      )}
    </>
  );

  const renderStats = () => {
    const joined = Number(summary?.JoinedClassroomCount ?? 0);
    const submitted = Number(summary?.SubmittedCount ?? 0);
    const upcoming = Number(summary?.UpcomingSessionCount ?? 0);
    const completion = joined > 0 ? Math.round((submitted / joined) * 100) : 0;

    return (
      <>
        <Text className="text-xl font-black text-on-surface mb-3">Thống kê kết quả</Text>
        <View className="flex-row gap-3 mb-3">
          <StatCard icon="task-alt" label="Tỉ lệ hoàn thành" value={`${completion}%`} tone="highlight" />
          <StatCard icon="event-upcoming" label="Lịch thi sắp tới" value={upcoming} />
        </View>
        <View className="bg-surface-container-lowest border border-outline-variant/25 rounded-2xl p-4">
          <Text className="text-sm text-on-surface-variant">Đánh giá nhanh</Text>
          <Text className="text-base font-bold text-on-surface mt-1">
            {completion >= 80
              ? 'Tiến độ học tập rất tốt, hãy duy trì phong độ.'
              : 'Bạn nên hoàn thành thêm bài tập để cải thiện tiến độ.'}
          </Text>
        </View>
      </>
    );
  };

  const renderProfile = () => (
    <View className="mb-6">
      <Text className="text-xl font-bold text-on-surface mb-4">Thông tin tài khoản</Text>
      <View className="bg-surface-container-lowest border border-outline-variant/25 rounded-2xl p-5">
        <View className="flex-row items-center">
          <View className="w-14 h-14 rounded-full bg-primary items-center justify-center mr-4">
            <Text className="text-white font-bold text-lg">{initials}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-on-surface">{user?.fullName || '--'}</Text>
            <Text className="text-sm text-on-surface-variant">{user?.email || '--'}</Text>
            <Text className="text-xs text-on-surface-variant mt-1">Vai trò: Học sinh</Text>
          </View>
        </View>

        <TouchableOpacity
          className="mt-5 bg-primary rounded-xl h-11 items-center justify-center"
          onPress={onLogout}
        >
          <Text className="text-white font-bold">Đăng xuất</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMainContent = () => {
    if (activeMenu === 'classes') return renderJoinClass();
    if (activeMenu === 'sessions') return renderSessions();
    if (activeMenu === 'results') return renderStats();
    if (activeMenu === 'profile') return renderProfile();
    return renderOverview();
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface-container-low">
        <ActivityIndicator size="large" color="#005bbf" />
        <Text className="mt-3 text-on-surface-variant">Đang tải dashboard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1 bg-surface-container-low"
      style={Platform.OS === 'web' ? { height: '100vh' } : {}}
    >
      <DashboardTopBar
        searchText={searchText}
        onChangeSearch={setSearchText}
        upcomingCount={summary?.UpcomingSessionCount}
        initials={initials}
        onPressAvatar={onPressAvatar}
      />

      <ScrollView
        style={{ flex: 1 }}
        className="px-4"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="mb-8 mt-6">
          <Text className="text-on-surface-variant font-medium text-xs tracking-widest uppercase mb-1">
            {activeMenu === 'profile'
              ? 'Tài khoản'
              : studentMenuItems.find((item) => item.key === activeMenu)?.label || 'Trang chủ'}
          </Text>
          <Text className="text-3xl font-semibold text-on-surface tracking-tight leading-tight" numberOfLines={2}>
            Chào mừng trở lại,{"\n"}{user?.fullName || 'Học sinh'}!
          </Text>
        </View>

        {error ? (
          <View className="rounded-xl bg-red-100 px-3 py-2 mb-4 border border-red-200">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        ) : null}

        {renderMainContent()}
      </ScrollView>

      <BottomSidebarNav
        items={studentMenuItems}
        activeKey={activeMenu}
        onSelect={onMenuSelect}
      />
    </SafeAreaView>
  );
};

export default StudentDashboardScreen;
