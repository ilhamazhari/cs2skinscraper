// ────────────────────────────────────────────────
// Marketplace URL builders
// ────────────────────────────────────────────────

const marketplaceBuilders = {
  steam: (item, wear) => {
    const wearName = getWearName(wear);
    return `https://steamcommunity.com/market/listings/730/${encodeURIComponent(`${item} (${wearName})`)}`;
  },
  avan: (item, wear) => {
    const { min, max } = getFloatRange(wear);
    return `https://avan.market/en/market/cs?name=${encodeURIComponent(item)}&r=dadscap&sort=1&float_min=${min}&float_max=${max}`;
  },
  c5game: (item, wear) => {
    const wearName = getWearName(wear).replace(' ', '%20');
    return `https://www.c5game.com/en/csgo?keywords=${encodeURIComponent(item)}&exterior=${wearName}`;
  },
  white: (item, wear) => {
    const exteriorCode = getExteriorCode(wear, 'white');
    return `https://white.market/market?name=${encodeURIComponent(item)}&sort=pr_a&unique=false&exterior=${exteriorCode}`;
  },
  waxpeer: (item, wear) => {
    const exterior = getWearCode(wear);
    return `https://waxpeer.com/r/dadscap?all=0&search=${encodeURIComponent(item)}&exterior=${exterior}`;
  },
  skinbaron: (item, wear) => {
    return `https://skinbaron.de/en/csgo?str=${encodeURIComponent(item)}&sort=PA`;
  },
  shadowpay: (item, wear) => {
    const exteriors = encodeURIComponent(`["${getWearName(wear)}"]`);
    return `https://shadowpay.com/csgo-items?search=${encodeURIComponent(item)}&sort_column=price&sort_dir=asc&exteriors=${exteriors}&utm_campaign=KzvAR2XJATjoT8y`;
  },
  gamerpay: (item, wear) => {
    const wearName = getWearName(wear).replace(' ', '%20');
    return `https://gamerpay.gg/?query=${encodeURIComponent(item)}&sortBy=price&ascending=true&page=1&wear=${wearName}`;
  },
  csmoney: (item, wear) => {
    const exterior = getWearName(wear).replace(' ', '+');
    return `https://cs.money/market/buy/?limit=60&offset=0&name=${encodeURIComponent(item)}&order=asc&sort=price&exterior=${exterior}`;
  },
  csdeals: (item, wear) => {
    const exteriorCode = getExteriorCode(wear, 'csdeals');
    return `https://cs.deals/new/p2p?sort=price&sort_desc=0&name=${encodeURIComponent(item)}&exact_match=1&ref=dadscap&exterior=${exteriorCode}`;
  }
};

// ────────────────────────────────────────────────
// Helper functions
// ────────────────────────────────────────────────

function getWearName(wear) {
  const map = {
    fn: 'Factory New',
    mw: 'Minimal Wear',
    ft: 'Field-Tested',
    ww: 'Well-Worn',
    bs: 'Battle-Scarred',
    any: ''
  };
  return map[wear?.toLowerCase()] || '';
}

function getWearCode(wear) {
  const map = { fn: 'FN', mw: 'MW', ft: 'FT', ww: 'WW', bs: 'BS', any: '' };
  return map[wear?.toLowerCase()] || '';
}

function getFloatRange(wear) {
  const ranges = {
    fn: { min: 0, max: 0.07 },
    mw: { min: 0.07, max: 0.15 },
    ft: { min: 0.15, max: 0.38 },
    ww: { min: 0.38, max: 0.45 },
    bs: { min: 0.45, max: 1 },
    any: { min: 0, max: 1 }
  };
  return ranges[wear?.toLowerCase()] || { min: 0, max: 1 };
}

function getExteriorCode(wear, site) {
  const w = wear?.toLowerCase() || 'any';

  if (site === 'white') {
    const codes = { fn: 'e0', mw: 'e1', ft: 'e2', ww: 'e3', bs: 'e4', any: '' };
    return codes[w] || '';
  }

  if (site === 'csdeals') {
    const codes = {
      fn: 'WearCategory0',
      mw: 'WearCategory1',
      ft: 'WearCategory2',
      ww: 'WearCategory3',
      bs: 'WearCategory4',
      any: ''
    };
    return codes[w] || '';
  }

  return '';
}

// ────────────────────────────────────────────────
// Message listener (only needed for URL generation now)
// ────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'generateUrls') {
    const { itemName, wear } = message;

    if (!itemName || typeof itemName !== 'string' || itemName.trim() === '') {
      sendResponse({ success: false, error: 'Invalid or missing item name' });
      return true;
    }

    try {
      const urls = Object.values(marketplaceBuilders).map(builder =>
        builder(itemName.trim(), wear || 'any')
      );

      console.log(`[background.js] Generated ${urls.length} URLs for "${itemName}" (${wear || 'any'})`);

      sendResponse({
        success: true,
        urls,
        count: urls.length,
        itemName: itemName.trim(),
        wear: wear || 'any'
      });
    } catch (err) {
      console.error('[background.js] Error generating URLs:', err);
      sendResponse({ success: false, error: err.message });
    }

    return true; // Keep the message channel open for async sendResponse
  }

  // Unknown action
  sendResponse({ success: false, error: 'Unknown action' });
  return true;
});

// Optional: log when service worker starts / wakes up
console.log('[background.js] Service worker initialized at', new Date().toISOString());