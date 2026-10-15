/* =====================================================================
 * 배경 음악 (HTML5 Audio 1개를 재사용).  Phaser 오디오는 꺼져 있음(main.js noAudio).
 *  - 라운드 구간(RD.BGM_TRACKS)에 맞는 트랙을 반복 재생, 구간이 바뀌면 페이드 전환
 *  - 타이틀 · 로비는 RD.BGM_MENU 의 곡들을 번갈아 재생 (menu())
 *  - 특별 보스(RD.SPECIAL_BOSSES)가 살아 있는 동안은 그 보스 곡 (setRound 의 override)
 *  - playOnce(url): 이벤트 곡을 한 번만 틀고, 끝나면 원래 곡으로 돌아감 (레거시 첫 획득 연출)
 *  - 일시정지 / 게임 오버 / 탭 숨김(앱 백그라운드) 시 바로 멈추고, 돌아오면 다시 재생
 *  - 설정에서 배경 음악을 끄면(setMuted) 재생 자체를 멈춤
 *  - 모바일 자동재생 제한: 첫 터치(다이브 버튼 등) 안에서 play() 해야 하므로
 *    play 가 거부되면 다음 터치 때 다시 시도
 *  - 웹 주소로 열었을 때는 효과음과 같은 Web Audio 마스터(리미터)로 보내 볼륨을 GainNode 로 조절
 *    (아이폰은 audio.volume 을 무시해서 항상 최대 음량으로 나오고, 효과음과 따로 나가면 겹칠 때 찢어짐)
 *    파일로 직접 연 빌드(file://)는 Web Audio 로 보내면 무음이 되므로 예전처럼 audio.volume 사용
 * ===================================================================== */
window.RD = window.RD || {};

