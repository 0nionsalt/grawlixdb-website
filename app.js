const STORAGE_KEY = "tf2CheaterDb.entries.v1";
// Steam API key is now handled by the Cloudflare Worker for security
// const STEAM_API_KEY = "697576621005E7075600828CE6273B4F";

// DOM elements cache
const el = {
  // Search and filter elements
  q: document.getElementById('q'),
  filterVerdict: document.getElementById('filterVerdict'),
  sort: document.getElementById('sort'),
  stats: document.getElementById('stats'),
  rows: document.getElementById('rows'),
  
  // Buttons
  btnAdd: document.getElementById('btnAdd'),
  btnFetchProfile: document.getElementById('btnFetchProfile'),
  btnDelete: document.getElementById('btnDelete'),
  btnCancel: document.getElementById('btnCancel'),
  
  // Modal elements
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modalTitle'),
  modalClose: document.getElementById('modalClose'),
  form: document.getElementById('form'),
  id: document.getElementById('id'),
  name: document.getElementById('name'),
  steamId: document.getElementById('steamId'),
  verdict: document.getElementById('verdict'),
  lastSeen: document.getElementById('lastSeen'),
  aliases: document.getElementById('aliases'),
  evidence: document.getElementById('evidence'),
  evidencePreview: document.getElementById('evidencePreview'),
  notes: document.getElementById('notes'),
  
  // Steam profile elements
  steamProfileInfo: document.getElementById('steamProfileInfo'),
  steamAvatar: document.getElementById('steamAvatar'),
  steamId64Display: document.getElementById('steamId64Display'),
  steamName: document.getElementById('steamName'),
  steamProfileUrl: document.getElementById('steamProfileUrl'),
  
  // Overlay elements
  banOverlay: document.getElementById('banOverlay'),
  overlayTitle: document.getElementById('overlayTitle'),
  overlayClose: document.getElementById('overlayClose'),
  overlayBody: document.getElementById('overlayBody'),
  
  // Demo overlay elements
  demoOverlay: document.getElementById('demoOverlay'),
  demoOverlayTitle: document.getElementById('demoOverlayTitle'),
  demoOverlayClose: document.getElementById('demoOverlayClose'),
  demoOverlayFileName: document.getElementById('demoOverlayFileName'),
  demoOverlayFrame: document.getElementById('demoOverlayFrame')
};

// Random logo functionality
function initRandomLogo() {
  const logos = [
    { image: './assets/red_bot.png', favicon: './assets/favicons/red_bot.ico' },
    { image: './assets/blu_bot.png', favicon: './assets/favicons/blu_bot.ico' }
  ];
  
  const randomIndex = Math.floor(Math.random() * logos.length);
  const selectedLogo = logos[randomIndex];
  
  // Update navbar logo
  const brandLogoImg = document.querySelector('.brand__logo-img');
  if (brandLogoImg) {
    brandLogoImg.src = selectedLogo.image;
  }
  
  // Update favicon
  const favicon = document.getElementById('favicon');
  if (favicon) {
    favicon.href = selectedLogo.favicon;
  }
}

// Supabase configuration
const SUPABASE_URL = 'https://cveqazxsxeixqmrfxenj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2ZXFhenhzeGVpeHFtcmZ4ZW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTgwNzQsImV4cCI6MjA4OTc3NDA3NH0.BzOKzksZcZPvpo0VLiFKysa1RMSKe45GW05lh0fVj1Q';

// Initialize Supabase client
let sbClient = null;
try {
  const hasLib = !!window.supabase?.createClient;
  const hasConfig =
    !!SUPABASE_URL &&
    !!SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes("your-project-id") &&
    SUPABASE_ANON_KEY !== "your-anon-key";

  if (hasLib && hasConfig) {
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (e) {
  sbClient = null;
}

if (sbClient) console.log("Supabase enabled: loading entries from database");
else console.warn("Supabase disabled: falling back to localStorage");

function loadEntriesFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntriesToLocalStorage(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries ?? []));
}

