import { expect, test } from './fixtures';
import { navButton, watchErrors } from './helpers';

/** Local YYYY-MM-DD, matching what a datetime-local input holds. */
const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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

  test('a doctor sees the diary but cannot book into it', async ({ signIn }) => {
    const page = await signIn('doctor');
    await expect(page.getByRole('button', { name: /Add Walk-in Appointment/ })).toHaveCount(0);
    await expect(page.locator('[data-bookable]')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Schedule' })).toBeVisible();
  });
});
