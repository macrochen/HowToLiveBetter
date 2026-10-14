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
  play: 'M8 5v14l11-7z',
  stop: 'M6 6h12v12H6z',
  image: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  chart: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z',
  calc: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-6 2h5v2h-5V5zm0 3h5v2h-5V8zM6 5h5v5H6V5zm1 1h3v3H7V6zm-1 6h5v5H6v-5zm1 1h3v3H7v-3zm6 0h5v5h-5v-5zm1 1h3v3h-3v-3z',
  trophy: 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0011 15.9V19H7v2h10v-2h-4v-3.1c1.8-.46 3.16-1.92 3.61-3.96C19.08 11.63 21 9.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z',
  calendar: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z',
  graph: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z',
  compass: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z',
  timeline: 'M23 8c0 1.1-.9 2-2 2-.18 0-.35-.02-.51-.07l-3.56 3.55c.05.16.07.34.07.52 0 1.1-.9 2-2 2s-2-.9-2-2c0-.18.02-.36.07-.52l-2.55-2.55c-.16.05-.34.07-.52.07s-.36-.02-.52-.07l-4.55 4.56c.05.16.07.33.07.51 0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2c.18 0 .35.02.51.07l4.56-4.55C8.02 9.36 8 9.18 8 9c0-1.1.9-2 2-2s2 .9 2 2c0 .18-.02.36-.07.52l2.55 2.55c.16-.05.34-.07.52-.07s.36.02.52.07l3.55-3.56C19.02 8.35 19 8.18 19 8c0-1.1.9-2 2-2s2 .9 2 2z',
  fire: 'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM12 20c-3.31 0-6-2.69-6-6 0-1.53.58-3.05 1.58-4.23.47 2.09 2.27 3.66 4.42 3.66 1.83 0 3.39-1.12 3.96-2.73 1.25 1.76 2.04 3.76 2.04 5.3 0 3.31-2.69 6-6 6z',
  zen: 'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12zm-8-3h8v-2h-8v2zm0-4h8V7h-8v2z',
  expand: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
  compress: 'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-14v3h3v2h-5V5h2z',
  plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
  minus: 'M19 13H5v-2h14v2z'
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

/* ================= 语音朗读单例 (TTS) ================= */
const TTS = {
  cur: null,
  btn: null,
  speak(text, btn) {
    if (!('speechSynthesis' in window)) {
      toast('当前浏览器不支持语音播报');
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      if (this.btn) {
        this.btn.classList.remove('playing');
        const s = this.btn.querySelector('svg');
        if (s) s.innerHTML = '<path d="' + ICONS.play + '"/>';
      }
      if (this.cur === text) {
        this.cur = null; this.btn = null;
        return;
      }
    }
    this.cur = text;
    this.btn = btn;
    const ut = new SpeechSynthesisUtterance(text);
    ut.lang = 'zh-CN';
    ut.rate = 1.0;
    if (btn) {
      btn.classList.add('playing');
      const s = btn.querySelector('svg');
      if (s) s.innerHTML = '<path d="' + ICONS.stop + '"/>';
    }
    ut.onend = ut.onerror = () => {
      if (btn) {
        btn.classList.remove('playing');
        const s = btn.querySelector('svg');
        if (s) s.innerHTML = '<path d="' + ICONS.play + '"/>';
      }
      TTS.cur = null; TTS.btn = null;
    };
    window.speechSynthesis.speak(ut);
    Achievements.unlock('voice_listener');
  }
};

/* ================= 日历 .ics 文件生成器 ================= */
const ICalGen = {
  add(e) {
    const title = '【生活指南提醒】' + plain(e.title);
    const desc = plain(e.human || '') + '\n出处：《高性价比人生指南》第 ' + e.sec + ' 节第 ' + e.n + ' 条\n成本：' + plain(e.cost || '');
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0, 0);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HowToLiveBetter//CN', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT', 'SUMMARY:' + title, 'DESCRIPTION:' + desc.replace(/\n/g, '\\n'),
      'DTSTART:' + fmt(start), 'DTEND:' + fmt(end), 'STATUS:CONFIRMED',
      'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:提醒', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = '指南待办-' + e.sec + '-' + e.n + '.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('已生成日历待办文件 (.ics)，请在弹出的系统日历中保存');
  }
};

/* ================= Canvas 分享卡片生成器 ================= */
const CardGen = {
  show(e) {
    Achievements.unlock('share_card');
    const wrap = h('div', { class: 'card-preview-wrap' });
    const canvas = h('canvas', { class: 'card-canvas' });
    const tip = h('div', { style: 'font-size:.8125rem;color:var(--t3);text-align:center' }, '长按图片保存，或点击下方按钮下载');
    const dpr = Math.min(window.devicePixelRatio || 2, 2);
    const W = 640 * dpr;
    const ctx = canvas.getContext('2d');
    ctx.font = 'bold ' + (20 * dpr) + 'px -apple-system, sans-serif';
    const lines = [];
    const rawHuman = plain(e.human || e.title);
    const maxChars = 19;
    for (let i = 0; i < rawHuman.length; i += maxChars) lines.push(rawHuman.slice(i, i + maxChars));
    const H = (430 + lines.length * 36) * dpr;
    canvas.width = W; canvas.height = H;
    canvas.style.width = '320px'; canvas.style.height = (H / (2 * dpr)) + 'px';

    const dark = document.documentElement.classList.contains('dark');
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    if (dark) { bgGrad.addColorStop(0, '#1b1d25'); bgGrad.addColorStop(1, '#111216'); }
    else { bgGrad.addColorStop(0, '#f9fafc'); bgGrad.addColorStop(1, '#edf0f7'); }
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H);

    // 顶部标志
    ctx.fillStyle = '#3451b2'; ctx.fillRect(36 * dpr, 36 * dpr, 6 * dpr, 24 * dpr);
    ctx.fillStyle = dark ? '#a3b0ff' : '#3451b2';
    ctx.font = 'bold ' + (14 * dpr) + 'px -apple-system, sans-serif';
    ctx.fillText('高性价比人生指南 · 第 ' + e.sec + ' 节第 ' + e.n + ' 条', 50 * dpr, 53 * dpr);

    // 标题
    ctx.fillStyle = dark ? '#fff' : '#1c1d21';
    ctx.font = 'bold ' + (19 * dpr) + 'px -apple-system, sans-serif';
    ctx.fillText(plain(e.title).slice(0, 24), 36 * dpr, 98 * dpr);

    // 人话核心区块
    const boxY = 126 * dpr, boxH = (lines.length * 36 + 46) * dpr;
    ctx.fillStyle = dark ? 'rgba(52,81,178,0.22)' : 'rgba(52,81,178,0.08)';
    ctx.beginPath(); ctx.roundRect(36 * dpr, boxY, W - 72 * dpr, boxH, 12 * dpr); ctx.fill();
    ctx.fillStyle = dark ? '#e6e9ff' : '#233876';
    ctx.font = 'bold ' + (17 * dpr) + 'px -apple-system, sans-serif';
    lines.forEach((l, idx) => ctx.fillText(l, 54 * dpr, boxY + (38 + idx * 36) * dpr));

    // 标签徽章
    let badgeX = 36 * dpr;
    const badgeY = boxY + boxH + 26 * dpr;
    const tags = [
      { t: '性价比 ' + e.ratio, bg: '#3451b2', c: '#fff' },
      { t: '证据 ' + e.grade + ' 级', bg: dark ? '#2a3b30' : '#e6f4ea', c: dark ? '#4ad991' : '#18794e' },
      { t: LENS_LABEL[e.lens] || e.lens || '实用', bg: dark ? '#333' : '#e5e7eb', c: dark ? '#ccc' : '#4b5563' }
    ];
    tags.forEach(tg => {
      ctx.font = 'bold ' + (12 * dpr) + 'px -apple-system, sans-serif';
      const tw = ctx.measureText(tg.t).width;
      ctx.fillStyle = tg.bg; ctx.beginPath(); ctx.roundRect(badgeX, badgeY, tw + 20 * dpr, 26 * dpr, 6 * dpr); ctx.fill();
      ctx.fillStyle = tg.c; ctx.fillText(tg.t, badgeX + 10 * dpr, badgeY + 18 * dpr);
      badgeX += tw + 26 * dpr;
    });

    // 成本注记
    ctx.fillStyle = dark ? '#888' : '#666';
    ctx.font = (13 * dpr) + 'px -apple-system, sans-serif';
    ctx.fillText('成本：' + plain(e.cost || '极低').slice(0, 32), 36 * dpr, badgeY + 52 * dpr);

    // 水印
    ctx.fillStyle = dark ? '#555' : '#aaa';
    ctx.font = (11 * dpr) + 'px -apple-system, sans-serif';
    ctx.fillText('用最少的钱、时间和精力，换回最多的寿命、金钱和人身自由', 36 * dpr, H - 36 * dpr);

    const actBar = h('div', { style: 'display:flex;gap:10px;justify-content:center;margin-top:10px' },
      h('button', { class: 'btn primary sm', on: { click: () => {
        const link = document.createElement('a');
        link.download = '高性价比指南-' + e.sec + '-' + e.n + '.png';
        link.href = canvas.toDataURL('image/png'); link.click();
        toast('卡片图片已开始下载');
      } } }, '下载图片')
    );
    wrap.append(canvas, tip, actBar);
    openModal('分享金句卡片', wrap);
  }
};

