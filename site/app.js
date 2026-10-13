/* 高性价比人生指南 · 应用主程序
   零依赖，纯浏览器原生 JS。数据来自同目录的 data.json（由 tools/site/build.mjs 生成）。
   路由用 hash，方便分享单条链接、后退键可用、静态托管（Cloudflare Pages）不需要服务端。
   正文里的「第 X 节第 Y 条」、术语、长文渲染规则和仓库里的 index.html 是同一套。 */
'use strict';
(function () {

/* ================= 基础工具 ================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.prototype.slice.call(r.querySelectorAll(s));

// 把子节点摊平成一层：数组可以套数组（章节页会把「整组条目卡片」当成一个数组传进来），
// 只摊一层的话第二层会被 String() 转成 "[object HTMLDivElement]" 直接显示出来。
function flattenKids(out, x) {
  if (x == null || x === false || x === true) return;
  if (Array.isArray(x)) { for (const y of x) flattenKids(out, y); return; }
  out.push(x);
}
function h(tag, props, ...kids) {
  // 允许省略 props：h('tr', child) 这种写法把第二个参数当子节点，别当属性表去遍历
  if (props != null && (props.nodeType || Array.isArray(props) || typeof props === 'string' || typeof props === 'number')) {
    kids.unshift(props); props = null;
  }
  const el = document.createElement(tag);
  if (props) for (const k in props) {
    if (!Object.prototype.hasOwnProperty.call(props, k)) continue;
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'on') { for (const ev in v) el.addEventListener(ev, v[ev]); }
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  const flat = [];
  flattenKids(flat, kids);
  for (const x of flat) el.append(x.nodeType ? x : document.createTextNode(String(x)));
  return el;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const unescMd = (s) => s.replace(/\\([*_])/g, '$1');
// 把正文里那些 markdown 记号抹掉，只留能读的字（列表摘要、标题用）
const plain = (s) => String(s)
  .replace(/\*\*/g, '').replace(/\\([*_])/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/<?https?:\/\/\S+>?/g, '')
  .replace(/\s+/g, ' ').trim();

/* 图标：全部是自己写死的 path，用 innerHTML 注入没有注入风险 */
const ICONS = {
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  toc: 'M4 5h16v2H4zm0 6h16v2H4zm0 6h10v2H4z',
  search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  check: 'M12 2a10 10 0 100 20 10 10 0 000-20zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8z',
  me: 'M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4.42 0-8 1.79-8 4v2h16v-2c0-2.21-3.58-4-8-4z',
  right: 'M9.29 6.71 14.58 12l-5.29 5.29 1.41 1.42L17.41 12l-6.71-6.71z',
  left: 'M14.71 17.29 9.42 12l5.29-5.29-1.41-1.42L6.59 12l6.71 6.71z',
  close: 'M18.3 5.71 12 12.01l-6.3-6.3-1.4 1.41L10.59 13.4 4.3 19.7l1.4 1.41L12 14.83l6.3 6.28 1.4-1.41-6.29-6.29 6.3-6.29z',
  bm: 'M17 3H7a2 2 0 00-2 2v16l7-3 7 3V5a2 2 0 00-2-2zm0 15-5-2.18L7 18V5h10z',
  bmf: 'M17 3H7a2 2 0 00-2 2v16l7-3 7 3V5a2 2 0 00-2-2z',
  done: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  doneall: 'M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z',
  sun: 'M12 7a5 5 0 100 10 5 5 0 000-10zm0-5 2 3h-4zM2 12l3-2v4zm20 0-3-2v4zM4.9 4.9 8 6.3 6.3 8zM19.1 19.1 16 17.7l1.7-1.7zM19.1 4.9 17.7 8l-1.7-1.7zM4.9 19.1 8 17.7 6.3 16z',
  moon: 'M12.3 2a9 9 0 108.7 11.7A7 7 0 0112.3 2z',
  share: 'M18 16a3 3 0 00-2.24 1l-6.06-3.03a3 3 0 000-2.94L15.76 8A3 3 0 1015 6c0 .13.03.26.05.38L9 9.4A3 3 0 103 12a3 3 0 006-1c0-.13-.03-.26-.05-.38l6.06 3.03A3 3 0 1018 16z',
  filter: 'M10 18h4v-2h-4zM3 6v2h18V6zm3 7h12v-2H6z',
  newwin: 'M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3zM5 5h6V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-6h-2v6H5z',
  book: 'M18 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-5 2v8l-2.5-1.5L8 12V4z',
  health: 'M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4z',
  money: 'M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z',
  shield: 'M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5z',
  clock: 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 11H7v-2h4V6h2z',
  bulb: 'M9 21h6v-1H9zm3-19a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z',
  refresh: 'M17.65 6.35A8 8 0 106 17.65l1.42-1.42A6 6 0 1117.65 6.35L15 9h7V2z',
  warn: 'M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6z',
  info: 'M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2zm0-8h-2V7h2z',
  download: 'M5 20h14v-2H5zM19 9h-4V3H9v6H5l7 7z',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  shuffle: 'M10.59 9.17 5.41 4 4 5.41l5.17 5.17zm4.82 4.66-5.17 5.17L4 13.83 5.41 12.41l5.17 5.17zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4z',
  list: 'M3 5h2v2H3zm0 6h2v2H3zm0 6h2v2H3zM7 5h14v2H7zm0 6h14v2H7zm0 6h14v2H7z',
};
function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<path d="' + (ICONS[name] || ICONS.info) + '"/>';
  return s;
}

/* 本机存储：收藏、已做到、阅读进度、设置。取不到也照常能用 */
const LS = {
  get(k, d) { try { const v = localStorage.getItem('hltb:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('hltb:' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('hltb:' + k); } catch (e) {} },
};

const S = {
  data: null,
  bm: new Set(LS.get('bm', [])),
  done: new Set(LS.get('done', [])),
  visits: LS.get('visits', {}),
  theme: LS.get('theme', 'auto'),
  fs: LS.get('fs', 'm'),
  last: LS.get('last', null),
};

function applyTheme() {
  const dark = S.theme === 'dark' || (S.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#17181c' : '#ffffff');
}
function applyFs() { document.body.dataset.fs = S.fs; }

let toastT = 0;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = h('div', { id: 'toast', class: 'toast' }); document.body.append(t); }
  t.textContent = msg;
  requestAnimationFrame(() => t.classList.add('on'));
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), 1900);
}

