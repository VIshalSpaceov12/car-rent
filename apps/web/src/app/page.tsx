import { redirect } from 'next/navigation';

// Redirect root URL to the default locale
export default function RootPage() {
  redirect('/en');
}