/* ================= 嵌入式计算器 ================= */
const Calculators = {
  // 1. 年化利率换算器 (5-7)
  aprCalc() {
    const box = h('div', { class: 'calc-box' });
    box.append(h('h4', {}, icon('calc'), '借钱真实年化利率换算器'));
    const form = h('div', { class: 'calc-form' });
    const inP = h('input', { type: 'number', value: '10000', step: '1000' });
    const inN = h('input', { type: 'number', value: '12', min: '1', max: '60' });
    const inFee = h('input', { type: 'number', value: '0.6', step: '0.05' });
    form.append(
      h('div', { class: 'calc-field' }, h('label', { text: '借款本金 (元)' }), inP),
      h('div', { class: 'calc-field' }, h('label', { text: '分期期数 (月)' }), inN),
      h('div', { class: 'calc-field' }, h('label', { text: '每期手续费率 (%)' }), inFee)
    );
    const res = h('div', { class: 'calc-result' });
    const update = () => {
      const P = +inP.value || 10000, n = +inN.value || 12, feePct = (+inFee.value || 0.6) / 100;
      const monthlyFee = P * feePct;
      const pmt = (P / n) + monthlyFee;
      // 牛顿法计算 IRR
      let r = feePct;
      for (let i = 0; i < 20; i++) {
        let f = pmt * (1 - Math.pow(1 + r, -n)) / r - P;
        let df = pmt * (- (1 - Math.pow(1 + r, -n)) / (r * r) + n * Math.pow(1 + r, -n - 1) / r);
        if (Math.abs(df) < 1e-8) break;
        let diff = f / df;
        r -= diff;
        if (Math.abs(diff) < 1e-6) break;
      }
      const apr = r * 12 * 100;
      const totalRepay = pmt * n;
      res.innerHTML = '每月还款：<b>¥' + pmt.toFixed(2) + '</b>（共还 ¥' + totalRepay.toFixed(2) + '）<br>真实单利年化利率 (APR)：<b>' + apr.toFixed(2) + '%</b><div class="calc-contrast">表面月费率看似只有 ' + (feePct * 100).toFixed(2) + '%，真实年化实际高达 <b>' + apr.toFixed(2) + '%</b>！相当于借款本金随着还款不断减少，但手续费却始终按初始全额在收。</div>';
    };
    inP.addEventListener('input', update); inN.addEventListener('input', update); inFee.addEventListener('input', update);
    update();
    box.append(form, res);
    return box;
  },
  // 2. 养老金估算与回本年限 (5-46)
  pensionCalc() {
    const box = h('div', { class: 'calc-box' });
    box.append(h('h4', {}, icon('calc'), '个人交职工养老金回本年限计算器'));
    const form = h('div', { class: 'calc-form' });
    const inWage = h('input', { type: 'number', value: '7000', step: '500' });
    const inIndex = h('select', {});
    inIndex.append(new Option('最低档 (60%)', '0.6'), new Option('标准档 (100%)', '1.0'), new Option('最高档 (300%)', '3.0'));
    const inYears = h('input', { type: 'number', value: '15', min: '15', max: '40' });
    form.append(
      h('div', { class: 'calc-field' }, h('label', { text: '当地社平工资 (元/月)' }), inWage),
      h('div', { class: 'calc-field' }, h('label', { text: '缴费档次' }), inIndex),
      h('div', { class: 'calc-field' }, h('label', { text: '累计缴费年限 (年)' }), inYears)
    );
    const res = h('div', { class: 'calc-result' });
    const update = () => {
      const W = +inWage.value || 7000, idx = +inIndex.value || 0.6, N = +inYears.value || 15;
      const basePay = W * (1 + idx) / 2 * N * 0.01;
      const personalAccount = (W * idx * 0.08) * 12 * N;
      const personalMonthly = personalAccount / 139; // 60岁退休 139 个月
      const totalMonthly = basePay + personalMonthly;
      const totalCost = (W * idx * 0.20) * 12 * N; // 灵活就业按 20%
      const payBackYears = totalCost / (totalMonthly * 12);
      res.innerHTML = '退休后预估每月领取：<b>¥' + totalMonthly.toFixed(1) + '</b>（基础 ¥' + basePay.toFixed(1) + ' + 个人账户 ¥' + personalMonthly.toFixed(1) + '）<br>灵活就业累计总缴费：<b>¥' + Math.round(totalCost) + '</b><br>预计领满 <b>' + payBackYears.toFixed(1) + ' 年</b> 即可收回全部缴费成本（之后纯赚）。<div class="calc-contrast">按 60% 最低档交 15 年的回本时间最短（约 9~10 年），档次越高，多交部分回本越慢。</div>';
    };
    inWage.addEventListener('input', update); inIndex.addEventListener('change', update); inYears.addEventListener('input', update);
    update();
    box.append(form, res);
    return box;
  },
  // 3. 裁员补偿金速算器 (19-6)
  severanceCalc() {
    const box = h('div', { class: 'calc-box' });
    box.append(h('h4', {}, icon('calc'), '离职经济补偿金速算器 (N / N+1)'));
    const form = h('div', { class: 'calc-form' });
    const inSalary = h('input', { type: 'number', value: '12000', step: '1000' });
    const inYears = h('input', { type: 'number', value: '3.5', step: '0.5' });
    const inAvg = h('input', { type: 'number', value: '8000', step: '500' });
    form.append(
      h('div', { class: 'calc-field' }, h('label', { text: '税前过去12个月平均工资 (元)' }), inSalary),
      h('div', { class: 'calc-field' }, h('label', { text: '在职工作年限 (年)' }), inYears),
      h('div', { class: 'calc-field' }, h('label', { text: '当地社平月工资 (元)' }), inAvg)
    );
    const res = h('div', { class: 'calc-result' });
    const update = () => {
      let sal = +inSalary.value || 12000, yr = +inYears.value || 3.5, avg = +inAvg.value || 8000;
      let capped = false;
      if (sal > avg * 3) { sal = avg * 3; capped = true; if (yr > 12) yr = 12; }
      let N = Math.floor(yr);
      const remain = yr - N;
      if (remain >= 0.5) N += 1;
      else if (remain > 0) N += 0.5;
      const compN = sal * N;
      const compN1 = compN + (+inSalary.value || 12000);
      const comp2N = compN * 2;
      res.innerHTML = '法定补偿基数 N：<b>' + N + ' 个月</b>' + (capped ? '（已触碰社平3倍封顶）' : '') + '<br>' +
        '协商解除 / 客观情况变化 (N)：<b>¥' + compN.toFixed(0) + '</b><br>' +
        '未提前30天书面通知解除 (N+1)：<b>¥' + compN1.toFixed(0) + '</b><br>' +
        '违法解除劳动合同 (2N 赔偿金)：<b>¥' + comp2N.toFixed(0) + '</b>';
    };
    inSalary.addEventListener('input', update); inYears.addEventListener('input', update); inAvg.addEventListener('input', update);
    update();
    box.append(form, res);
    return box;
  }
};

