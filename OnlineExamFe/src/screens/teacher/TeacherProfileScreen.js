import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import TeacherScreenShell from '../../components/TeacherScreenShell';
import { clearAuthSession } from '../../services/authSession';
import { useToast } from '../../context/ToastContext';
import { updateUserProfile, changeUserPassword } from '../../services/authService';
import {
  disableBiometricLogin,
  enableBiometricLogin,
  getBiometricInfo,
} from '../../services/biometricAuth';

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

  const [editVisible, setEditVisible] = useState(false);
  const [editName, setEditName] = useState(user?.fullName || '');
  const [editEmail, setEditEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);

  const [changeVisible, setChangeVisible] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [changing, setChanging] = useState(false);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSaving, setBiometricSaving] = useState(false);

  const initials = useMemo(() => {
    const fullName = user?.fullName || '';
    if (!fullName.trim()) return 'GV';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[parts.length - 2][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
  }, [user?.fullName]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        try {
          const info = await getBiometricInfo('teacher');
          if (!active) return;
          setBiometricAvailable(info.available);
          setBiometricEnabled(info.enabled);
        } catch {
          if (!active) return;
          setBiometricAvailable(false);
          setBiometricEnabled(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

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

  const handleToggleBiometric = async () => {
    if (Platform.OS === 'web') {
      showToast('Đăng nhập bằng vân tay chỉ hỗ trợ trên điện thoại.', 'warning');
      return;
    }

    if (!user || biometricSaving) return;

    setBiometricSaving(true);
    try {
      if (biometricEnabled) {
        await disableBiometricLogin('teacher');
        setBiometricEnabled(false);
        showToast('Đã tắt đăng nhập bằng vân tay cho giáo viên.', 'success');
        return;
      }

      const info = await getBiometricInfo('teacher');
      if (!info.available) {
        setBiometricAvailable(false);
        showToast('Thiết bị này chưa sẵn sàng cho xác thực sinh trắc học.', 'warning');
        return;
      }

      await enableBiometricLogin({ ...user, role: 'teacher' });
      setBiometricAvailable(true);
      setBiometricEnabled(true);
      showToast('Đã bật đăng nhập bằng vân tay cho giáo viên.', 'success');
    } catch {
      showToast('Không thể cập nhật đăng nhập bằng vân tay.', 'error');
    } finally {
      setBiometricSaving(false);
    }
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
          <View
            className="bg-surface-container-lowest rounded-3xl p-5"
            style={{ borderWidth: 1, borderColor: '#c1c6d64d' }}
          >
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
              <Text className="text-sm text-on-surface mt-1">Họ và tên: {user.fullName || '--'}</Text>
              <Text className="text-sm text-on-surface mt-1">Email: {user.email || '--'}</Text>
            </View>

            <View className="mt-4 rounded-2xl border border-slate-200 px-4 py-4 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 pr-3">
                <MaterialIcons name="fingerprint" size={22} color="#64748B" />
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-bold text-on-surface">Đăng nhập bằng vân tay</Text>
                  <Text className="text-xs text-on-surface-variant mt-1">
                    {Platform.OS === 'web'
                      ? 'Chỉ hỗ trợ trên điện thoại'
                      : biometricAvailable
                        ? 'Bật để dùng icon vân tay ở màn đăng nhập'
                        : 'Thiết bị chưa sẵn sàng cho sinh trắc học'}
                  </Text>
                </View>
              </View>
              <View className="items-end justify-center" style={{ width: 52, minHeight: 32 }}>
                {biometricSaving ? (
                  <ActivityIndicator size="small" color={biometricEnabled ? '#15803D' : '#64748B'} />
                ) : (
                  <Switch
                    value={biometricEnabled}
                    onValueChange={handleToggleBiometric}
                    trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
                    thumbColor={biometricEnabled ? '#005BBF' : '#F8FAFC'}
                    ios_backgroundColor="#CBD5E1"
                  />
                )}
              </View>
            </View>

            <View className="mt-4 flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-primary rounded-xl h-11 items-center justify-center flex-row"
                onPress={() => setEditVisible(true)}
              >
                <MaterialIcons name="edit" size={18} color="#FFFFFF" />
                <Text className="text-white font-bold ml-2">Chỉnh sửa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-surface-container-high rounded-xl h-11 items-center justify-center flex-row border"
                onPress={() => setChangeVisible(true)}
              >
                <MaterialIcons name="vpn-key" size={16} color="#1F2937" />
                <Text className="text-on-surface font-bold ml-2">Đổi mật khẩu</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              className="mt-4 bg-red-50 rounded-2xl h-12 items-center justify-center border border-red-100"
              onPress={onLogout}
            >
              <Text className="text-red-600 font-black text-base">Đăng xuất</Text>
            </TouchableOpacity>

            <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
              <View className="flex-1 bg-black/40 items-center justify-center px-4">
                <View className="w-full max-w-[420px] bg-white rounded-3xl p-5 border border-slate-100">
                  <Text className="text-xl font-black text-on-surface mb-2">Chỉnh sửa thông tin</Text>
                  <TextInput
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-on-surface font-medium mb-3"
                    value={editName}
                    onChangeText={setEditName}
                    placeholder="Họ và tên"
                  />
                  <TextInput
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-on-surface font-medium mb-4"
                    value={editEmail}
                    onChangeText={setEditEmail}
                    placeholder="Email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      className="flex-1 h-12 rounded-xl items-center justify-center bg-slate-100"
                      onPress={() => setEditVisible(false)}
                      disabled={saving}
                    >
                      <Text className="text-on-surface font-bold">Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`flex-1 h-12 rounded-xl items-center justify-center bg-primary ${saving ? 'opacity-70' : ''}`}
                      onPress={async () => {
                        if (!editName.trim() || !editEmail.trim()) {
                          showToast('Vui lòng điền tên và email.', 'warning');
                          return;
                        }
                        setSaving(true);
                        try {
                          const res = await updateUserProfile(user?.id, {
                            fullName: editName.trim(),
                            email: editEmail.trim(),
                          });
                          showToast(res?.message || 'Cập nhật thành công', 'success');
                          navigation.setParams({ user: res?.user });
                          setEditVisible(false);
                        } catch (err) {
                          showToast(err?.response?.data?.message || err.message || 'Lỗi khi cập nhật.', 'error');
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                    >
                      {saving ? <ActivityIndicator color="#FFF" /> : <Text className="text-white font-black">LƯU</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            <Modal visible={changeVisible} transparent animationType="fade" onRequestClose={() => setChangeVisible(false)}>
              <View className="flex-1 bg-black/40 items-center justify-center px-4">
                <View className="w-full max-w-[420px] bg-white rounded-3xl p-5 border border-slate-100">
                  <Text className="text-xl font-black text-on-surface mb-2">Đổi mật khẩu</Text>
                  <TextInput
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-on-surface font-medium mb-3"
                    value={currentPwd}
                    onChangeText={setCurrentPwd}
                    placeholder="Mật khẩu hiện tại"
                    secureTextEntry
                  />
                  <TextInput
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-on-surface font-medium mb-3"
                    value={newPwd}
                    onChangeText={setNewPwd}
                    placeholder="Mật khẩu mới"
                    secureTextEntry
                  />
                  <TextInput
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 h-12 text-on-surface font-medium mb-4"
                    value={confirmPwd}
                    onChangeText={setConfirmPwd}
                    placeholder="Xác nhận mật khẩu mới"
                    secureTextEntry
                  />
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      className="flex-1 h-12 rounded-xl items-center justify-center bg-slate-100"
                      onPress={() => setChangeVisible(false)}
                      disabled={changing}
                    >
                      <Text className="text-on-surface font-bold">Hủy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`flex-1 h-12 rounded-xl items-center justify-center bg-primary ${changing ? 'opacity-70' : ''}`}
                      onPress={async () => {
                        if (!currentPwd || !newPwd) {
                          showToast('Vui lòng nhập đầy đủ thông tin.', 'warning');
                          return;
                        }
                        if (newPwd !== confirmPwd) {
                          showToast('Mật khẩu xác nhận không khớp.', 'warning');
                          return;
                        }
                        setChanging(true);
                        try {
                          await changeUserPassword(user?.id, currentPwd, newPwd);
                          showToast('Đổi mật khẩu thành công.', 'success');
                          setChangeVisible(false);
                          setCurrentPwd('');
                          setNewPwd('');
                          setConfirmPwd('');
                        } catch (err) {
                          showToast(err?.response?.data?.message || err.message || 'Lỗi khi đổi mật khẩu.', 'error');
                        } finally {
                          setChanging(false);
                        }
                      }}
                      disabled={changing}
                    >
                      {changing ? <ActivityIndicator color="#FFF" /> : <Text className="text-white font-black">ĐỔI</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        )}
      </ScrollView>
    </TeacherScreenShell>
  );
};

export default TeacherProfileScreen;
