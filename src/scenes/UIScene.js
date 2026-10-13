/* =====================================================================
 * UIScene: GameScene 위에서 병렬 실행. HUD(라운드/타이머/골드/적 수/보스),
 * 하단 패널(유닛 정보, 조합/판매/타입 변경/소환, 강화, 히든 강화), 히든 레시피 도감, 알림, 일시정지 오버레이, 단축키.
 * ===================================================================== */
window.RD = window.RD || {};

RD.UIScene = class UIScene extends Phaser.Scene {
  constructor() { super('UIScene'); }

  get L() { return this.scene.get('GameScene').logic; }

  create() {
    const W = RD.W, UI = RD.UI, S = RD.util.textStyle;
    // ── HUD ──
    this.hudG = this.add.graphics();
    this.tRound = this.add.text(28, 60, '', S(42, '#ffe082', 6)).setOrigin(0, 0.5);
    this.tTimer = this.add.text(228, 62, '', S(26, '#d4c8ea')).setOrigin(0, 0.5);
    // 자원: 골드(처치 보상) / 광물(자동 채굴)
    this.add.image(470, 60, RD.CURRENCIES.gold.icon).setScale(0.85);
    this.tGold = this.add.text(494, 62, '', S(36, RD.CURRENCIES.gold.color, 6)).setOrigin(0, 0.5);
    this.add.image(634, 60, RD.CURRENCIES.mineral.icon).setScale(0.85);
    this.tMineral = this.add.text(658, 62, '', S(36, RD.CURRENCIES.mineral.color, 6)).setOrigin(0, 0.5);
    this.tEnemy = this.add.text(0, 150, '', S(38, '#ffffff', 6)).setOrigin(0.5);
    this.tEType = this.add.text(52, 150, '', S(30, '#ffffff', 6)).setOrigin(0, 0.5);   // 이번 라운드 적 타입
    this.tDiff = this.add.text(0, 150, '', S(28, '#ffffff', 6)).setOrigin(1, 0.5);     // 난이도 (적 수 바 오른쪽 끝)
    // 이벤트 몬스터 패킷: 체력 숫자 + 남은 시간 (필드 맨 위, 패킷이 있을 때만)
    this.tPacket = this.add.text(RD.W / 2, 226, '', S(32, RD.PACKET.type.color, 6)).setOrigin(0.5).setDepth(5).setVisible(false);
    this.tBoss = this.add.text(548 + 250, 150, '', S(32, '#ffffff', 6)).setOrigin(0.5);

    // ── 정보 패널 ──
    const r = UI.info;
    const ig = this.add.graphics();
    ig.fillStyle(0x1e162a, 0.9).fillRoundedRect(r.x, r.y, r.w, r.h, 28);
    ig.lineStyle(3, 0xffc878, 0.18).strokeRoundedRect(r.x, r.y, r.w, r.h, 28);
    const icx = r.x + r.w / 2;
    this.idle = [
      this.add.text(icx, r.y + 46, '유닛을 터치하면 정보가 표시됩니다', S(32, '#e6dcf5')).setOrigin(0.5),
      this.add.text(icx, r.y + 96, '드래그로 이동  ·  같은 유닛 3개 → 다음 레벨', S(26, '#a99bc0', 0, 'normal')).setOrigin(0.5),
      this.add.text(icx, r.y + 138, '', S(26, '#8f82a6', 0, 'normal')).setOrigin(0.5),
    ];
    const tx = r.x + 200;
    this.sel = {
      tagG: this.add.graphics(),
      tag: this.add.text(tx + 48, r.y + 44, '', S(28, '#1a1022')).setOrigin(0.5),
      name: this.add.text(tx + 116, r.y + 44, '', S(42, '#ffffff')).setOrigin(0, 0.5),
      count: this.add.text(r.x + r.w - 28, r.y + 44, '', S(28, '#b9aecb')).setOrigin(1, 0.5),
      stats: this.add.text(tx, r.y + 94, '', S(26, '#e6dcf5', 0, 'normal')).setOrigin(0, 0.5),
      special: this.add.text(tx, r.y + 138, '', S(26, '#ffffff')).setOrigin(0, 0.5),
      dps: this.add.text(r.x + r.w - 24, r.y + 138, '', S(28, '#ffd54f')).setOrigin(1, 0.5),
    };
    this.preview = null; this.previewType = null;

    // ── 버튼 ──
    const act = (fn, sys) => () => {
      const L = this.L, G = L.G;
      if (G.mode === 'over' || this.bookOpen) return;
      if (!sys && G.mode !== 'playing') return;
      return fn(L, G);
    };
    this.btn = {
      combine: new RD.UIButton(this, UI.btnCombine, { scheme: 'green', onClick: act((L, G) => L.combine(G.selected)) }),
      sell:    new RD.UIButton(this, UI.btnSell,    { scheme: 'red',   onClick: act((L, G) => L.sell(G.selected)) }),
      change:  new RD.UIButton(this, UI.btnChange,  { scheme: 'change', labelSize: 42, onClick: act((L, G) => L.typeChange(G.selected)) }),
      book:    new RD.UIButton(this, UI.btnBook,    { scheme: 'book', labelSize: 34, onClick: act(() => this.openBook(), true) }),
      hidden:  new RD.UIButton(this, UI.btnHidden,  { scheme: 'hidden', labelSize: 32, subSize: 22, onClick: act(L => L.upgradeHidden()) }),
      summon:  new RD.UIButton(this, UI.btnSummon,  { scheme: 'gold', big: true, repeat: { delay: 250, interval: 70, accel: 0.85, minInterval: 25 }, onClick: act(L => L.summon()) }),
      pause:   new RD.UIButton(this, UI.btnPause,   { scheme: 'dark', onClick: act(L => L.togglePause(), true) }),
      speed:   new RD.UIButton(this, UI.btnSpeed,   { scheme: 'dark', labelSize: 40, onClick: act(L => { L.toggleSpeed(); this.registry.set('speed', L.G.speed); }, true) }),
    };
    this.upgBtns = RD.CAT_KEYS.map((k, i) => new RD.UIButton(this, UI.upg[i], { scheme: k, labelSize: 40, onClick: act(L => L.upgrade(k)) }));
    this.btn.mine = new RD.UIButton(this, UI.btnMine, { scheme: 'mine', labelSize: 40, onClick: act(L => L.upgradeMine()) });
    // 타입별 자동 조합 (버튼 아래 줄에 레벨별 보유 수 표시)
    this.autoBtns = RD.AUTO_KEYS.map((k, i) => new RD.UIButton(this, UI.auto[i], {
      scheme: 'dark', labelSize: 34, subSize: 24, labelColor: RD.CATEGORIES[k].color, dimSubColor: '#8a8199',
      onClick: act(L => L.autoCombine(k)) }));
    // 레벨별 보유 수 칩 (레벨 색 = 유닛 머리 위 레벨 표시 색). 타입 칸은 Lv.1~5, 마지막 칸은 Lv.0 + 히든
    const maxN = RD.MAX_NORMAL_GRADE;
    this.autoChips = RD.AUTO_KEYS.map((k, i) => {
      const b = UI.auto[i], grades = k === 'none' ? [0, 'H'] : Array.from({ length: maxN }, (_, j) => j + 1);
      const cw = k === 'none' ? 110 : 42, gap = 5;
      const x0 = b.x + b.w / 2 - (grades.length * cw + (grades.length - 1) * gap) / 2, cy = b.y + b.h - 30;
      const g = this.add.graphics();
      const chips = grades.map((gr, j) => ({ gr, x: x0 + j * (cw + gap), w: cw,
        t: this.add.text(x0 + j * (cw + gap) + cw / 2, cy + 1, '', S(21, '#140c1c', 0)).setOrigin(0.5) }));
      return { g, chips, cy, last: '' };
    });

    // ── 일시정지 오버레이 ──
    this.pauseLayer = this.add.container(0, 0).setDepth(40).setVisible(false);
    const pg = this.add.graphics(); pg.fillStyle(0x000000, 0.5).fillRect(0, UI.hudH, W, UI.panelY - UI.hudH);
    this.pauseLayer.add([pg,
      this.add.text(W / 2, 720, '일시정지', S(80, '#ffffff', 10)).setOrigin(0.5),
      this.add.text(W / 2, 820, '화면을 터치하면 계속합니다', S(32, '#d4c8ea', 0, 'normal')).setOrigin(0.5)]);
    this.pauseZone = this.add.zone(0, UI.hudH, W, UI.panelY - UI.hudH).setOrigin(0).setInteractive();
    this.pauseZone.on('pointerup', p => {
      if (this.L.G.mode === 'paused' && !this.bookOpen && !RD.util.inRect(p, UI.btnQuit)) { this.quitArmed = false; this.L.togglePause(); }
    });
    // 다이브 중단 (일시정지 중에만 보임): 두 번 눌러야 중단 → 게임 오버(기억 파편 정산) 화면
    this.quitArmed = false;
    this.btnQuit = new RD.UIButton(this, UI.btnQuit, { scheme: 'red', labelSize: 38, subSize: 22, onClick: () => {
      const L = this.L;
      if (L.G.mode !== 'paused' || this.bookOpen) return;
      if (!this.quitArmed) { this.quitArmed = true; return; }
      this.quitArmed = false;
      L.gameOver(RD.QUIT_REASON);
    } }).setDepth(41);
    // 히든 강화 잠김 안내 (히든 유닛을 처음 얻기 전)
    const hb = UI.btnHidden;
    this.hiddenHint = this.add.text(hb.x + hb.w / 2, hb.y + hb.h / 2, '레거시 유닛을 만들면\n레거시 강화 개방', S(22, '#7d7290', 0, 'normal')).setOrigin(0.5).setAlign('center');

    this.buildBook();

    // ── 알림 ──
    this.toasts = [];

    // ── PC 단축키: S 소환, D 조합, F 판매, G 타입 변경, 1/2/3 강화, 4 채굴 강화, 5 히든 강화, Q/W/E/R 자동 조합, B 레시피 도감, Space 배속, P/Esc 일시정지 ──
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown', e => {
        const L = this.L, G = L.G;
        if (G.mode === 'over') return;
        if (this.bookOpen) { if (e.key === 'Escape' || e.key === 'b' || e.key === 'B') this.closeBook(); return; }
        if (e.key === 'b' || e.key === 'B') return this.openBook();
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') return L.togglePause();
        if (e.key === ' ') { e.preventDefault && e.preventDefault(); L.toggleSpeed(); this.registry.set('speed', G.speed); return; }
        if (G.mode !== 'playing') return;
        const k = e.key.toLowerCase();
        if (k === 's') L.summon();
        else if (k === 'd') L.combine(G.selected);
        else if (k === 'f') L.sell(G.selected);
        else if (k === 'g') L.typeChange(G.selected);
        else if (k === '5') L.upgradeHidden();
        else if (k === '1' || k === '2' || k === '3') L.upgrade(RD.CAT_KEYS[+k - 1]);
        else if (k === '4') L.upgradeMine();
        else if ('qwer'.includes(k) && k.length === 1) L.autoCombine(RD.AUTO_KEYS['qwer'.indexOf(k)]);
      });
    }
  }

  // ── 히든 레시피 도감: 전체 화면 오버레이 (열려 있는 동안 게임 일시정지) ──
  //  결과는 만들어 본 적이 있어야 이름이 보이고(그 전엔 ???), 재료는 가져본 적이 있어야 이름이 보임(그 전엔 레벨·타입 힌트)
  //  지금 필드에 있는 재료는 초록색, 재료가 다 모이면 [조합] 버튼이 켜짐
  buildBook() {
    const B = RD.UI.book, S = RD.util.textStyle, D = 50;
    const items = this.bookItems = [];
    const g = this.add.graphics().setDepth(D);
    g.fillStyle(0x05030a, 0.86).fillRect(0, 0, RD.W, RD.H);
    g.fillStyle(0x140e22, 0.98).fillRoundedRect(B.x, B.y, B.w, B.h, 36);
    g.lineStyle(4, RD.util.colorInt(RD.HIDDEN_COLOR), 0.8).strokeRoundedRect(B.x, B.y, B.w, B.h, 36);
    RD.RECIPES.forEach((rc, i) => {
      const y = B.rowY + i * B.rowH;
      g.fillStyle(i % 2 ? 0x1d1530 : 0x241a3a, 1).fillRoundedRect(B.x + 16, y, B.w - 32, B.rowH - 8, 18);
    });
    // 도감을 연 동안 아래(필드·버튼) 터치 차단
    const block = this.add.zone(0, 0, RD.W, RD.H).setOrigin(0).setInteractive().setDepth(D);
    items.push(g, block);
    this.bookTitle = this.add.text(RD.W / 2, B.y + 64, '레거시 레시피 도감', S(52, RD.HIDDEN_COLOR, 8)).setOrigin(0.5).setDepth(D);
    this.bookSub = this.add.text(RD.W / 2, B.y + 118, '', S(26, '#b9aecb', 0, 'normal')).setOrigin(0.5).setDepth(D);
    items.push(this.bookTitle, this.bookSub);
    this.bookRows = RD.RECIPES.map((rc, i) => {
      const y = B.rowY + i * B.rowH, x = B.x + 36;
      const out = this.add.text(x, y + 28, '', S(30, '#ffffff')).setOrigin(0, 0.5).setDepth(D);
      const parts = rc.needs.map((_, j) => this.add.text(x + j * 270, y + 72, '', S(23, '#ffffff', 0, 'normal')).setOrigin(0, 0.5).setDepth(D));
      const cr = B.craft, btn = new RD.UIButton(this, { x: B.x + B.w - 36 - cr.w, y: y + (B.rowH - 8 - cr.h) / 2, w: cr.w, h: cr.h },
        { scheme: 'green', labelSize: 32, onClick: () => { if (this.bookOpen && this.L.G.mode !== 'over') this.L.craft(rc); } }).setDepth(D);
      items.push(out, ...parts, btn);
      return { rc, out, parts, btn };
    });
    this.bookClose = new RD.UIButton(this, B.close, { scheme: 'dark', labelSize: 44, onClick: () => this.closeBook() }).setDepth(D);
    this.bookClose.set('닫기', '', true);
    items.push(this.bookClose);
    this.bookOpen = true;      // setBookVisible 이 상태를 바꿀 수 있게
    this.setBookVisible(false);
  }
  setBookVisible(v) {
    this.bookOpen = v;
    for (const o of this.bookItems) {
      o.setVisible(v);
      if (o.input) o.input.enabled = v;
    }
  }
  openBook() {
    if (this.bookOpen) return;
    const G = this.L.G;
    if (G.mode === 'over') return;
    this.bookPaused = G.mode === 'playing';
    if (this.bookPaused) G.mode = 'paused';
    this.setBookVisible(true);
    this.updateBook();
  }
  closeBook() {
    if (!this.bookOpen) return;
    this.setBookVisible(false);
    const G = this.L.G;
    if (this.bookPaused && G.mode === 'paused') G.mode = 'playing';
    this.bookPaused = false;
  }
  updateBook() {
    const L = this.L, setText = RD.util.setText, have = {};
    for (const u of L.G.units) have[u.type.id] = (have[u.type.id] || 0) + 1;
    let found = 0;
    for (const row of this.bookRows) {
      const rc = row.rc, t = RD.UNIT_BY_ID[rc.out], made = RD.Codex.made(t.id);
      if (made) found++;
      setText(row.out, `[${RD.unitLevelName(t)}]  ${made ? t.name : '???'}`, made ? RD.HIDDEN_COLOR : '#8f82a6');
      const used = {};
      rc.needs.forEach((id, j) => {
        const n = RD.UNIT_BY_ID[id], k = (used[id] = (used[id] || 0) + 1);
        const own = (have[id] || 0) >= k, known = RD.Codex.seen(id);
        const lv = RD.unitLevelName(n), hint = n.hidden ? lv : `${lv} ${RD.CATEGORIES[n.cat].name}`;
        setText(row.parts[j], `${j ? '+ ' : ''}${known ? `${n.name} ${n.hidden ? '(레거시)' : lv}` : `??? (${hint})`}`,
          own ? '#69f0ae' : known ? '#e6dcf5' : '#7d7290');
      });
      const ready = !!L.recipeUnits(rc);
      row.btn.set('조합', '', ready);
    }
    setText(this.bookSub, `발견한 레거시 유닛 ${found} / ${RD.RECIPES.length}   ·   초록색 = 지금 필드에 있는 재료`);
  }

  showToast(text, color) {
    const S = RD.util.textStyle;
    const t = this.add.text(RD.W / 2, 0, text, S(34, color)).setOrigin(0.5);
    const w = Math.min(1000, t.width + 72);
    const g = this.add.graphics();
    g.fillStyle(0x0a0612, 0.82).fillRoundedRect(-w / 2, -34, w, 68, 34);
    g.lineStyle(3, RD.util.colorInt(color), 1).strokeRoundedRect(-w / 2, -34, w, 68, 34);
    t.setPosition(0, 2);
    const c = this.add.container(RD.W / 2, 600, [g, t]).setDepth(60);
    this.toasts.push({ c, t: 0 });
    if (this.toasts.length > 3) this.toasts.shift().c.destroy();
  }

  // 화면 상단 강조 멘트 (나타났다가 몇 초 뒤 사라짐) — 레거시 첫 획득 연출 등
  showBanner(title, sub) {
    if (this.banner) this.banner.destroy();
    const W = RD.W, S = RD.util.textStyle, y = RD.UI.hudH + 150;
    const g = this.add.graphics();
    g.fillStyle(0x0a0304, 0.82).fillRect(0, -95, W, 190);
    g.fillStyle(0xffc440, 1).fillRect(0, -95, W, 4).fillRect(0, 91, W, 4);
    g.fillStyle(0xff2850, 0.7).fillRect(0, -85, W, 2).fillRect(0, 83, W, 2);
    const t1 = this.add.text(W / 2, -26, title, S(54, '#ffd36b', 8)).setOrigin(0.5).setShadow(0, 0, '#ff2850', 18, false, true);
    const t2 = this.add.text(W / 2, 46, sub || '', S(30, '#ffe9c4', 5, 'normal')).setOrigin(0.5);
    const c = this.banner = this.add.container(W / 2, y, [g, t1, t2]).setDepth(70).setAlpha(0);
    g.x = -W / 2; t1.x = 0; t2.x = 0;
    c.setScale(1, 0.2);
    this.tweens.add({ targets: c, alpha: 1, scaleY: 1, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: c, alpha: 0, delay: 4200, duration: 700, ease: 'Sine.easeIn', onComplete: () => { c.destroy(); if (this.banner === c) this.banner = null; } });
  }

  update(time, delta) {
    const L = this.L; if (!L) return;
    const G = L.G, UI = RD.UI, C = RD.CONFIG, U = RD.util, setText = U.setText, fmt = U.fmt;
    const realDt = Math.min(0.05, delta / 1000);

    // HUD 텍스트
    setText(this.tRound, `라운드 ${G.round}`);
    const tl = Math.max(0, Math.ceil(G.roundTimer));
    setText(this.tTimer, G.round === 0 ? `시작까지 ${tl}초` : `다음 라운드 ${tl}초`);
    const money = v => v >= 1e4 ? fmt(v) : Math.floor(v).toLocaleString('ko-KR');
    setText(this.tGold, money(G.gold));
    setText(this.tMineral, money(G.mineral));

    // 적 수 바 / 보스 바
    const g = this.hudG; g.clear();
    const n = L.enemyCount(), lim = G.enemyLimit, ratio = U.clamp(n / lim, 0, 1);
    const bx = 32, by = 116, bh = 64, bw = G.boss ? 500 : 1016;
    g.fillStyle(0x000000, 0.6).fillRoundedRect(bx, by, bw, bh, 18);
    if (ratio > 0) {
      let col = ratio < 0.5 ? 0x2e7d32 : ratio < 0.75 ? 0xef6c00 : 0xc62828;
      if (ratio >= 0.85 && Math.floor(time / 250) % 2) col = 0xff5252;
      const fw = bw * ratio;
      g.fillStyle(col, 1).fillRoundedRect(bx, by, fw, bh, Math.min(18, fw / 2));
    }
    g.lineStyle(4, 0xffffff, 0.35).strokeRoundedRect(bx, by, bw, bh, 18);
    this.tEnemy.x = bx + bw / 2 + 40;
    setText(this.tEnemy, `적 ${n} / ${lim}`);
    const ET = RD.ENEMY_TYPES[G.etype];
    setText(this.tEType, ET.name, ET.color);
    const DF = RD.DIFFICULTIES[G.diff];
    this.tDiff.x = bx + bw - 22;
    setText(this.tDiff, DF.name, DF.color);
    if (G.boss) {
      const x = 548, w = 500, b = G.boss, fw = w * U.clamp(b.hp / b.maxHp, 0, 1);
      g.fillStyle(0x3c0000, 0.75).fillRoundedRect(x, by, w, bh, 18);
      if (fw > 2) g.fillStyle(0xb71c1c, 1).fillRoundedRect(x, by, fw, bh, Math.min(18, fw / 2));
      g.lineStyle(4, G.bossTimer < 20 && Math.floor(time / 300) % 2 ? 0xffeb3b : 0xff5252, 1).strokeRoundedRect(x, by, w, bh, 18);
      setText(this.tBoss, `${b.type.name}  ${Math.ceil(G.bossTimer)}초`);
      this.tBoss.setVisible(true);
    } else this.tBoss.setVisible(false);

    if (G.packet && !G.packet.dead) {
      const p = G.packet, sec = Math.max(0, Math.ceil(G.packetTimer)), mm = Math.floor(sec / 60), ss = String(sec % 60).padStart(2, '0');
      setText(this.tPacket, `패킷  ${fmt(Math.max(0, p.hp))} / ${fmt(p.maxHp)}   ${mm}:${ss}`, sec <= 30 && Math.floor(time / 300) % 2 ? '#ffffff' : RD.PACKET.type.color);
      this.tPacket.setVisible(true);
    } else this.tPacket.setVisible(false);

    // 정보 패널
    const sel = G.selected && !G.selected.removed ? G.selected : null;
    this.idle.forEach(t => t.setVisible(!sel));
    Object.values(this.sel).forEach(o => o.setVisible(!!sel));
    if (!sel) {
      // 상성 안내 (유닛 타입 → 강한 적 타입)
      setText(this.idle[1], RD.CAT_KEYS.map(k => `${RD.CATEGORIES[k].name}→${RD.ENEMY_TYPES[RD.strongVs(k)].short}`).join(' · ') + ` 강함 ×${RD.TYPE_MULT.warrior[RD.strongVs('warrior')]}`);
      setText(this.idle[2], `보유 유닛 ${G.units.length} / ${RD.UNIT_CAP}      처치 ${fmt(G.kills)}`);
      if (this.preview) { this.preview.destroy(); this.preview = null; this.previewType = null; }
    } else {
      const t = sel.type, r = UI.info;
      if (this.previewType !== t) {
        if (this.preview) this.preview.destroy();
        const body = RD.Textures.unitBody(this, t, true);
        const frame = this.add.image(0, 0, 'frameL_' + t.grade);
        this.preview = this.add.container(r.x + 100, r.y + 86, [body, frame]).setScale(0.94);
        this.preview.frameImg = frame;
        this.previewType = t;
        const tg = this.sel.tagG; tg.clear();
        this.tagColor = null;
      }
      const gc = U.colorInt(RD.unitColorStr(t));
      this.preview.frameImg.setTint(gc);
      if (this.tagColor !== gc) { this.tagColor = gc; this.sel.tagG.clear().fillStyle(gc, 1).fillRoundedRect(r.x + 200, r.y + 20, 96, 48, 14); }
      setText(this.sel.tag, RD.GRADES[t.grade].name);
      setText(this.sel.name, t.name, t.hidden ? RD.HIDDEN_COLOR : '#ffffff');
      const cnt = L.countType(t.id);
      setText(this.sel.count, `보유 ${cnt}개`, L.canCombine(sel) ? '#69f0ae' : '#b9aecb');
      const dmg = L.unitDmg(t);
      const spd = L.unitSpd(t);
      setText(this.sel.stats, `공격력 ${fmt(dmg)}   공속 ${+spd.toFixed(2)}초   사거리 ${t.range}`);
      const catName = (t.hidden ? '레거시·' : '') + RD.CATEGORIES[t.cat].name;
      setText(this.sel.special, `[${catName}] ${U.specialText(t)}`, t.hidden ? RD.HIDDEN_COLOR : RD.CATEGORIES[t.cat].color);
      // 이번 라운드 적 타입에 대한 실제 DPS (상성 배율 반영, 강함 초록 · 약함 빨강)
      const m = RD.typeMult(t, G.etype);
      setText(this.sel.dps, `DPS ${fmt(dmg / spd * m)}${m !== 1 ? ` ×${m}` : ''}`,
        m > 1 ? '#69f0ae' : m < 1 ? '#ff8a80' : '#ffd54f');
    }

    // 버튼 상태
    const st = sel && sel.type, cnt = sel ? L.countType(st.id) : 0;
    const merge = st && RD.canMerge(st), recipe = sel && !(merge && cnt >= 3) && L.readyRecipeFor(sel);
    this.btn.combine.set('조합', !sel ? '유닛 선택' : recipe ? '레거시 조합!' : merge ? `${Math.min(cnt, 3)} / 3 보유` : RD.recipesUsing(st).length ? '레시피 재료' : '최고 레벨',
      !!sel && L.canCombine(sel));
    const CC = RD.COST_CURRENCY, CUR = RD.CURRENCIES;
    this.btn.sell.set('판매', sel ? `+${fmt(L.sellPrice(st))} ${CUR.gold.name}` : '유닛 선택', !!sel);
    const canCh = st && RD.canTypeChange(st), chCost = canCh ? RD.typeChangeCost(st) : 0;
    this.btn.change.set('타입 변경', !sel ? '유닛 선택' : st.hidden ? '레거시 불가' : canCh ? `${fmt(chCost)} ${CUR[CC.typeChange].name}` : `${RD.GRADES[RD.TYPE_CHANGE_MIN_GRADE].name} 이상`,
      !!canCh && L.canAfford(CC.typeChange, chCost));
    this.btn.summon.set('소환', `${C.summonCost} ${CUR[CC.summon].name}`, L.canAfford(CC.summon, C.summonCost) && G.units.length < RD.UNIT_CAP);
    this.btn.book.set('레시피 도감', '', true);
    this.btn.hidden.setVisible(G.hiddenUnlocked);
    this.hiddenHint.setVisible(!G.hiddenUnlocked);
    if (G.hiddenUnlocked) {
      const hc = RD.BAL.hiddenUpgradeCost(G.hiddenLv);
      this.btn.hidden.set(`레거시 강화 ×${U.fmt1(RD.BAL.hiddenMult(G.hiddenLv))}`, `Lv.${G.hiddenLv} · ${fmt(hc)}${CUR[CC.hiddenUpgrade].name}`, L.canAfford(CC.hiddenUpgrade, hc));
    }
    RD.CAT_KEYS.forEach((k, i) => {
      const lv = G.upg[k], cost = RD.BAL.upgradeCost(lv);
      this.upgBtns[i].set(`${RD.CATEGORIES[k].name} 강화`, `Lv.${lv} · ${fmt(cost)}${CUR[CC.unitUpgrade].name}`, L.canAfford(CC.unitUpgrade, cost));
    });
    const mMax = G.mineLv >= C.mineMaxLevel, mCost = RD.BAL.mineCost(G.mineLv);
    this.btn.mine.set(`채굴 +${U.fmt1(L.mineRate())}/초`, mMax ? `Lv.${G.mineLv} · 최대` : `Lv.${G.mineLv} · ${fmt(mCost)}${CUR[CC.mineUpgrade].name}`,
      !mMax && L.canAfford(CC.mineUpgrade, mCost));
    const lc = L.levelCounts();
    RD.AUTO_KEYS.forEach((k, i) => {
      const n = lc[k], ok = !!L.findMergeable(k), ch = this.autoChips[i];
      this.autoBtns[i].set(`${RD.AUTO_CATS[k].name} 조합`, ' ', ok);
      const key = n.join(',') + ok + lc.hidden;
      if (ch.last !== key) {
        ch.last = key; ch.g.clear();
        for (const c of ch.chips) {
          const hid = c.gr === 'H', v = hid ? lc.hidden : n[c.gr];
          ch.g.fillStyle(U.colorInt(hid ? RD.HIDDEN_COLOR : RD.GRADES[c.gr].color), v ? 1 : 0.35).fillRoundedRect(c.x, ch.cy - 16, c.w, 32, 10);
          setText(c.t, k === 'none' ? `${hid ? '레거시' : 'Lv0'} ×${v}` : `${v}`, v ? '#140c1c' : '#3a3046');
        }
      }
    });
    this.btn.pause.set('', '', true, G.mode === 'paused' ? 'play' : 'pause');
    this.btn.speed.set(G.speed + 'x', '', true);

    // 일시정지 (도감을 연 동안은 도감이 대신 덮음)
    this.pauseLayer.setVisible(G.mode === 'paused' && !this.bookOpen);
    this.btnQuit.setVisible(G.mode === 'paused' && !this.bookOpen);
    if (G.mode !== 'paused') this.quitArmed = false;
    this.btnQuit.set(this.quitArmed ? '정말 중단?' : '다이브 중단', this.quitArmed ? '한 번 더 누르면 종료' : '로비로 (파편 정산)', true);
    if (this.bookOpen) this.updateBook();

    // 알림
    while (L.toastQueue.length) { const q = L.toastQueue.shift(); this.showToast(q.text, q.color); }
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i]; t.t += realDt;
      if (t.t > 2.2) { t.c.destroy(); this.toasts.splice(i, 1); }
    }
    this.toasts.forEach((t, i) => { t.c.y = 600 + i * 84; t.c.setAlpha(U.clamp(t.t < 1.8 ? 1 : 1 - (t.t - 1.8) / 0.4, 0, 1)); });
  }
};
