import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Alert,
  Linking,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Calendar, FileText, Filter, MoreVertical, Plus, Search } from 'lucide-react-native';
import TeacherScreenShell from '../../components/TeacherScreenShell';
import { useToast } from '../../context/ToastContext';
import { clearAuthSession } from '../../services/authSession';
import { API_BASE_URL } from '../../config/api';
import { copyTeacherExam, deleteTeacherExam, getTeacherDashboard } from '../../services/authService';

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

const EXAM_COLORS = {
  primary: '#00357f',
  background: '#f7f9fb',
  surface: '#ffffff',
  surfaceContainerLow: '#f2f4f6',
  surfaceContainerHigh: '#e6e8ea',
  onSurface: '#191c1e',
  onSurfaceVariant: '#434653',
  primaryFixed: '#d9e2ff',
  secondaryContainer: '#d5e3fc',
  outlineVariant: 'rgba(195, 198, 213, 0.2)',
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

const formatExamDate = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('vi-VN');
};

const getSubjectLabel = (title) => {
  const text = String(title || '').toLowerCase();

  if (/(toan|giải tích|đại số|hình học)/i.test(text)) return 'Toán';
  if (/(van|ngữ văn|văn học)/i.test(text)) return 'Ngữ văn';
  if (/(anh|english|toeic|ielts)/i.test(text)) return 'Tiếng Anh';
  if (/(ly|vật lý|physics)/i.test(text)) return 'Vật lý';
  if (/(hoa|hóa|chemistry)/i.test(text)) return 'Hóa học';
  if (/(sinh|sinh học|biology)/i.test(text)) return 'Sinh học';
  if (/(su|lịch sử|history)/i.test(text)) return 'Lịch sử';
  if (/(dia|địa|geography)/i.test(text)) return 'Địa lý';
  if (/(tin|cntt|it|lap trinh|programming|sql|database|react|javascript|java|python)/i.test(text)) return 'Tin học';

  return 'Môn học';
};

