/* 맵 / 화면 레이아웃 상수 (1080x1920 논리 좌표) */
window.RD = window.RD || {};

RD.PATH = { l: 90, t: 250, r: 990, b: 1270, w: 88 };     // 적 이동 경로(중심선 사각형)
RD.PW = RD.PATH.r - RD.PATH.l;
RD.PH = RD.PATH.b - RD.PATH.t;
RD.PERIM = 2 * (RD.PW + RD.PH);
RD.GRID = { x: 140, y: 310, cols: 8, rows: 9, cell: 100 };  // 유닛 배치 칸
RD.UNIT_CAP = RD.GRID.cols * RD.GRID.rows;

RD.UI = {
  hudH: 200,
  panelY: 1320,
  info:       { x: 20,  y: 1332, w: 776, h: 172 },
  btnBook:    { x: 812, y: 1332, w: 248, h: 80 },    // 히든 레시피 도감
  btnHidden:  { x: 812, y: 1424, w: 248, h: 80 },    // 히든 강화 (광물, 히든 유닛을 얻으면 나타남)
  auto: [                                   // 타입별 자동 조합 + 레벨별 보유 수 (RD.AUTO_KEYS 순서)
    { x: 20,  y: 1516, w: 248, h: 112 },
    { x: 284, y: 1516, w: 248, h: 112 },
    { x: 548, y: 1516, w: 248, h: 112 },
    { x: 812, y: 1516, w: 248, h: 112 },
  ],
  btnCombine: { x: 20,  y: 1640, w: 248, h: 136 },
  btnSell:    { x: 284, y: 1640, w: 248, h: 136 },
  btnChange:  { x: 548, y: 1640, w: 248, h: 136 },   // 타입 변경 (골드, Lv.2 이상)
  btnSummon:  { x: 812, y: 1640, w: 248, h: 136 },
  // 히든 레시피 도감 (전체 화면 오버레이)
  book: { x: 30, y: 150, w: 1020, h: 1740, rowY: 300, rowH: 108, craft: { w: 150, h: 76 }, close: { x: 340, y: 1760, w: 400, h: 104 } },
  upg: [                                    // 계열 강화 (광물)
    { x: 20,  y: 1788, w: 248, h: 116 },
    { x: 284, y: 1788, w: 248, h: 116 },
    { x: 548, y: 1788, w: 248, h: 116 },
  ],
  btnMine:    { x: 812, y: 1788, w: 248, h: 116 },   // 채굴 강화 (골드)
  btnPause:   { x: 784, y: 20, w: 120, h: 80 },
  btnSpeed:   { x: 924, y: 20, w: 132, h: 80 },
  btnRestart: { x: 120, y: 1250, w: 400, h: 140 },   // 게임 오버: 다시 하기
  btnLobby:   { x: 560, y: 1250, w: 400, h: 140 },   // 게임 오버: 로비로
  btnQuit:    { x: 340, y: 960, w: 400, h: 120 },    // 일시정지: 다이브 중단
  btnPauseSet: { x: 340, y: 1110, w: 400, h: 110 },  // 일시정지: 설정 (소리 · 진동 · 게임 방법)
};

RD.FX_SPEED = { arrow: 1300, bullet: 1900, orb: 860, fire: 800, holy: 960, missile: 1040 };
RD.INSTANT_FX = { slash: 1, beam: 1, lightning: 1 };
