'use server';
import { redirect } from 'next/navigation';
import { prisma } from '@/server/db';
import { verifySession, requireRole, tenantScope } from '@/server/auth/dal';
import { categoryCreateSchema } from '@car-rental/types';

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

export async function createCategory(
  locale: string,
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  const user = await guardProvider(locale);

  const raw = {
    name: formData.get('name'),
    slug: formData.get('slug'),
  };

  const parsed = categoryCreateSchema.safeParse(raw);
  if (!parsed.success) return { error: 'invalid' };

  // Check for duplicate slug within tenant
  const existing = await prisma.vehicleCategory.findFirst({
    where: { slug: parsed.data.slug, providerId: user.providerId! },
  });
  if (existing) return { error: 'slug_exists' };

  await prisma.vehicleCategory.create({
    data: { ...parsed.data, providerId: user.providerId! },
  });

  redirect(`/${locale}/dashboard/categories`);
}

export async function deleteCategory(locale: string, id: string): Promise<void> {
  const user = await guardProvider(locale);
  await prisma.vehicleCategory.deleteMany({ where: { id, ...tenantScope(user) } });
  redirect(`/${locale}/dashboard/categories`);
}
