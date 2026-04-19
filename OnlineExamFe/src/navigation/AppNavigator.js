import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import TeacherDashboardScreen from '../screens/dashboard/TeacherDashboardScreen';
import StudentDashboardScreen from '../screens/dashboard/StudentDashboardScreen';
import ClassScreen from '../screens/teacher/ClassScreen';

const Stack = createNativeStackNavigator();

const AppNavigator = ({ initialRouteName = 'Login', initialUser = null }) => {
	return (
		<NavigationContainer>
			<Stack.Navigator
				initialRouteName={initialRouteName}
				screenOptions={{
					headerShown: false,
					animation: 'slide_from_right',
				}}
			>
				<Stack.Screen name="Login" component={LoginScreen} />
				<Stack.Screen name="Register" component={RegisterScreen} />
				<Stack.Screen
					name="TeacherDashboard"
					component={TeacherDashboardScreen}
					initialParams={{ user: initialUser }}
				/>
				<Stack.Screen
					name="TeacherClassrooms"
					component={ClassScreen}
					initialParams={{ user: initialUser }}
				/>
				<Stack.Screen
					name="StudentDashboard"
					component={StudentDashboardScreen}
					initialParams={{ user: initialUser }}
				/>
			</Stack.Navigator>
		</NavigationContainer>
	);
};

export default AppNavigator;
