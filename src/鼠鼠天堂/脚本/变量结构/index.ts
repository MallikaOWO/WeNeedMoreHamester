import { registerMvuSchema } from 'https://cdn.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';
import { Schema } from '../../schema';
import { compressAllMemories } from '../../engine/memory';

$(() => {
  registerMvuSchema(Schema);

  // 4.3 VARIABLE_UPDATE_ENDED 钩子
  // AI 的变量更新完成后，保护代码管理字段 + 执行引擎后处理
  eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, (variables: Mvu.MvuData, old_variables: Mvu.MvuData) => {
    const statData = variables.stat_data;
    if (!statData) return;

    // ── 保护代码管理的字段，防止 AI 覆盖 ──
    const oldHamsters = (old_variables?.stat_data?.hamsters ?? {}) as Record<string, any>;
    const newHamsters = (statData.hamsters ?? {}) as Record<string, any>;
    for (const id of Object.keys(newHamsters)) {
      if (oldHamsters[id]) {
        // 已存在的鼠鼠：保护 livingAt/workingAt
        _.set(variables, `stat_data.hamsters.${id}.livingAt`, oldHamsters[id].livingAt ?? null);
        _.set(variables, `stat_data.hamsters.${id}.workingAt`, oldHamsters[id].workingAt ?? null);
      } else {
        // AI 不能创建新鼠鼠（只有前端收养才能创建），删除
        delete newHamsters[id];
        _.set(variables, 'stat_data.hamsters', newHamsters);
      }
    }

    // ── 记忆压缩：AI 可能写入大量记忆，超限时裁剪 ──
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
