// 트럼프 카드 도우미
// 카드 객체: { suit: "S"|"H"|"D"|"C"|null, rank: 1..13 (1=A, 11=J, 12=Q, 13=K), joker: false|"black"|"color", id }
(function () {
  const SUITS = ["S", "H", "D", "C"];
  const SUIT_SYMBOL = { S: "♠", H: "♥", D: "♦", C: "♣" };
  const SUIT_NAME = { S: "스페이드", H: "하트", D: "다이아", C: "클로버" };
  const RANK_LABEL = { 1: "A", 11: "J", 12: "Q", 13: "K" };

  function rankLabel(rank) {
    return RANK_LABEL[rank] || String(rank);
  }

  function isRed(card) {
    if (card.joker) return card.joker === "color";
    return card.suit === "H" || card.suit === "D";
  }

  function makeDeck(opts) {
    const deck = [];
    let id = 0;
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) deck.push({ suit, rank, joker: false, id: id++ });
    }
    if (opts && opts.jokers) {
      deck.push({ suit: null, rank: 0, joker: "black", id: id++ });
      deck.push({ suit: null, rank: 0, joker: "color", id: id++ });
    }
    return deck;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function cardName(card) {
    if (card.joker) return card.joker === "color" ? "컬러 조커" : "흑백 조커";
    return `${SUIT_NAME[card.suit]} ${rankLabel(card.rank)}`;
  }

  // 카드 DOM 요소를 만든다. opts: { faceDown, clickable, selected, extraClass }
  function renderCard(card, opts) {
    opts = opts || {};
    const el = document.createElement("div");
    el.className = "pcard";
    if (opts.extraClass) el.className += " " + opts.extraClass;
    if (!card) {
      el.classList.add("slot");
      return el;
    }
    el.dataset.id = card.id;
    if (opts.faceDown) {
      el.classList.add("back");
      el.setAttribute("aria-label", "뒤집힌 카드");
    } else {
      if (isRed(card)) el.classList.add("red");
      el.setAttribute("aria-label", cardName(card));
      if (card.joker) {
        el.classList.add("joker");
        el.innerHTML = `<span class="pc-center">JOKER</span>`;
      } else {
        const r = rankLabel(card.rank);
        const s = SUIT_SYMBOL[card.suit];
        el.innerHTML =
          `<span class="pc-corner"><span>${r}</span><span class="pc-suit">${s}</span></span>` +
          `<span class="pc-center">${s}</span>` +
          `<span class="pc-corner br"><span>${r}</span><span class="pc-suit">${s}</span></span>`;
      }
    }
    if (opts.clickable) {
      el.classList.add("clickable");
      el.tabIndex = 0;
      el.setAttribute("role", "button");
    }
    if (opts.selected) el.classList.add("selected");
    return el;
  }

  window.Cards = { SUITS, SUIT_SYMBOL, SUIT_NAME, rankLabel, isRed, makeDeck, shuffle, cardName, renderCard };
})();
