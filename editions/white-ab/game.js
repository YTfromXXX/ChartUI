// ホワイトアウト版 AB — サトシを探せ版 (v0.1). No dependencies: open index.html.
// Three scenes:
//   1. OP — the aviator "Little" flies one lap round a hexagonal island (the six Dual ports) and a
//      face-down card is laid where it lands.
//   2. LAB (recollection) — three figures in glass capsules, faces left as blank paper. Ink over a
//      figure with the pen to reveal its signature fingerprint; pick the one that matches the card.
//      You find the signer without ever seeing a face: a signature proves a key, not a person.
//   3. DECK — slot the Famicom-shaped pocket into the deck; the card turns: the Hanged Man, seen
//      upside down — stop, and look again: a rope is for climbing down, not for falling.
// Colours follow the whiteout rules: white paper, ink #1f1f1f, one red #c8001a, greys for notes.
(function () {
  'use strict';
  var C = document.getElementById('stage'); var g = C.getContext('2d');
  var W = C.width, H = C.height;
  var INK = '#1f1f1f', RED = '#c8001a', SUB = '#57534e', LINE = '#e7e5e4', PAPER = '#ffffff';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var status = document.getElementById('status');
  var EMOJI20 = ['🌑','🌒','🌓','🌔','🌕','🌖','🌗','🌘','🌸','🌼','🌻','🌹','🌷','🐟','🐠','🐡','🍬','🍭','🎲','🎯'];
  var PORTS = ['3 奇数＆偶数', '8 aviator', '15 ファミつく', '20 King＆Queen', '21 MAP ex', '22 バイク魂'];

  // ---------------- state
  var S = { scene: 'op', t0: performance.now(), trail: [], ink: [0, 0, 0], revealed: [false, false, false], answer: 0, prints: ['', '', ''], tries: 0, msg: '', slot: 0, dragging: false, cart: { x: 150, y: 380 }, flipT0: 0 };
  function say(s) { S.msg = s; status.textContent = s; }
  function go(scene) { S.scene = scene; S.t0 = performance.now(); if (scene === 'lab') say('ペンで 3 体の上をなぞると、署名の指紋が浮かびます。カードと同じ指紋の 1 体を選んでください（1・2・3）。'); if (scene === 'deck') say('ファミコン型のポケットを、デッキの差し込み口までドラッグ（または Enter）。'); if (scene === 'reveal') say('カードがめくれます。'); }

  // Fictional keys → SHA-256 fingerprints (8 hex + 4 emoji-20 digits). Nothing here is a real key.
  var KEYS = ['trio-1:fictional-key:white-ab', 'trio-2:fictional-key:white-ab', 'trio-3:fictional-key:white-ab'];
  function fp(bytes) { var hex = Array.prototype.map.call(bytes.slice(0, 4), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); var e = ''; for (var i = 0; i < 4; i++) e += EMOJI20[bytes[4 + i] % 20]; return hex + ' ' + e; }
  function fallbackHash(s) { var out = new Uint8Array(8); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } for (var k = 0; k < 8; k++) { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; h >>>= 0; out[k] = h & 255; } return out; }
  function makePrints() {
    S.answer = Math.floor(Math.random() * 3);
    var enc = new TextEncoder();
    if (window.crypto && crypto.subtle) {
      Promise.all(KEYS.map(function (k) { return crypto.subtle.digest('SHA-256', enc.encode(k)); })).then(function (ds) { S.prints = ds.map(function (d) { return fp(new Uint8Array(d)); }); });
    } else S.prints = KEYS.map(function (k) { return fp(fallbackHash(k)); });
  }
  makePrints();

  // ---------------- drawing helpers
  function text(s, x, y, size, col, align) { g.fillStyle = col || INK; g.font = (size || 14) + 'px ui-monospace, Menlo, monospace'; g.textAlign = align || 'left'; g.fillText(s, x, y); }
  function hexPoint(i, R, cx, cy) { var a = -Math.PI / 2 + i * Math.PI / 3; return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }; }
  function card(x, y, w, h, faceDown) {
    g.fillStyle = PAPER; g.strokeStyle = INK; g.lineWidth = 2; g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h);
    if (faceDown) { g.strokeStyle = RED; g.lineWidth = 1; for (var i = 6; i < w; i += 8) { g.beginPath(); g.moveTo(x + i, y + 4); g.lineTo(x + i - 6, y + h - 4); g.stroke(); } text('?', x + w / 2, y + h / 2 + 8, 24, INK, 'center'); }
  }
  // An ink silhouette with the face left blank — the paper is the face.
  // Each of the three gets its own hair height, fringe length and jaw; the middle one faces the other way.
  function figure(cx, cy, seed) {
    var r = seed * 7.3; var hair = 6 + seed * 6; var fringe = 30 + seed * 14; var jaw = 50 + seed * 8; var dir = seed === 2 ? -1 : 1;
    g.save(); g.translate(cx, cy); g.scale(dir, 1);
    g.fillStyle = INK; g.beginPath(); g.moveTo(-46, -10);
    for (var i = 0; i <= 12; i++) { var x = -46 + i * 8; var y = -62 - hair * Math.abs(Math.sin(r + i * 1.7)) - (i % 3 === 0 ? 8 : 0); g.lineTo(x, y); }
    g.lineTo(fringe + 10, -34); g.lineTo(18, -30); g.quadraticCurveTo(-4, -26, -22, -18); g.lineTo(-24, 30);
    g.quadraticCurveTo(-6, jaw, 14, jaw + 4); g.lineTo(30, jaw); g.lineTo(8, jaw - 8); g.quadraticCurveTo(-18, 30, -26, -4); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(fringe + 4, -34); g.lineTo(fringe + 8, -34 + 10 + seed * 12); g.lineWidth = 3; g.strokeStyle = INK; g.stroke();
    g.restore();
  }
  function capsule(i) { return { x: 160 + i * 320 - 90, y: 70, w: 180, h: 280 }; }

  // ---------------- scenes
  function drawOP(t) {
    var dur = reduce ? 3000 : 9000; var k = Math.min(1, t / dur); var cx = W / 2, cy = 260, R = 160;
    for (var c = 0; c < 26; c++) { g.fillStyle = LINE; g.beginPath(); g.arc((c * 137) % W, 40 + (c * 61) % 120, 2 + (c % 3), 0, 7); g.fill(); }
    g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); for (var i = 0; i <= 6; i++) { var p = hexPoint(i % 6, R, cx, cy); if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); } g.stroke();
    for (var j = 0; j < 6; j++) { var q = hexPoint(j, R + 26, cx, cy); text(PORTS[j], q.x, q.y + 4, 12, j === 1 ? RED : SUB, 'center'); }
    var pos = k * 6; var e = Math.floor(pos) % 6; var f = pos - Math.floor(pos); var a = hexPoint(e, R - 30, cx, cy); var b = hexPoint((e + 1) % 6, R - 30, cx, cy);
    var px = a.x + (b.x - a.x) * f, py = a.y + (b.y - a.y) * f - 18 * Math.sin(f * Math.PI);
    S.trail.push({ x: px, y: py }); if (S.trail.length > 400) S.trail.shift();
    g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); S.trail.forEach(function (p, n) { if (n) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }); g.stroke();
    var ang = Math.atan2(b.y - a.y, b.x - a.x); g.save(); g.translate(px, py); g.rotate(ang); g.fillStyle = INK; g.beginPath(); g.moveTo(14, 0); g.lineTo(-10, -9); g.lineTo(-5, 0); g.lineTo(-10, 9); g.closePath(); g.fill(); g.restore();
    text('リトル（低く飛んで 3 か 4 マス）', px + 14, py - 12, 11, SUB);
    text('ホワイトアウト版 AB', cx, cy - 8, 22, INK, 'center'); text('サトシを探せ版', cx, cy + 20, 14, RED, 'center');
    if (k >= 1) { var land = hexPoint(1, R - 30, cx, cy); g.fillStyle = RED; g.beginPath(); g.arc(land.x, land.y, 5, 0, 7); g.fill(); card(land.x + 70, land.y - 40, 60, 84, true); text('着地：8 aviator に、裏返されたカードが 1 枚', cx, cy + R + 60, 13, INK, 'center'); if (!S.msg) say('進むと、回想の LAB へ。'); }
  }
  function drawLAB() {
    text('回想 — LAB', 24, 30, 14, SUB);
    for (var i = 0; i < 3; i++) {
      var c = capsule(i); g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.ellipse(c.x + c.w / 2, c.y + 14, c.w / 2, 14, 0, 0, 7); g.stroke();
      g.strokeRect(c.x, c.y + 14, c.w, c.h - 28); g.beginPath(); g.ellipse(c.x + c.w / 2, c.y + c.h - 14, c.w / 2, 14, 0, 0, 7); g.stroke();
      figure(c.x + c.w / 2 - 6, c.y + c.h / 2, i + 1);
      text((i + 1) + '', c.x + 8, c.y + 40, 14, SUB);
      var pct = Math.min(1, S.ink[i] / 420); g.fillStyle = LINE; g.fillRect(c.x, c.y + c.h + 8, c.w, 4); g.fillStyle = INK; g.fillRect(c.x, c.y + c.h + 8, c.w * pct, 4);
      text(S.revealed[i] ? S.prints[i] : '指紋：インクでなぞる', c.x + c.w / 2, c.y + c.h + 30, 13, S.revealed[i] ? INK : SUB, 'center');
    }
    g.strokeStyle = RED; g.lineWidth = 2; g.beginPath(); S.trail.forEach(function (p, n) { if (n && !p.lift) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y); }); g.stroke();
    card(W / 2 - 150, 430, 300, 70, false); text('裏返されたカードの署名：' + (S.prints[S.answer] || '…'), W / 2, 472, 13, INK, 'center');
  }
  function deckBox() { return { x: 560, y: 300, w: 320, h: 150, slotX: 640, slotY: 300, slotW: 160 }; }
  function drawDeck(t) {
    var d = deckBox(); text('ファミコン型のポケットを、デッキへ', 24, 30, 14, SUB);
    g.fillStyle = '#ece7dc'; g.strokeStyle = INK; g.lineWidth = 2; g.fillRect(d.x, d.y, d.w, d.h); g.strokeRect(d.x, d.y, d.w, d.h);
    g.fillStyle = '#7a1b1b'; g.fillRect(d.x, d.y + d.h - 34, d.w, 34); g.fillStyle = INK; g.fillRect(d.slotX, d.slotY - 6, d.slotW, 10);
    text('DECK', d.x + 14, d.y + 30, 14, INK); text('POWER ●', d.x + d.w - 90, d.y + d.h - 12, 11, PAPER);
    var cx = S.cart.x, cy = S.cart.y;
    if (S.slot > 0) { var k = Math.min(1, (t - S.slot) / (reduce ? 200 : 900)); cx = d.slotX + 10; cy = d.slotY - 110 + 104 * k; if (k >= 1 && S.scene === 'deck') { go('reveal'); S.flipT0 = performance.now(); } }
    g.fillStyle = '#d8d2c4'; g.strokeStyle = INK; g.fillRect(cx, cy, 140, 110); g.strokeRect(cx, cy, 140, 110);
    for (var r = 0; r < 5; r++) { g.beginPath(); g.moveTo(cx + 10, cy + 10 + r * 6); g.lineTo(cx + 130, cy + 10 + r * 6); g.stroke(); }
    g.fillStyle = PAPER; g.fillRect(cx + 16, cy + 44, 108, 54); g.strokeRect(cx + 16, cy + 44, 108, 54); text('AB', cx + 70, cy + 78, 20, RED, 'center'); text('ポケット', cx + 70, cy + 94, 10, SUB, 'center');
  }
  function hanged(cx, cy, s) {
    g.strokeStyle = INK; g.fillStyle = INK; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(cx - 40 * s, cy - 70 * s); g.lineTo(cx + 40 * s, cy - 70 * s); g.stroke();
    g.beginPath(); g.moveTo(cx, cy - 70 * s); g.lineTo(cx, cy - 52 * s); g.stroke();
    g.beginPath(); g.moveTo(cx, cy - 52 * s); g.lineTo(cx, cy + 10 * s); g.moveTo(cx, cy - 46 * s); g.lineTo(cx + 18 * s, cy - 30 * s); g.lineTo(cx, cy - 20 * s); g.stroke();
    g.beginPath(); g.moveTo(cx - 20 * s, cy - 6 * s); g.lineTo(cx, cy + 4 * s); g.lineTo(cx + 20 * s, cy - 6 * s); g.stroke();
    g.beginPath(); g.arc(cx, cy + 22 * s, 12 * s, 0, 7); g.fill(); g.strokeStyle = RED; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy + 22 * s, 18 * s, 0, 7); g.stroke();
  }
  function drawReveal(t) {
    var k = Math.min(1, t / (reduce ? 300 : 1400)); var turn = Math.min(1, Math.max(0, (t - (reduce ? 300 : 1600)) / (reduce ? 300 : 2400)));
    var cx = 300, cy = 260; var sx = Math.abs(Math.cos(Math.PI * (1 - k)));
    g.save(); g.translate(cx, cy); g.scale(Math.max(0.02, sx), 1);
    if (k < 0.5) card(-90, -130, 180, 260, true); else { card(-90, -130, 180, 260, false); g.save(); g.rotate(Math.PI * turn); hanged(0, 0, 1.4); g.restore(); text('XII', 0, -100, 16, INK, 'center'); }
    g.restore();
    if (turn > 0.2) {
      text('吊るされた男 — 止まって、逆さに見る。', 470, 140, 16, INK);
      text('ロープは、落ちるためではなく、降りるための道具。', 470, 170, 14, INK);
      // A fictional balance: with the rope (stop-loss) the climber stops at the ledge; without it, the line runs to zero.
      var x0 = 470, y0 = 220, w = 420, h = 200;
      g.strokeStyle = LINE; g.lineWidth = 1; g.strokeRect(x0, y0, w, h);
      g.strokeStyle = SUB; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(x0, y0 + h * 0.55); g.lineTo(x0 + w, y0 + h * 0.55); g.stroke(); g.setLineDash([]);
      text('ロープ（ロスカット）', x0 + w - 130, y0 + h * 0.55 - 6, 11, SUB);
      g.strokeStyle = SUB; g.beginPath(); for (var i = 0; i <= 60; i++) { var x = x0 + (i / 60) * w; var y = y0 + 20 + (h - 30) * Math.pow(i / 60, 1.4) + 6 * Math.sin(i); if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();
      g.strokeStyle = INK; g.lineWidth = 2.5; g.beginPath(); for (var j = 0; j <= 60; j++) { var x2 = x0 + (j / 60) * w; var y2 = Math.min(y0 + h * 0.55, y0 + 20 + (h - 30) * Math.pow(j / 60, 1.4) + 6 * Math.sin(j)); if (j) g.lineTo(x2, y2); else g.moveTo(x2, y2); } g.stroke();
      text('細い線：ロープなし（架空の残高は 0 へ）', x0, y0 + h + 18, 11, SUB); text('太い線：ロープで止まり、降りられた', x0, y0 + h + 34, 11, INK);
      if (turn >= 1 && S.scene === 'reveal') { S.scene = 'end'; say('おしまい。R で最初から。'); }
    }
  }
  function drawEnd(t) { drawReveal(t + 99999); text('ホワイトアウト版 AB · v0.1 · 3 つの場面', W / 2, H - 14, 12, SUB, 'center'); }

  // ---------------- loop
  function frame(now) {
    var t = now - S.t0; g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
    if (S.scene === 'op') drawOP(t); else if (S.scene === 'lab') drawLAB(); else if (S.scene === 'deck') drawDeck(now); else if (S.scene === 'reveal') drawReveal(now - S.flipT0); else drawEnd(now - S.flipT0);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---------------- input
  function pos(e) { var r = C.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
  function pick(i) {
    if (S.scene !== 'lab') return;
    if (!S.revealed[i]) { say((i + 1) + ' の指紋はまだ見えていません。ペンでなぞってください。'); return; }
    S.tries++;
    if (i === S.answer) { say('署名が一致：' + (i + 1) + ' が署名者。顔は見えないまま、鍵だけが確かめられた。'); setTimeout(function () { S.trail = []; go('deck'); }, reduce ? 300 : 1400); }
    else say('署名が合わない。別の 1 体を。');
  }
  function next() {
    if (S.scene === 'op') { S.trail = []; go('lab'); }
    else if (S.scene === 'deck') { if (!S.slot) S.slot = performance.now(); }
    else if (S.scene === 'end') restart();
  }
  function restart() { S.scene = 'op'; S.t0 = performance.now(); S.trail = []; S.ink = [0, 0, 0]; S.revealed = [false, false, false]; S.tries = 0; S.slot = 0; S.cart = { x: 150, y: 380 }; S.msg = ''; makePrints(); say(''); }
  C.addEventListener('pointerdown', function (e) {
    var p = pos(e);
    if (S.scene === 'lab') { for (var i = 0; i < 3; i++) { var c = capsule(i); if (S.revealed[i] && p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h && e.detail === 2) { pick(i); return; } } S.dragging = true; S.trail.push({ x: p.x, y: p.y, lift: true }); }
    else if (S.scene === 'deck') { if (p.x > S.cart.x && p.x < S.cart.x + 140 && p.y > S.cart.y && p.y < S.cart.y + 110) { S.dragging = true; S.grab = { dx: p.x - S.cart.x, dy: p.y - S.cart.y }; } }
    else if (S.scene === 'op') next();
    else if (S.scene === 'end') restart();
    C.setPointerCapture(e.pointerId);
  });
  C.addEventListener('pointermove', function (e) {
    if (!S.dragging) return; var p = pos(e);
    if (S.scene === 'lab') {
      var last = S.trail[S.trail.length - 1]; S.trail.push({ x: p.x, y: p.y }); if (S.trail.length > 1500) S.trail.shift();
      var d = last ? Math.hypot(p.x - last.x, p.y - last.y) : 0;
      for (var i = 0; i < 3; i++) { var c = capsule(i); if (p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h) { S.ink[i] += d; if (S.ink[i] > 420 && !S.revealed[i]) { S.revealed[i] = true; say((i + 1) + ' の指紋が浮かんだ：' + S.prints[i] + '（選ぶ：' + (i + 1) + ' キー、またはダブルクリック）'); } } }
    } else if (S.scene === 'deck') { S.cart = { x: p.x - S.grab.dx, y: p.y - S.grab.dy }; }
  });
  C.addEventListener('pointerup', function () {
    if (S.scene === 'deck' && S.dragging) { var d = deckBox(); if (S.cart.x + 70 > d.slotX && S.cart.x + 70 < d.slotX + d.slotW && S.cart.y + 110 > d.slotY - 40 && S.cart.y < d.slotY + 20) S.slot = performance.now(); }
    S.dragging = false;
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); }
    if (e.key === '1' || e.key === '2' || e.key === '3') pick(Number(e.key) - 1);
    if (e.key === 'r' || e.key === 'R') restart();
  });
  document.getElementById('next').addEventListener('click', next);
  document.getElementById('restart').addEventListener('click', restart);
})();