/* ================= 术语表 ================= */
let GLOSS_RE = null, GLOSS_BY = {};
function buildGloss(list) {
  GLOSS_BY = {};
  const rows = list.slice().sort((a, b) => b.term.length - a.term.length);
  for (const g of rows) GLOSS_BY[g.term] = g;
  const escRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const latin = rows.filter((g) => g.latin).map((g) => escRe(g.term));
  const cjk = rows.filter((g) => !g.latin).map((g) => escRe(g.term));
  const parts = [];
  if (latin.length) parts.push('(?<![A-Za-z0-9])(?:' + latin.join('|') + ')(?![A-Za-z0-9])');
  if (cjk.length) parts.push('(?:' + cjk.join('|') + ')');
  try { GLOSS_RE = new RegExp(parts.join('|'), 'g'); } catch (e) { GLOSS_RE = null; }
}
function termify(root) {
  if (!GLOSS_RE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = []; let n;
  while ((n = walker.nextNode())) if (!n.parentElement.closest('a,abbr,.term')) nodes.push(n);
  for (const node of nodes) {
    const s = node.nodeValue;
    GLOSS_RE.lastIndex = 0;
    if (!GLOSS_RE.test(s)) continue;
    GLOSS_RE.lastIndex = 0;
    const frag = document.createDocumentFragment(); let pos = 0, m;
    while ((m = GLOSS_RE.exec(s))) {
      const g = GLOSS_BY[m[0]]; if (!g) continue;
      if (m.index > pos) frag.append(document.createTextNode(s.slice(pos, m.index)));
      const ab = h('span', { class: 'term', text: m[0], title: g.meaning, tabIndex: 0, dataset: { term: g.term } });
      frag.append(ab); pos = m.index + m[0].length;
    }
    if (pos < s.length) frag.append(document.createTextNode(s.slice(pos)));
    node.parentNode.replaceChild(frag, node);
  }
}

/* ================= 交叉引用与文本渲染 ================= */
const ITEMS = new Map();   // '9-15' -> entry
const SECS = new Map();    // '9' -> section
let CUR_SEC = '';
const NUMS = '[\\d、]+(?:\\s*到\\s*\\d+)?';
const XREF_RE = new RegExp(
  '第\\s*(\\d+)\\s*节第\\s*(' + NUMS + ')\\s*条|本节第\\s*(' + NUMS + ')\\s*条|第\\s*(' + NUMS + ')\\s*条|第\\s*([\\d、]+)\\s*节', 'g');

function xrefKeys(sec, spec) {
  const ns = [];
  for (const part of String(spec).split('、')) {
    const r = /^\s*(\d+)\s*到\s*(\d+)\s*$/.exec(part);
    if (r) { const a = +r[1], b = +r[2]; if (b >= a && b - a <= 40) for (let i = a; i <= b; i++) ns.push(i); continue; }
    const n = part.trim(); if (n) ns.push(n);
  }
  return ns.map((n) => sec + '-' + n).filter((k) => ITEMS.has(k));
}

const URL_RE = /<?(https?:\/\/[A-Za-z0-9\-._~:\/?#\[\]@!$&'()*+,=%]+)>?/g;
function trimUrl(u) {
  let t = '';
  for (;;) {
    const ch = u.slice(-1);
    const unbalanced = ch === ')' && (u.split('(').length < u.split(')').length);
    if (!/[）。,，]/.test(ch) && !unbalanced) break;
    t = ch + t; u = u.slice(0, -1);
  }
  return [u, t];
}
const MD_LINK_RE = /\[([^\]\n]+)\]\(([^)\s]+)\)/;
const BOLD_RE = /\*\*((?:\\\*|[^*\n])+)\*\*/;
const LINK_RE = new RegExp([MD_LINK_RE.source, URL_RE.source, BOLD_RE.source].join('|'), 'g');
function hrefOf(p) {
  if (/^(https?:|mailto:|#|\/)/.test(p)) return p;
  return S.data.meta.repoBlob + p.replace(/^(\.\.?\/)+/, '').split('/').map(encodeURIComponent).join('/');
}
function mkLink(href, text) {
  return h('a', { href, target: '_blank', rel: 'noopener', text });
}
function highlightInto(el, s, terms) {
  if (!terms || !terms.length) { el.append(document.createTextNode(s)); return; }
  const lower = s.toLowerCase(); let i = 0;
  while (i < s.length) {
    let best = -1, bl = 0;
    for (const t of terms) { const k = lower.indexOf(t, i); if (k !== -1 && (best === -1 || k < best)) { best = k; bl = t.length; } }
    if (best === -1) { el.append(document.createTextNode(s.slice(i))); break; }
    if (best > i) el.append(document.createTextNode(s.slice(i, best)));
    el.append(h('mark', { text: s.slice(best, best + bl) }));
    i = best + bl;
  }
}
function xrefInto(el, s, terms) {
  XREF_RE.lastIndex = 0; let m, last = 0, any = false;
  while ((m = XREF_RE.exec(s))) {
    const keys = m[5] != null
      ? String(m[5]).split('、').map((x) => x.trim()).filter((x) => SECS.has(x)).map((x) => 's' + x)
      : xrefKeys(m[1] ?? CUR_SEC, m[2] ?? m[3] ?? m[4] ?? '');
    if (!keys.length) continue;
    highlightInto(el, s.slice(last, m.index), terms);
    el.append(h('span', { class: 'xref', tabIndex: 0, text: m[0], dataset: { keys: keys.join(',') } }));
    last = m.index + m[0].length; any = true;
  }
  if (!any) { highlightInto(el, s, terms); return; }
  highlightInto(el, s.slice(last), terms);
}
function renderText(el, text, terms, withTerms, urlsLast) {
  el.textContent = '';
  const held = []; let justHeld = false;
  let last = 0; LINK_RE.lastIndex = 0; let m;
  const pushText = (s) => {
    if (!s) return;
    if (justHeld && /^[\s、,，]+$/.test(s)) return;
    justHeld = false;
    xrefInto(el, unescMd(s), terms);
  };
  while ((m = LINK_RE.exec(text))) {
    pushText(text.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[4] !== undefined) {
      const b = h('strong'); highlightInto(b, unescMd(m[4]), terms); el.append(b); justHeld = false; continue;
    }
    if (m[3]) {
      const [u, tail] = trimUrl(m[3]);
      const a = mkLink(u, u.replace(/^https?:\/\//, '').replace(/\/$/, ''));
      a.className = 'url';
      if (urlsLast) { held.push(a); justHeld = true; } else el.append(a);
      pushText(tail); continue;
    }
    el.append(mkLink(hrefOf(m[2]), m[1])); justHeld = false;
  }
  pushText(text.slice(last));
  for (const a of held) el.append(a);
  if (withTerms !== false) termify(el);
}
/* 拆分规则：和 index.html 的 <split-rules> 一致，收益/备注超 300 字按新依据分块，来源按「；」分条 */
const GAIN_MIN_LEN = 300, GAIN_MIN_CHUNK = 25;
const GAIN_TOPIC_START = [
  /^[^，。「」《》：；（）的]{1,12}看(《|[^，。「」的]{0,10}法[：「（第])/,
  /^《[^》]{2,40}》/,
  /^(?!该|本|此|这|同|上述|但|而|所以|因此|并且|也)[一-龥]{1,12}法(第[一二三四五六七八九十百零]+条|「)/,
  /^(另一|另有一|还有一|再一|又一)(项|篇)/,
  /^(国内|国外|国内外)也有/,
  /^案例[一二三四五六七八九十]/,
  /^(同一天|同一试验|同一指南|同一研究)/,
  /^(美国|英国|欧洲|世界卫生组织|WHO|中国)[^，。]{0,20}(指南|共识|建议|学会)/,
  /^(先说|再说|最后说|先看|再看|最后看)/,
  /^一(项|篇)[^，。]{0,20}(试验|研究|综述|分析|调查)/,
  /^(芬兰|北欧|英国|美国|日本|韩国|瑞典|丹麦|挪威|德国|法国|澳大利亚|加拿大|荷兰|台湾|香港|上海|北京)[^，。]{0,25}(研究|数据库|试验|队列|调查)/,
];
function splitGain(text) {
  if (!text || text.length < GAIN_MIN_LEN) return [text];
  const sentences = []; let buf = '', depth = 0;
  for (const c of text) {
    if ('「『《（'.includes(c)) depth++;
    else if ('」』》）'.includes(c)) depth = Math.max(0, depth - 1);
    buf += c;
    if (c === '。' && depth === 0) { sentences.push(buf); buf = ''; }
  }
  if (buf) sentences.push(buf);
  const chunks = [];
  for (const s of sentences) {
    if (chunks.length && GAIN_TOPIC_START.some((re) => re.test(s))) chunks.push(s);
    else if (chunks.length) chunks[chunks.length - 1] += s;
    else chunks.push(s);
  }
  const out = [];
  for (const c of chunks) { if (out.length && c.length < GAIN_MIN_CHUNK) out[out.length - 1] += c; else out.push(c); }
  if (out.length > 1 && out[0].length < GAIN_MIN_CHUNK) out.splice(0, 2, out[0] + out[1]);
  return out;
}
const SRC_OPEN = '「『（', SRC_CLOSE = '」』）';
function splitSrc(text) {
  const parts = []; let buf = '', depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (SRC_OPEN.includes(c)) depth++;
    if (SRC_CLOSE.includes(c)) depth = Math.max(0, depth - 1);
    const semi = c === '；' || (c === ';' && /\s/.test(text[i - 1] || '') && /\s/.test(text[i + 1] || ''));
    if (semi && depth === 0) { parts.push(buf); buf = ''; continue; }
    buf += c;
  }
  parts.push(buf);
  return parts.map((s) => s.trim()).filter(Boolean);
}
function renderGain(el, text, terms) {
  const parts = splitGain(text);
  el.textContent = '';
  if (parts.length < 2) { renderText(el, text, terms); return; }
  const ul = h('ul', { class: 'chunks' });
  for (const p of parts) { const li = h('li'); renderText(li, p, terms); ul.append(li); }
  el.append(ul);
}
function renderSrc(el, text, terms) {
  el.textContent = '';
  const parts = splitSrc(text);
  if (parts.length < 2) { renderText(el, text, terms, true, true); return; }
  const ol = h('ol');
  for (const p of parts) { const li = h('li'); renderText(li, p, terms, true, true); ol.append(li); }
  el.append(ol);
}

/* ================= 浮层：交叉引用 / 术语 / 筛选 ================= */
let popEl = null;
function closePop() { if (popEl) { popEl.remove(); popEl = null; } }
function placePop(anchor) {
  const r = anchor.getBoundingClientRect();
  const w = popEl.offsetWidth, hgt = popEl.offsetHeight;
  let left = Math.max(12, Math.min(r.left, innerWidth - w - 12));
  let top = r.bottom + 8;
  if (top + hgt > innerHeight - 12) top = Math.max(12, r.top - hgt - 8);
  popEl.style.left = left + 'px';
  popEl.style.top = top + 'px';
}
function showXrefPop(a) {
  closePop();
  const keys = a.dataset.keys.split(',');
  popEl = h('div', { class: 'xpop' });
  popEl.append(h('div', { class: 'xh' }, h('b', { text: a.textContent })));
  for (const k of keys) {
    if (k[0] === 's') {
      const sec = SECS.get(k.slice(1)); if (!sec) continue;
      const b = h('div', { class: 'xb' },
        h('div', { class: 's', text: '整节，共 ' + sec.entries.length + ' 条' }),
        h('strong', { text: sec.n + '. ' + sec.title }));
      b.append(h('a', { href: '#/s/' + sec.n, class: 'btn sm ghost', text: '跳到这一节', on: { click: closePop } }));
      popEl.append(b); continue;
    }
    const e = ITEMS.get(k); if (!e) continue;
    const b = h('div', { class: 'xb' },
      h('div', { class: 's', text: '第 ' + e.sec + ' 节第 ' + e.n + ' 条' }),
      h('strong', { text: plain(e.title) }));
    if (e.human) b.append(h('p', { text: plain(e.human) }));
    b.append(h('a', { href: '#/e/' + e.sec + '/' + e.n, class: 'btn sm ghost', text: '跳过去', on: { click: closePop } }));
    popEl.append(b);
  }
  document.body.append(popEl);
  placePop(a);
}
function showTermPop(t) {
  closePop();
  const g = GLOSS_BY[t.dataset.term]; if (!g) return;
  popEl = h('div', { class: 'xpop' },
    h('div', { class: 'xh' }, h('b', { text: g.term })),
    h('p', { text: g.meaning }));
  document.body.append(popEl);
  placePop(t);
}
document.addEventListener('click', (ev) => {
  const x = ev.target.closest('.xref');
  if (x) { ev.preventDefault(); showXrefPop(x); return; }
  const t = ev.target.closest('.term');
  if (t) { ev.preventDefault(); showTermPop(t); return; }
  if (popEl && !ev.target.closest('.xpop')) closePop();
});
document.addEventListener('scroll', closePop, { passive: true, capture: true });

/* ================= 标签与徽章 ================= */
const LENS_LABEL = { '死亡率': '换寿命', '金钱': '换钱', '时间': '换时间精力', '自由': '换人身自由' };
const WHO_LABEL = { '怀孕': '怀孕或备孕', '婴幼儿': '家有 3 岁以下孩子', '孩子': '家有 3 到 18 岁孩子', '老人': '家有老人', '35岁': '35 岁以上', '60岁': '60 岁以上', '女性': '女性' };
const RATIO_CLS = { '极高': 'r3', '高': 'r2', '一般': 'r1' };
const GRADE_CLS = { A: 'a', B: 'b', C: 'c' };
function badgesOf(e) {
  const b = h('div', { class: 'badges' });
  b.append(h('span', { class: 'badge ' + RATIO_CLS[e.ratio], text: '性价比 ' + e.ratio }));
  b.append(h('span', { class: 'badge ' + GRADE_CLS[e.grade], text: '证据 ' + e.grade + ' 级' }));
  if (e.lens) b.append(h('span', { class: 'badge lens', text: LENS_LABEL[e.lens] || e.lens }));
  if (e.level) b.append(h('span', { class: 'badge plain', text: '收益 ' + e.level }));
  if (e.dispute) b.append(h('span', { class: 'badge warn', text: '有争议' }));
  if (e.todo) b.append(h('span', { class: 'badge warn', text: '待核实' }));
  return b;
}

/* ================= 条目：字段区 ================= */
function renderFields(box, e, terms) {
  CUR_SEC = String(e.sec);
  const add = (k, v, cls, kind) => {
    if (!v) return;
    const f = h('div', { class: 'field ' + (cls || '') }, h('div', { class: 'k', text: k }));
    const vv = h('div', { class: 'v' });
    if (kind === 'gain') renderGain(vv, v, terms);
    else if (kind === 'src') renderSrc(vv, v, terms);
    else renderText(vv, v, terms);
    f.append(vv); box.append(f);
  };
  add('成本', e.cost, '', 'gain');
  add('收益', e.gain, 'gain', 'gain');
  add('证据等级', e.grade + ' 级', '');
  add('来源', e.src, '', 'src');
  add('备注', e.note, 'note', 'gain');
}

/* 收藏 / 已做到 按钮 */
function toggleBm(e, btn) {
  const k = e.sec + '-' + e.n;
  if (S.bm.has(k)) { S.bm.delete(k); toast('已取消收藏'); } else { S.bm.add(k); toast('已收藏'); }
  LS.set('bm', [...S.bm]); btn.classList.toggle('on', S.bm.has(k)); btn.classList.toggle('book', S.bm.has(k));
  const svg = btn.firstChild; if (svg) svg.innerHTML = '<path d="' + (S.bm.has(k) ? ICONS.bmf : ICONS.bm) + '"/>';
}
function toggleDone(e, btn) {
  const k = e.sec + '-' + e.n;
  if (S.done.has(k)) { S.done.delete(k); } else { S.done.add(k); toast('记为已做到'); }
  LS.set('done', [...S.done]); btn.classList.toggle('on', S.done.has(k));
  const svg = btn.firstChild; if (svg) svg.innerHTML = '<path d="' + (S.done.has(k) ? ICONS.doneall : ICONS.done) + '"/>';
}
function actionsFor(e) {
  const k = e.sec + '-' + e.n;
  const bmBtn = h('button', { class: 'act book' + (S.bm.has(k) ? ' on' : ''), title: '收藏', 'aria-label': '收藏', on: { click: (ev) => { ev.stopPropagation(); toggleBm(e, bmBtn); } } }, icon(S.bm.has(k) ? 'bmf' : 'bm'));
  const dnBtn = h('button', { class: 'act' + (S.done.has(k) ? ' on' : ''), title: '记为已做到', 'aria-label': '记为已做到', on: { click: (ev) => { ev.stopPropagation(); toggleDone(e, dnBtn); } } }, icon(S.done.has(k) ? 'doneall' : 'done'));
  return h('div', { class: 'entry-actions' }, bmBtn, dnBtn);
}

/* 可展开的条目卡片 */
function entryCard(e, terms) {
  const card = h('div', { class: 'entry', id: 'e-' + e.sec + '-' + e.n });
  const head = h('div', { class: 'entry-h' });
  const tx = h('div', { class: 'tx' });
  const title = h('a', { class: 'ti', href: '#/e/' + e.sec + '/' + e.n, text: plain(e.title), on: { click: (ev) => { ev.preventDefault(); openEntry(e.sec, e.n); } } });
  tx.append(title);
  if (e.human) tx.append(h('div', { class: 'entry-human', text: plain(e.human) }));
  tx.append(h('div', { class: 'entry-meta' }, badgesOf(e)));
  head.append(h('div', { class: 'idx', text: e.n }), tx, actionsFor(e));
  card.append(head);

  const body = h('div', { class: 'entry-body', hidden: true });
  renderFields(body, e, terms);
  body.append(h('div', { class: 'entry-foot' },
    h('a', { class: 'gh', href: '#/e/' + e.sec + '/' + e.n, text: '打开详情 · 第 ' + e.sec + ' 节第 ' + e.n + ' 条', on: { click: (ev) => { ev.preventDefault(); openEntry(e.sec, e.n); } } })));
  card.append(body);

  // 点标题以外的地方也展开：整块 header 可点（按钮已 stopPropagation）
  head.addEventListener('click', (ev) => {
    if (ev.target.closest('a,button')) return;
    body.hidden = !body.hidden;
  });
  return card;
}

/* ================= 视图容器 ================= */
const view = () => $('#view');
function setView(...nodes) {
  // 换页时把上一步可能留着的弹层清掉（筛选弹层、模态），否则它会盖在新页面上
  $$('.sheet,.mask,.modal').forEach((n) => n.remove());
  const v = view(); v.textContent = '';
  v.append(h('div', { class: 'wrap' }, nodes.filter(Boolean)));
  window.scrollTo(0, 0);
  closePop();
}
function pageHead(crumbText, crumbHref, title) {
  const c = h('div', { class: 'crumb' });
  if (crumbHref) c.append(h('a', { href: crumbHref, text: crumbText }), icon('right'));
  else c.append(h('span', { text: crumbText }));
  const ph = h('div', { class: 'page-head' }, c);
  if (title) ph.append(h('h1', { text: title }));
  return ph;
}

/* ================= 首页 ================= */
const RES = [
  { t: '寿命', d: '活得更久，少死于本来可以避免的事', i: 'health' },
  { t: '时间与精力', d: '不把时间和注意力花在没有回报的事上', i: 'clock' },
  { t: '金钱', d: '少花冤枉钱，把钱花在收益确定的地方', i: 'money' },
  { t: '人身自由', d: '不因为不知道一条红线，把自己送进去', i: 'shield' },
];
const QUICK = [
  { t: '紧急情况', s: '先做什么', n: 13, i: 'health' },
  { t: '没钱的时候', s: '能领什么、去哪求助', n: 7, i: 'money' },
  { t: '法律红线', s: '别把自己搭进去', n: 9, i: 'shield' },
  { t: '全部目录', s: '34 节 690 条', n: 0, i: 'list' },
];
function renderHome() {
  const d = S.data, st = d.meta.stats;
  const hero = h('div', { class: 'hero' },
    h('h1', { text: '用最少的钱、时间和精力，换回最多的寿命、金钱和人身自由' }),
    h('p', { text: '按性价比排序的人生指南：' + st.entries + ' 条建议，每条写明花掉什么、换回什么、证据有多硬，来源只引期刊论文和官方文件。' }),
    h('p', { class: 'lead', text: '不用全做——这是备选单，不是任务清单。挑走一两条就算数。' }),
    h('div', { class: 'hero-actions' },
      h('a', { class: 'btn primary', href: '#/toc', on: { click: (ev) => { ev.preventDefault(); go('#/toc'); } } }, icon('toc'), '开始阅读'),
      h('a', { class: 'btn ghost', href: '#/check', on: { click: (ev) => { ev.preventDefault(); go('#/check'); } } }, icon('check'), '生活自查'),
      h('button', { class: 'btn ghost', on: { click: randomEntry } }, icon('shuffle'), '随便看一条'),
    ));

  const stats = h('div', { class: 'stat-grid' },
    h('div', { class: 'stat' }, h('b', { text: st.entries }), h('span', { text: '条建议' })),
    h('div', { class: 'stat' }, h('b', { text: st.sections }), h('span', { text: '个章节' })),
    h('div', { class: 'stat' }, h('b', { text: st.a }), h('span', { text: '条 A 级证据' })),
    h('div', { class: 'stat' }, h('b', { text: st.links }), h('span', { text: '条原始文献链接' })),
  );

  const quick = h('div', { class: 'quick' }, QUICK.map((q) =>
    h('a', { href: q.n ? '#/s/' + q.n : '#/toc', on: { click: (ev) => { ev.preventDefault(); go(q.n ? '#/s/' + q.n : '#/toc'); } } },
      h('span', { class: 'ico' }, icon(q.i)),
      h('span', { text: q.t }),
      h('small', { text: q.s }))));

  const res = h('div', { class: 'res-grid' }, RES.map((r) =>
    h('div', { class: 'res' }, h('b', {}, h('i'), r.t), h('p', { text: r.d }))));

  const nodes = [
    hero,
    h('div', { class: 'section-title' }, h('h2', { text: '这本书想帮你留住四样东西' })),
    res,
    h('div', { class: 'section-title' }, h('h2', { text: '常用入口' })),
    quick,
    h('div', { class: 'section-title' }, h('h2', { text: '数据' })),
    stats,
  ];

  // 继续阅读
  if (S.last && ITEMS.has(S.last)) {
    const e = ITEMS.get(S.last);
    nodes.splice(1, 0,
      h('div', { class: 'section-title' }, h('h2', { text: '继续阅读' }), h('a', { class: 'more', href: '#/toc', text: '全部目录' })),
      entryCard(e, []));
  }

  // 今天做一件：从性价比极高的条目里挑一条没标「已做到」的
  const top = d.sections.flatMap((s) => s.entries).filter((e) => e.ratio === '极高' && !S.done.has(e.sec + '-' + e.n));
  if (top.length) {
    const pick = top[Math.floor(Math.random() * Math.min(top.length, 40))];
    nodes.push(h('div', { class: 'section-title' }, h('h2', { text: '今天做一件' }), h('small', { text: '从性价比极高的条目里挑一条' })),
      entryCard(pick, []));
  }

  nodes.push(h('div', { class: 'section-title' }, h('h2', { text: '长文与工具' }), h('a', { class: 'more', href: '#/toc', text: '更多' })),
    h('div', { class: 'melist' },
      d.docs.slice(0, 4).map((doc) => h('a', { class: 'mi', href: '#/doc/' + encodeURIComponent(doc.slug), on: { click: (ev) => { ev.preventDefault(); go('#/doc/' + encodeURIComponent(doc.slug)); } } },
        h('span', { class: 'ico' }, icon('book')), h('span', { class: 'tx' }, h('b', { text: doc.title })), icon('right'))),
      h('a', { class: 'mi', href: '#/glossary', on: { click: (ev) => { ev.preventDefault(); go('#/glossary'); } } },
        h('span', { class: 'ico' }, icon('bulb')), h('span', { class: 'tx' }, h('b', { text: '术语表' }), h('small', { text: d.glossary.length + ' 个统计与制度名词' })), icon('right')),
    ));

  setView(...nodes);
}
function randomEntry() {
  const all = S.data.sections.flatMap((s) => s.entries);
  const e = all[Math.floor(Math.random() * all.length)];
  openEntry(e.sec, e.n);
}

/* ================= 目录 ================= */
function renderToc() {
  const d = S.data;
  const filter = h('input', { type: 'search', placeholder: '在目录里找（节名、关键词）', 'aria-label': '筛选章节' });
  const list = h('div', { class: 'melist' });
  const draw = (q) => {
    list.textContent = '';
    const kw = (q || '').trim().toLowerCase();
    for (const s of d.sections) {
      if (kw && !(s.title + ' ' + (s.question || '') + ' ' + (s.summary || '')).toLowerCase().includes(kw)) continue;
      list.append(h('a', { class: 'sec-row', href: '#/s/' + s.n, on: { click: (ev) => { ev.preventDefault(); go('#/s/' + s.n); } } },
        h('span', { class: 'num', text: s.n }),
        h('span', { class: 'tx' }, h('b', { text: s.title }), h('small', { text: s.question || s.summary || '' })),
        h('span', { class: 'ct', text: s.entries.length + ' 条' }),
        icon('right')));
    }
    if (!list.children.length) list.append(h('div', { class: 'empty', text: '没有匹配的章节' }));
  };
  filter.addEventListener('input', () => draw(filter.value));
  draw('');

  setView(
    pageHead('目录', null, '全部章节'),
    h('p', { class: 'intro', text: '每节内的条目按性价比从高到低排。节标题说的是这一节想防住的结果，具体做什么、别做什么，以条目标题为准。' }),
    h('div', { class: 'searchbar', style: 'margin:6px 0 16px' }, icon('search'), filter),
    list,
    h('div', { class: 'section-title' }, h('h2', { text: '长文' })),
    h('div', { class: 'melist' }, d.docs.map((doc) =>
      h('a', { class: 'mi', href: '#/doc/' + encodeURIComponent(doc.slug), on: { click: (ev) => { ev.preventDefault(); go('#/doc/' + encodeURIComponent(doc.slug)); } } },
        h('span', { class: 'ico' }, icon('book')), h('span', { class: 'tx' }, h('b', { text: doc.title })), icon('right')))),
  );
}

/* ================= 章节页 ================= */
function renderSection(n) {
  const s = SECS.get(String(n));
  if (!s) { render404(); return; }
  S.visits[s.n] = 1; LS.set('visits', S.visits);

  const intro = h('div', { class: 'intro' });
  for (const p of s.intro) { const el = h('p'); renderText(el, p, []); intro.append(el); }

  const head = pageHead('目录', '#/toc', s.n + '. ' + s.title);
  if (s.question) head.append(h('div', { class: 'q' }, h('b', { text: '这一节回答：' }), s.question));

  setView(
    head,
    intro,
    h('div', { class: 'section-title' }, h('h2', { text: '条目' }), h('small', { text: s.entries.length + ' 条 · 按性价比排序' })),
    s.entries.map((e) => entryCard(e, [])),
    h('div', { class: 'note' },
      '正文按 CC BY 4.0 发布。想看这一节的原始文件，或核对某条数字的出处，去 ',
      h('a', { href: S.data.meta.repoBlob + s.file, target: '_blank', rel: 'noopener', text: 'GitHub 上的 ' + s.file })),
  );
}

/* ================= 单条详情 ================= */
function openEntry(sec, n) {
  S.last = sec + '-' + n; LS.set('last', S.last);
  go('#/e/' + sec + '/' + n);
}
function renderEntry(sec, n) {
  const e = ITEMS.get(sec + '-' + n);
  if (!e) { render404(); return; }
  const s = SECS.get(String(sec));
  S.last = sec + '-' + n; LS.set('last', S.last);
  S.visits[sec] = 1; LS.set('visits', S.visits);

  const head = pageHead('第 ' + sec + ' 节 · ' + (s ? s.title : ''), '#/s/' + sec, plain(e.title));
  const metaRow = h('div', { class: 'row', style: 'margin:12px 0 18px;gap:12px;align-items:flex-start' },
    badgesOf(e), h('span', { style: 'flex:1' }), actionsFor(e));

  const body = h('div', { class: 'entry-body', style: 'border-top:0;padding:0' });
  renderFields(body, e, []);
  const card = h('div', { class: 'card', style: 'padding:16px 17px' }, body);

  const idx = s.entries.findIndex((x) => x.n === +n);
  const prev = s.entries[idx - 1], next = s.entries[idx + 1];
  const nav = h('div', { class: 'row', style: 'justify-content:space-between;margin-top:16px;gap:10px' },
    prev ? h('a', { class: 'btn ghost sm', href: '#/e/' + sec + '/' + prev.n, on: { click: (ev) => { ev.preventDefault(); openEntry(sec, prev.n); } } }, icon('left'), '上一条') : h('span'),
    next ? h('a', { class: 'btn ghost sm', href: '#/e/' + sec + '/' + next.n, on: { click: (ev) => { ev.preventDefault(); openEntry(sec, next.n); } } }, '下一条', icon('right')) : h('span'));

  setView(
    head,
    metaRow,
    card,
    nav,
    h('div', { class: 'row', style: 'margin-top:14px' },
      h('button', { class: 'btn ghost sm', on: { click: () => shareEntry(e) } }, icon('share'), '分享'),
      h('a', { class: 'btn ghost sm', href: S.data.meta.repoBlob + (s ? s.file : ''), target: '_blank', rel: 'noopener' }, icon('newwin'), '看原文')),
  );
}
function shareEntry(e) {
  const url = location.origin + location.pathname + '#/e/' + e.sec + '/' + e.n;
  const text = plain(e.title);
  if (navigator.share) navigator.share({ title: text, text: text, url }).catch(() => {});
  else if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('链接已复制'), () => toast(url));
  else toast(url);
}

/* ================= 搜索 ================= */
const FACETS = [
  { k: 'ratio', label: '性价比', opts: ['极高', '高', '一般'] },
  { k: 'grade', label: '证据等级', opts: [['A', 'A 级'], ['B', 'B 级'], ['C', 'C 级']] },
  { k: 'lens', label: '换回什么', opts: [['死亡率', '寿命'], ['金钱', '钱'], ['时间', '时间精力'], ['自由', '人身自由']] },
  { k: 'money', label: '要花钱吗', opts: [['0', '不花钱'], ['少', '花少量钱'], ['多', '花不少钱']] },
  { k: 'time', label: '花时间吗', opts: [['少', '顺手'], ['中', '花几小时'], ['多', '每天占时间']] },
  { k: 'will', label: '要毅力吗', opts: [['否', '不用毅力'], ['些', '要一点'], ['是', '要很多']] },
  { k: 'who', label: '我的情况', opts: Object.keys(WHO_LABEL).map((k) => [k, WHO_LABEL[k]]) },
];
const st = { q: '', ratio: new Set(), grade: new Set(), lens: new Set(), money: new Set(), time: new Set(), will: new Set(), who: new Set(), dispute: false, todo: false };

function entryHay(e) {
  if (e._hay == null) {
    e._hay = (e.title + '\n' + e.human + '\n' + e.cost + '\n' + e.gain + '\n' + e.note + '\n' + e.src + '\n' + e.grade)
      .replace(/\*\*/g, '').replace(/\\([*_])/g, '$1').toLowerCase();
  }
  return e._hay;
}
function fitsMe(e) {
  if (!st.who.size || !e.who.length) return true;
  const has = (v) => st.who.has(v) || (v === '35岁' && st.who.has('60岁'));
  return e.who.some((g) => g.every(has));
}
function match(e, terms) {
  if (st.ratio.size && !st.ratio.has(e.ratio)) return false;
  if (st.grade.size && !st.grade.has(e.grade)) return false;
  if (st.lens.size && !st.lens.has(e.lens)) return false;
  if (st.money.size && !st.money.has(e.money)) return false;
  if (st.time.size && !st.time.has(e.time)) return false;
  if (st.will.size && !st.will.has(e.will)) return false;
  if (!fitsMe(e)) return false;
  if (st.dispute && !e.dispute) return false;
  if (st.todo && !e.todo) return false;
  if (terms.length && !terms.every((t) => entryHay(e).includes(t))) return false;
  return true;
}
function activeCount() {
  return st.ratio.size + st.grade.size + st.lens.size + st.money.size + st.time.size + st.will.size + st.who.size + (st.dispute ? 1 : 0) + (st.todo ? 1 : 0);
}
function clearFilters() {
  for (const f of FACETS) st[f.k].clear();
  st.dispute = st.todo = false;
}
function renderSearch() {
  const input = h('input', { type: 'search', placeholder: '搜关键词：戒烟、押金、仲裁、溺水……', 'aria-label': '搜索', value: st.q });
  const clr = h('button', { class: 'clr', 'aria-label': '清空', on: { click: () => { st.q = ''; input.value = ''; input.focus(); run(); } } }, icon('close'));
  const bar = h('div', { class: 'searchbar' }, icon('search'), input, st.q ? clr : null);

  const chips = h('div', { class: 'chips', style: 'margin:12px 0 4px' });
  const fBtn = h('button', { class: 'chip', on: { click: openFilterSheet } }, icon('filter'), '筛选');
  const countEl = h('span', { class: 'cnt' });
  const fbar = h('div', { class: 'fbar' }, fBtn, chips, h('span', { class: 'sp' }), countEl);
  const results = h('div');

  const drawChips = () => {
    chips.textContent = '';
    for (const f of FACETS) for (const v of st[f.k]) {
      const lbl = f.opts.find((o) => (Array.isArray(o) ? o[0] : o) === v);
      chips.append(h('button', { class: 'chip', 'aria-pressed': 'true', on: { click: () => { st[f.k].delete(v); run(); } } },
        Array.isArray(lbl) ? lbl[1] : v, icon('close')));
    }
    if (st.dispute) chips.append(h('button', { class: 'chip', 'aria-pressed': 'true', on: { click: () => { st.dispute = false; run(); } } }, '有争议', icon('close')));
    if (st.todo) chips.append(h('button', { class: 'chip', 'aria-pressed': 'true', on: { click: () => { st.todo = false; run(); } } }, '待核实', icon('close')));
    if (activeCount()) chips.append(h('button', { class: 'chip', on: { click: () => { clearFilters(); run(); } } }, '清空筛选'));
    fBtn.setAttribute('aria-pressed', String(activeCount() > 0));
  };

  const run = () => {
    const terms = st.q.toLowerCase().split(/\s+/).filter(Boolean);
    const all = S.data.sections.flatMap((s) => s.entries);
    const hits = all.filter((e) => match(e, terms));
    results.textContent = '';
    countEl.innerHTML = '';
    countEl.append('共 ', h('b', { text: String(hits.length) }), ' 条');
    if (!hits.length) {
      results.append(h('div', { class: 'empty' }, icon('search'), h('div', { text: '没有匹配的条目' }),
        h('div', { style: 'margin-top:10px;font-size:13.5px' }, '换个词，或点「筛选」放宽条件。')));
    } else {
      // 相关性：标题命中排前面
      if (terms.length) hits.sort((a, b) => score(b, terms) - score(a, terms));
      for (const e of hits) results.append(entryCard(e, terms));
    }
    drawChips();
  };
  const score = (e, terms) => {
    let sc = 0;
    const t = e.title.toLowerCase();
    for (const x of terms) { if (t.includes(x)) sc += 10; if (e.human.toLowerCase().includes(x)) sc += 3; }
    return sc;
  };

  let deb = 0;
  input.addEventListener('input', () => { st.q = input.value; clearTimeout(deb); deb = setTimeout(run, 120); });
  if (!st.q) setTimeout(() => input.focus(), 60);

  setView(
    pageHead('搜索', null, '找一条建议'),
    bar,
    fbar,
    results,
  );
  run();
}
function openFilterSheet() {
  const body = h('div');
  for (const f of FACETS) {
    const g = h('div', { class: 'fgroup', style: 'margin-bottom:16px' }, h('div', { class: 'fl', text: f.label }));
    const row = h('div', { class: 'chips' });
    for (const o of f.opts) {
      const v = Array.isArray(o) ? o[0] : o, lbl = Array.isArray(o) ? o[1] : o;
      row.append(h('button', { class: 'chip', 'aria-pressed': String(st[f.k].has(v)), on: { click: (ev) => { const b = ev.currentTarget; if (st[f.k].has(v)) st[f.k].delete(v); else st[f.k].add(v); b.setAttribute('aria-pressed', String(st[f.k].has(v))); } } }, lbl));
    }
    g.append(row); body.append(g);
  }
  body.append(h('div', { class: 'fgroup' }, h('div', { class: 'fl', text: '其他' }),
    h('div', { class: 'chips' },
      h('button', { class: 'chip', 'aria-pressed': String(st.dispute), on: { click: (ev) => { st.dispute = !st.dispute; ev.currentTarget.setAttribute('aria-pressed', String(st.dispute)); } } }, '只看有争议'),
      h('button', { class: 'chip', 'aria-pressed': String(st.todo), on: { click: (ev) => { st.todo = !st.todo; ev.currentTarget.setAttribute('aria-pressed', String(st.todo)); } } }, '只看待核实'))));

  const { mask, sheet } = makeSheet('筛选', body, [
    { text: '清空', cls: 'ghost', fn: () => { clearFilters(); close(); renderSearch(); } },
    { text: '看结果', cls: 'primary', fn: () => { close(); renderSearch(); } },
  ]);
  function close() { mask.remove(); sheet.remove(); }
}

/* 底部弹层 */
function makeSheet(title, bodyNode, actions) {
  const mask = h('div', { class: 'mask' });
  const sheet = h('div', { class: 'sheet' },
    h('div', { class: 'grab' }),
    h('div', { class: 'sheet-h' }, h('b', { text: title }), h('button', { class: 'iconbtn', 'aria-label': '关闭', on: { click: close } }, icon('close'))),
    h('div', { class: 'sheet-b' }, bodyNode));
  if (actions && actions.length) {
    sheet.append(h('div', { class: 'sheet-h', style: 'border-top:1px solid var(--divider-soft);border-bottom:0;justify-content:flex-end' },
      actions.map((a) => h('button', { class: 'btn ' + (a.cls || ''), on: { click: a.fn } }, a.text))));
  }
  document.body.append(mask, sheet);
  requestAnimationFrame(() => { mask.classList.add('on'); sheet.classList.add('on'); });
  mask.addEventListener('click', close);
  function close() {
    mask.classList.remove('on'); sheet.classList.remove('on');
    setTimeout(() => { mask.remove(); sheet.remove(); }, 260);
  }
  return { mask, sheet, close };
}

/* ================= 生活自查 ================= */
/* 题目表：sec + key 按「第几节、标题里含哪段字」定位条目，不写条号，插条目顺延时不会指歪。
   和仓库里的 selfcheck.html 是同一套题，改一处要同步另一处。 */
const PROFILE = [
  { id: 'age', text: '你的年龄', opts: [['<30', '30 岁以下'], ['30', '30–44'], ['45', '45–59'], ['60', '60 岁以上']] },
  { id: 'sex', text: '你的性别', opts: [['m', '男'], ['f', '女']] },
  { id: 'kid', text: '家里有 4 岁以下的孩子吗', opts: [['y', '有'], ['n', '没有']] },
];
const ageAtLeast = (p, a) => ({ '<30': 20, '30': 30, '45': 45, '60': 60 }[p.age] || 0) >= a;
const GROUPS = [
  { name: '烟、酒和槟榔', mod: '身体', qs: [
    { sec: 2, key: '戒烟，越早越好', text: '不抽烟，或者已经戒了', also: [{ sec: 2, key: '先去拿药' }, { sec: 2, key: '戒烟门诊' }] },
    { sec: 2, key: '少喝或不喝酒', text: '不喝酒，或者很少喝' },
    { sec: 2, key: '不嚼槟榔', text: '不嚼槟榔' },
  ] },
  { name: '吃喝', mod: '身体', qs: [
    { sec: 2, key: '含糖饮料', text: '基本不喝奶茶、可乐、果汁这类含糖饮料' },
    { sec: 2, key: '加工肉', text: '很少吃火腿、香肠、培根、午餐肉' },
    { sec: 2, key: '全谷物', text: '主食里有一部分是糙米、燕麦、全麦这类全谷物' },
    { sec: 2, key: '5 份', text: '每天吃够一斤左右的水果和蔬菜' },
    { sec: 2, key: '坚果', text: '每天吃一小把坚果' },
    { sec: 2, key: '低钠盐', text: '家里做饭用低钠盐' },
    { sec: 2, key: '滚烫', text: '热茶热汤放一放再喝，不喝滚烫的' },
    { sec: 2, key: '抽油烟机', text: '炒菜时从开火到做完一直开着抽油烟机', hint: '不做饭可以跳过' },
  ] },
  { name: '动、睡和晒太阳', mod: '身体', qs: [
    { sec: 2, key: '7000', text: '每天走到 7000 步左右，或者每周快走累计 150 分钟以上' },
    { sec: 2, key: '力量训练', text: '每周做点力量训练（俯卧撑、深蹲、器械都算）' },
    { sec: 2, key: '别连着坐太久', text: '不会连着坐好几个小时不起身' },
    { sec: 2, key: '每晚睡 7', text: '每晚睡 7 小时左右，作息基本固定' },
    { sec: 2, key: '晒晒太阳', text: '白天会出门见见太阳，不是整天待在屋里' },
    { sec: 2, key: 'BMI', text: '体重在正常范围（BMI 20–25）', hint: 'BMI = 体重(公斤) ÷ 身高(米)²' },
    { sec: 2, key: '认真刷牙', text: '每天认真刷牙、清一次牙缝，缺了牙会去补' },
    { sec: 1, key: '平衡和腿部力量', text: '练过平衡和腿部力量，浴室楼梯装了扶手防滑', when: (p) => ageAtLeast(p, 60) },
  ] },
  { name: '出门和家里的安全', mod: '身体', qs: [
    { sec: 1, key: '系安全带', text: '坐车时前排后排都系安全带' },
    { sec: 1, key: '不酒驾', text: '开车不超速、不酒驾', hint: '不开车可以跳过' },
    { sec: 1, key: '戴头盔', text: '骑电动车、摩托车戴头盔并扣好', hint: '不骑可以跳过' },
    { sec: 1, key: '电动自行车不推进楼道', text: '电动车不推进楼道，不在家里充电', hint: '没有电动车可以跳过' },
    { sec: 1, key: '烟雾报警器', text: '家里装了烟雾报警器' },
    { sec: 1, key: '燃气软管', text: '燃气软管和灶具到期换过，没自己改过管道', hint: '家里不用燃气可以跳过' },
    { sec: 1, key: '野生蘑菇', text: '不采、不买、不吃野生蘑菇' },
    { sec: 1, key: '安全套', text: '和不固定的伴侣发生关系，全程用安全套', hint: '没有这种情况可以跳过' },
    { sec: 1, key: '安全座椅', text: '孩子坐车用安全座椅，不抱在怀里', when: (p) => p.kid === 'y' },
    { sec: 1, key: '限位器', text: '窗户和阳台装了限位器或护栏', when: (p) => p.kid === 'y' },
  ] },
  { name: '吃药', mod: '身体', qs: [
    { sec: 34, key: '对乙酰氨基酚', text: '同时吃两种感冒药或止痛药之前，会先看成分表' },
    { sec: 34, key: '普通感冒别找医生要抗生素', text: '普通感冒不找医生要抗生素' },
    { sec: 34, key: '头孢、甲硝唑', text: '吃头孢、甲硝唑期间和停药后一周不喝酒' },
    { sec: 2, key: '有高血压、高血脂', text: '有高血压、高血脂的，在按医嘱规律吃药', hint: '没有这些病可以跳过' },
  ] },
  { name: '检查和疫苗', mod: '身体', qs: [
    { sec: 1, key: '量血压', text: '最近一年量过血压，高了在吃药控制' },
    { sec: 1, key: '空腹血糖', text: '查过空腹血糖', when: (p) => ageAtLeast(p, 30) },
    { sec: 1, key: '乙肝两对半', text: '查过乙肝两对半，没抗体的打了疫苗' },
    { sec: 1, key: '幽门螺杆菌', text: '查过幽门螺杆菌' },
    { sec: 1, key: 'HPV 疫苗', text: '打过 HPV 疫苗', when: (p) => p.sex === 'f' },
    { sec: 1, key: '宫颈癌筛查', text: '做过宫颈癌筛查', when: (p) => p.sex === 'f' && ageAtLeast(p, 30) },
    { sec: 1, key: '乳腺癌筛查', text: '近两年做过乳腺钼靶', when: (p) => p.sex === 'f' && ageAtLeast(p, 45) },
    { sec: 1, key: '结直肠癌筛查', text: '做过结直肠癌筛查（大便潜血或肠镜）', when: (p) => ageAtLeast(p, 45) },
    { sec: 1, key: '流感疫苗', text: '每年打流感疫苗', when: (p) => ageAtLeast(p, 60) },
    { sec: 1, key: '带状疱疹疫苗', text: '打过带状疱疹疫苗', when: (p) => ageAtLeast(p, 60) },
    { sec: 1, key: '肺炎球菌疫苗', text: '打过肺炎球菌疫苗', when: (p) => ageAtLeast(p, 60) },
    { sec: 1, key: '骨密度', text: '做过骨密度检查', when: (p) => p.sex === 'f' && ageAtLeast(p, 60) },
  ] },
  { name: '急救常识', mod: '急救常识', qs: [
    { sec: 13, key: '有人倒地没呼吸', text: '看到有人倒地没呼吸，知道要立刻用力按压胸口，并让旁人找 AED' },
    { sec: 13, key: '突然嘴歪', text: '知道突然嘴歪、一侧胳膊没劲要直接打 120，不自己开车去' },
    { sec: 13, key: '胸口压着疼', text: '知道胸口压着疼超过 15 分钟不缓解要打 120' },
    { sec: 13, key: '有人噎住', text: '会给噎住的人做拍背加腹部冲击' },
    { sec: 13, key: '烫伤后', text: '知道烫伤先用凉的流水冲 20 分钟，不抹牙膏酱油' },
    { sec: 13, key: '被狗、猫咬伤', text: '被猫狗咬伤或抓破皮，会先冲洗再当天去打疫苗' },
    { sec: 13, key: '误服', text: '知道误服清洁剂、农药不催吐，带上瓶子去医院' },
    { sec: 13, key: '火灾时', text: '知道火灾时贴地走、先摸门、走楼梯不坐电梯' },
    { sec: 13, key: '婴儿噎住', text: '会给不满 1 岁的婴儿做拍背加按胸', when: (p) => p.kid === 'y' },
  ] },
  { name: '精力和情绪', mod: '精力', qs: [
    { sec: 3, key: '关掉非必要通知', text: '关掉了手机上不必要的通知，工作时手机放在看不到的地方' },
    { sec: 3, key: '固定起床时间', text: '周末也基本按平时的时间起床' },
    { sec: 3, key: '下午两点以后', text: '下午两点以后不喝咖啡、浓茶' },
    { sec: 3, key: '到点就睡', text: '不会为了打游戏、刷短视频熬夜' },
    { sec: 3, key: '睡前一小时', text: '睡前一小时不看手机' },
    { sec: 3, key: '别人过得怎么样', text: '不会每天刷同龄人的动态' },
    { sec: 3, key: '49 小时', text: '每周工作时间基本不超过 50 小时', hint: '没在上班可以跳过' },
    { sec: 3, key: '学会拒绝', text: '不想接的请求能说出「不」' },
    { sec: 22, key: '定期和人见面', text: '定期和朋友家人见面，不是心情差了才找人' },
  ] },
  { name: '钱', mod: '钱', qs: [
    { sec: 5, key: '自动续费', text: '关掉了不用的自动续费' },
    { sec: 5, key: '个税汇算', text: '每年做个税汇算，该填的专项附加扣除都填了', hint: '没有工资收入可以跳过' },
    { sec: 5, key: '最低还款', text: '不用信用卡最低还款，不开消费分期和消费贷' },
    { sec: 5, key: '先存出', text: '存了 3 到 6 个月生活费的应急金，能随时取' },
    { sec: 5, key: '高收益', text: '看到「保本」「高收益」「稳赚」会直接走开' },
    { sec: 5, key: '家庭共济', text: '在医保 App 上办了家庭共济', hint: '没有职工医保可以跳过' },
    { sec: 5, key: '三者险', text: '开车的话，三者险买够了', hint: '没有车可以跳过' },
    { sec: 5, key: '定期寿险', text: '家里有人靠你的收入过日子，你买了定期寿险', hint: '家里没人靠你收入可以跳过' },
    { sec: 5, key: '宽基指数', text: '长期投资的钱放在宽基指数基金，而不是主动基金或个股', hint: '没有投资可以跳过' },
  ] },
  { name: '账号与防骗', mod: '账号与防骗', qs: [
    { sec: 14, key: '二次验证', text: '邮箱、支付、社交账号都开了二次验证' },
    { sec: 14, key: '邮箱密码单独', text: '邮箱密码单独一个，没在别的网站用过' },
    { sec: 14, key: '锁屏密码', text: '手机设了锁屏密码，SIM 卡设了 PIN 码' },
    { sec: 8, key: '通讯录里的旧号码', text: '家人视频或电话要你转账，会先挂断，用通讯录里的旧号码打回去核实' },
    { sec: 8, key: '不把银行卡', text: '从不把银行卡、手机卡、支付账号借给别人' },
    { sec: 8, key: '征信报告', text: '查过自己的征信报告' },
    { sec: 8, key: '签字前', text: '把纸看完，不在空白纸上签' },
  ] },
];
const MODS = ['身体', '急救常识', '精力', '钱', '账号与防骗'];
let ans = LS.get('selfcheck', {});
const saveAns = () => LS.set('selfcheck', ans);
const modOn = (m) => ans['mod:' + m] !== 'off';
const profile = () => Object.fromEntries(PROFILE.map((p) => [p.id, ans['p:' + p.id]]));
const profileDone = () => PROFILE.every((p) => ans['p:' + p.id]);
const qid = (q) => q.sec + ':' + q.key;
let QMAP = null;
function resolveQs() {
  if (QMAP) return QMAP;
  const all = S.data.sections.flatMap((s) => s.entries);
  for (const g of GROUPS) for (const q of g.qs) {
    q.g = g;
    q.entry = all.find((x) => x.sec === q.sec && x.title.includes(q.key));
    if (!q.entry) console.warn('自查题找不到条目：第 ' + q.sec + ' 节，标题含「' + q.key + '」');
  }
  QMAP = true;
  return true;
}
function seg(name, opts, cur, cls) {
  const box = h('div', { class: 'seg', role: 'group' });
  for (const o of opts) {
    const v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o, c = Array.isArray(o) ? o[2] : '';
    const b = h('button', { type: 'button', class: c || '', 'aria-pressed': String(cur === v), text: t, dataset: { k: name, v } });
    b.addEventListener('click', () => {
      ans[name] = ans[name] === v ? undefined : v;
      saveAns(); renderCheck();
    });
    box.append(b);
  }
  return box;
}
const YN = [['y', '做到了', 'yes'], ['n', '没做到', 'no'], ['s', '跳过']];
function renderCheck() {
  resolveQs();
  const p = profile();
  const nodes = [pageHead('自查', null, '生活自查'),
    h('p', { class: 'intro', text: '回答下面的问题，看看书里哪些事你还没做到。结果会告诉你哪一块漏得最多、先做哪几件、哪些一次办完就行。答案只存在你这台设备上。' })];

  nodes.push(h('div', { class: 'section-title' }, h('h2', { text: '基本情况' }), h('small', { text: '决定问哪些题' })));
  for (const f of PROFILE) nodes.push(h('div', { class: 'qrow' }, h('div', { class: 'qt', text: f.text }), seg('p:' + f.id, f.opts, ans['p:' + f.id])));

  const mods = h('div', { class: 'chips' }, MODS.map((m) => {
    const b = h('button', { class: 'chip', 'aria-pressed': String(modOn(m)), text: m });
    b.addEventListener('click', () => { ans['mod:' + m] = modOn(m) ? 'off' : undefined; saveAns(); renderCheck(); });
    return b;
  }));
  nodes.push(h('div', { class: 'qrow' }, h('div', { class: 'qt' }, '想查哪几块', h('small', { text: '点一下取消，不查的整块不出题' })), mods));

  const qs = [];
  for (const g of GROUPS) {
    const list = g.qs.filter((q) => q.entry && modOn(g.mod) && (!q.when || (profileDone() && q.when(p))));
    if (!list.length) continue;
    qs.push(...list);
    nodes.push(h('div', { class: 'section-title' }, h('h2', { text: g.name })));
    for (const q of list) nodes.push(h('div', { class: 'qrow' },
      h('div', { class: 'qt' }, q.text, q.hint ? h('small', { text: q.hint }) : null),
      seg(qid(q), YN, ans[qid(q)])));
  }

  const answered = qs.filter((q) => ans[qid(q)]).length;
  nodes.push(h('div', { class: 'qbar' },
    h('span', { class: 'prog', text: profileDone() ? '已答 ' + answered + ' / ' + qs.length + ' 题' : '先填上面三题' }),
    h('button', { class: 'btn ghost sm', on: { click: () => { if (confirm('清空所有答案？')) { ans = {}; saveAns(); renderCheck(); } } } }, '清空'),
    h('button', { class: 'btn primary sm', on: { click: () => { if (!profileDone()) { toast('先把基本情况三题填上'); return; } renderCheckOut(qs, p); } } }, '看结果')));

  setView(...nodes);
}
const RANK = { '极高': 0, '高': 1, '一般': 2 }, LV = { '大': 0, '中': 1, '小': 2 }, GR = { A: 0, B: 1, C: 2 }, WILLW = { '否': 0, '些': 1, '是': 2 };
const PILES = [
  { will: '否', name: '一次办完就行', sub: '做一次或者记住就够，不用改习惯' },
  { will: '些', name: '要改一个习惯', sub: '要忍一点不适，坚持几周就成了习惯' },
  { will: '是', name: '要长期坚持', sub: '和惯性长期对着干，最难，挑一件慢慢来' },
];
function renderCheckOut(qs, p) {
  const no = qs.filter((q) => ans[qid(q)] === 'n').sort((a, b) =>
    RANK[a.entry.ratio] - RANK[b.entry.ratio] || LV[a.entry.level] - LV[b.entry.level] ||
    WILLW[a.entry.will] - WILLW[b.entry.will] || GR[a.entry.grade] - GR[b.entry.grade] || a.entry.cs - b.entry.cs);
  const yes = qs.filter((q) => ans[qid(q)] === 'y');
  const answered = no.length + yes.length;

  const groups = GROUPS.map((g) => {
    const y = yes.filter((q) => q.g === g).length, n = no.filter((q) => q.g === g).length;
    return { g, y, t: y + n, pct: y + n ? y / (y + n) : 1 };
  }).filter((r) => r.t).sort((a, b) => a.pct - b.pct || b.t - a.t);

  const easy = no.filter((q) => q.entry.will === '否'), free = easy.filter((q) => q.entry.money === '0');
  const good = no.filter((q) => q.entry.ratio !== '一般'), disp = no.filter((q) => q.entry.dispute);
  const weak = groups.find((r) => r.t >= 2 && r.pct < 1);
  const v = h('p', { class: 'verdict' });
  v.append('你答了 ' + answered + ' 题，做到 ', h('b', { text: String(yes.length) }), ' 项，没做到 ', h('b', { text: String(no.length) }), ' 项。');
  if (!no.length) v.append('书里这些事你都做到了。');
  if (weak) v.append('漏得最多的是「' + weak.g.name + '」，' + weak.t + ' 项里做到 ' + weak.y + ' 项。');
  if (easy.length) v.append('没做到的里有 ' + easy.length + ' 项一次办完就行，不用改习惯' + (free.length ? '，其中 ' + free.length + ' 项不花钱。' : '。'));
  if (disp.length) v.append('有 ' + disp.length + ' 项证据有争议，先看原条目的备注再决定。');

  const tiles = h('div', { class: 'tiles' },
    h('div', { class: 'tile' }, h('b', { text: (answered ? Math.round(yes.length / answered * 100) : 0) + '%' }), h('span', { text: '答过的题里做到的比例' })),
    h('div', { class: 'tile' }, h('b', { text: String(no.length) }), h('span', { text: '还没做到' })),
    h('div', { class: 'tile r3' }, h('b', { text: String(good.length) }), h('span', { text: '其中性价比高或极高' })),
    h('div', { class: 'tile r2' }, h('b', { text: String(easy.length) }), h('span', { text: '其中一次办完就行' })));

  const bars = h('div', {}, groups.map((r) =>
    h('div', { class: 'hbar' },
      h('span', { class: 'nm', text: r.g.name }),
      h('span', { class: 'tr' }, h('span', { class: 'fl', style: 'width:' + (r.pct * 100).toFixed(0) + '%' })),
      h('span', { class: 'v', text: r.y + ' / ' + r.t }))));

  const top = no.slice(0, 3);
  const nodes = [pageHead('自查', null, '自查结果'), v, tiles,
    h('div', { class: 'section-title' }, h('h2', { text: '哪一块漏得最多' }), h('small', { text: '按做到的比例从低到高' })), bars];

  if (top.length) {
    const ol = h('ol', { class: 'top3' });
    for (const q of top) ol.append(h('li', {},
      h('a', { href: '#/e/' + q.entry.sec + '/' + q.entry.n, text: plain(q.entry.title), on: { click: (ev) => { ev.preventDefault(); openEntry(q.entry.sec, q.entry.n); } } }),
      h('span', { class: 'why', text: '性价比' + q.entry.ratio + '，证据 ' + q.entry.grade + ' 级，' + (PILES.find((x) => x.will === q.entry.will) || {}).name })));
    nodes.push(h('div', { class: 'section-title' }, h('h2', { text: '先做这' + (top.length === 3 ? '三' : top.length === 2 ? '两' : '一') + '件' }), h('small', { text: '没做到的里性价比最高的' })), ol);
  }
  for (const pl of PILES) {
    const list = no.filter((q) => q.entry.will === pl.will);
    if (!list.length) continue;
    nodes.push(h('div', { class: 'section-title' }, h('h2', { text: pl.name + '（' + list.length + ' 项）' }), h('small', { text: pl.sub })));
    for (const q of list) nodes.push(entryCard(q.entry, []));
  }
  nodes.push(h('div', { class: 'note' }, h('b', { text: '为什么不算「少活几年」：' }), '每条的数字来自不同研究、不同人群，而且抽烟、不运动、睡得差这些习惯常常一起出现。把各条的风险乘到一起会重复计算，算出来的年数会偏大，偏多少也说不清。所以每条只给它自己那份证据。'));
  if (yes.length) {
    nodes.push(h('div', { class: 'section-title' }, h('h2', { text: '已经做到的' })));
    nodes.push(h('div', { class: 'melist' }, yes.map((q) => h('a', { class: 'mi', href: '#/e/' + q.entry.sec + '/' + q.entry.n, on: { click: (ev) => { ev.preventDefault(); openEntry(q.entry.sec, q.entry.n); } } },
      h('span', { class: 'ico' }, icon('done')), h('span', { class: 'tx' }, h('b', { text: plain(q.entry.title) })), icon('right')))));
  }
  nodes.push(h('div', { class: 'qbar' },
    h('span', { class: 'prog', text: '答案只存在你这台设备的浏览器里。' }),
    h('button', { class: 'btn ghost sm', on: { click: () => renderCheck() } }, '改答案')));
  setView(...nodes);
}

/* ================= 我的 ================= */
function renderMe() {
  const d = S.data;
  const visited = Object.keys(S.visits).length;
  const bmList = [...S.bm].map((k) => ITEMS.get(k)).filter(Boolean);
  const doneList = [...S.done].map((k) => ITEMS.get(k)).filter(Boolean);

  const segTheme = (() => {
    const box = h('div', { class: 'seg' });
    for (const [v, t] of [['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']]) {
      const b = h('button', { 'aria-pressed': String(S.theme === v), text: t });
      b.addEventListener('click', () => { S.theme = v; LS.set('theme', v); applyTheme(); renderMe(); });
      box.append(b);
    }
    return box;
  })();
  const segFs = (() => {
    const box = h('div', { class: 'seg' });
    for (const [v, t] of [['s', '小'], ['m', '标准'], ['l', '大'], ['xl', '特大']]) {
      const b = h('button', { 'aria-pressed': String(S.fs === v), text: t });
      b.addEventListener('click', () => { S.fs = v; LS.set('fs', v); applyFs(); renderMe(); });
      box.append(b);
    }
    return box;
  })();

  const nodes = [pageHead('我的', null, '我的')];

  nodes.push(h('div', { class: 'tiles' },
    h('div', { class: 'tile' }, h('b', { text: String(bmList.length) }), h('span', { text: '条收藏' })),
    h('div', { class: 'tile' }, h('b', { text: String(doneList.length) }), h('span', { text: '条已做到' })),
    h('div', { class: 'tile' }, h('b', { text: visited + '/' + d.sections.length }), h('span', { text: '读过的章节' })),
    h('div', { class: 'tile' }, h('b', { text: String(d.meta.stats.entries) }), h('span', { text: '全书条目' }))));

  nodes.push(h('div', { class: 'section-title' }, h('h2', { text: '显示' })));
  nodes.push(h('div', { class: 'melist' },
    h('div', { class: 'mi' }, h('span', { class: 'ico' }, icon('sun')), h('span', { class: 'tx' }, h('b', { text: '主题' })), segTheme),
    h('div', { class: 'mi' }, h('span', { class: 'ico' }, icon('book')), h('span', { class: 'tx' }, h('b', { text: '字号' })), segFs)));

  if (bmList.length) {
    nodes.push(h('div', { class: 'section-title' }, h('h2', { text: '收藏' })));
    nodes.push(h('div', { class: 'melist' }, bmList.map((e) => h('a', { class: 'mi', href: '#/e/' + e.sec + '/' + e.n, on: { click: (ev) => { ev.preventDefault(); openEntry(e.sec, e.n); } } },
      h('span', { class: 'ico' }, icon('bmf')), h('span', { class: 'tx' }, h('b', { text: plain(e.title) }), h('small', { text: '第 ' + e.sec + ' 节第 ' + e.n + ' 条' })), icon('right')))));
  }
  if (doneList.length) {
    nodes.push(h('div', { class: 'section-title' }, h('h2', { text: '已做到' })));
    nodes.push(h('div', { class: 'melist' }, doneList.map((e) => h('a', { class: 'mi', href: '#/e/' + e.sec + '/' + e.n, on: { click: (ev) => { ev.preventDefault(); openEntry(e.sec, e.n); } } },
      h('span', { class: 'ico' }, icon('done')), h('span', { class: 'tx' }, h('b', { text: plain(e.title) })), icon('right')))));
  }

  const REL = d.meta.repo + '/releases/download/epub-latest/';
  nodes.push(h('div', { class: 'section-title' }, h('h2', { text: '其他格式' })));
  nodes.push(h('div', { class: 'melist' },
    h('a', { class: 'mi', href: REL + 'HowToLiveBetter.pdf', target: '_blank', rel: 'noopener' }, h('span', { class: 'ico' }, icon('download')), h('span', { class: 'tx' }, h('b', { text: 'PDF' }), h('small', { text: 'A4 排版、带目录页码，适合打印' })), icon('newwin')),
    h('a', { class: 'mi', href: REL + 'HowToLiveBetter.epub', target: '_blank', rel: 'noopener' }, h('span', { class: 'ico' }, icon('download')), h('span', { class: 'tx' }, h('b', { text: 'EPUB' }), h('small', { text: 'Kindle 等阅读器' })), icon('newwin')),
    h('a', { class: 'mi', href: REL + 'HowToLiveBetter.html', target: '_blank', rel: 'noopener' }, h('span', { class: 'ico' }, icon('download')), h('span', { class: 'tx' }, h('b', { text: '离线单文件 HTML' }), h('small', { text: '双击就开，不用联网' })), icon('newwin')),
    h('a', { class: 'mi', href: REL + 'HowToLiveBetter.apkg', target: '_blank', rel: 'noopener' }, h('span', { class: 'ico' }, icon('download')), h('span', { class: 'tx' }, h('b', { text: 'Anki 牌组' }), h('small', { text: '一条一张卡，按节分牌组' })), icon('newwin'))));

  nodes.push(h('div', { class: 'section-title' }, h('h2', { text: '关于' })));
  nodes.push(h('div', { class: 'melist' },
    h('a', { class: 'mi', href: '#/glossary', on: { click: (ev) => { ev.preventDefault(); go('#/glossary'); } } }, h('span', { class: 'ico' }, icon('bulb')), h('span', { class: 'tx' }, h('b', { text: '术语表' }), h('small', { text: d.glossary.length + ' 个名词' })), icon('right')),
    h('a', { class: 'mi', href: d.meta.repo, target: '_blank', rel: 'noopener' }, h('span', { class: 'ico' }, icon('newwin')), h('span', { class: 'tx' }, h('b', { text: 'GitHub 仓库' }), h('small', { text: '正文与工具脚本' })), icon('newwin')),
    h('a', { class: 'mi', href: d.meta.repo + '/issues', target: '_blank', rel: 'noopener' }, h('span', { class: 'ico' }, icon('warn')), h('span', { class: 'tx' }, h('b', { text: '报告错误 / 提建议' }), h('small', { text: '发现写错了，欢迎提 issue' })), icon('newwin')),
    h('a', { class: 'mi', href: 'https://creativecommons.org/licenses/by/4.0/deed.zh-hans', target: '_blank', rel: 'noopener' }, h('span', { class: 'ico' }, icon('info')), h('span', { class: 'tx' }, h('b', { text: '许可' }), h('small', { text: '正文 CC BY 4.0，代码 MIT' })), icon('newwin'))));

  nodes.push(h('div', { class: 'section-title' }, h('h2', { text: '本机数据' })));
  nodes.push(h('div', { class: 'melist' },
    h('button', { class: 'mi', on: { click: () => { if (confirm('清除收藏、已做到、阅读进度和自查答案？')) { for (const k of ['bm', 'done', 'visits', 'selfcheck', 'last']) LS.del(k); S.bm = new Set(); S.done = new Set(); S.visits = {}; S.last = null; ans = {}; QMAP = null; toast('已清除'); renderMe(); } } } },
      h('span', { class: 'ico' }, icon('refresh')), h('span', { class: 'tx' }, h('b', { text: '清除本机数据' }), h('small', { text: '收藏、已做到、进度、自查答案' })))));

  nodes.push(h('div', { class: 'note' }, '书里的内容可能过时，也可能有错。不少政策各地执行不一样。真去办事、看病、打官司时，以当地部门、医生和律师的说法为准。数据版本：' + d.meta.builtAt + '。'));
  setView(...nodes);
}

/* ================= 长文 ================= */
function renderDoc(slug) {
  const doc = S.data.docs.find((x) => x.slug === slug);
  if (!doc) { render404(); return; }
  const body = h('div', { class: 'doc-body' });
  // 长文自己的一级标题和页头重复，去掉；页头已经显示标题了
  renderDocMd(body, doc.md.replace(/^\s*#\s+[^\n]*\n/, ''));
  const toc = h('div', { class: 'doc-toc' });
  for (const el of $$('.doc-body h2, .doc-body h3', body)) {
    const id = 'h-' + Math.random().toString(36).slice(2, 7);
    el.id = id;
    toc.append(h('a', { class: 'chip', href: '#' + id, text: el.textContent, on: { click: (ev) => { ev.preventDefault(); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } } }));
  }
  setView(pageHead('长文', '#/toc', doc.title), toc.children.length ? toc : null, body);
}
/* 长文渲染器：只认标题、段落、列表、表格、引用、代码，够用不引库 */
function renderDocMd(root, md) {
  const lines = md.split('\n');
  let i = 0, list = null, listTag = null, para = null;
  const flushList = () => { if (list) { root.append(list); list = null; listTag = null; } };
  const flushPara = () => { if (para) { root.append(para); para = null; } };
  const inl = (el, s) => { renderText(el, s, [], false); termify(el); };
  while (i < lines.length) {
    const line = lines[i];
    let m;
    if (/^\s*$/.test(line)) { flushList(); flushPara(); i++; continue; }
    if ((m = /^(#{1,4})\s+(.+)$/.exec(line))) {
      flushList(); flushPara();
      const lvl = Math.min(4, m[1].length + 1); // md 的 # 对应页面里的 h2 起
      const el = h('h' + Math.min(3, lvl));
      inl(el, m[2]); root.append(el); i++; continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushList(); flushPara(); root.append(h('hr')); i++; continue; }
    if ((m = /^\s*\|(.+)\|\s*$/.exec(line))) {
      flushList(); flushPara();
      const rows = [];
      while (i < lines.length && /^\s*\|(.+)\|\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
      const tbl = h('table');
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(rows[0]);
      const isSep = rows[1] && /^\s*\|[\s:|-]+\|\s*$/.test(rows[1]);
      // 三列以上的表在手机上挤成一团，给它一个最小宽度让它横向滚动
      if (head.length >= 3) tbl.className = 'wide';
      const thead = h('thead', null, h('tr', null, head.map((c) => { const th = h('th'); inl(th, c); return th; })));
      tbl.append(thead);
      const tbody = h('tbody');
      for (const r of rows.slice(isSep ? 2 : 1)) {
        tbody.append(h('tr', null, cells(r).map((c) => { const td = h('td'); inl(td, c); return td; })));
      }
      tbl.append(tbody); root.append(h('div', { class: 'table-wrap' }, tbl)); continue;
    }
    if ((m = /^\s*[-*]\s+(.+)$/.exec(line))) {
      flushPara();
      if (!list || listTag !== 'ul') { flushList(); list = h('ul'); listTag = 'ul'; }
      const li = h('li'); inl(li, m[1]); list.append(li); i++; continue;
    }
    if ((m = /^\s*\d+[.、]\s+(.+)$/.exec(line))) {
      flushPara();
      if (!list || listTag !== 'ol') { flushList(); list = h('ol'); listTag = 'ol'; }
      const li = h('li'); inl(li, m[1]); list.append(li); i++; continue;
    }
    if ((m = /^>\s?(.*)$/.exec(line))) {
      flushList(); flushPara();
      const bq = h('blockquote'); inl(bq, m[1]); root.append(bq); i++; continue;
    }
    flushList();
    if (!para) { para = h('p'); inl(para, line); }
    else { para.append(document.createTextNode(' ')); const tmp = h('span'); inl(tmp, line); while (tmp.firstChild) para.append(tmp.firstChild); }
    i++;
  }
  flushList(); flushPara();
}

/* ================= 术语表页 ================= */
function renderGlossary() {
  const list = h('div', { class: 'melist' }, S.data.glossary.map((g) =>
    h('div', { class: 'mi', style: 'align-items:flex-start' },
      h('span', { class: 'tx' }, h('b', { text: g.term }), h('small', { style: 'font-size:13.5px;line-height:1.7;margin-top:3px', text: g.meaning })))));
  setView(pageHead('术语表', '#/toc', '读懂数字'), h('p', { class: 'intro', text: '正文尽量用日常说法，但引用研究时免不了出现几个统计名词。看不懂就查这里。' }), list);
}

/* ================= 404 ================= */
function render404() {
  setView(h('div', { class: 'empty' }, icon('info'), h('div', { text: '没有找到这个页面' }), h('div', { style: 'margin-top:12px' }, h('a', { class: 'btn ghost sm', href: '#/', text: '回首页' }))));
}

/* ================= 路由 ================= */
const NAV = [
  { id: 'home', label: '首页', icon: 'home', href: '#/' },
  { id: 'toc', label: '目录', icon: 'toc', href: '#/toc' },
  { id: 'search', label: '搜索', icon: 'search', href: '#/search' },
  { id: 'check', label: '自查', icon: 'check', href: '#/check' },
  { id: 'me', label: '我的', icon: 'me', href: '#/me' },
];
function currentTab(route) {
  if (route.name === 'section' || route.name === 'entry' || route.name === 'doc' || route.name === 'glossary') return 'toc';
  return route.name;
}
function buildNav() {
  // 顶栏
  const top = h('header', { class: 'topbar' });
  const backBtn = h('button', { class: 'iconbtn', id: 'top-back', 'aria-label': '返回', hidden: true, on: { click: () => history.back() } }, icon('left'));
  top.append(backBtn,
    h('a', { class: 'brand', href: '#/' }, h('span', { class: 'logo' }, icon('check')), h('span', { text: '高性价比人生指南' })),
    h('span', { class: 'sp' }),
    h('a', { class: 'iconbtn', href: '#/search', 'aria-label': '搜索' }, icon('search')));
  // 侧栏
  const side = h('nav', { class: 'sidebar' },
    h('a', { class: 'brand', href: '#/' }, h('span', { class: 'logo' }, icon('check')), h('span', {}, '高性价比人生指南', h('small', { text: '按性价比排序的人生指南' }))),
    NAV.map((n) => h('a', { class: 'navlink', href: n.href, dataset: { tab: n.id } }, icon(n.icon), h('span', { text: n.label }))),
    h('div', { class: 'foot' },
      h('div', {}, S.data.meta.stats.entries + ' 条 · ' + S.data.meta.stats.sections + ' 节'),
      h('div', {}, h('a', { href: S.data.meta.repo, target: '_blank', rel: 'noopener', text: 'GitHub 仓库' }), ' · ', h('a', { href: '#/glossary', text: '术语表' })),
      h('div', { style: 'margin-top:6px' }, '正文 CC BY 4.0')));
  // 底部标签栏
  const tabbar = h('nav', { class: 'tabbar' }, NAV.map((n) =>
    h('a', { class: 'tab', href: n.href, dataset: { tab: n.id } }, icon(n.icon), h('span', { text: n.label }))));
  document.body.prepend(top, side, tabbar);
  document.body.append(h('main', { class: 'main', id: 'main' }, h('div', { id: 'view' })));
}
function markNav(route) {
  const tab = currentTab(route);
  $$('.tab,.navlink').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  const showBack = route.name === 'entry' || route.name === 'doc' || route.name === 'glossary';
  const b = $('#top-back'); if (b) b.hidden = !showBack;
  const title = { section: '章节', entry: '条目', doc: '长文', glossary: '术语表' }[route.name];
  const brand = $('.topbar .brand span:last-child');
  if (brand) brand.textContent = title || '高性价比人生指南';
}
function parseHash() {
  let raw = location.hash || '#/';
  // 兼容旧格式 #e-9-15 / #s-9（仓库里 README、selfcheck 用的是这种）
  let m;
  if ((m = /^#e-(\d+)-(\d+)$/.exec(raw))) return { name: 'entry', sec: m[1], n: m[2] };
  if ((m = /^#s-(\d+)$/.exec(raw))) return { name: 'section', n: m[1] };
  let path = raw.replace(/^#\/?/, '');
  const qIdx = path.indexOf('?');
  if (qIdx >= 0) path = path.slice(0, qIdx);
  const seg = path.split('/').filter(Boolean);
  if (!seg.length) return { name: 'home' };
  if (seg[0] === 'toc') return { name: 'toc' };
  if (seg[0] === 'search') return { name: 'search' };
  if (seg[0] === 'check') return { name: 'check' };
  if (seg[0] === 'me') return { name: 'me' };
  if (seg[0] === 'glossary') return { name: 'glossary' };
  if (seg[0] === 's') return { name: 'section', n: seg[1] };
  if (seg[0] === 'e') return { name: 'entry', sec: seg[1], n: seg[2] };
  if (seg[0] === 'doc') return { name: 'doc', slug: decodeURIComponent(seg.slice(1).join('/')) };
  return { name: 'home' };
}
function route() {
  const r = parseHash();
  markNav(r);
  try {
    if (r.name === 'home') renderHome();
    else if (r.name === 'toc') renderToc();
    else if (r.name === 'section') renderSection(r.n);
    else if (r.name === 'entry') renderEntry(r.sec, r.n);
    else if (r.name === 'search') renderSearch();
    else if (r.name === 'check') renderCheck();
    else if (r.name === 'me') renderMe();
    else if (r.name === 'doc') renderDoc(r.slug);
    else if (r.name === 'glossary') renderGlossary();
    else renderHome();
  } catch (err) {
    console.error(err);
    setView(h('div', { class: 'empty' }, h('div', { text: '这个页面出错了：' + err.message })));
  }
}
function go(href) {
  if (location.hash === href) route();
  else location.hash = href;
}
window.addEventListener('hashchange', route);
// 页内锚点（长文目录）不要被路由吃掉
window.addEventListener('click', (ev) => {
  const a = ev.target.closest('a[href^="#h-"]');
  if (a) { ev.preventDefault(); const t = document.getElementById(a.getAttribute('href').slice(1)); if (t) t.scrollIntoView({ behavior: 'smooth' }); }
});

/* ================= 启动 ================= */
async function init() {
  applyTheme(); applyFs();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.theme === 'auto') applyTheme(); });
  const viewEl = h('div', { class: 'loading' }, h('div', { class: 'spinner' }), h('div', { text: '正在读取正文 …' }));
  document.body.append(h('main', { class: 'main' }, h('div', { id: 'view' }, h('div', { class: 'wrap' }, viewEl))));
  try {
    const res = await fetch('data.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    S.data = await res.json();
  } catch (err) {
    $('#view').innerHTML = '';
    $('#view').append(h('div', { class: 'wrap' },
      h('div', { class: 'empty' }, icon('warn'),
        h('div', { text: '没能读取正文数据' }),
        h('div', { style: 'margin-top:10px;font-size:13.5px;color:var(--t3)' }, '这个页面要通过 http 打开，并保证同目录下有 data.json（运行 node tools/site/build.mjs 生成）。'),
        h('div', { style: 'margin-top:14px' }, h('button', { class: 'btn primary sm', on: { click: () => location.reload() } }, '重试')))));
    return;
  }
  // 索引
  for (const s of S.data.sections) {
    SECS.set(String(s.n), s);
    for (const e of s.entries) ITEMS.set(e.sec + '-' + e.n, e);
  }
  buildGloss(S.data.glossary);
  document.body.textContent = '';
  buildNav();
  route();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();