/* ================= 成就与里程碑系统 (Achievements) ================= */
const ACHIEVE_DEFS = [
  { id: 'first_step', name: '🎯 初试啼声', desc: '标记了第 1 条「已做到」' },
  { id: 'ratio_10', name: '⚡ 性价比学徒', desc: '完成 10 条「极高」性价比建议' },
  { id: 'ratio_30', name: '⚡ 极高践行者', desc: '完成 30 条「极高」性价比建议' },
  { id: 'health_10', name: '🏃 惜命如金', desc: '做到 10 条防早死或健康建议' },
  { id: 'law_5', name: '🛡️ 自由护盾', desc: '做到 5 条法律红线避坑条目' },
  { id: 'money_10', name: '💰 精打细算', desc: '做到 10 条省钱避坑建议' },
  { id: 'explorer_10', name: '🧭 游历全书', desc: '阅读浏览了 10 个以上不同章节' },
  { id: 'explorer_all', name: '📚 阅历通达', desc: '浏览过 30 个以上章节' },
  { id: 'done_50', name: '🥇 半百达成', desc: '累计做到 50 项建议' },
  { id: 'done_100', name: '🏆 百尺竿头', desc: '累计做到 100 项建议' },
  { id: 'voice_listener', name: '🎧 倾听之耳', desc: '使用过一次语音朗读' },
  { id: 'share_card', name: '🖼️ 渡人者', desc: '生成过一张金句分享卡片' }
];

