/**
 * Makes an existing account a super admin.
 *
 *   npm run directory:grant-admin -- someone@example.com
 *
 * This role runs Cura Website and creates clinic owners. It is separate from a
 * clinic's Administrator, whose access ends at their own clinic.
 * It is granted by hand so that no default admin account or password exists.
 */
import { PrismaClient } from '@prisma/client';

async function main(): Promise<void> {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('Usage: npm run directory:grant-admin -- <email>');
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw new Error(`No account with email ${email}`);
    await prisma.userDirectoryRole.upsert({
      where: { userId_role: { userId: user.id, role: 'SUPER_ADMIN' } },
      create: { userId: user.id, role: 'SUPER_ADMIN' },
      update: {},
    });
    console.log(`${email} is now a super admin.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
