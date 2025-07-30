/**
 * Playwright Test Utilities for RobPass
 * 
 * Comprehensive utilities for end-to-end testing of security requirements,
 * cryptographic operations, authentication flows, and vault management.
 */

import { Page, expect, Locator } from '@playwright/test'

export class TestUser {
  constructor(
    public username: string,
    public password: string,
    public id?: number
  ) {}

  static createRandom(): TestUser {
    const timestamp = Date.now()
    return new TestUser(
      `testuser_${timestamp}`,
      `TestPassword${timestamp}!`
    )
  }

  static createDefault(): TestUser {
    return new TestUser('testuser', 'TestPassword123!')
  }
}

export class TestVaultItem {
  constructor(
    public name: string,
    public username: string,
    public password: string,
    public website?: string,
    public id?: number
  ) {}

  static createRandom(): TestVaultItem {
    const timestamp = Date.now()
    return new TestVaultItem(
      `Test Site ${timestamp}`,
      `user${timestamp}@example.com`,
      `Password${timestamp}!`,
      `https://example${timestamp}.com`
    )
  }

  static createDefault(): TestVaultItem {
    return new TestVaultItem(
      'Test Website',
      'testuser@example.com',
      'MySecurePassword123!',
      'https://example.com'
    )
  }
}

/**
 * Authentication helper functions
 */
export class AuthHelpers {
  constructor(private page: Page) {}

  async navigateToLogin(): Promise<void> {
    await this.page.goto('/')
    await expect(this.page.locator('h1:has-text("🔐 RobPass")')).toBeVisible()
  }

  async switchToRegistration(): Promise<void> {
    await this.page.click('button:has-text("Create Account")')
    await expect(this.page.locator('h2:has-text("Create Account")')).toBeVisible()
  }

  async switchToLogin(): Promise<void> {
    await this.page.click('button:has-text("Sign In Instead")')
    await expect(this.page.locator('h2:has-text("Sign In")')).toBeVisible()
  }

  async register(user: TestUser): Promise<void> {
    await this.page.getByRole('textbox', { name: 'Username' }).fill(user.username)
    await this.page.getByRole('textbox', { name: 'Password', exact: true }).fill(user.password)
    await this.page.getByRole('textbox', { name: 'Confirm Password' }).fill(user.password)

    await this.page.locator('form').getByRole('button', { name: 'Create Account' }).click()

    // Wait for successful registration and automatic login
    await expect(this.page.locator(`text=Welcome back, ${user.username}`)).toBeVisible({ timeout: 10000 })
  }

  async login(user: TestUser): Promise<void> {
    await this.page.getByRole('textbox', { name: 'Username' }).fill(user.username)
    await this.page.getByRole('textbox', { name: 'Password' }).fill(user.password)

    await this.page.locator('form').getByRole('button', { name: 'Sign In' }).click()

    // Wait for successful login
    await expect(this.page.locator(`text=Welcome back, ${user.username}`)).toBeVisible({ timeout: 10000 })
  }

  async logout(): Promise<void> {
    await this.page.click('button:has-text("Logout")')
    
    // Wait for redirect to login page
    await expect(this.page.locator('h2:has-text("Sign In")')).toBeVisible()
  }

  async expectLoginError(errorMessage: string): Promise<void> {
    await expect(this.page.locator(`text=${errorMessage}`)).toBeVisible()
  }

  async expectRegistrationError(errorMessage: string): Promise<void> {
    await expect(this.page.locator(`text=${errorMessage}`)).toBeVisible()
  }
}

/**
 * Vault management helper functions
 */
export class VaultHelpers {
  constructor(private page: Page) {}

  async expectVaultDashboard(): Promise<void> {
    await expect(this.page.locator('text=passwords stored securely')).toBeVisible()
  }

  async expectEmptyVault(): Promise<void> {
    await expect(this.page.locator('text=No passwords yet')).toBeVisible()
    await expect(this.page.locator('text=Get started by adding your first password')).toBeVisible()
  }

  async expectVaultItemCount(count: number): Promise<void> {
    await expect(this.page.locator(`text=${count} password${count !== 1 ? 's' : ''} stored securely`)).toBeVisible()
  }

