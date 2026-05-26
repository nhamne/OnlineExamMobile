import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { resetPassword, sendOtp } from '../../services/authService';
import { useToast } from '../../context/ToastContext';

const webInputFixStyle = Platform.OS === 'web' ? { outlineWidth: 0 } : null;

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const { showToast } = useToast();

  const onSendOtp = async () => {
    if (!email.trim()) {
      showToast('Vui lòng nhập email.', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await sendOtp({ email: email.trim() });
      showToast(res.message || 'Đã gửi mã OTP.', 'success');
      setOtpSent(true);
    } catch (error) {
      console.error('Send OTP error:', error);
      showToast(error?.response?.data?.message || 'Không thể kết nối đến máy chủ.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async () => {
    if (!email.trim() || !otp.trim() || !newPassword.trim()) {
      showToast('Vui lòng nhập đầy đủ thông tin.', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showToast('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error');
      return;
    }

    try {
      setLoading(true);
      await resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        newPassword,
      });

      showToast('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.', 'success');
      navigation.replace('Login');
    } catch (error) {
      console.error('Reset password error:', error);
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
            <TouchableOpacity onPress={() => navigation.goBack()} className="mb-6">
              <MaterialIcons name="arrow-back" size={24} color="#005bbf" />
            </TouchableOpacity>

            <View className="mb-8">
              <Text className="text-3xl font-bold tracking-tight text-on-surface mb-2">
                Quên mật khẩu
              </Text>
              <Text className="text-on-surface-variant font-medium">
                {!otpSent ? 'Nhập email của bạn để nhận mã xác nhận (OTP).' : 'Nhập mã OTP vừa nhận được và mật khẩu mới.'}
              </Text>
            </View>

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
                  editable={!otpSent}
                />
              </View>
            </View>

            {otpSent && (
              <>
                <View className="space-y-2 mb-4">
                  <Text className="text-sm font-semibold tracking-wide text-on-surface-variant mb-1">
                    Mã OTP
                  </Text>
                  <View className="flex-row items-center bg-surface-container-highest rounded-xl px-4 h-14 border" style={{ borderColor: '#c1c6d680' }}>
                    <MaterialIcons name="password" size={20} color="#727785" />
                    <TextInput
                      className="flex-1 ml-3 text-on-surface font-body text-base"
                      placeholder="123456"
                      placeholderTextColor="#727785"
                      keyboardType="number-pad"
                      value={otp}
                      onChangeText={setOtp}
                      style={webInputFixStyle}
                    />
                  </View>
                </View>

                <View className="space-y-2 mb-8">
                  <Text className="text-sm font-semibold tracking-wide text-on-surface-variant mb-1">
                    Mật khẩu mới
                  </Text>
                  <View className="flex-row items-center bg-surface-container-highest rounded-xl px-4 h-14 border" style={{ borderColor: '#c1c6d680' }}>
                    <MaterialIcons name="lock-outline" size={20} color="#727785" />
                    <TextInput
                      className="flex-1 ml-3 text-on-surface font-body text-base"
                      placeholder="••••••••"
                      placeholderTextColor="#727785"
                      secureTextEntry={!showPassword}
                      value={newPassword}
                      onChangeText={setNewPassword}
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
              </>
            )}

            <TouchableOpacity
              className="w-full bg-primary py-4 rounded-lg items-center shadow-md mb-4"
              onPress={otpSent ? onResetPassword : onSendOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-base">
                  {otpSent ? 'Xác nhận đổi mật khẩu' : 'Gửi mã OTP'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default ForgotPasswordScreen;
