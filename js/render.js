let PLAYERS = [];

// view = { type: "overall" } | { type: "region", value: "NA" } | { type: "gamemode", value: "vanilla" } | { type: "player", value: "Frostbyte" }
let currentView = { type: "overall" };
let previousListView = { type: "overall" }; // remembered so the profile's Back button returns here
let searchQuery = "";

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function headUrl(name, size) {
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/${size}`;
}

// Firebase Realtime Database REST endpoint. Public reads only — writes
// happen exclusively through the Discord bot's service account.
const FIREBASE_URL = "https://cleantiers-default-rtdb.asia-southeast1.firebasedatabase.app";

async function loadPlayers() {
  const res = await fetch(`${FIREBASE_URL}/players.json`);
  const data = await res.json();
  // Firebase stores players as an object keyed by name, not an array.
  PLAYERS = data ? Object.values(data) : [];
}

function buildNav() {
  const nav = document.getElementById("nav-tabs");
  const gamemodeSelect = document.getElementById("gamemode-select");
  nav.innerHTML = "";
  gamemodeSelect.innerHTML = "";

  // Overall tab (the landing view: every region combined)
  const overallBtn = document.createElement("button");
  overallBtn.textContent = "Overall";
  overallBtn.className = "tab-btn";
  overallBtn.onclick = () => setView({ type: "overall" });
  nav.appendChild(overallBtn);

  // One tab per region, fixed order: NA, EU, AS, ME, AU
  REGIONS.forEach((region) => {
    const btn = document.createElement("button");
    btn.textContent = region;
    btn.className = "tab-btn";
    btn.onclick = () => setView({ type: "region", value: region });
    nav.appendChild(btn);
  });

  // Gamemode dropdown
  const gmPlaceholder = document.createElement("option");
  gmPlaceholder.textContent = "Gamemode \u2193";
  gmPlaceholder.disabled = true;
  gmPlaceholder.selected = true;
  gamemodeSelect.appendChild(gmPlaceholder);
  GAMEMODES.forEach((gm) => {
    const opt = document.createElement("option");
    opt.value = gm.id;
    opt.textContent = gm.label;
    gamemodeSelect.appendChild(opt);
  });
  gamemodeSelect.onchange = () =>
    setView({ type: "gamemode", value: gamemodeSelect.value });

  // Search box: filters whatever view is currently showing, doesn't change it
  const searchInput = document.getElementById("search-input");
  searchInput.value = "";
  searchInput.oninput = () => {
    searchQuery = searchInput.value.trim().toLowerCase();
    render();
  };
}

function setView(view) {
  if (view.type !== "player") {
    previousListView = view;
  }
  currentView = view;

  // Highlight the active tab (Overall or a region), reset the gamemode
  // dropdown whenever a tab is picked instead. Skipped on the profile view,
  // which isn't one of the nav tabs.
  const gamemodeSelect = document.getElementById("gamemode-select");
  if (view.type !== "player") {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      const isActive =
        (view.type === "overall" && btn.textContent === "Overall") ||
        (view.type === "region" && btn.textContent === view.value);
      btn.classList.toggle("active", isActive);
    });

    if (view.type !== "gamemode") {
      gamemodeSelect.selectedIndex = 0;
    }
  }

  render();
}

function render() {
  const title = document.getElementById("view-title");
  let rows, columns;

  if (currentView.type === "player") {
    renderProfile(currentView.value);
    return;
  }

  if (currentView.type === "overall") {
    title.textContent = "Overall Rankings";
    rows = getOverallLeaderboard(PLAYERS);
    columns = "score";
  } else if (currentView.type === "region") {
    title.textContent = `${currentView.value} Rankings`;
    rows = getRegionLeaderboard(PLAYERS, currentView.value);
    columns = "score";
  } else {
    const gm = GAMEMODES.find((g) => g.id === currentView.value);
    title.innerHTML = gm.icon
      ? `<img src="${gm.icon}" alt="" class="title-icon" /> ${gm.label} Rankings`
      : `${gm.label} Rankings`;
    rows = getGamemodeLeaderboard(PLAYERS, currentView.value);
    columns = "tier";
  }

  if (searchQuery) {
    rows = rows.filter((p) => p.name.toLowerCase().includes(searchQuery));
  }

  renderTable(rows, columns);
}

function renderTable(players, columns) {
  const container = document.getElementById("leaderboard");
  container.innerHTML = "";

  const title = document.getElementById("view-title");
  title.classList.remove("profile-mode");

  const showTiers = columns === "score";

  const table = document.createElement("table");
  if (showTiers) table.classList.add("with-tiers");
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>#</th>
      <th>Player</th>
      <th>Region</th>
      <th>${columns === "score" ? "Score" : "Tier"}</th>
      ${showTiers ? "<th>Tiers</th>" : ""}
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  players.forEach((player, i) => {
    const rank = i + 1;
    const tr = document.createElement("tr");
    if (rank <= 3) tr.classList.add(`rank-${rank}`);

    const value =
      columns === "score"
        ? overallScore(player)
        : player.tiers[currentView.value];

    const safeName = escapeHtml(player.name);

    const tierBadges = showTiers
      ? GAMEMODES.filter((gm) => player.tiers[gm.id])
          .map((gm) => {
            const tier = player.tiers[gm.id];
            return `
              <span class="mini-tier-badge" title="${gm.label}: ${tier}">
                ${gm.icon ? `<img src="${gm.icon}" alt="" class="mini-tier-icon" />` : ""}
              </span>
            `;
          })
          .join("")
      : "";

    tr.innerHTML = `
      <td>${rank}</td>
      <td>
        <button class="player-link" data-player="${safeName}">
          <img src="${headUrl(player.name, 24)}" alt="" class="player-head" loading="lazy" />
          <span>${safeName}</span>
        </button>
      </td>
      <td>${player.region}</td>
      <td>${value}</td>
      ${showTiers ? `<td><div class="mini-tier-row">${tierBadges}</div></td>` : ""}
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  container.appendChild(table);

  container.querySelectorAll(".player-link").forEach((btn) => {
    btn.onclick = () => setView({ type: "player", value: btn.dataset.player });
  });
}

