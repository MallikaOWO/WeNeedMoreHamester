// 2.2 状态读写桥接
// 连接游戏引擎与酒馆 MVU 变量系统

import type { GameState } from '../schema';
import { Schema } from '../schema';
import { createInitialGameState } from '../data/init';
import { FACILITY_DEFS } from '../data/facilities';

/**
 * 确保存在非零消息楼层用于持久化。
 * Message 0 的变量在重载时会被 initvar 覆盖，因此需要一个 message 1+ 来存储前端修改的数据。
 * 调用后 'latest' 一定指向 message 1+。
 */
export async function ensurePersistenceLayer(): Promise<void> {
  if (getLastMessageId() > 0) return;

  // 将 message 0 的 MVU 数据复制到新的 assistant 楼层
  const mvuData = Mvu.getMvuData({ type: 'message', message_id: 0 });
  await createChatMessages(
    [{ role: 'assistant', message: ' ', data: _.cloneDeep(mvuData) }],
    { refresh: 'none' },
  );
}

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
  const result = Schema.safeParse(statData);
  if (result.success) {
    return result.data;
  }
  console.warn('[鼠鼠天堂] GameState 校验失败，使用原始数据:', result.error);
  return statData as GameState;
}

/** 将 GameState 写回 MVU（始终写入 'latest'，确保不会写到 message 0） */
export async function saveGameState(state: GameState, messageId?: number): Promise<void> {
  const targetId = messageId ?? 'latest';

  // 如果只有 message 0，先创建持久化层，避免数据被 initvar 覆盖
  if (targetId === 'latest' && getLastMessageId() === 0) {
    await ensurePersistenceLayer();
  }

  const option: VariableOption = {
    type: 'message',
    message_id: targetId,
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
  const hamsterEntries = Object.entries(state.hamsters);
  if (hamsterEntries.length > 0) {
    lines.push(`【鼠居民】(${hamsterEntries.length}只)`);
    for (const [hId, h] of hamsterEntries) {
      const livingType = h.livingAt ? state.facilities[h.livingAt]?.type : null;
      const livingName = livingType
        ? (FACILITY_DEFS.find(d => d.type === livingType)?.name ?? livingType)
        : '无住所';
      const workType = h.workingAt ? state.facilities[h.workingAt]?.type : null;
      const workName = workType
        ? (FACILITY_DEFS.find(d => d.type === workType)?.name ?? workType)
        : '休息中';
      lines.push(`  ${h.name}[${hId}](${h.breed}) 性格:${h.personality} 心情:${h.mood} 体力:${h.stamina} 住所:${livingName} 状态:${workName}`);
    }
  } else {
    lines.push('【鼠居民】无');
  }

  // 天使简表
  lines.push('【鼠天使】');
  for (const [aId, a] of Object.entries(state.angels)) {
    const domainFacilities = Object.entries(state.facilities)
      .filter(([, f]) => f.managedBy === aId)
      .map(([, f]) => FACILITY_DEFS.find(d => d.type === f.type)?.name ?? f.type);
    const facilityLabel = domainFacilities.length > 0
      ? domainFacilities.join('+')
      : '无设施';
    const skillInfo = Object.entries(a.skills)
      .filter(([, s]) => a.level >= s.unlockedAtAngelLevel)
      .map(([sId, s]) => `${sId}${s.cooldownLeft > 0 ? `(CD:${s.cooldownLeft})` : ''}`)
      .join(', ');
    lines.push(`  ${a.name}[${aId}] Lv.${a.level} 管理:${facilityLabel} 技能:[${skillInfo}]`);
  }

  // 设施简表
  const facilityEntries = Object.entries(state.facilities);
  if (facilityEntries.length > 0) {
    lines.push(`【设施】(${facilityEntries.length}个)`);
    for (const [fId, f] of facilityEntries) {
      const def = FACILITY_DEFS.find(d => d.type === f.type);
      const name = def?.name ?? f.type;
      const managerName = f.managedBy ? (state.angels[f.managedBy]?.name ?? '未知') : '无人管理';
      if (def?.category === 'living') {
        const residents = Object.values(state.hamsters).filter(h => h.livingAt === fId).length;
        lines.push(`  ${name}[${fId}] Lv.${f.level} 住户:${residents}/${f.capacity} 管理:${managerName}`);
      } else {
        const occupantCount = Object.keys(f.occupants).length;
        lines.push(`  ${name}[${fId}] Lv.${f.level} 工位:${occupantCount}/${f.capacity} 管理:${managerName}`);
      }
    }
  } else {
    lines.push('【设施】无');
  }

  // 成就
  const unlockedAchievements = Object.keys(state.achievements).filter(k => state.achievements[k]);
  if (unlockedAchievements.length > 0) {
    lines.push(`【已解锁成就】${unlockedAchievements.join(', ')}`);
  }

  return lines.join('\n');
}
