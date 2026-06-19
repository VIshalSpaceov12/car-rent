import { I18n } from 'i18n-js';
import { I18nManager } from 'react-native';
import * as Localization from 'expo-localization';

export const i18n = new I18n({
  en: {
    signIn: 'Sign in',
    email: 'Email',
    password: 'Password',
    home: 'Find your ride',
    invalid: 'Invalid credentials',
    bookings: 'Bookings',
    pickup: 'Pickup',
    settings: 'Settings',
    onboarding: 'Welcome to Car Rental',
    getStarted: 'Get Started',
  },
  ar: {
    signIn: 'تسجيل الدخول',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    home: 'ابحث عن سيارتك',
    invalid: 'بيانات الاعتماد غير صحيحة',
    bookings: 'الحجوزات',
    pickup: 'الاستلام',
    settings: 'الإعدادات',
    onboarding: 'مرحباً بك في تأجير السيارات',
    getStarted: 'ابدأ الآن',
  },
});

i18n.locale = Localization.getLocales()[0]?.languageCode ?? 'en';
i18n.enableFallback = true;

export const setLocale = (l: 'en' | 'ar') => {
  i18n.locale = l;
  I18nManager.forceRTL(l === 'ar'); // requires reload to fully apply
};
