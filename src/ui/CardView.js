/* =====================================================================
 * 메모리 카드 그리기 (갤러리 / 싱크 슬롯 / 캡슐 결과 공용)
 *  RD.CardView.create(scene, x, y, w, h, card, opts) → Container (가운데 기준)
 *   opts.owned (기본: 실제 보유 여부), opts.level, opts.showName(기본 true)
 *  일러스트가 아직 없어서 등급 색 프레임 + 실루엣 + 스캔라인 플레이스홀더를 그린다
 *  RD.CardArt.texture(scene, card) 가 텍스처 키를 돌려주면 실루엣 대신 그 이미지를 씀
 * ===================================================================== */
window.RD = window.RD || {};

/* 일러스트 연결 지점 (아직 이미지 없음)
 *  계획: 빌드 때 이미지를 인코딩(암호화)한 문자열로 RD.CARD_ART_DATA[art 키] 에 넣고,
 *        카드를 보유한 경우에만 decode() 로 풀어 scene.textures.addBase64 로 등록 → 공개 저장소에는 원본 이미지 파일이 없음
 *  decode 는 이미지가 들어올 때 함께 구현 (지금은 데이터가 없어서 항상 null) */
RD.CardArt = {
  decode: null,
  texture(scene, card) {
    const data = RD.CARD_ART_DATA && card.art && RD.CARD_ART_DATA[card.art];
    if (!data || !RD.Meta.owned(card.id) || !this.decode) return null;
    const key = 'card_' + card.id;
    return scene.textures.exists(key) ? key : null;   // 디코딩·등록은 이미지 추가 시 구현
  },
};

