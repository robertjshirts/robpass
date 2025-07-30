import { test, expect } from '@playwright/test';

test.describe('Vault Security Tests', () => {
  // Helper function to register and login a user
  async function registerAndLogin(page: any, username: string, password: string) {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill(password);
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();
  }

  // Helper function to add a vault item
  async function addVaultItem(page: any, name: string, username: string, password: string, url?: string) {
    await page.getByRole('button', { name: /Add.*Password/ }).click();
    await page.getByRole('textbox', { name: 'Name *' }).fill(name);
    await page.getByRole('textbox', { name: 'Username/Email *' }).fill(username);
    await page.getByRole('textbox', { name: 'Password *' }).fill(password);
    if (url) {
      await page.getByRole('textbox', { name: 'Website URL (optional)' }).fill(url);
    }
    await page.locator('form').getByRole('button', { name: 'Add Password' }).click();
    await expect(page.getByText(name)).toBeVisible();
  }

  test.describe('Happy Path - Vault Operations', () => {
    test('should successfully create, view, edit, and delete vault items', async ({ page }) => {
      const timestamp = Date.now();
      const userAccount = `vaultuser${timestamp}`;
      const userPassword = 'VaultUserPassword123!';

      await registerAndLogin(page, userAccount, userPassword);

      // Create vault item
      await addVaultItem(page, 'Gmail Account', 'test@gmail.com', 'GmailPassword123!', 'https://gmail.com');

      // View vault item (decrypt)
      await page.getByRole('button', { name: 'View' }).click();
      await expect(page.getByText('test@gmail.com')).toBeVisible();
      await expect(page.getByText('https://gmail.com')).toBeVisible();

      // Show password
      await page.getByRole('button', { name: '👁️' }).click();
      await expect(page.getByText('GmailPassword123!')).toBeVisible();

      // Edit vault item
      await page.getByRole('button', { name: 'Edit' }).click();
      await page.getByRole('textbox', { name: 'Username' }).fill('updated@gmail.com');
      await page.getByRole('textbox', { name: 'Password' }).fill('UpdatedPassword123!');
      await page.getByRole('button', { name: 'Save Changes' }).click();

      // Verify changes
      await expect(page.getByText('updated@gmail.com')).toBeVisible();
      await page.getByRole('button', { name: '👁️' }).click();
      await expect(page.getByText('UpdatedPassword123!')).toBeVisible();

      // Delete vault item
      page.on('dialog', dialog => dialog.accept()); // Accept confirmation dialog
      await page.getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByText('Gmail Account')).not.toBeVisible();
      await expect(page.getByText('No passwords yet')).toBeVisible();
    });

    test('should support multiple vault items with search', async ({ page }) => {
      const timestamp = Date.now();
      const userAccount = `multiuser${timestamp}`;
      const userPassword = 'MultiUserPassword123!';

      await registerAndLogin(page, userAccount, userPassword);

      // Add multiple vault items
      await addVaultItem(page, 'Gmail', 'user@gmail.com', 'GmailPass123!');
      await addVaultItem(page, 'Facebook', 'user@facebook.com', 'FacebookPass123!');
      await addVaultItem(page, 'Twitter', 'user@twitter.com', 'TwitterPass123!');

      // Should show 3 passwords
      await expect(page.getByText('3 passwords stored securely')).toBeVisible();

      // Test search functionality
      await page.getByPlaceholder('Search passwords...').fill('Gmail');
      await expect(page.getByText('Gmail')).toBeVisible();
      await expect(page.getByText('Facebook')).not.toBeVisible();
      await expect(page.getByText('Twitter')).not.toBeVisible();

      // Clear search
      await page.getByPlaceholder('Search passwords...').fill('');
      await expect(page.getByText('Gmail')).toBeVisible();
      await expect(page.getByText('Facebook')).toBeVisible();
      await expect(page.getByText('Twitter')).toBeVisible();
    });

    test('should generate secure passwords', async ({ page }) => {
      const timestamp = Date.now();
      const userAccount = `genuser${timestamp}`;
      const userPassword = 'GenUserPassword123!';

      await registerAndLogin(page, userAccount, userPassword);

      // Start adding a password
      await page.getByRole('button', { name: /Add.*Password/ }).click();
      await page.getByRole('textbox', { name: 'Name *' }).fill('Generated Password Test');
      await page.getByRole('textbox', { name: 'Username/Email *' }).fill('test@example.com');

      // Generate password
      await page.getByRole('button', { name: 'Generate Password' }).click();
      
      // Should show generated passwords
      await expect(page.getByText('Generated Passwords (click to select):')).toBeVisible();
      
      // Select first generated password
      await page.locator('button').filter({ hasText: /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]{16}$/ }).first().click();
      
      // Should show password strength
      await expect(page.getByText(/Strength:.*Strong/)).toBeVisible();
      
      // Complete adding the item
      await page.locator('form').getByRole('button', { name: 'Add Password' }).click();
      await expect(page.getByText('Generated Password Test')).toBeVisible();
    });
  });

  test.describe('Unhappy Path - Vault Security', () => {
    test('should not allow access to vault without authentication', async ({ page }) => {
      // Try to access vault API directly without authentication
      const response = await page.request.get('/api/vault/items');
      expect(response.status()).toBe(401);
      
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Authentication required');
    });

    test('should not allow creating vault items without authentication', async ({ page }) => {
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

    test('should validate vault item input data', async ({ page }) => {
      const timestamp = Date.now();
      const userAccount = `validuser${timestamp}`;
      const userPassword = 'ValidUserPassword123!';

      await registerAndLogin(page, userAccount, userPassword);

      // Try to add vault item with missing required fields
      await page.getByRole('button', { name: /Add.*Password/ }).click();
      
      // Submit without filling required fields
      await page.locator('form').getByRole('button', { name: 'Add Password' }).click();
      
      // Should show validation errors
      await expect(page.getByText('Name is required')).toBeVisible();
      await expect(page.getByText('Username is required')).toBeVisible();
      await expect(page.getByText('Password is required')).toBeVisible();
    });

    test('should not decrypt vault items with wrong master key', async ({ page, context }) => {
      const timestamp = Date.now();
      const user1 = `user1_${timestamp}`;
      const user2 = `user2_${timestamp}`;
      const password1 = 'User1Password123!';
      const password2 = 'User2Password123!';

      // Create first user and add vault item
      await registerAndLogin(page, user1, password1);
      await addVaultItem(page, 'User1 Secret', 'user1@example.com', 'User1Secret123!');
      
      // Logout
      await page.getByRole('button', { name: 'Logout' }).click();

      // Create second user
      await page.getByRole('button', { name: 'Create Account' }).click();
      await page.getByRole('textbox', { name: 'Username' }).fill(user2);
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password2);
      await page.getByRole('textbox', { name: 'Confirm Password' }).fill(password2);
      await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

      // User2 should not see User1's vault items
      await expect(page.getByText('No passwords yet')).toBeVisible();
      await expect(page.getByText('User1 Secret')).not.toBeVisible();
    });

    test('should handle session expiration gracefully', async ({ page }) => {
      const timestamp = Date.now();
      const userAccount = `expireuser${timestamp}`;
      const userPassword = 'ExpireUserPassword123!';

      await registerAndLogin(page, userAccount, userPassword);
      await addVaultItem(page, 'Test Item', 'test@example.com', 'TestPassword123!');

      // Simulate session expiration by clearing session storage
      await page.evaluate(() => {
        sessionStorage.clear();
        localStorage.clear();
      });

      // Try to access vault - should redirect to login
      await page.reload();
      
      // Should be redirected to login form
      await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
      await expect(page.getByText('Test Item')).not.toBeVisible();
    });

    test('should prevent unauthorized vault item access via API', async ({ page }) => {
      const timestamp = Date.now();
      const user1 = `apiuser1_${timestamp}`;
      const user2 = `apiuser2_${timestamp}`;
      const password = 'ApiUserPassword123!';

      // Create first user and get their session
      await registerAndLogin(page, user1, password);
      await addVaultItem(page, 'User1 Item', 'user1@example.com', 'User1Password123!');
      
      // Get the vault items to find the item ID
      const vaultResponse = await page.request.get('/api/vault/items');
      const vaultData = await vaultResponse.json();
      const itemId = vaultData.data.items[0].id;
      
      // Logout first user
      await page.getByRole('button', { name: 'Logout' }).click();

      // Create second user
      await page.getByRole('button', { name: 'Create Account' }).click();
      await page.getByRole('textbox', { name: 'Username' }).fill(user2);
      await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
      await page.getByRole('textbox', { name: 'Confirm Password' }).fill(password);
      await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

      // Try to access User1's vault item with User2's session
      const unauthorizedResponse = await page.request.get(`/api/vault/items/${itemId}`);
      expect(unauthorizedResponse.status()).toBe(404); // Should not find item (ownership check)
      
      const body = await unauthorizedResponse.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Vault item not found');
    });

    test('should validate password strength requirements', async ({ page }) => {
      const timestamp = Date.now();
      const userAccount = `strengthuser${timestamp}`;
      const userPassword = 'StrengthUserPassword123!';

      await registerAndLogin(page, userAccount, userPassword);

      // Try to add vault item with weak password
      await page.getByRole('button', { name: /Add.*Password/ }).click();
      await page.getByRole('textbox', { name: 'Name *' }).fill('Weak Password Test');
      await page.getByRole('textbox', { name: 'Username/Email *' }).fill('test@example.com');
      await page.getByRole('textbox', { name: 'Password *' }).fill('weak');

      // Should show weak password strength
      await expect(page.getByText(/Strength:.*Very Weak/)).toBeVisible();
      
      // Use a strong password instead
      await page.getByRole('textbox', { name: 'Password *' }).fill('StrongPassword123!@#');
      await expect(page.getByText(/Strength:.*Strong/)).toBeVisible();
    });
  });
});
