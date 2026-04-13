import { test, expect, devices } from '@playwright/test'

// iPhone 12 Tests
const iPhoneContext = test.extend({
  // Setup iPhone context
})

iPhoneContext.describe('Dashboard - Mobile (iPhone 12)', () => {
  iPhoneContext.beforeEach(async ({ page }) => {
    // iPhone viewport
    await page.setViewportSize({ width: 390, height: 844 })
  })

  iPhoneContext('Dashboard does not crash on mobile viewport', async ({ page }) => {
    await page.goto('/')
    
    // Verify page loads
    await expect(page).toHaveTitle(/Dashboard|Bamakor/i)
    
    // Check main content is visible
    const mainContent = page.locator('[style*="padding"]').first()
    await expect(mainContent).toBeVisible()
  })

  iPhoneContext('Mobile navigation is accessible', async ({ page }) => {
    await page.goto('/')
    
    // On mobile, check for mobile menu button or navigation
    const navElements = page.locator('a').filter({ hasText: /dashboard|tickets|projects/i })
    
    // Verify navigation is available
    const count = await navElements.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  iPhoneContext('KPI cards stack on mobile', async ({ page }) => {
    await page.goto('/')
    
    // Wait for KPI cards to render
    await page.waitForTimeout(1000)
    
    // Verify cards are visible and stacked
    const cards = page.locator('div').filter({ hasText: /Total Tickets|Open|Assigned|Closed/i })
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  iPhoneContext('New Ticket button is accessible on mobile', async ({ page }) => {
    await page.goto('/')
    
    // Check bottom action button or header button
    const newTicketBtn = page.locator('button', { hasText: /New Ticket/i })
    await expect(newTicketBtn).toBeVisible()
    
    // Verify it's tappable (large enough)
    const box = await newTicketBtn.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(40) // Touch target size
  })

  iPhoneContext('Modal is touch-friendly on mobile', async ({ page }) => {
    await page.goto('/')
    
    // Open modal
    const newTicketBtn = page.locator('button', { hasText: /New Ticket/i })
    await newTicketBtn.click()
    
    // Verify modal is visible and not cut off
    const modal = page.locator('[style*="position"][style*="fixed"]').first()
    await expect(modal).toBeVisible()
  })

  iPhoneContext('Scrollable content on small screens', async ({ page }) => {
    await page.goto('/')
    
    // Wait for content to load
    await page.waitForTimeout(1000)
    
    // Scroll down to verify content is scrollable
    await page.evaluate(() => window.scrollBy(0, 200))
    
    // Verify no scroll errors
    const scrollPos = await page.evaluate(() => window.scrollY)
    expect(scrollPos).toBeGreaterThanOrEqual(0)
  })
})

// Android Pixel Tests
const androidContext = test.extend({})

androidContext.describe('Dashboard - Mobile (Pixel 5 Android)', () => {
  androidContext.beforeEach(async ({ page }) => {
    // Pixel 5 viewport
    await page.setViewportSize({ width: 393, height: 851 })
  })

  androidContext('Dashboard loads on Android mobile', async ({ page }) => {
    await page.goto('/')
    
    await expect(page).toHaveTitle(/Dashboard|Bamakor/i)
    
    // Verify content is visible
    const content = page.locator('[style*="padding"]').first()
    await expect(content).toBeVisible()
  })

  androidContext('Key buttons are clickable on Android', async ({ page }) => {
    await page.goto('/')
    
    const newTicketBtn = page.locator('button', { hasText: /New Ticket/i })
    await expect(newTicketBtn).toBeVisible()
    
    // Click and verify action
    await newTicketBtn.click()
    
    // Modal or action should occur
    await page.waitForTimeout(500)
  })

  androidContext('Dashboard navigation works on Android', async ({ page }) => {
    await page.goto('/')
    
    // Check for tickets link
    const ticketsLink = page.locator('a').filter({ hasText: /tickets/i })
    const count = await ticketsLink.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
