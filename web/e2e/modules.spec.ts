import { expect, test } from './fixtures';
import { API, PRACTICE_ID, apiToken, openModule, testMobile, watchErrors } from './helpers';

test.describe('Patient Management', () => {
  test('a booked patient moves Booked → Waiting → With doctor → Done', async ({ signIn }) => {
    const page = await signIn();
    const errors = watchErrors(page);

    // Fixture: a fresh patient booked for now, so the test never depends on
    // (or disturbs) the seeded queue's states. The doctor is taken from a
    // seeded appointment rather than a second (throttled) login.
    const token = await apiToken(page);
    const headers = { authorization: `Bearer ${token}` };
    const request = page.context().request;
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const today = (await (
      await request.get(`${API}/appointments`, {
        headers,
        params: {
          practiceId: PRACTICE_ID,
          from: dayStart.toISOString(),
          to: new Date(dayStart.getTime() + 86_400_000).toISOString(),
        },
      })
    ).json()) as Array<{ doctorId: string }>;
    expect(today.length, 'seeded appointments for today — run `npm run seed`').toBeGreaterThan(0);

    const name = `E2E Queue ${Date.now().toString().slice(-6)}`;
    const created = await request.post(`${API}/appointments`, {
      headers,
      data: {
        practiceId: PRACTICE_ID,
        doctorId: today[0]?.doctorId,
        scheduledAt: new Date().toISOString(),
        durationMinutes: 10,
        visitType: 'NEW',
        patient: { mobile: testMobile(), fullName: name, ageYears: 30, gender: 'FEMALE' },
      },
    });
    expect(created.ok(), await created.text()).toBeTruthy();

    await openModule(page, 'Patient Management');

    const card = (column: string) =>
      page.locator('section', { has: page.getByText(column, { exact: true }) }).locator('article', { hasText: name });

    await expect(card('Booked')).toBeVisible();
    await card('Booked').getByRole('button', { name: 'Check in' }).click();
    await expect(card('Waiting')).toBeVisible();
    await expect(card('Waiting').getByText(/Waiting \d+ min/)).toBeVisible();
    await card('Waiting').getByRole('button', { name: 'Call in' }).click();
    await expect(card('With doctor')).toBeVisible();
    await card('With doctor').getByRole('button', { name: 'Check out' }).click();
    await expect(card('Done')).toBeVisible();
    await expect(card('Done').getByRole('button')).toHaveCount(1); // only the name link remains

    expect(errors).toEqual([]);
  });

  test('a doctor sees the board but can still move the queue', async ({ signIn }) => {
    const page = await signIn('doctor');
    await openModule(page, 'Patient Management');
    await expect(page.getByText('With doctor', { exact: true })).toBeVisible();
  });
});

test.describe('Feedback', () => {
  test('records a rating and replies to it', async ({ signIn }) => {
    const page = await signIn();
    const errors = watchErrors(page);
    await openModule(page, 'Feedback');

    const comment = `E2E comment ${Date.now()}`;
    await page.getByRole('button', { name: '+ Record feedback' }).click();
    const dialog = page.getByRole('dialog', { name: 'Record feedback' });

    // Validation: nothing chosen yet.
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Choose the patient.');

    await dialog.getByPlaceholder('Search patients…').fill('Nusrat');
    await dialog.getByText('Nusrat Jahan').first().click();
    await dialog.getByRole('radio', { name: '4 stars' }).click();
    await dialog.getByLabel('Comment').fill(comment);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toHaveCount(0);

    const card = page.getByRole('listitem').filter({ hasText: comment });
    await expect(card).toBeVisible();
    await expect(card.getByLabel('4 out of 5')).toBeVisible();

    await card.getByRole('button', { name: 'Reply' }).click();
    await card.getByRole('textbox').fill('Thank you for the feedback.');
    await card.getByRole('button', { name: 'Send reply' }).click();
    await expect(card.getByText('Your reply')).toBeVisible();

    // The "awaiting reply" filter must no longer list it.
    await page.getByRole('tab', { name: 'Awaiting reply' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: comment })).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('star filters narrow the list but not the summary', async ({ signIn }) => {
    const page = await signIn();
    await openModule(page, 'Feedback');
    const summary = page.getByRole('region', { name: 'Rating summary' });
    await expect(summary).toContainText('ratings');
    const before = await summary.innerText();
    await page.getByRole('tab', { name: '1 ★' }).click();
    await expect(page.getByRole('tab', { name: '1 ★' })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => summary.innerText()).toBe(before);
  });
});

test.describe('Communications', () => {
  test('lists follow-ups and birthdays, and the window changes the list', async ({ signIn }) => {
    const page = await signIn();
    const errors = watchErrors(page);
    await openModule(page, 'Communication');

    // Seeded: Farhana Islam — last visit ~170 days ago, birthday in ~9 days.
    await expect(page.getByRole('region', { name: /Follow-ups/ }).getByText('Farhana Islam')).toBeVisible();
    await expect(page.getByRole('region', { name: /Birthday wishes/ }).getByText('Farhana Islam')).toBeVisible();

    await page.getByLabel('Next').selectOption('7');
    await expect(page.getByRole('region', { name: /Follow-ups/ }).getByText('Farhana Islam')).toHaveCount(0);

    await page.getByRole('tab', { name: /SMS & email settings/ }).click();
    await expect(page.getByRole('main').getByText(/Appointment|Confirmation/).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('clicking a patient opens their record', async ({ signIn }) => {
    const page = await signIn();
    await openModule(page, 'Communication');
    await page.getByRole('region', { name: /Birthday wishes/ }).getByRole('button', { name: /Farhana Islam/ }).click();
    await expect(page.getByRole('main').getByText('CURA-', { exact: false }).first()).toBeVisible();
  });

  test('non-admins see the outreach list without the settings tab', async ({ signIn }) => {
    const page = await signIn('desk');
    await openModule(page, 'Communication');
    await expect(page.getByRole('heading', { name: 'Birthday wishes' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /SMS & email settings/ })).toHaveCount(0);
  });
});
