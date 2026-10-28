import { expect, test } from './fixtures';
import { navButton, openModule, watchErrors, type Role } from './helpers';

/** Sidebar entries each access level must see (README "What each level can do"). */
const EXPECTED: Record<Role, { visible: string[]; hidden: string[] }> = {
  admin: {
    visible: ['Calendar', 'Patients', 'Patient Management', 'Communication', 'Billing', 'Statistics', 'Settings',
      'Documents', 'Integrations', 'Profile', 'Feedback', 'Community', 'Prime Services', 'Log out'],
    hidden: [],
  },
  doctor: {
    visible: ['Calendar', 'Patients', 'Patient Management', 'Communication', 'Statistics', 'Feedback', 'Profile'],
    hidden: ['Settings', 'Integrations', 'Prime Services'],
  },
  desk: {
    visible: ['Calendar', 'Patients', 'Patient Management', 'Communication', 'Billing', 'Feedback', 'Profile'],
    hidden: ['Settings', 'Statistics', 'Integrations', 'Prime Services'],
  },
};

for (const role of Object.keys(EXPECTED) as Role[]) {
  test(`sidebar for ${role} shows only permitted modules`, async ({ signIn }) => {
    const page = await signIn(role);
    for (const label of EXPECTED[role].visible) {
      await expect(navButton(page, label), label).toBeVisible();
    }
    for (const label of EXPECTED[role].hidden) {
      await expect(navButton(page, label), label).toHaveCount(0);
    }
  });
}

/**
 * Smoke pass: every module renders something only that screen shows, and no
 * uncaught error is raised on the way.
 */
const MODULES: Array<{ label: string; expectText: RegExp }> = [
  { label: 'Calendar', expectText: /Today/ },
  { label: 'Patients', expectText: /\d+ patients/ },
  { label: 'Patient Management', expectText: /Today.s queue/ },
  { label: 'Communication', expectText: /Birthday wishes/ },
  { label: 'Billing', expectText: /Invoice/i },
  { label: 'Statistics', expectText: /Appointment volume/ },
  { label: 'Settings', expectText: /Practice Details/ },
  { label: 'Documents', expectText: /Document|File/i },
  { label: 'Integrations', expectText: /Not connected/ },
  { label: 'Profile', expectText: /Password/i },
  { label: 'Feedback', expectText: /What patients said/ },
  { label: 'Community', expectText: /planned, not built/ },
  { label: 'Prime Services', expectText: /plan|Premium|Subscription/i },
];

test('every module opens without a runtime error (admin)', async ({ signIn }) => {
  const page = await signIn('admin');
  const errors = watchErrors(page);

  for (const m of MODULES) {
    await openModule(page, m.label);
    await expect(navButton(page, m.label)).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('main').getByText(m.expectText).first(), m.label).toBeVisible();
  }

  expect(errors).toEqual([]);
});

test('sidebar collapses to icons and expands again', async ({ signIn }) => {
  const page = await signIn();
  const nav = page.getByRole('navigation', { name: 'Modules' });
  await page.getByRole('button', { name: 'Collapse navigation' }).click();
  await expect(nav.getByText('Patients', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand navigation' }).click();
  await expect(nav.getByText('Patients', { exact: true })).toBeVisible();
});

test('universal search finds a seeded patient and opens the record', async ({ signIn }) => {
  const page = await signIn();
  await page.getByPlaceholder(/Search by Phone Number, Name, or ID/).fill('Rahima');
  await page.getByText('Rahima Begum').first().click();
  await expect(page.getByRole('main').getByText('Rahima Begum').first()).toBeVisible();
});
