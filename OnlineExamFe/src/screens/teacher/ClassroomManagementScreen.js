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
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import TeacherScreenShell from '../../components/TeacherScreenShell';
import { useToast } from '../../context/ToastContext';
import {
  getTeacherClassroomDetail,
  removeStudentFromTeacherClassroom,
} from '../../services/authService';

const ClassroomManagementScreen = ({ route, navigation }) => {
  const { showToast } = useToast();
  const user = route?.params?.user || null;
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

  const classroomId = classroomParam?.Id || classroomParam?.id || null;

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

  const onSelectBottomNav = (item) => {
    if (item.key === 'classes') {
      navigation.replace('TeacherClassrooms', { user });
      return;
    }

    if (item.key === 'sessions') {
      navigation.replace('TeacherSessions', { user });
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
        { key: 'home', label: 'Tổng quan', shortLabel: 'Home', icon: 'home' },
        { key: 'classes', label: 'Lớp học', shortLabel: 'Classes', icon: 'groups' },
        { key: 'exams', label: 'Đề thi', shortLabel: 'Exams', icon: 'description' },
        { key: 'sessions', label: 'Ca thi', shortLabel: 'Sessions', icon: 'event' },
      ]}
      activeKey="classes"
      onSelectBottomNav={onSelectBottomNav}
      searchText={searchText}
      onChangeSearch={setSearchText}
      searchPlaceholder="Tìm kiếm học sinh theo tên hoặc email..."
      upcomingCount={0}
      initials={teacherInitials}
      onPressAvatar={() => navigation.replace('TeacherDashboard', { user, initialTab: 'profile' })}
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

        <View className="bg-surface-container-lowest rounded-3xl p-5 mb-4" style={{ borderWidth: 1, borderColor: '#c1c6d64d' }}>
          <Text className="text-xs uppercase tracking-wide font-bold text-on-surface-variant mb-2">
            Thông tin lớp học
          </Text>
          <Text className="text-2xl font-bold text-on-surface">{classroom?.ClassName || '--'}</Text>

          <View className="mt-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <MaterialIcons name="vpn-key" size={18} color="#1F2937" />
              <Text className="text-on-surface ml-2 font-semibold">Mã: {classroom?.JoinCode || '--'}</Text>
            </View>
            <View className="flex-row items-center">
              <MaterialIcons name="people-outline" size={18} color="#1F2937" />
              <Text className="text-on-surface ml-2 font-semibold">
                {classroom?.StudentCount ?? students.length} học sinh
              </Text>
            </View>
          </View>
        </View>

        <View className="mb-3">
          <Text className="text-xl font-bold text-on-surface">Danh sách học sinh</Text>
        </View>

        {loading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color="#005bbf" />
            <Text className="mt-3 text-on-surface-variant">Đang tải danh sách học sinh...</Text>
          </View>
        ) : error ? (
          <View className="rounded-lg bg-red-100 px-3 py-2 mb-4 border border-red-200">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        ) : students.length === 0 ? (
          <View className="border-2 border-dashed border-outline-variant rounded-xl items-center justify-center p-8 bg-surface-container-low">
            <MaterialIcons name="person-off" size={40} color="#727785" />
            <Text className="text-on-surface-variant font-medium mt-3 text-base">Lớp hiện chưa có học sinh.</Text>
          </View>
        ) : filteredStudents.length === 0 ? (
          <View className="border-2 border-dashed border-outline-variant rounded-xl items-center justify-center p-8 bg-surface-container-low">
            <MaterialIcons name="search-off" size={40} color="#727785" />
            <Text className="text-on-surface-variant font-medium mt-3 text-base">
              Không tìm thấy học sinh theo tên hoặc email.
            </Text>
          </View>
        ) : (
          filteredStudents.map((student) => {
            const isRemoving = removingStudentId === student.Id;
            return (
              <View
                key={student.Id}
                className="mb-3 rounded-2xl bg-surface-container-lowest px-4 py-3 flex-row items-center justify-between"
                style={{ borderWidth: 1, borderColor: '#c1c6d64d' }}
              >
                <View className="flex-1 pr-3">
                  <Text className="text-on-surface text-base font-bold" numberOfLines={1}>
                    {student.FullName || 'Không rõ tên'}
                  </Text>
                  <Text className="text-on-surface-variant text-sm mt-1" numberOfLines={1}>
                    {student.Email || '--'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => onOpenRemoveStudentModal(student)}
                  disabled={isRemoving}
                  className="h-10 rounded-xl px-3 bg-red-50 border border-red-100 flex-row items-center justify-center"
                >
                  {isRemoving ? (
                    <ActivityIndicator size="small" color="#B42318" />
                  ) : (
                    <>
                      <MaterialIcons name="delete-outline" size={16} color="#B42318" />
                      <Text className="text-red-700 font-bold ml-1">Xóa</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            );
          })
        )}
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
    </TeacherScreenShell>
  );
};

export default ClassroomManagementScreen;
