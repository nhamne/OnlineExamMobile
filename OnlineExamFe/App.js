import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { ToastProvider } from './src/context/ToastContext';
import { loadAuthSession } from './src/services/authSession';

export default function App() {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [initialUser, setInitialUser] = useState(null);

  useEffect(() => {
    const user = loadAuthSession();
    setInitialUser(user);
    setBootstrapping(false);
  }, []);

  const initialRouteName = useMemo(() => {
    if (initialUser?.role === 'teacher') return 'TeacherDashboard';
    if (initialUser?.role === 'student') return 'StudentDashboard';
    return 'Login';
  }, [initialUser]);

  if (bootstrapping) {
    return (
      <SafeAreaProvider>
        <ToastProvider>
          <SafeAreaView className="flex-1 items-center justify-center bg-surface-container-low">
            <ActivityIndicator size="large" color="#005bbf" />
            <Text className="mt-3 text-on-surface-variant">Đang khôi phục phiên đăng nhập...</Text>
          </SafeAreaView>
        </ToastProvider>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <View style={{ flex: 1 }}>
          <StatusBar style="dark" translucent={false} backgroundColor="#FFFFFF" />
          <AppNavigator initialRouteName={initialRouteName} initialUser={initialUser} />
        </View>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
