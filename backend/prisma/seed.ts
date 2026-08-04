/**
 * Development seed.
 *
 * Creates a practice, a verified doctor and a day of appointments so the
 * calendar has something to render on first run.
 *
 * The seeded doctor has `mobileVerifiedAt` set and 2FA off, which means login
 * returns a session directly instead of an OTP challenge — the flow the spec
 * describes for a returning, already-verified user. Register a fresh account
 * through the UI if you want to exercise the OTP path (the code is printed to
 * the API console in development).
 *
 * Idempotent: safe to re-run.
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const DOCTOR = {
  mobile: '+8801711111111',
  email: 'doctor@cura.local',
  password: 'CuraDoctor123',
  fullName: 'Dr Ariful Islam',
  bmdc: 'A-100200',
};

async function main(): Promise<void> {
  const passwordHash = await argon2.hash(DOCTOR.password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const practice = await prisma.practice.upsert({
    where: { id: '11111111-1111-4111-8111-111111111111' },
    update: {},
    create: {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Cura Demo Clinic',
      specialization: 'General Practice',
      contactNumber: '+8801700000000',
      address: 'House 12, Road 5, Dhanmondi, Dhaka',
      slotMinutes: 10,
      sessions: {
        // Sunday–Thursday, the standard Bangladesh clinic week.
        create: [0, 1, 2, 3, 4].map((dayOfWeek) => ({
          dayOfWeek,
          startTime: '09:00',
          endTime: '21:00',
        })),
      },
    },
  });

  const doctor = await prisma.user.upsert({
    where: { mobile: DOCTOR.mobile },
    update: { passwordHash, isActive: true, lockedUntil: null, failedLoginCount: 0 },
    create: {
      fullName: DOCTOR.fullName,
      mobile: DOCTOR.mobile,
      email: DOCTOR.email,
      passwordHash,
      bmdcNumber: DOCTOR.bmdc,
      role: 'DOCTOR',
      // Pre-verified so login issues a session without an OTP round trip.
      mobileVerifiedAt: new Date(),
      emailVerifiedAt: new Date(),
      onboardingComplete: true,
      onboardingStep: 4,
    },
  });

  await prisma.practiceMembership.upsert({
    where: { practiceId_userId: { practiceId: practice.id, userId: doctor.id } },
    update: { isActive: true },
    create: { practiceId: practice.id, userId: doctor.id, role: 'DOCTOR', isActive: true },
  });

  const people = [
    { fullName: 'Rahima Begum', mobile: '+8801811111111', gender: 'FEMALE', visit: 'NEW' },
    { fullName: 'Kamal Hossain', mobile: '+8801822222222', gender: 'MALE', visit: 'FOLLOW_UP' },
    { fullName: 'Nusrat Jahan', mobile: '+8801833333333', gender: 'FEMALE', visit: 'OLD' },
    { fullName: 'Tanvir Ahmed', mobile: '+8801844444444', gender: 'MALE', visit: 'NEW' },
    { fullName: 'Shirin Akter', mobile: '+8801855555555', gender: 'FEMALE', visit: 'FOLLOW_UP' },
  ] as const;

  // Appointments land on today so the default calendar view is populated.
  const base = new Date();
  base.setHours(10, 0, 0, 0);

  const statuses = ['DONE', 'ENGAGED', 'WAITING', 'SCHEDULED', 'SCHEDULED'] as const;

  for (const [index, person] of people.entries()) {
    const seq = 10_000 + index;
    const curaId = `CURA-${String(seq).padStart(5, '0')}`;

    const patient = await prisma.patient.upsert({
      where: { curaId },
      update: {},
      create: {
        curaId,
        practiceId: practice.id,
        fullName: person.fullName,
        mobile: person.mobile,
        gender: person.gender,
        searchName: person.fullName.toLowerCase(),
        profileComplete: true,
        dateOfBirth: new Date(1985 + index, index, 12),
      },
    });

    const scheduledAt = new Date(base.getTime() + index * 20 * 60_000);
    const endsAt = new Date(scheduledAt.getTime() + 10 * 60_000);

    const existing = await prisma.appointment.findFirst({
      where: { patientId: patient.id, scheduledAt },
    });
    if (existing) continue;

    await prisma.appointment.create({
      data: {
        practiceId: practice.id,
        doctorId: doctor.id,
        patientId: patient.id,
        scheduledAt,
        endsAt,
        durationMinutes: 10,
        status: statuses[index],
        visitType: person.visit,
        tokenNumber: index + 1,
        plannedProcedures: index % 2 === 0 ? ['Follow-up visit'] : [],
      },
    });
  }

  // Keep the sequence ahead of the ids seeded above so the first real intake
  // does not collide with demo data.
  await prisma.$executeRawUnsafe(
    `SELECT setval('cura_patient_seq', ${10_000 + people.length}, true)`,
  );

  console.log('\nSeed complete.');
  console.log(`  Practice : ${practice.name} (${practice.id})`);
  console.log(`  Sign in  : ${DOCTOR.mobile}  /  ${DOCTOR.password}`);
  console.log(`  Or email : ${DOCTOR.email}`);
  console.log(`  ${people.length} patients and appointments created for today.\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
