/* =====================================================================
 * 네온 UI 공용 부품 (타이틀 / 로비 / 갤러리 / 캡슐 씬)
 *  RD.Neon.button(scene, rect, label, sub, color, onClick) : 네온 외곽선 버튼
 *  RD.Neon.background(scene, horizonY)                     : 원근 그리드 + 데이터 입자 배경 (update(dt) 호출)
 *  RD.Neon.header(scene, title, en, onBack)                 : 상단 제목 바 + [◀ 로비] 버튼
 *  씬에 scene.modal 이 켜져 있으면(팝업 열림) 버튼이 눌리지 않음 (팝업 안의 버튼은 opts.modal = true)
 *  GPU 부담을 줄이려고 postFX 없이 Graphics 선과 반투명 채우기만 사용
 * ===================================================================== */
window.RD = window.RD || {};

RD.Neon = (() => {
  const hexStr = c => '#' + c.toString(16).padStart(6, '0');

  // 네온 외곽선 버튼 (누르고 있다가 버튼 위에서 떼면 실행). 반환: { zone, setLabel(label, sub), setEnabled(on), destroy() }
  function button(scene, r, label, sub, color, onClick, opts) {
    opts = opts || {};
    const S = RD.util.textStyle, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const parts = [];
    const g = scene.add.graphics();
    let enabled = true, pressed = false, hover = false, col = color;
    const big = opts.size || (sub ? 60 : 44);
    const txt = scene.add.text(cx, cy, label, S(big, '#ffffff')).setOrigin(0.5).setShadow(0, 0, hexStr(col), 18, false, true);
    const subTxt = scene.add.text(cx, cy, sub || '', S(opts.subSize || 24, hexStr(col), 0, 'normal')).setOrigin(0.5).setLetterSpacing(opts.subSpacing === undefined ? 10 : opts.subSpacing);
    const draw = () => {
      g.clear();
      const off = pressed ? 4 : 0, c = enabled ? col : 0x4d5b78;
      if (opts.backing) g.fillStyle(0x07060f, 0.88).fillRect(r.x, r.y + off, r.w, r.h);   // 배경 그리드 위에서 글자가 잘 보이게
      g.fillStyle(c, pressed ? 0.35 : hover ? 0.22 : 0.12).fillRect(r.x, r.y + off, r.w, r.h);
      g.lineStyle(10, c, enabled ? 0.18 : 0.08).strokeRect(r.x - 4, r.y - 4 + off, r.w + 8, r.h + 8);
      g.lineStyle(4, c, 1).strokeRect(r.x, r.y + off, r.w, r.h);
      const k = Math.min(26, r.h / 4);
      g.lineStyle(6, 0xffffff, enabled ? 0.9 : 0.3);
      [[r.x, r.y, 1, 1], [r.x + r.w, r.y, -1, 1], [r.x, r.y + r.h, 1, -1], [r.x + r.w, r.y + r.h, -1, -1]].forEach(([x, y, dx, dy]) => {
        g.lineBetween(x, y + off, x + k * dx, y + off); g.lineBetween(x, y + off, x, y + off + k * dy);
      });
      const hasSub = subTxt.text !== '';
      txt.y = (hasSub ? cy - r.h * 0.13 : cy) + off;
      subTxt.y = cy + r.h * 0.25 + off;
      txt.setAlpha(enabled ? 1 : 0.45); subTxt.setAlpha(enabled ? 1 : 0.45);
    };
    const zone = scene.add.zone(r.x, r.y, r.w, r.h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => { hover = true; draw(); });
    zone.on('pointerdown', () => { pressed = true; draw(); });
    zone.on('pointerout', () => { pressed = false; hover = false; draw(); });
    zone.on('pointerup', () => {
      const was = pressed; pressed = false; draw();
      if (was && enabled && (opts.modal || !scene.modal)) onClick();
    });
    parts.push(g, txt, subTxt, zone);
    draw();
    const api = {
      zone, parts,
      setLabel(l, s) { if (l !== undefined) txt.setText(l); if (s !== undefined) subTxt.setText(s); draw(); return api; },
      setEnabled(on) { if (enabled !== on) { enabled = on; draw(); } return api; },
      setColor(c) { col = c; txt.setShadow(0, 0, hexStr(c), 18, false, true); subTxt.setColor(hexStr(c)); draw(); return api; },
      setDepth(d) { parts.forEach(p => p.setDepth(d)); return api; },
      addTo(container) { container.add(parts); return api; },
      destroy() { parts.forEach(p => p.destroy()); },
    };
    return api;
  }

  // 원근 네온 그리드 + 흘러가는 데이터 입자. 반환 객체의 update(dt) 를 씬 update 에서 호출
  function background(scene, horizonY, opts) {
    opts = opts || {};
    const W = RD.W, H = RD.H, hy = horizonY;
    scene.cameras.main.setBackgroundColor('#050409');
    scene.add.graphics().fillGradientStyle(0x0a0618, 0x0a0618, 0x050409, 0x050409, 1).fillRect(0, 0, W, H);
    const grid = scene.add.graphics();
    const bits = [];
    for (let i = 0; i < (opts.bits || 40); i++) {
      const b = scene.add.rectangle(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 4, Phaser.Math.Between(8, 26),
        Phaser.Math.RND.pick([0x00e5ff, 0xff2bd6, 0x7c4dff]), Phaser.Math.FloatBetween(0.12, opts.bitAlpha || 0.5));
      b.speed = Phaser.Math.FloatBetween(40, 140);
      bits.push(b);
    }
    let t = 0;
    const dim = opts.dim || 1;
    return {
      update(dt) {
        t += dt;
        const g = grid;
        g.clear();
        g.lineStyle(1, 0x3a2a7a, 0.25 * dim);
        for (let x = 0; x <= W; x += 90) g.lineBetween(x, 0, x, hy);
        for (let y = 0; y <= hy; y += 90) g.lineBetween(0, y, W, y);
        g.lineStyle(14, 0xff2bd6, 0.12 * dim).lineBetween(0, hy, W, hy);
        g.lineStyle(3, 0xff2bd6, 0.9 * dim).lineBetween(0, hy, W, hy);
        const vx = W / 2;
        g.lineStyle(2, 0x00e5ff, 0.45 * dim);
        for (let i = -12; i <= 12; i++) g.lineBetween(vx + i * 30, hy, vx + i * 260, H);
        const scroll = (t * 0.6) % 1;
        for (let i = 0; i < 14; i++) {
          const p = (i + scroll) / 14, y = hy + (H - hy) * p * p;
          g.lineStyle(2, 0x00e5ff, (0.15 + 0.6 * p) * dim).lineBetween(0, y, W, y);
        }
        for (const b of bits) {
          b.y -= b.speed * dt;
          if (b.y < -30) { b.y = H + 30; b.x = Phaser.Math.Between(0, W); }
        }
      },
    };
  }

  // 상단 제목 바 (높이 200): 왼쪽 [◀] 뒤로 버튼, 가운데 제목. 반환 { g, back }
  function header(scene, title, en, onBack) {
    const W = RD.W, S = RD.util.textStyle;
    const g = scene.add.graphics().setDepth(50);
    g.fillStyle(0x07060f, 0.96).fillRect(0, 0, W, 200);
    g.lineStyle(2, 0x00e5ff, 0.6).lineBetween(0, 200, W, 200);
    g.lineStyle(8, 0x00e5ff, 0.12).lineBetween(0, 202, W, 202);
    const t1 = scene.add.text(W / 2, 92, title, S(56, '#ffffff')).setOrigin(0.5).setShadow(0, 0, '#00e5ff', 16, false, true).setDepth(51);
    const t2 = scene.add.text(W / 2, 152, en, S(22, '#00e5ff', 0, 'normal')).setOrigin(0.5).setLetterSpacing(8).setDepth(51);
    const back = button(scene, { x: 30, y: 50, w: 150, h: 100 }, '◀', '', 0x00e5ff, onBack, { size: 44 }).setDepth(52);
    return { g, t1, t2, back };
  }

  // 화면 아래에서 떠올랐다 사라지는 짧은 알림
  function toast(scene, text, color, y) {
    const S = RD.util.textStyle;
    const t = scene.add.text(RD.W / 2, y || 1700, text, S(34, color || '#ffffff', 6)).setOrigin(0.5).setDepth(300);
    scene.tweens.add({ targets: t, y: t.y - 60, alpha: 0, delay: 1100, duration: 500, onComplete: () => t.destroy() });
    return t;
  }

  return { button, background, header, toast, hexStr };
})();

