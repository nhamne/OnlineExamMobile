import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { 
  getStudentDashboard, 
  getStudentClassrooms, 
  joinClassroom,
  startExamAttempt 
} from '../../services/authService';
import BottomSidebarNav from '../../components/BottomSidebarNav';
import DashboardTopBar from '../../components/DashboardTopBar';
import { useToast } from '../../context/ToastContext';
import { clearAuthSession } from '../../services/authSession';
import { useDispatch } from 'react-redux';
import { setAttempt } from '../../store/useExamStore';
import { COLORS } from '../../constants/theme';

const studentMenuItems = [
  { key: 'home', label: 'Trang chủ', shortLabel: 'Trang chủ', icon: 'home' },
  { key: 'classes', label: 'Lớp học', shortLabel: 'Lớp học', icon: 'groups' },
  { key: 'sessions', label: 'Ca thi', shortLabel: 'Ca thi', icon: 'assignment' },
  { key: 'results', label: 'Kết quả', shortLabel: 'Kết quả', icon: 'person-outline' },
];

const StatCard = ({ icon, label, value, tone = 'default', onPress }) => {
  const isHighlight = tone === 'highlight';

  return (
    <TouchableOpacity
      disabled={!onPress}
      onPress={onPress}
      className="flex-1 rounded-2xl border p-4"
      style={{
        backgroundColor: isHighlight ? '#eff6ff' : '#ffffff',
        borderColor: isHighlight ? '#bfdbfe' : '#c1c6d640',
      }}
    >
      <View className="flex-row items-center gap-2 mb-2">
        <MaterialIcons name={icon} size={18} color={COLORS.primary} />
        <Text className="text-xs text-on-surface-variant font-semibold tracking-wide">{label}</Text>
      </View>
      <Text className="text-2xl font-black text-on-surface">{value}</Text>
    </TouchableOpacity>
  );
};

const SessionCard = ({ item, onPress }) => (
  <TouchableOpacity 
    onPress={() => onPress && onPress(item)}
    className="bg-surface-container-lowest rounded-2xl p-4 mb-3 border border-slate-100 shadow-sm"
  >
    <View className="flex-row items-center justify-between">
      <Text className="font-extrabold text-on-surface flex-1 pr-3" numberOfLines={1}>{item.SessionName}</Text>
      <View className="bg-blue-50 px-2 py-1 rounded-lg">
        <Text className="text-xs font-bold text-primary">Vào thi</Text>
      </View>
    </View>
    <View className="flex-row items-center mt-2">
      <MaterialIcons name="class" size={14} color="#666" />
      <Text className="text-sm text-on-surface-variant ml-1">Lớp: {item.ClassName}</Text>
    </View>
    <View className="flex-row items-center mt-1">
      <MaterialIcons name="description" size={14} color="#666" />
      <Text className="text-sm text-on-surface-variant ml-1">Bài thi: {item.ExamTitle}</Text>
    </View>
  </TouchableOpacity>
);

