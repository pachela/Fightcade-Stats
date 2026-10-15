(() => {
  "use strict";

  const emptyElement = document.getElementById(
    "dashboard-empty"
  );

  const contentElement = document.getElementById(
    "dashboard-content"
  );

  const subtitleElement = document.getElementById(
    "dashboard-subtitle"
  );

  const nameElement = document.getElementById("dashboard-name");
  const rankElement = document.getElementById("dashboard-rank");
  const eloElement = document.getElementById("dashboard-elo");
  const eloProgressElement = document.getElementById("dashboard-elo-progress");

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("es-AR");
  }

  function formatPercent(value) {
    return `${Number(value || 0).toFixed(2)}%`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function parseDate(value) {
    const match = String(value || "").match(
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

  function getCellSortValue(cell) {
    const raw = String(cell?.innerText || "").trim();
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

        const rows = Array.from(body.querySelectorAll("tr"));

        rows.sort((rowA, rowB) => {
          const valueA = getCellSortValue(
            rowA.children[columnIndex]
          );

          const valueB = getCellSortValue(
            rowB.children[columnIndex]
          );

          let comparison = 0;

          if (
            valueA.type === "number" &&
            valueB.type === "number"
          ) {
            comparison = valueA.value - valueB.value;
          } else {
            comparison = String(valueA.value).localeCompare(
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
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          sort();
        }
      });
    });
  }

  function makeAllTablesSortable() {
    document
      .querySelectorAll("table")
      .forEach(makeTableSortable);
  }

  function renderCards(stats) {
    document.getElementById("dashboard-cards")
      .innerHTML = `
        <div class="dashboard-card">
          <span>Sets jugados</span>
          <strong>${formatNumber(stats.setsPlayed)}</strong>
        </div>

        <div class="dashboard-card positive">
          <span>Sets ganados</span>
          <strong>${formatNumber(stats.setsWon)}</strong>
        </div>

        <div class="dashboard-card negative">
          <span>Sets perdidos</span>
          <strong>${formatNumber(stats.setsLost)}</strong>
        </div>

        <div class="dashboard-card">
          <span>Win rate de sets</span>
          <strong>${formatPercent(stats.setWinRate)}</strong>
        </div>

        <div class="dashboard-card">
          <span>Rounds jugados</span>
          <strong>${formatNumber(stats.roundsPlayed)}</strong>
        </div>

        <div class="dashboard-card positive">
          <span>Rounds ganados</span>
          <strong>${formatNumber(stats.roundsWon)}</strong>
        </div>

        <div class="dashboard-card negative">
          <span>Rounds perdidos</span>
          <strong>${formatNumber(stats.roundsLost)}</strong>
        </div>

        <div class="dashboard-card">
          <span>Win rate de rounds</span>
          <strong>${formatPercent(stats.roundWinRate)}</strong>
        </div>
      `;
  }

  function renderOpponents(stats) {
    document.getElementById("dashboard-opponents")
      .innerHTML = `
        <div class="table-wrapper">
          <table>
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
              ${(stats.opponents || [])
                .map(
                  (item) => `
                    <tr>
                      <td>${escapeHtml(item.player)}</td>
                      <td>${formatNumber(item.setsPlayed)}</td>
                      <td class="positive">
                        ${formatNumber(item.setsWon)}
                      </td>
                      <td class="negative">
                        ${formatNumber(item.setsLost)}
                      </td>
                      <td>${formatPercent(item.setWinRate)}</td>
                      <td>
                        ${formatNumber(item.roundsWon)}
                        -
                        ${formatNumber(item.roundsLost)}
                      </td>
                      <td class="$ {
                        item.lastResult === "Victoria"
                          ? "positive"
                          : item.lastResult === "Derrota"
                            ? "negative"
                            : "draw"
                      }">
                        ${escapeHtml(
                          item.lastResult || "Empate"
                        )}
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

  function renderRanks(stats) {
    const ranks = stats.ranks || [];

    document.getElementById("dashboard-ranks")
      .innerHTML = `
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Rango rival</th>
                <th>Sets jugados</th>
                <th>Victoria</th>
                <th>Derrota</th>
                <th>Win rate</th>
              </tr>
            </thead>

            <tbody>
              ${
                ranks.length
                  ? ranks
                      .map(
                        (item) => `
                          <tr>
                            <td class="rank-name">
                              ${escapeHtml(item.rank)}
                            </td>
                            <td>
                              ${formatNumber(
                                item.setsPlayed
                              )}
                            </td>
                            <td class="positive">
                              ${formatNumber(item.setsWon)}
                            </td>
                            <td class="negative">
                              ${formatNumber(item.setsLost)}
                            </td>
                            <td class="${
                              item.setWinRate >= 50
                                ? "positive"
                                : "negative"
                            }">
                              ${formatPercent(
                                item.setWinRate
                              )}
                            </td>
                          </tr>
                        `
                      )
                      .join("")
                  : `
                      <tr>
                        <td colspan="5">
                          No hay rangos detectados.
                        </td>
                      </tr>
                    `
              }
            </tbody>
          </table>
        </div>
      `;
  }

  function renderGames(stats) {
    document.getElementById("dashboard-games")
      .innerHTML = `
        <div class="table-wrapper">
          <table>
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
              ${(stats.games || [])
                .map(
                  (item) => `
                    <tr>
                      <td>${escapeHtml(item.game)}</td>
                      <td>${formatNumber(item.setsPlayed)}</td>
                      <td class="positive">
                        ${formatNumber(item.setsWon)}
                      </td>
                      <td class="negative">
                        ${formatNumber(item.setsLost)}
                      </td>
                      <td>${formatPercent(item.setWinRate)}</td>
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

  function renderHistory(stats, eloMap) {
    /*
     * Ahora la tabla incluye una columna adicional: Δ Elo
     */
    document.getElementById("dashboard-history")
      .innerHTML = `
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Juego</th>
                <th>Jugador</th>
                <th>Resultado</th>
                <th>Rival</th>
                <th>Estado</th>
                <th>Δ Elo</th>
              </tr>
            </thead>

            <tbody>
              ${(stats.rows || [])
                .map(
                  (row) => {
                    const key = `${row.date}|${row.opponent}`;
                    const delta = eloMap && eloMap[key] !== undefined ? eloMap[key] : "-";

                    return `
                      <tr>
                        <td>${escapeHtml(row.date)}</td>
                        <td>${escapeHtml(row.game)}</td>
                        <td>${escapeHtml(row.player)}</td>
                        <td>
                          ${row.playerScore} -
                          ${row.opponentScore}
                        </td>
                        <td>${escapeHtml(row.opponent)}</td>
                        <td class="${
                          row.isDraw
                            ? "draw"
                            : row.wonSet
                              ? "positive"
                              : "negative"
                        }">
                          ${escapeHtml(row.result)}
                        </td>
                        <td style="text-align:right;font-weight:700;color:${typeof delta==='number'&&delta>0? '#35e0bd': typeof delta==='number'&&delta<0? '#ed789a':'#e6c8df'}">${typeof delta==='number'? (delta>0? `+${delta}`: `${delta}`) : delta}</td>
                      </tr>
                    `;
                  }
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `;
  }

  function prepareCanvas(canvas) {
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 520;
    const height = canvas.clientHeight || 300;

    canvas.width = width * ratio;
    canvas.height = height * ratio;

    const context = canvas.getContext("2d");

    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    return {
      context,
      width,
      height
    };
  }

  function drawChartBackground(context, width, height) {
    context.fillStyle = "#241425";
    context.fillRect(0, 0, width, height);

    context.strokeStyle = "#542c4d";
    context.lineWidth = 1;

    for (let y = 30; y < height - 20; y += 40) {
      context.beginPath();
      context.moveTo(45, y);
      context.lineTo(width - 20, y);
      context.stroke();
    }
  }

  function drawSimpleChart(id, values) {
    const canvas = document.getElementById(id);

    if (!canvas) {
      return;
    }

    const { context, width, height } =
      prepareCanvas(canvas);

    drawChartBackground(context, width, height);

    const maxValue = Math.max(
      1,
      ...values.map((item) => item[1])
    );

    const barWidth = 90;
    const gap = 80;
    const chartHeight = height - 85;
    const totalWidth =
      values.length * barWidth +
      (values.length - 1) * gap;

    const startX = (width - totalWidth) / 2;

    values.forEach(([label, value, color], index) => {
      const barHeight =
        (value / maxValue) * chartHeight;

      const x = startX + index * (barWidth + gap);
      const y = height - 55 - barHeight;

      context.fillStyle = color;
      context.fillRect(
        x,
        y,
        barWidth,
        barHeight
      );

      context.fillStyle = "#ffffff";
      context.font = "700 13px Arial";
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.fillText(
        String(value),
        x + barWidth / 2,
        y - 6
      );

      context.fillStyle = "#e6c8df";
      context.font = "600 12px Arial";
      context.textBaseline = "top";
      context.fillText(
        label,
        x + barWidth / 2,
        height - 42
      );
    });
  }

  function drawHorizontalChart(
    id,
    items,
    color,
    valueKey,
    labelKey
  ) {
    const canvas = document.getElementById(id);

    if (!canvas) {
      return;
    }

    const { context, width, height } =
      prepareCanvas(canvas);

    drawChartBackground(context, width, height);

    const visibleItems = items.slice(0, 8);

    if (!visibleItems.length) {
      return;
    }

    const maxValue = Math.max(
      1,
      ...visibleItems.map((item) => item[valueKey])
    );

    const left = 180;
    const top = 25;
    const barHeight = 25;
    const gap = 18;
    const maxBarWidth = width - left - 70;

    visibleItems.forEach((item, index) => {
      const y = top + index * (barHeight + gap);
      const barWidth =
        (item[valueKey] / maxValue) * maxBarWidth;

      context.fillStyle = color;
      context.fillRect(
        left,
        y,
        barWidth,
        barHeight
      );

      context.fillStyle = "#e6c8df";
      context.font = "600 12px Arial";
      context.textAlign = "right";
      context.textBaseline = "middle";

      context.fillText(
        String(item[labelKey]).slice(0, 22),
        left - 10,
        y + barHeight / 2
      );

      context.fillStyle = "#ffffff";
      context.textAlign = "left";

      context.fillText(
        `${item[valueKey]} sets`,
        left + barWidth + 8,
        y + barHeight / 2
      );
    });
  }

  function drawRankChart(stats) {
    const canvas = document.getElementById(
      "ranks-chart"
    );

    if (!canvas) {
      return;
    }

    const { context, width, height } =
      prepareCanvas(canvas);

    drawChartBackground(context, width, height);

    const ranks = stats.ranks || [];

    if (!ranks.length) {
      context.fillStyle = "#d493c4";
      context.font = "600 14px Arial";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(
        "No hay rangos detectados",
        width / 2,
        height / 2
      );
      return;
    }

    const left = 65;
    const right = 25;
    const top = 25;
    const bottom = 55;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;
    const slotWidth = chartWidth / ranks.length;
    const barWidth = Math.min(70, slotWidth * 0.6);

    [0, 25, 50, 75, 100].forEach((value) => {
      const y =
        top +
        chartHeight -
        (value / 100) * chartHeight;

      context.strokeStyle = "#542c4d";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(width - right, y);
      context.stroke();

      context.fillStyle = "#d493c4";
      context.font = "11px Arial";
      context.textAlign = "right";
      context.textBaseline = "middle";
      context.fillText(`${value}%`, left - 8, y);
    });

    ranks.forEach((item, index) => {
      const percentage = Number(item.setWinRate || 0);
      const barHeight =
        (percentage / 100) * chartHeight;

      const x =
        left +
        index * slotWidth +
        (slotWidth - barWidth) / 2;

      const y = top + chartHeight - barHeight;

      context.fillStyle =
        percentage >= 50
          ? "#35e0bd"
          : "#ed789a";

      context.fillRect(
        x,
        y,
        barWidth,
        barHeight
      );

      context.fillStyle = "#ffffff";
      context.font = "700 12px Arial";
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.fillText(
        formatPercent(percentage),
        x + barWidth / 2,
        y - 6
      );

      context.fillStyle = "#e6c8df";
      context.textBaseline = "top";
      context.fillText(
        item.rank,
        x + barWidth / 2,
        top + chartHeight + 10
      );
    });
  }

  function renderCharts(stats) {
    requestAnimationFrame(() => {
      drawSimpleChart("sets-chart", [
        ["Ganados", stats.setsWon, "#35e0bd"],
        ["Perdidos", stats.setsLost, "#ed789a"]
      ]);

      drawSimpleChart("rounds-chart", [
        ["Ganados", stats.roundsWon, "#35e0bd"],
        ["Perdidos", stats.roundsLost, "#ed789a"]
      ]);

      drawHorizontalChart(
        "opponents-chart",
        stats.opponents || [],
        "#35e0bd",
        "setsPlayed",
        "player"
      );

      drawHorizontalChart(
        "games-chart",
        stats.games || [],
        "#f2c957",
        "setsPlayed",
        "game"
      );

      drawRankChart(stats);
    });
  }

  // helper to compute rank name from elo
  function rankFromElo(elo) {
    if (elo >= 1900) return 'S';
    if (elo >= 1600) return 'A';
    if (elo >= 1300) return 'B';
    if (elo >= 1000) return 'C';
    if (elo >= 700) return 'D';
    if (elo >= 400) return 'E';
    return 'Sin rango';
  }

  function nextRankThreshold(elo) {
    if (elo < 700) return 700;
    if (elo < 1000) return 1000;
    if (elo < 1300) return 1300;
    if (elo < 1600) return 1600;
    if (elo < 1900) return 1900;
    return null;
  }

  function prevRankThreshold(elo) {
    if (elo >= 1900) return 1600;
    if (elo >= 1600) return 1300;
    if (elo >= 1300) return 1000;
    if (elo >= 1000) return 700;
    if (elo >= 700) return 400;
    return null;
  }

  function render(stats, eloState) {
    if (!stats) {
      emptyElement.hidden = false;
      contentElement.hidden = true;
      return;
    }

    emptyElement.hidden = true;
    contentElement.hidden = false;

    subtitleElement.textContent =
      `${stats.player} · ${formatNumber(
        stats.setsPlayed
      )} sets`;

    // render name / rank / elo
    nameElement.textContent = stats.player;

    if (eloState && typeof eloState.elo === 'number') {
      eloElement.textContent = `Elo: ${eloState.elo}`;
      const playerRank = rankFromElo(eloState.elo);
      rankElement.textContent = playerRank;

      const next = nextRankThreshold(eloState.elo);
      const prev = prevRankThreshold(eloState.elo);

      let progressText = '';
      if (next) {
        progressText += `${next - eloState.elo} puntos para subir a ${rankFromElo(next)}.`;
      } else {
        progressText += 'Ya estás en el rango más alto.';
      }

      if (prev) {
        progressText += ` ${eloState.elo - prev} puntos para bajar a ${rankFromElo(prev)}.`;
      }

      eloProgressElement.textContent = progressText;
    } else {
      eloElement.textContent = 'Elo: -';
      rankElement.textContent = '-';
      eloProgressElement.textContent = '';
    }

    renderCards(stats);
    renderOpponents(stats);
    renderRanks(stats);
    renderGames(stats);

    // build elo map keyed by date|opponent
    const eloMap = {};
    if (eloState && Array.isArray(eloState.matches)) {
      eloState.matches.forEach(m => {
        const key = `${m.date}|${m.opponent}`;
        // store delta as number rounded to 2 decimals
        eloMap[key] = typeof m.delta === 'number' ? Math.round(m.delta*100)/100 : m.delta;
      });
    }

    renderHistory(stats, eloMap);
    renderCharts(stats);
    makeAllTablesSortable();
  }

  // load both dashboard and elo state
  chrome.storage.local.get([
    "fightcadeStatsDashboard",
    "fightcadeEloState"
  ], (result) => {
    render(result.fightcadeStatsDashboard || null, result.fightcadeEloState || null);
  });
})();