RD.BGM = (() => {
  const FADE = 0.8;                 // 페이드 시간(초)
  let el = null, cur = null, want = null, paused = false, muted = false, vol = 0, fadeTimer = null, blocked = false;
  let gain = null;                  // Web Audio 경로일 때 볼륨 노드
  let listIdx = 0;                  // 플레이리스트(타이틀 · 로비 음악)에서 지금 곡 번호
  let once = null, base = null;     // 한 번만 트는 이벤트 곡 / 그동안 원래 나와야 할 곡

  function audio() {
    if (!el) {
      el = new Audio();
      el.loop = true;
      el.preload = 'auto';
      el.volume = 0;
      // 플레이리스트는 한 곡이 끝나면 다음 곡으로 (단일 트랙은 loop 로 반복)
      const endOnce = () => { if (cur && cur.once) { once = null; want = base; apply(); } };
      el.addEventListener('error', () => { if (cur && cur.once) endOnce(); });
      el.addEventListener('ended', () => {
        if (cur && cur.once) return endOnce();
        if (!cur || !cur.list) return;
        listIdx = (listIdx + 1) % cur.list.length;
        el.src = (RD.BGM_BASE || '') + cur.list[listIdx];
        if (!off()) tryPlay();
      });
      routeToMaster();
    }
    return el;
  }
  function routeToMaster() {
    if (!/^https?:$/.test(location.protocol) || !RD.SFX || !RD.SFX.musicBus) return;
    try {
      const bus = RD.SFX.musicBus();
      if (!bus) return;
      const ctx = bus.context;
      const g = ctx.createGain();
      g.gain.value = 0;
      ctx.createMediaElementSource(el).connect(g);
      g.connect(bus);
      gain = g;
      el.volume = 1;
    } catch (e) { gain = null; el.volume = 0; console.warn('[RD] 배경 음악을 Web Audio 로 연결하지 못해 기본 재생을 씁니다:', e); }
  }
  function setVol(v) {
    v = Math.max(0, Math.min(1, v));
    if (gain) { const t = gain.context.currentTime; gain.gain.cancelScheduledValues(t); gain.gain.setValueAtTime(v, t); }
    else el.volume = v;
  }
  const off = () => paused || muted || document.hidden;
  function trackFor(round) {
    const r = Math.max(1, round);
    return RD.BGM_TRACKS.find(t => r >= t.from && r <= t.to) || null;
  }
  const overrides = {};
  function overrideTrack(url) { return overrides[url] || (overrides[url] = { url }); }
  function tryPlay() {
    const a = audio();
    if (gain && gain.context.state !== 'running' && !document.hidden) gain.context.resume().catch(() => {});
    const p = a.play();
    if (p && p.catch) p.then(() => { blocked = false; }, () => { blocked = true; });
  }
  // 목표 볼륨으로 서서히 (to=0 이면 끝난 뒤 done 호출)
  function fadeTo(to, done) {
    clearInterval(fadeTimer); clearTimeout(fadeTimer);
    if (gain) {                     // Web Audio: 오디오 시계로 부드럽게 (타이머가 느려져도 소리는 정확)
      const g = gain.gain, t = gain.context.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(to, t + FADE);
      vol = to;
      fadeTimer = setTimeout(() => { fadeTimer = null; if (done) done(); }, FADE * 1000);
      return;
    }
    const a = audio(), from = vol, steps = Math.max(1, Math.round(FADE * 20));
    let i = 0;
    fadeTimer = setInterval(() => {
      i++;
      vol = from + (to - from) * (i / steps);
      setVol(vol);
      if (i >= steps) { clearInterval(fadeTimer); fadeTimer = null; if (done) done(); }
    }, 50);
  }
  function apply() {
    const a = audio();
    if (want !== cur) {
      const next = want;
      const swap = () => {
        cur = next;
        if (!next) { a.pause(); return; }
        a.loop = !next.list && !next.once;
        a.src = (RD.BGM_BASE || '') + (next.list ? next.list[listIdx % next.list.length] : next.url);
        a.currentTime = 0;
        if (!off()) { tryPlay(); fadeTo(RD.BGM_VOLUME); }
        if (want !== cur) apply();          // 페이드 도중 목표가 또 바뀐 경우
      };
      if (cur && !a.paused && vol > 0) fadeTo(0, swap); else { vol = 0; setVol(0); swap(); }
      return;
    }
    if (!cur) return;
    if (off()) { if (!a.paused) a.pause(); }
    else if (a.paused) { tryPlay(); fadeTo(RD.BGM_VOLUME); }
  }

  // 막혔던 재생을 다음 사용자 입력에서 재시도
  const unlock = () => { if (blocked && cur && !off()) tryPlay(); };
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, unlock, true));
  document.addEventListener('visibilitychange', () => {
    if (!el || !cur) return;
    if (document.hidden) el.pause(); else if (!off()) { tryPlay(); if (!gain) setVol(vol); }
  });

  return {
    // 라운드에 맞는 트랙으로 (같은 트랙이면 그대로 이어서 재생)
    // override: 특별 보스처럼 잠깐 다른 곡을 틀 때 그 곡 주소 (없어지면 라운드 곡으로 돌아감)
    setRound(round, override) {
      base = override ? overrideTrack(override) : trackFor(round);
      const t = once || base;
      if (t !== want) { want = t; apply(); }
    },
    setPaused(p) { if (p !== paused) { paused = p; apply(); } },
    setMuted(m) { m = !!m; if (m !== muted) { muted = m; apply(); } },
    get muted() { return muted; },
    // 다이브 버튼처럼 사용자 입력 안에서 호출 → 모바일에서도 재생 허용
    start(round) { paused = false; once = null; want = base = trackFor(round || 0); apply(); },
    stop() { once = null; want = null; apply(); },
    // 이벤트 곡 한 번 재생 → 끝나면 setRound 로 정해진 원래 곡으로
    playOnce(url) { once = { url, once: true }; want = once; apply(); },
    stopOnce() { if (once) { once = null; want = base; apply(); } },
    get onceActive() { return !!once; },
    // 타이틀 · 로비 음악 (이미 나오고 있으면 그대로 이어서). 들어올 때마다 다음 곡부터
    menu() {
      if (!RD.BGM_MENU) return;
      paused = false; once = null;
      if (want !== RD.BGM_MENU) { if (cur !== RD.BGM_MENU) listIdx = cur ? listIdx + 1 : 0; want = RD.BGM_MENU; }
      apply();
    },
    get trackUrl() { return cur ? (cur.list ? cur.list[listIdx % cur.list.length] : cur.url) : null; },
    get playing() { return !!el && !el.paused; },
  };
})();
