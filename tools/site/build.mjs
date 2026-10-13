#!/usr/bin/env node
// 站点构建：把 README.md、book/、docs/ 解析成 site/data.json，供 site/ 下的静态应用读取。
//
// 零依赖，只用 Node 内置模块，和仓库其它工具保持一致。
// 解析规则和 index.html 的 parseReadme / parseGlossary 是同一套：条目靠 `### N. 标题`
// 起头，字段靠 `- 成本：` 这类行前缀，成本维度靠紧跟标题那行 HTML 注释里的「成本标签」。
// 改这里的规则要同时看 index.html 和 selfcheck.html，三处读的是同一批正文。
//
// 用法：node tools/site/build.mjs
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeIcons } from './icons.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'site', 'data.json');

export const REPO = 'https://github.com/eternity4719/HowToLiveBetter';
export const REPO_BLOB = REPO + '/blob/main/';
export const TITLE = '高性价比人生指南';

const read = (p) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

// 性价比三档：和 index.html 的 COST_W、e.ratio 两行一致
const COST_W = {
  money: { '0': 0, '少': 1, '多': 2 },
  time: { '少': 0, '中': 1, '多': 2 },
  will: { '否': 0, '些': 1, '是': 2 },
};

// ---------- README：目录、导读、想回答的问题、术语表 ----------
function parseReadme(md) {
  const block = (from, to) => {
    const a = md.indexOf(from);
    if (a < 0) return '';
    const b = to ? md.indexOf(to, a + from.length) : -1;
    return md.slice(a + from.length, b < 0 ? undefined : b);
  };

  // 「这本书想回答的问题」表：每一节一行，右侧是指向 book/ 的链接
  const questions = {};
  for (const m of block('## 这本书想回答的问题', '## 怎么读')
    .matchAll(/^\|\s*(.+?)\s*\|\s*\[(\d+)\.\s*(.+?)\]\((book\/[^)]+\.md)\)\s*\|$/gm)) {
    questions[m[2]] = m[1];
  }

  // 「目录」列表：条数、节名、文件、一句话简介（「：」后面的部分）
  const toc = [];
  for (const m of block('## 目录', '## 正文')
    .matchAll(/^(\d+)\.\s*\[(.+?)\]\((book\/[^)]+\.md)\)(?:：(.+))?$/gm)) {
    toc.push({ n: +m[1], title: m[2].trim(), file: m[3], summary: (m[4] || '').trim() });
  }

  // 页首导读：一级标题之后到第一个 [[ 徽章 之前的那几段
  const lead = block('# ' + TITLE, '[![')
    .split('\n')
    .map((l) => l.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean)
    .join('');

  // 术语表：details 里的两列表格，一格可以写好几个词（用「、」隔开）
  const glossary = [];
  for (const m of block('## 读懂数字', '## 目录')
    .matchAll(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/gm)) {
    const head = m[1].trim();
    if (head === '术语' || /^-+$/.test(head)) continue;
    for (const t of head.split('、')) {
      const term = t.trim();
      if (term) glossary.push({ term, meaning: m[2].trim(), latin: /^[A-Za-z0-9%. ]+$/.test(term) });
    }
  }
  glossary.sort((a, b) => b.term.length - a.term.length);

  return { lead, questions, toc, glossary };
}

