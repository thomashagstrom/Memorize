import { test, expect } from '@playwright/test';

test('ac_2 from the colour level, lit squares show colours and I can set a colour on each square', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play', exact: true }).click();

  for (let round = 1; round <= 3; round++) {
    await expect(page.getByText(`Round ${round}`)).toBeVisible();
    await expect(page.getByText('Watch…')).toBeVisible();
    const lit = await page
      .locator('button[data-lit="true"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    await expect(page.getByText('Your turn')).toBeVisible();
    for (const label of lit) {
      await page.getByRole('button', { name: label as string, exact: true }).click();
    }
  }

  await expect(page.getByText('Round 4')).toBeVisible();
  await expect(page.getByText('Watch…')).toBeVisible();
  const cells = await page.locator('button[data-lit="true"]').evaluateAll((els) =>
    els.map((e) => ({ label: e.getAttribute('aria-label'), glyph: (e.textContent || '').trim() })),
  );
  expect(cells.length).toBeGreaterThan(0);
  for (const c of cells) expect(c.glyph).not.toBe('');

  await expect(page.getByText('Your turn')).toBeVisible();
  const palette = page.getByRole('radiogroup', { name: 'Colour' });
  await expect(palette).toBeVisible();
  expect(await palette.getByRole('radio').count()).toBeGreaterThan(1);

  const first = cells[0];
  const radio = palette.getByRole('radio').filter({ hasText: first.glyph }).first();
  await radio.click();
  await expect(radio).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: first.label as string, exact: true }).click();
  await expect(page.getByRole('button', { name: first.label as string, exact: true })).toContainText(first.glyph);
});
