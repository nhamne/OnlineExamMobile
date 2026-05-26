import { loadAuthSession } from '../../services/authSession';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Platform,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useToast } from '../../context/ToastContext';
import {
  getTeacherClassroomDetail,
  removeStudentFromTeacherClassroom,
} from '../../services/authService';

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

const ClassroomManagementScreen = ({ route, navigation }) => {
  const { showToast } = useToast();
  const user = route?.params?.user?.id ? route?.params?.user : loadAuthSession();
  const classroomParam = route?.params?.classroom || null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [classroom, setClassroom] = useState(classroomParam || null);
  const [students, setStudents] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [removingStudentId, setRemovingStudentId] = useState(null);
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  const classroomId = classroomParam?.Id || classroomParam?.id || route?.params?.classroomId || null;

  const teacherInitials = useMemo(() => {
    const fullName = user?.fullName || '';
    if (!fullName.trim()) return 'GV';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[parts.length - 2][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }, [user?.fullName]);

  const loadData = useCallback(async () => {
    if (!user?.id || !classroomId) {
      setError('Thiếu thông tin lớp học để quản lý.');
      return;
    }

    try {
      setError('');
      const data = await getTeacherClassroomDetail(user.id, classroomId);
      setClassroom(data?.classroom || null);
      setStudents(Array.isArray(data?.students) ? data.students : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Không tải được dữ liệu lớp học.');
    }
  }, [classroomId, user?.id]);

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
      const fullName = String(student?.FullName || '').toLowerCase();
      const email = String(student?.Email || '').toLowerCase();
      return fullName.includes(keyword) || email.includes(keyword);
    });
  }, [searchText, students]);

  const onOpenRemoveStudentModal = (student) => {
    setSelectedStudent(student || null);
    setShowRemoveModal(true);
  };

  const onCloseRemoveStudentModal = () => {
    if (removingStudentId) return;
    setShowRemoveModal(false);
    setSelectedStudent(null);
  };

  const onRemoveStudent = async () => {
    if (!selectedStudent?.Id || !user?.id || !classroom?.Id) {
      showToast('Không thể xóa học sinh này.', 'error');
      return;
    }

    try {
      setRemovingStudentId(selectedStudent.Id);
      await removeStudentFromTeacherClassroom(user.id, classroom.Id, selectedStudent.Id);
      setStudents((prev) => prev.filter((item) => item.Id !== selectedStudent.Id));
      setClassroom((prev) => {
        if (!prev) return prev;
        const nextCount = Math.max(0, Number(prev.StudentCount || 0) - 1);
        return { ...prev, StudentCount: nextCount };
      });
      showToast('Đã xóa học sinh khỏi lớp.', 'success');
      setShowRemoveModal(false);
      setSelectedStudent(null);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Không thể xóa học sinh khỏi lớp.';
      showToast(msg, 'error');
    } finally {
      setRemovingStudentId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('TeacherClassrooms', { user })}>
          <MaterialIcons name="arrow-back" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Chi tiết lớp học</Text>
          <Text style={styles.headerSubtitle}>Quản lý học sinh</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tên lớp học</Text>
            <View style={styles.infoInputBlock}>
              <Text style={styles.infoInputText}>{classroom?.ClassName || '--'}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[styles.infoRow, { flex: 1 }]}>
              <Text style={styles.infoLabel}>Mã tham gia</Text>
              <View style={[styles.infoInputBlock, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                <MaterialIcons name="vpn-key" size={16} color={COLORS.primary} />
                <Text style={[styles.infoInputText, { color: COLORS.primary, fontWeight: '700' }]}>
                  {classroom?.JoinCode || '--'}
                </Text>
              </View>
            </View>

            <View style={[styles.infoRow, { flex: 1 }]}>
              <Text style={styles.infoLabel}>Sĩ số</Text>
              <View style={[styles.infoInputBlock, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                <MaterialIcons name="people" size={16} color={COLORS.onSurfaceVariant} />
                <Text style={styles.infoInputText}>
                  {classroom?.StudentCount ?? students.length} học sinh
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.listHeaderRow}>
          <Text style={styles.listTitle}>Danh sách học sinh</Text>
          <Text style={styles.listCount}>Tổng: {students.length}</Text>
        </View>

        <View style={styles.listSection}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Đang tải danh sách học sinh...</Text>
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : students.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="person-off" size={40} color="#727785" />
              <Text style={styles.emptyStateText}>Lớp hiện chưa có học sinh.</Text>
            </View>
          ) : filteredStudents.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="search-off" size={40} color="#727785" />
              <Text style={styles.emptyStateText}>
                Không tìm thấy học sinh theo tên hoặc email.
              </Text>
            </View>
          ) : (
            filteredStudents.map((student) => {
              const isRemoving = removingStudentId === student.Id;
              return (
                <View key={student.Id} style={styles.card}>
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

                  <TouchableOpacity
                    onPress={() => onOpenRemoveStudentModal(student)}
                    disabled={isRemoving}
                    style={styles.deleteButton}
                  >
                    {isRemoving ? (
                      <ActivityIndicator size="small" color="#B42318" />
                    ) : (
                      <>
                        <MaterialIcons name="delete-outline" size={16} color="#B42318" />
                        <Text style={styles.deleteButtonText}>Xóa</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
            );
          })
        )}
        </View>
      </ScrollView>

      <Modal
        visible={showRemoveModal}
        transparent
        animationType="fade"
        onRequestClose={onCloseRemoveStudentModal}
      >
        <Pressable
          className="flex-1 items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={onCloseRemoveStudentModal}
        >
          <Pressable
            className="w-full max-w-md p-5 bg-surface-container-lowest rounded-3xl overflow-hidden"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="flex-row items-center mb-3">
              <View className="w-12 h-12 rounded-2xl bg-red-50 items-center justify-center mr-3">
                <MaterialIcons name="delete-outline" size={24} color="#B42318" />
              </View>
              <Text className="text-lg font-bold text-on-surface">Xóa học sinh</Text>
            </View>

            <Text className="text-on-surface-variant leading-5 mb-5">
              Bạn có chắc muốn xóa {selectedStudent?.FullName ? `"${selectedStudent.FullName}"` : 'học sinh này'} khỏi lớp không?
            </Text>

            <View className="flex-row items-center justify-end gap-2">
              <TouchableOpacity
                onPress={onCloseRemoveStudentModal}
                disabled={Boolean(removingStudentId)}
                className="h-11 px-4 rounded-xl bg-surface-container-high items-center justify-center"
              >
                <Text className="text-on-surface font-semibold">Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onRemoveStudent}
                disabled={Boolean(removingStudentId)}
                className="h-11 px-4 rounded-xl bg-red-600 items-center justify-center flex-row"
              >
                {removingStudentId ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="delete" size={16} color="#FFFFFF" />
                    <Text className="text-white font-bold ml-1">Xóa</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

export default ClassroomManagementScreen;

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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceContainerLow,
    borderWidth: 1,
    borderColor: COLORS.outlineVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
