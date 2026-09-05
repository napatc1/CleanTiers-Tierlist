let PLAYERS = [];

// view = { type: "overall" } | { type: "gamemode", value: "vanilla" } | { type: "player", value: "Frostbyte" }
// Region and tier are independent multi-select filters layered on top of
// whichever view is active, not separate views themselves.
let currentView = { type: "overall" };
let previousListView = { type: "overall" }; // remembered so the profile's Back button returns here
let searchQuery = "";
let selectedRegions = new Set(); // empty = no filter, show every region
let selectedTiers = new Set(); // empty = no filter, show every tier

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

// Builds a checkbox-style dropdown menu. onToggle(value, nowChecked) fires
// per click; the caller decides how that affects filtering/rendering.
function buildCheckboxMenu(menuEl, options, selectedSet, onToggle) {
  menuEl.innerHTML = "";
  options.forEach(({ value, label }) => {
    const item = document.createElement("label");
    item.className = "custom-select-checkbox-item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = selectedSet.has(value);
    checkbox.onchange = () => onToggle(value, checkbox.checked);
    item.appendChild(checkbox);
    item.appendChild(document.createTextNode(label));
    menuEl.appendChild(item);
  });
}

function updateFilterTriggerLabel(triggerId, baseLabel, selectedSet) {
  const trigger = document.getElementById(triggerId);
  const text = selectedSet.size > 0 ? `${baseLabel} (${selectedSet.size})` : baseLabel;
  trigger.innerHTML = `${text} <span class="custom-select-arrow"></span>`;
}

function buildNav() {
  const nav = document.getElementById("nav-tabs");
  nav.innerHTML = "";

  // Overall tab (the only fixed nav tab now — region/tier are filters, and
  // a gamemode is picked from its own dropdown below).
  const overallBtn = document.createElement("button");
  overallBtn.textContent = "Overall";
  overallBtn.className = "tab-btn active";
  overallBtn.onclick = () => setView({ type: "overall" });
  nav.appendChild(overallBtn);

  // Generic open/close wiring shared by all three dropdowns.
  function wireDropdown(dropdownId, triggerId) {
    const dropdown = document.getElementById(dropdownId);
    const trigger = document.getElementById(triggerId);
    trigger.onclick = (e) => {
      e.stopPropagation();
      const wasOpen = dropdown.classList.contains("open");
      document.querySelectorAll(".custom-select.open").forEach((d) => d.classList.remove("open"));
      if (!wasOpen) dropdown.classList.add("open");
    };
  }
  document.addEventListener("click", () => {
    document.querySelectorAll(".custom-select.open").forEach((d) => d.classList.remove("open"));
  });

  // Region filter (multi-select checkboxes)
  wireDropdown("region-dropdown", "region-trigger");
  buildCheckboxMenu(
    document.getElementById("region-menu"),
    REGIONS.map((r) => ({ value: r, label: r })),
    selectedRegions,
    (value, checked) => {
      if (checked) selectedRegions.add(value);
      else selectedRegions.delete(value);
      updateFilterTriggerLabel("region-trigger", "Region", selectedRegions);
      render();
    }
  );
  updateFilterTriggerLabel("region-trigger", "Region", selectedRegions);

  // Tier filter (multi-select checkboxes)
  wireDropdown("tier-dropdown", "tier-trigger");
  buildCheckboxMenu(
    document.getElementById("tier-menu"),
    TIER_ORDER.map((t) => ({ value: t, label: t })),
    selectedTiers,
    (value, checked) => {
      if (checked) selectedTiers.add(value);
      else selectedTiers.delete(value);
      updateFilterTriggerLabel("tier-trigger", "Tier", selectedTiers);
      render();
    }
  );
  updateFilterTriggerLabel("tier-trigger", "Tier", selectedTiers);

  // Gamemode dropdown (single-select — switches the view, not a filter)
  wireDropdown("gamemode-dropdown", "gamemode-trigger");
  const gamemodeDropdown = document.getElementById("gamemode-dropdown");
  const gamemodeMenu = document.getElementById("gamemode-menu");
  gamemodeMenu.innerHTML = "";
  GAMEMODES.forEach((gm) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "custom-select-item";
    item.textContent = gm.label;
    item.dataset.gamemode = gm.id;
    item.onclick = () => {
      gamemodeDropdown.classList.remove("open");
      setView({ type: "gamemode", value: gm.id });
    };
    gamemodeMenu.appendChild(item);
  });

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

  // Highlight Overall vs a gamemode. Skipped on the profile view, which
  // isn't one of the nav tabs.
  const gamemodeTrigger = document.getElementById("gamemode-trigger");
  if (view.type !== "player") {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", view.type === "overall" && btn.textContent === "Overall");
    });

    document.querySelectorAll("#gamemode-menu .custom-select-item").forEach((item) => {
      item.classList.toggle("active", view.type === "gamemode" && item.dataset.gamemode === view.value);
    });

    if (view.type === "gamemode") {
      const gm = GAMEMODES.find((g) => g.id === view.value);
      gamemodeTrigger.innerHTML = `${gm.label} <span class="custom-select-arrow"></span>`;
    } else {
      gamemodeTrigger.innerHTML = `Gamemode <span class="custom-select-arrow"></span>`;
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
  } else {
    const gm = GAMEMODES.find((g) => g.id === currentView.value);
    title.innerHTML = gm.icon
      ? `<img src="${gm.icon}" alt="" class="title-icon" /> ${gm.label} Rankings`
      : `${gm.label} Rankings`;
    rows = getGamemodeLeaderboard(PLAYERS, currentView.value);
    columns = "tier";
  }

  if (selectedRegions.size > 0) {
    rows = rows.filter((p) => selectedRegions.has(p.region));
  }

  if (selectedTiers.size > 0) {
    rows = rows.filter((p) =>
      currentView.type === "gamemode"
        ? selectedTiers.has(p.tiers[currentView.value])
        : Object.values(p.tiers).some((t) => selectedTiers.has(t))
    );
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
              <div class="mini-tier-item" title="${gm.label}: ${tier}">
                <span class="mini-tier-badge">
                  ${gm.icon ? `<img src="${gm.icon}" alt="" class="mini-tier-icon" />` : ""}
                </span>
                <span class="mini-tier-label" style="color:${tierColor(tier)}">${tier}</span>
              </div>
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
  const player = PLAYERS.find(
    (p) => p.name.toLowerCase() === playerName.toLowerCase()
  );
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
