chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'scrapeThisPage') {
    const url = msg.url;
    let itemName = document.title || 'Unknown Item';
    let price = null;
    let currency = 'USD'; // Default
    const marketplace = getMarketplaceName(url);

    const maxRetries = 3;
    let retryCount = 0;

    const scrapeWithRetry = () => {
      const timeout = setTimeout(() => {
        console.error('Timeout on', url);
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying scrape (${retryCount}/${maxRetries})...`);
          scrapeWithRetry();
        } else {
          sendError('Scrape timeout after retries', url);
        }
      }, 10000);

      const checkPrice = setInterval(() => {
        let priceElement = null;
        // ... (same site-specific logic as before)

        if (priceElement) {
          clearInterval(checkPrice);
          clearTimeout(timeout);
          const priceText = priceElement.innerText.trim();
          price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
          if (isNaN(price)) {
            sendError('Invalid price format', url);
            return;
          }

          const data = {
            marketplace,
            itemName,
            price,
            currency,
            url,
            lastUpdate: new Date().toISOString()
          };

          // Send to server with fetch (instead of runtime message for now)
          fetch('http://localhost:3000/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          })
          .then(response => {
            if (!response.ok) throw new Error('Server error: ' + response.status);
            return response.json();
          })
          .then(result => {
            console.log('Data sent successfully:', result);
            chrome.runtime.sendMessage({ action: 'scrapeSuccess', url });
          })
          .catch(err => {
            console.error('Network error sending data:', err);
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`Retrying send (${retryCount}/${maxRetries})...`);
              scrapeWithRetry(); // Retry whole scrape if needed
            } else {
              sendError('Failed to send data after retries', url);
            }
          });
        }
      }, 500);
    };

    scrapeWithRetry();
  }
});

function sendError(message, url) {
  chrome.runtime.sendMessage({ action: 'scrapeError', message, url });
}

function getMarketplaceName(url) {
  if (url.includes('steamcommunity.com')) return 'Steam';
  if (url.includes('avan.market')) return 'Avan Market';
  if (url.includes('c5game.com')) return 'C5Game';
  if (url.includes('white.market')) return 'White Market';
  if (url.includes('waxpeer.com')) return 'Waxpeer';
  if (url.includes('skinbaron.de')) return 'SkinBaron';
  if (url.includes('shadowpay.com')) return 'ShadowPay';
  if (url.includes('gamerpay.gg')) return 'GamerPay';
  if (url.includes('cs.money')) return 'CS.Money';
  if (url.includes('cs.deals')) return 'CS.Deals';
  return 'Unknown';
}