// Warm colors for HT tiers (rank 1 = brightest gold), cool colors for LT
// tiers (rank 1 = brightest cyan), getting duller as the tier drops.
function tierColor(tier) {
  const isHT = tier.startsWith("HT");
  const rank = parseInt(tier.slice(2), 10) - 1; // 0-4
  const warm = ["#ffd700", "#ffb84d", "#ff9800", "#ff7043", "#e64a19"];
  const cool = ["#4fc3f7", "#42a5f5", "#5c6bc0", "#7e57c2", "#8e24aa"];
  return (isHT ? warm : cool)[rank] || "#999";
}

function renderProfile(playerName) {
  const player = PLAYERS.find((p) => p.name === playerName);
  const container = document.getElementById("leaderboard");
  const title = document.getElementById("view-title");
  title.classList.add("profile-mode");
  title.innerHTML = `<button id="back-btn" class="back-btn">&larr; Back</button>`;
  document.getElementById("back-btn").onclick = () => setView(previousListView);

  if (!player) {
    container.innerHTML = `<p class="empty-state">Player not found.</p>`;
    return;
  }

  const score = overallScore(player);
  const tierIcons = GAMEMODES.filter((gm) => player.tiers[gm.id])
    .map((gm) => {
      const tier = player.tiers[gm.id];
      return `
        <div class="profile-tier-item" title="${gm.label}">
          <div class="profile-tier-icon-box">
            ${gm.icon ? `<img src="${gm.icon}" alt="${gm.label}" class="gamemode-icon" />` : ""}
          </div>
          <span class="profile-tier-label" style="color:${tierColor(tier)}">${tier}</span>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="profile-card">
      <img src="${headUrl(player.name, 96)}" alt="" class="profile-head" />
      <div class="profile-info">
        <h2 class="profile-name">${escapeHtml(player.name)}</h2>
        <div class="profile-meta">
          <span class="profile-score">${score} overall</span>
        </div>
      </div>
    </div>
    <div class="profile-details">
      <div class="profile-detail-col">
        <div class="detail-label">Region</div>
        <div class="profile-region-badge">${player.region}</div>
      </div>
      <div class="profile-detail-col profile-detail-col-grow">
        <div class="detail-label">Tiers</div>
        <div class="profile-tier-icons">
          ${tierIcons || `<p class="empty-state">No tiers recorded yet.</p>`}
        </div>
      </div>
    </div>
  `;
}

async function init() {
  await loadPlayers();
  buildNav();
  setView({ type: "overall" });
}

init();
