'use server';
import { redirect } from 'next/navigation';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { branchCreateSchema } from '@car-rental/types';

async function guardProvider(locale: string) {
  const user = await verifySession();
  if (!user) redirect(`/${locale}/login`);
  try {
    requireRole(user, 'provider', 'staff', 'admin');
  } catch {
    redirect(user.role === 'admin' ? `/${locale}/admin` : `/${locale}/login`);
  }
  if (!user.providerId) redirect(`/${locale}/login`);
  return user;
}

export async function createBranch(
  locale: string,
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const user = await guardProvider(locale);

  const raw = {
    name: formData.get('name'),
    address: formData.get('address'),
    phone: formData.get('phone') || undefined,
  };

  const parsed = branchCreateSchema.safeParse(raw);
  if (!parsed.success) return { error: 'invalid' };

  await prisma.branch.create({
    data: { ...parsed.data, providerId: user.providerId! },
  });

  redirect(`/${locale}/dashboard/branches`);
}

export async function deleteBranch(locale: string, id: string): Promise<void> {
  const user = await guardProvider(locale);
  await prisma.branch.deleteMany({ where: { id, ...tenantScope(user) } });
  redirect(`/${locale}/dashboard/branches`);
}