/* =====================================================================
 * 팝업 창 (브라우저 기본 confirm/prompt 대신 게임 화면 안에 그림)
 *  RD.Modal.open(scene, { h, color, build(c, top, close) })  : 빈 패널 (가운데 정렬, 높이 h)
 *  RD.Modal.confirm(scene, { title, text, ok, cancel, onOk, onCancel, okColor })
 *  열려 있는 동안 scene.modal / scene.rdModal 이 설정됨 → 아래 버튼은 눌리지 않고, 뒤로가기는 창을 닫음
 * ===================================================================== */
RD.Modal = {
  open(scene, o) {
    if (scene.rdModal) scene.rdModal.close();
    const W = RD.W, H = RD.H, D = 500, h = o.h || 700, top = Math.round(H / 2 - h / 2);
    const c = scene.add.container(0, 0).setDepth(D);
    const dim = scene.add.rectangle(0, 0, W, H, 0x02010a, 0.86).setOrigin(0).setInteractive();
    const g = scene.add.graphics();
    g.fillStyle(0x0b0f24, 0.98).fillRect(80, top, W - 160, h);
    g.lineStyle(10, o.color || 0x00e5ff, 0.15).strokeRect(76, top - 4, W - 152, h + 8);
    g.lineStyle(4, o.color || 0x00e5ff, 1).strokeRect(80, top, W - 160, h);
    c.add([dim, g]);
    const prev = scene.modal;
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      c.destroy();
      scene.rdModal = null;
      // 같은 터치로 아래 버튼이 눌리지 않게 한 틱 뒤에 해제
      scene.time.delayedCall(0, () => { if (scene.modal === c) scene.modal = prev || null; });
      if (o.onClose) o.onClose();
    };
    c.close = close;
    c.once('destroy', () => { if (!closed) { closed = true; scene.rdModal = null; if (scene.modal === c) scene.modal = prev || null; } });
    scene.modal = c;
    scene.rdModal = c;
    o.build(c, top, close);
    return c;
  },
  // 버튼 (팝업 안에서도 눌리도록 modal: true)
  button(scene, c, r, label, color, fn, size) {
    RD.Neon.button(scene, r, label, '', color, fn, { size: size || 40, modal: true, backing: true }).addTo(c);
  },
  confirm(scene, o) {
    const S = RD.util.textStyle, W = RD.W;
    const lines = (o.text || '').split('\n').length;
    const h = 330 + lines * 46;
    return RD.Modal.open(scene, { h, color: o.okColor || 0x00e5ff, build: (c, top, close) => {
      c.add(scene.add.text(W / 2, top + 80, o.title || '확인', S(50, '#ffffff')).setOrigin(0.5).setShadow(0, 0, '#00e5ff', 14, false, true));
      c.add(scene.add.text(W / 2, top + 140, o.text || '', S(30, '#c9d4ea', 0, 'normal')).setOrigin(0.5, 0).setAlign('center').setLineSpacing(12));
      const by = top + h - 150;
      RD.Modal.button(scene, c, { x: 130, y: by, w: 390, h: 110 }, o.cancel || '취소', 0x7fa8c9, () => { close(); if (o.onCancel) o.onCancel(); });
      RD.Modal.button(scene, c, { x: 560, y: by, w: 390, h: 110 }, o.ok || '확인', o.okColor || 0x00e5ff, () => { close(); if (o.onOk) o.onOk(); });
    } });
  },
};

