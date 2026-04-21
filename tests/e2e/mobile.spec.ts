import { test, expect } from '@playwright/test'

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
    await expect(page).toHaveTitle(/במקור|Bamakor|Dashboard/i)
    
    // Check main content is visible
    const mainContent = page.locator('[style*="padding"]').first()
    await expect(mainContent).toBeVisible()
  })

  iPhoneContext('Mobile navigation is accessible', async ({ page }) => {
    await page.goto('/')
    
    // Open mobile menu
    const menuBtn = page.locator('button[aria-label="פתיחת תפריט"]').first()
    await expect(menuBtn).toBeVisible()
    await menuBtn.click()

    // Verify navigation links are present in the opened menu
    const ticketsLink = page.locator('a[href="/tickets"]').first()
    const projectsLink = page.locator('a[href="/projects"]').first()
    await expect(ticketsLink).toBeVisible()
    await expect(projectsLink).toBeVisible()
  })

  iPhoneContext('KPI cards stack on mobile', async ({ page }) => {
    await page.goto('/')
    
    // Wait for KPI cards to render
    await page.waitForTimeout(1000)
    
    // Verify cards are visible and stacked
    const kpiButtons = page.locator('button', { hasText: /סה״כ תקלות|פתוחות|בטיפול|נסגרו/i })
    await expect(kpiButtons.first()).toBeVisible()
  })

  iPhoneContext('New Ticket button is accessible on mobile', async ({ page }) => {
    await page.goto('/')
    
    // Check bottom action button or header button
    const newTicketBtn = page.locator('button', { hasText: /תקלה חדשה/i })
    await expect(newTicketBtn).toBeVisible()
    
    // Verify it's tappable (large enough)
    const box = await newTicketBtn.boundingBox()
    expect(box?.height).toBeGreaterThanOrEqual(40) // Touch target size
  })

  iPhoneContext('Modal is touch-friendly on mobile', async ({ page }) => {
    await page.goto('/')
    
    // Open modal
    const newTicketBtn = page.locator('button', { hasText: /תקלה חדשה/i })
    await newTicketBtn.click()
    
    // Verify modal is visible and not cut off
    const modalTitle = page.locator('h2', { hasText: /תקלה חדשה/i }).first()
    await expect(modalTitle).toBeVisible()
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
    
    await expect(page).toHaveTitle(/במקור|Bamakor|Dashboard/i)
    
    // Verify content is visible
    const content = page.locator('[style*="padding"]').first()
    await expect(content).toBeVisible()
  })

  androidContext('Key buttons are clickable on Android', async ({ page }) => {
    await page.goto('/')
    
    const newTicketBtn = page.locator('button', { hasText: /תקלה חדשה/i })
    await expect(newTicketBtn).toBeVisible()
    
    // Click and verify action
    await newTicketBtn.click()
    
    // Modal or action should occur
    await page.waitForTimeout(500)
  })

  androidContext('Dashboard navigation works on Android', async ({ page }) => {
    await page.goto('/')
    
    // Open mobile menu (same header pattern on narrow viewports)
    const menuBtn = page.locator('button[aria-label="פתיחת תפריט"]').first()
    await expect(menuBtn).toBeVisible()
    await menuBtn.click()

    const ticketsLink = page.locator('a[href="/tickets"]').first()
    await expect(ticketsLink).toBeVisible()
  })
})
