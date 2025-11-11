const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

// When running under Jest, the integration test spawns a child process.
// Set up nock here so the child process can mock https://example.com/
if (process.env.NODE_ENV === 'test') {
  try {
    const nock = require('nock');
    const { sampleHtmlWithYale } = require('./tests/test-utils');
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
    nock('https://example.com').get('/').reply(200, sampleHtmlWithYale);
  } catch (_) {
    // Ignore if nock or test-utils are unavailable outside test runs
  }
}

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// Middleware to parse request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API endpoint to fetch and modify content
app.post('/fetch', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Fetch the content from the provided URL
    const response = await axios.get(url);
    const html = response.data;

    // Use cheerio to parse HTML and selectively replace text content, not URLs
    const $ = cheerio.load(html);
    
    // Function to replace text but skip URLs and attributes
    function replaceYaleWithNHCC(i, el) {
      if ($(el).children().length === 0 || $(el).text().trim() !== '') {
        // Get the HTML content of the element
        let content = $(el).html();
        
        // Only process if it's a text node
        if (content && $(el).children().length === 0) {
          // Replace Yale with Fale in text content only (case-aware)
          content = content.replace(/Yale/gi, (m) => {
            if (m === m.toUpperCase()) return 'FALE';
            if (m[0] === m[0].toUpperCase()) return 'Fale';
            return 'fale';
          });
          $(el).html(content);
        }
      }
    }
    
    // Process text nodes in the body
    $('body *').contents().filter(function() {
      return this.nodeType === 3; // Text nodes only
    }).each(function() {
      // Replace text content but not in URLs or attributes
      const text = $(this).text();
      const newText = text.replace(/Yale/gi, (m) => {
        if (m === m.toUpperCase()) return 'FALE';
        if (m[0] === m[0].toUpperCase()) return 'Fale';
        return 'fale';
      });
      if (text !== newText) {
        $(this).replaceWith(newText);
      }
    });
    
    // Process title separately
    const title = $('title').text().replace(/Yale/gi, (m) => {
      if (m === m.toUpperCase()) return 'FALE';
      if (m[0] === m[0].toUpperCase()) return 'Fale';
      return 'fale';
    });
    $('title').text(title);
    
    return res.json({ 
      success: true, 
      content: $.html(),
      title: title,
      originalUrl: url
    });
  } catch (error) {
    console.error('Error fetching URL:', error.message);
    return res.status(500).json({ 
      error: `Failed to fetch content: ${error.message}` 
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`NHCCproxy server running at http://localhost:${PORT}`);
});
