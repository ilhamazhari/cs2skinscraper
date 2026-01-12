// background.js

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

function getWearName(wear) {
  const map = {
    fn: 'Factory New',
    mw: 'Minimal Wear',
    ft: 'Field-Tested',
    ww: 'Well-Worn',
    bs: 'Battle-Scarred',
    any: ''
  };
  return map[wear] || '';
}

function getWearCode(wear) {
  const map = { fn: 'FN', mw: 'MW', ft: 'FT', ww: 'WW', bs: 'BS', any: '' };
  return map[wear] || '';
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
  return ranges[wear] || { min: 0, max: 1 };
}

function getExteriorCode(wear, site) {
  if (site === 'white') {
    const codes = { fn: 'e0', mw: 'e1', ft: 'e2', ww: 'e3', bs: 'e4', any: '' };
    return codes[wear] || '';
  } else if (site === 'csdeals') {
    const codes = { fn: 'WearCategory0', mw: 'WearCategory1', ft: 'WearCategory2', ww: 'WearCategory3', bs: 'WearCategory4', any: '' };
    return codes[wear] || '';
  }
  return '';
}

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.action === 'startScrape') {
    const { itemName, wear } = msg;
    if (!itemName) {
      console.error('[BG] No itemName provided');
      return;
    }

    const urls = Object.values(marketplaceBuilders).map(builder => builder(itemName, wear));
    const marketplaceNames = Object.keys(marketplaceBuilders);

    let completed = 0;

    console.log(`[BG] Starting scrape for "${itemName}" (${wear}) - ${urls.length} marketplaces`);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const marketplace = marketplaceNames[i];

      try {
        const tab = await chrome.tabs.create({ url, active: false });
        const expectedTabId = tab.id;

        console.log(`[BG] Created tab ${expectedTabId} for ${marketplace} → ${url}`);

        const onTabUpdated = (updatedTabId, changeInfo) => {
          if (updatedTabId === expectedTabId && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(onTabUpdated);

            console.log(`[BG] Tab ${expectedTabId} reached complete status`);

            // Force inject content script
            chrome.scripting.executeScript({
              target: { tabId: expectedTabId },
              files: ['content.js']
            })
            .then(() => {
              console.log(`[BG] content.js injected into tab ${expectedTabId}`);

              // Send scrape instruction
              chrome.tabs.sendMessage(expectedTabId, {
                action: 'scrapeThisPage',
                url,
                marketplace,
                itemName,
                wear
              });

              console.log(`[BG] Sent 'scrapeThisPage' to tab ${expectedTabId} (${marketplace})`);
            })
            .catch(err => {
              console.error(`[BG] Failed to inject content.js into tab ${expectedTabId}:`, err);
              completed++;
              checkCompletion();
            });

            // Give plenty of time for scraping (slow sites need this)
            setTimeout(() => {
              chrome.tabs.remove(expectedTabId).catch(err => {
                console.warn(`[BG] Could not remove tab ${expectedTabId}:`, err);
              });
            }, 60000); // 60 seconds
          }
        };

        chrome.tabs.onUpdated.addListener(onTabUpdated);

      } catch (err) {
        console.error(`[BG] Failed to create tab for ${marketplace}:`, err);
        completed++;
        checkCompletion();
      }
    }

    function checkCompletion() {
      completed++;
      if (completed >= urls.length) {
        console.log('[BG] All tabs processed');
        chrome.runtime.sendMessage({ action: 'scrapeComplete' });
      }
    }
  }
});

// Optional: Listen for messages from content.js (success/error reporting)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'scrapeError') {
    console.error(`[CONTENT → BG] Error: ${msg.message} on ${msg.url}`);
    chrome.runtime.sendMessage(msg); // forward to popup if needed
  } else if (msg.action === 'scrapeSuccess') {
    console.log(`[CONTENT → BG] Success on ${msg.url}`);
  }
});