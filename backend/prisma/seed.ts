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

import { SEED_DRUGS } from './seed-drugs';

const prisma = new PrismaClient();

/** One account per access level, so each can be signed into directly. */
const ACCOUNTS = [
  {
    role: 'ADMINISTRATOR',
    mobile: '+8801700000001',
    email: 'admin@cura.local',
    password: 'CuraAdmin123',
    fullName: 'Shahnaz Rahman',
    bmdc: null,
  },
  {
    role: 'DOCTOR',
    mobile: '+8801711111111',
    email: 'doctor@cura.local',
    password: 'CuraDoctor123',
    fullName: 'Dr Ariful Islam',
    bmdc: 'A-100200',
  },
  {
    role: 'DESK_STAFF',
    mobile: '+8801700000003',
    email: 'desk@cura.local',
    password: 'CuraDesk123',
    fullName: 'Rekha Sultana',
    bmdc: null,
  },
] as const;

const hash = (password: string) =>
  argon2.hash(password, { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 });

async function main(): Promise<void> {

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

  const users: Record<string, { id: string }> = {};

  for (const account of ACCOUNTS) {
    const passwordHash = await hash(account.password);

    // Mobile *and* email are both unique, so an upsert keyed on one of them
    // still collides on the other. Reconcile against whichever row already
    // holds either identifier, which keeps re-seeding safe on a database that
    // has been poked at by hand.
    const existing = await prisma.user.findFirst({
      where: { OR: [{ mobile: account.mobile }, { email: account.email }] },
      select: { id: true },
    });

    // The role is re-applied on update so re-seeding repairs an account whose
    // level was changed by hand during testing.
    const user = await prisma.user.upsert({
      where: existing ? { id: existing.id } : { mobile: account.mobile },
      update: {
        fullName: account.fullName,
        mobile: account.mobile,
        email: account.email,
        passwordHash,
        role: account.role,
        isActive: true,
        lockedUntil: null,
        failedLoginCount: 0,
        // Re-applied on update too: a demo account that already existed but was
        // never verified would otherwise be stuck behind an OTP challenge.
        mobileVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
        onboardingComplete: true,
        onboardingStep: 4,
      },
      create: {
        fullName: account.fullName,
        mobile: account.mobile,
        email: account.email,
        passwordHash,
        bmdcNumber: account.bmdc,
        role: account.role,
        // Pre-verified so login issues a session without an OTP round trip.
        mobileVerifiedAt: new Date(),
        emailVerifiedAt: new Date(),
        onboardingComplete: true,
        onboardingStep: 4,
      },
    });

    await prisma.practiceMembership.upsert({
      where: { practiceId_userId: { practiceId: practice.id, userId: user.id } },
      update: { isActive: true, role: account.role },
      create: { practiceId: practice.id, userId: user.id, role: account.role, isActive: true },
    });

    users[account.role] = user;
  }

  // Appointments are booked against the doctor, who is the one holding clinics.
  const doctor = users.DOCTOR!;

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
  const seededPatients: string[] = [];

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
    seededPatients.push(patient.id);

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

  // -- Engagement ------------------------------------------------------------
  //
  // Only on a practice with no feedback yet, so re-seeding never stacks
  // duplicate ratings on top of ones staff have recorded.
  if ((await prisma.patientFeedback.count({ where: { practiceId: practice.id } })) === 0) {
    const ratings = [
      { rating: 5, comment: 'Explained everything clearly and did not rush.', reply: 'Thank you — glad it helped.' },
      { rating: 4, comment: 'Good consultation, but the wait was about 30 minutes.', reply: null },
      { rating: 5, comment: null, reply: null },
      { rating: 2, comment: 'Could not get through on the phone to reschedule.', reply: null },
    ];
    await prisma.patientFeedback.createMany({
      data: ratings.map((r, i) => ({
        practiceId: practice.id,
        patientId: seededPatients[i % seededPatients.length] as string,
        rating: r.rating,
        comment: r.comment,
        reply: r.reply,
        repliedAt: r.reply ? new Date() : null,
        createdAt: new Date(Date.now() - (i + 1) * 3 * 86_400_000),
      })),
    });
  }

  // -- Drug catalogue --------------------------------------------------------
  //
  // `skipDuplicates` plus a stable (practiceId, searchName) key makes re-seeding
  // idempotent: running this twice does not double the catalogue.
  const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
  const existing = new Set(
    (
      await prisma.drug.findMany({
        where: { practiceId: practice.id },
        select: { searchName: true },
      })
    ).map((d) => d.searchName),
  );

  const freshDrugs = SEED_DRUGS.filter((d) => !existing.has(normalise(d.name)));
  if (freshDrugs.length > 0) {
    await prisma.drug.createMany({
      data: freshDrugs.map((d) => ({
        practiceId: practice.id,
        name: d.name,
        form: d.form,
        strength: d.strength,
        unit: d.unit,
        instruction: d.instruction,
        searchName: normalise(d.name),
      })),
    });
  }

  // Keep the sequence ahead of the ids seeded above so the first real intake
  // does not collide with demo data.
  //
  // GREATEST, not a bare setval: patients registered *after* a previous seed
  // have already consumed higher ids, and rewinding the sequence would hand the
  // next intake a curaId that is already taken.
  await prisma.$executeRawUnsafe(
    `SELECT setval(
       'cura_patient_seq',
       GREATEST(
         ${10_000 + people.length},
         (SELECT COALESCE(MAX(NULLIF(regexp_replace("curaId", '\\D', '', 'g'), ''))::bigint, 0) FROM patients)
       ),
       true
     )`,
  );

  // A patient last seen ~6 months ago with nothing booked, so the preventive
  // recall list in Communications has an entry. Keyed on mobile, and given an
  // id from the live sequence — which is why it runs after the setval above: on
  // a fresh database the sequence would otherwise hand back CURA-10000.
  const recallMobile = '+8801866666666';
  if (!(await prisma.patient.findFirst({ where: { practiceId: practice.id, mobile: recallMobile } }))) {
    const [row] = await prisma.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('cura_patient_seq') AS nextval`;
    await prisma.patient.create({
      data: {
        curaId: `CURA-${String(row?.nextval ?? 19_999).padStart(5, '0')}`,
        practiceId: practice.id,
        fullName: 'Farhana Islam',
        mobile: recallMobile,
        gender: 'FEMALE',
        searchName: 'farhana islam',
        profileComplete: true,
        dateOfBirth: new Date(1979, new Date().getMonth(), new Date().getDate() + 9),
        lastVisitAt: new Date(Date.now() - 170 * 86_400_000),
      },
    });
  }

  console.log('\nSeed complete.');
  console.log(`  Practice : ${practice.name} (${practice.id})`);
  for (const a of ACCOUNTS) {
    console.log(`  ${a.role.padEnd(13)}: ${a.mobile}  /  ${a.password}   (${a.email})`);
  }
  console.log(`  ${people.length} patients and appointments created for today.`);
  console.log(`  ${SEED_DRUGS.length} drugs in the catalogue (${freshDrugs.length} added now).\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
