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
    const exteriorCode = getExteriorCode(wear, 'white'); // e.g., e0 for FN
    return `https://white.market/market?name=${encodeURIComponent(item)}&sort=pr_a&unique=false&exterior=${exteriorCode}`;
  },
  waxpeer: (item, wear) => {
    const exterior = getWearCode(wear); // FN, MW, etc.
    return `https://waxpeer.com/r/dadscap?all=0&search=${encodeURIComponent(item)}&exterior=${exterior}`;
  },
  skinbaron: (item, wear) => {
    // Wear filtered on page; base search
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
    const exteriorCode = getExteriorCode(wear, 'csdeals'); // WearCategory0 for FN, etc.
    return `https://cs.deals/new/p2p?sort=price&sort_desc=0&name=${encodeURIComponent(item)}&exact_match=1&ref=dadscap&exterior=${exteriorCode}`;
  }
};

function getWearName(wear) {
  const map = { fn: 'Factory New', mw: 'Minimal Wear', ft: 'Field-Tested', ww: 'Well-Worn', bs: 'Battle-Scarred', any: '' };
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
  // Site-specific codes; e.g., white: e0=FN, csdeals: WearCategory0=FN,1=MW,etc.
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
    const urls = Object.values(marketplaceBuilders).map(builder => builder(itemName, wear));
    let completed = 0;
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const marketplace = Object.keys(marketplaceBuilders)[i]; // For data
      try {
        const tab = await chrome.tabs.create({ url, active: false });
        // ... (rest of tab logic same, but send marketplace, itemName, wear to content)
        chrome.tabs.sendMessage(tab.id, { action: 'scrapeThisPage', url, marketplace, itemName, wear });
      } catch (e) {
        console.error('Error creating tab:', e);
      }
    }
  }
});