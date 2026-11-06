# Cura demo credentials

These accounts hold demo data only, and their passwords are public. Never use them for real patients.

Log in with either the email or the mobile number. There is one user table, so an account is the same on both front
ends. **Works on** says where its screens are.

- **Cura Dashboard:** https://cura-web-qvfx.onrender.com
- **Cura Website:** https://cura-user-frontend.onrender.com

The live and local databases hold different accounts, so check which section you need.

## What each role gets on Cura Website

All the live logins below can log in on Cura Website, but only super admins, doctors and patients get their own screens
there. Nobody needs a login to browse doctors, hospitals, diagnostic centres and ambulances.

| Role | Account to try | Lands on | What they can do |
| --- | --- | --- | --- |
| Patient | patient01@cura.local | My Appointments | Browse, join or leave clinics, view appointments and review completed visits |
| Doctor | doctor01@cura.local | Doctor Dashboard | Browse, edit their public profile, see profile stats and get a QR card |
| Super admin | admin@cura.local | Admin panel | Manage all website content and doctors, approve doctor sign-ups and create clinic owners |
| Clinic owner | owner1@cura.local | Home | Browse only; their screens are on Cura Dashboard |
| Clinic staff | desk@cura.local | Home | Browse only; their screens are on Cura Dashboard |

- **Super admin:** the admin panel covers hospitals, doctors, specialties, symptoms, ambulances, sample prices, the home
  page, site text, photo credits, appointments, verifications and owners.
- **Patients:** joining a clinic adds them to that clinic's patient list on Cura Dashboard. To join, open My Appointments
  and click **My clinics**.
- **Booking:** patients can only book online if booking is switched on in the API. A serial at a clinic on Cura also
  goes into that clinic's calendar on Cura Dashboard, where clinic staff can cancel, check out or mark it no-show.
- **Ambulance and pharmacy owners:** their screens are on Cura Dashboard, under **My Ambulances** and **My Pharmacy**.
  There are no pharmacy owners on the live database yet.

### Login rules

- **Patients:** Cura Website is the only place they can log in, because Cura Dashboard blocks them.
- **Super admin:** works on both front ends. On Cura Dashboard, **Super Admin** has the same tools as the Cura Website
  admin panel, plus users and roles, clinics and pharmacies. A super admin can open any clinic's records read-only from
  **Super Admin → Clinics**, and each view is recorded in the audit log.
- **Moving between the two:** an account that can use Cura Dashboard (doctor, clinic account, ambulance or pharmacy
  owner, super admin) logs in once. **Open Cura Dashboard** at the top of Cura Website and **Open Cura Website** in the
  Cura Dashboard account menu open the other one already logged in. The link works once, for one minute.
- **New doctors:** signing up on Cura Website sends them to Cura Dashboard. They cannot finish signing up on the live
  site yet, because Cura does not send real SMS.

## Accounts with more than one role

| Where | Name | Email | Roles |
| --- | --- | --- | --- |
| Live and your local copy | Shahnaz Rahman | admin@cura.local | Super admin and clinic owner of Cura Demo Clinic |
| Freshly seeded database only | Tanzila Ahmed | owner2@cura.local | Clinic owner of Cura Uttara Clinic, ambulance owner and pharmacy owner |

Every other account has one role. No account on the live database is both a clinic owner and an ambulance owner.
`owner2@cura.local` on the live database is a clinic owner only.

Dr Nadia Karim (`doctor2@cura.local`) has one role, but in a freshly seeded database works at two clinics.

## Live database

### Super admin

| User type | Name | Email | Mobile | Password | Works on |
| --- | --- | --- | --- | --- | --- |
| Super admin, also owner of Cura Demo Clinic | Shahnaz Rahman | admin@cura.local | 01700000001 | CuraAdmin123 | Both |

This password is public, so anyone can use this account. Replace it before real patients use Cura.

### Original demo accounts

| User type | Name | Clinic | Email | Mobile | Password | Works on |
| --- | --- | --- | --- | --- | --- | --- |
| Clinic owner | Shahnaz Rahman | Cura Demo Clinic | admin@cura.local | 01700000001 | CuraAdmin123 | Cura Dashboard |
| Doctor | Dr Ariful Islam | Cura Demo Clinic | doctor@cura.local | 01711111111 | CuraDoctor123 | Both |
| Doctor | Dr Nadia Karim | Cura Demo Clinic | doctor2@cura.local | 01711111112 | CuraDoctor123 | Both |
| Doctor | Dr Sajid Hasan | Cura Demo Clinic | doctor3@cura.local | 01711111113 | CuraDoctor123 | Both |
| Clinic staff | Rekha Sultana | Cura Demo Clinic | desk@cura.local | 01700000003 | CuraDesk123 | Cura Dashboard |
| Clinic staff | Mitu Akter | Cura Demo Clinic | desk2@cura.local | 01700000004 | CuraDesk123 | Cura Dashboard |
| Clinic staff | Jahid Hasan | Cura Demo Clinic | desk3@cura.local | 01700000005 | CuraDesk123 | Cura Dashboard |

