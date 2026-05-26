import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import TeacherScreenShell from '../../components/TeacherScreenShell';
import { useToast } from '../../context/ToastContext';
import { getTeacherSessionDetail } from '../../services/authService';

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

const getSubmissionStatusText = (value) => {
  if (value === 1) return 'Đã nộp';
  if (value === 2) return 'Nộp bắt buộc';
  if (value === 0) return 'Đang làm';
  return 'Chưa vào thi';
};

const SessionManagementScreen = ({ route, navigation }) => {
  const { showToast } = useToast();
  const user = route?.params?.user || null;
  const sessionParam = route?.params?.session || null;
  const sessionId = sessionParam?.Id || null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState(sessionParam || null);
  const [students, setStudents] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);

  const teacherInitials = useMemo(() => {
    const fullName = user?.fullName || '';
    if (!fullName.trim()) return 'GV';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[parts.length - 2][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }, [user?.fullName]);

  const loadData = useCallback(async () => {
    if (!user?.id || !sessionId) {
      setError('Thiếu thông tin ca thi để quản lý.');
      return;
    }

    try {
      setError('');
      const data = await getTeacherSessionDetail(user.id, sessionId);
      setSession(data?.session || null);
      setStudents(Array.isArray(data?.students) ? data.students : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không tải được dữ liệu quản lý ca thi.');
    }
  }, [sessionId, user?.id]);

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

  const filteredStudents = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return students;

    return students.filter((student) => {
      const haystack = `${student?.FullName || ''} ${student?.Email || ''}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [searchText, students]);

  const onCopyLink = useCallback(async () => {
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
  }, [session?.SessionLink, showToast]);

  const onDownloadQrImage = useCallback(
    async (qrImageUrl, sessionName) => {
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
            anchor.download = `${String(sessionName || 'ca-thi').replace(/[^a-zA-Z0-9-_]+/g, '-')}-qr.png`;
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

        const safeName = String(sessionName || 'ca-thi').replace(/[^a-zA-Z0-9-_]+/g, '-');
        const destinationFile = new FileSystem.File(
          FileSystem.Paths.cache,
          `${safeName}-qr-${Date.now()}.png`
        );
        const result = await FileSystem.downloadFileAsync(qrImageUrl, destinationFile);
        const downloadedUri = typeof result === 'string' ? result : result?.uri || destinationFile.uri;
        const canShare = await Sharing.isAvailableAsync();

        if (!canShare) {
          showToast(`Đã lưu tạm ảnh QR tại: ${downloadedUri}`, 'info');
          return;
        }

        await Sharing.shareAsync(downloadedUri, {
          mimeType: 'image/png',
          dialogTitle: 'Lưu ảnh QR ca thi',
          UTI: 'public.png',
        });
        showToast('Đã mở trình chia sẻ để lưu ảnh QR.', 'success');
      } catch (error) {
        showToast(error?.message || 'Không thể tải ảnh QR.', 'error');
      } finally {
        setDownloadingQr(false);
      }
    },
    [showToast]
  );

  const onSelectBottomNav = (item) => {
    if (item.key === 'sessions') {
      navigation.replace('TeacherSessions', { user });
      return;
    }

    if (item.key === 'classes') {
      navigation.replace('TeacherClassrooms', { user });
      return;
    }

    navigation.replace('TeacherDashboard', {
      user,
      initialTab: item.key,
    });
  };

  return (
    <TeacherScreenShell
      bottomNavItems={[
        { key: 'home', label: 'Trang chủ', shortLabel: 'Home', icon: 'home' },
        { key: 'classes', label: 'Lớp học', shortLabel: 'Classes', icon: 'groups' },
        { key: 'exams', label: 'Đề thi', shortLabel: 'Exams', icon: 'description' },
        { key: 'sessions', label: 'Ca thi', shortLabel: 'Sessions', icon: 'event' },
        { key: 'reports', label: 'Báo cáo', shortLabel: 'Reports', icon: 'bar-chart' },
      ]}
      activeKey="sessions"
      onSelectBottomNav={onSelectBottomNav}
      searchText={searchText}
      onChangeSearch={setSearchText}
      searchPlaceholder="Tìm học sinh theo tên hoặc email..."
      upcomingCount={0}
      initials={teacherInitials}
      onPressAvatar={() => navigation.navigate('TeacherProfile', { user })}
    >
      <ScrollView
        className="flex-1 px-4"
        style={{ minHeight: 0 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="mt-4 mb-3 flex-row items-center self-start px-3 py-2 rounded-xl bg-surface-container-high"
        >
          <MaterialIcons name="arrow-back" size={16} color="#0B63C8" />
          <Text className="text-primary font-bold ml-1">Quay lại</Text>
        </TouchableOpacity>

        {loading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color="#005bbf" />
            <Text className="mt-3 text-on-surface-variant">Đang tải quản lý ca thi...</Text>
          </View>
        ) : error ? (
          <View className="rounded-lg bg-red-100 px-3 py-2 mb-4 border border-red-200">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        ) : (
          <>
            <View className="bg-surface-container-lowest rounded-3xl p-5 mb-4" style={{ borderWidth: 1, borderColor: '#c1c6d64d' }}>
              <Text className="text-xs uppercase tracking-wide font-bold text-on-surface-variant mb-2">
                Thông tin ca thi
              </Text>
              <Text className="text-2xl font-bold text-on-surface">{session?.SessionName || '--'}</Text>

              <Text className="text-on-surface-variant mt-3">Lớp: {session?.ClassName || '--'}</Text>
              <Text className="text-on-surface-variant mt-1">Đề thi: {session?.ExamTitle || '--'}</Text>
              <Text className="text-on-surface-variant mt-1">Bắt đầu: {formatDateTime(session?.StartTime)}</Text>
              <Text className="text-on-surface-variant mt-1">Kết thúc: {formatDateTime(session?.EndTime)}</Text>

              <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-on-surface font-semibold">
                  Sĩ số lớp: {session?.ClassroomStudentCount ?? 0} - Đã nộp: {session?.SubmittedCount ?? 0}
                </Text>
              </View>

              <View className="mt-3 rounded-2xl px-3 py-3" style={{ borderWidth: 1, borderColor: '#cbd5e1' }}>
                <Text className="text-xs uppercase font-bold text-on-surface-variant mb-1">Link ca thi</Text>
                <Text className="text-primary text-sm" numberOfLines={2}>{session?.SessionLink || '--'}</Text>
              </View>

              <View className="mt-3 flex-row items-center justify-between">
                <TouchableOpacity
                  className="rounded-xl px-3 py-2.5 flex-row items-center"
                  style={{ backgroundColor: '#eff3fa' }}
                  onPress={onCopyLink}
                >
                  <MaterialIcons name="content-copy" size={15} color="#0B63C8" />
                  <Text className="text-primary font-semibold text-sm ml-1.5">Sao chép Link</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="rounded-xl px-3 py-2.5 flex-row items-center"
                  style={{ backgroundColor: '#eff3fa' }}
                  onPress={() => setShowQrModal(true)}
                >
                  <MaterialIcons name="qr-code-2" size={15} color="#0B63C8" />
                  <Text className="text-primary font-semibold text-sm ml-1.5">Xem QR</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="mb-3">
              <Text className="text-xl font-bold text-on-surface">Danh sách học sinh trong ca thi</Text>
            </View>

            {students.length === 0 ? (
              <View className="border-2 border-dashed border-outline-variant rounded-xl items-center justify-center p-8 bg-surface-container-low">
                <MaterialIcons name="person-off" size={40} color="#727785" />
                <Text className="text-on-surface-variant font-medium mt-3 text-base">Chưa có học sinh trong lớp học này.</Text>
              </View>
            ) : filteredStudents.length === 0 ? (
              <View className="border-2 border-dashed border-outline-variant rounded-xl items-center justify-center p-8 bg-surface-container-low">
                <MaterialIcons name="search-off" size={40} color="#727785" />
                <Text className="text-on-surface-variant font-medium mt-3 text-base">Không tìm thấy học sinh theo từ khóa.</Text>
              </View>
            ) : (
              filteredStudents.map((student) => (
                <View
                  key={student.Id}
                  className="mb-3 rounded-2xl bg-surface-container-lowest px-4 py-3"
                  style={{ borderWidth: 1, borderColor: '#c1c6d64d' }}
                >
                  <View className="flex-row items-start justify-between">
                    <View className="flex-1 pr-2">
                      <Text className="text-on-surface text-base font-bold" numberOfLines={1}>
                        {student.FullName || 'Không rõ tên'}
                      </Text>
                      <Text className="text-on-surface-variant text-sm mt-1" numberOfLines={1}>
                        {student.Email || '--'}
                      </Text>
                    </View>
                    <View className="px-2 py-1 rounded-lg" style={{ backgroundColor: '#eff3fa' }}>
                      <Text className="text-xs font-bold text-primary">{getSubmissionStatusText(student.Status)}</Text>
                    </View>
                  </View>

                  <View className="mt-3 flex-row items-center justify-between">
                    <Text className="text-sm text-on-surface-variant">Vi phạm: {student.WarningCount ?? 0}</Text>
                    <Text className="text-sm text-on-surface-variant">Điểm: {student.Score ?? '--'}</Text>
                    <Text className="text-sm text-on-surface-variant">Làm bài: {student.DurationInMinutes ?? '--'} phút</Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={showQrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
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
              {session?.QrImageUrl ? (
                <Image
                  source={{ uri: session.QrImageUrl }}
                  style={{ width: 220, height: 220, borderRadius: 12 }}
                  resizeMode="contain"
                />
              ) : null}
            </View>

            <TouchableOpacity
              className="h-11 mt-4 rounded-xl bg-primary items-center justify-center flex-row"
              disabled={downloadingQr}
              onPress={() => onDownloadQrImage(session?.QrImageUrl, session?.SessionName || 'ca-thi')}
            >
              {downloadingQr ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="download" size={18} color="#FFFFFF" />
                  <Text className="text-white font-bold ml-2">Tải xuống QR</Text>
                </>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </TeacherScreenShell>
  );
};

export default SessionManagementScreen;
