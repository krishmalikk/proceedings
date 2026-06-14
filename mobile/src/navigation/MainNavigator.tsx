import React, { useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  SearchScreen,
  CaseDetailsScreen,
  AuthorScreen,
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

// "Community" mirrors the website's Community tab (the postings search/browse,
// i.e. /search). The old mock forum screen navigated to fake case ids → 404.
function CommunityStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CommunityMain" component={SearchScreen} />
      <Stack.Screen name="CaseDetails" component={CaseDetailsScreen} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} />
      <Stack.Screen name="Author" component={AuthorScreen} />
      <Stack.Screen name="Post" component={PostScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="BackgroundOnboarding" component={BackgroundOnboardingScreen} />
      <Stack.Screen name="ExperiencesOnboarding" component={ExperiencesOnboardingScreen} />
    </Stack.Navigator>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SearchMain" component={SearchScreen} />
      <Stack.Screen name="CaseDetails" component={CaseDetailsScreen} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} />
      <Stack.Screen name="Author" component={AuthorScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="BackgroundOnboarding" component={BackgroundOnboardingScreen} />
      <Stack.Screen name="ExperiencesOnboarding" component={ExperiencesOnboardingScreen} />
    </Stack.Navigator>
  );
}

function FindStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FindMain" component={FindScreen} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} />
      <Stack.Screen name="CaseDetails" component={CaseDetailsScreen} />
      <Stack.Screen name="Author" component={AuthorScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="BackgroundOnboarding" component={BackgroundOnboardingScreen} />
      <Stack.Screen name="ExperiencesOnboarding" component={ExperiencesOnboardingScreen} />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="BackgroundOnboarding" component={BackgroundOnboardingScreen} />
      <Stack.Screen name="ExperiencesOnboarding" component={ExperiencesOnboardingScreen} />
      <Stack.Screen name="CaseDetails" component={CaseDetailsScreen} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} />
      <Stack.Screen name="Author" component={AuthorScreen} />
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

type TabIconName = 'home' | 'document-text' | 'chatbubbles' | 'people' | 'person' | 'create';

const tabIcons: Record<string, { focused: TabIconName; unfocused: `${TabIconName}-outline` }> = {
  Home: { focused: 'home', unfocused: 'home-outline' },
  Find: { focused: 'people', unfocused: 'people-outline' },
  Community: { focused: 'chatbubbles', unfocused: 'chatbubbles-outline' },
  Profile: { focused: 'person', unfocused: 'person-outline' },
};

// The global AI chat is DISABLED to match the website, where the equivalent
// "AI mode" answer panel is gated off (UnifiedSearch.tsx `AI_MODE_ENABLED = false`,
// per posting-specs.md §2). Flip both to re-enable the AI assistant together.
const AI_CHAT_ENABLED = false;

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
            tabBarLabel: 'Groups',
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
          name="Profile"
          component={ProfileStack}
          options={{
            tabBarLabel: 'Profile',
          }}
        />
      </Tab.Navigator>

      {/* AI Chat Floating Button and Modal — disabled to match the website
          (AI_MODE_ENABLED = false there). Re-enable via AI_CHAT_ENABLED above. */}
      {AI_CHAT_ENABLED && (
        <>
          <FloatingChatButton
            onPress={() => setIsChatOpen(true)}
            isOpen={isChatOpen}
          />
          <ChatModal
            visible={isChatOpen}
            onClose={() => setIsChatOpen(false)}
          />
        </>
      )}
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