### Clinic owners

Password for all: `CuraAdmin123`. Works on Cura Dashboard.

| Name | Clinic | Email | Mobile |
| --- | --- | --- | --- |
| Farhana Yasmin | Cura Dhanmondi Clinic | owner1@cura.local | 01700020001 |
| Tanzila Ahmed | Cura Uttara Clinic | owner2@cura.local | 01700020002 |
| Mahmudul Hasan | Cura Mirpur Clinic | owner3@cura.local | 01700020003 |
| Nasima Chowdhury | Cura Chattogram Clinic | owner4@cura.local | 01700020004 |
| Kamrul Islam | Cura Sylhet Clinic | owner5@cura.local | 01700020005 |

### Ambulance owners

Password for all: `CuraOwner123`. Works on Cura Dashboard, under **My Ambulances**.

| Name | Ambulance service | Email | Mobile |
| --- | --- | --- | --- |
| Rafiq Mia | BD Ambulance | ambulance1@cura.local | 01700030001 |
| Jamal Uddin | Dhaka Ambulance | ambulance2@cura.local | 01700030002 |
| Sharmin Nahar | National Ambulance Service (Mirpur) | ambulance3@cura.local | 01700030003 |
| Abdul Karim | Shihab Ambulance | ambulance4@cura.local | 01700030004 |

### Doctors

Password for all: `CuraDoctor123`. Works on both front ends.

| Name | Specialty | Clinic | Email | Mobile |
| --- | --- | --- | --- | --- |
| Dr Rumana Haque | Dermatology | Cura Dhanmondi Clinic | doctor01@cura.local | 01712000001 |
| Dr Imtiaz Rahman | Cardiology | Cura Dhanmondi Clinic | doctor02@cura.local | 01712000002 |
| Dr Sharmin Akter | Gynecology | Cura Dhanmondi Clinic | doctor03@cura.local | 01712000003 |
| Dr Tanvir Hossain | Orthopaedics | Cura Dhanmondi Clinic | doctor04@cura.local | 01712000004 |
| Dr Nusrat Jahan | Pediatrics | Cura Uttara Clinic | doctor05@cura.local | 01712000005 |
| Dr Rezaul Karim | General Physician | Cura Uttara Clinic | doctor06@cura.local | 01712000006 |
| Dr Lubna Sultana | Ophthalmology | Cura Uttara Clinic | doctor07@cura.local | 01712000007 |
| Dr Shafiqul Alam | ENT | Cura Uttara Clinic | doctor08@cura.local | 01712000008 |
| Dr Mehnaz Parvin | Gynecology | Cura Mirpur Clinic | doctor09@cura.local | 01712000009 |
| Dr Arif Mahmud | Pediatrics | Cura Mirpur Clinic | doctor10@cura.local | 01712000010 |
| Dr Sabina Yasmin | Nutrition & Dietetics | Cura Mirpur Clinic | doctor11@cura.local | 01712000011 |
| Dr Faisal Ahmed | General Surgery | Cura Mirpur Clinic | doctor12@cura.local | 01712000012 |
| Dr Jannatul Ferdous | Endocrinology | Cura Chattogram Clinic | doctor13@cura.local | 01712000013 |
| Dr Monirul Islam | Neurology | Cura Chattogram Clinic | doctor14@cura.local | 01712000014 |
| Dr Rokeya Begum | Psychiatry | Cura Chattogram Clinic | doctor15@cura.local | 01712000015 |
| Dr Habibur Rahman | Gastroenterology | Cura Chattogram Clinic | doctor16@cura.local | 01712000016 |
| Dr Tahmina Khatun | Nephrology | Cura Sylhet Clinic | doctor17@cura.local | 01712000017 |
| Dr Sohel Rana | Pulmonology | Cura Sylhet Clinic | doctor18@cura.local | 01712000018 |
| Dr Dilruba Hoque | Rheumatology | Cura Sylhet Clinic | doctor19@cura.local | 01712000019 |
| Dr Abdullah Al Mamun | Urology | Cura Sylhet Clinic | doctor20@cura.local | 01712000020 |

### Patients

