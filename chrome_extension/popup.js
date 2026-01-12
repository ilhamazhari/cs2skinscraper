// popup.js
let allSkins = [];
let isDataLoaded = false;

const itemInput = document.getElementById('itemName');
const suggestionsDiv = document.getElementById('suggestions');

itemInput.addEventListener('input', showSuggestions);
itemInput.addEventListener('focus', showSuggestions);
document.addEventListener('click', (e) => {
  if (!itemInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
    suggestionsDiv.style.display = 'none';
  }
});

function showSuggestions() {
  const value = itemInput.value.toLowerCase().trim();
  if (value.length < 2) {
    suggestionsDiv.style.display = 'none';
    return;
  }

  const matches = allSkins
    .filter(name => name.toLowerCase().includes(value))
    .slice(0, 12); // limit to 12 suggestions

  if (matches.length === 0) {
    suggestionsDiv.style.display = 'none';
    return;
  }

  suggestionsDiv.innerHTML = matches
    .map(name => `<div class="suggestion-item">${name}</div>`)
    .join('');

  suggestionsDiv.style.display = 'block';

  // Click handler for suggestions
  suggestionsDiv.querySelectorAll('.suggestion-item').forEach(item => {
    item.addEventListener('click', () => {
      itemInput.value = item.textContent;
      suggestionsDiv.style.display = 'none';
    });
  });
}

async function loadSkinData() {
  if (isDataLoaded) return;
  
  try {
    const response = await fetch('https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json');
    if (!response.ok) throw new Error('Failed to load skin data');
    
    const data = await response.json();
    
    allSkins = [...new Set(
      data
        .filter(item => item.id?.startsWith('skin-') && item.name?.includes('|'))
        .map(item => item.name.trim())
    )].sort();
    
    isDataLoaded = true;
    console.log(`Loaded ${allSkins.length} unique CS2 skin base names`);
    
    // Save for offline
    chrome.storage.local.set({ skinNames: allSkins });
    
  } catch (error) {
    console.error('Error loading skins:', error);
    // Fallback to storage
    chrome.storage.local.get('skinNames', (result) => {
      if (result.skinNames?.length > 0) {
        allSkins = result.skinNames;
        isDataLoaded = true;
      }
    });
  }
}

// Call when popup opens
document.addEventListener('DOMContentLoaded', () => {
  loadSkinData();
});

document.getElementById('scrapeBtn').addEventListener('click', () => {
  const itemName = document.getElementById('itemName').value.trim();
  const wear = document.getElementById('wear').value;
  if (!itemName) {
    document.getElementById('status').textContent = 'Error: Enter an item name.';
    return;
  }
  const status = document.getElementById('status');
  status.textContent = 'Scraping started...';
  chrome.runtime.sendMessage({ action: 'startScrape', itemName, wear });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'scrapeComplete') {
    document.getElementById('status').textContent = 'Scraping complete! Check server console.';
  } else if (msg.action === 'scrapeError') {
    document.getElementById('status').textContent += `\nError on ${msg.url}: ${msg.message}`;
  }
});