async function fetchSteamProfile(steamId) {
  console.log('Fetching Steam profile for:', steamId);
  console.log('🔥 SECURE VERSION - Using Cloudflare Worker proxy');
  
  // Convert SteamID to SteamID64 if needed
  const steamId64 = await convertToSteamId64(steamId);
  console.log('Converted to SteamID64:', steamId64);
  
  if (!steamId64) {
    console.error('Invalid SteamID format');
    return null;
  }

  // Use Cloudflare Workers proxy - Steam API key is handled by the Worker
  const proxyUrl = `https://grawlixdb-proxy.grawlixcinema.workers.dev/api/steam/ISteamUser/GetPlayerSummaries/v0002/?key=REMOVED&steamids=${steamId64}`;
  
  try {
    console.log('Using Cloudflare Worker proxy:', proxyUrl);
    
    const response = await fetch(proxyUrl);
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Steam API response:', data);
    
    if (data.response && data.response.players && data.response.players.length > 0) {
      const player = data.response.players[0];
      console.log('Player data:', player);
      return {
        steamId64: steamId64,
        personaName: player.personaname,
        avatarUrl: player.avatarfull,
        profileUrl: player.profileurl,
        realName: player.realname || null,
        location: player.loccountrycode || null
      };
    } else {
      console.log('No player data found in response');
    }
  } catch (error) {
    console.error('Steam API fetch failed:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      steamId: steamId64,
      proxyUrl: proxyUrl
    });
    
    let errorMessage = 'Failed to fetch Steam profile.\n\n';
    
    if (error.message.includes('Failed to fetch')) {
      errorMessage += 'Network error - possible causes:\n';
      errorMessage += '1. Cloudflare Worker is not running or accessible\n';
      errorMessage += '2. Internet connection issues\n';
      errorMessage += '3. CORS or firewall blocking the request\n';
      errorMessage += '4. Worker URL is incorrect\n\n';
      errorMessage += `Worker URL: ${proxyUrl}\n\n`;
      errorMessage += 'To fix this:\n';
      errorMessage += '- Check if the Cloudflare Worker is deployed and running\n';
      errorMessage += '- Verify the Worker URL is correct\n';
      errorMessage += '- Try accessing the Worker URL directly in your browser\n';
    } else if (error.message.includes('HTTP 401')) {
      errorMessage += 'Steam API key is invalid or expired\n';
      errorMessage += 'Please update STEAM_API_KEY in the Cloudflare Worker\n';
    } else if (error.message.includes('HTTP 429')) {
      errorMessage += 'Steam API rate limit exceeded\n';
      errorMessage += 'Please wait a moment before trying again\n';
    } else {
      errorMessage += `Error: ${error.message}\n`;
    }
    
    errorMessage += '\nCheck browser console for more details.';
    alert(errorMessage);
  }
  return null;
}

async function convertToSteamId64(steamId) {
  console.log('Converting SteamID:', steamId);
  
  // Clean the input
  steamId = steamId.trim();
  
  // If it's already a 64-bit ID, return as is
  if (/^7656[0-9]{13}$/.test(steamId)) {
    console.log('Already SteamID64 format');
    return steamId;
  }
  
  // Convert STEAM_X:Y:Z format to 64-bit
  const match = steamId.match(/^STEAM_[0-9]:([0-9]):([0-9]+)$/);
  if (match) {
    const universe = 0; // Default universe
    const Y = parseInt(match[1]);
    const Z = parseInt(match[2]);
    const steamId64 = (Z * 2) + Y + 76561197960265728;
    console.log('Converted from STEAM format to:', steamId64.toString());
    return steamId64.toString();
  }
  
  console.log('Invalid SteamID format');
  return null;
}

function nowIso() {
  return new Date().toISOString();
}

function uid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalize(s) {
  return (s ?? "").toString().trim();
}

