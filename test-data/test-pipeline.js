/**
 * End-to-end pipeline test
 */
const path = require('path');
const fs = require('fs');
const { parseDocx } = require('../server/parsers/docx-parser');
const { composeIssue } = require('../server/layout/compose-issue');
const { renderToPdf } = require('../server/pdf/render-with-pagedjs');
const { runQualityChecks } = require('../server/pdf/quality-check');

async function test() {
    console.log('=== End-to-End Pipeline Test ===\n');

    // 1. Parse .docx
    console.log('1. Parsing .docx...');
    const article = await parseDocx(
        path.join(__dirname, 'sample-article.docx'),
        path.join(__dirname, '../output/test-parse')
    );
    article.template = 'feature-opening';
    console.log(`   Title: ${article.title}`);
    console.log(`   Author: ${article.author}`);
    console.log(`   Words: ${article.wordCount}`);

    // 2. Quality check
    console.log('\n2. Quality check...');
    const issue = {
        id: '2026-01',
        title: 'தமிழ் இதழ் — முதல் இதழ்',
        date: 'April 2026',
        tagline: 'பண்பாடு · இலக்கியம் · தொழில்நுட்பம்',
        articles: [article],
    };
    const report = runQualityChecks(issue, issue.articles);
    console.log(`   Passed: ${report.passed}`);
    console.log(`   Estimated pages: ${report.estimatedPages}`);
    for (const c of report.checks) {
        console.log(`   ${c.passed ? '✓' : '✗'} ${c.name}: ${c.message}`);
    }

    // 3. Compose full magazine HTML
    console.log('\n3. Composing magazine HTML...');
    const html = composeIssue(issue, issue.articles);
    const tempHtml = path.join(__dirname, '../output/test-magazine.html');
    fs.writeFileSync(tempHtml, html);
    console.log(`   HTML size: ${(html.length / 1024).toFixed(0)} KB`);

    // 4. Render to PDF
    console.log('\n4. Rendering PDF...');
    const startTime = Date.now();
    const outputPdf = path.join(__dirname, '../output/test-magazine.pdf');
    await renderToPdf(tempHtml, outputPdf);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const fileSize = (fs.statSync(outputPdf).size / 1024).toFixed(0);
    console.log(`   Done in ${elapsed}s — ${fileSize} KB`);

    // Clean up temp
    fs.unlinkSync(tempHtml);

    console.log(`\n=== SUCCESS ===`);
    console.log(`Open: open "${outputPdf}"`);
}

test().catch(err => {
    console.error('\nFAILED:', err);
    process.exit(1);
});
