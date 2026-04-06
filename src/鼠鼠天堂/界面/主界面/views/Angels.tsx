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
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {tips && tips.length > 0 && (
        <div className="card guide-card">
           <div style={{ fontWeight: 700, marginBottom: 4 }}>💡 乐园守护者</div>
          {tips.map((tip, i) => (
            <div key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>{tip}</div>
          ))}
        </div>
      )}
      {Object.entries(game.angels).map(([angelId, angel]) => {
        const expanded = expandedId === angelId;
        const preset = ANGEL_PRESETS.find(p => p.id === angelId);
        const domainFacilities = Object.entries(game.facilities).filter(([, f]) => f.managedBy === angelId);
        const facilityLabel = domainFacilities.length > 0
          ? `✨ 守护着 ${domainFacilities.length} 个设施`
          : '🔭 暂无守护设施';
        const levelCheck = canLevelUp(game, angelId);

        return (
          <div key={angelId} className="card" style={{ 
            background: 'linear-gradient(135deg, #fff 0%, #f5f3ff 100%)',
            borderColor: 'var(--color-stardust)',
            padding: 0,
            overflow: 'hidden'
          }}>
            {/* 头部 */}
            <div
              style={{ padding: '16px 16px 12px', cursor: 'pointer', background: expanded ? 'rgba(167, 139, 250, 0.05)' : 'transparent' }}
              onClick={() => setExpandedId(expanded ? null : angelId)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--color-text)' }}>{angel.name}</span>
                  <span style={{ fontSize: 11, background: 'var(--color-stardust)', color: 'white', padding: '1px 8px', borderRadius: 10, fontWeight: 800 }}>Lv.{angel.level}</span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-stardust)' }}>{DOMAIN_LABELS[angel.manageDomain] ?? angel.manageDomain}之翼</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>{facilityLabel}</span>
                {preset && <span style={{ fontStyle: 'italic', opacity: 0.8 }}>「{preset.personalityKeywords[0]}」</span>}
              </div>
              {preset && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', background: 'white', padding: '8px 12px', borderRadius: 12, border: '1px solid #EDE9FE' }}>
                  {preset.description}
                </div>
              )}
            </div>

            {/* 技能面板 */}
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-stardust)', margin: '12px 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🔮</span> 奇迹之术
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: 4,
                      background: locked ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.6)',
                      padding: 8,
                      borderRadius: 12,
                      border: isSelectingTarget ? '2px solid var(--color-stardust)' : '1px solid #EDE9FE'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          className="btn btn-sm"
                          disabled={!canUse}
                          style={{
                            background: locked ? '#E5E7EB' : (onCooldown ? '#F3F4F6' : 'white'),
                            color: locked ? '#9CA3AF' : (onCooldown ? 'var(--color-text-muted)' : 'var(--color-stardust)'),
                            boxShadow: canUse ? '0 2px 0 #DDD6FE' : 'none',
                            flexShrink: 0,
                            minWidth: 80,
                            borderColor: canUse ? '#DDD6FE' : 'transparent',
                            borderWidth: 1,
                            borderStyle: 'solid'
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
                          {locked ? '🔒 封印中' : (onCooldown ? `⏳ (${sk.cooldownLeft})` : `✨ ${def?.name ?? skId}`)}
                        </button>
                        <div style={{ fontSize: 11, color: locked ? '#D1D5DB' : 'var(--color-text)', lineHeight: 1.4 }}>
                          {locked ? `天使等级达到 Lv.${sk.unlockedAtAngelLevel} 时苏醒` : def?.description}
                        </div>
                      </div>

                      {/* 目标选择 UI */}
                      {isSelectingTarget && (
                        <div className="fade-in" style={{ marginTop: 8, background: '#F5F3FF', padding: 10, borderRadius: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-stardust)', marginBottom: 6 }}>选择奇迹降临的对象:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {(def?.effectType === 'boost_production' || def?.effectType === 'repair_facility')
                              ? domainFacilities.map(([fId, f]) => {
                                  const fDef = getFacilityDef(f.type);
                                  return (
                                    <button
                                      key={fId}
                                      className="btn btn-sm"
                                      onClick={() => {
                                        dispatch({ type: 'USE_SKILL', angelId, skillId: skId, targetId: fId });
                                        setSkillTarget(null);
                                      }}
                                    >
                                      {fDef?.name ?? f.type}
                                    </button>
                                  );
                                })
                              : Object.entries(game.hamsters).map(([hId, h]) => (
                                  <button
                                    key={hId}
                                    className="btn btn-sm"
                                    onClick={() => {
                                      dispatch({ type: 'USE_SKILL', angelId, skillId: skId, targetId: hId });
                                      setSkillTarget(null);
                                    }}
                                  >
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
                <div className="fade-in" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--color-stardust)' }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={!levelCheck.ok}
                      style={{ background: 'var(--color-stardust)', boxShadow: '0 2px 0 #8B5CF6', flex: 1 }}
                      onClick={() => dispatch({ type: 'LEVEL_UP_ANGEL', angelId })}
                    >
                      {angel.level >= 5 ? '⭐ 已登峰造极' : `🌠 晋升等级 (✨${(angel.level + 1) * 5})`}
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ background: 'white', color: 'var(--color-stardust)', flex: 1 }}
                      onClick={() => interactWithCharacter(angelId)}
                      disabled={state.generating}
                    >
                      {state.generating ? '✨ 祈祷中...' : '💬 与天使交流'}
                    </button>
                  </div>

                  {!levelCheck.ok && levelCheck.reason && (
                    <div style={{ fontSize: 11, color: 'var(--color-mood)', marginBottom: 12, fontWeight: 700, textAlign: 'center' }}>
                      ⚠️ {levelCheck.reason}
                    </div>
                  )}

                  {/* 记忆碎片 */}
                  {Object.keys(angel.memory).length > 0 && (() => {
                    const entries = Object.entries(angel.memory);
                    const isExpanded = memoryExpanded[angelId] ?? false;
                    const shown = isExpanded ? entries : entries.slice(-3);
                    const hasMore = entries.length > 3;
                    return (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-stardust)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                          <span>🌌 往昔碎片</span>
                          {hasMore && (
                            <span
                              style={{ color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: 11 }}
                              onClick={(e) => { e.stopPropagation(); setMemoryExpanded(p => ({ ...p, [angelId]: !isExpanded })); }}
                            >
                              {isExpanded ? '封存 ▲' : `揭开更多 (${entries.length}) ▼`}
                            </span>
                          )}
                        </div>
                        <div style={{ background: '#F5F3FF', padding: '12px', borderRadius: 16, border: '1px solid #DDD6FE' }}>
                          {shown.map(([key, text]) => (
                            <div key={key} style={{ fontSize: 12, color: '#5B21B6', lineHeight: 1.6, marginBottom: 6, display: 'flex', gap: 8 }}>
                              <span style={{ opacity: 0.5 }}>{key.startsWith('!') ? '🌟' : '✦'}</span>
                              <span>{text}</span>
                            </div>
                          ))}
                        </div>
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
