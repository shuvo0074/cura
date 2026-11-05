/**
 * Makes an existing account a directory admin.
 *
 *   npm run directory:grant-admin -- someone@example.com
 *
 * This role runs the public site and is separate from a clinic's Administrator.
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
      where: { userId_role: { userId: user.id, role: 'ADMIN' } },
      create: { userId: user.id, role: 'ADMIN' },
      update: {},
    });
    console.log(`${email} is now a directory admin.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
