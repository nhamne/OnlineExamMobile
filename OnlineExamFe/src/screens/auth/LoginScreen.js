import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { login } from '../../services/authService';
import { saveAuthSession } from '../../services/authSession';
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

  // Reset input fields when screen is focused (e.g., after logout)
  useFocusEffect(
    useCallback(() => {
      return () => {
        // Cleanup when screen loses focus is optional here,
        // but we'll reset on focus to clear previous login attempts
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      // Reset all input fields when screen is focused
      setEmail('');
      setPassword('');
      setShowPassword(false);
      setRememberMe(false);
      return () => {};
    }, [])
  );

  const wait = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

  const roleCopy = getRoleCopy(role);

  const onLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showToast('Vui lòng nhập email và mật khẩu.', 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await login({
        email: email.trim(),
        password,
        role,
        rememberMe,
      });

      if (response?.user?.role === 'teacher') {
        saveAuthSession(response.user);
        showToast('Đăng nhập thành công. Chuyển tới dashboard giáo viên.', 'success');
        await wait(300);
        navigation.replace('TeacherDashboard', { user: response.user });
      } else if (response?.user?.role === 'student') {
        saveAuthSession(response.user);
        showToast('Đăng nhập thành công. Chuyển tới dashboard học sinh.', 'success');
        await wait(300);
        navigation.replace('StudentDashboard', { user: response.user });
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
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
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
              <View className="flex-row items-center bg-surface-container-highest rounded-xl px-4 h-14 border" style={{ borderColor: '#c1c6d680' }}>
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
              <View className="flex-row items-center bg-surface-container-highest rounded-xl px-4 h-14 border" style={{ borderColor: '#c1c6d680' }}>
                <MaterialIcons name="lock-outline" size={20} color="#727785" />
                <TextInput
                  className="flex-1 ml-3 text-on-surface font-body text-base"
                  placeholder="••••••••"
                  placeholderTextColor="#727785"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
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
                  style={{ backgroundColor: rememberMe ? '#005bbf' : 'transparent', borderColor: rememberMe ? '#005bbf' : '#c1c6d6' }}
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
              className="w-full bg-primary py-4 rounded-lg items-center shadow-md mb-8"
              onPress={onLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-base">Đăng nhập</Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <View className="flex-row justify-center">
            <Text className="text-on-surface-variant font-medium">Chưa có tài khoản? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text className="text-primary font-bold">Đăng ký ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;
