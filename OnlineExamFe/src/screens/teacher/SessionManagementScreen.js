import { loadAuthSession } from '../../services/authSession';
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
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useToast } from '../../context/ToastContext';
import { getTeacherSessionDetail } from '../../services/authService';

const COLORS = {
  primary: '#005BBF',
  primaryContainer: '#004aad',
  surface: '#f7f9fb',
  surfaceContainerLow: '#f2f4f6',
  surfaceContainerLowest: '#ffffff',
  onSurface: '#191c1e',
  onSurfaceVariant: '#434653',
  outlineVariant: 'rgba(195, 198, 213, 0.4)',
  errorContainer: '#ffdad6',
  onErrorContainer: '#410002',
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

const getSubmissionStatusText = (value) => {
  if (value === 1) return 'Đã nộp';
  if (value === 2) return 'Nộp bắt buộc';
  if (value === 0) return 'Đang làm';
  return 'Chưa vào thi';
};

const SessionManagementScreen = ({ route, navigation }) => {
  const { showToast } = useToast();
  const user = route?.params?.user?.id ? route?.params?.user : loadAuthSession();
  const sessionParam = route?.params?.session || null;
  const sessionId = sessionParam?.Id || route?.params?.sessionId || null;

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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header matching ExamDetail style */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('TeacherSessions')}>
          <MaterialIcons name="arrow-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Chi tiết ca thi</Text>
          <Text style={styles.headerSubtitle}>Quản lý ca thi</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Đang tải chi tiết ca thi...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBoxInline}>
            <Text style={styles.errorTextInline}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tên ca thi</Text>
                <View style={styles.infoInputBlock}>
                  <Text style={styles.infoInputText}>{session?.SessionName || '--'}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={[styles.infoRow, { flex: 1 }]}>
                  <Text style={styles.infoLabel}>Lớp học</Text>
                  <View style={[styles.infoInputBlock, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <MaterialIcons name="class" size={16} color={COLORS.onSurfaceVariant} />
                    <Text style={styles.infoInputText} numberOfLines={1}>{session?.ClassName || '--'}</Text>
                  </View>
                </View>

                <View style={[styles.infoRow, { flex: 1 }]}>
                  <Text style={styles.infoLabel}>Đề thi</Text>
                  <View style={[styles.infoInputBlock, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <MaterialIcons name="description" size={16} color={COLORS.onSurfaceVariant} />
                    <Text style={styles.infoInputText} numberOfLines={1}>{session?.ExamTitle || '--'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Thời gian diễn ra</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={[styles.infoInputBlock, { flex: 1 }]}>
                    <Text style={{ fontSize: 10, color: '#16a34a', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 }}>Bắt đầu</Text>
                    <Text style={styles.infoInputText}>{formatDateTime(session?.StartTime)}</Text>
                  </View>
                  <View style={[styles.infoInputBlock, { flex: 1 }]}>
                    <Text style={{ fontSize: 10, color: '#dc2626', fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 }}>Kết thúc</Text>
                    <Text style={styles.infoInputText}>{formatDateTime(session?.EndTime)}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tình trạng nộp bài</Text>
                <View style={[styles.infoInputBlock, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', backgroundColor: 'rgba(0, 91, 191, 0.05)', borderColor: 'rgba(0, 91, 191, 0.1)', borderWidth: 1 }]}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: COLORS.primary }}>{session?.ClassroomStudentCount ?? 0}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', marginTop: 2 }}>Sĩ số</Text>
                  </View>
                  <View style={{ width: 1, height: 32, backgroundColor: COLORS.outlineVariant }} />
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: '#16a34a' }}>{session?.SubmittedCount ?? 0}</Text>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', marginTop: 2 }}>Đã nộp</Text>
                  </View>
                </View>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Link ca thi</Text>
                <View style={styles.infoInputBlock}>
                  <Text style={[styles.infoInputText, { color: COLORS.primary }]} numberOfLines={2}>{session?.SessionLink || '--'}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={[styles.infoInputBlock, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.outlineVariant, backgroundColor: COLORS.surfaceContainerLowest }]}
                  onPress={onCopyLink}
                >
                  <MaterialIcons name="content-copy" size={16} color={COLORS.primary} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: COLORS.primary }}>Copy Link</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.infoInputBlock, { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary }]}
                  onPress={() => setShowQrModal(true)}
                >
                  <MaterialIcons name="qr-code-2" size={16} color="#ffffff" />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#ffffff' }}>Mã QR</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.listHeaderRow}>
              <Text style={styles.listTitle}>Danh sách học sinh</Text>
              <Text style={styles.listCount}>Tổng: {students.length}</Text>
            </View>
            <View style={styles.listSection}>
              {students.length === 0 ? (
                <Text style={styles.emptyText}>Chưa có học sinh nào.</Text>
              ) : filteredStudents.length === 0 ? (
                <Text style={styles.emptyText}>Không tìm thấy học sinh theo tên hoặc email.</Text>
              ) : (
                filteredStudents.map((student) => (
                  <View key={student.Id} style={styles.card}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant, paddingBottom: 12, marginBottom: 12 }}>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                        <View style={styles.avatarBox}>
                          <Text style={styles.avatarText}>{student.FullName ? student.FullName.charAt(0).toUpperCase() : 'H'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle} numberOfLines={1}>
                            {student.FullName || 'Không rõ tên'}
                          </Text>
                          <Text style={styles.cardSubtitle} numberOfLines={1}>
                            {student.Email || '--'}
                          </Text>
                        </View>
                      </View>
                      <View style={{ backgroundColor: student.Status === 1 ? 'rgba(22, 163, 74, 0.08)' : COLORS.surfaceContainerLow, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: student.Status === 1 ? '#166534' : COLORS.onSurfaceVariant }}>{getSubmissionStatusText(student.Status)}</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', marginBottom: 2 }}>Vi phạm</Text>
                        <Text style={{ fontSize: 14, fontWeight: '900', color: '#dc2626' }}>{student.WarningCount ?? 0}</Text>
                      </View>
                      <View style={{ width: 1, height: 24, backgroundColor: COLORS.outlineVariant }} />
                      <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', marginBottom: 2 }}>Làm bài</Text>
                        <Text style={{ fontSize: 14, fontWeight: '900', color: COLORS.onSurface }}>{student.DurationInMinutes ?? '--'}p</Text>
                      </View>
                      <View style={{ width: 1, height: 24, backgroundColor: COLORS.outlineVariant }} />
                      <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase', marginBottom: 2 }}>Điểm số</Text>
                        <Text style={{ fontSize: 15, fontWeight: '900', color: COLORS.primary }}>{student.Score ?? '--'}</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
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
    </SafeAreaView>
  );
};