function parseAliases(raw) {
  return normalize(raw)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseEvidence(raw) {
  // For file uploads, raw will be an array of file objects
  if (Array.isArray(raw)) {
    return raw.map(file => {
      // Handle both File objects and our custom file objects
      if (file instanceof File) {
        return {
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          data: null // Don't store file data in localStorage to avoid quota exceeded
        };
      } else {
        // Handle our custom file objects (from existing entries)
        return {
          name: file.name || 'Unknown file',
          size: file.size || 0,
          type: file.type || 'unknown',
          lastModified: file.lastModified || Date.now(),
          data: null // Clear data to avoid storage issues
        };
      }
    });
  }
  return [];
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function dbRowToEntry(row) {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    steamId: row.steam_id,
    verdict: row.verdict,
    lastSeen: row.last_seen ?? "",
    aliases: row.aliases ?? [],
    evidence: row.evidence ?? [],
    notes: row.notes ?? "",
    steamProfile: row.steam_profile ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function entryToDbRow(entry) {
  if (!entry) return entry;
  return {
    id: entry.id,
    name: entry.name,
    steam_id: entry.steamId,
    verdict: entry.verdict,
    last_seen: entry.lastSeen || null,
    aliases: entry.aliases ?? [],
    evidence: entry.evidence ?? [],
    notes: entry.notes || null,
    steam_profile: entry.steamProfile ?? null,
    created_at: entry.createdAt || null,
    updated_at: entry.updatedAt || null,
  };
}

// Upload evidence files to Supabase Storage and return file metadata with URLs
async function uploadEvidenceFiles(entryId, files) {
  if (!sbClient || !files || files.length === 0) return [];

  const uploaded = [];
  for (const file of files) {
    try {
      const filePath = `${entryId}/${file.name}`;
      // For .dem files, try without contentType first, then with fallbacks
      const isDemFile = file.name.toLowerCase().endsWith('.dem');
      
      let data, error;
      if (isDemFile) {
        // Try without contentType first
        ({ data, error } = await sbClient.storage
          .from('tf2-demo-files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          }));
        
        // If that fails, try with application/octet-stream
        if (error) {
          console.log('Retrying .dem file with application/octet-stream...');
          ({ data, error } = await sbClient.storage
            .from('tf2-demo-files')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: 'application/octet-stream',
            }));
        }
      } else {
        // For non-dem tf2-demo-files, use provided type or fallback
        const contentType = file.type || 'application/octet-stream';
        ({ data, error } = await sbClient.storage
          .from('tf2-demo-files')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType,
          }));
      }

      if (error) {
        console.error('Error uploading file:', file.name, error);
        continue;
      }

      const { data: { publicUrl } } = sbClient.storage
        .from('tf2-demo-files')
        .getPublicUrl(filePath);

      uploaded.push({
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        path: filePath,
        publicUrl,
      });
    } catch (err) {
      console.error('Unexpected error uploading file:', file.name, err);
    }
  }
  return uploaded;
}

// Update entryToDbRow to handle file uploads
async function prepareEntryWithFiles(entry, files) {
  const evidence = files && files.length > 0
    ? await uploadEvidenceFiles(entry.id, files)
    : (entry.evidence ?? []);

  return {
    id: entry.id,
    name: entry.name,
    steam_id: entry.steamId,
    verdict: entry.verdict,
    last_seen: entry.lastSeen || null,
    aliases: entry.aliases ?? [],
    evidence,
    notes: entry.notes || null,
    steam_profile: entry.steamProfile ?? null,
    created_at: entry.createdAt || null,
    updated_at: entry.updatedAt || null,
  };
}

// Supabase database functions
async function loadEntries() {
  if (!sbClient) return loadEntriesFromLocalStorage();
  try {
    const { data, error } = await sbClient
      .from('entries')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading entries:', error);
      throw new Error(`Supabase select failed: ${error.message || error}`);
    }
    
    return (data || []).map(dbRowToEntry);
  } catch (error) {
    console.error('Error loading entries:', error);
    throw error;
  }
}

async function saveEntries(entries) {
  if (!sbClient) {
    saveEntriesToLocalStorage(entries);
    return;
  }
  try {
    // First, delete all existing entries to avoid duplicates
    const { error: deleteError } = await sbClient
      .from('entries')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all records
    
    if (deleteError) {
      console.error('Error clearing entries:', deleteError);
    }
    
    // Then insert all entries
    const rows = (entries || []).map(entryToDbRow);
    const { data: insertData, error: insertError } = await sbClient
      .from('entries')
      .insert(rows);
    
    if (insertError) {
      console.error('Error saving entries:', insertError);
    } else {
      console.log('Successfully saved', entries.length, 'entries');
    }
  } catch (error) {
    console.error('Error saving entries:', error);
  }
}

async function upsertEntry(entry) {
  if (!sbClient) {
    const entries = loadEntriesFromLocalStorage();
    const idx = entries.findIndex((e) => e.id === entry.id);
    if (idx >= 0) entries[idx] = entry;
    else entries.unshift(entry);
    saveEntriesToLocalStorage(entries);
    return entry;
  }
  try {
    const row = await prepareEntryWithFiles(entry, entry._files);
    const { data, error } = await sbClient
      .from('entries')
      .upsert(row, { onConflict: 'id' })
      .select('*')
      .single();
    
    if (error) {
      console.error('Error upserting entry:', error);
    }
    
    return dbRowToEntry(data);
  } catch (error) {
    console.error('Error upserting entry:', error);
  }
}

