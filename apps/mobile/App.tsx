import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AppThemeProvider } from '@/theme/ThemeProvider';
import { RootNavigator } from '@/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
