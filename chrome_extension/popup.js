const socket = io('http://localhost:3000', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000
});

// UI elements
const itemInput = document.getElementById('itemName');
const wearSelect = document.getElementById('wear');
const scrapeBtn = document.getElementById('scrapeBtn');
const statusDiv = document.getElementById('status');

// Autocomplete state
let allSkins = [];
let isDataLoaded = false;
let isScraping = false;

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

// Hide suggestions on outside click
document.addEventListener('click', (e) => {
  if (!itemInput.contains(e.target) && !document.getElementById('suggestions').contains(e.target)) {
    document.getElementById('suggestions').style.display = 'none';
  }
});

// ────────────────────────────────────────────────
// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  if (typeof io === 'undefined') {
    console.error('Socket.IO library not loaded!');
    updateStatus('Error: Socket.IO failed to load. Check network / CDN.', 'error');
    return;
  }
  loadSkinData(); // Load autocomplete data on popup open

  itemInput.addEventListener('input', showSuggestions);
  itemInput.addEventListener('focus', showSuggestions);

  scrapeBtn.addEventListener('click', () => {
    if (isScraping) {
      updateStatus('Scraping already in progress...', 'warning');
      return;
    }

    const itemName = itemInput.value.trim();
    const wear = wearSelect.value;

    if (!itemName) {
      updateStatus('Enter an item name', 'error');
      return;
    }

    if (!socket.connected) {
      updateStatus('No server connection. Reconnecting...', 'warning');
      socket.connect();
      return;
    }

    clearStatus();
    isScraping = true;
    scrapeBtn.disabled = true;
    scrapeBtn.textContent = 'Scraping...';

    updateStatus(`Generating URLs for "${itemName}" (${wear})...`, 'info');

    chrome.runtime.sendMessage({ action: 'generateUrls', itemName, wear }, (response) => {
      if (chrome.runtime.lastError || !response?.success) {
        updateStatus('Failed to generate URLs: ' + (response?.error || chrome.runtime.lastError?.message), 'error');
        resetButton();
        return;
      }

      updateStatus(`Sending ${response.count} URLs to server...`, 'info');

      socket.emit('scrapeRequest', {
        urls: response.urls,
        itemName: response.itemName,
        wear: response.wear
      });
    });
  });
});

// Socket events (same as before)
socket.on('connect', () => updateStatus('Connected to scraping server', 'success'));
socket.on('connect_error', (err) => updateStatus('Connection error: ' + err.message, 'error'));
socket.on('disconnect', (reason) => updateStatus('Disconnected: ' + reason, 'warning'));

socket.on('scrapeProgress', (data) => {
  updateStatus(`${data.message} (${data.current || '?'}/${data.total || '?'})`, 'info');
});

socket.on('scrapeError', (data) => {
  updateStatus(`Error on ${data.url}: ${data.message}`, 'error');
});

socket.on('scrapeComplete', (data) => {
  isScraping = false;
  resetButton();

  if (data.results?.length > 0) {
    updateStatus(`Done! ${data.results.length} results scraped.`, 'success');

    const summary = data.results.map(r => `${r.marketplace}: ${r.price || 'N/A'} ${r.currency || '?'}`).join('\n');
    statusDiv.innerHTML += `<pre style="margin-top:10px; color:#eee;">${summary}</pre>`;

    if (confirm('Open preview tabs?')) {
      data.results.forEach(r => chrome.tabs.create({ url: r.url, active: false }));
    }
  } else {
    updateStatus('Scraping complete but no results.', 'warning');
  }
});

// Status helpers
function updateStatus(message, type = 'info') {
  const colors = { info: '#3498db', success: '#2ecc71', warning: '#f39c12', error: '#e74c3c' };
  const entry = document.createElement('div');
  entry.style.color = colors[type] || '#ecf0f1';
  entry.style.margin = '6px 0';
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  statusDiv.appendChild(entry);
  statusDiv.scrollTop = statusDiv.scrollHeight;
}

function clearStatus() {
  statusDiv.innerHTML = '';
}

function resetButton() {
  isScraping = false;
  scrapeBtn.disabled = false;
  scrapeBtn.textContent = 'Start Scraping';
}