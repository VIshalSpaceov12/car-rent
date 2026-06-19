import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '@car-rental/tokens';
import type { BookingDTO } from '@car-rental/types';
import { BookingsScreen } from '@/screens/Bookings';
import { CheckoutScreen } from '@/screens/Checkout';
import { PaymentConfirmationScreen } from '@/screens/PaymentConfirmation';
import { i18n } from '@/i18n';

export type BookingsStackParamList = {
  BookingsList: undefined;
  Checkout: { booking: BookingDTO };
  PaymentConfirmation: { booking: BookingDTO };
};

const Stack = createNativeStackNavigator<BookingsStackParamList>();

export function BookingsStack() {
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
        name="BookingsList"
        options={{ title: i18n.t('bookingList.title'), headerShown: false }}
      >
        {({ navigation }) => (
          <BookingsScreen
            onPayBooking={(booking) => navigation.navigate('Checkout', { booking })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Checkout" options={{ title: i18n.t('checkout.title') }}>
        {({ route, navigation }) => (
          <CheckoutScreen
            booking={route.params.booking}
            onPaymentSuccess={(updatedBooking) =>
              navigation.replace('PaymentConfirmation', { booking: updatedBooking })
            }
            onCancel={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      <Stack.Screen
        name="PaymentConfirmation"
        options={{ title: i18n.t('paymentConfirmation.title'), headerBackVisible: false }}
      >
        {({ route, navigation }) => (
          <PaymentConfirmationScreen
            booking={route.params.booking}
            onDone={() => navigation.popToTop()}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
