/* LobbyScene: 지휘관 로비
 *  기억 파편 / 최고 기록 / 뉴럴 싱크 슬롯(히로인 카드 3장) / 싱크 효과 / 난이도 / 다이브 시작 / 갤러리 / 메모리 캡슐 / 작전 브리핑
 * 레이아웃 (1080x1920 기준)
 *   y 40~150     제목(왼쪽) + [백업] 155x100 (x 455) + 기억 파편 칩(오른쪽, 640~1040)
 *   y 205~250    최고 기록 / 기억 복원율
 *   y 300        '뉴럴 싱크' 제목
 *   y 350~770    싱크 슬롯 3칸 (각 300x420, 가운데 x 210 / 540 / 870)
 *   y 800~980    싱크 효과 요약 (2열)
 *   y 1030~1120  난이도 [이지][노멀][하드] 각 190x90
 *   y 1160~1310  [다이브 시작] 600x150
 *   y 1360~1490  [히로인 갤러리] [메모리 캡슐] 각 465x130
 *   y 1540~1640  [기록 · 업적] [작전 브리핑] 각 465x100
 *   y 1690~1770  시스템 메시지 티커
 *   y 1860       버전
 */
window.RD = window.RD || {};

RD.LobbyScene = class LobbyScene extends Phaser.Scene {
  constructor() { super('LobbyScene'); }

  create() {
    RD.Telemetry.screen('lobby');     // 플레이 통계: 어느 화면까지 왔는지
    const W = RD.W, S = RD.util.textStyle, fmt = RD.util.fmt, SV = RD.Save.data;
    this.modal = null;
    this.started = false;
    RD.BGM.menu();                          // 타이틀에서 나오던 곡을 이어서 (전투에서 돌아오면 다음 곡)
    this.bg = RD.Neon.background(this, 1560, { dim: 0.55, bits: 30, bitAlpha: 0.35 });

    // ── 상단: 제목 + 기억 파편 ──
    this.add.text(60, 78, '지휘관 로비', S(54, '#ffffff')).setOrigin(0, 0.5).setShadow(0, 0, '#00e5ff', 16, false, true);
    this.add.text(62, 132, 'COMMANDER LOBBY', S(22, '#00e5ff', 0, 'normal')).setOrigin(0, 0.5).setLetterSpacing(8);
    const fg = this.add.graphics();
    fg.fillStyle(0x0b0f24, 0.9).fillRect(640, 40, 400, 120);
    fg.lineStyle(3, 0x7dffb0, 0.8).strokeRect(640, 40, 400, 120);
    RD.LobbyScene.drawShard(fg, 700, 100, 30);
    this.add.text(750, 76, '기억 파편', S(24, '#7dffb0', 0, 'normal')).setOrigin(0, 0.5);
    this.tFrag = this.add.text(750, 118, fmt(RD.Meta.fragments), S(40, '#ffffff')).setOrigin(0, 0.5);
    this.add.graphics().lineStyle(2, 0x00e5ff, 0.4).lineBetween(60, 180, W - 60, 180);
    RD.Neon.button(this, { x: 455, y: 50, w: 155, h: 100 }, '백업', '', 0x7fa8c9, () => this.openBackup(), { size: 34 });

    // ── 기록 ──
    const best = RD.DIFF_KEYS.map(k => `${RD.DIFFICULTIES[k].name} ${SV.stats.best[k] ? 'R' + SV.stats.best[k] : '—'}`).join('  ·  ');
    this.add.text(60, 220, `최고 기록  ${best}`, S(28, '#b9d4ee', 0, 'normal')).setOrigin(0, 0.5);
    this.add.text(W - 60, 220, `기억 복원 ${RD.Meta.ownedCount()} / ${RD.HEROINES.length}`, S(28, '#7dffb0')).setOrigin(1, 0.5);

    // ── 뉴럴 싱크 슬롯 ──
    this.add.text(60, 300, '뉴럴 싱크', S(38, '#ffffff')).setOrigin(0, 0.5);
    this.add.text(250, 302, '다이브에 함께할 히로인 (슬롯을 눌러 교체)', S(24, '#7fa8c9', 0, 'normal')).setOrigin(0, 0.5);
    this.buildSlots();
    this.buildBuffs();

    // ── 난이도 / 버튼 ──
    this.makeDifficulty(1030);
    RD.Neon.button(this, { x: 240, y: 1160, w: 600, h: 150 }, '다이브 시작', 'DIVE IN', 0x00e5ff, () => this.dive());
    RD.Neon.button(this, { x: 60, y: 1360, w: 465, h: 130 }, '히로인 갤러리', 'HEROINE ARCHIVE', 0xff2bd6,
      () => this.go('GalleryScene', {}), { size: 42, subSize: 20, subSpacing: 4 });
    const caps = RD.Meta.capsules();
    this.capBtn = RD.Neon.button(this, { x: 555, y: 1360, w: 465, h: 130 }, '메모리 캡슐', caps ? `해독 가능 ${caps}개` : 'MEMORY CAPSULE',
      0x7dffb0, () => this.go('CapsuleScene', {}), { size: 42, subSize: caps ? 24 : 20, subSpacing: caps ? 2 : 4 });
    if (caps) {   // 새 캡슐 알림 점
      const dot = this.add.circle(1006, 1374, 16, 0xff2a3d).setStrokeStyle(3, 0xffffff);
      this.tweens.add({ targets: dot, scale: 1.25, duration: 500, yoyo: true, repeat: -1 });
    }
    RD.Neon.button(this, { x: 60, y: 1540, w: 465, h: 100 }, '기록 · 업적', '', 0xffc935, () => this.go('RecordScene', {}), { size: 38 });
    if (RD.Achieve.claimable().length) {   // 받을 보상 알림 점
      const dot = this.add.circle(506, 1554, 16, 0xff2a3d).setStrokeStyle(3, 0xffffff);
      this.tweens.add({ targets: dot, scale: 1.25, duration: 500, yoyo: true, repeat: -1 });
    }
    RD.Neon.button(this, { x: 555, y: 1540, w: 465, h: 100 }, '작전 브리핑', '', 0x7c4dff, () => this.openBriefing(), { size: 38 });

    // ── 티커 ──
    const last = SV.stats.last;
    this.messages = [
      '> 지휘관 의식 동기화 완료. 대기 중...',
      last ? `> 직전 다이브: ${RD.DIFFICULTIES[last.diff] ? RD.DIFFICULTIES[last.diff].name : ''} R${last.round}, 기억 파편 +${fmt(last.fragments)}` : '> 첫 다이브를 준비하십시오',
      `> ${RD.META.fragmentMinRound} 스테이지부터 기억 파편 회수 가능`,
      `> 기억 파편 ${RD.META.capsuleCost}개 = 메모리 캡슐 1개`,
      '> 같은 히로인 5장마다 싱크율(레벨) 상승',
    ];
    if (SV.stats.runs) this.messages.push(`> 누적 다이브 ${fmt(SV.stats.runs)}회. 포기를 모르는 지휘관입니다`);
    // 이후로는 문구 풀(세계관 · 재치 · 팁)을 섞어서 돌림
    const L = RD.LOBBY_LINES || {};
    this.pool = [].concat(L.lore || [], L.witty || [], L.tip || []);
    this.msgIdx = 0;
    this.ticker = this.add.text(80, 1730, '', S(28, '#7dffb0', 0, 'normal')).setOrigin(0, 0.5);
    this.add.graphics().lineStyle(2, 0x7dffb0, 0.25).strokeRect(60, 1690, W - 120, 80);
    this.typeMessage();
    this.add.text(W / 2, 1860, 'v0.2  ·  RANDOM DEFENSE  ·  PROJECT ARCHIVE', S(22, '#4d5b78', 0, 'normal')).setOrigin(0.5);

    if (this.input.keyboard) {
      this.input.keyboard.on('keydown', e => {
        if (this.modal) { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') this.closeBriefing(); return; }
        if (e.key === 'Enter' || e.key === ' ') this.dive();
      });
    }
    this.cameras.main.fadeIn(300, 5, 4, 9);
  }

  // 기억 파편 아이콘 (마름모 결정)
  static drawShard(g, x, y, r) {
    g.fillStyle(0x7dffb0, 0.25).fillTriangle(x, y - r, x + r * 0.62, y, x, y + r).fillTriangle(x, y - r, x - r * 0.62, y, x, y + r);
    g.lineStyle(3, 0x7dffb0, 1).strokePoints([{ x, y: y - r }, { x: x + r * 0.62, y }, { x, y: y + r }, { x: x - r * 0.62, y }], true);
    g.lineStyle(2, 0xffffff, 0.7).lineBetween(x, y - r, x, y + r);
  }

  buildSlots() {
    const S = RD.util.textStyle, eq = RD.Meta.equipped(), w = 300, h = 420, cy = 560;
    [210, 540, 870].forEach((cx, i) => {
      const c = eq[i];
      const v = c ? RD.CardView.create(this, cx, cy, w, h, c) : RD.CardView.empty(this, cx, cy, w, h, `슬롯 ${i + 1}`);
      v.setSize(w, h).setInteractive({ useHandCursor: true });
      let down = false;
      v.on('pointerdown', () => { down = true; v.setScale(0.97); });
      v.on('pointerout', () => { down = false; v.setScale(1); });
      v.on('pointerup', () => { v.setScale(1); if (down && !this.modal) this.go('GalleryScene', { slot: i }); down = false; });
    });
  }

  // 장착 카드 능력 합계 (상한 적용, 상한에 걸리면 표시)
  buildBuffs() {
    const S = RD.util.textStyle, sum = RD.Meta.sumEffects(RD.Meta.equipped());
    const g = this.add.graphics();
    g.fillStyle(0x0b0f24, 0.75).fillRect(60, 800, RD.W - 120, 190);
    g.lineStyle(2, 0x00e5ff, 0.35).strokeRect(60, 800, RD.W - 120, 190);
    this.add.text(84, 830, '싱크 효과', S(26, '#00e5ff')).setOrigin(0, 0.5);
    const keys = Object.keys(RD.CARD_STATS).filter(k => sum[k]);
    if (!keys.length) {
      this.add.text(RD.W / 2, 905, RD.Meta.ownedCount() ? '슬롯에 히로인을 장착하면 이번 다이브에 능력이 적용됩니다'
        : '메모리 캡슐을 해독해 히로인 카드를 복원하십시오', S(26, '#7fa8c9', 0, 'normal')).setOrigin(0.5);
      return;
    }
    keys.slice(0, 8).forEach((k, i) => {
      const o = sum[k], x = 84 + (i % 2) * 470, y = 876 + Math.floor(i / 2) * 36;
      const capped = o.raw > o.st.cap;
      this.add.text(x, y, `${o.st.name} +${o.v}${o.st.unit}${capped ? ' (상한)' : ''}`, S(26, capped ? '#ffd54f' : '#e6ecff', 0, 'normal')).setOrigin(0, 0.5);
    });
  }

  // 난이도 선택 (RD.DIFFICULTIES, 선택은 저장 데이터에 기억)
  makeDifficulty(y) {
    const S = RD.util.textStyle, keys = RD.DIFF_KEYS, w = 190, gap = 15, h = 90;
    const x0 = RD.W / 2 - (keys.length * w + (keys.length - 1) * gap) / 2;
    const g = this.add.graphics();
    const items = keys.map((k, i) => {
      const d = RD.DIFFICULTIES[k], x = x0 + i * (w + gap);
      const t = this.add.text(x + w / 2, y + h / 2, d.name, S(38, d.color)).setOrigin(0.5);
      const z = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => { if (this.modal || this.started) return; RD.Difficulty.set(k); draw(); });
      return { k, x, t, col: RD.util.colorInt(d.color) };
    });
    const draw = () => {
      g.clear();
      for (const it of items) {
        const on = RD.Difficulty.get() === it.k;
        g.fillStyle(it.col, on ? 0.25 : 0.05).fillRect(it.x, y, w, h);
        g.lineStyle(on ? 5 : 2, it.col, on ? 1 : 0.35).strokeRect(it.x, y, w, h);
        it.t.setAlpha(on ? 1 : 0.45);
      }
    };
    draw();
  }

  typeMessage() {
    if (this.msgIdx >= this.messages.length && this.pool.length) {   // 다 보여 주면 풀을 새로 섞어서 처음부터
      this.messages = Phaser.Utils.Array.Shuffle(this.pool.slice());
      this.msgIdx = 0;
    }
    const msg = this.messages[this.msgIdx % this.messages.length];
    this.msgIdx++;
    let n = 0;
    if (this.typeEvt) this.typeEvt.remove();
    this.typeEvt = this.time.addEvent({
      delay: 32, repeat: msg.length - 1,
      callback: () => { n++; this.ticker.setText(msg.slice(0, n) + (n < msg.length ? '_' : '')); },
    });
    this.time.delayedCall(msg.length * 32 + 1800, () => this.typeMessage());
  }

  go(key, data) {
    if (this.started) return;
    this.started = true;
    const cam = this.cameras.main;
    cam.fadeOut(220, 5, 4, 9);
    cam.once('camerafadeoutcomplete', () => this.scene.start(key, data));
  }

  openBriefing() {
    if (this.modal) return;
    const W = RD.W, H = RD.H, S = RD.util.textStyle, C = RD.CONFIG, M = RD.META;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, W, H, 0x02010a, 0.85).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    g.fillStyle(0x0b0f24, 0.96).fillRect(60, 300, W - 120, 1340);
    g.lineStyle(4, 0xff2bd6, 1).strokeRect(60, 300, W - 120, 1340);
    c.add([dim, g]);
    c.add(this.add.text(W / 2, 400, '작전 브리핑', S(64, '#ffffff')).setOrigin(0.5).setShadow(0, 0, '#ff2bd6', 18, false, true));
    c.add(this.add.text(W / 2, 470, 'MISSION BRIEFING', S(24, '#ff2bd6', 0, 'normal')).setOrigin(0.5).setLetterSpacing(8));
    const lines = [
      ['소환', '적 처치로 얻은 골드로 인류의 유산을 무작위 소환'],
      ['조합', '같은 유닛 3개 → 다음 레벨 (타입도 매번 무작위, 최대 Lv.5)'],
      ['레거시', '정해진 재료 3개 → 레거시 유닛 Lv.5~8 (레시피 도감)'],
      ['상성', '워리어→기동형 · 아처→장갑형 · 위저드→데이터형 강함'],
      ['강화', '광물로 타입 강화 · 골드로 채굴 강화'],
      ['패배', `전장의 적이 ${C.enemyLimit}기에 도달하면 링크 붕괴`],
      ['보스', `${C.bossEvery}스테이지마다 방화벽 보스, ${C.bossTime}초 안에 돌파`],
      ['파편', `${M.fragmentMinRound}스테이지부터 기억 파편 회수 (10스테이지마다 보너스)`],
      ['캡슐', `기억 파편 ${M.capsuleCost}개로 메모리 캡슐 해독 → 히로인 카드`],
      ['싱크', `카드 ${M.slots}장 장착, 같은 카드 ${M.copiesPerLevel}장마다 레벨 업`],
    ];
    lines.forEach(([k, v], i) => {
      const y = 580 + i * 86;
      g.lineStyle(3, 0x00e5ff, 1).strokeRect(100, y - 30, 120, 60);
      c.add(this.add.text(160, y, k, S(30, '#00e5ff')).setOrigin(0.5));
      c.add(this.add.text(245, y, v, S(28, '#e6ecff', 0, 'normal')).setOrigin(0, 0.5));
    });
    const close = this.add.text(W / 2, 1560, '터치하여 닫기', S(38, '#ffffff')).setOrigin(0.5);
    this.tweens.add({ targets: close, alpha: 0.3, duration: 650, yoyo: true, repeat: -1 });
    c.add(close);
    dim.on('pointerup', () => this.closeBriefing());
    this.modal = c;
  }

  /* 데이터 백업: 저장 데이터를 코드(문자열)로 복사하거나, 코드를 붙여넣어 복원 (RD.Save.exportString / importString)
   *  폰 브라우저 데이터가 지워졌을 때, 다른 기기·브라우저로 옮길 때 사용 */
  openBackup() {
    if (this.modal) return;
    const W = RD.W, H = RD.H, S = RD.util.textStyle;
    const c = this.add.container(0, 0).setDepth(100);
    const dim = this.add.rectangle(0, 0, W, H, 0x02010a, 0.88).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    g.fillStyle(0x0b0f24, 0.97).fillRect(80, 480, W - 160, 940);
    g.lineStyle(4, 0x7fa8c9, 1).strokeRect(80, 480, W - 160, 940);
    c.add([dim, g]);
    c.add(this.add.text(W / 2, 570, '데이터 백업', S(56, '#ffffff')).setOrigin(0.5).setShadow(0, 0, '#00e5ff', 16, false, true));
    c.add(this.add.text(W / 2, 680, [
      '진행 상황(기억 파편 · 히로인 카드 · 기록 · 업적)을',
      '백업 코드로 복사해 메모장이나 메신저에 보관하세요.',
      '브라우저 데이터가 지워지거나 기기를 바꿨을 때',
      '코드를 붙여넣으면 그대로 복원됩니다.',
    ].join('\n'), S(28, '#c9d4ea', 0, 'normal')).setOrigin(0.5, 0).setAlign('center').setLineSpacing(10));
    const b1 = RD.Neon.button(this, { x: 190, y: 900, w: 700, h: 120 }, '백업 코드 복사', '', 0x00e5ff, () => this.copyBackup(), { size: 40, modal: true });
    const b2 = RD.Neon.button(this, { x: 190, y: 1060, w: 700, h: 120 }, '코드로 불러오기', '', 0xffc935, () => this.importBackup(), { size: 40, modal: true });
    const b3 = RD.Neon.button(this, { x: 340, y: 1240, w: 400, h: 110 }, '닫기', '', 0xff2bd6, () => this.closeBriefing(), { size: 38, modal: true });
    [b1, b2, b3].forEach(b => b.addTo(c));
    this.modal = c;
  }

  copyBackup() { RD.BackupUI.copy(this, 1460); }

  importBackup() {
    if (!RD.BackupUI.load(this, 1460)) return;
    this.scene.restart();
    this.events.once('create', () => RD.Neon.toast(this, '백업 코드로 복원했습니다', '#7dffb0', 1460));
  }

  closeBriefing() {
    if (!this.modal) return;
    this.modal.destroy();
    this.time.delayedCall(0, () => { this.modal = null; });   // 같은 pointerup 으로 버튼이 눌리지 않도록 한 틱 지연
  }

  dive() {
    if (this.started || this.modal) return;
    this.started = true;
    RD.BGM.start(0);                       // 터치 이벤트 안에서 시작해야 모바일 자동재생 제한에 안 걸림
    this.ticker.setText('> 뉴럴 다이브 개시. 결계 진입...');
    const cam = this.cameras.main;
    cam.flash(250, 0, 229, 255);
    cam.shake(300, 0.006);
    this.time.delayedCall(260, () => cam.fadeOut(400, 5, 4, 9));
    cam.once('camerafadeoutcomplete', () => this.scene.start('GameScene'));
  }

  update(time, delta) { this.bg.update(delta / 1000); }
};
