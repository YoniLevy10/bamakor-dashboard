import { test, expect } from '@playwright/test'

test.describe('Dashboard - Core Functionality', () => {
  test('Dashboard page loads successfully', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/במקור|Bamakor|Dashboard/i)
  })

  test('Main navigation renders', async ({ page }) => {
    await page.goto('/')
    // Check sidebar links exist
    const dashboardLink = page.locator('a[href="/"]').first()
    const ticketsLink = page.locator('a[href="/tickets"]').first()
    const projectsLink = page.locator('a[href="/projects"]').first()
    
    await expect(dashboardLink).toBeVisible()
    await expect(ticketsLink).toBeVisible()
    await expect(projectsLink).toBeVisible()
  })

  test('Key buttons are visible on main dashboard', async ({ page }) => {
    await page.goto('/')
    
    // Check for main action buttons
    const newTicketBtn = page.locator('button', { hasText: /תקלה חדשה/i })
    
    await expect(newTicketBtn).toBeVisible()
  })

  test('Dashboard does not crash on initial load', async ({ page }) => {
    await page.goto('/')
    
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
    
    // Wait for KPI cards to be visible (look for stats)
    const kpiCards = page.locator('div').filter({ hasText: /סה״כ תקלות|פתוחות|בטיפול|נסגרו/i })
    await expect(kpiCards.first()).toBeVisible()
  })
})

test.describe('Dashboard - Navigation', () => {
  test('Tickets page opens via navigation', async ({ page }) => {
    await page.goto('/')
    
    // Click on tickets link
    const ticketsLink = page.locator('a[href="/tickets"]:visible').first()
    await expect(ticketsLink).toBeVisible()
    await Promise.all([
      page.waitForURL(/\/tickets/),
      ticketsLink.click(),
    ])
    
    // Verify navigation to tickets page
    await expect(page).toHaveURL(/\/tickets/)
  })

  test('Projects page opens via navigation', async ({ page }) => {
    await page.goto('/')
    
    // Click on projects link
    const projectsLink = page.locator('a[href="/projects"]:visible').first()
    await expect(projectsLink).toBeVisible()
    await Promise.all([
      page.waitForURL(/\/projects/),
      projectsLink.click(),
    ])
    
    // Verify navigation to projects page
    await expect(page).toHaveURL(/\/projects/)
  })
})

test.describe('Dashboard - Modals and Drawers', () => {
  test('New Ticket modal opens when button clicked', async ({ page }) => {
    await page.goto('/')
    
    // Click the New Ticket button
    const newTicketBtn = page.locator('button', { hasText: /תקלה חדשה/i })
    await newTicketBtn.click()
    
    // Check if modal is visible
    const modalTitle = page.locator('h2', { hasText: /תקלה חדשה/i }).first()
    await expect(modalTitle).toBeVisible()
    
    // Check for form elements
    const projectSelect = page.locator('select').first()
    await expect(projectSelect).toBeVisible()
  })

  test('Modal can be closed', async ({ page }) => {
    await page.goto('/')
    
    // Open modal
    const newTicketBtn = page.locator('button', { hasText: /תקלה חדשה/i })
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
