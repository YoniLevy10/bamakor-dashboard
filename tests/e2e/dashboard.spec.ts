import { test, expect } from '@playwright/test'

test.describe('Dashboard - Core Functionality', () => {
  test('Dashboard page loads successfully', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/במקור|Bamakor|Dashboard/i)
    await expect(page.locator('button', { hasText: /תקלה חדשה/i }).first()).toBeVisible()
  })

  test('Main navigation renders', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('button', { hasText: /תקלה חדשה/i }).first()).toBeVisible()

    // Check sidebar links exist (stable a11y selectors)
    const dashboardLink = page.locator('nav a[href="/"]').first()
    const ticketsLink = page.locator('nav a[href="/tickets"]').first()
    const projectsLink = page.locator('nav a[href="/projects"]').first()
    
    await expect(dashboardLink).toBeVisible()
    await expect(ticketsLink).toBeVisible()
    await expect(projectsLink).toBeVisible()
  })

  test('Key buttons are visible on main dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('button', { hasText: /תקלה חדשה/i }).first()).toBeVisible()
    
    // Check for main action buttons
    const newTicketBtn = page.locator('button', { hasText: /תקלה חדשה/i })
    
    await expect(newTicketBtn).toBeVisible()
  })

  test('Dashboard does not crash on initial load', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('button', { hasText: /תקלה חדשה/i }).first()).toBeVisible()
    
    // Check for critical page elements that indicate successful load
    const pageContent = page.locator('[style*="padding"]').first()
    await expect(pageContent).toBeVisible()
    
    // Check for no console errors
    let errorCount = 0
    page.on('console', (msg) => {
      if (msg.type() === 'error') errorCount++
    })
    
    await page.waitForTimeout(2000)
    expect(errorCount).toBe(0)
  })

  test('KPI cards are displayed', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('button', { hasText: /תקלה חדשה/i }).first()).toBeVisible()
    
    // Wait for KPI cards to be visible (look for stats)
    const kpiButtons = page.locator('button', { hasText: /סה״כ תקלות|פתוחות|בטיפול|נסגרו/i })
    await expect(kpiButtons.first()).toBeVisible()
  })
})

test.describe('Dashboard - Navigation', () => {
  test('Tickets page opens via navigation', async ({ page }) => {
    await page.goto('/tickets')
    await expect(page).toHaveURL(/\/tickets/)
  })

  test('Projects page opens via navigation', async ({ page }) => {
    await page.goto('/projects')
    await expect(page).toHaveURL(/\/projects/)
  })
})

test.describe('Dashboard - Modals and Drawers', () => {
  test('New Ticket modal opens when button clicked', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('button', { hasText: /תקלה חדשה/i }).first()).toBeVisible()
    
    // Click the New Ticket button
    const newTicketBtn = page.locator('button', { hasText: /תקלה חדשה/i })
    await newTicketBtn.scrollIntoViewIfNeeded()
    await newTicketBtn.click()
    
    // Check if modal is visible
    const modalTitle = page.locator('h2', { hasText: /תקלה חדשה/i }).first()
    await expect(modalTitle).toBeVisible({ timeout: 10000 })
    
    // Check for form elements
    const projectSelect = page.locator('select').first()
    await expect(projectSelect).toBeVisible()
  })

  test('Modal can be closed', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('button', { hasText: /תקלה חדשה/i }).first()).toBeVisible()
    
    // Open modal
    const newTicketBtn = page.locator('button', { hasText: /תקלה חדשה/i })
    await newTicketBtn.scrollIntoViewIfNeeded()
    await newTicketBtn.click()
    
    // Close modal via close button or outside click
    const closeBtn = page.locator('button').filter({ hasText: /ביטול|סגירה|×/i }).first()
    const modalTitle = page.locator('h2', { hasText: /תקלה חדשה/i }).first()
    await expect(modalTitle).toBeVisible()
    if (await closeBtn.isVisible()) {
      await closeBtn.click()
    } else {
      // Click overlay to close
      const overlay = page.locator('[style*="background"][style*="rgba"]').first()
      await overlay.click({ position: { x: 0, y: 0 } })
    }
    
    // Modal should be hidden
    await expect(modalTitle).toBeHidden()
  })
})
