# Cura — Run and Check Guide

## What you can do in Cura right now

- Log in, or register a new doctor account with a code sent to the phone
- Reset a forgotten password with a code sent to your mobile or email, on Cura Dashboard and Cura Website
- Move between Cura Website and Cura Dashboard without logging in again
- Complete the 4-step new-doctor setup (personal, professional, academic, documents)
- As a new clinic owner, follow **Get your clinic ready** on the Calendar: clinic details, opening hours, a doctor,
  prices, front desk staff (optional) and a first patient, each one click away
- See the calendar by day, 3 days, week or month, and book an appointment by clicking an empty time
- Drag an appointment to a new time
- Check patients in, start the visit, finish the visit, mark them as no-show, or cancel the visit
- See serials patients book on Cura Website in the clinic's calendar, marked **Booked on Cura Website**; cancelling or
  finishing the visit on either side updates the other
- Add a new patient or a walk-in from the top bar
- Search any patient by name, phone or Cura ID
- Open a patient's record: vitals, clinical notes, prescriptions, files and bills
- Watch today's queue on a board (Booked, Waiting, With doctor, Done)
- See upcoming follow-ups and birthdays
- Record patient ratings and reply to them
- Create invoices and take payments
- As a patient on Cura Website, see your own visits, prescriptions, vital signs, invoices and upcoming clinic
  appointments from the clinics you joined, on **My health**, and print a prescription
- Find a pharmacy on Cura Website by name or area, see which ones deliver, see which medicines they have in stock,
  and call them
- As a patient, send a prescription from **My health** to a pharmacy, follow its status (waiting, ready for pickup,
  collected, cannot fill) and cancel it while the pharmacy has not started
- As a patient on Cura Website, request an ambulance from **Find Ambulance** (pickup address, destination, phone,
  now or a later time, and a note), follow it under **My ambulance requests** with the service's message, and cancel
  it while it is new or accepted. Calling stays on every card, because in an emergency calling is faster
- As an ambulance owner, see the requests for your services on **My Ambulances** and accept them (with a message such
  as when you will arrive), mark them completed or decline them
- As a pharmacy owner, see whether patients can see your pharmacy yet; a super admin shows or hides it
- As a pharmacy owner, keep your medicine stock list (name, strength, form, price, in stock) and handle the
  prescriptions patients send you, on **My Pharmacy**
- As a hospital owner, edit your hospital or diagnostic centre's details on Cura Dashboard (**My Hospital**); patients
  see the change on Cura Website at once
- As a super admin, link a hospital or diagnostic centre to its owner's account
- As a super admin, see everything people did across Cura on **Super Admin → Activity log**: filter by date, action,
  person, clinic or a search word, open a row for its details, and download the list as a CSV file (up to 5,000 rows)
- As a clinic owner, see who did what in your clinic on **Settings → Activity log**, including each time a Cura super
  admin looked at your clinic's data. Doctors and clinic staff do not see it
- Upload and view patient documents
- View statistics: income, appointments, top procedures, patient mix
- Change clinic settings: clinic details, hours, staff, prices, drugs, note templates, printouts, messages, security
- Edit your own profile and password
- Switch between light and dark mode
- Use Cura Dashboard in Bangla: switch **English / বাংলা** on the login page, in the menu under your name, or on
  **Profile**; the choice is saved to your account. Every screen is in Bangla, including Super Admin and the owner
  screens; names of people, places and medicines stay as they were typed

Not available yet: Community, Integrations (Practo and others), Facebook sign-up, login with a code instead of a
password, and text messages to patients.

## Open Cura

1. Open Chrome or Safari.
2. Go to **https://cura-web-qvfx.onrender.com** for Cura Dashboard, or **https://cura-user-frontend.onrender.com** for
   Cura Website.

## Login details

On the welcome page, stay on the **Login** tab, type the email (or mobile) and password, click **Login**.

