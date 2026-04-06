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
  const [memoryExpanded, setMemoryExpanded] = useState<Record<string, boolean>>({});
  const [skillTarget, setSkillTarget] = useState<{ angelId: string; skillId: string } | null>(null);

  const tips = getTabGuides(game).angels;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tips && tips.length > 0 && (
        <div className="card guide-card">
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>💡 守护者</div>
          {tips.map((tip, i) => (
            <div key={i} style={{ fontSize: 12, lineHeight: 1.5 }}>{tip}</div>
          ))}
        </div>
      )}
      {Object.entries(game.angels).map(([angelId, angel]) => {
        const expanded = expandedId === angelId;
        const preset = ANGEL_PRESETS.find(p => p.id === angelId);
        const domainFacilities = Object.entries(game.facilities).filter(([, f]) => f.managedBy === angelId);
        const facilityLabel = domainFacilities.length > 0
          ? `守护 ${domainFacilities.length} 个设施`
          : '暂无设施';
        const levelCheck = canLevelUp(game, angelId);

        return (
          <div key={angelId} className="card" style={{
            background: 'linear-gradient(135deg, #fff 0%, var(--color-stardust-bg) 100%)',
            borderColor: 'var(--color-stardust)',
            padding: 0,
            overflow: 'hidden'
          }}>
            {/* 头部 */}
            <div
              style={{ padding: '10px 12px 8px', cursor: 'pointer', background: expanded ? 'rgba(109, 208, 200, 0.05)' : 'transparent' }}
              onClick={() => setExpandedId(expanded ? null : angelId)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>{angel.name}</span>
                  <span style={{ fontSize: 10, background: 'var(--color-stardust)', color: 'white', padding: '1px 6px', borderRadius: 'var(--radius-sm)', fontWeight: 700 }}>Lv.{angel.level}</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-stardust)' }}>{DOMAIN_LABELS[angel.manageDomain] ?? angel.manageDomain}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>✨ {facilityLabel}</span>
                {preset && <span style={{ fontStyle: 'italic', opacity: 0.7 }}>「{preset.personalityKeywords[0]}」</span>}
              </div>
              {preset && (
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, background: 'white', padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
                  {preset.description}
                </div>
              )}
            </div>

            {/* 技能面板 */}
            <div style={{ padding: '0 12px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-stardust)', margin: '8px 0 6px' }}>🔮 技能</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(angel.skills).map(([skId, sk]) => {
                  const def = getSkillDef(skId);
                  const locked = angel.level < sk.unlockedAtAngelLevel;
                  const onCooldown = sk.cooldownLeft > 0;
                  const canUse = !locked && !onCooldown;
                  const needsHamsterTarget = def?.effectType === 'heal_mood';
                  const needsFacilityTarget = def?.effectType === 'boost_production' || def?.effectType === 'repair_facility';
                  const isSelectingTarget = skillTarget?.angelId === angelId && skillTarget?.skillId === skId;

                  return (
                    <div key={skId} style={{
                      display: 'flex', flexDirection: 'column', gap: 4,
                      background: locked ? 'var(--color-surface)' : 'white',
                      padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                      border: isSelectingTarget ? '2px solid var(--color-stardust)' : '1px solid var(--color-border)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          className="btn btn-sm"
                          disabled={!canUse}
                          style={{
                            background: locked ? 'var(--color-surface)' : (onCooldown ? 'var(--color-surface)' : 'white'),
                            color: locked ? 'var(--color-text-light)' : (onCooldown ? 'var(--color-text-muted)' : 'var(--color-stardust)'),
                            borderColor: canUse ? 'var(--color-stardust)' : 'transparent',
                            flexShrink: 0, minWidth: 72,
                          }}
                          onClick={() => {
                            if (needsHamsterTarget && Object.keys(game.hamsters).length > 0) {
                              setSkillTarget(isSelectingTarget ? null : { angelId, skillId: skId });
                            } else if (needsFacilityTarget && domainFacilities.length > 0) {
                              setSkillTarget(isSelectingTarget ? null : { angelId, skillId: skId });
                            } else {
                              dispatch({ type: 'USE_SKILL', angelId, skillId: skId });
                            }
                          }}
                        >
                          {locked ? '🔒 封印' : (onCooldown ? `⏳ ${sk.cooldownLeft}` : `✨ ${def?.name ?? skId}`)}
                        </button>
                        <div style={{ fontSize: 11, color: locked ? 'var(--color-text-light)' : 'var(--color-text)', lineHeight: 1.4 }}>
                          {locked ? `Lv.${sk.unlockedAtAngelLevel} 解锁` : def?.description}
                        </div>
                      </div>

                      {/* 目标选择 */}
                      {isSelectingTarget && (
                        <div className="fade-in" style={{ marginTop: 4, background: 'var(--color-stardust-bg)', padding: 8, borderRadius: 'var(--radius-sm)' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-stardust)', marginBottom: 4 }}>选择目标:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {(def?.effectType === 'boost_production' || def?.effectType === 'repair_facility')
                              ? domainFacilities.map(([fId, f]) => {
                                  const fDef = getFacilityDef(f.type);
                                  return (
                                    <button key={fId} className="btn btn-sm" onClick={() => { dispatch({ type: 'USE_SKILL', angelId, skillId: skId, targetId: fId }); setSkillTarget(null); }}>
                                      {fDef?.name ?? f.type}
                                    </button>
                                  );
                                })
                              : Object.entries(game.hamsters).map(([hId, h]) => (
                                  <button key={hId} className="btn btn-sm" onClick={() => { dispatch({ type: 'USE_SKILL', angelId, skillId: skId, targetId: hId }); setSkillTarget(null); }}>
                                    {h.name}
                                  </button>
                                ))
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 展开操作 */}
              {expanded && (
                <div className="fade-in" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--color-border)' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={!levelCheck.ok}
                      style={{ background: 'var(--color-stardust)', flex: 1 }}
                      onClick={() => dispatch({ type: 'LEVEL_UP_ANGEL', angelId })}
                    >
                      {angel.level >= 5 ? '⭐ 已满级' : `🌠 晋升 (✨${(angel.level + 1) * 5})`}
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => interactWithCharacter(angelId)}
                      disabled={state.generating}
                    >
                      {state.generating ? '交流中...' : '💬 交流'}
                    </button>
                  </div>

                  {!levelCheck.ok && levelCheck.reason && (
                    <div style={{ fontSize: 11, color: 'var(--color-negative)', marginBottom: 8, textAlign: 'center' }}>
                      ⚠ {levelCheck.reason}
                    </div>
                  )}

                  {/* 记忆 */}
                  {Object.keys(angel.memory).length > 0 && (() => {
                    const aId = angelId;
                    const entries = Object.entries(angel.memory);
                    const isExpanded = memoryExpanded[aId] ?? false;
                    const shown = isExpanded ? entries : entries.slice(-3);
                    const hasMore = entries.length > 3;
                    return (
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                          <span>🌌 记忆 ({entries.length})</span>
                          {hasMore && (
                            <span
                              style={{ color: 'var(--color-stardust)', cursor: 'pointer' }}
                              onClick={(e) => { e.stopPropagation(); setMemoryExpanded(p => ({ ...p, [aId]: !isExpanded })); }}
                            >
                              {isExpanded ? '收起 ▲' : '展开 ▼'}
                            </span>
                          )}
                        </div>
                        {shown.map(([key, text]) => (
                          <div key={key} style={{ fontSize: 11, color: 'var(--color-text)', lineHeight: 1.5, marginBottom: 2 }}>
                            {key.startsWith('!') ? '⭐ ' : '· '}{text}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Angels;
