/* BootScene: 전역 설정 후 PreloadScene 으로 */
window.RD = window.RD || {};

RD.BootScene = class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }
  create() {
    if (this.registry.get('speed') === undefined) this.registry.set('speed', 1);
    this.input.setGlobalTopOnly(false);   // UIScene 과 GameScene 이 같은 포인터 이벤트를 받도록 (영역으로 구분)
    // 캔버스 텍스트는 폰트가 로드된 뒤 그려야 웹폰트가 적용됨 (최대 3초 대기 후 시스템 폰트로 진행)
    const go = () => { if (!this._rdStarted) { this._rdStarted = true; this.scene.start('PreloadScene'); } };
    if (document.fonts && document.fonts.load) {
      Promise.all(['400', 'bold'].map(w => document.fonts.load(`${w} 20px Pretendard`, '가나다ABC123')))
        .then(r => { if (!r.every(f => f.length)) console.warn('[RD] Pretendard 폰트를 불러오지 못해 시스템 폰트를 사용합니다'); go(); }, go);
      this.time.delayedCall(3000, go);
    } else go();
  }
};
