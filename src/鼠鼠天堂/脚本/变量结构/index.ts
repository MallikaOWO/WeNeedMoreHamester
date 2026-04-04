import { registerMvuSchema } from 'https://cdn.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';
import { Schema } from '../../schema';
import { compressAllMemories } from '../../engine/memory';

$(() => {
  registerMvuSchema(Schema);

  // 4.3 VARIABLE_UPDATE_ENDED 钩子
  // AI 的 JSONPatch 更新完成后，执行引擎后处理
  eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (variables: Mvu.MvuData) => {
    const statData = variables.stat_data;
    if (!statData) return;

    // 记忆压缩：AI 可能写入大量记忆，超限时裁剪
    const parsed = Schema.safeParse(statData);
    if (!parsed.success) return;

    const compressed = compressAllMemories(parsed.data);

    // 将压缩后的记忆写回（直接修改 variables 对象，MVU 会持久化）
    for (const [id, h] of Object.entries(compressed.hamsters)) {
      _.set(variables, `stat_data.hamsters.${id}.memory`, h.memory);
    }
    for (const [id, a] of Object.entries(compressed.angels)) {
      _.set(variables, `stat_data.angels.${id}.memory`, a.memory);
    }
  });
});
