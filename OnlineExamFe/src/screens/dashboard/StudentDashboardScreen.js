import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  getStudentDashboard, 
  getStudentClassrooms, 
  joinClassroom,
  startExamAttempt,
  getStudentResultHistory,
  examApi,
  updateUserProfile,
  changeUserPassword,
  globalSearch,
} from '../../services/authService';
import BottomSidebarNav from '../../components/BottomSidebarNav';
import DashboardTopBar from '../../components/DashboardTopBar';
import { useToast } from '../../context/ToastContext';
import { clearAuthSession, loadAuthSession } from '../../services/authSession';
import { useDispatch } from 'react-redux';
import { setAttempt } from '../../store/useExamStore';
import { COLORS } from '../../constants/theme';
import StudentResultsContent from './StudentResultsContent';
import * as Clipboard from 'expo-clipboard';
import {
  disableBiometricLogin,
  enableBiometricLogin,
  getBiometricInfo,
} from '../../services/biometricAuth';

const ambientShadow = Platform.OS === 'ios'
  ? { shadowColor: '#005bbf', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12 }
  : { elevation: 2, shadowColor: '#005bbf' };

const studentMenuItems = [
  { key: 'home', label: 'Trang chủ', shortLabel: 'Trang chủ', icon: 'home' },
  { key: 'classes', label: 'Lớp học', shortLabel: 'Lớp học', icon: 'groups' },
  { key: 'sessions', label: 'Ca thi', shortLabel: 'Ca thi', icon: 'assignment' },
  { key: 'results', label: 'Kết quả', shortLabel: 'Kết quả', icon: 'person-outline' },
];

const getSessionState = (item) => {
  const submissionStatus = Number(item?.SubmissionStatus);
  const now = Date.now();
  const startTime = item?.StartTime ? new Date(item.StartTime).getTime() : NaN;
  const endTime = item?.EndTime ? new Date(item.EndTime).getTime() : NaN;

  if (submissionStatus === 1) {
    return {
      key: 'submitted',
      label: 'Đã nộp',
      canEnter: false,
      action: 'result',
      badgeStyle: { backgroundColor: '#dcfce7' },
      textStyle: { color: '#15803d' },
    };
  }

  if (submissionStatus === 2) {
    return {
      key: 'forced',
      label: 'Đã kết thúc',
      canEnter: false,
      action: 'result',
      badgeStyle: { backgroundColor: '#e2e8f0' },
      textStyle: { color: '#334155' },
      buttonStyle: { backgroundColor: '#e2e8f0' },
      buttonTextStyle: { color: '#475569' },
    };
  }

  if (Number.isFinite(endTime) && now > endTime) {
    return {
      key: 'ended',
      label: 'Đã kết thúc',
      canEnter: false,
      action: 'none',
      badgeStyle: { backgroundColor: '#e2e8f0' },
      textStyle: { color: '#334155' },
      buttonStyle: { backgroundColor: '#e2e8f0' },
      buttonTextStyle: { color: '#475569' },
    };
  }

  if (Number.isFinite(startTime) && now < startTime) {
    return {
      key: 'upcoming',
      label: 'Chưa bắt đầu',
      canEnter: false,
      action: 'none',
      badgeStyle: { backgroundColor: '#ffedd5' },
      textStyle: { color: '#c2410c' },
      buttonStyle: { backgroundColor: '#f8fafc' },
      buttonTextStyle: { color: '#64748b' },
    };
  }

  return {
    key: 'active',
    label: 'Vào thi',
    canEnter: true,
    action: 'enter',
    badgeStyle: { backgroundColor: '#dbeafe' },
    textStyle: { color: COLORS.primary },
      buttonStyle: { backgroundColor: COLORS.primary },
      buttonTextStyle: { color: '#FFFFFF' },
  };
};

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

