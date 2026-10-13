/* =====================================================================
 * 업적 데이터 + 판정 (RD.ACHIEVEMENTS, RD.Achieve)
 *  업적은 저장된 누적 기록(RD.Save.data.stats / meta / codex)에서 진행도를 계산하므로 따로 '달성' 상태를 저장하지 않는다
 *   → 업적을 나중에 추가해도 이미 조건을 채운 플레이어는 바로 달성 처리됨
 *  저장하는 것: claimed(보상 받은 업적 id), seen(달성 알림을 이미 띄운 업적 id)
 *  보상은 기억 파편 (로비 → 기록·업적 에서 [받기]). 파편은 원래 30 스테이지부터 얻는 재화라 업적도 30R 부터 시작
 *  항목: id, cat(분류), name, desc, val(S → 현재 값), goal(목표), reward(파편)
 *   S = { st: stats, m: meta, cx: codex }
 * ===================================================================== */
window.RD = window.RD || {};

RD.ACH_CATS = {
  stage:  { name: '돌파',   color: '#00e5ff' },
  combat: { name: '전투',   color: '#ff7043' },
  unit:   { name: '유닛',   color: '#b46bff' },
  memory: { name: '기억',   color: '#7dffb0' },
};

(() => {
  const bestAny = S => Math.max(0, ...Object.values(S.st.best || {}));
  const bestOf = k => S => (S.st.best || {})[k] || 0;
  const owned = S => Object.keys(S.m.cards).filter(id => S.m.cards[id] > 0 && RD.HEROINE_BY_ID[id]).length;
  const ownedGrade = g => S => Object.keys(S.m.cards).filter(id => S.m.cards[id] > 0 && RD.HEROINE_BY_ID[id] && RD.HEROINE_BY_ID[id].grade === g).length;
  const maxCardLv = S => Math.max(0, ...Object.keys(S.m.cards).map(id => RD.Meta.levelOf(S.m.cards[id])));
  const A = [];
  const add = (cat, id, name, desc, val, goal, reward) => A.push({ cat, id, name, desc, val, goal, reward });

  // 돌파 (최고 도달 스테이지)
  [[30, 50, '방화벽 돌파'], [50, 80, '보안 구역 진입'], [100, 200, '코어 서버 접근'], [150, 300, '심층 아카이브'], [200, 500, '메인프레임의 심장']]
    .forEach(([r, rw, n]) => add('stage', 'stage' + r, n, `아무 난이도로 ${r} 스테이지 도달`, bestAny, r, rw));
  add('stage', 'normal100', '표준 작전 완수', '노멀 난이도로 100 스테이지 도달', bestOf('normal'), 100, 250);
  add('stage', 'hard50', '고위험 다이브', '하드 난이도로 50 스테이지 도달', bestOf('hard'), 50, 150);
  add('stage', 'hard100', '네메시스의 악몽', '하드 난이도로 100 스테이지 도달', bestOf('hard'), 100, 400);
  // 전투
  [[1000, 30], [10000, 100], [100000, 300]].forEach(([n, rw], i) =>
    add('combat', 'kills' + n, ['데이터 정리', '대량 삭제', '군단 소거'][i], `누적 ${n.toLocaleString('ko-KR')}마리 처치`, S => S.st.kills, n, rw));
  [[10, 50], [50, 150]].forEach(([n, rw], i) =>
    add('combat', 'boss' + n, ['방화벽 파괴자', '보스 헌터'][i], `누적 보스 ${n}마리 처치`, S => S.st.bossKills, n, rw));
  add('combat', 'onerun3000', '끝나지 않는 전투', '한 판에 3,000마리 처치', S => S.st.bestKills, 3000, 100);
  [[5, 30], [30, 100]].forEach(([n, rw], i) =>
    add('combat', 'runs' + n, ['반복 다이브', '숙련된 지휘관'][i], `다이브 ${n}회 완료`, S => S.st.runs, n, rw));
  // 유닛
  add('unit', 'grade5', '최고 등급 소환', '일반 유닛 Lv.5 만들기', S => S.st.topGrade, 5, 50);
  add('unit', 'hidden1', '숨겨진 레시피', '레거시 유닛 처음 만들기', S => S.cx.made.length, 1, 80);
  add('unit', 'hidden7', '레시피 연구가', '레거시 유닛 7종 발견', S => S.cx.made.length, 7, 150);
  add('unit', 'hiddenAll', '완전한 도감', () => `레거시 유닛 ${RD.RECIPES.length}종 모두 발견`, S => S.cx.made.length, () => RD.RECIPES.length, 300);
  // 기억 (메모리 캡슐 / 메모리 카드)
  [[1, 20], [50, 100], [200, 300]].forEach(([n, rw], i) =>
    add('memory', 'open' + n, ['첫 번째 해독', '기억 복원가', '아카이브 관리자'][i], `메모리 캡슐 ${n}개 해독`, S => S.m.opened, n, rw));
  add('memory', 'own10', '되살아난 얼굴들', '메모리 10개 복원', owned, 10, 50);
  add('memory', 'own20', '기억의 회랑', '메모리 20개 복원', owned, 20, 150);
  add('memory', 'ownAll', '그랜드 아카이브', () => `메모리 ${RD.HEROINES.length}개 모두 복원`, owned, () => RD.HEROINES.length, 500);
  add('memory', 'legend', '전설의 기억', '레전더리 메모리 복원', ownedGrade('legendary'), 1, 100);
  add('memory', 'error404', 'ERROR 404', '404 ERROR 메모리 복원', ownedGrade('error404'), 1, 200);
  add('memory', 'cardlv5', '완전 동기화', '메모리 카드 하나를 Lv.5 로', maxCardLv, 5, 200);
  RD.ACHIEVEMENTS = A;
})();

RD.Achieve = (() => {
  const S = () => ({ st: RD.Save.data.stats, m: RD.Save.data.meta, cx: RD.Save.data.codex });
  const A = () => RD.Save.data.ach;
  const goal = a => typeof a.goal === 'function' ? a.goal() : a.goal;
  const desc = a => typeof a.desc === 'function' ? a.desc() : a.desc;
  const value = a => Math.min(goal(a), a.val(S()) || 0);
  const done = a => (a.val(S()) || 0) >= goal(a);
  const claimed = a => A().claimed.includes(a.id);
  const claimable = () => RD.ACHIEVEMENTS.filter(a => done(a) && !claimed(a));
  function claim(a) {
    if (!done(a) || claimed(a)) return 0;
    A().claimed.push(a.id);
    if (!A().seen.includes(a.id)) A().seen.push(a.id);
    RD.Save.data.meta.fragments += a.reward;
    RD.Save.data.meta.totalFragments += a.reward;
    RD.Save.save();
    return a.reward;
  }
  // 새로 달성했지만 아직 알리지 않은 업적 (알린 것으로 표시)
  function popNew() {
    const out = RD.ACHIEVEMENTS.filter(a => done(a) && !claimed(a) && !A().seen.includes(a.id));
    if (out.length) { out.forEach(a => A().seen.push(a.id)); RD.Save.save(); }
    return out;
  }
  const doneCount = () => RD.ACHIEVEMENTS.filter(done).length;
  return { goal, desc, value, done, claimed, claimable, claim, popNew, doneCount };
})();