/* 설정: 배경 음악 · 효과음 · 진동 켜기/끄기 + 게임 방법 (타이틀 · 로비 · 일시정지에서 열기) */
RD.SettingsUI = {
  open(scene, opts) {
    opts = opts || {};
    const S = RD.util.textStyle, W = RD.W;
    const rows = [['bgm', '배경 음악', 'BGM'], ['sfx', '효과음', 'SOUND EFFECTS'], ['haptic', '진동', 'HAPTICS']];
    const h = 1080;
    return RD.Modal.open(scene, { h, color: 0x00e5ff, onClose: opts.onClose, build: (c, top, close) => {
      c.add(scene.add.text(W / 2, top + 90, '설정', S(60, '#ffffff')).setOrigin(0.5).setShadow(0, 0, '#00e5ff', 16, false, true));
      c.add(scene.add.text(W / 2, top + 150, 'SETTINGS', S(22, '#00e5ff', 0, 'normal')).setOrigin(0.5).setLetterSpacing(8));
      rows.forEach(([k, name, en], i) => {
        const y = top + 260 + i * 160;
        c.add(scene.add.text(140, y + 30, name, S(44, '#ffffff')).setOrigin(0, 0.5));
        c.add(scene.add.text(142, y + 80, en, S(20, '#7fa8c9', 0, 'normal')).setOrigin(0, 0.5).setLetterSpacing(4));
        const label = () => RD.Settings.get(k) ? 'ON' : 'OFF';
        const color = () => RD.Settings.get(k) ? 0x7dffb0 : 0x4d5b78;
        const b = RD.Neon.button(scene, { x: 660, y, w: 260, h: 110 }, label(), '', color(), () => {
          RD.Settings.set(k, !RD.Settings.get(k));
          b.setLabel(label()).setColor(color());
          if (k === 'haptic') RD.Platform.haptic('tap');
        }, { size: 44, modal: true, backing: true });
        b.addTo(c);
      });
      RD.Modal.button(scene, c, { x: 190, y: top + 760, w: 700, h: 110 }, '게임 방법', 0x7c4dff, () => { close(); RD.HelpUI.open(scene); });
      RD.Modal.button(scene, c, { x: 340, y: top + h - 160, w: 400, h: 110 }, '닫기', 0xff2bd6, close);
    } });
  },
};

