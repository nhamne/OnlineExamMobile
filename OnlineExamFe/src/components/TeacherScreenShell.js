import React from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSidebarNav from './BottomSidebarNav';
import DashboardTopBar from './DashboardTopBar';

const BOTTOM_NAV_HEIGHT = 74;

const TeacherScreenShell = ({
  children,
  bottomNavItems,
  activeKey,
  onSelectBottomNav,
  searchText,
  onChangeSearch,
  searchPlaceholder,
  upcomingCount,
  initials,
  onPressAvatar,
}) => {
  return (
    <SafeAreaView
      edges={['bottom']}
      className="flex-1 bg-surface-container-low"
      style={Platform.OS === 'web' ? { height: '100vh', overflow: 'hidden', position: 'relative' } : { flex: 1 }}
    >
      <DashboardTopBar
        searchText={searchText}
        onChangeSearch={onChangeSearch}
        searchPlaceholder={searchPlaceholder}
        upcomingCount={upcomingCount}
        initials={initials}
        onPressAvatar={onPressAvatar}
      />

      <View style={{ flex: 1, minHeight: 0, paddingBottom: BOTTOM_NAV_HEIGHT }}>{children}</View>

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 40,
          elevation: 40,
        }}
      >
        <BottomSidebarNav items={bottomNavItems} activeKey={activeKey} onSelect={onSelectBottomNav} />
      </View>
    </SafeAreaView>
  );
};

export default TeacherScreenShell;