Password for all: `CuraPatient123`. Works on Cura Website only. Each patient appears on Cura Dashboard under their clinic.

| Name | Clinic | Email | Mobile |
| --- | --- | --- | --- |
| Mahbub Ahmed | Cura Dhanmondi Clinic | patient01@cura.local | 01812000001 |
| Sumaiya Sarker | Cura Dhanmondi Clinic | patient02@cura.local | 01812000002 |
| Imran Haque | Cura Dhanmondi Clinic | patient03@cura.local | 01812000003 |
| Taslima Hossain | Cura Dhanmondi Clinic | patient04@cura.local | 01812000004 |
| Kamal Khan | Cura Dhanmondi Clinic | patient05@cura.local | 01812000005 |
| Sadia Uddin | Cura Dhanmondi Clinic | patient06@cura.local | 01812000006 |
| Sajjad Islam | Cura Dhanmondi Clinic | patient07@cura.local | 01812000007 |
| Rehana Chowdhury | Cura Dhanmondi Clinic | patient08@cura.local | 01812000008 |
| Jubayer Mia | Cura Dhanmondi Clinic | patient09@cura.local | 01812000009 |
| Moushumi Rahman | Cura Dhanmondi Clinic | patient10@cura.local | 01812000010 |
| Shahin Ahmed | Cura Dhanmondi Clinic | patient11@cura.local | 01812000011 |
| Anika Sarker | Cura Dhanmondi Clinic | patient12@cura.local | 01812000012 |
| Masud Haque | Cura Uttara Clinic | patient13@cura.local | 01812000013 |
| Rima Hossain | Cura Uttara Clinic | patient14@cura.local | 01812000014 |
| Arif Khan | Cura Uttara Clinic | patient15@cura.local | 01812000015 |
| Fatema Uddin | Cura Uttara Clinic | patient16@cura.local | 01812000016 |
| Rafiqul Islam | Cura Uttara Clinic | patient17@cura.local | 01812000017 |
| Nasrin Chowdhury | Cura Uttara Clinic | patient18@cura.local | 01812000018 |
| Fahim Mia | Cura Uttara Clinic | patient19@cura.local | 01812000019 |
| Lamia Rahman | Cura Uttara Clinic | patient20@cura.local | 01812000020 |
| Tareq Ahmed | Cura Uttara Clinic | patient21@cura.local | 01812000021 |
| Mitu Sarker | Cura Uttara Clinic | patient22@cura.local | 01812000022 |
| Nayeem Haque | Cura Uttara Clinic | patient23@cura.local | 01812000023 |
| Shirin Hossain | Cura Uttara Clinic | patient24@cura.local | 01812000024 |
| Rakib Khan | Cura Mirpur Clinic | patient25@cura.local | 01812000025 |
| Tania Uddin | Cura Mirpur Clinic | patient26@cura.local | 01812000026 |
| Ashraf Islam | Cura Mirpur Clinic | patient27@cura.local | 01812000027 |
| Farzana Chowdhury | Cura Mirpur Clinic | patient28@cura.local | 01812000028 |
| Zahid Mia | Cura Mirpur Clinic | patient29@cura.local | 01812000029 |
| Ayesha Rahman | Cura Mirpur Clinic | patient30@cura.local | 01812000030 |
| Mahbub Ahmed | Cura Mirpur Clinic | patient31@cura.local | 01812000031 |
| Sumaiya Sarker | Cura Mirpur Clinic | patient32@cura.local | 01812000032 |
| Imran Haque | Cura Mirpur Clinic | patient33@cura.local | 01812000033 |
| Taslima Hossain | Cura Mirpur Clinic | patient34@cura.local | 01812000034 |
| Kamal Khan | Cura Mirpur Clinic | patient35@cura.local | 01812000035 |
| Sadia Uddin | Cura Mirpur Clinic | patient36@cura.local | 01812000036 |
| Sajjad Islam | Cura Chattogram Clinic | patient37@cura.local | 01812000037 |
| Rehana Chowdhury | Cura Chattogram Clinic | patient38@cura.local | 01812000038 |
| Jubayer Mia | Cura Chattogram Clinic | patient39@cura.local | 01812000039 |
| Moushumi Rahman | Cura Chattogram Clinic | patient40@cura.local | 01812000040 |
| Shahin Ahmed | Cura Chattogram Clinic | patient41@cura.local | 01812000041 |
| Anika Sarker | Cura Chattogram Clinic | patient42@cura.local | 01812000042 |
| Masud Haque | Cura Chattogram Clinic | patient43@cura.local | 01812000043 |
| Rima Hossain | Cura Chattogram Clinic | patient44@cura.local | 01812000044 |
| Arif Khan | Cura Chattogram Clinic | patient45@cura.local | 01812000045 |
| Fatema Uddin | Cura Chattogram Clinic | patient46@cura.local | 01812000046 |
| Rafiqul Islam | Cura Chattogram Clinic | patient47@cura.local | 01812000047 |
| Nasrin Chowdhury | Cura Chattogram Clinic | patient48@cura.local | 01812000048 |
| Fahim Mia | Cura Sylhet Clinic | patient49@cura.local | 01812000049 |
| Lamia Rahman | Cura Sylhet Clinic | patient50@cura.local | 01812000050 |
| Tareq Ahmed | Cura Sylhet Clinic | patient51@cura.local | 01812000051 |
| Mitu Sarker | Cura Sylhet Clinic | patient52@cura.local | 01812000052 |
| Nayeem Haque | Cura Sylhet Clinic | patient53@cura.local | 01812000053 |
| Shirin Hossain | Cura Sylhet Clinic | patient54@cura.local | 01812000054 |
| Rakib Khan | Cura Sylhet Clinic | patient55@cura.local | 01812000055 |
| Tania Uddin | Cura Sylhet Clinic | patient56@cura.local | 01812000056 |
| Ashraf Islam | Cura Sylhet Clinic | patient57@cura.local | 01812000057 |
| Farzana Chowdhury | Cura Sylhet Clinic | patient58@cura.local | 01812000058 |
| Zahid Mia | Cura Sylhet Clinic | patient59@cura.local | 01812000059 |
| Ayesha Rahman | Cura Sylhet Clinic | patient60@cura.local | 01812000060 |