/* 게임 방법 (첫 다이브 때 자동으로 한 번 + 설정에서 다시 보기) */
RD.HelpUI = {
  LINES: [
    ['소환', '골드로 인류의 유산(유닛)을 무작위 소환합니다. 꾹 누르면 연속 소환'],
    ['조합', '같은 유닛 3개 → 다음 레벨 (어떤 유닛이 될지는 매번 무작위)'],
    ['배치', '유닛을 끌어서 옮기거나 자리를 바꿀 수 있습니다'],
    ['상성', '워리어→기동형 · 아처→장갑형 · 위저드→데이터형에 강함'],
    ['강화', '광물로 타입 강화, 골드로 채굴 강화 (나눠 쓰는 게 핵심)'],
    ['패배', '전장의 적이 한도에 차거나 보스를 제한 시간 안에 못 잡으면 종료'],
  ],
  open(scene, opts) {
    opts = opts || {};
    const S = RD.util.textStyle, W = RD.W, L = RD.HelpUI.LINES;
    const h = 380 + L.length * 128;
    return RD.Modal.open(scene, { h, color: 0x7c4dff, onClose: opts.onClose, build: (c, top, close) => {
      c.add(scene.add.text(W / 2, top + 90, '게임 방법', S(58, '#ffffff')).setOrigin(0.5).setShadow(0, 0, '#7c4dff', 16, false, true));
      c.add(scene.add.text(W / 2, top + 150, 'HOW TO PLAY', S(22, '#b39dff', 0, 'normal')).setOrigin(0.5).setLetterSpacing(8));
      L.forEach(([k, v], i) => {
        const y = top + 250 + i * 128;
        const g = scene.add.graphics();
        g.lineStyle(3, 0x00e5ff, 1).strokeRect(120, y - 32, 130, 64);
        c.add(g);
        c.add(scene.add.text(185, y, k, S(32, '#00e5ff')).setOrigin(0.5));
        c.add(scene.add.text(280, y, v, S(28, '#e6ecff', 0, 'normal')).setOrigin(0, 0.5).setWordWrapWidth(680, true).setLineSpacing(6));
      });
      RD.Modal.button(scene, c, { x: 290, y: top + h - 150, w: 500, h: 110 }, opts.okLabel || '확인', 0x00e5ff, close);
    } });
  },
};

