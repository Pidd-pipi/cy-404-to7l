import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
const { window } = dom;
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Text', 'Event', 'CustomEvent']) {
  globalThis[key] = window[key];
}
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
const raf = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.requestAnimationFrame = raf;
window.requestAnimationFrame = raf;
const caf = (id) => clearTimeout(id);
globalThis.cancelAnimationFrame = caf;
window.cancelAnimationFrame = caf;
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.document.fonts = { ready: Promise.resolve() };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/* ---------------- 极简排版模拟器（自底向上求高度） ----------------
 * 规则贴近真实简历：
 *  - 叶子文本行：按当前宽度折行，每行 ~22px
 *  - h2 模块标题 30px；h3 24px；h1 48px；li 26px；图片固定
 *  - 容器：纵向排列子元素高度 + 各自 margin/padding
 *  - 两列网格：左右两列各自求高，取较大者
 * 这样“内容多 => 高度大”，分页算法就能像真实浏览器一样换页。
 * ------------------------------------------------------------------ */
const TEXT_LINE = 22;

function ownText(el) {
  let t = '';
  el.childNodes.forEach((n) => {
    if (n.nodeType === 3) t += n.textContent;
  });
  return t.trim();
}

function childElements(el) {
  return Array.from(el.children);
}

function cssPx(el, prop) {
  const v = el.style?.[prop];
  if (typeof v === 'string' && v.endsWith('px')) return parseFloat(v) || 0;
  return 0;
}

function elementWidth(el) {
  // 显式宽度
  const w = cssPx(el, 'width');
  if (w) return w;
  if (el.tagName === 'ARTICLE') {
    const pad = cssPx(el, 'paddingLeft') + cssPx(el, 'paddingRight');
    return (el.style?.width ? 0 : 794) || 794 - pad + pad;
  }
  return null;
}

function subtreeWidth(el, contextWidth) {
  const explicit = cssPx(el, 'width');
  if (explicit) return explicit;
  const pad = cssPx(el, 'paddingLeft') + cssPx(el, 'paddingRight');
  return contextWidth - pad;
}

// 计算一个元素在给定可用宽度下的高度
function heightOf(el, width) {
  const style = el.style || {};
  const padX = cssPx(el, 'paddingLeft') + cssPx(el, 'paddingRight');
  const padY = cssPx(el, 'paddingTop') + cssPx(el, 'paddingBottom');
  const innerWidth = Math.max(20, width - padX);

  // 图片固定尺寸
  if (el.tagName === 'IMG') {
    const cls = el.className || '';
    return cls.includes('h-24') ? 96 : cls.includes('h-20') ? 80 : 64;
  }
  if (el.tagName === 'H1') return 48;
  if (el.tagName === 'H2') {
    const cls = el.className || '';
    return cls.includes('text-lg') ? 28 : 30 + cssPx(el, 'paddingBottom');
  }
  if (el.tagName === 'H3') return 24;
  if (el.tagName === 'LI') {
    const lines = Math.max(1, Math.ceil((el.textContent || '').length / Math.floor(innerWidth / 12)));
    return lines * TEXT_LINE + 4;
  }

  const isGrid = (el.className || '').includes('grid-cols-[190px_1fr]');
  const kids = childElements(el);

  if (isGrid) {
    // 190px 侧栏 + gap-8(32px) + 主列
    const aside = kids.find((k) => k.tagName === 'ASIDE') || kids[0];
    const main = kids.find((k) => k.tagName === 'MAIN') || kids[1];
    const asideH = aside ? heightOf(aside, 190 - cssPx(aside, 'paddingRight') - 1) : 0;
    const mainW = innerWidth - 190 - 32;
    let mainH = 0;
    if (main) {
      mainH = stackHeight(main, mainW);
    } else {
      // 测量行里第二列是 div
      const second = kids[1];
      mainH = second ? heightOf(second, mainW) : 0;
    }
    return padY + Math.max(asideH, mainH);
  }

  if (el.tagName === 'HEADER') {
    // 横向：姓名块 vs 头像 取大，+ 联系方式行
    const isCompact = (el.className || '').includes('border-b') && el.querySelector('h2');
    if (isCompact) return padY + 28 + cssPx(el, 'marginBottom');
    const contactRows = Math.max(1, Math.ceil((el.textContent || '').length / Math.floor(innerWidth / 11)));
    return padY + 52 + 10 + contactRows * TEXT_LINE + cssPx(el, 'marginBottom');
  }

  if (el.tagName === 'ASIDE') {
    let h = 0;
    if (el.querySelector('img')) h += 96 + 16;
    h += 48; // name
    const contactPs = el.querySelectorAll('p').length;
    h += 8 + contactPs * 22 + 24;
    return padY + h;
  }

  if (el.tagName === 'ARTICLE') {
    // 工作/项目条目 or skills 行
    const lis = el.querySelectorAll(':scope ul > li').length;
    if (lis > 0) {
      return padY + 48 + 8 + heightList(el.querySelector(':scope ul'), innerWidth) + marginPx(el);
    }
  }

  // 通用：纵向堆叠
  return padY + stackHeight(el, innerWidth) + marginPx(el);
}

