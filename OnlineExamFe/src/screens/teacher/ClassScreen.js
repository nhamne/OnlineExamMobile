import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
  createTeacherClassroom,
  deleteTeacherClassroom,
  getTeacherClassrooms,
  updateTeacherClassroom,
} from '../../services/authService';

const ClassScreen = ({ route, navigation }) => {
  const { showToast } = useToast();
  const user = route?.params?.user || null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [teacher, setTeacher] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [classNameInput, setClassNameInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [showClassActionModal, setShowClassActionModal] = useState(false);
  const [showEditClassModal, setShowEditClassModal] = useState(false);
  const [showDeleteClassModal, setShowDeleteClassModal] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [editClassNameInput, setEditClassNameInput] = useState('');
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const bodyOpacity = React.useRef(new Animated.Value(0.94)).current;

  const ambientShadow = {
    shadowColor: '#191c23',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 32,
    elevation: 4,
  };

  const teacherInitials = useMemo(() => {
    const fullName = teacher?.fullName || user?.fullName || '';
    if (!fullName.trim()) return 'GV';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[parts.length - 2][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }, [teacher?.fullName, user?.fullName]);

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setError('Không tìm thấy thông tin tài khoản giáo viên.');
      return;
    }

    try {
      setError('');
      const data = await getTeacherClassrooms(user.id);
      setTeacher(data?.teacher || null);
      setClassrooms(
        Array.isArray(data?.classrooms)
          ? data.classrooms.filter((item) => !item?.IsDeleted)
          : []
      );
    } catch (err) {
      setError(err?.response?.data?.message || 'Không tải được danh sách lớp học.');
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
  }, [bodyOpacity]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const filteredClassrooms = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return classrooms.filter((item) => {
      const haystack = `${item.ClassName || ''} ${item.JoinCode || ''}`;
      return haystack.toLowerCase().includes(keyword);
    });
  }, [classrooms, searchText]);

  const formatDate = (value) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const onPressClassItem = (item) => {
    if (item?.IsDeleted) {
      showToast('Lớp học này đã bị xóa.', 'info');
      return;
    }

    navigation.navigate('TeacherClassroomManagement', {
      user,
      classroom: item,
    });
  };

  const onCopyJoinCode = async (joinCode) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(joinCode);
        showToast('Đã sao chép mã tham gia.', 'success');
        return;
      }
    } catch (_error) {
      // ignore
    }

    showToast(`Mã tham gia: ${joinCode}`, 'info');
  };

  const onSelectBottomNav = (item) => {
    if (item.key === 'classes') {
      return;
    }

    if (item.key === 'sessions') {
      navigation.replace('TeacherSessions', { user: teacher || user });
      return;
    }

    navigation.replace('TeacherDashboard', {
      user,
      initialTab: item.key,
    });
  };

  const onOpenCreateModal = () => {
    setClassNameInput('');
    setShowCreateModal(true);
  };

  const onLongPressClassItem = (item) => {
    setSelectedClassroom(item);
    setShowClassActionModal(true);
  };

  const onCloseClassActionModal = () => {
    if (updating || deleting) return;
    setShowClassActionModal(false);
  };

  const onOpenEditClassModal = () => {
    if (!selectedClassroom) return;
    setEditClassNameInput(selectedClassroom.ClassName || '');
    setShowClassActionModal(false);
    setShowEditClassModal(true);
  };

  const onCloseEditClassModal = () => {
    if (updating) return;
    setShowEditClassModal(false);
    setEditClassNameInput('');
  };

  const onOpenDeleteClassModal = () => {
    if (!selectedClassroom) return;
    setShowClassActionModal(false);
    setShowDeleteClassModal(true);
  };

  const onCloseDeleteClassModal = () => {
    if (deleting) return;
    setShowDeleteClassModal(false);
  };

  const onCloseCreateModal = () => {
    if (creating) return;
    setShowCreateModal(false);
    setClassNameInput('');
  };

  const onCreateClassroom = async () => {
    const className = classNameInput.trim();
    if (!className) {
      showToast('Vui lòng nhập tên lớp học.', 'error');
      return;
    }

    if (!user?.id) {
      showToast('Không tìm thấy thông tin giáo viên.', 'error');
      return;
    }

    try {
      setCreating(true);
      const response = await createTeacherClassroom(user.id, { className });
      const created = response?.classroom || null;

      if (created) {
        setClassrooms((prev) => [created, ...prev]);
      } else {
        await loadData();
      }

      showToast('Tạo lớp học thành công.', 'success');
      setShowCreateModal(false);
      setClassNameInput('');
    } catch (err) {
      let errorMsg = 'Không thể tạo lớp học.';
      if (err?.response?.data?.message && typeof err.response.data.message === 'string') {
        errorMsg = err.response.data.message;
      } else if (err?.response?.status === 404) {
        errorMsg = 'API chưa khởi chạy do server cũ. Vui lòng restart tắt/bật lại Backend!';
      }
      showToast(errorMsg, 'error');
    } finally {
      setCreating(false);
    }
  };

  const onUpdateClassroom = async () => {
    const className = editClassNameInput.trim();
    if (!className) {
      showToast('Vui lòng nhập tên lớp học.', 'error');
      return;
    }

    if (!user?.id || !selectedClassroom?.Id) {
      showToast('Không tìm thấy thông tin lớp học để cập nhật.', 'error');
      return;
    }

    try {
      setUpdating(true);
      const response = await updateTeacherClassroom(user.id, selectedClassroom.Id, { className });
      const updated = response?.classroom || null;

      if (updated) {
        setClassrooms((prev) => prev.map((item) => (item.Id === updated.Id ? { ...item, ...updated } : item)));
      } else {
        await loadData();
      }

      showToast('Cập nhật lớp học thành công.', 'success');
      setShowEditClassModal(false);
      setEditClassNameInput('');
      setSelectedClassroom((prev) => (prev ? { ...prev, ClassName: className } : prev));
    } catch (err) {
      const errorMsg = err?.response?.data?.message || 'Không thể cập nhật lớp học.';
      showToast(errorMsg, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const onDeleteClassroom = async () => {
    if (!user?.id || !selectedClassroom?.Id) {
      showToast('Không tìm thấy lớp học để xóa.', 'error');
      return;
    }

    try {
      setDeleting(true);
      await deleteTeacherClassroom(user.id, selectedClassroom.Id);
      setClassrooms((prev) => prev.filter((item) => item.Id !== selectedClassroom.Id));
      showToast('Xóa lớp học thành công.', 'success');
      setShowDeleteClassModal(false);
      setSelectedClassroom(null);
    } catch (err) {
      const errorMsg = err?.response?.data?.message || 'Không thể xóa lớp học.';
      showToast(errorMsg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <TeacherScreenShell
      bottomNavItems={[
        { key: 'home', label: 'Tổng quan', shortLabel: 'Home', icon: 'home' },
        { key: 'classes', label: 'Lớp học', shortLabel: 'Classes', icon: 'groups' },
        { key: 'exams', label: 'Đề thi', shortLabel: 'Exams', icon: 'description' },
        { key: 'sessions', label: 'Ca thi', shortLabel: 'Sessions', icon: 'event' },
        { key: 'reports', label: 'Báo cáo', shortLabel: 'Reports', icon: 'bar-chart' },
      ]}
      activeKey="classes"
      onSelectBottomNav={onSelectBottomNav}
      searchText={searchText}
      onChangeSearch={setSearchText}
      upcomingCount={0}
      initials={teacherInitials}
      onPressAvatar={() => navigation.navigate('TeacherProfile', { user })}
    >
      <Animated.View style={{ flex: 1, opacity: bodyOpacity }}>
        <ScrollView
          className="flex-1 px-4"
          style={{ minHeight: 0 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 28 }}
        >
          <View className="mb-6 mt-6 flex-col items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-primary tracking-tight">Danh sách lớp học</Text>
            <Text className="text-on-surface-variant font-medium text-base mt-2">
              Tổng số lớp học: {filteredClassrooms.length}
            </Text>
          </View>

          <TouchableOpacity
            className="w-full bg-primary mt-1 py-3 px-4 rounded-xl flex-row items-center justify-center gap-2"
            onPress={onOpenCreateModal}
          >
            <MaterialIcons name="add" size={22} color="white" />
            <Text className="text-white font-bold text-sm">Tạo lớp học mới</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator size="large" color="#005bbf" />
            <Text className="mt-3 text-on-surface-variant">Đang tải danh sách lớp học...</Text>
          </View>
        ) : error ? (
          <View className="rounded-lg bg-red-100 px-3 py-2 mb-4 border border-red-200">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        ) : null}

          <View className="flex-col">
          {filteredClassrooms.length > 0 ? (
            filteredClassrooms.map((item) => (
              <Pressable
                key={item.Id}
                style={ambientShadow}
                className="mb-4 bg-surface-container-lowest rounded-3xl overflow-hidden"
                delayLongPress={220}
                onLongPress={() => onLongPressClassItem(item)}
                onPress={() => onPressClassItem(item)}
              >
                <View className="h-28 py-4 bg-primary items-center justify-center">
                  <MaterialIcons name="school" size={60} color="#FFFFFF" />
                </View>

                <View className="p-6">
                  <Text className="text-xl font-bold text-on-surface" numberOfLines={2}>
                    {item.ClassName}
                  </Text>
                  <Text className="text-on-surface-variant text-sm mt-2">
                    Ngày tạo: {formatDate(item.CreatedAt)}
                  </Text>

                  {item.JoinCode ? (
                    <View className="mt-4 bg-surface-container-high rounded-2xl px-4 py-4 flex-row items-center justify-between">
                      <View className="flex-1 pr-3">
                        <Text className="text-xs uppercase font-bold text-on-surface-variant">
                          Mã tham gia
                        </Text>
                        <Text className="text-primary text-sm font-black mt-1" numberOfLines={1}>
                          {item.JoinCode}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => onCopyJoinCode(item.JoinCode)}
                        className="w-8 h-8 rounded-xl bg-surface-container-lowest items-center justify-center"
                      >
                        <MaterialIcons name="content-copy" size={16} color="#0B63C8" />
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <View className="mt-4 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                      <MaterialIcons name="people-outline" size={22} color="#1F2937" />
                      <Text className="text-on-surface text-[13px] font-semibold ml-2">
                        {item.StudentCount ?? 0} sinh viên
                      </Text>
                    </View>
                    <TouchableOpacity
                      className="flex-row items-center gap-2"
                      onPress={() => onPressClassItem(item)}
                    >
                      <Text className="text-primary text-sm font-bold">Quản lý</Text>
                      <MaterialIcons name="arrow-forward" size={16} color="#0B63C8" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Pressable>
            ))
          ) : (
            <View className="border-2 border-dashed border-outline-variant rounded-xl flex-col items-center justify-center p-8 mt-2 mb-8 bg-surface-container-low">
              <MaterialIcons name="school" size={40} color="#727785" />
              <Text className="text-on-surface-variant font-medium mt-3 text-base">
                Không có lớp học nào phù hợp
              </Text>
            </View>
          )}
          </View>
        </ScrollView>
      </Animated.View>

      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={onCloseCreateModal}>
        <Pressable
          className="flex-1 items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={onCloseCreateModal}
        >
          <Pressable
            className="w-full max-w-2xl p-4 bg-surface-container-lowest rounded-3xl overflow-hidden"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="pb-4 relative">
              <TouchableOpacity
                onPress={onCloseCreateModal}
                disabled={creating}
                className="absolute right-0 top-2 z-10 w-10 h-10 rounded-full bg-surface-container-high items-center justify-center"
              >
                <MaterialIcons name="close" size={22} color="#1F2937" />
              </TouchableOpacity>

              <View className="flex-row items-center px-4 pt-4">
                <View className="w-12 h-12 rounded-2xl bg-primary items-center justify-center mr-4">
                  <MaterialIcons name="add-home-work" size={20} color="#FFFFFF" />
                </View>
                <Text className="text-xl font-bold text-on-surface">Tạo lớp học mới</Text>
              </View>
              <Text className="text-on-surface-variant text-sm text-center leading-4 mt-2">
                Nhập tên lớp học, hệ thống sẽ tự động sinh mã tham gia cho học sinh.
              </Text>
            </View>

            <View className="p-4 border-t" style={{ borderColor: '#c1c6d64d' }}>
              <Text className="text-xs uppercase font-bold text-on-surface-variant mb-3">
                Tên lớp học (bắt buộc)
              </Text>

              <TextInput
                value={classNameInput}
                onChangeText={setClassNameInput}
                placeholder="Ví dụ: Lập trình Web Nâng cao"
                placeholderTextColor="#9AA3B2"
                editable={!creating}
                className="h-12 rounded-2xl border-2 border-outline px-4 text-base text-on-surface bg-surface-container-lowest"
                onSubmitEditing={onCreateClassroom}
              />
            </View>

            <View className="px-4 " >
              <TouchableOpacity
                onPress={onCreateClassroom}
                disabled={creating}
                className="bg-primary rounded-2xl h-12 px-4 flex-row items-center justify-center gap-2"
              >
                {creating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="add" size={16} color="#FFFFFF" />
                    <Text className="text-white text-sm font-bold">Tạo lớp học</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showClassActionModal}
        transparent
        animationType="fade"
        onRequestClose={onCloseClassActionModal}
      >
        <Pressable
          className="flex-1 items-center justify-center px-6"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
          onPress={onCloseClassActionModal}
        >
          <Pressable
            className="w-full max-w-md rounded-3xl bg-surface-container-lowest p-4"
            onPress={(event) => event.stopPropagation()}
          >
            <Text className="text-base font-bold text-on-surface mb-3" numberOfLines={1}>
              {selectedClassroom?.ClassName || 'Lớp học'}
            </Text>

            <TouchableOpacity
              onPress={onOpenEditClassModal}
              className="h-12 rounded-2xl px-4 mb-2 bg-surface-container-high flex-row items-center"
            >
              <MaterialIcons name="edit" size={18} color="#0B63C8" />
              <Text className="text-on-surface font-semibold ml-3">Chỉnh sửa lớp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onOpenDeleteClassModal}
              className="h-12 rounded-2xl px-4 bg-red-50 border border-red-100 flex-row items-center"
            >
              <MaterialIcons name="delete-outline" size={18} color="#B42318" />
              <Text className="text-red-700 font-semibold ml-3">Xóa lớp</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showEditClassModal}
        transparent
        animationType="fade"
        onRequestClose={onCloseEditClassModal}
      >
        <Pressable
          className="flex-1 items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={onCloseEditClassModal}
        >
          <Pressable
            className="w-full max-w-2xl p-4 bg-surface-container-lowest rounded-3xl overflow-hidden"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="pb-4 relative">
              <TouchableOpacity
                onPress={onCloseEditClassModal}
                disabled={updating}
                className="absolute right-0 top-2 z-10 w-10 h-10 rounded-full bg-surface-container-high items-center justify-center"
              >
                <MaterialIcons name="close" size={22} color="#1F2937" />
              </TouchableOpacity>

              <View className="flex-row items-center px-4 pt-4">
                <View className="w-12 h-12 rounded-2xl bg-primary items-center justify-center mr-4">
                  <MaterialIcons name="edit" size={20} color="#FFFFFF" />
                </View>
                <Text className="text-xl font-bold text-on-surface">Chỉnh sửa lớp học</Text>
              </View>
              <Text className="text-on-surface-variant text-sm text-center leading-4 mt-2">
                Cập nhật tên lớp học của bạn.
              </Text>
            </View>

            <View className="p-4 border-t" style={{ borderColor: '#c1c6d64d' }}>
              <Text className="text-xs uppercase font-bold text-on-surface-variant mb-3">Tên lớp học mới</Text>
              <TextInput
                value={editClassNameInput}
                onChangeText={setEditClassNameInput}
                placeholder="Ví dụ: Lập trình Web Nâng cao"
                placeholderTextColor="#9AA3B2"
                editable={!updating}
                className="h-12 rounded-2xl border-2 border-outline px-4 text-base text-on-surface bg-surface-container-lowest"
                onSubmitEditing={onUpdateClassroom}
              />
            </View>

            <View className="px-4">
              <TouchableOpacity
                onPress={onUpdateClassroom}
                disabled={updating}
                className="bg-primary rounded-2xl h-12 px-4 flex-row items-center justify-center gap-2"
              >
                {updating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="save" size={16} color="#FFFFFF" />
                    <Text className="text-white text-sm font-bold">Lưu thay đổi</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showDeleteClassModal}
        transparent
        animationType="fade"
        onRequestClose={onCloseDeleteClassModal}
      >
        <Pressable
          className="flex-1 items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          onPress={onCloseDeleteClassModal}
        >
          <Pressable
            className="w-full max-w-md p-5 bg-surface-container-lowest rounded-3xl overflow-hidden"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="flex-row items-center mb-3">
              <View className="w-12 h-12 rounded-2xl bg-red-50 items-center justify-center mr-3">
                <MaterialIcons name="delete-outline" size={24} color="#B42318" />
              </View>
              <Text className="text-lg font-bold text-on-surface">Xóa lớp học</Text>
            </View>

            <Text className="text-on-surface-variant leading-5 mb-5">
              Bạn có chắc muốn xóa lớp {selectedClassroom?.ClassName ? `"${selectedClassroom.ClassName}"` : 'này'}?
            </Text>

            <View className="flex-row items-center justify-end gap-2">
              <TouchableOpacity
                onPress={onCloseDeleteClassModal}
                disabled={deleting}
                className="h-11 px-4 rounded-xl bg-surface-container-high items-center justify-center"
              >
                <Text className="text-on-surface font-semibold">Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onDeleteClassroom}
                disabled={deleting}
                className="h-11 px-4 rounded-xl bg-red-600 items-center justify-center flex-row"
              >
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="delete" size={16} color="#FFFFFF" />
                    <Text className="text-white font-bold ml-1">Xóa lớp</Text>
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

export default ClassScreen;