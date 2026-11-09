// 화투 엔진 — 맞고(2인) / 고스톱(3인) 공용
// 페이지의 <body data-players="2|3"> 로 인원을 정한다.
(function () {
  "use strict";

  const N = Number(document.body.dataset.players) === 3 ? 3 : 2;
  const MODE = N === 2 ? "matgo" : "gostop";
  const WIN_AT = N === 2 ? 7 : 3; // 날 수 있는 점수
  const HAND_N = N === 2 ? 10 : 7;
  const FLOOR_N = N === 2 ? 8 : 6;
  const PER_POINT = 100; // 점당 100원
  const STORE = "minigame.hwatu." + MODE;
  const NAMES = N === 2 ? ["나", "컴퓨터"] : ["나", "컴퓨터 1", "컴퓨터 2"];

  /* ---------------- 카드 정의 ---------------- */
  const MONTH_NAMES = ["", "송학", "매조", "벚꽃", "흑싸리", "난초", "모란", "홍싸리", "공산", "국진", "단풍", "오동", "비"];
  const MONTH_COLORS = ["", "#2e7d32", "#d9578a", "#e98aa9", "#6a4c93", "#3a6fc4", "#c62828", "#a0336b", "#7c6a2e", "#d39a00", "#d84315", "#5d4a7a", "#37597a"];
  // 광 5 · 열끗 9 · 띠 10 · 피 24(쌍피 2장 포함) = 48
  const SPEC = {
    1: ["gwang", "tti:hong", "pi", "pi"],
    2: ["yeol:bird", "tti:hong", "pi", "pi"],
    3: ["gwang", "tti:hong", "pi", "pi"],
    4: ["yeol:bird", "tti:cho", "pi", "pi"],
    5: ["yeol", "tti:cho", "pi", "pi"],
    6: ["yeol", "tti:cheong", "pi", "pi"],
    7: ["yeol", "tti:cho", "pi", "pi"],
    8: ["gwang", "yeol:bird", "pi", "pi"],
    9: ["yeol", "tti:cheong", "pi", "pi"], // 국진은 열끗으로만 센다
    10: ["yeol", "tti:cheong", "pi", "pi"],
    11: ["gwang", "pi:2", "pi", "pi"], // 오동 똥쌍피
    12: ["gwang:bi", "yeol", "tti", "pi:2"], // 비광, 제비, 비띠, 비쌍피
  };

  function buildDeck() {
    const deck = [];
    for (let m = 1; m <= 12; m++) {
      SPEC[m].forEach((s, i) => {
        const [t, x] = s.split(":");
        deck.push({
          id: m + "-" + i,
          m,
          t,
          sub: t === "tti" ? x || "" : "",
          bird: x === "bird",
          bi: x === "bi",
          pi: t === "pi" ? (x === "2" ? 2 : 1) : 0,
        });
      });
    }
    return deck;
  }

  function selfCheck() {
    const d = buildDeck();
    const cnt = (f) => d.filter(f).length;
    const res = {
      total: d.length,
      gwang: cnt((c) => c.t === "gwang"),
      yeol: cnt((c) => c.t === "yeol"),
      tti: cnt((c) => c.t === "tti"),
      pi: cnt((c) => c.t === "pi"),
      ssangpi: cnt((c) => c.pi === 2),
      perMonth: [...Array(12)].every((_, i) => cnt((c) => c.m === i + 1) === 4),
      uniqueIds: new Set(d.map((c) => c.id)).size === 48,
    };
    res.ok = res.total === 48 && res.gwang === 5 && res.yeol === 9 && res.tti === 10 && res.pi === 24 &&
      res.ssangpi === 2 && res.perMonth && res.uniqueIds;
    if (!res.ok) console.error("화투 덱 자체 점검 실패", res);
    return res;
  }

  const SUB_NAME = { hong: "홍단", cheong: "청단", cho: "초단" };
  function cardName(c) {
    let k;
    if (c.t === "gwang") k = c.bi ? "비광" : "광";
    else if (c.t === "yeol") k = c.bird ? "열끗(새)" : "열끗";
    else if (c.t === "tti") k = c.sub ? SUB_NAME[c.sub] + " 띠" : "띠";
    else k = c.pi === 2 ? "쌍피" : "피";
    return c.m + "월 " + k;
  }

  function cardValue(c) {
    if (c.t === "gwang") return c.bi ? 4 : 6;
    if (c.t === "yeol") return c.bird ? 5 : 3;
    if (c.t === "tti") return c.sub ? 3.5 : 2;
    return c.pi === 2 ? 3 : 1;
  }

  /* ---------------- 점수 계산 ---------------- */
  function scoreOf(cards) {
    const g = cards.filter((c) => c.t === "gwang");
    const y = cards.filter((c) => c.t === "yeol");
    const t = cards.filter((c) => c.t === "tti");
    const p = cards.filter((c) => c.t === "pi");
    const piCount = p.reduce((s, c) => s + c.pi, 0);
    let gw = 0;
    if (g.length >= 5) gw = 15;
    else if (g.length === 4) gw = 4;
    else if (g.length === 3) gw = g.some((c) => c.bi) ? 2 : 3;
    const has = (arr, m, f) => arr.some((c) => c.m === m && f(c));
    const godori = [2, 4, 8].every((m) => has(y, m, (c) => c.bird)) ? 5 : 0;
    const set = (ms, sub) => (ms.every((m) => has(t, m, (c) => c.sub === sub)) ? 3 : 0);
    const hong = set([1, 2, 3], "hong");
    const cheong = set([6, 9, 10], "cheong");
    const cho = set([4, 5, 7], "cho");
    const yeol = y.length >= 5 ? y.length - 4 : 0;
    const tti = t.length >= 5 ? t.length - 4 : 0;
    const pi = piCount >= 10 ? piCount - 9 : 0;
    const total = gw + godori + yeol + hong + cheong + cho + tti + pi;
    const items = [];
    if (gw) items.push((g.length === 3 && gw === 2 ? "비광 3광" : g.length + "광") + " " + gw + "점");
    if (godori) items.push("고도리 5점");
    if (yeol) items.push("열끗 " + y.length + "장 " + yeol + "점");
    if (hong) items.push("홍단 3점");
    if (cheong) items.push("청단 3점");
    if (cho) items.push("초단 3점");
    if (tti) items.push("띠 " + t.length + "장 " + tti + "점");
    if (pi) items.push("피 " + piCount + "장 " + pi + "점");
    return {
      gw, godori, yeol, hong, cheong, cho, tti, pi, total, items,
      n: { g: g.length, y: y.length, t: t.length, p: piCount },
      cat: { g: gw, y: yeol + godori, t: tti + hong + cheong + cho, p: pi },
    };
  }

  /* ---------------- 카드 그림 (직접 그린 단순 도안) ---------------- */
  function flower(cx, cy, r, col, mid) {
    let s = "";
    for (let i = 0; i < 5; i++) {
      const a = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      s += `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${(r * 0.75).toFixed(1)}" fill="${col}"/>`;
    }
    return s + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.5).toFixed(1)}" fill="${mid || "#f6d55c"}"/>`;
  }
  const ART = {
    1: () => `<rect x="18.5" y="34" width="3" height="12" fill="#6b4a2b"/><polygon points="20,6 8,22 32,22" fill="#2e7d32"/><polygon points="20,14 5,32 35,32" fill="#25692a"/><polygon points="20,22 3,40 37,40" fill="#1e5a23"/>`,
    2: () => `<path d="M4 44 Q16 30 22 20 T36 6" stroke="#5b3a24" stroke-width="2.4" fill="none"/>` + flower(12, 34, 4, "#d9578a") + flower(24, 20, 4, "#e46c9b") + flower(33, 9, 3.4, "#d9578a"),
    3: () => flower(10, 16, 4.5, "#f2a6bf", "#c94f73") + flower(28, 22, 5, "#eb8fb0", "#c94f73") + flower(14, 36, 5, "#f2a6bf", "#c94f73") + flower(31, 40, 3.6, "#eb8fb0", "#c94f73"),
    4: () => [8, 17, 26, 34].map((x, i) => `<line x1="${x}" y1="2" x2="${x}" y2="${30 + (i % 2) * 8}" stroke="#3a2a4a" stroke-width="1.2"/>` + [0, 1, 2, 3].map((k) => `<ellipse cx="${x}" cy="${8 + k * 7 + (i % 2) * 3}" rx="3.2" ry="2.6" fill="${k % 2 ? "#8a6bb8" : "#6a4c93"}"/>`).join("")).join(""),
    5: () => `<path d="M10 48 L16 22 M20 48 L20 18 M30 48 L24 22" stroke="#2e7d32" stroke-width="2.2"/><ellipse cx="14" cy="18" rx="4" ry="8" transform="rotate(-25 14 18)" fill="#3a6fc4"/><ellipse cx="26" cy="18" rx="4" ry="8" transform="rotate(25 26 18)" fill="#3a6fc4"/><ellipse cx="20" cy="13" rx="4" ry="8" fill="#5b8ee0"/>`,
    6: () => `<path d="M6 48 Q20 36 34 48" fill="#2e7d32"/>` + flower(20, 24, 8, "#c62828", "#f6d55c"),
    7: () => `<path d="M4 46 Q8 12 36 6" stroke="#5b3a24" stroke-width="1.8" fill="none"/>` + [[8, 34], [10, 24], [15, 16], [22, 11], [29, 8], [16, 30], [24, 20]].map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="2" transform="rotate(${-30 + i * 10} ${x} ${y})" fill="${i % 2 ? "#c2185b" : "#a0336b"}"/>`).join(""),
    8: () => `<path d="M0 50 L0 34 Q20 16 40 34 L40 50 Z" fill="#3b3a30"/><path d="M4 38 L6 32 M10 33 L12 27 M18 30 L19 24 M26 30 L27 24 M33 33 L35 28" stroke="#9c8a4a" stroke-width="1.4"/>`,
    9: () => `<path d="M20 48 L20 28" stroke="#2e7d32" stroke-width="2.4"/>` + flower(20, 22, 8, "#e8b100", "#a86b00") + flower(20, 22, 4, "#f6d55c", "#a86b00"),
    10: () => `<polygon points="20,6 24,16 34,13 28,22 36,28 25,29 26,40 20,33 14,40 15,29 4,28 12,22 6,13 16,16" fill="#d84315"/><path d="M20 33 L20 48" stroke="#6b3a1b" stroke-width="2"/>`,
    11: () => `<path d="M20 46 L20 30" stroke="#4a3a5a" stroke-width="2.2"/><path d="M20 32 C4 30 4 10 20 6 C36 10 36 30 20 32 Z" fill="#5d4a7a"/><path d="M20 30 L20 9 M20 18 L12 13 M20 18 L28 13 M20 25 L11 21 M20 25 L29 21" stroke="#a594c2" stroke-width="1.2"/>`,
    12: () => [4, 12, 20, 28, 36].map((x) => `<line x1="${x + 6}" y1="2" x2="${x - 4}" y2="48" stroke="#5f8fbf" stroke-width="1.6"/>`).join("") + `<path d="M6 30 Q20 16 34 30 Z" fill="#37597a"/><line x1="20" y1="24" x2="20" y2="44" stroke="#37597a" stroke-width="1.8"/>`,
  };

  function cardHTML(c, extra) {
    let svg = "";
    if (c.t === "gwang") svg += `<circle cx="20" cy="14" r="11" fill="${c.m === 8 ? "#f7e8a6" : c.m === 12 ? "#f08a24" : "#e53935"}" opacity=".9"/>`;
    svg += ART[c.m]();
    if (c.bird) svg += `<path d="M7 9 q4 -5 8 0 q4 -5 8 0" fill="none" stroke="#1d1b18" stroke-width="2.4" stroke-linecap="round"/>`;
    let badge = "";
    if (c.t === "gwang") badge = `<span class="hc-b b-gw">光</span>`;
    else if (c.t === "yeol") badge = `<span class="hc-b b-yeol">열</span>`;
    else if (c.pi === 2) badge = `<span class="hc-b b-ss">2</span>`;
    if (c.t === "tti") badge = `<span class="hc-rib r-${c.sub || "plain"}">${c.sub === "hong" ? "홍단" : c.sub === "cheong" ? "청단" : ""}</span>`;
    return `<div class="hc m${c.m} t-${c.t}${extra ? " " + extra : ""}" data-id="${c.id}" title="${cardName(c)}" style="--mc:${MONTH_COLORS[c.m]}">` +
      `<span class="hc-mo">${c.m}월</span><svg class="hc-art" viewBox="0 0 40 50" aria-hidden="true">${svg}</svg>${badge}</div>`;
  }
  const backHTML = (extra) => `<div class="hc back${extra ? " " + extra : ""}"></div>`;

  /* ---------------- 상태 ---------------- */
  const SPEED = { v: 1 };
  let token = 0;
  const S = {
    players: [],
    floor: [],
    pile: [],
    turn: 0,
    starter: 0,
    phase: "idle", // idle | human | busy | over
    ppeok: {}, // month -> owner index
    fresh: new Set(),
    log: "",
    round: 0,
    money: new Array(N).fill(0),
    nagari: 1, // 나가리 배수(다음 판 ×2)
    lastResult: null,
  };

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE));
      if (d && Array.isArray(d.money) && d.money.length === N) {
        S.money = d.money.map(Number);
        S.round = Number(d.round) || 0;
        S.nagari = Number(d.nagari) || 1;
        S.starter = Number(d.starter) || 0;
      }
    } catch (e) {}
  }
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ money: S.money, round: S.round, nagari: S.nagari, starter: S.starter }));
    } catch (e) {}
  }

  class Abort extends Error {}
  function wait(ms, tok) {
    return MG.sleep(ms * SPEED.v).then(() => {
      if (tok !== token) throw new Abort();
    });
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function deal() {
    for (;;) {
      const d = shuffle(buildDeck());
      const hands = [];
      for (let i = 0; i < N; i++) hands.push(d.splice(0, HAND_N));
      const floor = d.splice(0, FLOOR_N);
      const counts = {};
      floor.forEach((c) => (counts[c.m] = (counts[c.m] || 0) + 1));
      if (Object.values(counts).some((v) => v >= 4)) continue; // 바닥에 같은 월 4장 → 다시 섞기
      S.players = hands.map((h, i) => ({ name: NAMES[i], ai: i > 0, hand: sortHand(h), cap: [], go: 0, goScore: 0, shake: 0, bombSkips: 0 }));
      S.floor = floor;
      S.pile = d;
      return;
    }
  }
  function sortHand(h) {
    const order = { gwang: 0, yeol: 1, tti: 2, pi: 3 };
    return h.sort((a, b) => a.m - b.m || order[a.t] - order[b.t]);
  }

  // 낼 패도, 폭탄 패(뒤집기만)도 남지 않았는가
  function out(q) {
    return q.hand.length === 0 && !q.bombSkips;
  }
  function shakeMulOf(q) {
    return 2 ** (q.shake || 0);
  }

  function totalCards() {
    return S.floor.length + S.pile.length + S.players.reduce((s, p) => s + p.hand.length + p.cap.length, 0);
  }

  /* ---------------- 렌더링 ---------------- */
  const $ = (id) => document.getElementById(id);
  let el = {};

  function capGroupsHTML(p, compact) {
    const sc = scoreOf(p.cap);
    const groups = [
      ["광", "gwang", sc.n.g, sc.cat.g],
      ["열끗", "yeol", sc.n.y, sc.cat.y],
      ["띠", "tti", sc.n.t, sc.cat.t],
      ["피", "pi", sc.n.p, sc.cat.p],
    ];
    return groups.map(([label, t, n, pts]) => {
      const cards = p.cap.filter((c) => c.t === t).sort((a, b) => a.m - b.m);
      return `<div class="hw-cg${cards.length ? "" : " empty"}"><div class="hw-cg-h">${label} <b>${n}</b>${pts ? ` · <em>${pts}점</em>` : ""}</div>` +
        `<div class="hw-fan">${cards.map((c) => cardHTML(c, S.fresh.has(c.id) ? "fresh" : "")).join("")}</div></div>`;
    }).join("");
  }

  function scoreLabel(p) {
    const sc = scoreOf(p.cap).total;
    return `${sc}점${p.go ? ` · <span class="hw-go">${p.go}고</span>` : ""}${p.shake ? ` · <span class="hw-go">흔들 ×${shakeMulOf(p)}</span>` : ""}`;
  }

  function render() {
    // 상대
    el.opps.innerHTML = S.players.slice(1).map((p, k) => {
      const i = k + 1;
      const hand = p.hand.map(() => backHTML()).join("");
      return `<section class="hw-opp${S.turn === i && S.phase !== "over" ? " active" : ""}">
        <div class="hw-ph"><strong>${p.name}</strong><span class="hw-cnt">손패 ${p.hand.length}</span><span class="hw-sc">${scoreLabel(p)}</span></div>
        <div class="hw-ohand">${hand}</div>
        <div class="hw-cap">${capGroupsHTML(p)}</div></section>`;
    }).join("");

    // 바닥 (월별로 묶음)
    const byM = {};
    S.floor.forEach((c) => (byM[c.m] = byM[c.m] || []).push(c));
    const me = S.players[0];
    const myMonths = new Set(me ? me.hand.map((c) => c.m) : []);
    const groups = Object.keys(byM).map(Number).sort((a, b) => a - b).map((m) => {
      const pk = S.ppeok[m] !== undefined ? `<span class="hw-ppeok">뻑</span>` : "";
      return `<div class="hw-grp${S.phase === "human" && myMonths.has(m) ? " target" : ""}" data-m="${m}">${byM[m].map((c) => cardHTML(c, S.fresh.has(c.id) ? "fresh" : "")).join("")}${pk}</div>`;
    }).join("");
    el.floor.innerHTML = groups || `<p class="hw-empty">바닥이 비었습니다</p>`;
    el.pile.innerHTML = S.pile.length ? backHTML() + `<span class="hw-pilen">${S.pile.length}</span>` : `<span class="hw-pilen">0</span>`;

    // 나
    el.meHead.innerHTML = `<strong>${NAMES[0]}</strong><span class="hw-sc">${me ? scoreLabel(me) : ""}</span>` +
      (S.phase === "human" ? `<span class="hw-turn">내 차례 — 낼 카드를 고르세요</span>` : "");
    el.meCap.innerHTML = me ? capGroupsHTML(me) : "";
    const floorMonths = new Set(S.floor.map((c) => c.m));
    el.hand.innerHTML = me ? me.hand.map((c) => {
      let x = "";
      if (S.phase === "human") x = "playable" + (floorMonths.has(c.m) ? " match" : "");
      return cardHTML(c, x);
    }).join("") + (me.bombSkips ? `<button type="button" class="hc hw-bombskip${S.phase === "human" ? " playable" : ""}" data-id="bombskip" title="손패를 내지 않고 더미만 뒤집습니다">폭탄 패<br><small>뒤집기만 · ${me.bombSkips}회</small></button>` : "") : "";
    el.hand.classList.toggle("on", S.phase === "human");
    el.log.textContent = S.log;

    // 상태줄
    const money = S.money.map((v, i) => `<span class="pill">${NAMES[i]} ${fmtMoney(v)}</span>`).join("");
    el.status.innerHTML = `<span class="pill">${S.round}판</span>${money}` +
      (S.nagari > 1 ? `<span class="pill hw-nag">나가리 ×${S.nagari}</span>` : "") +
      `<span class="spacer"></span><span class="pill">${WIN_AT}점 나기</span>`;
  }
  function fmtMoney(v) {
    return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toLocaleString("ko-KR") + "원";
  }

  function setLog(msg) {
    S.log = msg;
    if (el.log) el.log.textContent = msg;
  }

  /* ---------------- 선택 / 고·스톱 ---------------- */
  function askChoice(pi, opts) {
    const p = S.players[pi];
    if (p.ai) {
      const sc0 = scoreOf(p.cap).total;
      let best = opts[0], bv = -1e9;
      opts.forEach((c) => {
        const v = cardValue(c) + (scoreOf(p.cap.concat(c)).total - sc0) * 3;
        if (v > bv) { bv = v; best = c; }
      });
      return Promise.resolve(best);
    }
    // 같은 종류면 묻지 않는다
    if (opts[0].t === opts[1].t && opts[0].pi === opts[1].pi && opts[0].sub === opts[1].sub && opts[0].bird === opts[1].bird) return Promise.resolve(opts[0]);
    return new Promise((res) => {
      MG.showModal({
        title: "어느 카드를 가져올까요?",
        html: `<p>바닥에 같은 월 카드가 두 장 있습니다. 하나를 고르세요.</p><div class="hw-choice">${opts.map((c) => cardHTML(c)).join("")}</div>`,
        buttons: opts.map((c, i) => ({ label: (i ? "② " : "① ") + cardName(c), primary: i === 0, onClick: () => res(c) })),
      });
    });
  }

  function askGo(pi, score) {
    const p = S.players[pi];
    if (p.ai) {
      const left = p.hand.length;
      const oppMax = Math.max(...S.players.filter((_, i) => i !== pi).map((q) => scoreOf(q.cap).total));
      const oppGo = S.players.some((q, i) => i !== pi && q.go > 0);
      let go;
      if (N === 2) go = left >= 3 && oppMax <= 3 && p.go < 3 && Math.random() < 0.75;
      else go = left >= 3 && oppMax <= 1 && !oppGo && p.go < 2 && Math.random() < 0.6;
      return Promise.resolve(go);
    }
    const sc = scoreOf(p.cap);
    return new Promise((res) => {
      MG.showModal({
        title: `${score}점! 고 또는 스톱`,
        html: `<p>${sc.items.join(", ")}</p><p>지금 스톱하면 이 판을 이깁니다. 고를 하면 계속 진행하고 점수가 오르지만, 상대가 먼저 나면 <b>고박</b>을 씁니다.</p><p>현재 ${p.go}고 · 다음은 ${p.go + 1}고 (${goBonusText(p.go + 1)})</p>`,
        buttons: [
          { label: "고!", primary: true, onClick: () => res(true) },
          { label: "스톱", onClick: () => res(false) },
        ],
      });
    });
  }
  function goBonusText(go) {
    if (go <= 0) return "보너스 없음";
    if (go <= 2) return "+" + go + "점";
    return "+2점 후 ×" + 2 ** (go - 2);
  }

  /* ---------------- 한 차례 진행 ---------------- */
  function removeFrom(arr, cards) {
    cards.forEach((c) => {
      const i = arr.indexOf(c);
      if (i >= 0) arr.splice(i, 1);
    });
  }

  function stealPi(to, count, reason) {
    if (count <= 0) return [];
    const got = [];
    S.players.forEach((q, i) => {
      if (i === to) return;
      for (let k = 0; k < count; k++) {
        const pis = q.cap.filter((c) => c.t === "pi");
        if (!pis.length) break;
        const c = pis.find((x) => x.pi === 1) || pis[0];
        q.cap.splice(q.cap.indexOf(c), 1);
        S.players[to].cap.push(c);
        S.fresh.add(c.id);
        got.push(q.name);
      }
    });
    return got;
  }

  // card: 낼 카드 (null 이면 폭탄 패로 더미만 뒤집기), opts.bomb: 같은 월 3장을 한꺼번에 낸다
  async function playTurn(pi, card, tok, opts) {
    const p = S.players[pi];
    const who = pi === 0 ? "나" : p.name;
    const bomb = !!(card && opts && opts.bomb);
    S.phase = "busy";
    S.fresh = new Set();
    const m = card ? card.m : 0;
    let F = [];
    if (card && !bomb) {
      p.hand.splice(p.hand.indexOf(card), 1);
      F = S.floor.filter((c) => c.m === m);
    }
    // 가져온 카드는 바로 먹은 패로 옮긴다 (총 48장 유지)
    const take = [];
    take.push = (...cs) => { cs.forEach((c) => { Array.prototype.push.call(take, c); p.cap.push(c); }); return take.length; };
    let steal = 0;
    const events = [];
    let placed = false;
    let pair = null;
    const msgs = [];

    if (!card) {
      p.bombSkips -= 1;
      msgs.push(`${who}: 폭탄 패 — 더미만 뒤집기`);
    } else if (bomb) {
      // 폭탄: 손의 같은 월 3장 + 바닥 1장을 모두 먹는다
      const B = p.hand.filter((c) => c.m === m);
      removeFrom(p.hand, B);
      const FB = S.floor.filter((c) => c.m === m);
      removeFrom(S.floor, FB);
      take.push(...B, ...FB);
      B.forEach((c) => S.fresh.add(c.id));
      steal += 1;
      p.shake += 1;
      p.bombSkips += 2;
      events.push("폭탄");
      msgs.push(`${who}: ${m}월 ${B.length}장 폭탄`);
    } else if (F.length === 0) {
      msgs.push(`${who}: ${cardName(card)} 냄`);
      S.floor.push(card);
      placed = true;
    } else if (F.length === 1) {
      msgs.push(`${who}: ${cardName(card)} 냄`);
      S.floor.push(card); // 잠깐 바닥에 겹쳐 보이게
      pair = [card, F[0]];
    } else if (F.length === 2) {
      msgs.push(`${who}: ${cardName(card)} 냄`);
      S.floor.push(card);
      render();
      const c = await askChoice(pi, F);
      if (tok !== token) throw new Abort();
      pair = [card, c];
    } else {
      // 3장(뻑 또는 처음부터 깔린 3장) → 4장 모두
      msgs.push(`${who}: ${cardName(card)} 냄`);
      removeFrom(S.floor, F);
      take.push(card, ...F);
      if (S.ppeok[m] !== undefined) {
        const own = S.ppeok[m] === pi;
        steal += own ? 2 : 1;
        events.push(own ? "자뻑 먹기" : "뻑 먹기");
        delete S.ppeok[m];
      } else events.push("싹쓸이(3장)");
    }
    if (card) S.fresh.add(card.id);
    setLog(msgs.join(" · "));
    render();
    await wait(pi === 0 ? 350 : 550, tok);

    // 더미 뒤집기
    const D = S.pile.pop();
    if (D) {
      S.fresh.add(D.id);
      msgs.push(`뒤집기 ${cardName(D)}`);
      if (card && !bomb && D.m === m && F.length < 3) {
        if (placed) {
          removeFrom(S.floor, [card]);
          take.push(card, D);
          steal += 1;
          events.push("쪽");
        } else if (F.length === 1) {
          // 뻑: 세 장이 바닥에 남는다
          S.floor.push(D);
          pair = null;
          S.ppeok[m] = pi;
          events.push("뻑");
        } else {
          // 따닥
          removeFrom(S.floor, F.concat(card));
          take.push(card, ...F, D);
          pair = null;
          steal += 1;
          events.push("따닥");
        }
      } else {
        if (pair) {
          removeFrom(S.floor, pair);
          take.push(...pair);
          pair = null;
        }
        const G = S.floor.filter((c) => c.m === D.m);
        if (G.length === 0) S.floor.push(D);
        else if (G.length === 1) {
          removeFrom(S.floor, G);
          take.push(D, G[0]);
        } else if (G.length === 2) {
          S.floor.push(D);
          render();
          const c = await askChoice(pi, G);
          if (tok !== token) throw new Abort();
          removeFrom(S.floor, [D, c]);
          take.push(D, c);
        } else {
          removeFrom(S.floor, G);
          take.push(D, ...G);
          if (S.ppeok[D.m] !== undefined) {
            const own = S.ppeok[D.m] === pi;
            steal += own ? 2 : 1;
            events.push(own ? "자뻑 먹기" : "뻑 먹기");
            delete S.ppeok[D.m];
          }
        }
      }
    } else if (pair) {
      removeFrom(S.floor, pair);
      take.push(...pair);
    }

    take.forEach((c) => S.fresh.add(c.id));
    // 쓸: 바닥을 비웠을 때 (마지막 차례 제외)
    const anyLeft = S.players.some((q) => !out(q));
    if (S.floor.length === 0 && take.length && anyLeft) {
      steal += 1;
      events.push("쓸");
    }
    if (steal) {
      const got = stealPi(pi, steal);
      if (got.length) msgs.push(`피 ${got.length}장 뺏음`);
    }
    if (take.length) msgs.push(`${take.length}장 가져옴`);
    if (events.length) {
      msgs.push(events.join("·") + "!");
      MG.toast(`${who === "나" ? "" : who + " "}${events.join(" · ")}!`, 1400);
    }
    setLog(msgs.join(" · "));
    render();
    await wait(pi === 0 ? 300 : 600, tok);
  }

  async function afterTurn(pi, tok) {
    const p = S.players[pi];
    const sc = scoreOf(p.cap).total;
    const threshold = p.go ? p.goScore + 1 : WIN_AT;
    if (sc >= threshold) {
      if (out(p)) return endRound(pi, tok); // 더 낼 패가 없으면 자동 스톱
      const go = await askGo(pi, sc);
      if (tok !== token) throw new Abort();
      if (go) {
        p.go += 1;
        p.goScore = sc;
        setLog(`${p.name}: ${p.go}고! (${sc}점)`);
        MG.toast(`${p.name === "나" ? "" : p.name + " "}${p.go}고!`, 1400);
        render();
        await wait(500, tok);
      } else {
        setLog(`${p.name}: 스톱! (${sc}점)`);
        return endRound(pi, tok);
      }
    }
    if (S.players.every(out)) return endRound(-1, tok);
    S.turn = (pi + 1) % N;
    return nextTurn(tok);
  }

  function countInHand(p, m) {
    return p.hand.filter((c) => c.m === m).length;
  }
  function floorCount(m) {
    return S.floor.filter((c) => c.m === m).length;
  }
  // 같은 월 3장 + 바닥 1장 → 폭탄 가능
  function canBomb(p, c) {
    return countInHand(p, c.m) >= 3 && floorCount(c.m) === 1;
  }
  // 같은 월 3장 + 바닥 0장 → 흔들기 가능 (그 월로 아직 흔들지 않았을 때)
  function canShake(p, c) {
    return countInHand(p, c.m) >= 3 && floorCount(c.m) === 0 && !(p.shook || []).includes(c.m);
  }

  function aiMove(pi) {
    const p = S.players[pi];
    if (!p.hand.length) return { card: null };
    const bombCard = p.hand.find((c) => canBomb(p, c));
    if (bombCard) return { card: bombCard, bomb: true };
    const card = aiPick(pi);
    // 먹을 게 없으면 폭탄 패로 뒤집기만 한다
    if (p.bombSkips && floorCount(card.m) === 0) return { card: null };
    return { card, shake: canShake(p, card) && Math.random() < 0.85 };
  }

  function aiPick(pi) {
    const p = S.players[pi];
    const sc0 = scoreOf(p.cap).total;
    let best = p.hand[0], bv = -1e9;
    p.hand.forEach((c) => {
      const F = S.floor.filter((f) => f.m === c.m);
      let v;
      if (F.length === 0) {
        v = -cardValue(c) * 0.6;
        // 손에 같은 월이 더 있으면 버려도 다시 먹을 수 있음
        if (p.hand.some((h) => h !== c && h.m === c.m)) v += 1.5;
      } else {
        let got = F.length === 3 ? F.concat(c) : [c, F.slice().sort((a, b) => cardValue(b) - cardValue(a))[0]];
        v = got.reduce((s, x) => s + cardValue(x), 0) + (scoreOf(p.cap.concat(got)).total - sc0) * 4;
        if (F.length === 3) v += 3;
        if (F.length === 1 && p.hand.some((h) => h !== c && h.m === c.m)) v -= 0.5;
      }
      v += Math.random() * 0.4;
      if (v > bv) { bv = v; best = c; }
    });
    return best;
  }

  async function declareShake(pi, card, tok) {
    const p = S.players[pi];
    p.shake += 1;
    (p.shook = p.shook || []).push(card.m);
    const who = pi === 0 ? "나" : p.name;
    const shown = p.hand.filter((c) => c.m === card.m).map(cardName).join(", ");
    setLog(`${who}: 흔들기! (${shown}) — 이기면 ×${shakeMulOf(p)}`);
    MG.toast(`${pi === 0 ? "" : p.name + " "}흔들기! ${card.m}월 ×3`, 1600);
    render();
    await wait(700, tok);
  }

  async function nextTurn(tok) {
    if (tok !== token) return;
    const p = S.players[S.turn];
    if (out(p)) {
      if (S.players.every(out)) return endRound(-1, tok);
      S.turn = (S.turn + 1) % N;
      return nextTurn(tok);
    }
    if (!p.ai) {
      S.phase = "human";
      render();
      return;
    }
    S.phase = "busy";
    setLog(`${p.name} 차례…`);
    render();
    await wait(450, tok);
    const mv = aiMove(S.turn);
    if (mv.shake) await declareShake(S.turn, mv.card, tok);
    await playTurn(S.turn, mv.card, tok, { bomb: mv.bomb });
    return afterTurn(S.turn, tok);
  }

  function ask(title, html, yes, no) {
    return new Promise((res) => {
      MG.showModal({
        title,
        html,
        buttons: [
          { label: yes, primary: true, onClick: () => res(true) },
          { label: no, onClick: () => res(false) },
        ],
      });
    });
  }

  async function humanPlay(id) {
    if (S.phase !== "human" || S.turn !== 0) return;
    const p = S.players[0];
    const tok = token;
    let card = null, bomb = false, shake = false;
    if (id === "bombskip") {
      if (!p.bombSkips) return;
    } else {
      card = p.hand.find((c) => c.id === id);
      if (!card) return;
    }
    S.phase = "busy"; // 묻는 동안 다른 카드를 누르지 못하게
    try {
      if (card && canBomb(p, card)) {
        bomb = await ask("폭탄?", `<p>손에 ${card.m}월이 3장, 바닥에 1장 있습니다. <b>폭탄</b>을 하면 3장을 한꺼번에 내서 4장을 모두 먹고, 상대마다 피 1장을 뺏습니다. 이기면 <b>×2</b>, 그리고 더미만 뒤집는 <b>폭탄 패</b> 2번을 받습니다.</p>`, "폭탄!", "한 장만 내기");
      } else if (card && canShake(p, card)) {
        shake = await ask("흔들기?", `<p>손에 ${card.m}월이 3장 있습니다. <b>흔들기</b>를 하면 상대에게 3장을 보여주고, 이 판을 이기면 점수가 <b>×2</b>가 됩니다.</p>`, "흔들기!", "그냥 내기");
      }
      if (tok !== token) return;
      if (shake) await declareShake(0, card, tok);
      await playTurn(0, card, tok, { bomb });
      await afterTurn(0, tok);
    } catch (e) {
      if (!(e instanceof Abort)) throw e;
    }
  }

  /* ---------------- 정산 ---------------- */
  function settle(wi) {
    const w = S.players[wi];
    const ws = scoreOf(w.cap);
    const base = ws.total;
    const goBonus = Math.min(w.go, 2);
    const goMul = w.go >= 3 ? 2 ** (w.go - 2) : 1;
    const meong = ws.n.y >= 7 ? 2 : 1;
    const shakeMul = shakeMulOf(w);
    const pts = base + goBonus;
    const rows = [];
    let goBakIdx = -1;
    S.players.forEach((q, i) => {
      if (i === wi) return;
      const qs = scoreOf(q.cap);
      const tags = [];
      let mul = goMul * meong * shakeMul * S.nagari;
      if (ws.pi > 0 && qs.n.p < 7) { mul *= 2; tags.push("피박 ×2"); }
      if (ws.gw > 0 && qs.n.g === 0) { mul *= 2; tags.push("광박 ×2"); }
      if (q.go > 0) {
        if (N === 2) { mul *= 2; tags.push("고박 ×2"); }
        else if (goBakIdx < 0) goBakIdx = i;
      }
      rows.push({ i, mul, tags, amount: pts * mul });
    });
    if (goBakIdx >= 0) {
      const sum = rows.reduce((s, r) => s + r.amount, 0);
      rows.forEach((r) => {
        if (r.i === goBakIdx) { r.tags.push("고박: 다른 사람 몫까지 혼자 냄"); r.pay = sum; }
        else { r.tags.push(`${S.players[goBakIdx].name}가 대신 냄`); r.pay = 0; }
      });
    } else rows.forEach((r) => (r.pay = r.amount));
    return { base, goBonus, goMul, meong, shakeMul, pts, rows, ws };
  }

  async function endRound(wi, tok) {
    if (tok !== token) return;
    S.phase = "over";
    render();
    await wait(400, tok);
    let html = "";
    let title;
    if (wi < 0) {
      title = "나가리";
      html += `<p>아무도 나지 못하고 패가 모두 소진되었습니다. 다음 판은 <b>×${S.nagari * 2}</b> 입니다.</p>`;
      S.nagari *= 2;
      S.lastResult = { nagari: true };
    } else {
      const w = S.players[wi];
      const r = settle(wi);
      title = wi === 0 ? "승리!" : `${w.name} 승리`;
      const calc = [`기본 ${r.base}점`];
      if (r.goBonus) calc.push(`${w.go}고 +${r.goBonus}`);
      html += `<p><b>${w.name}</b> — ${r.ws.items.join(", ")}</p><p>${calc.join(" ")} = <b>${r.pts}점</b>` +
        (r.goMul > 1 ? ` · ${w.go}고 ×${r.goMul}` : "") + (r.meong > 1 ? " · 멍따(열끗 7장↑) ×2" : "") + (r.shakeMul > 1 ? ` · 흔들기·폭탄 ${w.shake}번 ×${r.shakeMul}` : "") +
        (S.nagari > 1 ? ` · 나가리 ×${S.nagari}` : "") + `</p><ul class="hw-pay">`;
      let gain = 0;
      r.rows.forEach((row) => {
        const q = S.players[row.i];
        const won = row.pay * PER_POINT;
        gain += won;
        S.money[row.i] -= won;
        html += `<li><b>${q.name}</b> (${scoreOf(q.cap).total}점, 피 ${scoreOf(q.cap).n.p}·광 ${scoreOf(q.cap).n.g}): ${r.pts}점 × ${row.mul} = ${row.amount}점` +
          (row.tags.length ? ` <span class="hw-tags">${row.tags.join(", ")}</span>` : "") + ` → <b>${won.toLocaleString("ko-KR")}원</b> 지불</li>`;
      });
      S.money[wi] += gain;
      html += `</ul><p>${w.name} <b>+${gain.toLocaleString("ko-KR")}원</b> (점당 ${PER_POINT}원)</p>`;
      S.nagari = 1;
      S.starter = wi;
      S.lastResult = { winner: wi, gain, pts: r.pts };
    }
    html += `<div class="hw-sum">${S.players.map((q) => `<div><b>${q.name}</b> ${scoreOf(q.cap).total}점${q.go ? ` (${q.go}고)` : ""}${q.shake ? ` (흔들 ${q.shake})` : ""} · ${fmtMoney(S.money[S.players.indexOf(q)])}<br><small>${scoreOf(q.cap).items.join(", ") || "점수 없음"}</small></div>`).join("")}</div>`;
    save();
    render();
    MG.showModal({ title, html, buttons: [{ label: "다음 판", primary: true, onClick: () => newRound() }] });
  }

  function newRound() {
    token++;
    MG.hideModal();
    S.round += 1;
    S.ppeok = {};
    S.fresh = new Set();
    deal();
    S.turn = S.starter;
    S.phase = "busy";
    setLog(`${S.round}판 시작 — ${S.players[S.turn].name === "나" ? "내가" : S.players[S.turn].name + "가"} 먼저 냅니다.`);
    save();
    render();
    const tok = token;
    nextTurn(tok).catch((e) => {
      if (!(e instanceof Abort)) throw e;
    });
  }

  /* ---------------- 규칙 ---------------- */
  function rulesHTML() {
    return `<ul class="hw-rules">
<li><b>인원·배분</b>: ${N === 2 ? "맞고 2인 — 손패 10장, 바닥 8장" : "고스톱 3인 — 손패 7장, 바닥 6장"}, 나머지는 더미. 바닥에 같은 월 4장이 깔리면 다시 섞습니다.</li>
<li><b>차례</b>: 손패 1장을 내 같은 월 바닥 카드를 먹고, 더미 맨 위를 뒤집어 한 번 더 맞춥니다. 같은 월이 2장이면 하나를 고릅니다.</li>
<li><b>뻑</b>: 낸 카드로 1장을 맞췄는데 뒤집은 카드도 같은 월이면 3장이 바닥에 남습니다. 나중에 4번째 카드로 모두 먹으면 상대마다 피 1장(자기 뻑은 2장)을 뺏습니다.</li>
<li><b>쪽</b>: 낸 카드가 맞지 않았는데 뒤집은 카드가 그 카드와 맞으면 → 피 1장씩 뺏기. <b>따닥</b>: 바닥 2장 + 낸 카드 + 뒤집은 카드 4장 모두 → 피 1장씩. <b>쓸</b>: 바닥을 모두 비우면 → 피 1장씩 (마지막 차례 제외).</li>
<li><b>흔들기</b>: 손에 같은 월 3장이 있고 바닥에 그 월이 없을 때, 그중 한 장을 내면서 흔들 수 있습니다. 이기면 ×2 (흔들기·폭탄 할 때마다 ×2씩 누적).</li>
<li><b>폭탄</b>: 손에 같은 월 3장, 바닥에 1장이 있으면 3장을 한꺼번에 내 4장을 모두 먹고 상대마다 피 1장을 뺏습니다. 흔들기처럼 ×2가 붙고, 손패가 2장 줄어든 대신 손패를 내지 않고 더미만 뒤집는 <b>폭탄 패</b>를 2번 받습니다.</li>
<li><b>광</b>: 3광 3점(비광이 끼면 2점), 4광 4점, 5광 15점.</li>
<li><b>열끗</b>: 5장 1점, 1장마다 +1. <b>고도리</b>(2·4·8월 새) 5점. 9월 국진은 열끗으로만 셉니다.</li>
<li><b>띠</b>: 5장 1점, 1장마다 +1. 홍단(1·2·3월)·청단(6·9·10월)·초단(4·5·7월) 각 3점.</li>
<li><b>피</b>: 10장 1점, 1장마다 +1. 쌍피(11월 1장, 12월 1장)는 2장으로 셉니다.</li>
<li><b>고/스톱</b>: ${WIN_AT}점 이상이면 날 수 있습니다. 고를 하면 점수가 더 오를 때마다 다시 고/스톱을 고릅니다. 1고 +1점, 2고 +2점, 3고부터 ×2, 4고 ×4… 마지막 패를 낸 뒤에는 자동 스톱.</li>
<li><b>박</b>(진 사람마다): 피박 — 이긴 사람이 피로 점수를 냈고 진 사람의 피가 7장 미만이면 ×2. 광박 — 이긴 사람이 광 점수가 있고 진 사람이 광 0장이면 ×2. 멍따 — 이긴 사람 열끗 7장 이상이면 ×2.</li>
<li><b>고박</b>: 고를 부른 사람이 지면 ${N === 2 ? "×2를 냅니다" : "다른 진 사람 몫까지 혼자 모두 냅니다"}.</li>
<li><b>나가리</b>: 아무도 스톱하지 못하고 패가 끝나면 무효, 다음 판은 ×2.</li>
<li><b>정산</b>: 점당 ${PER_POINT}원, 누적 금액은 이 기기에 저장됩니다.</li>
<li><b>생략한 규칙</b>: 총통·3뻑·첫뻑 보너스·보너스패·국진 쌍피 선택은 없습니다.</li>
</ul>`;
  }

  /* ---------------- 초기화 ---------------- */
  function init() {
    selfCheck();
    el = {
      status: $("status"),
      opps: $("hwOpps"),
      floor: $("hwFloor"),
      pile: $("hwPile"),
      log: $("hwLog"),
      meHead: $("hwMeHead"),
      meCap: $("hwMeCap"),
      hand: $("hwHand"),
    };
    el.hand.addEventListener("click", (e) => {
      const c = e.target.closest(".hc");
      if (c) humanPlay(c.dataset.id);
    });
    // 손패에 올리면 바닥의 같은 월 강조
    el.hand.addEventListener("pointerover", (e) => {
      const c = e.target.closest(".hc");
      const mm = c && c.className.match(/\bm(\d+)\b/);
      el.floor.querySelectorAll(".hw-grp").forEach((g) => g.classList.toggle("hover", !!mm && S.phase === "human" && g.dataset.m === mm[1]));
    });
    el.hand.addEventListener("pointerleave", () => el.floor.querySelectorAll(".hw-grp.hover").forEach((g) => g.classList.remove("hover")));
    $("rulesBtn").addEventListener("click", () => MG.showModal({ title: (N === 2 ? "맞고" : "고스톱") + " 규칙", html: rulesHTML() }));
    $("newGame").addEventListener("click", () => newRound());
    const reset = $("resetMoney");
    if (reset) reset.addEventListener("click", () => MG.showModal({
      title: "점수 초기화",
      html: "<p>누적 금액과 판 수를 0으로 되돌릴까요?</p>",
      buttons: [
        { label: "초기화", primary: true, onClick: () => { S.money = new Array(N).fill(0); S.round = 0; S.nagari = 1; S.starter = 0; save(); newRound(); } },
        { label: "취소" },
      ],
    }));
    load();
    newRound();
  }

  window.HW = {
    N, MODE, WIN_AT, buildDeck, scoreOf, selfCheck, cardName, settle, totalCards,
    state: S,
    render: () => render(),
    setSpeed: (v) => (SPEED.v = v),
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