RD.CardView = (() => {
  const colInt = c => parseInt(c.slice(1), 16);

  function create(scene, x, y, w, h, card, opts) {
    opts = opts || {};
    const S = RD.util.textStyle, GR = RD.CARD_GRADES[card.grade];
    const owned = opts.owned !== undefined ? opts.owned : RD.Meta.owned(card.id);
    const lv = opts.level !== undefined ? opts.level : RD.Meta.level(card.id);
    const col = colInt(GR.color), err = card.grade === 'error404';
    const k = w / 240;                       // 글자·선 크기 배율 (기준 카드 폭 240)
    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    c.add(g);
    const L = -w / 2, T = -h / 2;

    // 바탕 + 등급 색 그라데이션
    g.fillStyle(0x0b0f24, 1).fillRect(L, T, w, h);
    const a = owned ? 0.42 : 0.12;
    g.fillGradientStyle(col, col, 0x0b0f24, 0x0b0f24, a, a, 0, 0).fillRect(L, T, w, h * 0.75);

    // 일러스트 또는 실루엣
    const art = owned && RD.CardArt.texture(scene, card);
    if (art) {
      const img = scene.add.image(0, T + h * 0.42, art);
      img.setScale(Math.min(w / img.width, (h * 0.8) / img.height));
      c.add(img);
    } else {
      const sa = owned ? 0.55 : 0.18, cy = T + h * 0.45;
      g.fillStyle(col, sa);
      g.fillCircle(0, cy - h * 0.12, w * 0.16);                                   // 머리
      g.fillEllipse(0, cy + h * 0.17, w * 0.62, h * 0.34);                         // 어깨
      g.fillStyle(0x0b0f24, 1).fillRect(L, cy + h * 0.25, w, h * 0.3);             // 어깨 아래 잘라냄
      // 스캔라인
      g.lineStyle(1, 0xffffff, owned ? 0.07 : 0.04);
      for (let yy = T + 6; yy < T + h * 0.8; yy += 10 * k) g.lineBetween(L + 4, yy, L + w - 4, yy);
      if (owned) c.add(scene.add.text(0, T + h * 0.7, 'IMAGE // SEALED', S(Math.round(15 * k), '#ffffff', 0, 'normal')).setOrigin(0.5).setAlpha(0.35).setLetterSpacing(3));
    }

    // 404: 빨간 글리치 띠
    if (err && owned) {
      g.fillStyle(0xff2a3d, 0.35);
      [[0.18, 0.03, 10], [0.36, 0.02, -14], [0.58, 0.04, 8]].forEach(([py, ph, dx]) => g.fillRect(L + dx * k, T + h * py, w, h * ph));
      g.fillStyle(0x00e5ff, 0.25).fillRect(L - 8 * k, T + h * 0.47, w, h * 0.015);
    }

    // 이름 판
    const plateY = T + h * 0.78;
    g.fillStyle(0x05040b, 0.92).fillRect(L, plateY, w, h * 0.22);
    g.lineStyle(2, col, owned ? 0.8 : 0.3).lineBetween(L, plateY, L + w, plateY);

    // 테두리 (바깥 글로우 + 선 + 모서리)
    g.lineStyle(8 * k, col, owned ? 0.22 : 0.08).strokeRect(L - 3, T - 3, w + 6, h + 6);
    g.lineStyle(Math.max(2, 4 * k), col, owned ? 1 : 0.35).strokeRect(L, T, w, h);
    const ck = 22 * k;
    g.lineStyle(Math.max(2, 4 * k), 0xffffff, owned ? 0.85 : 0.25);
    [[L, T, 1, 1], [L + w, T, -1, 1], [L, T + h, 1, -1], [L + w, T + h, -1, -1]].forEach(([px, py, dx, dy]) => {
      g.lineBetween(px, py, px + ck * dx, py); g.lineBetween(px, py, px, py + ck * dy);
    });

    // 등급 / 레벨
    c.add(scene.add.text(L + 12 * k, T + 12 * k, GR.en, S(Math.round(17 * k), GR.color)).setOrigin(0, 0).setAlpha(owned ? 1 : 0.5));
    if (owned && lv > 0) c.add(scene.add.text(L + w - 12 * k, T + 10 * k, `Lv.${lv}`, S(Math.round(24 * k), '#ffffff', 4)).setOrigin(1, 0));
    if (opts.showName !== false) {
      c.add(scene.add.text(0, plateY + h * 0.08, owned ? card.name : '???', S(Math.round(30 * k), owned ? '#ffffff' : '#5d6680')).setOrigin(0.5));
      c.add(scene.add.text(0, plateY + h * 0.165, owned ? card.title : 'SEALED MEMORY', S(Math.round(16 * k), owned ? GR.color : '#4d5b78', 0, 'normal')).setOrigin(0.5));
    }
    if (!owned) {                            // 자물쇠
      const ly = T + h * 0.4, lw = 44 * k, lh = 36 * k;
      g.lineStyle(7 * k, 0x8a94b0, 0.6).beginPath();
      g.arc(0, ly - lh / 2, lw * 0.32, Math.PI, 0, false); g.strokePath();
      g.fillStyle(0x8a94b0, 0.6).fillRect(-lw / 2, ly - lh / 2, lw, lh);
      g.fillStyle(0x0b0f24, 1).fillCircle(0, ly, 5 * k);
    }
    c.setSize(w, h);
    return c;
  }

  // 빈 싱크 슬롯
  function empty(scene, x, y, w, h, label) {
    const S = RD.util.textStyle, c = scene.add.container(x, y), g = scene.add.graphics();
    g.fillStyle(0x0b0f24, 0.7).fillRect(-w / 2, -h / 2, w, h);
    g.lineStyle(3, 0x00e5ff, 0.5);
    const dash = 18;
    for (let p = -w / 2; p < w / 2; p += dash * 2) { g.lineBetween(p, -h / 2, Math.min(p + dash, w / 2), -h / 2); g.lineBetween(p, h / 2, Math.min(p + dash, w / 2), h / 2); }
    for (let p = -h / 2; p < h / 2; p += dash * 2) { g.lineBetween(-w / 2, p, -w / 2, Math.min(p + dash, h / 2)); g.lineBetween(w / 2, p, w / 2, Math.min(p + dash, h / 2)); }
    c.add([g, scene.add.text(0, -20, '+', S(80, '#00e5ff')).setOrigin(0.5).setAlpha(0.7),
      scene.add.text(0, 60, label || '카드 장착', S(26, '#7fa8c9', 0, 'normal')).setOrigin(0.5)]);
    c.setSize(w, h);
    return c;
  }

  return { create, empty };
})();
