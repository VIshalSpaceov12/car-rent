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
    browse: {
      title: 'Browse Vehicles',
      searchPlaceholder: 'Search by name…',
      empty: 'No vehicles found',
      loading: 'Loading…',
      perDay: '/ day',
    },
    vehicle: {
      specs: 'Specs',
      transmission: 'Transmission',
      fuel: 'Fuel',
      seats: 'Seats',
      year: 'Year',
      price: 'Price',
      perDay: '/ day',
      description: 'Description',
    },
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
    browse: {
      title: 'تصفح المركبات',
      searchPlaceholder: 'ابحث بالاسم…',
      empty: 'لا توجد مركبات',
      loading: 'جارٍ التحميل…',
      perDay: '/ يوم',
    },
    vehicle: {
      specs: 'المواصفات',
      transmission: 'ناقل الحركة',
      fuel: 'الوقود',
      seats: 'المقاعد',
      year: 'السنة',
      price: 'السعر',
      perDay: '/ يوم',
      description: 'الوصف',
    },
  },
});

i18n.locale = Localization.getLocales()[0]?.languageCode ?? 'en';
i18n.enableFallback = true;

export const setLocale = (l: 'en' | 'ar') => {
  i18n.locale = l;
  I18nManager.forceRTL(l === 'ar'); // requires reload to fully apply
};
