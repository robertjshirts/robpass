/**
 * Cryptographic Operations E2E Tests
 * 
 * Tests all cryptographic functionality through the UI to ensure
 * proper encryption, decryption, key derivation, and security.
 */

import { test, expect } from '@playwright/test'
import { 
  AuthHelpers, 
  VaultHelpers, 
  SecurityHelpers, 
  CryptoHelpers,
  PerformanceHelpers,
  TestUser, 
  TestVaultItem 
} from '../utils/playwright-helpers'

test.describe('Cryptographic Operations', () => {
  let authHelpers: AuthHelpers
  let vaultHelpers: VaultHelpers
  let securityHelpers: SecurityHelpers
  let cryptoHelpers: CryptoHelpers
  let performanceHelpers: PerformanceHelpers

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page)
    vaultHelpers = new VaultHelpers(page)
    securityHelpers = new SecurityHelpers(page)
    cryptoHelpers = new CryptoHelpers(page)
    performanceHelpers = new PerformanceHelpers(page)
    
    await authHelpers.navigateToLogin()
  })

  test.describe('Web Crypto API Availability', () => {
    test('should have Web Crypto API available', async () => {
      await cryptoHelpers.expectWebCryptoAvailable()
    })

    test('should generate secure random values', async () => {
      await cryptoHelpers.expectSecureRandomGeneration()
    })

    test('should operate in secure context', async () => {
      await securityHelpers.expectSecureContext()
    })
  })

  test.describe('Password Generation', () => {
    test('should generate secure passwords', async ({ page }) => {
      const user = TestUser.createRandom()
      
      // Register and login
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      // Test password generation
      await vaultHelpers.openAddPasswordForm()
      const generatedPassword = await cryptoHelpers.testPasswordGeneration()
      
      // Verify password meets security requirements
      expect(generatedPassword.length).toBeGreaterThanOrEqual(12)
      expect(generatedPassword).toMatch(/[A-Z]/) // Uppercase
      expect(generatedPassword).toMatch(/[a-z]/) // Lowercase  
      expect(generatedPassword).toMatch(/[0-9]/) // Numbers
      expect(generatedPassword).toMatch(/[^A-Za-z0-9]/) // Special characters
    })

    test('should generate unique passwords each time', async ({ page }) => {
      const user = TestUser.createRandom()
      
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      await vaultHelpers.openAddPasswordForm()
      
      // Generate multiple passwords and verify they're different
      const passwords = []
      for (let i = 0; i < 3; i++) {
        const password = await cryptoHelpers.testPasswordGeneration()
        passwords.push(password)
        
        // Clear the field for next generation
        await page.fill('input[placeholder="password"]', '')
      }
      
      // All passwords should be unique
      const uniquePasswords = new Set(passwords)
      expect(uniquePasswords.size).toBe(passwords.length)
    })
  })

  test.describe('Data Encryption and Storage', () => {
    test('should encrypt vault items before storage', async ({ page }) => {
      const user = TestUser.createRandom()
      const vaultItem = TestVaultItem.createRandom()
      
      // Register and login
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      // Monitor network requests to verify encryption
      const apiRequests: any[] = []
      page.on('request', request => {
        if (request.url().includes('/api/vault')) {
          apiRequests.push({
            url: request.url(),
            method: request.method(),
            postData: request.postData()
          })
        }
      })
      
      // Add vault item
      await vaultHelpers.addVaultItem(vaultItem)
      
      // Verify that the API request contains encrypted data
      const createRequest = apiRequests.find(req => req.method === 'POST')
      expect(createRequest).toBeDefined()
      
      if (createRequest?.postData) {
        const requestData = JSON.parse(createRequest.postData)
        
        // Should contain encrypted_data and iv fields
        expect(requestData.encrypted_data).toBeDefined()
        expect(requestData.iv).toBeDefined()
        
        // Should not contain plaintext password
        expect(requestData.encrypted_data).not.toContain(vaultItem.password)
        expect(requestData.encrypted_data).not.toContain(vaultItem.username)
        
        // Encrypted data should be base64 encoded
        expect(requestData.encrypted_data).toMatch(/^[A-Za-z0-9+/]*={0,2}$/)
        expect(requestData.iv).toMatch(/^[A-Za-z0-9+/]*={0,2}$/)
      }
    })

    test('should decrypt vault items for display', async ({ page }) => {
      const user = TestUser.createRandom()
      const vaultItem = TestVaultItem.createRandom()
      
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      // Add vault item
      await vaultHelpers.addVaultItem(vaultItem)
      
      // View the item to trigger decryption
      await vaultHelpers.viewVaultItem(vaultItem.name)
      
      // Verify decrypted data is displayed correctly
      await vaultHelpers.expectVaultItemVisible(vaultItem)
      
      // Toggle password visibility to verify decryption
      await vaultHelpers.togglePasswordVisibility(vaultItem.name)
      await vaultHelpers.expectPasswordVisible(vaultItem.name, vaultItem.password)
    })

    test('should handle encryption errors gracefully', async ({ page }) => {
      const user = TestUser.createRandom()
      
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      // Simulate crypto API failure
      await page.addInitScript(() => {
        // Override crypto.subtle.encrypt to fail
        const originalEncrypt = window.crypto.subtle.encrypt
        window.crypto.subtle.encrypt = () => Promise.reject(new Error('Encryption failed'))
      })
      
      await vaultHelpers.openAddPasswordForm()
      
      const vaultItem = TestVaultItem.createDefault()
      await page.fill('input[placeholder="e.g., Gmail, Facebook, Work Email"]', vaultItem.name)
      await page.fill('input[placeholder="username or email"]', vaultItem.username)
      await page.fill('input[placeholder="password"]', vaultItem.password)
      
      await page.click('button:has-text("Add Password"):not(:has-text("Generate"))')
      
      // Should show user-friendly error message
      await securityHelpers.expectErrorMessage('Failed to encrypt data')
    })
  })

  test.describe('Key Derivation and Management', () => {
    test('should derive master key from password during login', async ({ page }) => {
      const user = TestUser.createRandom()
      
      // Register user first
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      await authHelpers.logout()
      
      // Monitor the login process
      let loginStartTime: number
      let loginEndTime: number
      
      page.on('request', request => {
        if (request.url().includes('/api/auth/login')) {
          loginStartTime = Date.now()
        }
      })
      
      page.on('response', response => {
        if (response.url().includes('/api/auth/login')) {
          loginEndTime = Date.now()
        }
      })
      
      // Login to trigger key derivation
      await authHelpers.login(user)
      
      // Verify login completed (key derivation successful)
      await vaultHelpers.expectVaultDashboard()
      
      // Key derivation should take reasonable time (PBKDF2 with sufficient iterations)
      const loginDuration = loginEndTime! - loginStartTime!
      expect(loginDuration).toBeGreaterThan(100) // At least 100ms for proper PBKDF2
      expect(loginDuration).toBeLessThan(10000) // But not too slow for UX
    })

    test('should maintain master key in memory only', async ({ page }) => {
      const user = TestUser.createRandom()
      
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      // Verify session token is stored but not master key
      await securityHelpers.expectSessionTokenInStorage()
      
      // Check that master key is not in any storage
      const localStorageKeys = await page.evaluate(() => Object.keys(localStorage))
      const sessionStorageKeys = await page.evaluate(() => Object.keys(sessionStorage))
      
      const allKeys = [...localStorageKeys, ...sessionStorageKeys]
      
      for (const key of allKeys) {
        expect(key.toLowerCase()).not.toContain('master')
        expect(key.toLowerCase()).not.toContain('key')
        expect(key.toLowerCase()).not.toContain('password')
      }
    })

    test('should clear master key on logout', async ({ page }) => {
      const user = TestUser.createRandom()
      
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      // Verify we can access vault (master key is available)
      await vaultHelpers.expectVaultDashboard()
      
      // Logout
      await authHelpers.logout()
      
      // Verify session storage is cleared
      await securityHelpers.expectNoSessionTokenInStorage()
      
      // Try to access vault directly - should redirect to login
      await page.goto('/')
      await expect(page.locator('h2:has-text("Sign In")')).toBeVisible()
    })
  })

  test.describe('Encryption Performance', () => {
    test('should encrypt data within reasonable time', async ({ page }) => {
      const user = TestUser.createRandom()
      
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      // Test encryption performance
      await performanceHelpers.expectEncryptionPerformance()
    })

    test('should handle multiple concurrent encryptions', async ({ page }) => {
      const user = TestUser.createRandom()
      
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      // Add multiple vault items quickly
      const items = Array.from({ length: 3 }, () => TestVaultItem.createRandom())
      
      const startTime = Date.now()
      
      for (const item of items) {
        await vaultHelpers.addVaultItem(item)
      }
      
      const totalTime = Date.now() - startTime
      
      // Should complete all encryptions within reasonable time
      expect(totalTime).toBeLessThan(15000) // 15 seconds for 3 items
      
      // Verify all items were added successfully
      await vaultHelpers.expectVaultItemCount(items.length)
    })
  })

  test.describe('Security Validation', () => {
    test('should not expose sensitive data in DOM', async ({ page }) => {
      const user = TestUser.createRandom()
      const vaultItem = TestVaultItem.createRandom()
      
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      await vaultHelpers.addVaultItem(vaultItem)
      
      // Verify no sensitive data is exposed
      await securityHelpers.expectNoSensitiveDataInDOM()
    })

    test('should handle browser refresh securely', async ({ page }) => {
      const user = TestUser.createRandom()
      
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      // Refresh the page
      await page.reload()
      
      // Should require re-authentication (master key lost)
      await expect(page.locator('h2:has-text("Sign In")')).toBeVisible()
      
      // Session token should still be present for convenience
      await securityHelpers.expectSessionTokenInStorage()
    })

    test('should validate crypto parameters', async ({ page }) => {
      const user = TestUser.createRandom()
      
      // Test with weak password
      const weakUser = new TestUser('testuser', '123')
      
      await authHelpers.switchToRegistration()
      
      await page.fill('input[placeholder="Username"]', weakUser.username)
      await page.fill('input[placeholder="Password"]', weakUser.password)
      await page.fill('input[placeholder="Confirm Password"]', weakUser.password)
      
      await page.click('button:has-text("Create Account")')
      
      // Should show password strength error
      await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible()
    })
  })
})
