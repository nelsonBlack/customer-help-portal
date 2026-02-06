const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ─── Configuration ────────────────────────────────────────────────────────────
const TARGET_URL = 'http://localhost:4200';
const OUTPUT_DIR = path.join(__dirname, '../src/assets/guides');
const VIEWPORT = { width: 1440, height: 900 };
const CREDENTIALS = {
  email: 'nelsonbwogora23136@gmail.com',
  password: '123456'
};

// ─── PII Masking Data ─────────────────────────────────────────────────────────
const KENYAN_NAMES = [
  { first: 'Wanjiku', last: 'Kamau' },
  { first: 'Otieno', last: 'Odhiambo' },
  { first: 'Amina', last: 'Hassan' },
  { first: 'Kipchoge', last: 'Ruto' },
  { first: 'Njeri', last: 'Mwangi' },
  { first: 'Barasa', last: 'Wekesa' },
  { first: 'Fatuma', last: 'Ali' },
  { first: 'Kibet', last: 'Kosgei' },
  { first: 'Achieng', last: 'Onyango' },
  { first: 'Mutua', last: 'Musyoka' },
  { first: 'Nyambura', last: 'Kariuki' },
  { first: 'Juma', last: 'Bakari' },
  { first: 'Chebet', last: 'Langat' },
  { first: 'Muthoni', last: 'Ndung\'u' },
  { first: 'Ouma', last: 'Akinyi' }
];

const EMAILS = [
  'wanjiku.k@example.com', 'otieno.o@example.com', 'amina.h@example.com',
  'kipchoge.r@example.com', 'njeri.m@example.com', 'barasa.w@example.com',
  'fatuma.a@example.com', 'kibet.k@example.com', 'achieng.o@example.com',
  'mutua.m@example.com', 'nyambura.k@example.com', 'juma.b@example.com',
  'chebet.l@example.com', 'muthoni.n@example.com', 'ouma.a@example.com'
];

const PHONES = [
  '+254 712 345 678', '+254 723 456 789', '+254 734 567 890',
  '+254 745 678 901', '+254 756 789 012', '+254 767 890 123',
  '+254 778 901 234', '+254 789 012 345', '+254 790 123 456',
  '+254 701 234 567', '+254 712 098 765', '+254 723 987 654',
  '+254 734 876 543', '+254 745 765 432', '+254 756 654 321'
];

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ─── Core Functions ───────────────────────────────────────────────────────────

