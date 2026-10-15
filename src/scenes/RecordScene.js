/* RecordScene: 기록 · 업적
 *  [업적] 탭: 업적 목록 (진행도 바, 달성하면 [받기] → 기억 파편), 위아래 드래그로 스크롤
 *  [최고 기록] 탭: 난이도별 최고 스테이지, 한 판 최다 처치, 누적 처치·보스·다이브·플레이 시간·파편·캡슐·카드·히든
 * 레이아웃 (1080x1920 기준)
 *   y 0~200      제목 바 + [◀]
 *   y 220~300    탭 [업적 n/N] [최고 기록] 각 465x80
 *   y 320~390    (업적 탭) 받을 보상 안내 + [모두 받기] 260x70
 *   y 420~       업적 줄 (960x140, 줄 간격 152) / 기록 줄 (줄 간격 84)
 */
window.RD = window.RD || {};

RD.RecordScene = class RecordScene extends Phaser.Scene {
  constructor() { super('RecordScene'); }

  init(data) { this.tab = (data && data.tab) || 'ach'; }

  create() {
    const W = RD.W, S = RD.util.textStyle;
    this.modal = null;
    this.leaving = false;
    this.bg = RD.Neon.background(this, 1700, { dim: 0.35, bits: 20, bitAlpha: 0.3 });
    RD.Neon.header(this, '기록 · 업적', 'RECORDS & ACHIEVEMENTS', () => this.back());
    this.add.graphics().setDepth(50).fillStyle(0x07060f, 0.96).fillRect(0, 200, W, this.tab === 'ach' ? 210 : 120);

    // ── 탭 ──
    const n = RD.ACHIEVEMENTS.length, d = RD.Achieve.doneCount();
    [['ach', `업적 ${d}/${n}`, 60], ['rec', '최고 기록', 555]].forEach(([k, label, x]) => {
      const on = this.tab === k;
      const b = RD.Neon.button(this, { x, y: 220, w: 465, h: 80 }, label, '', on ? 0xffc935 : 0x4d5b78,
        () => { if (!on) this.scene.restart({ tab: k }); }, { size: 34 }).setDepth(52);
      if (!on) b.parts[1].setAlpha(0.6);
    });

    this.list = this.add.container(0, 0).setDepth(10);
    this.scrollY = 0; this.vel = 0; this.minY = 0;
    if (this.tab === 'ach') this.buildAch(); else this.buildRec();

    // ── 스크롤 / 탭 ──
    this.drag = null;
    this.input.on('pointerdown', p => { if (p.y > 410) this.drag = { y0: p.y, sy: this.scrollY, last: p.y, t: p.time, moved: false }; this.vel = 0; });
    this.input.on('pointermove', p => {
      const dd = this.drag; if (!dd || !p.isDown) return;
      if (Math.abs(p.y - dd.y0) > 14) dd.moved = true;
      if (dd.moved) {
        this.setScroll(dd.sy + (p.y - dd.y0));
        this.vel = (p.y - dd.last) / Math.max(1, p.time - dd.t) * 1000; dd.last = p.y; dd.t = p.time;
      }
    });
    this.input.on('pointerup', p => {
      const dd = this.drag; this.drag = null;
      if (dd && !dd.moved && this.tab === 'ach') this.tapAch(p);
    });
    this.input.on('wheel', (p, o, dx, dy) => this.setScroll(this.scrollY - dy));
    if (this.input.keyboard) this.input.keyboard.on('keydown', e => { if (e.key === 'Escape') this.back(); });
    this.cameras.main.fadeIn(200, 5, 4, 9);
  }

  setScroll(y) { this.scrollY = Phaser.Math.Clamp(y, this.minY, 0); this.list.y = this.scrollY; }

  // ── 업적 ──
  buildAch() {
    const W = RD.W, S = RD.util.textStyle, AC = RD.Achieve, fmt = RD.util.fmt;
    const ready = AC.claimable();
    const total = ready.reduce((s, a) => s + a.reward, 0);
    this.add.text(70, 355, ready.length ? `받을 보상 ${ready.length}개  ·  기억 파편 +${fmt(total)}` : '조건을 채우면 기억 파편 보상을 받을 수 있습니다',
      S(28, ready.length ? '#ffd54f' : '#7fa8c9', 0, 'normal')).setOrigin(0, 0.5).setDepth(51);
    if (ready.length) RD.Neon.button(this, { x: 760, y: 320, w: 260, h: 70 }, '모두 받기', '', 0xffc935, () => {
      let sum = 0; ready.forEach(a => { sum += AC.claim(a); });
      this.claimed(sum);
    }, { size: 30 }).setDepth(52);

    // 받을 수 있는 것 → 진행 중 → 받은 것 순
    const rank = a => AC.claimed(a) ? 2 : AC.done(a) ? 0 : 1;
    this.rows = [...RD.ACHIEVEMENTS].sort((a, b) => rank(a) - rank(b) || RD.ACHIEVEMENTS.indexOf(a) - RD.ACHIEVEMENTS.indexOf(b));
    const top = 430, rowH = 152, h = 140, x = 60, w = W - 120;
    this.rowGeo = { top, rowH, h };
    const g = this.add.graphics();
    this.list.add(g);
    this.rows.forEach((a, i) => {
      const y = top + i * rowH, done = AC.done(a), got = AC.claimed(a), ready = done && !got;
      const cc = RD.util.colorInt(RD.ACH_CATS[a.cat].color), goal = AC.goal(a), val = AC.value(a);
      g.fillStyle(0x0b0f24, got ? 0.55 : 0.9).fillRect(x, y, w, h);
      g.lineStyle(ready ? 4 : 2, ready ? 0xffc935 : cc, ready ? 1 : got ? 0.25 : 0.5).strokeRect(x, y, w, h);
      g.fillStyle(cc, got ? 0.35 : 1).fillRect(x, y, 10, h);
      const a1 = got ? 0.5 : 1;
      this.list.add(this.add.text(x + 36, y + 38, a.name, S(34, '#ffffff')).setOrigin(0, 0.5).setAlpha(a1));
      this.list.add(this.add.text(x + 36 + 8 + this.list.last.width, y + 40, RD.ACH_CATS[a.cat].name, S(22, RD.ACH_CATS[a.cat].color, 0, 'normal')).setOrigin(0, 0.5).setAlpha(a1));
      this.list.add(this.add.text(x + 36, y + 80, AC.desc(a), S(25, '#b9d4ee', 0, 'normal')).setOrigin(0, 0.5).setAlpha(a1));
      // 진행도 바
      const bx = x + 36, bw = 560, by = y + 108;
      g.fillStyle(0x1b2142, 1).fillRect(bx, by, bw, 14);
      g.fillStyle(done ? 0x7dffb0 : cc, got ? 0.4 : 1).fillRect(bx, by, bw * Math.min(1, val / goal), 14);
      this.list.add(this.add.text(bx + bw + 16, by + 7, `${fmt(val)} / ${fmt(goal)}`, S(22, '#8fa3c0', 0, 'normal')).setOrigin(0, 0.5));
      // 보상 / 받기
      const rx = x + w - 150;
      if (ready) {
        g.fillStyle(0xffc935, 1).fillRect(rx - 10, y + 22, 150, 96);
        this.list.add(this.add.text(rx + 65, y + 52, '받기', S(32, '#1a1022')).setOrigin(0.5));
        this.list.add(this.add.text(rx + 65, y + 92, `+${a.reward}`, S(24, '#1a1022')).setOrigin(0.5));
      } else {
        RD.LobbyScene.drawShard(g, rx + 10, y + 70, 18);
        this.list.add(this.add.text(rx + 36, y + 70, got ? '완료' : `+${a.reward}`, S(30, got ? '#5d6680' : '#7dffb0')).setOrigin(0, 0.5));
      }
    });
    this.minY = Math.min(0, RD.H - 40 - (top + this.rows.length * rowH));
  }

  tapAch(p) {
    const R = this.rowGeo, y = p.y - this.scrollY - R.top;
    if (y < 0 || p.x < 60 || p.x > RD.W - 60) return;
    const i = Math.floor(y / R.rowH);
    if (y - i * R.rowH > R.h) return;
    const a = this.rows[i];
    if (a && RD.Achieve.done(a) && !RD.Achieve.claimed(a)) this.claimed(RD.Achieve.claim(a));
  }

  claimed(sum) {
    if (!sum) return;
    const keep = this.scrollY;
    this.scene.restart({ tab: 'ach' });
    this.events.once('create', () => {
      this.setScroll(keep);
      RD.Neon.toast(this, `기억 파편 +${RD.util.fmt(sum)}`, '#7dffb0', 1760);
    });
  }

  // ── 최고 기록 ──
  buildRec() {
    const W = RD.W, S = RD.util.textStyle, fmt = RD.util.fmt, SV = RD.Save.data, st = SV.stats, m = SV.meta;
    const hm = s => { const h = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60; return h ? `${h}시간 ${mm}분` : `${mm}분`; };
    const rows = [['최고 도달 스테이지', null]];
    RD.DIFF_KEYS.forEach(k => rows.push([`   ${RD.DIFFICULTIES[k].name}`, st.best[k] ? `R${st.best[k]}` : '—', RD.DIFFICULTIES[k].color]));
    rows.push(['전투', null],
      ['   한 판 최다 처치', fmt(st.bestKills)],
      ['   누적 처치', fmt(st.kills)],
      ['   누적 보스 처치', fmt(st.bossKills)],
      ['   다이브 횟수', fmt(st.runs)],
      ['   누적 플레이 시간', hm(st.playTime)],
      ['성장', null],
      ['   최고 일반 유닛', st.topGrade ? `Lv.${st.topGrade}` : '—'],
      ['   발견한 레거시 유닛', `${SV.codex.made.length} / ${RD.RECIPES.length}`],
      ['   누적 기억 파편', fmt(m.totalFragments)],
      ['   해독한 메모리 캡슐', fmt(m.opened)],
      ['   복원한 메모리', `${RD.Meta.ownedCount()} / ${RD.HEROINES.length}`]);
    const last = st.last;
    if (last) rows.push(['직전 다이브', `${RD.DIFFICULTIES[last.diff] ? RD.DIFFICULTIES[last.diff].name : ''} R${last.round} · 파편 +${fmt(last.fragments)}`, '#b9d4ee']);
    let y = 360;
    const g = this.add.graphics();
    this.list.add(g);
    rows.forEach(([k, v, col]) => {
      if (v === null) {          // 소제목
        y += 20;
        this.list.add(this.add.text(70, y, k, S(32, '#00e5ff')).setOrigin(0, 0.5));
        g.lineStyle(2, 0x00e5ff, 0.3).lineBetween(70, y + 30, W - 70, y + 30);
        y += 74;
        return;
      }
      this.list.add(this.add.text(70, y, k, S(30, '#e6ecff', 0, 'normal')).setOrigin(0, 0.5));
      this.list.add(this.add.text(W - 70, y, v, S(32, col || '#ffffff')).setOrigin(1, 0.5));
      y += 62;
    });
    this.minY = Math.min(0, RD.H - 40 - y);
  }

  onBack() { this.back(); return true; }   // 안드로이드 뒤로가기

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
    if (!this.drag && Math.abs(this.vel) > 5) {
      this.setScroll(this.scrollY + this.vel * dt);
      this.vel *= Math.pow(0.04, dt);
    }
  }
};
