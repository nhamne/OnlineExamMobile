import React, { useMemo } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import TeacherScreenShell from '../../components/TeacherScreenShell';
import { clearAuthSession } from '../../services/authSession';
import { useToast } from '../../context/ToastContext';

const bottomNavItems = [
  { key: 'home', label: 'Trang chủ', shortLabel: 'Home', icon: 'home' },
  { key: 'classes', label: 'Lớp học', shortLabel: 'Classes', icon: 'groups' },
  { key: 'exams', label: 'Đề thi', shortLabel: 'Exams', icon: 'description' },
  { key: 'sessions', label: 'Ca thi', shortLabel: 'Sessions', icon: 'event' },
  { key: 'reports', label: 'Báo cáo', shortLabel: 'Reports', icon: 'bar-chart' },
];

const TeacherProfileScreen = ({ route, navigation }) => {
  const { showToast } = useToast();
  const user = route?.params?.user || null;

  const initials = useMemo(() => {
    const fullName = user?.fullName || '';
    if (!fullName.trim()) return 'GV';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[parts.length - 2][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }, [user?.fullName]);

  const onLogout = () => {
    clearAuthSession();
    showToast('Bạn đã đăng xuất.', 'info');
    navigation.replace('Login');
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
      bottomNavItems={bottomNavItems}
      activeKey="__profile__"
      onSelectBottomNav={onSelectBottomNav}
      searchText=""
      onChangeSearch={() => {}}
      searchPlaceholder="Tìm kiếm..."
      upcomingCount={0}
      initials={initials}
      onPressAvatar={() => {}}
    >
      <ScrollView className="flex-1 px-8" contentContainerStyle={{ paddingTop: 16, paddingBottom: 28 }}>
        <View className="mt-2 mb-5">
          <Text className="text-primary text-2xl font-bold tracking-tight mb-1">Thông tin tài khoản</Text>
          
        </View>

        {!user ? (
          <View className="items-center justify-center py-10">
            <ActivityIndicator size="large" color="#005bbf" />
            <Text className="mt-3 text-on-surface-variant">Không tìm thấy dữ liệu tài khoản.</Text>
          </View>
        ) : (
          <View className="bg-surface-container-lowest rounded-3xl p-5" style={{ borderWidth: 1, borderColor: '#c1c6d64d' }}>
            <View className="flex-row items-center">
              <View className="w-16 h-16 rounded-full bg-primary items-center justify-center mr-4">
                <Text className="text-white font-bold text-xl">{initials}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xl font-bold text-on-surface">{user.fullName || '--'}</Text>
                <Text className="text-sm text-on-surface-variant mt-1">{user.email || '--'}</Text>
                <Text className="text-xs text-on-surface-variant mt-1">Vai trò: Giáo viên</Text>
              </View>
            </View>

            <View className="mt-5 rounded-2xl p-4" style={{ backgroundColor: '#eef2ff' }}>
              <Text className="text-xs uppercase font-bold text-on-surface-variant mb-2">Thông tin hiển thị</Text>
              <Text className="text-sm text-on-surface mt-1">Mã tài khoản: {user.id || '--'}</Text>
              <Text className="text-sm text-on-surface mt-1">Họ và tên: {user.fullName || '--'}</Text>
              <Text className="text-sm text-on-surface mt-1">Email: {user.email || '--'}</Text>
            </View>

            <TouchableOpacity
              className="mt-5 bg-primary rounded-xl h-11 items-center justify-center flex-row"
              onPress={onLogout}
            >
              <MaterialIcons name="logout" size={18} color="#FFFFFF" />
              <Text className="text-white font-bold ml-2">Đăng xuất</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </TeacherScreenShell>
  );
};

export default TeacherProfileScreen;