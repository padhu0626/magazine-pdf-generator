/**
 * Quality Check — Validates PDF output quality
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

/**
 * Run quality checks on generated content
 * @param {object} issue - Issue data
 * @param {Array} articles - Articles array
 * @returns {object} Quality report
 */
function runQualityChecks(issue, articles) {
    const report = {
        passed: true,
        checks: [],
    };

    // Check 1: All articles have titles
    const untitled = articles.filter(a => !a.title || a.title.trim() === '');
    report.checks.push({
        name: 'Article titles',
        passed: untitled.length === 0,
        message: untitled.length === 0
            ? `All ${articles.length} articles have titles`
            : `${untitled.length} article(s) missing title`,
    });

    // Check 2: All articles have authors
    const noAuthor = articles.filter(a => !a.author || a.author.trim() === '');
    report.checks.push({
        name: 'Author attribution',
        passed: noAuthor.length === 0,
        message: noAuthor.length === 0
            ? 'All articles have authors'
            : `${noAuthor.length} article(s) missing author — will show as anonymous`,
        severity: 'warning',
    });

    // Check 3: Word count ranges
    for (const a of articles) {
        if (a.wordCount && a.wordCount < 50 && a.template !== 'poetry' && a.template !== 'cartoon') {
            report.checks.push({
                name: `Short article: "${a.title}"`,
                passed: false,
                message: `Only ${a.wordCount} words — may not fill the template properly`,
                severity: 'warning',
            });
        }
    }

    // Check 4: Template assignments
    const validTemplates = [
        'cover', 'toc', 'editors-letter', 'feature-opening', 'feature-continuation',
        'interview', 'short-story', 'poetry', 'editorial', 'photo-essay', 'cartoon', 'back-cover'
    ];
    for (const a of articles) {
        if (!validTemplates.includes(a.template)) {
            report.checks.push({
                name: `Invalid template: "${a.template}"`,
                passed: false,
                message: `Article "${a.title}" has unknown template "${a.template}" — will fall back to feature-opening`,
                severity: 'warning',
            });
        }
    }

    // Check 5: Issue metadata
    if (!issue.title) {
        report.checks.push({ name: 'Issue title', passed: false, message: 'Missing issue title' });
    }

    // Overall pass
    report.passed = report.checks.every(c => c.passed || c.severity === 'warning');
    report.articleCount = articles.length;
    report.totalWords = articles.reduce((sum, a) => sum + (a.wordCount || 0), 0);
    report.estimatedPages = articles.length + 3 + Math.ceil(report.totalWords / 500);

    return report;
}

/**
 * Check image quality
 * @param {string} imagePath - Path to image
 * @returns {Promise<object>} Image quality info
 */
async function checkImageQuality(imagePath) {
    try {
        const metadata = await sharp(imagePath).metadata();
        const minDpi = 150; // minimum for digital; 300 for print
        const widthInches = metadata.width / 72;
        const effectiveDpi = metadata.width / widthInches;

        return {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
            size: fs.statSync(imagePath).size,
            dpiWarning: metadata.width < 800,
            message: metadata.width < 800
                ? `Low resolution (${metadata.width}px wide) — may look blurry in print`
                : `Good resolution (${metadata.width}px wide)`,
        };
    } catch (err) {
        return { error: err.message };
    }
}

module.exports = { runQualityChecks, checkImageQuality };
