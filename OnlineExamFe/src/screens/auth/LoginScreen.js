import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { login } from '../../services/authService';
import { saveAuthSession } from '../../services/authSession';
import { authenticateBiometricLogin, getBiometricInfo } from '../../services/biometricAuth';
import RoleSegmentedControl from '../../components/RoleSegmentedControl';
import { useToast } from '../../context/ToastContext';

const webInputFixStyle = Platform.OS === 'web' ? { outlineWidth: 0 } : null;

const getRoleCopy = (role) => {
  if (role === 'teacher') {
    return {
      title: 'Đăng nhập giáo viên',
      subtitle: 'Quản lý lớp học, đề thi và tiến độ học tập từ bảng điều khiển của bạn.',
    };
  }

  return {
    title: 'Đăng nhập học sinh',
    subtitle: 'Truy cập lớp học, làm bài và theo dõi kết quả học tập của bạn.',
  };
};

const LoginScreen = ({ navigation }) => {
  const [role, setRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('vân tay');
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const { showToast } = useToast();

  useEffect(() => {
    slideAnim.setValue(18);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [role, slideAnim]);

  useFocusEffect(
    useCallback(() => {
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setRememberMe(false);
      return () => {};
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        try {
          const info = await getBiometricInfo(role);
          if (!active) return;
          setBiometricAvailable(info.available);
          setBiometricEnabled(info.available && info.enabled);
          setBiometricLabel(info.label || 'vân tay');
        } catch {
          if (!active) return;
          setBiometricAvailable(false);
          setBiometricEnabled(false);
          setBiometricLabel('vân tay');
        }
      })();

      return () => {
        active = false;
      };
    }, [role])
  );

  const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
  const roleCopy = getRoleCopy(role);

  const navigateAfterLogin = useCallback((user) => {
    if (user?.role === 'teacher') {
      navigation.replace('TeacherDashboard', { user });
      return;
    }

    navigation.replace('StudentDashboard', { user });
  }, [navigation]);

  const onBiometricLogin = async () => {
    if (Platform.OS === 'web') {
      showToast('Đăng nhập bằng vân tay chỉ hỗ trợ trên điện thoại.', 'warning');
      return;
    }

    if (!biometricAvailable) {
      showToast('Thiết bị này chưa sẵn sàng cho xác thực sinh trắc học.', 'warning');
      return;
    }

    if (!biometricEnabled) {
      setShowBiometricPrompt(true);
      return;
    }

    try {
      setBiometricLoading(true);
      const user = await authenticateBiometricLogin(role);
      saveAuthSession(user);
      showToast(`Đăng nhập bằng ${biometricLabel} thành công.`, 'success');
      await wait(150);
      navigateAfterLogin(user);
    } catch {
      showToast(`Không thể đăng nhập bằng ${biometricLabel}.`, 'error');
    } finally {
      setBiometricLoading(false);
    }
  };

  const onLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showToast('Vui lòng nhập email và mật khẩu.', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await login({
        email: email.trim(),
        password: password.trim(),
        role,
        rememberMe,
      });

      if (response?.user?.role === 'teacher') {
        saveAuthSession(response.user);
        showToast('Đăng nhập thành công. Chuyển tới dashboard giáo viên.', 'success');
        await wait(300);
        navigateAfterLogin(response.user);
      } else if (response?.user?.role === 'student') {
        saveAuthSession(response.user);
        showToast('Đăng nhập thành công. Chuyển tới dashboard học sinh.', 'success');
        await wait(300);
        navigateAfterLogin(response.user);
      } else {
        showToast('Role tài khoản không hợp lệ trong cơ sở dữ liệu.', 'error');
      }
    } catch (error) {
      showToast(error?.response?.data?.message || 'Không thể kết nối đến máy chủ.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      className="flex-1 bg-surface-container-low"
      style={Platform.OS === 'web' ? { minHeight: '100vh' } : {}}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ flex: 1 }} />
          <View className="flex-none bg-surface-container-lowest rounded-xl m-4 p-6 shadow-sm mb-4">
            <View className="flex-row items-center gap-2 mb-8">
              <MaterialIcons name="menu-book" size={32} color="#005bbf" />
              <Text className="text-xl font-black text-primary tracking-tighter">Online Exam</Text>
            </View>

            <RoleSegmentedControl value={role} onChange={setRole} />

            <Animated.View
              className="mb-8"
              style={{
                opacity: slideAnim.interpolate({ inputRange: [0, 18], outputRange: [1, 0.78] }),
                transform: [{ translateX: slideAnim }],
              }}
            >
              <Text className="text-3xl font-bold tracking-tight text-on-surface mb-2">
                {roleCopy.title}
              </Text>
              <Text className="text-on-surface-variant font-medium">{roleCopy.subtitle}</Text>
            </Animated.View>

            <Animated.View
              style={{
                opacity: slideAnim.interpolate({ inputRange: [0, 18], outputRange: [1, 0.84] }),
                transform: [{ translateX: slideAnim }],
              }}
            >
              <View className="space-y-2 mb-4">
                <Text className="mt-4 text-sm font-semibold tracking-wide text-on-surface-variant mb-1">
                  Email
                </Text>
                <View
                  className="flex-row items-center bg-surface-container-highest rounded-xl px-4 h-14 border"
                  style={{ borderColor: '#c1c6d680' }}
                >
                  <MaterialIcons name="mail-outline" size={20} color="#727785" />
                  <TextInput
                    className="flex-1 ml-3 text-on-surface font-body text-base"
                    placeholder="email@vi-du.com"
                    placeholderTextColor="#727785"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                    style={webInputFixStyle}
                  />
                </View>
              </View>

              <View className="space-y-2 mb-6">
                <Text className="text-sm font-semibold tracking-wide text-on-surface-variant mb-1">
                  Mật khẩu
                </Text>
                <View
                  className="flex-row items-center bg-surface-container-highest rounded-xl px-4 h-14 border"
                  style={{ borderColor: '#c1c6d680' }}
                >
                  <MaterialIcons name="lock-outline" size={20} color="#727785" />
                  <TextInput
                    className="flex-1 ml-3 text-on-surface font-body text-base"
                    placeholder="........"
                    placeholderTextColor="#727785"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={webInputFixStyle}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <MaterialIcons
                      name={showPassword ? 'visibility-off' : 'visibility'}
                      size={20}
                      color="#727785"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-row items-center justify-between mb-8">
                <TouchableOpacity
                  className="flex-row items-center gap-2"
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <View
                    className="w-5 h-5 border-2 rounded flex items-center justify-center"
                    style={{
                      backgroundColor: rememberMe ? '#005bbf' : 'transparent',
                      borderColor: rememberMe ? '#005bbf' : '#c1c6d6',
                    }}
                  >
                    {rememberMe && <MaterialIcons name="check" size={14} color="white" />}
                  </View>
                  <Text className="text-sm font-medium text-on-surface-variant">
                    Ghi nhớ đăng nhập
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity>
                  <Text className="text-sm font-bold text-primary">Quên mật khẩu?</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                className="w-full bg-primary py-4 rounded-lg items-center shadow-md mb-6"
                onPress={onLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white font-bold text-base">Đăng nhập</Text>
                )}
              </TouchableOpacity>

              {Platform.OS !== 'web' && (
                <View className="items-center mb-8">
                  <TouchableOpacity
                    onPress={onBiometricLogin}
                    disabled={biometricLoading}
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: biometricEnabled ? '#EAF2FF' : '#F1F5F9',
                      borderWidth: 1,
                      borderColor: biometricEnabled ? '#BFD7FF' : '#CBD5E1',
                      opacity: biometricLoading ? 0.75 : 1,
                    }}
                  >
                    {biometricLoading ? (
                      <ActivityIndicator color="#005bbf" />
                    ) : (
                      <MaterialIcons
                        name="fingerprint"
                        size={28}
                        color={biometricEnabled ? '#005bbf' : '#94A3B8'}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>

            <View className="flex-row justify-center">
              <Text className="text-on-surface-variant font-medium">Chưa có tài khoản? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text className="text-primary font-bold">Đăng ký ngay</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ flex: 1, minHeight: 40 }} />
        </ScrollView>

        <Modal
          visible={showBiometricPrompt}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBiometricPrompt(false)}
        >
          <View className="flex-1 bg-black/40 items-center justify-center px-6">
            <View className="w-full max-w-[360px] bg-white rounded-3xl px-5 py-6 border border-slate-100">
              <View className="items-center mb-4">
                <View
                  className="w-14 h-14 rounded-full items-center justify-center"
                  style={{ backgroundColor: '#EAF2FF' }}
                >
                  <MaterialIcons name="fingerprint" size={28} color="#005bbf" />
                </View>
              </View>

              <Text className="text-xl font-black text-on-surface text-center mb-2">
                Chưa bật đăng nhập vân tay
              </Text>
              <Text className="text-sm text-on-surface-variant text-center leading-6 mb-6">
                Hãy vào Thông tin tài khoản và bật đăng nhập bằng vân tay trước khi sử dụng.
              </Text>

              <TouchableOpacity
                className="h-12 rounded-2xl bg-primary items-center justify-center"
                onPress={() => setShowBiometricPrompt(false)}
              >
                <Text className="text-white font-bold text-base">Đã hiểu</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;