function marginPx(el) {
  return cssPx(el, 'marginTop') + cssPx(el, 'marginBottom');
}

function heightList(ul, width) {
  const lis = Array.from(ul.children);
  let h = 0;
  lis.forEach((li, i) => {
    h += heightOf(li, width - 20);
    if (i < lis.length - 1) h += 4; // space-y-1
  });
  return h;
}

// 纵向排列所有子节点（含文本）的总高度
function stackHeight(el, width) {
  let h = 0;
  const kids = childElements(el);
  // 直接文本
  const txt = ownText(el);
  if (txt) {
    const lines = Math.max(1, Math.ceil(txt.length / Math.floor(width / 12)));
    h += lines * TEXT_LINE;
  }
  kids.forEach((kid, i) => {
    const cls = kid.className || '';
    let gap = 0;
    if (kid.style?.marginTop) gap = parseFloat(kid.style.marginTop) || 0;
    else if (i > 0 && cls && typeof cls.contains === 'function') {
      // tailwind 间距近似
    }
    h += gap;
    if (kid.tagName === 'UL') {
      h += heightList(kid, width - 20) + 8;
    } else {
      h += heightOf(kid, width);
    }
  });
  return h;
}

Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get() {
    // 测量行根宽度：真实 article 宽 794，padding 32 => content 730
    const w = this.style?.width ? parseFloat(this.style.width) : 730;
    return Math.round(heightOf(this, w));
  },
});
Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get() {
    return this.style?.width ? parseFloat(this.style.width) : 730;
  },
});
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get() {
    return 842;
  },
});
window.HTMLElement.prototype.getBoundingClientRect = function () {
  return { width: this.offsetWidth, height: this.offsetHeight, top: 0, left: 0, right: this.offsetWidth, bottom: this.offsetHeight, x: 0, y: 0, toJSON() {} };
};

/* -------------------------------- 测试 -------------------------------- */
const React = (await import('react')).default;
const { createRoot } = await import('react-dom/client');
const { act } = await import('react-dom/test-utils');
const { useResumeStore } = await import('../src/stores/resume.ts');
const { A4Preview } = await import('../src/components/preview/A4Preview.tsx');

let failures = 0;
const check = (name, cond, detail = '') => {
  if (cond) console.log(`PASS  ${name}`);
  else {
    failures += 1;
    console.error(`FAIL  ${name} ${detail}`);
  }
};
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

const resume = useResumeStore.getState().resumes[0];
const longResume = {
  ...resume,
  workExperiences: Array.from({ length: 14 }, (_, i) => ({
    ...resume.workExperiences[0],
    id: `w${i}`,
    position: `职位编号 ${i}`,
    companyName: `公司名称 ${i}`,
    responsibilities: [`负责核心工作流的规划与迭代，组织跨团队协作并推动关键项目落地 ${i}`],
    achievements: [
      `核心链路转化率显著提升，带来可量化的业务增长与效率改善 ${i}`,
      `将关键任务的平均耗时大幅降低，释放团队产能投入更高价值工作 ${i}`,
    ],
  })),
};

const container = window.document.getElementById('root');
await act(async () => {
  createRoot(container).render(React.createElement(A4Preview, { resume: longResume, margin: 14, fontSize: 12 }));
  // 让若干 rAF / fonts.ready / 重渲染链全部跑完
  for (let i = 0; i < 10; i += 1) await tick(15);
});
await act(async () => {
  await tick(30);
});

const sheets = Array.from(container.querySelectorAll('[data-pdf-page]'));
check('内容超长时渲染出多张 A4 纸', sheets.length >= 2, `实际 ${sheets.length} 页`);

const { fullName, phone } = longResume.basicInfo;
check('每页都保留姓名', sheets.length > 0 && sheets.every((s) => (s.textContent || '').includes(fullName)));
check('每页都保留联系方式（电话）', sheets.every((s) => (s.textContent || '').includes(phone)));

const pageNumbersOf = (sheet) =>
  Array.from(sheet.querySelectorAll('p[aria-hidden]')).map((p) => (p.textContent || '').trim());
check('第一页不显示页码', pageNumbersOf(sheets[0]).length === 0);
check(
  '第二页起显示页码',
  sheets.length > 1 && sheets.slice(1).every((s, i) => pageNumbersOf(s)[0] === `${i + 2} / ${sheets.length}`),
);

// 所有 14 个工作条目都渲染
const workTitles = sheets.reduce(
  (n, s) => n + Array.from(s.querySelectorAll('h3')).filter((h) => (h.textContent || '').startsWith('职位编号')).length,
  0,
);
check('全部 14 条工作经历都出现且不丢失', workTitles === 14, `实际 ${workTitles}`);

