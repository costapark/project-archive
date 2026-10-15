/* =====================================================================
 * 저장 시스템 (localStorage 한 키에 JSON 하나)
 *  - 버전이 붙은 저장 객체: 구조를 바꿀 때는 VERSION 을 올리고 MIGRATE 에 이전 버전 → 다음 버전 변환을 추가
 *    (100+ 스테이지 체크포인트, 추가 영구 강화 등은 새 필드를 넣고 fresh() 에 기본값만 추가하면 됨: load 시 기본값과 병합)
 *  - 저장이 막힌 환경(시크릿 모드, node 시뮬레이터)에서는 메모리에만 두고 그 세션 동안 동작
 *  - 이전 버전의 개별 키(rd_difficulty_v1, rd_codex_v1)는 처음 불러올 때 가져옴
 *  - 앱인토스(토스 앱 안): RD.Platform 이 사용자 식별키로 키를 바꾸고(attach) 토스 저장소에도 같이 저장
 * ===================================================================== */
window.RD = window.RD || {};

RD.Save = (() => {
  let KEY = 'pa_save';
  const VERSION = 1;
  let persist = null;                    // 저장할 때 같이 부를 함수 (토스 저장소, RD.Platform)
  const store = (() => { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; } })();

  const fresh = () => ({
    v: VERSION,
    difficulty: 'normal',
    codex: { seen: [], made: [] },       // 레시피 도감 (유닛 id)
    meta: {
      fragments: 0,                      // 보유 기억 파편
      totalFragments: 0,                 // 누적 획득
      opened: 0,                         // 연 메모리 캡슐 수
      pity: 0,                           // 유니크 이상이 안 나온 연속 횟수
      cards: {},                         // { 카드 id: 획득 장수 }
      equip: [null, null, null],         // 싱크 슬롯 (카드 id)
    },
    // 기록 (best: { 난이도 키: 최고 라운드 }). 업적 진행도는 여기서 계산 (src/data/achievements.js)
    stats: { runs: 0, best: {}, last: null, kills: 0, bossKills: 0, bestKills: 0, playTime: 0, topGrade: 0 },
    ach: { claimed: [], seen: [] },      // 업적: 보상 받은 id / 달성 알림을 띄운 id
    settings: { bgm: true, sfx: true, haptic: true, help: false },   // 소리 · 진동 켜기, 게임 방법을 본 적 있는지
  });

  // 기본값 위에 저장값을 덮어씀 (새 필드가 추가돼도 옛 저장이 깨지지 않게)
  function merge(base, saved) {
    if (!saved || typeof saved !== 'object' || Array.isArray(base)) return saved === undefined ? base : saved;
    const out = Object.assign({}, base);
    for (const k in saved) out[k] = (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) ? merge(base[k], saved[k]) : saved[k];
    return out;
  }

  // 버전별 변환: MIGRATE[n] = n → n+1
  const MIGRATE = {
    0: d => {                            // 개별 키 시절 → v1
      const out = fresh();
      try {
        const diff = store && store.getItem('rd_difficulty_v1');
        if (diff) out.difficulty = diff;
        const cx = JSON.parse((store && store.getItem('rd_codex_v1')) || '{}');
        out.codex = { seen: cx.seen || [], made: cx.made || [] };
      } catch (e) { /* 무시 */ }
      return out;
    },
  };

  let data = null;
  // 백업 코드 체크섬 (오타·잘림 감지용, 보안 목적 아님)
  function checksum(str) { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 1679616; return h.toString(36).padStart(4, '0'); }
  function load(raw) {
    let d = null;
    try { d = JSON.parse(raw !== undefined ? raw : ((store && store.getItem(KEY)) || 'null')); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') d = { v: 0 };
    for (let v = d.v || 0; v < VERSION; v++) if (MIGRATE[v]) d = MIGRATE[v](d);
    d.v = VERSION;
    data = merge(fresh(), d);
    if (!Array.isArray(data.meta.equip)) data.meta.equip = [];
    while (data.meta.equip.length < (RD.META ? RD.META.slots : 3)) data.meta.equip.push(null);
    return data;
  }
  function save() {
    if (!data) return false;
    const str = JSON.stringify(data);
    if (persist) persist(KEY, str);
    if (!store) return !!persist;
    try { store.setItem(KEY, str); return true; } catch (e) { return !!persist; }
  }
  load();

  return {
    get data() { return data; },
    save,
    load,
    // 모든 진행 초기화 (새 게임 / 콘솔에서 RD.Save.reset()). 소리 · 진동 설정은 유지
    reset() { const st = data && data.settings; data = fresh(); if (st) data.settings = st; save(); return data; },
    // 저장 위치 변경 (토스: 'pa_save:<사용자 식별키>'). external = 토스 저장소에서 읽은 값(문자열, 없으면 null)
    //  우선순위: 토스 저장소 → 이 기기의 같은 키 → 처음이면 새 데이터. 바꾼 뒤 양쪽에 한 번 저장
    attach(key, external, persistFn) {
      KEY = key; persist = persistFn || null;
      let local = null;
      try { local = store && (store.getItem(KEY) || store.getItem('pa_save:guest')); } catch (e) { local = null; }
      load(external || local || 'null');
      save();
      if (RD.Settings) RD.Settings.apply();
      return data;
    },
    get key() { return KEY; },
    // 백업 코드: 'PA1-' + 체크섬 4자리 + '-' + base64(JSON). 로비 [백업] 에서 복사 / 붙여넣기
    exportString() {
      const body = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
      return `PA1-${checksum(body)}-${body}`;
    },
    // 코드 검사 후 저장 데이터를 통째로 교체. 잘못된 코드면 Error (메시지는 화면에 그대로 표시)
    importString(code) {
      const m = String(code || '').replace(/\s+/g, '').match(/^PA1-([0-9a-z]{4})-([A-Za-z0-9+/=]+)$/);
      if (!m) throw new Error('백업 코드 형식이 아닙니다');
      if (checksum(m[2]) !== m[1]) throw new Error('코드가 일부 잘렸거나 바뀌었습니다');
      let d;
      try { d = JSON.parse(decodeURIComponent(escape(atob(m[2])))); } catch (e) { throw new Error('코드를 읽을 수 없습니다'); }
      if (!d || typeof d !== 'object' || !d.meta || !d.stats) throw new Error('프로젝트 아카이브 저장 데이터가 아닙니다');
      const st = data && data.settings;
      load(JSON.stringify(d));
      if (st) data.settings = st;          // 소리 · 진동 설정은 이 기기 설정 유지
      save();
      return data;
    },
    VERSION,
  };
})();

/* 설정 (저장 데이터 settings 에 보관): 배경 음악 · 효과음 · 진동 */
RD.Settings = {
  get(k) { const s = RD.Save.data.settings || {}; return s[k] !== false; },
  set(k, v) { RD.Save.data.settings[k] = !!v; RD.Save.save(); RD.Settings.apply(); },
  apply() {
    if (RD.BGM && RD.BGM.setMuted) RD.BGM.setMuted(!RD.Settings.get('bgm'));
    if (RD.SFX && RD.SFX.setMuted) RD.SFX.setMuted(!RD.Settings.get('sfx'));
  },
};
