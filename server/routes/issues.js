/**
 * Issue routes — create issues, add articles, assemble full magazine PDF
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { composeIssue } = require('../layout/compose-issue');
const { renderToPdf } = require('../pdf/render-with-pagedjs');
const { runQualityChecks } = require('../pdf/quality-check');

const router = express.Router();
const ISSUES_DIR = path.join(__dirname, '../../issues');
const OUTPUT_DIR = path.join(__dirname, '../../output');

// In-memory issue store (persisted to JSON)
let currentIssue = null;

function loadIssue() {
    const p = path.join(ISSUES_DIR, 'current-issue.json');
    if (fs.existsSync(p)) {
        currentIssue = JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
    return currentIssue;
}

function saveIssue() {
    if (!fs.existsSync(ISSUES_DIR)) fs.mkdirSync(ISSUES_DIR, { recursive: true });
    fs.writeFileSync(path.join(ISSUES_DIR, 'current-issue.json'), JSON.stringify(currentIssue, null, 2));
}

// Load on startup
loadIssue();

/**
 * POST /api/issues/create — Create a new issue
 */
router.post('/create', (req, res) => {
    const { id, title, date, tagline } = req.body;
    currentIssue = {
        id: id || `issue-${Date.now()}`,
        title: title || 'தமிழ் இதழ்',
        date: date || new Date().toLocaleDateString('ta-IN'),
        tagline: tagline || '',
        articles: [],
        createdAt: new Date().toISOString(),
    };
    saveIssue();
    res.json({ success: true, issue: currentIssue });
});

/**
 * GET /api/issues/current — Get current issue
 */
router.get('/current', (req, res) => {
    loadIssue();
    res.json({ issue: currentIssue });
});

/**
 * POST /api/issues/add-article — Add a parsed article to current issue
 */
router.post('/add-article', (req, res) => {
    if (!currentIssue) {
        return res.status(400).json({ error: 'No issue created yet' });
    }
    const { article, template } = req.body;
    if (!article) {
        return res.status(400).json({ error: 'No article data' });
    }
    article.template = template || article.suggestedTemplate || 'feature-opening';
    article.order = currentIssue.articles.length;
    currentIssue.articles.push(article);
    saveIssue();
    res.json({ success: true, articleCount: currentIssue.articles.length });
});

/**
 * POST /api/issues/reorder — Reorder articles
 */
router.post('/reorder', (req, res) => {
    if (!currentIssue) return res.status(400).json({ error: 'No issue' });
    const { order } = req.body; // array of indices
    if (!Array.isArray(order)) return res.status(400).json({ error: 'Invalid order' });
    const reordered = order.map(i => currentIssue.articles[i]).filter(Boolean);
    currentIssue.articles = reordered;
    saveIssue();
    res.json({ success: true });
});

/**
 * DELETE /api/issues/remove-article/:index — Remove an article
 */
router.delete('/remove-article/:index', (req, res) => {
    if (!currentIssue) return res.status(400).json({ error: 'No issue' });
    const idx = parseInt(req.params.index, 10);
    if (idx >= 0 && idx < currentIssue.articles.length) {
        currentIssue.articles.splice(idx, 1);
        saveIssue();
        res.json({ success: true });
    } else {
        res.status(400).json({ error: 'Invalid index' });
    }
});

/**
 * GET /api/issues/quality-check — Run quality checks on current issue
 */
router.get('/quality-check', (req, res) => {
    if (!currentIssue || currentIssue.articles.length === 0) {
        return res.status(400).json({ error: 'No articles in issue' });
    }
    const report = runQualityChecks(currentIssue, currentIssue.articles);
    res.json(report);
});

/**
 * POST /api/issues/generate — Generate the full magazine PDF
 */
router.post('/generate', async (req, res) => {
    if (!currentIssue || currentIssue.articles.length === 0) {
        return res.status(400).json({ error: 'No articles in issue' });
    }

    try {
        // Compose full magazine HTML
        const html = composeIssue(currentIssue, currentIssue.articles);

        // Write temp HTML
        if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        const tempDir = path.join(OUTPUT_DIR, 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const tempHtml = path.join(tempDir, `magazine-${Date.now()}.html`);
        fs.writeFileSync(tempHtml, html);

        const pdfName = `magazine-${currentIssue.id}-${Date.now()}.pdf`;
        const outputPdf = path.join(OUTPUT_DIR, pdfName);

        // Render to PDF
        await renderToPdf(tempHtml, outputPdf);

        // Clean up temp
        fs.unlinkSync(tempHtml);

        const fileSize = (fs.statSync(outputPdf).size / 1024).toFixed(0);

        res.json({
            success: true,
            pdfUrl: `/output/${pdfName}`,
            fileSize: fileSize + ' KB',
            pageCount: currentIssue.articles.length + 3, // cover + toc + articles + back cover
        });
    } catch (err) {
        console.error('Magazine generation error:', err);
        res.status(500).json({ error: 'Failed to generate magazine: ' + err.message });
    }
});

module.exports = router;
