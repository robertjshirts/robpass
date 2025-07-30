import { test, expect } from '@playwright/test';
import { AuthHelpers, VaultHelpers, SecurityHelpers, TestUser, TestVaultItem } from './utils/playwright-helpers';

test.describe('Authentication Security Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Happy Path - Valid Authentication', () => {
    test('should successfully register and login with valid credentials', async ({ page }) => {
      const timestamp = Date.now();
      const username = `testuser${timestamp}`;
      const password = 'ValidPassword123!';

      // Register new user
      await page.getByRole('button', { name: 'Create Account' }).click();
      await page.getByRole('textbox', { name: 'Username' }).fill(username);
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
      await page.getByRole('textbox', { name: 'Confirm Password' }).fill(password);
      await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

      // Should be logged in automatically after registration
      await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

      // Logout
      await page.getByRole('button', { name: 'Logout' }).click();
      await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

      // Login with same credentials
      await page.getByRole('textbox', { name: 'Username' }).fill(username);
      await page.getByRole('textbox', { name: 'Password' }).fill(password);
      await page.locator('form').getByRole('button', { name: 'Sign In' }).click();

      // Should be logged in successfully
      await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();
    });

    test('should successfully create and decrypt vault items', async ({ page }) => {
      const timestamp = Date.now();
      const username = `vaultuser${timestamp}`;
      const password = 'VaultPassword123!';

      // Register and login
      await page.getByRole('button', { name: 'Create Account' }).click();
      await page.getByRole('textbox', { name: 'Username' }).fill(username);
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
      await page.getByRole('textbox', { name: 'Confirm Password' }).fill(password);
      await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

      // Wait for vault to load
      await expect(page.getByText('Password Vault')).toBeVisible();

      // Add a password
      await page.getByRole('button', { name: 'Add Your First Password' }).click();
      await page.getByRole('textbox', { name: 'Name *' }).fill('Test Account');
      await page.getByRole('textbox', { name: 'Username/Email *' }).fill('test@example.com');
      await page.getByRole('textbox', { name: 'Password *' }).fill('TestAccountPassword123!');
      await page.getByRole('textbox', { name: 'Website URL (optional)' }).fill('https://example.com');
      await page.locator('form').getByRole('button', { name: 'Add Password' }).click();

      // Should show the vault item
      await expect(page.getByText('Test Account')).toBeVisible();
      await expect(page.getByText('1 password stored securely')).toBeVisible();

      // View the password (decrypt)
      await page.getByRole('button', { name: 'View' }).click();
      await expect(page.getByText('test@example.com')).toBeVisible();
      await expect(page.getByText('https://example.com')).toBeVisible();

      // Show password
      await page.getByRole('button', { name: '👁️' }).click();
      await expect(page.getByText('TestAccountPassword123!')).toBeVisible();
    });
  });

  test.describe('Unhappy Path - Invalid Authentication', () => {
    test('should reject registration with weak password', async ({ page }) => {
      await page.getByRole('button', { name: 'Create Account' }).click();
      await page.getByRole('textbox', { name: 'Username' }).fill('testuser');
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill('weak');
      await page.getByRole('textbox', { name: 'Confirm Password' }).fill('weak');
      await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

      await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
    });

    test('should reject registration with mismatched passwords', async ({ page }) => {
      await page.getByRole('button', { name: 'Create Account' }).click();
      await page.getByRole('textbox', { name: 'Username' }).fill('testuser');
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill('ValidPassword123!');
      await page.getByRole('textbox', { name: 'Confirm Password' }).fill('DifferentPassword123!');
      await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

      await expect(page.getByText('Passwords do not match')).toBeVisible();
    });

    test('should reject login with wrong password', async ({ page }) => {
      const timestamp = Date.now();
      const username = `wrongpassuser${timestamp}`;
      const correctPassword = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword123!';

      // First register a user
      await page.getByRole('button', { name: 'Create Account' }).click();
      await page.getByRole('textbox', { name: 'Username' }).fill(username);
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill(correctPassword);
      await page.getByRole('textbox', { name: 'Confirm Password' }).fill(correctPassword);
      await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

      // Logout
      await page.getByRole('button', { name: 'Logout' }).click();

      // Try to login with wrong password
      await page.getByRole('textbox', { name: 'Username' }).fill(username);
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill(wrongPassword);
      await page.locator('form').getByRole('button', { name: 'Sign In' }).click();

      // Should show error
      await expect(page.getByText('Invalid credentials')).toBeVisible();
      
      // Should not be logged in
      await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
      await expect(page.getByText(`Welcome back, ${username}`)).not.toBeVisible();
    });

    test('should reject login with non-existent user', async ({ page }) => {
      await page.getByRole('textbox', { name: 'Username' }).fill('nonexistentuser12345');
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill('SomePassword123!');
      await page.locator('form').getByRole('button', { name: 'Sign In' }).click();

      await expect(page.getByText('User not found')).toBeVisible();
    });

    test('should reject duplicate username registration', async ({ page }) => {
      const timestamp = Date.now();
      const username = `duplicateuser${timestamp}`;
      const password = 'DuplicatePassword123!';

      // Register first user
      await page.getByRole('button', { name: 'Create Account' }).click();
      await page.getByRole('textbox', { name: 'Username' }).fill(username);
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
      await page.getByRole('textbox', { name: 'Confirm Password' }).fill(password);
      await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

      // Should be logged in
      await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();

      // Logout
      await page.getByRole('button', { name: 'Logout' }).click();

      // Try to register same username again
      await page.locator('div').filter({ hasText: /^Create Account$/ }).getByRole('button').click();
      await page.getByRole('textbox', { name: 'Username' }).fill(username);
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
      await page.getByRole('textbox', { name: 'Confirm Password' }).fill(password);
      await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

      await expect(page.getByText('Username already exists')).toBeVisible();
    });
  });

  test.describe('Session Security', () => {
    test('should maintain session after page refresh', async ({ page }) => {
      const timestamp = Date.now();
      const username = `sessionuser${timestamp}`;
      const password = 'SessionPassword123!';

      // Register and login
      await page.getByRole('button', { name: 'Create Account' }).click();
      await page.getByRole('textbox', { name: 'Username' }).fill(username);
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
      await page.getByRole('textbox', { name: 'Confirm Password' }).fill(password);
      await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

      // Should be logged in
      await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();

      // Refresh page
      await page.reload();

      // Should still be logged in
      await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();
    });

    test('should clear session on logout', async ({ page }) => {
      const timestamp = Date.now();
      const username = `logoutuser${timestamp}`;
      const password = 'LogoutPassword123!';

      // Register and login
      await page.getByRole('button', { name: 'Create Account' }).click();
      await page.getByRole('textbox', { name: 'Username' }).fill(username);
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
      await page.getByRole('textbox', { name: 'Confirm Password' }).fill(password);
      await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

      // Should be logged in
      await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();

      // Logout
      await page.getByRole('button', { name: 'Logout' }).click();

      // Should be logged out
      await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();

      // Refresh page - should still be logged out
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
      await expect(page.getByText(`Welcome back, ${username}`)).not.toBeVisible();
    });
  });
});
