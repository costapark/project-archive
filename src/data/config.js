/* 게임 설정 & 밸런스 공식 (바닐라 버전과 동일한 수치) */
window.RD = window.RD || {};

RD.VERSION = '1.0.0';       // 화면 아래 버전 표기 (앱인토스 번들을 올릴 때마다 올림)
RD.W = 1080;                // 논리 해상도 (9:16 세로)
RD.H = 1920;
RD.TEXT_RES = Math.min(2, Math.max(1, Math.ceil(window.devicePixelRatio || 1)));  // 텍스트 렌더 해상도 (선명도)
RD.FONT = "'Pretendard','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR','Noto Sans CJK KR','Gothic A1','Nanum Gothic',sans-serif";
RD.QUIT_REASON = '지휘관이 다이브를 중단했습니다';   // 일시정지 → 다이브 중단 시 게임 오버 사유 (통계에서 '중단'으로 구분)

RD.CONFIG = {
  enemyLimit: 80,        // 필드 위 적이 이 수에 도달하면 패배
  roundTime: 35,         // 라운드 길이(초)
  firstRoundDelay: 6,    // 게임 시작 후 1라운드까지 대기(초)
  bossEvery: 10,         // N 라운드마다 보스
  bossTime: 90,          // 보스 제한 시간(초)
  startGold: 100,       // 시작 골드 (처치 자원)
  startMineral: 0,      // 시작 광물 (채굴 자원)
  summonCost: 20,       // 소환 비용 (골드)
  spawnInterval: 0.6,    // 적 생성 간격(초)
  enemyBaseSpeed: 140,   // px/s
  mineMaxLevel: 30,      // 채굴 강화 최대 레벨
  showDamage: true,      // 데미지 숫자 표시
  maxFloats: 70,
};

// 배경 음악: 라운드(스테이지) 구간별 트랙. 구간 밖(121 라운드~)은 음악 없음
//  라운드 0(시작 대기)은 첫 구간 음악을 사용. base 는 build.js 가 dist 용으로 '../' 를 붙임
RD.BGM_BASE = RD.BGM_BASE || '';
RD.BGM_TRACKS = [
  { from: 1,  to: 15, url: 'assets/audio/bgm1_neon_velocity.mp3' },
  { from: 16, to: 30, url: 'assets/audio/bgm2_neon_velocity2.mp3' },
  { from: 31, to: 45, url: 'assets/audio/bgm3_last_hope.mp3' },
  { from: 46, to: 60, url: 'assets/audio/bgm4_last_hope4.mp3' },
  { from: 61, to: 80, url: 'assets/audio/bgm5_neon_game_loop5.mp3' },
  { from: 81, to: 99, url: 'assets/audio/bgm6_neon_game_loop6.mp3' },
  { from: 100, to: 120, url: 'assets/audio/bgm7_neon_game_loop7.mp3' },
];
// 타이틀 · 로비 음악: 두 곡을 번갈아 반복 (타이틀 → 로비로 넘어가도 끊기지 않고 이어짐)
RD.BGM_MENU = { list: ['assets/audio/menu1_neo_talk_lobby.mp3', 'assets/audio/menu2_neo_talk_lobby2.mp3'] };
RD.BGM_VOLUME = 0.5;
// 공격 효과음 전체 볼륨 (Web Audio, 0~1). 배경 음악이 잘 들리도록 낮게 유지
RD.SFX_VOLUME = 0.35;

/* ── 밸런스 공식 (라운드 r 기준) ─────────────────────────────────────────
 *  목표: 숙련 플레이어가 약 200 라운드까지 갈 수 있게. 숫자는 tools/balance_sim.js (실제 로직 + 숙련 봇)로 검증
 *   (봇 10판: 178~253R, 중앙값 약 224R → 사람은 200R 전후. 적 타입 상성(enemies.js) 포함)
 *  1) 유닛 가치: Lv.0 = 소환 1회 = summonCost(20) 골드. 일반 LvN = Lv.0 3^N 개 (Lv.3 = 540골드, Lv.5 = 4,860골드)
 *     히든 = 레시피 재료 가치의 합 (RD.unitValue). 판매 = 가치 × 20 × 환급률(Lv.0~2 50%, Lv.3 35%, Lv.4 25%, Lv.5 18%, 히든 Lv.6+ 15%)
 *     타입 변경 = 판매가의 절반 (Lv.2 50, Lv.3 90, Lv.4 200, Lv.5 440 골드)
 *  2) 골드 수입: 라운드당 약 60 + 20r (처치 40마리 × (1 + r/4) + 라운드 보상 20 + 10r)
 *     (60R 이후는 r 대신 BAL.goldRound(r) 로 계산해 증가 속도 절반)
 *     → 누적 약 10r² 골드 (100R ≈ 10만 = Lv.5 20개분, 200R ≈ 40만). 72칸이 Lv.5·히든으로 차는 시점이 200R 전후
 *  3) 적 체력: 그 라운드 숙련 봇의 총 DPS(기준 DPS) × 압박도 × 라운드 시간 ÷ 마릿수
 *     → 플레이어가 강해지는 속도(소환·조합·강화)와 같은 속도로 적이 단단해지고, 150R 이후 압박도가 올라가 200R 전후에서 막힘
 *  기준 DPS: 숙련 봇이 라운드 r 에 갖는 총 DPS (적 체력 1 로 6판 평균, 유효숫자 2자리) [라운드, DPS]
 *   사이 라운드는 로그 보간, 마지막 기준점(230R) 이후는 마지막 구간의 증가율로 연장 */