/* 백업 코드 UI (타이틀 메뉴 · 로비 [백업] 공용). 저장 형식은 RD.Save.exportString / importString
 *  코드 상자는 HTML 입력창(길게 눌러 복사 / 붙여넣기)이라 클립보드 권한이 필요 없음
 *  copy: 코드 표시 + [복사] (브라우저가 허용하면 바로 복사)
 *  load(scene, y, skipConfirm, onDone): 코드 입력 → 덮어쓰기 확인 → 복원 성공 시 onDone() */
RD.BackupUI = {
  // 화면 위에 HTML 상자를 띄움. 반환: 닫기 함수
  box(o) {
    const wrap = document.createElement('div');
    wrap.className = 'rd-box';
    wrap.innerHTML = `<div class="rd-box-panel"><div class="rd-box-title"></div><div class="rd-box-desc"></div>
      <textarea spellcheck="false" autocomplete="off" autocapitalize="off"></textarea>
      <div class="rd-box-btns"><button class="rd-cancel"></button><button class="rd-ok"></button></div></div>`;
    wrap.querySelector('.rd-box-title').textContent = o.title;
    wrap.querySelector('.rd-box-desc').textContent = o.desc;
    const ta = wrap.querySelector('textarea');
    ta.value = o.value || '';
    ta.readOnly = !!o.readOnly;
    ta.placeholder = o.placeholder || '';
    const okB = wrap.querySelector('.rd-ok'), noB = wrap.querySelector('.rd-cancel');
    okB.textContent = o.ok; noB.textContent = o.cancel || '닫기';
    const close = () => { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); if (RD.game) RD.game.input.enabled = true; };
    okB.onclick = () => o.onOk(ta.value, close, ta);
    noB.onclick = close;
    ['pointerdown', 'touchstart', 'touchend', 'mousedown'].forEach(ev => wrap.addEventListener(ev, e => e.stopPropagation()));
    document.body.appendChild(wrap);
    if (RD.game) RD.game.input.enabled = false;
    if (o.readOnly) setTimeout(() => { ta.focus(); ta.select(); }, 50);
    RD.BackupUI.closeBox = close;
    return close;
  },
  copy(scene, y) {
    const code = RD.Save.exportString();
    RD.BackupUI.box({
      title: '백업 코드', desc: '아래 코드를 복사해 메모장이나 메신저에 보관하세요. 기기를 바꾸거나 데이터가 지워졌을 때 [게임 불러오기]로 복원됩니다.',
      value: code, readOnly: true, ok: '복사',
      onOk: (v, close, ta) => {
        const done = () => { close(); RD.Neon.toast(scene, '복사 완료! 안전한 곳에 붙여넣어 보관하세요', '#7dffb0', y); };
        const manual = () => { ta.focus(); ta.select(); ta.setSelectionRange(0, v.length); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } if (ok) done(); };
        try { if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(v).then(done, manual); else manual(); } catch (e) { manual(); }
      },
    });
  },
  load(scene, y, skipConfirm, onDone) {
    RD.BackupUI.box({
      title: '게임 불러오기', desc: '보관해 둔 백업 코드(PA1- 로 시작)를 붙여넣으세요.', placeholder: 'PA1-...', ok: '불러오기', cancel: '취소',
      onOk: (code, close) => {
        if (!code.trim()) return;
        close();
        const apply = () => {
          try { RD.Save.importString(code); } catch (e) { RD.Neon.toast(scene, `불러오기 실패: ${e.message}`, '#ff8a80', y); return; }
          if (onDone) onDone();
        };
        if (skipConfirm) apply();
        else RD.Modal.confirm(scene, { title: '덮어쓰기 확인', text: '지금 데이터를 코드의 데이터로 덮어씁니다.\n계속할까요?', ok: '덮어쓰기', okColor: 0xffc935, onOk: apply });
      },
    });
  },
  // 진행한 기록이 있는지 (새 게임 시 덮어쓰기 경고용)
  hasProgress() {
    const d = RD.Save.data;
    return d.stats.runs > 0 || d.meta.opened > 0 || d.meta.fragments > 0 || d.codex.seen.length > 0;
  },
};