| Role | Name | Email | Mobile | Password | Sees |
| --- | --- | --- | --- | --- | --- |
| Administrator | Shahnaz Rahman | admin@cura.local | 01700000001 | CuraAdmin123 | Everything |
| Doctor | Dr Ariful Islam | doctor@cura.local | 01711111111 | CuraDoctor123 | Clinical work; no booking, Settings or Billing changes |
| Doctor | Dr Nadia Karim | doctor2@cura.local | 01711111112 | CuraDoctor123 | Same as Doctor |
| Doctor | Dr Sajid Hasan | doctor3@cura.local | 01711111113 | CuraDoctor123 | Same as Doctor |
| Desk staff | Rekha Sultana | desk@cura.local | 01700000003 | CuraDesk123 | Booking, patients, billing; no Settings or Statistics |
| Desk staff | Mitu Akter | desk2@cura.local | 01700000004 | CuraDesk123 | Same as Desk staff |
| Desk staff | Jahid Hasan | desk3@cura.local | 01700000005 | CuraDesk123 | Same as Desk staff |

The other user types used in the checks below, and where each one logs in. They work on the live site and on your
local copy unless the row says otherwise. **CREDENTIALS.md** lists every account.

| User type | Name | Email or mobile | Password | Logs in on |
| --- | --- | --- | --- | --- |
| Super admin, also owner of Cura Demo Clinic | Shahnaz Rahman | admin@cura.local | CuraAdmin123 | Cura Website and Cura Dashboard |
| Clinic owner of Cura Dhanmondi Clinic | Farhana Yasmin | owner1@cura.local | CuraAdmin123 | Cura Dashboard |
| Doctor at Cura Dhanmondi Clinic | Dr Rumana Haque | doctor01@cura.local | CuraDoctor123 | Cura Website and Cura Dashboard |
| Ambulance owner of BD Ambulance | Rafiq Mia | ambulance1@cura.local | CuraOwner123 | Cura Dashboard |
| Pharmacy owner of Cura Demo Pharmacy (your local copy only) | Selina Parvin | pharmacy1@cura.local | CuraOwner123 | Cura Dashboard |
| Patient at Cura Dhanmondi Clinic | Mahbub Ahmed | patient01@cura.local | CuraPatient123 | Cura Website |
| Doctor with no login yet (freshly seeded database only) | Dr Farzana Ahmed | 01711111114 | Signs up with BMDC A-100203 | Cura Dashboard |

There are no pharmacy or hospital owners on the live site yet: make one as in **Pharmacies on Cura Website** and
**My Hospital** below.

A patient cannot log in on Cura Dashboard, but appears there as a patient at each clinic they chose on Cura Website.

The calendar shows all three doctors' appointments together. Dr Nadia Karim's are in the morning and early afternoon; Dr Sajid Hasan's are in the afternoon and evening.

After 10 login attempts in 15 minutes Cura says **Too many attempts**. Wait 15 minutes and try again.

## Who can do what

✅ = can do it · 👁 = can view only · — = not shown

