import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, Text, View } from 'react-native';
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
      <ToastProvider>
        <SafeAreaView className="flex-1 items-center justify-center bg-surface-container-low">
          <ActivityIndicator size="large" color="#005bbf" />
          <Text className="mt-3 text-on-surface-variant">Đang khôi phục phiên đăng nhập...</Text>
        </SafeAreaView>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <View style={{ flex: 1 }}>
        <AppNavigator initialRouteName={initialRouteName} initialUser={initialUser} />
      </View>
    </ToastProvider>
  );
}
