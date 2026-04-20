import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import TeacherScreenShell from '../../components/TeacherScreenShell';
import { useToast } from '../../context/ToastContext';
import { clearAuthSession } from '../../services/authSession';
import { getTeacherDashboard } from '../../services/authService';

const bottomNavItems = [
  { key: 'home', label: 'Trang chủ', shortLabel: 'Home', icon: 'home' },
  { key: 'classes', label: 'Lớp học', shortLabel: 'Classes', icon: 'groups' },
  { key: 'exams', label: 'Đề thi', shortLabel: 'Exams', icon: 'description' },
  { key: 'sessions', label: 'Ca thi', shortLabel: 'Sessions', icon: 'event' },
];

const formatDateTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('vi-VN', {
    hour12: false,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const SESSION_STATUS_STYLES = {
  'Sắp diễn ra': { bg: '#dbeafe', text: '#1d4ed8' },
  'Đã kết thúc': { bg: '#e0e2ec', text: '#414754' },
  'Đang diễn ra': { bg: '#ffedd5', text: '#c2410c' },
  'Không xác định': { bg: '#f1f5f9', text: '#475569' },
};

const getSessionStatus = (session) => {
  const now = new Date();
  const start = new Date(session.StartTime);
  const end = new Date(session.EndTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { label: 'Không xác định', bgClass: 'bg-slate-100', textClass: 'text-slate-600' };
  }

  if (now < start) {
    return { label: 'Sắp diễn ra' };
  }

  if (now > end) {
    return { label: 'Đã kết thúc' };
  }

  return { label: 'Đang diễn ra' };
};

const TeacherDashboardScreen = ({ route, navigation }) => {
  const { showToast } = useToast();
  const user = route?.params?.user || null;
  const initialTab = route?.params?.initialTab;

  const getStartingTab = () => {
    const allowedTabs = new Set(['home', 'exams', 'sessions', 'profile']);
    return allowedTabs.has(initialTab) ? initialTab : 'home';
  };

  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState(getStartingTab());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [teacher, setTeacher] = useState(null);
  const [summary, setSummary] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [examPapers, setExamPapers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const bodyOpacity = React.useRef(new Animated.Value(1)).current;

  const ambientShadow = {
    shadowColor: '#191c23',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 4,
  };

  const displayTeacher = teacher || user;

  const initials = useMemo(() => {
    const fullName = displayTeacher?.fullName || '';
    if (!fullName.trim()) return 'GV';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[parts.length - 2][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }, [displayTeacher?.fullName]);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setError('Không tìm thấy thông tin tài khoản giáo viên.');
      return;
    }

    try {
      setError('');
      const data = await getTeacherDashboard(user.id);
      setTeacher(data?.teacher || null);
      setSummary(data?.summary || null);
      setClassrooms(Array.isArray(data?.classrooms) ? data.classrooms : []);
      setExamPapers(Array.isArray(data?.examPapers) ? data.examPapers : []);
      setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không tải được dữ liệu dashboard giáo viên.');
    }
  }, [user?.id]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadData();
      setLoading(false);
    })();
  }, [loadData]);

  useEffect(() => {
    bodyOpacity.setValue(0.94);
    Animated.timing(bodyOpacity, {
      toValue: 1,
      duration: 170,
      useNativeDriver: true,
    }).start();
  }, [activeTab, bodyOpacity]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const onPressBottomNav = (item) => {
    if (item.key === 'classes') {
      navigation.replace('TeacherClassrooms', { user: displayTeacher || user });
      return;
    }

    if (item.key === 'sessions') {
      navigation.replace('TeacherSessions', { user: displayTeacher || user });
      return;
    }

    setActiveTab(item.key);
  };

  const onPressAvatar = () => {
    if (!displayTeacher) {
      showToast('Không có dữ liệu hồ sơ giáo viên.', 'error');
      return;
    }

    setActiveTab('profile');
  };

  const onLogout = () => {
    clearAuthSession();
    showToast('Bạn đã đăng xuất.', 'info');
    navigation.replace('Login');
  };

  const filterKeyword = searchText.trim().toLowerCase();
  const filteredClassrooms = useMemo(
    () =>
      classrooms.filter((item) =>
        `${item.ClassName || ''} ${item.JoinCode || ''}`.toLowerCase().includes(filterKeyword)
      ),
    [classrooms, filterKeyword]
  );

  const filteredExamPapers = useMemo(
    () => examPapers.filter((item) => `${item.Title || ''}`.toLowerCase().includes(filterKeyword)),
    [examPapers, filterKeyword]
  );

  const filteredSessions = useMemo(
    () =>
      sessions.filter((item) =>
        `${item.SessionName || ''} ${item.ClassName || ''} ${item.ExamTitle || ''}`
          .toLowerCase()
          .includes(filterKeyword)
      ),
    [sessions, filterKeyword]
  );

  const renderSummaryCards = () => (
    <View className="flex-col mb-10">
      <View style={ambientShadow} className="bg-surface-container-lowest p-6 rounded-2xl mb-4">
        <View className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-1">
          <MaterialIcons name="groups" size={24} color="#005bbf" />
        </View>
        <View className="flex-row items-end justify-between">
          <Text className="text-on-surface-variant text-sm font-medium flex-1 pr-3" numberOfLines={1}>
            Tổng số lớp học
          </Text>
          <Text className="text-3xl font-black text-on-surface">{summary?.ClassroomCount ?? 0}</Text>
        </View>
      </View>

      <View style={ambientShadow} className="bg-surface-container-lowest p-6 rounded-2xl mb-4">
        <View className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
          <MaterialIcons name="description" size={24} color="#9e4300" />
        </View>
        <View className="flex-row items-end justify-between">
          <Text className="text-on-surface-variant text-sm font-medium flex-1 pr-3" numberOfLines={1}>
            Tổng số đề thi
          </Text>
          <Text className="text-3xl font-black text-on-surface">{summary?.ExamPaperCount ?? 0}</Text>
        </View>
      </View>

      <View style={ambientShadow} className="bg-surface-container-lowest p-6 rounded-2xl">
        <View className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
          <MaterialIcons name="fact-check" size={24} color="#006e2c" />
        </View>
        <View className="flex-row items-end justify-between">
          <Text className="text-on-surface-variant text-sm font-medium flex-1 pr-3" numberOfLines={1}>
            Tổng số ca thi
          </Text>
          <Text className="text-3xl font-black text-on-surface">{summary?.SessionCount ?? 0}</Text>
        </View>
      </View>
    </View>
  );

  const renderClassrooms = (options = {}) => {
    const { compact = false, showAllButton = false } = options;
    const classroomsToRender = compact ? filteredClassrooms.slice(0, 3) : filteredClassrooms;

    return (
      <View className="mb-10">
        <Text className="text-xl font-bold text-on-surface mb-4">Lớp học gần đây</Text>
        <View className="flex-col">
          {classroomsToRender.length > 0 ? (
            classroomsToRender.map((item) => (
              <View
                key={item.Id}
                style={ambientShadow}
                className="bg-surface-container-lowest p-4 rounded-xl mb-3"
              >
                <Text className="font-bold text-on-surface text-base" numberOfLines={1}>
                  {item.ClassName}
                </Text>
                <Text className="text-xs text-on-surface-variant mt-1" numberOfLines={1}>
                  {item.StudentCount ?? 0} học sinh
                </Text>
              </View>
            ))
          ) : (
            <View className="p-4 rounded-xl border border-dashed bg-surface-container-high" style={{ borderColor: '#c1c6d699', backgroundColor: '#e6e8f266' }}>
              <Text className="text-sm text-on-surface-variant text-center">Không có lớp học phù hợp.</Text>
            </View>
          )}

          {compact && filteredClassrooms.length > 3 && showAllButton ? (
            <TouchableOpacity
              className="mt-1 items-center justify-center rounded-xl border py-3"
              style={{ borderColor: '#005bbf33', backgroundColor: '#005bbf0d' }}
              onPress={() => navigation.navigate('TeacherClassrooms', { user: displayTeacher || user })}
            >
              <Text className="text-primary font-bold">Xem tất cả</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  const renderExamPapers = () => (
    <View className="mb-10">
      <Text className="text-xl font-bold text-on-surface mb-4">Đề thi gần đây</Text>
      <View className="flex-col gap-3">
        {filteredExamPapers.length > 0 ? (
          filteredExamPapers.map((item) => (
            <View
              key={item.Id}
              style={ambientShadow}
              className="bg-surface-container-lowest p-4 rounded-xl flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-4 flex-1 pr-3">
                <View className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                  <MaterialIcons name="description" size={24} color="#c55500" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="font-bold text-on-surface text-base" numberOfLines={1}>
                    {item.Title}
                  </Text>
                  <Text className="text-xs text-on-surface-variant" numberOfLines={1}>
                    {item.DurationInMinutes} phút - {item.QuestionCount ?? 0} câu hỏi
                  </Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#005bbf" />
            </View>
          ))
        ) : (
          <View className="p-4 rounded-xl border border-dashed bg-surface-container-high" style={{ borderColor: '#c1c6d699', backgroundColor: '#e6e8f266' }}>
            <Text className="text-sm text-on-surface-variant text-center">Không có đề thi phù hợp.</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderSessions = (options = {}) => {
    const { compact = false, showAllInline = false } = options;
    const sessionsToRender = compact ? filteredSessions.slice(0, 5) : filteredSessions;

    return (
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xl font-bold text-on-surface">Các ca thi gần đây</Text>
          {compact && filteredSessions.length > 5 && showAllInline ? (
            <TouchableOpacity onPress={() => setActiveTab('sessions')}>
              <Text className="text-primary font-bold">Xem tất cả</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View className="flex-col gap-3">
          {sessionsToRender.length > 0 ? (
            sessionsToRender.map((item) => {
              const status = getSessionStatus(item);
              const statusStyle = SESSION_STATUS_STYLES[status.label] || SESSION_STATUS_STYLES['Không xác định'];

              return (
                <View
                  key={item.Id}
                  style={ambientShadow}
                  className="bg-surface-container-lowest p-4 rounded-xl flex-row items-center justify-between"
                >
                  <View className="flex-row items-center gap-4 flex-1 min-w-0">
                    <View className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                      <MaterialIcons name="event-available" size={24} color="#414754" />
                    </View>
                    <View className="flex-1 min-w-0 pr-2">
                      <Text className="font-bold text-on-surface text-base" numberOfLines={1}>
                        {item.SessionName}
                      </Text>
                      <Text className="text-xs text-on-surface-variant" numberOfLines={1}>
                        {item.ClassName} - {item.ExamTitle}
                      </Text>
                      <Text className="text-xs text-on-surface-variant mt-1">
                        {formatDateTime(item.StartTime)}
                      </Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: statusStyle.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
                    <Text style={{ color: statusStyle.text, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>
                      {status.label}
                    </Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View className="p-4 rounded-xl border border-dashed bg-surface-container-high" style={{ borderColor: '#c1c6d699', backgroundColor: '#e6e8f266' }}>
              <Text className="text-sm text-on-surface-variant text-center">Không có ca thi phù hợp.</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderProfile = () => (
    <View className="mb-6">
      <Text className="text-xl font-bold text-on-surface mb-4">Thông tin tài khoản</Text>
      <View style={ambientShadow} className="bg-surface-container-lowest p-5 rounded-2xl">
        <View className="flex-row items-center">
          <View className="w-14 h-14 rounded-full bg-primary items-center justify-center mr-4">
            <Text className="text-white font-bold text-lg">{initials}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-on-surface">{displayTeacher?.fullName || '--'}</Text>
            <Text className="text-sm text-on-surface-variant">{displayTeacher?.email || '--'}</Text>
            <Text className="text-xs text-on-surface-variant mt-1">Vai trò: Giáo viên</Text>
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

  const renderContentByTab = () => {
    if (activeTab === 'exams') return renderExamPapers();
    if (activeTab === 'sessions') return renderSessions();
    if (activeTab === 'profile') return renderProfile();

    return (
      <>
        {renderSummaryCards()}
        {renderClassrooms({ compact: true, showAllButton: true })}
        {renderSessions({ compact: true, showAllInline: true })}
      </>
    );
  };

  if (loading) {
    return (
      <TeacherScreenShell
        bottomNavItems={bottomNavItems}
        activeKey="home"
        onSelectBottomNav={onPressBottomNav}
        searchText={searchText}
        onChangeSearch={setSearchText}
        upcomingCount={summary?.UpcomingSessionCount}
        initials={initials}
        onPressAvatar={onPressAvatar}
      >
        <View className="flex-1 items-center justify-center px-4" style={{ minHeight: 0 }}>
          <ActivityIndicator size="large" color="#005bbf" />
          <Text className="mt-3 text-on-surface-variant">Đang tải dashboard giáo viên...</Text>
        </View>
      </TeacherScreenShell>
    );
  }

  return (
    <TeacherScreenShell
      bottomNavItems={bottomNavItems}
      activeKey={activeTab}
      onSelectBottomNav={onPressBottomNav}
      searchText={searchText}
      onChangeSearch={setSearchText}
      upcomingCount={summary?.UpcomingSessionCount}
      initials={initials}
      onPressAvatar={onPressAvatar}
    >
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        className="px-4"
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="mb-8">
          <Text className="mt-6 text-primary text-2xl font-bold tracking-tight mb-1">
            {activeTab === 'home'
              ? 'Tổng quan'
              : activeTab === 'profile'
                ? 'Thông tin tài khoản'
                : bottomNavItems.find((i) => i.key === activeTab)?.label}
          </Text>
          <Text className="text-3xl font-semibold text-on-surface tracking-tight leading-tight" numberOfLines={2}>
            Chào mừng trở lại,{"\n"}{displayTeacher?.fullName || 'Giáo viên'}!
          </Text>
        </View>

        {error ? (
          <View className="rounded-lg bg-red-100 px-3 py-2 mb-4 border border-red-200">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        ) : null}

        <Animated.View style={{ opacity: bodyOpacity }}>
          {renderContentByTab()}
        </Animated.View>
      </ScrollView>
    </TeacherScreenShell>
  );
};

export default TeacherDashboardScreen;
