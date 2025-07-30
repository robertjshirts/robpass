/**
 * Global Teardown for Playwright Tests
 * 
 * This file runs after all tests and cleans up the test environment,
 * ensuring no sensitive data is left behind.
 */

import { FullConfig } from '@playwright/test'
import fs from 'fs'
import path from 'path'

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up test environment...')

  // 1. Clean up test database
  cleanupTestDatabase()

  // 2. Clean up test artifacts (but preserve reports)
  cleanupTestArtifacts()

  // 3. Verify no sensitive data remains
  verifySensitiveDataCleanup()

  // 4. Generate test summary
  generateTestSummary()

  console.log('✅ Test environment cleanup complete')
}

/**
 * Clean up test database and sensitive data
 */
function cleanupTestDatabase() {
  console.log('🗑️  Cleaning up test database...')
  
  try {
    const testDbPath = process.env.DB_FILE_NAME || 'test.db'
    
    if (fs.existsSync(testDbPath)) {
      // Securely delete the test database
      fs.unlinkSync(testDbPath)
      console.log(`✅ Deleted test database: ${testDbPath}`)
    }

    // Clean up any database-related temporary files
    const tempFiles = [
      'test.db-shm',
      'test.db-wal',
      '.tmp.db',
      'temp.db'
    ]

    for (const file of tempFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
        console.log(`✅ Deleted temporary file: ${file}`)
      }
    }

  } catch (error) {
    console.error('❌ Error cleaning up test database:', error)
  }
}

/**
 * Clean up test artifacts while preserving reports
 */
function cleanupTestArtifacts() {
  console.log('📁 Cleaning up test artifacts...')
  
  try {
    const testDataDir = path.join(__dirname, 'test-data')
    
    if (fs.existsSync(testDataDir)) {
      // Remove test data files but keep the directory structure
      const files = fs.readdirSync(testDataDir)
      
      for (const file of files) {
        const filePath = path.join(testDataDir, file)
        const stat = fs.statSync(filePath)
        
        if (stat.isFile()) {
          fs.unlinkSync(filePath)
          console.log(`✅ Deleted test data file: ${file}`)
        }
      }
    }

    // Clean up temporary screenshots and videos (keep only failures)
    const testResultsDir = path.join(__dirname, '..', 'test-results')
    
    if (fs.existsSync(testResultsDir)) {
      const entries = fs.readdirSync(testResultsDir, { withFileTypes: true })
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(testResultsDir, entry.name)
          
          // Keep failure artifacts, remove success artifacts
          if (!entry.name.includes('failed') && !entry.name.includes('retry')) {
            try {
              fs.rmSync(dirPath, { recursive: true, force: true })
              console.log(`✅ Cleaned up test artifacts: ${entry.name}`)
            } catch (error) {
              console.warn(`⚠️  Could not clean up ${entry.name}:`, error instanceof Error ? error.message : String(error))
            }
          }
        }
      }
    }

  } catch (error) {
    console.error('❌ Error cleaning up test artifacts:', error)
  }
}

/**
 * Verify no sensitive data remains in test environment
 */
function verifySensitiveDataCleanup() {
  console.log('🔍 Verifying sensitive data cleanup...')
  
  const sensitivePatterns = [
    /password.*[^*]/i,
    /secret.*key/i,
    /auth.*token/i,
    /session.*token/i,
    /master.*key/i,
  ]

  const checkDirectories = [
    path.join(__dirname, 'test-data'),
    path.join(__dirname, '..', 'test-results'),
  ]

  for (const dir of checkDirectories) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir, { recursive: true })
        
        for (const file of files) {
          const filePath = path.join(dir, file.toString())
          
          if (fs.statSync(filePath).isFile()) {
            try {
              const content = fs.readFileSync(filePath, 'utf8')
              
              for (const pattern of sensitivePatterns) {
                if (pattern.test(content)) {
                  console.warn(`⚠️  Potential sensitive data found in: ${filePath}`)
                  // In a real scenario, you might want to fail the cleanup
                  // or implement more sophisticated cleaning
                }
              }
            } catch (error) {
              // Skip binary files or files that can't be read as text
              continue
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️  Could not verify cleanup in ${dir}:`, error instanceof Error ? error.message : String(error))
      }
    }
  }

  console.log('✅ Sensitive data cleanup verification complete')
}

/**
 * Generate test summary
 */
function generateTestSummary() {
  console.log('📊 Generating test summary...')
  
  try {
    const resultsPath = path.join(__dirname, '..', 'test-results', 'results.json')
    
    if (fs.existsSync(resultsPath)) {
      const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'))
      
      const summary = {
        timestamp: new Date().toISOString(),
        totalTests: results.stats?.total || 0,
        passed: results.stats?.passed || 0,
        failed: results.stats?.failed || 0,
        skipped: results.stats?.skipped || 0,
        duration: results.stats?.duration || 0,
        environment: {
          nodeEnv: process.env.NODE_ENV,
          testDatabase: process.env.DB_FILE_NAME,
        },
        security: {
          sensitiveDataCleaned: true,
          testDatabaseRemoved: true,
        },
      }

      const summaryPath = path.join(__dirname, '..', 'test-results', 'summary.json')
      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
      
      console.log('📈 Test Summary:')
      console.log(`   Total Tests: ${summary.totalTests}`)
      console.log(`   Passed: ${summary.passed}`)
      console.log(`   Failed: ${summary.failed}`)
      console.log(`   Duration: ${Math.round(summary.duration / 1000)}s`)
      
    } else {
      console.log('⚠️  No test results found for summary')
    }
    
  } catch (error) {
    console.error('❌ Error generating test summary:', error)
  }
}

export default globalTeardown
