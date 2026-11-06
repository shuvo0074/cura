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

/**
 * Every access level, signed into directly. The first doctor holds the
 * original demo diary; the other two get their own patients and schedules
 * below, so the calendar shows a multi-doctor clinic.
 */
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
  {
    role: 'DOCTOR',
    mobile: '+8801711111112',
    email: 'doctor2@cura.local',
    password: 'CuraDoctor123',
    fullName: 'Dr Nadia Karim',
    bmdc: 'A-100201',
  },
  {
    role: 'DOCTOR',
    mobile: '+8801711111113',
    email: 'doctor3@cura.local',
    password: 'CuraDoctor123',
    fullName: 'Dr Sajid Hasan',
    bmdc: 'A-100202',
  },
  {
    role: 'DESK_STAFF',
    mobile: '+8801700000004',
    email: 'desk2@cura.local',
    password: 'CuraDesk123',
    fullName: 'Mitu Akter',
    bmdc: null,
  },
  {
    role: 'DESK_STAFF',
    mobile: '+8801700000005',
    email: 'desk3@cura.local',
    password: 'CuraDesk123',
    fullName: 'Jahid Hasan',
    bmdc: null,
  },
] as const;

/** What patients see on Cura Website for each doctor account above. */
const DOCTOR_DETAILS: Record<string, { specialty: string; about: string; fees: number }> = {
  'doctor@cura.local': { specialty: 'General Physician', about: 'Adult medicine and long-term conditions.', fees: 800 },
  'doctor2@cura.local': { specialty: 'Pediatrics', about: 'Newborn and child health.', fees: 1000 },
  'doctor3@cura.local': { specialty: 'Cardiology', about: 'Heart disease and blood pressure.', fees: 1200 },
};

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

    users[account.email] = user;
  }

  // Appointments are booked against the doctor, who is the one holding clinics.
  const doctor = users['doctor@cura.local']!;

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

  // -- Calendar history and bookings ------------------------------------------
  //
  // 30 appointments around today — the 7 clinic days before it (finished,
  // no-shows, cancellations) and the 8 after it (booked) — so every calendar
  // view has something in it. Created once: the set is the only thing that
  // books the eight patients below, so any appointment of theirs means it
  // exists — a re-seed on a later day leaves it alone rather than piling up.
  const extraPeople = [
    { fullName: 'Arif Chowdhury', mobile: '+8801877000001', gender: 'MALE', born: 1981 },
    { fullName: 'Sumaiya Rahman', mobile: '+8801877000002', gender: 'FEMALE', born: 1994 },
    { fullName: 'Mahbub Alam', mobile: '+8801877000003', gender: 'MALE', born: 1967 },
    { fullName: 'Nasrin Sultana', mobile: '+8801877000004', gender: 'FEMALE', born: 1988 },
    { fullName: 'Rafiqul Islam', mobile: '+8801877000005', gender: 'MALE', born: 1959 },
    { fullName: 'Taslima Khatun', mobile: '+8801877000006', gender: 'FEMALE', born: 1976 },
    { fullName: 'Imran Hossain', mobile: '+8801877000007', gender: 'MALE', born: 2001 },
    { fullName: 'Ayesha Siddiqua', mobile: '+8801877000008', gender: 'FEMALE', born: 1990 },
  ] as const;

  let calendarAdded = 0;
  const alreadySeeded = await prisma.appointment.count({
    where: { practiceId: practice.id, patient: { mobile: { in: extraPeople.map((p) => p.mobile) } } },
  });

  if (alreadySeeded === 0) {
    const pool: string[] = [...seededPatients];
    for (const [index, person] of extraPeople.entries()) {
      const found = await prisma.patient.findFirst({ where: { practiceId: practice.id, mobile: person.mobile } });
      if (found) {
        pool.push(found.id);
        continue;
      }
      const [row] = await prisma.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('cura_patient_seq') AS nextval`;
      const created = await prisma.patient.create({
        data: {
          curaId: `CURA-${String(row?.nextval ?? 29_000 + index).padStart(5, '0')}`,
          practiceId: practice.id,
          fullName: person.fullName,
          mobile: person.mobile,
          gender: person.gender,
          searchName: person.fullName.toLowerCase(),
          profileComplete: true,
          dateOfBirth: new Date(person.born, (index * 5) % 12, 3 + index * 3),
        },
      });
      pool.push(created.id);
    }

    // Sunday–Thursday only, matching the practice's sessions.
    const clinicDays = (direction: -1 | 1, count: number): Date[] => {
      const days: Date[] = [];
      const cursor = new Date();
      cursor.setHours(0, 0, 0, 0);
      while (days.length < count) {
        cursor.setDate(cursor.getDate() + direction);
        if (cursor.getDay() <= 4) days.push(new Date(cursor));
      }
      return days;
    };

    const procedures = ['Follow-up visit', 'Blood pressure review', 'Diabetes check', 'Dressing', 'Vaccination', 'Consultation'];
    const visitTypes = ['NEW', 'FOLLOW_UP', 'OLD'] as const;
    // Two a day — one morning, one evening — at times that vary day to day.
    const mornings = [[9, 30], [11, 40], [10, 10], [12, 0], [9, 50]] as const;
    const evenings = [[17, 0], [18, 20], [19, 0], [16, 30], [20, 10]] as const;

    const plan = [
      ...clinicDays(-1, 7).map((day) => ({ day, past: true })),
      ...clinicDays(1, 8).map((day) => ({ day, past: false })),
    ];

    let n = 0;
    for (const [d, { day, past }] of plan.entries()) {
      for (let k = 0; k < 2; k += 1) {
        const [hour, minute] = (k === 0 ? mornings : evenings)[d % 5]!;
        const scheduledAt = new Date(day);
        scheduledAt.setHours(hour, minute, 0, 0);
        const endsAt = new Date(scheduledAt.getTime() + 10 * 60_000);

        // Past: mostly finished, with the odd no-show and cancellation so the
        // "show cancelled" filter and the counters have something to show.
        const status = !past ? 'SCHEDULED' : n % 7 === 3 ? 'NO_SHOW' : n % 9 === 5 ? 'CANCELLED' : 'DONE';
        const at = (offsetMin: number) => new Date(scheduledAt.getTime() + offsetMin * 60_000);

        await prisma.appointment.create({
          data: {
            practiceId: practice.id,
            doctorId: doctor.id,
            patientId: pool[n % pool.length]!,
            scheduledAt,
            endsAt,
            durationMinutes: 10,
            status,
            visitType: visitTypes[n % visitTypes.length]!,
            tokenNumber: k + 1,
            plannedProcedures: [procedures[n % procedures.length]!],
            ...(status === 'DONE' ? { checkedInAt: at(-5), engagedAt: at(2), completedAt: at(12) } : {}),
            ...(status === 'CANCELLED' ? { cancelledAt: at(-120), cancelReason: 'Patient rescheduled by phone' } : {}),
          },
        });
        n += 1;
      }
    }
    calendarAdded = n;
  }

  // -- Two more doctors' diaries ---------------------------------------------
  //
  // Five patients of their own each, booked over the 3 clinic days before
  // today, today, and the 5 after. Created once per doctor: any appointment
  // already against that doctor means their diary exists.
  const colleagues = [
    {
      email: 'doctor2@cura.local',
      patients: [
        { fullName: 'Fahim Rahman', mobile: '+8801899000001', gender: 'MALE', born: 2015 },
        { fullName: 'Lamia Haque', mobile: '+8801899000002', gender: 'FEMALE', born: 1992 },
        { fullName: 'Shafiqul Bari', mobile: '+8801899000003', gender: 'MALE', born: 1972 },
        { fullName: 'Rokeya Begum', mobile: '+8801899000004', gender: 'FEMALE', born: 1963 },
        { fullName: 'Tahmid Khan', mobile: '+8801899000005', gender: 'MALE', born: 2008 },
      ],
      // Clinic mornings and early afternoons.
      times: [[9, 0], [10, 30], [11, 20], [12, 40], [14, 0]],
    },
    {
      email: 'doctor3@cura.local',
      patients: [
        { fullName: 'Moushumi Das', mobile: '+8801899000006', gender: 'FEMALE', born: 1985 },
        { fullName: 'Habibur Rahman', mobile: '+8801899000007', gender: 'MALE', born: 1955 },
        { fullName: 'Sadia Afrin', mobile: '+8801899000008', gender: 'FEMALE', born: 1998 },
        { fullName: 'Kamrul Hasan', mobile: '+8801899000009', gender: 'MALE', born: 1979 },
        { fullName: 'Jannatul Ferdous', mobile: '+8801899000010', gender: 'FEMALE', born: 2003 },
      ],
      // Afternoon and evening clinics.
      times: [[15, 0], [16, 10], [17, 40], [18, 30], [19, 50]],
    },
  ] as const;

  const colleagueLog: string[] = [];
  for (const [c, colleague] of colleagues.entries()) {
    const doctorUser = users[colleague.email]!;
    if (await prisma.appointment.count({ where: { practiceId: practice.id, doctorId: doctorUser.id } })) {
      colleagueLog.push(`${colleague.email}: diary already seeded (skipped)`);
      continue;
    }

    const own: string[] = [];
    for (const [index, person] of colleague.patients.entries()) {
      const found = await prisma.patient.findFirst({ where: { practiceId: practice.id, mobile: person.mobile } });
      if (found) {
        own.push(found.id);
        continue;
      }
      const [row] = await prisma.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('cura_patient_seq') AS nextval`;
      const created = await prisma.patient.create({
        data: {
          curaId: `CURA-${String(row?.nextval ?? 39_000 + c * 10 + index).padStart(5, '0')}`,
          practiceId: practice.id,
          fullName: person.fullName,
          mobile: person.mobile,
          gender: person.gender,
          searchName: person.fullName.toLowerCase(),
          profileComplete: true,
          dateOfBirth: new Date(person.born, (index * 4 + c * 3) % 12, 5 + index * 4),
        },
      });
      own.push(created.id);
    }

    // Sunday–Thursday, as the practice's sessions: 3 days back, today, 5 ahead.
    const days: Array<{ day: Date; when: -1 | 0 | 1 }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const direction of [-1, 1] as const) {
      const cursor = new Date(today);
      let found = 0;
      while (found < (direction === -1 ? 3 : 5)) {
        cursor.setDate(cursor.getDate() + direction);
        if (cursor.getDay() <= 4) {
          days.push({ day: new Date(cursor), when: direction });
          found += 1;
        }
      }
    }
    if (today.getDay() <= 4) days.push({ day: today, when: 0 });

    const visitTypes = ['NEW', 'FOLLOW_UP', 'OLD'] as const;
    let n = 0;
    for (const [d, { day, when }] of days.entries()) {
      // Two a day, at times that shift from day to day.
      for (let k = 0; k < 2; k += 1) {
        const [hour, minute] = colleague.times[(d + k * 2) % colleague.times.length]!;
        const scheduledAt = new Date(day);
        scheduledAt.setHours(hour, minute, 0, 0);
        const at = (offsetMin: number) => new Date(scheduledAt.getTime() + offsetMin * 60_000);
        // Past: finished, bar the odd no-show. Today: one in the queue, one booked.
        const status = when === 1 ? 'SCHEDULED' : when === 0 ? (k === 0 ? 'WAITING' : 'SCHEDULED') : n % 5 === 2 ? 'NO_SHOW' : 'DONE';

        await prisma.appointment.create({
          data: {
            practiceId: practice.id,
            doctorId: doctorUser.id,
            patientId: own[n % own.length]!,
            scheduledAt,
            endsAt: at(10),
            durationMinutes: 10,
            status,
            visitType: visitTypes[n % visitTypes.length]!,
            tokenNumber: k + 1,
            plannedProcedures: ['Consultation'],
            ...(status === 'WAITING' ? { checkedInAt: new Date() } : {}),
            ...(status === 'DONE' ? { checkedInAt: at(-5), engagedAt: at(2), completedAt: at(12) } : {}),
          },
        });
        n += 1;
      }
    }
    colleagueLog.push(`${colleague.email}: ${own.length} patients, ${n} appointments added`);
  }

  const people2 = await seedUserTypes(practice.id, practice.name, users);

  console.log('\nSeed complete.');
  console.log(`  Practice : ${practice.name} (${practice.id})`);
  for (const a of ACCOUNTS) {
    console.log(`  ${a.role.padEnd(13)}: ${a.mobile}  /  ${a.password}   (${a.email})`);
  }
  console.log(`  ${people.length} patients and appointments created for today.`);
  console.log(
    alreadySeeded > 0
      ? '  Past and upcoming appointments already seeded (skipped).'
      : `  ${calendarAdded} past and upcoming appointments added.`,
  );
  for (const line of colleagueLog) console.log(`  ${line}.`);
  for (const line of people2) console.log(`  ${line}`);
  console.log(`  ${SEED_DRUGS.length} drugs in the catalogue (${freshDrugs.length} added now).\n`);
}

