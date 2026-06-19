import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '@car-rental/tokens';
import { BrowseScreen } from '@/screens/Browse';
import { VehicleDetailScreen } from '@/screens/VehicleDetail';
import { BookingScreen } from '@/screens/Booking';
import { i18n } from '@/i18n';

export type HomeStackParamList = {
  Browse: undefined;
  VehicleDetail: { vehicleId: string };
  Booking: { vehicleId: string; vehicleName: string; pricePerDay: number };
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
        {({ route, navigation }) => (
          <VehicleDetailScreen
            vehicleId={route.params.vehicleId}
            onBook={(vehicleId, vehicleName, pricePerDay) =>
              navigation.navigate('Booking', { vehicleId, vehicleName, pricePerDay })
            }
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Booking" options={{ title: i18n.t('booking.title') }}>
        {({ route }) => (
          <BookingScreen
            vehicleId={route.params.vehicleId}
            vehicleName={route.params.vehicleName}
            pricePerDay={route.params.pricePerDay}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
