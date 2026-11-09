(function () {
  const games = window.GAMES || [];
  const grid = document.getElementById("gameGrid");
  const toastEl = document.getElementById("toast");
  const CATEGORY_LABEL = { board: "보드 게임", card: "카드 게임" };
  const RECENT_KEY = "minigame.recent";
  const THEME_KEY = "minigame.theme";

  const storage = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {}
    },
  };

  // ---------- 테마 ----------
  const savedTheme = storage.get(THEME_KEY, null);
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  document.getElementById("themeToggle").addEventListener("click", () => {
    const current =
      document.documentElement.dataset.theme ||
      (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    storage.set(THEME_KEY, next);
  });

  // ---------- 토스트 ----------
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  // ---------- 카드 렌더 ----------
  function stars(n) {
    return "★".repeat(n) + "☆".repeat(3 - n);
  }

  function artFor(g) {
    if (g.theme === "chess") {
      return `<div class="art art-chess"><span>${g.icon}</span></div>`;
    }
    if (g.theme === "omok") {
      return `<div class="art art-omok">
        <i class="st b" style="--x:1;--y:1"></i><i class="st w" style="--x:2;--y:1"></i>
        <i class="st b" style="--x:2;--y:2"></i><i class="st b" style="--x:3;--y:3"></i>
        <i class="st w" style="--x:1;--y:3"></i><i class="st b" style="--x:4;--y:4"></i>
      </div>`;
    }
    const red = /[♥♦]/.test(g.icon);
    return `<div class="art art-felt ${g.theme}">
      <div class="mini-card back"></div>
      <div class="mini-card ${red ? "red" : ""}">${g.icon}</div>
    </div>`;
  }

  function cardHTML(g) {
    const soon = g.status !== "ready";
    return `
      <button class="game-card" type="button" data-id="${g.id}" data-category="${g.category}">
        ${artFor(g)}
        <div class="game-body">
          <div class="game-meta">
            <span class="tag tag-${g.category}">${CATEGORY_LABEL[g.category]}</span>
            ${soon ? '<span class="tag tag-soon">준비 중</span>' : ""}
          </div>
          <h3>${g.title}</h3>
          <p>${g.desc}</p>
          <dl class="stats">
            <div><dt>인원</dt><dd>${g.players}</dd></div>
            <div><dt>시간</dt><dd>${g.time}</dd></div>
            <div><dt>난이도</dt><dd class="stars" aria-label="난이도 ${g.level} / 3">${stars(g.level)}</dd></div>
          </dl>
        </div>
      </button>`;
  }

  function render(filter) {
    const list = filter === "all" ? games : games.filter((g) => g.category === filter);
    grid.innerHTML = list.map(cardHTML).join("");
  }

  // 받침 유무에 따라 은/는 선택
  function josa(word) {
    const code = word.charCodeAt(word.length - 1) - 0xac00;
    if (code < 0 || code > 11171) return "은(는)";
    return code % 28 ? "은" : "는";
  }

  // ---------- 게임 실행 ----------
  function launch(id) {
    const g = games.find((x) => x.id === id);
    if (!g) return;
    const recent = storage.get(RECENT_KEY, []).filter((x) => x !== id);
    recent.unshift(id);
    storage.set(RECENT_KEY, recent.slice(0, 4));
    renderRecent();
    if (g.status === "ready") {
      location.href = g.url;
    } else {
      toast(`${g.title}${josa(g.title)} 곧 열려요. 조금만 기다려 주세요!`);
    }
  }

  function renderRecent() {
    const ids = storage.get(RECENT_KEY, []);
    const items = ids.map((id) => games.find((g) => g.id === id)).filter(Boolean);
    const section = document.getElementById("recentSection");
    section.hidden = items.length === 0;
    document.getElementById("recentList").innerHTML = items
      .map(
        (g) => `<button class="recent-item" type="button" data-id="${g.id}">
          <span class="recent-icon ${g.category}">${g.icon}</span>
          <span>${g.title}</span>
        </button>`
      )
      .join("");
  }

  // ---------- 이벤트 ----------
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => {
        c.classList.toggle("is-active", c === chip);
        c.setAttribute("aria-selected", c === chip ? "true" : "false");
      });
      render(chip.dataset.filter);
    });
  });

  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-id]");
    if (target) launch(target.dataset.id);
  });

  document.getElementById("randomPick").addEventListener("click", () => {
    const g = games[Math.floor(Math.random() * games.length)];
    launch(g.id);
  });

  render("all");
  renderRecent();
})();
