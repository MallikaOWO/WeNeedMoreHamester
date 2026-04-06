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

  const getCatIcon = (cat: string) => {
    switch (cat) {
      case 'play': return '🎡';
      case 'living': return '🏠';
      case 'function': return '⚙️';
      default: return '🏗️';
    }
  };

  return (
    <div className="fade-in">
      {/* 引导提示 */}
      {tips && tips.length > 0 && (
        <div className="card guide-card" style={{ marginBottom: 16 }}>
           <div style={{ fontWeight: 700, marginBottom: 4 }}>💡 扩建指南</div>
          {tips.map((tip, i) => (
            <div key={i} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: i < tips.length - 1 ? 4 : 0 }}>{tip}</div>
          ))}
        </div>
      )}

      {/* 已建设施 */}
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-muted)', marginBottom: 10, paddingLeft: 4 }}>
        🏟️ 已落成的设施 ({facilityEntries.length})
      </div>
      
      {facilityEntries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '40px 20px', marginBottom: 16 }}>
           <div style={{ fontSize: 40, marginBottom: 12 }}>🏗️</div>
           <div>乐园还是空荡荡的...</div>
           <div style={{ fontSize: 12, marginTop: 4 }}>快去建造第一个设施吧！</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {facilityEntries.map(([fId, f]) => {
            const def = getFacilityDef(f.type);
            const name = def?.name ?? f.type;
            const manager = f.managedBy
              ? game.angels[f.managedBy]?.name ?? '未知'
              : '无天使值守';
            const upgradeCheck = canUpgrade(game, fId);
            const cost = def ? getUpgradeCost(def, f.level) : null;
            const occupantCount = Object.keys(f.occupants).length;

            return (
              <div key={fId} className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 20 }}>{getCatIcon(def?.category ?? '')}</span>
                      <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--color-text)' }}>{name}</span>
                      <span style={{ fontSize: 11, background: 'var(--color-happiness)', color: 'white', padding: '1px 6px', borderRadius: 6, fontWeight: 800 }}>Lv.{f.level}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                      {def?.category === 'play' && <span style={{ color: 'var(--color-energy)', fontWeight: 700 }}>⚡ +{def.basePower}/回合 </span>}
                      {def?.specialEffect && <span style={{ color: 'var(--color-stardust)', fontWeight: 700 }}>🌟 {def.specialEffect}</span>}
                    </div>
                  </div>
                  {f.level < 3 && (
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={!upgradeCheck.ok}
                      onClick={() => dispatch({ type: 'UPGRADE_FACILITY', facilityId: fId })}
                      style={{ fontSize: 11, padding: '6px 10px' }}
                    >
                      🚀 升级 {cost && `(⚡${cost.energy}${cost.stardust > 0 ? ` ✨${cost.stardust}` : ''})`}
                    </button>
                  )}
                </div>

                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '10px 12px', borderRadius: 12, marginTop: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {f.capacity > 0 && (
                        <span>
                          {def?.category === 'living' ? '🏠 住户' : '🎡 玩耍中'}: 
                          <span style={{ color: 'var(--color-text)', fontWeight: 700, marginLeft: 4 }}>
                            {def?.category === 'living' 
                              ? Object.values(game.hamsters).filter(h => h.livingAt === fId).length 
                              : occupantCount}/{f.capacity}
                          </span>
                        </span>
                      )}
                    </span>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      👼 管理: <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{manager}</span>
                    </span>
                  </div>

                  {/* 居民/玩耍鼠鼠列表 */}
                  {def?.category === 'living' ? (() => {
                    const residents = Object.entries(game.hamsters).filter(([, h]) => h.livingAt === fId);
                    return residents.length > 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 4 }}>
                        <span style={{ color: 'var(--color-happiness)' }}>♥</span> {residents.map(([, h]) => h.name).join('、')}
                      </div>
                    ) : null;
                  })() : occupantCount > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 4 }}>
                      <span style={{ color: 'var(--color-energy)' }}>☀</span> {Object.keys(f.occupants).map(id => game.hamsters[id]?.name ?? id).join('、')}
                    </div>
                  )}
                </div>

                {!upgradeCheck.ok && f.level < 3 && upgradeCheck.reason && (
                  <div style={{ fontSize: 11, color: 'var(--color-mood)', marginTop: 8, fontWeight: 700, textAlign: 'right' }}>
                    ⚠️ {upgradeCheck.reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 建造按钮 */}
      <div style={{ paddingBottom: 20 }}>
        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '14px 0', fontSize: 16, borderRadius: 20, boxShadow: '0 4px 0 #D14D8E' }}
          onClick={() => setShowBuild(!showBuild)}
        >
          {showBuild ? '❌ 取消建造' : '🏗️ 建造新设施'}
        </button>

        {/* 建造列表 */}
        {showBuild && (
          <div className="fade-in" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(['play', 'living', 'function'] as const).map(cat => {
              const catLabel = { play: '玩耍', living: '生活', function: '功能' }[cat];
              const defs = FACILITY_DEFS.filter(d => d.category === cat);
              return (
                <div key={cat}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-text-muted)', marginBottom: 8, paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{getCatIcon(cat)}</span> {catLabel}类蓝图
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {defs.map(def => {
                      const check = canBuild(game, def.type);
                      return (
                        <div
                          key={def.type}
                          className="card"
                          style={{ 
                            marginBottom: 0, 
                            opacity: check.ok ? 1 : 0.7, 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            padding: '12px 16px',
                            background: check.ok ? 'white' : '#F3F4F6'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 800, color: 'var(--color-text)' }}>{def.name}</span>
                              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{def.description}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <span>💰 <span style={{ color: 'var(--color-energy)', fontWeight: 700 }}>⚡{def.cost.energy}</span>{def.cost.stardust > 0 ? <span style={{ color: 'var(--color-stardust)', fontWeight: 700 }}> ✨{def.cost.stardust}</span> : ''}</span>
                              <span>🛠️ 维护: <span style={{ color: 'var(--color-mood)' }}>⚡{def.maintenanceCost}</span></span>
                              <span>👼 天使: Lv.{def.requiredAngelLevel}+</span>
                              {def.capacity > 0 && <span>👥 容量: {def.capacity}</span>}
                            </div>
                            {def.specialEffect && (
                              <div style={{ fontSize: 11, color: 'var(--color-stardust)', fontWeight: 700, marginTop: 2 }}>🌟 {def.specialEffect}</div>
                            )}
                          </div>
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={!check.ok}
                            onClick={() => {
                              dispatch({ type: 'BUILD_FACILITY', facilityType: def.type });
                              setShowBuild(false);
                            }}
                            title={check.reason}
                            style={{ padding: '8px 16px', fontSize: 12 }}
                          >
                            建造
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Facilities;