async function deleteEntryById(id) {
  if (!sbClient) {
    const entries = loadEntriesFromLocalStorage().filter((e) => e.id !== id);
    saveEntriesToLocalStorage(entries);
    return;
  }
  try {
    // First, get entry to find associated files
    const { data: entry, error: fetchError } = await sbClient
      .from('entries')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      console.error('Error fetching entry for file cleanup:', fetchError);
    } else if (entry?.evidence?.length) {
      // Delete associated files from Storage
      const filesToDelete = entry.evidence.map(f => f.path).filter(Boolean);
      if (filesToDelete.length > 0) {
        const { error: deleteFilesError } = await sbClient.storage
          .from('tf2-demo-files')
          .remove(filesToDelete);
        
        if (deleteFilesError) {
          console.error('Error deleting files from storage:', deleteFilesError);
        } else {
          console.log('Deleted', filesToDelete.length, 'files from storage');
        }
      }
    }

    // Then delete the entry
    const { error } = await sbClient
      .from('entries')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting entry:', error);
    }
  } catch (error) {
    console.error('Error deleting entry:', error);
  }
}

// ...

function updateEvidencePreview() {
  el.evidencePreview.innerHTML = '';
  
  currentFiles.forEach((file, index) => {
    const fileDiv = document.createElement('div');
    fileDiv.className = 'evidence-file';
    
    const fileInfo = document.createElement('div');
    fileInfo.className = 'evidence-file__info';
    
    const fileName = document.createElement('span');
    fileName.className = 'evidence-file__name';
    fileName.textContent = file.name;
    
    const fileSize = document.createElement('span');
    fileSize.className = 'evidence-file__size';
    fileSize.textContent = formatFileSize(file.size);
    
    fileInfo.appendChild(fileName);
    fileInfo.appendChild(fileSize);
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'evidence-file__remove';
    removeBtn.textContent = 'Remove';
    removeBtn.onclick = () => removeFile(index);
    
    fileDiv.appendChild(fileInfo);
    fileDiv.appendChild(removeBtn);
    el.evidencePreview.appendChild(fileDiv);
  });
}

// ...