async function login(page) {
  console.log('🔐 Logging in...');
  await page.goto(`${TARGET_URL}/sessions/signin4`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.fill('input[formcontrolname="email"]', CREDENTIALS.email);
  await page.fill('input[formcontrolname="password"]', CREDENTIALS.password);
  await page.click('button[type="submit"]');
  // Wait for redirect after login
  await page.waitForURL('**/dashboard/**', { timeout: 15000 });
  console.log('✅ Logged in successfully.');
}

/**
 * DOM-level PII masking (Layer 2).
 * Varies names per table row using a pool of Kenyan names.
 * Also masks the logged-in user display in the header/sidebar.
 */
async function maskPII(page) {
  await page.evaluate(({ names, emails, phones }) => {
    // Helper: walk text nodes and replace
    function replaceTextInElement(el, search, replacement) {
      if (!el) return;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while ((node = walker.nextNode())) {
        if (node.textContent.includes(search)) {
          node.textContent = node.textContent.replace(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
        }
      }
    }

    // 1. Vary names in table rows
    const rows = document.querySelectorAll('mat-row, tr[mat-row], .mat-mdc-row');
    rows.forEach((row, idx) => {
      const nameData = names[idx % names.length];
      const fullName = `${nameData.first} ${nameData.last}`;
      const email = emails[idx % emails.length];
      const phone = phones[idx % phones.length];

      // Replace "John Doe" / "Standard Customer" variations
      replaceTextInElement(row, 'John Doe', fullName);
      replaceTextInElement(row, 'Standard Customer', fullName);
      replaceTextInElement(row, 'customer@example.com', email);
      replaceTextInElement(row, '+254 722 000 000', phone);
    });

    // 2. Vary names in card/detail views
    const body = document.body;
    const detailContainers = document.querySelectorAll(
      'app-detail-page-layout, .detail-container, mat-card, .customer-detail, .mat-mdc-card'
    );
    if (detailContainers.length > 0) {
      detailContainers.forEach((container, idx) => {
        const nameData = names[idx % names.length];
        const fullName = `${nameData.first} ${nameData.last}`;
        replaceTextInElement(container, 'John Doe', fullName);
        replaceTextInElement(container, 'Standard Customer', fullName);
        replaceTextInElement(container, 'customer@example.com', emails[idx % emails.length]);
        replaceTextInElement(container, '+254 722 000 000', phones[idx % phones.length]);
      });
    }

    // 3. Mask logged-in user display in header/toolbar
    const toolbarTexts = document.querySelectorAll('mat-toolbar, .mat-toolbar, header, nav');
    toolbarTexts.forEach(el => {
      replaceTextInElement(el, 'nelsonbwogora23136@gmail.com', 'admin@easybiller.com');
      replaceTextInElement(el, 'Nelson', 'Admin');
      replaceTextInElement(el, 'nelson', 'admin');
    });

    // 4. Also check sidenav user profile area
    const sidenavAreas = document.querySelectorAll('.sidenav, mat-sidenav, .user-profile, .user-info');
    sidenavAreas.forEach(el => {
      replaceTextInElement(el, 'nelsonbwogora23136@gmail.com', 'admin@easybiller.com');
      replaceTextInElement(el, 'Nelson', 'Admin');
    });

  }, { names: KENYAN_NAMES, emails: EMAILS, phones: PHONES });
}

/**
 * Navigate to a route with docs_mode=true, wait for content, mask PII, and capture.
 *
 * Options:
 *   selector  - CSS selector to screenshot (default: full page)
 *   waitFor   - additional selector to wait for before capture
 *   clickTab  - selector of a tab to click before capture
 *   clickBtn  - selector of a button/element to click before capture
 *   scrollTo  - selector to scroll into view before capture
 *   delay     - extra ms to wait after navigation (default: 1500)
 *   fullPage  - capture full scrollable page (default: false)
 *   crop      - { selector } to crop screenshot to specific element
 */
async function captureScreen(page, name, route, options = {}) {
  const {
    selector = null,
    waitFor = null,
    clickTab = null,
    clickBtn = null,
    scrollTo = null,
    delay = 1500,
    fullPage = false,
    crop = null
  } = options;

  console.log(`📸 Capturing: ${name}`);

  // Navigate with docs_mode
  const separator = route.includes('?') ? '&' : '?';
  const url = `${TARGET_URL}${route}${separator}docs_mode=true`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Wait for Angular to settle
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch (e) {
    // networkidle may not fire if there are long-polling connections; that's OK
  }
  await page.waitForTimeout(delay);

  // Wait for specific element if requested
  if (waitFor) {
    try {
      await page.waitForSelector(waitFor, { timeout: 10000 });
    } catch (e) {
      console.warn(`  ⚠️ waitFor selector "${waitFor}" not found, continuing...`);
    }
  }

  // Click a tab if requested
  if (clickTab) {
    try {
      await page.click(clickTab);
      await page.waitForTimeout(1000);
      try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch(e) {}
      await page.waitForTimeout(500);
    } catch (e) {
      console.warn(`  ⚠️ Tab click "${clickTab}" failed: ${e.message}`);
    }
  }

  // Click a button if requested
  if (clickBtn) {
    try {
      await page.click(clickBtn);
      await page.waitForTimeout(1000);
    } catch (e) {
      console.warn(`  ⚠️ Button click "${clickBtn}" failed: ${e.message}`);
    }
  }

  // Scroll to element if requested
  if (scrollTo) {
    try {
      await page.locator(scrollTo).scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    } catch (e) {
      console.warn(`  ⚠️ scrollTo "${scrollTo}" failed: ${e.message}`);
    }
  }

  // Apply PII masking
  await maskPII(page);
  await page.waitForTimeout(300);

  const outputPath = path.join(OUTPUT_DIR, `${name}.png`);

  // Capture
  if (crop) {
    const element = await page.$(crop);
    if (element) {
      await element.screenshot({ path: outputPath });
    } else {
      console.warn(`  ⚠️ Crop element "${crop}" not found, taking full page`);
      await page.screenshot({ path: outputPath, fullPage });
    }
  } else if (selector) {
    const element = await page.$(selector);
    if (element) {
      await element.screenshot({ path: outputPath });
    } else {
      console.warn(`  ⚠️ Selector "${selector}" not found, taking full page`);
      await page.screenshot({ path: outputPath, fullPage });
    }
  } else {
    await page.screenshot({ path: outputPath, fullPage });
  }

  console.log(`  ✅ Saved: ${name}.png`);
}

/**
 * Switch to a specific company via the company switcher in the toolbar.
 */
async function switchCompany(page, companyName) {
  console.log(`🔄 Switching to company: ${companyName}`);

  // Click the company switcher button (mat-icon-button with matMenuTriggerFor)
  try {
    await page.click('app-company-switcher button[mat-icon-button], app-company-switcher button');
    await page.waitForTimeout(800);

    // Search for the company using the search input in the mat-menu
    const searchInput = await page.$('.company-switcher-menu input, .mat-mdc-menu-panel input');
    if (searchInput) {
      await searchInput.fill(companyName);
      await page.waitForTimeout(800);
    }

    // Click the matching company button in the menu
    await page.click(`.mat-mdc-menu-panel button:has-text("${companyName}")`);
    await page.waitForTimeout(3000);
    try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch(e) {}
    console.log(`  ✅ Switched to: ${companyName}`);
  } catch (e) {
    console.warn(`  ⚠️ Company switch failed: ${e.message}`);
    console.warn('  Trying alternative approach...');

    // Alternative: look for any dropdown/select that shows companies
    try {
      const altSelectors = [
        'button:has-text("company")',
        '.mat-mdc-select-trigger',
        '[class*="company"] button'
      ];
      for (const sel of altSelectors) {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          await page.waitForTimeout(500);
          break;
        }
      }
      await page.click(`text=${companyName}`);
      await page.waitForTimeout(2000);
      console.log(`  ✅ Switched via alt method: ${companyName}`);
    } catch (e2) {
      console.error(`  ❌ Could not switch company: ${e2.message}`);
    }
  }
}

// ─── Batch Definitions ────────────────────────────────────────────────────────

const batches = {

  // Batch 1: Auth & Dashboard
  'batch1': async (page) => {
    // Auth pages (before login)
    await captureScreen(page, 'auth-login-page', '/sessions/signin4');
    await captureScreen(page, 'auth-registration-form', '/sessions/company-registration');
    await captureScreen(page, 'auth-forgot-password', '/sessions/forgot-password');

    // Login for protected routes
    await login(page);

    // Dashboard
    await captureScreen(page, 'dashboard-overview', '/dashboard/default', {
      waitFor: 'mat-card'
    });

    // Sidebar crop
    await captureScreen(page, 'dashboard-sidebar-nav', '/dashboard/default', {
      crop: 'mat-sidenav, .sidenav, app-sidebar, [class*="sidenav"]',
      delay: 1000
    });

    // Company switcher (click to open it)
    await captureScreen(page, 'dashboard-company-switcher', '/dashboard/default', {
      clickBtn: 'app-company-switcher button[mat-icon-button], app-company-switcher button',
      delay: 1500
    });
  },

  // Batch 2: Customers & Meters
  'batch2': async (page) => {
    await login(page);

    await captureScreen(page, 'customers-list', '/customer/list', {
      waitFor: 'mat-table, table'
    });
    await captureScreen(page, 'customer-add-form', '/customer/add', {
      waitFor: 'form'
    });

    // Customer detail - navigate to list first and click first customer
    await page.goto(`${TARGET_URL}/customer/list?docs_mode=true`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // Click first customer row to get to a detail page
    const firstRow = await page.$('mat-row:first-child, tr[mat-row]:first-child, .mat-mdc-row:first-child');
    if (firstRow) {
      await firstRow.click();
      try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch(e) {}
      await page.waitForTimeout(1500);

      // Get the detail page URL for subsequent captures
      const detailUrl = new URL(page.url());
      const detailPath = detailUrl.pathname;

      await maskPII(page);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'customer-detail-overview.png') });
      console.log('  ✅ Saved: customer-detail-overview.png');

      // Customer detail tabs
      const tabs = [
        { name: 'customer-detail-water-statement', label: 'Water Statement' },
        { name: 'customer-detail-water-bills', label: 'Water Bill' },
        { name: 'customer-detail-meter-readings', label: 'Meter Reading' },
        { name: 'customer-detail-accounts', label: 'Account' },
        { name: 'customer-detail-water-charges', label: 'Water Charge' }
      ];

      for (const tab of tabs) {
        try {
          // Try clicking the tab by label text
          const tabEl = await page.$(`[role="tab"]:has-text("${tab.label}"), .mat-mdc-tab:has-text("${tab.label}"), .mat-tab-label:has-text("${tab.label}")`);
          if (tabEl) {
            await tabEl.click();
            await page.waitForTimeout(1500);
            try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch(e) {}
            await maskPII(page);
            await page.screenshot({ path: path.join(OUTPUT_DIR, `${tab.name}.png`) });
            console.log(`  ✅ Saved: ${tab.name}.png`);
          } else {
            console.warn(`  ⚠️ Tab "${tab.label}" not found`);
          }
        } catch (e) {
          console.warn(`  ⚠️ Tab "${tab.label}" failed: ${e.message}`);
        }
      }
    } else {
      console.warn('  ⚠️ No customer rows found for detail capture');
    }

    // Water meters
    await captureScreen(page, 'water-meters-list', '/analog-meter/list', {
      waitFor: 'mat-table, table'
    });
    await captureScreen(page, 'water-meter-add-form', '/analog-meter/add', {
      waitFor: 'form'
    });
  },

  // Batch 3: Meter Readings
  'batch3': async (page) => {
    await login(page);

    await captureScreen(page, 'meter-readings-list', '/meter-readings/list', {
      waitFor: 'mat-table, table'
    });
    await captureScreen(page, 'meter-reading-add-form', '/meter-readings/add', {
      waitFor: 'form'
    });

    // Detail - click first row
    await page.goto(`${TARGET_URL}/meter-readings/list?docs_mode=true`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const firstRow = await page.$('mat-row:first-child, tr[mat-row]:first-child, .mat-mdc-row:first-child');
    if (firstRow) {
      await firstRow.click();
      try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch(e) {}
      await page.waitForTimeout(1500);
      await maskPII(page);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'meter-reading-detail.png') });
      console.log('  ✅ Saved: meter-reading-detail.png');
    }

    // Filtered view - apply a filter on the list
    await captureScreen(page, 'meter-readings-filtered', '/meter-readings/list', {
      waitFor: 'mat-table, table',
      delay: 2000
    });
  },

  // Batch 4: Water Bills
  'batch4': async (page) => {
    await login(page);

    await captureScreen(page, 'water-bills-list', '/water-bills/list', {
      waitFor: 'mat-table, table'
    });
    await captureScreen(page, 'water-bill-add-form', '/water-bills/add', {
      waitFor: 'form'
    });

    // Bill detail - click first row
    await page.goto(`${TARGET_URL}/water-bills/list?docs_mode=true`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const firstRow = await page.$('mat-row:first-child, tr[mat-row]:first-child, .mat-mdc-row:first-child');
    if (firstRow) {
      await firstRow.click();
      try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch(e) {}
      await page.waitForTimeout(1500);
      await maskPII(page);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'water-bill-detail.png') });
      console.log('  ✅ Saved: water-bill-detail.png');

      // Scroll to tier breakdown section
      try {
        const tierSection = await page.$('[class*="tier"], [class*="breakdown"], .tier-breakdown, mat-expansion-panel');
        if (tierSection) {
          await tierSection.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(OUTPUT_DIR, 'water-bill-tier-breakdown.png') });
          console.log('  ✅ Saved: water-bill-tier-breakdown.png');
        } else {
          // Just capture the full page as tier breakdown
          await page.screenshot({ path: path.join(OUTPUT_DIR, 'water-bill-tier-breakdown.png'), fullPage: true });
          console.log('  ✅ Saved: water-bill-tier-breakdown.png (full page)');
        }
      } catch (e) {
        console.warn(`  ⚠️ Tier breakdown section not found: ${e.message}`);
      }
    }

    // Status filter - try to click a filter dropdown
    await captureScreen(page, 'water-bills-status-filter', '/water-bills/list', {
      waitFor: 'mat-table, table',
      delay: 2000
    });
  },

  // Batch 5: Payments
  'batch5': async (page) => {
    await login(page);

    await captureScreen(page, 'payments-list', '/debit-credits/list', {
      waitFor: 'mat-table, table'
    });

    // Failed payments tab
    await captureScreen(page, 'payments-failed-tab', '/debit-credits/list', {
      clickTab: '[role="tab"]:has-text("Failed"), .mat-mdc-tab:has-text("Failed")',
      waitFor: 'mat-table, table'
    });

    // Payment detail - click first row
    await page.goto(`${TARGET_URL}/debit-credits/list?docs_mode=true`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const firstRow = await page.$('mat-row:first-child, tr[mat-row]:first-child, .mat-mdc-row:first-child');
    if (firstRow) {
      await firstRow.click();
      await page.waitForTimeout(1500);
      await maskPII(page);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'payment-detail.png') });
      console.log('  ✅ Saved: payment-detail.png');
    }

    // Rent payments tab
    await captureScreen(page, 'payments-rent-tab', '/debit-credits/list', {
      clickTab: '[role="tab"]:has-text("Rent"), .mat-mdc-tab:has-text("Rent")',
      waitFor: 'mat-table, table'
    });
  },

  // Batch 6: Company Setup & Tariffs
  'batch6': async (page) => {
    await login(page);

    await captureScreen(page, 'tariffs-list', '/tariff/list', {
      waitFor: 'mat-table, table'
    });
    await captureScreen(page, 'tariff-add-form', '/tariff/add', {
      waitFor: 'form'
    });

    // Tariff detail
    await page.goto(`${TARGET_URL}/tariff/list?docs_mode=true`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const tariffRow = await page.$('mat-row:first-child, tr[mat-row]:first-child, .mat-mdc-row:first-child');
    if (tariffRow) {
      await tariffRow.click();
      try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch(e) {}
      await page.waitForTimeout(1500);
      await maskPII(page);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'tariff-detail.png') });
      console.log('  ✅ Saved: tariff-detail.png');
    }

    await captureScreen(page, 'regions-list', '/region/list', {
      waitFor: 'mat-table, table'
    });
    await captureScreen(page, 'region-add-form', '/region/add', {
      waitFor: 'form'
    });

    await captureScreen(page, 'service-charges-list', '/service-charge/list', {
      waitFor: 'mat-table, table'
    });
    await captureScreen(page, 'service-charge-add-form', '/service-charge/add', {
      waitFor: 'form'
    });

    // Company settings - need to find the company ID
    await page.goto(`${TARGET_URL}/company/list?docs_mode=true`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const companyRow = await page.$('mat-row:first-child, tr[mat-row]:first-child, .mat-mdc-row:first-child');
    if (companyRow) {
      await companyRow.click();
      try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch(e) {}
      await page.waitForTimeout(1500);
      await maskPII(page);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'company-settings-page.png') });
      console.log('  ✅ Saved: company-settings-page.png');
    } else {
      // Fallback: try direct company route
      await captureScreen(page, 'company-settings-page', '/company/list', {
        waitFor: 'mat-card, form'
      });
    }
  },

  // Batch 7: Staff Management
  'batch7': async (page) => {
    await login(page);

    await captureScreen(page, 'staff-list', '/company-staff/list', {
      waitFor: 'mat-table, table'
    });
    await captureScreen(page, 'staff-invite-form', '/company-staff/add', {
      waitFor: 'form'
    });

    // Staff detail
    await page.goto(`${TARGET_URL}/company-staff/list?docs_mode=true`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const staffRow = await page.$('mat-row:first-child, tr[mat-row]:first-child, .mat-mdc-row:first-child');
    if (staffRow) {
      await staffRow.click();
      try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch(e) {}
      await page.waitForTimeout(1500);
      await maskPII(page);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'staff-detail.png') });
      console.log('  ✅ Saved: staff-detail.png');
    }

    // Role selector - go to add form and open role dropdown
    await captureScreen(page, 'staff-role-selector', '/company-staff/add', {
      waitFor: 'form',
      clickBtn: 'mat-select[formcontrolname="role"], mat-select[formcontrolname="roleId"], [formcontrolname="role"] .mat-mdc-select-trigger'
    });
  },

  // Batch 8: Complaints & Reports
  'batch8': async (page) => {
    await login(page);

    await captureScreen(page, 'complaints-list', '/complaints/list', {
      waitFor: 'mat-table, table'
    });
    await captureScreen(page, 'complaint-add-form', '/complaints/add', {
      waitFor: 'form'
    });

    await captureScreen(page, 'reports-overview', '/reports/list', {
      waitFor: 'mat-card, .report'
    });

    // Map view tab
    await captureScreen(page, 'reports-map-view', '/reports/list', {
      clickTab: '[role="tab"]:has-text("Map"), .mat-mdc-tab:has-text("Map")',
      delay: 2000
    });
  },

  // Batch 9: Real Estate Properties & Units
  'batch9': async (page) => {
    await login(page);
    await switchCompany(page, 'Real Estate');

    await captureScreen(page, 'properties-list', '/properties', {
      waitFor: 'mat-table, table, mat-card'
    });
    await captureScreen(page, 'property-add-form', '/properties/add', {
      waitFor: 'form'
    });

    // Property detail
    await page.goto(`${TARGET_URL}/properties?docs_mode=true`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const propRow = await page.$('mat-row:first-child, tr[mat-row]:first-child, .mat-mdc-row:first-child, mat-card:first-child');
    if (propRow) {
      await propRow.click();
      try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch(e) {}
      await page.waitForTimeout(1500);
      await maskPII(page);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'property-detail.png') });
      console.log('  ✅ Saved: property-detail.png');

      // Units tab
      try {
        const unitsTab = await page.$('[role="tab"]:has-text("Unit"), .mat-mdc-tab:has-text("Unit")');
        if (unitsTab) {
          await unitsTab.click();
          await page.waitForTimeout(1500);
          await maskPII(page);
          await page.screenshot({ path: path.join(OUTPUT_DIR, 'property-units-tab.png') });
          console.log('  ✅ Saved: property-units-tab.png');
        }
      } catch (e) {
        console.warn(`  ⚠️ Units tab not found: ${e.message}`);
      }
    }

    // Unit detail
    await page.goto(`${TARGET_URL}/units?docs_mode=true`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const unitRow = await page.$('mat-row:first-child, tr[mat-row]:first-child, .mat-mdc-row:first-child');
    if (unitRow) {
      await unitRow.click();
      try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch(e) {}
      await page.waitForTimeout(1500);
      await maskPII(page);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'unit-detail.png') });
      console.log('  ✅ Saved: unit-detail.png');
    }

    await captureScreen(page, 'unit-add-form', '/units/add', {
      waitFor: 'form'
    });
  },

  // Batch 10: Real Estate Tenants & Leases
  'batch10': async (page) => {
    await login(page);
    await switchCompany(page, 'Real Estate');

    await captureScreen(page, 'tenants-list', '/tenants', {
      waitFor: 'mat-table, table, mat-card'
    });
    await captureScreen(page, 'tenant-create-form', '/tenants/create', {
      waitFor: 'form'
    });

    // Tenant move-in wizard - need a tenant ID
    await page.goto(`${TARGET_URL}/tenants?docs_mode=true`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const tenantRow = await page.$('mat-row:first-child, tr[mat-row]:first-child, .mat-mdc-row:first-child');
    if (tenantRow) {
      await tenantRow.click();
      try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch(e) {}
      await page.waitForTimeout(1500);

      // Try to find move-in button
      const moveInBtn = await page.$('button:has-text("Move In"), a:has-text("Move In"), [routerlink*="move-in"]');
      if (moveInBtn) {
        await moveInBtn.click();
        try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch(e) {}
        await page.waitForTimeout(1500);
        await maskPII(page);
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'tenant-move-in-wizard.png') });
        console.log('  ✅ Saved: tenant-move-in-wizard.png');

        // Try stepping through wizard
        const nextBtn = await page.$('button:has-text("Next"), .mat-stepper-next');
        if (nextBtn) {
          await nextBtn.click();
          await page.waitForTimeout(1500);
          await maskPII(page);
          await page.screenshot({ path: path.join(OUTPUT_DIR, 'tenant-move-in-lease.png') });
          console.log('  ✅ Saved: tenant-move-in-lease.png');

          const nextBtn2 = await page.$('button:has-text("Next"), .mat-stepper-next');
          if (nextBtn2) {
            await nextBtn2.click();
            await page.waitForTimeout(1500);
            await maskPII(page);
            await page.screenshot({ path: path.join(OUTPUT_DIR, 'tenant-move-in-charges.png') });
            console.log('  ✅ Saved: tenant-move-in-charges.png');
          }
        }
      } else {
        console.warn('  ⚠️ Move-in button not found on tenant detail');
      }

      // Tenant detail (lease view)
      await page.goto(`${TARGET_URL}/tenants?docs_mode=true`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
      const row2 = await page.$('mat-row:first-child, tr[mat-row]:first-child, .mat-mdc-row:first-child');
      if (row2) {
        await row2.click();
        try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch(e) {}
        await page.waitForTimeout(1500);
        await maskPII(page);
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'tenant-detail.png') });
        console.log('  ✅ Saved: tenant-detail.png');
      }
    }
  },

  // Batch 11: Real Estate Pricing & Transactions
  'batch11': async (page) => {
    await login(page);
    await switchCompany(page, 'Real Estate');

    await captureScreen(page, 'pricing-list', '/pricing', {
      waitFor: 'mat-table, table, mat-card'
    });
    await captureScreen(page, 'pricing-create-form', '/pricing/create', {
      waitFor: 'form'
    });

    // Pricing detail
    await page.goto(`${TARGET_URL}/pricing?docs_mode=true`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    const pricingRow = await page.$('mat-row:first-child, tr[mat-row]:first-child, .mat-mdc-row:first-child');
    if (pricingRow) {
      await pricingRow.click();
      try { await page.waitForLoadState('networkidle', { timeout: 8000 }); } catch(e) {}
      await page.waitForTimeout(1500);
      await maskPII(page);
      await page.screenshot({ path: path.join(OUTPUT_DIR, 'pricing-detail.png') });
      console.log('  ✅ Saved: pricing-detail.png');
    }

    await captureScreen(page, 'transactions-list', '/transactions', {
      waitFor: 'mat-table, table'
    });

    // Money In dialog
    await captureScreen(page, 'transactions-money-in', '/transactions', {
      clickBtn: 'button:has-text("Money In"), button:has-text("Record Payment"), button:has-text("Add Payment")',
      delay: 1500
    });
  }
};

