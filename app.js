const STORAGE_KEY = "tf2CheaterDb.entries.v1";
const STEAM_API_KEY = "697576621005E7075600828CE6273B4F";

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
const SUPABASE_URL = 'https://your-project-id.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

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
  
  // Convert SteamID to SteamID64 if needed
  const steamId64 = await convertToSteamId64(steamId);
  console.log('Converted to SteamID64:', steamId64);
  
  if (!steamId64) {
    console.error('Invalid SteamID format');
    return null;
  }

  // Use Cloudflare Workers proxy - replace with your actual worker URL
  const proxyUrl = `https://nameless-bread-3fcd.grawlixcinema.workers.dev/api/steam/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${steamId64}`;
  
  try {
    console.log('Using proxy:', proxyUrl);
    
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
    alert('Failed to fetch Steam profile. Please make sure:\n\n1. The proxy server is running and accessible\n2. Your Steam API key is valid\n3. The SteamID format is correct\n\nCheck browser console for more details.');
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
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error loading entries:', error);
    return [];
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
      .neq('id', 'neq.0'); // Delete all records
    
    if (deleteError) {
      console.error('Error clearing entries:', deleteError);
    }
    
    // Then insert all entries
    const { data: insertData, error: insertError } = await sbClient
      .from('entries')
      .insert(entries);
    
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
    const { data, error } = await sbClient
      .from('entries')
      .upsert(entry, { onConflict: 'merge' });
    
    if (error) {
      console.error('Error upserting entry:', error);
    }
    
    return data;
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

function safeUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function badgeClass(verdict) {
  if (verdict === "confirmed") return "badge badge--confirmed";
  if (verdict === "cleared") return "badge badge--cleared";
  return "badge badge--suspected";
}

function entryMatches(entry, q, verdict) {
  if (verdict && entry.verdict !== verdict) return false;
  if (!q) return true;
  const hay = [
    entry.name,
    entry.steamId,
    ...(entry.aliases ?? []),
    entry.lastSeen,
    entry.notes,
    ...(entry.evidence ?? []),
  ]
    .join("\n")
    .toLowerCase();
  return hay.includes(q);
}

function sortEntries(entries, sort) {
  const copy = [...entries];
  if (sort === "nameAsc") {
    copy.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
    return copy;
  }
  if (sort === "createdDesc") {
    copy.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return copy;
  }
  copy.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  return copy;
}

window.addEventListener("error", (ev) => {
  console.error("Uncaught error:", ev.error || ev.message);
});

window.addEventListener("unhandledrejection", (ev) => {
  console.error("Unhandled promise rejection:", ev.reason);
});

const el = {
  rows: document.getElementById("rows"),
  q: document.getElementById("q"),
  filterVerdict: document.getElementById("filterVerdict"),
  sort: document.getElementById("sort"),
  stats: document.getElementById("stats"),

  btnAdd: document.getElementById("btnAdd"),
  btnSteamLogin: document.getElementById("btnSteamLogin"),

  modal: document.getElementById("modal"),
  modalTitle: document.getElementById("modalTitle"),
  modalClose: document.getElementById("modalClose"),
  btnCancel: document.getElementById("btnCancel"),
  btnDelete: document.getElementById("btnDelete"),

  form: document.getElementById("form"),
  id: document.getElementById("id"),
  name: document.getElementById("name"),
  steamId: document.getElementById("steamId"),
  verdict: document.getElementById("verdict"),
  lastSeen: document.getElementById("lastSeen"),
  aliases: document.getElementById("aliases"),
  evidence: document.getElementById("evidence"),
  evidencePreview: document.getElementById("evidencePreview"),
  notes: document.getElementById("notes"),

  btnFetchProfile: document.getElementById("btnFetchProfile"),
  steamProfileInfo: document.getElementById("steamProfileInfo"),
  steamAvatar: document.getElementById("steamAvatar"),
  steamId64Display: document.getElementById("steamId64Display"),
  steamName: document.getElementById("steamName"),
  steamProfileUrl: document.getElementById("steamProfileUrl"),

  banOverlay: document.getElementById("banOverlay"),
  overlayTitle: document.getElementById("overlayTitle"),
  overlayClose: document.getElementById("overlayClose"),
  overlayBody: document.getElementById("overlayBody"),
};

if (!el.btnAdd) {
  alert("Init error: #btnAdd not found in DOM. Make sure you're opening the right index.html.");
}

let currentFiles = [];

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

function removeFile(index) {
  currentFiles.splice(index, 1);
  updateEvidencePreview();
}

function viewDemoInDribble(file) {
// For demo files, we can open them in dribble.tf
if (file.name.toLowerCase().endsWith('.dem')) {
  // Since we can't store the actual file data due to localStorage limits,
  // we'll open dribble.tf and let the user upload the file manually
  alert(`To view this demo file:\n\n1. Open dribble.tf in a new tab\n2. Upload the file "${file.name}" manually\n\nThis is required because demo files are too large to store in browser storage.`);
  window.open('https://dribble.tf/', '_blank');
} else {
  alert('Only .dem files can be viewed in the demo player.');
}
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
  el.steamId64Display.textContent = "";
  el.steamName.textContent = "";
  el.steamProfileUrl.href = "#";
  el.steamProfileUrl.textContent = "";
  
  // Reset files and clear file input
  currentFiles = [];
  updateEvidencePreview();
  el.evidence.value = ''; // Clear the file input
  
  // Reset name field
  el.name.value = "";
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
      alert("Could not fetch Steam profile. Please check:\n\n1. SteamID format (should be STEAM_0:X:Y or 7656... )\n2. Internet connection\n3. Steam API key validity\n\nCheck browser console for details.");
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
              ${isDemoFile ? '📹 Demo File' : '🎬 Video File'}
            </div>
            ${isDemoFile ? `
              <div class="evidence-file-buttons">
                <button class="btn btn--primary btn--small" onclick="viewDemoInDribble(${JSON.stringify(file).replace(/"/g, '&quot;')})">
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
        <div>${escapeHtml(entry.name ?? "")}</div>
        <div class="small">${escapeHtml((entry.aliases ?? []).join(", "))}</div>
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

function handleSteamLogin() {
  // Steam OpenID authentication URL
  const realm = window.location.origin;
  const returnUrl = `${realm}/steam-callback`;
  const steamLoginUrl = `https://steamcommunity.com/openid/login?` +
    `openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select&` +
    `openid.identity=http://specs.openid.net/auth/2.0/identifier_select&` +
    `openid.mode=checkid_setup&` +
    `openid.ns=http://specs.openid.net/auth/2.0&` +
    `openid.realm=${encodeURIComponent(realm)}&` +
    `openid.return_to=${encodeURIComponent(returnUrl)}`;
  
  // For demo purposes, we'll show a message since full OpenID requires server-side handling
  alert("Steam login requires server-side OpenID authentication.\n\nThis would typically:\n1. Redirect to Steam for authentication\n2. Handle the callback on your server\n3. Extract the SteamID64 from the response\n4. Create a session for the user\n\nFor now, you can manually enter your SteamID and use 'Fetch Steam Profile'.");
  
  // In a real implementation, you would redirect:
  // window.location.href = steamLoginUrl;
}

el.btnAdd.addEventListener("click", () => openModal("add"));
el.btnSteamLogin.addEventListener("click", handleSteamLogin);
el.btnFetchProfile.addEventListener("click", handleFetchProfile);

// File input event listener
el.evidence.addEventListener("change", async (ev) => {
  const files = Array.from(ev.target.files);
  // Filter for allowed file types
  const allowedFiles = files.filter(file => {
    const extension = file.name.toLowerCase().split('.').pop();
    return extension === 'mp4' || extension === 'dem';
  });
  
  if (allowedFiles.length !== files.length) {
    alert('Only .mp4 and .dem files are allowed for evidence.');
  }
  
  // Don't read file data to avoid localStorage quota issues
  // Just store the file metadata
  currentFiles = allowedFiles.map(file => ({
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    data: null
  }));
  
  updateEvidencePreview();
});

el.q.addEventListener("input", render);
el.filterVerdict.addEventListener("change", render);
el.sort.addEventListener("change", render);

el.modalClose.addEventListener("click", closeModal);
el.btnCancel.addEventListener("click", closeModal);

el.overlayClose.addEventListener("click", closeBanOverlay);

el.modal.addEventListener("click", (ev) => {
  const t = ev.target;
  if (t?.dataset?.close) closeModal();
});

el.banOverlay.addEventListener("click", (ev) => {
  const t = ev.target;
  if (t?.dataset?.close === "overlay") closeBanOverlay();
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") {
    if (el.modal.getAttribute("aria-hidden") === "false") closeModal();
    if (el.banOverlay.getAttribute("aria-hidden") === "false") closeBanOverlay();
  }
});

el.btnDelete.addEventListener("click", () => {
  const id = normalize(el.id.value);
  if (!id) return;
  if (!confirm("Delete this entry?")) return;
  deleteEntryById(id);
  closeModal();
  render();
});

el.form.addEventListener("submit", async (ev) => {
  ev.preventDefault();

  try {
    const existingId = normalize(el.id.value);
    const entries = await loadEntries();
    const existing = existingId ? entries.find((e) => e.id === existingId) : null;

    const name = normalize(el.name.value);
    if (!name) return;

    const verdict = normalize(el.verdict.value) || "suspected";
    const steamId = normalize(el.steamId.value);
    
    // Fetch Steam profile data if SteamID is provided
    let steamProfile = null;
    if (steamId && !existing?.steamProfile) {
      try {
        steamProfile = await fetchSteamProfile(steamId);
      } catch (error) {
        console.error('Error auto-fetching Steam profile:', error);
      }
    } else if (existing?.steamProfile) {
      steamProfile = existing.steamProfile;
    }

    const entry = {
      id: existing?.id ?? uid(),
      name,
      steamId,
      verdict: ["suspected", "confirmed", "cleared"].includes(verdict) ? verdict : "suspected",
      lastSeen: normalize(el.lastSeen.value),
      aliases: parseAliases(el.aliases.value),
      evidence: parseEvidence(currentFiles),
      notes: normalize(el.notes.value),
      steamProfile,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };

    console.log('Saving entry with evidence:', entry.evidence);
    console.log('Current files:', currentFiles);

    await upsertEntry(entry);
    closeModal();
    await render();
  } catch (error) {
    console.error('Error submitting form:', error);
    alert('Error saving entry: ' + error.message);
  }
});

(function seedIfEmpty() {
  const entries = loadEntries();
  if (entries.length) return;
  const sample = {
    id: uid(),
    name: "Example: Aimbot Scout",
    steamId: "STEAM_0:1:12345678",
    verdict: "suspected",
    lastSeen: "Uncletopia | 2Fort",
    aliases: ["SmoothAim", "noSpread?"] ,
    evidence: [],
    notes: "Add evidence links and notes here.",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  saveEntries([sample]);
})();

// Initialize random logo on page load
initRandomLogo();

render();
