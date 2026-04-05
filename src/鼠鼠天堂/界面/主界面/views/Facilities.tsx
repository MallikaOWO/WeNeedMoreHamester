// 3.3.3 设施页 — 已建设施 + 建造/升级

import React, { useState } from 'react';
import { useStore } from '../store';
import { getTabGuides } from '../guides';
import { FACILITY_DEFS, getFacilityDef, getUpgradeCost } from '../../../data/facilities';
import { canBuild, canUpgrade } from '../../../engine/facility';

const Facilities: React.FC = () => {
  const { state, dispatch } = useStore();
  const game = state.game;
  const [showBuild, setShowBuild] = useState(false);

  const facilityEntries = Object.entries(game.facilities);
  const tips = getTabGuides(game).facilities;

  return (
    <div>
      {/* 引导提示 */}
      {tips && tips.length > 0 && (
        <div className="card" style={{ marginBottom: 12, background: '#eff6ff', borderColor: '#3b82f6' }}>
          {tips.map((tip, i) => (
            <div key={i} style={{ color: '#1e40af', fontSize: 13, lineHeight: 1.6, marginBottom: i < tips.length - 1 ? 4 : 0 }}>{tip}</div>
          ))}
        </div>
      )}

      {/* 已建设施 */}
      {facilityEntries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#9ca3af', padding: 24, marginBottom: 12 }}>
          还没有建造任何设施
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {facilityEntries.map(([fId, f]) => {
            const def = getFacilityDef(f.type);
            const name = def?.name ?? f.type;
            const manager = f.managedBy
              ? game.angels[f.managedBy]?.name ?? '未知'
              : '无';
            const upgradeCheck = canUpgrade(game, fId);
            const cost = def ? getUpgradeCost(def, f.level) : null;
            const occupantCount = Object.keys(f.occupants).length;

            return (
              <div key={fId} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{name}</span>
                    <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>Lv.{f.level}</span>
                  </div>
                  {def?.category === 'play' && (
                    <span style={{ fontSize: 12, color: 'var(--color-energy)' }}>⚡ {def.basePower}/回合</span>
                  )}
                </div>

                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  {f.capacity > 0 && (
                    <span>
                      {def?.category === 'living'
                        ? `住户: ${Object.values(game.hamsters).filter(h => h.livingAt === fId).length}/${f.capacity}`
                        : `玩耍中: ${occupantCount}/${f.capacity}`
                      } |{' '}
                    </span>
                  )}
                  管理: {manager}
                  {def?.specialEffect && <span> | {def.specialEffect}</span>}
                </div>

                {/* 居民/玩耍鼠鼠列表 */}
                {def?.category === 'living' ? (() => {
                  const residents = Object.entries(game.hamsters).filter(([, h]) => h.livingAt === fId);
                  return residents.length > 0 ? (
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      住户: {residents.map(([, h]) => h.name).join('、')}
                    </div>
                  ) : null;
                })() : occupantCount > 0 && (
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    玩耍中: {Object.keys(f.occupants).map(id => game.hamsters[id]?.name ?? id).join('、')}
                  </div>
                )}

                {/* 升级按钮 */}
                {f.level < 3 && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      className="btn btn-sm"
                      disabled={!upgradeCheck.ok}
                      onClick={() => dispatch({ type: 'UPGRADE_FACILITY', facilityId: fId })}
                      title={upgradeCheck.reason}
                    >
                      升级 {cost && `(⚡${cost.energy}${cost.stardust > 0 ? ` ✨${cost.stardust}` : ''})`}
                    </button>
                    {!upgradeCheck.ok && upgradeCheck.reason && (
                      <span style={{ fontSize: 11, color: '#ef4444' }}>{upgradeCheck.reason}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 建造按钮 */}
      <button
        className="btn btn-primary"
        style={{ width: '100%', marginBottom: 8 }}
        onClick={() => setShowBuild(!showBuild)}
      >
        {showBuild ? '收起' : '建造新设施'}
      </button>

      {/* 建造列表 */}
      {showBuild && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(['play', 'living', 'function'] as const).map(cat => {
            const catLabel = { play: '玩耍', living: '生活', function: '功能' }[cat];
            const defs = FACILITY_DEFS.filter(d => d.category === cat);
            return (
              <div key={cat}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>{catLabel}设施</div>
                {defs.map(def => {
                  const check = canBuild(game, def.type);
                  return (
                    <div
                      key={def.type}
                      className="card"
                      style={{ marginBottom: 4, opacity: check.ok ? 1 : 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <div>
                        <span style={{ fontWeight: 500 }}>{def.name}</span>
                        {def.description && (
                          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{def.description}</div>
                        )}
                        <div style={{ fontSize: 11, color: '#6b7280' }}>
                          {def.capacity > 0 && `容量:${def.capacity} | `}⚡{def.cost.energy}{def.cost.stardust > 0 ? ` ✨${def.cost.stardust}` : ''} | 维护⚡{def.maintenanceCost}/回合 | 天使Lv.{def.requiredAngelLevel}+
                          {def.specialEffect && ` | ${def.specialEffect}`}
                        </div>
                      </div>
                      <button
                        className="btn btn-sm btn-primary"
                        disabled={!check.ok}
                        onClick={() => {
                          dispatch({ type: 'BUILD_FACILITY', facilityType: def.type });
                          setShowBuild(false);
                        }}
                        title={check.reason}
                      >
                        建造
                      </button>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Facilities;
