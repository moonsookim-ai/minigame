// 체스 — 규칙 엔진 + 컴퓨터(흑) + 화면
// 엔진은 0x88 보드를 사용한다. node 에서 require 하면 엔진만 내보낸다(perft 검증용).
(function () {
  "use strict";

  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const WHITE = 8, BLACK = 16;
  const FL_DOUBLE = 1, FL_EP = 2, FL_CASTLE = 4;

  const N_OFF = [33, 31, 18, 14, -33, -31, -18, -14];
  const B_OFF = [15, 17, -15, -17];
  const R_OFF = [16, -16, 1, -1];
  const K_OFF = [15, 16, 17, 1, -1, -15, -16, -17];

  // 캐슬링 권리 비트: 1 백 킹사이드, 2 백 퀸사이드, 4 흑 킹사이드, 8 흑 퀸사이드
  const CASTLE_MASK = new Array(128).fill(15);
  CASTLE_MASK[0x04] = 15 & ~3;
  CASTLE_MASK[0x00] = 15 & ~2;
  CASTLE_MASK[0x07] = 15 & ~1;
  CASTLE_MASK[0x74] = 15 & ~12;
  CASTLE_MASK[0x70] = 15 & ~8;
  CASTLE_MASK[0x77] = 15 & ~4;

  const VAL = [0, 100, 320, 330, 500, 900, 0];
  // 기물-칸 점수표 (a8 부터 h1 순서, 백 기준)
  const PST = [
    null,
    [ 0, 0, 0, 0, 0, 0, 0, 0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
      5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0,
      5, -5, -10, 0, 0, -10, -5, 5,
      5, 10, 10, -20, -20, 10, 10, 5,
      0, 0, 0, 0, 0, 0, 0, 0],
    [-50, -40, -30, -30, -30, -30, -40, -50,
      -40, -20, 0, 0, 0, 0, -20, -40,
      -30, 0, 10, 15, 15, 10, 0, -30,
      -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30,
      -30, 5, 10, 15, 15, 10, 5, -30,
      -40, -20, 0, 5, 5, 0, -20, -40,
      -50, -40, -30, -30, -30, -30, -40, -50],
    [-20, -10, -10, -10, -10, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 10, 10, 5, 0, -10,
      -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10,
      -10, 10, 10, 10, 10, 10, 10, -10,
      -10, 5, 0, 0, 0, 0, 5, -10,
      -20, -10, -10, -10, -10, -10, -10, -20],
    [ 0, 0, 0, 0, 0, 0, 0, 0,
      5, 10, 10, 10, 10, 10, 10, 5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      0, 0, 0, 5, 5, 0, 0, 0],
    [-20, -10, -10, -5, -5, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 5, 5, 5, 0, -10,
      -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5,
      -10, 5, 5, 5, 5, 5, 0, -10,
      -10, 0, 5, 0, 0, 0, 0, -10,
      -20, -10, -10, -5, -5, -10, -10, -20],
  ];
  const KING_MID = [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20];
  const KING_END = [
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10, 0, 0, -10, -20, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50];

  const MATE = 100000, INF = 1e9;
  const TIMEOUT = { timeout: true };
  const FILES = "abcdefgh";

  function sqName(sq) { return FILES[sq & 7] + ((sq >> 4) + 1); }
  function mv(from, to, piece, cap, promo, flags) {
    return { from, to, piece, cap, promo, flags };
  }

  function Chess(fen) {
    if (fen) this.load(fen); else this.reset();
  }

  Chess.prototype.reset = function () {
    this.load("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  };

  Chess.prototype.load = function (fen) {
    const parts = fen.trim().split(/\s+/);
    const b = this.board = new Array(128).fill(0);
    this.kings = {};
    const map = { p: P, n: N, b: B, r: R, q: Q, k: K };
    let rank = 7, file = 0;
    for (const ch of parts[0]) {
      if (ch === "/") { rank--; file = 0; continue; }
      if (/\d/.test(ch)) { file += +ch; continue; }
      const color = ch === ch.toUpperCase() ? WHITE : BLACK;
      const sq = rank * 16 + file;
      b[sq] = map[ch.toLowerCase()] | color;
      if (map[ch.toLowerCase()] === K) this.kings[color] = sq;
      file++;
    }
    this.turn = parts[1] === "b" ? BLACK : WHITE;
    const c = parts[2] || "-";
    this.castle = (c.includes("K") ? 1 : 0) | (c.includes("Q") ? 2 : 0) | (c.includes("k") ? 4 : 0) | (c.includes("q") ? 8 : 0);
    const ep = parts[3] || "-";
    this.ep = ep === "-" ? -1 : (FILES.indexOf(ep[0]) + (+ep[1] - 1) * 16);
    this.half = +(parts[4] || 0);
    this.fullmove = +(parts[5] || 1);
    this.stack = [];
    this.played = [];
    this.keys = [this.key()];
  };

  Chess.prototype.key = function () {
    return this.board.join(",") + "|" + this.turn + "|" + this.castle + "|" + this.ep;
  };

  Chess.prototype.attacked = function (sq, by) {
    const b = this.board;
    let s;
    if (by === WHITE) {
      s = sq - 15; if (!(s & 0x88) && b[s] === (P | WHITE)) return true;
      s = sq - 17; if (!(s & 0x88) && b[s] === (P | WHITE)) return true;
    } else {
      s = sq + 15; if (!(s & 0x88) && b[s] === (P | BLACK)) return true;
      s = sq + 17; if (!(s & 0x88) && b[s] === (P | BLACK)) return true;
    }
    for (let i = 0; i < 8; i++) {
      s = sq + N_OFF[i]; if (!(s & 0x88) && b[s] === (N | by)) return true;
      s = sq + K_OFF[i]; if (!(s & 0x88) && b[s] === (K | by)) return true;
    }
    for (let i = 0; i < 4; i++) {
      let d = B_OFF[i]; s = sq + d;
      while (!(s & 0x88)) {
        const p = b[s];
        if (p) { if (p === (B | by) || p === (Q | by)) return true; break; }
        s += d;
      }
      d = R_OFF[i]; s = sq + d;
      while (!(s & 0x88)) {
        const p = b[s];
        if (p) { if (p === (R | by) || p === (Q | by)) return true; break; }
        s += d;
      }
    }
    return false;
  };

  Chess.prototype.inCheck = function () {
    return this.attacked(this.kings[this.turn], this.turn ^ 24);
  };

  // 의사 합법수(자기 킹이 체크에 남는지는 아직 검사하지 않음)
  Chess.prototype.pseudo = function (capsOnly) {
    const b = this.board, us = this.turn, them = us ^ 24, moves = [];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p || !(p & us)) continue;
      const t = p & 7;
      if (t === P) {
        const dir = us === WHITE ? 16 : -16;
        const startRank = us === WHITE ? 1 : 6, promoRank = us === WHITE ? 7 : 0;
        const one = sq + dir;
        if (!(one & 0x88) && !b[one]) {
          if ((one >> 4) === promoRank) {
            moves.push(mv(sq, one, p, 0, Q, 0));
            if (!capsOnly) { moves.push(mv(sq, one, p, 0, R, 0), mv(sq, one, p, 0, B, 0), mv(sq, one, p, 0, N, 0)); }
          } else if (!capsOnly) {
            moves.push(mv(sq, one, p, 0, 0, 0));
            const two = one + dir;
            if ((sq >> 4) === startRank && !b[two]) moves.push(mv(sq, two, p, 0, 0, FL_DOUBLE));
          }
        }
        for (const d of [dir - 1, dir + 1]) {
          const s = sq + d;
          if (s & 0x88) continue;
          const c = b[s];
          if (c && (c & them)) {
            if ((s >> 4) === promoRank) {
              moves.push(mv(sq, s, p, c, Q, 0));
              if (!capsOnly) { moves.push(mv(sq, s, p, c, R, 0), mv(sq, s, p, c, B, 0), mv(sq, s, p, c, N, 0)); }
            } else moves.push(mv(sq, s, p, c, 0, 0));
          } else if (s === this.ep) {
            moves.push(mv(sq, s, p, P | them, 0, FL_EP));
          }
        }
      } else if (t === N || t === K) {
        const offs = t === N ? N_OFF : K_OFF;
        for (let i = 0; i < 8; i++) {
          const s = sq + offs[i];
          if (s & 0x88) continue;
          const c = b[s];
          if (!c) { if (!capsOnly) moves.push(mv(sq, s, p, 0, 0, 0)); }
          else if (c & them) moves.push(mv(sq, s, p, c, 0, 0));
        }
        if (t === K && !capsOnly) {
          const home = us === WHITE ? 0x04 : 0x74;
          const kBit = us === WHITE ? 1 : 4, qBit = us === WHITE ? 2 : 8;
          if (sq === home && (this.castle & (kBit | qBit)) && !this.attacked(home, them)) {
            if ((this.castle & kBit) && !b[home + 1] && !b[home + 2] && b[home + 3] === (R | us) &&
                !this.attacked(home + 1, them) && !this.attacked(home + 2, them)) {
              moves.push(mv(home, home + 2, p, 0, 0, FL_CASTLE));
            }
            if ((this.castle & qBit) && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === (R | us) &&
                !this.attacked(home - 1, them) && !this.attacked(home - 2, them)) {
              moves.push(mv(home, home - 2, p, 0, 0, FL_CASTLE));
            }
          }
        }
      } else {
        const dirs = t === B ? B_OFF : t === R ? R_OFF : K_OFF;
        for (let i = 0; i < dirs.length; i++) {
          const d = dirs[i];
          let s = sq + d;
          while (!(s & 0x88)) {
            const c = b[s];
            if (!c) { if (!capsOnly) moves.push(mv(sq, s, p, 0, 0, 0)); }
            else { if (c & them) moves.push(mv(sq, s, p, c, 0, 0)); break; }
            s += d;
          }
        }
      }
    }
    return moves;
  };

  Chess.prototype.make = function (m) {
    const b = this.board, us = this.turn;
    this.stack.push({ m, castle: this.castle, ep: this.ep, half: this.half });
    b[m.to] = m.promo ? (m.promo | us) : m.piece;
    b[m.from] = 0;
    if (m.flags & FL_EP) b[us === WHITE ? m.to - 16 : m.to + 16] = 0;
    if (m.flags & FL_CASTLE) {
      if (m.to > m.from) { b[m.from + 1] = b[m.from + 3]; b[m.from + 3] = 0; }
      else { b[m.from - 1] = b[m.from - 4]; b[m.from - 4] = 0; }
    }
    if ((m.piece & 7) === K) this.kings[us] = m.to;
    this.castle &= CASTLE_MASK[m.from] & CASTLE_MASK[m.to];
    this.ep = (m.flags & FL_DOUBLE) ? (m.from + m.to) >> 1 : -1;
    this.half = ((m.piece & 7) === P || m.cap) ? 0 : this.half + 1;
    if (us === BLACK) this.fullmove++;
    this.turn = us ^ 24;
  };

  Chess.prototype.unmake = function () {
    const u = this.stack.pop(), m = u.m, b = this.board;
    const us = this.turn ^ 24;
    this.turn = us;
    if (us === BLACK) this.fullmove--;
    b[m.from] = m.piece;
    if (m.flags & FL_EP) { b[m.to] = 0; b[us === WHITE ? m.to - 16 : m.to + 16] = m.cap; }
    else b[m.to] = m.cap;
    if (m.flags & FL_CASTLE) {
      if (m.to > m.from) { b[m.from + 3] = b[m.from + 1]; b[m.from + 1] = 0; }
      else { b[m.from - 4] = b[m.from - 1]; b[m.from - 1] = 0; }
    }
    if ((m.piece & 7) === K) this.kings[us] = m.from;
    this.castle = u.castle; this.ep = u.ep; this.half = u.half;
  };

  Chess.prototype.moves = function () {
    const out = [], us = this.turn, them = us ^ 24;
    for (const m of this.pseudo(false)) {
      this.make(m);
      if (!this.attacked(this.kings[us], them)) out.push(m);
      this.unmake();
    }
    return out;
  };

  Chess.prototype.perft = function (depth) {
    if (depth === 0) return 1;
    const us = this.turn, them = us ^ 24;
    let n = 0;
    for (const m of this.pseudo(false)) {
      this.make(m);
      if (!this.attacked(this.kings[us], them)) n += depth === 1 ? 1 : this.perft(depth - 1);
      this.unmake();
    }
    return n;
  };

  // 표준 대수 기보(SAN)
  Chess.prototype.san = function (m, legal) {
    let s;
    const t = m.piece & 7;
    if (m.flags & FL_CASTLE) s = m.to > m.from ? "O-O" : "O-O-O";
    else if (t === P) {
      s = (m.cap ? FILES[m.from & 7] + "x" : "") + sqName(m.to);
      if (m.promo) s += "=" + " PNBRQK"[m.promo];
    } else {
      s = " PNBRQK"[t];
      const others = legal.filter((o) => o !== m && o.piece === m.piece && o.to === m.to && o.from !== m.from);
      if (others.length) {
        const sameFile = others.some((o) => (o.from & 7) === (m.from & 7));
        const sameRank = others.some((o) => (o.from >> 4) === (m.from >> 4));
        if (!sameFile) s += FILES[m.from & 7];
        else if (!sameRank) s += (m.from >> 4) + 1;
        else s += sqName(m.from);
      }
      s += (m.cap ? "x" : "") + sqName(m.to);
    }
    this.make(m);
    if (this.inCheck()) s += this.moves().length ? "+" : "#";
    this.unmake();
    return s;
  };

  // 실제 대국의 수 (기록 남김)
  Chess.prototype.play = function (m) {
    const san = this.san(m, this.moves());
    this.make(m);
    this.played.push({ m, san });
    this.keys.push(this.key());
    return san;
  };

  Chess.prototype.takeBack = function () {
    if (!this.played.length) return null;
    this.keys.pop();
    this.unmake();
    return this.played.pop();
  };

  Chess.prototype.insufficient = function () {
    const minors = [];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const t = this.board[sq] & 7;
      if (!t || t === K) continue;
      if (t === P || t === R || t === Q) return false;
      minors.push({ t, color: ((sq >> 4) + (sq & 7)) & 1 });
    }
    if (minors.length <= 1) return true;
    if (minors.every((x) => x.t === B)) return minors.every((x) => x.color === minors[0].color);
    return false;
  };

  // 대국 상태: { over, winner(WHITE/BLACK/0), reason }
  Chess.prototype.status = function () {
    const legal = this.moves();
    if (!legal.length) {
      if (this.inCheck()) return { over: true, winner: this.turn ^ 24, reason: "checkmate" };
      return { over: true, winner: 0, reason: "stalemate" };
    }
    if (this.insufficient()) return { over: true, winner: 0, reason: "insufficient" };
    if (this.half >= 100) return { over: true, winner: 0, reason: "fifty" };
    const k = this.keys[this.keys.length - 1];
    if (this.keys.filter((x) => x === k).length >= 3) return { over: true, winner: 0, reason: "repetition" };
    return { over: false };
  };

  // ---------- 평가 & 탐색 ----------
  Chess.prototype.evaluate = function () {
    const b = this.board;
    let score = 0, phase = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p) continue;
      const t = p & 7;
      if (t === K) continue;
      const white = p & WHITE;
      const idx = white ? (7 - (sq >> 4)) * 8 + (sq & 7) : (sq >> 4) * 8 + (sq & 7);
      const v = VAL[t] + PST[t][idx];
      score += white ? v : -v;
      if (t !== P) phase += VAL[t];
    }
    const kt = phase <= 1600 ? KING_END : KING_MID;
    const wk = this.kings[WHITE], bk = this.kings[BLACK];
    score += kt[(7 - (wk >> 4)) * 8 + (wk & 7)];
    score -= kt[(bk >> 4) * 8 + (bk & 7)];
    return this.turn === WHITE ? score : -score;
  };

  function orderMoves(moves, first) {
    for (const m of moves) {
      let s = 0;
      if (m.cap) s = 10000 + 10 * VAL[m.cap & 7] - VAL[m.piece & 7];
      if (m.promo) s += 8000 + VAL[m.promo];
      if (first && m.from === first.from && m.to === first.to && m.promo === first.promo) s = 1e6;
      m.ord = s;
    }
    moves.sort((a, c) => c.ord - a.ord);
    return moves;
  }

  Chess.prototype._tick = function () {
    if ((++this.nodes & 1023) === 0 && Date.now() > this.deadline) throw TIMEOUT;
  };

  Chess.prototype.qs = function (alpha, beta, ply) {
    this._tick();
    const stand = this.evaluate();
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (ply > 24) return alpha;
    const us = this.turn, them = us ^ 24;
    const moves = orderMoves(this.pseudo(true));
    for (const m of moves) {
      this.make(m);
      if (this.attacked(this.kings[us], them)) { this.unmake(); continue; }
      const sc = -this.qs(-beta, -alpha, ply + 1);
      this.unmake();
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  };

  Chess.prototype.negamax = function (depth, alpha, beta, ply) {
    this._tick();
    if (depth <= 0) return this.qs(alpha, beta, ply);
    if (this.half >= 100) return 0;
    const us = this.turn, them = us ^ 24;
    const moves = orderMoves(this.pseudo(false));
    let legal = 0;
    for (const m of moves) {
      this.make(m);
      if (this.attacked(this.kings[us], them)) { this.unmake(); continue; }
      legal++;
      const sc = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      this.unmake();
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    if (!legal) return this.inCheck() ? -MATE + ply : 0;
    return alpha;
  };

  // level: "easy" | "normal"
  Chess.prototype.bestMove = function (level, timeMs) {
    const root = this.moves();
    if (!root.length) return null;
    const base = this.stack.length;
    this.nodes = 0;
    this.deadline = Date.now() + (timeMs || 800);
    const recent = this.keys.slice(-8);
    // 같은 국면을 되풀이하는 수는 살짝 감점(무승부 회피)
    const repeatPenalty = (m) => {
      this.make(m);
      const k = this.key();
      this.unmake();
      return recent.includes(k) ? 30 : 0;
    };

    if (level === "easy") {
      let best = null, bestScore = -INF;
      try {
        for (const m of root) {
          this.make(m);
          const sc = -this.qs(-INF, INF, 1) + (Math.random() * 240 - 120);
          this.unmake();
          if (sc > bestScore) { bestScore = sc; best = m; }
        }
      } catch (e) {
        if (e !== TIMEOUT) throw e;
        while (this.stack.length > base) this.unmake();
      }
      return best || root[Math.floor(Math.random() * root.length)];
    }

    let best = root[Math.floor(Math.random() * root.length)];
    orderMoves(root);
    const maxDepth = 5;
    for (let depth = 1; depth <= maxDepth; depth++) {
      let alpha = -INF, bestThis = null;
      try {
        for (const m of root) {
          this.make(m);
          let sc = -this.negamax(depth - 1, -INF, -alpha, 1);
          this.unmake();
          sc -= repeatPenalty(m);
          if (sc > alpha) { alpha = sc; bestThis = m; }
        }
      } catch (e) {
        if (e !== TIMEOUT) throw e;
        while (this.stack.length > base) this.unmake();
        // 시간 초과: 이번 깊이에서 이미 더 좋은 수를 찾았다면(첫 수는 직전 최선수) 그것을 쓴다
        if (bestThis && bestThis !== best && alpha > -INF) best = bestThis;
        break;
      }
      best = bestThis;
      orderMoves(root, best);
      if (alpha > MATE - 100) break;
    }
    return best;
  };

  const api = { Chess, P, N, B, R, Q, K, WHITE, BLACK, sqName };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  window.ChessEngine = api;

  // ---------- 화면 ----------
  const GLYPH = { 1: "♟︎", 2: "♞", 3: "♝", 4: "♜", 5: "♛", 6: "♚" };
  const NAME = { 1: "폰", 2: "나이트", 3: "비숍", 4: "룩", 5: "퀸", 6: "킹" };
  const LEVEL_KEY = "minigame.chess.level";

  const game = new Chess();
  api.game = game; // 디버그/테스트용
  const boardEl = document.getElementById("board");
  const turnPill = document.getElementById("turnPill");
  const checkNote = document.getElementById("checkNote");
  const capMine = document.getElementById("capMine");
  const capLost = document.getElementById("capLost");
  const moveList = document.getElementById("moveList");
  const undoBtn = document.getElementById("undoBtn");
  const levelBtns = Array.from(document.querySelectorAll("[data-level]"));

  let level = "normal";
  try { const v = localStorage.getItem(LEVEL_KEY); if (v === "easy" || v === "normal") level = v; } catch (e) {}

  let selected = -1, legal = [], busy = false, over = null, gen = 0;
  const cells = [];

  for (let i = 0; i < 64; i++) {
    const r = Math.floor(i / 8), f = i % 8;
    const sq = (7 - r) * 16 + f;
    const el = document.createElement("button");
    el.type = "button";
    el.dataset.sq = sq;
    boardEl.appendChild(el);
    cells.push(el);
  }

  function lastMove() {
    const l = game.played[game.played.length - 1];
    return l ? l.m : null;
  }

  function render() {
    const humanTurn = !over && !busy && game.turn === WHITE;
    legal = humanTurn ? game.moves() : [];
    const check = game.inCheck();
    const kingSq = game.kings[game.turn];
    const lm = lastMove();
    const targets = selected >= 0 ? legal.filter((m) => m.from === selected) : [];

    cells.forEach((el, i) => {
      const r = Math.floor(i / 8), f = i % 8;
      const sq = +el.dataset.sq;
      const p = game.board[sq];
      const cls = ["sq", (r + f) % 2 ? "dark" : "light"];
      if (lm && (lm.from === sq || lm.to === sq)) cls.push("last");
      if (sq === selected) cls.push("sel");
      const tgt = targets.find((m) => m.to === sq);
      if (tgt) cls.push(tgt.cap ? "target cap" : "target");
      if (check && sq === kingSq) cls.push("check");
      if (humanTurn && p && (p & WHITE)) cls.push("mine");
      el.className = cls.join(" ");
      let html = "";
      if (p) html += `<span class="pc ${p & WHITE ? "w" : "b"}">${GLYPH[p & 7]}</span>`;
      if (f === 0) html += `<span class="co cr">${8 - r}</span>`;
      if (r === 7) html += `<span class="co cf">${FILES[f]}</span>`;
      el.innerHTML = html;
      el.setAttribute("aria-label", sqName(sq) + (p ? ` ${p & WHITE ? "백" : "흑"} ${NAME[p & 7]}` : "") + (tgt ? " (이동 가능)" : ""));
    });

    // 상태 줄
    if (over) turnPill.textContent = over.winner === WHITE ? "당신 승리" : over.winner === BLACK ? "컴퓨터 승리" : "무승부";
    else if (busy) turnPill.textContent = "컴퓨터 생각 중…";
    else turnPill.textContent = "당신 차례 (백)";
    turnPill.classList.toggle("thinking", busy && !over);
    if (check) {
      checkNote.hidden = false;
      checkNote.textContent = over && over.reason === "checkmate" ? "체크메이트!" : "체크!";
    } else checkNote.hidden = true;

    // 잡은 기물
    const mine = [], lost = [];
    for (const { m } of game.played) {
      if (!m.cap) continue;
      (m.cap & BLACK ? mine : lost).push(m.cap & 7);
    }
    mine.sort((a, c) => c - a); lost.sort((a, c) => c - a);
    const sum = (a) => a.reduce((s, t) => s + [0, 1, 3, 3, 5, 9][t], 0);
    const diff = sum(mine) - sum(lost);
    capMine.innerHTML = (mine.map((t) => `<span class="pc b">${GLYPH[t]}</span>`).join("") || '<span class="none">없음</span>') +
      (diff > 0 ? `<span class="adv">+${diff}</span>` : "");
    capLost.innerHTML = (lost.map((t) => `<span class="pc w">${GLYPH[t]}</span>`).join("") || '<span class="none">없음</span>') +
      (diff < 0 ? `<span class="adv">+${-diff}</span>` : "");

    // 기보
    let html = "";
    for (let i = 0; i < game.played.length; i += 2) {
      const w = game.played[i].san, b = game.played[i + 1] ? game.played[i + 1].san : "";
      html += `<li><span class="mn">${i / 2 + 1}.</span><span>${w}</span><span>${b}</span></li>`;
    }
    moveList.innerHTML = html || '<li class="empty">아직 둔 수가 없어요. 백(아래)부터 시작합니다.</li>';
    moveList.scrollTop = moveList.scrollHeight;

    undoBtn.disabled = !game.played.length;
    levelBtns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.level === level)));
  }

  function finishCheck() {
    const st = game.status();
    if (!st.over) return false;
    over = st;
    busy = false;
    selected = -1;
    render();
    const reasons = {
      checkmate: "체크메이트",
      stalemate: "스테일메이트 — 둘 수 있는 수가 없지만 체크는 아니에요",
      insufficient: "기물이 부족해 아무도 체크메이트할 수 없어요",
      fifty: "50수 동안 폰 이동이나 기물 잡기가 없었어요",
      repetition: "같은 국면이 세 번 반복됐어요",
    };
    const title = st.winner === WHITE ? "승리!" : st.winner === BLACK ? "패배" : "무승부";
    const msg = st.winner === WHITE ? "체크메이트! 컴퓨터를 이겼어요."
      : st.winner === BLACK ? "체크메이트를 당했어요. 다시 도전해 보세요."
      : reasons[st.reason] + ".";
    const g = gen;
    setTimeout(() => {
      if (g !== gen) return;
      MG.showModal({
        title,
        html: `<p>${msg}</p><p>총 ${Math.ceil(game.played.length / 2)}수 · 난이도 ${level === "easy" ? "쉬움" : "보통"}</p>`,
        buttons: [
          { label: "판 보기" },
          { label: "새 게임", primary: true, onClick: newGame },
        ],
      });
    }, 350);
    return true;
  }

  function humanMove(m) {
    game.play(m);
    selected = -1;
    if (finishCheck()) return;
    aiTurn();
  }

  function aiTurn() {
    busy = true;
    const g = ++gen;
    render();
    // 화면이 먼저 그려지도록 잠깐 기다린 뒤 계산
    setTimeout(() => {
      if (g !== gen) return;
      const m = game.bestMove(level, level === "easy" ? 300 : 800);
      if (g !== gen) return;
      busy = false;
      if (m) game.play(m);
      if (!finishCheck()) render();
    }, 180);
  }

  function askPromotion(options) {
    const pick = (t) => () => {
      const m = options.find((o) => o.promo === t);
      if (m) humanMove(m);
    };
    MG.showModal({
      title: "폰 승진",
      html: "<p>폰이 끝 줄에 도착했어요. 어떤 기물로 바꿀까요?</p>",
      buttons: [
        { label: "♛ 퀸", primary: true, onClick: pick(Q) },
        { label: "♜ 룩", onClick: pick(R) },
        { label: "♝ 비숍", onClick: pick(B) },
        { label: "♞ 나이트", onClick: pick(N) },
      ],
    });
  }

  boardEl.addEventListener("click", (e) => {
    const el = e.target.closest("[data-sq]");
    if (!el) return;
    if (over) { MG.toast("게임이 끝났어요. 새 게임을 눌러 주세요."); return; }
    if (busy || game.turn !== WHITE) { MG.toast("컴퓨터가 생각 중이에요"); return; }
    const sq = +el.dataset.sq;
    const p = game.board[sq];
    if (selected >= 0) {
      const ms = legal.filter((m) => m.from === selected && m.to === sq);
      if (ms.length > 1) { askPromotion(ms); return; }
      if (ms.length === 1) { humanMove(ms[0]); return; }
    }
    if (p && (p & WHITE) && sq !== selected) {
      selected = sq;
      if (!legal.some((m) => m.from === sq)) MG.toast("이 기물은 지금 움직일 수 없어요");
    } else {
      if (selected >= 0 && !(p && (p & WHITE))) MG.toast("그곳으로는 갈 수 없어요");
      selected = -1;
    }
    render();
  });

  function newGame() {
    gen++;
    MG.hideModal();
    game.reset();
    selected = -1; busy = false; over = null;
    render();
  }

  function undo() {
    if (!game.played.length) { MG.toast("무를 수가 없어요"); return; }
    gen++;
    MG.hideModal();
    busy = false; over = null; selected = -1;
    do { game.takeBack(); } while (game.played.length && game.turn !== WHITE);
    render();
    MG.toast("한 수 물렀어요");
  }

  document.getElementById("newGame").addEventListener("click", newGame);
  undoBtn.addEventListener("click", undo);
  levelBtns.forEach((b) => b.addEventListener("click", () => {
    level = b.dataset.level;
    try { localStorage.setItem(LEVEL_KEY, level); } catch (e) {}
    render();
    MG.toast(`난이도: ${level === "easy" ? "쉬움" : "보통"}`);
  }));

  document.getElementById("rulesBtn").addEventListener("click", () => {
    MG.showModal({
      title: "체스 규칙",
      html: `
        <p>당신은 <b>백(아래)</b>, 컴퓨터는 <b>흑(위)</b>입니다. 상대 킹을 <b>체크메이트</b>(피할 수 없는 공격)하면 이겨요.</p>
        <ul>
          <li>내 기물을 누르면 갈 수 있는 칸이 점으로 표시돼요. 그 칸을 누르면 이동합니다.</li>
          <li>킹이 공격받는 상태를 <b>체크</b>라고 하며, 반드시 체크를 피하는 수만 둘 수 있어요.</li>
          <li><b>캐슬링</b>: 킹과 룩이 한 번도 움직이지 않았고, 사이가 비어 있으며, 킹이 체크가 아니고 지나가는 칸도 공격받지 않을 때 킹을 룩 쪽으로 두 칸 옮기면 룩이 킹 너머로 넘어와요.</li>
          <li><b>앙파상</b>: 상대 폰이 처음에 두 칸 전진해 내 폰 옆에 섰다면, 바로 다음 수에 대각선으로 지나가며 잡을 수 있어요.</li>
          <li><b>승진</b>: 폰이 맨 끝 줄에 닿으면 퀸·룩·비숍·나이트 중 하나로 바뀌어요.</li>
          <li><b>무승부</b>: 스테일메이트(둘 수 있는 수가 없지만 체크 아님), 기물 부족, 같은 국면 3회 반복, 50수 규칙.</li>
          <li><b>무르기</b>는 내 수와 컴퓨터의 응수를 함께 되돌려요.</li>
        </ul>`,
    });
  });

  api.render = () => { selected = -1; over = null; busy = false; gen++; render(); };
  render();
})();
