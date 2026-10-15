(function() {
  "use strict";

  const EXTENSION_ID = "fightcade-stats-extension";
  const BUTTON_HOST_ID = `${EXTENSION_ID}-button-host`;
  const PANEL_ID = `${EXTENSION_ID}-panel`;
  const PROFILE_REGEX = /\/id\/([^/?#]+)/i;
  const MAX_PAGES = 100;
  const PAGE_WAIT = 600;

  let currentStats = null;
  let analyzing = false;
  let analysisCancelled = false;
  let analysisToken = 0;

  const normalize = (value) =>
    String(value || "").replace(/\s+/g, " ").trim();

  const userKey = (value) =>
    normalize(value).replace(/^@/, "").toLowerCase();

  const wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("es-AR");
  }

  function formatPercent(value) {
    return `${Number(value || 0).toFixed(2)}%`;
  }

  function parseNumber(value) {
    const match = normalize(value).match(/^\d+$/);
    return match ? Number(match[0]) : null;
  }

  function getProfileUsername() {
    const match = window.location.pathname.match(PROFILE_REGEX);

    return match
      ? decodeURIComponent(match[1])
      : null;
  }

  function getRows() {
    return Array.from(document.querySelectorAll("table tr")).filter(
      (row) => {
        const text = normalize(row.innerText);

        return (
          text &&
          !/^date\s+game/i.test(text) &&
          !/^fecha\s+juego/i.test(text)
        );
      }
    );
  }

  function getCells(row) {
    return Array.from(row.querySelectorAll("td, th"))
      .map((cell) => normalize(cell.innerText))
      .filter(Boolean);
  }

  function getFormatIndex(cells) {
    return cells.findIndex((cell) => /^FT\d+$/i.test(cell));
  }

  function getScores(cells, formatIndex) {
    if (formatIndex < 0) {
      return null;
    }

    let leftScore = null;
    let rightScore = null;
    let leftIndex = -1;
    let rightIndex = -1;

    for (let index = formatIndex - 1; index >= 0; index--) {
      const value = parseNumber(cells[index]);

      if (value !== null) {
        leftScore = value;
        leftIndex = index;
        break;
      }
    }

    for (let index = formatIndex + 1; index < cells.length; index++) {
      const value = parseNumber(cells[index]);

      if (value !== null) {
        rightScore = value;
        rightIndex = index;
        break;
      }
    }

    if (
      leftScore === null ||
      rightScore === null ||
      leftIndex < 0 ||
      rightIndex < 0
    ) {
      return null;
    }

    return {
      leftScore,
      rightScore,
      leftIndex,
      rightIndex
    };
  }

  function rankNameFromNumber(value) {
    const ranks = {
      0: "Sin rango",
      1: "E",
      2: "D",
      3: "C",
      4: "B",
      5: "A",
      6: "S"
    };

    return ranks[Number(value)] || "Sin rango";
  }

  function getRankFromCell(cell) {
    const image = cell?.querySelector("img.rank");

    if (!image) {
      return "Sin rango";
    }

    const source =
      image.getAttribute("src") ||
      image.getAttribute("data-src") ||
      "";

    const match = source.match(/rank(\d+)\.png/i);

    return match
      ? rankNameFromNumber(match[1])
      : "Sin rango";
  }

  function getPlayers(row, cells, scores) {
    const links = Array.from(row.querySelectorAll("a"))
      .map((anchor) => ({
        name: normalize(anchor.innerText),
        href: anchor.getAttribute("href") || "",
        element: anchor
      }))
      .filter((item) => {
        return item.name && /\/id\//i.test(item.href);
      });

    if (links.length >= 2) {
      return {
        left: links[0].name,
        right: links[1].name,
        leftRank: getRankFromCell(
          links[0].element.closest("td")
        ),
        rightRank: getRankFromCell(
          links[1].element.closest("td")
        )
      };
    }

    const isFlag = (value) =>
      /^[A-Z]{2}$/i.test(normalize(value));

    const leftCandidates = cells
      .slice(0, scores.leftIndex)
      .filter((value) => {
        return (
          parseNumber(value) === null &&
          !/^FT\d+$/i.test(value) &&
          !isFlag(value) &&
          !/^\d{1,2}:\d{2}:\d{2}$/.test(value)
        );
      });

    const rightCandidates = cells
      .slice(scores.rightIndex + 1)
      .filter((value) => {
        return (
          parseNumber(value) === null &&
          !/^FT\d+$/i.test(value) &&
          !isFlag(value) &&
          !/^\d{1,2}:\d{2}:\d{2}$/.test(value) &&
          !/view replay/i.test(value)
        );
      });

    return {
      left: leftCandidates[leftCandidates.length - 1] || "",
      right: rightCandidates[0] || "",
      leftRank: "Sin rango",
      rightRank: "Sin rango"
    };
  }

  function getDate(cells) {
    return (
      cells.find((cell) =>
        /\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/.test(cell)
      ) || ""
    );
  }

  function getDuration(cells) {
    return (
      cells.find((cell) =>
        /^\d{1,2}:\d{2}:\d{2}$/.test(cell)
      ) || ""
    );
  }

  function getGame(cells) {
    const excluded = [
      /^FT\d+$/i,
      /view replay/i,
      /^\d+$/,
      /^\d{1,2}:\d{2}:\d{2}$/,
      /^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}/,
      /^[A-Z]{2}$/i
    ];

    return (
      cells.find((cell) => {
        return (
          /[a-z0-9]/i.test(cell) &&
          !excluded.some((pattern) => pattern.test(cell))
        );
      }) || "Desconocido"
    );
  }

  function parseRow(row) {
    const cells = getCells(row);
    const formatIndex = getFormatIndex(cells);
    const scores = getScores(cells, formatIndex);

    if (!scores) {
      return null;
    }

    const players = getPlayers(row, cells, scores);

    if (
      !players.left ||
      !players.right ||
      userKey(players.left) === userKey(players.right)
    ) {
      return null;
    }

    const date = getDate(cells);
    const game = getGame(cells);

    return {
      id: [
        date,
        game,
        players.left,
        scores.leftScore,
        scores.rightScore,
        players.right
      ].join("|"),

      date,
      game,
      format: cells[formatIndex] || "",

      leftPlayer: players.left,
      leftRank: players.leftRank || "Sin rango",
      leftScore: scores.leftScore,

      rightPlayer: players.right,
      rightRank: players.rightRank || "Sin rango",
      rightScore: scores.rightScore,

      duration: getDuration(cells)
    };
  }

  function parseCurrentPage() {
    return getRows().map(parseRow).filter(Boolean);
  }

  function getPageSignature(rows) {
    return rows.map((row) => row.id).join("||");
  }

  function parseDate(value) {
    const match = normalize(value).match(
      /(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:,?\s+(\d{1,2}):(\d{2}):(\d{2}))?/
    );

    if (!match) {
      return 0;
    }

    const [
      ,
      day,
      month,
      year,
      hours = "0",
      minutes = "0",
      seconds = "0"
    ] = match;

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds)
    ).getTime();
  }

  function isVisible(element) {
    const style = window.getComputedStyle(element);

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0"
    );
  }

  function isDisabled(element) {
    const classes = String(element.className || "").toLowerCase();

    return Boolean(
      element.disabled ||
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true" ||
        classes.includes("disabled") ||
        classes.includes("is-disabled")
    );
  }

  function getLabel(element) {
    return normalize(
      element.innerText ||
        element.textContent ||
        element.getAttribute("aria-label") ||
        element.getAttribute("title") ||
        element.value
    ).toLowerCase();
  }

  function getPaginationElements() {
    let elements = Array.from(
      document.querySelectorAll(
        "nav button, nav a, " +
          ".pagination button, .pagination a, " +
          "[class*='pagination'] button, " +
          "[class*='pagination'] a, " +
          "[class*='pager'] button, " +
          "[class*='pager'] a"
      )
    );

    if (!elements.length) {
      elements = Array.from(
        document.querySelectorAll(
          "button, a, [role='button'], input[type='button']"
        )
      );
    }

    return elements.filter((element) => {
      return (
        isVisible(element) &&
        !isDisabled(element) &&
        element.id !== BUTTON_HOST_ID
      );
    });
  }

  function getFirstPageButton() {
    const elements = getPaginationElements();

    return (
      elements.find((element) => {
        const value = getLabel(element);

        return (
          value === "first" ||
          value === "primera" ||
          value === "<<" ||
          value === "«" ||
          value.includes("first") ||
          value.includes("primera")
        );
      }) ||
      elements.find((element) => getLabel(element) === "1") ||
      null
    );
  }

  function getNextPageButton() {
    return (
      getPaginationElements().find((element) => {
        const value = getLabel(element);
        const classes = String(element.className || "").toLowerCase();

        return (
          value === ">" ||
          value === "›" ||
          value === "→" ||
          value.includes("next") ||
          value.includes("siguiente") ||
          classes.includes("next")
        );
      }) || null
    );
  }

  function isCancelled(token) {
    return (
      analysisCancelled ||
      token !== analysisToken
    );
  }

  function stopAnalysis() {
    if (!analyzing) {
      return;
    }

    analysisCancelled = true;
    analysisToken++;

    const panel = document.getElementById(PANEL_ID);

    if (panel) {
      const progress = panel.querySelector(
        ".fc-stats-progress"
      );

      if (progress) {
        progress.textContent =
          "Análisis detenido por el usuario.";
      }

      const stopButton = panel.querySelector(
        '[data-action="stop"]'
      );

      if (stopButton) {
        stopButton.disabled = true;
        stopButton.textContent = "Análisis detenido";
      }
    }

    analyzing = false;
  }

  function setAnalyzingState(panel, active) {
    const stopButton = panel.querySelector(
      '[data-action="stop"]'
    );

    if (!stopButton) {
      return;
    }

    stopButton.hidden = !active;
    stopButton.disabled = !active;
    stopButton.textContent = "Detener análisis";
  }

  async function goToFirstPage(updateProgress, token) {
    if (isCancelled(token)) {
      return;
    }

    const button = getFirstPageButton();

    if (!button) {
      return;
    }

    const label = getLabel(button);

    if (
      label === "1" ||
      label === "first" ||
      label === "primera"
    ) {
      return;
    }

    const before = getPageSignature(
      parseCurrentPage()
    );

    updateProgress("Volviendo a la primera página...");

    button.scrollIntoView({
      behavior: "instant",
      block: "center"
    });

    button.click();

    for (let attempt = 0; attempt < 25; attempt++) {
      if (isCancelled(token)) {
        return;
      }

      await wait(PAGE_WAIT);

      const after = getPageSignature(
        parseCurrentPage()
      );

      if (after && after !== before) {
        return;
      }
    }
  }

  async function collectAllRows(updateProgress, token) {
    const result = new Map();
    const visited = new Set();

    await goToFirstPage(updateProgress, token);

    if (isCancelled(token)) {
      return [];
    }

    for (
      let page = 1;
      page <= MAX_PAGES;
      page++
    ) {
      if (isCancelled(token)) {
        return [];
      }

      const rows = parseCurrentPage();
      const signature = getPageSignature(rows);

      if (!signature || visited.has(signature)) {
        break;
      }

      visited.add(signature);

      rows.forEach((row) => {
        result.set(row.id, row);
      });

      updateProgress(
        `Analizando página ${page}... ` +
          `${result.size} sets encontrados`
      );

      const nextButton = getNextPageButton();

      if (!nextButton) {
        break;
      }

      nextButton.scrollIntoView({
        behavior: "instant",
        block: "center"
      });

      nextButton.click();

      let changed = false;

      for (let attempt = 0; attempt < 20; attempt++) {
        if (isCancelled(token)) {
          return [];
        }

        await wait(PAGE_WAIT);

        const nextSignature = getPageSignature(
          parseCurrentPage()
        );

        if (
          nextSignature &&
          nextSignature !== signature
        ) {
          changed = true;
          break;
        }
      }

      if (!changed) {
        break;
      }
    }

    updateProgress(
      `Análisis completo: ${result.size} sets encontrados`
    );

    return Array.from(result.values());
  }

  function addPercentages(stats) {
    return {
      ...stats,

      setWinRate: stats.setsPlayed
        ? Number(
            (
              (stats.setsWon / stats.setsPlayed) *
              100
            ).toFixed(2)
          )
        : 0,

      roundWinRate: stats.roundsPlayed
        ? Number(
            (
              (stats.roundsWon / stats.roundsPlayed) *
              100
            ).toFixed(2)
          )
        : 0
    };
  }

  function calculateStats(rows, playerName) {
    const playerKey = userKey(playerName);

    const opponents = new Map();
    const games = new Map();
    const ranks = new Map();
    const history = [];

    let setsWon = 0;
    let setsLost = 0;
    let roundsWon = 0;
    let roundsLost = 0;

    rows.forEach((row) => {
      const leftIsPlayer =
        userKey(row.leftPlayer) === playerKey;

      const rightIsPlayer =
        userKey(row.rightPlayer) === playerKey;

      if (!leftIsPlayer && !rightIsPlayer) {
        return;
      }

      const player = leftIsPlayer
        ? row.leftPlayer
        : row.rightPlayer;

      const opponent = leftIsPlayer
        ? row.rightPlayer
        : row.leftPlayer;

      const playerRank = leftIsPlayer
        ? row.leftRank || "Sin rango"
        : row.rightRank || "Sin rango";

      const opponentRank = leftIsPlayer
        ? row.rightRank || "Sin rango"
        : row.leftRank || "Sin rango";

      const playerScore = leftIsPlayer
        ? row.leftScore
        : row.rightScore;

      const opponentScore = leftIsPlayer
        ? row.rightScore
        : row.leftScore;

      const isDraw = playerScore === opponentScore;
      const wonSet =
        !isDraw && playerScore > opponentScore;

      const result = isDraw
        ? "Empate"
        : wonSet
          ? "Victoria"
          : "Derrota";

      if (!ranks.has(opponentRank)) {
        ranks.set(opponentRank, {
          rank: opponentRank,
          setsPlayed: 0,
          setsWon: 0,
          setsLost: 0,
          roundsPlayed: 0,
          roundsWon: 0,
          roundsLost: 0
        });
      }

      const rankStats = ranks.get(opponentRank);

      if (!isDraw) {
        rankStats.setsPlayed++;
        rankStats.setsWon += wonSet ? 1 : 0;
        rankStats.setsLost += wonSet ? 0 : 1;

        if (wonSet) {
          setsWon++;
        } else {
          setsLost++;
        }

        roundsWon += playerScore;
        roundsLost += opponentScore;

        const opponentKey = userKey(opponent);

        if (!opponents.has(opponentKey)) {
          opponents.set(opponentKey, {
            player: opponent,
            setsPlayed: 0,
            setsWon: 0,
            setsLost: 0,
            roundsPlayed: 0,
            roundsWon: 0,
            roundsLost: 0,
            lastResult: ""
          });
        }

        const opponentStats = opponents.get(opponentKey);

        opponentStats.setsPlayed++;
        opponentStats.setsWon += wonSet ? 1 : 0;
        opponentStats.setsLost += wonSet ? 0 : 1;
        opponentStats.roundsPlayed +=
          playerScore + opponentScore;
        opponentStats.roundsWon += playerScore;
        opponentStats.roundsLost += opponentScore;

        if (
          opponentStats.setsWon >
          opponentStats.setsLost
        ) {
          opponentStats.lastResult = "Victoria";
        } else if (
          opponentStats.setsLost >
          opponentStats.setsWon
        ) {
          opponentStats.lastResult = "Derrota";
        } else {
          opponentStats.lastResult = "Empate";
        }

        const gameKey = row.game || "Desconocido";

        if (!games.has(gameKey)) {
          games.set(gameKey, {
            game: gameKey,
            setsPlayed: 0,
            setsWon: 0,
            setsLost: 0,
            roundsPlayed: 0,
            roundsWon: 0,
            roundsLost: 0
          });
        }

        const gameStats = games.get(gameKey);

        gameStats.setsPlayed++;
        gameStats.setsWon += wonSet ? 1 : 0;
        gameStats.setsLost += wonSet ? 0 : 1;
        gameStats.roundsPlayed +=
          playerScore + opponentScore;
        gameStats.roundsWon += playerScore;
        gameStats.roundsLost += opponentScore;
      }

      history.push({
        ...row,
        player,
        opponent,
        playerRank,
        opponentRank,
        playerScore,
        opponentScore,
        isDraw,
        wonSet,
        result
      });
    });

    history.sort((a, b) => {
      return (
        parseDate(b.date) -
        parseDate(a.date) ||
        a.id.localeCompare(b.id)
      );
    });

    const opponentList = Array.from(
      opponents.values()
    )
      .map(addPercentages)
      .sort((a, b) => {
        return (
          b.setsPlayed - a.setsPlayed ||
          b.roundsPlayed - a.roundsPlayed
        );
      });

    const gameList = Array.from(games.values())
      .map(addPercentages)
      .sort((a, b) => {
        return b.setsPlayed - a.setsPlayed;
      });

    const rankOrder = [
      "S",
      "A",
      "B",
      "C",
      "D",
      "E",
      "Sin rango"
    ];

    const rankList = Array.from(ranks.values())
      .map(addPercentages)
      .sort((a, b) => {
        const indexA = rankOrder.indexOf(a.rank);
        const indexB = rankOrder.indexOf(b.rank);

        return (
          (indexA < 0 ? 999 : indexA) -
          (indexB < 0 ? 999 : indexB)
        );
      });

    return addPercentages({
      player: playerName,
      setsPlayed: setsWon + setsLost,
      setsWon,
      setsLost,
      roundsPlayed: roundsWon + roundsLost,
      roundsWon,
      roundsLost,
      rows: history,
      opponents: opponentList,
      games: gameList,
      ranks: rankList,
      generatedAt: new Date().toISOString()
    });
  }

  // --- Elo calculation helpers (new) ---
  const RANK_TO_ELO = {
    E: 550,
    D: 850,
    C: 1150,
    B: 1450,
    A: 1750,
    S: 2000,
    "Sin rango": null
  };

  function rankToElo(rank) {
    if (!rank) return null;
    return RANK_TO_ELO[rank] ?? null;
  }

  function getKFactorElo(elo, gamesPlayed) {
    if (gamesPlayed < 10) return 20;
    if (elo < 700) return 34;
    if (elo < 1000) return 32;
    if (elo < 1300) return 30;
    if (elo < 1600) return 28;
    if (elo < 1900) return 26;
    return 24;
  }

  function expectedScore(yourElo, oppElo) {
    return 1 / (1 + Math.pow(10, (oppElo - yourElo) / 400));
  }

  function applyEloSingle(yourElo, oppElo, score, gamesPlayed) {
    const K = getKFactorElo(yourElo, gamesPlayed);
    const exp = expectedScore(yourElo, oppElo);
    const delta = K * (score - exp);
    return {
      newElo: Math.round(yourElo + delta),
      delta: Math.round(delta * 100) / 100,
      K,
      expected: Math.round(exp * 10000) / 10000
    };
  }

  function computeEloFromStats(stats) {
    const rowsChrono = (stats.rows || []).slice().reverse(); // oldest -> newest

    const state = {
      elo: 1000,
      gamesPlayed: 0,
      matches: []
    };

    rowsChrono.forEach((row) => {
      if (row.isDraw) return; // skip draws for Elo adjustments

      const score = row.wonSet ? 1 : 0;
      let oppElo = rankToElo(row.opponentRank);

      if (oppElo === null || oppElo === undefined) {
        // If opponent rank unknown, assume opponent at current player's Elo
        oppElo = state.elo;
      }

      const res = applyEloSingle(state.elo, oppElo, score, state.gamesPlayed);

      state.matches.push({
        date: row.date,
        opponent: row.opponent,
        opponentRank: row.opponentRank,
        opponentElo: oppElo,
        score,
        delta: res.delta,
        eloBefore: state.elo,
        eloAfter: res.newElo
      });

      state.elo = res.newElo;
      state.gamesPlayed += 1;
    });

    return state;
  }
  // --- end Elo helpers ---

  function getSortValue(cell) {
    const raw = normalize(cell?.innerText);

    const date = parseDate(raw);

    if (date > 0) {
      return {
        type: "number",
        value: date
      };
    }

    if (/^-?\d+([.,]\d+)?%?$/.test(raw)) {
      return {
        type: "number",
        value: Number(
          raw.replace("%", "").replace(",", ".")
        )
      };
    }

    const score = raw.match(/^(\d+)\s*-\s*(\d+)$/);

    if (score) {
      return {
        type: "number",
        value:
          Number(score[1]) * 1000 + Number(score[2])
      };
    }

    return {
      type: "text",
      value: raw.toLowerCase()
    };
  }

  function makeTableSortable(table) {
    if (!table || table.dataset.sortableReady === "true") {
      return;
    }

    table.dataset.sortableReady = "true";

    const headers = Array.from(
      table.querySelectorAll("thead th")
    );

    headers.forEach((header, columnIndex) => {
      header.classList.add("fc-sortable-header");
      header.setAttribute("role", "button");
      header.setAttribute("tabindex", "0");
      header.title = "Ordenar columna";

      const sort = () => {
        const previousColumn = Number(
          table.dataset.sortColumn || "-1"
        );

        const previousDirection =
          table.dataset.sortDirection === "desc"
            ? "desc"
            : "asc";

        const direction =
          previousColumn === columnIndex &&
          previousDirection === "asc"
            ? "desc"
            : "asc";

        table.dataset.sortColumn = String(columnIndex);
        table.dataset.sortDirection = direction;

        headers.forEach((item, index) => {
          item.classList.remove(
            "fc-sort-asc",
            "fc-sort-desc"
          );

          if (index === columnIndex) {
            item.classList.add(
              direction === "asc"
                ? "fc-sort-asc"
                : "fc-sort-desc"
            );
          }
        });

        const body = table.querySelector("tbody");

        if (!body) {
          return;
        }

        const rows = Array.from(
          body.querySelectorAll("tr")
        );

        rows.sort((rowA, rowB) => {
          const valueA = getSortValue(
            rowA.children[columnIndex]
          );

          const valueB = getSortValue(
            rowB.children[columnIndex]
          );

          let comparison = 0;

          if (
            valueA.type === "number" &&
            valueB.type === "number"
          ) {
            comparison =
              valueA.value - valueB.value;
          } else {
            comparison = String(
              valueA.value
            ).localeCompare(
              String(valueB.value),
              "es",
              {
                numeric: true,
                sensitivity: "base"
              }
            );
          }

          return direction === "asc"
            ? comparison
            : -comparison;
        });

        rows.forEach((row) => body.appendChild(row));
      };

      header.addEventListener("click", sort);

      header.addEventListener("keydown", (event) => {
        if (
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          sort();
        }
      });
    });
  }

  function makePanelTablesSortable(panel) {
    panel
      .querySelectorAll(".fc-stats-table")
      .forEach(makeTableSortable);
  }

  function createAnalyzeButton() {
    if (!document.documentElement) {
      return;
    }

    let host = document.getElementById(BUTTON_HOST_ID);

    if (!host) {
      host = document.createElement("div");
      host.id = BUTTON_HOST_ID;

      Object.assign(host.style, {
        all: "initial",
        position: "fixed",
        right: "24px",
        bottom: "24px",
        zIndex: "2147483647",
        display: "block",
        visibility: "visible",
        opacity: "1",
        width: "auto",
        height: "auto",
        margin: "0",
        padding: "0",
        border: "0",
        background: "transparent"
      });

      document.documentElement.appendChild(host);

      const shadow = host.attachShadow({
        mode: "open"
      });

      const style = document.createElement("style");

      style.textContent = `
        :host {
          all: initial;
          position: fixed;
          right: 24px;
          bottom: 24px;
          z-index: 2147483647;
          display: block;
        }

        button {
          all: initial;
          display: block;
          box-sizing: border-box;
          min-width: 190px;
          min-height: 42px;
          padding: 12px 18px;
          border: 1px solid #32e6df;
          border-radius: 5px;
          color: #120e20;
          background: #2de3dc;
          box-shadow: 0 5px 20px rgba(0, 0, 0, 0.35);
          cursor: pointer;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 14px;
          font-weight: 700;
          text-align: center;
          white-space: nowrap;
        }

        button:hover {
          background: #68fff8;
        }
      `;

      const button = document.createElement("button");

      button.type = "button";
      button.textContent = "Analizar estadísticas";

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openStats();
      });

      shadow.appendChild(style);
      shadow.appendChild(button);
    }

    if (!host.isConnected) {
      document.documentElement.appendChild(host);
    }

    host.style.setProperty(
      "display",
      "block",
      "important"
    );

    host.style.setProperty(
      "visibility",
      "visible",
      "important"
    );

    host.style.setProperty(
      "opacity",
      "1",
      "important"
    );
  }

  function createPanel() {
    let panel = document.getElementById(PANEL_ID);

    if (panel) {
      enableInteractions(panel);
      return panel;
    }

    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "fc-stats-panel";

    panel.innerHTML = `
      <div class="fc-stats-header">
        <div>
          <div class="fc-stats-title">
            Fightcade Stats
          </div>

          <div class="fc-stats-subtitle"></div>
        </div>

        <div class="fc-stats-header-actions">
          <button
            class="fc-open-tab"
            type="button"
            title="Abrir en una pestaña"
          >
            ↗
          </button>

          <button
            class="fc-stats-close"
            type="button"
            title="Cerrar"
          >
            ×
          </button>
        </div>
      </div>

      <div class="fc-stats-progress"></div>

      <div class="fc-stats-content">
        <div class="fc-stats-cards"></div>

        <div class="fc-stats-actions">
          <button
            data-action="stop"
            type="button"
            hidden
          >
            Detener análisis
          </button>

          <button
            data-action="json"
            type="button"
          >
            Exportar JSON
          </button>

          <button
            data-action="csv"
            type="button"
          >
            Exportar CSV
          </button>

          <button
            data-action="image"
            type="button"
          >
            Exportar imagen
          </button>
        </div>

        <section class="fc-stats-section">
          <h3>Rivales más jugados</h3>
          <div class="fc-stats-opponents"></div>
        </section>

        <section class="fc-stats-section">
          <h3>Estadísticas por juego</h3>
          <div class="fc-stats-games"></div>
        </section>

        <section class="fc-stats-section">
          <h3>Historial por fecha</h3>
          <div class="fc-stats-history"></div>
        </section>
      </div>

      <div
        class="fc-resize-handle"
        title="Redimensionar"
      ></div>
    `;

    document.documentElement.appendChild(panel);

    panel.querySelector(
      ".fc-stats-close"
    ).addEventListener("click", () => {
      stopAnalysis();
      panel.classList.remove("visible");
    });

    panel.querySelector(
      ".fc-open-tab"
    ).addEventListener("click", openDashboard);

    panel.querySelector(
      '[data-action="stop"]'
    ).addEventListener("click", stopAnalysis);

    panel.querySelector(
      '[data-action="json"]'
    ).addEventListener("click", exportJson);

    panel.querySelector(
      '[data-action="csv"]'
    ).addEventListener("click", exportCsv);

    panel.querySelector(
      '[data-action="image"]'
    ).addEventListener("click", exportImage);

    enableInteractions(panel);

    return panel;
  }

  function showPanel() {
    const panel = createPanel();

    panel.classList.add("visible");

    return panel;
  }

  function setProgress(message) {
    showPanel().querySelector(
      ".fc-stats-progress"
    ).textContent = message;
  }

  function resultClass(result) {
    if (result === "Victoria") {
      return "positive-text";
    }

    if (result === "Derrota") {
      return "negative-text";
    }

    return "draw-text";
  }

  function renderStats(stats) {
    const panel = showPanel();

    panel.querySelector(
      ".fc-stats-subtitle"
    ).textContent =
      `${stats.player} · ${formatNumber(
        stats.setsPlayed
      )} sets`;

    panel.querySelector(
      ".fc-stats-progress"
    ).textContent =
      `Actualizado: ${new Date(
        stats.generatedAt
      ).toLocaleString("es-AR")}`;

    panel.querySelector(
      ".fc-stats-cards"
    ).innerHTML = `
      <div class="fc-stat-card">
        <span>Sets jugados</span>
        <strong>
          ${formatNumber(stats.setsPlayed)}
        </strong>
      </div>

      <div class="fc-stat-card positive">
        <span>Sets ganados</span>
        <strong>
          ${formatNumber(stats.setsWon)}
        </strong>
      </div>

      <div class="fc-stat-card negative">
        <span>Sets perdidos</span>
        <strong>
          ${formatNumber(stats.setsLost)}
        </strong>
      </div>

      <div class="fc-stat-card">
        <span>Win rate de sets</span>
        <strong>
          ${formatPercent(stats.setWinRate)}
        </strong>
      </div>

      <div class="fc-stat-card">
        <span>Rounds jugados</span>
        <strong>
          ${formatNumber(stats.roundsPlayed)}
        </strong>
      </div>

      <div class="fc-stat-card positive">
        <span>Rounds ganados</span>
        <strong>
          ${formatNumber(stats.roundsWon)}
        </strong>
      </div>

      <div class="fc-stat-card negative">
        <span>Rounds perdidos</span>
        <strong>
          ${formatNumber(stats.roundsLost)}
        </strong>
      </div>

      <div class="fc-stat-card">
        <span>Win rate de rounds</span>
        <strong>
          ${formatPercent(stats.roundWinRate)}
        </strong>
      </div>
    `;

    renderOpponents(panel, stats.opponents);
    renderGames(panel, stats.games);
    renderHistory(panel, stats.rows);

    makePanelTablesSortable(panel);
  }

  function renderOpponents(panel, opponents) {
    panel.querySelector(
      ".fc-stats-opponents"
    ).innerHTML = `
      <div class="fc-table-wrapper">
        <table class="fc-stats-table">
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Sets jugados</th>
              <th>Victoria</th>
              <th>Derrota</th>
              <th>Win rate</th>
              <th>Rounds</th>
              <th>Estado</th>
            </tr>
          </thead>

          <tbody>
            ${(opponents || [])
              .map((item) => {
                return `
                  <tr>
                    <td>
                      ${escapeHtml(item.player)}
                    </td>

                    <td>
                      ${formatNumber(item.setsPlayed)}
                    </td>

                    <td class="positive-text">
                      ${formatNumber(item.setsWon)}
                    </td>

                    <td class="negative-text">
                      ${formatNumber(item.setsLost)}
                    </td>

                    <td>
                      ${formatPercent(item.setWinRate)}
                    </td>

                    <td>
                      ${formatNumber(item.roundsWon)}
                      -
                      ${formatNumber(item.roundsLost)}
                    </td>

                    <td class="${resultClass(
                      item.lastResult
                    )}">
                      ${escapeHtml(
                        item.lastResult || "Empate"
                      )}
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderGames(panel, games) {
    panel.querySelector(
      ".fc-stats-games"
    ).innerHTML = `
      <div class="fc-table-wrapper">
        <table class="fc-stats-table">
          <thead>
            <tr>
              <th>Juego</th>
              <th>Sets</th>
              <th>Victoria</th>
              <th>Derrota</th>
              <th>Win rate</th>
              <th>Rounds</th>
            </tr>
          </thead>

          <tbody>
            ${(games || [])
              .map(
                (item) => `
                  <tr>
                    <td>
                      ${escapeHtml(item.game)}
                    </td>

                    <td>
                      ${formatNumber(item.setsPlayed)}
                    </td>

                    <td class="positive-text">
                      ${formatNumber(item.setsWon)}
                    </td>

                    <td class="negative-text">
                      ${formatNumber(item.setsLost)}
                    </td>

                    <td>
                      ${formatPercent(item.setWinRate)}
                    </td>

                    <td>
                      ${formatNumber(item.roundsWon)}
                      -
                      ${formatNumber(item.roundsLost)}
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderHistory(panel, rows) {
    /*
     * Esta tabla conserva exactamente la estructura original:
     * Fecha, Juego, Jugador, Resultado, Rival y Estado.
     * Los rangos se guardan en los datos, pero no se muestran aquí.
     */
    panel.querySelector(
      ".fc-stats-history"
    ).innerHTML = `
      <div class="fc-table-wrapper">
        <table class="fc-stats-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Juego</th>
              <th>Jugador</th>
              <th>Resultado</th>
              <th>Rival</th>
              <th>Estado</th>
            </tr>
          </thead>

          <tbody>
            ${(rows || [])
              .map(
                (row) => `
                  <tr>
                    <td>
                      ${escapeHtml(row.date)}
                    </td>

                    <td>
                      ${escapeHtml(row.game)}
                    </td>

                    <td>
                      ${escapeHtml(row.player)}
                    </td>

                    <td>
                      ${row.playerScore}
                      -
                      ${row.opponentScore}
                    </td>

                    <td>
                      ${escapeHtml(row.opponent)}
                    </td>

                    <td class="${
                      row.isDraw
                        ? "draw-text"
                        : row.wonSet
                          ? "positive-text"
                          : "negative-text"
                    }">
                      ${escapeHtml(row.result)}
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function openDashboard() {
    if (!currentStats) {
      return;
    }

    chrome.storage.local.set(
      {
        fightcadeStatsDashboard: currentStats
      },
      () => {
        chrome.runtime.sendMessage({
          type: "OPEN_DASHBOARD"
        });
      }
    );
  }

  function enableInteractions(panel) {
    if (
      panel.dataset.interactionsReady === "true"
    ) {
      return;
    }

    const header = panel.querySelector(
      ".fc-stats-header"
    );

    const handle = panel.querySelector(
      ".fc-resize-handle"
    );

    if (!header || !handle) {
      return;
    }

    panel.dataset.interactionsReady = "true";

    let mode = null;
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let startWidth = 0;
    let startHeight = 0;
    let startLeft = 0;
    let startTop = 0;

    function setAbsolutePosition() {
      const rectangle =
        panel.getBoundingClientRect();

      panel.style.left = `${rectangle.left}px`;
      panel.style.top = `${rectangle.top}px`;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    }

    function stopInteraction(event) {
      if (!mode) {
        return;
      }

      if (
        event?.pointerId !== undefined &&
        pointerId !== null &&
        event.pointerId !== pointerId
      ) {
        return;
      }

      mode = null;
      pointerId = null;

      document.body.classList.remove(
        "fc-panel-moving",
        "fc-panel-resizing"
      );
    }

    function movePanel(event) {
      if (
        mode !== "move" ||
        event.pointerId !== pointerId
      ) {
        return;
      }

      const maxLeft = Math.max(
        0,
        window.innerWidth - panel.offsetWidth
      );

      const maxTop = Math.max(
        0,
        window.innerHeight - panel.offsetHeight
      );

      panel.style.left = `${Math.min(
        Math.max(
          0,
          startLeft + event.clientX - startX
        ),
        maxLeft
      )}px`;

      panel.style.top = `${Math.min(
        Math.max(
          0,
          startTop + event.clientY - startY
        ),
        maxTop
      )}px`;
    }

    function resizePanel(event) {
      if (
        mode !== "resize" ||
        event.pointerId !== pointerId
      ) {
        return;
      }

      const maxWidth = Math.min(
        window.innerWidth * 0.95,
        window.innerWidth - startLeft
      );

      const maxHeight = Math.min(
        window.innerHeight * 0.95,
        window.innerHeight - startTop
      );

      panel.style.width = `${Math.min(
        Math.max(
          430,
          startWidth + event.clientX - startX
        ),
        maxWidth
      )}px`;

      panel.style.height = `${Math.min(
        Math.max(
          320,
          startHeight + event.clientY - startY
        ),
        maxHeight
      )}px`;
    }

    header.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      setAbsolutePosition();

      const rectangle =
        panel.getBoundingClientRect();

      mode = "move";
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startLeft = rectangle.left;
      startTop = rectangle.top;

      document.body.classList.add(
        "fc-panel-moving"
      );
    });

    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();

      setAbsolutePosition();

      const rectangle =
        panel.getBoundingClientRect();

      mode = "resize";
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      startWidth = rectangle.width;
      startHeight = rectangle.height;
      startLeft = rectangle.left;
      startTop = rectangle.top;

      document.body.classList.add(
        "fc-panel-resizing"
      );
    });

    document.addEventListener(
      "pointermove",
      movePanel
    );

    document.addEventListener(
      "pointermove",
      resizePanel
    );

    document.addEventListener(
      "pointerup",
      stopInteraction
    );

    document.addEventListener(
      "pointercancel",
      stopInteraction
    );
  }

  function downloadFile(
    filename,
    content,
    mimeType
  ) {
    const blob = new Blob([content], {
      type: mimeType
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function exportJson() {
    if (!currentStats) {
      return;
    }

    downloadFile(
      `fightcade-${currentStats.player}-stats.json`,
      JSON.stringify(currentStats, null, 2),
      "application/json;charset=utf-8"
    );
  }

  function csvEscape(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function exportCsv() {
    if (!currentStats) {
      return;
    }

    const headers = [
      "fecha",
      "juego",
      "formato",
      "jugador",
      "rango_jugador",
      "rounds_jugador",
      "rounds_rival",
      "rival",
      "rango_rival",
      "resultado",
      "duracion"
    ];

    const lines = [
      headers.map(csvEscape).join(","),
      ...currentStats.rows.map((row) => {
        return [
          row.date,
          row.game,
          row.format,
          row.player,
          row.playerRank,
          row.playerScore,
          row.opponentScore,
          row.opponent,
          row.opponentRank,
          row.result,
          row.duration
        ]
          .map(csvEscape)
          .join(",");
      })
    ];

    downloadFile(
      `fightcade-${currentStats.player}-historial.csv`,
      "\ufeff" + lines.join("\n"),
      "text/csv;charset=utf-8"
    );
  }

  function normalizeRomName(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9_-]/g, "");
  }

  function getRomNameFromGame(gameName) {
    const game = normalizeRomName(gameName);

    const aliases = {
      streetfighteriii3rdstrike: "sfiii3nr1",
      streetfighteriii3rdstrikefightforfuture:
        "sfiii3nr1",
      sfiii3n: "sfiii3nr1",
      sf3: "sfiii3nr1"
    };

    return aliases[game] || game;
  }

  function askGameForImage(stats) {
    const games = Array.from(
      new Set(
        (stats.games || [])
          .map((item) =>
            String(item.game || "").trim()
          )
          .filter((game) => {
            return (
              game &&
              game.toLowerCase() !== "desconocido"
            );
          })
      )
    );

    if (!games.length) {
      alert(
        "No se pudo identificar ningún juego en el historial."
      );

      return null;
    }

    if (games.length === 1) {
      return getRomNameFromGame(games[0]);
    }

    const options = games
      .map(
        (game, index) =>
          `${index + 1}. ${game}`
      )
      .join("\n");

    const answer = window.prompt(
      "¿De qué juego querés generar la imagen?\n\n" +
        `${options}\n\n` +
        "Escribí el número correspondiente:",
      "1"
    );

    if (answer === null) {
      return null;
    }

    const selectedIndex = Number(answer) - 1;

    if (
      !Number.isInteger(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= games.length
    ) {
      alert("Selección inválida.");
      return null;
    }

    return getRomNameFromGame(
      games[selectedIndex]
    );
  }

  function runtimeRequest(type, payload = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type,
          ...payload
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(
              new Error(
                chrome.runtime.lastError.message
              )
            );

            return;
          }

          if (!response?.ok) {
            reject(
              new Error(
                response?.error || "Error"
              )
            );

            return;
          }

          resolve(response.dataUrl);
        }
      );
    });
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = source;
    });
  }

  function drawCoverImage(
    context,
    image,
    x,
    y,
    width,
    height
  ) {
    const imageRatio =
      image.width / image.height;

    const boxRatio = width / height;

    let sourceWidth = image.width;
    let sourceHeight = image.height;
    let sourceX = 0;
    let sourceY = 0;

    if (imageRatio > boxRatio) {
      sourceWidth = image.height * boxRatio;
      sourceX =
        (image.width - sourceWidth) / 2;
    } else {
      sourceHeight = image.width / boxRatio;
      sourceY =
        (image.height - sourceHeight) / 2;
    }

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      x,
      y,
      width,
      height
    );
  }

  function drawText(
    context,
    value,
    x,
    y,
    options = {}
  ) {
    context.fillStyle =
      options.color || "#ffffff";

    context.font =
      options.font || "700 24px Arial";

    context.textAlign =
      options.align || "left";

    context.textBaseline = "middle";

    context.fillText(
      String(value),
      x,
      y
    );
  }

  async function exportImage() {
    if (!currentStats) {
      return;
    }

    const rom = askGameForImage(currentStats);

    if (!rom) {
      return;
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    const width = 1600;
    const height = 900;

    canvas.width = width;
    canvas.height = height;

    let background = null;
    let gameImage = null;

    try {
      background = await loadImage(
        await runtimeRequest("FETCH_BACKGROUND")
      );
    } catch {
      background = null;
    }

    try {
      gameImage = await loadImage(
        await runtimeRequest(
          "FETCH_GAME_PREVIEW",
          { rom }
        )
      );
    } catch {
      gameImage = null;
    }

    if (background) {
      drawCoverImage(
        context,
        background,
        0,
        0,
        width,
        height
      );

      context.fillStyle =
        "rgba(35, 16, 38, 0.66)";

      context.fillRect(
        0,
        0,
        width,
        height
      );
    } else {
      const gradient =
        context.createLinearGradient(
          0,
          0,
          width,
          height
        );

      gradient.addColorStop(0, "#271426");
      gradient.addColorStop(0.5, "#4d2147");
      gradient.addColorStop(1, "#211121");

      context.fillStyle = gradient;
      context.fillRect(
        0,
        0,
        width,
        height
      );
    }

    context.strokeStyle = "#32e6df";
    context.lineWidth = 8;
    context.strokeRect(
      42,
      42,
      width - 84,
      height - 84
    );

    context.strokeStyle = "#98517f";
    context.lineWidth = 3;
    context.strokeRect(
      62,
      62,
      width - 124,
      height - 124
    );

    drawText(
      context,
      "FIGHTCADE STATS",
      105,
      120,
      {
        color: "#32e6df",
        font:
          "900 58px Arial Black, Impact, sans-serif"
      }
    );

    drawText(
      context,
      String(currentStats.player).toUpperCase(),
      105,
      215,
      {
        color: "#ffffff",
        font:
          "900 78px Arial Black, Impact, sans-serif"
      }
    );

    drawText(
      context,
      `ROM: ${rom}`,
      108,
      270,
      {
        color: "#e4bfd9",
        font: "700 28px Arial, sans-serif"
      }
    );

    const imageX = 1125;
    const imageY = 90;
    const imageWidth = 350;
    const imageHeight = 250;

    context.fillStyle =
      "rgba(25, 12, 27, 0.9)";

    context.fillRect(
      imageX,
      imageY,
      imageWidth,
      imageHeight
    );

    context.strokeStyle = "#32e6df";
    context.lineWidth = 5;

    context.strokeRect(
      imageX,
      imageY,
      imageWidth,
      imageHeight
    );

    if (gameImage) {
      context.save();

      context.beginPath();

      context.rect(
        imageX + 8,
        imageY + 8,
        imageWidth - 16,
        imageHeight - 16
      );

      context.clip();

      drawCoverImage(
        context,
        gameImage,
        imageX + 8,
        imageY + 8,
        imageWidth - 16,
        imageHeight - 16
      );

      context.restore();
    } else {
      drawText(
        context,
        rom.toUpperCase(),
        imageX + imageWidth / 2,
        imageY + imageHeight / 2,
        {
          color: "#ffffff",
          font:
            "900 28px Arial Black, Impact, sans-serif",
          align: "center"
        }
      );
    }

    const cards = [
      [
        "SETS GANADOS",
        currentStats.setsWon,
        "#35e0bd"
      ],
      [
        "SETS PERDIDOS",
        currentStats.setsLost,
        "#ed789a"
      ],
      [
        "WIN RATE DE SETS",
        formatPercent(currentStats.setWinRate),
        "#f2c957"
      ],
      [
        "ROUNDS GANADOS",
        currentStats.roundsWon,
        "#35e0bd"
      ],
      [
        "ROUNDS PERDIDOS",
        currentStats.roundsLost,
        "#ed789a"
      ],
      [
        "WIN RATE DE ROUNDS",
        formatPercent(currentStats.roundWinRate),
        "#f2c957"
      ]
    ];

    const cardWidth = 430;
    const cardHeight = 125;
    const startX = 105;
    const startY = 365;
    const gapX = 35;
    const gapY = 25;

    cards.forEach(([title, value, color], index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);

      const x =
        startX + column * (cardWidth + gapX);

      const y =
        startY + row * (cardHeight + gapY);

      context.fillStyle =
        "rgba(35, 17, 36, 0.92)";

      context.fillRect(
        x,
        y,
        cardWidth,
        cardHeight
      );

      context.strokeStyle = color;
      context.lineWidth = 4;

      context.strokeRect(
        x,
        y,
        cardWidth,
        cardHeight
      );

      drawText(
        context,
        title,
        x + 24,
        y + 36,
        {
          color: "#e4bfd9",
          font: "700 22px Arial, sans-serif"
        }
      );

      drawText(
        context,
        value,
        x + 24,
        y + 91,
        {
          color,
          font:
            "900 48px Arial Black, Impact, sans-serif"
        }
      );
    });

    drawText(
      context,
      `Sets analizados: ${formatNumber(
        currentStats.setsPlayed
      )} · Rounds analizados: ${formatNumber(
        currentStats.roundsPlayed
      )}`,
      105,
      830,
      {
        color: "#e4bfd9",
        font: "600 22px Arial, sans-serif"
      }
    );

    drawText(
      context,
      "ARCADE FIGHTER CARD",
      width - 105,
      830,
      {
        color: "#32e6df",
        font: "700 20px Arial, sans-serif",
        align: "right"
      }
    );

    canvas.toBlob((blob) => {
      if (!blob) {
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download =
        `fightcade-${currentStats.player}-${rom}-stats.png`;

      link.click();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    }, "image/png");
  }

  async function openStats() {
    if (analyzing) {
      return;
    }

    const player = getProfileUsername();

    if (!player) {
      alert(
        "No se pudo detectar el usuario de Fightcade."
      );

      return;
    }

    analyzing = true;
    analysisCancelled = false;
    analysisToken++;

    const token = analysisToken;
    const panel = showPanel();

    setAnalyzingState(panel, true);
    setProgress("Analizando historial...");

    try {
      const rows = await collectAllRows(
        setProgress,
        token
      );

      if (isCancelled(token)) {
        return;
      }

      if (!rows.length) {
        setProgress(
          "No se encontraron partidas o el análisis fue detenido."
        );

        return;
      }

      currentStats = calculateStats(rows, player);

      renderStats(currentStats);

      // Guardar el dashboard usual
      chrome.storage.local.set({
        fightcadeStatsDashboard: currentStats
      });

      // Calcular y guardar el estado de Elo basado en el historial analizado
      try {
        const eloState = computeEloFromStats(currentStats);
        chrome.storage.local.set({ fightcadeEloState: eloState });
      } catch (err) {
        console.error('[Fightcade Stats] Error calculando Elo:', err);
      }

    } catch (error) {
      if (!isCancelled(token)) {
        console.error(
          "[Fightcade Stats]",
          error
        );

        setProgress(
          "Error analizando el historial."
        );
      }
    } finally {
      if (token === analysisToken) {
        analyzing = false;
        setAnalyzingState(panel, false);
      }
    }
  }

  function initialize() {
    const ensureButton = () => {
      try {
        createAnalyzeButton();
      } catch (error) {
        console.error(
          "[Fightcade Stats] Error creando el botón:",
          error
        );
      }
    };

    ensureButton();

    const observer = new MutationObserver(
      ensureButton
    );

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    window.addEventListener(
      "load",
      ensureButton
    );

    window.addEventListener(
      "pageshow",
      ensureButton
    );

    setInterval(ensureButton, 1000);

    setTimeout(ensureButton, 100);
    setTimeout(ensureButton, 500);
    setTimeout(ensureButton, 1500);
    setTimeout(ensureButton, 3000);
  }

  initialize();
})();
