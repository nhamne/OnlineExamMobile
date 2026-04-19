import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import TeacherScreenShell from '../../components/TeacherScreenShell';
import { useToast } from '../../context/ToastContext';
import { getTeacherClassrooms } from '../../services/authService';

const ClassScreen = ({ route, navigation }) => {
  const { showToast } = useToast();
  const user = route?.params?.user || null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [teacher, setTeacher] = useState(null);
  const [classrooms, setClassrooms] = useState([]);
  const [searchText, setSearchText] = useState('');

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
      setClassrooms(Array.isArray(data?.classrooms) ? data.classrooms : []);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const filteredClassrooms = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return classrooms.filter((item) => {
      const haystack = `${item.ClassName || ''} ${item.JoinCode || ''} ${item.TeacherName || ''} ${item.TeacherEmail || ''}`;
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
    showToast(`Lớp: ${item.ClassName}`, 'info');
  };

  const onCopyJoinCode = async (joinCode) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(joinCode);
        showToast('Đã sao chép mã tham gia.', 'success');
        return;
      }
    } catch (_error) {
      // Fallback handled below.
    }

    showToast(`Mã tham gia: ${joinCode}`, 'info');
  };

  const onSelectBottomNav = (item) => {
    if (item.key === 'classes') {
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
      upcomingCount={0}
      initials={teacherInitials}
      onPressAvatar={() => navigation.replace('TeacherDashboard', { user, initialTab: 'profile' })}
    >
      <ScrollView
        className="flex-1 px-4 md:px-6 pt-5"
        style={{ minHeight: 0 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <View className="mb-6 mt-4 flex-col items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-2xl font-bold text-primary tracking-tight">Danh sách lớp học</Text>
            <Text className="text-on-surface-variant font-medium text-base mt-2">
              Tổng số lớp học: {filteredClassrooms.length}
            </Text>
          </View>

          <TouchableOpacity className="w-full bg-primary mt-1 py-3 px-4 rounded-xl flex-row items-center justify-center gap-2 shadow-md shadow-primary/20 active:opacity-80">
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
            filteredClassrooms.map((item) => {
              return (
                <View
                  key={item.Id}
                  style={ambientShadow}
                  className="mb-4 bg-surface-container-lowest rounded-3xl overflow-hidden"
                >
                  <View className="h-28 py-4 bg-primary items-center justify-center">
                    <MaterialIcons name="school" size={60} color="#FFFFFF" />
                  </View>

                  <View className="p-6">
                    <Text className="text-4xl font-bold text-on-surface" numberOfLines={2}>
                      {item.ClassName}
                    </Text>
                    <Text className="text-on-surface-variant text-sm mt-2">
                      Ngày tạo: {formatDate(item.CreatedAt)}
                    </Text>

                    {item.JoinCode ? (
                      <View className="mt-5 bg-surface-container-high rounded-2xl px-4 py-4 flex-row items-center justify-between">
                        <View className="flex-1 pr-3">
                          <Text className="text-xs tracking-[3px] uppercase font-bold text-on-surface-variant">
                            Mã tham gia
                          </Text>
                          <Text className="text-primary text-lg font-black mt-1" numberOfLines={1}>
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
                </View>
              );
            })
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
    </TeacherScreenShell>
  );
};

export default ClassScreen;