RD.DPS_REF = [[1, 34], [5, 170], [10, 750], [15, 2200], [20, 4800], [25, 11000], [30, 17000], [35, 29000], [40, 50000],
  [45, 100000], [50, 190000], [55, 400000], [60, 730000], [65, 1.2e6], [70, 1.8e6], [80, 3.2e6], [90, 5.5e6], [100, 8.3e6],
  [110, 1.2e7], [120, 1.7e7], [130, 2.1e7], [140, 2.7e7], [150, 3.5e7], [160, 4.3e7], [170, 4.8e7], [180, 6.2e7],
  [190, 6.8e7], [200, 7.4e7], [210, 8.0e7], [220, 8.6e7], [230, 9.2e7]];
RD.dpsRef = r => {
  const T = RD.DPS_REF, n = T.length;
  let i = 1;
  while (i < n - 1 && T[i][0] < r) i++;
  const [r0, d0] = T[i - 1], [r1, d1] = T[i];
  return d0 * Math.pow(d1 / d0, (r - r0) / (r1 - r0));
};
RD.BAL = {
  // 적 체력: 라운드 r 의 적 전체 체력(마릿수 × 체력)을 roundTime 초에 녹이려면 기준 DPS × 압박도가 필요하도록 맞춤
  enemyHp:    r => Math.max(10, Math.floor(RD.BAL.pressure(r) * RD.dpsRef(r) * RD.CONFIG.roundTime / RD.BAL.spawnCount(r))),
  // 압박도: 기준 DPS 대비 요구 DPS 비율. 0.35(~20R, 초반은 여유) → 0.8(35R) 유지 → 1.2(150R) → 이후 라운드당 ×1.012 (200R ≈ 2.2)
  //  봇은 압박도 약 1.3(초중반)~2(200R 전후)까지 버팀 → 사람 숙련자는 200R 전후에서 막히도록
  pressure:   r => (Math.min(0.8, Math.max(0.35, 0.35 + 0.03 * (r - 20))) + 0.4 * Math.min(1, Math.max(0, (r - 60) / 90))) * Math.pow(1.012, Math.max(0, r - 150)),
  spawnCount: r => 20 + Math.min(20, Math.floor(r / 2)),
  bossDiffShare: 0.5,   // 난이도 체력 배율 중 보스에 적용하는 비율 (보스는 단일 대상이라 그대로 올리면 운이 나쁜 판이 보스에서 일찍 막힘)
  bossHp:     r => RD.BAL.enemyHp(r) * 3,      // 보스는 단일 대상 + 90초 제한이라 일반 적 3마리분 (시뮬레이션상 일반 웨이브와 비슷한 난이도)
  // 골드 보상은 60R 까지 라운드에 비례해 늘고, 그 뒤로는 증가 속도를 절반으로 줄임 (80R 이후 골드 과잉 방지)
  //  예) 처치 골드 60R 16, 100R 21 (원래 26), 160R 28 (원래 41)
  goldRound:  r => r <= 60 ? r : 60 + 0.5 * (r - 60),
  killGold:   r => 1 + Math.floor(RD.BAL.goldRound(r) / 4),
  roundGold:  r => Math.round(20 + 10 * RD.BAL.goldRound(r)),
  bossGold:   r => Math.round(100 + 40 * RD.BAL.goldRound(r)),
  upgradeCost: lv => 50 + 10 * lv,          // 타입 강화 비용 (광물) 50, 60, 70 …
  mineRate:    lv => 2 + 1.5 * lv,          // 초당 광물 채굴량
  // 채굴 강화 비용 (골드): 80, 99, 123 … 레벨마다 ×1.24 (Lv.10 ≈ 690, Lv.20 ≈ 5,900). 채굴량은 레벨당 +1.5/초로 일정해서 높은 레벨일수록 본전 뽑기가 오래 걸림
  //  → 채굴만 하면 유닛이 모자라 막히고, 유닛만 뽑으면 강화가 모자라 막힘. 시뮬레이션(노멀 16판 중앙값): 채굴 안 함 68 / 유닛 먼저 106 / Lv.6 125 / Lv.10 144 / Lv.14 139 / Lv.20 162 / 채굴 최우선 144
  mineCost:    lv => Math.round(80 * Math.pow(1.24, lv)),
  // 히든 강화 (광물): 300, 390, 510 … 레벨마다 ×1.3 으로 가파르게 오르는 대신 히든 유닛 공격력 +25%/레벨
  hiddenUpgradeCost: lv => Math.round(300 * Math.pow(1.3, lv) / 10) * 10,
  hiddenMult:  lv => 1 + 0.25 * lv,         // 히든 유닛 공격력 배율 (타입 강화와 별도로 곱해짐)
};

