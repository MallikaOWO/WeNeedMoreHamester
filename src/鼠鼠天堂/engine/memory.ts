// 1.6 记忆管理

import type { GameState, MemoryEntry, Hamster, Angel } from '../schema';

/** 鼠居民记忆上限 */
const HAMSTER_MEMORY_LIMIT = 15;
/** 鼠天使记忆上限 */
const ANGEL_MEMORY_LIMIT = 20;

type Character = Hamster | Angel;

function isAngel(c: Character): c is Angel {
  return 'level' in c && 'manageDomain' in c;
}

/** 追加记忆条目 */
export function appendMemory(character: Character, entry: MemoryEntry): Character {
  const limit = isAngel(character) ? ANGEL_MEMORY_LIMIT : HAMSTER_MEMORY_LIMIT;
  let memory = [...character.memory, entry];

  // 超限时自动压缩
  if (memory.length > limit) {
    memory = compressMemoryEntries(memory, limit);
  }

  return { ...character, memory };
}

/** 压缩记忆：移除最早的非重要条目直到不超限 */
function compressMemoryEntries(entries: MemoryEntry[], limit: number): MemoryEntry[] {
  const result = [...entries];
  // 从最早的条目开始移除非重要的
  let i = 0;
  while (result.length > limit && i < result.length) {
    if (!result[i].important) {
      result.splice(i, 1);
    } else {
      i++;
    }
  }
  return result;
}

/** 压缩角色记忆（公开接口） */
export function compressMemory(character: Character): Character {
  const limit = isAngel(character) ? ANGEL_MEMORY_LIMIT : HAMSTER_MEMORY_LIMIT;
  if (character.memory.length <= limit) return character;
  return { ...character, memory: compressMemoryEntries(character.memory, limit) };
}

/** 提取指定角色的记忆文本，用于注入提示词 */
export function getMemoryForPrompt(state: GameState, characterIds: string[]): string {
  const parts: string[] = [];

  for (const id of characterIds) {
    const hamster = state.hamsters.find(h => h.id === id);
    const angel = state.angels.find(a => a.id === id);
    const character = hamster || angel;
    if (!character) continue;
    if (character.memory.length === 0) continue;

    const name = character.name;
    const memoryText = character.memory
      .map(m => `[回合${m.turn}] ${m.text}`)
      .join('\n');

    parts.push(`【${name}的记忆】\n${memoryText}`);
  }

  return parts.join('\n\n');
}

/** 向游戏状态中的角色追加记忆 */
export function appendMemoryToState(
  state: GameState,
  characterId: string,
  entry: MemoryEntry,
): GameState {
  const hamsterIdx = state.hamsters.findIndex(h => h.id === characterId);
  if (hamsterIdx >= 0) {
    const updated = appendMemory(state.hamsters[hamsterIdx], entry) as Hamster;
    const hamsters = [...state.hamsters];
    hamsters[hamsterIdx] = updated;
    return { ...state, hamsters };
  }

  const angelIdx = state.angels.findIndex(a => a.id === characterId);
  if (angelIdx >= 0) {
    const updated = appendMemory(state.angels[angelIdx], entry) as Angel;
    const angels = [...state.angels];
    angels[angelIdx] = updated;
    return { ...state, angels };
  }

  return state;
}
