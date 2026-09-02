let PLAYERS = [];

// view = { type: "overall" } | { type: "region", value: "NA" } | { type: "gamemode", value: "vanilla" }
let currentView = { type: "overall" };

async function loadPlayers() {
  const res = await fetch("data/players.json");
  PLAYERS = await res.json();
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
}

function setView(view) {
  currentView = view;

  // Highlight the active tab (Overall or a region), reset the gamemode
  // dropdown whenever a tab is picked instead.
  const gamemodeSelect = document.getElementById("gamemode-select");
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const isActive =
      (view.type === "overall" && btn.textContent === "Overall") ||
      (view.type === "region" && btn.textContent === view.value);
    btn.classList.toggle("active", isActive);
  });

  if (view.type !== "gamemode") {
    gamemodeSelect.selectedIndex = 0;
  }

  render();
}

function render() {
  const title = document.getElementById("view-title");
  let rows, columns;

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
    title.textContent = `${gm.label} Rankings`;
    rows = getGamemodeLeaderboard(PLAYERS, currentView.value);
    columns = "tier";
  }

  renderTable(rows, columns);
}

function renderTable(players, columns) {
  const container = document.getElementById("leaderboard");
  container.innerHTML = "";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>#</th>
      <th>Player</th>
      <th>Region</th>
      <th>${columns === "score" ? "Score" : "Tier"}</th>
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

    tr.innerHTML = `
      <td>${rank}</td>
      <td>${player.name}</td>
      <td>${player.region}</td>
      <td>${value}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  container.appendChild(table);
}

async function init() {
  await loadPlayers();
  buildNav();
  setView({ type: "overall" });
}

init();
