// 2.2 状态读写桥接
// 连接游戏引擎与酒馆 MVU 变量系统

import type { GameState } from '../schema';
import { GameStateSchema } from '../schema';
import { createInitialGameState } from '../data/init';
import { FACILITY_DEFS } from '../data/facilities';

/** 从 MVU 读取当前 GameState */
export function loadGameState(messageId?: number): GameState {
  const option: VariableOption = {
    type: 'message',
    message_id: messageId ?? 'latest',
  };
  const mvuData = Mvu.getMvuData(option);
  const statData = _.get(mvuData, 'stat_data');

  if (!statData || Object.keys(statData).length === 0) {
    return createInitialGameState();
  }

  // safeParse: 校验失败时回退到初始状态，避免阻塞加载
  const result = GameStateSchema.safeParse(statData);
  if (result.success) {
    return result.data;
  }
  console.warn('[鼠鼠天堂] GameState 校验失败，使用原始数据:', result.error);
  // 校验失败但数据存在时，信任原始数据（可能是 schema 变更导致）
  return statData as GameState;
}

/** 将 GameState 写回 MVU */
export async function saveGameState(state: GameState, messageId?: number): Promise<void> {
  const option: VariableOption = {
    type: 'message',
    message_id: messageId ?? 'latest',
  };
  const mvuData = Mvu.getMvuData(option);
  _.set(mvuData, 'stat_data', state);
  await Mvu.replaceMvuData(mvuData, option);
}

/** 生成简洁的状态摘要字符串（供 AI 提示词） */
export function getStateForPrompt(state: GameState): string {
  const lines: string[] = [];

  // 资源
  lines.push(`【资源】⚡能源: ${state.energy}/${state.energyCap} | ✨星尘: ${state.stardust} | 💛心情: ${state.happiness} | 回合: ${state.turn}`);

  // 鼠鼠简表
  if (state.hamsters.length > 0) {
    lines.push(`【鼠居民】(${state.hamsters.length}只)`);
    for (const h of state.hamsters) {
      const location = h.assignedTo
        ? state.facilities.find(f => f.id === h.assignedTo)?.type ?? '未知'
        : '休息中';
      const facilityName = h.assignedTo
        ? FACILITY_DEFS.find(d => d.type === state.facilities.find(f => f.id === h.assignedTo)?.type)?.name ?? location
        : '休息中';
      lines.push(`  ${h.name}(${h.breed}) 性格:${h.personality.join('/')} 心情:${h.mood} 体力:${h.stamina} 位置:${facilityName}`);
    }
  } else {
    lines.push('【鼠居民】无');
  }

  // 天使简表
  lines.push('【鼠天使】');
  for (const a of state.angels) {
    const facilityName = a.assignedFacility
      ? FACILITY_DEFS.find(d => d.type === state.facilities.find(f => f.id === a.assignedFacility)?.type)?.name ?? '未知设施'
      : '空闲';
    const skillInfo = a.skills
      .filter(s => a.level >= s.unlockedAtAngelLevel)
      .map(s => `${s.skillId}${s.cooldownLeft > 0 ? `(CD:${s.cooldownLeft})` : ''}`)
      .join(', ');
    lines.push(`  ${a.name} Lv.${a.level} 管理:${facilityName} 技能:[${skillInfo}]`);
  }

  // 设施简表
  if (state.facilities.length > 0) {
    lines.push(`【设施】(${state.facilities.length}个)`);
    for (const f of state.facilities) {
      const def = FACILITY_DEFS.find(d => d.type === f.type);
      const name = def?.name ?? f.type;
      const manager = f.managedBy
        ? state.angels.find(a => a.id === f.managedBy)?.name ?? '未知'
        : '无人管理';
      lines.push(`  ${name} Lv.${f.level} 容量:${f.occupants.length}/${f.capacity} 管理:${manager}`);
    }
  } else {
    lines.push('【设施】无');
  }

  // 成就
  if (state.achievements.length > 0) {
    lines.push(`【已解锁成就】${state.achievements.join(', ')}`);
  }

  return lines.join('\n');
}
