/**
 * Admin UI — upload .docx, review parsed content, generate PDF
 */
(function () {
    'use strict';

    var dropZone = document.getElementById('drop-zone');
    var docxInput = document.getElementById('docx-input');
    var browseBtn = document.getElementById('browse-btn');
    var uploadStatus = document.getElementById('upload-status');
    var parsedSection = document.getElementById('parsed-section');
    var generateSection = document.getElementById('generate-section');
    var resultSection = document.getElementById('result-section');
    var generateBtn = document.getElementById('generate-btn');
    var generateStatus = document.getElementById('generate-status');
    var downloadLink = document.getElementById('download-link');
    var pdfFrame = document.getElementById('pdf-frame');
    var newArticleBtn = document.getElementById('new-article-btn');
    var templateSelect = document.getElementById('template-select');

    var currentArticle = null;

    // --- Upload ---
    browseBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        docxInput.click();
    });
    dropZone.addEventListener('click', function () { docxInput.click(); });

    dropZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', function () {
        dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]);
    });
    docxInput.addEventListener('change', function () {
        if (this.files[0]) uploadFile(this.files[0]);
    });

    async function uploadFile(file) {
        if (!file.name.endsWith('.docx')) {
            showStatus(uploadStatus, 'error', 'Please upload a .docx file.');
            return;
        }

        showStatus(uploadStatus, 'loading', 'Uploading and parsing...');
        parsedSection.hidden = true;
        generateSection.hidden = true;
        resultSection.hidden = true;

        var formData = new FormData();
        formData.append('docx', file);

        try {
            var response = await fetch('/api/upload', { method: 'POST', body: formData });
            var data = await response.json();

            if (!response.ok || !data.success) {
                showStatus(uploadStatus, 'error', data.error || 'Upload failed');
                return;
            }

            currentArticle = data.article;
            showStatus(uploadStatus, 'success', 'Parsed successfully!');
            displayParsedContent(data.article);
        } catch (err) {
            showStatus(uploadStatus, 'error', 'Network error: ' + err.message);
        }
    }

    function displayParsedContent(article) {
        document.getElementById('parsed-title').value = article.title || '';
        document.getElementById('parsed-subtitle').value = article.subtitle || '';
        document.getElementById('parsed-author').value = article.author || '';
        document.getElementById('parsed-category').value = article.category || '';
        document.getElementById('parsed-wordcount').textContent = article.wordCount + ' words';
        document.getElementById('parsed-images').textContent = article.imageCount + ' images';
        document.getElementById('parsed-template').textContent = article.suggestedTemplate || 'feature-opening';

        var pq = document.getElementById('parsed-pullquotes');
        pq.innerHTML = article.pullQuotes.length > 0
            ? article.pullQuotes.map(function (q) { return '<p>"' + q + '"</p>'; }).join('')
            : '<p class="muted">No pull quotes detected</p>';

        document.getElementById('parsed-body').innerHTML = article.bodyHtml || '<p class="muted">No body content</p>';

        templateSelect.value = article.suggestedTemplate || 'feature-opening';

        parsedSection.hidden = false;
        generateSection.hidden = false;
    }

    // --- Generate PDF ---
    generateBtn.addEventListener('click', async function () {
        if (!currentArticle) return;

        // Update article from editable fields
        currentArticle.title = document.getElementById('parsed-title').value;
        currentArticle.subtitle = document.getElementById('parsed-subtitle').value;
        currentArticle.author = document.getElementById('parsed-author').value;
        currentArticle.category = document.getElementById('parsed-category').value;

        generateBtn.disabled = true;
        showStatus(generateStatus, 'loading', 'Generating PDF... this may take a few seconds.');
        resultSection.hidden = true;

        try {
            var response = await fetch('/api/render', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    article: currentArticle,
                    template: templateSelect.value,
                }),
            });

            var data = await response.json();

            if (!response.ok || !data.success) {
                showStatus(generateStatus, 'error', data.error || 'Render failed');
                generateBtn.disabled = false;
                return;
            }

            generateStatus.hidden = true;
            downloadLink.href = data.pdfUrl;
            pdfFrame.src = data.pdfUrl;
            resultSection.hidden = false;
            generateBtn.disabled = false;
        } catch (err) {
            showStatus(generateStatus, 'error', 'Network error: ' + err.message);
            generateBtn.disabled = false;
        }
    });

    // --- New article ---
    newArticleBtn.addEventListener('click', function () {
        currentArticle = null;
        parsedSection.hidden = true;
        generateSection.hidden = true;
        resultSection.hidden = true;
        uploadStatus.hidden = true;
        docxInput.value = '';
    });

    function showStatus(el, type, message) {
        el.hidden = false;
        el.className = 'status ' + type;
        el.textContent = message;
    }
})();
