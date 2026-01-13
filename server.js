const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const { chromium } = require('playwright');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } }); // Allow extension origin

app.use(express.json()); // As before

const pool = new Pool({ /* same as before */ });

// Init DB table (same as before)
async function initDb() { /* same */ }
initDb();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('scrapeRequest', async (data) => {
    const { urls, itemName, wear } = data; // From extension
    socket.emit('scrapeProgress', { message: 'Starting scrape...', total: urls.length });

    const results = [];
    const browser = await chromium.launch({ headless: true });

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const marketplace = getMarketplaceName(url); // Define function as before

      try {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        // Site-specific scraping (adapt selectors; use await page.waitForSelector for dynamics)
        let priceText = await page.$eval('.price, .market_listing_price_with_fee, span.money', (el) => el.innerText.trim()) || '';
        let price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        let currency = /\$/.test(priceText) ? '$' : /€/.test(priceText) ? '€' : '$';

        // Fallback for listings (if no single price)
        if (isNaN(price)) {
          const minPrice = await page.evaluate(() => {
            const listings = Array.from(document.querySelectorAll('.item, .offer'));
            let minP = Infinity;
            listings.forEach(el => {
              const pText = el.querySelector('.price')?.innerText || '';
              const p = parseFloat(pText.replace(/[^0-9.]/g, ''));
              if (!isNaN(p) && p < minP) minP = p;
            });
            return minP !== Infinity ? minP : null;
          });
          price = minPrice || null;
        }

        if (!price) throw new Error('No price found');

        const scrapedData = {
          marketplace,
          itemName,
          price,
          currency,
          url,
          lastUpdate: new Date().toISOString()
        };

        // Store in DB (same as POST /scrape)
        const query = `INSERT INTO scraped_items (...) VALUES (...) RETURNING id;`; // Same as before
        const result = await pool.query(query, [/* values */]);
        scrapedData.id = result.rows[0].id;

        results.push(scrapedData);
        socket.emit('scrapeProgress', { message: `Scraped ${marketplace}`, current: i + 1 });

      } catch (err) {
        console.error(`Error scraping ${url}:`, err);
        socket.emit('scrapeError', { url, message: err.message });
      } finally {
        await page.close();
      }
    }

    await browser.close();
    socket.emit('scrapeComplete', { results });
  });

  socket.on('disconnect', () => console.log('Client disconnected'));
});

server.listen(3000, () => console.log('Server with WS on 3000'));