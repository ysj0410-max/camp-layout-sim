'use strict';
/* 캠프 배치 — 캠핑 사이트·장비 배치 시뮬레이터
   정적 웹앱(서버 없음). 모든 데이터는 이 브라우저의 localStorage에만 저장됩니다. */
(function () {

  /* ============================== 상수 ============================== */
  const TAU = Math.PI * 2;
  const STORE_KEY = 'campsim.v1';
  const PLAN_KEY = 'campsim.plans.v1';
  const SNAP = 10;
  const EPS = 0.5;

  const CATS = ['텐트', '타프', '가구', '수납·기타', '화기·기타', '차량', '장애물'];
  const SHAPES = [['rect', '사각'], ['round', '둥근사각'], ['circle', '원형'], ['hex', '육각']];
  const DOORS = [['none', '표시 안 함'], ['front', '앞'], ['back', '뒤'], ['left', '왼쪽'], ['right', '오른쪽']];
  const L_SIDES = ['c', 't', 'b', 'l', 'r'];
  const L_SIDE_NAMES = { c: '중앙', t: '위', b: '아래', l: '왼쪽', r: '오른쪽' };
  const L_FLIPS = ['n', 'h', 'v'];
  const L_FLIP_NAMES = { n: '없음', h: '좌우', v: '상하' };
  const FLOORS = { deck: '데크', gravel: '파쇄석', grass: '잔디' };
  const PRESETS = [
    { label: '4×5m 데크', w: 400, d: 500, floor: 'deck' },
    { label: '5×7m 데크', w: 500, d: 700, floor: 'deck' },
    { label: '6×8m 파쇄석', w: 600, d: 800, floor: 'gravel' },
    { label: '8×10m 대형', w: 800, d: 1000, floor: 'gravel' },
    { label: '10×10m 노지', w: 1000, d: 1000, floor: 'grass' }
  ];

  // 한국 캠핑에서 흔한 차종 (전장 × 전폭, cm) — 코나·레이를 앞에
  const CAR_MODELS = [
    { name: '코나', w: 435, d: 183, color: '#34373c', carStyle: 'ironman' },
    { name: '레이', w: 360, d: 160, color: '#0e1013', carStyle: 'black' },
    { name: '아반떼 / 준중형', w: 471, d: 183, color: '#6d7f8f', carStyle: 'generic' },
    { name: '스포티지 / 투싼', w: 466, d: 187, color: '#5f7a6d', carStyle: 'generic' },
    { name: '쏘렌토 / 싼타페', w: 482, d: 190, color: '#7a6a5b', carStyle: 'generic' },
    { name: '토레스', w: 470, d: 189, color: '#6a6f7a', carStyle: 'generic' },
    { name: '팰리세이드', w: 500, d: 198, color: '#55606e', carStyle: 'generic' },
    { name: '카니발', w: 516, d: 200, color: '#5a6672', carStyle: 'generic' },
    { name: '스타리아', w: 525, d: 200, color: '#4f5a66', carStyle: 'generic' }
  ];

  function carStyleOf(it) { return (it && it.carStyle) || carStyleOfName(it ? it.name : ''); }
  function carStyleOfName(name) {
    const n = name || '';
    if (n.indexOf('코나') >= 0) return 'ironman';
    if (n.indexOf('레이') >= 0) return 'black';
    return 'generic';
  }

  const DEFAULT_LIBRARY = [
    // --- 수정 님 텐트 7종 (실제 규격) ---
    { id: 'tent-yakdome450', name: '야크돔 450', maker: '위오', cat: '텐트', w: 440, d: 460, hgt: 210, guy: 50, shape: 'round', color: '#ab8557', door: 'front', memo: '돔형' },
    { id: 'tent-modelv', name: '위켄트립 모델V', maker: '', cat: '텐트', w: 350, d: 625, hgt: 225, guy: 80, shape: 'rect', color: '#d2c7b2', door: 'front', memo: '터널형' },
    { id: 'tent-timaxex', name: '제드 티맥스 EX', maker: '', cat: '텐트', w: 400, d: 680, hgt: 225, guy: 100, shape: 'rect', color: '#ded6c5', door: 'front', memo: '대형 터널형' },
    { id: 'tent-raummini', name: '트레블첵 라움 미니', maker: '', cat: '텐트', w: 200, d: 260, hgt: 130, guy: 40, shape: 'rect', color: '#d3a3a0', door: 'front', memo: '사각 돔' },
    { id: 'tent-poler2', name: '폴러 투맨', maker: '', cat: '텐트', w: 152, d: 216, hgt: 102, guy: 40, shape: 'rect', color: '#c96a3f', door: 'front', memo: '경량 돔' },
    { id: 'tent-village5', name: '네이처하이크 빌리지 5.0', maker: '', cat: '텐트', w: 210, d: 470, hgt: 190, guy: 60, shape: 'rect', color: '#d6c7ab', door: 'front', memo: '로지형' },
    { id: 'tent-geoair4', name: '지오에어 4', maker: '디얼스', cat: '텐트', w: 230, d: 300, hgt: 190, guy: 60, shape: 'rect', color: '#9c968c', door: 'front', memo: '에어텐트' },
    // --- 타프 ---
    { id: 'tarp-recta440', name: '렉타 타프 440', maker: '', cat: '타프', w: 440, d: 440, hgt: 0, guy: 60, shape: 'rect', color: '#bda484', door: 'none', memo: '렉타' },
    { id: 'tarp-hexa', name: '헥사 타프 500×420', maker: '', cat: '타프', w: 500, d: 420, hgt: 0, guy: 70, shape: 'hex', color: '#55564e', door: 'none', memo: '헥사' },
    // --- 가구 ---
    { id: 'furn-cot', name: '야전침대', maker: '', cat: '가구', w: 190, d: 65, hgt: 35, guy: 0, shape: 'round', color: '#8b95a5', door: 'none', memo: '' },
    { id: 'furn-table120', name: '캠핑 테이블 120', maker: '', cat: '가구', w: 120, d: 60, hgt: 45, guy: 0, shape: 'round', color: '#a98b6b', door: 'none', memo: '' },
    { id: 'furn-igt90', name: 'IGT 테이블 90', maker: '', cat: '가구', w: 90, d: 50, hgt: 45, guy: 0, shape: 'round', color: '#b79a76', door: 'none', memo: '' },
    { id: 'furn-relaxchair', name: '릴렉스체어', maker: '', cat: '가구', w: 60, d: 60, hgt: 70, guy: 0, shape: 'round', color: '#7d8a9c', door: 'none', memo: '' },
    { id: 'furn-lightchair', name: '경량체어', maker: '', cat: '가구', w: 55, d: 55, hgt: 65, guy: 0, shape: 'round', color: '#93a3b5', door: 'none', memo: '' },
    // --- 화기·기타 ---
    { id: 'etc-firepit', name: '화로대 (원형)', maker: '', cat: '화기·기타', w: 45, d: 45, hgt: 40, guy: 0, shape: 'circle', color: '#f07a3c', door: 'none', memo: '' },
    // --- 차량 ---
    { id: 'veh-kona', name: '차량 · 코나', maker: '', cat: '차량', w: 435, d: 183, hgt: 0, guy: 0, shape: 'round', color: '#34373c', door: 'none', memo: '코나', carStyle: 'ironman' },
    { id: 'veh-ray', name: '차량 · 레이', maker: '', cat: '차량', w: 360, d: 160, hgt: 0, guy: 0, shape: 'round', color: '#0e1013', door: 'none', memo: '레이', carStyle: 'black' },
    { id: 'veh-suv', name: '차량 · 중형 SUV', maker: '', cat: '차량', w: 480, d: 195, hgt: 0, guy: 0, shape: 'round', color: '#5b6b82', door: 'none', memo: 'SUV' },
    { id: 'veh-van', name: '차량 · 대형 RV/카니발', maker: '', cat: '차량', w: 515, d: 200, hgt: 0, guy: 0, shape: 'round', color: '#6d7f8f', door: 'none', memo: '대형' },
    { id: 'veh-small', name: '차량 · 소형', maker: '', cat: '차량', w: 430, d: 180, hgt: 0, guy: 0, shape: 'round', color: '#7b8a98', door: 'none', memo: '소형' },
    { id: 'etc-car', name: '주차구역 (480×200)', maker: '', cat: '차량', w: 480, d: 200, hgt: 0, guy: 0, shape: 'round', color: '#4a5568', door: 'none', memo: '주차' },
    // --- 장애물 (사이트에 원래 있는 것) ---
    { id: 'obs-tree', name: '나무 기둥', maker: '', cat: '장애물', w: 40, d: 40, hgt: 0, guy: 0, shape: 'circle', color: '#6f9450', door: 'none', memo: '나무' },
    { id: 'obs-box', name: '전기 배전함', maker: '', cat: '장애물', w: 60, d: 40, hgt: 0, guy: 0, shape: 'rect', color: '#9a9a86', door: 'none', memo: '배전함' },
    // --- 수납·기타 ---
    { id: 'etc-cargobox', name: '카고박스', maker: '', cat: '수납·기타', w: 60, d: 40, hgt: 35, guy: 0, shape: 'round', color: '#c98f5a', door: 'none', memo: '수납' },
    { id: 'etc-cooler', name: '쿨러 60', maker: '', cat: '수납·기타', w: 60, d: 40, hgt: 40, guy: 0, shape: 'round', color: '#5f7fa8', door: 'none', memo: '' },
    { id: 'etc-shelf', name: '쉘프/선반', maker: '', cat: '수납·기타', w: 90, d: 40, hgt: 80, guy: 0, shape: 'round', color: '#8d7f6e', door: 'none', memo: '' }
  ];

  /* ============================== 유틸 ============================== */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = (p) => (p || 'id') + Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-4);
  const normDeg = (d) => ((d % 360) + 360) % 360;
  const fmt = (n) => (Math.round(n * 10) / 10).toString();

  function withA(hex, a) {
    const h = String(hex || '#888888').replace('#', '');
    const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(v, 16);
    if (isNaN(n)) return 'rgba(140,160,180,' + a + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // 색 밝기 조절 — k>0 밝게, k<0 어둡게 (장비 입체감 표현용)
  function shade(hex, k) {
    const h = String(hex || '#888888').replace('#', '');
    const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    let n = parseInt(v, 16);
    if (isNaN(n)) n = 0x888888;
    let r = (n >> 16) & 255, g2 = (n >> 8) & 255, b = n & 255;
    if (k >= 0) { r += (255 - r) * k; g2 += (255 - g2) * k; b += (255 - b) * k; }
    else { r *= (1 + k); g2 *= (1 + k); b *= (1 + k); }
    return 'rgb(' + Math.round(clamp(r, 0, 255)) + ',' + Math.round(clamp(g2, 0, 255)) + ',' + Math.round(clamp(b, 0, 255)) + ')';
  }

  // hex 색 밝기 조절 (hex 반환 — withA 에 그대로 넣을 수 있게)
  function tintHex(hex, k) {
    const h = String(hex || '#888888').replace('#', '');
    const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    let n = parseInt(v, 16);
    if (isNaN(n)) n = 0x888888;
    let r = (n >> 16) & 255, g2 = (n >> 8) & 255, b = n & 255;
    if (k >= 0) { r += (255 - r) * k; g2 += (255 - g2) * k; b += (255 - b) * k; }
    else { r *= (1 + k); g2 *= (1 + k); b *= (1 + k); }
    return '#' + [r, g2, b].map((x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0')).join('');
  }

  function normLrot(v) {
    const n = Math.round((+v || 0) / 90) * 90;
    return ((n % 360) + 360) % 360;
  }

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    requestAnimationFrame(() => { t.style.opacity = '1'; t.style.transform = 'translate(-50%,0)'; });
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translate(-50%,8px)';
      setTimeout(() => { t.hidden = true; }, 260);
    }, 2200);
  }

  /* ============================== 상태 ============================== */
  let S = null;          // { site:{w,d,floor,grid}, snap, guy, unit, library:[], items:[] }
  let plans = [];
  let selId = null;
  const view = { scale: 0.8, ox: 0, oy: 0, auto: true };
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  let lastIssues = { outIds: new Set(), pairs: [], overlapIds: new Set(), guyPairs: 0 };
  let issueSig = '';

  let cv, ctx, W = 0, H = 0, DPR = 1;
  const texCache = {};

  function defaultState() {
    return {
      site: { w: 500, d: 700, floor: 'deck', grid: 'm1' },
      snap: true, guy: true, unit: 'cm',
      wind: { on: true, dir: 90 },
      library: clone(DEFAULT_LIBRARY),
      items: []
    };
  }

  function loadState() {
    S = defaultState();
    let first = true;
    let paletteMoved = false;
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.site && typeof d.site.w === 'number') {
          first = false;
          S.site = {
            w: clamp(+d.site.w || 500, 50, 5000),
            d: clamp(+d.site.d || 700, 50, 5000),
            floor: FLOORS[d.site.floor] ? d.site.floor : 'deck',
            grid: ['off', 'm1', 'm05'].indexOf(d.site.grid) >= 0 ? d.site.grid : 'm1'
          };
          S.snap = d.snap !== false;
          S.guy = d.guy !== false;
          S.unit = d.unit === 'm' ? 'm' : 'cm';
          if (d.wind && typeof d.wind === 'object') {
            S.wind = { on: d.wind.on !== false, dir: (isFinite(+d.wind.dir) ? normDeg(+d.wind.dir) : 90) };
          }
          if (Array.isArray(d.library) && d.library.length) S.library = d.library.filter(validLib);
          if (Array.isArray(d.items)) S.items = d.items.filter(validItem).map(fixItem);
          if (!(d.palette >= PALETTE_V)) {          // 옛 기본색(민트·보라 등) → 실제 제품색
            migratePalette(S.library);
            migratePalette(S.items);
            paletteMoved = true;
          }
        }
      }
    } catch (e) { /* 저장소를 못 쓰는 환경이면 기본값으로 */ }

    if (!first && !S.library.length) S.library = clone(DEFAULT_LIBRARY);

    if (first) {
      // 첫 실행: 5×7m 데크에 야크돔 450을 놓아 둔 화면으로 시작
      const lib = S.library.find((l) => l.id === 'tent-yakdome450') || S.library[0];
      if (lib) {
        S.items.push(makeItem(lib, S.site.w / 2, Math.min(S.site.d - lib.d / 2 - 40, 330)));
      }
    }

    if (paletteMoved) persist();   // 옮긴 색을 바로 저장해 다시 계산하지 않게

    try {
      const rawP = localStorage.getItem(PLAN_KEY);
      if (rawP) {
        const p = JSON.parse(rawP);
        if (Array.isArray(p)) plans = p.filter((x) => x && x.name && x.site);
      }
    } catch (e) { plans = []; }
  }

  function validLib(e) {
    return e && typeof e.name === 'string' && +e.w > 0 && +e.d > 0;
  }
  function validItem(e) {
    return e && typeof e.name === 'string' && +e.w > 0 && +e.d > 0 && isFinite(+e.x) && isFinite(+e.y);
  }
  function fixItem(e) {
    const cat = CATS.indexOf(e.cat) >= 0 ? e.cat : '화기·기타';
    const isCover = cat === '텐트' || cat === '타프';
    return {
      id: e.id || uid('it'),
      libId: e.libId || null,
      name: String(e.name).slice(0, 30),
      cat: cat,
      w: clamp(+e.w, 10, 3000),
      d: clamp(+e.d, 10, 3000),
      hgt: clamp(+e.hgt || 0, 0, 400),
      guy: clamp(+e.guy || 0, 0, 400),
      shape: ['rect', 'round', 'circle', 'hex'].indexOf(e.shape) >= 0 ? e.shape : 'rect',
      color: /^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : '#7aa7d9',
      door: ['none', 'front', 'back', 'left', 'right'].indexOf(e.door) >= 0 ? e.door : 'none',
      memo: e.memo ? String(e.memo).slice(0, 24) : '',
      carStyle: e.carStyle || null,
      lrot: normLrot(e.lrot),
      lside: L_SIDES.indexOf(e.lside) >= 0 ? e.lside : (isCover ? 'b' : 'c'),
      lflip: L_FLIPS.indexOf(e.lflip) >= 0 ? e.lflip : 'n',
      x: +e.x, y: +e.y, rot: normDeg(+e.rot || 0)
    };
  }

  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
          v: 1, palette: PALETTE_V, site: S.site, snap: S.snap, guy: S.guy, unit: S.unit, wind: S.wind,
          library: S.library, items: S.items
        }));
      } catch (e) { /* 저장 불가 환경 무시 */ }
    }, 180);
  }
  function persistPlans() {
    try { localStorage.setItem(PLAN_KEY, JSON.stringify(plans)); } catch (e) { }
  }

  /* ============================== 도형·판정 ============================== */
  function rotPt(x, y, deg) {
    const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return { x: x * c - y * s, y: x * s + y * c };
  }

  function itemPoly(it, grow) {
    const g = grow || 0;
    const hw = it.w / 2 + g, hd = it.d / 2 + g;
    const pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
    return pts.map((p) => {
      const r = rotPt(p[0], p[1], it.rot);
      return { x: it.x + r.x, y: it.y + r.y };
    });
  }

  function aabb(poly) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    poly.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
    return { minX, minY, maxX, maxY };
  }

  function overlapPoly(A, B) {
    const polys = [A, B];
    for (let k = 0; k < 2; k++) {
      const P = polys[k];
      for (let i = 0; i < P.length; i++) {
        const p1 = P[i], p2 = P[(i + 1) % P.length];
        let nx = -(p2.y - p1.y), ny = p2.x - p1.x;
        const len = Math.hypot(nx, ny) || 1;
        nx /= len; ny /= len;
        let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
        for (let a = 0; a < A.length; a++) { const v = A[a].x * nx + A[a].y * ny; if (v < minA) minA = v; if (v > maxA) maxA = v; }
        for (let b = 0; b < B.length; b++) { const v = B[b].x * nx + B[b].y * ny; if (v < minB) minB = v; if (v > maxB) maxB = v; }
        if (maxA <= minB + EPS || maxB <= minA + EPS) return false;
      }
    }
    return true;
  }

  function isOutPoly(poly) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      if (p.x < -EPS || p.y < -EPS || p.x > S.site.w + EPS || p.y > S.site.d + EPS) return true;
    }
    return false;
  }

  /* 층 구성 — 텐트·타프(덮개)가 바닥에 깔리고, 그 위에 가구·수납·화기가 놓입니다.
     덮개 안에 가구를 넣는 것은 '내부 배치'라 겹침 경고를 하지 않습니다. */
  function groupOf(it) {
    if (it.cat === '장애물') return 'obstacle';
    if (it.cat === '차량' || /차량|주차/.test(it.name || '')) return 'vehicle';
    if (it.cat === '텐트' || it.cat === '타프') return 'cover';
    return 'gear';
  }
  function zOf(it) {
    const g = groupOf(it);
    return g === 'cover' ? 0 : g === 'vehicle' ? 1 : g === 'gear' ? 2 : 3;
  }
  function conflicts(a, b) {
    const ga = groupOf(a), gb = groupOf(b);
    if (ga === 'obstacle' || gb === 'obstacle') return true; // 나무·배전함은 무엇과 겹쳐도 경고
    if (ga === 'vehicle' || gb === 'vehicle') return true;   // 차량은 모든 장비와 충돌
    if (ga === 'cover' && gb === 'cover') return true;       // 텐트 ↔ 텐트·타프
    if (ga === 'gear' && gb === 'gear') return true;         // 가구·수납·화기끼리
    return false;                                            // 덮개 ↔ 가구 = 내부 배치
  }

  function analyze() {
    const polys = S.items.map((it) => itemPoly(it));
    const outIds = new Set();
    const pairs = [];
    const overlapIds = new Set();
    for (let i = 0; i < S.items.length; i++) if (isOutPoly(polys[i])) outIds.add(S.items[i].id);
    for (let i = 0; i < polys.length; i++) {
      for (let j = i + 1; j < polys.length; j++) {
        if (!conflicts(S.items[i], S.items[j])) continue;
        if (overlapPoly(polys[i], polys[j])) {
          pairs.push([S.items[i], S.items[j]]);
          overlapIds.add(S.items[i].id);
          overlapIds.add(S.items[j].id);
        }
      }
    }
    let guyPairs = 0;
    if (S.guy) {
      const gp = S.items.map((it) => itemPoly(it, it.guy || 0));
      for (let i = 0; i < gp.length; i++) {
        for (let j = i + 1; j < gp.length; j++) {
          if (!conflicts(S.items[i], S.items[j])) continue;
          if (overlapPoly(gp[i], gp[j]) && !overlapPoly(polys[i], polys[j])) guyPairs++;
        }
      }
    }
    return { outIds, pairs, overlapIds, guyPairs };
  }

  const getItem = (id) => S.items.find((i) => i.id === id) || null;
  const getSel = () => (selId ? getItem(selId) : null);

  function makeItem(lib, x, y) {
    const isCover = lib.cat === '텐트' || lib.cat === '타프';
    return {
      id: uid('it'), libId: lib.id, name: lib.name, cat: lib.cat,
      w: +lib.w, d: +lib.d, hgt: +lib.hgt || 0, guy: +lib.guy || 0,
      shape: lib.shape || 'rect', color: lib.color || '#7aa7d9', door: lib.door || 'none',
      memo: lib.memo || '', carStyle: lib.carStyle || null, x: x, y: y, rot: 0,
      lrot: normLrot(lib.lrot), lside: L_SIDES.indexOf(lib.lside) >= 0 ? lib.lside : (isCover ? 'b' : 'c'),
      lflip: L_FLIPS.indexOf(lib.lflip) >= 0 ? lib.lflip : 'n'
    };
  }

  function findFreeSpot(item) {
    const w2 = item.w / 2, d2 = item.d / 2;
    const cx = S.site.w / 2, cy = S.site.d / 2;
    const cands = [];
    const stepX = Math.max(10, Math.round(item.w / 8 / 10) * 10);
    const stepY = Math.max(10, Math.round(item.d / 8 / 10) * 10);
    for (let y = d2; y <= S.site.d - d2 + 0.1; y += stepY) {
      for (let x = w2; x <= S.site.w - w2 + 0.1; x += stepX) {
        const probe = Object.assign({}, item, { x: x, y: y, rot: item.rot || 0 });
        const poly = itemPoly(probe);
        if (!S.items.some((o) => overlapPoly(poly, itemPoly(o)))) {
          cands.push({ x, y });
        }
      }
    }
    if (!cands.length) return { x: cx, y: cy };
    cands.sort((a, b) => ((a.x - cx) * (a.x - cx) + (a.y - cy) * (a.y - cy)) - ((b.x - cx) * (b.x - cx) + (b.y - cy) * (b.y - cy)));
    return cands[0];
  }

  /* ============================== 자동 배치 ============================== */
  function nudgeInside(it) {
    const b = aabb(itemPoly(it));
    const w = b.maxX - b.minX, h = b.maxY - b.minY;
    let dx = 0, dy = 0;
    if (w >= S.site.w) dx = S.site.w / 2 - (b.minX + b.maxX) / 2;
    else {
      if (b.minX < 0) dx = -b.minX;
      if (b.maxX + dx > S.site.w) dx = S.site.w - b.maxX;
    }
    if (h >= S.site.d) dy = S.site.d / 2 - (b.minY + b.maxY) / 2;
    else {
      if (b.minY < 0) dy = -b.minY;
      if (b.maxY + dy > S.site.d) dy = S.site.d - b.maxY;
    }
    it.x += dx; it.y += dy;
  }

  function aabbOverlapArea(pa, pb) {
    const a = aabb(pa), b = aabb(pb);
    const w = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const h = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
    return (w > 0 && h > 0) ? w * h : 0;
  }

  function coverSpot(c, area, vehicles, placed, obstacles) {
    let best = null, fallback = null;
    const cx0 = (area.x0 + area.x1) / 2;
    const blockers = (placed || []).concat(vehicles || [], obstacles || []);
    [0, 90].forEach((rot) => {
      const w = rot === 90 ? c.d : c.w;
      const d = rot === 90 ? c.w : c.d;
      if (w > area.x1 - area.x0 + 0.1 || d > area.y1 - area.y0 + 0.1) return;
      for (let y = area.y1 - d / 2; y >= area.y0 + d / 2 - 0.01; y -= 10) {
        for (let x = area.x0 + w / 2; x <= area.x1 - w / 2 + 0.01; x += 10) {
          const poly = itemPoly({ x: x, y: y, rot: rot, w: c.w, d: c.d });
          let penalty = 0;
          for (let i = 0; i < blockers.length; i++) penalty += aabbOverlapArea(poly, itemPoly(blockers[i]));
          // 사이트 안쪽 위(뒤쪽)에 붙이고 가운데 정렬
          const score = Math.abs(x - cx0) * 0.6 + (y - (area.y0 + d / 2)) * 0.9 + (rot ? 3 : 0);
          if (penalty <= 0.5) {
            if (!best || score < best.score) best = { x: x, y: y, rot: rot, score: score };
          } else if (!fallback || penalty < fallback.penalty) {
            fallback = { x: x, y: y, rot: rot, penalty: penalty };
          }
        }
      }
    });
    return best || fallback || { x: cx0, y: area.y0 + c.d / 2, rot: 0 };
  }

  function autoArrange() {
    if (!S.items.length) { toast('먼저 장비를 올려 주세요'); return; }
    const margin = 15, gap = 15;
    const vehicles = S.items.filter((i) => groupOf(i) === 'vehicle');
    const covers = S.items.filter((i) => groupOf(i) === 'cover').sort((a, b) => b.w * b.d - a.w * a.d);
    const gears = S.items.filter((i) => groupOf(i) === 'gear').sort((a, b) => b.w * b.d - a.w * a.d);
    const obstacles = S.items.filter((i) => groupOf(i) === 'obstacle');   // 나무·배전함은 고정

    // 옛 위치가 자리를 막지 않도록 잠시 사이트 밖으로
    covers.forEach((c, i) => { c.x = -9000 - i * 900; c.y = S.site.d / 2; });
    gears.forEach((g, i) => { g.x = -9000 - i * 900; g.y = S.site.d / 2; });

    // 1) 차량 — 사이트 아래쪽부터 비어 있는 자리에 주차 (나무·배전함 피해서)
    let bottomLimit = S.site.d - margin;
    if (vehicles.length) {
      const placedVeh = [];
      const vM = 10;   // 차는 사이트 폭을 꽉 쓰는 경우가 많아 여유를 조금만
      vehicles.forEach((v) => {
        const maxW = S.site.w - vM * 2;
        v.rot = (v.w > maxW && v.d <= maxW) ? 90 : 0;
        const vw = v.rot === 90 ? v.d : v.w;
        const vd = v.rot === 90 ? v.w : v.d;
        let best = null;
        for (let y = S.site.d - vM - vd / 2; y >= vM + vd / 2 - 0.01; y -= 10) {
          for (let x = vM + vw / 2; x <= S.site.w - vM - vw / 2 + 0.01; x += 10) {
            const poly = itemPoly({ x: x, y: y, rot: v.rot, w: v.w, d: v.d });
            let bad = false;
            for (let i = 0; i < obstacles.length && !bad; i++) bad = overlapPoly(poly, itemPoly(obstacles[i]));
            for (let i = 0; i < placedVeh.length && !bad; i++) bad = overlapPoly(poly, itemPoly(placedVeh[i]));
            if (bad) continue;
            const score = (S.site.d - y) * 1 + Math.abs(x - S.site.w / 2) * 0.02;
            if (!best || score < best.score) best = { x: x, y: y, score: score };
          }
        }
        if (best) { v.x = best.x; v.y = best.y; }
        else { v.x = S.site.w / 2; v.y = S.site.d - vM - vd / 2; }
        placedVeh.push(v);
      });
      let top = S.site.d;
      vehicles.forEach((v) => { top = Math.min(top, aabb(itemPoly(v)).minY); });
      bottomLimit = top - gap;
    }

    const area = { x0: margin, y0: margin, x1: S.site.w - margin, y1: Math.max(margin + 40, bottomLimit) };

    // 2) 텐트·타프 — 큰 것부터 남은 공간에
    const placedCovers = [];
    covers.forEach((c) => {
      const spot = coverSpot(c, area, vehicles, placedCovers, obstacles);
      c.x = spot.x; c.y = spot.y; c.rot = spot.rot;
      placedCovers.push(c);
    });

    // 3) 가구·수납·화기 — 가장 큰 텐트(거실) 안에 줄 맞춰
    const host = covers[0] || null;
    const rest = [];
    if (host) {
      const pad = 20, gGap = 12;
      const halfW = host.w / 2 - pad, halfD = host.d / 2 - pad;
      let cx = -halfW, cy = -halfD, rowD = 0;
      gears.forEach((g) => {
        if (halfW <= 10 || halfD <= 10 || g.w > halfW * 2 || g.d > halfD * 2) { rest.push(g); return; }
        if (cx + g.w > halfW + 0.1 && cx > -halfW + 0.1) { cx = -halfW; cy += rowD + gGap; rowD = 0; }
        if (cy + g.d > halfD + 0.1) { rest.push(g); return; }
        const p = rotPt(cx + g.w / 2, cy + g.d / 2, host.rot);
        const wx = host.x + p.x, wy = host.y + p.y;
        const wpoly = itemPoly({ x: wx, y: wy, rot: host.rot, w: g.w, d: g.d });
        if (obstacles.some((o) => overlapPoly(wpoly, itemPoly(o)))) { rest.push(g); return; }
        g.x = wx; g.y = wy; g.rot = host.rot;
        cx += g.w + gGap;
        rowD = Math.max(rowD, g.d);
      });
    } else {
      gears.forEach((g) => rest.push(g));
    }

    // 4) 남은 장비 — 빈 곳 스캔 (차량·이미 놓은 장비와 겹치지 않게)
    rest.forEach((g) => {
      g.rot = 0;
      let best = null;
      for (let y = margin + g.d / 2; y <= S.site.d - margin - g.d / 2 + 0.1; y += 10) {
        for (let x = margin + g.w / 2; x <= S.site.w - margin - g.w / 2 + 0.1; x += 10) {
          const poly = itemPoly({ x: x, y: y, rot: 0, w: g.w, d: g.d });
          let bad = false;
          for (let i = 0; i < vehicles.length && !bad; i++) bad = overlapPoly(poly, itemPoly(vehicles[i]));
          for (let i = 0; i < obstacles.length && !bad; i++) bad = overlapPoly(poly, itemPoly(obstacles[i]));
          for (let i = 0; i < gears.length && !bad; i++) {
            const o = gears[i];
            if (o !== g && o.x > -5000 && overlapPoly(poly, itemPoly(o))) bad = true;
          }
          if (bad) continue;
          const inside = host ? overlapPoly(poly, itemPoly(host)) : false;
          const dh = host ? Math.hypot(x - host.x, y - host.y) : 0;
          const score = (inside ? -800 : 0) + dh;
          if (!best || score < best.score) best = { x: x, y: y, score: score };
        }
      }
      if (best) { g.x = best.x; g.y = best.y; }
      else { g.x = S.site.w / 2; g.y = S.site.d / 2; }
    });

    // 5) 사이트 밖으로 나간 장비는 안으로 당기기
    S.items.forEach((it) => {
      if (groupOf(it) === 'obstacle') return;   // 나무·배전함은 사용자가 놓은 자리 그대로
      if (it.x < -5000) { it.x = S.site.w / 2; it.y = S.site.d / 2; }
      nudgeInside(it);
    });

    persist();
    render();
    toast('✨ 자동 배치 완료 — 손으로 옮겨 다듬으세요');
  }

  /* ============================== 화면 ============================== */
  function fitScale() {
    const padX = 30, padY = 26;
    return Math.max(0.005, Math.min((W - padX * 2) / S.site.w, (H - padY * 2) / S.site.d));
  }

  function fitView() {
    view.scale = fitScale();
    view.ox = (W - S.site.w * view.scale) / 2;
    view.oy = (H - S.site.d * view.scale) / 2;
    view.auto = true;
  }

  function resizeCanvas() {
    const wrap = $('#canvasWrap');
    const r = wrap.getBoundingClientRect();
    DPR = clamp(window.devicePixelRatio || 1, 1, 2.5);
    W = Math.max(120, Math.round(r.width));
    H = Math.max(120, Math.round(r.height));
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    cv.style.width = W + 'px';
    cv.style.height = H + 'px';
    if (view.auto) fitView();
    render();
  }

  function toS(x, y) {
    return { x: view.ox + x * view.scale, y: view.oy + y * view.scale };
  }
  function toWorld(clientX, clientY) {
    const r = cv.getBoundingClientRect();
    return { x: (clientX - r.left - view.ox) / view.scale, y: (clientY - r.top - view.oy) / view.scale };
  }

  function floorPattern(kind) {
    if (texCache[kind]) return texCache[kind];
    const c = document.createElement('canvas');
    c.width = 140; c.height = 140;
    const g = c.getContext('2d');
    if (kind === 'deck') {
      g.fillStyle = '#b1855a'; g.fillRect(0, 0, 140, 140);
      for (let y = 0; y < 140; y += 32) {
        g.fillStyle = 'rgba(84,57,31,.34)'; g.fillRect(0, y, 140, 2);
        g.fillStyle = 'rgba(255,236,203,.12)'; g.fillRect(0, y + 2, 140, 2);
      }
      for (let i = 0; i < 30; i++) {
        g.fillStyle = 'rgba(80,55,30,.10)';
        g.fillRect(Math.random() * 140, Math.random() * 140, 16 + Math.random() * 34, 1);
      }
    } else if (kind === 'gravel') {
      g.fillStyle = '#a9a49a'; g.fillRect(0, 0, 140, 140);
      for (let i = 0; i < 240; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(68,66,62,.30)' : 'rgba(255,255,255,.26)';
        g.beginPath();
        g.arc(Math.random() * 140, Math.random() * 140, 0.7 + Math.random() * 1.7, 0, TAU);
        g.fill();
      }
    } else {
      g.fillStyle = '#6e9a53'; g.fillRect(0, 0, 140, 140);
      for (let i = 0; i < 170; i++) {
        g.strokeStyle = Math.random() < 0.5 ? 'rgba(44,78,30,.34)' : 'rgba(196,226,152,.26)';
        g.lineWidth = 1;
        const x = Math.random() * 140, y = Math.random() * 140;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1.6, y - 3.6); g.stroke();
      }
    }
    const p = ctx.createPattern(c, 'repeat');
    texCache[kind] = p;
    return p;
  }

  function pathShape(g, shape, w, d, radius) {
    const hw = Math.max(w / 2, 0.5), hd = Math.max(d / 2, 0.5);
    if (shape === 'circle') {
      g.ellipse(0, 0, hw, hd, 0, 0, TAU);
      return;
    }
    if (shape === 'hex') {
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + i * TAU / 6;
        const x = Math.cos(a) * hw, y = Math.sin(a) * hd;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath();
      return;
    }
    const r = Math.min(radius || 0, hw, hd);
    if (shape === 'round' && r > 0.8) {
      g.moveTo(-hw + r, -hd);
      g.lineTo(hw - r, -hd); g.quadraticCurveTo(hw, -hd, hw, -hd + r);
      g.lineTo(hw, hd - r); g.quadraticCurveTo(hw, hd, hw - r, hd);
      g.lineTo(-hw + r, hd); g.quadraticCurveTo(-hw, hd, -hw, hd - r);
      g.lineTo(-hw, -hd + r); g.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
      g.closePath();
    } else {
      g.rect(-hw, -hd, hw * 2, hd * 2);
    }
  }

  function doorLine(door, w, d, inset) {
    const m = inset;
    switch (door) {
      case 'front': return { x1: -w * 0.24, y1: -d / 2 + m, x2: w * 0.24, y2: -d / 2 + m, nx: 0, ny: -1 };
      case 'back': return { x1: -w * 0.24, y1: d / 2 - m, x2: w * 0.24, y2: d / 2 - m, nx: 0, ny: 1 };
      case 'left': return { x1: -w / 2 + m, y1: -d * 0.24, x2: -w / 2 + m, y2: d * 0.24, nx: -1, ny: 0 };
      case 'right': return { x1: w / 2 - m, y1: -d * 0.24, x2: w / 2 - m, y2: d * 0.24, nx: 1, ny: 0 };
      default: return null;
    }
  }

  function rrPath(g, x, y, w, h, r) {
    const rad = Math.max(0, Math.min(r, w / 2, h / 2));
    g.moveTo(x + rad, y);
    g.lineTo(x + w - rad, y); g.quadraticCurveTo(x + w, y, x + w, y + rad);
    g.lineTo(x + w, y + h - rad); g.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    g.lineTo(x + rad, y + h); g.quadraticCurveTo(x, y + h, x, y + h - rad);
    g.lineTo(x, y + rad); g.quadraticCurveTo(x, y, x + rad, y);
    g.closePath();
  }

  /* ==================== 장비별 '위에서 본 모습' 디테일 ==================== */
  /* 카테고리·이름·메모로 장비 종류를 알아내 그 종류에 맞는 평면 모습을 그립니다. */
  function kindOf(it) {
    const n = (it.name || '') + ' ' + (it.memo || '');
    const cat = it.cat;
    if (cat === '차량' || groupOf(it) === 'vehicle') return 'vehicle';
    if (cat === '텐트') {
      if (/에어|air/i.test(n)) return 'tent-air';
      if (/터널|tunnel/i.test(n)) return 'tent-tunnel';
      if (/로지|ridge|빌리지/i.test(n)) return 'tent-ridge';
      return 'tent-dome';
    }
    if (cat === '타프') return (it.shape === 'hex' || /헥사|hexa/i.test(n)) ? 'tarp-hex' : 'tarp-rect';
    if (/야전침대|침대|cot/i.test(n)) return 'cot';
    if (/igt|버너|플레이트|불판/i.test(n)) return 'table-igt';
    if (/테이블|table|상/i.test(n)) return 'table';
    if (/체어|의자|chair|릴렉스|릴렉/i.test(n)) return 'chair';
    if (/쉘프|선반|shelf|랙/i.test(n)) return 'shelf';
    if (/화로|난로|스토브|그릴|버너|fire|stove/i.test(n)) return 'fire';
    if (/나무|tree|목/i.test(n)) return 'tree';
    if (/배전|분전|전기|power/i.test(n)) return 'power';
    if (/쿨러|cooler/i.test(n)) return 'cooler';
    if (/박스|box|케이스|수납/i.test(n)) return 'box';
    return 'generic';
  }

  /* ==================== 텐트 제품별 대표 색·구조 (2D·3D 공용) ==================== */
  /* 실제 제품의 대표 색과 부품 색. 이름으로 제품을 알아내고, 모르는 텐트는 종류별 기본값. */
  const TENT_LOOKS = {
    village: { body: '#d6c7ab', fly: '#3a3e44', pole: '#2b2f34', mesh: '#22262b' },
    yakdome: { body: '#ab8557', fly: '#9d7850', pole: '#3d4238', mesh: '#26241f' },
    modelv: { body: '#d2c7b2', fly: '#c2b7a0', pole: '#6a6357', mesh: '#24282c' },
    timax: { body: '#ded6c5', fly: '#c7beab', pole: '#565b62', mesh: '#23272c' },
    raum: { body: '#d3a3a0', fly: '#c89492', pole: '#5a4f4c', mesh: '#2a2624' },
    poler: { body: '#c96a3f', fly: '#b85f37', pole: '#4a4640', mesh: '#2b2622' },
    geoair: { body: '#9c968c', fly: '#aaa49b', pole: '#4d4a45', mesh: '#23262a' }
  };
  function tentLookOf(it) {
    const n = ((it && it.name) || '') + ' ' + ((it && it.memo) || '');
    let look = '';
    if (/빌리지|village|로지|ridge/i.test(n)) look = 'village';
    else if (/야크돔|yak/i.test(n)) look = 'yakdome';
    else if (/모델\s*v|model\s*v|위켄/i.test(n)) look = 'modelv';
    else if (/티맥스|timax|제드/i.test(n)) look = 'timax';
    else if (/라움|raum|트레블첵/i.test(n)) look = 'raum';
    else if (/폴러|poler|투맨/i.test(n)) look = 'poler';
    else if (/지오에어|geoair|디얼스/i.test(n)) look = 'geoair';
    if (!look) {
      const k = kindOf(it);
      look = k === 'tent-tunnel' ? 'modelv' : k === 'tent-ridge' ? 'village' : k === 'tent-air' ? 'geoair' : 'yakdome';
    }
    return { look: look, spec: TENT_LOOKS[look] };
  }

  /* 이전 기본 팔레트(민트·보라 등)로 저장된 텐트·타프 색을 실제 제품색으로 옮깁니다. */
  const PALETTE_V = 2;
  const OLD_TENT_COLORS = {
    'tent-yakdome450': '#4f8df7', 'tent-modelv': '#3ecf8e', 'tent-timaxex': '#f5a24b',
    'tent-raummini': '#b07cf5', 'tent-poler2': '#f25f6a', 'tent-village5': '#2fc7c0',
    'tent-geoair4': '#e879c0', 'tarp-recta440': '#9dc45a', 'tarp-hexa': '#6fa8c9'
  };
  function migratePalette(list) {
    (list || []).forEach((e) => {
      const key = OLD_TENT_COLORS[e.id] ? e.id : (e.libId || '');
      const old = OLD_TENT_COLORS[key];
      if (!old) return;
      if (String(e.color || '').toLowerCase() === old) {
        const d = DEFAULT_LIBRARY.find((x) => x.id === key);
        if (d) e.color = d.color;
      }
    });
  }

  function bodyPath(g, it, w, d) {
    g.beginPath();
    pathShape(g, it.shape, w, d, Math.min(w, d) * 0.2);
  }

  // 차를 위에서 본 모습 — 둥근 차체 윤곽, 앞·뒤 유리, 사이드미러, 루프레일, 헤드/테일램프
  function drawVehicle(g, it, w, d, lw) {
    const hw = w / 2, hd = d / 2;
    const style = carStyleOf(it);
    const iron = style === 'ironman';
    const dark = style === 'black';
    const paint = /^#[0-9a-f]{6}$/i.test(it.color || '') ? it.color : (dark ? '#0e1013' : '#5b6b82');
    const bodyLit = shade(paint, 0.1);
    const bodyDark = shade(paint, -0.16);
    const glass = 'rgba(112,152,192,.82)';
    const glassDark = 'rgba(14,20,28,.35)';
    const R = Math.min(hw, hd) * (dark ? 0.16 : 0.3);
    const nose = Math.min(hw, hd) * (dark ? 0.1 : 0.24);
    const tail = Math.min(hw, hd) * 0.14;

    // 타이어 — 차체 옆으로 살짝
    g.fillStyle = 'rgba(6,8,11,.95)';
    const tw = Math.max(3, w * 0.055), th = Math.max(2.5, d * 0.1);
    [-0.55, 0.58].forEach((fx) => {
      [-1, 1].forEach((sy) => {
        g.beginPath();
        rrPath(g, hw * fx - tw / 2, sy < 0 ? -hd - th * 0.22 : hd - th * 0.78, tw, th, th * 0.3);
        g.fill();
      });
    });

    // 차체
    g.beginPath();
    g.moveTo(-hw + nose, -hd);
    g.lineTo(hw - tail, -hd);
    g.quadraticCurveTo(hw, -hd, hw, -hd + R);
    g.lineTo(hw, hd - R);
    g.quadraticCurveTo(hw, hd, hw - tail, hd);
    g.lineTo(-hw + nose, hd);
    g.quadraticCurveTo(-hw, hd, -hw, hd - nose);
    g.lineTo(-hw, -hd + nose);
    g.quadraticCurveTo(-hw, -hd, -hw + nose, -hd);
    g.closePath();
    const grd = g.createLinearGradient(-hw, 0, hw, 0);
    grd.addColorStop(0, bodyDark);
    grd.addColorStop(0.45, paint);
    grd.addColorStop(1, bodyLit);
    g.fillStyle = grd; g.fill();
    g.lineWidth = Math.max(1, lw * 0.8);
    g.strokeStyle = 'rgba(255,255,255,.24)'; g.stroke();
    g.save(); g.clip();   // 세부는 차체 안쪽에만

    // 보닛 패널 (앞) — 코나는 레드
    g.beginPath();
    rrPath(g, -hw * 0.95, -hd * 0.88, hw * 0.62, hd * 1.76, Math.min(hw, hd) * 0.26);
    g.fillStyle = iron ? '#b8232f' : shade(paint, 0.1);
    g.globalAlpha = iron ? 0.98 : 0.5; g.fill(); g.globalAlpha = 1;
    if (iron) {
      g.strokeStyle = 'rgba(216,166,60,.85)'; g.lineWidth = Math.max(1, lw * 0.8);
      g.beginPath(); rrPath(g, -hw * 0.95, -hd * 0.88, hw * 0.62, hd * 1.76, Math.min(hw, hd) * 0.26); g.stroke();
    }
    // 보닛 이음선
    g.strokeStyle = 'rgba(0,0,0,.26)'; g.lineWidth = Math.max(1, lw * 0.6);
    g.beginPath(); g.moveTo(-hw * 0.33, -hd * 0.9); g.lineTo(-hw * 0.33, hd * 0.9); g.stroke();

    // 창문 (앞유리 · 옆창 · 뒷유리) — 가는 기둥으로 나눔
    g.fillStyle = glass;
    // 앞유리 (앞이 좁은 사다리꼴)
    g.beginPath();
    g.moveTo(-hw * 0.3, -hd * 0.68); g.lineTo(-hw * 0.17, -hd * 0.74);
    g.lineTo(-hw * 0.17, hd * 0.74); g.lineTo(-hw * 0.3, hd * 0.68);
    g.closePath(); g.fill();
    // 뒷유리
    g.beginPath();
    g.moveTo(hw * 0.19, -hd * 0.72); g.lineTo(hw * 0.31, -hd * 0.66);
    g.lineTo(hw * 0.31, hd * 0.66); g.lineTo(hw * 0.19, hd * 0.72);
    g.closePath(); g.fill();
    // 옆창 (앞·뒤 두 칸)
    [-1, 1].forEach((sy) => {
      const y0 = sy < 0 ? -hd * 0.92 : hd * 0.76;
      g.beginPath(); rrPath(g, -hw * 0.14, y0, hw * 0.15, hd * 0.16, 2); g.fill();
      g.beginPath(); rrPath(g, hw * 0.04, y0, hw * 0.13, hd * 0.16, 2); g.fill();
    });
    // 유리 반사
    g.strokeStyle = 'rgba(226,242,255,.5)'; g.lineWidth = Math.max(0.8, lw * 0.6);
    g.beginPath();
    g.moveTo(-hw * 0.27, -hd * 0.5); g.lineTo(-hw * 0.2, -hd * 0.08);
    g.stroke();

    // 루프 (앞유리 ↔ 뒷유리) — 코나는 레드
    g.beginPath();
    rrPath(g, -hw * 0.16, -hd * 0.72, hw * 0.33, hd * 1.44, Math.min(hw, hd) * 0.14);
    g.fillStyle = iron ? '#c8232f' : shade(paint, 0.14);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = Math.max(0.8, lw * 0.5); g.stroke();

    // 루프레일 (코나 · 일반 SUV)
    if (!dark) {
      g.strokeStyle = iron ? 'rgba(216,166,60,.95)' : 'rgba(226,238,250,.45)';
      g.lineWidth = Math.max(1, lw * 0.9);
      g.beginPath();
      [-1, 1].forEach((sy) => {
        g.moveTo(-hw * 0.14, sy * hd * 0.64); g.lineTo(hw * 0.15, sy * hd * 0.64);
      });
      g.stroke();
    }

    // 사이드미러
    [-1, 1].forEach((sy) => {
      g.beginPath();
      rrPath(g, -hw * 0.32, sy < 0 ? -hd - Math.max(2, d * 0.06) : hd - Math.max(1, d * 0.02), Math.max(3, w * 0.04), Math.max(2, d * 0.08), 2);
      g.fillStyle = shade(paint, 0.06);
      g.fill();
    });

    // 헤드라이트 · 테일램프
    const hlW = Math.max(2, w * 0.026), hlH = Math.max(1.6, d * 0.1);
    g.fillStyle = iron ? 'rgba(255,236,178,.97)' : dark ? 'rgba(240,244,250,.9)' : 'rgba(255,250,226,.85)';
    [-1, 1].forEach((sy) => {
      g.beginPath();
      rrPath(g, -hw * 0.995, sy < 0 ? -hd * 0.7 : hd * 0.7 - hlH, hlW, hlH, hlH * 0.4);
      g.fill();
    });
    g.fillStyle = 'rgba(255,74,84,.95)';
    [-1, 1].forEach((sy) => {
      g.beginPath();
      rrPath(g, hw * 0.96, sy < 0 ? -hd * 0.72 : hd * 0.72 - hlH, hlW * 0.85, hlH, hlH * 0.35);
      g.fill();
    });

    // 차체 이음선 (도어)
    g.strokeStyle = glassDark; g.lineWidth = Math.max(0.8, lw * 0.5);
    g.beginPath();
    g.moveTo(-hw * 0.1, -hd * 0.98); g.lineTo(-hw * 0.1, -hd * 0.62);
    g.moveTo(-hw * 0.1, hd * 0.98); g.lineTo(-hw * 0.1, hd * 0.62);
    g.stroke();

    if (iron) {
      // 아이언맨 포인트 — 골드 라인 + 아크리액터
      g.strokeStyle = 'rgba(216,166,60,.95)';
      g.lineWidth = Math.max(1, lw * 0.9);
      g.beginPath();
      g.moveTo(-hw * 0.92, 0); g.lineTo(hw * 0.26, 0);
      g.stroke();
      g.beginPath();
      g.arc(-hw * 0.62, 0, Math.max(2, Math.min(hw, hd) * 0.09), 0, TAU);
      g.fillStyle = 'rgba(120,215,255,.92)'; g.fill();
      g.strokeStyle = 'rgba(216,166,60,.95)'; g.stroke();
    } else if (dark) {
      // 레이 — 각진 창 테두리 (박스카 느낌)
      g.strokeStyle = 'rgba(255,255,255,.2)';
      g.lineWidth = Math.max(1, lw * 0.7);
      g.beginPath();
      rrPath(g, -hw * 0.95, -hd * 0.9, hw * 1.88, hd * 1.8, Math.min(hw, hd) * 0.1);
      g.stroke();
    }
    g.restore();
  }

  /* ==================== 2D 평면 — 제품별 폴대·창문·캐노피 ==================== */
  function detailTentLook(g, it, w, d, lw, look) {
    const hw = w / 2, hd = d / 2;
    const spec = TENT_LOOKS[look];
    const body = /^#[0-9a-f]{6}$/i.test(it.color || '') ? it.color : spec.body;
    const flyC = withA(spec.fly, 0.95);
    const flyLit = withA(tintHex(spec.fly, 0.18), 0.95);
    const poleC = withA(spec.pole, 0.9);
    const meshC = 'rgba(18,22,27,.82)';
    const seamC = 'rgba(255,255,255,.3)';
    const thin = Math.max(0.8, lw * 0.7);
    const mid = Math.max(1, lw * 0.95);

    // 바닥 그림자 느낌(가장자리 어둡게)
    const edge = g.createLinearGradient(0, -hd, 0, hd);
    edge.addColorStop(0, 'rgba(255,255,255,.16)');
    edge.addColorStop(0.5, 'rgba(255,255,255,.02)');
    edge.addColorStop(1, 'rgba(0,0,0,.2)');
    g.fillStyle = edge;
    g.fillRect(-hw, -hd, w, d);
    g.lineCap = 'round';

    const ellipseArc = (rx, ry, rot, color, lwid) => {
      g.save(); g.rotate(rot);
      g.beginPath(); g.ellipse(0, 0, Math.max(1, rx), Math.max(1, ry), 0, 0, TAU);
      g.strokeStyle = color; g.lineWidth = lwid; g.stroke();
      g.restore();
    };
    const win = (x, y, ww, hh, rot) => {
      g.save();
      if (rot) g.rotate(rot);
      g.fillStyle = 'rgba(255,255,255,.5)';
      g.beginPath(); rrPath(g, x - ww / 2 - 1.2, y - hh / 2 - 1.2, ww + 2.4, hh + 2.4, 2); g.fill();
      g.fillStyle = meshC;
      g.beginPath(); rrPath(g, x - ww / 2, y - hh / 2, ww, hh, 1.6); g.fill();
      g.restore();
    };
    const doorPanel = (x, y, ww, hh, side) => {
      // side: 'f' 앞(-y), 'b' 뒤(+y), 'l', 'r'
      const rot = side === 'l' ? -Math.PI / 2 : side === 'r' ? Math.PI / 2 : 0;
      const px = side === 'l' ? -hw + 2 : side === 'r' ? hw - 2 : x;
      const py = side === 'f' ? -hd + 2 : side === 'b' ? hd - 2 : y;
      g.save();
      g.translate(px, py); g.rotate(rot);
      const yy = side === 'f' ? hh / 2 - 2 : side === 'b' ? -hh / 2 + 2 : 0;
      g.fillStyle = 'rgba(10,14,19,.5)';
      g.beginPath(); rrPath(g, -ww / 2, yy - hh / 2, ww, hh, 3); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(1, lw * 0.8); g.stroke();
      // 지퍼
      g.setLineDash([Math.max(2, lw * 1.8), Math.max(1.5, lw * 1.4)]);
      g.strokeStyle = 'rgba(255,255,255,.7)';
      g.beginPath(); g.moveTo(0, yy - hh / 2 + 1); g.lineTo(0, yy + hh / 2 - 1); g.stroke();
      g.setLineDash([]);
      g.restore();
    };

    if (look === 'village') {
      // 어두운 플라이(지붕) — 폭을 덮고 양옆에 베이지 자락
      g.fillStyle = flyC;
      g.beginPath(); rrPath(g, -hw * 0.87, -hd * 0.985, w * 0.87, d * 0.97, Math.min(w, d) * 0.1); g.fill();
      // 능선
      g.strokeStyle = flyLit; g.lineWidth = Math.max(1.4, lw * 1.3);
      g.beginPath(); g.moveTo(0, -hd * 0.97); g.lineTo(0, hd * 0.97); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = thin;
      [-0.42, 0.42].forEach((k) => { g.beginPath(); g.moveTo(hw * k, -hd * 0.96); g.lineTo(hw * k, hd * 0.96); g.stroke(); });
      // 옆면 메쉬 창 (양쪽 2개)
      [-1, 1].forEach((sx) => {
        win(sx * hw * 0.84, -hd * 0.26, Math.max(2.6, w * 0.075), d * 0.24, 0);
        win(sx * hw * 0.84, hd * 0.16, Math.max(2.6, w * 0.075), d * 0.22, 0);
      });
      // 앞 출입문 + 뒤 창
      doorPanel(0, 0, w * 0.44, d * 0.06, 'f');
      win(0, hd * 0.94, w * 0.36, Math.max(2.5, d * 0.05), 0);
      // 캐노피는 바깥쪽에 따로 (drawTentAwning2)
    } else if (look === 'yakdome') {
      // 지오데식 돔 — 3개의 교차 폴대
      ellipseArc(hw * 0.99, hd * 0.99, 0, poleC, mid);
      ellipseArc(hw * 0.99, hd * 0.99, Math.PI / 3, poleC, mid);
      ellipseArc(hw * 0.99, hd * 0.99, -Math.PI / 3, poleC, mid);
      ellipseArc(hw * 0.72, hd * 0.72, 0, 'rgba(255,255,255,.2)', thin);
      // 스커트
      g.strokeStyle = withA(spec.fly, 0.9); g.lineWidth = Math.max(1.2, lw * 1.1);
      g.beginPath(); rrPath(g, -hw * 0.93, -hd * 0.93, w * 0.86, d * 0.86, Math.min(w, d) * 0.42); g.stroke();
      // 환기캡
      g.beginPath(); g.arc(0, 0, Math.max(2, Math.min(w, d) * 0.06), 0, TAU);
      g.fillStyle = withA(spec.fly, 0.9); g.fill();
      // 앞 현관 + 문
      g.fillStyle = withA(spec.fly, 0.9);
      g.beginPath(); rrPath(g, -hw * 0.28, -hd * 1.0, w * 0.28, d * 0.12, 2); g.fill();
      doorPanel(0, 0, w * 0.36, d * 0.08, 'f');
    } else if (look === 'modelv' || look === 'timax' || look === 'geoair') {
      const beams = look === 'modelv' ? 4 : look === 'timax' ? 5 : 3;
      const thick = look === 'geoair';
      if (look === 'timax') {
        g.fillStyle = withA(spec.fly, 0.5);
        g.beginPath(); rrPath(g, -hw * 0.9, -hd * 0.96, w * 0.9, d * 0.92, Math.min(w, d) * 0.2); g.fill();
      }
      // 길이 방향 능선
      g.strokeStyle = look === 'geoair' ? withA(tintHex(body, 0.3), 0.8) : seamC;
      g.lineWidth = thick ? Math.max(2.4, lw * 2.2) : Math.max(1, lw * 0.8);
      g.beginPath(); g.moveTo(0, -hd * 0.97); g.lineTo(0, hd * 0.97); g.stroke();
      // 아치 폴대·에어빔
      for (let i = 0; i < beams; i++) {
        const y = -hd + (d * (i + 0.5)) / beams;
        g.beginPath();
        g.moveTo(-hw * 0.985, y);
        g.quadraticCurveTo(0, y + Math.min(w, d) * 0.045, hw * 0.985, y);
        g.strokeStyle = thick ? withA(tintHex(body, 0.22), 0.95) : poleC;
        g.lineWidth = thick ? Math.max(3, Math.min(w, d) * 0.05) : Math.max(1.2, lw * 1.05);
        g.stroke();
        if (thick) {
          g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = thin;
          g.beginPath();
          g.moveTo(-hw * 0.97, y - Math.min(w, d) * 0.012);
          g.quadraticCurveTo(0, y + Math.min(w, d) * 0.033, hw * 0.97, y - Math.min(w, d) * 0.012);
          g.stroke();
        }
      }
      // 옆면 큰 창
      const nWin = look === 'timax' ? 3 : 2;
      [-1, 1].forEach((sx) => {
        for (let i = 0; i < nWin; i++) {
          const y = -hd * 0.55 + (d * 0.72 * i) / Math.max(1, nWin - 1);
          win(sx * hw * 0.82, nWin === 1 ? 0 : y, Math.max(3, w * 0.085), d * 0.15, 0);
        }
      });
      doorPanel(0, 0, w * 0.5, d * 0.07, 'f');
      win(0, hd * 0.95, w * 0.3, Math.max(2.5, d * 0.045), 0);
    } else if (look === 'raum') {
      // 면 자립형 돔 — X 폴대
      ellipseArc(hw * 0.985, hd * 0.985, Math.PI / 4, poleC, mid);
      ellipseArc(hw * 0.985, hd * 0.985, -Math.PI / 4, poleC, mid);
      // 그라운드시트 테두리
      g.strokeStyle = withA(spec.fly, 0.9);
      g.lineWidth = Math.max(2, Math.min(w, d) * 0.035);
      g.beginPath(); rrPath(g, -hw * 0.96, -hd * 0.96, w * 0.92, d * 0.92, Math.min(w, d) * 0.3); g.stroke();
      g.setLineDash([Math.max(3, lw * 2.4), Math.max(2, lw * 1.8)]);
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = thin;
      g.beginPath(); rrPath(g, -hw * 0.78, -hd * 0.8, w * 0.56, d * 0.6, Math.min(w, d) * 0.2); g.stroke();
      g.setLineDash([]);
      doorPanel(0, 0, w * 0.42, d * 0.07, 'f');
      doorPanel(0, 0, w * 0.34, d * 0.05, 'b');
      win(-hw * 0.9, 0, Math.max(2.5, w * 0.07), d * 0.22, 0);
      win(hw * 0.9, 0, Math.max(2.5, w * 0.07), d * 0.22, 0);
    } else {
      // poler — 컴팩트 돔
      ellipseArc(hw * 0.985, hd * 0.985, Math.PI / 2, poleC, mid);
      ellipseArc(hw * 0.985, hd * 0.985, 0, poleC, mid);
      g.strokeStyle = withA(spec.fly, 0.85); g.lineWidth = Math.max(1.4, lw * 1.2);
      g.beginPath(); rrPath(g, -hw * 0.94, -hd * 0.94, w * 0.88, d * 0.88, Math.min(w, d) * 0.42); g.stroke();
      // 앞 큰 둥근 문
      g.fillStyle = 'rgba(10,14,19,.55)';
      g.beginPath(); g.ellipse(0, -hd * 0.8, w * 0.26, d * 0.11, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(1, lw * 0.8); g.stroke();
      // 옆 둥근 창
      [-1, 1].forEach((sx) => {
        g.beginPath(); g.ellipse(sx * hw * 0.62, -hd * 0.16, Math.min(w, d) * 0.06, Math.min(w, d) * 0.06, 0, 0, TAU);
        g.fillStyle = meshC; g.fill();
        g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = thin; g.stroke();
      });
      // 뒤 환기
      g.beginPath(); g.ellipse(0, hd * 0.86, w * 0.16, d * 0.06, 0, 0, TAU);
      g.fillStyle = meshC; g.fill();
    }

    // 공통 — 바닥 안쪽 라인
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = thin;
    g.beginPath(); rrPath(g, -hw * 0.88, -hd * 0.9, w * 0.76, d * 0.8, Math.min(w, d) * 0.12); g.stroke();
  }

  // 본체 바깥으로 나오는 차양(캐노피) — 평면에서도 앞쪽에 그려 폴대 위치를 보여 줍니다.
  function drawTentAwning2(g, it, w, d, lw) {
    const look = tentLookOf(it).look;
    if (look !== 'village' && look !== 'timax') return;
    const spec = TENT_LOOKS[look];
    const hw = w / 2, hd = d / 2;
    const dep = look === 'village' ? Math.min(d * 0.16, hw * 0.4) : Math.min(d * 0.09, hw * 0.28);
    const aw = hw * (look === 'village' ? 0.86 : 0.8);
    const col = withA(look === 'village' ? spec.fly : spec.fly, 0.92);
    const y0 = -hd;
    g.save();
    g.fillStyle = col;
    g.beginPath(); rrPath(g, -aw, y0 - dep, aw * 2, dep, Math.min(3, dep * 0.18)); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = Math.max(0.9, lw * 0.7); g.stroke();
    // 끝단 처짐선
    g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = Math.max(0.8, lw * 0.6);
    g.beginPath(); g.moveTo(-aw * 0.98, y0 - dep * 0.62); g.lineTo(aw * 0.98, y0 - dep * 0.62); g.stroke();
    // 폴대 2개 (앞 모서리)
    [-1, 1].forEach((sx) => {
      const px = sx * aw * 0.92, py = y0 - dep * 0.86;
      g.beginPath(); g.arc(px, py, Math.max(1.8, lw * 1.5), 0, TAU);
      g.fillStyle = 'rgba(240,246,255,.95)'; g.fill();
      g.strokeStyle = 'rgba(20,26,34,.8)'; g.lineWidth = Math.max(0.8, lw * 0.6); g.stroke();
      // 가이라인
      g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = Math.max(0.7, lw * 0.5);
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + sx * dep * 0.5, py - dep * 0.9); g.stroke();
    });
    g.restore();
  }

  function detailTent(g, it, w, d, lw, kind) {
    const hw = w / 2, hd = d / 2;
    // 제품(이름)을 알 수 있으면 제품별 평면 모습으로
    const look = tentLookOf(it).look;
    if (look) { detailTentLook(g, it, w, d, lw, look); return; }
    const grad = g.createLinearGradient(0, -hd, 0, hd);
    grad.addColorStop(0, 'rgba(255,255,255,.20)');
    grad.addColorStop(0.46, 'rgba(255,255,255,.04)');
    grad.addColorStop(1, 'rgba(0,0,0,.18)');
    g.fillStyle = grad;
    g.fillRect(-hw, -hd, w, d);

    const line = 'rgba(255,255,255,.34)';
    g.lineCap = 'round';

    if (kind === 'tent-tunnel') {
      // 터널형 — 길이 방향 능선 2줄 + 폭 방향 아치 립
      g.strokeStyle = line; g.lineWidth = Math.max(1, lw * 0.75);
      g.beginPath();
      g.moveTo(-hw * 0.88, -hd * 0.6); g.lineTo(hw * 0.88, -hd * 0.6);
      g.moveTo(-hw * 0.88, hd * 0.6); g.lineTo(hw * 0.88, hd * 0.6);
      g.stroke();
      const n = clamp(Math.round(d / (Math.min(w, d) * 0.75)), 2, 6);
      for (let i = 1; i < n; i++) {
        const y = -hd + (d * i) / n;
        g.beginPath();
        g.moveTo(-hw * 0.95, y);
        g.quadraticCurveTo(0, y + (y < 0 ? -1 : 1) * Math.min(w, d) * 0.07, hw * 0.95, y);
        g.stroke();
      }
      // 앞뒤 벽
      g.fillStyle = 'rgba(0,0,0,.12)';
      g.fillRect(-hw, -hd, w, Math.max(1, d * 0.045));
      g.fillRect(-hw, hd - Math.max(1, d * 0.045), w, Math.max(1, d * 0.045));
    } else if (kind === 'tent-air') {
      // 에어텐트 — 둥근 에어빔 2줄 + 밸브
      const bw = Math.max(2, Math.min(w, d) * 0.1);
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = bw;
      g.beginPath();
      g.moveTo(-hw + bw * 0.9, -hd + bw * 0.9); g.lineTo(-hw + bw * 0.9, hd - bw * 0.9);
      g.moveTo(hw - bw * 0.9, -hd + bw * 0.9); g.lineTo(hw - bw * 0.9, hd - bw * 0.9);
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = Math.max(1, lw * 0.9);
      g.beginPath();
      rrPath(g, -hw + bw * 1.9, -hd + bw * 1.7, w - bw * 3.8, d - bw * 3.4, Math.min(w, d) * 0.12);
      g.stroke();
      g.beginPath();
      g.moveTo(-hw * 0.5, -hd * 0.86); g.lineTo(hw * 0.5, -hd * 0.86);
      g.stroke();
      g.beginPath();
      g.arc(hw - bw * 1.6, hd * 0.5, Math.max(1.6, Math.min(w, d) * 0.045), 0, TAU);
      g.fillStyle = 'rgba(16,22,30,.5)'; g.fill();
    } else if (kind === 'tent-ridge') {
      // 로지형 — 용마루 1줄 + 양쪽 지붕면 + 측벽
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = Math.max(1.2, lw * 1.05);
      g.beginPath(); g.moveTo(0, -hd * 0.94); g.lineTo(0, hd * 0.94); g.stroke();
      g.strokeStyle = line; g.lineWidth = Math.max(1, lw * 0.7);
      [-1, 1].forEach((s) => {
        g.beginPath(); g.moveTo(s * hw * 0.56, -hd * 0.94); g.lineTo(s * hw * 0.56, hd * 0.94); g.stroke();
      });
      g.fillStyle = 'rgba(0,0,0,.14)';
      g.fillRect(-hw, -hd, w, Math.max(1, d * 0.05));
      g.fillRect(-hw, hd - Math.max(1, d * 0.05), w, Math.max(1, d * 0.05));
    } else {
      // 돔형 — 지붕 이음선 + 폴대 교차
      g.strokeStyle = line; g.lineWidth = Math.max(1, lw * 0.8);
      g.beginPath();
      g.moveTo(-hw * 0.72, -hd * 0.74); g.quadraticCurveTo(0, -hd * 0.06, hw * 0.72, -hd * 0.74);
      g.moveTo(-hw * 0.72, hd * 0.74); g.quadraticCurveTo(0, hd * 0.06, hw * 0.72, hd * 0.74);
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.22)';
      g.beginPath();
      g.moveTo(-hw * 0.92, -hd * 0.92); g.quadraticCurveTo(0, 0, hw * 0.92, hd * 0.92);
      g.moveTo(-hw * 0.92, hd * 0.92); g.quadraticCurveTo(0, 0, hw * 0.92, -hd * 0.92);
      g.stroke();
      // 꼭대기 환기구
      g.beginPath();
      g.arc(0, 0, Math.max(1.6, Math.min(w, d) * 0.055), 0, TAU);
      g.fillStyle = 'rgba(12,18,26,.22)'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = Math.max(0.8, lw * 0.5); g.stroke();
    }
    // 바닥 매트
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = Math.max(0.8, lw * 0.5);
    g.beginPath();
    rrPath(g, -hw * 0.86, -hd * 0.86, w * 0.72, d * 0.72, Math.min(w, d) * 0.14);
    g.stroke();
  }

  function detailTarp(g, it, w, d, lw, kind) {
    const hw = w / 2, hd = d / 2;
    const grad = g.createLinearGradient(-hw, -hd, hw, hd);
    grad.addColorStop(0, 'rgba(255,255,255,.26)');
    grad.addColorStop(0.5, 'rgba(255,255,255,.05)');
    grad.addColorStop(1, 'rgba(0,0,0,.2)');
    g.fillStyle = grad; g.fillRect(-hw, -hd, w, d);

    // 팽팽하게 당겨진 윙 곡선 (가장자리 안쪽)
    g.strokeStyle = 'rgba(255,255,255,.34)'; g.lineWidth = Math.max(1, lw * 0.75);
    g.beginPath();
    if (kind === 'tarp-hex') {
      for (let i = 0; i < 6; i++) {
        const a1 = -Math.PI / 2 + i * TAU / 6, a2 = -Math.PI / 2 + (i + 1) * TAU / 6;
        const x1 = Math.cos(a1) * hw * 0.88, y1 = Math.sin(a1) * hd * 0.88;
        const x2 = Math.cos(a2) * hw * 0.88, y2 = Math.sin(a2) * hd * 0.88;
        const mx = (x1 + x2) / 2 * 0.86, my = (y1 + y2) / 2 * 0.86;
        if (i === 0) g.moveTo(x1, y1);
        g.quadraticCurveTo(mx, my, x2, y2);
      }
    } else {
      g.moveTo(-hw * 0.9, -hd * 0.9); g.quadraticCurveTo(0, -hd * 0.7, hw * 0.9, -hd * 0.9);
      g.moveTo(-hw * 0.9, hd * 0.9); g.quadraticCurveTo(0, hd * 0.7, hw * 0.9, hd * 0.9);
      g.moveTo(-hw * 0.9, -hd * 0.9); g.quadraticCurveTo(-hw * 0.7, 0, -hw * 0.9, hd * 0.9);
      g.moveTo(hw * 0.9, -hd * 0.9); g.quadraticCurveTo(hw * 0.7, 0, hw * 0.9, hd * 0.9);
    }
    g.stroke();

    // 메인 폴대 능선
    g.strokeStyle = 'rgba(255,255,255,.62)'; g.lineWidth = Math.max(1.6, lw * 1.5);
    g.beginPath();
    if (kind === 'tarp-hex') { g.moveTo(-hw * 0.94, 0); g.lineTo(hw * 0.94, 0); }
    else { g.moveTo(-hw * 0.94, 0); g.lineTo(hw * 0.94, 0); }
    g.stroke();
    // 메인 폴대 2개 (능선 위) + 사이드 폴대(렉타 4곳 / 헥사 6각)
    const poles2 = [];
    poles2.push([-hw * 0.62, 0, 1], [hw * 0.62, 0, 1]);
    if (kind === 'tarp-hex') {
      [[0.5, 0], [0.25, 0.5], [-0.25, 0.5], [-0.5, 0], [-0.25, -0.5], [0.25, -0.5]].forEach((p) => poles2.push([hw * p[0], hd * p[1], 0]));
    } else {
      [[-0.47, -0.47], [0.47, -0.47], [-0.47, 0.47], [0.47, 0.47]].forEach((p) => poles2.push([hw * p[0], hd * p[1], 0]));
    }
    poles2.forEach((p) => {
      const r = p[2] ? Math.max(2.6, lw * 2.2) : Math.max(2.1, lw * 1.8);
      g.beginPath(); g.arc(p[0], p[1], r, 0, TAU);
      g.fillStyle = p[2] ? 'rgba(255,255,255,.95)' : 'rgba(214,226,240,.9)'; g.fill();
      g.strokeStyle = 'rgba(16,22,30,.85)'; g.lineWidth = Math.max(0.8, lw * 0.7); g.stroke();
    });

    // 모서리 스트링 + 스테이크
    const pts = [];
    if (kind === 'tarp-hex') {
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + i * TAU / 6;
        pts.push([Math.cos(a) * hw * 0.97, Math.sin(a) * hd * 0.97]);
      }
    } else {
      pts.push([-hw * 0.97, -hd * 0.97], [hw * 0.97, -hd * 0.97], [hw * 0.97, hd * 0.97], [-hw * 0.97, hd * 0.97]);
    }
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = Math.max(0.8, lw * 0.5);
    g.fillStyle = 'rgba(255,255,255,.7)';
    pts.forEach((p) => {
      const ex = p[0] * 1.12, ey = p[1] * 1.12;
      g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(ex, ey); g.stroke();
      g.beginPath(); g.arc(ex, ey, Math.max(1, lw * 0.7), 0, TAU); g.fill();
    });
  }

  function detailCot(g, it, w, d, lw) {
    const hw = w / 2, hd = d / 2;
    // 프레임 테두리
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(1.2, lw * 1.2);
    g.beginPath(); rrPath(g, -hw * 0.96, -hd * 0.9, w * 0.92, d * 0.8, Math.min(w, d) * 0.1); g.stroke();
    // 매트
    g.fillStyle = 'rgba(240,244,250,.28)';
    g.beginPath(); rrPath(g, -hw * 0.86, -hd * 0.78, w * 0.72, d * 0.56, Math.min(w, d) * 0.08); g.fill();
    // 매트 가로선
    g.strokeStyle = 'rgba(20,28,38,.22)'; g.lineWidth = Math.max(0.8, lw * 0.5);
    for (let i = 1; i <= 4; i++) {
      const x = -hw * 0.86 + (w * 0.72 * i) / 5;
      g.beginPath(); g.moveTo(x, -hd * 0.78); g.lineTo(x, hd * 0.78); g.stroke();
    }
    // 베개 (머리 쪽)
    g.fillStyle = 'rgba(250,252,255,.62)';
    g.beginPath(); rrPath(g, -hw * 0.84, -hd * 0.56, w * 0.16, d * 0.56, Math.min(w, d) * 0.16); g.fill();
    g.strokeStyle = 'rgba(20,28,38,.18)'; g.stroke();
  }

  function detailTable(g, it, w, d, lw, kind) {
    const hw = w / 2, hd = d / 2;
    const wood = kind !== 'table-igt';
    if (wood) {
      // 우드 롤테이블 — 슬랫
      const n = clamp(Math.round(w / Math.max(6, d * 0.22)), 3, 9);
      for (let i = 0; i < n; i++) {
        const y = -hd + (d * (i + 0.5)) / n;
        g.strokeStyle = i % 2 ? 'rgba(72,48,26,.30)' : 'rgba(255,240,214,.22)';
        g.lineWidth = Math.max(1, lw * 0.9);
        g.beginPath(); g.moveTo(-hw * 0.94, y); g.lineTo(hw * 0.94, y); g.stroke();
      }
      g.strokeStyle = 'rgba(255,255,255,.32)'; g.lineWidth = Math.max(1, lw * 0.7);
      g.beginPath(); rrPath(g, -hw * 0.96, -hd * 0.92, w * 0.92, d * 0.84, Math.min(w, d) * 0.1); g.stroke();
    } else {
      // IGT — 버너/플레이트 칸 구분
      g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = Math.max(1.1, lw * 1.0);
      g.beginPath(); rrPath(g, -hw * 0.94, -hd * 0.9, w * 0.88, d * 0.8, Math.min(w, d) * 0.06); g.stroke();
      const cols = w > d * 1.4 ? 2 : 1, rows = w > d * 1.4 ? 1 : 2;
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          const cw = (w * 0.8) / cols, ch = (d * 0.7) / rows;
          const x = -hw * 0.9 + cw * cx + cw * 0.1, y = -hd * 0.85 + ch * cy + ch * 0.12;
          g.fillStyle = 'rgba(12,18,26,.24)';
          g.beginPath(); rrPath(g, x, y, cw * 0.8, ch * 0.76, Math.min(cw, ch) * 0.12); g.fill();
          g.strokeStyle = 'rgba(255,255,255,.34)'; g.lineWidth = Math.max(0.8, lw * 0.55);
          g.beginPath(); rrPath(g, x, y, cw * 0.8, ch * 0.76, Math.min(cw, ch) * 0.12); g.stroke();
          g.beginPath(); g.arc(x + cw * 0.4, y + ch * 0.38, Math.max(1, Math.min(cw, ch) * 0.11), 0, TAU);
          g.fillStyle = 'rgba(255,255,255,.4)'; g.fill();
        }
      }
    }
  }

  function detailChair(g, it, w, d, lw) {
    const hw = w / 2, hd = d / 2;
    // 등받이 (뒤쪽 곡선)
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(1.4, lw * 1.5);
    g.beginPath();
    g.moveTo(-hw * 0.62, hd * 0.9);
    g.quadraticCurveTo(0, hd * 0.62, hw * 0.62, hd * 0.9);
    g.stroke();
    // 좌판
    g.fillStyle = 'rgba(255,255,255,.26)';
    g.beginPath(); rrPath(g, -hw * 0.58, -hd * 0.1, w * 0.58, d * 0.62, Math.min(w, d) * 0.16); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = Math.max(1, lw * 0.7);
    g.beginPath(); rrPath(g, -hw * 0.58, -hd * 0.1, w * 0.58, d * 0.62, Math.min(w, d) * 0.16); g.stroke();
    // 팔걸이
    g.lineWidth = Math.max(1.2, lw * 1.1);
    g.strokeStyle = 'rgba(255,255,255,.5)';
    g.beginPath();
    g.moveTo(-hw * 0.72, -hd * 0.12); g.lineTo(hw * 0.5, -hd * 0.2);
    g.moveTo(-hw * 0.72, hd * 0.66); g.lineTo(hw * 0.5, hd * 0.6);
    g.stroke();
  }

  function detailBox(g, it, w, d, lw, kind) {
    const hw = w / 2, hd = d / 2;
    const lid = shade(it.color, 0.22);
    // 뚜껑
    g.fillStyle = 'rgba(255,255,255,.18)';
    g.beginPath(); rrPath(g, -hw * 0.92, -hd * 0.86, w * 0.84, d * 0.7, Math.min(w, d) * 0.12); g.fill();
    g.fillStyle = lid; g.globalAlpha = 0.18;
    g.beginPath(); rrPath(g, -hw * 0.92, -hd * 0.86, w * 0.84, d * 0.7, Math.min(w, d) * 0.12); g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(255,255,255,.42)'; g.lineWidth = Math.max(1, lw * 0.8);
    g.beginPath(); rrPath(g, -hw * 0.92, -hd * 0.86, w * 0.84, d * 0.7, Math.min(w, d) * 0.12); g.stroke();
    // 몰드 리브
    g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = Math.max(0.8, lw * 0.5);
    for (let i = 1; i <= 2; i++) {
      const y = -hd * 0.86 + (d * 0.7 * i) / 3;
      g.beginPath(); g.moveTo(-hw * 0.9, y); g.lineTo(-hw * 0.35, y); g.stroke();
      g.beginPath(); g.moveTo(hw * 0.35, y); g.lineTo(hw * 0.9, y); g.stroke();
    }
    // 버클 · 손잡이
    g.fillStyle = 'rgba(18,24,32,.55)';
    [-1, 1].forEach((s) => {
      g.beginPath(); rrPath(g, s * hw * 0.74 - w * 0.045, -hd * 0.14, w * 0.09, d * 0.28, 2); g.fill();
    });
    if (kind === 'cooler') {
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, lw * 0.8);
      g.beginPath(); g.arc(0, 0, Math.min(w, d) * 0.16, 0, TAU); g.stroke();
    }
  }

  function detailShelf(g, it, w, d, lw) {
    const hw = w / 2, hd = d / 2;
    g.strokeStyle = 'rgba(255,255,255,.42)'; g.lineWidth = Math.max(1, lw * 0.85);
    g.beginPath(); rrPath(g, -hw * 0.92, -hd * 0.86, w * 0.84, d * 0.72, Math.min(w, d) * 0.08); g.stroke();
    // 선반 칸선
    const n = clamp(Math.round(w / Math.max(10, d * 0.5)), 2, 4);
    g.strokeStyle = 'rgba(255,255,255,.24)';
    for (let i = 1; i < n; i++) {
      const x = -hw * 0.92 + (w * 0.84 * i) / n;
      g.beginPath(); g.moveTo(x, -hd * 0.86); g.lineTo(x, hd * 0.86); g.stroke();
    }
    // 기둥
    g.fillStyle = 'rgba(20,28,38,.32)';
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((p) => {
      g.beginPath();
      g.arc(p[0] * hw * 0.88, p[1] * hd * 0.8, Math.max(1, lw * 0.75), 0, TAU);
      g.fill();
    });
  }

  function detailFire(g, it, w, d, lw) {
    const hw = w / 2, hd = d / 2;
    // 받침 (팔각)
    g.save();
    g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = Math.max(1, lw * 0.9);
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = -Math.PI / 2 + i * TAU / 8;
      const x = Math.cos(a) * hw * 0.94, y = Math.sin(a) * hd * 0.94;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath(); g.stroke();
    // 안쪽 그릴 격자
    g.strokeStyle = 'rgba(28,20,16,.55)'; g.lineWidth = Math.max(0.8, lw * 0.6);
    for (let i = 1; i <= 3; i++) {
      const t = (i / 4) * 2 - 1;
      g.beginPath(); g.moveTo(t * hw * 0.66, -hd * 0.66); g.lineTo(t * hw * 0.66, hd * 0.66); g.stroke();
      g.beginPath(); g.moveTo(-hw * 0.66, t * hd * 0.66); g.lineTo(hw * 0.66, t * hd * 0.66); g.stroke();
    }
    // 불씨 (은은한 주황)
    const gl = g.createRadialGradient(0, 0, 0, 0, 0, Math.min(w, d) * 0.4);
    gl.addColorStop(0, 'rgba(255,196,96,.95)');
    gl.addColorStop(0.45, 'rgba(255,124,42,.62)');
    gl.addColorStop(1, 'rgba(255,90,30,0)');
    g.fillStyle = gl;
    g.beginPath(); g.arc(0, 0, Math.min(w, d) * 0.4, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,236,170,.95)';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.4;
      const r = Math.min(w, d) * (0.07 + (i % 3) * 0.05);
      g.beginPath();
      g.arc(Math.cos(a) * r, Math.sin(a) * r * 0.8, Math.max(1, Math.min(w, d) * 0.035), 0, TAU);
      g.fill();
    }
    g.restore();
  }

  function detailTree(g, it, w, d, lw) {
    const hw = w / 2, hd = d / 2;
    // 잎 실루엣
    const leaf = shade(it.color, 0.12);
    g.fillStyle = withA('#5f8f42', 0.55);
    g.beginPath();
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU - 0.3;
      const r = Math.min(w, d) * (0.46 + (i % 2) * 0.12);
      g.moveTo(0, 0);
      g.arc(Math.cos(a) * Math.min(w, d) * 0.16, Math.sin(a) * Math.min(w, d) * 0.16, r, 0, TAU);
    }
    g.fill();
    g.strokeStyle = 'rgba(28,48,20,.45)'; g.lineWidth = Math.max(0.8, lw * 0.6);
    g.beginPath(); g.arc(0, 0, Math.min(w, d) * 0.34, 0, TAU); g.stroke();
    // 줄기
    g.fillStyle = 'rgba(92,66,42,.9)';
    g.beginPath(); g.arc(0, 0, Math.max(2, Math.min(w, d) * 0.16), 0, TAU); g.fill();
    g.fillStyle = leaf;
    g.beginPath(); g.arc(0, 0, Math.max(1.4, Math.min(w, d) * 0.09), 0, TAU); g.fill();
    // 가지
    g.strokeStyle = 'rgba(92,66,42,.6)'; g.lineWidth = Math.max(1, lw * 0.7);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.5;
      g.beginPath(); g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * hw * 0.6, Math.sin(a) * hd * 0.6); g.stroke();
    }
  }

  function detailPower(g, it, w, d, lw) {
    const hw = w / 2, hd = d / 2;
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = Math.max(1, lw * 0.8);
    g.beginPath(); rrPath(g, -hw * 0.9, -hd * 0.82, w * 0.8, d * 0.64, Math.min(w, d) * 0.08); g.stroke();
    // 도어 이음선 · 힌지
    g.beginPath(); g.moveTo(0, -hd * 0.82); g.lineTo(0, hd * 0.82); g.stroke();
    g.fillStyle = 'rgba(24,30,38,.45)';
    g.fillRect(-hw * 0.62, -hd * 0.06, w * 0.16, Math.max(1.6, d * 0.1));
    // ⚡ 표시
    g.fillStyle = 'rgba(255,214,76,.95)';
    g.beginPath();
    g.moveTo(hw * 0.2, -hd * 0.42);
    g.lineTo(hw * 0.52, -hd * 0.06);
    g.lineTo(hw * 0.34, -hd * 0.02);
    g.lineTo(hw * 0.46, hd * 0.42);
    g.lineTo(hw * 0.14, hd * 0.02);
    g.lineTo(hw * 0.32, -hd * 0.04);
    g.closePath(); g.fill();
  }

  function detailGeneric(g, it, w, d, lw) {
    const hw = w / 2, hd = d / 2;
    g.strokeStyle = 'rgba(255,255,255,.24)'; g.lineWidth = Math.max(1, lw * 0.7);
    g.beginPath(); rrPath(g, -hw * 0.86, -hd * 0.8, w * 0.72, d * 0.6, Math.min(w, d) * 0.14); g.stroke();
  }

  function drawDetail(g, it, w, d, lw, kind) {
    g.save();
    bodyPath(g, it, w, d);
    g.clip();
    try {
      if (kind === 'vehicle') drawVehicle(g, it, w, d, lw);
      else if (kind.indexOf('tent') === 0) detailTent(g, it, w, d, lw, kind);
      else if (kind.indexOf('tarp') === 0) detailTarp(g, it, w, d, lw, kind);
      else if (kind === 'cot') detailCot(g, it, w, d, lw);
      else if (kind === 'table' || kind === 'table-igt') detailTable(g, it, w, d, lw, kind);
      else if (kind === 'chair') detailChair(g, it, w, d, lw);
      else if (kind === 'box' || kind === 'cooler') detailBox(g, it, w, d, lw, kind);
      else if (kind === 'shelf') detailShelf(g, it, w, d, lw);
      else if (kind === 'fire') detailFire(g, it, w, d, lw);
      else if (kind === 'tree') detailTree(g, it, w, d, lw);
      else if (kind === 'power') detailPower(g, it, w, d, lw);
      else detailGeneric(g, it, w, d, lw);
    } catch (e) { /* 디테일 그리기가 실패해도 본체는 그대로 */ }
    g.restore();
  }

  // 출입문 — 텐트는 플랩+지퍼, 그 밖에는 방향선
  function drawDoor(g, it, w, d, lw) {
    if (groupOf(it) === 'cover') {
      const fw = 0.3, fd = 0.17;
      let pts = null;
      if (it.door === 'front') pts = [[-w * fw * 1.2, -d / 2 + 0.5], [w * fw * 1.2, -d / 2 + 0.5], [w * fw * 0.94, -d / 2 + d * fd], [-w * fw * 0.94, -d / 2 + d * fd]];
      else if (it.door === 'back') pts = [[-w * fw * 1.2, d / 2 - 0.5], [w * fw * 1.2, d / 2 - 0.5], [w * fw * 0.94, d / 2 - d * fd], [-w * fw * 0.94, d / 2 - d * fd]];
      else if (it.door === 'left') pts = [[-w / 2 + 0.5, -d * fw * 1.2], [-w / 2 + w * fd, -d * fw * 0.94], [-w / 2 + w * fd, d * fw * 0.94], [-w / 2 + 0.5, d * fw * 1.2]];
      else if (it.door === 'right') pts = [[w / 2 - 0.5, -d * fw * 1.2], [w / 2 - w * fd, -d * fw * 0.94], [w / 2 - w * fd, d * fw * 0.94], [w / 2 - 0.5, d * fw * 1.2]];
      if (pts) {
        g.beginPath();
        pts.forEach((p, i) => { if (i === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); });
        g.closePath();
        g.fillStyle = 'rgba(8,12,17,.32)'; g.fill();
        g.strokeStyle = 'rgba(255,255,255,.24)'; g.lineWidth = Math.max(1, lw * 0.7); g.stroke();
        // 지퍼 점선
        g.setLineDash([Math.max(2, lw * 2), Math.max(2, lw * 1.6)]);
        g.strokeStyle = 'rgba(255,255,255,.5)';
        g.beginPath();
        g.moveTo((pts[0][0] + pts[3][0]) / 2, (pts[0][1] + pts[3][1]) / 2);
        g.lineTo((pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2);
        g.stroke();
        g.setLineDash([]);
      }
    }
    const L = doorLine(it.door, w, d, Math.max(2, lw * 1.5));
    if (!L) return;
    g.strokeStyle = 'rgba(255,255,255,.92)';
    g.lineWidth = Math.max(2, lw * 2);
    g.beginPath(); g.moveTo(L.x1, L.y1); g.lineTo(L.x2, L.y2); g.stroke();
    const mx = (L.x1 + L.x2) / 2, my = (L.y1 + L.y2) / 2;
    const s = Math.max(3.5, lw * 3);
    g.beginPath();
    g.moveTo(mx + L.nx * s * 1.5, my + L.ny * s * 1.5);
    g.lineTo(mx - L.nx * s + L.ny * s, my - L.ny * s - L.nx * s);
    g.lineTo(mx - L.nx * s - L.ny * s, my - L.ny * s + L.nx * s);
    g.closePath();
    g.fillStyle = 'rgba(255,255,255,.92)';
    g.fill();
  }

  /* ==================== 이름표 (방향·위치·반전) ==================== */
  function drawItemLabel(g, it, w, d, cx, cy, o) {
    if (!o.labels || w < 46 || d < 20) return;
    const isCover = groupOf(it) === 'cover';
    const isVeh = groupOf(it) === 'vehicle';
    const lrot = normLrot(it.lrot);
    const side = L_SIDES.indexOf(it.lside) >= 0 ? it.lside : (isCover ? 'b' : 'c');
    const flip = L_FLIPS.indexOf(it.lflip) >= 0 ? it.lflip : 'n';
    const vertical = lrot === 90 || lrot === 270;
    const fs = Math.max(8, o.fontPx || 11);
    const pad = Math.max(5, fs * 0.7);

    // 앵커 — 장비 로컬 좌표 → 화면
    let ox = 0, oy = 0;
    if (side === 't') oy = -d / 2 + pad + fs * 0.55;
    else if (side === 'b') oy = d / 2 - pad - fs * 0.55;
    else if (side === 'l') ox = -w / 2 + pad + fs * 0.55;
    else if (side === 'r') ox = w / 2 - pad - fs * 0.55;
    const rp = rotPt(ox, oy, it.rot);
    const ax = cx + rp.x, ay = cy + rp.y;

    // 글씨가 놓일 수 있는 길이 (회전된 장비의 화면 바운딩박스 기준)
    const rad = it.rot * Math.PI / 180;
    const bw = Math.abs(w * Math.cos(rad)) + Math.abs(d * Math.sin(rad));
    const bh = Math.abs(w * Math.sin(rad)) + Math.abs(d * Math.cos(rad));
    const avail = Math.max(16, (vertical ? bh : bw) - 10);
    const perp = vertical ? bw : bh;

    g.save();
    g.translate(ax, ay);
    if (lrot) g.rotate(lrot * Math.PI / 180);
    if (flip === 'h') g.scale(-1, 1);
    else if (flip === 'v') g.scale(1, -1);
    g.textAlign = 'center';
    g.textBaseline = 'middle';

    const fontMain = '600 ' + fs + 'px system-ui, "Noto Sans KR", sans-serif';
    const fontSub = '500 ' + Math.round(fs * 0.85) + 'px system-ui, "Noto Sans KR", sans-serif';
    g.font = fontMain;
    let name = it.name;
    while (name.length > 2 && g.measureText(name).width > avail - 6) name = name.slice(0, -1);
    if (name !== it.name) name = name.slice(0, -1) + '…';
    const nameW = g.measureText(name).width;
    const sizeStr = it.w + '×' + it.d;
    g.font = fontSub;
    const sizeW = g.measureText(sizeStr).width;
    const twoLine = perp > (side === 'c' ? fs * 2.9 : fs * 3.6);
    const plateW = Math.min(avail + 12, Math.max(nameW, twoLine ? sizeW : 0) + 14);
    const plateH = fs * (twoLine ? 2.2 : 1.7);

    if (isCover || isVeh) {
      g.fillStyle = 'rgba(8,12,17,.72)';
      g.beginPath(); rrPath(g, -plateW / 2, -plateH / 2, plateW, plateH, 5); g.fill();
    }

    g.font = fontMain;
    g.fillStyle = 'rgba(255,255,255,.98)';
    const y1 = twoLine ? -fs * 0.5 : 0;
    g.fillText(name, 0, y1);
    if (twoLine) {
      g.font = fontSub;
      g.fillStyle = 'rgba(255,255,255,.74)';
      g.fillText(sizeStr, 0, y1 + fs * 1.02);
    }
    g.restore();
  }

  function paintItem(g, it, sc, cx, cy, o) {
    const w = it.w * sc, d = it.d * sc;
    const rad = it.rot * Math.PI / 180;
    const lw = o.lw;
    const kind = kindOf(it);

    if (o.guy && it.guy > 0) {
      g.save();
      g.translate(cx, cy); g.rotate(rad);
      g.beginPath();
      pathShape(g, it.shape, w + it.guy * 2 * sc, d + it.guy * 2 * sc, Math.min(w, d) * 0.2);
      g.setLineDash([Math.max(4, lw * 3.5), Math.max(3, lw * 3)]);
      g.lineWidth = lw * 0.85;
      g.strokeStyle = 'rgba(255,255,255,.5)';
      g.stroke();
      g.setLineDash([]);
      g.restore();
    }

    g.save();
    g.translate(cx, cy); g.rotate(rad);
    const isVeh = kind === 'vehicle';
    bodyPath(g, it, w, d);
    g.fillStyle = isVeh ? (it.color || '#5b6b82') : withA(it.color, 0.82);
    g.fill();

    if (w > 16 && d > 9) drawDetail(g, it, w, d, lw, kind);

    bodyPath(g, it, w, d);
    g.lineWidth = o.bad ? lw * 2.2 : lw;
    g.strokeStyle = o.bad ? '#ff5a68' : 'rgba(255,255,255,.7)';
    g.stroke();

    if (o.selected) {
      bodyPath(g, it, w, d);
      g.lineWidth = lw * 1.6;
      g.strokeStyle = '#ffd166';
      g.stroke();
    }

    if (it.door !== 'none' && kind !== 'vehicle' && w > 22 && d > 14) drawDoor(g, it, w, d, lw);
    if (kind.indexOf('tent') === 0 && w > 34 && d > 34) drawTentAwning2(g, it, w, d, lw);
    g.restore();

    drawItemLabel(g, it, w, d, cx, cy, o);
  }

  function drawGrid(x0, y0, ww, hh) {
    if (S.site.grid === 'off') return;
    const minor = S.site.grid === 'm05' ? 50 : 100;
    const showMinor = minor * view.scale >= 5;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, ww, hh); ctx.clip();
    ctx.lineWidth = 1;
    if (showMinor) {
      ctx.strokeStyle = 'rgba(255,255,255,.055)';
      ctx.beginPath();
      for (let x = 0; x <= S.site.w + 0.01; x += minor) {
        const sx = Math.round(x0 + x * view.scale) + 0.5;
        ctx.moveTo(sx, y0); ctx.lineTo(sx, y0 + hh);
      }
      for (let y = 0; y <= S.site.d + 0.01; y += minor) {
        const sy = Math.round(y0 + y * view.scale) + 0.5;
        ctx.moveTo(x0, sy); ctx.lineTo(x0 + ww, sy);
      }
      ctx.stroke();
    }
    if (100 * view.scale >= 14) {
      ctx.strokeStyle = 'rgba(255,255,255,.16)';
      ctx.beginPath();
      for (let x = 0; x <= S.site.w + 0.01; x += 100) {
        const sx = Math.round(x0 + x * view.scale) + 0.5;
        ctx.moveTo(sx, y0); ctx.lineTo(sx, y0 + hh);
      }
      for (let y = 0; y <= S.site.d + 0.01; y += 100) {
        const sy = Math.round(y0 + y * view.scale) + 0.5;
        ctx.moveTo(x0, sy); ctx.lineTo(x0 + ww, sy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRulers(x0, y0, ww, hh) {
    ctx.save();
    ctx.lineWidth = 1;
    ctx.font = '10px system-ui, "Noto Sans KR", sans-serif';
    ctx.textBaseline = 'middle';
    const stepM = view.scale * 100 >= 44 ? 1 : view.scale * 100 >= 22 ? 2 : 5;
    // 위쪽
    ctx.strokeStyle = 'rgba(150,172,194,.35)';
    ctx.fillStyle = 'rgba(176,196,214,.72)';
    ctx.beginPath();
    for (let m = 0; m <= S.site.w / 100 + 0.001; m += stepM) {
      const sx = Math.round(x0 + m * 100 * view.scale) + 0.5;
      ctx.moveTo(sx, y0 - 6); ctx.lineTo(sx, y0);
      ctx.textAlign = 'center';
      ctx.fillText(m + 'm', sx, y0 - 14);
    }
    // 왼쪽
    for (let m = 0; m <= S.site.d / 100 + 0.001; m += stepM) {
      const sy = Math.round(y0 + m * 100 * view.scale) + 0.5;
      ctx.moveTo(x0 - 6, sy); ctx.lineTo(x0, sy);
      ctx.textAlign = 'right';
      ctx.fillText(m + 'm', x0 - 9, sy);
    }
    ctx.stroke();
    ctx.restore();
  }

  function handlePos(it) {
    const a = it.rot * Math.PI / 180;
    const dir = { x: Math.sin(a), y: -Math.cos(a) };
    const mid = toS(it.x + dir.x * (it.d / 2), it.y + dir.y * (it.d / 2));
    return { x: mid.x + dir.x * 26, y: mid.y + dir.y * 26, mid: mid };
  }

  const WIND_NAMES = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];

  function drawWind() {
    if (!S.wind || !S.wind.on) return;
    const rad = (S.wind.dir || 0) * Math.PI / 180;
    const dir = { x: Math.sin(rad), y: -Math.cos(rad) };
    const px = -dir.y, py = dir.x;

    // 연기 (화로·난로)
    const fires = S.items.filter((i) => groupOf(i) !== 'obstacle' && /화로|난로|스토브|그릴|버너/.test(i.name || ''));
    if (fires.length) {
      ctx.save();
      fires.forEach((it) => {
        const c = toS(it.x, it.y);
        for (let k = 0; k < 3; k++) {
          const off = (k - 1) * 7;
          const sx = c.x + px * off, sy = c.y + py * off;
          const L = 54 + k * 20;
          const ex = sx + dir.x * L, ey = sy + dir.y * L;
          const mx = sx + dir.x * L * 0.45 + px * (8 + k * 6);
          const my = sy + dir.y * L * 0.45 + py * (8 + k * 6);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.quadraticCurveTo(mx, my, ex, ey);
          ctx.setLineDash([5, 4]);
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(232,241,250,' + (0.62 - k * 0.15).toFixed(2) + ')';
          ctx.stroke();
        }
      });
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 사이트 안쪽 우측 상단에 바람 화살표
    const cx = view.ox + S.site.w * view.scale - 46;
    const cy = view.oy + 38;
    const len = 22;
    ctx.save();
    ctx.strokeStyle = 'rgba(150,210,255,.92)';
    ctx.fillStyle = 'rgba(150,210,255,.92)';
    ctx.lineWidth = 2;
    const ax = cx - dir.x * len, ay = cy - dir.y * len;
    const bx = cx + dir.x * len, by = cy + dir.y * len;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx + dir.x * 6, by + dir.y * 6);
    ctx.lineTo(bx - dir.x * 2 + px * 5, by - dir.y * 2 + py * 5);
    ctx.lineTo(bx - dir.x * 2 - px * 5, by - dir.y * 2 - py * 5);
    ctx.closePath(); ctx.fill();
    ctx.font = '700 9.5px system-ui, "Noto Sans KR", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('바람', cx, cy - 15);
    ctx.restore();
  }

  function drawSelection() {
    const it = getSel();
    if (!it) return;
    const poly = itemPoly(it).map((p) => toS(p.x, p.y));
    ctx.save();
    ctx.beginPath();
    poly.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.closePath();
    ctx.setLineDash([7, 5]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,209,102,.95)';
    ctx.stroke();
    ctx.setLineDash([]);

    const h = handlePos(it);
    ctx.beginPath(); ctx.moveTo(h.mid.x, h.mid.y); ctx.lineTo(h.x, h.y);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,209,102,.8)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(h.x, h.y, 12, 0, TAU);
    ctx.fillStyle = '#ffd166'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#12181f'; ctx.stroke();
    ctx.fillStyle = '#12181f';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('↻', h.x, h.y + 0.5);
    ctx.restore();
  }

  function drawDistances(it) {
    const box = aabb(itemPoly(it));
    const gaps = [
      { v: box.minY, side: 'top', from: { x: (box.minX + box.maxX) / 2, y: box.minY }, to: { x: (box.minX + box.maxX) / 2, y: 0 } },
      { v: S.site.d - box.maxY, side: 'bottom', from: { x: (box.minX + box.maxX) / 2, y: box.maxY }, to: { x: (box.minX + box.maxX) / 2, y: S.site.d } },
      { v: box.minX, side: 'left', from: { x: box.minX, y: (box.minY + box.maxY) / 2 }, to: { x: 0, y: (box.minY + box.maxY) / 2 } },
      { v: S.site.w - box.maxX, side: 'right', from: { x: box.maxX, y: (box.minY + box.maxY) / 2 }, to: { x: S.site.w, y: (box.minY + box.maxY) / 2 } }
    ];
    ctx.save();
    ctx.font = '600 10px system-ui, "Noto Sans KR", sans-serif';
    gaps.forEach((gp) => {
      const a = toS(gp.from.x, gp.from.y);
      const b = toS(gp.to.x, gp.to.y);
      const bad = gp.v < 0;
      ctx.strokeStyle = bad ? 'rgba(255,90,104,.9)' : 'rgba(255,209,102,.75)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
      // 양끝 눈금
      const vertical = Math.abs(a.x - b.x) < 0.5;
      ctx.beginPath();
      if (vertical) {
        ctx.moveTo(a.x - 4, a.y); ctx.lineTo(a.x + 4, a.y);
        ctx.moveTo(b.x - 4, b.y); ctx.lineTo(b.x + 4, b.y);
      } else {
        ctx.moveTo(a.x, a.y - 4); ctx.lineTo(a.x, a.y + 4);
        ctx.moveTo(b.x, b.y - 4); ctx.lineTo(b.x, b.y + 4);
      }
      ctx.stroke();
      const label = (bad ? '초과 ' : '') + Math.abs(Math.round(gp.v)) + 'cm';
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = bad ? 'rgba(60,12,16,.9)' : 'rgba(14,20,27,.88)';
      ctx.beginPath();
      const bw = tw + 10, bh = 16;
      ctx.rect(mx - bw / 2, my - bh / 2, bw, bh);
      ctx.fill();
      ctx.fillStyle = bad ? '#ff9aa3' : '#ffd166';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my + 0.5);
    });
    ctx.restore();
  }

  function render() {
    if (!ctx) return;
    lastIssues = analyze();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#080d13';
    ctx.fillRect(0, 0, W, H);

    const x0 = view.ox, y0 = view.oy;
    const ww = S.site.w * view.scale, hh = S.site.d * view.scale;

    // 사이트 그림자 + 바닥
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = 26; ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#121a23';
    ctx.fillRect(x0, y0, ww, hh);
    ctx.restore();

    const pat = floorPattern(S.site.floor);
    if (pat) {
      ctx.save();
      ctx.fillStyle = pat;
      ctx.fillRect(x0, y0, ww, hh);
      ctx.restore();
    }
    // 바닥 위 살짝 어둡게(대비)
    ctx.save();
    ctx.fillStyle = 'rgba(6,10,15,.18)';
    ctx.fillRect(x0, y0, ww, hh);
    ctx.restore();

    drawGrid(x0, y0, ww, hh);
    drawRulers(x0, y0, ww, hh);

    // 사이트 경계
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(226,240,255,.42)';
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, ww - 1, hh - 1);
    ctx.restore();

    // 장비 (덮개 → 차량 → 가구 순으로 겹쳐 그리기: 텐트 안 배치가 보이게)
    const sc = view.scale;
    S.items.map((it, i) => ({ it, i, z: zOf(it) }))
      .sort((a, b) => a.z - b.z || a.i - b.i)
      .forEach(({ it }) => {
        const p = toS(it.x, it.y);
        paintItem(ctx, it, sc, p.x, p.y, {
          lw: clamp(sc * 0.09, 1.3, 3),
          fontPx: 11,
          labels: true,
          guy: S.guy,
          bad: lastIssues.outIds.has(it.id) || lastIssues.overlapIds.has(it.id),
          selected: it.id === selId
        });
      });

    drawWind();

    const sel = getSel();
    if (sel) {
      drawSelection();
      drawDistances(sel);
    }

    updateStatus();
    updateSelbar();
    updateZoomLabel();
  }

  let rafPending = false;
  function schedule() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      render();
      if (V3.mode) {
        V3.dirty = true;
        build3DScene();
        render3D();
      }
    });
  }

  /* ============================== 상태 표시 ============================== */
  function updateStatus() {
    const pill = $('#status');
    const txt = $('#statusText');
    const n = lastIssues.outIds.size + lastIssues.pairs.length;
    pill.classList.toggle('bad', n > 0);
    pill.classList.toggle('ok', n === 0);
    const count = S.items.length;
    txt.textContent = (n ? '이탈·겹침 ' + n + '건' : '정상 배치') + ' · ' + count + '개';
    pill.title = n ? ('사이트 밖 ' + lastIssues.outIds.size + '개 · 본체 겹침 ' + lastIssues.pairs.length + '쌍') : '모든 장비가 사이트 안에서 겹치지 않습니다';

    const sig = S.items.map((i) => i.id).join(',') + '|' + Array.from(lastIssues.outIds).join(',') + '|' +
      lastIssues.pairs.map((p) => p[0].id + p[1].id).join(',') + '|' + lastIssues.guyPairs;
    if (sig === issueSig) return;
    issueSig = sig;

    const box = $('#issues');
    const rows = [];
    lastIssues.outIds.forEach((id) => {
      const it = getItem(id);
      if (it) rows.push(['⚠ 사이트 밖 · ' + it.name, it.id]);
    });
    lastIssues.pairs.forEach((p) => rows.push(['⚠ 겹침 · ' + p[0].name + ' ↔ ' + p[1].name, p[0].id]));
    let html = rows.map((r) => '<button type="button" data-goto="' + r[1] + '">' + esc(r[0]) + '</button>').join('');
    if (lastIssues.guyPairs > 0) html += '<div class="info">가이라인 여유가 겹치는 장비 ' + lastIssues.guyPairs + '쌍 (경고 아님)</div>';
    box.innerHTML = html;
    box.hidden = rows.length === 0 && lastIssues.guyPairs === 0;
    $$('button[data-goto]', box).forEach((b) => {
      b.addEventListener('click', () => {
        const it = getItem(b.getAttribute('data-goto'));
        if (!it) return;
        selId = it.id;
        centerOn(it);
        schedule();
      });
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function centerOn(it) {
    const cx = W / 2, cy = H / 2;
    view.ox = cx - it.x * view.scale;
    view.oy = cy - it.y * view.scale;
    view.auto = false;
  }

  function updateSelbar() {
    const bar = $('#selbar');
    const it = getSel();
    document.body.classList.toggle('sel-active', !!it);
    if (!it) { bar.hidden = true; return; }
    bar.hidden = false;
    $('#selColor').style.background = it.color;
    $('#selName').textContent = it.name;
    $('#selSize').textContent = it.w + '×' + it.d + 'cm · ' + Math.round(it.rot) + '°' + (it.guy ? ' · 가이라인 ' + it.guy + 'cm' : '');

    const box = aabb(itemPoly(it));
    const d = {
      top: box.minY,
      bottom: S.site.d - box.maxY,
      left: box.minX,
      right: S.site.w - box.maxX
    };
    const cell = (label, v) => '<span' + (v < -0.5 ? ' class="warn"' : '') + '>' + label + ' ' + (v < -0.5 ? '초과 ' + Math.abs(Math.round(v)) : Math.round(v)) + 'cm</span>';
    $('#selDist').innerHTML = cell('위', d.top) + cell('아래', d.bottom) + cell('좌', d.left) + cell('우', d.right);

    const wEl = $('#selW'), dEl = $('#selD'), gEl = $('#selG');
    if (document.activeElement !== wEl) wEl.value = Math.round(it.w);
    if (document.activeElement !== dEl) dEl.value = Math.round(it.d);
    if (document.activeElement !== gEl) gEl.value = Math.round(it.guy || 0);

    // 글씨 방향·위치
    const curLrot = normLrot(it.lrot);
    $$('#selLrot button').forEach((b) => b.classList.toggle('active', +b.getAttribute('data-lrot') === curLrot));
    const lf = L_FLIPS.indexOf(it.lflip) >= 0 ? it.lflip : 'n';
    const flipEl = $('#selLflip');
    flipEl.textContent = lf === 'h' ? '↔ 좌우반전' : lf === 'v' ? '↕ 상하반전' : '↔ 반전';
    flipEl.classList.toggle('on', lf !== 'n');
    const sideEl = $('#selLside');
    if (document.activeElement !== sideEl) {
      sideEl.value = L_SIDES.indexOf(it.lside) >= 0 ? it.lside : (groupOf(it) === 'cover' ? 'b' : 'c');
    }
  }

  let sizeTimer = null;
  function applySelSize() {
    const it = getSel();
    if (!it) return;
    const w = Math.round(+$('#selW').value || 0);
    const d = Math.round(+$('#selD').value || 0);
    const g = Math.round(+$('#selG').value || 0);
    let changed = false;
    if (w >= 10 && w !== it.w) { it.w = clamp(w, 10, 3000); changed = true; }
    if (d >= 10 && d !== it.d) { it.d = clamp(d, 10, 3000); changed = true; }
    if (g !== (it.guy || 0)) { it.guy = clamp(g, 0, 400); changed = true; }
    if (!changed) return;
    persist();
    schedule();
  }

  /* ========================= 놓인 장비 수정 모달 ========================= */
  let editItemId = null;

  function openItemDialog(it) {
    if (!it) return;
    editItemId = it.id;
    $('#iName').value = it.name;
    $('#iW').value = Math.round(it.w);
    $('#iD').value = Math.round(it.d);
    $('#iGuy').value = Math.round(it.guy || 0);
    $('#iShape').value = it.shape || 'rect';
    $('#iDoor').value = it.door || 'none';
    $('#iColor').value = /^#[0-9a-f]{6}$/i.test(it.color || '') ? it.color : '#7aa7d9';
    $('#iLrot').value = String(normLrot(it.lrot));
    $('#iLside').value = L_SIDES.indexOf(it.lside) >= 0 ? it.lside : (groupOf(it) === 'cover' ? 'b' : 'c');
    $('#iLflip').value = L_FLIPS.indexOf(it.lflip) >= 0 ? it.lflip : 'n';
    $('#iSyncLib').checked = true;
    const isCar = groupOf(it) === 'vehicle';
    $('#iModelWrap').hidden = !isCar;
    if (isCar) {
      const mi = CAR_MODELS.findIndex((m) => (it.name || '').indexOf(m.name) >= 0);
      $('#iModel').value = String(mi >= 0 ? mi : 0);
    }
    const dlg = $('#itemDlg');
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }

  function submitItem(ev) {
    ev.preventDefault();
    const it = getItem(editItemId);
    if (!it) { closeDialog($('#itemDlg')); return; }
    const w = Math.round(+$('#iW').value), d = Math.round(+$('#iD').value);
    if (!(w >= 10) || !(d >= 10)) { toast('가로·세로(cm)를 확인해 주세요'); return; }
    it.name = ($('#iName').value || '').trim().slice(0, 30) || it.name;
    it.w = clamp(w, 10, 3000);
    it.d = clamp(d, 10, 3000);
    it.guy = clamp(Math.round(+$('#iGuy').value || 0), 0, 400);
    it.shape = $('#iShape').value;
    it.door = $('#iDoor').value;
    it.color = $('#iColor').value;
    it.lrot = normLrot($('#iLrot').value);
    it.lside = L_SIDES.indexOf($('#iLside').value) >= 0 ? $('#iLside').value : (groupOf(it) === 'cover' ? 'b' : 'c');
    it.lflip = L_FLIPS.indexOf($('#iLflip').value) >= 0 ? $('#iLflip').value : 'n';
    it.carStyle = groupOf(it) === 'vehicle' ? carStyleOfName(it.name) : null;

    if ($('#iSyncLib').checked) {
      const lib = it.libId ? S.library.find((l) => l.id === it.libId) : null;
      const data = { name: it.name, cat: it.cat, w: it.w, d: it.d, hgt: it.hgt, guy: it.guy, shape: it.shape, color: it.color, door: it.door };
      if (lib) Object.assign(lib, data);
      else {
        const nl = Object.assign({ id: uid('lib'), memo: it.memo || '' }, data);
        S.library.push(nl);
        it.libId = nl.id;
        const mine = S.items.filter((x) => x.id === it.id);
        mine.forEach((x) => { x.libId = nl.id; });
      }
      renderLibrary();
    }
    persist();
    render();
    closeDialog($('#itemDlg'));
    toast('장비 크기를 적용했습니다');
  }

  function refreshWindUI() {
    if (!S.wind) S.wind = { on: true, dir: 90 };
    const on = !!S.wind.on;
    const box = $('#windBox');
    box.classList.toggle('off', !on);
    $('#windToggle').classList.toggle('on', on);
    $('#windToggle').setAttribute('aria-pressed', on ? 'true' : 'false');
    const d = Math.round(S.wind.dir || 0) % 360;
    $('#windArrow').style.transform = 'rotate(' + d + 'deg)';
    $('#windDeg').textContent = d + '° ' + WIND_NAMES[Math.round(d / 45) % 8];
  }

  function updateZoomLabel() {
    const pct = Math.round((view.scale / fitScale()) * 100);
    $('#zoomLabel').textContent = pct + '%';
  }

  /* ============================== 포인터 조작 ============================== */
  function hitTest(p) {
    for (let i = S.items.length - 1; i >= 0; i--) {
      const it = S.items[i];
      const r = rotPt(p.x - it.x, p.y - it.y, -it.rot);
      if (Math.abs(r.x) <= it.w / 2 && Math.abs(r.y) <= it.d / 2) return it;
    }
    return null;
  }

  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { cv.setPointerCapture(e.pointerId); } catch (err) { }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cv.classList.add('dragging');
    hideHint();

    if (pointers.size === 1) {
      const wpt = toWorld(e.clientX, e.clientY);
      const sel = getSel();
      if (sel) {
        const h = handlePos(sel);
        const r = cv.getBoundingClientRect();
        if (Math.hypot(e.clientX - r.left - h.x, e.clientY - r.top - h.y) < 20) {
          drag = { type: 'rotate', id: sel.id, a0: Math.atan2(wpt.y - sel.y, wpt.x - sel.x), r0: sel.rot };
          return;
        }
      }
      const hit = hitTest(wpt);
      if (hit) {
        selId = hit.id;
        drag = { type: 'move', id: hit.id, dx: wpt.x - hit.x, dy: wpt.y - hit.y };
      } else {
        selId = null;
        drag = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: view.ox, oy: view.oy };
      }
      schedule();
    } else if (pointers.size === 2) {
      drag = null;
      const pts = Array.from(pointers.values());
      pinch = { d0: Math.max(24, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)), s0: view.scale };
    }
  }

  function onMove(e) {
    const pt = pointers.get(e.pointerId);
    if (!pt) return;
    pt.x = e.clientX; pt.y = e.clientY;

    if (pointers.size >= 2 && pinch) {
      const pts = Array.from(pointers.values());
      const d = Math.max(24, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
      const s = clamp(pinch.s0 * (d / pinch.d0), 0.01, 6);
      const r = cv.getBoundingClientRect();
      const mx = (pts[0].x + pts[1].x) / 2 - r.left;
      const my = (pts[0].y + pts[1].y) / 2 - r.top;
      const k = s / view.scale;
      view.ox = mx - (mx - view.ox) * k;
      view.oy = my - (my - view.oy) * k;
      view.scale = s;
      view.auto = false;
      schedule();
      return;
    }
    if (!drag) return;

    if (drag.type === 'pan') {
      view.ox = drag.ox + (e.clientX - drag.sx);
      view.oy = drag.oy + (e.clientY - drag.sy);
      view.auto = false;
      schedule();
      return;
    }

    const it = getItem(drag.id);
    if (!it) return;

    if (drag.type === 'move') {
      const p = toWorld(e.clientX, e.clientY);
      let nx = p.x - drag.dx, ny = p.y - drag.dy;
      if (S.snap) { nx = Math.round(nx / SNAP) * SNAP; ny = Math.round(ny / SNAP) * SNAP; }
      it.x = nx; it.y = ny;
      schedule();
    } else if (drag.type === 'rotate') {
      const p = toWorld(e.clientX, e.clientY);
      const a1 = Math.atan2(p.y - it.y, p.x - it.x);
      let deg = drag.r0 + (a1 - drag.a0) * 180 / Math.PI;
      if (S.snap) deg = Math.round(deg / 5) * 5;
      it.rot = normDeg(Math.round(deg * 10) / 10);
      schedule();
    }
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && (drag.type === 'move' || drag.type === 'rotate')) persist();
    if (pointers.size === 0) { drag = null; cv.classList.remove('dragging'); }
    schedule();
  }

  function zoomBy(k, mx, my) {
    if (mx == null) { mx = W / 2; my = H / 2; }
    const s = clamp(view.scale * k, 0.01, 6);
    const kk = s / view.scale;
    view.ox = mx - (mx - view.ox) * kk;
    view.oy = my - (my - view.oy) * kk;
    view.scale = s;
    view.auto = false;
    schedule();
  }

  /* ============================== 장비함 ============================== */
  function renderLibrary() {
    const host = $('#libList');
    host.innerHTML = '';
    CATS.forEach((cat) => {
      const list = S.library.filter((l) => l.cat === cat);
      if (!list.length) return;
      const group = document.createElement('div');
      group.className = 'lib-group';
      const h = document.createElement('h4');
      h.innerHTML = esc(cat) + ' <em>' + list.length + '</em>';
      group.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'lib-grid';
      list.forEach((l) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('data-lib', l.id);
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.innerHTML =
          '<span class="dot" style="background:' + esc(l.color || '#7aa7d9') + '"></span>' +
          '<span class="card-main"><b>' + esc(l.name) + '</b><small>' + sizeText(l) + '</small></span>' +
          '<button class="edit" type="button" data-edit="' + l.id + '" aria-label="' + esc(l.name) + ' 수정">✎</button>';
        card.addEventListener('click', (ev) => {
          if (ev.target.closest('[data-edit]')) return;
          addFromLib(l.id);
        });
        card.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); addFromLib(l.id); }
        });
        const eb = card.querySelector('[data-edit]');
        eb.addEventListener('click', (ev) => { ev.stopPropagation(); openGearDialog(l.id); });
        grid.appendChild(card);
      });
      group.appendChild(grid);
      host.appendChild(group);
    });
  }

  function sizeText(l) {
    let s = l.w + '×' + l.d + 'cm';
    if (+l.hgt > 0) s += ' · 높이 ' + l.hgt;
    if (+l.guy > 0) s += ' · 가이 ' + l.guy;
    return s;
  }

  function addFromLib(libId) {
    const lib = S.library.find((l) => l.id === libId);
    if (!lib) return;
    const item = makeItem(lib, 0, 0);
    const spot = findFreeSpot(item);
    item.x = spot.x; item.y = spot.y;
    S.items.push(item);
    selId = item.id;
    hideHint();
    persist();
    schedule();
    updateSelbar();
    toast(lib.name + ' 배치 — 끌어서 옮기세요');
  }

  /* ============================== 장비 편집 모달 ============================== */
  let editingId = null;

  function gearFormItem() {
    const cat = $('#gCat').value || '텐트';
    const name = ($('#gName').value || '').trim() || '새 장비';
    const w = clamp(Math.round(+$('#gW').value || 150), 10, 2000);
    const d = clamp(Math.round(+$('#gD').value || 100), 10, 2000);
    const isCover = cat === '텐트' || cat === '타프';
    return {
      id: 'preview', name: name, cat: cat, w: w, d: d,
      hgt: clamp(Math.round(+$('#gH').value || 0), 0, 400),
      guy: clamp(Math.round(+$('#gGuy').value || 0), 0, 300),
      shape: $('#gShape').value || 'rect',
      color: $('#gColor').value || '#7aa7d9',
      door: $('#gDoor').value || 'none',
      memo: $('#gMemo').value || '',
      carStyle: cat === '차량' ? carStyleOfName(name) : null,
      rot: 0, lrot: 0, lside: isCover ? 'b' : 'c', lflip: 'n', x: 0, y: 0
    };
  }

  function renderGearPreview() {
    const c = $('#gearPreview');
    if (!c) return;
    const g = c.getContext('2d');
    const cw = c.width, ch = c.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = '#0c141c';
    g.fillRect(0, 0, cw, ch);
    g.strokeStyle = 'rgba(255,255,255,.045)';
    g.lineWidth = 1;
    for (let x = 0; x <= cw; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, ch); g.stroke(); }
    for (let y = 0; y <= ch; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(cw, y); g.stroke(); }

    const it = gearFormItem();
    const pad = 26;
    const sc = Math.min((cw - pad * 2) / Math.max(10, it.w + it.guy * 2), (ch - pad * 2) / Math.max(10, it.d + it.guy * 2));
    paintItem(g, it, sc, cw / 2, ch / 2 + 6, {
      lw: 2.6, fontPx: 14, labels: true, guy: true, bad: false, selected: false
    });
    // 치수 표시
    g.font = '600 13px system-ui, "Noto Sans KR", sans-serif';
    g.fillStyle = 'rgba(190,210,230,.75)';
    g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText(it.w + '×' + it.d + 'cm' + (it.guy ? ' · 가이 ' + it.guy : ''), 10, 8);
  }

  function buildGearChips() {
    const catHost = $('#gCatChips');
    if (!catHost) return;
    catHost.innerHTML = '';
    CATS.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c;
      b.setAttribute('data-cat', c);
      b.addEventListener('click', () => {
        $('#gCat').value = c;
        syncGearChips();
        syncModelVisibility();
        $('#gName').focus();
        renderGearPreview();
      });
      catHost.appendChild(b);
    });
    const shapeHost = $('#gShapeChips');
    shapeHost.innerHTML = '';
    SHAPES.forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s[1];
      b.setAttribute('data-shape', s[0]);
      b.addEventListener('click', () => {
        $('#gShape').value = s[0];
        syncGearChips();
        renderGearPreview();
      });
      shapeHost.appendChild(b);
    });
  }

  function syncGearChips() {
    const cat = $('#gCat').value;
    const shape = $('#gShape').value;
    $$('#gCatChips button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-cat') === cat));
    $$('#gShapeChips button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-shape') === shape));
  }

  function openGearDialog(libId) {
    const dlg = $('#gearDlg');
    editingId = libId || null;
    const lib = libId ? S.library.find((l) => l.id === libId) : null;
    $('#gearTitle').textContent = lib ? '장비 수정' : '장비 등록';
    $('#gDelete').style.display = lib ? '' : 'none';
    $('#gName').value = lib ? lib.name : '';
    $('#gCat').value = lib ? lib.cat : '텐트';
    $('#gW').value = lib ? lib.w : '';
    $('#gD').value = lib ? lib.d : '';
    $('#gH').value = lib ? (lib.hgt || '') : '';
    $('#gGuy').value = lib ? (lib.guy || '') : '';
    $('#gShape').value = lib ? (lib.shape || 'rect') : 'rect';
    $('#gDoor').value = lib ? (lib.door || 'none') : 'front';
    $('#gColor').value = lib ? (lib.color || '#7aa7d9') : '#7aa7d9';
    $('#gMemo').value = lib ? (lib.memo || '') : '';
    $('#gPlace').checked = !lib;
    $('#gPlace').parentNode.hidden = !!lib;
    const isCar = $('#gCat').value === '차량';
    $('#gModelWrap').hidden = !isCar;
    if (isCar) {
      const mi = lib ? CAR_MODELS.findIndex((m) => lib.name.indexOf(m.name) >= 0) : 0;
      $('#gModel').value = String(mi >= 0 ? mi : 0);
    }
    syncGearChips();
    renderGearPreview();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    if (!lib) setTimeout(() => $('#gName').focus(), 50);
  }

  function submitGear(ev) {
    ev.preventDefault();
    const name = $('#gName').value.trim();
    const w = Math.round(+$('#gW').value), d = Math.round(+$('#gD').value);
    if (!name || !(w >= 10) || !(d >= 10)) { toast('이름과 가로·세로(cm)를 확인해 주세요'); return; }
    const data = {
      name: name,
      cat: $('#gCat').value,
      w: clamp(w, 10, 2000),
      d: clamp(d, 10, 2000),
      hgt: clamp(Math.round(+$('#gH').value || 0), 0, 400),
      guy: clamp(Math.round(+$('#gGuy').value || 0), 0, 300),
      shape: $('#gShape').value,
      door: $('#gDoor').value,
      color: $('#gColor').value,
      memo: $('#gMemo').value.trim().slice(0, 24),
      carStyle: $('#gCat').value === '차량' ? carStyleOfName(name) : null
    };
    if (editingId) {
      const lib = S.library.find((l) => l.id === editingId);
      if (lib) {
        Object.assign(lib, data);
        // 이미 놓인 같은 장비도 규격을 맞춰 준다
        S.items.forEach((it) => {
          if (it.libId === lib.id) {
            it.name = lib.name; it.cat = lib.cat; it.w = lib.w; it.d = lib.d;
            it.hgt = lib.hgt; it.guy = lib.guy; it.shape = lib.shape; it.color = lib.color;
            it.door = lib.door; it.memo = lib.memo; it.carStyle = lib.carStyle || null;
          }
        });
      }
      toast('장비 정보를 저장했습니다');
    } else {
      const lib = Object.assign({ id: uid('lib') }, data);
      S.library.push(lib);
      const place = $('#gPlace').checked;
      if (place) {
        const item = makeItem(lib, 0, 0);
        const spot = findFreeSpot(item);
        item.x = spot.x; item.y = spot.y;
        S.items.push(item);
        selId = item.id;
        hideHint();
        render();
      }
      toast(place ? name + ' 등록 후 사이트에 놓았습니다' : name + ' 장비를 등록했습니다');
    }
    persist();
    renderLibrary();
    schedule();
    closeDialog($('#gearDlg'));
  }

  function deleteGear() {
    if (!editingId) return;
    const lib = S.library.find((l) => l.id === editingId);
    if (!lib) return;
    ask('장비함에서 "' + lib.name + '"을(를) 지울까요?\n이미 사이트에 놓인 장비는 그대로 남습니다.', () => {
      S.library = S.library.filter((l) => l.id !== editingId);
      persist();
      renderLibrary();
      closeDialog($('#gearDlg'));
      toast('장비함에서 지웠습니다');
    });
  }

  /* ============================== 사이트 설정 ============================== */
  function unitFactor() { return S.unit === 'm' ? 100 : 1; }

  function refreshSiteUI() {
    $('#siteW').value = fmt(S.site.w / unitFactor());
    $('#siteD').value = fmt(S.site.d / unitFactor());
    $('#siteW').step = S.unit === 'm' ? '0.1' : '1';
    $('#siteD').step = S.unit === 'm' ? '0.1' : '1';
    $('#areaNote').textContent = (S.site.w / 100).toFixed(1) + ' × ' + (S.site.d / 100).toFixed(1) + 'm · ' +
      (S.site.w * S.site.d / 10000).toFixed(1) + '㎡';
    $$('#unitSeg button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-unit') === S.unit));
    $$('#floorSeg button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-floor') === S.site.floor));
    $$('#gridSeg button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-grid') === S.site.grid));
    $('#optSnap').checked = !!S.snap;
    $('#optGuy').checked = !!S.guy;
  }

  let siteTimer = null;
  function applySiteInput() {
    clearTimeout(siteTimer);
    siteTimer = setTimeout(() => {
      const f = unitFactor();
      let w = Math.round((+$('#siteW').value || 0) * f);
      let d = Math.round((+$('#siteD').value || 0) * f);
      if (w < 100 || d < 100) return;
      w = clamp(w, 100, 5000); d = clamp(d, 100, 5000);
      if (w === S.site.w && d === S.site.d) return;
      S.site.w = w; S.site.d = d;
      view.auto = true;
      fitView();
      persist();
      render();
    }, 260);
  }

  function setPreset(p) {
    S.site.w = p.w; S.site.d = p.d; S.site.floor = p.floor;
    view.auto = true;
    fitView();
    refreshSiteUI();
    persist();
    render();
    toast('사이트 ' + p.label + '로 설정');
  }

  /* ============================== 차량 ============================== */
  function fillModelSelect(sel) {
    if (!sel) return;
    sel.innerHTML = '';
    CAR_MODELS.forEach((m, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = m.name + ' (' + m.w + '×' + m.d + ')';
      sel.appendChild(o);
    });
  }

  function addVehicleFromModel(idx) {
    const m = CAR_MODELS[idx] || CAR_MODELS[0];
    const name = '차량 · ' + m.name;
    let lib = S.library.find((l) => l.name === name);
    if (!lib) {
      lib = {
        id: uid('lib'), name: name, maker: '', cat: '차량',
        w: m.w, d: m.d, hgt: 0, guy: 0, shape: 'round', color: m.color,
        door: 'none', memo: m.name, carStyle: m.carStyle
      };
      S.library.push(lib);
      renderLibrary();
      persist();
    }
    addFromLib(lib.id);
    toast(m.name + ' ' + m.w + '×' + m.d + 'cm 차량을 배치했습니다');
  }

  function syncModelVisibility() {
    if ($('#gModelWrap')) $('#gModelWrap').hidden = $('#gCat').value !== '차량';
  }

  /* ============================== 배치안 ============================== */
  function renderPlans() {
    const host = $('#planList');
    if (!plans.length) {
      host.innerHTML = '<div class="plan-empty">저장한 배치안이 없습니다.<br>위에 이름을 넣고 <b>저장</b>을 누르면 지금 배치가 보관됩니다.</div>';
      return;
    }
    host.innerHTML = '';
    plans.forEach((p) => {
      const row = document.createElement('div');
      row.className = 'plan';
      const dt = new Date(p.at);
      const when = isNaN(dt.getTime()) ? '' : (dt.getMonth() + 1) + '/' + dt.getDate() + ' ' +
        String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
      row.innerHTML =
        '<span class="p-main"><b>' + esc(p.name) + '</b><small>' + (p.site.w / 100).toFixed(1) + '×' + (p.site.d / 100).toFixed(1) + 'm · ' +
        (FLOORS[p.site.floor] || '데크') + ' · 장비 ' + (p.items ? p.items.length : 0) + '개 · ' + esc(when) + '</small></span>' +
        '<span class="p-act"><button type="button" data-load="' + p.id + '">불러오기</button>' +
        '<button type="button" class="del" data-del="' + p.id + '">삭제</button></span>';
      host.appendChild(row);
    });
    $$('button[data-load]', host).forEach((b) => b.addEventListener('click', () => loadPlan(b.getAttribute('data-load'))));
    $$('button[data-del]', host).forEach((b) => b.addEventListener('click', () => deletePlan(b.getAttribute('data-del'))));
  }

  function savePlan() {
    const input = $('#planName');
    const name = (input.value || '').trim() || ('배치안 ' + (plans.length + 1));
    const plan = {
      id: uid('plan'),
      name: name.slice(0, 40),
      at: new Date().toISOString(),
      site: clone(S.site),
      items: clone(S.items)
    };
    plans.unshift(plan);
    persistPlans();
    renderPlans();
    input.value = '';
    toast('"' + plan.name + '" 배치안을 저장했습니다');
  }

  function loadPlan(id) {
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    ask('지금 화면을 "' + plan.name + '" 배치안으로 바꿀까요?\n지금 배치가 저장하지 않은 상태라면 사라집니다.', () => {
      S.site = {
        w: clamp(+plan.site.w || 500, 100, 5000),
        d: clamp(+plan.site.d || 700, 100, 5000),
        floor: FLOORS[plan.site.floor] ? plan.site.floor : 'deck',
        grid: ['off', 'm1', 'm05'].indexOf(plan.site.grid) >= 0 ? plan.site.grid : 'm1'
      };
      S.items = (plan.items || []).filter(validItem).map(fixItem);
      selId = null;
      view.auto = true;
      fitView();
      refreshSiteUI();
      persist();
      render();
      toast('"' + plan.name + '" 배치안을 불러왔습니다');
    });
  }

  function deletePlan(id) {
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    ask('"' + plan.name + '" 배치안을 지울까요?', () => {
      plans = plans.filter((p) => p.id !== id);
      persistPlans();
      renderPlans();
      toast('배치안을 지웠습니다');
    });
  }

  /* ============================== 모달 도우미 ============================== */
  function closeDialog(dlg) {
    if (!dlg) return;
    if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
  }

  function ask(text, onYes) {
    const dlg = $('#askDlg');
    $('#askText').textContent = text;
    ask._yes = onYes;
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
  }

  /* ============================== JSON · PNG ============================== */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
  }

  function exportJSON() {
    const data = {
      app: 'camp-layout-sim', version: 1, savedAt: new Date().toISOString(),
      site: S.site, snap: S.snap, guy: S.guy, unit: S.unit, wind: S.wind,
      library: S.library, items: S.items, plans: plans
    };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), 'camp-layout-' + stamp() + '.json');
    toast('JSON 백업 파일을 저장했습니다');
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = function () {
      let data;
      try { data = JSON.parse(String(reader.result)); } catch (e) { toast('JSON 파일을 읽지 못했습니다'); return; }
      if (!data || !data.site || !Array.isArray(data.items)) { toast('이 앱의 백업 파일이 아닙니다'); return; }
      ask('지금 사이트·장비함·배치안을 이 백업 파일 내용으로 바꿀까요?', () => {
        S.site = {
          w: clamp(+data.site.w || 500, 100, 5000),
          d: clamp(+data.site.d || 700, 100, 5000),
          floor: FLOORS[data.site.floor] ? data.site.floor : 'deck',
          grid: ['off', 'm1', 'm05'].indexOf(data.site.grid) >= 0 ? data.site.grid : 'm1'
        };
        S.items = (data.items || []).filter(validItem).map(fixItem);
        if (Array.isArray(data.library) && data.library.length) S.library = data.library.filter(validLib).map((l) => Object.assign({ id: uid('lib') }, l));
        if (Array.isArray(data.plans)) { plans = data.plans.filter((p) => p && p.name && p.site); persistPlans(); renderPlans(); }
        S.snap = data.snap !== false;
        S.guy = data.guy !== false;
        S.unit = data.unit === 'm' ? 'm' : 'cm';
        if (data.wind && typeof data.wind === 'object') {
          S.wind = { on: data.wind.on !== false, dir: isFinite(+data.wind.dir) ? normDeg(+data.wind.dir) : 90 };
        }
        selId = null;
        view.auto = true;
        fitView();
        refreshSiteUI();
        renderLibrary();
        persist();
        render();
        toast('백업을 불러왔습니다');
      });
    };
    reader.readAsText(file);
  }

  function solidFloor(kind) {
    return kind === 'deck' ? '#bb9066' : kind === 'gravel' ? '#aaa69c' : '#79a55c';
  }

  function exportPNG() {
    const w = S.site.w, d = S.site.d;
    const sc = clamp(2400 / Math.max(w, d), 2.2, 12);
    const pad = Math.round(sc * 14) + 20;
    const headerH = 74;
    const cols = S.items.length > 9 ? 2 : 1;
    const rows = Math.ceil(S.items.length / cols);
    const legendH = S.items.length ? 46 + rows * 26 : 16;

    const cw = Math.round(w * sc + pad * 2);
    const ch = Math.round(headerH + d * sc + pad * 2 + legendH);
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const g = c.getContext('2d');

    // 배경
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, cw, ch);

    // 머리글
    g.fillStyle = '#101820';
    g.font = '700 ' + Math.round(clamp(sc * 6, 20, 34)) + 'px system-ui, "Noto Sans KR", sans-serif';
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText('캠프 배치 도면', pad, pad + Math.round(clamp(sc * 5, 18, 28)));
    g.fillStyle = '#6b7c8d';
    g.font = '500 ' + Math.round(clamp(sc * 3.2, 13, 18)) + 'px system-ui, "Noto Sans KR", sans-serif';
    const sub = w + '×' + d + 'cm (' + (w / 100).toFixed(2) + '×' + (d / 100).toFixed(2) + 'm) · ' +
      FLOORS[S.site.floor] + ' · ' + (w * d / 10000).toFixed(1) + '㎡ · ' +
      new Date().toLocaleDateString('ko-KR') + ' · 장비 ' + S.items.length + '개';
    g.fillText(sub, pad, pad + Math.round(clamp(sc * 5, 18, 28)) + Math.round(clamp(sc * 3.6, 16, 22)));

    const ox = pad, oy = pad + headerH;

    // 바닥
    g.fillStyle = solidFloor(S.site.floor);
    g.fillRect(ox, oy, w * sc, d * sc);

    // 질감 힌트
    if (S.site.floor === 'deck') {
      g.strokeStyle = 'rgba(96,66,38,.22)';
      g.lineWidth = Math.max(1, sc * 0.25);
      for (let y = 0; y <= d; y += 30) {
        g.beginPath(); g.moveTo(ox, oy + y * sc); g.lineTo(ox + w * sc, oy + y * sc); g.stroke();
      }
    }

    // 격자
    if (S.site.grid !== 'off') {
      const step = S.site.grid === 'm05' ? 50 : 100;
      g.strokeStyle = 'rgba(255,255,255,.28)';
      g.lineWidth = Math.max(1, sc * 0.12);
      g.beginPath();
      for (let x = 0; x <= w; x += step) { g.moveTo(ox + x * sc, oy); g.lineTo(ox + x * sc, oy + d * sc); }
      for (let y = 0; y <= d; y += step) { g.moveTo(ox, oy + y * sc); g.lineTo(ox + w * sc, oy + y * sc); }
      g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.5)';
      g.lineWidth = Math.max(1, sc * 0.18);
      g.beginPath();
      for (let x = 0; x <= w; x += 100) { g.moveTo(ox + x * sc, oy); g.lineTo(ox + x * sc, oy + d * sc); }
      for (let y = 0; y <= d; y += 100) { g.moveTo(ox, oy + y * sc); g.lineTo(ox + w * sc, oy + y * sc); }
      g.stroke();
    }

    // 장비
    S.items.map((it, i) => ({ it, i, z: zOf(it) }))
      .sort((a, b) => a.z - b.z || a.i - b.i)
      .forEach(({ it }) => {
        const cx = ox + it.x * sc, cy = oy + it.y * sc;
        paintItem(g, it, sc, cx, cy, {
          lw: clamp(sc * 0.22, 1.6, 5),
          fontPx: Math.round(clamp(sc * 3.4, 12, 30)),
          labels: true,
          guy: S.guy,
          bad: lastIssues.outIds.has(it.id) || lastIssues.overlapIds.has(it.id),
          selected: false
        });
      });

    // 테두리
    g.strokeStyle = 'rgba(20,30,40,.75)';
    g.lineWidth = Math.max(1.5, sc * 0.3);
    g.strokeRect(ox, oy, w * sc, d * sc);

    // 축척 막대 (1m)
    const barY = oy + d * sc + Math.max(14, sc * 4);
    g.strokeStyle = '#2b3a48';
    g.lineWidth = Math.max(2, sc * 0.3);
    g.beginPath(); g.moveTo(ox, barY); g.lineTo(ox + 100 * sc, barY); g.stroke();
    g.beginPath();
    g.moveTo(ox, barY - 5); g.lineTo(ox, barY + 5);
    g.moveTo(ox + 100 * sc, barY - 5); g.lineTo(ox + 100 * sc, barY + 5);
    g.stroke();
    g.fillStyle = '#5b6b7b';
    g.font = '600 ' + Math.round(clamp(sc * 2.8, 11, 16)) + 'px system-ui, sans-serif';
    g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText('1m', ox + 100 * sc + 8, barY - 8);

    // 장비 목록
    if (S.items.length) {
      const ly = oy + d * sc + Math.max(14, sc * 4) + 34;
      g.fillStyle = '#101820';
      g.font = '700 ' + Math.round(clamp(sc * 3, 13, 17)) + 'px system-ui, "Noto Sans KR", sans-serif';
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillText('장비 목록', ox, ly);
      const colW = (w * sc) / cols;
      S.items.forEach((it, i) => {
        const col = Math.floor(i / rows), row = i % rows;
        const x = ox + col * colW;
        const y = ly + 20 + row * 26;
        g.fillStyle = it.color;
        g.beginPath(); g.arc(x + 6, y - 4, 5, 0, TAU); g.fill();
        g.fillStyle = '#243240';
        g.font = '500 ' + Math.round(clamp(sc * 2.9, 12, 15)) + 'px system-ui, "Noto Sans KR", sans-serif';
        const rot = Math.round(it.rot) % 360;
        const txt = it.name + '  ' + it.w + '×' + it.d + 'cm' + (it.guy ? ' · 가이 ' + it.guy : '') + (rot ? ' · ' + rot + '°' : '');
        g.fillText(txt, x + 18, y);
      });
    }

    c.toBlob((blob) => {
      if (!blob) { toast('이미지를 만들지 못했습니다'); return; }
      downloadBlob(blob, 'camp-layout-' + stamp() + '.png');
      toast('도면 PNG를 저장했습니다');
    }, 'image/png');
  }

  /* ============================== 3D 보기 ============================== */
  const V3 = {
    mode: false, ready: false, loading: false, failed: false, THREE: null,
    scene: null, camera: null, renderer: null, root: null, canvas: null,
    az: -0.62, el: 0.62, dist: 12, target: { x: 0, y: 0.5, z: 0 },
    ghost: false, dirty: true
  };

  const M3 = 0.01;   // cm → m

  async function loadThree() {
    if (V3.THREE) return V3.THREE;
    const urls = ['./three.module.min.js', 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js'];
    let lastErr = null;
    for (let i = 0; i < urls.length; i++) {
      try {
        const mod = await import(urls[i]);
        V3.THREE = mod;
        return mod;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('three load failed');
  }

  function show3DNotice(msg) {
    const host = $('#scene3d');
    let n = host.querySelector('.notice3d');
    if (!n) { n = document.createElement('div'); n.className = 'notice3d'; host.appendChild(n); }
    n.textContent = msg;
  }

  function setView3D(on) {
    if (on === V3.mode) return;
    if (on) enter3D(); else exit3D();
  }

  function enter3D() {
    $$('#viewSeg button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-view') === '3d'));
    $('#scene3d').hidden = false;
    $('#overlay3d').hidden = false;
    document.body.classList.add('mode3d');
    $('#cv').style.visibility = 'hidden';
    V3.mode = true;
    if (V3.ready) {
      V3.dirty = true;
      resize3D();
      build3DScene();
      fit3D();
      applyGhost3();
      render3D();
    } else if (V3.failed) {
      // 이미 실패한 경우: 2D로 남기고 알림
      exit3D();
      toast('3D를 불러오지 못했습니다 — 2D 도면으로 표시합니다');
    } else {
      show3DNotice('3D 화면을 준비하는 중…');
      startThree();
    }
  }

  function exit3D() {
    $$('#viewSeg button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-view') === '2d'));
    V3.mode = false;
    document.body.classList.remove('mode3d');
    $('#scene3d').hidden = true;
    $('#overlay3d').hidden = true;
    $('#cv').style.visibility = '';
    render();
  }

  async function startThree() {
    if (V3.loading) return;
    V3.loading = true;
    try {
      const THREE = await loadThree();
      initThree(THREE);
      V3.ready = true;
      resize3D();
      build3DScene();
      fit3D();
      applyGhost3();
      render3D();
    } catch (e) {
      V3.failed = true;
      exit3D();
      toast('3D를 불러오지 못했습니다 — 2D 도면으로 표시합니다');
    } finally {
      V3.loading = false;
    }
  }

  function initThree(THREE) {
    const host = $('#scene3d');
    host.innerHTML = '';
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(clamp(window.devicePixelRatio || 1, 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a1219');
    scene.fog = new THREE.Fog('#0a1219', 18, 60);

    const camera = new THREE.PerspectiveCamera(42, 1.6, 0.05, 300);

    V3.renderer = renderer;
    V3.scene = scene;
    V3.camera = camera;
    V3.canvas = canvas;
    V3.root = new THREE.Group();
    scene.add(V3.root);

    scene.add(new THREE.HemisphereLight(0xbfd8f2, 0x2c2519, 1.05));
    const sun = new THREE.DirectionalLight(0xfff1da, 2.05);
    sun.position.set(-6, 11, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 45;
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    sun.shadow.bias = -0.0008;
    scene.add(sun);
    V3.sun = sun;
    const fill = new THREE.DirectionalLight(0x88b6ff, 0.45);
    fill.position.set(8, 6, -9);
    scene.add(fill);

    bind3DControls(canvas);
  }

  function dispose3(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
      }
    });
  }

  function clearRoot3() {
    const root = V3.root;
    if (!root) return;
    while (root.children.length) {
      const o = root.children.pop();
      dispose3(o);
    }
  }

  function floorTexture3(kind) {
    const THREE = V3.THREE;
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const g = c.getContext('2d');
    if (kind === 'deck') {
      g.fillStyle = '#b98c5f'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 26) {
        g.fillStyle = 'rgba(86,58,32,.32)'; g.fillRect(0, y, 256, 3);
        g.fillStyle = 'rgba(255,238,208,.13)'; g.fillRect(0, y + 3, 256, 2);
      }
      for (let i = 0; i < 40; i++) {
        g.fillStyle = 'rgba(80,55,30,.11)';
        g.fillRect(Math.random() * 256, Math.random() * 256, 18 + Math.random() * 40, 1);
      }
    } else if (kind === 'gravel') {
      g.fillStyle = '#a8a49b'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 700; i++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(64,62,58,.34)' : 'rgba(255,255,255,.24)';
        g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 0.8 + Math.random() * 2.2, 0, TAU); g.fill();
      }
    } else {
      g.fillStyle = '#6d9a52'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 700; i++) {
        g.strokeStyle = Math.random() < 0.5 ? 'rgba(42,76,28,.34)' : 'rgba(196,226,152,.28)';
        const x = Math.random() * 256, y = Math.random() * 256;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 1.6, y - 3.6); g.stroke();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    if ('colorSpace' in tex) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function heightOf3(it, kind) {
    if (+it.hgt > 0) return it.hgt * M3;
    switch (kind) {
      case 'tent-dome': return 2.0;
      case 'tent-tunnel': return 2.1;
      case 'tent-air': return 1.95;
      case 'tent-ridge': return 1.95;
      case 'tarp-rect': case 'tarp-hex': return 1.8;
      case 'cot': return 0.42;
      case 'table': case 'table-igt': return 0.45;
      case 'chair': return 0.7;
      case 'box': return 0.36;
      case 'cooler': return 0.42;
      case 'shelf': return 0.85;
      case 'fire': return 0.4;
      case 'tree': return 4.6;
      case 'power': return 1.3;
      case 'vehicle': return 1.55;
      default: return 0.5;
    }
  }

  function buildGround3() {
    const THREE = V3.THREE, root = V3.root;
    const w = Math.max(1, S.site.w * M3), d = Math.max(1, S.site.d * M3);

    // 사이트 밖 바닥
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.max(50, w * 6), Math.max(50, d * 6)),
      new THREE.MeshStandardMaterial({ color: '#0d161e', roughness: 1 })
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.04;
    outer.receiveShadow = true;
    root.add(outer);

    // 사이트 바닥
    const tex = floorTexture3(S.site.floor);
    tex.repeat.set(Math.max(1, w / 2), Math.max(1, d / 2));
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.94, metalness: 0.02 })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    root.add(plane);

    // 사이트 테두리
    const frameMat = new THREE.MeshStandardMaterial({ color: '#33465a', roughness: 0.7, metalness: 0.15 });
    const th = 0.07, hh = 0.05;
    [[0, -d / 2], [0, d / 2]].forEach((p) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w + th * 2, hh * 2, th), frameMat);
      m.position.set(p[0], hh, p[1]);
      m.castShadow = true; m.receiveShadow = true;
      root.add(m);
    });
    [[-w / 2, 0], [w / 2, 0]].forEach((p) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(th, hh * 2, d + th * 2), frameMat);
      m.position.set(p[0], hh, p[1]);
      m.castShadow = true; m.receiveShadow = true;
      root.add(m);
    });

    // 1m 격자
    if (S.site.grid !== 'off') {
      const step = S.site.grid === 'm05' ? 0.5 : 1;
      const pts = [];
      for (let x = 0; x <= w + 0.001; x += step) pts.push([x - w / 2, 0.008, -d / 2], [x - w / 2, 0.008, d / 2]);
      for (let z = 0; z <= d + 0.001; z += step) pts.push([-w / 2, 0.008, z - d / 2], [w / 2, 0.008, z - d / 2]);
      const geo = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
      root.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#cfe4ff', transparent: true, opacity: 0.12 })));
    }

    // 바람 방향 표시
    if (S.wind && S.wind.on) {
      const rad = (S.wind.dir || 0) * Math.PI / 180;
      const dir = { x: Math.sin(rad), z: -Math.cos(rad) };
      const len = Math.min(w, d) * 0.22;
      const cx = w / 2 - len * 0.9, cz = -d / 2 + len * 0.9;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(cx - dir.x * len, 0.02, cz - dir.z * len),
        new THREE.Vector3(cx + dir.x * len, 0.02, cz + dir.z * len)
      ]);
      root.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#8fd0ff', transparent: true, opacity: 0.75 })));
    }
  }

  function addGuy3(grp, pts, color) {
    const THREE = V3.THREE;
    const geo = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    grp.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: color || '#d7e8f8', transparent: true, opacity: 0.34 })));
  }

  /* ==================== 3D 텐트 — 실제 제품별 조립 ==================== */
  /* 각 텐트의 실제 구조(지오데식 돔 / 터널·에어빔 / 로지형 / 캐빈)를 폴대·플라이·
     창문·출입문·캐노피로 나누어 만듭니다. 색은 제품 대표색(TENT_LOOKS)을 씁니다. */
  function buildTent3(grp, it, w, d, h) {
    const T = V3.THREE;
    const lookInfo = tentLookOf(it);
    const look = lookInfo.look;
    const spec = lookInfo.spec;
    const body = /^#[0-9a-f]{6}$/i.test(it.color || '') ? it.color : spec.body;

    const bodyMat = new T.MeshStandardMaterial({ color: body, roughness: 0.94, metalness: 0.02, side: T.DoubleSide });
    const flyMat = new T.MeshStandardMaterial({ color: spec.fly, roughness: 0.93, metalness: 0.02, side: T.DoubleSide });
    const poleMat = new T.MeshStandardMaterial({ color: spec.pole, roughness: 0.5, metalness: 0.35 });
    const meshMat = new T.MeshStandardMaterial({ color: shade(spec.mesh, 0.22), roughness: 0.45, metalness: 0.12, side: T.DoubleSide, transparent: true, opacity: 0.95 });
    const frameMat = new T.MeshStandardMaterial({ color: shade(body, -0.42), roughness: 0.9, side: T.DoubleSide });
    const doorMat = new T.MeshStandardMaterial({ color: shade(body, -0.34), roughness: 0.95, side: T.DoubleSide });
    const beamMat = new T.MeshStandardMaterial({ color: shade(body, 0.1), roughness: 0.95, metalness: 0.02 });
    const trimMat = new T.MeshStandardMaterial({ color: '#1e2227', roughness: 0.7, metalness: 0.3 });

    const V = (x, y, z) => new T.Vector3(x, y, z);
    const put = (geo, m, x, y, z, rx) => {
      const ms = new T.Mesh(geo, m);
      ms.position.set(x || 0, y || 0, z || 0);
      if (rx) ms.rotation.x = rx;
      ms.castShadow = true; ms.receiveShadow = true;
      grp.add(ms);
      return ms;
    };
    const tube = (pts, radius, m) => {
      const curve = new T.CatmullRomCurve3(pts);
      const ms = put(new T.TubeGeometry(curve, Math.max(14, pts.length * 3), radius, 7, false), m);
      ms.castShadow = false;      // 표면에 붙은 폴대가 자기 그림자를 만들지 않게
      return ms;
    };
    const shapeOf = (pts2) => {
      const s = new T.Shape();
      pts2.forEach((p, i) => { if (i === 0) s.moveTo(p.x, p.y); else s.lineTo(p.x, p.y); });
      s.closePath();
      return s;
    };

    // 벽 + 둥근 지붕 단면 (왼쪽 아래 → 벽 → 둥근 어깨 → 꼭대기 → 오른쪽 → 오른쪽 아래)
    const sectionPts = (halfW, top, wallR, seg) => {
      const out = [];
      const wallY = top * wallR, n = seg || 8;
      out.push({ x: -halfW, y: 0 });
      if (wallY > 0.001) out.push({ x: -halfW, y: wallY });
      for (let i = 1; i <= n; i++) {
        const t = i / n, mt = 1 - t;
        out.push({
          x: mt * mt * (-halfW) + 2 * mt * t * (-halfW) + t * t * 0,
          y: mt * mt * wallY + 2 * mt * t * top + t * t * top
        });
      }
      for (let i = 1; i <= n; i++) {
        const t = i / n, mt = 1 - t;
        out.push({
          x: mt * mt * 0 + 2 * mt * t * halfW + t * t * halfW,
          y: mt * mt * top + 2 * mt * t * top + t * t * wallY
        });
      }
      if (wallY > 0.001) out.push({ x: halfW, y: wallY });
      out.push({ x: halfW, y: 0 });
      return out;
    };
    const extrudeSection = (pts2, depth, m, kx) => {
      const g = new T.ExtrudeGeometry(shapeOf(pts2), { depth: depth, bevelEnabled: false, curveSegments: 1 });
      g.translate(0, 0, -depth / 2);
      if (kx) g.scale(kx, 1, 1);
      return put(g, m);
    };

    // 돔 껍질 (아래 벽 + 둥근 지붕) — 타원 단면
    const domeProf = (wallR, seg) => {
      const prof = [new T.Vector2(0.999, 0)];
      const n = seg || 9;
      for (let i = 0; i <= n; i++) {
        const t = i / n, a = t * Math.PI / 2;
        // 반지름은 천천히 줄고 높이는 빠르게 올라 편평한 지오데식 돔 모양
        prof.push(new T.Vector2(Math.pow(Math.cos(a), 0.72) * 0.999, wallR + Math.pow(Math.sin(a), 1.18) * (1 - wallR)));
      }
      return prof;
    };
    const domeShell = (wallR, m, k) => {
      const g = new T.LatheGeometry(domeProf(wallR), 42);
      g.scale(w * 0.5 * (k || 1), h * (k || 1), d * 0.5 * (k || 1));
      return put(g, m);
    };
    let domeRibCount = 0;
    const domeRib = (wallR, theta, radius) => {
      domeRibCount++;
      const prof = domeProf(wallR), k = 1.012;
      const s1 = prof.map((p) => V(p.x * w * 0.5 * k * Math.cos(theta), p.y * h * k, p.x * d * 0.5 * k * Math.sin(theta)));
      const s2 = prof.slice(1).reverse().slice(1).map((p) => V(p.x * w * 0.5 * k * Math.cos(theta + Math.PI), p.y * h * k, p.x * d * 0.5 * k * Math.sin(theta + Math.PI)));
      return tube(s1.concat(s2), radius, poleMat);
    };

    // 아치 모양 판 (출입문·창문) — 아래가 뚫린 반원형 지붕
    const archPanel = (halfW, top, wallR, m) => {
      const s = new T.Shape();
      const wallY = top * wallR;
      s.moveTo(-halfW, 0);
      s.lineTo(-halfW, wallY);
      s.quadraticCurveTo(-halfW, top, 0, top);
      s.quadraticCurveTo(halfW, top, halfW, wallY);
      s.lineTo(halfW, 0);
      s.closePath();
      return new T.ShapeGeometry(s, 18);
    };
    // 앞쪽 출입 현관(베스티블) — 작은 아치 터널
    const porch = (halfW, top, depth, wallR, m) => {
      const sec = sectionPts(halfW, top, wallR, 6);
      const g = new T.ExtrudeGeometry(shapeOf(sec), { depth: depth, bevelEnabled: false, curveSegments: 1 });
      return g;
    };
    const sideWindow = (sx, y0, y1, zc, len) => {
      // 벽면에 붙는 메쉬 창 — 테두리(어두운 판) + 메쉬
      const hh = y1 - y0;
      put(new T.PlaneGeometry(len + 0.07, hh + 0.07), frameMat, sx * (w * 0.5 + 0.007), (y0 + y1) / 2, zc).rotation.y = sx * Math.PI / 2;
      put(new T.PlaneGeometry(len, hh), meshMat, sx * (w * 0.5 + 0.016), (y0 + y1) / 2, zc).rotation.y = sx * Math.PI / 2;
    };
    const frontWindow = (zc, halfW, y0, y1, m) => {
      put(new T.PlaneGeometry(halfW * 2 + 0.07, (y1 - y0) + 0.07), frameMat, 0, (y0 + y1) / 2, zc);
      put(new T.PlaneGeometry(halfW * 2, y1 - y0), m || meshMat, 0, (y0 + y1) / 2, zc * 1.002);
    };
    const zipper = (x, y0, y1, z) => {
      put(new T.BoxGeometry(0.018, y1 - y0, 0.014), trimMat, x, (y0 + y1) / 2, z).castShadow = false;
    };

    /* ---------- 1) 빌리지 5.0 — 로지형 원터치 ---------- */
    if (look === 'village') {
      const wallR = 0.62;
      const sec = sectionPts(w * 0.5, h, wallR, 9);
      extrudeSection(sec, d, bodyMat);
      // 어두운 플라이 — 지붕 위 얇은 껍질 (처마에서 살짝 내려오게)
      const cut = h * (wallR - 0.06);
      const upper = sec.filter((p) => p.y >= cut - 0.001);
      const outer = upper.map((p) => ({ x: p.x * 1.028, y: p.y + 0.03 }));
      const inner = upper.slice().reverse().map((p) => ({ x: p.x * 0.985, y: p.y + 0.055 }));
      const band = outer.concat(inner);
      const fg = new T.ExtrudeGeometry(shapeOf(band), { depth: d * 1.02, bevelEnabled: false, curveSegments: 1 });
      fg.translate(0, 0, -d * 1.02 / 2);
      put(fg, flyMat);
      // 지붕 능선 폴대
      put(new T.BoxGeometry(0.055, 0.055, d * 1.03), poleMat, 0, h + 0.055, 0);
      // 옆면 메쉬 창문 (양쪽 2개씩) + 지퍼
      [-1, 1].forEach((sx) => {
        [-0.235, 0.235].forEach((fz) => {
          sideWindow(sx, h * 0.14, h * 0.42, fz * d, d * 0.3);
        });
      });
      // 앞 출입문 (아치) + 지퍼
      put(archPanel(w * 0.21, h * 0.62, 0.5, doorMat), doorMat, 0, 0, -d * 0.5 - 0.012);
      zipper(0, 0.02, h * 0.6, -d * 0.5 - 0.02);
      // 뒤 창
      frontWindow(d * 0.5 + 0.012, w * 0.19, h * 0.26, h * 0.62);
      // 앞 캐노피 — 어닝 (폴대 2개)
      const cw = w * 0.86, cDep = Math.min(0.72, d * 0.16), slope = 0.3;
      const cg = new T.PlaneGeometry(cw, cDep, 6, 3);
      {
        const p = cg.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const u = (p.getY(i) / cDep) + 0.5;
          p.setZ(i, -0.055 * Math.sin(u * Math.PI) - 0.03 * u);
        }
        p.needsUpdate = true; cg.computeVertexNormals();
      }
      const eaveY = h * wallR + 0.02;
      const canY = eaveY - (cDep / 2) * Math.sin(slope) * 0.94;
      const canZ = -d * 0.5 - (cDep / 2) * Math.cos(slope) * 0.97;
      put(cg, flyMat, 0, canY, canZ, -Math.PI / 2 - slope);
      const poleTop = eaveY - cDep * Math.sin(slope);
      // 앞 처마에 늘어지는 발란스(차양 끝단)
      put(new T.BoxGeometry(cw, 0.14, 0.015), flyMat, 0, poleTop - 0.07, -d * 0.5 - cDep * Math.cos(slope) * 0.96);
      [-1, 1].forEach((sx) => {
        put(new T.CylinderGeometry(0.021, 0.026, poleTop, 10), poleMat, sx * cw * 0.46, poleTop / 2, -d * 0.5 - cDep * Math.cos(slope) * 0.95);
        addGuy3(grp, [[sx * cw * 0.46, poleTop, -d * 0.5 - cDep * 0.95], [sx * (cw * 0.46 + 0.42), 0.01, -d * 0.5 - cDep * 0.95 - 0.5]]);
        // 어닝과 본체를 잇는 스트링
        addGuy3(grp, [[sx * cw * 0.46, poleTop, -d * 0.5 - cDep * 0.9], [sx * w * 0.45, h * 0.5, -d * 0.5]]);
      });
      // 모서리 가이라인
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((p) => {
        addGuy3(grp, [[p[0] * w * 0.485, h * wallR * 0.92, p[1] * d * 0.49], [p[0] * (w * 0.5 + 0.5), 0.01, p[1] * (d * 0.5 + 0.5)]]);
      });
      return grp;
    }

    /* ---------- 2) 지오데식 돔 (야크돔 450) ---------- */
    if (look === 'yakdome') {
      const wallR = 0.2;
      domeShell(wallR, bodyMat);
      [0, Math.PI / 3, (2 * Math.PI) / 3].forEach((th) => domeRib(wallR, th, 0.03));
      // 스커트(바닥 자락)
      const sk = put(new T.CylinderGeometry(1.01, 1.03, 0.16, 44, 1, true), flyMat, 0, 0.08, 0);
      sk.scale.set(w * 0.5, 1, d * 0.5);
      // 이음선(심) 테이프 — 어깨와 윗면
      const domeR = (yr) => {
        const t = (yr - wallR) / (1 - wallR);
        if (t <= 0) return 1;
        const a = Math.asin(Math.pow(Math.min(1, t), 1 / 1.18));
        return Math.pow(Math.cos(a), 0.72);
      };
      [wallR + 0.18, wallR + 0.52].forEach((yr) => {
        const rr = domeR(yr) * 0.998;
        const ring = put(new T.TorusGeometry(1, 0.011, 6, 48), flyMat, 0, 0, 0);
        ring.rotation.x = Math.PI / 2;
        ring.scale.set(w * 0.5 * rr, d * 0.5 * rr, 1);
        ring.position.y = h * yr;
      });
      // 꼭대기 환기캡
      put(new T.CylinderGeometry(0.07, 0.1, 0.12, 12), flyMat, 0, h * 0.99, 0);
      // 앞 현관 (베스티블) — 아치 터널
      const pw = w * 0.26, ph = h * 0.56, pd = Math.min(0.42, d * 0.1);
      const pg2 = porch(pw, ph, pd, 0.46);
      pg2.translate(0, 0, -d * 0.5 - pd + 0.02);
      put(pg2, flyMat);
      put(archPanel(pw * 0.72, ph * 0.86, 0.5, doorMat), doorMat, 0, 0, -d * 0.5 - pd + 0.005);
      zipper(0, 0.02, ph * 0.8, -d * 0.5 - pd - 0.005);
      // 양쪽 작은 창
      [[-1, -1], [1, 1]].forEach((p) => {
        const t = 0.55;
        put(new T.CircleGeometry(w * 0.11, 18), meshMat, p[0] * w * 0.42 * t, h * 0.3, p[1] * d * 0.42 * t).rotation.y = Math.atan2(p[0] * 0.42 * w / (w * 0.5), p[1] * 0.42 * d / (d * 0.5));
      });
      // 가이라인
      [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, Math.PI * 4 / 3, Math.PI * 5 / 3].forEach((th, i) => {
        if (i % 2) return;
        const x = Math.cos(th) * w * 0.5 * 1.02, z = Math.sin(th) * d * 0.5 * 1.02;
        addGuy3(grp, [[x, h * 0.16, z], [x * 1.35, 0.01, z * 1.35]]);
      });
      return grp;
    }

    /* ---------- 3) 터널형 에어텐트 (위켄트립 모델V) ---------- */
    if (look === 'modelv') {
      const halfW = w * 0.5, wallR = 0.42;
      const sec = sectionPts(halfW, h, wallR, 8);
      extrudeSection(sec, d, bodyMat);
      // 둥근 에어빔 4개
      const nB = 4;
      for (let i = 0; i < nB; i++) {
        const z = -d * 0.5 + (d * (i + 0.5)) / nB;
        tube(sec.map((p) => V(p.x * 1.012, p.y * 1.008, z)), 0.075, beamMat);
      }
      // 어깨 이음선
      [-1, 1].forEach((sx) => {
        put(new T.BoxGeometry(0.02, 0.02, d * 0.98), flyMat, sx * halfW * 0.93, h * 0.52, 0).castShadow = false;
      });
      // 앞·뒤 출입문
      put(archPanel(halfW * 0.44, h * 0.6, 0.52, doorMat), doorMat, 0, 0, -d * 0.5 - 0.012);
      zipper(0, 0.02, h * 0.58, -d * 0.5 - 0.02);
      frontWindow(d * 0.5 + 0.012, halfW * 0.34, h * 0.16, h * 0.44);
      // 옆면 큰 메쉬 창
      [-1, 1].forEach((sx) => {
        sideWindow(sx, h * 0.12, h * 0.36, -d * 0.14, d * 0.3);
        sideWindow(sx, h * 0.12, h * 0.36, d * 0.2, d * 0.22);
      });
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((p) => {
        addGuy3(grp, [[p[0] * halfW * 0.99, h * 0.4, p[1] * d * 0.5], [p[0] * (halfW + 0.55), 0.01, p[1] * (d * 0.5 + 0.55)]]);
      });
      return grp;
    }

    /* ---------- 4) 대형 3룸 터널 (제드 티맥스 EX) ---------- */
    if (look === 'timax') {
      const halfW = w * 0.5, wallR = 0.45;
      const sec = sectionPts(halfW, h, wallR, 8);
      extrudeSection(sec, d, bodyMat);
      // 지붕 플라이 (어두운 상단 껍질)
      const cut = h * wallR * 0.98;
      const upper = sec.filter((p) => p.y >= cut - 0.001);
      const outer = upper.map((p) => ({ x: p.x * 1.022, y: p.y + 0.03 }));
      const inner = upper.slice().reverse().map((p) => ({ x: p.x * 0.99, y: p.y + 0.05 }));
      const fg = new T.ExtrudeGeometry(shapeOf(outer.concat(inner)), { depth: d * 0.99, bevelEnabled: false, curveSegments: 1 });
      fg.translate(0, 0, -d * 0.99 / 2);
      put(fg, flyMat);
      // 아치 폴대 5개
      for (let i = 0; i < 5; i++) {
        const z = -d * 0.5 + (d * (i + 0.5)) / 5;
        tube(sec.map((p) => V(p.x * 1.012, p.y * 1.008, z)), 0.033, poleMat);
      }
      // 앞 출입문 + 뒤 문
      put(archPanel(halfW * 0.4, h * 0.6, 0.5, doorMat), doorMat, 0, 0, -d * 0.5 - 0.012);
      zipper(0, 0.02, h * 0.58, -d * 0.5 - 0.02);
      frontWindow(d * 0.5 + 0.012, halfW * 0.3, h * 0.16, h * 0.42);
      // 옆면 창문 (룸마다)
      [-1, 1].forEach((sx) => {
        [-0.28, -0.02, 0.24].forEach((fz) => sideWindow(sx, h * 0.13, h * 0.37, fz * d, d * 0.19));
      });
      // 앞 미니 타프
      const tw = w * 0.8, td = Math.min(0.6, d * 0.1), slope = 0.38;
      const mini = new T.PlaneGeometry(tw, td, 4, 2);
      { const mp = mini.attributes.position;
        for (let i = 0; i < mp.count; i++) mp.setZ(i, -0.02 * Math.sin(((mp.getY(i) / td) + 0.5) * Math.PI));
        mp.needsUpdate = true; mini.computeVertexNormals(); }
      const mEave = h * wallR + 0.01;
      put(mini, flyMat, 0, mEave - (td / 2) * Math.sin(slope), -d * 0.5 - (td / 2) * Math.cos(slope), -Math.PI / 2 - slope);
      const mPole = mEave - td * Math.sin(slope);
      put(new T.BoxGeometry(tw, 0.1, 0.014), flyMat, 0, mPole - 0.05, -d * 0.5 - td * Math.cos(slope));
      [-1, 1].forEach((sx) => {
        put(new T.CylinderGeometry(0.019, 0.023, mPole, 10), poleMat, sx * tw * 0.46, mPole / 2, -d * 0.5 - td * Math.cos(slope) * 0.97);
        addGuy3(grp, [[sx * tw * 0.46, mPole, -d * 0.5 - td], [sx * (tw * 0.46 + 0.4), 0.01, -d * 0.5 - td * 1.4]]);
      });
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((p) => {
        addGuy3(grp, [[p[0] * halfW * 0.99, h * 0.42, p[1] * d * 0.5], [p[0] * (halfW + 0.6), 0.01, p[1] * (d * 0.5 + 0.6)]]);
      });
      return grp;
    }

    /* ---------- 5) 면 자립형 돔 (트레블첵 라움 미니) ---------- */
    if (look === 'raum') {
      const wallR = 0.34;
      domeShell(wallR, bodyMat);
      domeRib(wallR, Math.PI / 4, 0.026);
      domeRib(wallR, -Math.PI / 4, 0.026);
      // 그라운드시트 테두리
      const gb = 0.055, bh = 0.07;
      put(new T.BoxGeometry(w * 1.0, bh, gb), flyMat, 0, bh / 2, -d * 0.5);
      put(new T.BoxGeometry(w * 1.0, bh, gb), flyMat, 0, bh / 2, d * 0.5);
      put(new T.BoxGeometry(gb, bh, d * 1.0), flyMat, -w * 0.5, bh / 2, 0);
      put(new T.BoxGeometry(gb, bh, d * 1.0), flyMat, w * 0.5, bh / 2, 0);
      // 앞뒤 아치 문
      const pw = w * 0.24, ph = h * 0.62, pd = 0.26;
      const p1 = porch(pw, ph, pd, 0.5);
      p1.translate(0, 0, -d * 0.5 - pd + 0.02);
      put(p1, bodyMat);
      put(archPanel(pw * 0.74, ph * 0.85, 0.55, doorMat), doorMat, 0, 0, -d * 0.5 - pd);
      zipper(0, 0.02, ph * 0.8, -d * 0.5 - pd - 0.006);
      const p2 = porch(pw, ph * 0.8, pd * 0.7, 0.5);
      p2.translate(0, 0, d * 0.5 - 0.02);
      put(p2, bodyMat);
      put(archPanel(pw * 0.7, ph * 0.68, 0.55, doorMat), doorMat, 0, 0, d * 0.5 + pd * 0.7 - 0.006);
      // 옆 창
      [-1, 1].forEach((sx) => sideWindow(sx, h * 0.16, h * 0.4, 0, d * 0.24));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((p) => {
        addGuy3(grp, [[p[0] * w * 0.48, h * 0.2, p[1] * d * 0.48], [p[0] * (w * 0.5 + 0.38), 0.01, p[1] * (d * 0.5 + 0.38)]]);
      });
      return grp;
    }

    /* ---------- 6) 컴팩트 돔 (폴러 투맨) ---------- */
    if (look === 'poler') {
      const wallR = 0.12;
      domeShell(wallR, bodyMat);
      domeRib(wallR, 0, 0.024);
      domeRib(wallR, Math.PI / 2, 0.024);
      const sk = put(new T.CylinderGeometry(1.01, 1.03, 0.1, 40, 1, true), flyMat, 0, 0.05, 0);
      sk.scale.set(w * 0.5, 1, d * 0.5);
      // 앞 큰 둥근 출입문 (베스티블)
      const pw = w * 0.3, ph = h * 0.66, pd = 0.24;
      const pg3 = porch(pw, ph, pd, 0.56);
      pg3.translate(0, 0, -d * 0.5 - pd + 0.02);
      put(pg3, flyMat);
      put(archPanel(pw * 0.78, ph * 0.84, 0.62, doorMat), doorMat, 0, 0, -d * 0.5 - pd);
      zipper(0, 0.02, ph * 0.78, -d * 0.5 - pd - 0.006);
      // 뒤 환기 창
      frontWindow(d * 0.5 + 0.012, w * 0.12, h * 0.24, h * 0.5);
      // 옆 둥근 창
      [-1, 1].forEach((sx) => {
        put(new T.CircleGeometry(h * 0.11, 16), meshMat, sx * (w * 0.5 + 0.012) * 0.93, h * 0.3, 0).rotation.y = sx * Math.PI / 2;
      });
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((p) => {
        addGuy3(grp, [[p[0] * w * 0.47, h * 0.22, p[1] * d * 0.47], [p[0] * (w * 0.5 + 0.3), 0.01, p[1] * (d * 0.5 + 0.3)]]);
      });
      return grp;
    }

    /* ---------- 7) 에어빔 캐빈 (지오에어 4) ---------- */
    const halfW = w * 0.5, wallR = 0.56;
    const sec = sectionPts(halfW, h, wallR, 9);
    extrudeSection(sec, d, bodyMat);
    // 굵은 에어폴대 — 앞뒤 + 능선
    [-1, 0.15, 1].forEach((fz) => {
      const z = fz * (d * 0.5 - 0.06);
      tube(sec.map((p) => V(p.x * 1.01, p.y * 1.008, z)), 0.085, beamMat);
    });
    put(new T.CylinderGeometry(0.075, 0.075, d * 0.94, 12), beamMat, 0, h * 1.0, 0).rotation.x = Math.PI / 2;
    // 큰 메쉬 창 (옆면 넓게, 앞면 일부)
    [-1, 1].forEach((sx) => {
      sideWindow(sx, h * 0.14, h * 0.46, -d * 0.16, d * 0.36);
      sideWindow(sx, h * 0.14, h * 0.46, d * 0.22, d * 0.2);
    });
    // 출입문 (앞) + 지퍼 + 문 테두리
    put(archPanel(halfW * 0.46, h * 0.6, 0.55, doorMat), doorMat, 0, 0, -d * 0.5 - 0.012);
    zipper(0, 0.02, h * 0.56, -d * 0.5 - 0.02);
    zipper(-halfW * 0.4, 0.05, h * 0.42, -d * 0.5 - 0.02);
    frontWindow(d * 0.5 + 0.012, halfW * 0.3, h * 0.14, h * 0.4);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((p) => {
      addGuy3(grp, [[p[0] * halfW * 0.99, h * 0.5, p[1] * d * 0.5], [p[0] * (halfW + 0.6), 0.01, p[1] * (d * 0.5 + 0.6)]]);
    });
    return grp;
  }

  /* ==================== 3D 타프 — 능선·사이드 폴대·가이라인 ==================== */
  /* 렉타: 가운데 메인 폴대 2개(2.4m)가 능선, 네 귀퉁이 사이드 폴대(1.8m)로 ㅅ자로 내려옴.
     헥사: 메인 폴대 2개를 잇는 능선에서 6각 윙이 나비 날개 곡선으로 낮게 당겨짐. */
  function buildTarp3(grp, it, w, d, kind) {
    const T = V3.THREE;
    const color = /^#[0-9a-f]{6}$/i.test(it.color || '') ? it.color : '#b9a077';
    const coverMat = new T.MeshStandardMaterial({ color: color, roughness: 0.96, metalness: 0.02, side: T.DoubleSide });
    const poleMat = new T.MeshStandardMaterial({ color: '#cfd8e2', roughness: 0.42, metalness: 0.35 });
    const V = (x, y, z) => new T.Vector3(x, y, z);
    const add = (geo, m, x, y, z, rx) => {
      const ms = new T.Mesh(geo, m);
      ms.position.set(x || 0, y || 0, z || 0);
      if (rx) ms.rotation.x = rx;
      ms.castShadow = true; ms.receiveShadow = true;
      grp.add(ms); return ms;
    };
    const pole = (x, z, hh, r) => {
      add(new T.CylinderGeometry(r || 0.022, (r || 0.022) * 1.2, hh, 10), poleMat, x, hh / 2, z);
      add(new T.CylinderGeometry((r || 0.022) * 2.6, (r || 0.022) * 2.6, 0.03, 10), poleMat, x, 0.015, z).castShadow = false;
      add(new T.CylinderGeometry((r || 0.022) * 1.6, (r || 0.022) * 1.6, 0.02, 10), poleMat, x, hh, z).castShadow = false;
    };
    const guy = (pts) => addGuy3(grp, pts);
    const peg = (x, z) => {
      add(new T.CylinderGeometry(0.018, 0.01, 0.16, 6), new T.MeshStandardMaterial({ color: '#c9d2db', roughness: 0.5, metalness: 0.5 }), x, 0.07, z).rotation.x = 0.35;
    };

    const MAIN = 2.4, SIDE = 1.8, WING = 1.15;

    if (kind !== 'tarp-hex') {
      // ---------- 렉타 타프 ----------
      // 능선(u=0)에서 2.4m, 좌우 가장자리로 ㅅ자로 내려와 1.8m
      const surfY = (u, v) => {
        const au = Math.abs(u), av = Math.abs(v);
        let y = SIDE + (MAIN - SIDE) * Math.pow(Math.max(0, 1 - av), 1.25);
        y -= 0.05 * (1 - av) * Math.cos(au * Math.PI * 0.5);            // 능선 처짐
        if (au > 0.6) y -= ((au - 0.6) / 0.4) * 0.34 * (1 - av * 0.7);  // 양 끝 능선이 내려감
        y -= 0.035 * Math.sin(au * Math.PI) * (1 - av);                 // 천 늘어짐
        return y;
      };
      const g = new T.PlaneGeometry(w, d, 16, 12);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        p.setZ(i, surfY(p.getX(i) / (w * 0.5), p.getY(i) / (d * 0.5)));
      }
      p.needsUpdate = true;
      g.computeVertexNormals();
      g.rotateX(-Math.PI / 2);
      add(g, coverMat);
      // 메인 폴대 2개 (능선)
      const mainX = 0.3, mY = surfY(mainX, 0);
      [-1, 1].forEach((s) => pole(s * w * mainX, 0, mY, 0.024));
      // 사이드 폴대 4개 (네 귀퉁이) — 천 높이에 맞춤
      const cx = 0.47, cz = 0.47, cY = surfY(cx, cz);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((c) => pole(c[0] * w * cx, c[1] * d * cz, cY, 0.021));
      // 가이라인 — 귀퉁이 4곳 + 양 끝 능선
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((c) => {
        const x = c[0] * w * cx, z = c[1] * d * cz;
        const ex = x * 1.24, ez = z * 1.24;
        guy([[x, cY - 0.03, z], [ex, 0.02, ez]]);
        peg(ex, ez);
      });
      [-1, 1].forEach((s) => {
        const x = s * w * 0.5, y = surfY(1, 0) - 0.02;
        guy([[x * 0.99, y, 0], [x * 1.3, 0.02, 0]]);
        peg(x * 1.3, 0);
      });
      // 메인 폴대 밑동 스트링
      [-1, 1].forEach((s) => {
        guy([[s * w * mainX, mY - 0.06, 0], [s * w * mainX, 0.05, 0]]);
      });
      return grp;
    }

    // ---------- 헥사 타프 ----------
    const corners = [
      { x: w * 0.5, z: 0 }, { x: w * 0.25, z: d * 0.5 }, { x: -w * 0.25, z: d * 0.5 },
      { x: -w * 0.5, z: 0 }, { x: -w * 0.25, z: -d * 0.5 }, { x: w * 0.25, z: -d * 0.5 }
    ];
    const per = 7, rows = 6;
    const rays = [];
    const rimY = (z) => WING + (SIDE + 0.25 - WING) * Math.pow(Math.max(0, 1 - Math.abs(z) / (d * 0.5)), 1.15);
    for (let i = 0; i < 6; i++) {
      const a = corners[i], b = corners[(i + 1) % 6];
      for (let j = 0; j < per; j++) {
        const t = j / per;
        const pull = 0.09 * Math.sin(Math.PI * t);       // 변 가운데를 안쪽으로 → 나비 날개 곡선
        const x = (a.x + (b.x - a.x) * t) * (1 - pull);
        const z = (a.z + (b.z - a.z) * t) * (1 - pull);
        rays.push({ x: x, z: z, y: rimY(z) });
      }
    }
    const pos = [], idx = [];
    const NR = rays.length;
    for (let r = 0; r < NR; r++) {
      const ray = rays[r];
      const ax = ray.x * 0.7, az = 0;
      for (let j = 0; j <= rows; j++) {
        const t = j / rows;
        const x = ray.x + (ax - ray.x) * t;
        const z = ray.z + (az - ray.z) * t;
        let y = ray.y + (MAIN - ray.y) * Math.pow(t, 0.85);
        y -= 0.07 * Math.sin(t * Math.PI);
        pos.push(x, y, z);
      }
    }
    for (let r = 0; r < NR; r++) {
      const r2 = (r + 1) % NR;
      for (let j = 0; j < rows; j++) {
        const a = r * (rows + 1) + j, b = r * (rows + 1) + j + 1;
        const c = r2 * (rows + 1) + j, e = r2 * (rows + 1) + j + 1;
        idx.push(a, c, b, b, c, e);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    add(geo, coverMat);
    // 메인 폴대 2개 (능선)
    [-1, 1].forEach((s) => pole(s * w * 0.3, 0, MAIN - 0.02, 0.024));
    // 6각 윙 — 낮게 당긴 가이라인 + 팩
    corners.forEach((c) => {
      const ex = c.x * 1.3, ez = c.z * 1.3;
      guy([[c.x, rimY(c.z) - 0.02, c.z], [ex, 0.02, ez]]);
      peg(ex, ez);
    });
    [-1, 1].forEach((s) => {
      guy([[s * w * 0.5, rimY(0), 0], [s * w * 0.72, 0.02, 0]]);
      peg(s * w * 0.72, 0);
    });
    [-1, 1].forEach((s) => {
      guy([[s * w * 0.3, MAIN - 0.06, 0], [s * w * 0.3, 0.05, 0]]);
    });
    return grp;
  }

  function buildItem3(it) {
    const THREE = V3.THREE;
    const kind = kindOf(it);
    const w = Math.max(0.1, it.w * M3), d = Math.max(0.1, it.d * M3);
    const h = heightOf3(it, kind);
    const color = /^#[0-9a-f]{6}$/i.test(it.color || '') ? it.color : '#7aa7d9';
    const grp = new THREE.Group();
    grp.position.set((it.x - S.site.w / 2) * M3, 0, (it.y - S.site.d / 2) * M3);
    grp.rotation.y = -it.rot * Math.PI / 180;
    grp.userData.itemId = it.id;

    const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0.03 }, o || {}));
    const mesh = (geo, m, x, y, z) => {
      const ms = new THREE.Mesh(geo, m);
      ms.position.set(x || 0, y || 0, z || 0);
      ms.castShadow = true; ms.receiveShadow = true;
      grp.add(ms);
      return ms;
    };

    /* ---- 차량 ---- */
    if (kind === 'vehicle') {
      const style = carStyleOf(it);
      const iron = style === 'ironman', dark = style === 'black';
      const bodyMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.34, metalness: 0.5 });
      const redMat = new THREE.MeshStandardMaterial({ color: '#b8232f', roughness: 0.3, metalness: 0.45 });
      const goldMat = new THREE.MeshStandardMaterial({ color: '#d8a63c', roughness: 0.28, metalness: 0.85 });
      const glassMat = new THREE.MeshStandardMaterial({ color: '#0d141c', roughness: 0.1, metalness: 0.85 });
      const tireMat = new THREE.MeshStandardMaterial({ color: '#0a0c10', roughness: 0.95 });
      const rimMat = new THREE.MeshStandardMaterial({ color: '#8f9aa6', roughness: 0.3, metalness: 0.9 });
      const lampMat = new THREE.MeshStandardMaterial({ color: '#fff3cd', emissive: '#ffeaa9', emissiveIntensity: 1.0, roughness: 0.3 });
      const tailMat = new THREE.MeshStandardMaterial({ color: '#ff4a54', emissive: '#a8101a', emissiveIntensity: 0.8, roughness: 0.35 });
      const trimMat = new THREE.MeshStandardMaterial({ color: '#20262e', roughness: 0.6, metalness: 0.4 });

      const H = h;   // 전체 높이
      const halfD = d * 0.46;

      // 옆모습 실루엣(앞 -x)을 폭 방향으로 압출 — 앞범퍼→보닛→앞유리→루프→뒷유리→트렁크
      // 앞 -x, 뒤 +x. 코나(아이언맨)는 트렁크가 튀어나오지 않는 SUV 해치백 실루엣
      const prof = iron
        ? [[-0.5, 0.16], [-0.487, 0.36], [-0.462, 0.52], [-0.35, 0.575], [-0.21, 0.635],
           [-0.05, 0.9], [0.13, 0.945], [0.29, 0.93], [0.37, 0.8], [0.425, 0.66],
           [0.462, 0.44], [0.487, 0.23], [0.5, 0.16]]
        : dark
          ? [[-0.5, 0.14], [-0.48, 0.5], [-0.45, 0.88], [0.28, 0.94], [0.44, 0.52], [0.5, 0.46], [0.5, 0.14]]
          : [[-0.5, 0.15], [-0.478, 0.44], [-0.36, 0.52], [-0.19, 0.57], [-0.06, 0.87], [0.16, 0.92], [0.3, 0.79], [0.42, 0.6], [0.475, 0.3], [0.5, 0.15]];
      const shp = new THREE.Shape();
      prof.forEach((p, i) => {
        const x = p[0] * w, y = p[1] * H;
        if (i === 0) shp.moveTo(x, y); else shp.lineTo(x, y);
      });
      shp.closePath();
      const bodyGeo = new THREE.ExtrudeGeometry(shp, {
        depth: halfD * 2, bevelEnabled: true, bevelSize: Math.min(0.05, d * 0.04),
        bevelThickness: 0.04, bevelSegments: 2, curveSegments: 2
      });
      bodyGeo.translate(0, 0, -halfD);
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.castShadow = true; body.receiveShadow = true;
      grp.add(body);

      // 유리 (앞·뒤 경사면 + 옆창)
      const slope = (x1, y1, x2, y2, width, offset) => {
        const len = Math.hypot((x2 - x1) * w, (y2 - y1) * H);
        const ang = Math.atan2((y2 - y1) * H, (x2 - x1) * w);
        const m = new THREE.Mesh(new THREE.BoxGeometry(len * 0.96, 0.035, width), glassMat);
        m.position.set((x1 + x2) / 2 * w, (y1 + y2) / 2 * H + offset, 0);
        m.rotation.z = ang;
        m.castShadow = false;
        grp.add(m);
      };
      if (dark) {
        slope(-0.47, 0.84, -0.45, 0.5, d * 0.82, 0.02);   // 앞유리 (거의 수직)
        slope(0.3, 0.9, 0.43, 0.54, d * 0.82, 0.02);      // 뒷유리
      } else if (iron) {
        slope(-0.2, 0.645, -0.06, 0.895, d * 0.74, 0.02);  // 앞유리
        slope(0.28, 0.925, 0.36, 0.805, d * 0.72, 0.02);   // 뒷유리 (해치 경사)
        // 옆창 — 앞·뒤 두 칸
        [-1, 1].forEach((s) => {
          [[-0.02, 0.17], [0.15, 0.15]].forEach((p) => {
            const sw = new THREE.Mesh(new THREE.BoxGeometry(w * p[1], H * 0.145, 0.02), glassMat);
            sw.position.set(w * p[0], H * 0.715, s * (halfD + 0.004));
            sw.castShadow = false;
            grp.add(sw);
          });
        });
      } else {
        slope(-0.19, 0.57, -0.06, 0.87, d * 0.8, 0.02);
        slope(0.16, 0.92, 0.3, 0.79, d * 0.8, 0.02);
        [-1, 1].forEach((s) => {
          const sw = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, H * 0.2, 0.02), glassMat);
          sw.position.set(w * 0.07, H * 0.74, s * (halfD + 0.004));
          sw.castShadow = false;
          grp.add(sw);
        });
      }

      // 코나 아이언맨 — 레드 루프 · 레드 보닛 · 골드 포인트
      if (iron) {
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.33, 0.02, d * 0.74), redMat);
        roof.position.set(w * 0.125, H * 0.948, 0);
        roof.castShadow = true;
        grp.add(roof);
        [-1, 1].forEach((s) => {
          const gs = new THREE.Mesh(new THREE.BoxGeometry(w * 0.34, 0.012, 0.03), goldMat);
          gs.position.set(w * 0.125, H * 0.962, s * d * 0.3);
          gs.castShadow = false;
          grp.add(gs);
        });
        const hoodLen = Math.hypot(0.27 * w, 0.1 * H);
        const hood = new THREE.Mesh(new THREE.BoxGeometry(hoodLen, 0.03, d * 0.8), redMat);
        hood.position.set(-0.33 * w, H * 0.565, 0);
        hood.rotation.z = Math.atan2(0.1 * H, 0.27 * w);
        hood.castShadow = false;
        grp.add(hood);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(hoodLen * 0.9, 0.012, 0.05), goldMat);
        stripe.position.set(-0.33 * w, H * 0.586, 0);
        stripe.rotation.z = Math.atan2(0.1 * H, 0.27 * w);
        stripe.castShadow = false;
        grp.add(stripe);
      }

      // 바퀴 4개 (차체 옆면에 붙게)
      const wheelR = Math.max(0.24, H * 0.21);
      const wheelW = Math.min(0.3, d * 0.14);
      const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 18);
      wheelGeo.rotateX(Math.PI / 2);
      const rimGeo = new THREE.CylinderGeometry(wheelR * 0.52, wheelR * 0.52, wheelW * 1.03, 12);
      rimGeo.rotateX(Math.PI / 2);
      [[-0.31, -1], [-0.31, 1], [0.3, -1], [0.3, 1]].forEach((p) => {
        const wx = p[0] * w, wz = p[1] * (halfD - wheelW * 0.35);
        mesh(wheelGeo, tireMat, wx, wheelR, wz);
        mesh(rimGeo, rimMat, wx, wheelR, wz).castShadow = false;
      });

      // 앞 범퍼 · 그릴
      mesh(new THREE.BoxGeometry(0.06, H * 0.18, d * 0.9), trimMat, -w * 0.49, H * 0.24, 0).castShadow = false;
      if (iron) {
        // SUV 하단 클래딩 — 차체 안쪽에 얇게
        mesh(new THREE.BoxGeometry(w * 0.9, H * 0.07, d * 0.99), trimMat, 0, H * 0.16, 0).castShadow = false;
      }

      // 헤드라이트 · 테일램프
      [-1, 1].forEach((s) => {
        mesh(new THREE.BoxGeometry(0.07, H * 0.1, d * 0.2), lampMat, -w * 0.465, H * 0.44, s * d * 0.29).castShadow = false;
        mesh(new THREE.BoxGeometry(0.07, H * 0.09, d * 0.18), tailMat, w * 0.485, H * 0.46, s * d * 0.28).castShadow = false;
      });

      // 사이드미러
      [-1, 1].forEach((s) => {
        mesh(new THREE.BoxGeometry(0.1, 0.06, 0.12), trimMat, -w * 0.17, H * 0.6, s * (halfD + 0.06)).castShadow = false;
      });
      return grp;
    }

    /* ---- 텐트 ---- */
    if (kind.indexOf('tent') === 0) {
      buildTent3(grp, it, w, d, h);
      // 출입문 앞 매트
      if (it.door !== 'none') {
        const dirs = { front: [0, -1], back: [0, 1], left: [-1, 0], right: [1, 0] };
        const dv = dirs[it.door];
        mesh(new THREE.BoxGeometry(w * 0.34, 0.02, 0.32), mat('#2b3138'), dv[0] * (w * 0.5 + 0.2), 0.01, dv[1] * (d * 0.5 + 0.2)).castShadow = false;
      }
      return grp;
    }

    /* ---- 타프 ---- */
    if (kind.indexOf('tarp') === 0) {
      return buildTarp3(grp, it, w, d, kind);
    }

    /* ---- 야전침대 ---- */
    if (kind === 'cot') {
      const frameMat = new THREE.MeshStandardMaterial({ color: '#98a5b3', roughness: 0.35, metalness: 0.6 });
      const bedMat = mat(shade(color, 0.16));
      const rail = 0.05;
      [-1, 1].forEach((s) => {
        mesh(new THREE.BoxGeometry(w * 0.96, rail, rail), frameMat, 0, h - rail, s * d * 0.44);
      });
      mesh(new THREE.BoxGeometry(w * 0.9, 0.06, d * 0.8), bedMat, 0, h - 0.03, 0);
      // 다리
      const legGeo = new THREE.CylinderGeometry(0.018, 0.018, h, 8);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((p) => {
        const lg = new THREE.Mesh(legGeo, frameMat);
        lg.position.set(p[0] * w * 0.42, h / 2, p[1] * d * 0.4);
        lg.castShadow = true;
        grp.add(lg);
      });
      // 베개
      mesh(new THREE.BoxGeometry(w * 0.15, 0.1, d * 0.62), mat('#eef4fa'), -w * 0.38, h + 0.04, 0);
      return grp;
    }

    /* ---- 테이블 / IGT ---- */
    if (kind === 'table' || kind === 'table-igt') {
      const woodMat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.72, metalness: 0.05 });
      const legMat = new THREE.MeshStandardMaterial({ color: '#8e9aa6', roughness: 0.4, metalness: 0.55 });
      mesh(new THREE.BoxGeometry(w, 0.045, d), woodMat, 0, h - 0.022, 0);
      if (kind === 'table') {
        // 나무 슬랫 표현
        const slatMat = new THREE.MeshStandardMaterial({ color: shade(color, 0.18), roughness: 0.75 });
        for (let i = 0; i < 4; i++) {
          const z = -d / 2 + (d * (i + 0.5)) / 4;
          mesh(new THREE.BoxGeometry(w * 0.985, 0.008, d * 0.16), slatMat, 0, h + 0.002, z).castShadow = false;
        }
      } else {
        const burnerMat = new THREE.MeshStandardMaterial({ color: '#2b333c', roughness: 0.45, metalness: 0.5 });
        const n = w > d * 1.4 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const x = n === 1 ? 0 : (i - 0.5) * w * 0.46;
          mesh(new THREE.BoxGeometry(w * 0.42, 0.05, d * 0.62), burnerMat, x, h + 0.01, 0);
        }
      }
      const legGeo = new THREE.BoxGeometry(0.035, h, 0.035);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((p) => {
        const lg = new THREE.Mesh(legGeo, legMat);
        lg.position.set(p[0] * w * 0.44, h / 2, p[1] * d * 0.4);
        lg.castShadow = true;
        grp.add(lg);
      });
      return grp;
    }

    /* ---- 의자 ---- */
    if (kind === 'chair') {
      const frameMat = new THREE.MeshStandardMaterial({ color: shade(color, -0.15), roughness: 0.55, metalness: 0.3 });
      const seatMat = mat(shade(color, 0.14));
      const seatY = h * 0.58;
      mesh(new THREE.BoxGeometry(w * 0.9, 0.06, d * 0.78), seatMat, 0, seatY, 0);
      const back = mesh(new THREE.BoxGeometry(w * 0.88, h * 0.55, 0.06), seatMat, 0, seatY + h * 0.26, d * 0.36);
      back.rotation.x = -0.22;
      const legGeo = new THREE.BoxGeometry(0.03, seatY, 0.03);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((p) => {
        const lg = new THREE.Mesh(legGeo, frameMat);
        lg.position.set(p[0] * w * 0.4, seatY / 2, p[1] * d * 0.34);
        lg.castShadow = true;
        grp.add(lg);
      });
      // 팔걸이
      [-1, 1].forEach((s) => {
        mesh(new THREE.BoxGeometry(w * 0.86, 0.035, 0.035), frameMat, 0, seatY + 0.2, s * d * 0.42);
      });
      return grp;
    }

    /* ---- 카고박스 · 쿨러 ---- */
    if (kind === 'box' || kind === 'cooler') {
      const boxMat = mat(color);
      const lidMat = mat(shade(color, 0.16));
      mesh(new THREE.BoxGeometry(w * 0.96, h * 0.82, d * 0.94), boxMat, 0, h * 0.41, 0);
      mesh(new THREE.BoxGeometry(w, h * 0.16, d * 0.98), lidMat, 0, h * 0.9, 0);
      // 손잡이
      const hMat = new THREE.MeshStandardMaterial({ color: '#20262d', roughness: 0.7 });
      [-1, 1].forEach((s) => {
        mesh(new THREE.BoxGeometry(0.03, 0.05, d * 0.4), hMat, s * w * 0.5, h * 0.86, 0).castShadow = false;
      });
      if (kind === 'cooler') {
        mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 10), hMat, w * 0.44, h * 0.5, d * 0.44).castShadow = false;
      }
      return grp;
    }

    /* ---- 쉘프 ---- */
    if (kind === 'shelf') {
      const frameMat = new THREE.MeshStandardMaterial({ color: '#7d7468', roughness: 0.6, metalness: 0.25 });
      const shelfMat = mat(shade(color, 0.1));
      const postGeo = new THREE.BoxGeometry(0.03, h, 0.03);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach((p) => {
        const ps = new THREE.Mesh(postGeo, frameMat);
        ps.position.set(p[0] * w * 0.45, h / 2, p[1] * d * 0.42);
        ps.castShadow = true;
        grp.add(ps);
      });
      [0.02, 0.36, 0.68, 0.98].forEach((f) => {
        mesh(new THREE.BoxGeometry(w * 0.94, 0.025, d * 0.9), shelfMat, 0, h * f, 0);
      });
      return grp;
    }

    /* ---- 화로대 ---- */
    if (kind === 'fire') {
      const metal = new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.55, metalness: 0.55 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.48, Math.min(w, d) * 0.4, h * 0.8, 8), metal);
      body.position.y = h * 0.4;
      body.castShadow = true; body.receiveShadow = true;
      grp.add(body);
      const emberMat = new THREE.MeshStandardMaterial({
        color: '#ff8a3d', emissive: '#ff6a1e', emissiveIntensity: 1.25, roughness: 0.9
      });
      const ember = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.34, Math.min(w, d) * 0.3, 0.04, 12), emberMat);
      ember.position.y = h * 0.82;
      grp.add(ember);
      const gl = new THREE.PointLight(0xff8a3a, 0.75, 2.4);
      gl.position.set(0, h * 0.95, 0);
      grp.add(gl);
      // 그릴
      const grillMat = new THREE.MeshStandardMaterial({ color: '#20252b', roughness: 0.5, metalness: 0.7 });
      for (let i = -1; i <= 1; i++) {
        mesh(new THREE.BoxGeometry(Math.min(w, d) * 0.8, 0.012, 0.012), grillMat, 0, h * 0.86, i * Math.min(w, d) * 0.2).castShadow = false;
      }
      return grp;
    }

    /* ---- 나무 ---- */
    if (kind === 'tree') {
      const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4f37', roughness: 0.95 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.22, Math.min(w, d) * 0.3, h * 0.55, 10), trunkMat);
      trunk.position.y = h * 0.27;
      trunk.castShadow = true; trunk.receiveShadow = true;
      grp.add(trunk);
      const leafMat = new THREE.MeshStandardMaterial({ color: shade(color, -0.05), roughness: 1, flatShading: true });
      const leafMat2 = new THREE.MeshStandardMaterial({ color: shade(color, 0.14), roughness: 1, flatShading: true });
      const r = Math.min(w, d) * 2.4;
      [[0, h * 0.78, 0, r], [-r * 0.45, h * 0.62, r * 0.2, r * 0.72], [r * 0.4, h * 0.66, -r * 0.25, r * 0.66]].forEach((p, i) => {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(p[3], 1), i % 2 ? leafMat2 : leafMat);
        leaf.position.set(p[0], p[1], p[2]);
        leaf.castShadow = true; leaf.receiveShadow = true;
        grp.add(leaf);
      });
      return grp;
    }

    /* ---- 배전함 ---- */
    if (kind === 'power') {
      const cab = new THREE.MeshStandardMaterial({ color: '#9a9a86', roughness: 0.65, metalness: 0.3 });
      mesh(new THREE.BoxGeometry(w, h, d), cab, 0, h / 2, 0);
      const warn = new THREE.MeshStandardMaterial({ color: '#ffd64c', emissive: '#7a5a00', emissiveIntensity: 0.3, roughness: 0.6 });
      mesh(new THREE.BoxGeometry(0.02, h * 0.22, d * 0.22), warn, w / 2 + 0.005, h * 0.62, 0).castShadow = false;
      mesh(new THREE.BoxGeometry(w * 1.04, 0.05, d * 1.04), new THREE.MeshStandardMaterial({ color: '#6c6c5c', roughness: 0.8 }), 0, h + 0.02, 0);
      return grp;
    }

    /* ---- 그 밖의 장비 ---- */
    const genericMat = mat(color);
    mesh(new THREE.BoxGeometry(w * 0.94, Math.max(0.12, h * 0.8), d * 0.94), genericMat, 0, Math.max(0.12, h * 0.8) / 2, 0);
    return grp;
  }

  function build3DScene() {
    if (!V3.ready || !V3.root) return;
    clearRoot3();
    buildGround3();
    S.items.slice().sort((a, b) => zOf(a) - zOf(b)).forEach((it) => {
      const g = buildItem3(it);
      if (g) V3.root.add(g);
    });
    V3.dirty = false;
    applyGhost3();
  }

  // 투시 — 텐트·타프만 반투명
  function applyGhost3() {
    if (!V3.ready || !V3.root) return;
    const coverIds = new Set(S.items.filter((i) => groupOf(i) === 'cover').map((i) => i.id));
    V3.root.children.forEach((grp) => {
      if (!grp.userData.itemId) return;
      if (!coverIds.has(grp.userData.itemId)) return;
      grp.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (!m || m.userData && m.userData.keepSolid) return;
          m.transparent = V3.ghost;
          m.opacity = V3.ghost ? 0.3 : 1;
          m.depthWrite = !V3.ghost;
          m.needsUpdate = true;
        });
      });
    });
  }

  function camPos3() {
    const t = V3.target;
    const ce = Math.cos(V3.el), se = Math.sin(V3.el);
    return {
      x: t.x + V3.dist * ce * Math.sin(V3.az),
      y: t.y + V3.dist * se,
      z: t.z + V3.dist * ce * Math.cos(V3.az)
    };
  }

  function applyCamera3() {
    if (!V3.camera) return;
    const p = camPos3();
    V3.camera.position.set(p.x, p.y, p.z);
    V3.camera.lookAt(V3.target.x, V3.target.y, V3.target.z);
  }

  function fit3D() {
    const w = Math.max(1, S.site.w * M3), d = Math.max(1, S.site.d * M3);
    const aspect = (V3.camera && V3.camera.aspect) || 1.6;
    const vfov = 42 * Math.PI / 180;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const R = Math.hypot(w, d) / 2;
    const distV = R / Math.tan(vfov / 2);
    const distH = R / Math.tan(hfov / 2);
    V3.target = { x: 0, y: Math.max(0.5, Math.min(w, d) * 0.12), z: 0 };
    V3.dist = clamp(Math.max(distV, distH) * 1.02 + 0.8, 2, 120);
    V3.az = -0.62;
    V3.el = 0.6;
    applyCamera3();
  }

  function render3D() {
    if (!V3.ready || !V3.renderer) return;
    V3.renderer.render(V3.scene, V3.camera);
  }

  function resize3D() {
    if (!V3.ready || !V3.mode) return;
    const host = $('#scene3d');
    if (!host) return;
    const r = host.getBoundingClientRect();
    const w = Math.max(80, Math.round(r.width)), h = Math.max(80, Math.round(r.height));
    if (!w || !h) return;
    V3.renderer.setPixelRatio(clamp(window.devicePixelRatio || 1, 1, 2));
    V3.renderer.setSize(w, h, false);
    V3.camera.aspect = w / h;
    V3.camera.updateProjectionMatrix();
    render3D();
  }

  function bind3DControls(canvas) {
    const pts = new Map();
    let drag = null, pinch = null;

    const orbitUpdate = () => { applyCamera3(); render3D(); };

    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.classList.add('dragging');
      if (pts.size === 1) {
        drag = { az: V3.az, el: V3.el, x: e.clientX, y: e.clientY };
      } else if (pts.size === 2) {
        drag = null;
        const a = Array.from(pts.values());
        pinch = { d0: Math.max(24, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)), dist: V3.dist };
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size >= 2 && pinch) {
        const a = Array.from(pts.values());
        const dd = Math.max(24, Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y));
        V3.dist = clamp(pinch.dist * (pinch.d0 / dd), 1.2, 80);
        orbitUpdate();
        return;
      }
      if (!drag) return;
      V3.az = drag.az + (e.clientX - drag.x) * 0.0075;
      V3.el = clamp(drag.el + (e.clientY - drag.y) * 0.0062, 0.05, 1.45);
      orbitUpdate();
    });

    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (!pts.size) { drag = null; canvas.classList.remove('dragging'); }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('lostpointercapture', up);

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      V3.dist = clamp(V3.dist * Math.exp(e.deltaY * 0.0013), 1.2, 80);
      orbitUpdate();
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ============================== 초기화·이벤트 ============================== */
  function hideHint() {
    $('#hint').classList.add('off');
  }

  function bind() {
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);
    cv.addEventListener('lostpointercapture', onUp);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoomBy(Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());

    $('#windToggle').addEventListener('click', () => {
      S.wind.on = !S.wind.on;
      refreshWindUI(); persist(); render();
    });
    $$('.wind-rot').forEach((b) => b.addEventListener('click', () => {
      S.wind.dir = normDeg((S.wind.dir || 0) + (+b.getAttribute('data-wind')));
      refreshWindUI(); persist(); render();
    }));

    $('#btnZoomIn').addEventListener('click', () => zoomBy(1.25));
    $('#btnZoomOut').addEventListener('click', () => zoomBy(0.8));
    $('#btnFit').addEventListener('click', () => { fitView(); schedule(); });

    // 탭
    $$('#tabs button').forEach((b) => {
      b.addEventListener('click', () => {
        $$('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
        $$('.pane').forEach((p) => p.classList.toggle('active', p.id === 'pane-' + b.getAttribute('data-tab')));
      });
    });

    // 장비 등록
    $('#btnAuto').addEventListener('click', () => {
      ask('지금 장비들을 사이트에 맞춰 자동으로 정리할까요?\n(자동 배치 후에도 손으로 옮기고 돌릴 수 있습니다)', autoArrange);
    });
    $('#btnNewGear').addEventListener('click', () => openGearDialog(null));
    $('#btnQuickAdd').addEventListener('click', () => openGearDialog(null));

    // 2D · 3D 보기 전환
    $$('#viewSeg button').forEach((b) => b.addEventListener('click', () => {
      setView3D(b.getAttribute('data-view') === '3d');
    }));
    $('#btn3dReset').addEventListener('click', () => { fit3D(); render3D(); });
    $('#btn3dGhost').addEventListener('click', () => {
      V3.ghost = !V3.ghost;
      $('#btn3dGhost').setAttribute('aria-pressed', V3.ghost ? 'true' : 'false');
      applyGhost3();
      render3D();
      toast(V3.ghost ? '투시 — 텐트 속 침대·테이블까지 보입니다' : '실제 외관 보기');
    });

    // 새 장비 미리보기
    ['gName', 'gW', 'gD', 'gH', 'gGuy', 'gColor', 'gMemo', 'gDoor'].forEach((id) => {
      const el = $('#' + id);
      if (el) {
        el.addEventListener('input', renderGearPreview);
        el.addEventListener('change', renderGearPreview);
      }
    });

    // 글씨 방향 · 위치
    $$('#selLrot button').forEach((b) => b.addEventListener('click', () => {
      const it = getSel();
      if (!it) return;
      it.lrot = normLrot(+b.getAttribute('data-lrot'));
      persist(); schedule(); updateSelbar();
    }));
    $('#selLflip').addEventListener('click', () => {
      const it = getSel();
      if (!it) return;
      it.lflip = it.lflip === 'h' ? 'v' : it.lflip === 'v' ? 'n' : 'h';
      persist(); schedule(); updateSelbar();
      toast('글씨 ' + (it.lflip === 'n' ? '정상' : it.lflip === 'h' ? '좌우 반전' : '상하 반전'));
    });
    $('#selLside').addEventListener('change', () => {
      const it = getSel();
      if (!it) return;
      it.lside = L_SIDES.indexOf($('#selLside').value) >= 0 ? $('#selLside').value : 'c';
      persist(); schedule();
    });
    $('#iLrotToggle').addEventListener('click', () => {
      const cur = normLrot($('#iLrot').value);
      $('#iLrot').value = String(cur === 0 ? 90 : cur === 90 ? 0 : cur === 180 ? 270 : 180);
    });
    $('#iLrotFlip').addEventListener('click', () => {
      $('#iLrot').value = String(normLrot($('#iLrot').value) + 180);
    });
    $('#btnAddVeh').addEventListener('click', () => addVehicleFromModel(+$('#vehModel').value));
    $('#gCat').addEventListener('change', syncModelVisibility);
    $('#gModel').addEventListener('change', () => {
      const m = CAR_MODELS[+$('#gModel').value];
      if (!m) return;
      $('#gName').value = '차량 · ' + m.name;
      $('#gW').value = m.w;
      $('#gD').value = m.d;
      $('#gColor').value = m.color;
    });
    $('#iModel').addEventListener('change', () => {
      const m = CAR_MODELS[+$('#iModel').value];
      if (!m) return;
      $('#iName').value = '차량 · ' + m.name;
      $('#iW').value = m.w;
      $('#iD').value = m.d;
      $('#iColor').value = m.color;
    });
    $('#gearForm').addEventListener('submit', submitGear);
    $('#gDelete').addEventListener('click', deleteGear);
    $$('[data-close]').forEach((b) => b.addEventListener('click', () => closeDialog(b.closest('dialog'))));

    $('#btnHelp').addEventListener('click', () => {
      const dlg = $('#helpDlg');
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    });

    $('#status').addEventListener('click', () => {
      const n = lastIssues.outIds.size + lastIssues.pairs.length;
      toast(n ? '사이트 밖 ' + lastIssues.outIds.size + '개 · 본체 겹침 ' + lastIssues.pairs.length + '쌍' : '모든 장비가 사이트 안에서 겹치지 않습니다');
    });

    // 사이트
    $('#siteW').addEventListener('input', applySiteInput);
    $('#siteD').addEventListener('input', applySiteInput);
    $$('#unitSeg button').forEach((b) => b.addEventListener('click', () => {
      const u = b.getAttribute('data-unit');
      if (u === S.unit) return;
      S.unit = u;
      refreshSiteUI();
      persist();
    }));
    $$('#floorSeg button').forEach((b) => b.addEventListener('click', () => {
      S.site.floor = b.getAttribute('data-floor');
      refreshSiteUI(); persist(); render();
    }));
    $$('#gridSeg button').forEach((b) => b.addEventListener('click', () => {
      S.site.grid = b.getAttribute('data-grid');
      refreshSiteUI(); persist(); render();
    }));
    $('#optSnap').addEventListener('change', (e) => { S.snap = e.target.checked; persist(); });
    $('#optGuy').addEventListener('change', (e) => { S.guy = e.target.checked; persist(); render(); });

    // 프리셋
    const presets = $('#presets');
    PRESETS.forEach((p) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = p.label;
      b.addEventListener('click', () => setPreset(p));
      presets.appendChild(b);
    });

    // 데이터
    $('#btnExportJson').addEventListener('click', exportJSON);
    $('#btnImportJson').addEventListener('click', () => $('#fileJson').click());
    $('#fileJson').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importJSON(f);
      e.target.value = '';
    });
    $('#btnClear').addEventListener('click', () => {
      if (!S.items.length) { toast('사이트가 이미 비어 있습니다'); return; }
      ask('사이트에 놓인 장비 ' + S.items.length + '개를 모두 지울까요? (장비함은 그대로)', () => {
        S.items = []; selId = null; persist(); render();
        toast('사이트를 비웠습니다');
      });
    });
    $('#btnResetLib').addEventListener('click', () => {
      ask('장비함을 기본 장비(텐트 7종 포함)로 되돌릴까요?\n직접 추가·수정한 장비는 사라지고, 사이트에 놓인 장비는 그대로 남습니다.', () => {
        S.library = clone(DEFAULT_LIBRARY);
        persist(); renderLibrary();
        toast('기본 장비함으로 복원했습니다');
      });
    });

    // 배치안
    $('#btnSavePlan').addEventListener('click', savePlan);
    $('#planName').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); savePlan(); } });
    $('#btnPng').addEventListener('click', exportPNG);
    $('#btnPng2').addEventListener('click', exportPNG);

    // 선택 바
    $('#selClose').addEventListener('click', () => { selId = null; schedule(); });
    ['selW', 'selD', 'selG'].forEach((id) => {
      const el = $('#' + id);
      el.addEventListener('input', () => {
        clearTimeout(sizeTimer);
        sizeTimer = setTimeout(applySelSize, 240);
      });
      el.addEventListener('change', () => { clearTimeout(sizeTimer); applySelSize(); });
    });
    $('#selEdit').addEventListener('click', () => openItemDialog(getSel()));
    $('#itemForm').addEventListener('submit', submitItem);
    $$('#selbar [data-act]').forEach((b) => b.addEventListener('click', () => {
      const it = getSel();
      if (!it) return;
      const act = b.getAttribute('data-act');
      if (act === 'rot-15') it.rot = normDeg(it.rot - 15);
      else if (act === 'rot+15') it.rot = normDeg(it.rot + 15);
      else if (act === 'rot90') it.rot = normDeg(it.rot + 90);
      else if (act === 'rot0') it.rot = 0;
      else if (act === 'dup') {
        const copy = clone(it);
        copy.id = uid('it');
        copy.x = it.x + 30; copy.y = it.y + 30;
        S.items.push(copy); selId = copy.id;
        toast('복제했습니다');
      } else if (act === 'del') {
        S.items = S.items.filter((x) => x.id !== it.id);
        selId = null;
      }
      persist(); schedule();
    }));

    // 확인 모달
    $('#askYes').addEventListener('click', () => {
      const fn = ask._yes;
      closeDialog($('#askDlg'));
      ask._yes = null;
      if (typeof fn === 'function') fn();
    });
    $('#askNo').addEventListener('click', () => { ask._yes = null; closeDialog($('#askDlg')); });

    // 키보드
    window.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      const openDlg = document.querySelector('dialog[open]');
      if (openDlg) return;
      const it = getSel();
      if (!it) return;
      let changed = false;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        S.items = S.items.filter((x) => x.id !== it.id); selId = null; changed = true;
      } else if (e.key === 'r' || e.key === 'R') {
        it.rot = normDeg(it.rot + 90); changed = true;
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        const copy = clone(it); copy.id = uid('it'); copy.x += 30; copy.y += 30;
        S.items.push(copy); selId = copy.id; changed = true;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 10;
        if (e.key === 'ArrowLeft') it.x -= step;
        if (e.key === 'ArrowRight') it.x += step;
        if (e.key === 'ArrowUp') it.y -= step;
        if (e.key === 'ArrowDown') it.y += step;
        changed = true;
      }
      if (changed) { persist(); schedule(); }
    });

    window.addEventListener('resize', () => { resizeCanvas(); resize3D(); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => { resizeCanvas(); resize3D(); });
    new ResizeObserver(() => { resizeCanvas(); resize3D(); }).observe($('#canvasWrap'));
  }

  function init() {
    cv = $('#cv');
    ctx = cv.getContext('2d');
    loadState();

    // select 옵션
    const catSel = $('#gCat');
    CATS.forEach((c) => { const o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o); });
    const shapeSel = $('#gShape');
    SHAPES.forEach((s) => { const o = document.createElement('option'); o.value = s[0]; o.textContent = s[1]; shapeSel.appendChild(o); });
    const doorSel = $('#gDoor');
    DOORS.forEach((s) => { const o = document.createElement('option'); o.value = s[0]; o.textContent = s[1]; doorSel.appendChild(o); });
    const iShape = $('#iShape');
    SHAPES.forEach((s) => { const o = document.createElement('option'); o.value = s[0]; o.textContent = s[1]; iShape.appendChild(o); });
    const iDoor = $('#iDoor');
    DOORS.forEach((s) => { const o = document.createElement('option'); o.value = s[0]; o.textContent = s[1]; iDoor.appendChild(o); });
    fillModelSelect($('#vehModel'));
    fillModelSelect($('#gModel'));
    fillModelSelect($('#iModel'));

    bind();
    refreshSiteUI();
    refreshWindUI();
    renderLibrary();
    renderPlans();
    buildGearChips();
    resizeCanvas();
    if (S.items.length) hideHint();
    render();

    // 검증·디버그용 읽기 창구 (앱 동작에는 영향 없음)
    window.__camp = {
      get state() { return S; },
      get items() { return S.items; },
      get library() { return S.library; },
      get issues() { return lastIssues; },
      get selected() { return getSel(); },
      get view() { return view; },
      addFromLib: addFromLib,
      autoArrange: autoArrange,
      addVehicle: addVehicleFromModel,
      select: function (id) { selId = id; schedule(); },
      exportPNG: exportPNG,
      setView3D: setView3D,
      kindOf: kindOf,
      get mode3d() { return V3.mode; },
      get view3d() { return V3; },
      renderPreview: renderGearPreview,
      paintItem: paintItem
    };

    window.__camp3d = {
      get ready() { return V3.ready; },
      get failed() { return V3.failed; },
      get mode() { return V3.mode; },
      get scene() { return V3.scene; },
      get camera() { return V3.camera; },
      get root() { return V3.root; },
      get ghost() { return V3.ghost; },
      get renderer() { return V3.renderer; },
      setGhost: function (on) { V3.ghost = !!on; applyGhost3(); render3D(); },
      rebuild: function () { build3DScene(); render3D(); },
      fit: fit3D,
      render: render3D
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
