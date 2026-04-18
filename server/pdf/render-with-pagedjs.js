/**
 * PDF Renderer — Uses Puppeteer + Paged.js to render HTML templates to print-quality PDFs
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PAGEDJS_PATH = path.resolve(__dirname, '../../templates/paged.polyfill.js');
const PROJECT_ROOT = path.resolve(__dirname, '../..');

/**
 * Start a temporary static file server for Paged.js to fetch CSS
 */
function startStaticServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            const filePath = path.join(PROJECT_ROOT, decodeURIComponent(req.url));
            const ext = path.extname(filePath);
            const mimeTypes = {
                '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
                '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
                '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
            };
            if (fs.existsSync(filePath)) {
                res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
                fs.createReadStream(filePath).pipe(res);
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });
        server.listen(0, '127.0.0.1', () => {
            resolve(server);
        });
    });
}

/**
 * Render an HTML template to PDF using Paged.js
 * @param {string} htmlPath - Absolute path to the HTML template file
 * @param {string} outputPath - Absolute path for the output PDF
 * @param {object} options - Rendering options
 * @returns {Promise<string>} Path to the generated PDF
 */
async function renderToPdf(htmlPath, outputPath, options = {}) {
    const {
        timeout = 60000,
    } = options;

    console.log(`[Renderer] Opening: ${htmlPath}`);

    // Start temp server so Paged.js can fetch CSS files
    const server = await startStaticServer();
    const port = server.address().port;
    console.log(`[Renderer] Static server on port ${port}`);

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--font-render-hinting=none',
        ],
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 794, height: 1123 });

        // Navigate via HTTP (not file://) so Paged.js can fetch CSS
        const relPath = path.relative(PROJECT_ROOT, htmlPath);
        const httpUrl = `http://127.0.0.1:${port}/${relPath}`;
        await page.goto(httpUrl, {
            waitUntil: 'networkidle0',
            timeout: timeout,
        });

        // Wait for fonts to load
        await page.evaluateHandle('document.fonts.ready');
        console.log('[Renderer] Fonts loaded');

        // Capture console logs from the page
        page.on('console', msg => console.log('[Page]', msg.text()));
        page.on('pageerror', err => console.error('[Page Error]', err.message));

        // Inject Paged.js and manually trigger pagination
        console.log('[Renderer] Injecting Paged.js...');
        await page.addScriptTag({ path: PAGEDJS_PATH });

        // Give script time to load and initialize
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check state
        const state = await page.evaluate(() => {
            return {
                hasPagedPolyfill: typeof window.PagedPolyfill !== 'undefined',
                hasPaged: typeof window.Paged !== 'undefined',
                hasPagedModule: typeof window.Paged !== 'undefined' && typeof window.Paged.Previewer !== 'undefined',
                pagedPages: document.querySelectorAll('.pagedjs_page').length,
                pagedWrapper: document.querySelector('.pagedjs_pages') !== null,
                bodyChildren: document.body.children.length,
            };
        });
        console.log('[Renderer] Page state:', JSON.stringify(state));

        // If polyfill didn't auto-run, manually trigger it
        if (state.pagedPages === 0) {
            console.log('[Renderer] Manually triggering Paged.js previewer...');
            await page.evaluate(async () => {
                if (window.PagedPolyfill) {
                    await window.PagedPolyfill.preview();
                } else if (window.Paged && window.Paged.Previewer) {
                    const previewer = new window.Paged.Previewer();
                    await previewer.preview(
                        document.body.innerHTML,
                        [document.querySelector('link[href*="master"]')?.href,
                         document.querySelector('link[href*="brand"]')?.href,
                         document.querySelector('link[href*="feature"]')?.href].filter(Boolean),
                        document.body
                    );
                }
            });
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        const finalPageCount = await page.evaluate(() =>
            document.querySelectorAll('.pagedjs_page').length
        );

        if (finalPageCount === 0) {
            console.log('[Renderer] Paged.js did not create pages. Generating PDF without pagination...');
        } else {
            console.log(`[Renderer] Paged.js rendered ${finalPageCount} page(s)`);
        }

        // Extra settle time
        await new Promise(resolve => setTimeout(resolve, 1000));

        const pageCount = await page.evaluate(() =>
            document.querySelectorAll('.pagedjs_page').length
        );
        console.log(`[Renderer] Paged.js rendered ${pageCount} page(s)`);

        // Generate PDF
        await page.pdf({
            path: outputPath,
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
            displayHeaderFooter: false,
        });

        console.log(`[Renderer] PDF saved: ${outputPath}`);
        return outputPath;

    } finally {
        await browser.close();
        server.close();
    }
}

module.exports = { renderToPdf };
