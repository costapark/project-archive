/* =====================================================================
 * 플레이 통계 (테스터용): 누가 몇 번 다이브했고, 어디까지 갔고, 어디서 그만뒀는지
 *  - 익명 플레이어 ID (기기에 저장, 개인 정보 없음) + 선택 닉네임 (주소 뒤 ?n=이름 으로 들어오면 기억)
 *  - 보내는 이벤트: open(접속) · title(로딩 끝) · lobby(로비 진입) · start(다이브 시작) · round(10 스테이지마다) · leave(다이브 중 앱 이탈)
 *    · back(다시 돌아옴) · end(게임 오버 / 다이브 중단) · abandon(이탈한 다이브를 다음 접속 때 마감)
 *  - 받는 곳: 구글 시트 + Apps Script 웹 앱 (tools/stats_sheet.gs). ENDPOINT 가 비어 있으면 아무것도 보내지 않음
 *  - 전송은 sendBeacon (텍스트 한 줄, 응답을 기다리지 않음) → 게임 성능에 영향 없음
 * ===================================================================== */
window.RD = window.RD || {};

RD.Telemetry = (() => {
  // ▼ 구글 시트 Apps Script 배포 후 받은 웹 앱 URL 을 여기에 붙여 넣기 (https://script.google.com/macros/s/.../exec)
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxyqtcVpVlubSmnlomwP0rWZv5b3ez4HMRAZztCOjsgnzB_RLvYy8LLfTRSj3WHXF0BCA/exec';

  const store = (() => { try { return localStorage; } catch (e) { return null; } })();
  const get = k => { try { return store && store.getItem(k); } catch (e) { return null; } };
  const set = (k, v) => { try { store && (v == null ? store.removeItem(k) : store.setItem(k, v)); } catch (e) { /* 저장 불가 환경 */ } };
  const rid = n => Array.from({ length: n }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');

  let pid = get('pa_pid');
  if (!pid) { pid = rid(6); set('pa_pid', pid); }
  try {
    const n = new URLSearchParams(location.search).get('n');
    if (n) set('pa_nick', n.slice(0, 20));
  } catch (e) { /* 무시 */ }
  const nick = get('pa_nick') || '';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const device = /iPhone|iPad|iPod/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : 'PC';
  // 링크 미리보기·검색 로봇·자동화 브라우저는 보내지 않음
  const bot = /bot|crawl|spider|slurp|preview|scrap|facebookexternalhit|headless|lighthouse/i.test(ua) || (typeof navigator !== 'undefined' && navigator.webdriver);

  // 진행 중인 다이브 { id, diff, round, ms, since }: 플레이 시간은 화면을 보고 있던 시간만 (ms 누적 + 지금 보고 있으면 since 부터)
  let dive = null;
  const activeMs = () => dive.ms + (dive.since ? Date.now() - dive.since : 0);

  function send(ev, extra) {
    if (!ENDPOINT || bot) return;
    const body = JSON.stringify(Object.assign({ ev, pid, nick, device, t: Date.now() }, extra));
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body)) return;
      fetch(ENDPOINT, { method: 'POST', body, mode: 'no-cors', keepalive: true }).catch(() => {});
    } catch (e) { /* 통계 실패는 게임에 영향 없음 */ }
  }
  const diveInfo = () => ({ dive: dive.id, diff: dive.diff, round: dive.round, min: Math.round(activeMs() / 6000) / 10 });
  const remember = () => set('pa_tel_dive', dive ? JSON.stringify(Object.assign({}, dive, { ms: activeMs(), since: null })) : null);

  // 지난 접속에서 끝나지 않은 다이브 (앱을 닫음) → 그 라운드에서 이탈로 마감
  try {
    const old = JSON.parse(get('pa_tel_dive') || 'null');
    if (old && old.id) { dive = Object.assign({ ms: 0 }, old, { since: null }); send('abandon', diveInfo()); dive = null; remember(); }
  } catch (e) { set('pa_tel_dive', null); }
  // 접속 기록은 화면이 실제로 보일 때만 (백그라운드 미리 불러오기 제외)
  let opened = false;
  const sendOpen = () => { if (!opened && (typeof document === 'undefined' || document.visibilityState !== 'hidden')) { opened = true; send('open', {}); } };
  sendOpen();
  const seen = {};

  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
    sendOpen();
    if (!dive) return;
    const hidden = document.visibilityState === 'hidden';
    if (hidden && dive.since) { dive.ms = activeMs(); dive.since = null; remember(); }
    if (!hidden && !dive.since) dive.since = Date.now();
    send(hidden ? 'leave' : 'back', diveInfo());
  });

  return {
    pid,
    // 어느 화면까지 왔는지 (접속마다 한 번): title = 로딩 끝, lobby = 타이틀을 지나 로비 진입
    screen(name) {
      if (seen[name]) return;
      seen[name] = true;
      send(name, {});
    },
    diveStart(diff) {
      dive = { id: pid + '-' + rid(4), diff, round: 0, ms: 0, since: Date.now() };
      remember();
      send('start', diveInfo());
    },
    // 매 라운드 호출 (기기에만 기록, 10 스테이지마다 전송)
    round(r) {
      if (!dive || r === dive.round) return;
      const prev = dive.round;
      dive.round = r;
      remember();
      if (Math.floor(r / 10) > Math.floor(prev / 10)) send('round', diveInfo());
    },
    diveEnd(r, reason, aborted) {
      if (!dive) return;
      dive.round = r;
      send('end', Object.assign(diveInfo(), { result: aborted ? 'abort' : 'over', reason: reason || '' }));
      dive = null;
      remember();
    },
  };
})();
