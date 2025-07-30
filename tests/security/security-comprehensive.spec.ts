/**
 * Comprehensive Security Tests
 * 
 * Tests all security requirements including rate limiting, session management,
 * data isolation, error handling, and security logging through E2E scenarios.
 */

import { test, expect } from '@playwright/test'
import { 
  AuthHelpers, 
  VaultHelpers, 
  SecurityHelpers,
  TestUser, 
  TestVaultItem 
} from '../utils/playwright-helpers'

test.describe('Security Comprehensive Tests', () => {
  let authHelpers: AuthHelpers
  let vaultHelpers: VaultHelpers
  let securityHelpers: SecurityHelpers

  test.beforeEach(async ({ page }) => {
    authHelpers = new AuthHelpers(page)
    vaultHelpers = new VaultHelpers(page)
    securityHelpers = new SecurityHelpers(page)
    
    await authHelpers.navigateToLogin()
  })

  test.describe('Authentication Security', () => {
    test('should enforce rate limiting on failed login attempts', async ({ page }) => {
      const user = TestUser.createDefault()
      const wrongPassword = 'WrongPassword123!'
      
      // Attempt multiple failed logins
      for (let i = 0; i < 6; i++) {
        await page.fill('input[placeholder="Username"]', user.username)
        await page.fill('input[placeholder="Password"]', wrongPassword)
        await page.click('button:has-text("Sign In")')
        
        if (i < 4) {
          // First few attempts should show invalid credentials
          await expect(page.locator('text=Invalid credentials')).toBeVisible()
          
          // Clear the form for next attempt
          await page.fill('input[placeholder="Username"]', '')
          await page.fill('input[placeholder="Password"]', '')
        } else {
          // After 5 attempts, should show rate limiting
          await expect(page.locator('text=Too many failed attempts')).toBeVisible()
          break
        }
      }
    })

    test('should prevent timing attacks on authentication', async ({ page }) => {
      const validUser = TestUser.createRandom()
      const invalidUser = new TestUser('nonexistent_user', 'password123')
      
      // Register valid user first
      await authHelpers.switchToRegistration()
      await authHelpers.register(validUser)
      await authHelpers.logout()
      
      // Measure timing for valid vs invalid usernames
      const timings: number[] = []
      
      // Test with invalid username
      const startTime1 = Date.now()
      await page.fill('input[placeholder="Username"]', invalidUser.username)
      await page.fill('input[placeholder="Password"]', invalidUser.password)
      await page.click('button:has-text("Sign In")')
      await expect(page.locator('text=Invalid credentials')).toBeVisible()
      timings.push(Date.now() - startTime1)
      
      // Clear form
      await page.fill('input[placeholder="Username"]', '')
      await page.fill('input[placeholder="Password"]', '')
      
      // Test with valid username but wrong password
      const startTime2 = Date.now()
      await page.fill('input[placeholder="Username"]', validUser.username)
      await page.fill('input[placeholder="Password"]', 'wrongpassword')
      await page.click('button:has-text("Sign In")')
      await expect(page.locator('text=Invalid credentials')).toBeVisible()
      timings.push(Date.now() - startTime2)
      
      // Timing difference should be minimal (within 500ms)
      const timingDifference = Math.abs(timings[0] - timings[1])
      expect(timingDifference).toBeLessThan(500)
    })

    test('should enforce secure password requirements', async ({ page }) => {
      await authHelpers.switchToRegistration()
      
      const weakPasswords = [
        '123',           // Too short
        'password',      // No numbers/symbols
        '12345678',      // Only numbers
        'PASSWORD',      // Only uppercase
        'password123',   // No symbols
      ]
      
      for (const weakPassword of weakPasswords) {
        await page.fill('input[placeholder="Username"]', 'testuser')
        await page.fill('input[placeholder="Password"]', weakPassword)
        await page.fill('input[placeholder="Confirm Password"]', weakPassword)
        
        await page.click('button:has-text("Create Account")')
        
        // Should show password strength error
        const errorVisible = await page.locator('text*=Password must').isVisible()
        expect(errorVisible).toBeTruthy()
        
        // Clear form for next test
        await page.fill('input[placeholder="Username"]', '')
        await page.fill('input[placeholder="Password"]', '')
        await page.fill('input[placeholder="Confirm Password"]', '')
      }
    })

    test('should prevent session fixation attacks', async ({ page }) => {
      // Get initial session state
      const initialSessionToken = await page.evaluate(() => 
        sessionStorage.getItem('robpass_session_token')
      )
      
      const user = TestUser.createRandom()
      
      // Register and login
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      // Verify new session token was created
      const newSessionToken = await page.evaluate(() => 
        sessionStorage.getItem('robpass_session_token')
      )
      
      expect(newSessionToken).not.toBe(initialSessionToken)
      expect(newSessionToken).toBeTruthy()
    })
  })

  test.describe('Data Isolation and Access Control', () => {
    test('should isolate user data completely', async ({ page, context }) => {
      const user1 = TestUser.createRandom()
      const user2 = TestUser.createRandom()
      const user1Item = TestVaultItem.createRandom()
      const user2Item = TestVaultItem.createRandom()
      
      // User 1: Register and add vault item
      await authHelpers.switchToRegistration()
      await authHelpers.register(user1)
      await vaultHelpers.addVaultItem(user1Item)
      await authHelpers.logout()
      
      // User 2: Register and add different vault item
      await authHelpers.switchToRegistration()
      await authHelpers.register(user2)
      await vaultHelpers.addVaultItem(user2Item)
      
      // Verify User 2 can only see their own item
      await expect(page.locator(`text=${user2Item.name}`)).toBeVisible()
      await expect(page.locator(`text=${user1Item.name}`)).not.toBeVisible()
      
      await vaultHelpers.expectVaultItemCount(1)
    })

    test('should prevent unauthorized API access', async ({ page }) => {
      const user = TestUser.createRandom()
      
      // Register and login
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      // Get session token
      const sessionToken = await page.evaluate(() => 
        sessionStorage.getItem('robpass_session_token')
      )
      
      // Logout to clear session
      await authHelpers.logout()
      
      // Try to access API with old token
      const response = await page.request.get('/api/vault/items', {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      })
      
      // Should be unauthorized
      expect(response.status()).toBe(401)
    })

    test('should validate session tokens properly', async ({ page }) => {
      const user = TestUser.createRandom()
      
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      // Tamper with session token
      await page.evaluate(() => {
        sessionStorage.setItem('robpass_session_token', 'invalid_token')
      })
      
      // Try to access vault - should redirect to login
      await page.reload()
      await expect(page.locator('h2:has-text("Sign In")')).toBeVisible()
    })
  })

  test.describe('Error Handling and Information Disclosure', () => {
    test('should not expose sensitive information in errors', async ({ page }) => {
      // Test various error scenarios
      const errorScenarios = [
        {
          action: async () => {
            await page.fill('input[placeholder="Username"]', 'testuser')
            await page.fill('input[placeholder="Password"]', 'wrongpassword')
            await page.click('button:has-text("Sign In")')
          },
          expectedError: 'Invalid credentials'
        },
        {
          action: async () => {
            await authHelpers.switchToRegistration()
            await page.fill('input[placeholder="Username"]', 'a'.repeat(100)) // Too long
            await page.fill('input[placeholder="Password"]', 'ValidPassword123!')
            await page.fill('input[placeholder="Confirm Password"]', 'ValidPassword123!')
            await page.click('button:has-text("Create Account")')
          },
          expectedError: 'Invalid username'
        }
      ]
      
      for (const scenario of errorScenarios) {
        await scenario.action()
        
        // Check that error message is user-friendly and doesn't expose internals
        const bodyText = await page.textContent('body')
        
        // Should not contain technical details
        expect(bodyText).not.toMatch(/database/i)
        expect(bodyText).not.toMatch(/sql/i)
        expect(bodyText).not.toMatch(/server error/i)
        expect(bodyText).not.toMatch(/stack trace/i)
        expect(bodyText).not.toMatch(/exception/i)
        
        // Should contain expected user-friendly message
        await expect(page.locator(`text=${scenario.expectedError}`)).toBeVisible()
        
        // Reset for next test
        await page.reload()
      }
    })

    test('should handle network errors gracefully', async ({ page }) => {
      const user = TestUser.createRandom()
      
      await authHelpers.switchToRegistration()
      
      // Simulate network failure during registration
      await securityHelpers.simulateNetworkError()
      
      await page.fill('input[placeholder="Username"]', user.username)
      await page.fill('input[placeholder="Password"]', user.password)
      await page.fill('input[placeholder="Confirm Password"]', user.password)
      
      await page.click('button:has-text("Create Account")')
      
      // Should show network error message
      await expect(page.locator('text=Network error')).toBeVisible()
      
      // Clear network interception
      await securityHelpers.clearNetworkInterception()
    })

    test('should handle malformed responses securely', async ({ page }) => {
      const user = TestUser.createRandom()
      
      // Intercept API responses and return malformed data
      await page.route('**/api/auth/register', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: 'invalid json{'
        })
      })
      
      await authHelpers.switchToRegistration()
      
      await page.fill('input[placeholder="Username"]', user.username)
      await page.fill('input[placeholder="Password"]', user.password)
      await page.fill('input[placeholder="Confirm Password"]', user.password)
      
      await page.click('button:has-text("Create Account")')
      
      // Should handle parsing error gracefully
      await expect(page.locator('text=An error occurred')).toBeVisible()
    })
  })

  test.describe('Session Security', () => {
    test('should expire sessions after inactivity', async ({ page }) => {
      const user = TestUser.createRandom()
      
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      // Verify session is active
      await vaultHelpers.expectVaultDashboard()
      
      // Simulate session expiry by manipulating session storage
      await page.evaluate(() => {
        // Set an expired timestamp
        const expiredTime = Date.now() - (31 * 60 * 1000) // 31 minutes ago
        sessionStorage.setItem('robpass_last_activity', expiredTime.toString())
      })
      
      // Try to access vault - should redirect to login
      await page.reload()
      await expect(page.locator('h2:has-text("Sign In")')).toBeVisible()
    })

    test('should clear sensitive data on page unload', async ({ page }) => {
      const user = TestUser.createRandom()
      
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      // Verify session data exists
      await securityHelpers.expectSessionTokenInStorage()
      
      // Simulate page unload
      await page.evaluate(() => {
        window.dispatchEvent(new Event('beforeunload'))
      })
      
      // Session storage should be cleared
      await securityHelpers.expectCleanSessionStorage()
    })

    test('should prevent concurrent sessions', async ({ page, context }) => {
      const user = TestUser.createRandom()
      
      // Register user in first tab
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      // Open second tab and try to login with same user
      const secondPage = await context.newPage()
      const secondAuthHelpers = new AuthHelpers(secondPage)
      
      await secondAuthHelpers.navigateToLogin()
      await secondAuthHelpers.login(user)
      
      // First tab should be logged out
      await page.reload()
      await expect(page.locator('h2:has-text("Sign In")')).toBeVisible()
      
      await secondPage.close()
    })
  })

  test.describe('Input Validation and Sanitization', () => {
    test('should sanitize user inputs', async ({ page }) => {
      const user = TestUser.createRandom()
      
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      // Test XSS prevention in vault item names
      const maliciousItem = new TestVaultItem(
        '<script>alert("xss")</script>',
        'test@example.com',
        'password123',
        'https://example.com'
      )
      
      await vaultHelpers.addVaultItem(maliciousItem)
      
      // Script should not execute - name should be displayed as text
      const itemElement = page.locator('[data-testid="vault-item"]').first()
      const itemText = await itemElement.textContent()
      
      expect(itemText).toContain('<script>')
      expect(itemText).not.toContain('alert')
      
      // Verify no script was executed
      const alertDialogs: string[] = []
      page.on('dialog', dialog => {
        alertDialogs.push(dialog.message())
        dialog.dismiss()
      })
      
      expect(alertDialogs).toHaveLength(0)
    })

    test('should validate input lengths', async ({ page }) => {
      const user = TestUser.createRandom()
      
      await authHelpers.switchToRegistration()
      await authHelpers.register(user)
      
      await vaultHelpers.openAddPasswordForm()
      
      // Test extremely long input
      const longString = 'a'.repeat(10000)
      
      await page.fill('input[placeholder="e.g., Gmail, Facebook, Work Email"]', longString)
      await page.fill('input[placeholder="username or email"]', 'test@example.com')
      await page.fill('input[placeholder="password"]', 'password123')
      
      await page.click('button:has-text("Add Password"):not(:has-text("Generate"))')
      
      // Should show validation error
      await expect(page.locator('text=Name is too long')).toBeVisible()
    })
  })
})