function openDemoOverlay(file) {
  if (!file?.name || !file.name.toLowerCase().endsWith(".dem")) {
    alert("Only .dem files can be viewed in demo player.");
    return;
  }

  if (!el.demoOverlay) {
    alert("Demo viewer overlay is missing from the page.");
    return;
  }

  if (el.demoOverlayFileName) el.demoOverlayFileName.textContent = file.name;
  if (el.demoOverlayTitle) el.demoOverlayTitle.textContent = "Demo Viewer";

  if (el.demoOverlayFrame) {
    el.demoOverlayFrame.src = "https://dribble.tf/";
  }

  el.demoOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeDemoOverlay() {
  if (!el.demoOverlay) return;
  el.demoOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  if (el.demoOverlayFrame) el.demoOverlayFrame.src = "about:blank";
}

function viewDemoInDribble(file) {
  openDemoOverlay(file);
}

function downloadDemo(file) {
// Create a download link for the demo file
const link = document.createElement('a');
link.href = file.data || '#';
link.download = file.name;
link.style.display = 'none';
document.body.appendChild(link);
  
if (file.data) {
  // If we have the file data, trigger download
  link.click();
  document.body.removeChild(link);
} else {
  // If we don't have the file data (localStorage issue), show message
  alert(`Unable to download "${file.name}".\n\nThe original file is not available because demo files are too large to store in browser storage.\n\nPlease use the "View Demo" button to open the file in dribble.tf.`);
}
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function openModal(mode, entry) {
  el.modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  // Reset Steam profile info
  el.steamProfileInfo.style.display = "none";
  el.steamAvatar.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  el.name.removeAttribute('readonly');
  el.name.classList.remove('input--readonly');

  if (mode === "edit") {
    el.modalTitle.textContent = "Edit entry";
    el.btnDelete.hidden = false;
    el.id.value = entry.id;
    el.steamId.value = entry.steamId ?? "";
    el.verdict.value = entry.verdict ?? "suspected";
    el.lastSeen.value = entry.lastSeen ?? "";
    el.aliases.value = (entry.aliases ?? []).join(", ");
    el.notes.value = entry.notes ?? "";
    
    // Handle existing evidence files
    if (entry.evidence && entry.evidence.length > 0) {
      // For existing entries, show file names but don't allow editing
      currentFiles = entry.evidence.map(evidence => ({
        name: evidence.name || 'Unknown file',
        size: evidence.size || 0,
        type: evidence.type || 'unknown',
        lastModified: evidence.lastModified || Date.now(),
        data: evidence.data || null
      }));
      updateEvidencePreview();
    } else {
      // Reset files for new entries
      currentFiles = [];
      updateEvidencePreview();
    }
    
    // Display existing Steam profile data if available
    if (entry.steamProfile) {
      displaySteamProfile(entry.steamProfile);
    }
    return;
  }

  el.modalTitle.textContent = "Add entry";
  el.btnDelete.hidden = true;
  el.id.value = "";
  el.steamId.value = "";
  el.verdict.value = "suspected";
  el.lastSeen.value = "";
  el.aliases.value = "";
  el.notes.value = "";
}

function displaySteamProfile(profileData) {
  el.steamProfileInfo.style.display = "block";
  el.steamId64Display.textContent = profileData.steamId64;
  el.steamName.textContent = profileData.personaName;
  el.steamProfileUrl.href = profileData.profileUrl;
  el.steamProfileUrl.textContent = profileData.personaName;
  
  // Auto-fill name field with fetched username
  el.name.value = profileData.personaName;
}

function showProfileFetchingState() {
  // Show loading state for profile info
  el.steamProfileInfo.style.display = "block";
  el.steamId64Display.textContent = "Loading...";
  el.steamName.textContent = "Fetching profile...";
  el.steamProfileUrl.href = "#";
  el.steamProfileUrl.textContent = "Loading...";
}

async function handleFetchProfile() {
  const steamId = normalize(el.steamId.value);
  if (!steamId) {
    alert("Please enter a SteamID first.");
    return;
  }
  
  console.log('User clicked fetch profile with SteamID:', steamId);
  
  // Show loading state immediately
  showProfileFetchingState();
  
  el.btnFetchProfile.disabled = true;
  el.btnFetchProfile.textContent = "Fetching...";
  
  try {
    const profileData = await fetchSteamProfile(steamId);
    if (profileData) {
      console.log('Successfully fetched profile:', profileData);
      displaySteamProfile(profileData);
    } else {
      console.log('Failed to fetch profile - no data returned');
      alert("Could not fetch Steam profile. Please check:\n\n1. SteamID format (should be STEAM_0:X:Y or 7656... )\n2. Internet connection\n3. Cloudflare Worker is running\n\nCheck browser console for details.");
    }
  } catch (error) {
    console.error('Error in handleFetchProfile:', error);
    alert("Error fetching Steam profile: " + error.message + "\n\nCheck browser console for more details.");
  } finally {
    el.btnFetchProfile.disabled = false;
    el.btnFetchProfile.textContent = "Fetch Steam Profile";
  }
}

function closeModal() {
  el.modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function showBanDetails(entry) {
  el.overlayTitle.textContent = `Ban Details: ${entry.name}`;
  
  const content = buildBanDetailsContent(entry);
  el.overlayBody.innerHTML = content;
  
  el.banOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeBanOverlay() {
  el.banOverlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function buildBanDetailsContent(entry) {
  console.log('Building ban details for entry:', entry);
  console.log('Entry evidence:', entry.evidence);
  const sections = [];
  
  sections.push(`
    <div class="ban-detail-section">
      <div class="ban-detail-title">Player Information</div>
      <div class="ban-detail-content ban-detail-content--with-watch">
        <div class="player-info-main">
          <div><strong>Name:</strong> ${escapeHtml(entry.name ?? "")}</div>
          ${entry.steamId ? `<div><strong>SteamID:</strong> ${escapeHtml(entry.steamId)}</div>` : ''}
          <div><strong>Verdict:</strong> <span class="${badgeClass(entry.verdict)}">${entry.verdict ?? "suspected"}</span></div>
          ${entry.aliases?.length ? `<div><strong>Aliases:</strong> ${escapeHtml(entry.aliases.join(", "))}</div>` : ''}
        </div>
        
        <div class="watch-user-section">
          <button class="btn btn--primary btn--small" onclick="handleWatchUser('${escapeHtml(entry.name ?? "")}', '${escapeHtml(entry.steamId ?? "")}', '${entry.id}')">
            Watch User
          </button>
        </div>
      </div>
    </div>
  `);
  
  if (entry.lastSeen) {
    sections.push(`
      <div class="ban-detail-section">
        <div class="ban-detail-title">Ban Location</div>
        <div class="ban-detail-content">
          <div><strong>Last Seen:</strong> ${escapeHtml(entry.lastSeen)}</div>
        </div>
      </div>
    `);
  }
  
  // Add Community Bans section
  sections.push(`
    <div class="ban-detail-section">
      <div class="ban-detail-title">Community Bans</div>
      <div class="ban-detail-content">
        <div class="community-bans-placeholder">
          <div class="community-bans-placeholder__icon">Search</div>
          <div class="community-bans-placeholder__text">Nothing has appeared yet...</div>
          <div class="community-bans-placeholder__subtext">Community ban detection feature coming soon</div>
        </div>
      </div>
    </div>
  `);
  
  if (entry.evidence?.length) {
    console.log('Displaying evidence for entry:', entry.evidence);
    const evidenceFiles = entry.evidence.map((file, index) => {
      const fileName = file.name || 'Unknown file';
      const fileSize = file.size ? formatFileSize(file.size) : 'Unknown size';
      const fileType = file.type || 'unknown';
      const isDemoFile = fileName.toLowerCase().endsWith('.dem');
      
      return `
        <li class="evidence-file-item">
          <div class="evidence-file-item__info">
            <div class="evidence-file-item__name">${escapeHtml(fileName)}</div>
            <div class="evidence-file-item__details">${fileSize} • ${fileType}</div>
          </div>
          <div class="evidence-file-item__actions">
            <div class="evidence-file-item__type">
              ${isDemoFile ? 'Demo File' : 'Video File'}
            </div>
            ${isDemoFile ? `
              <div class="evidence-file-buttons">
                <button class="btn btn--primary btn--small" onclick="openDemoOverlay(${JSON.stringify(file).replace(/"/g, '&quot;')})">
                  View Demo
                </button>
                <button class="btn btn--secondary btn--small" onclick="downloadDemo(${JSON.stringify(file).replace(/"/g, '&quot;')})">
                  Download Demo
                </button>
              </div>
            ` : ''}
          </div>
        </li>
      `;
    }).join('');
    
    sections.push(`
      <div class="ban-detail-section">
        <div class="ban-detail-title">Evidence Files</div>
        <div class="ban-detail-content">
          <ul class="evidence-list evidence-list--files">
            ${evidenceFiles}
          </ul>
        </div>
      </div>
    `);
  } else {
    console.log('No evidence found for entry');
    sections.push(`
      <div class="ban-detail-section">
        <div class="ban-detail-title">Evidence Files</div>
        <div class="ban-detail-content">
          <div class="small" style="color: var(--muted);">No evidence files uploaded</div>
        </div>
      </div>
    `);
  }
  
  if (entry.notes) {
    sections.push(`
      <div class="ban-detail-section">
        <div class="ban-detail-title">Notes</div>
        <div class="ban-detail-content">
          ${escapeHtml(entry.notes).replace(/\n/g, '<br>')}
        </div>
      </div>
    `);
  }
  
  sections.push(`
    <div class="ban-detail-section">
      <div class="ban-detail-title">Timestamps</div>
      <div class="ban-detail-content">
        <div><strong>Created:</strong> ${escapeHtml(formatDateTime(entry.createdAt))}</div>
        <div><strong>Last Updated:</strong> ${escapeHtml(formatDateTime(entry.updatedAt))}</div>
      </div>
    </div>
  `);
  
  return `<div class="ban-details">${sections.join('')}</div>`;
}

