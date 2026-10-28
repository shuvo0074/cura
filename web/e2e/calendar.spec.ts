import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { API, PRACTICE_ID, apiToken, navButton, testMobile, watchErrors } from './helpers';

/** Local YYYY-MM-DD, matching what a datetime-local input holds. */
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Opens the left-pane doctor dropdown and picks an entry. */
const pickDoctor = async (page: Page, name: string) => {
  await page.getByRole('button', { name: /^Show schedule for/ }).click();
  await page.getByRole('radiogroup', { name: 'Show schedule for' }).getByRole('radio', { name }).click();
};

test.describe('Calendar', () => {
  test('three panes render with today’s seeded schedule', async ({ signIn }) => {
    const page = await signIn();
    const errors = watchErrors(page);
    await navButton(page, 'Calendar').click();

    await expect(page.getByRole('complementary', { name: 'Navigator and team' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Schedule' })).toBeVisible();
    const today = page.getByRole('complementary', { name: "Today's schedule" });
    await expect(today.getByRole('button', { name: /Add Walk-in Appointment/ })).toBeVisible();
    for (const counter of ['Waiting', 'Engaged', 'Done', 'Cancelled']) {
      await expect(today.getByText(counter, { exact: true })).toBeVisible();
    }
    await expect(today.getByText('Rahima Begum')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('view toggles switch between Day, 3 Day, Week and Month', async ({ signIn }) => {
    const page = await signIn();
    const views = page.getByRole('tablist', { name: 'Calendar view' });
    for (const view of ['Day', '3 Day', 'Week', 'Month']) {
      await views.getByRole('tab', { name: view, exact: true }).click();
      await expect(views.getByRole('tab', { name: view, exact: true })).toHaveAttribute('aria-selected', 'true');
    }
    // Let the month's data land first: cells are re-rendered when it does, and
    // a click straddling that swap (mousedown on the old node, mouseup on the
    // new) never becomes a click.
    await expect(page.getByRole('region', { name: 'Schedule' })).not.toHaveAttribute('data-loading', /.*/);

    // Month is a real month grid: one cell per day, labelled with its count.
    await expect(page.getByRole('button', { name: /, \d+ appointments$/ }).first()).toBeVisible();
    expect(await page.getByRole('button', { name: /, \d+ appointments$/ }).count()).toBeGreaterThanOrEqual(28);

    // Clicking a day (not one of its chips, which select) drops into Day view.
    await page
      .getByRole('button', { name: /, [1-9]\d* appointments$/ })
      .first()
      .click({ position: { x: 8, y: 8 } });
    await expect(views.getByRole('tab', { name: 'Day', exact: true })).toHaveAttribute('aria-selected', 'true');
  });

  test('selecting an appointment fills the details box', async ({ signIn }) => {
    const page = await signIn();
    await page.getByRole('tablist', { name: 'Calendar view' }).getByRole('tab', { name: 'Day', exact: true }).click();
    await page.getByRole('button', { name: 'Today' }).click();
    await page.getByRole('region', { name: 'Schedule' }).getByText('Rahima Begum').click();

    const details = page.getByRole('complementary', { name: "Today's schedule" });
    await expect(details.getByText('CURA-10000')).toBeVisible();
    await expect(details.getByText(/Profile (complete|incomplete)/)).toBeVisible();
    await expect(details.getByText('Phone')).toBeVisible();
    await expect(details.getByRole('button', { name: /Open patient record/ })).toBeVisible();
  });

  test('clicking an empty slot opens intake pre-filled with that time', async ({ signIn }) => {
    const page = await signIn();
    await page.getByRole('tablist', { name: 'Calendar view' }).getByRole('tab', { name: 'Day', exact: true }).click();
    await page.getByRole('button', { name: 'Today' }).click();

    const column = page.locator('[data-bookable]').first();
    await column.scrollIntoViewIfNeeded();
    const box = await column.boundingBox();
    expect(box).not.toBeNull();
    // Near the bottom of the day: past the seeded morning bookings.
    await column.click({ position: { x: (box?.width ?? 100) / 2, y: (box?.height ?? 100) - 6 } });

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const value = await dialog.getByLabel('Scheduled on').inputValue();
    expect(value.startsWith(localDate())).toBeTruthy();
    // Slot starts land on whole slot boundaries, never "now"'s odd minute.
    expect(Number(value.slice(14, 16)) % 5).toBe(0);
    await dialog.getByRole('button', { name: 'Close' }).click();
  });

  test('quick settings toggle cancelled visibility and link to Settings', async ({ signIn }) => {
    const page = await signIn();
    await page.getByRole('button', { name: /^Settings/ , exact: false }).filter({ hasText: '▾' }).click();
    const menu = page.getByRole('menu');
    const toggle = menu.getByRole('checkbox', { name: /Show cancelled appointments/ });
    await expect(toggle).not.toBeChecked();
    await toggle.check();
    await expect(toggle).toBeChecked();

    await menu.getByRole('menuitem', { name: 'Calendar settings…' }).click();
    await expect(navButton(page, 'Settings')).toHaveAttribute('aria-current', 'page');
  });

  test('mini month browses without moving the grid, then jumps on click', async ({ signIn }) => {
    const page = await signIn();
    await navButton(page, 'Calendar').click();
    const nav = page.getByRole('complementary', { name: 'Navigator and team' });
    const range = page.getByRole('button', { name: 'Previous period' }).locator('..');
    const before = await range.innerText();

    await nav.getByRole('button', { name: 'Next month' }).click();
    await expect.poll(() => range.innerText()).toBe(before);

    const target = new Date();
    target.setMonth(target.getMonth() + 1, 15);
    const label = target.toLocaleDateString([], { dateStyle: 'long' });
    await nav.getByRole('grid', { name: 'Pick a date' }).getByRole('button', { name: new RegExp(`^${label}`) }).click();
    await expect.poll(() => range.innerText()).not.toBe(before);
  });

  test('month view: drag an appointment to another day, keeping its time', async ({ signIn }) => {
    const page = await signIn();
    const errors = watchErrors(page);

    // Fixture on the 10th of next month (a whole month view away from today's
    // busy cells), then dragged to a free later day.
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() + 1, 10, 15, 0);
    const token = await apiToken(page);
    const headers = { authorization: `Bearer ${token}` };
    const request = page.context().request;
    const range = await request.get(`${API}/appointments`, {
      headers,
      params: { practiceId: PRACTICE_ID, from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString() },
    });
    const doctorId = ((await range.json()) as Array<{ doctorId: string }>)[0]?.doctorId;
    const name = `E2E Month ${Date.now().toString().slice(-6)}`;
    let created = null;
    for (let i = 0; i < 12; i += 1) {
      const at = new Date(from.getTime() + i * 10 * 60_000);
      created = await request.post(`${API}/appointments`, {
        headers,
        data: {
          practiceId: PRACTICE_ID, doctorId, scheduledAt: at.toISOString(), durationMinutes: 10, visitType: 'NEW',
          patient: { mobile: testMobile(), fullName: name, ageYears: 40, gender: 'MALE' },
        },
      });
      if (created.status() !== 409) break;
    }
    expect(created?.ok(), await created?.text()).toBeTruthy();
    const booked = new Date(((await created!.json()) as { scheduledAt: string }).scheduledAt);

    // Target: the first later day that month with nothing booked, so a leftover
    // from an earlier run can never make the move a (rightly refused) clash.
    const monthAppts = (await (
      await request.get(`${API}/appointments`, {
        headers,
        params: { practiceId: PRACTICE_ID, from: new Date(from.getFullYear(), from.getMonth(), 1).toISOString(), to: new Date(from.getFullYear(), from.getMonth() + 1, 1).toISOString() },
      })
    ).json()) as Array<{ scheduledAt: string }>;
    const busy = new Set(monthAppts.map((a) => new Date(a.scheduledAt).getDate()));
    const targetDay = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21].find((d) => !busy.has(d)) ?? 22;
    const to = new Date(from.getFullYear(), from.getMonth(), targetDay);

    await page.getByRole('tablist', { name: 'Calendar view' }).getByRole('tab', { name: 'Month', exact: true }).click();
    await page.getByRole('button', { name: 'Next period' }).click();
    await expect(page.getByRole('region', { name: 'Schedule' })).not.toHaveAttribute('data-loading', /.*/);

    const cell = (d: Date) =>
      page.getByRole('button', { name: new RegExp(`^${d.toLocaleDateString([], { dateStyle: 'full' })},`) });
    const chip = cell(from).getByText(name);
    await expect(chip).toBeVisible();

    // A real pointer drag: press the chip, move onto the target day, release.
    const fromBox = (await chip.boundingBox())!;
    const toBox = (await cell(to).boundingBox())!;
    await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 8 });
    await page.mouse.up();

    const dialog = page.getByRole('dialog', { name: 'Move appointment' });
    await expect(dialog).toContainText(name);
    await dialog.getByRole('button', { name: 'Move', exact: true }).click();

    await expect(cell(to).getByText(name)).toBeVisible();
    await expect(cell(from).getByText(name)).toHaveCount(0);

    // Same wall-clock time on the new day.
    const after = await request.get(`${API}/appointments`, {
      headers,
      params: { practiceId: PRACTICE_ID, from: new Date(to.getFullYear(), to.getMonth(), to.getDate()).toISOString(), to: new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1).toISOString() },
    });
    const moved = ((await after.json()) as Array<{ scheduledAt: string; patient: { fullName: string } }>).find((a) => a.patient.fullName === name);
    expect(moved).toBeTruthy();
    const at = new Date(moved!.scheduledAt);
    expect([at.getDate(), at.getHours(), at.getMinutes()]).toEqual([targetDay, booked.getHours(), booked.getMinutes()]);
    expect(errors).toEqual([]);
  });

  test('week view: drag an appointment to another time', async ({ signIn }) => {
    const page = await signIn();
    const errors = watchErrors(page);
    await page.getByRole('tablist', { name: 'Calendar view' }).getByRole('tab', { name: 'Week', exact: true }).click();
    await page.getByRole('button', { name: 'Today' }).click();
    await expect(page.getByRole('region', { name: 'Schedule' })).not.toHaveAttribute('data-loading', /.*/);

    const card = page.getByRole('region', { name: 'Schedule' }).locator('[data-movable]').first();
    await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 8);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 8 + 26 * 3, { steps: 8 });
    await page.mouse.up();

    // Cancel: the drag is proven by the confirmation, and the diary stays put.
    const dialog = page.getByRole('dialog', { name: 'Move appointment' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('doctor filter narrows the diary to one doctor and marks cards when mixed', async ({ signIn }) => {
    const page = await signIn();
    const errors = watchErrors(page);
    await page.getByRole('tablist', { name: 'Calendar view' }).getByRole('tab', { name: 'Day', exact: true }).click();
    await page.getByRole('button', { name: 'Today' }).click();
    const schedule = page.getByRole('region', { name: 'Schedule' });

    // All doctors: Dr Ariful's patient is there, and cards name their doctor.
    await expect(page.getByRole('button', { name: /^Show schedule for/ })).toHaveText(/All doctors/);
    await expect(schedule.getByText('Rahima Begum').first()).toBeVisible();
    await expect(schedule.locator('[title*="Dr Nadia Karim"]').first()).toBeVisible();

    // One doctor: only her diary, no markers.
    await pickDoctor(page, 'Dr Nadia Karim');
    await expect(page.getByRole('button', { name: /^Show schedule for/ })).toHaveText(/Dr Nadia Karim/);
    await expect(page.getByRole('radiogroup', { name: 'Show schedule for' })).toHaveCount(0);
    await expect(schedule.getByText('Rahima Begum')).toHaveCount(0);
    await expect(schedule.locator('[data-status]').first()).toBeVisible();
    await expect(schedule.locator('[title*="Dr "]')).toHaveCount(0);

    await pickDoctor(page, 'All doctors');
    await expect(schedule.getByText('Rahima Begum').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('booking from a filtered calendar books with that doctor', async ({ signIn }) => {
    const page = await signIn('desk');
    await pickDoctor(page, 'Dr Sajid Hasan');
    await page.getByRole('button', { name: /Add Walk-in Appointment/ }).click();
    const doctor = page.getByRole('dialog').getByLabel('Doctor');
    await expect(doctor.locator('option:checked')).toHaveText('Dr Sajid Hasan');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

    // From the header, with no calendar context, the form starts on the lead.
    await pickDoctor(page, 'All doctors');
    await page.getByRole('button', { name: /Add Patient/ }).click();
    await expect(page.getByRole('dialog').getByLabel('Doctor').locator('option:checked')).toHaveText('Dr Ariful Islam');
  });

  test('a doctor sees the diary but cannot book into it', async ({ signIn }) => {
    const page = await signIn('doctor');
    await expect(page.getByRole('button', { name: /Add Walk-in Appointment/ })).toHaveCount(0);
    await expect(page.locator('[data-bookable]')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Schedule' })).toBeVisible();
  });
});
