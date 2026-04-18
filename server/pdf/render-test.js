/**
 * Test script — renders the feature-opening template to PDF
 * Run: npm run render-test
 */
const path = require('path');
const fs = require('fs');
const { renderToPdf } = require('./render-with-pagedjs');

async function main() {
    const templatePath = path.resolve(__dirname, '../../templates/feature-opening.html');
    const outputDir = path.resolve(__dirname, '../../output');
    const outputPath = path.join(outputDir, 'test-feature.pdf');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log('=== Tamil Magazine PDF Generator — Test Render ===');
    console.log(`Template: ${templatePath}`);
    console.log(`Output:   ${outputPath}`);
    console.log('');

    const startTime = Date.now();

    try {
        await renderToPdf(templatePath, outputPath);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const fileSize = (fs.statSync(outputPath).size / 1024).toFixed(0);
        console.log('');
        console.log(`Done in ${elapsed}s — ${fileSize} KB`);
        console.log(`Open the PDF: open "${outputPath}"`);
    } catch (err) {
        console.error('Render failed:', err);
        process.exit(1);
    }
}

main();