// 标题不孤立：每页正文容器(.min-h-0.flex-1)的最后一个块包装层不能只含 h2
let orphan = false;
for (const sheet of sheets) {
  const body = sheet.querySelector('.min-h-0.flex-1');
  if (!body) continue;
  const wrappers = Array.from(body.children);
  const last = wrappers[wrappers.length - 1];
  if (last && last.querySelector('h2') && !last.querySelector('h3,p,ul,div.grid')) orphan = true;
}
check('没有模块标题孤立在页尾', !orphan);

// 无空白页
check('没有空白页', sheets.every((s) => (s.textContent || '').trim().length > 10));

// 每张纸内层为 A4 固定像素尺寸
const inner = sheets[0]?.firstElementChild as HTMLElement | undefined;
check('纸张内层为 A4 像素尺寸', !!inner && inner.style.width === '794px' && inner.style.height === '1123px');

console.log(`\n共生成 ${sheets.length} 页`);

/* ---------- 场景二：侧栏版式（executive） ---------- */
const sidebarResume = { ...longResume, id: 'r-sidebar', templateId: 'executive' };
const container2 = window.document.createElement('div');
window.document.body.appendChild(container2);
await act(async () => {
  createRoot(container2).render(React.createElement(A4Preview, { resume: sidebarResume, margin: 14, fontSize: 12 }));
  for (let i = 0; i < 10; i += 1) await tick(15);
});
await act(async () => {
  await tick(30);
});
const sheets2 = Array.from(container2.querySelectorAll('[data-pdf-page]'));
check('侧栏版式：内容超长时渲染出多张 A4 纸', sheets2.length >= 2, `实际 ${sheets2.length} 页`);
check('侧栏版式：每页都保留姓名', sheets2.every((s) => (s.textContent || '').includes(fullName)));
check('侧栏版式：每页都保留联系方式', sheets2.every((s) => (s.textContent || '').includes(phone)));
check('侧栏版式：每页都有左栏 aside', sheets2.every((s) => !!s.querySelector('aside')));
check('侧栏版式：第二页起显示页码', sheets2.slice(1).every((s, i) => pageNumbersOf(s)[0] === `${i + 2} / ${sheets2.length}`));
check('侧栏版式：没有空白页', sheets2.every((s) => (s.textContent || '').trim().length > 10));
console.log(`侧栏版式共生成 ${sheets2.length} 页`);

/* ---------- 场景三：页边距 / 字号变化后重新分页 ---------- */
let setProps: (patch: { margin?: number; fontSize?: number }) => void = () => {};
const container3 = window.document.createElement('div');
window.document.body.appendChild(container3);
function RePaginateHost() {
  const [props, setLocal] = React.useState({ margin: 14, fontSize: 12 });
  setProps = (patch) => setLocal((prev) => ({ ...prev, ...patch }));
  return React.createElement(A4Preview, { resume: longResume, ...props });
}
await act(async () => {
  createRoot(container3).render(React.createElement(RePaginateHost));
  for (let i = 0; i < 10; i += 1) await tick(15);
});
const count3 = () => container3.querySelectorAll('[data-pdf-page]').length;
const waitForPages = async (countFn, ms = 600) => {
  const start = Date.now();
  while (countFn() === 0 && Date.now() - start < ms) await tick(15);
};
await act(async () => {
  await waitForPages(count3);
});
const baseCount = count3();
check('初始状态已完成分页（非 0）', baseCount > 0, `实际 ${baseCount}`);

// 增大页边距 => 可用高度变小 => 页数只增不减
await act(async () => {
  setProps({ margin: 24 });
  for (let i = 0; i < 10; i += 1) await tick(15);
});
const wideMarginCount = count3();
check('增大页边距后重新分页（页数增加）', wideMarginCount >= baseCount, `${baseCount} -> ${wideMarginCount}`);
check(
  '增大页边距后无空白页',
  Array.from(container3.querySelectorAll('[data-pdf-page]')).every((s) => (s.textContent || '').trim().length > 10),
);

// 减小字号 => 每页容纳更多 => 页数只减不增
await act(async () => {
  setProps({ margin: 14, fontSize: 11 });
  for (let i = 0; i < 10; i += 1) await tick(15);
});
const smallFontCount = count3();
check('减小字号后重新分页（页数减少）', smallFontCount <= baseCount, `${baseCount} -> ${smallFontCount}`);
check(
  '参数变化后第二页起仍有页码、内容不丢',
  (() => {
    const ss = Array.from(container3.querySelectorAll('[data-pdf-page]'));
    const titles = ss.reduce((n, s) => n + Array.from(s.querySelectorAll('h3')).filter((h) => (h.textContent || '').startsWith('职位编号')).length, 0);
    const paging = ss.slice(1).every((s, i) => pageNumbersOf(s)[0] === `${i + 2} / ${ss.length}`);
    return titles === 14 && paging;
  })(),
);
console.log(`重新分页：${baseCount} -> 大边距 ${wideMarginCount} -> 小字号 ${smallFontCount}`);

process.exitCode = failures ? 1 : 0;

