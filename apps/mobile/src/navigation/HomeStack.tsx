import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '@car-rental/tokens';
import { BrowseScreen } from '@/screens/Browse';
import { VehicleDetailScreen } from '@/screens/VehicleDetail';
import { i18n } from '@/i18n';

export type HomeStackParamList = {
  Browse: undefined;
  VehicleDetail: { vehicleId: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
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
        name="Browse"
        options={{ title: i18n.t('browse.title'), headerShown: false }}
      >
        {({ navigation }) => (
          <BrowseScreen onSelectVehicle={(id) => navigation.navigate('VehicleDetail', { vehicleId: id })} />
        )}
      </Stack.Screen>
      <Stack.Screen name="VehicleDetail" options={{ title: '' }}>
        {({ route }) => <VehicleDetailScreen vehicleId={route.params.vehicleId} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
