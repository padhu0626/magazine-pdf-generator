/**
 * Magazine PDF Generator — Express Server
 */
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use('/client', express.static(path.join(__dirname, '../client')));
app.use('/templates', express.static(path.join(__dirname, '../templates')));
app.use('/brand', express.static(path.join(__dirname, '../brand')));
app.use('/output', express.static(path.join(__dirname, '../output')));

// JSON parsing
app.use(express.json());

// Home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: '1.0.0' });
});

app.listen(PORT, () => {
    console.log(`Magazine PDF Generator running at http://localhost:${PORT}`);
});
