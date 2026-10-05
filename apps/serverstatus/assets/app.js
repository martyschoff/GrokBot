(function(){
  const phone = new URLSearchParams(location.search).has("phone");
  if (phone) document.body.classList.add("phone");

  function etNow() {
    return new Date().toLocaleString("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function stampClock() {
    const el = document.getElementById("clock");
    if (el) el.textContent = etNow();
  }

  function shortUse(v) {
    if (v === undefined || v === null || v === "") return v;
    let s = String(v);
    if (s.indexOf("llama:") === 0) s = s.slice(6);
    if (s.indexOf("llama") === 0) s = s.slice(5);
    return s;
  }

  function emptyTd() {
    const td = document.createElement("td");
    td.className = "empty";
    return td;
  }

  function load() {
    stampClock();
    const refreshBtn = document.getElementById("refresh");
    refreshBtn.textContent = "Instant Working";
    const url = "data/servers.json?" + Date.now();
    fetch(url, { cache: "no-store" })
      .then(response => response.json())
      .then(data => {
        const tbody = document.getElementById("rows");
        tbody.innerHTML = "";
        function linesOf(row) {
          if (row.up && Array.isArray(row.lines) && row.lines.length) {
            return row.lines.map(line => ({
              name: row.name,
              up: true,
              whatsinuse: line.whatsinuse || "",
              working_on: line.working_on || "",
              cpuU: row.cpuU,
              memU: row.memU,
              vram: row.vram
            }));
          }
          return [row];
        }

        data.rows.forEach(machine => {
          linesOf(machine).forEach(row => {
          const tr = document.createElement("tr");
          const nameTd = document.createElement("td");
          nameTd.textContent = row.name;
          tr.appendChild(nameTd);
          const statusTd = document.createElement("td");
          const span = document.createElement("span");
          span.className = row.up ? "pill up" : "pill down";
          span.textContent = row.up ? "up" : "down";
          statusTd.appendChild(span);
          tr.appendChild(statusTd);
          if (phone) {
            if (!row.up) {
              tr.appendChild(emptyTd());
              tr.appendChild(emptyTd());
            } else {
              const useTd = document.createElement("td");
              const use = shortUse(row.whatsinuse);
              if (use === undefined || use === "") useTd.className = "empty";
              else useTd.textContent = use;
              tr.appendChild(useTd);
              const workTd = document.createElement("td");
              if (row.working_on === undefined || row.working_on === "") workTd.className = "empty";
              else workTd.textContent = row.working_on;
              tr.appendChild(workTd);
            }
          } else if (!row.up) {
            for (let i = 0; i < 5; i++) tr.appendChild(emptyTd());
          } else {
            const fields = [shortUse(row.whatsinuse), row.working_on, row.cpuU, row.memU, row.vram];
            fields.forEach(field => {
              const td = document.createElement("td");
              if (field === undefined || field === "") td.className = "empty";
              else td.textContent = field;
              tr.appendChild(td);
            });
          }
          tbody.appendChild(tr);
          });
        });
        refreshBtn.textContent = "Refresh";
      })
      .catch(() => {
        document.getElementById("rows").innerHTML = "";
        refreshBtn.textContent = "Refresh";
      });
  }

  load();
  document.getElementById("refresh").addEventListener("click", load);
})();