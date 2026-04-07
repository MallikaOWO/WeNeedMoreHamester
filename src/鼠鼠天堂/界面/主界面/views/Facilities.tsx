// 3.3.3 设施页 — 网格化乐园地图 + 分区 + 建造/升级

import React, { useState } from 'react';
import { useStore } from '../store';
import { getTabGuides } from '../guides';
import { FACILITY_DEFS, getFacilityDef, getUpgradeCost, getMaintenanceCost } from '../../../data/facilities';
import { canBuild, canUpgrade, canDemolish, MAX_FACILITY_SLOTS } from '../../../engine/facility';
import { STAMINA_COST_PER_TURN } from '../../../engine/turn';

const CAT_LABEL: Record<string, { icon: string; name: string }> = {
  play: { icon: '🎡', name: '玩耍区' },
  living: { icon: '🏠', name: '生活区' },
  function: { icon: '⚙️', name: '功能区' },
};

const Facilities: React.FC = () => {
  const { state, dispatch } = useStore();
  const game = state.game;
  const [expandedTile, setExpandedTile] = useState<string | null>(null);
  const [buildingCat, setBuildingCat] = useState<string | null>(null);

  const facilityEntries = Object.entries(game.facilities);
  const tips = getTabGuides(game).facilities;
  const totalSlots = MAX_FACILITY_SLOTS;
  const [confirmDemolish, setConfirmDemolish] = useState<string | null>(null);

  // 按类别分组
  const byCategory: Record<string, [string, typeof game.facilities[string]][]> = { play: [], living: [], function: [] };
  for (const entry of facilityEntries) {
    const def = getFacilityDef(entry[1].type);
    const cat = def?.category ?? 'function';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(entry);
  }

  return (
    <div className="fade-in">
      {tips && tips.length > 0 && (
        <div className="card guide-card">
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>💡 扩建指南</div>
          {tips.map((tip, i) => (
            <div key={i} style={{ fontSize: 12, lineHeight: 1.5 }}>{tip}</div>
          ))}
        </div>
      )}

      {/* 乐园规模 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', marginBottom: 8, fontSize: 12 }}>
        <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>乐园规模</span>
        <div className="bar-track" style={{ flex: 1, height: 6 }}>
          <div className="bar-fill" style={{ width: `${Math.min(100, (facilityEntries.length / totalSlots) * 100)}%`, background: 'var(--color-accent)' }} />
        </div>
        <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{facilityEntries.length}/{totalSlots}</span>
      </div>

      {/* 按类别分区 */}
      {(['play', 'living', 'function'] as const).map(cat => {
        const catInfo = CAT_LABEL[cat];
        const entries = byCategory[cat] ?? [];
        const buildable = FACILITY_DEFS.filter(d => d.category === cat);
        const canBuildMore = buildable.some(d => canBuild(game, d.type).ok);
        const isBuildingHere = buildingCat === cat;

        return (
          <div key={cat} style={{ marginBottom: 12 }}>
            <div className="zone-header">
              <span>{catInfo.icon}</span> {catInfo.name}
              <span style={{ color: 'var(--color-text-light)' }}>({entries.length})</span>
            </div>

            <div className="facility-grid">
              {/* 已建设施 */}
              {entries.map(([fId, f]) => {
                const def = getFacilityDef(f.type);
                const name = def?.name ?? f.type;
                const manager = f.managedBy ? game.angels[f.managedBy]?.name : null;
                const upgradeCheck = canUpgrade(game, fId);
                const cost = def ? getUpgradeCost(def, f.level) : null;
                const isExpanded = expandedTile === fId;
                const occupantCount = def?.category === 'living'
                  ? Object.values(game.hamsters).filter(h => h.livingAt === fId).length
                  : Object.keys(f.occupants).length;

                return (
                  <div
                    key={fId}
                    className="facility-tile"
                    data-level={String(f.level)}
                    style={{ cursor: 'pointer', position: 'relative' }}
                    onClick={() => setExpandedTile(isExpanded ? null : fId)}
                  >
                    {/* 升级按钮 */}
                    {f.level < 3 && upgradeCheck.ok && (
                      <div
                        style={{ position: 'absolute', top: 4, right: 4, fontSize: 14, cursor: 'pointer', lineHeight: 1 }}
                        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPGRADE_FACILITY', facilityId: fId }); }}
                        title={cost ? `升级 ⚡${cost.energy}${cost.stardust > 0 ? ` ✨${cost.stardust}` : ''}` : '升级'}
                      >
                        ⬆️
                      </div>
                    )}

                    <div style={{ fontSize: 20, lineHeight: 1 }}>{catInfo.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>{name}</div>
                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                      Lv.{f.level} · {f.capacity > 0 ? `🐹${occupantCount}/${f.capacity}` : '—'}
                    </div>
                    {manager && <div style={{ fontSize: 10, color: 'var(--color-stardust)' }}>👼 {manager}</div>}
                    {!manager && <div style={{ fontSize: 10, color: 'var(--color-negative)' }}>⚠ 无天使</div>}

                    {/* 展开详情 */}
                    {isExpanded && (
                      <div className="fade-in" style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--color-border)', textAlign: 'left', fontSize: 11 }}>
                        {def?.category === 'play' && def.basePower > 0 && <div>⚡ 产能 +{def.basePower}/回合</div>}
                        {def?.category === 'play' && <div style={{ color: 'var(--color-text-muted)' }}>🏃 体力消耗 -{STAMINA_COST_PER_TURN}/回合</div>}
                        {def?.category === 'living' && def.moodRegen > 0 && <div>💝 心情恢复 +{def.moodRegen}/回合 (基础)</div>}
                        {def?.specialEffect && <div style={{ color: 'var(--color-stardust)' }}>🌟 {def.specialEffect}</div>}
                        {def && <div style={{ color: 'var(--color-text-muted)' }}>维护: ⚡{getMaintenanceCost(def, f.level)}/回合{f.level > 1 ? ` (基础${def.maintenanceCost}×${(1 + (f.level - 1) * 0.5).toFixed(1)})` : ''}</div>}
                        {f.level < 3 && cost && (
                          <div style={{ marginTop: 4 }}>
                            <button
                              className="btn btn-sm btn-primary"
                              disabled={!upgradeCheck.ok}
                              onClick={(e) => { e.stopPropagation(); dispatch({ type: 'UPGRADE_FACILITY', facilityId: fId }); }}
                              style={{ width: '100%', fontSize: 11 }}
                            >
                              升级 Lv.{f.level + 1} (⚡{cost.energy}{cost.stardust > 0 ? ` ✨${cost.stardust}` : ''})
                            </button>
                            {!upgradeCheck.ok && upgradeCheck.reason && (
                              <div style={{ color: 'var(--color-negative)', marginTop: 2, fontSize: 10 }}>{upgradeCheck.reason}</div>
                            )}
                          </div>
                        )}
                        {/* 居民列表 */}
                        {(() => {
                          const names = def?.category === 'living'
                            ? Object.values(game.hamsters).filter(h => h.livingAt === fId).map(h => h.name)
                            : Object.keys(f.occupants).map(id => game.hamsters[id]?.name ?? id);
                          return names.length > 0 ? (
                            <div style={{ marginTop: 2, color: 'var(--color-text-muted)' }}>🐹 {names.join('、')}</div>
                          ) : null;
                        })()}
                        {/* 拆除按钮 */}
                        {(() => {
                          const demolishCheck = canDemolish(game, fId);
                          return (
                            <div style={{ marginTop: 6 }}>
                              {confirmDemolish === fId ? (
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                  <span style={{ fontSize: 10, color: 'var(--color-negative)' }}>确认拆除？返还 ⚡{def ? Math.floor(def.cost.energy * 0.5) : 0}{def && def.cost.stardust > 0 ? ` ✨${Math.floor(def.cost.stardust * 0.5)}` : ''}</span>
                                  <button
                                    className="btn btn-sm"
                                    style={{ background: 'var(--color-negative)', color: '#fff', fontSize: 10, padding: '2px 8px' }}
                                    onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DEMOLISH_FACILITY', facilityId: fId }); setConfirmDemolish(null); setExpandedTile(null); }}
                                  >
                                    确认
                                  </button>
                                  <button
                                    className="btn btn-sm"
                                    style={{ fontSize: 10, padding: '2px 8px' }}
                                    onClick={(e) => { e.stopPropagation(); setConfirmDemolish(null); }}
                                  >
                                    取消
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    className="btn btn-sm"
                                    disabled={!demolishCheck.ok}
                                    style={{ width: '100%', fontSize: 11, color: 'var(--color-negative)', borderColor: 'var(--color-negative)', background: 'transparent', opacity: demolishCheck.ok ? 1 : 0.5 }}
                                    onClick={(e) => { e.stopPropagation(); setConfirmDemolish(fId); }}
                                  >
                                    🗑 拆除设施
                                  </button>
                                  {!demolishCheck.ok && demolishCheck.reason && (
                                    <div style={{ color: 'var(--color-negative)', marginTop: 2, fontSize: 10 }}>{demolishCheck.reason}</div>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 空地块 */}
              {canBuildMore && (
                <div
                  className="facility-empty"
                  onClick={() => setBuildingCat(isBuildingHere ? null : cat)}
                >
                  <span style={{ fontSize: 20 }}>＋</span>
                  <span>建造</span>
                </div>
              )}
            </div>

            {/* 该类别建造列表 */}
            {isBuildingHere && (
              <div className="fade-in" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {buildable.map(def => {
                  const check = canBuild(game, def.type);
                  return (
                    <div
                      key={def.type}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 10px', borderRadius: 'var(--radius-md)',
                        background: check.ok ? 'var(--color-card-bg)' : 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        opacity: check.ok ? 1 : 0.6,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{def.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>{def.description}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <span>⚡{def.cost.energy}{def.cost.stardust > 0 ? <> ✨{def.cost.stardust}</> : ''}</span>
                          <span>维护 ⚡{def.maintenanceCost}</span>
                          {def.capacity > 0 && <span>容量 {def.capacity}</span>}
                        </div>
                      </div>
                      <button
                        className="btn btn-sm btn-primary"
                        disabled={!check.ok}
                        onClick={() => { dispatch({ type: 'BUILD_FACILITY', facilityType: def.type }); setBuildingCat(null); }}
                        title={check.reason}
                        style={{ flexShrink: 0, marginLeft: 8 }}
                      >
                        建造
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Facilities;
