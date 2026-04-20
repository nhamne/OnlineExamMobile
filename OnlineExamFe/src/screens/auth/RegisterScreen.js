import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { register } from '../../services/authService';
import RoleSegmentedControl from '../../components/RoleSegmentedControl';

const webInputFixStyle = Platform.OS === 'web' ? { outlineWidth: 0 } : null;

const getRoleCopy = (role) => {
  if (role === 'teacher') {
    return {
      title: 'Đăng ký tài khoản giáo viên',
      subtitle: 'Tạo tài khoản để quản lý lớp học, đề thi và chấm điểm tập trung.',
    };
  }

  return {
    title: 'Đăng ký tài khoản học sinh',
    subtitle: 'Tạo tài khoản để tham gia lớp học, làm bài và theo dõi kết quả.',
  };
};

const RegisterScreen = ({ navigation }) => {
  const [role, setRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slideAnim.setValue(18);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [role, slideAnim]);

  const roleCopy = getRoleCopy(role);

  const onRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Mật khẩu yếu', 'Mật khẩu cần ít nhất 6 ký tự.');
      return;
    }

    try {
      setLoading(true);
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        role,
      });

      Alert.alert('Thành công', 'Đăng ký tài khoản thành công. Vui lòng đăng nhập.');
      navigation.replace('Login');
    } catch (error) {
      Alert.alert(
        'Đăng ký thất bại',
        error?.response?.data?.message || 'Không thể kết nối đến máy chủ.'
      );
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

            <RoleSegmentedControl value={role} onChange={setRole} />

            <Animated.View
              style={{
                opacity: slideAnim.interpolate({ inputRange: [0, 18], outputRange: [1, 0.84] }),
                transform: [{ translateX: slideAnim }],
              }}
            >
              <View className="space-y-2 mb-4">
                <Text className="text-sm font-semibold tracking-wide text-on-surface-variant mb-1">
                  Họ và tên
                </Text>
                <View className="flex-row items-center bg-surface-container-highest rounded-xl px-4 h-14 border" style={{ borderColor: '#c1c6d680' }}>
                  <MaterialIcons name="person-outline" size={20} color="#727785" />
                  <TextInput
                    className="flex-1 ml-3 text-on-surface font-body text-base"
                    placeholder="Nguyễn Văn A"
                    placeholderTextColor="#727785"
                    value={fullName}
                    onChangeText={setFullName}
                    style={webInputFixStyle}
                  />
                </View>
              </View>

              <View className="space-y-2 mb-4">
                <Text className="text-sm font-semibold tracking-wide text-on-surface-variant mb-1">
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

              <View className="space-y-2 mb-8">
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

              <TouchableOpacity
                className="flex-row justify-center items-center w-full bg-primary py-4 rounded-lg shadow-md mb-8 gap-2"
                onPress={onRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Text className="text-white font-bold text-base">Đăng ký</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="white" />
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            <View className="flex-row justify-center">
              <Text className="text-on-surface-variant font-medium">Đã có tài khoản? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text className="text-primary font-bold">Đăng nhập</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default RegisterScreen;