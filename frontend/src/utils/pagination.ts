import { AnyResumeBlock, gapBeforeBlock } from '../components/preview/resumeBlocks';

export interface PackPage {
  start: number;
  end: number;
  isFirst: boolean;
}

export interface PackOptions {
  blocks: AnyResumeBlock[];
  blockHeights: Record<string, number>;
  /** 首页正文可用高度（已扣除首页页眉/页码） */
  firstCapacity: number;
  /** 续页正文可用高度（已扣除续页页眉/页码） */
  laterCapacity: number;
}

const EPS = 1;

/**
 * 贪心分页装箱，所有保证都在这里实现，便于独立测试：
 * 1. 原子块（一条工作/项目经历等）只会整体落在某一页，绝不跨页拆开；
 * 2. 标记 attachNext 的模块标题必须与后续第一个内容块同页，
 *    因此标题不会单独落在页尾；
 * 3. 单个原子块超过整页容量时独占一页（不阻塞后续内容，不产生空白死循环）；
 * 4. 页与页之间不插入空页，空内容也恰好返回一页。
 */
export function paginateBlocks({ blocks, blockHeights, firstCapacity, laterCapacity }: PackOptions): PackPage[] {
  const blockHeight = (index: number, atPageStart: boolean): number => {
    const own = blockHeights[blocks[index].id] ?? 0;
    return atPageStart ? own : own + gapBeforeBlock(blocks, index);
  };

  const fitEnd = (from: number, cap: number): number => {
    let used = 0;
    let i = from;
    while (i < blocks.length) {
      const attaches = blocks[i].attachNext;
      // 标题没有可跟随的内容块属于异常数据，直接停止
      if (attaches && i + 1 >= blocks.length) {
        break;
      }
      const unit = attaches ? blockHeight(i, i === from) + blockHeight(i + 1, false) : blockHeight(i, i === from);

      if (used + unit > cap + EPS) {
        if (i === from) {
          // 单块（或标题+首块）超出整页：独占一页
          return from + (attaches ? 2 : 1);
        }
        break;
      }

      used += unit;
      i += attaches ? 2 : 1;
    }
    return i;
  };

  const pages: PackPage[] = [];
  let cursor = 0;
  let pageIndex = 0;
  while (cursor < blocks.length) {
    const cap = pageIndex === 0 ? firstCapacity : laterCapacity;
    const end = Math.max(cursor + 1, fitEnd(cursor, cap));
    pages.push({ start: cursor, end, isFirst: pageIndex === 0 });
    cursor = end;
    pageIndex += 1;
  }

  if (pages.length === 0) {
    pages.push({ start: 0, end: 0, isFirst: true });
  }
  return pages;
}
