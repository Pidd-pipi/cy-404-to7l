import assert from 'node:assert';
import { paginateBlocks } from '../src/utils/pagination';
import { gapBeforeBlock } from '../src/components/preview/resumeBlocks';
import type { AnyResumeBlock } from '../src/components/preview/resumeBlocks';

let failures = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`FAIL  ${name}\n      ${err.message}`);
  }
}

// 构造块：t=标题(attachNext)，w=工作条目，s=摘要
function makeBlocks(spec) {
  return spec.map(([type, id], index) => ({
    id: id ?? `${type}-${index}`,
    type: type === 't' ? 'section-title' : type === 'w' ? 'work-item' : 'summary',
    attachNext: type === 't',
  })) as AnyResumeBlock[];
}
function heights(blocks, map) {
  const h = {};
  blocks.forEach((b, i) => (h[b.id] = map[i]));
  return h;
}
const cover = (pages, blocks) => {
  const flat = pages.flatMap((p) => blocks.slice(p.start, p.end).map((b) => b.id));
  assert.deepStrictEqual(flat, blocks.map((b) => b.id), '块必须按序完整覆盖、无重复无遗漏');
};
const withinCap = (pages, blocks, h, firstCap, laterCap) => {
  for (const page of pages) {
    let used = 0;
    for (let i = page.start; i < page.end; i += 1) {
      used += h[blocks[i].id] + (i === page.start ? 0 : gapBeforeBlock(blocks, i));
    }
    const cap = page.isFirst ? firstCap : laterCap;
    assert.ok(used <= cap + 1, `页内容 ${used} 超过容量 ${cap}`);
  }
};
const noOrphanTitle = (pages, blocks) => {
  for (const page of pages) {
    const last = blocks[page.end - 1];
    assert.ok(!last || !last.attachNext, '模块标题不能是页内最后一块');
  }
};

// 1. 单页放得下：恰好一页
test('单页内容不产生多余页', () => {
  const blocks = makeBlocks([['t'], ['w'], ['w']]);
  const h = heights(blocks, [20, 100, 100]); // 20+12+100+16+100 = 248
  const pages = paginateBlocks({ blocks, blockHeights: h, firstCapacity: 248, laterCapacity: 300 });
  assert.strictEqual(pages.length, 1);
  assert.strictEqual(pages[0].end, 3);
  cover(pages, blocks);
  noOrphanTitle(pages, blocks);
});

// 2. 条目不跨页：放不下的整块移到下一页
test('原子块不跨页拆开', () => {
  const blocks = makeBlocks([['w'], ['w'], ['w']]);
  const h = heights(blocks, [60, 60, 60]);
  // 60 + (20+60) = 140 放两块，第三块 20+60 会到 220
  const pages = paginateBlocks({ blocks, blockHeights: h, firstCapacity: 140, laterCapacity: 140 });
  assert.strictEqual(pages.length, 2);
  assert.deepStrictEqual([pages[0].start, pages[0].end], [0, 2]);
  assert.deepStrictEqual([pages[1].start, pages[1].end], [2, 3]);
  cover(pages, blocks);
  withinCap(pages, blocks, h, 140, 140);
});

// 3. 标题不孤立：标题+首块一起换页
test('模块标题不会单独落在页尾', () => {
  const blocks = makeBlocks([['w', 'a'], ['t', 'sec'], ['w', 'b']]);
  const h = heights(blocks, [60, 20, 90]);
  // 首页：a=60；标题作为非页首块 20+20=40（标题自身+间距），连同 b 还要 +12+90 => 182
  // 首页容量 100：a=60 后剩 40，标题单元(20+20+12+90=142)放不下 -> 标题和 b 整体换页
  const pages = paginateBlocks({ blocks, blockHeights: h, firstCapacity: 100, laterCapacity: 200 });
  assert.strictEqual(pages.length, 2);
  assert.deepStrictEqual([pages[0].start, pages[0].end], [0, 1]);
  assert.deepStrictEqual([pages[1].start, pages[1].end], [1, 3]);
  cover(pages, blocks);
  withinCap(pages, blocks, h, 100, 200);
  noOrphanTitle(pages, blocks);
});