## Local database

Your local `cura` database is now a copy of the live database, taken on 2026-11-06, so the live accounts above work locally.

The accounts below come from `backend/prisma/seed.ts`. They exist only in a freshly seeded database, or in the old local
database kept as `cura_local_backup_20261106`.

| User type | Name | Clinic | Email | Mobile | Password | Works on |
| --- | --- | --- | --- | --- | --- | --- |
| Clinic owner | Shahnaz Rahman | Cura Demo Clinic | admin@cura.local | 01700000001 | CuraAdmin123 | Cura Dashboard |
| Clinic owner, also ambulance and pharmacy owner | Tanzila Ahmed | Cura Uttara Clinic | owner2@cura.local | 01700000011 | CuraAdmin123 | Cura Dashboard |
| Doctor | Dr Ariful Islam | Cura Demo Clinic | doctor@cura.local | 01711111111 | CuraDoctor123 | Both |
| Doctor | Dr Nadia Karim | Cura Demo Clinic and Cura Uttara Clinic | doctor2@cura.local | 01711111112 | CuraDoctor123 | Both |
| Doctor | Dr Sajid Hasan | Cura Demo Clinic | doctor3@cura.local | 01711111113 | CuraDoctor123 | Both |
| Doctor | Dr Rumana Haque | Cura Uttara Clinic | doctor4@cura.local | 01711111115 | CuraDoctor123 | Both |
| Clinic staff | Rekha Sultana | Cura Demo Clinic | desk@cura.local | 01700000003 | CuraDesk123 | Cura Dashboard |
| Clinic staff | Mitu Akter | Cura Demo Clinic | desk2@cura.local | 01700000004 | CuraDesk123 | Cura Dashboard |
| Clinic staff | Jahid Hasan | Cura Demo Clinic | desk3@cura.local | 01700000005 | CuraDesk123 | Cura Dashboard |
| Super admin | Cura Super Admin | None | superadmin@cura.local | 01700000009 | CuraSuper123 | Both |
| Ambulance owner | Rafiq Mia | None | ambulance@cura.local | 01700000012 | CuraOwner123 | Cura Dashboard |
| Pharmacy owner | Selina Parvin | None | pharmacy@cura.local | 01700000013 | CuraOwner123 | Cura Dashboard |
| Patient | Sadia Rahman | Cura Demo Clinic and Cura Uttara Clinic | patient@cura.local | 01800000001 | CuraPatient123 | Cura Website |

### Doctor with no login yet

Dr Farzana Ahmed (Cura Demo Clinic) has no password. To try the doctor sign-up, enter mobile 01711111114 on Cura
Dashboard and use BMDC number A-100203. The verification code is printed in the API log, because Cura does not send SMS yet.

## If a login stops working

After 10 login attempts in 15 minutes, Cura says **Too many attempts**. Wait 15 minutes and try again.

Do not run `npm run seed` on the live database or on a copy of it: it would overwrite `owner2@cura.local` and reset demo
passwords. Use it only on an empty database.