const StudentDashboardScreen = ({ route, navigation }) => {
  const user = route.params?.user;
  const dispatch = useDispatch();
  const { showToast } = useToast();
  
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeMenu, setActiveMenu] = useState('home');
  const [searchText, setSearchText] = useState('');
  
  // Join classroom state
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

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
      const [dashData, classData] = await Promise.all([
        getStudentDashboard(user?.id),
        getStudentClassrooms(user?.id)
      ]);
      
      setSummary(dashData?.summary || null);
      setSessions(Array.isArray(dashData?.sessions) ? dashData.sessions : []);
      setClassrooms(Array.isArray(classData) ? classData : []);
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

  const handleJoinClass = async () => {
    if (!joinCode.trim()) {
      showToast('Vui lòng nhập mã lớp.', 'warning');
      return;
    }
    
    setJoining(true);
    try {
      await joinClassroom(user?.id, joinCode.trim());
      showToast('Tham gia lớp học thành công!', 'success');
      setJoinCode('');
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Lỗi khi tham gia lớp học.', 'error');
    } finally {
      setJoining(false);
    }
  };

  const handleEnterSession = async (session) => {
    try {
      showToast('Đang chuẩn bị bài thi...', 'info');
      const data = await startExamAttempt(user?.id, session.Id);
      dispatch(setAttempt({
        attempt: data.attempt,
        questions: data.questions,
        duration: data.attempt.duration
      }));
      navigation.navigate('TakeExam');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể vào ca thi.', 'error');
    }
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
          onPress={() => setActiveMenu('classes')}
        />
        <StatCard
          icon="assignment-turned-in"
          label="Bài đã nộp"
          value={summary?.SubmittedCount ?? 0}
          onPress={() => setActiveMenu('results')}
        />
      </View>
      <View className="mb-5">
        <StatCard
          icon="event-note"
          label="Ca thi sắp diễn ra"
          value={summary?.UpcomingSessionCount ?? 0}
          onPress={() => setActiveMenu('sessions')}
        />
      </View>

      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-lg font-black text-on-surface">Ca thi gần đây</Text>
        <TouchableOpacity onPress={() => setActiveMenu('sessions')}>
          <Text className="text-sm text-primary font-bold">Xem tất cả</Text>
        </TouchableOpacity>
      </View>

      {filteredSessions.slice(0, 4).map((item) => (
        <SessionCard key={String(item.Id)} item={item} onPress={handleEnterSession} />
      ))}

      {filteredSessions.length === 0 ? (
        <View className="items-center py-8 bg-white rounded-2xl border border-slate-50">
          <MaterialIcons name="event-busy" size={48} color="#CBD5E1" />
          <Text className="text-on-surface-variant mt-2 font-medium">Chưa có lịch thi nào.</Text>
        </View>
      ) : null}
    </>
  );

  const renderClasses = () => (
    <View>
      {/* Join Section */}
      <View className="bg-white rounded-2xl p-5 mb-6 border border-slate-100 shadow-sm">
        <Text className="text-xl font-black text-on-surface mb-2">Tham gia lớp học</Text>
        <Text className="text-on-surface-variant mb-4 text-sm">
          Nhập mã lớp do giáo viên cung cấp để bắt đầu.
        </Text>
        <View className="flex-row gap-2">
          <TextInput
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-on-surface font-medium"
            placeholder="Mã lớp (VD: WEB101)"
            value={joinCode}
            onChangeText={setJoinCode}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            className={`bg-primary rounded-xl px-6 h-12 items-center justify-center ${joining ? 'opacity-70' : ''}`}
            onPress={handleJoinClass}
            disabled={joining}
          >
            {joining ? <ActivityIndicator color="#FFF" /> : <Text className="text-white font-black">THAM GIA</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* List Section */}
      <Text className="text-lg font-black text-on-surface mb-3">Lớp học của bạn ({classrooms.length})</Text>
      {classrooms.length > 0 ? (
        classrooms.map((c) => (
          <View key={c.Id} className="bg-white p-4 rounded-2xl mb-3 border border-slate-100 flex-row items-center">
            <View className="w-12 h-12 rounded-full bg-blue-50 items-center justify-center mr-4">
              <MaterialIcons name="school" size={24} color={COLORS.primary} />
            </View>
            <View className="flex-1">
              <Text className="font-bold text-on-surface text-base">{c.ClassName}</Text>
              <Text className="text-xs text-on-surface-variant">Giáo viên: {c.TeacherName}</Text>
              <Text className="text-[10px] text-primary font-bold uppercase tracking-widest mt-1">Mã: {c.JoinCode}</Text>
            </View>
          </View>
        ))
      ) : (
        <View className="bg-white rounded-2xl p-8 items-center border border-slate-100">
          <MaterialIcons name="group-off" size={48} color="#CBD5E1" />
          <Text className="text-on-surface-variant mt-2">Bạn chưa tham gia lớp học nào.</Text>
        </View>
      )}
    </View>
  );

  const renderSessions = () => (
    <>
      <Text className="text-xl font-black text-on-surface mb-3">Danh sách ca thi</Text>
      {filteredSessions.length > 0 ? (
        filteredSessions.map((item) => (
          <SessionCard key={String(item.Id)} item={item} onPress={handleEnterSession} />
        ))
      ) : (
        <View className="bg-white rounded-2xl p-8 items-center border border-slate-100">
          <MaterialIcons name="assignment-late" size={48} color="#CBD5E1" />
          <Text className="text-on-surface-variant mt-2 text-center">
            Hiện chưa có ca thi nào được phân công.
          </Text>
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
        <View className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <Text className="text-xs text-on-surface-variant font-bold uppercase tracking-widest mb-1">Đánh giá tiến độ</Text>
          <Text className="text-base font-semibold text-on-surface leading-6">
            {completion >= 80
              ? 'Tiến độ học tập rất tốt, hãy tiếp tục duy trì phong độ này!'
              : 'Hãy cố gắng hoàn thành thêm các bài thi để cải thiện kết quả học tập.'}
          </Text>
          <TouchableOpacity 
            className="mt-4 flex-row items-center"
            onPress={() => navigation.navigate('StudentStatistics', { userId: user?.id })}
          >
            <Text className="text-primary font-bold mr-1">Xem thống kê chi tiết</Text>
            <MaterialIcons name="chevron-right" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </>
    );
  };

  const renderProfile = () => (
    <View className="mb-6">
      <Text className="text-xl font-bold text-on-surface mb-4">Hồ sơ cá nhân</Text>
      <View className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
        <View className="flex-row items-center mb-6">
          <View className="w-16 h-16 rounded-full bg-primary items-center justify-center mr-4">
            <Text className="text-white font-black text-2xl">{initials}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xl font-black text-on-surface">{user?.fullName || '--'}</Text>
            <Text className="text-sm text-on-surface-variant">{user?.email || '--'}</Text>
          </View>
        </View>
        
        <View className="border-t border-slate-50 pt-4">
          <ProfileRow icon="badge" label="Vai trò" value="Học sinh" />
          <ProfileRow icon="school" label="Trạng thái" value="Đang học" />
        </View>

        <TouchableOpacity
          className="mt-6 bg-red-50 rounded-2xl h-14 items-center justify-center border border-red-100"
          onPress={() => {
            clearAuthSession();
            showToast('Bạn đã đăng xuất.', 'info');
            navigation.replace('Login');
          }}
        >
          <Text className="text-red-600 font-black text-base">Đăng xuất</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const ProfileRow = ({ icon, label, value }) => (
    <View className="flex-row items-center justify-between py-3">
      <View className="flex-row items-center">
        <MaterialIcons name={icon} size={20} color="#64748B" />
        <Text className="text-on-surface-variant ml-2">{label}</Text>
      </View>
      <Text className="font-bold text-on-surface">{value}</Text>
    </View>
  );

  const renderMainContent = () => {
    if (activeMenu === 'classes') return renderClasses();
    if (activeMenu === 'sessions') return renderSessions();
    if (activeMenu === 'results') return renderStats();
    if (activeMenu === 'profile') return renderProfile();
    return renderOverview();
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 items-center justify-center bg-surface-container-low">
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text className="mt-3 text-on-surface-variant font-medium">Đang tải dữ liệu...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={['bottom']}
      className="flex-1 bg-surface-container-low"
      style={Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden' } : {}}
    >
      <DashboardTopBar
        searchText={searchText}
        onChangeSearch={setSearchText}
        upcomingCount={summary?.UpcomingSessionCount}
        initials={initials}
        onPressAvatar={() => setActiveMenu('profile')}
      />

      <ScrollView
        style={{ flex: 1 }}
        className="px-4"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="mb-8 mt-6">
          <Text className="text-on-surface-variant font-bold text-xs tracking-[2px] uppercase mb-1">
            {activeMenu === 'profile'
              ? 'Tài khoản'
              : studentMenuItems.find((item) => item.key === activeMenu)?.label || 'Trang chủ'}
          </Text>
          <Text className="text-3xl font-black text-on-surface tracking-tight leading-tight" numberOfLines={2}>
            Chào bạn,{"\n"}{user?.fullName || 'Học sinh'}!
          </Text>
        </View>

        {error ? (
          <View className="rounded-xl bg-red-100 px-4 py-3 mb-6 border border-red-200">
            <Text className="text-red-700 text-sm font-medium">{error}</Text>
          </View>
        ) : null}

        {renderMainContent()}
      </ScrollView>

      <BottomSidebarNav
        items={studentMenuItems}
        activeKey={activeMenu}
        onSelect={(item) => setActiveMenu(item.key)}
      />
    </SafeAreaView>
  );
};

export default StudentDashboardScreen;
