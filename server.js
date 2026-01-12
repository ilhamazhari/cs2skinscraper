const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// PostgreSQL Pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Create table if not exists (run once or in migration tool)
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS scraped_items (
        id SERIAL PRIMARY KEY,
        marketplace VARCHAR(255) NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        price NUMERIC NOT NULL,
        currency VARCHAR(50) NOT NULL,
        url TEXT NOT NULL,
        last_update TIMESTAMP NOT NULL
      );
    `);
    console.log('Table created or already exists');
  } catch (err) {
    console.error('Error creating table:', err);
  }
}
initDb();

app.post('/scrape', async (req, res, next) => {
  const data = req.body;
  try {
    // Validate required fields
    const requiredFields = ['marketplace', 'itemName', 'price', 'currency', 'url'];
    for (const field of requiredFields) {
      if (!data[field]) {
        return res.status(400).json({ error: `Missing required field: ${field}` });
      }
    }
    if (isNaN(data.price)) {
      return res.status(400).json({ error: 'Price must be a number' });
    }

    data.lastUpdate = data.lastUpdate || new Date().toISOString();

    // Insert into DB
    const query = `
      INSERT INTO scraped_items (marketplace, item_name, price, currency, url, last_update)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id;
    `;
    const values = [data.marketplace, data.itemName, data.price, data.currency, data.url, data.lastUpdate];
    const result = await pool.query(query, values);
    console.log('Data inserted with ID:', result.rows[0].id);

    res.json({ success: true, message: 'Data stored', id: result.rows[0].id });
  } catch (err) {
    next(err); // Pass to error middleware
  }
});

app.get('/data', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM scraped_items ORDER BY last_update DESC;');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// Optional Playwright endpoint remains the same, but add DB insert
// In /start-scrape, after scraping, loop over results and POST internally to /scrape or insert directly.

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});