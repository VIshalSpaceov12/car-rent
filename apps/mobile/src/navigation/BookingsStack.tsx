import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '@car-rental/tokens';
import type { BookingDTO } from '@car-rental/types';
import { BookingsScreen } from '@/screens/Bookings';
import { CheckoutScreen } from '@/screens/Checkout';
import { PaymentConfirmationScreen } from '@/screens/PaymentConfirmation';
import { PickupOtpScreen } from '@/screens/PickupOtp';
import { ContractScreen } from '@/screens/Contract';
import { PickupSuccessScreen } from '@/screens/PickupSuccess';
import { ReceiptScreen } from '@/screens/Receipt';
import { i18n } from '@/i18n';

export type BookingsStackParamList = {
  BookingsList: undefined;
  Receipt: { booking: BookingDTO };
  Checkout: { booking: BookingDTO };
  PaymentConfirmation: { booking: BookingDTO };
  PickupOtp: { booking: BookingDTO };
  Contract: { booking: BookingDTO };
  PickupSuccess: { booking: BookingDTO };
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
            onPickup={(booking) => navigation.navigate('PickupOtp', { booking })}
            onViewReceipt={(booking) => navigation.navigate('Receipt', { booking })}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Receipt" options={{ title: i18n.t('receipt.title') }}>
        {({ route, navigation }) => (
          <ReceiptScreen
            booking={route.params.booking}
            onRebooked={(newBooking) => navigation.replace('Checkout', { booking: newBooking })}
            onBack={() => navigation.goBack()}
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

      <Stack.Screen
        name="PickupOtp"
        options={{ title: i18n.t('pickupFlow.title') }}
      >
        {({ route, navigation }) => (
          <PickupOtpScreen
            booking={route.params.booking}
            onVerified={(booking) => navigation.replace('Contract', { booking })}
            onCancel={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      <Stack.Screen
        name="Contract"
        options={{ title: i18n.t('contract.title') }}
      >
        {({ route, navigation }) => (
          <ContractScreen
            booking={route.params.booking}
            onSigned={(updatedBooking) =>
              navigation.replace('PickupSuccess', { booking: updatedBooking })
            }
            onCancel={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>

      <Stack.Screen
        name="PickupSuccess"
        options={{ title: i18n.t('pickupSuccess.title'), headerBackVisible: false }}
      >
        {({ route, navigation }) => (
          <PickupSuccessScreen
            booking={route.params.booking}
            onDone={() => navigation.popToTop()}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
