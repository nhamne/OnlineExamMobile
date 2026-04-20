import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import TeacherScreenShell from '../../components/TeacherScreenShell';
import { useToast } from '../../context/ToastContext';
import {
  createTeacherSession,
  getTeacherSessionFormOptions,
  getTeacherSessions,
  previewTeacherSession,
} from '../../services/authService';

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

const toOnOffText = (value) => (value ? 'Bật' : 'Tắt');

const parseDateTimeInput = (value) => {
  const safe = String(value || '').trim();
  const match = safe.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, dd, mm, yyyy, hh, min] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), 0, 0);
  if (Number.isNaN(date.getTime())) return null;

  if (
    date.getDate() !== Number(dd) ||
    date.getMonth() !== Number(mm) - 1 ||
    date.getFullYear() !== Number(yyyy) ||
    date.getHours() !== Number(hh) ||
    date.getMinutes() !== Number(min)
  ) {
    return null;
  }

  return date;
};

const getStatusMeta = (session) => {
  const now = new Date();
  const start = new Date(session?.StartTime);
  const end = new Date(session?.EndTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { label: 'Không xác định', bg: '#f1f5f9', text: '#475569' };
  }

  if (now < start) {
    return { label: 'Sắp diễn ra', bg: '#dbeafe', text: '#1d4ed8' };
  }

  if (now > end) {
    return { label: 'Đã kết thúc', bg: '#e0e2ec', text: '#414754' };
  }

  return { label: 'Đang diễn ra', bg: '#ffedd5', text: '#c2410c' };
};

