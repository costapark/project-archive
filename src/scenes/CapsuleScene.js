/* CapsuleScene: 메모리 캡슐 해독 (가챠)
 *  기억 파편 100개 = 캡슐 1개. 1개 / 최대 10개 해독. 등급 확률 · 천장(유니크 이상 확정) 표시
 * 레이아웃 (1080x1920 기준)
 *   y 0~200      제목 바 + [◀]
 *   y 250~330    보유 기억 파편 / 해독 가능 캡슐 수
 *   y 420~980    캡슐 그림 (가운데 y 690)
 *   y 1020       천장 안내
 *   y 1080~1390  등급별 확률 표 (6줄, 줄 간격 52)
 *   y 1450~1600  [1개 해독] [10개 해독] 각 465x150
 *   y 1680~1760  안내 문구
 *  결과 연출: 캡슐 흔들림 → 최고 등급 색 섬광 → 카드가 순서대로 뒤집히며 등장 (1장은 크게, 여러 장은 5열)
 */
window.RD = window.RD || {};

RD.CapsuleScene = class CapsuleScene extends Phaser.Scene {
  constructor() { super('CapsuleScene'); }

  create() {
    const W = RD.W, S = RD.util.textStyle, M = RD.META;
    this.modal = null;
    this.leaving = false;
    this.busy = false;
    this.t = 0;
    this.bg = RD.Neon.background(this, 1500, { dim: 0.45, bits: 26, bitAlpha: 0.35 });
    RD.Neon.header(this, '메모리 캡슐', 'MEMORY CAPSULE DECRYPT', () => this.back());

    // ── 보유 현황 ──
    const g = this.add.graphics();
    g.fillStyle(0x0b0f24, 0.85).fillRect(60, 240, W - 120, 110);
    g.lineStyle(3, 0x7dffb0, 0.7).strokeRect(60, 240, W - 120, 110);
    RD.LobbyScene.drawShard(g, 120, 295, 32);
    this.tFrag = this.add.text(170, 295, '', S(40, '#ffffff')).setOrigin(0, 0.5);
    this.tCaps = this.add.text(W - 90, 295, '', S(32, '#7dffb0')).setOrigin(1, 0.5);

    // ── 캡슐 그림 ──
    this.capsule = this.add.container(W / 2, 690);
    this.capG = this.add.graphics();
    this.capsule.add(this.capG);
    this.coreText = this.add.text(0, 0, 'HBM', S(40, '#ffffff')).setOrigin(0.5).setShadow(0, 0, '#7dffb0', 14, false, true);
    this.capsule.add(this.coreText);

    // ── 천장 / 확률 ──
    this.tPity = this.add.text(W / 2, 1020, '', S(28, '#ffd54f', 0, 'normal')).setOrigin(0.5);
    const tg = this.add.graphics();
    tg.fillStyle(0x0b0f24, 0.85).fillRect(140, 1060, W - 280, 340);
    tg.lineStyle(2, 0x00e5ff, 0.4).strokeRect(140, 1060, W - 280, 340);
    this.tHave = RD.CARD_GRADE_KEYS.map((k, i) => {
      const GR = RD.CARD_GRADES[k], y = 1100 + i * 52;
      tg.fillStyle(RD.util.colorInt(GR.color), 1).fillRect(180, y - 12, 24, 24);
      this.add.text(226, y, GR.name, S(30, GR.color)).setOrigin(0, 0.5);
      this.add.text(640, y, `${GR.odds}%`, S(30, '#ffffff')).setOrigin(1, 0.5);
      return this.add.text(W - 180, y, '', S(26, '#8fa3c0', 0, 'normal')).setOrigin(1, 0.5);
    });

    // ── 해독 버튼 ──
    this.btn1 = RD.Neon.button(this, { x: 60, y: 1450, w: 465, h: 150 }, '1개 해독', '', 0x7dffb0, () => this.open(1), { size: 46, subSize: 26, subSpacing: 2 });
    this.btn10 = RD.Neon.button(this, { x: 555, y: 1450, w: 465, h: 150 }, '10개 해독', '', 0xff2bd6, () => this.open(10), { size: 46, subSize: 26, subSpacing: 2 });
    this.add.text(W / 2, 1690, `${M.fragmentMinRound} 스테이지 이상 도달하면 다이브가 끝날 때 기억 파편을 회수합니다`, S(26, '#7fa8c9', 0, 'normal')).setOrigin(0.5);
    this.add.text(W / 2, 1740, `같은 메모리 ${M.copiesPerLevel}장마다 싱크 Lv 상승 (최대 Lv.${M.maxCardLevel})`, S(26, '#7fa8c9', 0, 'normal')).setOrigin(0.5);
    this.refresh();

    if (this.input.keyboard) this.input.keyboard.on('keydown', e => { if (e.key === 'Escape') this.modal ? this.closeResult() : this.back(); });
    this.cameras.main.fadeIn(220, 5, 4, 9);
  }

  refresh() {
    const fmt = RD.util.fmt, n = RD.Meta.capsules(), cost = RD.META.capsuleCost;
    this.tFrag.setText(`기억 파편 ${fmt(RD.Meta.fragments)}`);
    this.tCaps.setText(n ? `해독 가능 ${n}개` : `다음 캡슐까지 ${cost - RD.Meta.fragments % cost}`);
    const many = n >= 2 ? Math.min(10, n) : 10;
    this.btn1.setLabel('1개 해독', `기억 파편 ${cost}`).setEnabled(n >= 1);
    this.btn10.setLabel(`${many}개 해독`, `기억 파편 ${fmt(cost * many)}`).setEnabled(n >= 2);
    this.many = many;
    RD.CARD_GRADE_KEYS.forEach((k, i) => {     // 등급별 보유 수
      const all = RD.HEROINES.filter(h => h.grade === k), have = all.filter(h => RD.Meta.owned(h.id)).length;
      this.tHave[i].setText(`보유 ${have} / ${all.length}`);
    });
    this.tPity.setText(`${RD.CARD_GRADES[RD.META.pityGrade].name} 이상 확정까지 ${RD.Meta.pityLeft()}회`);
  }

  open(n) {
    if (this.busy || this.modal) return;
    if (n > 1) n = this.many;
    const res = RD.Meta.openCapsules(n);
    if (!res.length) return;
    this.busy = true;
    const top = res.reduce((a, r) => Math.max(a, RD.CARD_GRADE_KEYS.indexOf(r.card.grade)), 0);
    const topCol = RD.CARD_GRADES[RD.CARD_GRADE_KEYS[top]].color;
    // 연출: 흔들림 → 섬광 → 결과
    this.tweens.add({ targets: this.capsule, x: { from: RD.W / 2 - 10, to: RD.W / 2 + 10 }, duration: 50, yoyo: true, repeat: 7,
      onComplete: () => {
        this.capsule.x = RD.W / 2;
        const c = Phaser.Display.Color.HexStringToColor(topCol);
        this.cameras.main.flash(top >= 4 ? 700 : 350, c.red, c.green, c.blue);
        if (top >= 4) this.cameras.main.shake(400, 0.01);
        this.showResult(res);
        this.refresh();
        this.busy = false;
      } });
    this.tweens.add({ targets: this.capsule, scale: 1.08, duration: 400, yoyo: true });
  }

  showResult(res) {
    const W = RD.W, H = RD.H, S = RD.util.textStyle;
    const c = this.add.container(0, 0).setDepth(200);
    const dim = this.add.rectangle(0, 0, W, H, 0x02010a, 0.96).setOrigin(0).setInteractive();
    c.add(dim);
    c.add(this.add.text(W / 2, 300, '해독 완료', S(60, '#ffffff')).setOrigin(0.5).setShadow(0, 0, '#7dffb0', 16, false, true));
    const nNew = res.filter(r => r.isNew).length, nUp = res.filter(r => r.levelUp).length;
    c.add(this.add.text(W / 2, 370, `${res.length}개 해독  ·  새 메모리 ${nNew}  ·  레벨 업 ${nUp}`, S(28, '#b9d4ee', 0, 'normal')).setOrigin(0.5));

    const tag = r => {
      if (r.refund) return [`최대 Lv · 파편 +${r.refund}`, '#7dffb0'];
      if (r.isNew) return ['NEW!', '#7dffb0'];
      if (r.levelUp) return [`Lv.${r.level} 달성!`, '#ffd54f'];
      const p = r.progress;
      return [p ? `+1  (${p.have}/${p.need})` : '+1', '#b9d4ee'];
    };
    const one = res.length === 1;
    const cw = one ? 420 : 190, ch = one ? 588 : 266, cols = 5, gap = 12;
    const x0 = (W - (Math.min(cols, res.length) * cw + (Math.min(cols, res.length) - 1) * gap)) / 2 + cw / 2;
    res.forEach((r, i) => {
      const x = one ? W / 2 : x0 + (i % cols) * (cw + gap);
      const y = one ? 820 : 640 + Math.floor(i / cols) * (ch + 90);
      // 같은 결과에서 같은 카드가 여러 번 나와도 마지막 상태(레벨)로 그려짐
      const v = RD.CardView.create(this, x, y, cw, ch, r.card, { owned: true, level: r.level });
      v.scaleX = 0;
      c.add(v);
      const [tt, tc] = tag(r);
      const label = this.add.text(x, y + ch / 2 + (one ? 44 : 30), tt, S(one ? 36 : 22, tc)).setOrigin(0.5).setAlpha(0);
      c.add(label);
      if (one) c.add(this.add.text(x, y + ch / 2 + 100, RD.Meta.cardEffects(r.card, r.level).map(RD.Meta.fmtEffect).join('  ·  '), S(26, '#ffffff', 0, 'normal')).setOrigin(0.5).setAlpha(0).setName('fx'));
      const high = RD.CARD_GRADE_KEYS.indexOf(r.card.grade) >= 3;
      this.tweens.add({ targets: v, scaleX: 1, duration: 220, delay: 250 + i * 140, ease: 'Back.Out',
        onStart: () => { if (high) { const ring = this.add.circle(x, y, cw * 0.35, RD.util.colorInt(RD.CARD_GRADES[r.card.grade].color), 0.35); c.add(ring);
          this.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 600, onComplete: () => ring.destroy() }); } } });
      this.tweens.add({ targets: c.list.filter(o => o === label || (one && o.name === 'fx')), alpha: 1, duration: 200, delay: 420 + i * 140 });
    });
    const close = this.add.text(W / 2, 1720, '터치하여 닫기', S(38, '#ffffff')).setOrigin(0.5).setAlpha(0);
    c.add(close);
    const ready = 500 + res.length * 140;
    this.tweens.add({ targets: close, alpha: { from: 0, to: 1 }, delay: ready, duration: 300,
      onComplete: () => this.tweens.add({ targets: close, alpha: 0.3, duration: 650, yoyo: true, repeat: -1 }) });
    this.time.delayedCall(ready, () => dim.on('pointerup', () => this.closeResult()));
    this.modal = c;
  }

  closeResult() {
    if (!this.modal) return;
    this.modal.destroy();
    this.time.delayedCall(0, () => { this.modal = null; });
  }

  back() {
    if (this.leaving || this.busy) return;
    this.leaving = true;
    const cam = this.cameras.main;
    cam.fadeOut(200, 5, 4, 9);
    cam.once('camerafadeoutcomplete', () => this.scene.start('LobbyScene'));
  }

  // 캡슐: 둥근 원통 + 회전하는 데이터 고리 + 맥동하는 코어
  drawCapsule() {
    const g = this.capG, t = this.t, n = RD.Meta.capsules();
    const col = n ? 0x7dffb0 : 0x4d5b78, pulse = 0.5 + 0.5 * Math.sin(t * 3);
    g.clear();
    const w = 220, h = 400;
    g.fillStyle(0x0b0f24, 0.95).fillRoundedRect(-w / 2, -h / 2, w, h, w / 2);
    g.fillStyle(col, 0.12 + 0.12 * pulse).fillRoundedRect(-w / 2 + 20, -h / 2 + 20, w - 40, h - 40, (w - 40) / 2);
    g.lineStyle(12, col, 0.15).strokeRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, w / 2 + 4);
    g.lineStyle(5, col, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, w / 2);
    g.lineStyle(3, 0xffffff, 0.5).lineBetween(-w / 2 + 10, 0, w / 2 - 10, 0);
    // 데이터 고리 (원근 타원 3개, 위아래로 흐름)
    for (let i = 0; i < 3; i++) {
      const p = ((t * 0.35 + i / 3) % 1), y = -h / 2 + 30 + p * (h - 60);
      g.lineStyle(3, i % 2 ? 0xff2bd6 : 0x00e5ff, 0.25 + 0.5 * Math.sin(p * Math.PI)).strokeEllipse(0, y, w + 120, 46);
    }
    this.coreText.setAlpha(n ? 0.6 + 0.4 * pulse : 0.3);
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.t += dt;
    this.bg.update(dt);
    this.drawCapsule();
  }
};
