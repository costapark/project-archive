/* =====================================================================
 * 플레이스홀더 텍스처 생성 (부팅 시 1회)
 *  - 적 / 투사체 / 작은 아이콘 : Phaser Graphics.generateTexture
 *  - 유닛(한글 이름 포함), 배경, 버튼(그라데이션) : CanvasTexture (2D 캔버스)
 *  - 에셋 매니페스트에 스프라이트가 있으면 그 텍스처(spr_unit_<id>, spr_enemy_<id>)가 우선
 * ===================================================================== */
window.RD = window.RD || {};

RD.Textures = (() => {
  const { TAU, isLight, pathPos } = RD.util;
  const UNIT_R = 38, UNIT_RL = 66;          // 필드 / 정보창 유닛 반지름

  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function canvasTex(scene, key, w, h, draw) {
    if (scene.textures.exists(key)) return key;
    const tex = scene.textures.createCanvas(key, w, h);
    draw(tex.getContext(), w, h);
    tex.refresh();
    return key;
  }
  function gfxTex(scene, key, w, h, draw) {
    if (scene.textures.exists(key)) return key;
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    draw(g, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
    return key;
  }
  const hex = c => parseInt(c.slice(1), 16);

  // ── 맵 배경: 타이틀 화면과 같은 사이버 네온 그리드 스타일 (에셋 미사용, 캔버스로 직접 그림) ──
  //  경로 = 네온 테두리의 데이터 도로(타일 구분선 + 마젠타 중앙 점선 + 진행 방향 화살표)
  //  배치 칸 = 시안 테두리 + 모서리 브래킷 홀로 타일 / 하단 패널 = 시안·마젠타 네온 라인
  //  theme: MAP_THEMES 의 이름 (레거시 연출 때 바뀌는 맵). 기본은 'base' = 'bg_map'
  const MAP_THEMES = {
    base:    { CY: '0,229,255', MG: '255,43,214', VI: '124,77,255', bg: ['#0a0618', '#070513', '#050409'], road: ['#120b2c', '#0d0820'], core: '60,30,120', grid: '58,42,122' },
    // 레거시 Lv.5 각성: 금빛 · 진홍 데이터 도로
    legacy5: { CY: '255,196,64', MG: '255,40,80', VI: '255,120,60', bg: ['#1a0808', '#120506', '#070304'], road: ['#2a0e10', '#1c080a'], core: '140,40,30', grid: '122,52,42' },
  };
  function makeBackground(scene, theme) {
    theme = MAP_THEMES[theme] ? theme : 'base';
    const key = theme === 'base' ? 'bg_map' : 'bg_map_' + theme, T = MAP_THEMES[theme];
    const W = RD.W, H = RD.H, P = RD.PATH, PW = RD.PW, PH = RD.PH, UI = RD.UI, GRID = RD.GRID;
    const { CY, MG, VI } = T;
    return canvasTex(scene, key, W, H, c => {
      let g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, T.bg[0]); g.addColorStop(0.65, T.bg[1]); g.addColorStop(1, T.bg[2]);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // 바탕 그리드 (타이틀 상단 그리드와 같은 90px 간격)
      c.lineWidth = 1; c.strokeStyle = `rgba(${T.grid},0.35)`;
      c.beginPath();
      for (let x = 0; x <= W; x += 90) { c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, UI.panelY); }
      for (let y = 0; y <= UI.panelY; y += 90) { c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); }
      c.stroke();
      let seed = 1337;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 90; i++) {      // 흩날리는 데이터 조각
        c.fillStyle = `rgba(${[CY, MG, VI][i % 3]},${0.08 + rnd() * 0.18})`;
        c.fillRect(rnd() * W, UI.hudH + rnd() * (UI.panelY - UI.hudH), 3, 6 + rnd() * 16);
      }

      // 경로 (바깥 사각형 - 안쪽 사각형)
      const hw = P.w / 2, ox = P.l - hw, oy = P.t - hw, ow = PW + P.w, oh = PH + P.w;
      const ix = P.l + hw, iy = P.t + hw, iw = PW - P.w, ih = PH - P.w;
      c.save();
      c.beginPath(); c.rect(ox, oy, ow, oh); c.rect(ix, iy, iw, ih);
      g = c.createLinearGradient(0, oy, 0, oy + oh);
      g.addColorStop(0, T.road[0]); g.addColorStop(1, T.road[1]);
      c.fillStyle = g; c.fill('evenodd');
      c.clip('evenodd');
      // 경로 타일 구분선 (경로 폭 간격)
      c.strokeStyle = `rgba(${CY},0.13)`; c.lineWidth = 2; c.beginPath();
      for (let x = ox; x <= ox + ow; x += P.w) { c.moveTo(x, oy); c.lineTo(x, oy + oh); }
      for (let y = oy; y <= oy + oh; y += P.w) { c.moveTo(ox, y); c.lineTo(ox + ow, y); }
      c.stroke();
      // 회로 무늬
      c.strokeStyle = `rgba(${VI},0.22)`; c.lineWidth = 2;
      const tmp = { x: 0, y: 0 };
      for (let i = 0; i < 70; i++) {
        pathPos(rnd() * RD.PERIM, (rnd() - 0.5) * (P.w - 24), tmp);
        const L = 10 + rnd() * 22;
        c.beginPath(); c.moveTo(tmp.x, tmp.y); c.lineTo(tmp.x + L, tmp.y); c.lineTo(tmp.x + L + 6, tmp.y + 6); c.stroke();
        c.fillStyle = `rgba(${VI},0.4)`; c.fillRect(tmp.x - 2, tmp.y - 2, 4, 4);
      }
      c.restore();
      // 경로 테두리 네온 (글로우)
      const neon = (x, y, w, h, rgb, lw, blur) => {
        c.save(); c.shadowColor = `rgb(${rgb})`; c.shadowBlur = blur;
        c.strokeStyle = `rgba(${rgb},0.95)`; c.lineWidth = lw; c.strokeRect(x, y, w, h); c.restore();
      };
      neon(ox, oy, ow, oh, CY, 4, 18);
      neon(ix, iy, iw, ih, CY, 3, 14);
      c.strokeStyle = `rgba(${CY},0.25)`; c.lineWidth = 10; c.strokeRect(ox - 7, oy - 7, ow + 14, oh + 14);
      // 중앙 점선 (마젠타) + 진행 방향 화살표
      c.save(); c.setLineDash([22, 26]); c.shadowColor = `rgb(${MG})`; c.shadowBlur = 8;
      c.strokeStyle = `rgba(${MG},0.45)`; c.lineWidth = 3; c.strokeRect(P.l, P.t, PW, PH); c.restore();
      c.fillStyle = `rgba(${MG},0.6)`;
      for (const [x, y, a] of [[W / 2, P.t, 0], [P.r, (P.t + P.b) / 2, Math.PI / 2], [W / 2, P.b, Math.PI], [P.l, (P.t + P.b) / 2, -Math.PI / 2]]) {
        for (const d of [-26, 0, 26]) {
          c.save(); c.translate(x, y); c.rotate(a); c.translate(d, 0);
          c.beginPath(); c.moveTo(10, 0); c.lineTo(-8, -14); c.lineTo(-2, 0); c.lineTo(-8, 14); c.closePath(); c.fill(); c.restore();
        }
      }
      // 경로 모서리 노드
      for (const [x, y] of [[P.l, P.t], [P.r, P.t], [P.r, P.b], [P.l, P.b]]) {
        c.save(); c.shadowColor = `rgb(${CY})`; c.shadowBlur = 16;
        c.strokeStyle = `rgba(${CY},0.9)`; c.lineWidth = 3;
        c.beginPath(); c.moveTo(x, y - 22); c.lineTo(x + 22, y); c.lineTo(x, y + 22); c.lineTo(x - 22, y); c.closePath(); c.stroke();
        c.restore();
      }

      // 안쪽 결계 (유닛 배치 영역)
      g = c.createRadialGradient(W / 2, (P.t + P.b) / 2, 60, W / 2, (P.t + P.b) / 2, 620);
      g.addColorStop(0, `rgba(${T.core},0.35)`); g.addColorStop(1, 'rgba(10,6,24,0)');
      c.fillStyle = g; c.fillRect(ix, iy, iw, ih);
      // 배치 칸: 홀로 타일
      const k = 14;
      for (let r = 0; r < GRID.rows; r++) for (let col = 0; col < GRID.cols; col++) {
        const x = GRID.x + col * GRID.cell + 6, y = GRID.y + r * GRID.cell + 6, w = GRID.cell - 12;
        g = c.createLinearGradient(x, y, x, y + w);
        g.addColorStop(0, `rgba(${CY},0.07)`); g.addColorStop(1, `rgba(${VI},0.05)`);
        c.fillStyle = g; c.fillRect(x, y, w, w);
        c.strokeStyle = `rgba(${CY},0.22)`; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, w - 2);
        c.strokeStyle = `rgba(${CY},0.75)`; c.lineWidth = 3; c.beginPath();
        for (const [bx, by, dx, dy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + w, 1, -1], [x + w, y + w, -1, -1]]) {
          c.moveTo(bx + k * dx, by); c.lineTo(bx, by); c.lineTo(bx, by + k * dy);
        }
        c.stroke();
        c.fillStyle = `rgba(${CY},0.18)`; c.fillRect(x + w / 2 - 2, y + w / 2 - 2, 4, 4);
      }

      // HUD 상단 어둡게 + 네온 라인
      g = c.createLinearGradient(0, 0, 0, UI.hudH);
      g.addColorStop(0, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0.1)');
      c.fillStyle = g; c.fillRect(0, 0, W, UI.hudH);
      // 하단 패널
      g = c.createLinearGradient(0, UI.panelY, 0, H);
      g.addColorStop(0, '#0b0f24'); g.addColorStop(1, '#050409');
      c.fillStyle = g; c.fillRect(0, UI.panelY, W, H - UI.panelY);
      c.strokeStyle = `rgba(${T.grid},0.25)`; c.lineWidth = 1; c.beginPath();
      for (let x = 0; x <= W; x += 90) { c.moveTo(x + 0.5, UI.panelY); c.lineTo(x + 0.5, H); }
      c.stroke();
      c.save(); c.shadowColor = `rgb(${CY})`; c.shadowBlur = 16;
      c.fillStyle = `rgba(${CY},0.95)`; c.fillRect(0, UI.panelY, W, 4); c.restore();
      c.fillStyle = `rgba(${MG},0.55)`; c.fillRect(0, UI.panelY + 8, W, 2);
    });
  }

  // ── 유닛 몸통 (원 + 한글 2글자) ──
  function makeUnit(scene, t, key, R) {
    const S = 2 * (R + 16);
    canvasTex(scene, key, S, S, c => {
      const x = S / 2, y = S / 2;
      c.beginPath(); c.arc(x, y, R, 0, TAU); c.fillStyle = t.color; c.fill();
      c.beginPath(); c.arc(x - R * 0.3, y - R * 0.35, R * 0.45, 0, TAU); c.fillStyle = 'rgba(255,255,255,0.16)'; c.fill();
      const light = isLight(t.color), size = Math.round(26 * R / UNIT_R);
      c.font = `bold ${size}px ${RD.FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      if (!light) { c.lineWidth = 6 * R / UNIT_R; c.lineJoin = 'round'; c.strokeStyle = 'rgba(0,0,0,0.85)'; c.strokeText(t.short, x, y + 2); }
      c.fillStyle = light ? '#2a2030' : '#ffffff'; c.fillText(t.short, x, y + 2);
    });
  }
  // ── 등급 테두리 + 등급 점 (흰색 → 등급 색으로 tint) ──
  function makeFrame(scene, key, R, grade) {
    const S = 2 * (R + 16), k = R / UNIT_R;
    canvasTex(scene, key, S, S, c => {
      const x = S / 2, y = S / 2;
      c.beginPath(); c.arc(x, y, R, 0, TAU); c.lineWidth = 6 * k; c.strokeStyle = '#ffffff'; c.stroke();
      c.fillStyle = '#ffffff';
      for (let i = 0; i < grade; i++) {
        c.beginPath(); c.arc(x + (i - (grade - 1) / 2) * 10 * k, y + R + 6 * k, 3.6 * k, 0, TAU); c.fill();
      }
    });
  }

  // ── 등급 점만 (캐릭터 스프라이트 유닛 발밑) ──
  function makePips(scene, key, grade) {
    canvasTex(scene, key, 112, 16, c => {
      c.fillStyle = '#ffffff';
      for (let i = 0; i < grade; i++) { c.beginPath(); c.arc(56 + (i - (grade - 1) / 2) * 12, 8, 4.4, 0, TAU); c.fill(); }
    });
  }

  // ── 레벨 이펙트용 흰색 텍스처 (게임에서 tint + ADD 블렌드) ──
  function makeAuraFx(scene) {
    canvasTex(scene, 'fx_soft', 128, 128, c => {     // 부드러운 원형 빛
      const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    });
    canvasTex(scene, 'fx_spark', 24, 24, c => {
      const g = c.createRadialGradient(12, 12, 0, 12, 12, 12);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 24, 24);
    });
    canvasTex(scene, 'fx_pillar', 64, 160, c => {    // 위로 솟는 빛기둥 (Lv.3)
      const g = c.createLinearGradient(0, 0, 0, 160);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0.55)');
      const h = c.createLinearGradient(0, 0, 64, 0);
      c.fillStyle = g; c.fillRect(0, 0, 64, 160);
      c.globalCompositeOperation = 'destination-in';
      h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = h; c.fillRect(0, 0, 64, 160);
    });
    // 바닥 마법진: 레벨별 (1 단일 링, 2 육각 룬, 3 이중 링 + 별)  — 위에서 본 원, 게임에서 scaleY 로 눕힘
    const S = 200, C = S / 2;
    const ring = (c, r, w) => { c.beginPath(); c.arc(C, C, r, 0, TAU); c.lineWidth = w; c.stroke(); };
    const poly = (c, n, r, rot) => { c.beginPath(); for (let i = 0; i <= n; i++) { const a = rot + i * TAU / n; i ? c.lineTo(C + Math.cos(a) * r, C + Math.sin(a) * r) : c.moveTo(C + Math.cos(a) * r, C + Math.sin(a) * r); } c.stroke(); };
    canvasTex(scene, 'fx_rune1', S, S, c => {
      c.strokeStyle = '#fff'; c.shadowColor = '#fff'; c.shadowBlur = 8;
      ring(c, 84, 4);
      for (let i = 0; i < 24; i++) { const a = i * TAU / 24; c.beginPath(); c.moveTo(C + Math.cos(a) * 72, C + Math.sin(a) * 72); c.lineTo(C + Math.cos(a) * (i % 2 ? 78 : 66), C + Math.sin(a) * (i % 2 ? 78 : 66)); c.lineWidth = 3; c.stroke(); }
    });
    canvasTex(scene, 'fx_rune2', S, S, c => {
      c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.shadowColor = '#fff'; c.shadowBlur = 10;
      ring(c, 90, 4); ring(c, 74, 2);
      poly(c, 6, 74, 0); poly(c, 6, 74, Math.PI / 6);
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6; c.beginPath(); c.arc(C + Math.cos(a) * 82, C + Math.sin(a) * 82, 5, 0, TAU); c.fill(); }
    });
    canvasTex(scene, 'fx_rune3', S, S, c => {
      c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.shadowColor = '#fff'; c.shadowBlur = 12;
      ring(c, 94, 5); ring(c, 82, 2); ring(c, 46, 3);
      c.beginPath();
      for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + i * 2 * TAU / 5; i ? c.lineTo(C + Math.cos(a) * 82, C + Math.sin(a) * 82) : c.moveTo(C + Math.cos(a) * 82, C + Math.sin(a) * 82); }
      c.lineWidth = 3; c.stroke();
      for (let i = 0; i < 12; i++) { const a = i * TAU / 12; c.save(); c.translate(C + Math.cos(a) * 88, C + Math.sin(a) * 88); c.rotate(a); c.fillRect(-3, -6, 6, 12); c.restore(); }
    });
  }

  // ── 적 (Graphics) ──
  function shapePoints(shape, cx, cy, s) {
    if (shape === 'diamond') return [{ x: cx, y: cy - s * 1.1 }, { x: cx + s, y: cy }, { x: cx, y: cy + s * 1.1 }, { x: cx - s, y: cy }];
    if (shape === 'hex') { const pts = []; for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + Math.PI / 6; pts.push({ x: cx + Math.cos(a) * s, y: cy + Math.sin(a) * s }); } return pts; }
    if (shape === 'triangle') return [{ x: cx, y: cy - s * 1.1 }, { x: cx + s, y: cy + s * 0.75 }, { x: cx - s, y: cy + s * 0.75 }];
    return null;
  }
  function makeEnemy(scene, type, boss) {
    const s = type.size, S = Math.ceil(s * 2.5 + 12);
    gfxTex(scene, 'enemy_' + type.id, S, S, g => {
      const cx = S / 2, cy = S / 2;
      g.fillStyle(hex(type.color), 1);
      g.lineStyle(boss ? 6 : 3, boss ? 0xff1744 : 0x000000, boss ? 1 : 0.6);
      if (type.shape === 'circle') { g.fillCircle(cx, cy, s); g.strokeCircle(cx, cy, s); }
      else if (type.shape === 'square') { g.fillRect(cx - s * 0.85, cy - s * 0.85, s * 1.7, s * 1.7); g.strokeRect(cx - s * 0.85, cy - s * 0.85, s * 1.7, s * 1.7); }
      else { const pts = shapePoints(type.shape, cx, cy, s); g.fillPoints(pts, true); g.strokePoints(pts, true); }
      g.fillStyle(boss ? 0xff1744 : 0x1a1a1a, 1);
      const ey = cy - s * 0.15, ex = s * 0.32, er = Math.max(3.2, s * 0.13);
      g.fillCircle(cx - ex, ey, er); g.fillCircle(cx + ex, ey, er);
    });
  }

  // ── 투사체 (Graphics) ──
  function makeProjectiles(scene) {
    gfxTex(scene, 'p_arrow', 40, 16, g => {
      g.lineStyle(4, 0xe6d8a8, 1); g.lineBetween(2, 8, 30, 8);
      g.fillStyle(0xe6d8a8, 1); g.fillTriangle(38, 8, 26, 1, 26, 15);
    });
    gfxTex(scene, 'p_bullet', 16, 6, g => { g.fillStyle(0xffee58, 1); g.fillRect(0, 0, 16, 6); });
    gfxTex(scene, 'p_missile', 48, 20, g => {
      g.fillStyle(0xffab40, 0.6); g.fillCircle(10, 10, 9);
      g.fillStyle(0xcfd8dc, 1); g.fillRect(12, 4, 24, 12);
      g.fillStyle(0xff5252, 1); g.fillTriangle(44, 10, 36, 4, 36, 16);
    });
  }
  // 마법구/화염/신성탄: 색별로 필요할 때 생성 (반지름 20 기준, 스프라이트 scale 로 크기 조절)
  function orb(scene, color) {
    return gfxTex(scene, 'orb_' + color, 80, 80, g => {
      const c = hex(color);
      g.fillStyle(c, 0.35); g.fillCircle(34, 40, 36);
      g.fillStyle(c, 1); g.fillCircle(40, 40, 20);
      g.fillStyle(0xffffff, 0.8); g.fillCircle(40, 40, 8);
    });
  }

  // ── 작은 공용 아이콘 ──
  function makeMisc(scene) {
    canvasTex(scene, 'shadow', 72, 28, c => { c.fillStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.ellipse(36, 14, 32, 12, 0, 0, TAU); c.fill(); });
    gfxTex(scene, 'halo', 100, 100, g => { g.fillStyle(0xffffff, 1); g.fillCircle(50, 50, UNIT_R + 10); });
    gfxTex(scene, 'badge', 32, 32, g => {
      g.fillStyle(0x43a047, 1); g.fillCircle(16, 16, 13); g.lineStyle(3, 0x0b2e0d, 1); g.strokeCircle(16, 16, 13);
      g.fillStyle(0xffffff, 1); g.fillTriangle(16, 8.4, 23.2, 20.8, 8.8, 20.8);
    });
    // 유닛 머리 위 레벨 표시 (레벨 색 바탕 + 검은 글자)
    //  히든 유닛(lvtagH_)은 무지개 그라데이션 바탕
    const lvtag = (key, label, fill) => canvasTex(scene, key, 74, 38, c => {
      rrect(c, 2, 2, 70, 34, 12);
      if (fill) c.fillStyle = fill;
      else { const g = c.createLinearGradient(2, 0, 72, 0); ['#ff6b6b', '#ffd93d', '#6bff95', '#4dd9ff', '#c86bff'].forEach((s, i) => g.addColorStop(i / 4, s)); c.fillStyle = g; }
      c.fill();
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.stroke();
      c.font = `900 26px ${RD.FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#140c1c'; c.fillText(label, 37, 21);
    });
    RD.GRADES.forEach((gr, i) => { lvtag('lvtag_' + i, gr.name, gr.color); lvtag('lvtagH_' + i, gr.name, null); });
    // 필드 유닛 타입 표시: 발밑 타입 색 원판(흰색 → 틴트) + 오른쪽 아래 타입 아이콘 (워리어 검 · 아처 활 · 위저드 별)
    canvasTex(scene, 'typeplate', 96, 40, c => {
      c.beginPath(); c.ellipse(48, 20, 44, 16, 0, 0, TAU);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fill();
      c.lineWidth = 5; c.strokeStyle = '#ffffff'; c.stroke();
    });
    const typeIcon = (cat, glyph) => canvasTex(scene, 'typeic_' + cat, 44, 44, c => {
      c.beginPath(); c.arc(22, 22, 19, 0, TAU); c.fillStyle = RD.CATEGORIES[cat].color; c.fill();
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.stroke();
      c.strokeStyle = '#ffffff'; c.fillStyle = '#ffffff'; c.lineCap = 'round'; c.lineJoin = 'round';
      glyph(c);
    });
    typeIcon('warrior', c => {          // 검 (대각선 칼날 + 가드 + 손잡이)
      c.lineWidth = 4.5; c.beginPath(); c.moveTo(30, 12); c.lineTo(17, 25); c.stroke();
      c.lineWidth = 4; c.beginPath(); c.moveTo(12, 21); c.lineTo(21, 30); c.stroke();
      c.lineWidth = 3.5; c.beginPath(); c.moveTo(16, 26); c.lineTo(11, 31); c.stroke();
    });
    typeIcon('archer', c => {           // 활 + 화살
      c.lineWidth = 3.5; c.beginPath(); c.arc(16, 22, 12, -Math.PI / 2.4, Math.PI / 2.4); c.stroke();
      c.lineWidth = 1.8; c.beginPath(); c.moveTo(19.4, 10.4); c.lineTo(19.4, 33.6); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.moveTo(12, 22); c.lineTo(33, 22); c.stroke();
      c.beginPath(); c.moveTo(34, 22); c.lineTo(28, 17.5); c.lineTo(28, 26.5); c.closePath(); c.fill();
    });
    typeIcon('wizard', c => {           // 네 갈래 별 (마법)
      c.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, r = i % 2 ? 4.5 : 13; c.lineTo(22 + Math.cos(a) * r, 22 + Math.sin(a) * r); }
      c.closePath(); c.fill();
    });
    canvasTex(scene, 'coin', 48, 48, c => {
      c.beginPath(); c.arc(24, 24, 20, 0, TAU); c.fillStyle = '#ffc107'; c.fill();
      c.lineWidth = 4; c.strokeStyle = '#8a5a00'; c.stroke();
      c.font = `bold 22px ${RD.FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#6d4300'; c.fillText('G', 24, 26);
    });
    canvasTex(scene, 'mineral', 48, 48, c => {   // 광물: 육각 크리스탈
      const pts = [[24, 3], [40, 16], [36, 42], [12, 42], [8, 16]];
      c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
      const g = c.createLinearGradient(8, 3, 40, 42); g.addColorStop(0, '#e1f8ff'); g.addColorStop(0.5, '#4fc3f7'); g.addColorStop(1, '#1565c0');
      c.fillStyle = g; c.fill(); c.lineWidth = 3; c.strokeStyle = '#0b2f5c'; c.stroke();
      c.beginPath(); c.moveTo(24, 3); c.lineTo(20, 18); c.lineTo(24, 42); c.moveTo(20, 18); c.lineTo(8, 16); c.moveTo(20, 18); c.lineTo(40, 16);
      c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.55)'; c.stroke();
    });
  }

  // ── 버튼 배경 (둥근 사각형 + 그라데이션) ──
  const SCHEMES = {
    gold:  ['#ffca28', '#e65100', '#3e2000'],
    green: ['#66bb6a', '#1b5e20', '#ffffff'],
    red:   ['#ef5350', '#8e1b1b', '#ffffff'],
    warrior: ['#e0874f', '#7a3410', '#ffffff'],
    archer:  ['#6cc04a', '#25601a', '#ffffff'],
    wizard:  ['#8c7bff', '#3b23a8', '#ffffff'],
    mine:  ['#4f8cff', '#1a3590', '#ffffff'],
    dark:  ['#3a3150', '#1d1729', '#ffffff'],
    change: ['#26c6da', '#00606e', '#ffffff'],     // 타입 변경
    book:  ['#7e57c2', '#311b92', '#ffffff'],      // 레시피 도감
    hidden: ['#ff6bf0', '#6a1b9a', '#ffffff'],     // 히든 강화
  };
  function button(scene, scheme, w, h, enabled) {
    const key = `btn_${scheme}_${w}x${h}_${enabled ? 1 : 0}`;
    return canvasTex(scene, key, w + 8, h + 8, c => {
      rrect(c, 4, 4, w, h - 2, 28);
      if (enabled) { const g = c.createLinearGradient(0, 4, 0, 4 + h); g.addColorStop(0, SCHEMES[scheme][0]); g.addColorStop(1, SCHEMES[scheme][1]); c.fillStyle = g; }
      else c.fillStyle = '#2a2433';
      c.fill();
      c.lineWidth = 4; c.strokeStyle = enabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'; c.stroke();
    });
  }
  function buttonShadow(scene, w, h) {
    return canvasTex(scene, `btnsh_${w}x${h}`, w + 8, h + 8, c => { rrect(c, 4, 4, w, h, 28); c.fillStyle = 'rgba(0,0,0,0.5)'; c.fill(); });
  }

  function generateAll(scene) {
    makeBackground(scene);
    for (const t of RD.UNITS) { makeUnit(scene, t, 'unit_' + t.id, UNIT_R); makeUnit(scene, t, 'unitL_' + t.id, UNIT_RL); }
    for (let g = 0; g < RD.GRADES.length; g++) { makeFrame(scene, 'frame_' + g, UNIT_R, g); makeFrame(scene, 'frameL_' + g, UNIT_RL, g); makePips(scene, 'pips_' + g, g); }
    makeAuraFx(scene);
    for (const e of RD.ENEMIES) makeEnemy(scene, e, false);
    for (const b of RD.BOSSES) makeEnemy(scene, b, true);
    makeEnemy(scene, RD.PACKET.type, true);
    makeProjectiles(scene);
    makeMisc(scene);
  }

  // ── 스프라이트 오버라이드 헬퍼 ──
  // 유닛 몸통 GameObject 생성: 매니페스트 스프라이트가 있으면 Sprite(+idle 애니), 없으면 플레이스홀더 Image
  function unitBody(scene, t, large) {
    const a = RD.ASSETS.units[t.id], key = RD.assetKey('spr_unit_', t.id, a);
    if (a && scene.textures.exists(key)) {
      const spr = scene.add.sprite(0, 0, key);
      const fh = spr.frame.realHeight || spr.height;
      const base = a.bodyH ? (RD.UNIT_SPRITE_H[t.grade] || 84) / a.bodyH : (a.scale || (UNIT_R * 2.3) / fh);
      spr.setScale(base * (large ? UNIT_RL / UNIT_R * 0.8 : 1));
      if (a.originY !== undefined) spr.setOrigin(0.5, a.originY);
      if (a.tint !== undefined) spr.setTint(a.tint);
      // 레벨 2 이상: 외곽 발광 (WebGL 전용 preFX) — 정보창 미리보기(1개)에만 사용
      //  preFX 는 오브젝트마다 프레임버퍼를 여러 번 바꿔 그려서, 필드 유닛 수십 개에 쓰면 모바일 GPU 가 버티지 못함
      //  (70스테이지 무렵 Lv.2+ 유닛 45개 → 프레임당 프레임버퍼 전환 180회 → 튕김). 필드 유닛은 GameScene 의 테두리 스프라이트로 대신함
      if (large && t.grade >= 2 && spr.preFX) spr.preFX.addGlow(RD.util.colorInt(RD.unitTextColor(t)), t.hidden ? 4 : t.grade >= 3 ? 3 : 2, 0, false, 0.1, t.hidden ? 12 : 8);
      if (scene.anims.exists(key + '_idle')) spr.play({ key: key + '_idle', startFrame: Math.floor(Math.random() * 4) });
      spr.rdSprite = { key, attack: scene.anims.exists(key + '_attack') ? key + '_attack' : null, idle: scene.anims.exists(key + '_idle') ? key + '_idle' : null };
      return spr;
    }
    return scene.add.image(0, 0, (large ? 'unitL_' : 'unit_') + t.id);
  }
  function enemySprite(scene, type) {
    const key = 'spr_enemy_' + type.id, a = RD.ASSETS.enemies[type.id];
    if (a && scene.textures.exists(key)) {
      const spr = scene.add.sprite(0, 0, key);
      const fh = spr.frame.realHeight || spr.height;
      spr.setScale(a.scale || (type.size * 2.4) / fh);
      if (scene.anims.exists(key + '_walk')) spr.play(key + '_walk');
      spr.rdSprite = { key };
      return spr;
    }
    return scene.add.sprite(0, 0, 'enemy_' + type.id);
  }

  return { UNIT_R, UNIT_RL, generateAll, orb, button, buttonShadow, unitBody, enemySprite, SCHEMES, mapTexture: makeBackground };
})();
