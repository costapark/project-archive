/* GameOverScene: 결과(기억 파편 정산 포함) + 다시 하기 / 로비로 (GameScene/UIScene 위에 겹쳐서 실행)
 * 레이아웃: 패널 y 470~1440
 *   y 590 제목 · 690 사유 · 790 도달 라운드 · 860 처치/유닛 · 920 최고 등급 · 980 난이도
 *   y 1040~1180 기억 파편 상자 · 1250 [다시 하기] [로비로]
 */
window.RD = window.RD || {};

RD.GameOverScene = class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOverScene'); }
  create() {
    const W = RD.W, H = RD.H, S = RD.util.textStyle, fmt = RD.util.fmt;
    const gs = this.scene.get('GameScene'), G = gs.logic.G, res = gs.runResult;
    const g = this.add.graphics();
    g.fillStyle(0x05030a, 0.72).fillRect(0, 0, W, H);
    g.fillStyle(0x1f1530, 1).fillRoundedRect(80, 470, W - 160, 970, 44);
    g.lineStyle(6, 0x8a6a3a, 1).strokeRoundedRect(80, 470, W - 160, 970, 44);
    this.add.zone(0, 0, W, H).setOrigin(0).setInteractive();   // 아래 화면 터치 차단용

    this.add.text(W / 2, 590, '게임 오버', S(92, '#ff5252', 10)).setOrigin(0.5);
    this.add.text(W / 2, 690, G.overReason, S(32, '#f0e6ff', 0, 'normal')).setOrigin(0.5);
    const DF = RD.DIFFICULTIES[G.diff];
    this.add.text(W / 2, 790, `도달 라운드  ${G.round}${res && res.newBest ? '   최고 기록!' : ''}`, S(48, '#ffe082')).setOrigin(0.5);
    this.add.text(W / 2, 860, `처치 ${fmt(G.kills)}   ·   보유 유닛 ${G.units.length}`, S(34, '#c9bde0', 0, 'normal')).setOrigin(0.5);
    const best = G.units.reduce((m, u) => (!m || u.type.grade > m.grade || (u.type.grade === m.grade && u.type.hidden) ? u.type : m), null);
    if (best) this.add.text(W / 2, 920, `최고 등급: ${RD.unitLevelName(best)}  ${best.name}`, S(34, RD.unitTextColor(best))).setOrigin(0.5);
    this.add.text(W / 2, 980, `난이도 ${DF.name}`, S(32, DF.color)).setOrigin(0.5);

    // ── 기억 파편 정산 ──
    g.fillStyle(0x0b0f24, 1).fillRect(140, 1040, W - 280, 150);
    g.lineStyle(3, 0x7dffb0, 0.8).strokeRect(140, 1040, W - 280, 150);
    RD.LobbyScene.drawShard(g, 200, 1115, 34);
    if (res && res.total > 0) {
      this.add.text(250, 1088, `기억 파편 +${fmt(res.total)}${res.bonus ? `  (카드 보너스 +${fmt(res.bonus)})` : ''}`, S(36, '#7dffb0')).setOrigin(0, 0.5);
      const caps = Math.floor(res.have / RD.META.capsuleCost);
      this.add.text(250, 1144, `보유 ${fmt(res.have)}  ·  메모리 캡슐 ${caps}개 해독 가능`, S(28, '#e6ecff', 0, 'normal')).setOrigin(0, 0.5);
    } else {
      this.add.text(250, 1088, '기억 파편 회수 실패', S(36, '#8fa3c0')).setOrigin(0, 0.5);
      this.add.text(250, 1144, `${RD.META.fragmentMinRound} 스테이지 이상 도달하면 회수됩니다`, S(28, '#b9d4ee', 0, 'normal')).setOrigin(0, 0.5);
    }

    // 새로 달성한 업적 (보상은 로비 → 기록·업적에서)
    if (res && res.ach && res.ach.length) {
      const names = res.ach.slice(0, 2).map(a => a.name).join(', ') + (res.ach.length > 2 ? ` 외 ${res.ach.length - 2}개` : '');
      const t = this.add.text(W / 2, 1500, `업적 달성! ${names}`, S(34, '#ffd54f', 6)).setOrigin(0.5);
      this.add.text(W / 2, 1552, '로비 → 기록 · 업적에서 보상(기억 파편)을 받으세요', S(26, '#e6ecff', 4, 'normal')).setOrigin(0.5);
      this.tweens.add({ targets: t, scale: 1.06, duration: 500, yoyo: true, repeat: -1 });
    }
    const restart = () => { if (!this.done) { this.done = true; RD.BGM.start(0); this.scene.start('GameScene'); } };
    const lobby = () => { if (!this.done) { this.done = true; this.scene.stop('GameScene'); this.scene.start('LobbyScene'); } };
    this.onBack = () => { lobby(); return true; };   // 안드로이드 뒤로가기 → 로비로
    new RD.UIButton(this, RD.UI.btnRestart, { scheme: 'gold', labelSize: 48, onClick: restart }).set('다시 하기', '', true);
    new RD.UIButton(this, RD.UI.btnLobby, { scheme: 'mine', labelSize: 48, onClick: lobby }).set('로비로', '', true);
    this.input.keyboard && this.input.keyboard.on('keydown', e => { if (e.key === 'Enter') restart(); else if (e.key === 'Escape') lobby(); });
  }
};
