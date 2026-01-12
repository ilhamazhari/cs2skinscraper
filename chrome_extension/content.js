console.log('[CONTENT.JS] File loaded and executed at ' + new Date().toISOString());

function getWearName(wear) { /* same */ }
function getFloatRange(wear) { /* same */ }

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'scrapeThisPage') {
    console.log('Received scrape message for URL:', msg.url);
    const url = msg.url;
    const marketplace = msg.marketplace;
    const targetItem = msg.itemName;
    const targetWear = getWearName(msg.wear);
    const { min: minF, max: maxF } = getFloatRange(msg.wear);

    let itemName = document.title.trim() || targetItem;
    let price = null;
    let currency = '$'; // Default; detect later

    const maxRetries = 5;
    let retryCount = 0;

    const scrapeWithRetry = () => {
      console.log(`Starting scrape attempt ${retryCount + 1} for ${marketplace}`);
      const timeoutId = setTimeout(() => {
        console.error('Scrape timeout on', url);
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying (${retryCount}/${maxRetries})...`);
          scrapeWithRetry();
        } else {
          sendError('Timeout after retries', url);
        }
      }, 10000); // 20s timeout

      // MutationObserver to wait for dynamic content
      const observer = new MutationObserver(() => {
        console.log('DOM mutation detected; checking for prices');
        if (tryScrape()) {
          observer.disconnect();
          clearTimeout(timeoutId);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      // Initial check
      if (tryScrape()) {
        observer.disconnect();
        clearTimeout(timeoutId);
      }
    };

    function tryScrape() {
      let priceElement = null;
      let priceText = '';

      // Site-specific selectors (update based on DevTools)
      if (marketplace === 'steam') {
        priceElement = document.querySelector('.market_listing_price_with_fee'); // Lowest sell price
      } else if (marketplace === 'waxpeer') {
        priceElement = document.querySelector('.item-price, .price'); // Common
      } else if (marketplace === 'skinbaron') {
        priceElement = document.querySelector('.price, span.price'); // Inspect for .offer-price or similar
      } else if (marketplace === 'csmoney') {
        priceElement = document.querySelector('.item-price, .cs-money-price'); // Card prices
      } // Add for others: avan: '.price-block', white: '.market-item-price', etc.

      if (priceElement) {
        priceText = priceElement.innerText.trim();
      } else {
        // Fallback: Parse all listings for min price matching item/wear
        console.log('No direct selector; parsing listings');
        const listings = document.querySelectorAll('.listing, .item, .offer, .market-row, div[class*="price"]'); // Common classes
        let minPrice = Infinity;
        listings.forEach(el => {
          const elItem = el.querySelector('.name, h3, .item-name')?.innerText?.trim() || '';
          const elWear = el.querySelector('.wear, .exterior')?.innerText?.toLowerCase() || '';
          const elFloat = parseFloat(el.querySelector('.float')?.innerText || 'NaN');
          const elPriceText = el.querySelector('.price, .item-price, span.money')?.innerText?.trim() || '';
          const elP = parseFloat(elPriceText.replace(/[^0-9.]/g, ''));

          if (elItem.includes(targetItem) && 
              (targetWear === '' || elWear.includes(targetWear.toLowerCase())) &&
              (!isNaN(elFloat) ? (elFloat >= minF && elFloat <= maxF) : true) &&
              !isNaN(elP) && elP < minPrice) {
            minPrice = elP;
            priceText = elPriceText;
            itemName = elItem;
          }
          console.log(`Checked listing: ${elItem} | Wear: ${elWear} | Float: ${elFloat} | Price: ${elP}`);
        });
        if (minPrice !== Infinity) {
          price = minPrice;
        } else {
          console.log('No matching listings found');
          return false;
        }
      }

      if (priceText) {
        price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
        if (isNaN(price)) {
          sendError('Invalid price format', url);
          return false;
        }
        currency = /\$/.test(priceText) ? '$' : /€/.test(priceText) ? '€' : /¥/.test(priceText) ? '¥' : '$';
        console.log(`Found price: ${price} ${currency} for ${itemName}`);

        const data = {
          marketplace,
          itemName,
          price,
          currency,
          url,
          lastUpdate: new Date().toISOString()
        };

        fetch('http://localhost:3000/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then(result => console.log('Data sent:', result))
        .catch(err => {
          console.error('Fetch error:', err);
          if (retryCount < maxRetries) {
            retryCount++;
            scrapeWithRetry();
          } else {
            sendError('Failed to send data', url);
          }
        });

        return true; // Success
      }
      return false; // Not yet
    }

    scrapeWithRetry();
  }
});

function sendError(message, url) {
  console.error(`Error: ${message} on ${url}`);
  chrome.runtime.sendMessage({ action: 'scrapeError', message, url });
}