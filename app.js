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
    { id: 'tent-yakdome450', name: '야크돔 450', maker: '위오', cat: '텐트', w: 440, d: 460, hgt: 210, guy: 50, shape: 'round', color: '#4f8df7', door: 'front', memo: '돔형' },
    { id: 'tent-modelv', name: '위켄트립 모델V', maker: '', cat: '텐트', w: 350, d: 625, hgt: 225, guy: 80, shape: 'rect', color: '#3ecf8e', door: 'front', memo: '터널형' },
    { id: 'tent-timaxex', name: '제드 티맥스 EX', maker: '', cat: '텐트', w: 400, d: 680, hgt: 225, guy: 100, shape: 'rect', color: '#f5a24b', door: 'front', memo: '대형 터널형' },
    { id: 'tent-raummini', name: '트레블첵 라움 미니', maker: '', cat: '텐트', w: 200, d: 260, hgt: 130, guy: 40, shape: 'rect', color: '#b07cf5', door: 'front', memo: '사각 돔' },
    { id: 'tent-poler2', name: '폴러 투맨', maker: '', cat: '텐트', w: 152, d: 216, hgt: 102, guy: 40, shape: 'rect', color: '#f25f6a', door: 'front', memo: '경량 돔' },
    { id: 'tent-village5', name: '네이처하이크 빌리지 5.0', maker: '', cat: '텐트', w: 210, d: 470, hgt: 190, guy: 60, shape: 'rect', color: '#2fc7c0', door: 'front', memo: '로지형' },
    { id: 'tent-geoair4', name: '지오에어 4', maker: '디얼스', cat: '텐트', w: 230, d: 300, hgt: 190, guy: 60, shape: 'rect', color: '#e879c0', door: 'front', memo: '에어텐트' },
    // --- 타프 ---
    { id: 'tarp-recta440', name: '렉타 타프 440', maker: '', cat: '타프', w: 440, d: 440, hgt: 0, guy: 60, shape: 'rect', color: '#9dc45a', door: 'none', memo: '렉타' },
    { id: 'tarp-hexa', name: '헥사 타프 500×420', maker: '', cat: '타프', w: 500, d: 420, hgt: 0, guy: 70, shape: 'hex', color: '#6fa8c9', door: 'none', memo: '헥사' },
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
    return {
      id: e.id || uid('it'),
      libId: e.libId || null,
      name: String(e.name).slice(0, 30),
      cat: CATS.indexOf(e.cat) >= 0 ? e.cat : '화기·기타',
      w: clamp(+e.w, 10, 3000),
      d: clamp(+e.d, 10, 3000),
      hgt: clamp(+e.hgt || 0, 0, 400),
      guy: clamp(+e.guy || 0, 0, 400),
      shape: ['rect', 'round', 'circle', 'hex'].indexOf(e.shape) >= 0 ? e.shape : 'rect',
      color: /^#[0-9a-f]{6}$/i.test(e.color || '') ? e.color : '#7aa7d9',
      door: ['none', 'front', 'back', 'left', 'right'].indexOf(e.door) >= 0 ? e.door : 'none',
      memo: e.memo ? String(e.memo).slice(0, 24) : '',
      carStyle: e.carStyle || null,
      x: +e.x, y: +e.y, rot: normDeg(+e.rot || 0)
    };
  }

  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify({
          v: 1, site: S.site, snap: S.snap, guy: S.guy, unit: S.unit, wind: S.wind,
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
    return {
      id: uid('it'), libId: lib.id, name: lib.name, cat: lib.cat,
      w: +lib.w, d: +lib.d, hgt: +lib.hgt || 0, guy: +lib.guy || 0,
      shape: lib.shape || 'rect', color: lib.color || '#7aa7d9', door: lib.door || 'none',
      memo: lib.memo || '', carStyle: lib.carStyle || null, x: x, y: y, rot: 0
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

  // 차를 위에서 본 모습 — 코나는 아이언맨(다크그레이 + 레드 + 골드), 레이는 블랙
  function drawVehicle(g, w, d, style, lw) {
    const hw = w / 2, hd = d / 2;
    const iron = style === 'ironman';
    const dark = style === 'black';
    const glass = iron ? 'rgba(16,18,22,.92)' : dark ? '#242a33' : 'rgba(18,22,28,.35)';

    // 타이어
    g.fillStyle = 'rgba(6,8,11,.92)';
    const tw = Math.max(3, w * 0.05), th = Math.max(2.5, d * 0.1);
    [-0.62, 0.64].forEach((fx) => {
      [-1, 1].forEach((sy) => {
        g.fillRect(hw * fx - tw / 2, sy < 0 ? -hd - th * 0.3 : hd - th * 0.7, tw, th);
      });
    });

    // 앞유리
    g.fillStyle = glass;
    g.beginPath(); rrPath(g, -hw * 0.31, -hd * 0.4, hw * 0.17, hd * 0.8, Math.min(hw, hd) * 0.09); g.fill();
    // 루프
    g.fillStyle = iron ? '#b8232f' : dark ? '#171a1f' : 'rgba(255,255,255,.25)';
    g.beginPath(); rrPath(g, -hw * 0.13, -hd * 0.44, hw * 0.37, hd * 0.88, Math.min(hw, hd) * 0.1); g.fill();
    // 뒷유리
    g.fillStyle = glass;
    g.beginPath(); rrPath(g, hw * 0.26, -hd * 0.38, hw * 0.12, hd * 0.76, Math.min(hw, hd) * 0.08); g.fill();

    if (iron) {
      g.fillStyle = '#b8232f';
      g.beginPath(); rrPath(g, -hw * 0.47, -hd * 0.32, hw * 0.13, hd * 0.64, Math.min(hw, hd) * 0.08); g.fill();
      g.strokeStyle = '#d8a63c';
      g.lineWidth = Math.max(1, lw * 0.85);
      g.beginPath();
      g.moveTo(-hw * 0.13, -hd * 0.44); g.lineTo(hw * 0.24, -hd * 0.44);
      g.moveTo(-hw * 0.13, hd * 0.44); g.lineTo(hw * 0.24, hd * 0.44);
      g.moveTo(-hw * 0.46, 0); g.lineTo(-hw * 0.34, 0);
      g.stroke();
      g.fillStyle = 'rgba(216,166,60,.95)';
      g.beginPath(); g.arc(-hw * 0.34, 0, Math.max(1.5, Math.min(hw, hd) * 0.055), 0, TAU); g.fill();
    } else if (dark) {
      g.strokeStyle = 'rgba(255,255,255,.22)';
      g.lineWidth = Math.max(1, lw * 0.7);
      g.beginPath(); rrPath(g, -hw * 0.95, -hd * 0.86, hw * 1.9, hd * 1.72, Math.min(hw, hd) * 0.2); g.stroke();
    } else {
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.beginPath(); rrPath(g, -hw * 0.47, -hd * 0.3, hw * 0.1, hd * 0.6, Math.min(hw, hd) * 0.06); g.fill();
    }

    // 헤드라이트
    g.fillStyle = iron ? 'rgba(255,228,160,.95)' : dark ? 'rgba(238,240,246,.8)' : 'rgba(255,255,255,.55)';
    const lwid = Math.max(2, w * 0.035), lhei = Math.max(1.5, d * 0.065);
    g.fillRect(-hw * 0.985, -hd * 0.56, lwid, lhei);
    g.fillRect(-hw * 0.985, hd * 0.56 - lhei, lwid, lhei);
  }

  function paintItem(g, it, sc, cx, cy, o) {
    const w = it.w * sc, d = it.d * sc;
    const rad = it.rot * Math.PI / 180;
    const lw = o.lw;

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
    const isVeh = groupOf(it) === 'vehicle';
    g.beginPath();
    pathShape(g, it.shape, w, d, Math.min(w, d) * 0.2);
    g.fillStyle = isVeh ? it.color : withA(it.color, 0.8);
    g.fill();
    g.lineWidth = o.bad ? lw * 2.2 : lw;
    g.strokeStyle = o.bad ? '#ff5a68' : 'rgba(255,255,255,.7)';
    g.stroke();

    if (isVeh && w > 60) drawVehicle(g, w, d, carStyleOf(it), lw);

    if (o.selected) {
      g.lineWidth = lw * 1.6;
      g.strokeStyle = '#ffd166';
      g.stroke();
    }

    if (it.door !== 'none' && w > 22 && d > 14) {
      const L = doorLine(it.door, w, d, Math.max(2, lw * 1.5));
      if (L) {
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
    }
    g.restore();

    if (o.labels && w > 40 && d > 17) {
      const fs = o.fontPx;
      const maxW = w - 8;
      g.save();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      let name = it.name;
      g.font = '600 ' + fs + 'px system-ui, "Noto Sans KR", sans-serif';
      while (name.length > 2 && g.measureText(name).width > maxW) name = name.slice(0, -1);
      if (name !== it.name) name = name.slice(0, -1) + '…';
      const twoLine = d > fs * 3;
      if (isVeh) {
        const tw2 = Math.min(maxW, g.measureText(name).width + 14);
        g.fillStyle = 'rgba(6,9,13,.66)';
        g.beginPath(); rrPath(g, cx - tw2 / 2, cy - fs * 0.95, tw2, fs * 1.9, 4); g.fill();
      }
      g.fillStyle = 'rgba(255,255,255,.97)';
      g.fillText(name, cx, cy - (twoLine ? fs * 0.62 : 0));
      if (twoLine) {
        g.font = '500 ' + Math.round(fs * 0.85) + 'px system-ui, "Noto Sans KR", sans-serif';
        g.fillStyle = 'rgba(255,255,255,.72)';
        g.fillText(it.w + '×' + it.d, cx, cy + fs * 0.66);
      }
      g.restore();
    }
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
    requestAnimationFrame(() => { rafPending = false; render(); });
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
    const isCar = $('#gCat').value === '차량';
    $('#gModelWrap').hidden = !isCar;
    if (isCar) {
      const mi = lib ? CAR_MODELS.findIndex((m) => lib.name.indexOf(m.name) >= 0) : 0;
      $('#gModel').value = String(mi >= 0 ? mi : 0);
    }
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    setTimeout(() => $('#gName').focus(), 50);
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
      toast(name + ' 장비를 등록했습니다');
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

    window.addEventListener('resize', () => { resizeCanvas(); });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', () => resizeCanvas());
    new ResizeObserver(() => resizeCanvas()).observe($('#canvasWrap'));
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
      addFromLib: addFromLib,
      autoArrange: autoArrange,
      addVehicle: addVehicleFromModel,
      select: function (id) { selId = id; schedule(); },
      exportPNG: exportPNG
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
