import { useCallback, useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { useTheme } from '@car-rental/tokens';
import { getToken } from '@/auth/storage';
import { OnboardingScreen } from '@/screens/Onboarding';
import { LoginScreen } from '@/screens/Login';
import { TabNavigator } from './TabNavigator';

type RootParamList = {
  Onboarding: undefined;
  Login: undefined;
  Tabs: undefined;
};

const Stack = createNativeStackNavigator<RootParamList>();

export function RootNavigator() {
  const theme = useTheme();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getToken().then((t) => {
      setToken(t);
      setReady(true);
    });
  }, []);

  const handleSuccess = useCallback(() => setToken('auth'), []);
  const handleSignOut = useCallback(() => setToken(null), []);

  if (!ready) return null;

  const navigationTheme = {
    dark: theme.scheme === 'dark',
    colors: {
      primary: theme.color.primary,
      background: theme.color.background,
      card: theme.color.surface,
      text: theme.color.text,
      border: theme.color.border,
      notification: theme.color.danger,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' as const },
      medium: { fontFamily: 'System', fontWeight: '500' as const },
      bold: { fontFamily: 'System', fontWeight: '700' as const },
      heavy: { fontFamily: 'System', fontWeight: '800' as const },
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <Stack.Screen name="Tabs">
            {() => <TabNavigator onSignOut={handleSignOut} />}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Onboarding">
              {({ navigation }) => (
                <OnboardingScreen onStart={() => navigation.navigate('Login')} />
              )}
            </Stack.Screen>
            <Stack.Screen name="Login">
              {() => <LoginScreen onSuccess={handleSuccess} />}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