/** Removes demo doctors from before every doctor had a user and a phone number. */
async function removeOldDemoDirectoryData(): Promise<void> {
  const old = await prisma.doctorListing.findMany({
    where: { name: { startsWith: 'Dr. Demo ' } },
    select: { id: true, userId: true },
  });
  const ids = old.map((row) => row.id);
  await prisma.doctorReview.deleteMany({ where: { doctorId: { in: ids } } });
  await prisma.serialBooking.deleteMany({ where: { doctorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: old.map((row) => row.userId) } } });
  await prisma.hospital.deleteMany({ where: { name: 'Cura Demo Hospital' } });
}

/** One login per user type, so each can be tried. Never run this on a real database. */
async function account(input: {
  email: string;
  mobile: string;
  fullName: string;
  password: string;
  role: 'ADMINISTRATOR' | 'DOCTOR' | 'PUBLIC_USER';
}) {
  const verified = { mobileVerifiedAt: new Date(), emailVerifiedAt: new Date(), onboardingComplete: true };
  const passwordHash = await hash(input.password);
  return prisma.user.upsert({
    where: { email: input.email },
    update: { fullName: input.fullName, mobile: input.mobile, role: input.role, passwordHash, isActive: true, ...verified },
    create: { ...input, password: undefined, passwordHash, ...verified } as never,
    select: { id: true },
  });
}

