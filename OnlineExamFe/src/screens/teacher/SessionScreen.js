import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import TeacherScreenShell from '../../components/TeacherScreenShell';
import { useToast } from '../../context/ToastContext';
import {
  createTeacherSession,
  deleteTeacherSession,
  getTeacherSessionFormOptions,
  getTeacherSessions,
  previewTeacherSession,
  updateTeacherSession,
} from '../../services/authService';

const bottomNavItems = [
  { key: 'home', label: 'Trang chủ', shortLabel: 'Home', icon: 'home' },
  { key: 'classes', label: 'Lớp học', shortLabel: 'Classes', icon: 'groups' },
  { key: 'exams', label: 'Đề thi', shortLabel: 'Exams', icon: 'description' },
  { key: 'sessions', label: 'Ca thi', shortLabel: 'Sessions', icon: 'event' },
  { key: 'reports', label: 'Báo cáo', shortLabel: 'Reports', icon: 'bar-chart' },
];

const REQUIRED_FIELD_ORDER = ['sessionName', 'examPaperId', 'classroomId', 'startTime', 'endTime'];

const FIELD_LABELS = {
  sessionName: 'Tên ca thi',
  examPaperId: 'Đề thi',
  classroomId: 'Lớp học tham gia',
  startTime: 'Giờ bắt đầu',
  endTime: 'Giờ kết thúc',
};

const createEmptyFormState = () => ({
  sessionName: '',
  examPaperId: null,
  classroomId: null,
  startTime: '',
  endTime: '',
  sessionPassword: '',
  allowViewExplanation: true,
  shuffleQuestions: true,
  shuffleAnswers: true,
  notes: '',
});

const mapSessionToFormState = (session) => ({
  sessionName: session?.SessionName || '',
  examPaperId: Number(session?.ExamPaperId) || null,
  classroomId: Number(session?.ClassroomId) || null,
  startTime: formatDateTimeInput(session?.StartTime ? new Date(session.StartTime) : null),
  endTime: formatDateTimeInput(session?.EndTime ? new Date(session.EndTime) : null),
  sessionPassword: session?.SessionPassword || '',
  allowViewExplanation: Boolean(session?.AllowViewExplanation),
  shuffleQuestions: Boolean(session?.ShuffleQuestions),
  shuffleAnswers: Boolean(session?.ShuffleAnswers),
  notes: session?.Notes || '',
});

const formatDateTimeInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
};

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

const formatSessionTimeRange = (startValue, endValue) => {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return '--';
  }

  const timeFormatter = new Intl.DateTimeFormat('vi-VN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();

  if (sameDay) {
    return `${timeFormatter.format(start)}-${timeFormatter.format(end)}, ${dateFormatter.format(start)}`;
  }

  return `${timeFormatter.format(start)}, ${dateFormatter.format(start)} - ${timeFormatter.format(end)}, ${dateFormatter.format(end)}`;
};

const formatWebDateInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatWebTimeInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
};

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

