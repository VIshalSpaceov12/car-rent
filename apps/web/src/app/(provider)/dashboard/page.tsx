import { redirect } from 'next/navigation';
import { verifySession } from '@/server/auth/dal';

export default async function DashboardPage() {
  const user = await verifySession();
  if (!user) redirect('/login');
  if (user.role !== 'provider' && user.role !== 'staff') redirect('/');
  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg">
      <h1 className="text-2xl font-bold text-cr-text">Provider dashboard — {user.name}</h1>
      <p className="text-cr-text-muted">Fleet, bookings, branches land in Phase 1+.</p>
    </main>
  );
}
