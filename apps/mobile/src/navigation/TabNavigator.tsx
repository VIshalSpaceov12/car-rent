import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HomeStack } from './HomeStack';
import { BookingsScreen } from '@/screens/Bookings';
import { PickupScreen } from '@/screens/Pickup';
import { SettingsScreen } from '@/screens/Settings';
import { FloatingTabBar } from './FloatingTabBar';
import { i18n } from '@/i18n';

type TabParamList = {
  Home: undefined;
  Bookings: undefined;
  Pickup: undefined;
  Settings: { onSignOut: () => void };
};

const Tab = createBottomTabNavigator<TabParamList>();

type Props = { onSignOut: () => void };

export function TabNavigator({ onSignOut }: Props) {
  return (
    <Tab.Navigator
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{ title: i18n.t('home') }}
      />
      <Tab.Screen
        name="Bookings"
        component={BookingsScreen}
        options={{ title: i18n.t('bookings') }}
      />
      <Tab.Screen
        name="Pickup"
        component={PickupScreen}
        options={{ title: i18n.t('pickup') }}
      />
      <Tab.Screen
        name="Settings"
        options={{ title: i18n.t('settings') }}
      >
        {() => <SettingsScreen onSignOut={onSignOut} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
