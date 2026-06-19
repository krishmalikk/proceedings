export default {
  expo: {
name: "Meridian",
    slug: "proceedings",
    owner: "krishmalik",
    version: "1.0.0",
    scheme: "proceedings",
    orientation: "portrait",
    icon: "./assets/meridian-logo.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/meridian-logo-transparent.png",
      resizeMode: "contain",
      backgroundColor: "#AE0000"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.krishmalik.proceedings",
      buildNumber: "1",
      googleServicesFile: process.env.GOOGLE_SERVICES_PLIST || "./config/GoogleService-Info.plist",
      infoPlist: {
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              "com.googleusercontent.apps.971592620882-mvj696meur8j54ibu82egpl2dmvha0nf"
            ]
          }
        ],
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      package: "com.krishmalik.proceedings",
      versionCode: 1,
      adaptiveIcon: {
        backgroundColor: "#F6F2E9",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png"
      },
      predictiveBackGestureEnabled: false
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    plugins: [
      "expo-font",
      "expo-web-browser",
      "expo-status-bar",
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: "com.googleusercontent.apps.971592620882-mvj696meur8j54ibu82egpl2dmvha0nf"
        }
      ],
      "./plugins/withModularHeaders"
    ],
    extra: {
      eas: {
        projectId: "52839499-7dbb-48e5-bb9b-57b30ec68491"
      }
    }
  }
};