/* ── 난이도 ──
 *  hpMult(r): 적·보스 체력에 곱하는 배율. 보상(골드·광물)은 모든 난이도 같음
 *  이지 = 위 기본 밸런스 그대로. 노멀/하드는 초반은 조금만, 라운드가 갈수록 크게 단단해짐
 *   (초반부터 크게 올리면 Lv.4·5 가 나오기 전인 40R 무렵에 막혀 버려서, 라운드에 비례해 올림)
 *  적 체력은 라운드만으로 정해지는 고정 곡선 (플레이어 보드와 무관) → 운·실력으로 DPS 를 더 뽑으면 그만큼 더 감
 *  검증: DIFF=easy|normal|hard BOT=sloppy|avg|skilled node tools/balance_sim.js 12 400 (12판씩, 도달 라운드 중앙값 [범위])
 *   기본 봇(채굴 Lv.12 까지 먼저, 판매·레시피 사용) 16판 중앙값 [범위]: 이지 217 [178~253], 노멀 143, 하드 117 [97~153]
 *   잘하는 봇 노멀 154, 판매·레시피를 안 쓰는 봇 노멀 55, 채굴 강화를 안 하면 노멀 68 (60R 이후 골드 증가 완화 반영)
 *   사람은 봇보다 느리므로 노멀 ~140R, 하드 ~90R 전후가 목표. 같은 봇도 운에 따라 100R 이상 차이남
 *  난이도를 추가하려면 여기에 항목을 넣고 DIFF_KEYS 에 키를 추가 */
RD.DIFFICULTIES = {
  easy:   { name: '이지', color: '#69f0ae', desc: '여유롭게 진행', hpMult: r => 1 },
  normal: { name: '노멀', color: '#ffd54f', desc: '표준 난이도',   hpMult: r => 1 + 0.008 * Math.max(0, r - 20) },
  hard:   { name: '하드', color: '#ff5252', desc: '숙련자용',      hpMult: r => 1.05 + 0.015 * Math.max(0, r - 20) },
};
RD.DIFF_KEYS = ['easy', 'normal', 'hard'];
// 선택한 난이도 (판을 넘어 유지: RD.Save 저장 데이터. 저장이 막힌 환경에서는 그 세션에서만 유지)
RD.Difficulty = {
  get() { const k = RD.Save && RD.Save.data.difficulty; return RD.DIFFICULTIES[k] ? k : 'normal'; },
  set(k) { if (!RD.DIFFICULTIES[k] || !RD.Save) return; RD.Save.data.difficulty = k; RD.Save.save(); },
};

/* 자원 종류. 재화가 늘어나면 여기에 추가하고 GameLogic.canAfford / spend 로 다룬다.
 *  gold    : 적 처치·라운드 보상으로 획득 → 유닛 소환, 채굴 강화, 타입 변경
 *  mineral : 시간에 따라 자동 채굴 → 타입(워리어/아처/위저드) 강화, 히든 강화 */
RD.CURRENCIES = {
  gold:    { name: '골드', josa: '가', color: '#ffd54f', icon: 'coin' },
  mineral: { name: '광물', josa: '이', color: '#80d8ff', icon: 'mineral' },
};
// 행동별 사용 자원 (밸런스 조정 시 여기만 바꾸면 됨)
RD.COST_CURRENCY = { summon: 'gold', unitUpgrade: 'mineral', mineUpgrade: 'gold', typeChange: 'gold', hiddenUpgrade: 'mineral' };