export default SessionManagementScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    minHeight: 56,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.outlineVariant,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center' },
  headerTitleContainer: { flex: 1, marginLeft: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.onSurface },
  headerSubtitle: { fontSize: 12, color: COLORS.onSurfaceVariant },
  
  scrollContent: { paddingBottom: 60 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: COLORS.onSurfaceVariant },
  errorBoxInline: {
    margin: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
  },
  errorTextInline: { color: '#b91c1c', fontSize: 12 },
  emptyText: { color: COLORS.onSurfaceVariant, fontSize: 12, marginTop: 8 },

  infoSection: {
    margin: 16,
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    gap: 12,
  },
  infoRow: { gap: 6 },
  infoLabel: { fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant, textTransform: 'uppercase' },
  infoInputBlock: {
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  infoInputText: {
    fontSize: 13,
    color: COLORS.onSurface,
  },

  listHeaderRow: {
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listTitle: { fontSize: 16, fontWeight: '700', color: COLORS.onSurface },
  listCount: { fontSize: 12, color: COLORS.onSurfaceVariant, fontWeight: '600' },
  listSection: { paddingHorizontal: 16 },
  
  card: {
    backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 8 }, android: { elevation: 2 } }),
  },
  cardTitle: { fontSize: 15, color: COLORS.onSurface, fontWeight: '600', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: COLORS.onSurfaceVariant },
  avatarBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
