// 各标签页引导提示 — 根据游戏状态动态生成

import type { GameState } from '../../schema';
import { getFacilityDef } from '../../data/facilities';
import type { TabId } from './store';

/** 计算每个标签页的引导提示文字 */
export function getTabGuides(game: GameState): Partial<Record<TabId, string[]>> {
  const guides: Partial<Record<TabId, string[]>> = {};

  const hamsters = Object.values(game.hamsters);
  const facilities = Object.values(game.facilities);
  const facilityEntries = Object.entries(game.facilities);

  const hasLiving = facilities.some(f => getFacilityDef(f.type)?.category === 'living');
  const hasPlay = facilities.some(f => getFacilityDef(f.type)?.category === 'play');
  const hasManagedPlay = facilityEntries.some(([, f]) => {
    const def = getFacilityDef(f.type);
    return def?.category === 'play' && f.managedBy;
  });
  const workingHamsters = hamsters.filter(h => h.workingAt);
  const idleHamsters = hamsters.filter(h => !h.workingAt);
  const availablePlaySlots = facilityEntries.some(([, f]) => {
    const def = getFacilityDef(f.type);
    return def?.category === 'play' && f.managedBy && Object.keys(f.occupants).length < f.capacity;
  });

  // ── 设施页 ──
  const fTips: string[] = [];
  if (!hasLiving && !hasPlay) {
    fTips.push('欢迎来到鼠鼠天堂! 先建造「木屑小窝」(⚡20) 和「跑轮发电站」(⚡30) 开始你的乐园吧~');
  } else if (!hasLiving) {
    fTips.push('鼠鼠需要住所! 建造一个「木屑小窝」(⚡20) 给她们一个温暖的家~');
  } else if (!hasPlay) {
    fTips.push('建造「跑轮发电站」(⚡30) 让鼠鼠玩耍产生能源!');
  }
  if (fTips.length > 0) guides.facilities = fTips;

  // ── 鼠鼠页 ──
  const hTips: string[] = [];
  if (hamsters.length === 0) {
    if (hasLiving) {
      hTips.push('小窝已经准备好了~ 推进回合后会有鼠鼠来到门口等待收养!');
    } else {
      hTips.push('先去「设施」页建造小窝，才能收养鼠鼠哦~');
    }
  } else if (idleHamsters.length > 0 && availablePlaySlots) {
    const names = idleHamsters.map(h => h.name).join('、');
    hTips.push(`${names}正在休息~ 点击展开卡片，把她分配到跑轮「去玩耍」就能帮忙发电了!`);
  }
  if (hTips.length > 0) guides.hamsters = hTips;

  // ── 天使页 ──
  const aTips: string[] = [];
  if (facilities.length === 0) {
    aTips.push('天使会在建造设施时自动分配管理~ 先去「设施」页建造设施吧!');
  } else if (!hasManagedPlay && hasPlay) {
    aTips.push('有设施缺少天使管理，没有天使管理的设施无法运作!');
  }
  if (aTips.length > 0) guides.angels = aTips;

  // ── 事件页 ──
  const eTips: string[] = [];
  if (game.adoption_proposal) {
    eTips.push('有鼠鼠在等待收养! 快去看看~');
  }
  if (Object.keys(game.pending_events).length > 0) {
    eTips.push('有待处理的事件，选择选项来获取资源和推进故事!');
  } else if (game.turn === 0) {
    eTips.push('点击「总览」页的「推进回合」按钮开始冒险吧!');
  }
  if (eTips.length > 0) guides.events = eTips;

  // ── 总览页 ──
  const oTips: string[] = [];
  if (game.turn === 0 && !hasLiving && !hasPlay) {
    oTips.push('欢迎来到鼠鼠天堂! 先去「设施」页建造小窝和跑轮~');
  } else if (hasPlay && hasManagedPlay && hamsters.length > 0 && workingHamsters.length > 0 && game.turn === 0) {
    oTips.push('一切准备就绪! 点击「推进回合」看看会发生什么吧~');
  }
  // 体力提示
  const tiredHamsters = hamsters.filter(h => h.workingAt && h.stamina <= 30);
  if (tiredHamsters.length > 0) {
    oTips.push(`${tiredHamsters.map(h => h.name).join('、')} 快累了，记得让她们回窝休息~`);
  }
  // 能源溢出提示
  if (game.energy >= game.energyCap * 0.9 && game.energyCap <= 100) {
    oTips.push('能源快满了! 考虑建造「向日葵储能站」扩展上限，或建新设施消耗一些');
  }
  if (oTips.length > 0) guides.overview = oTips;

  return guides;
}
