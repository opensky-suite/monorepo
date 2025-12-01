/**
 * Screenshot Verification Tool
 * Reads and verifies screenshots are valid and meet requirements
 * 
 * This tool can:
 * 1. Read screenshot images (PNG format)
 * 2. Verify file size and dimensions
 * 3. Compare with baseline
 * 4. Generate human-readable reports
 * 5. Upload to artifacts for LLM review
 */

import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

interface ScreenshotInfo {
  path: string;
  exists: boolean;
  size: number;
  width?: number;
  height?: number;
  valid: boolean;
  errors: string[];
}

interface VerificationResult {
  total: number;
  valid: number;
  invalid: number;
  missing: number;
  screenshots: ScreenshotInfo[];
  summary: string;
}

const SCREENSHOT_DIRS = {
  baseline: 'tests/screenshots/baseline',
  current: 'tests/screenshots/current',
  diff: 'tests/screenshots/diff',
};

const REQUIREMENTS = {
  maxSize: 5 * 1024 * 1024, // 5MB
  minWidth: 100,
  minHeight: 100,
  maxWidth: 4096,
  maxHeight: 4096,
};

/**
 * Read PNG file and extract metadata
 */
async function readScreenshot(filePath: string): Promise<ScreenshotInfo> {
  const info: ScreenshotInfo = {
    path: filePath,
    exists: false,
    size: 0,
    valid: false,
    errors: [],
  };

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      info.errors.push('File does not exist');
      return info;
    }

    info.exists = true;
    const stats = fs.statSync(filePath);
    info.size = stats.size;

    // Check file size
    if (info.size > REQUIREMENTS.maxSize) {
      info.errors.push(
        `File too large: ${(info.size / 1024 / 1024).toFixed(2)}MB (max ${REQUIREMENTS.maxSize / 1024 / 1024}MB)`
      );
    }

    if (info.size === 0) {
      info.errors.push('File is empty');
      return info;
    }

    // Read PNG and extract dimensions
    const buffer = fs.readFileSync(filePath);
    const png = PNG.sync.read(buffer);

    info.width = png.width;
    info.height = png.height;

    // Validate dimensions
    if (png.width < REQUIREMENTS.minWidth || png.height < REQUIREMENTS.minHeight) {
      info.errors.push(
        `Dimensions too small: ${png.width}x${png.height} (min ${REQUIREMENTS.minWidth}x${REQUIREMENTS.minHeight})`
      );
    }

    if (png.width > REQUIREMENTS.maxWidth || png.height > REQUIREMENTS.maxHeight) {
      info.errors.push(
        `Dimensions too large: ${png.width}x${png.height} (max ${REQUIREMENTS.maxWidth}x${REQUIREMENTS.maxHeight})`
      );
    }

    // Check if image is blank (all pixels same color)
    const isBlank = checkIfBlank(png);
    if (isBlank) {
      info.errors.push('Screenshot appears to be blank/solid color');
    }

    info.valid = info.errors.length === 0;
  } catch (error) {
    info.errors.push(`Failed to read PNG: ${error.message}`);
  }

  return info;
}

/**
 * Check if PNG is blank (all pixels same color)
 */
function checkIfBlank(png: PNG): boolean {
  if (!png.data || png.data.length < 4) return true;

  const firstR = png.data[0];
  const firstG = png.data[1];
  const firstB = png.data[2];

  // Sample 100 random pixels
  const samples = Math.min(100, Math.floor(png.data.length / 4));
  let sameColorCount = 0;

  for (let i = 0; i < samples; i++) {
    const offset = Math.floor(Math.random() * (png.data.length / 4)) * 4;
    const r = png.data[offset];
    const g = png.data[offset + 1];
    const b = png.data[offset + 2];

    if (r === firstR && g === firstG && b === firstB) {
      sameColorCount++;
    }
  }

  // If 95%+ pixels are same color, consider it blank
  return sameColorCount / samples > 0.95;
}

/**
 * Find all screenshot files in a directory
 */
