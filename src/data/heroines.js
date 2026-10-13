/* =====================================================================
 * 메모리 카드 데이터 (영구 강화 / 수집)
 *  설정: 지휘관은 무리한 딥다이브와 네메시스의 정신 공격으로 기억을 잃었다. 시스템과 싸울 때마다
 *        '기억 파편'을 회수하고, 파편을 모아 '메모리 캡슐'을 해독하면 봉인된 메모리(인류의 핵심 기억) 카드가 복원된다.
 *
 *  카드를 추가하려면 RD.HEROINES 에 항목만 넣으면 된다 (갤러리·캡슐·버프 계산이 자동으로 따라옴)
 *   id      : 고유 키 (저장 데이터에 쓰이므로 한 번 정하면 바꾸지 말 것)
 *   name    : 이름, title: 칭호, grade: RD.CARD_GRADES 키
 *   fx      : 능력 [[스탯 키, 비율], ...]. 실제 수치 = 스탯 기본값 × 등급 배율 × 비율 × 레벨 배율 (RD.Meta.cardEffects)
 *   lore    : 한 줄 설정
 *   art     : 일러스트 키 (아직 없음 → 등급 색 플레이스홀더). 나중에 이미지를 붙일 때:
 *             이미지는 빌드 시 암호화(인코딩)된 문자열로 내장하고, 카드를 보유했을 때만 디코딩해 텍스처로 등록한다
 *             (project-archive 공개 저장소에 원본 이미지 파일을 두지 않기 위함) → RD.CardArt (src/ui/CardView.js)
 * ===================================================================== */
window.RD = window.RD || {};

// 카드 등급 (낮은 → 높은 순). mult = 능력 수치 배율, odds = 캡슐 확률(%), refund = 최대 레벨 이후 중복 시 돌려받는 파편
RD.CARD_GRADES = {
  normal:    { name: '노멀',      en: 'NORMAL',    color: '#cfd8dc', mult: 1,   odds: 52,  refund: 10 },
  rare:      { name: '레어',      en: 'RARE',      color: '#40a9ff', mult: 1.6, odds: 28,  refund: 15 },
  epic:      { name: '에픽',      en: 'EPIC',      color: '#b46bff', mult: 2.4, odds: 13,  refund: 25 },
  unique:    { name: '유니크',    en: 'UNIQUE',    color: '#ffc935', mult: 3.5, odds: 5,   refund: 40 },
  legendary: { name: '레전더리',  en: 'LEGENDARY', color: '#39ff14', mult: 5,   odds: 1.6, refund: 60 },
  error404:  { name: '404 ERROR', en: '404 ERROR', color: '#ff2a3d', mult: 7,   odds: 0.4, refund: 100 },
};
RD.CARD_GRADE_KEYS = ['normal', 'rare', 'epic', 'unique', 'legendary', 'error404'];

/* 카드 능력 (스탯). base = 노멀 Lv.1 기준 수치, cap = 장착 카드 합계 상한
 *  상한이 있는 이유: 어떤 조합으로도 게임의 도전 요소가 사라지지 않게 (밸런스 근거는 RD.META 주석)
 *  pct: true 면 % 표시 */
RD.CARD_STATS = {
  dmg_all:       { name: '전체 공격력',      unit: '%',  base: 2,   cap: 25 },
  dmg_warrior:   { name: '워리어 공격력',    unit: '%',  base: 4,   cap: 50 },
  dmg_archer:    { name: '아처 공격력',      unit: '%',  base: 4,   cap: 50 },
  dmg_wizard:    { name: '위저드 공격력',    unit: '%',  base: 4,   cap: 50 },
  dmg_hidden:    { name: '레거시 유닛 공격력', unit: '%',  base: 5,   cap: 50 },
  boss_dmg:      { name: '보스 피해',        unit: '%',  base: 5,   cap: 50 },
  aspd:          { name: '공격 속도',        unit: '%',  base: 1.5, cap: 15 },
  start_gold:    { name: '시작 골드',        unit: '',   base: 20,  cap: 600, int: true },
  start_mineral: { name: '시작 광물',        unit: '',   base: 30,  cap: 800, int: true },
  mine_rate:     { name: '채굴량',           unit: '%',  base: 4,   cap: 50 },
  kill_gold:     { name: '처치 골드',        unit: '%',  base: 3,   cap: 40 },
  round_gold:    { name: '라운드 보상 골드', unit: '%',  base: 4,   cap: 50 },
  sell_refund:   { name: '판매 환급',        unit: '%',  base: 3,   cap: 30 },
  boss_time:     { name: '보스 제한 시간',   unit: '초', base: 2,   cap: 20, int: true },
  enemy_limit:   { name: '적 한도',          unit: '기', base: 1,   cap: 12, int: true },
  fragment:      { name: '기억 파편 획득',   unit: '%',  base: 3,   cap: 50 },
};

