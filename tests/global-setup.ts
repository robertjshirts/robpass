/**
 * Global Setup for Playwright Tests
 * 
 * This file runs before all tests and sets up the test environment,
 * including database initialization and security configurations.
 */

import { chromium, FullConfig } from '@playwright/test'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

async function globalSetup(config: FullConfig) {
  console.log('🔧 Setting up test environment...')

  // 1. Setup test database
  setupTestDatabase()

  // 2. Verify security requirements
  verifySecurityRequirements()

  // 3. Setup test data directory
  setupTestDataDirectory()

  // 4. Warm up the application
  await warmupApplication(config)

  console.log('✅ Test environment setup complete')
}

/**
 * Setup test database with clean state
 */
function setupTestDatabase() {
  console.log('📊 Setting up test database...')
  
  try {
    // Remove existing test database
    const testDbPath = 'test.db'
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }

    // Set test environment
    process.env.NODE_ENV = 'test'
    process.env.DB_FILE_NAME = testDbPath

    // Run database migrations
    execSync('npm run db:push', { stdio: 'inherit' })
    
    console.log('✅ Test database setup complete')
  } catch (error) {
    console.error('❌ Failed to setup test database:', error)
    throw error
  }
}

/**
 * Verify security requirements for testing
 */
function verifySecurityRequirements() {
  console.log('🔒 Verifying security requirements...')
  
  // Check that we're not running against production
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Tests should not run in production environment')
  }

  // Verify test environment variables
  const requiredEnvVars = ['DB_FILE_NAME', 'JWT_SECRET']
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`⚠️  Environment variable ${envVar} not set, using default`)
    }
  }

  // Ensure test database is separate from production
  const dbPath = process.env.DB_FILE_NAME || 'test.db'
  if (dbPath.includes('production') || dbPath.includes('local.db')) {
    throw new Error('Test database path conflicts with production database')
  }

  console.log('✅ Security requirements verified')
}

/**
 * Setup test data directory
 */
function setupTestDataDirectory() {
  console.log('📁 Setting up test data directory...')
  
  const testDataDir = path.join(__dirname, 'test-data')
  
  // Create test data directory if it doesn't exist
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true })
  }

  // Create test artifacts directory
  const artifactsDir = path.join(__dirname, '..', 'test-results')
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true })
  }

  console.log('✅ Test data directory setup complete')
}

/**
 * Warm up the application to ensure it's ready for testing
 */
async function warmupApplication(config: FullConfig) {
  console.log('🚀 Warming up application...')
  
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000'
  
  try {
    // Launch a browser to warm up the application
    const browser = await chromium.launch()
    const page = await browser.newPage()
    
    // Wait for application to be ready
    let retries = 30
    while (retries > 0) {
      try {
        await page.goto(baseURL, { waitUntil: 'networkidle' })
        
        // Check if the main heading is visible (indicates app is loaded)
        await page.waitForSelector('h1:has-text("🔐 RobPass")', { timeout: 5000 })
        break
      } catch (error) {
        retries--
        if (retries === 0) {
          throw new Error(`Application not ready after 30 attempts: ${error}`)
        }
        console.log(`⏳ Waiting for application... (${30 - retries}/30)`)
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    await browser.close()
    console.log('✅ Application warmup complete')
  } catch (error) {
    console.error('❌ Failed to warm up application:', error)
    throw error
  }
}

export default globalSetup
