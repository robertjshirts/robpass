import { test, expect } from '@playwright/test';

test.describe('Core Security Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should demonstrate complete security flow - happy path', async ({ page }) => {
    const timestamp = Date.now();
    const username = `secureuser${timestamp}`;
    const password = 'SecurePassword123!';

    // 1. Register new user
    await page.locator('div').filter({ hasText: /^Create Account$/ }).getByRole('button').click();
    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill(password);
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

    // Should be logged in after registration
    await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();
    await expect(page.getByText('Password Vault')).toBeVisible();

    // 2. Add encrypted vault item
    await page.getByRole('button', { name: /Add.*Password/ }).click();
    await page.getByRole('textbox', { name: 'Name *' }).fill('Test Account');
    await page.getByRole('textbox', { name: 'Username/Email *' }).fill('test@example.com');
    await page.getByRole('textbox', { name: 'Password *' }).fill('TestPassword123!');
    await page.getByRole('textbox', { name: 'Website URL (optional)' }).fill('https://example.com');
    await page.locator('form').getByRole('button', { name: 'Add Password' }).click();

    // Should show encrypted item
    await expect(page.getByText('Test Account')).toBeVisible();
    await expect(page.getByText('1 password stored securely')).toBeVisible();

    // 3. Decrypt and view vault item
    await page.getByRole('button', { name: 'View' }).click();
    await expect(page.getByText('test@example.com')).toBeVisible();
    await expect(page.getByText('https://example.com')).toBeVisible();

    // Show password (decrypt)
    await page.getByRole('button', { name: '👁️' }).click();
    await expect(page.getByText('TestPassword123!')).toBeVisible();

    // 4. Logout and verify session cleared
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByText(`Welcome back, ${username}`)).not.toBeVisible();

    // 5. Login again with correct credentials
    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
    await page.locator('form').getByRole('button', { name: 'Sign In' }).click();

    // Should be logged in and see vault
    await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();
    await expect(page.getByText('Test Account')).toBeVisible();
  });

  test('should reject wrong password - security validation', async ({ page }) => {
    const timestamp = Date.now();
    const username = `wrongpassuser${timestamp}`;
    const correctPassword = 'CorrectPassword123!';
    const wrongPassword = 'WrongPassword123!';

    // Register user
    await page.locator('div').filter({ hasText: /^Create Account$/ }).getByRole('button').click();
    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(correctPassword);
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill(correctPassword);
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

    // Should be logged in
    await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();

    // Logout
    await page.getByRole('button', { name: 'Logout' }).click();

    // Try to login with wrong password
    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(wrongPassword);
    await page.locator('form').getByRole('button', { name: 'Sign In' }).click();

    // Should show error and not be logged in
    await expect(page.getByText('Invalid credentials')).toBeVisible();
    await expect(page.getByText(`Welcome back, ${username}`)).not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });

  test('should prevent unauthorized API access', async ({ page }) => {
    // Try to access vault API without authentication
    const response = await page.request.get('/api/vault/items');
    expect(response.status()).toBe(401);
    
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Authentication required');
  });

  test('should prevent vault item creation without authentication', async ({ page }) => {
    const response = await page.request.post('/api/vault/items', {
      data: {
        name: 'Unauthorized Item',
        encrypted_data: 'fake_encrypted_data',
        iv: 'fake_iv'
      }
    });
    
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Authentication required');
  });

  test('should isolate users - cannot access other users vault items', async ({ page, context }) => {
    const timestamp = Date.now();
    const user1 = `user1_${timestamp}`;
    const user2 = `user2_${timestamp}`;
    const password = 'UserPassword123!';

    // Create first user and add vault item
    await page.locator('div').filter({ hasText: /^Create Account$/ }).getByRole('button').click();
    await page.getByRole('textbox', { name: 'Username' }).fill(user1);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill(password);
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

    // Add vault item for user1
    await page.getByRole('button', { name: /Add.*Password/ }).click();
    await page.getByRole('textbox', { name: 'Name *' }).fill('User1 Secret');
    await page.getByRole('textbox', { name: 'Username/Email *' }).fill('user1@example.com');
    await page.getByRole('textbox', { name: 'Password *' }).fill('User1Secret123!');
    await page.locator('form').getByRole('button', { name: 'Add Password' }).click();

    await expect(page.getByText('User1 Secret')).toBeVisible();

    // Logout user1
    await page.getByRole('button', { name: 'Logout' }).click();

    // Create second user
    await page.locator('div').filter({ hasText: /^Create Account$/ }).getByRole('button').click();
    await page.getByRole('textbox', { name: 'Username' }).fill(user2);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill(password);
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

    // User2 should not see User1's vault items
    await expect(page.getByText('No passwords yet')).toBeVisible();
    await expect(page.getByText('User1 Secret')).not.toBeVisible();
  });

  test('should validate registration input - weak password rejection', async ({ page }) => {
    await page.locator('div').filter({ hasText: /^Create Account$/ }).getByRole('button').click();
    await page.getByRole('textbox', { name: 'Username' }).fill('testuser');
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('weak');
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill('weak');
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

    // Should show validation error
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
  });

  test('should validate registration input - password mismatch', async ({ page }) => {
    await page.locator('div').filter({ hasText: /^Create Account$/ }).getByRole('button').click();
    await page.getByRole('textbox', { name: 'Username' }).fill('testuser');
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('ValidPassword123!');
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill('DifferentPassword123!');
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

    // Should show validation error
    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('should reject non-existent user login', async ({ page }) => {
    await page.getByRole('textbox', { name: 'Username' }).fill('nonexistentuser12345');
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('SomePassword123!');
    await page.locator('form').getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByText('User not found')).toBeVisible();
  });
});
