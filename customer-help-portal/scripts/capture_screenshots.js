/**
 * Enterprise Screenshot Capture Service
 * Automates UI capture, data obfuscation, and annotation.
 */
const { chromium } = require('playwright');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const TARGET_URL = 'http://localhost:4200';
const OUTPUT_DIR = path.join(__dirname, '../src/assets/guides');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function captureScreen(pageId, route, selector = 'body') {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  // 1. Navigate to the app with docs_mode enabled for obfuscation logic
  await page.goto(`${TARGET_URL}${route}?docs_mode=true`);
  
  // Wait for content to load
  await page.waitForLoadState('networkidle');

  const outputPath = path.join(OUTPUT_DIR, `${pageId}.png`);
  
  // 2. Capture the element or full page
  const element = await page.$(selector);
  await element.screenshot({ path: outputPath });

  console.log(`Captured: ${outputPath}`);

  // 3. Optional: Add enterprise annotations (Red boxes/Arrows) using Sharp
  // This is a placeholder for the automated annotation logic
  
  await browser.close();
}

// Example usage:
// captureScreen('dashboard-overview', '/dashboard');
