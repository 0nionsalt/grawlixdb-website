const STORAGE_KEY = "tf2CheaterDb.entries.v1";
const STEAM_API_KEY = "697576621005E7075600828CE6273B4F";

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

  // Use local proxy server
  const proxyUrl = `http://localhost:3001/api/steam/ISteamUser/GetPlayerSummaries/v0002/?key=${STEAM_API_KEY}&steamids=${steamId64}`;
  
  try {
    console.log('Using local proxy:', proxyUrl);
    
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
    alert('Failed to fetch Steam profile. Please make sure:\n\n1. The proxy server is running on port 3001\n2. Your Steam API key is valid\n3. The SteamID format is correct\n\nStart the server with: npm start\n\nCheck browser console for more details.');
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
  return normalize(raw)
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
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
    el.evidence.value = (entry.evidence ?? []).join("\n");
    el.notes.value = entry.notes ?? "";
    
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
  el.evidence.value = "";
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
  const sections = [];
  
  sections.push(`
    <div class="ban-detail-section">
      <div class="ban-detail-title">Player Information</div>
      <div class="ban-detail-content">
        <div><strong>Name:</strong> ${escapeHtml(entry.name ?? "")}</div>
        ${entry.steamId ? `<div><strong>SteamID:</strong> ${escapeHtml(entry.steamId)}</div>` : ''}
        <div><strong>Verdict:</strong> <span class="${badgeClass(entry.verdict)}">${entry.verdict ?? "suspected"}</span></div>
        ${entry.aliases?.length ? `<div><strong>Aliases:</strong> ${escapeHtml(entry.aliases.join(", "))}</div>` : ''}
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
        <div class="community-bans-alert community-bans-alert--warning">
          <div class="community-bans-alert__icon">⚠️</div>
          <div class="community-bans-alert__text">Possible Cheater Keywords: cheat</div>
        </div>
        <div class="community-bans-alert community-bans-alert--info">
          <div class="community-bans-alert__icon">ℹ️</div>
          <div class="community-bans-alert__text">Group membership bans are not direct evidence of cheating, but rather a community stance.</div>
        </div>
        
        <div class="community-bans-categories">
          <div class="community-bans-category">
            <div class="community-bans-category__header">
              <h4>TF2BD</h4>
            </div>
            <div class="community-bans-category__content">
              <div class="community-ban-entry">
                <div class="community-ban-entry__info">
                  <div class="community-ban-entry__name">Vorobey-HackerPolice</div>
                  <div class="community-ban-entry__details">1 proof entry attached</div>
                </div>
                <div class="community-ban-entry__status">
                  <span class="community-ban-tag community-ban-tag--cheater">Cheater</span>
                  <div class="community-ban-entry__time">8 months ago</div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="community-bans-category">
            <div class="community-bans-category__header">
              <h4>SourceBans</h4>
            </div>
            <div class="community-bans-category__content">
              <div class="community-ban-entry">
                <div class="community-ban-entry__info">
                  <div class="community-ban-entry__name">LazyPurple.com</div>
                  <div class="community-ban-entry__details">1 ban</div>
                </div>
                <div class="community-ban-entry__status">
                  <span class="community-ban-tag community-ban-tag--permanent">Permanent</span>
                  <div class="community-ban-entry__time">9 months ago</div>
                </div>
              </div>
              <div class="community-ban-entry">
                <div class="community-ban-entry__info">
                  <div class="community-ban-entry__name">dpg.tf</div>
                  <div class="community-ban-entry__details">1 ban</div>
                </div>
                <div class="community-ban-entry__status">
                  <span class="community-ban-tag community-ban-tag--permanent">Permanent</span>
                  <div class="community-ban-entry__time">16 years ago</div>
                </div>
              </div>
              <div class="community-ban-entry">
                <div class="community-ban-entry__info">
                  <div class="community-ban-entry__name">UGC-Gaming</div>
                  <div class="community-ban-entry__details">1 ban</div>
                </div>
                <div class="community-ban-entry__status">
                  <span class="community-ban-tag community-ban-tag--permanent">Permanent</span>
                  <div class="community-ban-entry__time">9 months ago</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);
  
  if (entry.evidence?.length) {
    const evidenceLinks = entry.evidence.map(url => 
      `<li><a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></li>`
    ).join('');
    
    sections.push(`
      <div class="ban-detail-section">
        <div class="ban-detail-title">Evidence</div>
        <div class="ban-detail-content">
          <ul class="evidence-list">
            ${evidenceLinks}
          </ul>
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
      evidence: parseEvidence(el.evidence.value).map(safeUrl).filter(Boolean),
      notes: normalize(el.notes.value),
      steamProfile,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
    };

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

render();