// ---------- book/*.md：章节与条目 ----------
function parseBook(md) {
  const lines = md.split('\n');
  const sections = [];
  let sec = null, entry = null, sawEntry = false;
  const flush = () => { if (entry && sec) sec.entries.push(entry); entry = null; };

  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    if ((m = /^#{1,2} (\d+)\. (.+)$/.exec(line))) {
      flush(); sawEntry = false;
      sec = { n: +m[1], title: m[2].trim(), intro: [], entries: [] };
      sections.push(sec);
      continue;
    }
    if (/^#{1,2} /.test(line)) { flush(); sec = null; continue; }
    if (!sec) continue;
    if ((m = /^### (\d+)\. (.+)$/.exec(line))) {
      flush(); sawEntry = true;
      entry = {
        sec: sec.n, n: +m[1], title: m[2].trim(),
        cost: '', human: '', gain: '', grade: '', src: '', note: '',
        money: '', time: '', will: '', level: '', lens: '', who: [],
      };
      continue;
    }
    if ((m = /^<!--\s*成本标签:\s*(.*?)\s*-->/.exec(line)) && entry) {
      for (const kv of m[1].split(/\s+/)) {
        const [k, v] = kv.split('=');
        if (k === '钱') entry.money = v;
        else if (k === '时间') entry.time = v;
        else if (k === '毅力') entry.will = v;
        else if (k === '收益') entry.level = v;
        else if (k === '口径') entry.lens = v;
        else if (k === '人群') entry.who = v.split(',').map((g) => g.split('+'));
      }
      continue;
    }
    if (entry) {
      if ((m = /^- 成本：(.*)$/.exec(line))) entry.cost = m[1];
      else if ((m = /^- 说人话：(.*)$/.exec(line))) entry.human = m[1];
      else if ((m = /^- 收益：(.*)$/.exec(line))) entry.gain = m[1];
      else if ((m = /^- 证据等级：\s*([ABC])/.exec(line))) entry.grade = m[1];
      else if ((m = /^- 来源：(.*)$/.exec(line))) entry.src = m[1];
      else if ((m = /^- 备注：(.*)$/.exec(line))) entry.note = m[1];
      continue;
    }
    if (line && !sawEntry) sec.intro.push(line); // 第一条之前的导读都收，不止第一段
  }
  flush();

  for (const s of sections) {
    for (const e of s.entries) {
      e.dispute = /^争议/.test(e.note);
      e.todo = /待核实|TODO/.test(e.src + e.gain + e.note + e.cost);
      e.cs = (COST_W.money[e.money] ?? 0) + (COST_W.time[e.time] ?? 0) + (COST_W.will[e.will] ?? 0);
      e.ratio = e.level === '大' ? (e.cs === 0 ? '极高' : e.cs <= 2 ? '高' : '一般')
        : e.level === '中' ? (e.cs === 0 ? '高' : '一般') : '一般';
    }
  }
  return sections;
}

// ---------- docs/*.md：长文 ----------
function readDocs() {
  const dir = join(ROOT, 'docs');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== '引用对照.md')
    .sort()
    .map((f) => {
      const md = readFileSync(join(dir, f), 'utf8').replace(/\r\n/g, '\n');
      const h = /^#\s+(.+)$/m.exec(md);
      return { slug: f.replace(/\.md$/, ''), title: h ? h[1].trim() : f, md };
    });
}

// ---------- 统计 ----------
function stats(sections) {
  const all = sections.flatMap((s) => s.entries);
  const count = (re, txt) => (txt.match(re) || []).length;
  const links = all.reduce((n, e) => n + count(/https?:\/\//g, e.src) + count(/https?:\/\//g, e.note), 0);
  return {
    entries: all.length,
    sections: sections.length,
    a: all.filter((e) => e.grade === 'A').length,
    b: all.filter((e) => e.grade === 'B').length,
    c: all.filter((e) => e.grade === 'C').length,
    dispute: all.filter((e) => e.dispute).length,
    todo: all.filter((e) => e.todo).length,
    links,
    top: all.filter((e) => e.ratio === '极高').length,
  };
}

// ---------- 组装 ----------
const readme = read('README.md');
const { lead, questions, toc, glossary } = parseReadme(readme);

const bookFiles = readdirSync(join(ROOT, 'book'))
  .filter((f) => f.endsWith('.md'))
  .sort();
const sections = parseBook(bookFiles.map((f) => read('book/' + f)).join('\n\n'));

// README 目录里的一句话简介和「想回答的问题」贴到对应节上
const tocBy = Object.fromEntries(toc.map((t) => [t.n, t]));
for (const s of sections) {
  const t = tocBy[s.n];
  if (t) { s.summary = t.summary; s.file = t.file; }
  s.question = questions[String(s.n)] || '';
}

const docs = readDocs();

const data = {
  meta: {
    title: TITLE,
    lead,
    repo: REPO,
    repoBlob: REPO_BLOB,
    builtAt: new Date().toISOString().slice(0, 10),
    stats: stats(sections),
    license: 'CC BY 4.0',
  },
  sections,
  docs,
  glossary,
};

writeFileSync(OUT, JSON.stringify(data));
const icons = writeIcons(join(ROOT, 'site', 'icons'));
const kb = (Buffer.byteLength(JSON.stringify(data)) / 1024).toFixed(0);
const st = data.meta.stats;
console.log(
  `site/data.json 已写入：${st.sections} 节 / ${st.entries} 条 / ` +
  `A${st.a} B${st.b} C${st.c} / 争议${st.dispute} / 待核实${st.todo} / 长文${docs.length} 篇 / ${kb} KB；` +
  `PWA 图标 ${icons} 张`
);