function entryMatches(entry, query, verdictFilter) {
  // If no query and no verdict filter, everything matches
  if (!query && !verdictFilter) return true;
  
  // Check verdict filter
  if (verdictFilter && entry.verdict !== verdictFilter) return false;
  
  // If no query, just check verdict
  if (!query) return true;
  
  // Search in name, steamId, aliases, notes, and evidence
  const searchText = [
    entry.name || '',
    entry.steamId || '',
    (entry.aliases || []).join(' '),
    entry.notes || '',
    (entry.evidence || []).map(e => e.name || '').join(' ')
  ].join(' ').toLowerCase();
  
  return searchText.includes(query);
}

function sortEntries(entries, sortOption) {
  const sorted = [...entries];
  
  switch (sortOption) {
    case 'nameAsc':
      return sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    case 'createdDesc':
      return sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    case 'updatedDesc':
    default:
      return sorted.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }
}

function badgeClass(verdict) {
  const v = normalize(verdict).toLowerCase();
  if (v === "confirmed" || v === "cleared" || v === "suspected") {
    return `badge badge--${v}`;
  }
  return "badge badge--suspected";
}

async function render() {
  try {
    const q = normalize(el.q.value).toLowerCase();
    const verdict = normalize(el.filterVerdict.value);
    const sort = normalize(el.sort.value);

    const all = await loadEntries();
    const filtered = all.filter((e) => entryMatches(e, q, verdict));
    const rows = sortEntries(filtered, sort);

    el.stats.textContent = `${rows.length} shown / ${all.length} total`;

    el.rows.innerHTML = "";

    if (rows.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 6;
      td.innerHTML = `<div class="small">No entries. Click <b>Add entry</b> to create one.</div>`;
      tr.appendChild(td);
      el.rows.appendChild(tr);
      return;
    }

    for (const entry of rows) {
      const tr = document.createElement("tr");

      const nameTd = document.createElement("td");
      const nameLink = document.createElement("button");
      nameLink.className = "nameLink";
      nameLink.innerHTML = `
        <div class="name-row">
          <img class="name-avatar" src="${entry.steamProfile?.avatarUrl || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}" alt="Avatar" onerror="this.src='data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'">
          <div class="name-info">
            <div>${escapeHtml(entry.name ?? "")}</div>
            <div class="small">${escapeHtml((entry.aliases ?? []).join(", "))}</div>
          </div>
        </div>
      `;
      nameLink.addEventListener("click", () => showBanDetails(entry));
      nameTd.appendChild(nameLink);

      const steamTd = document.createElement("td");
      steamTd.innerHTML = `<div>${escapeHtml(entry.steamId ?? "")}</div>`;

      const verdictTd = document.createElement("td");
      const badge = document.createElement("span");
      badge.className = badgeClass(entry.verdict);
      badge.textContent = entry.verdict ?? "suspected";
      verdictTd.appendChild(badge);

      const lastSeenTd = document.createElement("td");
      lastSeenTd.innerHTML = `<div>${escapeHtml(entry.lastSeen ?? "")}</div>`;

      const updatedTd = document.createElement("td");
      updatedTd.innerHTML = `<div class="small">${escapeHtml(formatDateTime(entry.updatedAt))}</div>`;

      const actionsTd = document.createElement("td");
      const actions = document.createElement("div");
      actions.className = "rowActions";

      const btnView = document.createElement("button");
      btnView.className = "btn";
      btnView.textContent = "Edit";
      btnView.addEventListener("click", () => openModal("edit", entry));

      const btnCopy = document.createElement("button");
      btnCopy.className = "btn";
      btnCopy.textContent = "Copy";
      btnCopy.addEventListener("click", async () => {
        const text = buildShareText(entry);
        try {
          await navigator.clipboard.writeText(text);
          btnCopy.textContent = "Copied";
          setTimeout(() => (btnCopy.textContent = "Copy"), 900);
        } catch {
          alert("Clipboard blocked by browser.");
        }
      });

      actions.appendChild(btnCopy);
      actions.appendChild(btnView);
      actionsTd.appendChild(actions);

      tr.appendChild(nameTd);
      tr.appendChild(steamTd);
      tr.appendChild(verdictTd);
      tr.appendChild(lastSeenTd);
      tr.appendChild(updatedTd);
      tr.appendChild(actionsTd);

      el.rows.appendChild(tr);
    }
  } catch (error) {
    console.error('Error rendering entries:', error);
    el.rows.innerHTML = `<tr><td colspan="6"><div class="small">Error loading entries: ${error.message}</div></td></tr>`;
  }
}