async function doctorRecord(
  userId: string,
  data: { name: string; specialty: string; phone: string; bmdcNo: string; chamber: string; about?: string; fees?: number },
): Promise<void> {
  await prisma.userDirectoryRole.upsert({
    where: { userId_role: { userId, role: 'DOCTOR' } },
    update: {},
    create: { userId, role: 'DOCTOR' },
  });
  // Re-seeding corrects what the migration filled in with a default specialty.
  await prisma.user.update({ where: { id: userId }, data: { bmdcNumber: data.bmdcNo } });
  const place = { city: 'Dhaka', division: 'Dhaka' };
  await prisma.doctorListing.upsert({
    where: { userId },
    update: { ...data, ...place, hidden: false, pendingApproval: false, bmdcVerifiedAt: new Date() },
    create: { ...data, ...place, userId, followupFees: null, bmdcVerifiedAt: new Date() },
  });
}

async function seedUserTypes(
  practiceId: string,
  practiceName: string,
  users: Record<string, { id: string }>,
): Promise<string[]> {
  await removeOldDemoDirectoryData();

  // Clinic owners reach only their own clinic, so none of them is a super admin.
  const shahnaz = users['admin@cura.local']!;
  await prisma.userDirectoryRole.deleteMany({ where: { userId: shahnaz.id, role: 'SUPER_ADMIN' } });

  const superAdmin = await account({
    email: 'superadmin@cura.local',
    mobile: '+8801700000009',
    fullName: 'Cura Super Admin',
    password: 'CuraSuper123',
    role: 'PUBLIC_USER',
  });
  await prisma.userDirectoryRole.upsert({
    where: { userId_role: { userId: superAdmin.id, role: 'SUPER_ADMIN' } },
    update: {},
    create: { userId: superAdmin.id, role: 'SUPER_ADMIN' },
  });

  // The doctors already in Cura Demo Clinic, now also on Cura Website.
  for (const a of ACCOUNTS) {
    if (a.role !== 'DOCTOR') continue;
    await doctorRecord(users[a.email]!.id, {
      name: a.fullName,
      phone: a.mobile.replace(/^\+88/, ''),
      bmdcNo: a.bmdc,
      chamber: practiceName,
      ...DOCTOR_DETAILS[a.email]!,
    });
  }

  // Added by an admin with no login: log in with 01711111114 to see the sign-up.
  const noLogin = await prisma.user.upsert({
    where: { mobile: '+8801711111114' },
    update: {},
    create: {
      fullName: 'Dr Farzana Ahmed',
      mobile: '+8801711111114',
      bmdcNumber: 'A-100203',
      role: 'DOCTOR',
      onboardingComplete: true,
    },
    select: { id: true },
  });
  await prisma.userDirectoryRole.upsert({
    where: { userId_role: { userId: noLogin.id, role: 'DOCTOR' } },
    update: {},
    create: { userId: noLogin.id, role: 'DOCTOR' },
  });
  await prisma.doctorListing.upsert({
    where: { userId: noLogin.id },
    update: {},
    create: {
      userId: noLogin.id,
      name: 'Dr Farzana Ahmed',
      specialty: 'Gynecology',
      phone: '01711111114',
      bmdcNo: 'A-100203',
      chamber: practiceName,
      city: 'Dhaka',
      division: 'Dhaka',
      followupFees: null,
    },
  });
  await prisma.practiceMembership.upsert({
    where: { practiceId_userId: { practiceId, userId: noLogin.id } },
    update: {},
    create: { practiceId, userId: noLogin.id, role: 'DOCTOR' },
  });

  // A second clinic. Its owner also owns an ambulance service and a pharmacy.
  const secondClinicId = '22222222-2222-4222-8222-222222222222';
  const secondClinicName = 'Cura Uttara Clinic';
  await prisma.practice.upsert({
    where: { id: secondClinicId },
    update: {},
    create: {
      id: secondClinicId,
      name: secondClinicName,
      specialization: 'Family Medicine',
      contactNumber: '+8801700000010',
      address: 'House 8, Road 3, Sector 7, Uttara, Dhaka',
      slotMinutes: 15,
      sessions: {
        create: [0, 1, 2, 3, 4].map((dayOfWeek) => ({ dayOfWeek, startTime: '10:00', endTime: '20:00' })),
      },
    },
  });
  const secondOwner = await account({
    email: 'owner2@cura.local',
    mobile: '+8801700000011',
    fullName: 'Tanzila Ahmed',
    password: 'CuraAdmin123',
    role: 'ADMINISTRATOR',
  });
  await prisma.practiceMembership.upsert({
    where: { practiceId_userId: { practiceId: secondClinicId, userId: secondOwner.id } },
    update: { role: 'ADMINISTRATOR' },
    create: { practiceId: secondClinicId, userId: secondOwner.id, role: 'ADMINISTRATOR' },
  });
  for (const role of ['AMBULANCE_OWNER', 'PHARMACY_OWNER'] as const) {
    await prisma.userDirectoryRole.upsert({
      where: { userId_role: { userId: secondOwner.id, role } },
      update: {},
      create: { userId: secondOwner.id, role },
    });
  }

  // A doctor of the second clinic, and one who works at both.
  const secondDoctor = await account({
    email: 'doctor4@cura.local',
    mobile: '+8801711111115',
    fullName: 'Dr Rumana Haque',
    password: 'CuraDoctor123',
    role: 'DOCTOR',
  });
  await doctorRecord(secondDoctor.id, {
    name: 'Dr Rumana Haque',
    specialty: 'Dermatology',
    phone: '01711111115',
    bmdcNo: 'A-100204',
    chamber: secondClinicName,
    about: 'Skin, hair and allergy care.',
    fees: 900,
  });
  for (const userId of [secondDoctor.id, users['doctor2@cura.local']!.id]) {
    await prisma.practiceMembership.upsert({
      where: { practiceId_userId: { practiceId: secondClinicId, userId } },
      update: { role: 'DOCTOR' },
      create: { practiceId: secondClinicId, userId, role: 'DOCTOR' },
    });
  }

  // An ambulance owner who owns nothing else.
  const ambulanceOwner = await account({
    email: 'ambulance@cura.local',
    mobile: '+8801700000012',
    fullName: 'Rafiq Mia',
    password: 'CuraOwner123',
    role: 'PUBLIC_USER',
  });
  await prisma.userDirectoryRole.upsert({
    where: { userId_role: { userId: ambulanceOwner.id, role: 'AMBULANCE_OWNER' } },
    update: {},
    create: { userId: ambulanceOwner.id, role: 'AMBULANCE_OWNER' },
  });
  await prisma.ambulanceVendor.upsert({
    where: { slug: 'cura-demo-ambulance' },
    update: { ownerId: ambulanceOwner.id },
    create: {
      slug: 'cura-demo-ambulance',
      name: 'Cura Demo Ambulance',
      phones: ['01700000012'],
      categories: ['ac'],
      dhakaWide: true,
      ownerId: ambulanceOwner.id,
    },
  });

  const pharmacyOwner = await account({
    email: 'pharmacy@cura.local',
    mobile: '+8801700000013',
    fullName: 'Selina Parvin',
    password: 'CuraOwner123',
    role: 'PUBLIC_USER',
  });
  await prisma.userDirectoryRole.upsert({
    where: { userId_role: { userId: pharmacyOwner.id, role: 'PHARMACY_OWNER' } },
    update: {},
    create: { userId: pharmacyOwner.id, role: 'PHARMACY_OWNER' },
  });

  // Something to manage on Cura Dashboard for each kind of owner.
  await prisma.ambulanceVendor.upsert({
    where: { slug: 'uttara-demo-ambulance' },
    update: { ownerId: secondOwner.id },
    create: {
      slug: 'uttara-demo-ambulance',
      name: 'Uttara Demo Ambulance',
      phones: ['01700000011'],
      categories: ['non_ac'],
      ownerId: secondOwner.id,
    },
  });
  for (const [id, ownerId, name, city] of [
    ['33333333-3333-4333-8333-333333333331', pharmacyOwner.id, 'Cura Demo Pharmacy', 'Dhaka'],
    ['33333333-3333-4333-8333-333333333332', secondOwner.id, 'Uttara Demo Pharmacy', 'Dhaka'],
  ] as const) {
    await prisma.pharmacy.upsert({
      where: { id },
      update: { ownerId },
      create: { id, ownerId, name, city, phones: ['01700000013'], openingHours: '9:00 AM - 10:00 PM', homeDelivery: true },
    });
  }

  // A hospital owner, linked to one demo hospital they edit under My Hospital.
  const hospitalOwner = await account({
    email: 'hospital@cura.local',
    mobile: '+8801700000014',
    fullName: 'Kamrul Hasan',
    password: 'CuraOwner123',
    role: 'PUBLIC_USER',
  });
  await prisma.userDirectoryRole.upsert({
    where: { userId_role: { userId: hospitalOwner.id, role: 'HOSPITAL_OWNER' } },
    update: {},
    create: { userId: hospitalOwner.id, role: 'HOSPITAL_OWNER' },
  });
  await prisma.hospital.upsert({
    where: { id: '44444444-4444-4444-8444-444444444441' },
    update: { ownerId: hospitalOwner.id },
    create: {
      id: '44444444-4444-4444-8444-444444444441',
      name: 'Cura Demo Hospital',
      location: 'Dhaka',
      division: 'Dhaka',
      address: 'House 12, Road 5, Dhanmondi, Dhaka',
      hotline: '01700000014',
      type: 'hospital',
      openingHours: '24/7',
      ownerId: hospitalOwner.id,
    },
  });

  // A patient on Cura Website who joined both clinics.
  const patient = await account({
    email: 'patient@cura.local',
    mobile: '+8801800000001',
    fullName: 'Sadia Rahman',
    password: 'CuraPatient123',
    role: 'PUBLIC_USER',
  });
  await prisma.userDirectoryRole.upsert({
    where: { userId_role: { userId: patient.id, role: 'PATIENT' } },
    update: {},
    create: { userId: patient.id, role: 'PATIENT' },
  });
  const patientAccount = await prisma.patientAccount.upsert({
    where: { userId: patient.id },
    update: {},
    create: { userId: patient.id, name: 'Sadia Rahman' },
    select: { id: true },
  });
  let joined = 0;
  for (const clinicId of [practiceId, secondClinicId]) {
    const existing = await prisma.patient.count({ where: { practiceId: clinicId, accountId: patientAccount.id } });
    if (existing) continue;
    const curaIds = await prisma.patient.count();
    await prisma.patient.create({
      data: {
        practiceId: clinicId,
        accountId: patientAccount.id,
        curaId: `CURA-W${String(curaIds + 1).padStart(5, '0')}`,
        fullName: 'Sadia Rahman',
        mobile: '+8801800000001',
        email: 'patient@cura.local',
        searchName: 'sadia rahman',
      },
    });
    joined += 1;
  }

  return [
    'SUPER_ADMIN  : superadmin@cura.local  /  CuraSuper123',
    'SECOND OWNER : owner2@cura.local  /  CuraAdmin123   (also ambulance and pharmacy owner)',
    'DOCTOR       : doctor4@cura.local  /  CuraDoctor123   (Cura Uttara Clinic)',
    'NO LOGIN YET : 01711111114, BMDC A-100203   (Dr Farzana Ahmed)',
    'AMBULANCE    : ambulance@cura.local  /  CuraOwner123',
    'PHARMACY     : pharmacy@cura.local  /  CuraOwner123',
    `PATIENT      : patient@cura.local  /  CuraPatient123   (joined ${joined} clinic(s) now)`,
  ];
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