/* 메모리 카드 목록 (등급별 능력 개수: 노멀·레어 1개 / 에픽 2개(보조 ×0.5) / 유니크 2개(×0.6) / 레전더리 2개(×0.8) / 404 3개(×0.8)) */
RD.HEROINES = [
  // ── 노멀 ──
  { id: 'n01', grade: 'normal', name: '리나', title: '수습 기록관', fx: [['dmg_all', 1]], lore: '아카이브 입구를 지키던 기록관. 지휘관의 이름을 처음 불러 준 사람.' },
  { id: 'n02', grade: 'normal', name: '세라', title: '견습 검사', fx: [['dmg_warrior', 1]], lore: '목검 한 자루로 데이터 늑대를 막아 낸 소녀의 기억.' },
  { id: 'n03', grade: 'normal', name: '유키', title: '설원의 사냥꾼', fx: [['dmg_archer', 1]], lore: '눈보라 속에서도 과녁을 놓치지 않는다는 오래된 이야기.' },
  { id: 'n04', grade: 'normal', name: '미라', title: '초급 주문사', fx: [['dmg_wizard', 1]], lore: '주문서 첫 장만 외운 마법사. 그래도 불꽃은 진짜였다.' },
  { id: 'n05', grade: 'normal', name: '하나', title: '광산 드론 조종사', fx: [['mine_rate', 1]], lore: '폐광 서버에서 마지막까지 데이터를 캐던 조종사.' },
  { id: 'n06', grade: 'normal', name: '노아', title: '보급 장교', fx: [['start_gold', 1]], lore: '전선이 무너져도 보급품은 제시간에 도착했다.' },
  { id: 'n07', grade: 'normal', name: '시엘', title: '통신 보조관', fx: [['round_gold', 1]], lore: '잡음 속에서 구조 신호를 골라내던 목소리.' },
  { id: 'n08', grade: 'normal', name: '아린', title: '전장 정비사', fx: [['sell_refund', 1]], lore: '부서진 유닛도 그녀 손을 거치면 쓸 만한 부품이 된다.' },
  // ── 레어 ──
  { id: 'r01', grade: 'rare', name: '카렌', title: '방패의 기사', fx: [['dmg_warrior', 1]], lore: '성벽이 무너진 뒤에도 끝까지 문 앞에 서 있던 기사.' },
  { id: 'r02', grade: 'rare', name: '루시아', title: '숲의 궁수', fx: [['dmg_archer', 1]], lore: '천 년 숲의 마지막 파수꾼. 화살 끝에 바람이 깃든다.' },
  { id: 'r03', grade: 'rare', name: '이블린', title: '서리 마녀', fx: [['dmg_wizard', 1]], lore: '얼어붙은 탑에서 혼자 별을 세던 마녀의 기억.' },
  { id: 'r04', grade: 'rare', name: '테아', title: '데이터 채굴자', fx: [['start_mineral', 1]], lore: '버려진 서버에서 광물 데이터를 긁어모으던 떠돌이.' },
  { id: 'r05', grade: 'rare', name: '소피', title: '현상금 사냥꾼', fx: [['kill_gold', 1]], lore: '네메시스 드론 하나당 금화 한 닢. 장부는 늘 두툼했다.' },
  { id: 'r06', grade: 'rare', name: '레나', title: '방화벽 해커', fx: [['boss_dmg', 1]], lore: '어떤 방화벽이든 세 번 두드리면 열린다고 믿었다.' },
  { id: 'r07', grade: 'rare', name: '키라', title: '전술 오퍼레이터', fx: [['aspd', 1]], lore: '0.1초 빠른 명령이 전선을 살린다.' },
  // ── 에픽 ──
  { id: 'e01', grade: 'epic', name: '아스트리드', title: '발키리 프로토콜', fx: [['dmg_warrior', 1], ['boss_dmg', 0.5]], lore: '전사의 혼을 실어 나르던 신화가 전투 AI 로 다시 쓰였다.' },
  { id: 'e02', grade: 'epic', name: '세레스', title: '별빛 저격수', fx: [['dmg_archer', 1], ['aspd', 0.5]], lore: '궤도 위에서 내려다보는 눈. 별빛 하나가 곧 탄환이다.' },
  { id: 'e03', grade: 'epic', name: '모르가나', title: '심연의 마도사', fx: [['dmg_wizard', 1], ['dmg_hidden', 0.5]], lore: '금지된 코드를 주문처럼 읽는 마도사.' },
  { id: 'e04', grade: 'epic', name: '이리스', title: '크로노 엔지니어', fx: [['boss_time', 1], ['mine_rate', 0.5]], lore: '멈춘 시계를 고치다 시간 그 자체를 고치게 되었다.' },
  { id: 'e05', grade: 'epic', name: '에코', title: '기억의 메아리', fx: [['fragment', 1], ['start_gold', 0.5]], lore: '지휘관이 잃어버린 목소리를 대신 기억하고 있는 존재.' },
  { id: 'e06', grade: 'epic', name: '바이올렛', title: '레거시 코드 연구원', fx: [['dmg_hidden', 1], ['sell_refund', 0.5]], lore: '레시피 도감의 빈칸을 처음 채운 연구원.' },
  // ── 유니크 ──
  { id: 'u01', grade: 'unique', name: '아테나', title: '전략 지성체', fx: [['dmg_all', 1], ['aspd', 0.6]], lore: '지혜의 여신을 본뜬 전략 AI. 네메시스와 같은 설계도에서 태어났다.' },
  { id: 'u02', grade: 'unique', name: '프레이야', title: '황금 연금술사', fx: [['kill_gold', 1], ['round_gold', 0.6]], lore: '쓰러진 적의 데이터를 금으로 바꾸는 연금술.' },
  { id: 'u03', grade: 'unique', name: '릴리스', title: '밤의 공주', fx: [['boss_dmg', 1], ['dmg_hidden', 0.6]], lore: '어둠 속에서만 웃는 공주. 거대한 적일수록 즐거워한다.' },
  { id: 'u04', grade: 'unique', name: '오로라', title: '궤도 방어 위성', fx: [['enemy_limit', 1], ['boss_time', 0.6]], lore: '하늘을 덮는 빛의 장막. 결계가 버틸 시간을 벌어 준다.' },
  // ── 레전더리 ──
  { id: 'l01', grade: 'legendary', name: '세이렌', title: '네온 디바', fx: [['dmg_all', 1], ['fragment', 0.8]], lore: '그녀의 노래가 흐르면 흩어진 기억들이 저절로 돌아온다.' },
  { id: 'l02', grade: 'legendary', name: '가이아', title: '세계수 코어', fx: [['mine_rate', 1], ['dmg_hidden', 0.8]], lore: '모든 데이터가 뿌리내린 거대한 나무. 아카이브의 심장.' },
  { id: 'l03', grade: 'legendary', name: '레이븐', title: '전쟁의 까마귀', fx: [['boss_dmg', 1], ['dmg_all', 0.8]], lore: '전장의 끝을 먼저 본 자. 그녀가 날면 방화벽이 무너진다.' },
  // ── 404 ERROR ──
  { id: 'x01', grade: 'error404', name: '이브', title: 'ERR://최초의 기억', fx: [['dmg_all', 1], ['aspd', 0.8], ['fragment', 0.8]], lore: '존재해서는 안 되는 파일. 지휘관이 가장 먼저 잃은, 가장 소중한 기억.' },
  { id: 'x02', grade: 'error404', name: '네메아', title: 'NULL://네메시스의 딸', fx: [['boss_dmg', 1], ['enemy_limit', 0.8], ['dmg_hidden', 0.8]], lore: '네메시스가 삼킨 인간의 감정이 오류로 깨어났다. 그녀는 어느 편일까.' },
];
RD.HEROINE_BY_ID = Object.fromEntries(RD.HEROINES.map(h => [h.id, h]));

