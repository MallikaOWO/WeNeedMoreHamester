// 3.3.5 天使页 — 天使卡片 + 技能 + 升级

import React, { useState } from 'react';
import { useStore } from '../store';
import { getTabGuides } from '../guides';
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
  const { state, dispatch, interactWithCharacter } = useStore();
  const game = state.game;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [skillTarget, setSkillTarget] = useState<{ angelId: string; skillId: string } | null>(null);

  const tips = getTabGuides(game).angels;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tips && tips.length > 0 && (
        <div className="card" style={{ background: '#eff6ff', borderColor: '#3b82f6' }}>
          {tips.map((tip, i) => (
            <div key={i} style={{ color: '#1e40af', fontSize: 13, lineHeight: 1.6 }}>{tip}</div>
          ))}
        </div>
      )}
      {Object.entries(game.angels).map(([angelId, angel]) => {
        const expanded = expandedId === angelId;
        const preset = ANGEL_PRESETS.find(p => p.id === angelId);
        const facilityType = angel.assignedFacility ? game.facilities[angel.assignedFacility]?.type : null;
        const facilityName = facilityType
          ? (getFacilityDef(facilityType)?.name ?? '未知')
          : '空闲';
        const levelCheck = canLevelUp(game, angelId);

        return (
          <div key={angelId} className="card">
            {/* 头部 */}
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setExpandedId(expanded ? null : angelId)}
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
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(angel.skills).map(([skId, sk]) => {
                const def = getSkillDef(skId);
                const locked = angel.level < sk.unlockedAtAngelLevel;
                const onCooldown = sk.cooldownLeft > 0;
                const canUse = !locked && !onCooldown;
                const needsTarget = def?.effectType === 'heal_mood';
                const isSelectingTarget = skillTarget?.angelId === angelId && skillTarget?.skillId === skId;

                return (
                  <div key={skId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      className="btn btn-sm"
                      disabled={!canUse}
                      style={{
                        opacity: locked ? 0.3 : 1,
                        flexShrink: 0,
                      }}
                      onClick={() => {
                        if (needsTarget && Object.keys(game.hamsters).length > 0) {
                          setSkillTarget(isSelectingTarget ? null : { angelId, skillId: skId });
                        } else {
                          dispatch({ type: 'USE_SKILL', angelId, skillId: skId });
                        }
                      }}
                    >
                      {def?.name ?? skId}
                      {onCooldown && <span style={{ fontSize: 10, marginLeft: 2 }}>({sk.cooldownLeft})</span>}
                      {locked && <span style={{ fontSize: 10, marginLeft: 2 }}>🔒</span>}
                    </button>
                    <span style={{ fontSize: 11, color: locked ? '#d1d5db' : '#9ca3af' }}>
                      {locked ? `Lv.${sk.unlockedAtAngelLevel} 解锁` : def?.description}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* 技能目标选择 */}
            {skillTarget?.angelId === angelId && (
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ fontSize: 12, color: '#6b7280', lineHeight: '24px' }}>选择目标:</span>
                {Object.entries(game.hamsters).map(([hId, h]) => (
                  <button
                    key={hId}
                    className="btn btn-sm"
                    onClick={() => {
                      dispatch({ type: 'USE_SKILL', angelId, skillId: skillTarget.skillId, targetId: hId });
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
                <div style={{ marginBottom: 8, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-sm btn-primary"
                    disabled={!levelCheck.ok}
                    onClick={() => dispatch({ type: 'LEVEL_UP_ANGEL', angelId })}
                    title={levelCheck.reason}
                  >
                    {angel.level >= 5 ? '已满级' : `升级到 Lv.${angel.level + 1}`}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => interactWithCharacter(angelId)}
                    disabled={state.generating}
                  >
                    {state.generating ? '互动中...' : '互动'}
                  </button>
                  {!levelCheck.ok && levelCheck.reason && (
                    <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 2 }}>{levelCheck.reason}</span>
                  )}
                </div>

                {/* 技能详情 */}
                <div style={{ fontSize: 12 }}>
                  {Object.entries(angel.skills).map(([skId, sk]) => {
                    const def = getSkillDef(skId);
                    return (
                      <div key={skId} style={{ marginBottom: 4 }}>
                        <span style={{ fontWeight: 500 }}>{def?.name ?? skId}</span>
                        <span style={{ color: '#6b7280' }}> — {def?.description ?? ''}</span>
                        <span style={{ color: '#9ca3af' }}> (CD:{def?.cooldown ?? '?'}回合, Lv.{sk.unlockedAtAngelLevel}解锁)</span>
                      </div>
                    );
                  })}
                </div>

                {/* 记忆 */}
                {Object.keys(angel.memory).length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>记忆 ({Object.keys(angel.memory).length})</div>
                    {Object.entries(angel.memory).slice(-3).map(([key, text]) => (
                      <div key={key} style={{ fontSize: 11, color: '#374151', lineHeight: 1.4 }}>
                        {key.startsWith('!') && '⭐ '}[{key}] {text}
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