// 4. 续页页首的标题与首块作为一个单元
test('续页页首标题带首块', () => {
  const blocks = makeBlocks([['w', 'a'], ['t', 'sec'], ['w', 'b'], ['w', 'c']]);
  const h = heights(blocks, [50, 20, 50, 50]);
  // 首页容量 50：只放 a。续页容量 100：页首标题单元 = 20+12+50=82，放得下；
  // 再加 c(16+50=66) 会到 148 -> 换页。c 独占第三页。
  const pages = paginateBlocks({ blocks, blockHeights: h, firstCapacity: 50, laterCapacity: 100 });
  assert.deepStrictEqual(pages.map((p) => [p.start, p.end]), [[0, 1], [1, 3], [3, 4]]);
  cover(pages, blocks);
  withinCap(pages, blocks, h, 50, 100);
  noOrphanTitle(pages, blocks);
});

// 5. 超长单块独占一页，后续块继续，不死循环
test('超过一页的条目独占一页且不产生空白页', () => {
  const blocks = makeBlocks([['w', 'a'], ['w', 'big'], ['w', 'c']]);
  const h = heights(blocks, [30, 500, 30]);
  const pages = paginateBlocks({ blocks, blockHeights: h, firstCapacity: 100, laterCapacity: 100 });
  // 首页：a=30；big 需 20+500=520>100 -> 换页。第二页 big 页首仍 500>100 -> 独占；c 第三页。
  assert.strictEqual(pages.length, 3);
  assert.deepStrictEqual([pages[0].start, pages[0].end], [0, 1]);
  assert.deepStrictEqual([pages[1].start, pages[1].end], [1, 2]);
  assert.deepStrictEqual([pages[2].start, pages[2].end], [2, 3]);
  cover(pages, blocks);
});

// 6. 空内容：恰好一页，无空白页
test('空简历恰好返回一页', () => {
  const blocks = [] as AnyResumeBlock[];
  const pages = paginateBlocks({ blocks, blockHeights: {}, firstCapacity: 800, laterCapacity: 700 });
  assert.strictEqual(pages.length, 1);
  assert.strictEqual(pages[0].start, 0);
  assert.strictEqual(pages[0].end, 0);
});

// 7. 贪心不浪费：容量内尽量多放
test('容量内尽量多放', () => {
  const blocks = makeBlocks([['w'], ['w'], ['w'], ['w']]);
  const h = heights(blocks, [40, 40, 40, 40]); // 块间距 20
  const pages = paginateBlocks({ blocks, blockHeights: h, firstCapacity: 101, laterCapacity: 101 });
  // 40 + (20+40) = 100 两块；第三块到 160 -> 换页
  assert.strictEqual(pages.length, 2);
  assert.strictEqual(pages[0].end, 2);
  cover(pages, blocks);
  withinCap(pages, blocks, h, 101, 101);
});

// 8. 大样本：完整覆盖 / 不超载 / 标题不孤立 / 无空白页
test('大样本：完整覆盖/不超载/标题不孤立/无空白页', () => {
  const spec = [];
  for (let s = 0; s < 8; s += 1) {
    spec.push(['t', `t${s}`]);
    for (let j = 0; j < 5; j += 1) spec.push(['w', `w${s}-${j}`]);
  }
  const blocks = makeBlocks(spec);
  const h = heights(blocks, blocks.map((_, i) => 30 + ((i * 37) % 80)));
  const pages = paginateBlocks({ blocks, blockHeights: h, firstCapacity: 260, laterCapacity: 240 });
  cover(pages, blocks);
  withinCap(pages, blocks, h, 260, 240);
  noOrphanTitle(pages, blocks);
  for (const p of pages) assert.ok(p.end > p.start, '不允许空白页');
});

// 9. 容量变化时分页数随之改变（页边距/字号 -> 容量变化的抽象验证）
test('容量变小导致页数增加', () => {
  const spec = [];
  for (let s = 0; s < 4; s += 1) {
    spec.push(['t', `t${s}`]);
    spec.push(['w', `w${s}`]);
  }
  const blocks = makeBlocks(spec);
  const h = heights(blocks, blocks.map((_, i) => (blocks[i].attachNext ? 20 : 80)));
  const roomy = paginateBlocks({ blocks, blockHeights: h, firstCapacity: 1000, laterCapacity: 1000 });
  const tight = paginateBlocks({ blocks, blockHeights: h, firstCapacity: 120, laterCapacity: 120 });
  assert.strictEqual(roomy.length, 1);
  assert.ok(tight.length > roomy.length, `期望重排后页数更多，实际 ${tight.length}`);
  cover(tight, blocks);
  noOrphanTitle(tight, blocks);
});

process.exitCode = failures ? 1 : 0;
