/* =====================================================================
 * GameScene: 맵 / 적 / 유닛 / 투사체 / 이펙트 렌더링 + 필드 입력(선택, 드래그 이동/교환)
 * 규칙과 상태는 RD.GameLogic 이 담당하고, 이 씬은 상태를 화면 오브젝트와 동기화한다.
 * HUD 와 버튼은 병렬 실행되는 UIScene 이 담당.
 * ===================================================================== */
window.RD = window.RD || {};

RD.GameScene = class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    // 싱크 슬롯에 장착한 메모리 카드 능력을 이번 판에 적용
    this.logic = new RD.GameLogic({ speed: this.registry.get('speed') || 1, onGameOver: () => this.onGameOver(), buffs: RD.Meta.runBuffs() });
    this.runResult = null;
    RD.debug.attach(this);
    RD.Telemetry.diveStart(this.logic.G.diff);     // 플레이 통계 (src/core/telemetry.js)

    this.add.image(0, 0, 'bg_map').setOrigin(0).setDepth(0);
    this.gUnder = this.add.graphics().setDepth(1);     // 포탈, 사거리, 그림자
    this.gOver = this.add.graphics().setDepth(6);      // 체력바, 이펙트, 드래그 표시

    this.unitViews = new Map();    // unit → Container
    this.enemyViews = new Map();   // enemy → Sprite
    this.projViews = new Map();    // projectile → Image
    this.floatViews = new Map();   // float → Text
    this.projPool = [];
    this.floatPool = [];
    this.drag = null;
    this.dragGhost = null;

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);

    this.events.once('shutdown', () => {
      this.registry.set('speed', this.logic.G.speed);
      this.input.off('pointerdown', this.onPointerDown, this);
      this.input.off('pointermove', this.onPointerMove, this);
      this.input.off('pointerup', this.onPointerUp, this);
      this.input.off('pointerupoutside', this.onPointerUp, this);
      this.scene.stop('UIScene');
      this.scene.stop('GameOverScene');
    });
    this.scene.launch('UIScene');
    RD.Platform.setAwake(true);                    // 다이브 중에는 화면이 꺼지지 않게 (토스)
    this.events.once('shutdown', () => RD.Platform.setAwake(false));
  }

  onGameOver() {
    const G = this.logic.G;
    this.registry.set('speed', G.speed);
    // 기억 파편 정산 (한 판에 한 번) → GameOverScene 에서 표시
    if (!this.runResult) this.runResult = RD.Meta.finishRun(G.round, G.diff, this.logic.buffs,
      { kills: G.kills, bossKills: G.bossKills, time: G.time, topGrade: G.topGrade });
    RD.Telemetry.diveEnd(G.round, G.overReason, G.overReason === RD.QUIT_REASON);
    RD.Platform.setAwake(false);
    if (G.overReason !== RD.QUIT_REASON) RD.Platform.haptic('error');
    this.endDrag();
    this.scene.launch('GameOverScene');
  }

  // ── 입력: 필드 영역만 처리 (HUD / 패널은 UIScene) ──
  inField(p) { return p.y > RD.UI.hudH && p.y < RD.UI.panelY; }
  onPointerDown(p) {
    const G = this.logic.G;
    if (G.mode !== 'playing' || this.drag || !this.inField(p)) return;
    const c = RD.util.cellAt(p);
    const u = c ? G.grid[c.row][c.col] : null;
    this.drag = { pid: p.id, unit: u, sx: p.x, sy: p.y, x: p.x, y: p.y, dragging: false };
  }
  onPointerMove(p) {
    const d = this.drag;
    if (!d || p.id !== d.pid) return;
    d.x = p.x; d.y = p.y;
    if (d.unit && !d.dragging && Math.hypot(p.x - d.sx, p.y - d.sy) > 20) {
      d.dragging = true;
      this.logic.G.selected = d.unit;
    }
  }
  onPointerUp(p) {
    const d = this.drag;
    if (!d || p.id !== d.pid) return;
    d.x = p.x; d.y = p.y;
    this.finishDrag();
  }
  finishDrag() {
    const d = this.drag, L = this.logic, G = L.G;
    if (!d) return;
    if (G.mode === 'playing') {
      if (d.unit && !d.unit.removed) {
        if (d.dragging) {
          const c = RD.util.cellAt(d);
          if (c) L.moveOrSwap(d.unit, c.col, c.row);
        }
        G.selected = d.unit;
      } else if (!d.unit) {
        G.selected = null;
      }
    }
    this.endDrag();
  }
  endDrag() {
    this.drag = null;
    if (this.dragGhost) { this.viewDestroy(this.dragGhost); this.dragGhost = null; }
  }

  // ── 레거시 첫 획득 연출: 곡 한 번 + 화면 진동 + 맵 테마 변경 + 상단 멘트 ──
  startLegacyEvent(ev) {
    if (this.legacyEv) this.endLegacyEvent(true);
    this.legacyEv = { ev, t: 0 };
    RD.Platform.haptic('success');
    if (ev.bgm) RD.BGM.playOnce(ev.bgm);
    const cam = this.cameras.main;
    cam.shake(1000, 0.018);
    cam.flash(350, 255, 190, 90);
    if (ev.theme) {
      // 맵 텍스처는 처음 쓸 때 한 번만 그림 (가벼운 이미지 1장 교체, 셰이더 효과 없음)
      const img = this.add.image(0, 0, RD.Textures.mapTexture(this, ev.theme)).setOrigin(0).setDepth(0.5).setAlpha(0);
      this.tweens.add({ targets: img, alpha: 1, duration: 600, ease: 'Sine.easeOut' });
      this.legacyEv.img = img;
    }
    const ui = this.scene.get('UIScene');
    if (ui && ui.showBanner) ui.showBanner(ev.title, ev.sub);
  }
  endLegacyEvent(instant) {
    const e = this.legacyEv; if (!e) return;
    this.legacyEv = null;
    if (RD.BGM.onceActive) RD.BGM.stopOnce();
    if (e.img) {
      if (instant) e.img.destroy();
      else this.tweens.add({ targets: e.img, alpha: 0, duration: 1500, ease: 'Sine.easeIn', onComplete: () => e.img.destroy() });
    }
  }

  // ── 메인 루프 ──
  update(time, delta) {
    const dt = Math.min(0.05, delta / 1000), L = this.logic, G = L.G;
    if (G.mode === 'playing') for (let i = 0; i < G.speed && G.mode === 'playing'; i++) L.update(dt);
    RD.Telemetry.round(G.round);
    if (L.shakeReq) { L.shakeReq = 0; this.cameras.main.shake(600, 0.012); RD.Platform.haptic('heavy'); }   // 패킷 등장·처치 흔들림
    // 레거시 첫 획득 연출: 곡이 끝나면(또는 maxSec 이 지나면) 맵을 원래대로
    if (L.eventReq) { const ev = L.eventReq; L.eventReq = null; this.startLegacyEvent(ev); }
    if (this.legacyEv && G.mode === 'playing') {
      this.legacyEv.t += delta / 1000;
      if (!RD.BGM.onceActive || this.legacyEv.t > this.legacyEv.ev.maxSec) this.endLegacyEvent();
    }
    // 배경 음악: 라운드 구간별 트랙, 일시정지/게임 오버 시 멈춤
    if (G.mode === 'over') RD.BGM.stop();
    else { RD.BGM.setRound(G.round, G.boss && G.boss.special && G.boss.special.bgm); RD.BGM.setPaused(G.mode === 'paused'); }

    // 포인터가 다른 씬 위에서 떼어져 up 이벤트를 놓친 경우 대비
    if (this.drag) {
      const pt = this.input.manager.pointers.find(q => q.id === this.drag.pid);
      if (!pt || !pt.isDown) this.finishDrag();
      else if (this.drag.unit && this.drag.unit.removed) this.endDrag();
    }

    this.syncUnits(time);
    this.syncEnemies(time);
    this.syncProjectiles();
    this.syncFloats();
    this.drawUnder(time);
    this.drawOver(time);
    this.syncDragGhost();
  }

  // ── 유닛 ──
  //  유닛 하나 = 본체 컨테이너(몸통·레벨 표시) + 층별 보조 컨테이너 3개 (그림자 / 바닥 이펙트·외곽 발광 / 위쪽 입자)
  //  같은 블렌드(ADD/일반)끼리 깊이를 모아 그려야 GPU 배치가 끊기지 않음 (유닛마다 섞여 있으면 유닛 수 × 4 번 드로우)
  createUnitView(t) {
    const c = this.add.container(0, 0).setDepth(3);
    c.layers = [this.add.container(0, 0), this.add.container(0, 0), this.add.container(0, 0)];   // 그림자, 바닥(ADD), 위(ADD)
    this.viewDepth(c, 3);
    const body = RD.Textures.unitBody(this, t, false);
    c.shadowImg = this.add.image(0, 32, 'shadow');
    c.layers[0].add(c.shadowImg);
    // 타입 표시 (워리어/아처/위저드): 발밑 타입 색 원판 + 아이콘. Lv.0(타입 없음)·레거시(무지개)는 없음
    const typed = !t.hidden && RD.CAT_KEYS.includes(t.cat);
    if (typed) {
      c.typePlate = this.add.image(0, 30, 'typeplate').setTint(RD.util.colorInt(RD.CATEGORIES[t.cat].color)).setAlpha(0.9);
      c.layers[0].add(c.typePlate);
    }
    if (body.rdSprite) this.addLevelFx(c, t);
    else if (t.grade >= 3) { c.halo = this.add.image(0, 0, 'halo').setAlpha(0.22); c.add(c.halo); }
    c.body = body;
    // Lv.2 이상 외곽 발광: 몸통과 같은 프레임을 레벨 색 단색(tintFill) + ADD 로 살짝 크게 뒤에 그림
    //  (preFX 글로우보다 훨씬 가벼움: 같은 텍스처라 한 배치로 그려지고 프레임버퍼 전환이 없음)
    if (body.rdSprite && t.grade >= 2) {
      const k = t.hidden ? 1.14 : t.grade >= 3 ? 1.11 : 1.08;
      c.rim = this.add.sprite(0, 0, body.texture.key, body.frame.name).setOrigin(body.originX, body.originY)
        .setScale(body.scaleX * k, body.scaleY * (1 + (k - 1) * 0.6)).setTintFill(RD.util.colorInt(RD.unitColorStr(t)))
        .setBlendMode(Phaser.BlendModes.ADD).setAlpha(t.hidden ? 0.6 : t.grade >= 3 ? 0.5 : 0.38);
      c.layers[1].add(c.rim);
    }
    c.add(body);
    if (c.fxTop) c.layers[2].add(c.fxTop);
    c.frameImg = this.add.image(0, body.rdSprite ? 44 : 0, (body.rdSprite ? 'pips_' : 'frame_') + t.grade);
    c.add(c.frameImg);
    c.badge = this.add.image(30, -30, 'badge').setVisible(false);
    c.add(c.badge);
    c.lvTag = this.add.image(-22, -42, (t.hidden ? 'lvtagH_' : 'lvtag_') + t.grade);     // 레벨 표시 (왼쪽 위, 히든은 무지개)
    c.add(c.lvTag);
    if (typed) c.add(this.add.image(32, 22, 'typeic_' + t.cat));    // 타입 아이콘 (오른쪽 아래)
    c.grade = t.grade; c.colStr = RD.unitColorStr(t); c.lastAtk = 0;
    this.tintUnitView(c, time0());
    return c;
  }
  viewDepth(v, d) { v.setDepth(d); v.layers[0].setDepth(d - 0.3); v.layers[1].setDepth(d - 0.2); v.layers[2].setDepth(d + 0.2); return v; }
  viewPlace(v, x, y, scale, alpha) { for (const o of [v, ...v.layers]) { o.setPosition(x, y); o.setScale(scale); o.setAlpha(alpha); } }
  viewDestroy(v) { v.layers.forEach(l => l.destroy()); v.destroy(); }
  // ── 레벨별 이펙트 (캐릭터 스프라이트 유닛) ──
  //  Lv.0 그림자만 · Lv.1 바닥 링(타입 색) · Lv.2 육각 마법진 + 오라 + 떠오르는 빛 입자 + 외곽 발광
  //  Lv.3 이중 회전 마법진 + 빛기둥 + 큰 오라 + 궤도 입자 + 강한 발광 (발광은 Textures.unitBody)
  //  Lv.4 이상은 마법진·오라가 조금씩 커지고, 히든은 마법진·오라·입자가 무지개로 계속 바뀜
  addLevelFx(c, t) {
    const g = Math.min(t.grade, 3), big = Math.max(0, t.grade - 3) * 0.06, ADD = Phaser.BlendModes.ADD;
    const col = RD.util.colorInt(RD.unitColorStr(t)), catCol = RD.util.colorInt(RD.CATEGORIES[t.cat].color);
    c.shadowImg.setScale(1 + g * 0.12, 1);
    if (g < 1) return;
    const fx = c.fx = { g, runes: [], sparks: [], orbit: [], seed: Math.random() * 1000, rainbow: !!t.hidden };
    const ground = this.add.container(0, 32).setScale(1, 0.4);     // 바닥 평면 (회전해도 눕혀 보이도록)
    c.layers[1].add(ground);
    const r1 = this.add.image(0, 0, 'fx_rune' + Math.min(g, 3)).setBlendMode(ADD)
      .setTint(g === 1 ? catCol : col).setAlpha(g === 1 ? 0.6 : 0.85).setScale([0, 0.44, 0.52, 0.6][g] + big);
    ground.add(r1); fx.runes.push([r1, g === 1 ? 0.4 : 0.7]);
    if (g >= 3) {
      const r2 = this.add.image(0, 0, 'fx_rune2').setBlendMode(ADD).setTint(catCol).setAlpha(0.7).setScale(0.82 + big);
      ground.add(r2); fx.runes.push([r2, -0.45]);
      fx.pillar = this.add.image(0, 34, 'fx_pillar').setOrigin(0.5, 1).setBlendMode(ADD).setTint(col).setAlpha(0.2).setScale(1.1, 0.9);
      c.layers[1].add(fx.pillar);
    }
    if (g >= 2) {
      fx.aura = this.add.image(0, 0, 'fx_soft').setBlendMode(ADD).setTint(col).setAlpha(g >= 3 ? 0.32 : 0.25).setScale((g >= 3 ? 1.2 : 1) + big * 2);
      c.layers[1].add(fx.aura);
      // 떠오르는 입자 + (Lv.3) 궤도 입자 → 몸통 위에 그림
      c.fxTop = this.add.container(0, 0);
      const n = g >= 3 ? 6 + Math.min(4, t.grade - 3) : 4;
      for (let i = 0; i < n; i++) {
        const sp = this.add.image(0, 0, 'fx_spark').setBlendMode(ADD).setTint(i % 2 ? col : catCol);
        c.fxTop.add(sp); fx.sparks.push(sp);
      }
      if (g >= 3) for (let i = 0; i < 3; i++) {
        const sp = this.add.image(0, 0, 'fx_spark').setBlendMode(ADD).setTint(0xffffff).setScale(1.1);
        c.fxTop.add(sp); fx.orbit.push(sp);
      }
    }
  }
  animLevelFx(c, time) {
    const fx = c.fx;
    if (!fx) return;
    const s = time / 1000, k = fx.seed;
    for (const [r, spd] of fx.runes) r.rotation = s * spd + k;
    if (fx.aura) fx.aura.setAlpha((fx.g >= 3 ? 0.3 : 0.22) + Math.sin(s * 3 + k) * 0.07);
    if (fx.pillar) fx.pillar.setAlpha(0.15 + Math.sin(s * 2.2 + k) * 0.07);
    if (fx.rainbow) {
      const rc = RD.util.colorInt('rainbow');
      fx.runes[0][0].setTint(rc); if (fx.aura) fx.aura.setTint(rc); if (fx.pillar) fx.pillar.setTint(rc);
      fx.sparks.forEach((sp, i) => { if (i % 2) sp.setTint(rc); });
      if (c.rim) c.rim.setTintFill(rc);
    }
    const n = fx.sparks.length;
    fx.sparks.forEach((sp, i) => {
      const p = (s * (fx.g >= 3 ? 0.7 : 0.5) + i / n + k) % 1;
      sp.setPosition(Math.sin(i * 2.4 + k) * (22 + (i % 3) * 8), 30 - p * 96);
      sp.setAlpha(Math.sin(p * Math.PI) * 0.9).setScale(0.45 + 0.4 * (1 - p));
    });
    fx.orbit.forEach((sp, i) => {
      const a = s * 2.4 + i * Math.PI * 2 / 3 + k;
      sp.setPosition(Math.cos(a) * 46, 6 + Math.sin(a) * 16);
      sp.setAlpha(Math.sin(a) > 0 ? 1 : 0.35);    // 뒤로 돌 때는 흐리게
    });
  }
  tintUnitView(c, time) {
    const col = RD.util.colorInt(c.colStr);
    c.frameImg.setTint(col);
    if (c.halo) { c.halo.setTint(col); c.halo.setScale(1 + Math.sin(time / 200) * 0.03); }
  }
  syncUnits(time) {
    const L = this.logic, G = L.G, counts = {};
    for (const u of G.units) counts[u.type.id] = (counts[u.type.id] || 0) + 1;
    // 히든 레시피 재료가 다 모인 유닛도 조합 가능 표시
    const ready = new Set();
    for (const rc of RD.RECIPES) { const p = L.recipeUnits(rc); if (p) p.forEach(u => ready.add(u)); }
    const dragU = this.drag && this.drag.dragging ? this.drag.unit : null;
    for (const u of G.units) {
      let v = this.unitViews.get(u);
      if (!v) { v = this.createUnitView(u.type); this.unitViews.set(u, v); }
      const pop = u.born < 1 ? 0.4 + 0.6 * u.born : 1;
      this.viewPlace(v, u.x, u.y, pop * (1 + 0.1 * u.anim), u === dragU ? 0.3 : 1);
      v.badge.setVisible(u !== dragU && ((counts[u.type.id] >= 3 && RD.canMerge(u.type)) || ready.has(u)));
      if (u.type.grade >= 3) this.tintUnitView(v, time);
      this.animLevelFx(v, time);
      if (v.body.rdSprite && u.face) v.body.setFlipX(u.face < 0);   // 공격한 적 쪽을 바라봄 (시트는 오른쪽 방향)
      if (v.rim) { v.rim.setFrame(v.body.frame.name, false, false); v.rim.setFlipX(v.body.flipX); }
      // 스프라이트시트 공격 애니메이션
      if (v.lastAtk !== u.atk) {
        v.lastAtk = u.atk;
        const rs = v.body.rdSprite;
        if (rs && rs.attack) {
          const cur = v.body.anims.currentAnim;
          if (!(cur && cur.key === rs.attack && v.body.anims.isPlaying)) {
            v.body.play(rs.attack);
            if (rs.idle) v.body.chain(rs.idle);
          }
        }
      }
    }
    for (const [u, v] of this.unitViews) if (u.removed) { this.viewDestroy(v); this.unitViews.delete(u); }
  }

  // ── 적 ──
  syncEnemies(time) {
    const G = this.logic.G;
    for (const e of G.enemies) {
      let v = this.enemyViews.get(e);
      if (!v) { v = RD.Textures.enemySprite(this, e.type).setDepth(e.boss || e.packet ? 2.5 : 2); this.enemyViews.set(e, v); v.prevX = e.x; }
      if (e.packet) {   // 뒤틀린 색: 색조·크기·위치를 매 프레임 흔듦 (가벼운 tint 만 사용, postFX 없음)
        const k = time / 1000;
        v.setTint(RD.util.hsvToInt((k * 0.9) % 1, 0.9, 1), RD.util.hsvToInt((k * 0.9 + 0.33) % 1, 0.9, 1),
          RD.util.hsvToInt((k * 0.9 + 0.66) % 1, 0.9, 1), RD.util.hsvToInt((k * 0.9 + 0.5) % 1, 0.9, 1));
        v.setScale(1.6 + Math.sin(k * 11) * 0.12, 1.6 + Math.cos(k * 7) * 0.12).setAngle(Math.sin(k * 5) * 12);
        const glitch = Math.random() < 0.12 ? RD.util.rand(-10, 10) : 0;
        v.setPosition(e.x + glitch, e.y);
        if (e.hitT > 0) v.setAlpha(0.6); else v.setAlpha(1);
        continue;
      }
      const bob = e.stunT > 0 ? 0 : Math.sin(time / 120 + e.wob) * 2.4;
      if (v.rdSprite) { const dx = e.x - v.prevX; if (dx < -0.02) v.setFlipX(true); else if (dx > 0.02) v.setFlipX(false); }
      v.prevX = e.x;
      v.setPosition(e.x, e.y + bob);
      if (e.hitT > 0) v.setTintFill(0xffffff); else if (v.isTinted) v.clearTint();
    }
    for (const [e, v] of this.enemyViews) if (e.dead) { v.destroy(); this.enemyViews.delete(e); }
  }

  // ── 투사체 (오브젝트 풀) ──
  projTexture(t) {
    switch (t.fx) {
      case 'arrow': return 'p_arrow';
      case 'bullet': return 'p_bullet';
      case 'missile': return 'p_missile';
      default: return RD.Textures.orb(this, t.pcolor || RD.GameLogic.fxColor(t));
    }
  }
  syncProjectiles() {
    const G = this.logic.G;
    for (const p of G.projectiles) {
      let v = this.projViews.get(p);
      if (!v) {
        v = this.projPool.pop() || this.add.image(0, 0, 'p_bullet').setDepth(4);
        v.setTexture(this.projTexture(p.t)).setVisible(true);
        const fx = p.t.fx;
        v.setScale(fx === 'fire' ? 0.7 : (fx === 'orb' || fx === 'holy') ? (5 + p.t.grade * 0.6) / 10 : 1);
        this.projViews.set(p, v);
      }
      v.setPosition(p.x, p.y).setRotation(p.ang);
    }
    for (const [p, v] of this.projViews) if (p.done) { v.setVisible(false); this.projPool.push(v); this.projViews.delete(p); }
  }

  // ── 데미지 숫자 (텍스트 풀) ──
  syncFloats() {
    const G = this.logic.G;
    for (const f of G.floats) {
      let v = this.floatViews.get(f);
      if (!v) {
        v = this.floatPool.pop() || this.add.text(0, 0, '', RD.util.textStyle(24, '#ffffff', 6)).setOrigin(0.5).setDepth(7);
        if (v._rdSize !== f.size) { v.setFontSize(f.size); v._rdSize = f.size; }
        RD.util.setText(v, f.text, f.color);
        v.setVisible(true);
        this.floatViews.set(f, v);
      }
      v.setPosition(f.x, f.y).setAlpha(1 - f.t / f.life);
    }
    for (const [f, v] of this.floatViews) if (f.dead) { v.setVisible(false); this.floatPool.push(v); this.floatViews.delete(f); }
  }

  // ── 아래층 그래픽: 포탈, 선택 사거리, 같은 유닛 표시, 적 그림자 ──
  drawUnder(time) {
    const g = this.gUnder, G = this.logic.G, P = RD.PATH, cInt = RD.util.colorInt;
    g.clear();
    // 경로를 따라 흐르는 데이터 신호 (적 진행 방향)
    const per = RD.PERIM, n = 28, step = per / n, off = (time * 0.09) % step, tp = this._tp || (this._tp = { x: 0, y: 0 });
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < 4; j++) {
        RD.util.pathPos(i * step + off - j * 9, 0, tp);
        g.fillStyle(0x00e5ff, 0.55 - j * 0.13).fillRect(tp.x - 3, tp.y - 3, 6, 6);
      }
    }
    const pr = 32 + Math.sin(time / 250) * 4;
    g.fillStyle(0xaa00ff, 0.18).fillCircle(P.l, P.t, pr + 12);
    g.lineStyle(6, 0xc158ff, 1).strokeCircle(P.l, P.t, pr);
    g.lineStyle(4, 0xea80fc, 1); g.beginPath(); g.arc(P.l, P.t, pr * 0.5, time / 200, time / 200 + 4); g.strokePath();

    const sel = G.selected;
    if (sel && !sel.removed) {
      const r = sel.type.range;
      g.fillStyle(0xffffff, 0.05).fillCircle(sel.x, sel.y, r);
      g.lineStyle(3, RD.util.colorInt(RD.unitColorStr(sel.type)), 1);
      const n = Math.max(12, Math.floor(Math.PI * 2 * r / 24));
      for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2; g.beginPath(); g.arc(sel.x, sel.y, r, a0, a0 + Math.PI / n); g.strokePath(); }
      for (const u of G.units) if (u.type.id === sel.type.id) {
        g.lineStyle(u === sel ? 6 : 4, 0xffffff, u === sel ? 1 : 0.45).strokeCircle(u.x, u.y, 48);
      }
    }
    g.fillStyle(0x000000, 0.35);
    for (const e of G.enemies) g.fillEllipse(e.x, e.y + e.size * 0.9, e.size * 1.8, e.size * 0.7);
  }

  // ── 위층 그래픽: 체력바, 상태이상, 공격 이펙트, 드래그 목표 칸 ──
  drawOver(time) {
    const g = this.gOver, G = this.logic.G, cInt = RD.util.colorInt, clamp = RD.util.clamp, TAU = Math.PI * 2;
    g.clear();
    for (const e of G.enemies) {
      const s = e.size;
      if (e.slowT > 0) g.lineStyle(4, 0x64c8ff, 0.8).strokeCircle(e.x, e.y, s + 6);
      if (e.packet) {   // 패킷: 무지개 링 + 큰 체력바
        const rc = cInt('rainbow');
        g.lineStyle(6, rc, 0.9).strokeEllipse(e.x, e.y + s * 1.3, s * 3.4, s * 1.2);
        const bw = 150, bx = e.x - bw / 2, by = e.y - s * 1.6 - 30;
        g.fillStyle(0x000000, 0.75).fillRect(bx - 2, by - 2, bw + 4, 16);
        g.fillStyle(rc, 1).fillRect(bx, by, bw * clamp(e.hp / e.maxHp, 0, 1), 12);
        continue;
      }
      // 적 타입 표시: 발밑 색 링 + 머리 위 작은 마름모 (장갑 주황 · 기동 노랑 · 데이터 하늘)
      const tc = cInt(RD.ENEMY_TYPES[e.etype].color), my = e.y - s - (e.boss ? 44 : 30);
      g.lineStyle(e.boss ? 5 : 3, tc, 0.85).strokeEllipse(e.x, e.y + s * 0.9, s * 2.2, s * 0.9);
      g.fillStyle(tc, 1).fillPoints([{ x: e.x, y: my - 7 }, { x: e.x + 6, y: my }, { x: e.x, y: my + 7 }, { x: e.x - 6, y: my }], true);
      if (e.stunT > 0) {
        g.fillStyle(0xffeb3b, 1);
        for (let i = 0; i < 3; i++) { const a = time / 150 + i * TAU / 3; g.fillCircle(e.x + Math.cos(a) * s, e.y - s - 8 + Math.sin(a) * 6, 4.4); }
      }
      if (e.hp < e.maxHp || e.boss) {
        const bw = e.boss ? 112 : s * 2 + 12, bh = e.boss ? 12 : 8, bx = e.x - bw / 2, by = e.y - s - (e.boss ? 28 : 18);
        g.fillStyle(0x000000, 0.7).fillRect(bx - 2, by - 2, bw + 4, bh + 4);
        const r = clamp(e.hp / e.maxHp, 0, 1);
        g.fillStyle(e.boss ? 0xff1744 : (r > 0.5 ? 0x66bb6a : r > 0.25 ? 0xffca28 : 0xef5350), 1).fillRect(bx, by, bw * r, bh);
      }
    }
    for (const f of G.effects) {
      const p = f.t / f.life, a = 1 - p, c = cInt(f.color);
      switch (f.k) {
        case 'boom':
          g.fillStyle(c, a * 0.25).fillCircle(f.x, f.y, f.r * (0.4 + 0.6 * p));
          g.lineStyle(4, c, a).strokeCircle(f.x, f.y, f.r * (0.4 + 0.6 * p));
          break;
        case 'slash':
          g.lineStyle(6, c, a); g.beginPath(); g.arc(f.x, f.y, f.r, f.a, f.a + 2.4 * (0.4 + p)); g.strokePath();
          break;
        case 'beam':
          g.lineStyle(f.w * (1.6 - p), c, a).lineBetween(f.x, f.y, f.x2, f.y2);
          g.lineStyle(Math.max(2, f.w * 0.4), 0xffffff, a).lineBetween(f.x, f.y, f.x2, f.y2);
          break;
        case 'lightning':
          g.lineStyle(6, c, a).strokePoints(f.pts, false);
          g.lineStyle(2, 0xffffff, a).strokePoints(f.pts, false);
          break;
        case 'spark':
          g.fillStyle(c, a).fillCircle(f.x, f.y, f.r * (1 + p)); break;
        case 'flash':
          g.fillStyle(c, a * 0.35).fillCircle(f.x, f.y, f.r * (0.7 + 0.5 * p));
          g.fillStyle(0xffffff, a * 0.6).fillCircle(f.x, f.y, f.r * 0.35 * (1 - p));
          break;
        case 'pop': case 'ring':
          g.lineStyle(5, c, a).strokeCircle(f.x, f.y, f.r * (0.5 + p)); break;
        case 'combine':
          g.lineStyle(8, c, a).strokeCircle(f.x, f.y, f.r * (0.3 + p));
          g.lineStyle(4, c, a);
          for (let i = 0; i < 10; i++) {
            const an = i * TAU / 10 + p, r1 = f.r * 0.4 * (1 + p), r2 = r1 + 20;
            g.lineBetween(f.x + Math.cos(an) * r1, f.y + Math.sin(an) * r1, f.x + Math.cos(an) * r2, f.y + Math.sin(an) * r2);
          }
          break;
      }
    }
    const d = this.drag;
    if (d && d.dragging && d.unit) {
      const c = RD.util.cellAt(d);
      if (c) {
        const p = RD.util.cellCenter(c.col, c.row), other = G.grid[c.row][c.col];
        g.lineStyle(4, other && other !== d.unit ? 0xffca28 : 0x69f0ae, 1).strokeRoundedRect(p.x - 46, p.y - 46, 92, 92, 18);
      }
    }
  }

  syncDragGhost() {
    const d = this.drag;
    if (d && d.dragging && d.unit) {
      if (!this.dragGhost) {
        this.dragGhost = this.viewDepth(this.createUnitView(d.unit.type), 9);
      }
      this.viewPlace(this.dragGhost, d.x, d.y - 20, 1.15, 0.9);
      if (d.unit.type.grade >= 3) this.tintUnitView(this.dragGhost, performance.now());
      this.animLevelFx(this.dragGhost, performance.now());
      const gh = this.dragGhost; if (gh.rim) gh.rim.setFrame(gh.body.frame.name, false, false);
    } else if (this.dragGhost) { this.viewDestroy(this.dragGhost); this.dragGhost = null; }
  }
};

function time0() { return performance.now(); }
