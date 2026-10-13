/* =====================================================================
 * 게임 로직 (렌더링과 분리된 순수 상태/규칙). 바닐라 버전 로직을 그대로 옮김.
 * GameScene 이 매 프레임 update(dt) 를 호출하고, 상태(G)를 읽어 화면에 반영한다.
 * ===================================================================== */
window.RD = window.RD || {};

RD.GameLogic = (() => {
  const { TAU, rand, pick, fmt, pathPos, cellCenter, gradeColorStr } = RD.util;

  class GameLogic {
    constructor(opts) {
      opts = opts || {};
      const CONFIG = RD.CONFIG;
      // 히로인 카드 버프 (RD.Meta.runBuffs, 키는 RD.CARD_STATS). % 값은 그대로(예: 12 = +12%)
      this.buffs = Object.assign({}, opts.buffs || {});
      const b = k => this.buffs[k] || 0;
      this.dmgMul = { warrior: 1 + (b('dmg_all') + b('dmg_warrior')) / 100, archer: 1 + (b('dmg_all') + b('dmg_archer')) / 100,
        wizard: 1 + (b('dmg_all') + b('dmg_wizard')) / 100, none: 1 + b('dmg_all') / 100, hidden: 1 + (b('dmg_all') + b('dmg_hidden')) / 100 };
      this.spdMul = 1 / (1 + b('aspd') / 100);
      this.bossMul = 1 + b('boss_dmg') / 100;
      this.goldMul = { kill: 1 + b('kill_gold') / 100, round: 1 + b('round_gold') / 100, sell: 1 + b('sell_refund') / 100 };
      this.mineMul = 1 + b('mine_rate') / 100;
      const grid = [];
      for (let r = 0; r < RD.GRID.rows; r++) grid.push(new Array(RD.GRID.cols).fill(null));
      this.G = {
        mode: 'playing',            // playing | paused | over
        time: 0,
        round: 0,
        roundTimer: CONFIG.firstRoundDelay,
        spawnLeft: 0, spawnTimer: 0,
        enemyType: RD.ENEMIES[0],
        diff: opts.difficulty || RD.Difficulty.get(),   // 난이도 키 (RD.DIFFICULTIES)
        etype: RD.roundEnemyType(1),   // 지금(시작 전이면 다음) 라운드의 적 타입
        gold: CONFIG.startGold + b('start_gold'),       // 처치 자원
        mineral: CONFIG.startMineral + b('start_mineral'), // 채굴 자원 (소수점 누적, 표시 시 내림)
        enemyLimit: CONFIG.enemyLimit + b('enemy_limit'),   // 패배 기준 적 수
        bossTime: CONFIG.bossTime + b('boss_time'),         // 보스 제한 시간
        mineLv: 0,                  // 채굴 강화 레벨
        kills: 0,
        bossKills: 0,               // 이번 판 보스 처치 (기록·업적)
        topGrade: 0,                // 이번 판에 가져 본 최고 일반 유닛 레벨 (기록·업적)
        speed: opts.speed || 1,
        upg: { warrior: 0, archer: 0, wizard: 0 },   // 타입 강화 레벨
        hiddenLv: 0,                // 히든 강화 레벨 (히든 유닛 공격력 배율)
        hiddenUnlocked: false,      // 히든 유닛을 한 번이라도 가지면 true → 히든 강화 버튼 표시
        units: [], enemies: [], projectiles: [], effects: [], floats: [],
        grid,
        selected: null,
        boss: null, bossTimer: 0,
        packet: null, packetTimer: 0,   // 이벤트 몬스터 패킷 (RD.PACKET)
        packetKills: 0,                 // 이번 판 패킷 처치 수 (기록)
        packetRewards: [],              // 칸이 없어 아직 못 놓은 보상 유닛
        legacyEvents: {},               // 레벨별 레거시 첫 획득 연출을 이미 했는지 (RD.LEGACY_EVENTS)
        overReason: '',
        uid: 1,
      };
      this.toastQueue = [];          // UIScene 이 꺼내서 표시
      this.onGameOver = opts.onGameOver || null;
      this.toast('소환 버튼으로 유닛을 뽑으세요!', '#ffe082');
    }

    // ── 자원 ──
    canAfford(cur, amt) { return this.G[cur] >= amt; }
    spend(cur, amt) {
      if (this.G[cur] < amt) { const c = RD.CURRENCIES[cur]; this.toast(`${c.name}${c.josa} 부족합니다`, '#ff8a80'); return false; }
      this.G[cur] -= amt;
      return true;
    }
    mineRate() { return RD.BAL.mineRate(this.G.mineLv) * this.mineMul; }

    // ── 알림 / 연출 데이터 ──
    toast(text, color) { this.toastQueue.push({ text, color: color || '#ffffff' }); }
    addFloat(x, y, text, color, size) {
      const F = this.G.floats;
      F.push({ x, y, text, color, size: size || 28, t: 0, life: 0.8 });
      if (F.length > RD.CONFIG.maxFloats) F.shift().dead = true;
    }
    addFx(o) { o.t = 0; this.G.effects.push(o); }

    // ── 라운드 ──
    startNextRound() {
      const G = this.G, CONFIG = RD.CONFIG;
      G.round++;
      const r = G.round;
      G.roundTimer = CONFIG.roundTime;
      if (r > 1) {
        const bonus = Math.round(RD.BAL.roundGold(r) * this.goldMul.round);
        G.gold += bonus;
        this.toast(`라운드 ${r}  ·  +${bonus} 골드`, '#ffe082');
      } else {
        this.toast('라운드 1 시작!', '#ffe082');
      }
      G.etype = RD.roundEnemyType(r);     // 이번 라운드 적 타입 (상성)
      const ET = RD.ENEMY_TYPES[G.etype];
      this.toast(`${ET.name} 적 출현  ·  ${this.counterText(G.etype)}`, ET.color);
      // 30 스테이지부터 10 스테이지마다 기억 파편 회수 알림 (실제 지급은 판이 끝날 때 RD.Meta.finishRun)
      if (RD.Meta && r >= RD.META.fragmentMinRound && r % 10 === 0)
        this.toast(`기억 파편 신호 감지  ·  지금 종료 시 +${RD.Meta.fragmentsFor(r, this.buffs).total}`, '#7dffb0');
      if (r % RD.PACKET.every === 0) this.spawnPacket(r);
      if (r % CONFIG.bossEvery === 0) {
        G.spawnLeft = 0;
        this.spawnBoss(r);
      } else {
        G.enemyType = RD.ENEMIES[(r - 1) % RD.ENEMIES.length];
        G.spawnLeft = RD.BAL.spawnCount(r);
        G.spawnTimer = 0;
      }
    }
    // 적 타입 et 에게 강한 유닛 타입 안내 문구
    counterText(et) {
      const k = RD.CAT_KEYS.find(c => RD.TYPE_MULT[c][et] > 1), w = RD.CAT_KEYS.find(c => RD.TYPE_MULT[c][et] < 1);
      return `${RD.CATEGORIES[k].name} 강함 · ${RD.CATEGORIES[w].name} 약함`;
    }
    makeEnemy(type, hp, speed, size, boss) {
      const e = { type, etype: this.G.etype || RD.roundEnemyType(this.G.round), hp, maxHp: hp, s: 0, off: boss ? 0 : rand(-14, 14), speed, size, boss,
        slowT: 0, slowAmt: 0, stunT: 0, hitT: 0, dead: false, x: RD.PATH.l, y: RD.PATH.t, wob: rand(0, TAU) };
      pathPos(0, e.off, e);
      this.G.enemies.push(e);
      return e;
    }
    spawnEnemy() {
      const G = this.G, et = G.enemyType;
      this.makeEnemy(et, Math.ceil(RD.BAL.enemyHp(G.round) * this.hpMult() * et.hp), RD.CONFIG.enemyBaseSpeed * et.spd, et.size, false);
    }
    // 난이도 체력 배율 (이번 라운드)
    hpMult() {
      const d = RD.DIFFICULTIES[this.G.diff] || RD.DIFFICULTIES.easy;
      return d.hpMult(this.G.round);
    }
    spawnBoss(r) {
      const G = this.G, CONFIG = RD.CONFIG;
      const bt = RD.BOSSES[(r / CONFIG.bossEvery - 1) % RD.BOSSES.length];
      const SP = (RD.SPECIAL_BOSSES || {})[r];
      const hp = RD.BAL.bossHp(r) * (1 + (this.hpMult() - 1) * RD.BAL.bossDiffShare) * (SP ? SP.hpMul : 1);
      G.boss = this.makeEnemy(bt, Math.ceil(hp), CONFIG.enemyBaseSpeed * 0.55, bt.size, true);
      G.bossTimer = G.bossTime + (SP ? SP.extraTime : 0);
      if (SP) {
        G.boss.special = SP;
        this.shakeReq = 1;               // GameScene 이 화면 흔들림으로 표시
        for (const line of SP.lines) this.toast(line, '#ff1744');
        this.toast(`특급 보스 ${bt.name}  (${Math.round(G.bossTimer)}초 안에 처치 · 보상 ${RD.GRADES[SP.rewardGrade].name} 유닛)`, '#ff6b6b');
      } else this.toast(`보스 등장! ${bt.name}  (${G.bossTime}초 안에 처치)`, '#ff6b6b');
    }

    // ── 이벤트 몬스터: 패킷 ──
    spawnPacket(r) {
      const G = this.G, P = RD.PACKET;
      if (G.packet && !G.packet.dead) G.packet.dead = true;   // (이전 패킷이 남아 있으면 정리)
      const hp = Math.ceil(RD.BAL.enemyHp(r) * P.hpMul * this.hpMult());
      const e = this.makeEnemy(P.type, hp, RD.CONFIG.enemyBaseSpeed * P.speedMul, P.type.size, false);
      e.packet = true; e.etype = null;
      G.packet = e; G.packetTimer = P.timeLimit;
      this.shakeReq = 1;                 // GameScene 이 화면 흔들림으로 표시
      this.toast(`패킷 전송이 시작됐습니다. ${Math.round(P.timeLimit / 60)}분 안에 잡으세요!`, P.type.color);
    }
    packetReward() {
      const G = this.G, P = RD.PACKET;
      G.packetKills++;
      const ts = [];
      for (let i = 0; i < P.reward.count; i++) ts.push(pick(RD.UNITS_BY_GRADE[P.reward.grade]));   // 타입도 매번 랜덤
      const g = Math.round(RD.BAL.bossGold(G.round) * P.goldMul * this.goldMul.kill);
      G.gold += g;
      G.packetRewards.push(...ts);
      this.toast(`패킷 확보!  ${ts.map(t => `[${RD.unitLevelName(t)}] ${t.name}`).join(' · ')} 획득  ·  +${fmt(g)} 골드`, RD.HIDDEN_COLOR);
      this.placePacketRewards();
      if (G.packetRewards.length) this.toast('빈 칸이 생기면 보상 유닛이 배치됩니다', '#ff8a80');
    }
    placePacketRewards() {
      const G = this.G;
      while (G.packetRewards.length) {
        const c = this.findFreeCell();
        if (!c) return;
        const t = G.packetRewards.shift(), u = this.addUnit(t, c.col, c.row);
        RD.Codex.make(t.id);
        // 조합 연출(무지개 폭발)과 헷갈리지 않게 보상 도착은 링 + '보상' 글자로 표시
        this.addFx({ k: 'ring', x: u.x, y: u.y, r: 70, color: '#ffd54f', life: 0.6 });
        this.addFloat(u.x, u.y - 52, '보상 도착', '#ffd54f', 26);
        this.toast(`보상 유닛 배치  ·  [${RD.unitLevelName(t)}] ${t.name}`, '#ffd54f');
      }
    }

    // ── 유닛 ──
    countType(id) { let c = 0; for (const u of this.G.units) if (u.type.id === id) c++; return c; }
    // 공격력 = 기본 공격력 + 공격력 계수 × 타입 강화 레벨 (Lv.0 은 타입이 없어 강화 영향 없음)
    //  히든 유닛은 여기에 히든 강화 배율을 곱함
    //  히로인 카드: 전체 공격력 + 타입 공격력(히든은 히든 공격력) % 를 곱함
    unitDmg(t) {
      const d = t.dmg + (t.coef || 0) * (this.G.upg[t.cat] || 0);
      return t.hidden ? d * RD.BAL.hiddenMult(this.G.hiddenLv) * this.dmgMul.hidden : d * this.dmgMul[t.cat];
    }
    // 공격 간격(초): 히로인 카드 공격 속도 % 반영
    unitSpd(t) { return t.spd * this.spdMul; }
    freeCells() {
      const out = [], grid = this.G.grid;
      for (let r = 0; r < RD.GRID.rows; r++) for (let c = 0; c < RD.GRID.cols; c++) if (!grid[r][c]) out.push({ col: c, row: r });
      return out;
    }
    // 경로에 가까운 바깥쪽 칸부터 채움
    findFreeCell() {
      const cells = this.freeCells();
      if (!cells.length) return null;
      const GR = RD.GRID;
      let best = Infinity, cand = [];
      for (const c of cells) {
        const ring = Math.min(c.col, c.row, GR.cols - 1 - c.col, GR.rows - 1 - c.row);
        if (ring < best) { best = ring; cand = [c]; } else if (ring === best) cand.push(c);
      }
      return pick(cand);
    }
    addUnit(type, col, row) {
      const G = this.G, p = cellCenter(col, row);
      const u = { uid: G.uid++, type, col, row, x: p.x, y: p.y, cd: rand(0, 0.4), anim: 0, born: 0, atk: 0, removed: false };
      G.grid[row][col] = u;
      G.units.push(u);
      RD.Codex.see(type.id);
      if (!type.hidden && type.grade > G.topGrade) G.topGrade = type.grade;
      if (type.hidden && !G.hiddenUnlocked) {
        G.hiddenUnlocked = true;
        this.toast('레거시 강화가 열렸습니다!', RD.HIDDEN_COLOR);
      }
      const ev = type.hidden && RD.LEGACY_EVENTS && RD.LEGACY_EVENTS[type.grade];
      if (ev && !G.legacyEvents[type.grade]) {   // 이번 다이브에서 이 레벨 레거시를 처음 얻음 → GameScene 이 연출
        G.legacyEvents[type.grade] = true;
        this.eventReq = ev;
      }
      return u;
    }
    removeUnit(u) {
      const G = this.G;
      if (G.grid[u.row][u.col] === u) G.grid[u.row][u.col] = null;
      const i = G.units.indexOf(u);
      if (i >= 0) G.units.splice(i, 1);
      if (G.selected === u) G.selected = null;
      u.removed = true;
    }
    moveUnit(u, col, row) {
      const G = this.G;
      if (G.grid[u.row][u.col] === u) G.grid[u.row][u.col] = null;
      u.col = col; u.row = row;
      const p = cellCenter(col, row); u.x = p.x; u.y = p.y;
      G.grid[row][col] = u;
    }
    // 드래그 드롭: 빈 칸이면 이동, 다른 유닛이 있으면 자리 교환
    moveOrSwap(u, col, row) {
      const other = this.G.grid[row][col];
      if (other === u) return;
      const oc = u.col, or = u.row;
      this.moveUnit(u, col, row);
      if (other) this.moveUnit(other, oc, or);
    }

    // ── 플레이어 행동 ──
    summon() {
      const G = this.G, cost = RD.CONFIG.summonCost, cur = RD.COST_CURRENCY.summon;
      const cell = this.findFreeCell();
      if (!cell) return this.toast('빈 자리가 없습니다', '#ff8a80');
      if (!this.spend(cur, cost)) return;
      const t = pick(RD.UNITS_BY_GRADE[0]);
      const u = this.addUnit(t, cell.col, cell.row);
      this.addFloat(u.x, u.y - 52, t.name, '#ffffff', 26);
      this.addFx({ k: 'ring', x: u.x, y: u.y, r: 52, color: RD.unitColorStr(t), life: 0.4 });
      return u;
    }
    // 선택한 유닛으로 조합: 같은 유닛 3개가 있으면 일반 조합, 없으면 이 유닛이 들어가는 히든 레시피
    combine(u) {
      const G = this.G;
      if (!u) return this.toast('유닛을 먼저 선택하세요', '#ff8a80');
      const t = u.type;
      const same = RD.canMerge(t) ? G.units.filter(o => o !== u && o.type.id === t.id) : [];
      if (same.length < 2) {
        const rc = this.readyRecipeFor(u);
        if (rc) return this.craft(rc, u);
        if (!RD.canMerge(t)) return this.toast(RD.recipesUsing(t).length ? '레거시 레시피 재료가 부족합니다 (레시피 도감 참고)' : '더 이상 조합할 수 없습니다', '#ff8a80');
        return this.toast(`같은 ${t.name} 3개가 필요합니다`, '#ff8a80');
      }
      const { col, row } = u;
      this.removeUnit(u); this.removeUnit(same[0]); this.removeUnit(same[1]);
      const nt = pick(RD.combineTargets(t));
      const nu = this.addUnit(nt, col, row);
      G.selected = nu;
      this.addFx({ k: 'combine', x: nu.x, y: nu.y, r: 92, color: RD.unitColorStr(nt), life: 0.7 });
      this.toast(`조합 성공!  [${RD.GRADES[nt.grade].name}] ${nt.name}`, RD.unitTextColor(nt));
      return nu;
    }
    canCombine(u) {
      if (!u) return false;
      return (RD.canMerge(u.type) && this.countType(u.type.id) >= 3) || !!this.readyRecipeFor(u);
    }

    // ── 히든 레시피 ──
    // 레시피 재료를 필드에서 찾음 (prefer 유닛을 우선 사용) → 유닛 3개 배열 또는 null
    recipeUnits(rc, prefer) {
      const used = new Set(), out = [];
      for (const id of rc.needs) {
        let u = prefer && !used.has(prefer) && prefer.type.id === id ? prefer : null;
        if (!u) u = this.G.units.find(o => o.type.id === id && !used.has(o));
        if (!u) return null;
        used.add(u); out.push(u);
      }
      return out;
    }
    readyRecipeFor(u) {
      for (const rc of RD.recipesUsing(u.type)) if (this.recipeUnits(rc, u)) return rc;
      return null;
    }
    craft(rc, prefer) {
      const G = this.G, parts = this.recipeUnits(rc, prefer);
      if (!parts) return this.toast('레시피 재료가 부족합니다', '#ff8a80');
      const anchor = prefer && parts.includes(prefer) ? prefer : parts[0];
      const { col, row } = anchor;
      parts.forEach(p => this.removeUnit(p));
      const nt = RD.UNIT_BY_ID[rc.out];
      const first = !RD.Codex.made(nt.id);
      RD.Codex.make(nt.id);
      const nu = this.addUnit(nt, col, row);
      G.selected = nu;
      this.addFx({ k: 'combine', x: nu.x, y: nu.y, r: 130, color: 'rainbow', life: 1.0 });
      this.addFx({ k: 'ring', x: nu.x, y: nu.y, r: 70, color: '#ffffff', life: 0.6 });
      this.toast(`${first ? '레거시 발견! ' : '레거시 조합!  '}[${RD.unitLevelName(nt)}] ${nt.name}`, RD.HIDDEN_COLOR);
      return nu;
    }
    // 타입별 레벨 보유 수: { none:[n0], warrior:[n0,n1,n2,n3], ... }
    //  히든 유닛은 out.hidden 에 따로 셈
    levelCounts() {
      const out = { hidden: 0 }, n = RD.GRADES.length;
      for (const k of RD.AUTO_KEYS) out[k] = new Array(n).fill(0);
      for (const u of this.G.units) { if (u.type.hidden) out.hidden++; else out[u.type.cat][u.type.grade]++; }
      return out;
    }
    // 해당 타입에서 지금 조합 가능한 유닛 묶음 (낮은 레벨 우선) → 같은 유닛 배열 또는 null
    findMergeable(cat) {
      const groups = {};
      for (const u of this.G.units) {
        const t = u.type;
        if (t.cat !== cat || !RD.canMerge(t)) continue;
        (groups[t.id] = groups[t.id] || []).push(u);
      }
      let best = null;
      for (const id in groups) {
        const g = groups[id];
        if (g.length >= 3 && (!best || g[0].type.grade < best[0].type.grade)) best = g;
      }
      return best;
    }
    // 자동 조합: 낮은 레벨부터 더 이상 조합할 수 없을 때까지 반복
    //  Lv.0(무타입) 은 조합하면 다른 타입 Lv.1 이 되므로 'none' 버튼에서는 Lv.0 만 처리
    autoCombine(cat) {
      const G = this.G, made = [];
      let g;
      while ((g = this.findMergeable(cat))) {
        const t = g[0].type;
        const { col, row } = g[0];
        this.removeUnit(g[0]); this.removeUnit(g[1]); this.removeUnit(g[2]);
        const nt = pick(RD.combineTargets(t));
        const nu = this.addUnit(nt, col, row);
        this.addFx({ k: 'combine', x: nu.x, y: nu.y, r: 92, color: RD.unitColorStr(nt), life: 0.7 });
        made.push(nt);
      }
      const name = RD.AUTO_CATS[cat].name;
      if (!made.length) return this.toast(`${name}: 조합할 유닛이 없습니다`, '#ff8a80');
      G.selected = null;
      const top = made.reduce((a, b) => (b.grade > a.grade ? b : a));
      this.toast(`${name} 자동 조합 ${made.length}회  ·  최고 [${RD.GRADES[top.grade].name}] ${top.name}`, RD.unitTextColor(top));
      return made;
    }
    // 판매가 (히로인 카드 판매 환급 % 반영)
    sellPrice(t) { return Math.max(10, Math.floor(RD.sellPrice(t) * this.goldMul.sell / 10) * 10); }
    sell(u) {
      if (!u) return this.toast('유닛을 먼저 선택하세요', '#ff8a80');
      const g = this.sellPrice(u.type);
      this.G.gold += g;
      this.addFloat(u.x, u.y - 40, `+${fmt(g)}`, '#ffd54f', 30);
      this.removeUnit(u);
    }
    // 타입 변경: Lv.2 이상 일반 유닛을 같은 레벨의 무작위 유닛으로 교체 (타입 1/3 씩, 똑같은 유닛만 제외, 골드)
    typeChange(u) {
      if (!u) return this.toast('유닛을 먼저 선택하세요', '#ff8a80');
      const t = u.type;
      if (t.hidden) return this.toast('레거시 유닛은 타입을 바꿀 수 없습니다', '#ff8a80');
      if (!RD.canTypeChange(t)) return this.toast(`타입 변경은 ${RD.GRADES[RD.TYPE_CHANGE_MIN_GRADE].name} 이상부터 가능합니다`, '#ff8a80');
      if (!this.spend(RD.COST_CURRENCY.typeChange, RD.typeChangeCost(t))) return;
      const nt = RD.pickTypeChange(t);
      const { col, row } = u;
      this.removeUnit(u);
      const nu = this.addUnit(nt, col, row);
      nu.born = 0.5;
      this.G.selected = nu;
      this.addFx({ k: 'combine', x: nu.x, y: nu.y, r: 80, color: RD.CATEGORIES[nt.cat].color, life: 0.6 });
      this.toast(`타입 변경!  ${t.name} → [${RD.CATEGORIES[nt.cat].name}] ${nt.name}`, RD.CATEGORIES[nt.cat].color);
      return nu;
    }
    upgradeHidden() {
      const G = this.G;
      if (!G.hiddenUnlocked) return this.toast('레거시 유닛을 얻으면 열립니다', '#ff8a80');
      if (!this.spend(RD.COST_CURRENCY.hiddenUpgrade, RD.BAL.hiddenUpgradeCost(G.hiddenLv))) return;
      G.hiddenLv++;
      this.toast(`레거시 강화 Lv.${G.hiddenLv}  (레거시 유닛 공격력 ×${RD.util.fmt1(RD.BAL.hiddenMult(G.hiddenLv))})`, RD.HIDDEN_COLOR);
    }
    upgrade(cat) {
      const G = this.G, lv = G.upg[cat], cost = RD.BAL.upgradeCost(lv);
      if (!this.spend(RD.COST_CURRENCY.unitUpgrade, cost)) return;
      G.upg[cat]++;
      this.toast(`${RD.CATEGORIES[cat].name} 강화 Lv.${G.upg[cat]}  (${RD.CATEGORIES[cat].name} 유닛 공격력 상승)`, RD.CATEGORIES[cat].color);
    }
    upgradeMine() {
      const G = this.G;
      if (G.mineLv >= RD.CONFIG.mineMaxLevel) return this.toast('채굴 강화가 최대 레벨입니다', '#ff8a80');
      if (!this.spend(RD.COST_CURRENCY.mineUpgrade, RD.BAL.mineCost(G.mineLv))) return;
      G.mineLv++;
      this.toast(`채굴 강화 Lv.${G.mineLv}  (광물 +${RD.util.fmt1(this.mineRate())}/초)`, RD.CURRENCIES.mineral.color);
    }
    togglePause() {
      const G = this.G;
      if (G.mode === 'playing') G.mode = 'paused';
      else if (G.mode === 'paused') G.mode = 'playing';
    }
    toggleSpeed() { this.G.speed = this.G.speed === 1 ? 2 : 1; }
    gameOver(reason) {
      const G = this.G;
      if (G.mode === 'over') return;
      G.mode = 'over';
      G.overReason = reason;
      G.selected = null;
      if (this.onGameOver) this.onGameOver(reason);
    }

    // ── 전투 ──
    // mult: 상성 배율 (데미지 숫자 색: 강함 주황 · 약함 회색)
    damage(e, dmg, show, mult) {
      if (e.dead) return;
      if (e.boss) dmg *= this.bossMul;
      e.hp -= dmg;
      e.hitT = 0.08;
      if (show && RD.CONFIG.showDamage) {
        const col = mult > 1 ? '#ffab40' : mult < 1 ? '#9e9e9e' : e.boss ? '#ffcdd2' : '#ffffff';
        this.addFloat(e.x + rand(-12, 12), e.y - e.size - 12, fmt(dmg), col, (e.boss ? 30 : 24) + (mult > 1 ? 4 : 0));
      }
      if (e.hp <= 0) this.killEnemy(e);
    }
    killEnemy(e) {
      const G = this.G;
      e.dead = true;
      G.kills++;
      if (e.packet) {
        G.packet = null;
        this.addFx({ k: 'combine', x: e.x, y: e.y, r: 200, color: 'rainbow', life: 1.2 });
        this.shakeReq = 1;
        return this.packetReward();
      }
      const g = Math.round((e.boss ? RD.BAL.bossGold(G.round) : RD.BAL.killGold(G.round)) * this.goldMul.kill);
      G.gold += g;
      this.addFx({ k: 'pop', x: e.x, y: e.y, r: e.size * 1.8, color: e.type.color, life: 0.3 });
      if (e.boss) {
        this.addFx({ k: 'combine', x: e.x, y: e.y, r: 160, color: '#ffd54f', life: 0.9 });
        this.toast(`보스 처치!  +${g} 골드`, '#ffd54f');
        G.boss = null;
        G.bossKills++;
        if (e.special) {                 // 특별 보스 보상: 해당 레벨 랜덤 유닛 1개 (타입도 랜덤)
          const t = pick(RD.UNITS_BY_GRADE[e.special.rewardGrade]);
          G.packetRewards.push(t);
          this.shakeReq = 1;
          this.toast(`수문장 격파!  [${RD.unitLevelName(t)}] ${t.name} 획득`, '#ffd54f');
          this.placePacketRewards();
          if (G.packetRewards.length) this.toast('빈 칸이 생기면 보상 유닛이 배치됩니다', '#ff8a80');
        }
      } else {
        this.addFloat(e.x, e.y - 8, '+' + g, '#ffd54f', 22);
      }
    }
    applyStatus(t, e) {
      if (t.slow) {
        const amt = e.boss || e.packet ? t.slow * 0.5 : t.slow;
        e.slowAmt = e.slowT > 0 ? Math.max(e.slowAmt, amt) : amt;
        e.slowT = Math.max(e.slowT, t.slowDur);
      }
      if (t.stun && Math.random() < t.stun) {
        e.stunT = Math.max(e.stunT, e.boss || e.packet ? t.stunDur * 0.3 : t.stunDur);
      }
    }
    hit(t, x, y, target, dmg) {
      if (t.splash) {
        const r = t.splash;
        for (const e of this.G.enemies) {
          if (e.dead) continue;
          const dx = e.x - x, dy = e.y - y, rr = r + e.size;
          if (dx * dx + dy * dy <= rr * rr) { const m = RD.typeMult(t, e.etype); this.applyStatus(t, e); this.damage(e, dmg * m, e === target, m); }
        }
        this.addFx({ k: 'boom', x, y, r, color: t.pcolor || GameLogic.fxColor(t), life: 0.28 });
      } else if (target && !target.dead) {
        const m = RD.typeMult(t, target.etype);
        this.applyStatus(t, target);
        this.damage(target, dmg * m, true, m);
        this.addFx({ k: 'spark', x, y, r: 12, color: t.pcolor || GameLogic.fxColor(t), life: 0.15 });
      }
    }
    static fxColor(t) {
      switch (t.fx) {
        case 'fire': return '#ff7043';
        case 'holy': return '#ffe082';
        case 'missile': return '#ffab40';
        case 'bullet': return '#ffee58';
        case 'arrow': return '#e6d8a8';
        case 'slash': return '#ffffff';
        default: return RD.unitTextColor(t);
      }
    }
    attack(u, e) {
      const t = u.type, dmg = this.unitDmg(t);
      u.anim = 1;
      if (RD.SFX) RD.SFX.attack(t);
      u.atk++;
      u.face = e.x < u.x - 4 ? -1 : e.x > u.x + 4 ? 1 : u.face || 1;
      // 레벨이 높을수록 공격 순간 섬광이 크고, Lv.3 은 적 위치에 충격파 추가
      const gk = Math.min(t.grade, 5), col = RD.unitColorStr(t);
      if (t.grade >= 1) this.addFx({ k: 'flash', x: u.x, y: u.y - 8, r: 12 + gk * 10, color: col, life: 0.14 + gk * 0.04 });
      if (t.grade >= 3) this.addFx({ k: 'ring', x: e.x, y: e.y, r: 34 + (gk - 3) * 10, color: col, life: 0.3 });
      if (RD.INSTANT_FX[t.fx]) {
        if (t.fx === 'slash') this.addFx({ k: 'slash', x: e.x, y: e.y, a: rand(0, TAU), r: 28 + gk * 6, color: t.grade >= 3 ? col : '#ffffff', life: 0.18 });
        else if (t.fx === 'beam') this.addFx({ k: 'beam', x: u.x, y: u.y, x2: e.x, y2: e.y, w: 4 + gk * 2, color: t.pcolor || '#ffffff', life: 0.14 });
        else this.addFx({ k: 'lightning', pts: GameLogic.zigzag(u.x, u.y, e.x, e.y), color: t.pcolor || '#ffffff', life: 0.18 });
        this.hit(t, e.x, e.y, e, dmg);
      } else {
        this.G.projectiles.push({ x: u.x, y: u.y, tx: e.x, ty: e.y, target: e, t, dmg, spd: RD.FX_SPEED[t.fx] || 1000, ang: 0, done: false });
      }
    }
    static zigzag(x1, y1, x2, y2) {
      const pts = [{ x: x1, y: y1 }], n = 6, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      for (let i = 1; i < n; i++) { const k = i / n, j = rand(-20, 20); pts.push({ x: x1 + dx * k + nx * j, y: y1 + dy * k + ny * j }); }
      pts.push({ x: x2, y: y2 });
      return pts;
    }

    // 패배 기준 적 수 (패킷 제외)
    enemyCount() { return this.G.enemies.length - (this.G.packet && !this.G.packet.dead ? 1 : 0); }

    // ── 업데이트 (게임 시간 dt 초) ──
    update(dt) {
      const G = this.G, CONFIG = RD.CONFIG;
      G.time += dt;

      // 광물 자동 채굴
      G.mineral += this.mineRate() * dt;

      G.roundTimer -= dt;
      if (G.roundTimer <= 0) this.startNextRound();

      if (G.spawnLeft > 0) {
        G.spawnTimer -= dt;
        while (G.spawnTimer <= 0 && G.spawnLeft > 0) {
          this.spawnEnemy(); G.spawnLeft--; G.spawnTimer += CONFIG.spawnInterval;
        }
      }

      if (G.boss) {
        G.bossTimer -= dt;
        if (G.bossTimer <= 0 && !G.boss.dead) { this.gameOver('보스를 제한 시간 안에 처치하지 못했습니다'); return; }
      }

      // 패킷: 제한 시간이 지나면 사라짐 (게임은 계속)
      if (G.packet) {
        G.packetTimer -= dt;
        if (G.packetTimer <= 0 && !G.packet.dead) {
          G.packet.dead = true; G.packet = null;
          this.toast('패킷 전송 실패  ·  패킷이 사라졌습니다', '#9e9e9e');
        }
      }
      if (G.packetRewards.length) this.placePacketRewards();

      // 적 이동
      for (const e of G.enemies) {
        if (e.hitT > 0) e.hitT -= dt;
        if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowAmt = 0; }
        if (e.stunT > 0) { e.stunT -= dt; continue; }
        e.s += e.speed * (1 - e.slowAmt) * dt;
        pathPos(e.s, e.off, e);
      }

      // 유닛 공격: 사거리 안 가장 가까운 적
      const enemies = G.enemies;
      for (const u of G.units) {
        if (u.anim > 0) u.anim = Math.max(0, u.anim - dt * 6);
        if (u.born < 1) u.born = Math.min(1, u.born + dt * 4);
        u.cd -= dt;
        if (u.cd > 0) continue;
        const r2 = u.type.range * u.type.range;
        let best = null, bd = Infinity;
        for (const e of enemies) {
          if (e.dead) continue;
          const dx = e.x - u.x, dy = e.y - u.y, d = dx * dx + dy * dy;
          if (d <= r2 && d < bd) { bd = d; best = e; }
        }
        if (best) { this.attack(u, best); u.cd = this.unitSpd(u.type); }
        else u.cd = 0.05;
      }

      // 투사체 (유도)
      for (const p of G.projectiles) {
        if (p.target && !p.target.dead) { p.tx = p.target.x; p.ty = p.target.y; }
        const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), step = p.spd * dt;
        p.ang = Math.atan2(dy, dx);
        if (d <= step + 4) {
          p.done = true;
          const tgt = p.target && !p.target.dead ? p.target : null;
          if (tgt || p.t.splash) this.hit(p.t, p.tx, p.ty, tgt, p.dmg);
        } else { p.x += dx / d * step; p.y += dy / d * step; }
      }
      G.projectiles = G.projectiles.filter(p => !p.done);

      // 이펙트 / 데미지 숫자 수명
      for (const f of G.effects) f.t += dt;
      G.effects = G.effects.filter(f => f.t < f.life);
      for (const f of G.floats) { f.t += dt; f.y -= 56 * dt; if (f.t >= f.life) f.dead = true; }
      G.floats = G.floats.filter(f => !f.dead);

      G.enemies = G.enemies.filter(e => !e.dead);
      if (this.enemyCount() >= G.enemyLimit) this.gameOver(`필드의 적이 ${G.enemyLimit}마리에 도달했습니다`);
    }
  }
  return GameLogic;
})();