/* ── 메타 진행 (기억 파편 / 메모리 캡슐 / 카드 레벨) ──
 *  기억 파편: 30 스테이지 이상 도달한 판이 끝날 때 지급. 30R = 100 (캡슐 1개), 이후 스테이지당 +10, 10 스테이지마다 +30 보너스
 *    (30R 100 · 50R 360 · 60R 490 · 100R 1,010 · 150R 1,660 · 200R 2,310) → 100R 은 캡슐 약 10개 (+파편 획득 카드 보너스)
 *  메모리 캡슐: 파편 100 개로 1 개 해독. 등급 확률은 RD.CARD_GRADES.odds, 30 회 연속 유니크 미만이면 다음은 유니크 이상 확정(천장)
 *  카드 레벨: 처음 얻으면 Lv.1, 같은 카드 5 장마다 +1 레벨 (최대 Lv.5 = 21장). 레벨 배율 1 + 0.25 × (Lv-1) → Lv.5 = ×2
 *    최대 레벨 이후 중복은 등급별 파편으로 환급 (RD.CARD_GRADES.refund)
 *  싱크 슬롯: 다이브 전에 카드 3 장을 장착 → 그 판에 능력 적용 (스탯별 합계 상한 RD.CARD_STATS.cap)
 *  밸런스: 상한까지 채워도 공격력 ×1.25 · 공속 ×1.15 수준이라 막히는 라운드가 뒤로 밀릴 뿐 벽이 사라지지 않음
 *    검증: DIFF=normal BOT=sloppy|avg CARDS=none|mid|max node tools/balance_sim.js 16 400 (16판 중앙값)
 *     노멀 기본 봇: 카드 없음 152 → mid(유니크·레전더리 Lv.1 + 에픽 Lv.2) 162 → max(404·레전더리·유니크 Lv.5) 176
 *     노멀 서툰 봇: 55 → 62 → 64 / 하드 기본 봇: 117 → max 153
 *    → 카드를 모아도 같은 난이도에서 +10~25 라운드 정도 (하드 최대 +36), 다른 전략을 무력화하지 않음 */
RD.META = {
  fragmentMinRound: 30,
  fragmentsFor: r => r < 30 ? 0 : 100 + 10 * (r - 30) + 30 * Math.floor((r - 30) / 10),
  capsuleCost: 100,
  pity: 30,                 // 이 횟수만큼 유니크 미만이 연속되면 다음 캡슐은 유니크 이상
  pityGrade: 'unique',
  copiesPerLevel: 5,
  maxCardLevel: 5,
  levelMult: lv => 1 + 0.25 * (lv - 1),
  slots: 3,
};
