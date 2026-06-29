import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId:   'it.marcopeluso.finanzai',
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
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'always',
    scrollEnabled: true,
  },
};

export default config;