| What | Administrator | Doctor | Desk staff |
| --- | --- | --- | --- |
| View the calendar | ✅ | ✅ | ✅ |
| Book an appointment (empty slot, **+ Add Patient**, walk-in) | ✅ | — | ✅ |
| Drag an appointment to a new time / edit its time | ✅ | — | ✅ |
| Check in, Engage, Check out, No show | ✅ | ✅ | ✅ |
| Block Calendar, Calendar settings link | ✅ | — | — |
| Patient Management (queue board) | ✅ | ✅ | ✅ |
| Search and open patients | ✅ | ✅ | ✅ |
| Edit a patient's profile | ✅ | ✅ | ✅ |
| See a patient's clinical history | ✅ | ✅ | — |
| Unlock history older than 90 days (patient's code) | ✅ | ✅ | — |
| Vital signs, clinical notes, prescription, sign visit | ✅ | ✅ | — |
| Upload and view patient files (Documents) | ✅ | ✅ | ✅ |
| Billing: view invoices | ✅ | 👁 | ✅ |
| Billing: new invoice, collect payment | ✅ | — | ✅ |
| Statistics | ✅ | ✅ | — |
| Communication: follow-ups and birthdays | ✅ | ✅ | ✅ |
| Communication: SMS & email settings | ✅ | — | — |
| Feedback: view, record, reply | ✅ | ✅ | ✅ |
| Settings (clinic, staff, prices, drugs, templates, printouts…) | ✅ | — | — |
| Settings → Activity log (who did what in the clinic) | ✅ | — | — |
| Integrations, Prime Services | ✅ | — | — |
| Community | ✅ | ✅ | ✅ |
| Own profile and password | ✅ | ✅ | ✅ |

## Check every screen

Log in as **Administrator** unless a step says otherwise. The menu is the list on the left.

### Welcome page

1. Click **Register**. Click **Register** (the dark button) with the form empty: red messages appear under the fields.
2. Fill in your own mobile number, a BMDC number, a full name, and a password twice (8+ characters, upper- and lowercase letters and a number). Click **Register**.
3. A **Verification code** box appears. Ask the developer for the code, type it, click **Verify**.
4. The 4-step setup opens. Fill each step and click **Next**, or click **Skip** on steps 2–4. Click **Finish** at the end.
5. Click **Log out** at the bottom of the left menu, then **Log out** in the box. Log in again as Administrator.

### Forgot password

Use an account you made for testing, so the demo passwords above keep working.

1. On the welcome page of Cura Dashboard, click **Forgot password?** under the password box.
2. Type the account's mobile number or email and click **Send code**. Ask the developer for the code (it is in the Cura API log).
3. Type the code, a new password twice, and click **Change password**. Cura logs you in. Every other device that was logged in is logged out.
4. Log out and log in again with the new password.
5. Type a wrong code instead: **That code is wrong or has expired** appears. An email or number with no account shows the same **Choose a new password** step, and no code arrives.
6. On Cura Website, click **Login**, then **Forgot password?**, and repeat steps 2–4. Switch to **বাং** at the top: the page is in Bangla.

A patient who resets on Cura Dashboard is told to log in on Cura Website. A doctor a clinic added who has no password yet is sent to finish signing up instead.

### Bangla on Cura Dashboard

1. On the welcome page, click **বাংলা** at the top right. The page turns to Bangla. Click **লগ ইন** with the boxes
   empty: the red messages are in Bangla too.
2. Log in as owner1@cura.local. The left menu, top bar, Calendar and the **Get your clinic ready** card are in
   Bangla, with Bangla digits in dates and times.
3. Reload the page. It stays in Bangla.
4. Open the menu under your name: **ভাষা** shows **English / বাংলা**. Click **প্রোফাইল** in the left menu: the
   same switch is under **ভাষা**.
5. Open Cura Dashboard in a private window and log in as owner1@cura.local again. It opens in Bangla, because the
   choice is saved to the account.
6. Open the menu under your name and click **English**. Everything turns back to English, and the next login is in
   English too.

### Switch between Cura Website and Cura Dashboard

1. On Cura Website, click **Login** and log in as doctor01@cura.local. At the top, click **Open Cura Dashboard**.
2. Cura Dashboard opens on the calendar, already logged in as Dr Rumana Haque. The address bar shows no code.
3. Click your name at the top right, then **Open Cura Website**. Cura Website opens on **Doctor Dashboard**, logged in.
4. Repeat with admin@cura.local: it opens **Super Admin** on Cura Website and the clinic calendar on Cura Dashboard.
5. Log in on Cura Website as patient01@cura.local: there is no **Open Cura Dashboard** button.
6. Each link works once, for one minute. A used or older link opens the login page with **This link has expired**.

### Calendar

1. Click **Calendar** in the menu.
2. At the top right, click **Day**, **3 Day**, **Week**, **Month** in turn.
3. Click **Day**, then click any patient name in the middle. Their details appear on the right.
4. On the right, click **Check in**, then **Engage**, then **Check out**.
5. Click an empty time in the middle. A new-appointment form opens with that time filled in. Click **×** to close.
6. Drag a patient name to another time. Click **Move** in the box that appears.
7. On the left, click **›** next to the month name, then click any date. The middle jumps to that date. Click **Today**.
8. On the left, click the box under **Show schedule for** and choose **Dr Nadia Karim**. Only her appointments stay. Open the box again and choose **All doctors**. Each card now has a coloured dot matching its doctor's colour in that list.
9. In the same box, choose **Dr Sajid Hasan**, then click **+ Add Walk-in Appointment**. The **Doctor** box in the form already says Dr Sajid Hasan. Click **Cancel**, then choose **All doctors** again.
10. Click **Settings ▾** at the top right. Tick **Show cancelled appointments**. Click **Calendar settings…**.
11. Back in **Calendar**, click **Block Calendar** on the left, choose a date, save.
12. On the right, click **+ Add Walk-in Appointment**, choose a **Doctor**, fill the form, click **Save**. The patient's record opens.

### Get your clinic ready

1. Log in as admin@cura.local. Click **Super Admin**, then **New clinic**. Fill in a clinic name, owner's name,
   mobile, email and a temporary password, and click **Create clinic and owner**. Log out.
2. Log in as the new owner (the login code is in the Cura API console). The Calendar shows **Get your clinic ready**
   with **0 of 5 done**.
3. Click **Add details**. Fill in **Address line 1** and **Specialization**, click **Save**, then click **Calendar**.
   **Clinic details** now says **Done** and the count is **1 of 5 done**.
4. Click **Set prices**, then **Add the standard three**. Back in **Calendar**, **Set prices** says **Done**.
5. Click **Book patient**. The new-patient form opens. Close it.
6. Click **Hide for now**. The card goes away, also after a reload. Open the menu under your name and click
   **Setup checklist**. The card is back.
7. When every step except the optional front desk step is done, the card says **Your clinic is ready** once, then
   stays away. **Setup checklist** shows it again.
8. Log in as owner1@cura.local. The card shows **4 of 5 done** (Cura Dhanmondi Clinic has no prices yet).
9. Doctors, clinic staff and a super admin viewing a clinic read-only never see the card.

### Website booking reaches the clinic

Online booking must be switched on in the Cura API (it is, unless `DIRECTORY_BOOKING_ENABLED=false`).

1. On Cura Website, log in as patient01@cura.local. Search for **Dr Tanvir Hossain** and open his profile.
2. Under **Book serial**, choose a day (not Friday), click **Book serial** next to the Cura Dhanmondi Clinic session,
   then **Confirm serial**. The green box says **Cura Dhanmondi Clinic can see this booking in their calendar.**
3. On Cura Dashboard, log in as owner1@cura.local. Click **Calendar**, then **Day**, and go to that day. The patient
   is at the session's start, or one slot later per earlier serial. Click the name: the details show
   **Booked on Cura Website** and the serial in **Notes**.
4. Click **Cancel visit**. The status becomes **cancelled**.
5. On Cura Website, click **My Appointments**. The serial is under **Past & cancelled**, marked **Cancelled**.
6. Book again, and on Cura Dashboard click **Check in**, **Engage**, **Check out**. On Cura Website the serial shows
   **Completed**, and the patient can rate the visit. A **No show** shows it as cancelled.
7. A doctor who is not on a clinic on Cura (or a session at a hospital) still books on Cura Website only. A patient
   with no mobile number is booked on Cura Website only, and told to add a number.

### My health on Cura Website

1. On Cura Dashboard, log in as owner1@cura.local. Click **+ Add Patient**, type `01812000001`, click **Mahbub Ahmed**
   under the matching profiles, choose **Dr Rumana Haque** as the doctor, pick a time today and click **Save**.
2. Log out and log in as doctor01@cura.local. Search `01812000001`, open Mahbub Ahmed and click **Start visit**. Fill
   **Vital signs**, **Clinical notes** and **Prescription** (pick the drug from the list), then click
   **Sign & complete visit**.
3. Log in as owner1@cura.local again. Open Mahbub Ahmed, click the **Billing** tab, then **New invoice**. Add a line and
   click **Create**. In **Billing**, click the invoice and record a part payment.
4. On Cura Website, log in as patient01@cura.local. Click **My Appointments**, then **My health**.
5. The visit shows under today's date with the doctor, clinic, complaints, diagnosis, vital signs, advice and the
   prescription (dose as morning + noon + night, meal, days, tests and next visit). The doctor's **Notes** and
   **Observations** do not show. Click **Print** next to the prescription: only that prescription prints.
6. Under **Invoices**, the invoice shows its items, total, paid amount, amount due and **Partly paid**.
7. A visit that is not signed yet does not show. Switch to **বাং** at the top: the page is in Bangla. On a phone,
   **My health** is also in the menu.
8. Use a test patient for this step, not patient01: click **My clinics** and leave a clinic. Its records disappear from
   **My health**. Joining again makes a new clinic record, so the old visits stay hidden.

### Pharmacies on Cura Website

1. On Cura Dashboard, log in as admin@cura.local. Click **Super Admin**, then **Users and roles**, then **New account**.
   Make a test account, and in it tick **Pharmacy owner**.
2. Log out and log in as the test account. **My Pharmacy** opens. Click **Add**, fill the name, phone, address and city,
   tick **Home delivery**, click **Save**. **On Cura Website** says **Waiting for an admin**.
3. On Cura Website, click **Pharmacies** at the top. The new pharmacy is not there yet.
4. On Cura Dashboard, log in as admin@cura.local. Click **Super Admin**, then **Pharmacies**. The pharmacy says
   **Hidden**. Click **Show** next to it: it says **Visible**. (The Cura Website admin panel has the same switch under
   **Pharmacies**.)
5. On Cura Website, reload **Pharmacies**. The pharmacy is there. Type part of its area in the search box, tick
   **Home delivery**: it stays. Click **Call**: the phone app opens with its number. Switch to **বাং**: the page is in
   Bangla.
6. As the test account on Cura Dashboard, **My Pharmacy** now says **Visible**.

### Prescription pickup and medicine stock

On your local copy, the pharmacy owner pharmacy1@cura.local (password `CuraOwner123`) owns **Cura Demo Pharmacy**,
which patients can see. Mahbub Ahmed (patient01@cura.local) already has signed prescriptions; if not, make one as in
**My health on Cura Website** above.

1. On Cura Dashboard, log in as pharmacy1@cura.local and click **My Pharmacy**. Under **Medicines in stock**, click
   **Add medicine**, type `Napa`, strength `500 mg`, form `Tablet`, price `1.5`, and click **Save**. Add a second one
   and click its **In stock** button: it says **Out of stock**.
2. On Cura Website, click **Pharmacies**, find **Cura Demo Pharmacy** and click **See medicines in stock**. Napa shows
   with its price; the out-of-stock one does not. With six or more medicines, a search box appears.
3. Log in on Cura Website as patient01@cura.local and open **My health**. Under a prescription, click **Send to a
   pharmacy**, search `Cura Demo`, pick **Cura Demo Pharmacy**, add a note and click **Send**. **My pharmacy orders**
   appears at the top with **Waiting for the pharmacy** and a **Cancel order** button, and the prescription says
   **Sent to Cura Demo Pharmacy**.
4. On Cura Dashboard, as pharmacy1@cura.local, click **Refresh** under **Prescription orders**. The order shows the
   time, Mahbub Ahmed's name and phone, the medicines with their doses, the doctor and the note. It shows nothing else
   from the visit. Click **Ready for pickup**.
5. Reload **My health** on Cura Website: the order says **Ready for pickup**, and **Cancel order** is gone.
6. On Cura Dashboard, click **Collected**; the order leaves the **Open** list and shows under **All**. Send another
   order and click **Cannot fill** instead, type a reason and confirm: the patient sees the reason on **My health**.
7. Send one more and click **Cancel order** on Cura Website: Cura Dashboard shows **Cancelled by patient** under
   **All**, with no buttons.
8. Switch to **বাং** on both: the new screens are in Bangla.

### Ambulance requests

Only services with an owner show **Request this ambulance**. ambulance1@cura.local (password `CuraOwner123`) owns
**BD Ambulance**, on the live site and on your local copy.

1. On Cura Website, logged out, click **Find Ambulance**. On **BD Ambulance**, the call buttons are still there, with
   **In an emergency, call: it is faster.** under **Request this ambulance**. Click it: the form asks you to log in and
   shows **Call now**. Click **Log in** and log in as patient01@cura.local (`CuraPatient123`); you come back to the
   form.
2. The phone is filled in from the account. Click **Send request** with no pickup address: it says **Enter the pickup
   address.** Type `House 7, Road 2, Dhanmondi`, destination `Square Hospital`, a note, leave **Now** and click
   **Send request**. **My ambulance requests** appears at the top with **Waiting** and **Cancel request**. Try
   **Later**: the time picker allows up to 7 days ahead.
3. On Cura Dashboard, log in as ambulance1@cura.local and click **My Ambulances**. Under **Ambulance requests**, the
   request shows the time, Mahbub Ahmed with a phone link, **As soon as possible**, the pickup, destination and note.
   Click **Accept**, type `Arriving in 15 minutes` and click **Accept**: it says **Accepted** and **Your message: …**.
4. Reload **Find Ambulance** on Cura Website (it also refreshes itself every 30 seconds): the request says
   **Accepted** and **The ambulance service says: Arriving in 15 minutes**.
5. On Cura Dashboard click **Completed**: the request leaves **Open** and shows under **All**. On Cura Website it says
   **Completed** with no cancel button.
6. Send another request and click **Decline** on Cura Dashboard with a reason: the patient sees **Declined** and the
   reason. Send one more and click **Cancel request** on Cura Website: Cura Dashboard shows **Cancelled by patient**.
7. A patient can have 3 open requests at a time and one per service; a fourth says to cancel one first.
8. Switch to **বাং** on Cura Website and **বাংলা** on Cura Dashboard: the new screens are in Bangla.

### My Hospital

1. On Cura Dashboard, log in as admin@cura.local. Click **Super Admin**, then **Users and roles**, then **New account**,
   and make a test account.
2. In the account, under **Businesses**, choose a place in **Link a hospital or diagnostic centre** and click the
   **Link** next to it. The place shows above the box, and **Hospital owner** is ticked under **Roles**.
3. Log out and log in as the test account. **My Hospital** opens. Click **Edit** next to the place. There is no type,
   map pin or photo: only a super admin changes those.
4. Change the **Hotline** and click **Save**. The table shows the new hotline.
5. On Cura Website, open that hospital (**Find Hospital**, or **Diagnostic Centres** for a centre). The new hotline is
   there. Also check **Open Cura Dashboard** shows at the top when logged in as the test account.
6. As admin@cura.local, click **Unlink** next to the place in the account to take it away again.

### Add a patient and search

1. Click **+ Add Patient** at the top. Fill mobile, name and age. Click **Save**.
2. The new patient's record opens on the **Charting** tab, with **Vital signs**, **Clinical notes** and **Prescription** ready.
3. Click **← Back**. Click the search bar at the top, type the same name, click it in the list.
4. In **Charting**, click **Start visit — (time) appointment**.

### Patient record (visit and prescription)

Log in as **Administrator** or **Doctor**.

1. Click **Calendar**, then **Day**. Click a patient whose status is **Waiting** or **Scheduled** (for example Tanvir Ahmed). On the right, click **Check in** if it is shown.
2. On the right, click **Open patient record / Write prescription**. The record opens on the **Charting** tab and the patient becomes **Engaged**.
3. Fill **Vital signs** (weight, blood pressure, pulse, temperature). Click **Save vitals**.
4. Fill **Clinical notes** (complaints, observations, diagnosis, advice). Click **Save notes**.
5. In **Prescription**, type three letters of a drug (for example `nap`) and pick one from the list. Fill strength, morning / noon / night, meal and days. A new empty row appears below.
6. Type a test in **Investigations** and pick a **Follow-up date**.
7. Click **Save draft**.
8. Click **Sign & complete visit**. The record shows **Signed — read only** and the patient becomes **Done** on the calendar.
9. Click the **Files** tab, then the **Billing** tab.
10. Click **← Back**.

A record opened from search, with no appointment today, says **No open appointment today for this patient**. Desk staff see **Only a doctor or administrator can record a visit.**

### Patients

1. Click **Patients**. Click **All**, then **Recent (7d)**.
2. Type a name in the search box. Click a patient.

### Patient Management

1. Click **Patient Management**.
2. On a card under **Booked**, click **Check in**. It moves to **Waiting**.
3. Click **Call in**. It moves to **With doctor**. Click **Check out**. It moves to **Done**.

### Communication

1. Click **Communication**. Check **Follow-ups** and **Birthday wishes** (Farhana Islam appears in both).
2. Change **Next** to **7 days**, then back to **30 days**.
3. Click **SMS & email settings**. Turn a few switches on and off.

### Billing

1. Click **Billing**. Click **New invoice**.
2. Pick a patient, add a line, click **Save**.
3. Click the new invoice. Click **Collect payment**, enter an amount, save.

### Statistics

1. Click **Statistics**. Click **Income**, **Appointment volume**, **Top procedures**, **Demographics**.
2. Change **Range**.

### Documents

1. Click **Documents**. Click **Upload files**.
2. Pick a patient, choose a JPG, PNG or PDF from your computer, pick a category, upload.
3. Click the uploaded file to preview it.

### Feedback

1. Click **Feedback**. Click **+ Record feedback**.
2. Type `Nusrat` in the patient box, click **Nusrat Jahan**, click 4 stars, write a comment, click **Save**.
3. Under the new rating, click **Reply**, type a reply, click **Send reply**.
4. Click **Awaiting reply**, then **1 ★**, then **All**.

### Settings

Click **Settings**, then each item in the second menu:

1. **Premium** — view the plan.
2. **Practice Details** — change the clinic name, click **Save**. Click **Edit Practice Timings**.
3. **Practice Staff** — click **Add Doctor** or **Add Staff**, fill, save. Turn a person **Inactive** and back.
4. **Calendar** — change the appointment length, save.
5. **Communications** — turn SMS/Email switches on and off.
6. **Pricing Catalog** — click **Add treatment**, fill, save.
7. **Consent Forms** — click **Add consent form**, fill, save.
8. **Data Security** — view the options.
9. **Clinical Notes Catalog** — click **Complaints**, **Observation**, **Diagnosis**, **Advise**, **Notes**; add one.
10. **Drug Catalog** — search `napa`; click **Add Drug**, fill, save.
11. **Charting Templates** — click **Add template**, fill, save.
12. **Printouts** — change a setting, save.
13. **Emails** — view the settings.

### Activity log

1. Log in as admin@cura.local. Click **Super Admin**, then **Clinics**, and click **View records** next to **Cura
   Dhanmondi Clinic**. Look at its patients, then go back.
2. Click **Super Admin**, then **Activity log**. The newest rows are at the top: your sign-in and **Super admin looked
   at clinic data** for Cura Dhanmondi Clinic, one row for each part of the clinic's data that opened (appointments,
   patients and so on). Each row shows the time, the person (name, email, role), the action in plain words, what it
   was about and the clinic.
