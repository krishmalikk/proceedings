import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  SearchScreen,
  CommunityScreen,
  CaseDetailsScreen,
  AskProScreen,
  NewsScreen,
  FindScreen,
  PostScreen,
  GroupChatScreen,
  LoginScreen,
  SignupScreen,
  ProfileScreen,
  BackgroundOnboardingScreen,
  ExperiencesOnboardingScreen,
} from '../screens';
import { colors, spacing } from '../constants/theme';
import { FloatingChatButton, ChatModal } from '../components/chat';
import { useAuth } from '../contexts/AuthContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const OnboardingStackNav = createNativeStackNavigator();

function CommunityStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CommunityMain" component={CommunityScreen} />
      <Stack.Screen name="CaseDetails" component={CaseDetailsScreen} />
      <Stack.Screen name="Post" component={PostScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SearchMain" component={SearchScreen} />
      <Stack.Screen name="CaseDetails" component={CaseDetailsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

function FindStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FindMain" component={FindScreen} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} />
      <Stack.Screen name="CaseDetails" component={CaseDetailsScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
    </Stack.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

function OnboardingStack() {
  return (
    <OnboardingStackNav.Navigator screenOptions={{ headerShown: false }}>
      <OnboardingStackNav.Screen name="BackgroundOnboarding" component={BackgroundOnboardingScreen} />
      <OnboardingStackNav.Screen name="ExperiencesOnboarding" component={ExperiencesOnboardingScreen} />
    </OnboardingStackNav.Navigator>
  );
}

type TabIconName = 'home' | 'document-text' | 'chatbubbles' | 'headset' | 'newspaper' | 'people' | 'create';

const tabIcons: Record<string, { focused: TabIconName; unfocused: `${TabIconName}-outline` }> = {
  Home: { focused: 'home', unfocused: 'home-outline' },
  Find: { focused: 'people', unfocused: 'people-outline' },
  Community: { focused: 'chatbubbles', unfocused: 'chatbubbles-outline' },
  AskPro: { focused: 'headset', unfocused: 'headset-outline' },
  News: { focused: 'newspaper', unfocused: 'newspaper-outline' },
};

function TabNavigator() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <View style={styles.container}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => {
            const icons = tabIcons[route.name];
            const iconName = focused ? icons.focused : icons.unfocused;
            return <Ionicons name={iconName} size={22} color={color} />;
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.outline,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarItemStyle: styles.tabBarItem,
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeStack}
          options={{
            tabBarLabel: 'Home',
          }}
        />
        <Tab.Screen
          name="Find"
          component={FindStack}
          options={{
            tabBarLabel: 'Find',
          }}
        />
        <Tab.Screen
          name="Community"
          component={CommunityStack}
          options={{
            tabBarLabel: 'Community',
          }}
        />
        <Tab.Screen
          name="AskPro"
          component={AskProScreen}
          options={{
            tabBarLabel: 'Ask Pro',
          }}
        />
        <Tab.Screen
          name="News"
          component={NewsScreen}
          options={{
            tabBarLabel: 'News',
          }}
        />
      </Tab.Navigator>

      {/* AI Chat Floating Button and Modal */}
      <FloatingChatButton
        onPress={() => setIsChatOpen(true)}
        isOpen={isChatOpen}
      />
      <ChatModal
        visible={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </View>
  );
}

export function MainNavigator() {
  const { user, loading, isDevMode, hasCompletedOnboarding } = useAuth();

  // Show loading screen while checking auth state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Show auth screens if not authenticated and not in dev mode
  if (!user && !isDevMode) {
    return <AuthNavigator />;
  }

  // Show onboarding if user hasn't completed it (and not in dev mode)
  if (!hasCompletedOnboarding && !isDevMode) {
    return <OnboardingStack />;
  }

  // Show main app if authenticated and onboarding complete (or in dev mode)
  return <TabNavigator />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  tabBar: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
    height: 70,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  tabBarItem: {
    paddingVertical: 4,
  },
});

export default MainNavigator;