const SessionScreen = ({ route, navigation }) => {
  const { showToast } = useToast();
  const user = route?.params?.user || null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [teacher, setTeacher] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [sessions, setSessions] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [previewSubmitting, setPreviewSubmitting] = useState(false);
  const [formOptions, setFormOptions] = useState({ classrooms: [], examPapers: [] });
  const [formState, setFormState] = useState({
    sessionName: '',
    examPaperId: null,
    classroomId: null,
    startTime: '',
    endTime: '',
    sessionPassword: '',
    allowViewExplanation: true,
    isShuffled: true,
    shuffleQuestions: true,
    shuffleAnswers: true,
    notes: '',
  });
  const [previewData, setPreviewData] = useState(null);
  const [previewUnlocked, setPreviewUnlocked] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showExamPicker, setShowExamPicker] = useState(false);
  const [showClassroomPicker, setShowClassroomPicker] = useState(false);

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
      const data = await getTeacherSessions(user.id);
      setTeacher(data?.teacher || null);
      setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không tải được danh sách ca thi.');
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

  const onSelectBottomNav = (item) => {
    if (item.key === 'sessions') {
      return;
    }

    if (item.key === 'classes') {
      navigation.replace('TeacherClassrooms', { user: displayTeacher || user });
      return;
    }

    navigation.replace('TeacherDashboard', {
      user: displayTeacher || user,
      initialTab: item.key,
    });
  };

  const onPressAvatar = () => {
    navigation.replace('TeacherDashboard', {
      user: displayTeacher || user,
      initialTab: 'profile',
    });
  };

  const filteredSessions = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return sessions.filter((item) => {
      const haystack = [
        item?.SessionName,
        item?.ClassName,
        item?.JoinCode,
        item?.ExamTitle,
        item?.SessionPassword,
        item?.Notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [searchText, sessions]);

  const selectedExam = useMemo(
    () => formOptions.examPapers.find((item) => item.Id === formState.examPaperId) || null,
    [formOptions.examPapers, formState.examPaperId]
  );

  const selectedClassroom = useMemo(
    () => formOptions.classrooms.find((item) => item.Id === formState.classroomId) || null,
    [formOptions.classrooms, formState.classroomId]
  );

  const resetCreateState = () => {
    setFormState({
      sessionName: '',
      examPaperId: null,
      classroomId: null,
      startTime: '',
      endTime: '',
      sessionPassword: '',
      allowViewExplanation: true,
      isShuffled: true,
      shuffleQuestions: true,
      shuffleAnswers: true,
      notes: '',
    });
    setPreviewData(null);
    setPreviewUnlocked(false);
    setShowPreviewModal(false);
  };

  const markPreviewDirty = () => {
    if (previewUnlocked || previewData) {
      setPreviewUnlocked(false);
      setPreviewData(null);
    }
  };

  const updateFormField = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    markPreviewDirty();
  };

  const buildSessionPayload = () => {
    const startDate = parseDateTimeInput(formState.startTime);
    const endDate = parseDateTimeInput(formState.endTime);

    if (!formState.sessionName.trim()) {
      return { error: 'Tên ca thi là bắt buộc.' };
    }

    if (!Number.isInteger(formState.examPaperId)) {
      return { error: 'Vui lòng chọn đề thi.' };
    }

    if (!Number.isInteger(formState.classroomId)) {
      return { error: 'Vui lòng chọn lớp học.' };
    }

    if (!startDate || !endDate) {
      return { error: 'Thời gian không hợp lệ. Dùng định dạng dd/mm/yyyy HH:mm.' };
    }

    if (endDate <= startDate) {
      return { error: 'Giờ kết thúc phải sau giờ bắt đầu.' };
    }

    return {
      payload: {
        sessionName: formState.sessionName.trim(),
        examPaperId: formState.examPaperId,
        classroomId: formState.classroomId,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        sessionPassword: formState.sessionPassword.trim() || null,
        allowViewExplanation: Boolean(formState.allowViewExplanation),
        isShuffled: Boolean(formState.isShuffled),
        shuffleQuestions: Boolean(formState.shuffleQuestions),
        shuffleAnswers: Boolean(formState.shuffleAnswers),
        notes: formState.notes.trim() || null,
      },
    };
  };

  const onOpenCreateModal = async () => {
    if (!user?.id) {
      showToast('Không tìm thấy thông tin giáo viên.', 'error');
      return;
    }

    try {
      setFormLoading(true);
      const options = await getTeacherSessionFormOptions(user.id);
      setFormOptions({
        classrooms: Array.isArray(options?.classrooms) ? options.classrooms : [],
        examPapers: Array.isArray(options?.examPapers) ? options.examPapers : [],
      });
      resetCreateState();
      setShowCreateModal(true);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Không tải được dữ liệu tạo ca thi.';
      showToast(msg, 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const onCloseCreateModal = () => {
    if (formSubmitting || previewSubmitting) return;
    setShowCreateModal(false);
    setShowExamPicker(false);
    setShowClassroomPicker(false);
    setShowPreviewModal(false);
    resetCreateState();
  };

  const onPreviewSession = async () => {
    if (!user?.id) {
      showToast('Không tìm thấy thông tin giáo viên.', 'error');
      return;
    }

    const { payload, error: payloadError } = buildSessionPayload();
    if (payloadError) {
      showToast(payloadError, 'error');
      return;
    }

    try {
      setPreviewSubmitting(true);
      const response = await previewTeacherSession(user.id, payload);
      setPreviewData(response || null);
      setPreviewUnlocked(true);
      setShowPreviewModal(true);
      showToast('Đã tạo xem trước ca thi. Bạn có thể hoàn tất tạo hoặc hủy.', 'success');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Không thể xem trước ca thi.';
      showToast(msg, 'error');
    } finally {
      setPreviewSubmitting(false);
    }
  };

  const onCreateSession = async () => {
    if (!previewUnlocked || !previewData) {
      showToast('Bạn cần bấm Xem trước ca thi trước khi hoàn tất tạo.', 'error');
      return;
    }

    if (!user?.id) {
      showToast('Không tìm thấy thông tin giáo viên.', 'error');
      return;
    }

    const { payload, error: payloadError } = buildSessionPayload();
    if (payloadError) {
      showToast(payloadError, 'error');
      return;
    }

    try {
      setFormSubmitting(true);
      await createTeacherSession(user.id, payload);
      showToast('Tạo ca thi thành công.', 'success');
      onCloseCreateModal();
      await loadData();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Không thể tạo ca thi.';
      showToast(msg, 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <TeacherScreenShell
      bottomNavItems={bottomNavItems}
      activeKey="sessions"
      onSelectBottomNav={onSelectBottomNav}
      searchText={searchText}
      onChangeSearch={setSearchText}
      searchPlaceholder="Tìm kiếm theo tên ca, lớp, đề, ghi chú..."
      upcomingCount={filteredSessions.filter((item) => getStatusMeta(item).label === 'Sắp diễn ra').length}
      initials={initials}
      onPressAvatar={onPressAvatar}
    >
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="mb-7 mt-6">
          <Text className="text-primary text-2xl font-bold tracking-tight mb-1">Ca thi</Text>
          <Text className="text-3xl font-semibold text-on-surface tracking-tight leading-tight" numberOfLines={2}>
            Chào mừng trở lại,{"\n"}{displayTeacher?.fullName || 'Giáo viên'}!
          </Text>
          <Text className="text-on-surface-variant font-medium text-sm mt-3">
            Tổng số ca thi: {filteredSessions.length}
          </Text>

          <TouchableOpacity
            className="w-full bg-primary mt-4 py-3 px-4 rounded-xl flex-row items-center justify-center gap-2"
            onPress={onOpenCreateModal}
            disabled={formLoading}
          >
            {formLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <MaterialIcons name="add" size={20} color="white" />
                <Text className="text-white font-bold text-sm">Tạo ca thi mới</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator size="large" color="#005bbf" />
            <Text className="mt-3 text-on-surface-variant">Đang tải danh sách ca thi...</Text>
          </View>
        ) : error ? (
          <View className="rounded-lg bg-red-100 px-3 py-2 mb-4 border border-red-200">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        ) : filteredSessions.length === 0 ? (
          <View className="border-2 border-dashed border-outline-variant rounded-xl flex-col items-center justify-center p-8 mt-2 mb-8 bg-surface-container-low">
            <MaterialIcons name="event-busy" size={40} color="#727785" />
            <Text className="text-on-surface-variant font-medium mt-3 text-base">
              Không có ca thi nào phù hợp.
            </Text>
          </View>
        ) : (
          <View className="flex-col">
            {filteredSessions.map((session) => {
              const statusMeta = getStatusMeta(session);

              return (
                <View
                  key={session.Id}
                  style={ambientShadow}
                  className="bg-surface-container-lowest rounded-2xl p-4 mb-4"
                >
                  <View className="flex-row items-center justify-between mb-3">
                    <View style={{ backgroundColor: statusMeta.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                      <Text style={{ color: statusMeta.text, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' }}>
                        {statusMeta.label}
                      </Text>
                    </View>
                    <Text className="text-xs text-on-surface-variant">ID ca thi: {session.Id}</Text>
                  </View>

                  <Text className="text-lg font-bold text-on-surface" numberOfLines={2}>
                    {session.SessionName || '--'}
                  </Text>

                  <View className="mt-3">
                    <View className="flex-row items-center mb-2">
                      <MaterialIcons name="description" size={18} color="#0B63C8" />
                      <Text className="text-sm text-on-surface-variant ml-2 flex-1" numberOfLines={1}>
                        Đề thi: {session.ExamTitle || '--'} (ExamPaperId: {session.ExamPaperId ?? '--'})
                      </Text>
                    </View>

                    <View className="flex-row items-center mb-2">
                      <MaterialIcons name="school" size={18} color="#0B63C8" />
                      <Text className="text-sm text-on-surface-variant ml-2 flex-1" numberOfLines={1}>
                        Lớp: {session.ClassName || '--'} ({session.JoinCode || '--'}) - ClassroomId: {session.ClassroomId ?? '--'}
                      </Text>
                    </View>

                    <View className="flex-row items-center mb-2">
                      <MaterialIcons name="schedule" size={18} color="#0B63C8" />
                      <Text className="text-sm text-on-surface-variant ml-2 flex-1">
                        Bắt đầu: {formatDateTime(session.StartTime)}
                      </Text>
                    </View>

                    <View className="flex-row items-center mb-2">
                      <MaterialIcons name="timer" size={18} color="#0B63C8" />
                      <Text className="text-sm text-on-surface-variant ml-2 flex-1">
                        Kết thúc: {formatDateTime(session.EndTime)} - Thời lượng ca: {session.DurationInMinutes ?? 0} phút - Thời lượng đề: {session.ExamPaperDurationInMinutes ?? '--'} phút
                      </Text>
                    </View>

                    <View className="flex-row items-center mb-2">
                      <MaterialIcons name="badge" size={18} color="#0B63C8" />
                      <Text className="text-sm text-on-surface-variant ml-2 flex-1" numberOfLines={1}>
                        Mật khẩu ca thi: {session.SessionPassword || 'Không có'}
                      </Text>
                    </View>

                    <View className="flex-row items-center mb-2">
                      <MaterialIcons name="tune" size={18} color="#0B63C8" />
                      <Text className="text-sm text-on-surface-variant ml-2 flex-1">
                        Cho xem giải thích: {toOnOffText(session.AllowViewExplanation)} | Trộn tổng thể: {toOnOffText(session.IsShuffled)} | Trộn câu: {toOnOffText(session.ShuffleQuestions)} | Trộn đáp án: {toOnOffText(session.ShuffleAnswers)}
                      </Text>
                    </View>

                    <View className="flex-row items-center mb-2">
                      <MaterialIcons name="fact-check" size={18} color="#0B63C8" />
                      <Text className="text-sm text-on-surface-variant ml-2 flex-1">
                        Số câu hỏi: {session.QuestionCount ?? 0} | Bài nộp: {session.SubmissionCount ?? 0} | Đã nộp: {session.SubmittedCount ?? 0}
                      </Text>
                    </View>

                    <View className="flex-row items-start">
                      <MaterialIcons name="notes" size={18} color="#0B63C8" style={{ marginTop: 2 }} />
                      <Text className="text-sm text-on-surface-variant ml-2 flex-1">
                        Ghi chú: {session.Notes || 'Không có'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    className="mt-4 rounded-xl border py-2.5 items-center"
                    style={{ borderColor: '#005bbf33', backgroundColor: '#005bbf0d' }}
                    onPress={() => showToast('Đang hiển thị toàn bộ trường dữ liệu hiện có trong CSDL cho ca thi này.', 'info')}
                  >
                    <Text className="text-primary font-bold text-sm">Đã tải dữ liệu thật từ CSDL</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={onCloseCreateModal}>
        <Pressable
          className="flex-1 items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
          onPress={onCloseCreateModal}
        >
          <Pressable
            className="w-full max-w-xl rounded-3xl bg-surface-container-lowest overflow-hidden"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="px-5 pt-5 pb-4 border-b" style={{ borderColor: '#c1c6d64d' }}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-2xl bg-blue-100 items-center justify-center mr-3">
                    <MaterialIcons name="event" size={20} color="#0B63C8" />
                  </View>
                  <Text className="text-on-surface text-2xl font-bold">Tạo ca thi mới</Text>
                </View>
                <TouchableOpacity onPress={onCloseCreateModal} disabled={formSubmitting || previewSubmitting}>
                  <MaterialIcons name="close" size={24} color="#727785" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView className="px-5" style={{ maxHeight: 520 }}>
              <View className="pt-4 pb-6">
                <Text className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Thông tin cơ bản</Text>

                <Text className="text-xs uppercase font-bold text-on-surface-variant mb-2">Tên ca thi *</Text>
                <TextInput
                  value={formState.sessionName}
                  onChangeText={(value) => updateFormField('sessionName', value)}
                  placeholder="Ví dụ: Kiểm tra cuối kỳ - Môn Toán"
                  placeholderTextColor="#9AA3B2"
                  className="h-12 rounded-2xl border border-outline px-4 text-base text-on-surface bg-surface-container-lowest"
                />

                <Text className="text-xs uppercase font-bold text-on-surface-variant mb-2 mt-4">Đề thi *</Text>
                <TouchableOpacity
                  className="h-12 rounded-2xl border border-outline px-4 flex-row items-center justify-between bg-surface-container-lowest"
                  onPress={() => setShowExamPicker(true)}
                >
                  <Text className="text-sm text-on-surface-variant flex-1 mr-3" numberOfLines={1}>
                    {selectedExam
                      ? `${selectedExam.Title} (${selectedExam.DurationInMinutes} phút - ${selectedExam.QuestionCount ?? 0} câu)`
                      : 'Chọn đề thi từ thư viện'}
                  </Text>
                  <MaterialIcons name="expand-more" size={20} color="#727785" />
                </TouchableOpacity>

                <Text className="text-xs uppercase font-bold text-on-surface-variant mb-2 mt-4">Lớp học tham gia *</Text>
                <TouchableOpacity
                  className="h-12 rounded-2xl border border-outline px-4 flex-row items-center justify-between bg-surface-container-lowest"
                  onPress={() => setShowClassroomPicker(true)}
                >
                  <Text className="text-sm text-on-surface-variant flex-1 mr-3" numberOfLines={1}>
                    {selectedClassroom
                      ? `${selectedClassroom.ClassName} (${selectedClassroom.JoinCode})`
                      : 'Chọn lớp học'}
                  </Text>
                  <MaterialIcons name="expand-more" size={20} color="#727785" />
                </TouchableOpacity>

                <Text className="text-xs font-bold text-primary uppercase tracking-wider mt-6 mb-3">Thời gian</Text>

                <Text className="text-xs uppercase font-bold text-on-surface-variant mb-2">Giờ bắt đầu *</Text>
                <TextInput
                  value={formState.startTime}
                  onChangeText={(value) => updateFormField('startTime', value)}
                  placeholder="dd/mm/yyyy HH:mm"
                  placeholderTextColor="#9AA3B2"
                  className="h-12 rounded-2xl border border-outline px-4 text-base text-on-surface bg-surface-container-lowest"
                />

                <Text className="text-xs uppercase font-bold text-on-surface-variant mb-2 mt-4">Giờ kết thúc *</Text>
                <TextInput
                  value={formState.endTime}
                  onChangeText={(value) => updateFormField('endTime', value)}
                  placeholder="dd/mm/yyyy HH:mm"
                  placeholderTextColor="#9AA3B2"
                  className="h-12 rounded-2xl border border-outline px-4 text-base text-on-surface bg-surface-container-lowest"
                />

                <Text className="text-xs font-bold text-primary uppercase tracking-wider mt-6 mb-3">Bảo mật & hiển thị</Text>

                <Text className="text-xs uppercase font-bold text-on-surface-variant mb-2">Mật khẩu phòng (tùy chọn)</Text>
                <TextInput
                  value={formState.sessionPassword}
                  onChangeText={(value) => updateFormField('sessionPassword', value)}
                  placeholder="Nhập mã bảo mật"
                  placeholderTextColor="#9AA3B2"
                  className="h-12 rounded-2xl border border-outline px-4 text-base text-on-surface bg-surface-container-lowest"
                />

                <View className="mt-4 p-4 rounded-2xl" style={{ backgroundColor: '#eef2ff' }}>
                  {[
                    { key: 'allowViewExplanation', label: 'Công bố lời giải sau khi làm xong' },
                    { key: 'shuffleQuestions', label: 'Xáo trộn câu hỏi' },
                    { key: 'shuffleAnswers', label: 'Xáo trộn đáp án' },
                    { key: 'isShuffled', label: 'Bật trộn tổng thể' },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      className="flex-row items-center mb-3 last:mb-0"
                      onPress={() => updateFormField(item.key, !formState[item.key])}
                    >
                      <MaterialIcons
                        name={formState[item.key] ? 'check-box' : 'check-box-outline-blank'}
                        size={20}
                        color="#0B63C8"
                      />
                      <Text className="text-on-surface text-base ml-3 flex-1">{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text className="text-xs uppercase font-bold text-on-surface-variant mb-2 mt-4">Ghi chú (tùy chọn)</Text>
                <TextInput
                  value={formState.notes}
                  onChangeText={(value) => updateFormField('notes', value)}
                  placeholder="Ví dụ: Học sinh được phép sử dụng máy tính bỏ túi..."
                  placeholderTextColor="#9AA3B2"
                  multiline
                  textAlignVertical="top"
                  className="rounded-2xl border border-outline px-4 py-3 text-base text-on-surface bg-surface-container-lowest"
                  style={{ minHeight: 92 }}
                />
              </View>
            </ScrollView>

            <View className="px-5 py-4 border-t" style={{ borderColor: '#c1c6d64d' }}>
              {previewUnlocked ? (
                <View className="flex-row items-center justify-between">
                  <TouchableOpacity
                    className="h-11 px-4 rounded-xl bg-surface-container-high items-center justify-center"
                    onPress={onCloseCreateModal}
                    disabled={formSubmitting}
                  >
                    <Text className="text-on-surface font-bold">Hủy</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="h-11 px-4 rounded-xl bg-primary items-center justify-center flex-row"
                    onPress={onCreateSession}
                    disabled={formSubmitting}
                  >
                    {formSubmitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialIcons name="done" size={18} color="#FFFFFF" />
                        <Text className="text-white font-bold ml-1">Hoàn tất tạo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}

              <TouchableOpacity
                className="h-11 rounded-xl border items-center justify-center flex-row mt-3"
                style={{ borderColor: '#005bbf33', backgroundColor: '#005bbf0d' }}
                onPress={onPreviewSession}
                disabled={previewSubmitting || formSubmitting}
              >
                {previewSubmitting ? (
                  <ActivityIndicator color="#005bbf" />
                ) : (
                  <>
                    <MaterialIcons name="visibility" size={18} color="#005bbf" />
                    <Text className="text-primary font-bold ml-1">Xem trước ca thi</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showExamPicker} transparent animationType="fade" onRequestClose={() => setShowExamPicker(false)}>
        <Pressable
          className="flex-1 items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
          onPress={() => setShowExamPicker(false)}
        >
          <Pressable
            className="w-full max-w-xl rounded-2xl bg-surface-container-lowest p-4"
            onPress={(event) => event.stopPropagation()}
          >
            <Text className="text-lg font-bold text-on-surface mb-3">Chọn đề thi</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {formOptions.examPapers.map((item) => (
                <TouchableOpacity
                  key={item.Id}
                  className="py-3 px-3 rounded-xl mb-2"
                  style={{ backgroundColor: formState.examPaperId === item.Id ? '#eaf1ff' : '#f6f7fb' }}
                  onPress={() => {
                    updateFormField('examPaperId', item.Id);
                    setShowExamPicker(false);
                  }}
                >
                  <Text className="text-on-surface font-bold" numberOfLines={1}>{item.Title}</Text>
                  <Text className="text-on-surface-variant text-xs mt-1">
                    {item.DurationInMinutes} phút - {item.QuestionCount ?? 0} câu hỏi
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showClassroomPicker} transparent animationType="fade" onRequestClose={() => setShowClassroomPicker(false)}>
        <Pressable
          className="flex-1 items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
          onPress={() => setShowClassroomPicker(false)}
        >
          <Pressable
            className="w-full max-w-xl rounded-2xl bg-surface-container-lowest p-4"
            onPress={(event) => event.stopPropagation()}
          >
            <Text className="text-lg font-bold text-on-surface mb-3">Chọn lớp học</Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {formOptions.classrooms.map((item) => (
                <TouchableOpacity
                  key={item.Id}
                  className="py-3 px-3 rounded-xl mb-2"
                  style={{ backgroundColor: formState.classroomId === item.Id ? '#eaf1ff' : '#f6f7fb' }}
                  onPress={() => {
                    updateFormField('classroomId', item.Id);
                    setShowClassroomPicker(false);
                  }}
                >
                  <Text className="text-on-surface font-bold" numberOfLines={1}>{item.ClassName}</Text>
                  <Text className="text-on-surface-variant text-xs mt-1">
                    {item.JoinCode} - {item.StudentCount ?? 0} học sinh
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showPreviewModal} transparent animationType="slide" onRequestClose={() => setShowPreviewModal(false)}>
        <View className="flex-1 bg-surface-container-low">
          <View className="px-4 pt-5 pb-3 border-b bg-surface-container-lowest" style={{ borderColor: '#c1c6d64d' }}>
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-bold text-on-surface">Xem trước ca thi</Text>
              <TouchableOpacity onPress={() => setShowPreviewModal(false)}>
                <MaterialIcons name="close" size={24} color="#727785" />
              </TouchableOpacity>
            </View>
            <Text className="text-sm text-on-surface-variant mt-1" numberOfLines={2}>
              {previewData?.preview?.sessionName || '--'} - {previewData?.examPaper?.Title || '--'}
            </Text>
          </View>

          <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: 12, paddingBottom: 20 }}>
            <View className="rounded-xl p-3 mb-4" style={{ backgroundColor: '#eef2ff' }}>
              <Text className="text-on-surface text-sm">Lớp: {previewData?.classroom?.ClassName || '--'}</Text>
              <Text className="text-on-surface text-sm mt-1">Bắt đầu: {formatDateTime(previewData?.preview?.startTime)}</Text>
              <Text className="text-on-surface text-sm mt-1">Kết thúc: {formatDateTime(previewData?.preview?.endTime)}</Text>
              <Text className="text-on-surface text-sm mt-1">Tổng câu: {previewData?.questions?.length ?? 0}</Text>
            </View>

            {(previewData?.questions || []).map((question, index) => (
              <View key={question.Id} className="mb-4 rounded-2xl p-4 bg-surface-container-lowest" style={{ borderWidth: 1, borderColor: '#c1c6d64d' }}>
                <Text className="font-bold text-on-surface mb-2">Câu {question.DisplayOrder || index + 1}: {question.Content}</Text>

                {['A', 'B', 'C', 'D'].map((optionKey) => {
                  const optionText = question[`Option${optionKey}`];
                  const isCorrect = question.CorrectOption === optionKey;
                  return (
                    <View
                      key={`${question.Id}-${optionKey}`}
                      className="rounded-xl px-3 py-2 mb-2"
                      style={{ backgroundColor: isCorrect ? '#dcfce7' : '#f8fafc', borderWidth: 1, borderColor: isCorrect ? '#86efac' : '#e2e8f0' }}
                    >
                      <Text style={{ color: isCorrect ? '#166534' : '#334155', fontWeight: isCorrect ? '700' : '500' }}>
                        {optionKey}. {optionText}
                      </Text>
                    </View>
                  );
                })}

                <Text className="text-xs text-primary font-bold mt-1">Đáp án đúng: {question.CorrectOption}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </TeacherScreenShell>
  );
};

export default SessionScreen;