3. Pick **Cura Dhanmondi Clinic** under **Clinic** and click **Show**. Only that clinic's rows stay. Click **Details** on
   a row: it shows the action code and the stored details (never passwords, codes or tokens). Click **Hide**.
4. Type a name or email under **Person** and click **Show**. Click **Clear filters**. Click **Show more** at the bottom
   for older rows. Click **Download CSV** to save the list you filtered.
5. Log out. Log in as owner1@cura.local. Click **Settings**, then **Activity log**. Only Cura Dhanmondi Clinic's rows
   are listed, with no clinic filter. Pick **Super admin looked at clinic data** under **Action** and click **Show**:
   the rows from step 1 show Shahnaz Rahman, **Super admin**.
6. Switch to **বাংলা** in the menu under your name. The screen reads **অ্যাক্টিভিটি লগ**. Switch back to **English**.
7. Log out. Log in as doctor01@cura.local or desk@cura.local: **Settings** is not in the menu, so there is no activity
   log.

### Other menu items

1. **Integrations** — shows Practo and others as **Not connected**.
2. **Profile** — change your name, save. Change your password, save.
3. **Community** — shows **not built**.
4. **Prime Services** — shows the plan.

### Top bar

1. Click the **bell** — notifications.
2. Click **?** — help menu.
3. Click your name at the top right — try the switches; click **Account settings**.
4. Click the **moon** icon — dark mode. Click the **sun** — back to light.
5. Click **☰** at the top left — the menu shrinks. Click again — it opens.

### Other roles

1. Click **Log out**, confirm. Log in as **Doctor**. Check that **Settings** is missing and the calendar has no **+ Add Walk-in Appointment**.
2. Log out. Log in as **Desk staff**. Check that **Settings** and **Statistics** are missing.
3. Log out. Log in as **Dr Nadia Karim** (doctor2@cura.local), then as **Mitu Akter** (desk2@cura.local). Each works like the Doctor and Desk staff accounts above.
4. As Administrator, click **Calendar**, then **Week**. Check that the left panel lists three doctors under **Doctor** and that appointments for Fahim Rahman (Dr Nadia Karim) and Moushumi Das (Dr Sajid Hasan) appear.
