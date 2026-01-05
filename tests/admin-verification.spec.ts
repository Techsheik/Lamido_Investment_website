import { test, expect } from '@playwright/test';

test.describe('Admin Panel Data Refresh and Display', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase Auth
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'admin-id',
          email: 'admin@example.com',
          role: 'authenticated',
        }),
      });
    });

    // Mock Admin Role Check
    await page.route('**/rest/v1/user_roles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ role: 'admin' }]),
      });
    });
  });

  test('should display multiple investor names correctly', async ({ page }) => {
    // Mock multiple investors with their profiles
    await page.route('**/rest/v1/investments*', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'inv-1',
              user_id: 'user-1',
              amount: 1000,
              roi: 10,
              status: 'active',
              start_date: '2023-01-01',
              investment_plans: { name: 'Basic' }
            },
            {
              id: 'inv-2',
              user_id: 'user-2',
              amount: 2000,
              roi: 20,
              status: 'active',
              start_date: '2023-01-02',
              investment_plans: { name: 'Premium' }
            }
          ]),
        });
      } else {
        await route.continue();
      }
    });

    // Mock profiles separately as per the new manual join pattern
    await page.route('**/rest/v1/profiles*', async (route) => {
      const url = route.request().url();
      if (url.includes('in.(') || url.includes('in.%28')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'user-1', name: 'Alice Investor', email: 'alice@example.com' },
            { id: 'user-2', name: 'Bob Investor', email: 'bob@example.com' }
          ]),
        });
      } else {
        await route.fulfill({ status: 200, body: '[]' });
      }
    });

    await page.goto('/admin/investor-management');

    // Verify both names appear
    await expect(page.getByText('Alice Investor')).toBeVisible();
    await expect(page.getByText('Bob Investor')).toBeVisible();
  });

  test('should reflect edits in the user management table immediately', async ({ page }) => {
    let users = [
      { id: 'u-1', user_code: 'USR001', name: 'Original Name', email: 'test@example.com', balance: 100, account_status: 'active', totalInvested: 0, totalROI: 0 }
    ];

    // Mock Users Fetch
    await page.route('**/rest/v1/profiles*', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(users),
        });
      } else if (route.request().method() === 'PATCH') {
        const payload = route.request().postDataJSON();
        users = users.map(u => u.id === 'u-1' ? { ...u, ...payload } : u);
        await route.fulfill({ status: 204 });
      }
    });

    await page.goto('/admin/users');
    await expect(page.getByText('Original Name')).toBeVisible();

    // Trigger Edit
    await page.locator('button:has(.lucide-pencil)').first().click();
    await page.fill('input#name', 'Updated Name');
    await page.click('button:has-text("Save Changes")');

    // Verify immediate reflection
    await expect(page.getByText('Updated Name')).toBeVisible();
    await expect(page.getByText('Original Name')).not.toBeVisible();
  });
});