function escapeHtml(str) {
  return (str ?? "")
    .toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function handleWatchUser(userName, steamId, entryId) {
  // Store watched user in localStorage for now
  const watchedUsers = JSON.parse(localStorage.getItem('watchedUsers') || '[]');
  
  // Check if user is already being watched
  if (watchedUsers.find(user => user.entryId === entryId)) {
    alert('You are already watching this user!');
    return;
  }
  
  const watchEntry = {
    entryId,
    userName,
    steamId,
    watchedAt: new Date().toISOString()
  };
  
  watchedUsers.push(watchEntry);
  localStorage.setItem('watchedUsers', JSON.stringify(watchedUsers));
  
  // Placeholder for Discord webhook functionality
  console.log('Discord webhook placeholder:', {
    type: 'user_watched',
    user: {
      name: userName,
      steamId: steamId,
      entryId: entryId
    },
    timestamp: watchEntry.watchedAt
  });
  
  alert(`You are now watching ${userName}!\n\nDiscord webhook notification will be implemented later.`);
}

function buildShareText(entry) {
  const lines = [];
  lines.push(`Name: ${entry.name ?? ""}`);
  if (entry.steamId) lines.push(`SteamID: ${entry.steamId}`);
  lines.push(`Verdict: ${entry.verdict ?? "suspected"}`);
  if (entry.aliases?.length) lines.push(`Aliases: ${entry.aliases.join(", ")}`);
  if (entry.lastSeen) lines.push(`Last seen: ${entry.lastSeen}`);
  if (entry.evidence?.length) {
    lines.push("Evidence:");
    for (const u of entry.evidence) lines.push(`- ${u}`);
  }
  if (entry.notes) {
    lines.push("Notes:");
    lines.push(entry.notes);
  }
  return lines.join("\n");
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  initRandomLogo();
  render();
});