function findScreenshots(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files: string[] = [];

  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.png')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Verify all screenshots in a directory
 */
async function verifyScreenshots(dir: string): Promise<VerificationResult> {
  const screenshots = findScreenshots(dir);
  const results: ScreenshotInfo[] = [];

  for (const screenshot of screenshots) {
    const info = await readScreenshot(screenshot);
    results.push(info);
  }

  const valid = results.filter((r) => r.valid).length;
  const invalid = results.filter((r) => r.exists && !r.valid).length;
  const missing = results.filter((r) => !r.exists).length;

  const summary = generateSummary(results);

  return {
    total: results.length,
    valid,
    invalid,
    missing,
    screenshots: results,
    summary,
  };
}

/**
 * Generate human-readable summary
 */
function generateSummary(screenshots: ScreenshotInfo[]): string {
  const lines: string[] = [];

  lines.push('📸 Screenshot Verification Report');
  lines.push('='.repeat(50));
  lines.push('');

  const valid = screenshots.filter((s) => s.valid);
  const invalid = screenshots.filter((s) => s.exists && !s.valid);
  const missing = screenshots.filter((s) => !s.exists);

  lines.push(`Total Screenshots: ${screenshots.length}`);
  lines.push(`✅ Valid: ${valid.length}`);
  lines.push(`❌ Invalid: ${invalid.length}`);
  lines.push(`🔍 Missing: ${missing.length}`);
  lines.push('');

  if (invalid.length > 0) {
    lines.push('Invalid Screenshots:');
    lines.push('-'.repeat(50));
    for (const screenshot of invalid) {
      lines.push(`\n📷 ${path.basename(screenshot.path)}`);
      lines.push(`   Size: ${(screenshot.size / 1024).toFixed(2)}KB`);
      if (screenshot.width && screenshot.height) {
        lines.push(`   Dimensions: ${screenshot.width}x${screenshot.height}`);
      }
      lines.push(`   Errors:`);
      for (const error of screenshot.errors) {
        lines.push(`     - ${error}`);
      }
    }
    lines.push('');
  }

  if (missing.length > 0) {
    lines.push('Missing Screenshots:');
    lines.push('-'.repeat(50));
    for (const screenshot of missing) {
      lines.push(`  - ${path.basename(screenshot.path)}`);
    }
    lines.push('');
  }

  if (valid.length > 0) {
    lines.push('Valid Screenshots:');
    lines.push('-'.repeat(50));
    for (const screenshot of valid) {
      lines.push(
        `  ✅ ${path.basename(screenshot.path)} (${screenshot.width}x${screenshot.height}, ${(screenshot.size / 1024).toFixed(2)}KB)`
      );
    }
    lines.push('');
  }

  lines.push('='.repeat(50));
  lines.push(
    `\n${invalid.length === 0 && missing.length === 0 ? '✅ All screenshots valid!' : '❌ Some screenshots have issues'}`
  );

  return lines.join('\n');
}

/**
 * Compare current screenshots with baseline
 */
async function compareWithBaseline(): Promise<{
  added: string[];
  removed: string[];
  changed: string[];
}> {
  const baselineFiles = findScreenshots(SCREENSHOT_DIRS.baseline);
  const currentFiles = findScreenshots(SCREENSHOT_DIRS.current);

  const baselineNames = new Set(baselineFiles.map((f) => path.basename(f)));
  const currentNames = new Set(currentFiles.map((f) => path.basename(f)));

  const added = Array.from(currentNames).filter((name) => !baselineNames.has(name));
  const removed = Array.from(baselineNames).filter((name) => !currentNames.has(name));

  // For changed, we'd need to do pixel comparison (handled by Playwright)
  const changed: string[] = [];

  return { added, removed, changed };
}

/**
 * Main CLI
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'verify';

  if (command === 'verify') {
    const dir = args[1] || SCREENSHOT_DIRS.baseline;
    console.log(`\n🔍 Verifying screenshots in: ${dir}\n`);

    const result = await verifyScreenshots(dir);
    console.log(result.summary);

    // Write report to file
    const reportPath = path.join(SCREENSHOT_DIRS.diff, 'verification-report.txt');
    fs.mkdirSync(SCREENSHOT_DIRS.diff, { recursive: true });
    fs.writeFileSync(reportPath, result.summary);
    console.log(`\n📄 Report saved to: ${reportPath}`);

    // Exit with error if any invalid
    if (result.invalid > 0 || result.missing > 0) {
      process.exit(1);
    }
  } else if (command === 'compare') {
    console.log(`\n🔍 Comparing screenshots...\n`);
    const comparison = await compareWithBaseline();

    console.log('📸 Screenshot Comparison:');
    console.log('='.repeat(50));
    console.log(`✨ Added: ${comparison.added.length}`);
    for (const name of comparison.added) {
      console.log(`   + ${name}`);
    }
    console.log(`🗑️  Removed: ${comparison.removed.length}`);
    for (const name of comparison.removed) {
      console.log(`   - ${name}`);
    }
    console.log('');
  } else {
    console.log('Usage:');
    console.log('  npm run screenshots:verify [dir]');
    console.log('  npm run screenshots:compare');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export { verifyScreenshots, compareWithBaseline, readScreenshot };
