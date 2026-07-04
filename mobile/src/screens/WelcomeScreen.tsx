import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function WelcomeScreen() {
  const { completeWelcome } = useAuth();

  const handleGetStarted = async () => {
    await completeWelcome();
  };

  return (
    <LinearGradient
      colors={['#FFDCDC', '#FFE8E8', '#FFF5F5', '#FFFFFF']}
      locations={[0, 0.35, 0.65, 1]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* Decorative circles at top */}
        <View style={styles.circlesContainer}>
          <View style={[styles.circle, styles.circle1]} />
          <View style={[styles.circle, styles.circle2]} />
          <View style={[styles.circle, styles.circle3]} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Logo with red circle background */}
          <Animated.View
            style={styles.logoContainer}
            entering={FadeIn.delay(200).duration(600)}
          >
            <View style={styles.logoCircle}>
              <Image
                source={require('../../assets/meridian-new-logo-transparent.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          {/* Welcome Text */}
          <Animated.View
            style={styles.textContainer}
            entering={FadeInDown.delay(400).duration(600)}
          >
            <Text style={styles.title}>Welcome to Meridian!</Text>
            <Text style={styles.tagline}>
              Your journey to a new beginning starts here
            </Text>
          </Animated.View>
        </View>

        {/* Get Started Button */}
        <Animated.View
          style={styles.buttonContainer}
          entering={FadeInUp.delay(600).duration(600)}
        >
          <TouchableOpacity
            style={styles.getStartedButton}
            onPress={handleGetStarted}
            activeOpacity={0.85}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={20} color={colors.onPrimary} style={styles.buttonIcon} />
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const LOGO_CIRCLE_SIZE = 180;

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  circlesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.4,
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  circle1: {
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_WIDTH * 1.2,
    top: -SCREEN_WIDTH * 0.6,
    left: -SCREEN_WIDTH * 0.3,
    opacity: 0.15,
  },
  circle2: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    top: -SCREEN_WIDTH * 0.3,
    right: -SCREEN_WIDTH * 0.3,
    opacity: 0.25,
  },
  circle3: {
    width: SCREEN_WIDTH * 0.6,
    height: SCREEN_WIDTH * 0.6,
    top: SCREEN_WIDTH * 0.1,
    left: SCREEN_WIDTH * 0.1,
    opacity: 0.1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.marginMobile,
  },
  logoContainer: {
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: LOGO_CIRCLE_SIZE,
    height: LOGO_CIRCLE_SIZE,
    borderRadius: LOGO_CIRCLE_SIZE / 2,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    width: LOGO_CIRCLE_SIZE * 1.3,
    height: LOGO_CIRCLE_SIZE * 1.3,
    tintColor: '#FFFFFF',
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Lora_700Bold',
    fontSize: 32,
    color: colors.onSurface,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: 'NunitoSans_500Medium',
    fontSize: 16,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  buttonContainer: {
    paddingHorizontal: spacing.marginMobile,
    paddingBottom: spacing.xl,
  },
  getStartedButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  getStartedText: {
    fontFamily: 'NunitoSans_700Bold',
    fontSize: 18,
    color: colors.onPrimary,
  },
  buttonIcon: {
    marginLeft: 4,
  },
});

export default WelcomeScreen;
