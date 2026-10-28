import { expect, test } from './fixtures';
import { freeSlotCandidates, testMobile, toLocalInput, watchErrors } from './helpers';

test.describe('Patient visit', () => {
  test('Add Patient opens the record ready to chart; search offers Start visit; signing locks it', async ({ signIn }) => {
    const page = await signIn();
    const name = `E2E Visit ${Date.now().toString().slice(-6)}`;

    // Walk-in through the header: the record must open with the visit editable.
    await page.getByRole('button', { name: '+ Add Patient' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Mobile/).first().fill(testMobile());
    await dialog.getByLabel('Patient Name').fill(name);
    await dialog.getByLabel('or Age (years)').fill('34');
    // Walk forward through today's slots until one is free (earlier runs leave
    // their bookings behind, and an overlap is rightly refused).
    for (const at of freeSlotCandidates()) {
      await dialog.getByLabel('Scheduled on').fill(toLocalInput(at));
      await dialog.getByRole('button', { name: 'Save' }).click();
      const outcome = await Promise.race([
        dialog.waitFor({ state: 'detached' }).then(() => 'saved' as const),
        dialog.getByText(/already booked/).waitFor().then(() => 'taken' as const),
      ]);
      if (outcome === 'saved') break;
    }
    // Watched from here: the refused slots above log expected 409s.
    const errors = watchErrors(page);

    await expect(page.getByRole('main').getByText(name).first()).toBeVisible();
    await expect(page.getByText('Vital signs').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign & complete visit' })).toBeVisible();

    // Same patient from search: no appointment in the URL, so Start visit is offered.
    await page.getByRole('button', { name: '← Back' }).click();
    await page.getByPlaceholder(/Search by Phone Number, Name, or ID/).fill(name);
    await page.locator('#universal-search-results').getByText(name).first().click();
    const start = page.getByRole('button', { name: /Start visit — .* appointment/ });
    await expect(start).toBeVisible();
    await start.click();
    await expect(page.getByRole('button', { name: 'Sign & complete visit' })).toBeVisible();

    await page.getByRole('button', { name: 'Sign & complete visit' }).click();
    await expect(page.getByText('Signed — read only')).toBeVisible();

    expect(errors).toEqual([]);
  });

  test('desk staff see the record but cannot start a visit', async ({ signIn }) => {
    const page = await signIn('desk');
    const errors = watchErrors(page);
    await page.getByPlaceholder(/Search by Phone Number, Name, or ID/).fill('Tanvir');
    await page.locator('#universal-search-results').getByText('Tanvir Ahmed').first().click();
    await expect(page.getByText('Only a doctor or administrator can record a visit.')).toBeVisible();
    await expect(page.getByText('Clinical history is visible to doctors and administrators.')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
