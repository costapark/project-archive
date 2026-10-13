/* =====================================================================
 * 메타 진행 로직 (판을 넘어 유지되는 성장): 기억 파편, 메모리 캡슐, 메모리 카드 레벨, 싱크 슬롯
 *  데이터·수치는 src/data/heroines.js (RD.HEROINES, RD.CARD_GRADES, RD.CARD_STATS, RD.META)
 *  저장은 RD.Save.data.meta. 씬(로비/갤러리/캡슐/게임 오버)은 여기 함수만 호출한다
 * ===================================================================== */
window.RD = window.RD || {};

RD.Meta = (() => {
  const M = () => RD.Save.data.meta;
  const card = id => RD.HEROINE_BY_ID[id];

  // ── 카드 보유 / 레벨 ──
  const copies = id => M().cards[id] || 0;
  const owned = id => copies(id) > 0;
  const levelOf = n => n <= 0 ? 0 : Math.min(RD.META.maxCardLevel, 1 + Math.floor((n - 1) / RD.META.copiesPerLevel));
  const level = id => levelOf(copies(id));
  const maxCopies = () => 1 + (RD.META.maxCardLevel - 1) * RD.META.copiesPerLevel;
  // 다음 레벨까지 진행도 { have, need } (최대 레벨이면 null)
  function nextLevelProgress(id) {
    const n = copies(id), lv = levelOf(n);
    if (lv >= RD.META.maxCardLevel || lv === 0) return null;
    const base = 1 + (lv - 1) * RD.META.copiesPerLevel;
    return { have: n - base, need: RD.META.copiesPerLevel };
  }

  // ── 능력 수치 ──
  function round(st, v) { return st.int ? Math.max(1, Math.round(v)) : Math.round(v * 10) / 10; }
  // 카드의 능력 목록 (lv 생략 시 현재 레벨, 미보유면 Lv.1 기준) → [{ k, v, st }]
  function cardEffects(c, lv) {
    if (typeof c === 'string') c = card(c);
    lv = lv || Math.max(1, level(c.id));
    const gm = RD.CARD_GRADES[c.grade].mult, lm = RD.META.levelMult(lv);
    return c.fx.map(([k, r]) => { const st = RD.CARD_STATS[k]; return { k, st, v: round(st, st.base * gm * r * lm) }; });
  }
  const fmtEffect = e => `${e.st.name} +${e.v}${e.st.unit}`;

  // ── 싱크 슬롯 ──
  const equipped = () => M().equip.map(id => (id && owned(id) ? card(id) : null));
  function equip(slot, id) {
    const E = M().equip;
    if (!owned(id) || slot < 0 || slot >= RD.META.slots) return false;
    const cur = E.indexOf(id);
    if (cur >= 0) E[cur] = E[slot] || null;     // 이미 다른 슬롯에 있으면 자리 교환
    E[slot] = id;
    RD.Save.save();
    return true;
  }
  function unequip(id) {
    const E = M().equip, i = E.indexOf(id);
    if (i >= 0) { E[i] = null; RD.Save.save(); }
  }
  const firstFreeSlot = () => M().equip.findIndex(x => !x || !owned(x));

  // 카드 목록 → 스탯 합계 { k: { raw, v(상한 적용), cap } }
  function sumEffects(cards) {
    const out = {};
    for (const c of cards) if (c) for (const e of cardEffects(c)) {
      const o = out[e.k] || (out[e.k] = { raw: 0, v: 0, st: e.st });
      o.raw = Math.round((o.raw + e.v) * 10) / 10;
      o.v = Math.min(o.raw, e.st.cap);
    }
    return out;
  }
  // 이번 판에 적용할 버프 { k: 수치 } (GameLogic opts.buffs)
  function runBuffs() {
    const s = sumEffects(equipped()), out = {};
    for (const k in s) out[k] = s[k].v;
    return out;
  }

  // ── 기억 파편 ──
  function fragmentsFor(round, buffs) {
    const base = RD.META.fragmentsFor(round);
    const bonus = Math.floor(base * ((buffs && buffs.fragment) || 0) / 100);
    return { base, bonus, total: base + bonus };
  }
  // 판 종료 정산 (한 판에 한 번). run = { kills, bossKills, time, topGrade } → { total, base, bonus, have, best, newBest, ach(새 업적) }
  function finishRun(round, diff, buffs, run) {
    const S = RD.Save.data, f = fragmentsFor(round, buffs), st = S.stats;
    run = run || {};
    st.kills += run.kills || 0;
    st.bossKills += run.bossKills || 0;
    st.playTime += Math.round(run.time || 0);
    st.bestKills = Math.max(st.bestKills, run.kills || 0);
    st.topGrade = Math.max(st.topGrade, run.topGrade || 0);
    M().fragments += f.total;
    M().totalFragments += f.total;
    S.stats.runs++;
    const prev = S.stats.best[diff] || 0;
    if (round > prev) S.stats.best[diff] = round;
    S.stats.last = { round, diff, fragments: f.total, at: Date.now() };
    RD.Save.save();
    const ach = RD.Achieve ? RD.Achieve.popNew() : [];
    return Object.assign({}, f, { have: M().fragments, best: Math.max(prev, round), newBest: round > prev, ach });
  }

  // ── 메모리 캡슐 ──
  const capsules = () => Math.floor(M().fragments / RD.META.capsuleCost);
  function rollGrade(minIdx) {
    const keys = RD.CARD_GRADE_KEYS.slice(minIdx || 0);
    const total = keys.reduce((s, k) => s + RD.CARD_GRADES[k].odds, 0);
    let x = Math.random() * total;
    for (const k of keys) { x -= RD.CARD_GRADES[k].odds; if (x < 0) return k; }
    return keys[keys.length - 1];
  }
  // n 개 해독 → [{ card, isNew, levelUp, level, refund, pity, progress(그 시점 다음 레벨 진행도) }]
  function openCapsules(n) {
    n = Math.min(n, capsules());
    const out = [], pityIdx = RD.CARD_GRADE_KEYS.indexOf(RD.META.pityGrade);
    for (let i = 0; i < n; i++) {
      M().fragments -= RD.META.capsuleCost;
      M().opened++;
      const forced = M().pity >= RD.META.pity - 1;
      const g = rollGrade(forced ? pityIdx : 0);
      M().pity = RD.CARD_GRADE_KEYS.indexOf(g) >= pityIdx ? 0 : M().pity + 1;
      const pool = RD.HEROINES.filter(h => h.grade === g);
      const c = pool[Math.floor(Math.random() * pool.length)];
      const before = copies(c.id), lv0 = levelOf(before);
      let refund = 0;
      if (before >= maxCopies()) { refund = RD.CARD_GRADES[g].refund; M().fragments += refund; }
      else M().cards[c.id] = before + 1;
      const lv1 = level(c.id);
      out.push({ card: c, isNew: before === 0, levelUp: lv0 > 0 && lv1 > lv0, level: lv1, refund, pity: forced, progress: nextLevelProgress(c.id) });
    }
    RD.Save.save();
    return out;
  }
  const pityLeft = () => RD.META.pity - M().pity;

  // 컬렉션 현황
  const ownedCount = () => RD.HEROINES.filter(h => owned(h.id)).length;

  return { card, copies, owned, level, levelOf, maxCopies, nextLevelProgress, cardEffects, fmtEffect,
    equipped, equip, unequip, firstFreeSlot, sumEffects, runBuffs,
    fragmentsFor, finishRun, capsules, openCapsules, pityLeft, ownedCount,
    get fragments() { return M().fragments; } };
})();