const getExamStatusLabel = (item) => (item?.IsDraft ? 'Bản nháp' : 'Xuất bản');
const getExamStatusStyle = (item) => (
  item?.IsDraft
    ? { backgroundColor: '#fde68a', color: '#92400e' }
    : { backgroundColor: '#bbf7d0', color: '#166534' }
);

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
  const [menuExamId, setMenuExamId] = useState(null);
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
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });

    return unsubscribe;
  }, [navigation, loadData]);

  useEffect(() => {
    if (route?.params?.refreshToken) {
      loadData();
    }
  }, [route?.params?.refreshToken, loadData]);

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

    if (item.key === 'exams') {
      setActiveTab('exams');
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

  const openExamMenu = (item) => {
    setMenuExamId(item?.Id || null);
  };

  const closeExamMenu = () => {
    setMenuExamId(null);
  };

  const handleDeleteExam = async (item) => {
    if (!user?.id || !item?.Id) {
      showToast('Không tìm thấy thông tin đề thi.', 'error');
      return;
    }

    const confirmDelete = async () => {
      try {
        await deleteTeacherExam(user.id, item.Id);
        setExamPapers((prev) => prev.filter((exam) => exam.Id !== item.Id));
        setSummary((prev) => {
          if (!prev) return prev;
          const nextCount = Math.max(0, Number(prev.ExamPaperCount ?? 0) - 1);
          return { ...prev, ExamPaperCount: nextCount };
        });
        showToast('Đã xóa đề thi.', 'success');
      } catch (err) {
        showToast(err?.response?.data?.message || 'Không thể xóa đề thi.', 'error');
      } finally {
        closeExamMenu();
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Bạn chắc chắn muốn xóa đề thi này?');
      if (confirmed) {
        confirmDelete();
      }
      return;
    }

    Alert.alert('Xóa đề thi', 'Bạn chắc chắn muốn xóa đề thi này?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: confirmDelete },
    ]);
  };

  const handleCopyExam = async (item) => {
    if (!user?.id || !item?.Id) {
      showToast('Không tìm thấy thông tin đề thi.', 'error');
      return;
    }

    try {
      const result = await copyTeacherExam(user.id, item.Id);
      if (result?.examPaper) {
        setExamPapers((prev) => [result.examPaper, ...prev]);
        setSummary((prev) => {
          if (!prev) return prev;
          return { ...prev, ExamPaperCount: Number(prev.ExamPaperCount ?? 0) + 1 };
        });
      }
      showToast('Đã sao chép đề thi.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể sao chép đề thi.', 'error');
    } finally {
      closeExamMenu();
    }
  };

  const handleExportExam = async (item) => {
    if (!user?.id || !item?.Id) {
      showToast('Không tìm thấy thông tin đề thi.', 'error');
      return;
    }

    const exportUrl = `${API_BASE_URL}/api/dashboard/teacher/${user.id}/exams/${item.Id}/export`;

    try {
      if (Platform.OS === 'web') {
        window.open(exportUrl, '_blank');
      } else {
        await Linking.openURL(exportUrl);
      }
    } catch (err) {
      showToast('Không thể xuất file PDF.', 'error');
    } finally {
      closeExamMenu();
    }
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
    <View style={stylesExam.container}>
      <View style={stylesExam.sectionHeader}>
        <Text style={stylesExam.sectionSubtitle}>
          Tổng số đề thi: {summary?.ExamPaperCount ?? 0}
        </Text>
      </View>
      <View style={stylesExam.grid}>
        <View style={stylesExam.addActions}>
          <TouchableOpacity
            style={[stylesExam.addButton, stylesExam.addButtonPrimary]}
            onPress={() => navigation.navigate('TeacherExamEditor', { user: displayTeacher || user })}
          >
            <Text style={[stylesExam.addTitle, stylesExam.addTitlePrimary]}>Tạo đề thi thủ công</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[stylesExam.addButton, stylesExam.addButtonSecondary]}
            onPress={() => navigation.navigate('TeacherAIOCR', { user: displayTeacher || user })}
          >
            <Text style={[stylesExam.addTitle, stylesExam.addTitleSecondary]}>Tạo đề thi bằng AI OCR</Text>
          </TouchableOpacity>
        </View>

        {filteredExamPapers.length > 0 ? (
          filteredExamPapers.map((item) => (
            <TouchableOpacity
              key={item.Id}
              style={[stylesExam.card, ambientShadow]}
              activeOpacity={0.9}
              onPress={() => {
                if (menuExamId === item.Id) {
                  closeExamMenu();
                  return;
                }
                navigation.navigate('TeacherExamDetail', { exam: item, user: displayTeacher || user });
              }}
            >
              <View style={stylesExam.cardHeader}>
                <View style={[stylesExam.badge, getExamStatusStyle(item)]}>
                  <Text style={[stylesExam.badgeText, { color: getExamStatusStyle(item).color }]}>
                    {getExamStatusLabel(item)}
                  </Text>
                </View>
                <TouchableOpacity
                  hitSlop={10}
                  onPress={() => {
                    if (menuExamId === item.Id) {
                      closeExamMenu();
                    } else {
                      openExamMenu(item);
                    }
                  }}
                >
                  <MoreVertical size={20} color={EXAM_COLORS.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              {menuExamId === item.Id ? (
                <View style={stylesExam.dropdownMenu}>
                  <TouchableOpacity style={stylesExam.menuItem} onPress={() => handleExportExam(item)}>
                    <Text style={stylesExam.menuItemText}>Xuất PDF</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={stylesExam.menuItem} onPress={() => handleCopyExam(item)}>
                    <Text style={stylesExam.menuItemText}>Sao chép đề thi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[stylesExam.menuItem, stylesExam.menuItemDanger]}
                    onPress={() => handleDeleteExam(item)}
                  >
                    <Text style={[stylesExam.menuItemText, stylesExam.menuItemTextDanger]}>Xóa đề thi</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <Text style={stylesExam.cardTitle}>{item.Title}</Text>
              <Text style={stylesExam.subjectText}>
                Môn: {item.Subject || 'Chưa có môn'}
              </Text>

              <View style={stylesExam.cardMeta}>
                <View style={stylesExam.metaItem}>
                  <FileText size={16} color={EXAM_COLORS.onSurfaceVariant} />
                  <Text style={stylesExam.metaText}>{item.QuestionCount ?? 0} câu</Text>
                </View>
                <View style={stylesExam.metaItem}>
                  <Calendar size={16} color={EXAM_COLORS.onSurfaceVariant} />
                  <Text style={stylesExam.metaText}>{item.DurationInMinutes ?? 0} phút</Text>
                </View>
                <View style={stylesExam.metaItem}>
                  <MaterialIcons name="access-time" size={16} color={EXAM_COLORS.onSurfaceVariant} />
                  <Text style={stylesExam.metaText}>{formatExamDate(item.CreatedAt)}</Text>
                </View>
              </View>

              <View style={stylesExam.cardFooter}>
                <TouchableOpacity
                  onPress={() => navigation.navigate('TeacherExamDetail', { exam: item, user: displayTeacher || user })}
                >
                  <Text style={stylesExam.actionText}>Chi tiết -&gt;</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View style={stylesExam.emptyBox}>
            <Text style={stylesExam.emptyText}>Chưa có đề thi nào.</Text>
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

const stylesExam = StyleSheet.create({
  container: { marginBottom: 16 },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: EXAM_COLORS.onSurface },
  sectionSubtitle: { fontSize: 12, color: EXAM_COLORS.onSurfaceVariant, marginTop: 4 },
  grid: { gap: 16 },
  card: {
    backgroundColor: EXAM_COLORS.surface,
    borderRadius: 16,
    padding: 20,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  badge: { backgroundColor: EXAM_COLORS.secondaryContainer, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 10, fontWeight: '800', color: EXAM_COLORS.onSurfaceVariant },
  cardTitle: { fontSize: 18, fontWeight: '700', color: EXAM_COLORS.onSurface, lineHeight: 24, marginBottom: 6 },
  subjectText: { fontSize: 12, color: EXAM_COLORS.onSurfaceVariant, marginBottom: 10 },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: EXAM_COLORS.onSurfaceVariant },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  actionText: { color: '#00357f', fontWeight: '800', fontSize: 14 },
  addActions: { gap: 12 },
  addButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonPrimary: {
    backgroundColor: EXAM_COLORS.primary,
  },
  addButtonSecondary: {
    backgroundColor: EXAM_COLORS.primaryFixed,
    borderWidth: 1,
    borderColor: EXAM_COLORS.outlineVariant,
  },
  addTitle: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  addTitlePrimary: { color: '#ffffff' },
  addTitleSecondary: { color: EXAM_COLORS.primary },
  emptyBox: { paddingVertical: 32, alignItems: 'center' },
  emptyText: { color: EXAM_COLORS.onSurfaceVariant, fontWeight: '600' },
  dropdownMenu: {
    position: 'absolute',
    top: 44,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 6,
    width: 180,
    borderWidth: 1,
    borderColor: 'rgba(195, 198, 213, 0.4)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
    zIndex: 5,
  },
  menuItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  menuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(195, 198, 213, 0.3)',
  },
  menuItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: EXAM_COLORS.onSurface,
  },
  menuItemTextDanger: {
    color: '#dc2626',
  },
});

export default TeacherDashboardScreen;
