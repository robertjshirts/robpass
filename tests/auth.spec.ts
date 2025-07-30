import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display the main page with authentication forms', async ({ page }) => {
    // Check that the main heading is visible
    await expect(page.getByRole('heading', { name: '🔐 RobPass' })).toBeVisible();
    
    // Check that the subtitle is visible
    await expect(page.getByText('Secure Password Manager with Zero-Knowledge Architecture')).toBeVisible();
    
    // Check that auth mode toggle buttons are visible
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    
    // Check that login form is displayed by default
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
  });

  test('should switch between login and registration forms', async ({ page }) => {
    // Initially should show login form
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    
    // Click on Create Account tab
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    // Should now show registration form
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Confirm Password' })).toBeVisible();
    
    // Click back to Sign In tab
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Should show login form again
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Confirm Password' })).not.toBeVisible();
  });

  test('should successfully register a new user', async ({ page }) => {
    // Switch to registration form
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    // Fill out registration form
    const timestamp = Date.now();
    const username = `testuser${timestamp}`;
    const password = 'TestPassword123!';
    
    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill(password);
    
    // Submit registration form
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();
    
    // Should show loading state
    await expect(page.getByText('Creating Account...')).toBeVisible();
    
    // Should redirect to authenticated state
    await expect(page.getByRole('heading', { name: '🔐 RobPass' })).toBeVisible();
    await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    
    // Should show secure session status
    await expect(page.getByText('Secure Session Active')).toBeVisible();
    await expect(page.getByText('✅ Master key stored in volatile memory')).toBeVisible();
    await expect(page.getByText('✅ Zero-knowledge architecture maintained')).toBeVisible();
    await expect(page.getByText('✅ Session token secured')).toBeVisible();
  });

  test('should validate registration form inputs', async ({ page }) => {
    // Switch to registration form
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    // Try to submit empty form
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();
    
    // Should show validation errors
    await expect(page.getByText('Username is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
    await expect(page.getByText('Please confirm your password')).toBeVisible();
    
    // Test username validation
    await page.getByRole('textbox', { name: 'Username' }).fill('ab');
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText('Username must be at least 3 characters')).toBeVisible();
    
    // Test password validation
    await page.getByRole('textbox', { name: 'Username' }).fill('validuser');
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('weak');
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
    
    // Test password confirmation
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('ValidPassword123!');
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill('DifferentPassword123!');
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByText('Passwords do not match')).toBeVisible();
  });

  test('should successfully login with existing user', async ({ page }) => {
    // First register a user
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    const timestamp = Date.now();
    const username = `logintest${timestamp}`;
    const password = 'LoginTestPassword123!';
    
    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill(password);
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();
    
    // Wait for registration to complete
    await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();
    
    // Logout
    await page.getByRole('button', { name: 'Logout' }).click();
    
    // Should return to login form
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    
    // Login with the same credentials
    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.locator('form').getByRole('button', { name: 'Sign In' }).click();
    
    // Should show loading state
    await expect(page.getByText('Signing In...')).toBeVisible();
    
    // Should successfully login
    await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('should handle login with invalid credentials', async ({ page }) => {
    // Try to login with non-existent user
    await page.getByRole('textbox', { name: 'Username' }).fill('nonexistentuser');
    await page.getByRole('textbox', { name: 'Password' }).fill('SomePassword123!');
    await page.locator('form').getByRole('button', { name: 'Sign In' }).click();
    
    // Should show error message
    await expect(page.getByText('Failed to get user information')).toBeVisible();
  });

  test('should successfully logout and clear session', async ({ page }) => {
    // Register and login a user first
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    const timestamp = Date.now();
    const username = `logouttest${timestamp}`;
    const password = 'LogoutTestPassword123!';
    
    await page.getByRole('textbox', { name: 'Username' }).fill(username);
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill(password);
    await page.getByRole('textbox', { name: 'Confirm Password' }).fill(password);
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();
    
    // Wait for login to complete
    await expect(page.getByText(`Welcome back, ${username}`)).toBeVisible();
    
    // Logout
    await page.getByRole('button', { name: 'Logout' }).click();
    
    // Should return to authentication forms
    await expect(page.getByRole('heading', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    
    // Should not show authenticated content
    await expect(page.getByText(`Welcome back, ${username}`)).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).not.toBeVisible();
  });

  test('should show password visibility toggle', async ({ page }) => {
    // Test on login form
    const passwordInput = page.getByRole('textbox', { name: 'Password' });
    const toggleButton = page.getByRole('button', { name: '👁️' });
    
    // Initially password should be hidden
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click toggle to show password
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    
    // Click toggle to hide password again
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should display security notices', async ({ page }) => {
    // Check login form security notice
    await expect(page.getByText('🔒 Your password is processed client-side and never sent to our servers.')).toBeVisible();
    
    // Switch to registration form
    await page.getByRole('button', { name: 'Create Account' }).click();
    
    // Check registration form security notice
    await expect(page.getByText('🔒 Your password is encrypted client-side and never sent to our servers in plaintext.')).toBeVisible();
    
    // Check footer security notice
    await expect(page.getByText('🔒 Your data is encrypted client-side')).toBeVisible();
  });
});
