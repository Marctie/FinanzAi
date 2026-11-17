import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'com.finanzai.app',
  appName: 'FinanzAI',
  webDir:  'www',
  plugins: {
    StatusBar: {
      style:           'DEFAULT',
      backgroundColor: '#ffffff',
      overlaysWebView: false,
    },
    Keyboard: {
      resize:              'body',
      resizeOnFullScreen:  true,
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#1b6ca8',
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#1b6ca8',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    // Non impostato: la WebView è ispezionabile solo nelle build di debug (test E2E con DevTools), mai in release.
  },
  ios: {
    contentInset: 'always',
    scrollEnabled: true,
  },
};

export default config;