const buildSessionQrImageUrl = (session) => {
  if (session?.QrImageUrl) return session.QrImageUrl;
  if (!session?.SessionLink) return '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(session.SessionLink)}`;
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
  const [formMode, setFormMode] = useState('create');
  const [editingSession, setEditingSession] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);
  const [previewSubmitting, setPreviewSubmitting] = useState(false);
  const [formOptions, setFormOptions] = useState({ classrooms: [], examPapers: [] });
  const [formState, setFormState] = useState(createEmptyFormState());
  const [previewData, setPreviewData] = useState(null);
  const [previewUnlocked, setPreviewUnlocked] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showExamPicker, setShowExamPicker] = useState(false);
  const [showClassroomPicker, setShowClassroomPicker] = useState(false);
  const [selectedSessionAction, setSelectedSessionAction] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [showCreatedSessionModal, setShowCreatedSessionModal] = useState(false);
  const [createdSession, setCreatedSession] = useState(null);
  const [submitSuccessMode, setSubmitSuccessMode] = useState('create');
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [pendingDeleteSession, setPendingDeleteSession] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [attemptedPreview, setAttemptedPreview] = useState(false);
  const [dateTimePickerVisible, setDateTimePickerVisible] = useState(false);
  const [activeDateField, setActiveDateField] = useState('');
  const [dateTimePickerMode, setDateTimePickerMode] = useState('date');
  const [dateTimeDraft, setDateTimeDraft] = useState(new Date());
  const [webDateDraft, setWebDateDraft] = useState('');
  const [webTimeDraft, setWebTimeDraft] = useState('');

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
    navigation.navigate('TeacherProfile', { user: displayTeacher || user });
  };

  const onCopySessionLink = useCallback(
    async (session) => {
      const link = session?.SessionLink;
      if (!link) {
        showToast('Không tìm thấy link ca thi.', 'error');
        return;
      }

      try {
        await Clipboard.setStringAsync(link);
        showToast('Đã sao chép link ca thi.', 'success');
      } catch (_error) {
        showToast(link, 'info');
      }
    },
    [showToast]
  );

  const onOpenSessionQr = useCallback((session) => {
    setSelectedSessionAction(session || null);
    setShowQrModal(true);
  }, []);

  const isUpcomingSession = useCallback((session) => getStatusMeta(session).label === 'Sắp diễn ra', []);

  const loadSessionFormOptions = useCallback(async () => {
    if (!user?.id) {
      throw new Error('Không tìm thấy thông tin giáo viên.');
    }

    const options = await getTeacherSessionFormOptions(user.id);
    const nextOptions = {
      classrooms: Array.isArray(options?.classrooms) ? options.classrooms : [],
      examPapers: Array.isArray(options?.examPapers) ? options?.examPapers : [],
    };
    setFormOptions(nextOptions);
    return nextOptions;
  }, [user?.id]);

  const openSessionForm = useCallback(
    async (mode, session = null) => {
      if (!user?.id) {
        showToast('Không tìm thấy thông tin giáo viên.', 'error');
        return;
      }

      try {
        setFormLoading(true);
        await loadSessionFormOptions();
        setFormMode(mode);
        setEditingSession(mode === 'edit' ? session : null);
        setFormState(mode === 'edit' ? mapSessionToFormState(session) : createEmptyFormState());
        setPreviewData(null);
        setPreviewUnlocked(false);
        setShowPreviewModal(false);
        setFormErrors({});
        setTouchedFields({});
        setAttemptedPreview(false);
        setShowCreateModal(true);
      } catch (err) {
        showToast(err?.response?.data?.message || err?.message || 'Không tải được dữ liệu tạo ca thi.', 'error');
      } finally {
        setFormLoading(false);
      }
    },
    [loadSessionFormOptions, showToast, user?.id]
  );

  const onOpenCreateModal = useCallback(async () => {
    await openSessionForm('create', null);
  }, [openSessionForm]);

  const onOpenEditModal = useCallback(
    async (session) => {
      if (!session || !isUpcomingSession(session)) return;
      await openSessionForm('edit', session);
    },
    [isUpcomingSession, openSessionForm]
  );

  const onOpenDeleteConfirm = useCallback((session) => {
    if (!session || !isUpcomingSession(session)) return;
    setPendingDeleteSession(session);
    setShowDeleteConfirmModal(true);
  }, [isUpcomingSession]);

  const onConfirmDeleteSession = useCallback(async () => {
    if (!user?.id || !pendingDeleteSession?.Id) {
      showToast('Không tìm thấy ca thi cần xóa.', 'error');
      return;
    }

    try {
      setDeletingSession(true);
      await deleteTeacherSession(user.id, pendingDeleteSession.Id);
      showToast('Xóa ca thi thành công.', 'success');
      setShowDeleteConfirmModal(false);
      setPendingDeleteSession(null);
      await loadData();
    } catch (err) {
      showToast(err?.response?.data?.message || 'Không thể xóa ca thi.', 'error');
    } finally {
      setDeletingSession(false);
    }
  }, [loadData, pendingDeleteSession?.Id, showToast, user?.id]);

  const onDownloadQrImage = useCallback(
    async (session) => {
      const qrImageUrl = buildSessionQrImageUrl(session);
      if (!qrImageUrl) {
        showToast('Không tìm thấy ảnh QR để tải.', 'error');
        return;
      }

      try {
        setDownloadingQr(true);

        if (Platform.OS === 'web') {
          try {
            const response = await fetch(qrImageUrl);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = blobUrl;
            anchor.download = `${String(session?.SessionName || 'ca-thi').replace(/[^a-zA-Z0-9-_]+/g, '-')}-qr.png`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            window.URL.revokeObjectURL(blobUrl);
            showToast('Đã tải ảnh QR.', 'success');
            return;
          } catch (_webDownloadError) {
            window.open(qrImageUrl, '_blank', 'noopener,noreferrer');
            showToast('Trình duyệt đã mở ảnh QR. Hãy lưu ảnh từ tab mới.', 'info');
            return;
          }
        }

        const safeName = String(session?.SessionName || 'ca-thi').replace(/[^a-zA-Z0-9-_]+/g, '-');
        const baseDirectory = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
        if (!baseDirectory) {
          throw new Error('Không tìm thấy thư mục lưu tạm trên thiết bị.');
        }

        const fileUri = `${baseDirectory}${safeName}-qr-${Date.now()}.png`;
        const result = await FileSystem.downloadAsync(qrImageUrl, fileUri);
        const downloadedUri = result?.uri || fileUri;

        const canShare = await Sharing.isAvailableAsync();

        if (!canShare) {
          const opened = await Linking.openURL(qrImageUrl).catch(() => false);
          if (opened) {
            showToast('Đã mở ảnh QR. Hãy giữ lâu để lưu ảnh.', 'info');
          } else {
            showToast(`Đã lưu tạm ảnh QR tại: ${downloadedUri}`, 'info');
          }
          return;
        }

        await Sharing.shareAsync(downloadedUri, {
          mimeType: 'image/png',
          dialogTitle: 'Lưu ảnh QR ca thi',
          UTI: 'public.png',
        });
        showToast('Đã mở trình chia sẻ để lưu ảnh QR.', 'success');
      } catch (err) {
        showToast(err?.message || 'Không thể tải ảnh QR.', 'error');
      } finally {
        setDownloadingQr(false);
      }
    },
    [showToast]
  );

  const onOpenSessionManagement = useCallback(
    (session) => {
      navigation.navigate('TeacherSessionManagement', {
        user: displayTeacher || user,
        session,
      });
    },
    [displayTeacher, navigation, user]
  );

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

  const validateForm = useCallback(
    (state) => {
      const errors = {};
      const startDate = parseDateTimeInput(state.startTime);
      const endDate = parseDateTimeInput(state.endTime);
      const selectedExamPaper = formOptions.examPapers.find((item) => item.Id === state.examPaperId);

      if (!state.sessionName.trim()) {
        errors.sessionName = `Trường ${FIELD_LABELS.sessionName} là trường bắt buộc.`;
      }

      if (!Number.isInteger(state.examPaperId)) {
        errors.examPaperId = `Trường ${FIELD_LABELS.examPaperId} là trường bắt buộc.`;
      }

      if (!Number.isInteger(state.classroomId)) {
        errors.classroomId = `Trường ${FIELD_LABELS.classroomId} là trường bắt buộc.`;
      }

      if (!state.startTime.trim()) {
        errors.startTime = `Trường ${FIELD_LABELS.startTime} là trường bắt buộc.`;
      } else if (!startDate) {
        errors.startTime = 'Giờ bắt đầu không hợp lệ.';
      } else if (startDate < new Date()) {
        errors.startTime = 'Giờ bắt đầu không được ở trong quá khứ.';
      }

      if (!state.endTime.trim()) {
        errors.endTime = `Trường ${FIELD_LABELS.endTime} là trường bắt buộc.`;
      } else if (!endDate) {
        errors.endTime = 'Giờ kết thúc không hợp lệ.';
      } else if (endDate < new Date()) {
        errors.endTime = 'Giờ kết thúc không được ở trong quá khứ.';
      } else if (startDate && endDate <= startDate) {
        errors.endTime = 'Giờ kết thúc phải sau giờ bắt đầu.';
      }

      if (startDate && endDate && selectedExamPaper?.DurationInMinutes) {
        const durationInMinutes = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
        if (durationInMinutes < Number(selectedExamPaper.DurationInMinutes)) {
          errors.endTime = `Thời lượng ca thi (${durationInMinutes} phút) không được nhỏ hơn thời lượng đề thi (${selectedExamPaper.DurationInMinutes} phút).`;
        }
      }

      if (startDate && endDate && Number.isInteger(state.classroomId)) {
        const overlappedSession = sessions.find((session) => {
          if (Number(session?.ClassroomId) !== Number(state.classroomId)) return false;
          const sessionStart = new Date(session?.StartTime);
          const sessionEnd = new Date(session?.EndTime);
          if (Number.isNaN(sessionStart.getTime()) || Number.isNaN(sessionEnd.getTime())) return false;
          return sessionStart < endDate && sessionEnd > startDate;
        });

        if (overlappedSession) {
          errors.endTime = `Lớp đã có ca thi trùng thời gian (${overlappedSession.SessionName}).`;
        }
      }

      return errors;
    },
    [formOptions.examPapers, sessions]
  );

  useEffect(() => {
    setFormErrors(validateForm(formState));
  }, [formState, validateForm]);

  const markFieldTouched = useCallback((field) => {
    setTouchedFields((prev) => ({ ...prev, [field]: true }));
  }, []);

  const touchRequiredFieldsUntil = useCallback(
    (field) => {
      const endIndex = REQUIRED_FIELD_ORDER.indexOf(field);
      if (endIndex < 0) return;

      setTouchedFields((prev) => {
        const next = { ...prev };
        for (let i = 0; i <= endIndex; i += 1) {
          next[REQUIRED_FIELD_ORDER[i]] = true;
        }
        return next;
      });
      setFormErrors(validateForm(formState));
    },
    [formState, validateForm]
  );

  const getFieldError = useCallback(
    (field) => {
      const shouldShow = touchedFields[field] || attemptedPreview;
      return shouldShow ? formErrors[field] : '';
    },
    [attemptedPreview, formErrors, touchedFields]
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
      shuffleQuestions: true,
      shuffleAnswers: true,
      notes: '',
    });
    setPreviewData(null);
    setPreviewUnlocked(false);
    setShowPreviewModal(false);
    setFormErrors({});
    setTouchedFields({});
    setAttemptedPreview(false);
    setDateTimePickerVisible(false);
    setDateTimePickerMode('date');
    setActiveDateField('');
    setDateTimeDraft(new Date());
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

  const closeDateTimePicker = useCallback(() => {
    setDateTimePickerVisible(false);
    setDateTimePickerMode('date');
    setActiveDateField('');
    setWebDateDraft('');
    setWebTimeDraft('');
  }, []);

  const openDateTimePicker = useCallback(
    (field) => {
      touchRequiredFieldsUntil(field);
      markFieldTouched(field);
      const currentValue = parseDateTimeInput(formState[field]) || new Date();
      setDateTimeDraft(currentValue);
      setWebDateDraft(formatWebDateInput(currentValue));
      setWebTimeDraft(formatWebTimeInput(currentValue));
      setActiveDateField(field);
      setDateTimePickerMode('date');
      setDateTimePickerVisible(true);
    },
    [formState, markFieldTouched, touchRequiredFieldsUntil]
  );

  const applyDateTimeField = useCallback(
    (field, value) => {
      if (!field) return;
      updateFormField(field, formatDateTimeInput(value));
      markFieldTouched(field);
    },
    [markFieldTouched]
  );

  const onChangeDateTimePicker = useCallback(
    (event, selectedDate) => {
      if (Platform.OS !== 'android') {
        if (selectedDate) {
          setDateTimeDraft(selectedDate);
        }
        return;
      }

      if (event?.type === 'dismissed') {
        closeDateTimePicker();
        return;
      }

      if (!selectedDate) {
        return;
      }

      if (dateTimePickerMode === 'date') {
        const mergedDate = new Date(dateTimeDraft);
        mergedDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        setDateTimeDraft(mergedDate);
        setDateTimePickerMode('time');
        return;
      }

      const mergedDateTime = new Date(dateTimeDraft);
      mergedDateTime.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      applyDateTimeField(activeDateField, mergedDateTime);
      closeDateTimePicker();
    },
    [activeDateField, applyDateTimeField, closeDateTimePicker, dateTimeDraft, dateTimePickerMode]
  );

  const onConfirmIosDateTime = useCallback(() => {
    if (dateTimePickerMode === 'date') {
      setDateTimePickerMode('time');
      return;
    }

    applyDateTimeField(activeDateField, dateTimeDraft);
    closeDateTimePicker();
  }, [activeDateField, applyDateTimeField, closeDateTimePicker, dateTimeDraft, dateTimePickerMode]);

  const onConfirmWebDateTime = useCallback(() => {
    if (!webDateDraft || !webTimeDraft) {
      showToast('Vui lòng chọn đủ ngày và giờ.', 'error');
      return;
    }

    const merged = new Date(`${webDateDraft}T${webTimeDraft}:00`);
    if (Number.isNaN(merged.getTime())) {
      showToast('Thời gian đã chọn không hợp lệ.', 'error');
      return;
    }

    applyDateTimeField(activeDateField, merged);
    closeDateTimePicker();
  }, [activeDateField, applyDateTimeField, closeDateTimePicker, showToast, webDateDraft, webTimeDraft]);

  const buildSessionPayload = () => {
    const errors = validateForm(formState);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return { error: 'Vui lòng kiểm tra các trường bắt buộc.' };
    }

    const startDate = parseDateTimeInput(formState.startTime);
    const endDate = parseDateTimeInput(formState.endTime);

    if (!startDate || !endDate) {
      return { error: 'Thời gian không hợp lệ.' };
    }

    const isShuffled = Boolean(formState.shuffleQuestions || formState.shuffleAnswers);

    return {
      payload: {
        sessionName: formState.sessionName.trim(),
        examPaperId: formState.examPaperId,
        classroomId: formState.classroomId,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        sessionPassword: formState.sessionPassword.trim() || null,
        allowViewExplanation: Boolean(formState.allowViewExplanation),
        isShuffled,
        shuffleQuestions: Boolean(formState.shuffleQuestions),
        shuffleAnswers: Boolean(formState.shuffleAnswers),
        notes: formState.notes.trim() || null,
      },
    };
  };

  const onCloseCreateModal = () => {
    if (formSubmitting || previewSubmitting) return;
    setShowCreateModal(false);
    setShowExamPicker(false);
    setShowClassroomPicker(false);
    setShowPreviewModal(false);
    closeDateTimePicker();
    resetCreateState();
    setFormMode('create');
    setEditingSession(null);
  };

  const onPreviewSession = async () => {
    if (!user?.id) {
      showToast('Không tìm thấy thông tin giáo viên.', 'error');
      return;
    }

    setAttemptedPreview(true);
    setTouchedFields((prev) => {
      const next = { ...prev };
      REQUIRED_FIELD_ORDER.forEach((field) => {
        next[field] = true;
      });
      return next;
    });

    const { payload, error: payloadError } = buildSessionPayload();
    if (payloadError) {
      showToast(payloadError, 'error');
      return;
    }

    const previewPayload = {
      ...payload,
      ...(formMode === 'edit' && editingSession?.Id ? { excludeSessionId: Number(editingSession.Id) } : {}),
    };

    try {
      setPreviewSubmitting(true);
      const response = await previewTeacherSession(user.id, previewPayload);
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

  const onSubmitSession = async () => {
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
      const response =
        formMode === 'edit' && editingSession?.Id
          ? await updateTeacherSession(user.id, editingSession.Id, payload)
          : await createTeacherSession(user.id, payload);
      setSubmitSuccessMode(formMode);
      setCreatedSession(response?.session || null);
      setShowPreviewModal(false);
      setShowCreateModal(false);
      closeDateTimePicker();
      resetCreateState();
      setFormMode('create');
      setEditingSession(null);
      setShowCreatedSessionModal(true);
      showToast(formMode === 'edit' ? 'Cập nhật ca thi thành công.' : 'Tạo ca thi thành công.', 'success');
      await loadData();
    } catch (err) {
      const msg = err?.response?.data?.message || (formMode === 'edit' ? 'Không thể cập nhật ca thi.' : 'Không thể tạo ca thi.');
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
      searchPlaceholder="Tìm kiếm..."
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
          <Text className="text-primary text-2xl font-bold tracking-tight mb-1">Danh sách ca thi</Text>
          
          <Text className="text-on-surface-variant font-medium text-sm mt-3">
            Tổng số ca thi: {filteredSessions.length}
          </Text>

          <TouchableOpacity className="w-full bg-primary mt-4 py-3 px-4 rounded-xl flex-row items-center justify-center gap-2" onPress={onOpenCreateModal} disabled={formLoading}>
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
                    {isUpcomingSession(session) ? (
                      <View className="flex-row items-center">
                        <TouchableOpacity
                          onPress={() => onOpenEditModal(session)}
                          className="w-8 h-8 rounded-full items-center justify-center mr-2"
                          style={{ backgroundColor: '#eff3fa' }}
                        >
                          <MaterialIcons name="edit" size={16} color="#0B63C8" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => onOpenDeleteConfirm(session)}
                          className="w-8 h-8 rounded-full items-center justify-center"
                          style={{ backgroundColor: '#fff1f2' }}
                        >
                          <MaterialIcons name="delete" size={16} color="#dc2626" />
                        </TouchableOpacity>
                      </View>
                    ) : null}
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
                        Thời gian: {formatSessionTimeRange(session.StartTime, session.EndTime)}
                      </Text>
                    </View>

                    <View className="flex-row items-center mb-2">
                      <MaterialIcons name="timer" size={18} color="#0B63C8" />
                      <Text className="text-sm text-on-surface-variant ml-2 flex-1">
                        Thời lượng ca: {session.DurationInMinutes ?? 0} phút - Thời lượng đề: {session.ExamPaperDurationInMinutes ?? '--'} phút
                      </Text>
                    </View>

                    

                    

                    

                    
                  </View>

                  

                  <View className=" w-full flex-row items-center justify-end gap-2 mt-3 flex-wrap">
                    <TouchableOpacity
                      className="flex-1 rounded-xl px-3 py-2 flex-row items-center justify-center"
                      style={{ backgroundColor: '#eff3fa' }}
                      onPress={() => onCopySessionLink(session)}
                    >
                      <MaterialIcons name="content-copy" size={14} color="#0B63C8" />
                      <Text className="text-primary text-xs font-bold ml-1">Lấy link</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      className="flex-1 rounded-xl px-3 py-2 flex-row items-center justify-center"
                      style={{ backgroundColor: '#eff3fa' }}
                      onPress={() => onOpenSessionQr(session)}
                    >
                      <MaterialIcons name="qr-code-2" size={14} color="#0B63C8" />
                      <Text className="text-primary text-xs font-bold ml-1">QR</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      className="flex-1 rounded-xl px-3 py-2 flex-row items-center justify-center"
                      style={{ backgroundColor: '#eef2ff' }}
                      onPress={() => onOpenSessionManagement(session)}
                    >
                      <MaterialIcons name="manage-search" size={14} color="#4f46e5" />
                      <Text className="text-indigo-700 text-xs font-bold ml-1">Quản lý</Text>
                    </TouchableOpacity>
                  </View>
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
                <Text className="text-xs text-on-surface-variant mb-3">{formMode === 'edit' ? 'Chỉnh sửa ca thi sắp diễn ra' : 'Tạo ca thi mới'}</Text>

                <Text className="text-xs uppercase font-bold text-on-surface-variant mb-2">Tên ca thi *</Text>
                <TextInput
                  value={formState.sessionName}
                  onChangeText={(value) => updateFormField('sessionName', value)}
                  onBlur={() => markFieldTouched('sessionName')}
                  placeholder="Ví dụ: Kiểm tra cuối kỳ - Môn Toán"
                  placeholderTextColor="#9AA3B2"
                  className="h-12 rounded-2xl px-4 text-base text-on-surface bg-surface-container-lowest"
                  style={{ borderWidth: 1, borderColor: getFieldError('sessionName') ? '#dc2626' : '#C1C6D6' }}
                />
                {getFieldError('sessionName') ? (
                  <Text className="text-red-600 text-xs mt-1">{getFieldError('sessionName')}</Text>
                ) : null}

                <Text className="text-xs uppercase font-bold text-on-surface-variant mb-2 mt-4">Đề thi *</Text>
                <TouchableOpacity
                  className="h-12 rounded-2xl px-4 flex-row items-center justify-between bg-surface-container-lowest"
                  style={{ borderWidth: 1, borderColor: getFieldError('examPaperId') ? '#dc2626' : '#C1C6D6' }}
                  onPress={() => {
                    touchRequiredFieldsUntil('examPaperId');
                    setShowExamPicker(true);
                  }}
                >
                  <Text className="text-sm text-on-surface-variant flex-1 mr-3" numberOfLines={1}>
                    {selectedExam
                      ? `${selectedExam.Title} (${selectedExam.DurationInMinutes} phút - ${selectedExam.QuestionCount ?? 0} câu)`
                      : 'Chọn đề thi từ thư viện'}
                  </Text>
                  <MaterialIcons name="expand-more" size={20} color="#727785" />
                </TouchableOpacity>
                {getFieldError('examPaperId') ? (
                  <Text className="text-red-600 text-xs mt-1">{getFieldError('examPaperId')}</Text>
                ) : null}

                <Text className="text-xs uppercase font-bold text-on-surface-variant mb-2 mt-4">Lớp học tham gia *</Text>
                <TouchableOpacity
                  className="h-12 rounded-2xl px-4 flex-row items-center justify-between bg-surface-container-lowest"
                  style={{ borderWidth: 1, borderColor: getFieldError('classroomId') ? '#dc2626' : '#C1C6D6' }}
                  onPress={() => {
                    touchRequiredFieldsUntil('classroomId');
                    setShowClassroomPicker(true);
                  }}
                >
                  <Text className="text-sm text-on-surface-variant flex-1 mr-3" numberOfLines={1}>
                    {selectedClassroom
                      ? `${selectedClassroom.ClassName} (${selectedClassroom.JoinCode})`
                      : 'Chọn lớp học'}
                  </Text>
                  <MaterialIcons name="expand-more" size={20} color="#727785" />
                </TouchableOpacity>
                {getFieldError('classroomId') ? (
                  <Text className="text-red-600 text-xs mt-1">{getFieldError('classroomId')}</Text>
                ) : null}

                <Text className="text-xs font-bold text-primary uppercase tracking-wider mt-6 mb-3">Thời gian</Text>

                <Text className="text-xs uppercase font-bold text-on-surface-variant mb-2">Giờ bắt đầu *</Text>
                <TouchableOpacity
                  className="h-12 rounded-2xl px-4 flex-row items-center justify-between bg-surface-container-lowest"
                  style={{ borderWidth: 1, borderColor: getFieldError('startTime') ? '#dc2626' : '#C1C6D6' }}
                  onPress={() => openDateTimePicker('startTime')}
                >
                  <View className="flex-row items-center flex-1 mr-2">
                    <MaterialIcons name="calendar-month" size={18} color="#5b6476" />
                    <Text className="ml-2 text-sm text-on-surface-variant" numberOfLines={1}>
                      {formState.startTime || 'dd/mm/yyyy HH:mm'}
                    </Text>
                  </View>
                  <MaterialIcons name="expand-more" size={20} color="#727785" />
                </TouchableOpacity>
                {getFieldError('startTime') ? (
                  <Text className="text-red-600 text-xs mt-1">{getFieldError('startTime')}</Text>
                ) : null}

                <Text className="text-xs uppercase font-bold text-on-surface-variant mb-2 mt-4">Giờ kết thúc *</Text>
                <TouchableOpacity
                  className="h-12 rounded-2xl px-4 flex-row items-center justify-between bg-surface-container-lowest"
                  style={{ borderWidth: 1, borderColor: getFieldError('endTime') ? '#dc2626' : '#C1C6D6' }}
                  onPress={() => openDateTimePicker('endTime')}
                >
                  <View className="flex-row items-center flex-1 mr-2">
                    <MaterialIcons name="schedule" size={18} color="#5b6476" />
                    <Text className="ml-2 text-sm text-on-surface-variant" numberOfLines={1}>
                      {formState.endTime || 'dd/mm/yyyy HH:mm'}
                    </Text>
                  </View>
                  <MaterialIcons name="expand-more" size={20} color="#727785" />
                </TouchableOpacity>
                {getFieldError('endTime') ? (
                  <Text className="text-red-600 text-xs mt-1">{getFieldError('endTime')}</Text>
                ) : null}

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
                    markFieldTouched('examPaperId');
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
                    markFieldTouched('classroomId');
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

      {dateTimePickerVisible && Platform.OS === 'android' ? (
        <DateTimePicker
          value={dateTimeDraft}
          mode={dateTimePickerMode}
          is24Hour
          display={dateTimePickerMode === 'date' ? 'default' : 'clock'}
          onChange={onChangeDateTimePicker}
        />
      ) : null}

      <Modal
        visible={dateTimePickerVisible && Platform.OS === 'ios'}
        transparent
        animationType="fade"
        onRequestClose={closeDateTimePicker}
      >
        <Pressable
          className="flex-1 items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
          onPress={closeDateTimePicker}
        >
          <Pressable
            className="w-full max-w-xl rounded-2xl bg-surface-container-lowest p-4"
            onPress={(event) => event.stopPropagation()}
          >
            <Text className="text-lg font-bold text-on-surface mb-1">
              {activeDateField === 'endTime' ? 'Chọn giờ kết thúc' : 'Chọn giờ bắt đầu'}
            </Text>
            <Text className="text-sm text-on-surface-variant mb-2">
              {dateTimePickerMode === 'date' ? 'Bước 1: Chọn ngày' : 'Bước 2: Chọn giờ'}
            </Text>

            <DateTimePicker
              value={dateTimeDraft}
              mode={dateTimePickerMode}
              is24Hour
              display="spinner"
              onChange={onChangeDateTimePicker}
            />

            <View className="flex-row justify-end mt-3">
              <TouchableOpacity className="px-3 py-2 mr-2" onPress={closeDateTimePicker}>
                <Text className="text-on-surface-variant font-bold">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="px-3 py-2 rounded-lg"
                style={{ backgroundColor: '#005bbf' }}
                onPress={onConfirmIosDateTime}
              >
                <Text className="text-white font-bold">
                  {dateTimePickerMode === 'date' ? 'Tiếp tục' : 'Xong'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={dateTimePickerVisible && Platform.OS === 'web'}
        transparent
        animationType="fade"
        onRequestClose={closeDateTimePicker}
      >
        <Pressable
          className="flex-1 items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
          onPress={closeDateTimePicker}
        >
          <Pressable
            className="w-full max-w-xl rounded-2xl bg-surface-container-lowest p-4"
            onPress={(event) => event.stopPropagation()}
          >
            <Text className="text-lg font-bold text-on-surface mb-1">
              {activeDateField === 'endTime' ? 'Chọn giờ kết thúc' : 'Chọn giờ bắt đầu'}
            </Text>
            <Text className="text-sm text-on-surface-variant mb-3">Chọn ngày và giờ rồi bấm Xong</Text>

            <View className="mb-3">
              <Text className="text-xs uppercase font-bold text-on-surface-variant mb-2">Ngày</Text>
              <input
                type="date"
                value={webDateDraft}
                onChange={(event) => setWebDateDraft(event.target.value)}
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 12,
                  border: '1px solid #C1C6D6',
                  padding: '0 12px',
                  fontSize: 14,
                }}
              />
            </View>

            <View className="mb-2">
              <Text className="text-xs uppercase font-bold text-on-surface-variant mb-2">Giờ</Text>
              <input
                type="time"
                value={webTimeDraft}
                onChange={(event) => setWebTimeDraft(event.target.value)}
                style={{
                  width: '100%',
                  height: 42,
                  borderRadius: 12,
                  border: '1px solid #C1C6D6',
                  padding: '0 12px',
                  fontSize: 14,
                }}
              />
            </View>

            <View className="flex-row justify-end mt-3">
              <TouchableOpacity className="px-3 py-2 mr-2" onPress={closeDateTimePicker}>
                <Text className="text-on-surface-variant font-bold">Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="px-3 py-2 rounded-lg"
                style={{ backgroundColor: '#005bbf' }}
                onPress={onConfirmWebDateTime}
              >
                <Text className="text-white font-bold">Xong</Text>
              </TouchableOpacity>
            </View>
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
              <Text className="text-on-surface text-sm mt-1">
                Xáo câu hỏi: {toOnOffText(previewData?.preview?.shuffleQuestions)} - Xáo đáp án: {toOnOffText(previewData?.preview?.shuffleAnswers)}
              </Text>
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

          <View className="px-4 pb-5 pt-3 border-t bg-surface-container-lowest" style={{ borderColor: '#c1c6d64d' }}>
            <TouchableOpacity
              className="h-11 rounded-xl bg-primary items-center justify-center flex-row"
              onPress={onSubmitSession}
              disabled={formSubmitting}
            >
              {formSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="done" size={18} color="#FFFFFF" />
                  <Text className="text-white font-bold ml-1">
                    {formMode === 'edit' ? 'Hoàn tất sửa' : 'Hoàn tất tạo'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showCreatedSessionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreatedSessionModal(false)}
      >
        <Pressable
          className="flex-1 items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
          onPress={() => setShowCreatedSessionModal(false)}
        >
          <Pressable
            className="w-full max-w-xl rounded-3xl bg-surface-container-lowest px-5 py-5"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-on-surface text-xl font-bold">
                {submitSuccessMode === 'edit' ? 'Cập nhật ca thi thành công' : 'Tạo ca thi thành công'}
              </Text>
              <TouchableOpacity onPress={() => setShowCreatedSessionModal(false)}>
                <MaterialIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text className="text-sm text-on-surface-variant mb-2" numberOfLines={2}>
              {createdSession?.SessionName || '--'}
            </Text>

            <View className="rounded-xl border px-3 py-3" style={{ borderColor: '#c1c6d64d', backgroundColor: '#f8fafc' }}>
              <Text className="text-xs uppercase font-bold text-on-surface-variant mb-1">Link ca thi</Text>
              <Text className="text-sm text-primary" numberOfLines={2}>
                {createdSession?.SessionLink || 'Không có link'}
              </Text>
              <TouchableOpacity className="mt-3 h-10 rounded-lg bg-primary items-center justify-center flex-row" onPress={() => onCopySessionLink(createdSession)}>
                <MaterialIcons name="content-copy" size={17} color="#FFFFFF" />
                <Text className="text-white font-bold ml-1">Sao chép link</Text>
              </TouchableOpacity>
            </View>

            <View className="items-center mt-4">
              {buildSessionQrImageUrl(createdSession) ? (
                <Image
                  source={{ uri: buildSessionQrImageUrl(createdSession) }}
                  style={{ width: 220, height: 220, borderRadius: 12 }}
                  resizeMode="contain"
                />
              ) : null}
            </View>

            <TouchableOpacity
              className="h-11 mt-4 rounded-xl bg-primary items-center justify-center flex-row"
              disabled={downloadingQr}
              onPress={() => onDownloadQrImage(createdSession)}
            >
              {downloadingQr ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="download" size={18} color="#FFFFFF" />
                  <Text className="text-white font-bold ml-2">Tải ảnh QR</Text>
                </>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showDeleteConfirmModal} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirmModal(false)}>
        <Pressable
          className="flex-1 items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
          onPress={() => setShowDeleteConfirmModal(false)}
        >
          <Pressable
            className="w-full max-w-xl rounded-3xl bg-surface-container-lowest px-5 py-5"
            onPress={(event) => event.stopPropagation()}
          >
            <Text className="text-on-surface text-xl font-bold mb-2">Xác nhận xóa ca thi</Text>
            <Text className="text-sm text-on-surface-variant mb-4">
              Bạn có chắc chắn muốn xóa ca thi {pendingDeleteSession?.SessionName || '--'} không? Hành động này không thể hoàn tác.
            </Text>

            <View className="flex-row items-center justify-end">
              <TouchableOpacity
                className="h-11 px-4 rounded-xl bg-surface-container-high items-center justify-center mr-3"
                onPress={() => setShowDeleteConfirmModal(false)}
                disabled={deletingSession}
              >
                <Text className="text-on-surface font-bold">Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="h-11 px-4 rounded-xl items-center justify-center flex-row"
                style={{ backgroundColor: '#dc2626' }}
                onPress={onConfirmDeleteSession}
                disabled={deletingSession}
              >
                {deletingSession ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="delete" size={18} color="#FFFFFF" />
                    <Text className="text-white font-bold ml-1">Xóa</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showQrModal} transparent animationType="fade" onRequestClose={() => setShowQrModal(false)}>
        <Pressable
          className="flex-1 items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.55)' }}
          onPress={() => setShowQrModal(false)}
        >
          <Pressable
            className="w-full max-w-xl rounded-3xl bg-surface-container-lowest px-5 py-5"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-on-surface text-xl font-bold">QR vào ca thi</Text>
              <TouchableOpacity onPress={() => setShowQrModal(false)}>
                <MaterialIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View className="items-center mt-4">
              {buildSessionQrImageUrl(selectedSessionAction) ? (
                <Image
                  source={{ uri: buildSessionQrImageUrl(selectedSessionAction) }}
                  style={{ width: 220, height: 220, borderRadius: 12 }}
                  resizeMode="contain"
                />
              ) : null}
            </View>

            <TouchableOpacity
              className="h-11 mt-4 rounded-xl bg-primary items-center justify-center flex-row"
              disabled={downloadingQr}
              onPress={() => onDownloadQrImage(selectedSessionAction)}
            >
              {downloadingQr ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="download" size={18} color="#FFFFFF" />
                  <Text className="text-white font-bold ml-2">Tải ảnh QR</Text>
                </>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </TeacherScreenShell>
  );
};

export default SessionScreen;