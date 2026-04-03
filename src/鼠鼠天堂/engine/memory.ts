// 1.6 记忆管理

import type { GameState, Hamster, Angel } from '../schema';

/** 鼠居民记忆上限 */
const HAMSTER_MEMORY_LIMIT = 15;
/** 鼠天使记忆上限 */
const ANGEL_MEMORY_LIMIT = 20;

type Character = Hamster | Angel;

function isAngel(c: Character): c is Angel {
  return 'level' in c && 'manageDomain' in c;
}

/** 压缩记忆：保留最新条目 + 优先保留 ! 开头的重要记忆 */
function compressMemoryRecord(memory: Record<string, string>, limit: number): Record<string, string> {
  const entries = Object.entries(memory);
  if (entries.length <= limit) return memory;

  // 分离重要记忆和普通记忆
  const important = entries.filter(([key]) => key.startsWith('!'));
  const normal = entries.filter(([key]) => !key.startsWith('!'));

  // 保留所有重要记忆 + 最新的普通记忆填充剩余空间
  const normalSlots = Math.max(0, limit - important.length);
  const kept = [...important, ...normal.slice(-normalSlots)];

  return Object.fromEntries(kept);
}

/** 压缩角色记忆 */
export function compressMemory(character: Character): Character {
  const limit = isAngel(character) ? ANGEL_MEMORY_LIMIT : HAMSTER_MEMORY_LIMIT;
  if (Object.keys(character.memory).length <= limit) return character;
  return { ...character, memory: compressMemoryRecord(character.memory, limit) };
}

/** 压缩游戏状态中所有角色的记忆（用于 VARIABLE_UPDATE_ENDED 钩子） */
export function compressAllMemories(state: GameState): GameState {
  const hamsters = Object.fromEntries(
    Object.entries(state.hamsters).map(([id, h]) => [id, compressMemory(h) as Hamster])
  );
  const angels = Object.fromEntries(
    Object.entries(state.angels).map(([id, a]) => [id, compressMemory(a) as Angel])
  );
  return { ...state, hamsters, angels };
}

/** 提取指定角色的记忆文本，用于注入提示词 */
export function getMemoryForPrompt(state: GameState, characterIds: string[]): string {
  const parts: string[] = [];

  for (const id of characterIds) {
    const hamster = state.hamsters[id];
    const angel = state.angels[id];
    const character = hamster || angel;
    if (!character) continue;
    if (Object.keys(character.memory).length === 0) continue;

    const name = character.name;
    const memoryText = Object.entries(character.memory)
      .map(([key, text]) => `[${key}] ${text}`)
      .join('\n');

    parts.push(`【${name}的记忆】\n${memoryText}`);
  }

  return parts.join('\n\n');
}