  async openAddPasswordForm(): Promise<void> {
    await this.page.click('button:has-text("Add Password")')
    await expect(this.page.locator('h3:has-text("Add New Password")')).toBeVisible()
  }

  async addVaultItem(item: TestVaultItem): Promise<void> {
    await this.openAddPasswordForm()
    
    await this.page.fill('input[placeholder="e.g., Gmail, Facebook, Work Email"]', item.name)
    await this.page.fill('input[placeholder="username or email"]', item.username)
    await this.page.fill('input[placeholder="password"]', item.password)
    
    if (item.website) {
      await this.page.fill('input[placeholder="https://example.com"]', item.website)
    }
    
    await this.page.click('button:has-text("Add Password"):not(:has-text("Generate"))')
    
    // Wait for the form to close and item to appear
    await expect(this.page.locator('h3:has-text("Add New Password")')).not.toBeVisible()
    await expect(this.page.locator(`text=${item.name}`)).toBeVisible()
  }

  async viewVaultItem(itemName: string): Promise<void> {
    const itemLocator = this.page.locator(`[data-testid="vault-item"]:has-text("${itemName}")`)
    await itemLocator.locator('button:has-text("View")').click()
    
    // Wait for item to expand
    await expect(itemLocator.locator('button:has-text("Hide")')).toBeVisible()
  }

  async expectVaultItemVisible(item: TestVaultItem): Promise<void> {
    const itemLocator = this.page.locator(`[data-testid="vault-item"]:has-text("${item.name}")`)
    await expect(itemLocator).toBeVisible()
    
    // Check that encrypted data is displayed (username should be visible)
    await expect(itemLocator.locator(`text=${item.username}`)).toBeVisible()
    
    // Password should be hidden by default
    await expect(itemLocator.locator('text=••••••••')).toBeVisible()
  }

  async togglePasswordVisibility(itemName: string): Promise<void> {
    const itemLocator = this.page.locator(`[data-testid="vault-item"]:has-text("${itemName}")`)
    await itemLocator.locator('button[aria-label*="password"]').click()
  }

  async expectPasswordVisible(itemName: string, password: string): Promise<void> {
    const itemLocator = this.page.locator(`[data-testid="vault-item"]:has-text("${itemName}")`)
    await expect(itemLocator.locator(`text=${password}`)).toBeVisible()
  }

  async expectPasswordHidden(itemName: string): Promise<void> {
    const itemLocator = this.page.locator(`[data-testid="vault-item"]:has-text("${itemName}")`)
    await expect(itemLocator.locator('text=••••••••')).toBeVisible()
  }

  async deleteVaultItem(itemName: string): Promise<void> {
    const itemLocator = this.page.locator(`[data-testid="vault-item"]:has-text("${itemName}")`)
    await itemLocator.locator('button:has-text("Delete")').click()
    
    // Confirm deletion if there's a confirmation dialog
    const confirmButton = this.page.locator('button:has-text("Confirm")').first()
    if (await confirmButton.isVisible()) {
      await confirmButton.click()
    }
    
    // Wait for item to be removed
    await expect(itemLocator).not.toBeVisible()
  }

  async searchVaultItems(query: string): Promise<void> {
    await this.page.fill('input[placeholder*="Search"]', query)
  }

  async expectSearchResults(expectedCount: number): Promise<void> {
    const items = this.page.locator('[data-testid="vault-item"]')
    await expect(items).toHaveCount(expectedCount)
  }
}

/**
 * Security testing helper functions
 */
export class SecurityHelpers {
  constructor(private page: Page) {}

  async expectSecureContext(): Promise<void> {
    // Verify HTTPS or localhost
    const url = this.page.url()
    expect(url.startsWith('https://') || url.includes('localhost')).toBeTruthy()
  }

  async expectNoSensitiveDataInDOM(): Promise<void> {
    // Check that no plaintext passwords are visible in DOM
    const bodyText = await this.page.textContent('body')
    
    // Should not contain common password patterns
    expect(bodyText).not.toMatch(/password.*[a-zA-Z0-9]{8,}/i)
    expect(bodyText).not.toMatch(/secret.*key/i)
    expect(bodyText).not.toMatch(/master.*key/i)
  }

