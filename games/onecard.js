// 원카드 — 플레이어 vs 컴퓨터 1~3명
(function () {
  "use strict";

  const SYM = Cards.SUIT_SYMBOL;
  const SNAME = Cards.SUIT_NAME;
  const HAND_SIZE = 7;
  const BANKRUPT = 20; // 이 장수 이상이면 파산
  const AI_DELAY = /[?&]fast\b/.test(location.search) ? 20 : 650; // ?fast 는 자동 테스트용

  // 공격 카드: 세기(strength)와 받을 장수(value)
  function attackInfo(card) {
    if (card.joker === "color") return { str: 4, val: 7 };
    if (card.joker === "black") return { str: 3, val: 5 };
    if (card.rank === 1) return { str: 2, val: 3 };
    if (card.rank === 2) return { str: 1, val: 2 };
    return null;
  }

  function label(card) {
    if (card.joker) return card.joker === "color" ? "컬러 조커" : "흑백 조커";
    return SYM[card.suit] + Cards.rankLabel(card.rank);
  }

  // 받침 조사: 을/를, 이/가, 으로/로
  const DIGIT_JONG = { 0: 1, 1: 8, 3: 1, 6: 1, 7: 8, 8: 8 }; // 영 일 삼 육 칠 팔 (8 = ㄹ)
  function josa(word, pair) {
    const last = word[word.length - 1];
    const ch = word.charCodeAt(word.length - 1);
    let jong = 0;
    if (ch >= 0xac00 && ch <= 0xd7a3) jong = (ch - 0xac00) % 28;
    else if (/[0-9]/.test(last)) jong = DIGIT_JONG[last] || 0;
    if (pair[0] === "으로") return word + (jong && jong !== 8 ? "으로" : "로");
    return word + (jong ? pair[0] : pair[1]);
  }

  let G = null; // 게임 상태
  let gameSeq = 0;
  let humanResolve = null;

  const $ = (id) => document.getElementById(id);

  // ---------- 카드 더미 ----------
  function reshuffleIfNeeded() {
    if (G.draw.length > 0 || G.discard.length <= 1) return;
    const top = G.discard.pop();
    G.draw = Cards.shuffle(G.discard);
    G.discard = [top];
    addLog("버린 카드를 섞어 새 더미를 만들었어요");
  }

  function drawCards(p, n) {
    let got = 0;
    for (let i = 0; i < n; i++) {
      reshuffleIfNeeded();
      if (!G.draw.length) break;
      const c = G.draw.pop();
      p.hand.push(c);
      if (p.human) G.fresh.add(c.id);
      got++;
    }
    return got;
  }

  // ---------- 규칙 ----------
  function canPlay(card) {
    if (G.attack > 0) {
      const a = attackInfo(card);
      if (!a || a.str < G.attackStr) return false;
      if (card.joker) return true;
      return G.suit === null || card.suit === G.suit || card.rank === G.rank;
    }
    if (card.joker) return true;
    if (G.suit === null) return true; // 조커 다음: 아무 카드나
    return card.suit === G.suit || card.rank === G.rank;
  }

  function activePlayers() {
    return G.players.filter((p) => !p.out);
  }

  function nextIndex(from, steps) {
    const n = G.players.length;
    let i = from;
    let s = steps;
    let guard = 0;
    while (s > 0 && guard++ < 50) {
      i = (i + G.dir + n) % n;
      if (!G.players[i].out) s--;
    }
    return i;
  }

  // ---------- 기록 ----------
  function addLog(msg) {
    G.log.unshift(msg);
    if (G.log.length > 5) G.log.length = 5;
    renderLog();
  }

  // ---------- 진행 ----------
  function newGame() {
    gameSeq++;
    if (humanResolve) { humanResolve(null); humanResolve = null; }
    MG.hideModal();
    const nOpp = parseInt($("oppSelect").value, 10) || 2;
    const players = [{ name: "나", human: true, hand: [], out: false }];
    for (let i = 1; i <= nOpp; i++) players.push({ name: "컴퓨터" + i, human: false, hand: [], out: false });

    G = {
      players,
      draw: Cards.shuffle(Cards.makeDeck({ jokers: true })),
      discard: [],
      suit: null,
      rank: 0,
      attack: 0,
      attackStr: 0,
      dir: 1,
      cur: 0,
      over: false,
      busy: false,
      log: [],
      fresh: new Set(),
    };
    for (let r = 0; r < HAND_SIZE; r++) players.forEach((p) => p.hand.push(G.draw.pop()));
    G.fresh.clear();
    const first = G.draw.pop();
    G.discard.push(first);
    G.suit = first.joker ? null : first.suit;
    G.rank = first.joker ? 0 : first.rank;
    addLog(`첫 카드는 ${label(first)}. 내 차례부터 시작!`);
    render();
    loop(gameSeq);
  }

  async function loop(seq) {
    while (G && seq === gameSeq && !G.over) {
      const p = G.players[G.cur];
      render();
      let action;
      if (p.human) {
        action = await new Promise((res) => { humanResolve = res; });
        humanResolve = null;
        if (seq !== gameSeq || !action) return;
      } else {
        await MG.sleep(AI_DELAY);
        if (seq !== gameSeq) return;
        action = aiChoose(p);
      }
      if (action.type === "play") applyPlay(p, action.card, action.suit);
      else applyDraw(p);
      if (p.human) G.fresh.clear();
    }
    if (G && seq === gameSeq) render();
  }

  function applyPlay(p, card, chosenSuit) {
    const idx = p.hand.indexOf(card);
    p.hand.splice(idx, 1);
    G.discard.push(card);
    const subj = josa(p.name, ["이", "가"]);
    const lb = label(card);
    G.suit = card.joker ? null : card.suit;
    G.rank = card.joker ? 0 : card.rank;

    const a = attackInfo(card);
    let msg = `${subj} ${josa(lb, ["을", "를"])} 냈어요`;
    let next = nextIndex(G.cur, 1);

    if (a) {
      G.attack += a.val;
      G.attackStr = a.str;
      msg = `${subj} ${josa(lb, ["으로", "로"])} 공격! (누적 +${G.attack})`;
    } else if (card.rank === 7) {
      G.suit = chosenSuit || card.suit;
      msg = `${subj} ${josa(lb, ["을", "를"])} 내고 ${SYM[G.suit]}${SNAME[G.suit]}로 바꿨어요`;
    } else if (card.rank === 11) {
      next = nextIndex(G.cur, 2);
      const skipped = G.players[nextIndex(G.cur, 1)];
      msg = `${subj} ${josa(lb, ["을", "를"])} 내서 ${skipped.name} 차례를 건너뛰어요`;
    } else if (card.rank === 12) {
      if (activePlayers().length > 2) {
        G.dir = -G.dir;
        next = nextIndex(G.cur, 1);
        msg = `${subj} ${josa(lb, ["을", "를"])} 내서 방향이 바뀌었어요`;
      }
    } else if (card.rank === 13) {
      next = G.cur;
      msg = `${subj} ${josa(lb, ["을", "를"])} 내고 한 장 더 내요`;
    }
    addLog(msg);

    if (p.hand.length === 0) {
      endGame(p, "카드를 모두 냈어요");
      return;
    }
    if (p.hand.length === 1) {
      MG.toast(`${p.name}: 원카드!`);
      addLog(`${p.name}: 원카드!`);
    }
    G.cur = next;
  }

  function applyDraw(p) {
    const subj = josa(p.name, ["이", "가"]);
    if (G.attack > 0) {
      const want = G.attack;
      const got = drawCards(p, want);
      addLog(`${subj} 공격을 받아 ${got}장을 받았어요`);
      if (p.human) MG.toast(`공격! ${got}장을 받았어요`);
      G.attack = 0;
      G.attackStr = 0;
    } else {
      const got = drawCards(p, 1);
      addLog(got ? `${subj} 카드를 한 장 받았어요` : `${subj} 받을 카드가 없어 넘겼어요`);
    }

    if (p.hand.length >= BANKRUPT) {
      p.out = true;
      G.draw = Cards.shuffle(G.draw.concat(p.hand));
      p.hand = [];
      addLog(`${subj} 카드 ${BANKRUPT}장 이상으로 파산했어요`);
      MG.toast(`${p.name} 파산!`);
      if (p.human) { endGame(null, "카드가 20장 이상이 되어 파산했어요"); return; }
      const alive = activePlayers();
      if (alive.length === 1) { endGame(alive[0], "다른 플레이어가 모두 파산했어요"); return; }
    }
    G.cur = nextIndex(G.cur, 1);
  }

  function endGame(winner, why) {
    G.over = true;
    render();
    const human = G.players[0];
    const won = winner && winner.human;
    const rows = G.players
      .slice()
      .sort((a, b) => (a === winner ? -1 : b === winner ? 1 : (a.out - b.out) || a.hand.length - b.hand.length))
      .map((p) => `<li>${p.name} — ${p.out ? "파산" : p === winner ? "승리" : p.hand.length + "장 남음"}</li>`)
      .join("");
    const title = won ? "승리했어요!" : "아쉽게 졌어요";
    const head = winner ? `${josa(winner.name, ["이", "가"])} ${why}.` : `${why}.`;
    addLog(winner ? `${josa(winner.name, ["이", "가"])} 이겼어요!` : "게임 종료");
    MG.showModal({
      title,
      html: `<p>${head}</p><ul>${rows}</ul>`,
      buttons: [
        { label: "닫기" },
        { label: "다시 하기", primary: true, onClick: newGame },
      ],
    });
  }

  // ---------- 컴퓨터 ----------
  function mostSuit(hand, exclude) {
    const cnt = { S: 0, H: 0, D: 0, C: 0 };
    hand.forEach((c) => { if (c !== exclude && c.suit) cnt[c.suit]++; });
    let best = "S";
    for (const s of Cards.SUITS) if (cnt[s] > cnt[best]) best = s;
    return best;
  }

  function aiChoose(p) {
    const playable = p.hand.filter(canPlay);
    if (!playable.length) return { type: "draw" };

    if (G.attack > 0) {
      // 가장 약한 공격 카드로 막는다
      playable.sort((a, b) => attackInfo(a).str - attackInfo(b).str);
      return { type: "play", card: playable[0] };
    }

    const nextP = G.players[nextIndex(G.cur, 1)];
    const danger = nextP.hand.length <= 2;
    function score(c) {
      const a = attackInfo(c);
      let s = 0;
      if (c.joker) s = danger ? 60 : -40;
      else if (a) s = danger ? 50 : 10 + a.val;
      else if (c.rank === 7) {
        const others = p.hand.filter((x) => x !== c);
        s = others.some((x) => canPlay(x) && x.rank !== 7) ? -20 : 15;
      } else if (c.rank === 13) {
        const rest = p.hand.filter((x) => x !== c);
        s = rest.some((x) => x.joker || x.suit === c.suit || x.rank === 13) ? 30 : 2;
      } else if (c.rank === 11) s = danger ? 40 : 12;
      else if (c.rank === 12) s = 8;
      else s = 20;
      // 같은 무늬를 많이 가진 카드를 먼저
      if (c.suit) s += p.hand.filter((x) => x.suit === c.suit).length;
      return s + Math.random() * 3;
    }
    playable.sort((a, b) => score(b) - score(a));
    const card = playable[0];
    const act = { type: "play", card };
    if (!card.joker && card.rank === 7) act.suit = mostSuit(p.hand, card);
    return act;
  }

  // ---------- 사람 입력 ----------
  function onCardClick(card) {
    if (!G || G.over || G.busy || !humanResolve || !G.players[G.cur].human) return;
    if (!canPlay(card)) {
      MG.toast(G.attack > 0 ? "같거나 더 센 공격 카드로만 막을 수 있어요" : "무늬나 숫자가 같은 카드만 낼 수 있어요");
      return;
    }
    if (!card.joker && card.rank === 7 && G.attack === 0) {
      G.busy = true;
      const res = humanResolve;
      MG.showModal({
        title: "무늬를 골라 주세요",
        html: "<p>7을 내면 다음 사람이 낼 무늬를 바꿀 수 있어요.</p>",
        buttons: Cards.SUITS.map((s) => ({
          label: `${SYM[s]} ${SNAME[s]}`,
          primary: s === mostSuit(G.players[0].hand, card),
          onClick: () => { G.busy = false; res({ type: "play", card, suit: s }); },
        })),
      });
      return;
    }
    humanResolve({ type: "play", card });
  }

  function onDrawClick() {
    if (!G || G.over || G.busy || !humanResolve || !G.players[G.cur].human) return;
    humanResolve({ type: "draw" });
  }

  // ---------- 그리기 ----------
  function renderLog() {
    const ul = $("log");
    ul.innerHTML = "";
    G.log.forEach((m) => {
      const li = document.createElement("li");
      li.textContent = m;
      ul.appendChild(li);
    });
  }

  function render() {
    if (!G) return;
    const cur = G.players[G.cur];
    const humanTurn = !G.over && cur.human;

    // 상태 줄
    $("turnPill").textContent = G.over ? "게임 끝" : `차례: ${cur.name}`;
    const arrow = G.dir === 1 ? "→" : "←";
    $("dirPill").textContent = `방향 ${G.dir === 1 ? "↻ 정방향" : "↺ 역방향"}`;
    $("deckPill").textContent = `더미 ${G.draw.length}장`;

    // 상대
    const opps = $("opps");
    opps.innerHTML = "";
    G.players.forEach((p, i) => {
      if (p.human) return;
      const box = document.createElement("div");
      box.className = "oc-opp" + (i === G.cur && !G.over ? " turn" : "") + (p.out ? " out" : "");
      const name = document.createElement("div");
      name.className = "oc-opp-name";
      name.textContent = p.name;
      if (p.out) name.insertAdjacentHTML("beforeend", '<span class="oc-badge bad">파산</span>');
      else if (p.hand.length === 1) name.insertAdjacentHTML("beforeend", '<span class="oc-badge">원카드!</span>');
      box.appendChild(name);
      const fan = document.createElement("div");
      fan.className = "card-fan";
      const show = Math.min(p.hand.length, 8);
      for (let k = 0; k < show; k++) fan.appendChild(Cards.renderCard(p.hand[k], { faceDown: true }));
      box.appendChild(fan);
      const cnt = document.createElement("div");
      cnt.className = "oc-count";
      cnt.textContent = p.out ? "탈락" : `${p.hand.length}장`;
      box.appendChild(cnt);
      opps.appendChild(box);
    });

    // 가운데
    const dp = $("drawPile");
    dp.innerHTML = "";
    dp.appendChild(G.draw.length ? Cards.renderCard(G.draw[0], { faceDown: true }) : Cards.renderCard(null));
    $("drawCount").textContent = `더미 ${G.draw.length}장`;
    const dt = $("discardTop");
    dt.innerHTML = "";
    dt.appendChild(Cards.renderCard(G.discard[G.discard.length - 1]));

    const sb = $("suitBadge");
    if (G.suit) {
      sb.textContent = SYM[G.suit];
      sb.className = "oc-suit" + (G.suit === "H" || G.suit === "D" ? " red" : "");
      $("suitLabel").textContent = `현재 무늬: ${SNAME[G.suit]}`;
    } else {
      sb.textContent = "자유";
      sb.className = "oc-suit any";
      $("suitLabel").textContent = "아무 카드나 가능";
    }
    const ab = $("attackBadge");
    ab.hidden = G.attack === 0;
    ab.textContent = `공격 +${G.attack}`;
    const order = activePlayers().length;
    $("dirLabel").textContent = order > 2 ? `진행 ${arrow}` : "";

    // 내 손패
    const me = G.players[0];
    $("meBox").className = "oc-me" + (humanTurn ? " turn" : "");
    $("myCount").textContent = me.hand.length;
    $("myBadge").innerHTML = me.out
      ? '<span class="oc-badge bad">파산</span>'
      : me.hand.length === 1 ? '<span class="oc-badge">원카드!</span>' : "";
    let hint = "";
    if (humanTurn) {
      const any = me.hand.some(canPlay);
      if (G.attack > 0) hint = any ? `공격 +${G.attack}! 막거나 카드를 받으세요` : `막을 카드가 없어요. ${G.attack}장을 받으세요`;
      else hint = any ? "낼 카드를 누르세요" : "낼 카드가 없어요. 카드를 받으세요";
    } else if (!G.over) hint = `${cur.name} 차례예요…`;
    $("myHint").textContent = hint;

    const sorted = me.hand.slice().sort((a, b) => {
      const ka = a.joker ? 100 + (a.joker === "color" ? 1 : 0) : Cards.SUITS.indexOf(a.suit) * 20 + a.rank;
      const kb = b.joker ? 100 + (b.joker === "color" ? 1 : 0) : Cards.SUITS.indexOf(b.suit) * 20 + b.rank;
      return ka - kb;
    });
    const hand = $("hand");
    hand.innerHTML = "";
    sorted.forEach((c) => {
      const ok = humanTurn && canPlay(c);
      const el = Cards.renderCard(c, { clickable: ok });
      if (humanTurn) el.classList.add(ok ? "playable" : "dim");
      if (G.fresh.has(c.id)) el.classList.add("flash");
      if (ok) {
        el.addEventListener("click", () => onCardClick(c));
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onCardClick(c); }
        });
      }
      hand.appendChild(el);
    });

    const db = $("drawBtn");
    db.disabled = !humanTurn;
    db.textContent = humanTurn && G.attack > 0 ? `카드 ${G.attack}장 받기` : "카드 받기";
  }

  // ---------- 규칙 창 ----------
  function showRules() {
    MG.showModal({
      title: "원카드 규칙",
      html: `
        <p>손에 든 카드를 먼저 모두 내면 이겨요.</p>
        <ul>
          <li>각자 7장씩 받고, 더미에서 한 장을 뒤집어 시작해요. (첫 카드는 효과 없음)</li>
          <li>내 차례에는 맨 위 카드와 <b>무늬나 숫자</b>가 같은 카드를 한 장 내요. 낼 수 없거나 내기 싫으면 카드를 <b>한 장 받고</b> 차례가 넘어가요.</li>
          <li><b>공격 카드</b>: 2 = +2장, A = +3장, 흑백 조커 = +5장, 컬러 조커 = +7장.</li>
          <li>공격을 받으면 <b>같거나 더 센</b> 공격 카드(2 &lt; A &lt; 흑백 조커 &lt; 컬러 조커)로 막을 수 있어요. 2와 A는 무늬나 숫자가 맞아야 하고, 조커는 언제든 낼 수 있어요. 막으면 장수가 쌓여 다음 사람에게 넘어가고, 못 막으면 쌓인 장수를 모두 받아요.</li>
          <li>조커는 아무 때나 낼 수 있고, 조커 다음 사람은 (공격을 막은 뒤가 아니라면) 아무 카드나 낼 수 있어요.</li>
          <li><b>7</b>: 무늬를 원하는 것으로 바꿔요.</li>
          <li><b>J</b>: 다음 사람을 건너뛰어요.</li>
          <li><b>Q</b>: 진행 방향을 반대로 바꿔요. (2명일 때는 일반 카드)</li>
          <li><b>K</b>: 한 번 더 내 차례예요. (낼 카드가 없으면 한 장 받아요)</li>
          <li>카드가 한 장 남으면 자동으로 "원카드!"를 외쳐요.</li>
          <li>카드가 <b>20장 이상</b>이 되면 파산해서 탈락해요. 나 혼자 남으면 승리!</li>
          <li>더미가 떨어지면 버린 카드(맨 위 제외)를 섞어 다시 써요.</li>
        </ul>`,
      buttons: [{ label: "확인", primary: true }],
    });
  }

  $("rulesBtn").addEventListener("click", showRules);
  $("newGame").addEventListener("click", newGame);
  $("drawBtn").addEventListener("click", onDrawClick);
  $("oppSelect").addEventListener("change", () => {
    MG.toast(`상대 ${$("oppSelect").value}명으로 새 게임을 시작해요`);
    newGame();
  });

  // 테스트/디버그용 읽기 전용 정보
  window.OneCard = {
    get state() { return G; },
    totalCards() {
      if (!G) return 0;
      return G.draw.length + G.discard.length + G.players.reduce((s, p) => s + p.hand.length, 0);
    },
  };

  newGame();
})();
