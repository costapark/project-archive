/* GalleryScene: 메모리 카드 갤러리 (전체 카드, 보유/미보유, 상세 정보, 싱크 장착)
 *  data.slot 이 있으면 로비의 그 싱크 슬롯에 장착할 카드를 고르는 모드
 * 레이아웃 (1080x1920 기준)
 *   y 0~200      제목 바 (RD.Neon.header) + [◀]
 *   y 240        복원 현황 / 안내
 *   y 290~       카드 4열 (236x330, 간격 12, 행 간격 346), 위아래 드래그로 스크롤
 *  상세 팝업: 카드 400x560 (가운데 y 560) → 이름·등급·레벨·복제 진행도 → 능력(현재 → 다음 레벨) → 설정 → [장착/해제] [닫기]
 */
window.RD = window.RD || {};

RD.GalleryScene = class GalleryScene extends Phaser.Scene {
  constructor() { super('GalleryScene'); }

  init(data) { this.slot = data && data.slot !== undefined ? data.slot : null; }

  create() {
    const W = RD.W, S = RD.util.textStyle;
    this.modal = null;
    this.leaving = false;
    this.bg = RD.Neon.background(this, 1700, { dim: 0.35, bits: 20, bitAlpha: 0.3 });
    RD.Neon.header(this, '메모리 아카이브', 'MEMORY ARCHIVE', () => this.back());

    const sub = this.slot !== null
      ? [`싱크 슬롯 ${this.slot + 1} 에 장착할 메모리를 고르세요`, '#ffd54f']
      : [`기억 복원 ${RD.Meta.ownedCount()} / ${RD.HEROINES.length}  ·  카드를 눌러 상세 정보`, '#7dffb0'];
    this.add.graphics().setDepth(50).fillStyle(0x07060f, 0.96).fillRect(0, 200, W, 80);
    this.add.text(W / 2, 240, sub[0], S(28, sub[1], 0, 'normal')).setOrigin(0.5).setDepth(51);

    // ── 카드 목록 (등급 높은 순 → 보유 우선 → 목록 순) ──
    const order = RD.CARD_GRADE_KEYS;
    this.cards = [...RD.HEROINES].sort((a, b) => order.indexOf(b.grade) - order.indexOf(a.grade)
      || (RD.Meta.owned(b.id) - RD.Meta.owned(a.id)) || RD.HEROINES.indexOf(a) - RD.HEROINES.indexOf(b));
    const cw = 236, ch = 330, gap = 12, cols = 4, rowH = ch + 16;
    this.grid = { cw, ch, gap, cols, rowH, x0: (W - (cols * cw + (cols - 1) * gap)) / 2, top: 300 };
    this.list = this.add.container(0, 0).setDepth(10);
    const eq = RD.Save.data.meta.equip;
    this.cards.forEach((c, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = this.grid.x0 + col * (cw + gap) + cw / 2, y = this.grid.top + row * rowH + ch / 2;
      const v = RD.CardView.create(this, x, y, cw, ch, c);
      this.list.add(v);
      const si = eq.indexOf(c.id);
      if (si >= 0 && RD.Meta.owned(c.id)) {    // 장착 표시
        const tg = this.add.graphics();
        tg.fillStyle(0x00e5ff, 1).fillRect(x - 60, y + ch / 2 - 30, 120, 34);
        this.list.add([tg, this.add.text(x, y + ch / 2 - 13, `SYNC ${si + 1}`, S(20, '#05040b')).setOrigin(0.5)]);
      }
    });
    const rows = Math.ceil(this.cards.length / cols);
    this.minY = Math.min(0, RD.H - 40 - (this.grid.top + rows * rowH));
    this.scrollY = 0; this.vel = 0;

    // ── 스크롤 / 탭 ──
    this.drag = null;
    this.input.on('pointerdown', p => { if (!this.modal && p.y > 280) this.drag = { y0: p.y, sy: this.scrollY, last: p.y, t: p.time, moved: false }; this.vel = 0; });
    this.input.on('pointermove', p => {
      const d = this.drag; if (!d || !p.isDown) return;
      if (Math.abs(p.y - d.y0) > 14) d.moved = true;
      if (d.moved) {
        this.setScroll(d.sy + (p.y - d.y0));
        const dt = Math.max(1, p.time - d.t);
        this.vel = (p.y - d.last) / dt * 1000; d.last = p.y; d.t = p.time;
      }
    });
    this.input.on('pointerup', p => {
      const d = this.drag; this.drag = null;
      if (!d || this.modal) return;
      if (!d.moved) { const c = this.cardAt(p.x, p.y); if (c) this.openDetail(c); }
    });
    this.input.on('wheel', (p, o, dx, dy) => { if (!this.modal) this.setScroll(this.scrollY - dy); });
    if (this.input.keyboard) this.input.keyboard.on('keydown', e => { if (e.key === 'Escape') this.modal ? this.closeDetail() : this.back(); });
    this.cameras.main.fadeIn(220, 5, 4, 9);
  }

  setScroll(y) { this.scrollY = Phaser.Math.Clamp(y, this.minY, 0); this.list.y = this.scrollY; }
  cardAt(px, py) {
    const g = this.grid, x = px - g.x0, y = py - this.scrollY - g.top;
    if (x < 0 || y < 0) return null;
    const col = Math.floor(x / (g.cw + g.gap)), row = Math.floor(y / g.rowH);
    if (col >= g.cols || x - col * (g.cw + g.gap) > g.cw || y - row * g.rowH > g.ch) return null;
    return this.cards[row * g.cols + col] || null;
  }

  openDetail(card) {
    const W = RD.W, H = RD.H, S = RD.util.textStyle, M = RD.Meta, GR = RD.CARD_GRADES[card.grade];
    const owned = M.owned(card.id), lv = M.level(card.id);
    const c = this.add.container(0, 0).setDepth(200);
    const dim = this.add.rectangle(0, 0, W, H, 0x02010a, 0.9).setOrigin(0).setInteractive();
    c.add(dim);
    const g = this.add.graphics();
    g.fillStyle(0x0b0f24, 0.97).fillRect(50, 230, W - 100, 1560);
    g.lineStyle(4, RD.util.colorInt(GR.color), 1).strokeRect(50, 230, W - 100, 1560);
    c.add(g);
    c.add(RD.CardView.create(this, W / 2, 590, 400, 560, card));

    // 이름 / 등급 / 레벨
    c.add(this.add.text(W / 2, 930, owned ? `${card.name}  ·  ${card.title}` : '봉인된 기억', S(46, '#ffffff')).setOrigin(0.5));
    c.add(this.add.text(W / 2, 992, owned ? `${GR.name}  ·  싱크 Lv.${lv}${lv >= RD.META.maxCardLevel ? ' (최대)' : ''}` : `${GR.name}  ·  메모리 캡슐에서 해독`, S(30, GR.color)).setOrigin(0.5));
    const pr = M.nextLevelProgress(card.id);
    if (owned) {
      const bx = 240, bw = 600, by = 1040;
      g.fillStyle(0x1b2142, 1).fillRect(bx, by, bw, 26);
      const ratio = pr ? pr.have / pr.need : 1;
      g.fillStyle(RD.util.colorInt(GR.color), 1).fillRect(bx, by, bw * ratio, 26);
      g.lineStyle(2, 0xffffff, 0.4).strokeRect(bx, by, bw, 26);
      c.add(this.add.text(W / 2, by + 56, pr ? `중복 카드 ${pr.have} / ${pr.need}  → Lv.${lv + 1}` : `최대 레벨  ·  중복 시 기억 파편 +${GR.refund}`, S(24, '#b9d4ee', 0, 'normal')).setOrigin(0.5));
    }

    // 능력: 현재 레벨 (다음 레벨 미리보기)
    c.add(this.add.text(110, 1160, owned ? '싱크 능력' : '싱크 능력 (Lv.1 기준)', S(30, '#00e5ff')).setOrigin(0, 0.5));
    const cur = M.cardEffects(card, Math.max(1, lv)), next = owned && lv < RD.META.maxCardLevel ? M.cardEffects(card, lv + 1) : null;
    cur.forEach((e, i) => {
      const y = 1215 + i * 50;
      c.add(this.add.text(130, y, M.fmtEffect(e), S(32, '#ffffff')).setOrigin(0, 0.5));
      if (next) c.add(this.add.text(W - 110, y, `다음 +${next[i].v}${e.st.unit}`, S(26, '#7fa8c9', 0, 'normal')).setOrigin(1, 0.5));
    });
    c.add(this.add.text(W / 2, 1420, owned ? card.lore : '이 기억은 아직 봉인되어 있습니다. 기억 파편을 모아 메모리 캡슐을 해독하십시오.',
      S(28, '#c9d4ea', 0, 'normal')).setOrigin(0.5).setWordWrapWidth(860, true).setAlign('center'));

    // 버튼
    const eqIdx = RD.Save.data.meta.equip.indexOf(card.id);
    let label = null, act = null;
    if (owned) {
      if (this.slot !== null) {
        if (eqIdx === this.slot) { label = '싱크 해제'; act = () => { M.unequip(card.id); this.back(); }; }
        else { label = `슬롯 ${this.slot + 1} 에 장착`; act = () => { M.equip(this.slot, card.id); this.back(); }; }
      } else if (eqIdx >= 0) { label = '싱크 해제'; act = () => { M.unequip(card.id); this.scene.restart({}); }; }
      else {
        label = '싱크 장착';
        act = () => {
          const free = M.firstFreeSlot();
          if (free < 0) { RD.Neon.toast(this, '싱크 슬롯이 가득 찼습니다 (로비에서 교체할 슬롯을 누르세요)', '#ffd54f', 1560); return; }
          M.equip(free, card.id); this.scene.restart({});
        };
      }
    }
    const btns = [];
    if (label) btns.push(RD.Neon.button(this, { x: 110, y: 1620, w: 420, h: 120 }, label, '', 0x00e5ff, act, { size: 40, modal: true }));
    btns.push(RD.Neon.button(this, label ? { x: 550, y: 1620, w: 420, h: 120 } : { x: 330, y: 1620, w: 420, h: 120 }, '닫기', '', 0xff2bd6,
      () => this.closeDetail(), { size: 40, modal: true }));
    btns.forEach(b => b.addTo(c));
    this.modal = c;
  }

  closeDetail() {
    if (!this.modal) return;
    this.modal.destroy();
    this.time.delayedCall(0, () => { this.modal = null; });   // 같은 탭이 아래 카드를 누르지 않게 한 틱 지연
  }

  onBack() { if (this.modal) this.closeDetail(); else this.back(); return true; }   // 안드로이드 뒤로가기

  back() {
    if (this.leaving) return;
    this.leaving = true;
    const cam = this.cameras.main;
    cam.fadeOut(200, 5, 4, 9);
    cam.once('camerafadeoutcomplete', () => this.scene.start('LobbyScene'));
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.bg.update(dt);
    if (!this.drag && Math.abs(this.vel) > 5) {       // 손을 뗀 뒤 관성 스크롤
      this.setScroll(this.scrollY + this.vel * dt);
      this.vel *= Math.pow(0.04, dt);
    }
  }
};