el.btnAdd.addEventListener("click", () => openModal("add"));
el.btnFetchProfile.addEventListener("click", handleFetchProfile);

// File input event listener
el.evidence.addEventListener("change", async (ev) => {
  const files = Array.from(ev.target.files);
  // Filter for allowed file types
  const allowedFiles = files.filter(file => {
    const extension = file.name.toLowerCase().split('.').pop();
    return extension === 'mp4' || extension === 'dem';
  });
  const maxBytes = 50 * 1024 * 1024;
  const sizeOkFiles = allowedFiles.filter((f) => (f?.size ?? 0) <= maxBytes);
  
  if (allowedFiles.length !== files.length) {
    alert('Only .mp4 and .dem files are allowed for evidence.');
  }

  if (sizeOkFiles.length !== allowedFiles.length) {
    alert('Some files were too large. Max 50MB per file.');
  }
  
  // Keep real File objects in-memory so Supabase Storage can upload them.
  // We still never store file bytes in localStorage.
  currentFiles = sizeOkFiles;
  
  updateEvidencePreview();
});

el.q.addEventListener("input", render);
el.filterVerdict.addEventListener("change", render);
el.sort.addEventListener("change", render);

el.modalClose.addEventListener("click", closeModal);
el.btnCancel.addEventListener("click", closeModal);

el.overlayClose.addEventListener("click", closeBanOverlay);

if (el.demoOverlayClose) {
  el.demoOverlayClose.addEventListener("click", closeDemoOverlay);
}

el.modal.addEventListener("click", (ev) => {
  const t = ev.target;
  if (t?.dataset?.close) closeModal();
});

el.banOverlay.addEventListener("click", (ev) => {
  const t = ev.target;
  if (t?.dataset?.close === "overlay") closeBanOverlay();
});

if (el.demoOverlay) {
  el.demoOverlay.addEventListener("click", (ev) => {
    const t = ev.target;
    if (t?.dataset?.close === "demo") closeDemoOverlay();
  });
}

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") {
    if (el.modal.getAttribute("aria-hidden") === "false") closeModal();
    if (el.banOverlay.getAttribute("aria-hidden") === "false") closeBanOverlay();
    if (el.demoOverlay && el.demoOverlay.getAttribute("aria-hidden") === "false") closeDemoOverlay();
  }
});

// Form submission
el.form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  
  const entry = {
    id: el.id.value || uid(),
    name: normalize(el.name.value),
    steamId: normalize(el.steamId.value),
    verdict: normalize(el.verdict.value),
    lastSeen: normalize(el.lastSeen.value),
    aliases: parseAliases(el.aliases.value),
    evidence: parseEvidence(currentFiles),
    notes: normalize(el.notes.value),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    _files: currentFiles, // temporary field for upload
  };

  try {
    await upsertEntry(entry);
    // Force a small delay to ensure the database has time to update
    await new Promise(resolve => setTimeout(resolve, 100));
    await render();
    closeModal();
  } catch (error) {
    console.error("Error saving entry:", error);
    alert("Error saving entry. Please try again.");
  }
});

el.btnDelete.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to delete this entry?")) return;
  
  try {
    await deleteEntryById(el.id.value);
    await render();
    closeModal();
  } catch (error) {
    console.error("Error deleting entry:", error);
    alert("Error deleting entry. Please try again.");
  }
});