const Achievements = {
  unlocked: new Set(LS.get('achievements', [])),
  unlock(id) {
    if (this.unlocked.has(id)) return;
    const def = ACHIEVE_DEFS.find((a) => a.id === id);
    if (!def) return;
    this.unlocked.add(id);
    LS.set('achievements', [...this.unlocked]);
    toast('🏆 解锁成就：' + def.name + '！');
  },
  check() {
    const doneList = [...S.done].map((k) => ITEMS.get(k)).filter(Boolean);
    if (doneList.length >= 1) this.unlock('first_step');
    if (doneList.length >= 50) this.unlock('done_50');
    if (doneList.length >= 100) this.unlock('done_100');
    const topRatio = doneList.filter((e) => e.ratio === '极高').length;
    if (topRatio >= 10) this.unlock('ratio_10');
    if (topRatio >= 30) this.unlock('ratio_30');
    const healthDone = doneList.filter((e) => e.sec === 1 || e.sec === 2).length;
    if (healthDone >= 10) this.unlock('health_10');
    const lawDone = doneList.filter((e) => e.sec === 8 || e.sec === 9).length;
    if (lawDone >= 5) this.unlock('law_5');
    const moneyDone = doneList.filter((e) => e.sec === 5 || e.sec === 7).length;
    if (moneyDone >= 10) this.unlock('money_10');
    const visitCount = Object.keys(S.visits).length;
    if (visitCount >= 10) this.unlock('explorer_10');
    if (visitCount >= 30) this.unlock('explorer_all');
  }
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
function applyFs() { document.documentElement.dataset.fs = S.fs; document.body.dataset.fs = S.fs; }

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

/* 通用模态弹窗 */
function openModal(title, contentNode) {
  $$('.modal').forEach((m) => m.remove());
  const mask = h('div', { class: 'modal', on: { click: (ev) => { if (ev.target === mask) mask.remove(); } } });
  const box = h('div', { class: 'box' });
  const head = h('div', { class: 'box-h' },
    h('b', { text: title }),
    h('button', { class: 'iconbtn', 'aria-label': '关闭', on: { click: () => mask.remove() } }, icon('close'))
  );
  const body = h('div', { class: 'box-b' }, contentNode);
  box.append(head, body);
  mask.append(box);
  document.body.append(mask);
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

  // 内嵌实用计算器
  if (e.sec === 5 && e.n === 7) box.append(Calculators.aprCalc());
  else if (e.sec === 5 && e.n === 46) box.append(Calculators.pensionCalc());
  else if (e.sec === 19 && e.n === 6) box.append(Calculators.severanceCalc());
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
  Achievements.check();
}
function actionsFor(e) {
  const k = e.sec + '-' + e.n;
  const speakText = '第 ' + e.sec + ' 节第 ' + e.n + ' 条：' + plain(e.title) + '。说人话：' + plain(e.human || e.title);
  const voiceBtn = h('button', { class: 'act voice', title: '语音朗读', 'aria-label': '语音朗读', on: { click: (ev) => { ev.stopPropagation(); TTS.speak(speakText, voiceBtn); } } }, icon('play'));
  const picBtn = h('button', { class: 'act pic', title: '生成卡片图', 'aria-label': '生成卡片图', on: { click: (ev) => { ev.stopPropagation(); CardGen.show(e); } } }, icon('image'));
  const calBtn = h('button', { class: 'act cal', title: '加入日历待办', 'aria-label': '加入日历待办', on: { click: (ev) => { ev.stopPropagation(); ICalGen.add(e); } } }, icon('calendar'));
  const bmBtn = h('button', { class: 'act book' + (S.bm.has(k) ? ' on' : ''), title: '收藏', 'aria-label': '收藏', on: { click: (ev) => { ev.stopPropagation(); toggleBm(e, bmBtn); } } }, icon(S.bm.has(k) ? 'bmf' : 'bm'));
  const dnBtn = h('button', { class: 'act' + (S.done.has(k) ? ' on' : ''), title: '记为已做到', 'aria-label': '记为已做到', on: { click: (ev) => { ev.stopPropagation(); toggleDone(e, dnBtn); } } }, icon(S.done.has(k) ? 'doneall' : 'done'));
  return h('div', { class: 'entry-actions' }, voiceBtn, picBtn, calBtn, bmBtn, dnBtn);
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

  // 突发情境横向滚动条
  const sitScroll = h('div', { class: 'sit-scroll' }, SITUATIONS.map((s) =>
    h('a', { class: 'sit-card', href: '#/situation/' + s.id },
      h('div', { class: 'sit-ico' }, icon(s.icon || 'fire')),
      h('b', { text: s.title }),
      h('small', { text: s.desc })
    )
  ));

  // 精选路径与新工具网格
  const featureList = h('div', { class: 'melist' },
    h('a', { class: 'mi', href: '#/paths' },
      h('span', { class: 'ico' }, icon('compass')),
      h('span', { class: 'tx' }, h('b', { text: '精选阅读路径' }), h('small', { text: '极简10条 · 0成本高收益 · 一次办完 · 打工人防身' })),
      icon('right')),
    h('a', { class: 'mi', href: '#/timeline' },
      h('span', { class: 'ico' }, icon('timeline')),
      h('span', { class: 'tx' }, h('b', { text: '人生事件时间线' }), h('small', { text: '18岁 ~ 60岁+ 不同人生阶段的攻防底线' })),
      icon('right')),
    h('a', { class: 'mi', href: '#/tools' },
      h('span', { class: 'ico' }, icon('calc')),
      h('span', { class: 'tx' }, h('b', { text: '实用速算工具箱' }), h('small', { text: '真实年化利率换算 · 养老金回本年限 · 离职经济补偿金' })),
      icon('right')),
    h('a', { class: 'mi', href: '#/zen' },
      h('span', { class: 'ico' }, icon('zen')),
      h('span', { class: 'tx' }, h('b', { text: '「说人话」大字报模式' }), h('small', { text: '极简沉浸式刷卡，适合大字阅读与老年读者' })),
      icon('right')),
    h('a', { class: 'mi', href: '#/graph' },
      h('span', { class: 'ico' }, icon('graph')),
      h('span', { class: 'tx' }, h('b', { text: '全书交叉引用关系图谱' }), h('small', { text: '力导向动态网络，直观探索全书条目关联' })),
      icon('right')),
    h('a', { class: 'mi', href: '#/glossary' },
      h('span', { class: 'ico' }, icon('bulb')),
      h('span', { class: 'tx' }, h('b', { text: '术语表 · 读懂数字' }), h('small', { text: d.glossary.length + ' 个统计与制度名词（HR/RR/LPR/门慢等）' })),
      icon('right'))
  );

  const nodes = [
    hero,
    h('div', { class: 'section-title' }, h('h2', { text: '突发情境急救指引' }), h('a', { class: 'more', href: '#/situations', text: '全部情境' })),
    sitScroll,
    h('div', { class: 'section-title' }, h('h2', { text: '专项路径与交互工具' })),
    featureList,
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
        h('div', { style: 'margin-top:10px;font-size:.84375rem' }, '换个词，或点「筛选」放宽条件。')));
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

  const myTools = h('div', { class: 'melist' },
    h('a', { class: 'mi', href: '#/dashboard' },
      h('span', { class: 'ico' }, icon('chart')),
      h('span', { class: 'tx' }, h('b', { text: '个人攻防仪表盘' }), h('small', { text: '六维攻防雷达图 · 查看各维度防御短板' })),
      icon('right')),
    h('a', { class: 'mi', href: '#/achievements' },
      h('span', { class: 'ico' }, icon('trophy')),
      h('span', { class: 'tx' }, h('b', { text: '成就勋章墙' }), h('small', { text: '已点亮 ' + Achievements.unlocked.size + ' / ' + ACHIEVE_DEFS.length + ' 个勋章' })),
      icon('right')),
    h('a', { class: 'mi', href: '#/tools' },
      h('span', { class: 'ico' }, icon('calc')),
      h('span', { class: 'tx' }, h('b', { text: '实用速算工具箱' }), h('small', { text: '真实年化利率换算 · 养老金回本年限 · 离职经济补偿金' })),
      icon('right')),
    h('a', { class: 'mi', href: '#/graph' },
      h('span', { class: 'ico' }, icon('graph')),
      h('span', { class: 'tx' }, h('b', { text: '全书交叉引用关系图谱' }), h('small', { text: '力导向动态网络，直观探索全书条目关联' })),
      icon('right')),
    h('a', { class: 'mi', href: '#/zen' },
      h('span', { class: 'ico' }, icon('zen')),
      h('span', { class: 'tx' }, h('b', { text: '「说人话」大字报模式' }), h('small', { text: '沉浸刷卡与长辈友好超大字号' })),
      icon('right'))
  );
  nodes.push(h('div', { class: 'section-title' }, h('h2', { text: '我的工具与成就' })), myTools);

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

/* ================= 人生事件时间线 (Timeline) ================= */
const TIMELINE_STAGES = [
  { id: '18', age: '18~22岁', title: '升学初涉世', desc: '成年法纪、防兼职陷阱、个人隐私与账号安全', secs: [1, 9, 11, 14, 31] },
  { id: '25', age: '23~28岁', title: '步入职场', desc: '职场防身、租房签约、借贷征信、体能维持', secs: [2, 5, 9, 15, 19] },
  { id: '30', age: '29~34岁', title: '成家立业', desc: '恋爱结婚账、买房决策、备孕生育、大额支出防坑', secs: [5, 10, 15, 18, 20, 27] },
  { id: '35', age: '35~45岁', title: '中流砥柱', desc: '35岁职场防线、健康筛查、慢病预防、照顾父母', secs: [1, 2, 5, 16, 17, 19] },
  { id: '50', age: '46~59岁', title: '稳健过渡', desc: '更年期评估、骨质疏松、养老储备、防重大意外', secs: [1, 2, 5, 16, 24] },
  { id: '60', age: '60岁以上', title: '银发安度', desc: '防跌倒、医保报销、防诈骗、意定监护、重疾处理', secs: [1, 8, 9, 17, 24, 25] }
];
let curTlStage = '25';
function renderTimeline() {
  const tabs = h('div', { class: 'timeline-tabs' }, TIMELINE_STAGES.map((s) => {
    const b = h('button', { class: 'tl-btn' + (s.id === curTlStage ? ' on' : ''), text: s.age });
    b.addEventListener('click', () => { curTlStage = s.id; renderTimeline(); });
    return b;
  }));
  const cur = TIMELINE_STAGES.find((s) => s.id === curTlStage) || TIMELINE_STAGES[0];
  const list = S.data.sections
    .filter((s) => cur.secs.includes(s.n))
    .flatMap((s) => s.entries)
    .sort((a, b) => (a.ratio === '极高' ? -1 : 1));

  setView(
    pageHead('时间线', '#/', cur.age + ' · ' + cur.title),
    h('p', { class: 'intro', text: cur.desc + '。优先展示极高性价比建议：' }),
    tabs,
    h('div', { class: 'section-title' }, h('h2', { text: '关键备选条目（' + list.length + ' 项）' })),
    ...list.map((e) => entryCard(e, []))
  );
}

/* ================= 情境快速通道 (Situations) ================= */
const SITUATIONS = [
  {
    id: 'layoff',
    icon: 'fire',
    title: '刚被裁员 / 面临辞退',
    desc: '稳住情绪，不要急着在任何离职文件上签字',
    steps: [
      { title: '第一步：绝不签「因个人原因主动辞职」', desc: '一旦签了主动辞职，经济补偿金和失业保险金全泡汤。只签协商解除或注明公司单方解除。', sec: 19, n: 5 },
      { title: '第二步：核算你的法定经济补偿 (N 或 N+1)', desc: '按过去12个月税前应发平均工资计算，满半年算一年，未提前30天书面通知另加1个月代通知金。', sec: 19, n: 6 },
      { title: '第三步：办理失业登记，申领失业保险金', desc: '非因本人意愿中断就业即可申领，各地标准约当地最低工资的80%~90%，领金期间社保由失业基金代缴医保！', sec: 7, n: 10 },
      { title: '第四步：衔接医疗保险，防断缴生病风险', desc: '辞职后医保次月失效，尽快办理灵活就业医保或城乡居民医保，避免意外重疾一夜致贫。', sec: 7, n: 1 }
    ],
    docSlug: '被裁了之后先做什么'
  },
  {
    id: 'chronic',
    icon: 'health',
    title: '刚确诊慢性病',
    desc: '别慌，慢性病是长跑，先办好政策待遇再调心态',
    steps: [
      { title: '第一步：去医院医保办申请「门诊慢特病」', desc: '高血压、糖尿病、乙肝、痛风等几十种慢病可以走门慢，门诊开药大幅提高报销比例，不用住院也能报。', sec: 16, n: 1 },
      { title: '第二步：申请开具「长期处方」（1~3个月药量）', desc: '病情稳定后要求开长处方，不用两周跑一次医院排队挂号，省出大量时间与挂号费。', sec: 16, n: 3 },
      { title: '第三步：拒绝任何昂贵偏方神医与保健品', desc: '没有任何保健品能逆转糖尿病或高血压，按指南规范吃基药，每月几十块钱就能控制好。', sec: 16, n: 4 },
      { title: '第四步：做好终身共处的心理与习惯调整', desc: '把吃药当成刷牙一样的日常例行事，不要有病耻感。', sec: 2, n: 1 }
    ],
    docSlug: '刚确诊慢性病之后'
  },
  {
    id: 'baby',
    icon: 'health',
    title: '刚怀孕 / 家有新生儿',
    desc: '新生命降临前的关键硬核避险与权益',
    steps: [
      { title: '第一步：孕期合规产检与生育津贴申报', desc: '了解女职工产假、产检假与生育保险报销规则，留存全套诊断证明。', sec: 27, n: 1 },
      { title: '第二步：出生后尽快办理「新生儿医保落地」', desc: '出生数月内参保可追溯报销自出生之日起的所有住院医疗费，防新生儿重症ICU巨额自费。', sec: 20, n: 2 },
      { title: '第三步：严格按国家免疫规划打齐疫苗', desc: '一类免费疫苗必须按时接种，二类自费疫苗优先考虑流脑、肺炎、水痘。', sec: 20, n: 5 },
      { title: '第四步：车上务必安装反向儿童安全座椅', desc: '大人抱着孩子坐车相当于肉垫，安全座椅能降低七成婴儿严重车祸死亡率。', sec: 1, n: 2 }
    ],
    docSlug: '孩子出生前后要办的事'
  },
  {
    id: 'passed',
    icon: 'shield',
    title: '亲人去世 / 离世后善后',
    desc: '人走了以后要办什么，防诈防坑',
    steps: [
      { title: '第一步：第一时间去医院或公安开具死亡证明', desc: '这是后续所有销户、继承、取钱的唯一法定起点凭证，多复印几十份备用。', sec: 25, n: 1 },
      { title: '第二步：切勿急于注销老人手机号与银行卡', desc: '保留手机号收验证码，查清银行账户、保险理赔、微信支付宝余额前别注销。', sec: 25, n: 2 },
      { title: '第三步：申领丧葬补助金与抚恤金', desc: '参加城镇职工基本养老保险的人员死亡后，遗属可以申领丧葬补助金和抚恤金。', sec: 25, n: 3 }
    ],
    docSlug: '人走了以后要办什么'
  },
  {
    id: 'scam',
    icon: 'shield',
    title: '疑似被骗 / 遭遇诈骗',
    desc: '遭遇电信网络诈骗或非法集资的紧急阻断',
    steps: [
      { title: '第一步：黄金半小时内拨打 110 或 96110 止付', desc: '提供对方银行卡号、姓名，警方反诈中心有快速冻结通道，迟一小时钱就被洗散。', sec: 13, n: 1 },
      { title: '第二步：不要相信任何「黑客追讨」或「法律维权退费」', desc: '网上自称能帮你追回被骗款项的，100%是二次诈骗，再次扒你一层皮。', sec: 5, n: 2 },
      { title: '第三步：保全完整截图、转账流水去派出所做笔录', desc: '打印所有银行电子回单、聊天记录，务必拿到受案回执或立案告知书。', sec: 9, n: 1 }
    ]
  },
  {
    id: 'borrow',
    icon: 'money',
    title: '亲友借钱 / 找我担保',
    desc: '守护血汗钱与人身自由的生死线',
    steps: [
      { title: '第一步：绝对不要给人做「连带责任保证」', desc: '签了连带保证，债务人跑路法院直接封你的房产和银行卡，替别人背一辈子债。', sec: 8, n: 1 },
      { title: '第二步：借钱必须写规范借条并银行转账留痕', desc: '写明「借条」而非欠条，身份证号、大写金额、明确还款日，微信现金转账一定要备注借款。', sec: 8, n: 2 },
      { title: '第三步：换算民间借贷利率法定保护上限', desc: '民间借贷利率不得超过 1 年期 LPR 的 4 倍，超出部分法律不予支持。', sec: 5, n: 7 }
    ]
  },
  {
    id: 'car_accident',
    icon: 'health',
    title: '出了车祸 / 交通意外',
    desc: '在事故现场怎么自保与定责理赔',
    steps: [
      { title: '第一步：车靠边、人撤离、即报警，防二次事故', desc: '高速或快车道发生事故，立即放三角牌，所有人撤到护栏外，切忌在路上争吵拍照。', sec: 1, n: 1 },
      { title: '第二步：拍照存证双方车辆受损与标线位置', desc: '四个方向全景、刹车痕迹、碰撞接触部位清晰拍照。', sec: 13, n: 4 },
      { title: '第三步：绝不轻易垫付大额医药费，通知三者险介入', desc: '对方伤情走交强险垫付或商业三者险直赔，个人垫付后续索赔极难。', sec: 5, n: 1 }
    ]
  }
];
function renderSituations(id) {
  if (id) {
    const sit = SITUATIONS.find((s) => s.id === id);
    if (!sit) { render404(); return; }
    const nodes = [pageHead('情境快速通道', '#/situations', sit.title), h('p', { class: 'intro', text: sit.desc })];
    const stepsEl = h('div', { class: 'steps-wrap' }, sit.steps.map((st, i) => {
      const e = ITEMS.get(st.sec + '-' + st.n);
      return h('div', { class: 'step-card' },
        h('div', { class: 'step-num', text: String(i + 1) }),
        h('div', { class: 'step-body' },
          h('h3', { text: st.title }),
          h('p', { style: 'font-size:.875rem;color:var(--t2);line-height:1.6;margin-bottom:8px', text: st.desc }),
          e ? h('div', { style: 'margin-top:8px' }, entryCard(e, [])) : null
        )
      );
    }));
    nodes.push(stepsEl);
    if (sit.docSlug) {
      nodes.push(h('div', { class: 'section-title' }, h('h2', { text: '深度长文参考' })),
        h('div', { class: 'melist' },
          h('a', { class: 'mi', href: '#/doc/' + encodeURIComponent(sit.docSlug) },
            h('span', { class: 'ico' }, icon('book')),
            h('span', { class: 'tx' }, h('b', { text: sit.docSlug })),
            icon('right')
          )
        )
      );
    }
    setView(...nodes);
    return;
  }
  const list = h('div', { class: 'melist' }, SITUATIONS.map((s) =>
    h('a', { class: 'mi', href: '#/situation/' + s.id },
      h('span', { class: 'ico' }, icon(s.icon || 'fire')),
      h('span', { class: 'tx' }, h('b', { text: s.title }), h('small', { text: s.desc })),
      icon('right')
    )
  ));
  setView(pageHead('情境快速通道', '#/', '突发情境急救指引'), h('p', { class: 'intro', text: '人在慌乱中容易做错决定。挑出你眼前最紧急的处境，按步骤做：' }), list);
}

/* ================= 精选阅读路径 (Paths) ================= */
const CURATED_PATHS = [
  {
    id: 'top10',
    title: '🚀 极简10条：最值得做的10件事',
    desc: '全书性价比最高、收益最大、执行成本最低的 10 个建议。做完这 10 件，就已经跑赢了绝大多数人。',
    keys: ['1-1', '1-2', '1-10', '2-1', '2-6', '5-7', '5-46', '7-1', '8-1', '19-5']
  },
  {
    id: 'free',
    title: '💰 一毛不拔：0元高收益清单',
    desc: '一分钱不花，全靠知晓制度常识或改掉一个动作，换回巨大的寿命、金钱与自由保障。',
    keys: ['1-1', '1-5', '1-12', '2-7', '3-1', '5-7', '7-10', '8-1', '9-5', '19-6']
  },
  {
    id: 'once',
    title: '⚡ 一次办完：终身受用无需毅力',
    desc: '做一次就能长期发挥作用，完全不需要长期自律对抗惯性（毅力=否）。',
    keys: ['1-3', '1-4', '1-14', '5-39', '5-44', '7-1', '14-1', '14-5', '17-1', '20-2']
  },
  {
    id: 'worker',
    title: '🛡️ 打工人自卫线：职场防坑与维权',
    desc: '关于入职试用期、加班证据、裁员补偿 N+1、工伤认定的硬核法条底线。',
    keys: ['19-1', '19-2', '19-5', '19-6', '19-7', '19-10', '19-13', '7-10', '9-1']
  },
  {
    id: 'senior',
    title: '👴 银发无忧：给父母的晚年防线',
    desc: '60岁以上老人最容易中招的跌倒、假药、保健品骗局、医保异地备案与意定监护。',
    keys: ['1-39', '1-40', '5-42', '6-10', '17-1', '17-2', '17-5', '24-1', '24-3']
  }
];
function renderPaths(id) {
  if (id) {
    const p = CURATED_PATHS.find((x) => x.id === id);
    if (!p) { render404(); return; }
    const entries = p.keys.map((k) => ITEMS.get(k)).filter(Boolean);
    const doneCount = entries.filter((e) => S.done.has(e.sec + '-' + e.n)).length;
    const pct = Math.round(doneCount / entries.length * 100);
    const progBar = h('div', { class: 'path-progress', style: 'margin:12px 0 20px' },
      h('span', { text: '已做到 ' + doneCount + ' / ' + entries.length + ' (' + pct + '%)' }),
      h('div', { class: 'bar' }, h('div', { class: 'fill', style: 'width:' + pct + '%' }))
    );
    setView(
      pageHead('精选路径', '#/paths', p.title),
      h('p', { class: 'intro', text: p.desc }),
      progBar,
      ...entries.map((e) => entryCard(e, []))
    );
    return;
  }
  const grid = h('div', { class: 'paths-grid' }, CURATED_PATHS.map((p) => {
    const entries = p.keys.map((k) => ITEMS.get(k)).filter(Boolean);
    const doneCount = entries.filter((e) => S.done.has(e.sec + '-' + e.n)).length;
    const pct = Math.round(doneCount / entries.length * 100);
    return h('a', { class: 'path-card', href: '#/path/' + p.id },
      h('div', { class: 'h' }, h('b', { text: p.title })),
      h('p', { text: p.desc }),
      h('div', { class: 'path-progress' },
        h('span', { text: doneCount + '/' + entries.length }),
        h('div', { class: 'bar' }, h('div', { class: 'fill', style: 'width:' + pct + '%' }))
      )
    );
  }));
  setView(pageHead('精选路径', '#/', '精选阅读路径'), h('p', { class: 'intro', text: '690 条太多不知道从哪看？挑一条适合你当前生活重心的路径开始：' }), grid);
}

/* ================= 独立计算器中心 (Tools) ================= */
function renderTools() {
  Achievements.unlock('calc_used');
  setView(
    pageHead('计算器', '#/', '实用速算工具箱'),
    h('p', { class: 'intro', text: '书中涉及复杂算账的条目，提供免心算交互小工具：' }),
    Calculators.aprCalc(),
    Calculators.pensionCalc(),
    Calculators.severanceCalc()
  );
}

/* ================= 个人仪表盘 (Dashboard & Radar) ================= */
const RADAR_DIMS = [
  { name: '寿命防猝死', secs: [1, 13] },
  { name: '日常健康', secs: [2, 16, 24, 34] },
  { name: '时间精力', secs: [3, 4, 22] },
  { name: '金钱防坑', secs: [5, 7, 12, 15] },
  { name: '人身自由', secs: [8, 9, 11, 14] },
  { name: '家庭发展', secs: [10, 17, 18, 19, 20, 27, 30, 31] }
];
function renderDashboard() {
  const dimStats = RADAR_DIMS.map((d) => {
    const entries = S.data.sections.filter((s) => d.secs.includes(s.n)).flatMap((s) => s.entries);
    const done = entries.filter((e) => S.done.has(e.sec + '-' + e.n)).length;
    const score = Math.min(1, done / Math.max(8, entries.length * 0.12)); // 标尺基准
    return { name: d.name, total: entries.length, done, score };
  });

  // SVG 六边形雷达图
  const R = 100, cx = 150, cy = 135;
  const num = RADAR_DIMS.length;
  const polyPoints = (r) => {
    return Array.from({ length: num }, (_, i) => {
      const angle = (Math.PI * 2 / num) * i - Math.PI / 2;
      return (cx + r * Math.cos(angle)).toFixed(1) + ',' + (cy + r * Math.sin(angle)).toFixed(1);
    }).join(' ');
  };
  const dataPoints = dimStats.map((d, i) => {
    const angle = (Math.PI * 2 / num) * i - Math.PI / 2;
    const r = Math.max(15, R * d.score);
    return (cx + r * Math.cos(angle)).toFixed(1) + ',' + (cy + r * Math.sin(angle)).toFixed(1);
  }).join(' ');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 300 270');
  svg.setAttribute('class', 'radar-svg');
  svg.innerHTML = `
    <polygon points="${polyPoints(R)}" fill="none" stroke="var(--divider)" stroke-width="1"/>
    <polygon points="${polyPoints(R * 0.66)}" fill="none" stroke="var(--divider-soft)" stroke-width="1"/>
    <polygon points="${polyPoints(R * 0.33)}" fill="none" stroke="var(--divider-soft)" stroke-width="1"/>
    <polygon points="${dataPoints}" fill="var(--brand-soft)" stroke="var(--brand-1)" stroke-width="2.5"/>
  `;
  // 文字标签
  dimStats.forEach((d, i) => {
    const angle = (Math.PI * 2 / num) * i - Math.PI / 2;
    const tx = cx + (R + 24) * Math.cos(angle);
    const ty = cy + (R + 18) * Math.sin(angle);
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', tx); t.setAttribute('y', ty);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'central');
    t.setAttribute('fill', 'var(--t2)');
    t.setAttribute('font-size', '11');
    t.textContent = d.name;
    svg.append(t);
  });

  const radarCard = h('div', { class: 'radar-card' },
    h('b', { style: 'font-size:1.0625rem;display:block;margin-bottom:12px', text: '个人六维防御雷达图' }),
    svg,
    h('small', { style: 'color:var(--t3);display:block;margin-top:8px', text: '基于你在各维度标记「已做到」的覆盖程度动态计算' })
  );

  const defGrid = h('div', { class: 'defense-grid' }, dimStats.map((d) =>
    h('div', { class: 'def-item' },
      h('div', { class: 'h' }, h('span', { text: d.name }), h('span', { style: 'color:var(--brand-1)', text: '已做到 ' + d.done + ' 条' })),
      h('div', { class: 'bar' }, h('div', { class: 'fill', style: 'width:' + Math.round(d.score * 100) + '%' }))
    )
  ));

  setView(
    pageHead('仪表盘', '#/me', '个人防线仪表盘'),
    radarCard,
    h('div', { class: 'section-title' }, h('h2', { text: '各维度攻防详情' })),
    defGrid,
    h('div', { style: 'margin-top:20px;text-align:center' },
      h('a', { class: 'btn primary sm', href: '#/achievements', text: '查看我的成就与勋章墙' })
    )
  );
}

/* ================= 成就勋章墙 (Achievements) ================= */
function renderAchievements() {
  const grid = h('div', { class: 'achieve-grid' }, ACHIEVE_DEFS.map((a) => {
    const isUnlocked = Achievements.unlocked.has(a.id);
    return h('div', { class: 'achieve-item ' + (isUnlocked ? 'unlocked' : 'locked') },
      h('div', { class: 'achieve-icon', text: a.name.split(' ')[0] }),
      h('div', { class: 'achieve-name', text: a.name.split(' ')[1] || a.name }),
      h('div', { class: 'achieve-desc', text: a.desc })
    );
  }));
  const count = Achievements.unlocked.size;
  setView(
    pageHead('成就', '#/me', '成就勋章墙'),
    h('p', { class: 'intro', text: '已点亮 ' + count + ' / ' + ACHIEVE_DEFS.length + ' 个勋章。知识变成行动，才能守护生活。' }),
    grid
  );
}

/* ================= 大字报模式 (Zen Mode) ================= */
let curZenIdx = 0;
function renderZenMode(sec, n) {
  const all = S.data.sections.flatMap((s) => s.entries);
  if (sec && n) {
    const found = all.findIndex((e) => e.sec === +sec && e.n === +n);
    if (found !== -1) curZenIdx = found;
  }
  if (curZenIdx < 0 || curZenIdx >= all.length) curZenIdx = 0;
  const e = all[curZenIdx];
  const isDone = S.done.has(e.sec + '-' + e.n);

  const card = h('div', { class: 'zen-card' },
    h('div', { style: 'display:flex;justify-content:space-between;align-items:center' },
      h('span', { class: 'zen-tag', text: '第 ' + e.sec + ' 节第 ' + e.n + ' 条 · 性价比 ' + e.ratio }),
      h('button', { class: 'iconbtn', title: '语音朗读', on: { click: (ev) => TTS.speak(plain(e.human || e.title), ev.currentTarget) } }, icon('play'))
    ),
    h('div', { class: 'zen-title', text: plain(e.title) }),
    h('div', { class: 'zen-human', text: plain(e.human || e.title) }),
    h('div', { style: 'font-size:.9375rem;color:var(--t2)' }, '成本：' + plain(e.cost || '极低')),
    h('div', { class: 'zen-controls' },
      h('button', { class: 'btn ghost zen-nav-btn', on: { click: () => { curZenIdx = (curZenIdx - 1 + all.length) % all.length; renderZenMode(); } } }, '👈 上一条'),
      h('button', { class: 'btn primary zen-nav-btn' + (isDone ? ' ghost' : ''), on: { click: (ev) => { toggleDone(e, ev.currentTarget); setTimeout(renderZenMode, 300); } } }, isDone ? '已做到 ✓' : '标记已做到'),
      h('button', { class: 'btn ghost zen-nav-btn', on: { click: () => { curZenIdx = Math.floor(Math.random() * all.length); renderZenMode(); } } }, '🎲 随便换一条'),
      h('button', { class: 'btn ghost zen-nav-btn', on: { click: () => { curZenIdx = (curZenIdx + 1) % all.length; renderZenMode(); } } }, '👉 下一条')
    )
  );

  setView(
    pageHead('大字报', '#/', '沉浸刷卡模式 (' + (curZenIdx + 1) + ' / ' + all.length + ')'),
    h('div', { class: 'zen-wrap' }, card)
  );
}

/* ================= 条目关系图谱 (Graph) ================= */
function renderGraph() {
  const container = h('div', { class: 'graph-container' });
  const canvas = h('canvas', { class: 'graph-canvas' });
  const tip = h('div', { class: 'graph-tip', text: '拖拽视野或点击节点查看条目。滚轮或双指可自由缩放。' });

  // 浮动控制工具栏（放大、缩小、重置、全屏）
  const tools = h('div', { class: 'graph-tools' });
  const btnZoomIn = h('button', { class: 'graph-btn', title: '放大', 'aria-label': '放大' }, icon('plus'));
  const btnZoomOut = h('button', { class: 'graph-btn', title: '缩小', 'aria-label': '缩小' }, icon('minus'));
  const btnReset = h('button', { class: 'graph-btn', title: '重置视图', 'aria-label': '重置视图' }, icon('refresh'));
  const btnFs = h('button', { class: 'graph-btn', title: '全屏模式', 'aria-label': '全屏模式' }, icon('expand'));
  tools.append(btnZoomIn, btnZoomOut, btnReset, btnFs);
  container.append(canvas, tools, tip);

  setView(
    pageHead('图谱', '#/', '全书交叉引用关系图谱'),
    h('p', { class: 'intro', text: '全书 690 条建议并非孤立存在，红线与出路、医疗与工伤在此交织成网：' }),
    container
  );

  // 初始化 Canvas 关系力导向图
  requestAnimationFrame(() => {
    let W = container.clientWidth || 600, H = container.clientHeight || 560;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      W = container.clientWidth || 600; H = container.clientHeight || 560;
      canvas.width = W * dpr; canvas.height = H * dpr;
    };
    window.addEventListener('resize', resize);

    // 全屏切换
    const toggleFullscreen = () => {
      const isFs = container.classList.toggle('fullscreen');
      const svg = btnFs.querySelector('svg');
      if (svg) svg.innerHTML = '<path d="' + (isFs ? ICONS.compress : ICONS.expand) + '"/>';
      btnFs.title = isFs ? '退出全屏' : '全屏模式';
      if (isFs && container.requestFullscreen) {
        container.requestFullscreen().catch(() => {});
      } else if (!isFs && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setTimeout(resize, 100);
    };
    btnFs.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && container.classList.contains('fullscreen')) {
        container.classList.remove('fullscreen');
        const svg = btnFs.querySelector('svg');
        if (svg) svg.innerHTML = '<path d="' + ICONS.expand + '"/>';
        btnFs.title = '全屏模式';
        setTimeout(resize, 100);
      }
    });

    // 筛选有引用的前 120 个核心条目节点
    const nodes = [];
    const nodeMap = new Map();
    const links = [];
    const all = S.data.sections.flatMap((s) => s.entries);
    for (const e of all.slice(0, 120)) {
      if (!e.gain && !e.note) continue;
      const key = e.sec + '-' + e.n;
      const nObj = { id: key, sec: e.sec, n: e.n, title: plain(e.title), x: W / 2 + (Math.random() - 0.5) * 320, y: H / 2 + (Math.random() - 0.5) * 260, vx: 0, vy: 0, r: e.ratio === '极高' ? 12 : 8 };
      nodes.push(nObj);
      nodeMap.set(key, nObj);
    }
    // 建立连线
    for (const n of nodes) {
      const e = ITEMS.get(n.id);
      if (!e) continue;
      const text = (e.gain || '') + ' ' + (e.note || '');
      XREF_RE.lastIndex = 0; let m;
      while ((m = XREF_RE.exec(text))) {
        const keys = xrefKeys(m[1] ?? String(e.sec), m[2] ?? m[3] ?? m[4] ?? '');
        for (const k of keys) {
          if (nodeMap.has(k) && k !== n.id) links.push({ s: n, t: nodeMap.get(k) });
        }
      }
    }

    let scale = 1, panX = 0, panY = 0, dragging = false, lastX = 0, lastY = 0, dragDist = 0;
    let animId = null, step = 0;
    let touchDistance = 0;

    const tick = () => {
      if (step < 80) {
        // 力导向物理迭代
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j];
            let dx = b.x - a.x, dy = b.y - a.y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < 130) {
              let f = (130 - dist) / dist * 0.08;
              a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f;
            }
          }
        }
        for (const l of links) {
          let dx = l.t.x - l.s.x, dy = l.t.y - l.s.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          let f = (dist - 70) * 0.02;
          l.s.vx += dx / dist * f; l.s.vy += dy / dist * f;
          l.t.vx -= dx / dist * f; l.t.vy -= dy / dist * f;
        }
        for (const n of nodes) {
          n.x += n.vx; n.y += n.vy;
          n.vx *= 0.84; n.vy *= 0.84;
        }
        step++;
      }

      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.translate(panX, panY);
      ctx.scale(scale, scale);

      // 连线
      ctx.strokeStyle = document.documentElement.classList.contains('dark') ? 'rgba(255,255,255,0.13)' : 'rgba(52,81,178,0.15)';
      ctx.lineWidth = 1;
      for (const l of links) {
        ctx.beginPath(); ctx.moveTo(l.s.x, l.s.y); ctx.lineTo(l.t.x, l.t.y); ctx.stroke();
      }
      // 节点
      for (const n of nodes) {
        ctx.fillStyle = n.r >= 12 ? '#3451b2' : '#18794e';
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#ccc' : '#444';
        ctx.font = '10px sans-serif';
        ctx.fillText(n.title.slice(0, 7), n.x + n.r + 3, n.y + 3);
      }
      ctx.restore();
      animId = requestAnimationFrame(tick);
    };
    tick();

    // 缩放函数（以任意点为中心缩放）
    const zoomAt = (centerX, centerY, factor) => {
      const nextScale = Math.max(0.25, Math.min(5.0, scale * factor));
      if (nextScale === scale) return;
      panX = centerX - (centerX - panX) * (nextScale / scale);
      panY = centerY - (centerY - panY) * (nextScale / scale);
      scale = nextScale;
    };

    // 滚轮缩放：必须阻止默认页面滚动行为
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      zoomAt(mx, my, factor);
    }, { passive: false });

    // 工具栏缩放按钮（以画布中心为锚点）
    btnZoomIn.addEventListener('click', () => zoomAt(W / 2, H / 2, 1.25));
    btnZoomOut.addEventListener('click', () => zoomAt(W / 2, H / 2, 0.8));
    btnReset.addEventListener('click', () => { scale = 1; panX = 0; panY = 0; });

    // 鼠标拖拽平移与点击
    canvas.addEventListener('mousedown', (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY; dragDist = 0;
    });
    window.addEventListener('mouseup', () => { dragging = false; });
    canvas.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      panX += dx; panY += dy;
      dragDist += Math.abs(dx) + Math.abs(dy);
      lastX = e.clientX; lastY = e.clientY;
    });

    // 节点点击识别（拖动距离小于 6px 视为点击）
    canvas.addEventListener('click', (e) => {
      if (dragDist > 6) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - panX) / scale;
      const my = (e.clientY - rect.top - panY) / scale;
      const clicked = nodes.find((n) => Math.hypot(n.x - mx, n.y - my) <= n.r + 6);
      if (clicked) {
        const item = ITEMS.get(clicked.id);
        tip.innerHTML = '<b>' + clicked.id + ' ' + clicked.title + '</b> · ' + plain(item ? item.human : '') +
          ' <a class="btn primary sm" style="margin-left:10px" href="#/e/' + clicked.sec + '/' + clicked.n + '">查看详情</a>';
      }
    });

    // 移动端手势（单指平移、双指缩放）
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        dragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; dragDist = 0;
      } else if (e.touches.length === 2) {
        dragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchDistance = Math.hypot(dx, dy);
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && dragging) {
        const dx = e.touches[0].clientX - lastX, dy = e.touches[0].clientY - lastY;
        panX += dx; panY += dy;
        dragDist += Math.abs(dx) + Math.abs(dy);
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (touchDistance > 0) {
          const rect = canvas.getBoundingClientRect();
          const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
          const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
          zoomAt(cx, cy, dist / touchDistance);
        }
        touchDistance = dist;
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) dragging = false;
    });
  });
}

