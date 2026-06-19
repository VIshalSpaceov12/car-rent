import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '@car-rental/tokens';
import { SettingsScreen } from '@/screens/Settings';
import { LoyaltyScreen } from '@/screens/Loyalty';
import { AddressesScreen } from '@/screens/Addresses';
import { SupportScreen } from '@/screens/Support';
import { i18n } from '@/i18n';

export type ProfileStackParamList = {
  SettingsHome: { onSignOut: () => void };
  Loyalty: undefined;
  Addresses: undefined;
  Support: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

type Props = { onSignOut: () => void };

export function ProfileStack({ onSignOut }: Props) {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.surface },
        headerTintColor: theme.color.text,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="SettingsHome"
        options={{ title: i18n.t('settings'), headerShown: false }}
      >
        {({ navigation }) => (
          <SettingsScreen
            onSignOut={onSignOut}
            onNavigateLoyalty={() => navigation.navigate('Loyalty')}
            onNavigateAddresses={() => navigation.navigate('Addresses')}
            onNavigateSupport={() => navigation.navigate('Support')}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Loyalty" options={{ title: i18n.t('loyalty.title') }}>
        {() => <LoyaltyScreen />}
      </Stack.Screen>

      <Stack.Screen name="Addresses" options={{ title: i18n.t('addresses.title') }}>
        {() => <AddressesScreen />}
      </Stack.Screen>

      <Stack.Screen name="Support" options={{ title: i18n.t('support.title') }}>
        {() => <SupportScreen />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