// ─── Runner ───────────────────────────────────────────────────────────────────

async function run() {
  const args = process.argv.slice(2);
  const batchName = args[0];
  const runAll = args.includes('--all');

  if (!batchName && !runAll) {
    console.log('Usage:');
    console.log('  node capture_screenshots.cjs <batch>   Run a specific batch');
    console.log('  node capture_screenshots.cjs --all     Run all batches');
    console.log('');
    console.log('Available batches:');
    Object.keys(batches).forEach(name => console.log(`  ${name}`));
    process.exit(0);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  // Increase default timeout
  page.setDefaultTimeout(15000);

  try {
    if (runAll) {
      console.log('🚀 Running ALL batches...\n');
      for (const [name, batchFn] of Object.entries(batches)) {
        console.log(`\n━━━ Batch: ${name} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        // Create fresh context for each batch to avoid state leaks
        const batchContext = await browser.newContext({ viewport: VIEWPORT });
        const batchPage = await batchContext.newPage();
        batchPage.setDefaultTimeout(15000);
        try {
          await batchFn(batchPage);
        } catch (e) {
          console.error(`❌ Batch ${name} failed: ${e.message}`);
        } finally {
          await batchContext.close();
        }
      }
    } else if (batches[batchName]) {
      console.log(`🚀 Running batch: ${batchName}\n`);
      await batches[batchName](page);
    } else {
      console.error(`❌ Unknown batch: ${batchName}`);
      console.log('Available:', Object.keys(batches).join(', '));
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await browser.close();
  }

  console.log('\n🏁 Done!');
}

run();
