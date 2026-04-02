// 3.3.5 天使页 — 天使卡片 + 技能 + 升级

import React, { useState } from 'react';
import { useStore } from '../store';
import { ANGEL_PRESETS } from '../../../data/angels';
import { getSkillDef } from '../../../data/skills';
import { getFacilityDef } from '../../../data/facilities';
import { canLevelUp } from '../../../engine/angel';

const DOMAIN_LABELS: Record<string, string> = {
  life: '生活',
  power: '产能',
  stardust: '星尘',
  social: '社交',
  special: '特殊',
};

const Angels: React.FC = () => {
  const { state, dispatch } = useStore();
  const game = state.game;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [skillTarget, setSkillTarget] = useState<{ angelId: string; skillId: string } | null>(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {game.angels.map(angel => {
        const expanded = expandedId === angel.id;
        const preset = ANGEL_PRESETS.find(p => p.id === angel.id);
        const facilityName = angel.assignedFacility
          ? getFacilityDef(game.facilities.find(f => f.id === angel.assignedFacility)?.type ?? '')?.name ?? '未知'
          : '空闲';
        const levelCheck = canLevelUp(game, angel.id);

        return (
          <div key={angel.id} className="card">
            {/* 头部 */}
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setExpandedId(expanded ? null : angel.id)}
            >
              <div>
                <span style={{ fontWeight: 600 }}>{angel.name}</span>
                <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>
                  Lv.{angel.level} | {DOMAIN_LABELS[angel.manageDomain] ?? angel.manageDomain}
                </span>
              </div>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{facilityName}</span>
            </div>

            {/* 描述 */}
            {preset && (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                {preset.personalityKeywords.join('、')} — {preset.description.slice(0, 30)}...
              </div>
            )}

            {/* 技能列表（总是显示） */}
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {angel.skills.map(sk => {
                const def = getSkillDef(sk.skillId);
                const locked = angel.level < sk.unlockedAtAngelLevel;
                const onCooldown = sk.cooldownLeft > 0;
                const canUse = !locked && !onCooldown;
                const needsTarget = def?.effectType === 'heal_mood';
                const isSelectingTarget = skillTarget?.angelId === angel.id && skillTarget?.skillId === sk.skillId;

                return (
                  <button
                    key={sk.skillId}
                    className="btn btn-sm"
                    disabled={!canUse}
                    style={{
                      opacity: locked ? 0.3 : 1,
                      position: 'relative',
                    }}
                    title={locked ? `Lv.${sk.unlockedAtAngelLevel} 解锁` : onCooldown ? `冷却中 (${sk.cooldownLeft}回合)` : def?.description}
                    onClick={() => {
                      if (needsTarget && game.hamsters.length > 0) {
                        setSkillTarget(isSelectingTarget ? null : { angelId: angel.id, skillId: sk.skillId });
                      } else {
                        dispatch({ type: 'USE_SKILL', angelId: angel.id, skillId: sk.skillId });
                      }
                    }}
                  >
                    {def?.name ?? sk.skillId}
                    {onCooldown && <span style={{ fontSize: 10, marginLeft: 2 }}>({sk.cooldownLeft})</span>}
                    {locked && <span style={{ fontSize: 10, marginLeft: 2 }}>🔒</span>}
                  </button>
                );
              })}
            </div>

            {/* 技能目标选择 */}
            {skillTarget?.angelId === angel.id && (
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#6b7280', lineHeight: '24px' }}>选择目标:</span>
                {game.hamsters.map(h => (
                  <button
                    key={h.id}
                    className="btn btn-sm"
                    onClick={() => {
                      dispatch({ type: 'USE_SKILL', angelId: angel.id, skillId: skillTarget.skillId, targetId: h.id });
                      setSkillTarget(null);
                    }}
                  >
                    {h.name} (💛{h.mood})
                  </button>
                ))}
              </div>
            )}

            {/* 展开详情 */}
            {expanded && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                {/* 升级 */}
                <div style={{ marginBottom: 8 }}>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={!levelCheck.ok}
                    onClick={() => dispatch({ type: 'LEVEL_UP_ANGEL', angelId: angel.id })}
                    title={levelCheck.reason}
                  >
                    {angel.level >= 5 ? '已满级' : `升级到 Lv.${angel.level + 1}`}
                  </button>
                  {!levelCheck.ok && levelCheck.reason && (
                    <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{levelCheck.reason}</span>
                  )}
                </div>

                {/* 技能详情 */}
                <div style={{ fontSize: 12 }}>
                  {angel.skills.map(sk => {
                    const def = getSkillDef(sk.skillId);
                    return (
                      <div key={sk.skillId} style={{ marginBottom: 4 }}>
                        <span style={{ fontWeight: 500 }}>{def?.name ?? sk.skillId}</span>
                        <span style={{ color: '#6b7280' }}> — {def?.description ?? ''}</span>
                        <span style={{ color: '#9ca3af' }}> (CD:{def?.cooldown ?? '?'}回合, Lv.{sk.unlockedAtAngelLevel}解锁)</span>
                      </div>
                    );
                  })}
                </div>

                {/* 记忆 */}
                {angel.memory.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>记忆 ({angel.memory.length})</div>
                    {angel.memory.slice(-3).map((m, i) => (
                      <div key={i} style={{ fontSize: 11, color: '#374151', lineHeight: 1.4 }}>
                        {m.important && '⭐ '}[回合{m.turn}] {m.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Angels;