const SessionCard = ({ item, onPress }) => {
  const state = getSessionState(item);
  const canPress = state.action !== 'none';
  const buttonLabel = state.action === 'enter'
    ? 'Vào thi'
    : state.action === 'result'
      ? 'Xem kết quả'
      : state.key === 'upcoming'
        ? 'Sắp diễn ra'
        : 'Đã kết thúc';

  return (
    <View
      className="bg-surface-container-lowest p-0 rounded-3xl mb-4 overflow-hidden"
      style={{ ...ambientShadow, opacity: canPress ? 1 : 0.9 }}
    >
      <View className="h-24 bg-slate-50 items-center justify-center relative">
        <MaterialIcons
          name={state.action === 'result' ? 'assignment' : 'event-note'}
          size={46}
          color={state.action === 'result' ? COLORS.primary : '#94A3B8'}
        />
        <View className="absolute right-3 top-3 px-2 py-1 rounded-full" style={{ backgroundColor: '#ffffffcc' }}>
          <Text className="text-[10px] font-bold uppercase" style={{ color: state.textStyle.color }}>
            {state.label}
          </Text>
        </View>
      </View>

      <View className="px-5 pb-5 pt-4 bg-white">
        <Text className="text-xl font-bold text-on-surface" numberOfLines={2}>
          {item.SessionName || '--'}
        </Text>
        <Text className="text-sm text-on-surface-variant mt-1" numberOfLines={1}>
          {item.ExamTitle || '--'} • {item.ClassName || '--'}
        </Text>

        <View className="mt-3 gap-2">
          <View className="flex-row items-center">
            <MaterialIcons name="person-outline" size={16} color="#64748B" />
            <Text className="text-sm text-on-surface-variant ml-1" numberOfLines={1}>
              GV. {item.TeacherName || '--'}
            </Text>
          </View>
          <View className="flex-row items-center">
            <MaterialIcons name="schedule" size={16} color="#64748B" />
            <Text className="text-sm text-on-surface-variant ml-1" numberOfLines={1}>
              {item.DurationInMinutes || item.Duration || '--'} phút
            </Text>
          </View>
          <View className="flex-row items-center">
            <MaterialIcons name="calendar-today" size={16} color="#64748B" />
            <Text className="text-sm text-primary font-semibold ml-1" numberOfLines={1}>
              {item.StartTime ? `Hạn: ${new Date(item.StartTime).toLocaleDateString('vi-VN')} ${new Date(item.StartTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })}` : 'Hạn: --'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          disabled={!canPress}
          onPress={() => onPress && onPress(item)}
          className="mt-4 h-12 rounded-xl items-center justify-center"
          style={state.buttonStyle || { backgroundColor: canPress ? COLORS.primary : '#EEF2F7' }}
        >
          <Text className="font-bold" style={state.buttonTextStyle || { color: '#FFFFFF' }}>
            {buttonLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const StudentDashboardScreen = ({ route, navigation }) => {
  const user = route?.params?.user?.id ? route?.params?.user : loadAuthSession();
  const dispatch = useDispatch();
  const { showToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeMenu, setActiveMenu] = useState(route?.params?.activeMenu || 'home');
  const [searchText, setSearchText] = useState('');
 
  
  // Join classroom state
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  
  // Password modal for exam session
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [pendingSession, setPendingSession] = useState(null);
  const [sessionPassword, setSessionPassword] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  // Profile edit / password change
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [editName, setEditName] = useState(user?.fullName || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [changePwdVisible, setChangePwdVisible] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSaving, setBiometricSaving] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {};
    }, [loadData])
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        try {
          const info = await getBiometricInfo('student');
          if (!active) return;
          setBiometricAvailable(info.available);
          setBiometricEnabled(info.enabled);
        } catch {
          if (!active) return;
          setBiometricAvailable(false);
          setBiometricEnabled(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  useEffect(() => {
    // Left empty since viewingAttempt is removed
  }, [activeMenu]);

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

  const startExamWithPassword = async (session, password = null) => {
    try {
      showToast('Đang chuẩn bị bài thi...', 'info');
      if (password) {
        setVerifyingPassword(true);
      }
      const data = await startExamAttempt(user?.id, session.Id, password);
      const examDuration = Number(
        data?.attempt?.examDurationInMinutes
        ?? data?.attempt?.duration
        ?? session?.ExamPaperDurationInMinutes
        ?? 0
      );
      dispatch(setAttempt({
        attempt: data.attempt,
        questions: data.questions,
        duration: examDuration
      }));
      if (password) {
        setPasswordModalVisible(false);
        setSessionPassword('');
      }
      navigation.navigate('TakeExam');
    } catch (err) {
      if (err?.response?.data?.requirePassword) {
        showToast('Mật khẩu không đúng.', 'error');
      } else {
        showToast(err?.response?.data?.message || 'Không thể vào ca thi.', 'error');
      }
    } finally {
      if (password) {
        setVerifyingPassword(false);
      }
    }
  };

  const handleEnterSession = async (session) => {
    const sessionState = getSessionState(session);
    if (sessionState.action === 'result') {
      const directAttemptId = Number(session?.AttemptId);
      if (Number.isInteger(directAttemptId) && directAttemptId > 0) {
        navigation.navigate('StudentExamDetail', { attemptId: directAttemptId, sessionName: session?.SessionName || '' });
        return;
      }

      try {
        const detail = await examApi.getResultDetailBySession(session.Id);
        const fallbackAttemptId = detail?.data?.id || detail?.data?.attemptId;
        if (fallbackAttemptId) {
          navigation.navigate('StudentExamDetail', { attemptId: fallbackAttemptId, sessionName: session?.SessionName || '' });
          return;
        }

        showToast('Không tìm thấy dữ liệu kết quả của bài thi này.', 'warning');
      } catch (error) {
        showToast('Không tải được dữ liệu kết quả. Vui lòng thử lại.', 'error');
      }
      return;
    }

    if (sessionState.action === 'none') {
      if (sessionState.key === 'submitted') {
        showToast('Bạn đã nộp bài thi cho ca này.', 'info');
      } else if (sessionState.key === 'upcoming') {
        showToast('Ca thi chưa bắt đầu.', 'info');
      } else {
        showToast('Ca thi đã kết thúc.', 'info');
      }
      return;
    }

    if (session.HasPassword) {
      setPendingSession(session);
      setPasswordModalVisible(true);
    } else {
      await startExamWithPassword(session);
    }
  };

 
  const submitSessionPassword = () => {
    if (!sessionPassword.trim()) {
      showToast('Vui lòng nhập mật khẩu ca thi', 'warning');
      return;
    }
    startExamWithPassword(pendingSession, sessionPassword);
  };

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchText.trim()) {
        if (!loading) {
          await loadData();
        }
      } else {
        try {
          setLoading(true);
          const [resC, resS] = await Promise.all([
            globalSearch('classrooms', searchText.trim(), null, user?.id),
            globalSearch('examsessions', searchText.trim(), null, user?.id),
          ]);
          setClassrooms(resC.results || []);
          setSessions(resS.results || []);

          if (resC.fallback || resS.fallback) {
            showToast('Meilisearch không hoạt động. Đang dùng tìm kiếm thường.', 'warning');
          }
        } catch (err) {
          console.error('Search error:', err);
        } finally {
          setLoading(false);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchText, user?.id]);

  const filteredSessions = sessions;


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

 
  const onCopyJoinCode = async (code) => {
    try {
      await Clipboard.setStringAsync(code);
      showToast('Đã sao chép mã tham gia.', 'success');
    } catch (_error) {
      showToast(`Mã tham gia: ${code}`, 'info');
    }
  };

  const openJoinModal = () => {
    setJoinModalVisible(true);
  };

  const closeJoinModal = () => {
    if (joining) return;
    setJoinModalVisible(false);
  };

  const handleToggleBiometric = async () => {
    if (Platform.OS === 'web') {
      showToast('Đăng nhập bằng vân tay chỉ hỗ trợ trên điện thoại.', 'warning');
      return;
    }

    if (biometricSaving) return;

    setBiometricSaving(true);
    try {
      if (biometricEnabled) {
        await disableBiometricLogin('student');
        setBiometricEnabled(false);
        showToast('Đã tắt đăng nhập bằng vân tay cho học sinh.', 'success');
        return;
      }

      const info = await getBiometricInfo('student');
      if (!info.available) {
        setBiometricAvailable(false);
        showToast('Thiết bị này chưa sẵn sàng cho xác thực sinh trắc học.', 'warning');
        return;
      }

      await enableBiometricLogin({ ...user, role: 'student' });
      setBiometricAvailable(true);
      setBiometricEnabled(true);
      showToast('Đã bật đăng nhập bằng vân tay cho học sinh.', 'success');
    } catch {
      showToast('Không thể cập nhật đăng nhập bằng vân tay.', 'error');
    } finally {
      setBiometricSaving(false);
    }
  };

  const renderClasses = () => (
    <View>
      {/* Join Section */}
      <TouchableOpacity
        className="bg-primary rounded-2xl px-5 py-4 mb-6 flex-row items-center justify-center shadow-sm"
        onPress={openJoinModal}
      >
        <MaterialIcons name="group-add" size={22} color="#FFFFFF" />
        <Text className="text-white font-black text-base ml-2">Tham gia lớp học</Text>
      </TouchableOpacity>

      <Modal
        visible={joinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeJoinModal}
      >
        <View className="flex-1 bg-black/40 items-center justify-center px-4">
          <View className="w-full max-w-[420px] bg-white rounded-3xl p-5 border border-slate-100">
            <Text className="text-xl font-black text-on-surface mb-2">Tham gia lớp học</Text>
            <Text className="text-on-surface-variant mb-4 text-sm">
              Nhập mã lớp do giáo viên cung cấp để bắt đầu.
            </Text>

            <TextInput
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-14 text-on-surface font-medium mb-4"
              placeholder="Mã lớp (VD: WEB101)"
              value={joinCode}
              onChangeText={setJoinCode}
              autoCapitalize="characters"
              autoFocus
            />

            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 h-12 rounded-xl items-center justify-center bg-slate-100"
                onPress={closeJoinModal}
                disabled={joining}
              >
                <Text className="text-on-surface font-bold">Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-1 h-12 rounded-xl items-center justify-center bg-primary ${joining ? 'opacity-70' : ''}`}
                onPress={handleJoinClass}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text className="text-white font-black">THAM GIA</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* List Section */}
      <View className="flex-col gap-1 mb-4">
        <Text className="text-xl font-bold text-on-surface">Lớp học của bạn</Text>
      </View>
      <View className="flex-col">
        {classrooms.length > 0 ? (
          classrooms.map((c) => {
            const createdAt = c.CreatedAt ? new Date(c.CreatedAt).toLocaleDateString('vi-VN') : '--';
            return (
              <View
                key={c.Id}
                style={ambientShadow}
                className="mb-4 bg-surface-container-lowest rounded-3xl overflow-hidden"
              >
                <View className="h-20 py-4 bg-primary items-center justify-center">
                  <MaterialIcons name="school" size={50} color="#FFFFFF" />
                </View>

                <View className="p-5">
                  <Text className="text-xl font-bold text-on-surface mb-1" numberOfLines={2}>
                    {c.ClassName}
                  </Text>
                  <Text className="text-on-surface-variant text-sm mt-1">
                    Giáo viên: <Text className="font-semibold text-on-surface">{c.TeacherName}</Text>
                  </Text>
                  <Text className="text-on-surface-variant text-sm mt-1">
                    Ngày tạo: {createdAt}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <View className="p-4 rounded-xl border border-dashed bg-surface-container-high items-center" style={{ borderColor: '#c1c6d699', backgroundColor: '#e6e8f266' }}>
            <Text className="text-sm text-on-surface-variant text-center">Bạn chưa tham gia lớp học nào.</Text>
          </View>
        )}
      </View>
    </View>
  );

 
  const renderSessions = () => {
    const activeSessions = filteredSessions.filter(s => getSessionState(s).key === 'active');
    const upcomingSessions = filteredSessions.filter(s => getSessionState(s).key === 'upcoming');
    const pastSessions = filteredSessions.filter(s => {
      const k = getSessionState(s).key;
      return k === 'ended' || k === 'submitted' || k === 'forced';
    });

    return (
      <View className="mb-8 mt-2">
        {filteredSessions.length === 0 ? (
          <View className="p-4 rounded-xl border border-dashed bg-surface-container-high items-center" style={{ borderColor: '#c1c6d699', backgroundColor: '#e6e8f266' }}>
            <Text className="text-sm text-on-surface-variant text-center">Hiện chưa có ca thi nào được phân công.</Text>
          </View>
        ) : (
          <View className="flex-col gap-6">
            {activeSessions.length > 0 && (
              <View>
                <Text className="text-base font-bold text-primary mb-3">Đang diễn ra ({activeSessions.length})</Text>
                {activeSessions.map((item) => (
                  <SessionCard key={String(item.Id)} item={item} onPress={handleEnterSession} />
                ))}
              </View>
            )}
            
            {upcomingSessions.length > 0 && (
              <View>
                <Text className="text-base font-bold text-amber-600 mb-3">Sắp diễn ra ({upcomingSessions.length})</Text>
                {upcomingSessions.map((item) => (
                  <SessionCard key={String(item.Id)} item={item} onPress={handleEnterSession} />
                ))}
              </View>
            )}

            {pastSessions.length > 0 && (
              <View>
                <Text className="text-base font-bold text-on-surface-variant mb-3">Đã kết thúc / Đã nộp ({pastSessions.length})</Text>
                {pastSessions.map((item) => (
                  <SessionCard key={String(item.Id)} item={item} onPress={handleEnterSession} />
                ))}
              </View>
            )}
          </View>
        )}
      </View>
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

          <View className="flex-row items-center justify-between py-3">
            <View className="flex-row items-center flex-1 pr-3">
              <MaterialIcons name="fingerprint" size={20} color="#64748B" />
              <View className="ml-2 flex-1">
                <Text className="text-on-surface-variant">Đăng nhập bằng vân tay</Text>
                <Text className="text-xs text-on-surface-variant mt-1">
                {Platform.OS === 'web'
                  ? 'Chỉ hỗ trợ trên điện thoại'
                  : biometricAvailable
                    ? 'Bật để dùng icon vân tay ở màn đăng nhập'
                    : 'Thiết bị chưa sẵn sàng cho sinh trắc học'}
              </Text>
            </View>
          </View>
            <View className="items-end justify-center" style={{ width: 52, minHeight: 32 }}>
              {biometricSaving ? (
                <ActivityIndicator size="small" color={biometricEnabled ? '#15803D' : '#64748B'} />
              ) : (
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
                  thumbColor={biometricEnabled ? '#005BBF' : '#F8FAFC'}
                  ios_backgroundColor="#CBD5E1"
                />
              )}
            </View>
          </View>

        <View className="mt-5 flex-row gap-3">
          <TouchableOpacity
            className="flex-1 bg-primary rounded-xl h-11 items-center justify-center flex-row"
            onPress={() => setEditProfileVisible(true)}
          >
            <MaterialIcons name="edit" size={18} color="#FFFFFF" />
            <Text className="text-white font-bold ml-2">Chỉnh sửa</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 bg-surface-container-high rounded-xl h-11 items-center justify-center flex-row border"
            onPress={() => setChangePwdVisible(true)}
          >
            <MaterialIcons name="vpn-key" size={16} color="#1F2937" />
            <Text className="text-on-surface font-bold ml-2">Đổi mật khẩu</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          className=" mt-4 bg-red-50 rounded-2xl h-12 items-center justify-center border border-red-100"
          onPress={() => {
            clearAuthSession();
            showToast('Bạn đã đăng xuất.', 'info');
            navigation.replace('Login');
          }}
        >
          <Text className="text-red-600 font-black text-base">Đăng xuất</Text>
        </TouchableOpacity>

        {/* Edit profile modal */}
        <Modal visible={editProfileVisible} transparent animationType="fade" onRequestClose={() => setEditProfileVisible(false)}>
          <View className="flex-1 bg-black/40 items-center justify-center px-4">
            <View className="w-full max-w-[420px] bg-white rounded-3xl p-5 border border-slate-100">
              <Text className="text-xl font-black text-on-surface mb-2">Chỉnh sửa thông tin</Text>
              <TextInput className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-on-surface font-medium mb-3" value={editName} onChangeText={setEditName} placeholder="Họ và tên" />
              <TextInput className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-on-surface font-medium mb-4" value={editEmail} onChangeText={setEditEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" />
              <View className="flex-row gap-3">
                <TouchableOpacity className="flex-1 h-12 rounded-xl items-center justify-center bg-slate-100" onPress={() => setEditProfileVisible(false)} disabled={savingProfile}>
                  <Text className="text-on-surface font-bold">Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity className={`flex-1 h-12 rounded-xl items-center justify-center bg-primary ${savingProfile ? 'opacity-70' : ''}`} onPress={async () => {
                  if (!editName.trim() || !editEmail.trim()) { showToast('Vui lòng điền tên và email.', 'warning'); return; }
                  setSavingProfile(true);
                  try {
                    const res = await updateUserProfile(user?.id, { fullName: editName.trim(), email: editEmail.trim() });
                    showToast(res?.message || 'Cập nhật thành công', 'success');
                    // update navigation params so parent screens see updated user
                    navigation.setParams({ user: res?.user });
                    setEditProfileVisible(false);
                  } catch (err) {
                    showToast(err?.response?.data?.message || err.message || 'Lỗi khi cập nhật.', 'error');
                  } finally { setSavingProfile(false); }
                }} disabled={savingProfile}>
                  {savingProfile ? <ActivityIndicator color="#FFF" /> : <Text className="text-white font-black">LƯU</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Change password modal */}
        <Modal visible={changePwdVisible} transparent animationType="fade" onRequestClose={() => setChangePwdVisible(false)}>
          <View className="flex-1 bg-black/40 items-center justify-center px-4">
            <View className="w-full max-w-[420px] bg-white rounded-3xl p-5 border border-slate-100">
              <Text className="text-xl font-black text-on-surface mb-2">Đổi mật khẩu</Text>
              <TextInput className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-on-surface font-medium mb-3" value={currentPwd} onChangeText={setCurrentPwd} placeholder="Mật khẩu hiện tại" secureTextEntry />
              <TextInput className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-on-surface font-medium mb-3" value={newPwd} onChangeText={setNewPwd} placeholder="Mật khẩu mới" secureTextEntry />
              <TextInput className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-on-surface font-medium mb-4" value={confirmPwd} onChangeText={setConfirmPwd} placeholder="Xác nhận mật khẩu mới" secureTextEntry />
              <View className="flex-row gap-3">
                <TouchableOpacity className="flex-1 h-12 rounded-xl items-center justify-center bg-slate-100" onPress={() => setChangePwdVisible(false)} disabled={changingPwd}>
                  <Text className="text-on-surface font-bold">Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity className={`flex-1 h-12 rounded-xl items-center justify-center bg-primary ${changingPwd ? 'opacity-70' : ''}`} onPress={async () => {
                  if (!currentPwd || !newPwd) { showToast('Vui lòng nhập đầy đủ thông tin.', 'warning'); return; }
                  if (newPwd !== confirmPwd) { showToast('Mật khẩu xác nhận không khớp.', 'warning'); return; }
                  setChangingPwd(true);
                  try {
                    await changeUserPassword(user?.id, currentPwd, newPwd);
                    showToast('Đổi mật khẩu thành công.', 'success');
                    setChangePwdVisible(false);
                    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
                  } catch (err) {
                    showToast(err?.response?.data?.message || err.message || 'Lỗi khi đổi mật khẩu.', 'error');
                  } finally { setChangingPwd(false); }
                }} disabled={changingPwd}>
                  {changingPwd ? <ActivityIndicator color="#FFF" /> : <Text className="text-white font-black">ĐỔI</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    if (activeMenu === 'results') {
      return (
        <StudentResultsContent
          userId={user?.id}
          onSelectAttempt={(id, sessionName) => navigation.navigate('StudentExamDetail', { attemptId: id, sessionName: sessionName || '' })}
        />
      );
    }
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
        hideSearch={activeMenu === 'home' || activeMenu === 'results' || activeMenu === 'profile'}
      />

      <ScrollView
        style={{ flex: 1 }}
        className="px-4"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="mb-4 mt-6">
          <Text className="text-primary text-2xl font-bold tracking-tight mb-1">
            {activeMenu === 'home'
              ? 'Tổng quan'
              : activeMenu === 'profile'
              ? 'Tài khoản'
              : studentMenuItems.find((item) => item.key === activeMenu)?.label}
          </Text>
          {activeMenu === 'sessions' && (
            <Text className="text-sm font-medium text-on-surface-variant">
              Tổng số ca thi: {filteredSessions.length}
            </Text>
          )}
          {activeMenu === 'results' && (
            <Text className="text-sm font-medium text-on-surface-variant">
              Tổng số bài làm: {summary?.SubmittedCount ?? 0}
            </Text>
          )}
          {activeMenu === 'home' && (
            <Text className="text-3xl font-semibold text-on-surface tracking-tight leading-tight" numberOfLines={2}>
              Chào bạn,{"\n"}{user?.fullName || 'Học sinh'}!
            </Text>
          )}
          {activeMenu === 'classes' && (
            <Text className="text-sm font-medium text-on-surface-variant">Tổng số lớp học: {classrooms.length}</Text>
          )}
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

      {/* Password Modal */}
      <Modal visible={passwordModalVisible} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center px-4">
          <View className="bg-white rounded-2xl p-6 w-full max-w-sm" style={ambientShadow}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-xl font-bold text-on-surface">Nhập mật khẩu</Text>
              <TouchableOpacity onPress={() => { setPasswordModalVisible(false); setSessionPassword(''); }}>
                <MaterialIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text className="text-on-surface-variant text-sm mb-4">
              Ca thi <Text className="font-bold">"{pendingSession?.SessionName}"</Text> yêu cầu mật khẩu để vào thi.
            </Text>
            
            <View className="bg-surface-container-low rounded-xl px-4 py-2 border border-surface-container-high mb-6">
              <Text className="text-xs text-on-surface-variant font-medium mb-1">Mật khẩu ca thi</Text>
              <TextInput
                className="text-base text-on-surface font-medium py-1"
                placeholder="Nhập mật khẩu..."
                placeholderTextColor="#94A3B8"
                secureTextEntry
                value={sessionPassword}
                onChangeText={setSessionPassword}
                autoCapitalize="none"
              />
            </View>

            <View className="flex-row gap-3">
              <TouchableOpacity 
                className="flex-1 py-3 rounded-xl items-center border border-surface-container-highest"
                onPress={() => { setPasswordModalVisible(false); setSessionPassword(''); }}
              >
                <Text className="text-on-surface font-bold">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                className={`flex-1 py-3 rounded-xl items-center bg-primary ${verifyingPassword ? 'opacity-70' : ''}`}
                onPress={submitSessionPassword}
                disabled={verifyingPassword}
              >
                {verifyingPassword ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text className="text-white font-bold">Vào thi</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
};

export default StudentDashboardScreen;
