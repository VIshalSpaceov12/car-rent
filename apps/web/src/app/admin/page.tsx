import { redirect } from 'next/navigation';
import { verifySession } from '@/server/auth/dal';

export default async function AdminPage() {
  const user = await verifySession();
  if (!user) redirect('/login');
  if (user.role !== 'admin') redirect('/');
  return (
    <main className="ps-cr-lg pe-cr-lg pt-cr-lg">
      <h1 className="text-2xl font-bold text-cr-text">Platform admin</h1>
      <p className="text-cr-text-muted">All-tenant oversight lands in Phase 7.</p>
    </main>
  );
}