  async expectSessionTokenInStorage(): Promise<void> {
    const sessionToken = await this.page.evaluate(() => 
      sessionStorage.getItem('robpass_session_token')
    )
    expect(sessionToken).toBeTruthy()
    expect(typeof sessionToken).toBe('string')
    expect(sessionToken!.length).toBeGreaterThan(10)
  }

  async expectNoSessionTokenInStorage(): Promise<void> {
    const sessionToken = await this.page.evaluate(() => 
      sessionStorage.getItem('robpass_session_token')
    )
    expect(sessionToken).toBeNull()
  }

  async expectCleanSessionStorage(): Promise<void> {
    const storageLength = await this.page.evaluate(() => sessionStorage.length)
    expect(storageLength).toBe(0)
  }

  async simulateNetworkError(): Promise<void> {
    await this.page.route('**/api/**', route => route.abort())
  }

  async clearNetworkInterception(): Promise<void> {
    await this.page.unroute('**/api/**')
  }

  async expectErrorMessage(message: string): Promise<void> {
    await expect(this.page.locator(`text=${message}`)).toBeVisible()
  }

  async expectNoErrorMessage(): Promise<void> {
    // Check that no error messages are visible
    const errorSelectors = [
      '[role="alert"]',
      '.error',
      '.alert-error',
      'text=Error',
      'text=Failed',
      'text=Invalid'
    ]
    
    for (const selector of errorSelectors) {
      await expect(this.page.locator(selector)).not.toBeVisible()
    }
  }
}

/**
 * Cryptographic operation testing helpers
 */
export class CryptoHelpers {
  constructor(private page: Page) {}

  async expectWebCryptoAvailable(): Promise<void> {
    const hasCrypto = await this.page.evaluate(() => {
      return typeof window.crypto !== 'undefined' && 
             typeof window.crypto.subtle !== 'undefined'
    })
    expect(hasCrypto).toBeTruthy()
  }

  async expectSecureRandomGeneration(): Promise<void> {
    const randomValues = await this.page.evaluate(() => {
      const array = new Uint8Array(32)
      window.crypto.getRandomValues(array)
      return Array.from(array)
    })
    
    expect(randomValues).toHaveLength(32)
    
    // Check that values are not all the same (very unlikely with secure random)
    const uniqueValues = new Set(randomValues)
    expect(uniqueValues.size).toBeGreaterThan(1)
  }

  async testPasswordGeneration(): Promise<string> {
    await this.page.click('button:has-text("Generate Password")')
    
    const generatedPassword = await this.page.inputValue('input[placeholder="password"]')
    
    // Verify password meets security requirements
    expect(generatedPassword.length).toBeGreaterThanOrEqual(12)
    expect(generatedPassword).toMatch(/[A-Z]/) // Uppercase
    expect(generatedPassword).toMatch(/[a-z]/) // Lowercase
    expect(generatedPassword).toMatch(/[0-9]/) // Numbers
    expect(generatedPassword).toMatch(/[^A-Za-z0-9]/) // Special characters
    
    return generatedPassword
  }
}

/**
 * Performance and timing helpers
 */
export class PerformanceHelpers {
  constructor(private page: Page) {}

  async measureOperationTime<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startTime = Date.now()
    const result = await operation()
    const duration = Date.now() - startTime
    
    return { result, duration }
  }

  async expectOperationWithinTime<T>(
    operation: () => Promise<T>, 
    maxDuration: number
  ): Promise<T> {
    const { result, duration } = await this.measureOperationTime(operation)
    expect(duration).toBeLessThan(maxDuration)
    return result
  }

  async expectEncryptionPerformance(): Promise<void> {
    // Test that encryption operations complete within reasonable time
    await this.expectOperationWithinTime(async () => {
      const item = TestVaultItem.createDefault()
      const vaultHelpers = new VaultHelpers(this.page)
      await vaultHelpers.addVaultItem(item)
    }, 5000) // 5 seconds max for encryption and storage
  }
}
