/* =====================================================================
 * 플랫폼 연결 (앱인토스 / 일반 브라우저)
 *  토스 앱 안에서 열리면(window.ReactNativeWebView) lib/ait-sdk.js 의 앱인토스 SDK 를 켜고:
 *   - 사용자 식별키(게임용 해시)를 받아 저장 데이터를 사용자별로 구분
 *   - 저장 데이터를 토스 앱 저장소(Storage)에도 보관 → 웹뷰 데이터가 지워져도 기록 유지
 *   - 안전 영역(노치 · 다이나믹 아일랜드 · 홈 바) + 상단 더보기/X 버튼 영역을 피해서 게임 화면 배치
 *   - 안드로이드 뒤로가기 → 열린 창 닫기 / 일시정지 / 이전 화면, 첫 화면에서는 종료 확인 창
 *   - 진동(햅틱), 다이브 중 화면 꺼짐 방지
 *  일반 브라우저에서는 SDK 를 실행하지 않고 CSS 안전 영역 + navigator.vibrate 만 사용
 *  SDK 호출은 모두 여기서만 하고, 실패하면 횟수 · 간격을 제한해 재시도한 뒤 기본 동작으로 넘어감
 * ===================================================================== */
window.RD = window.RD || {};

RD.Platform = (() => {
  let A = null;
  if (window.ReactNativeWebView && typeof window.RD_AIT_LOAD === 'function') {
    try { A = window.RD_AIT_LOAD(); } catch (e) { A = null; console.warn('[RD] 앱인토스 SDK 를 켜지 못했습니다:', e); }
  }
  const isToss = !!A;
  const NAV_H = 52;                 // 토스 게임 내비게이션 바(더보기 · X 버튼)를 피할 높이 (CSS px)
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const timeout = (p, ms, v) => Promise.race([p, sleep(ms).then(() => v)]);

  // ── 안전 영역: #game 의 위치를 CSS 변수로 지정 → Phaser FIT 이 그 안에 맞춰 그림 ──
  function applyInsets(ins) {
    const s = document.documentElement.style;
    if (ins) {
      s.setProperty('--rd-top', (ins.top || 0) + NAV_H + 'px');
      s.setProperty('--rd-bottom', (ins.bottom || 0) + 'px');
      s.setProperty('--rd-left', (ins.left || 0) + 'px');
      s.setProperty('--rd-right', (ins.right || 0) + 'px');
    }
    if (RD.game && RD.game.isBooted && RD.game.canvas) setTimeout(() => RD.game.scale.refresh(), 0);
  }

  // ── 사용자 식별키 (최대 3번, 0.8초 · 1.6초 간격) ──
  async function fetchUserKey() {
    const fn = A.getAnonymousKey || A.getUserKeyForGame;
    if (!fn) return null;
    for (let i = 0; i < 3; i++) {
      try {
        const r = await timeout(fn(), 3000, 'TIMEOUT');
        if (r && r.type === 'HASH' && r.hash) return r.hash;
        if (r === undefined) return null;          // 토스 앱 버전이 낮음 → 재시도해도 같음
      } catch (e) { console.warn('[RD] 사용자 식별키 오류:', e); }
      if (i < 2) await sleep(800 * (i + 1));
    }
    return null;
  }

  // ── 토스 저장소: 쓰기는 키마다 0.4초 모아서 한 번 (짧은 시간에 여러 번 저장해도 호출 1회), 실패하면 2초 뒤 1번만 재시도 ──
  const pending = {}, timers = {};
  function flush(key, retry) {
    timers[key] = null;
    const v = pending[key];
    delete pending[key];
    A.Storage.setItem(key, v).catch(e => {
      if (retry) return console.warn('[RD] 토스 저장소 저장 실패:', e);
      if (!(key in pending)) pending[key] = v;
      if (!timers[key]) timers[key] = setTimeout(() => flush(key, true), 2000);
    });
  }
  function persist(key, value) {
    if (!isToss || !A.Storage) return;
    pending[key] = value;
    if (!timers[key]) timers[key] = setTimeout(() => flush(key, false), 400);
  }
  function flushAll() { for (const k in timers) if (timers[k]) { clearTimeout(timers[k]); flush(k, false); } }
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushAll(); });

  // ── 시작 준비: 토스면 식별키 + 저장 데이터를 받아 RD.Save 에 연결 (최대 4초, 넘으면 있는 데이터로 시작) ──
  let userKey = null;
  async function prepare() {
    try { applyInsets(A.SafeArea.get()); A.SafeArea.subscribe({ onEvent: applyInsets }); } catch (e) { console.warn('[RD] 안전 영역 오류:', e); }
    try { A.graniteEvent.addEventListener('backEvent', { onEvent: () => handleBack(), onError: e => console.warn('[RD] 뒤로가기 이벤트 오류:', e) }); } catch (e) { console.warn(e); }
    userKey = await fetchUserKey();
    const key = 'pa_save:' + (userKey || 'guest');
    const get = async k => { try { return await timeout(A.Storage.getItem(k), 2500, null); } catch (e) { return null; } };
    let saved = await get(key);
    // 식별키를 못 받았던 접속(guest)에서 쌓은 기록이 있으면 이어받음
    if (!saved && userKey) saved = await get('pa_save:guest');
    RD.Save.attach(key, saved, persist);
  }
  function init() {
    if (!isToss) return Promise.resolve();
    return timeout(prepare().catch(e => console.warn('[RD] 앱인토스 준비 실패:', e)), 4000);
  }

  // ── 뒤로가기: 가장 위에 있는 씬부터 onBack() 을 물어보고, 아무도 처리하지 않으면 종료 확인 ──
  function handleBack() {
    const game = RD.game;
    if (!game) return;
    if (document.querySelector('.rd-box') && RD.BackupUI.closeBox) return RD.BackupUI.closeBox();   // 백업 코드 상자
    const scenes = game.scene.getScenes(true, true);
    for (const s of scenes) {
      if (s.rdModal) return s.rdModal.close();                                   // 팝업 창
      if (typeof s.onBack === 'function' && s.onBack()) return;
    }
    RD.ExitUI.confirm(scenes[0]);
  }

  // ── 진동: 설정에서 끌 수 있음. 같은 종류는 짧은 간격으로 겹치지 않게 ──
  const HAPTIC = {           // 종류 → [토스 햅틱 타입, 브라우저 진동 ms, 최소 간격 ms]
    tick:    ['tickWeak', 6, 90],
    tap:     ['tap', 12, 120],
    merge:   ['softMedium', 18, 150],
    success: ['success', [20, 40, 30], 400],
    heavy:   ['wiggle', 60, 500],
    error:   ['error', [40, 60, 80], 600],
  };
  const lastHaptic = {};
  function haptic(kind) {
    const h = HAPTIC[kind];
    if (!h || !RD.Settings || !RD.Settings.get('haptic') || document.hidden) return;
    const now = performance.now();
    if (now - (lastHaptic[kind] || -1e9) < h[2]) return;
    lastHaptic[kind] = now;
    if (isToss) { if (A.Device && A.Device.triggerHaptic) A.Device.triggerHaptic({ type: h[0] }).catch(() => {}); }
    else if (navigator.vibrate) { try { navigator.vibrate(h[1]); } catch (e) { /* 무시 */ } }
  }

  // ── 다이브 중 화면 꺼짐 방지 (바뀔 때만 호출) ──
  let awake = false;
  function setAwake(on) {
    if (!isToss || on === awake || !A.Screen || !A.Screen.setAwakeMode) return;
    awake = on;
    A.Screen.setAwakeMode({ enabled: on }).catch(() => {});
  }

  function close() {
    if (isToss && A.Screen && A.Screen.close) return A.Screen.close().catch(() => {});
    try { window.close(); } catch (e) { /* 무시 */ }
  }

  return {
    get isToss() { return isToss; },
    get userKey() { return userKey; },
    get os() { try { return isToss ? A.getPlatformOS() : null; } catch (e) { return null; } },
    init, persist, haptic, setAwake, close, handleBack, applyInsets,
  };
})();

/* 종료 확인 창 (토스: 뒤로가기를 첫 화면에서 눌렀을 때). [종료] → 미니앱 닫기 */
RD.ExitUI = {
  confirm(scene) {
    if (!scene || !RD.Platform.isToss) return;
    RD.Modal.confirm(scene, {
      title: '게임 종료',
      text: '프로젝트 아카이브를 종료할까요?\n기록은 자동으로 저장되어 있습니다.',
      ok: '종료', cancel: '계속하기', okColor: 0xff2bd6,
      onOk: () => RD.Platform.close(),
    });
  },
};