/* ================= 术语表页 ================= */
function renderGlossary() {
  const list = h('div', { class: 'melist' }, S.data.glossary.map((g) =>
    h('div', { class: 'mi', style: 'align-items:flex-start' },
      h('span', { class: 'tx' }, h('b', { text: g.term }), h('small', { style: 'font-size:.84375rem;line-height:1.7;margin-top:3px', text: g.meaning })))));
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
  const showBack = route.name === 'entry' || route.name === 'doc' || route.name === 'glossary' || route.name === 'situation' || route.name === 'path' || route.name === 'dashboard' || route.name === 'achievements' || route.name === 'tools' || route.name === 'zen' || route.name === 'graph' || route.name === 'timeline';
  const b = $('#top-back'); if (b) b.hidden = !showBack;
  const title = {
    section: '章节', entry: '条目', doc: '长文', glossary: '术语表',
    timeline: '人生时间线', situations: '情境急救', situation: '急救指南',
    paths: '精选路径', path: '精选路径', tools: '速算工具箱',
    dashboard: '个人仪表盘', achievements: '成就勋章', zen: '大字报模式', graph: '关系图谱'
  }[route.name];
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
  if (seg[0] === 'timeline') return { name: 'timeline' };
  if (seg[0] === 'situations') return { name: 'situations' };
  if (seg[0] === 'situation') return { name: 'situation', id: seg[1] };
  if (seg[0] === 'paths') return { name: 'paths' };
  if (seg[0] === 'path') return { name: 'path', id: seg[1] };
  if (seg[0] === 'tools') return { name: 'tools' };
  if (seg[0] === 'dashboard') return { name: 'dashboard' };
  if (seg[0] === 'achievements') return { name: 'achievements' };
  if (seg[0] === 'zen') return { name: 'zen', sec: seg[1], n: seg[2] };
  if (seg[0] === 'graph') return { name: 'graph' };
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
    else if (r.name === 'timeline') renderTimeline();
    else if (r.name === 'situations') renderSituations();
    else if (r.name === 'situation') renderSituations(r.id);
    else if (r.name === 'paths') renderPaths();
    else if (r.name === 'path') renderPaths(r.id);
    else if (r.name === 'tools') renderTools();
    else if (r.name === 'dashboard') renderDashboard();
    else if (r.name === 'achievements') renderAchievements();
    else if (r.name === 'zen') renderZenMode(r.sec, r.n);
    else if (r.name === 'graph') renderGraph();
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
        h('div', { style: 'margin-top:10px;font-size:.84375rem;color:var(--t3)' }, '这个页面要通过 http 打开，并保证同目录下有 data.json（运行 node tools/site/build.mjs 生成）。'),
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
