// 3.3.1 总览页 — 资源栏 + 回合信息 + 叙事面板 + 产能明细 + 推进回合

import React, { useState } from 'react';
import { useStore } from '../store';
import { getTabGuides } from '../guides';
import { getFacilityDef } from '../../../data/facilities';
import { calcMoodMultiplier, calcAngelMult } from '../../../engine/turn';

/** 资源进度条 */
const ResourceBar: React.FC<{
  icon: string;
  label: string;
  value: number;
  max?: number;
  color: string;
}> = ({ icon, label, value, max, color }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'baseline' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{icon} {label}</span>
      <span style={{ fontSize: 15, fontWeight: 800, color: color }}>{value}{max != null ? <span style={{ fontSize: 12, color: 'var(--color-text-muted)', fontWeight: 400 }}> / {max}</span> : ''}</span>
    </div>
    {max != null && (
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color, boxShadow: `0 0 8px ${color}44` }}
        />
      </div>
    )}
  </div>
);

interface FacilityBreakdown {
  name: string;
  hamsterDetails: { name: string; base: number; facilityBase: number; levelMult: number; angelMult: number }[];
  subtotal: number;
}

interface MoodForecast {
  hamsterDetails: { name: string; current: number; delta: number; predicted: number }[];
  currentAvg: number;
  predictedAvg: number;
}

const MOOD_COST_PER_TURN = 8;

/** 预估下回合心情变化 */
function calcMoodForecast(game: ReturnType<typeof useStore>['state']['game']): MoodForecast {
  const hamsters = Object.values(game.hamsters);
  if (hamsters.length === 0) return { hamsterDetails: [], currentAvg: game.happiness, predictedAvg: game.happiness };

  const details: MoodForecast['hamsterDetails'] = [];

  for (const h of hamsters) {
    let delta = 0;

    // 工作消耗心情
    if (h.workingAt) {
      const livingFac = h.livingAt ? game.facilities[h.livingAt] : null;
      const livingAngel = livingFac?.managedBy ? game.angels[livingFac.managedBy] : null;
      const reduction = livingAngel?.manageDomain === 'life' ? Math.round(MOOD_COST_PER_TURN * 0.5) : MOOD_COST_PER_TURN;
      delta -= reduction;
    }

    // 休息中：生活设施心情恢复
    if (!h.workingAt && h.livingAt) {
      const fac = game.facilities[h.livingAt];
      if (fac?.managedBy) {
        const def = getFacilityDef(fac.type);
        if (def && def.category === 'living' && def.moodRegen > 0) {
          const levelMult = 1 + (fac.level - 1) * 0.3;
          const mianhuaBonus = game.angels[fac.managedBy]?.manageDomain === 'life' ? 1.3 : 1;
          delta += Math.round(def.moodRegen * levelMult * mianhuaBonus);
        }
      }
    }

    // 交谊厅全体加成
    for (const f of Object.values(game.facilities)) {
      if (f.type === 'lounge' && f.managedBy) {
        const levelMult = 1 + (f.level - 1) * 0.3;
        delta += Math.round(2 * levelMult);
      }
    }

    // Buff 效果：mood_regen / mood_drain
    for (const buff of Object.values(game.buffs)) {
      if (buff.type === 'mood_regen') {
        if (buff.target === 'global' || buff.target === Object.entries(game.hamsters).find(([, v]) => v === h)?.[0]) {
          delta += buff.value;
        }
      }
      if (buff.type === 'mood_drain') {
        if (buff.target === Object.entries(game.hamsters).find(([, v]) => v === h)?.[0]) {
          delta -= buff.value;
        }
      }
    }

    const predicted = Math.max(0, Math.min(100, h.mood + delta));
    details.push({ name: h.name, current: h.mood, delta, predicted });
  }

  const currentAvg = Math.round(details.reduce((s, d) => s + d.current, 0) / details.length);
  const predictedAvg = Math.round(details.reduce((s, d) => s + d.predicted, 0) / details.length);

  return { hamsterDetails: details, currentAvg, predictedAvg };
}

/** 计算产能明细 */
function calcProductionBreakdown(game: ReturnType<typeof useStore>['state']['game']): {
  facilities: FacilityBreakdown[];
  rawTotal: number;
  moodMult: number;
  finalTotal: number;
  maintenance: number;
  netTotal: number;
} {
  const facilities: FacilityBreakdown[] = [];
  let rawTotal = 0;

  for (const [fId, f] of Object.entries(game.facilities)) {
    const def = getFacilityDef(f.type);
    if (!def || def.category !== 'play' || def.basePower <= 0) continue;
    if (!f.managedBy) continue;
    const levelMult = 1 + (f.level - 1) * 0.3;
    const angel = f.managedBy ? game.angels[f.managedBy] : null;
    const angelMult = calcAngelMult(angel?.level ?? 1);
    const hamsterDetails: FacilityBreakdown['hamsterDetails'] = [];
    let subtotal = 0;

    for (const hId of Object.keys(f.occupants)) {
      const h = game.hamsters[hId];
      if (!h) continue;
      const raw = (def.basePower + h.basePower) * levelMult * angelMult;
      subtotal += raw;
      hamsterDetails.push({ name: h.name, base: h.basePower, facilityBase: def.basePower, levelMult, angelMult });
    }

    // 应用 production_boost / facility_down buff
    for (const buff of Object.values(game.buffs)) {
      if (buff.target === fId) {
        if (buff.type === 'production_boost') subtotal = subtotal * (1 + buff.value / 100);
        if (buff.type === 'facility_down') subtotal = subtotal * 0.5;
      }
    }

    if (hamsterDetails.length > 0) {
      rawTotal += subtotal;
      facilities.push({ name: def.name, hamsterDetails, subtotal: Math.round(subtotal) });
    }
  }

  const moodMult = calcMoodMultiplier(game.happiness);
  const finalTotal = Math.round(rawTotal * moodMult);

  // 维护费
  let maintenance = 0;
  for (const f of Object.values(game.facilities)) {
    const def = getFacilityDef(f.type);
    if (def) maintenance += def.maintenanceCost;
  }

  return { facilities, rawTotal, moodMult, finalTotal, maintenance, netTotal: finalTotal - maintenance };
}

const Overview: React.FC = () => {
  const { state, advanceTurnAndGenerate } = useStore();
  const [showDebug, setShowDebug] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showResourceHelp, setShowResourceHelp] = useState(false);
  const game = state.game;
  const production = calcProductionBreakdown(game);
  const moodForecast = calcMoodForecast(game);
  const pendingCount = Object.keys(game.pending_events).length;
  const hamsterCount = Object.keys(game.hamsters).length;
  const facilityCount = Object.keys(game.facilities).length;
  const busyAngels = Object.entries(game.angels).filter(([aId]) =>
    Object.values(game.facilities).some(f => f.managedBy === aId)
  ).length;
  const unlockedAchievements = Object.keys(game.achievements).filter(k => game.achievements[k]);
  const guideTips = getTabGuides(game).overview ?? [];

  return (
    <div className="fade-in">
      {/* 回合信息 */}
      <div className="card" style={{ marginBottom: 16, textAlign: 'center', background: 'linear-gradient(135deg, #fff 0%, #fff5f8 100%)' }}>
        <div style={{ fontSize: 12, color: 'var(--color-happiness)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Current Progress</div>
        <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--color-text)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
          <span>🌙</span> 第 {game.turn} 回合 <span>☀️</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 8 }}>
          <div style={{ background: 'rgba(244, 114, 182, 0.1)', padding: '4px 10px', borderRadius: 12, fontSize: 12, color: 'var(--color-happiness)', fontWeight: 600 }}>🐹 {hamsterCount} 鼠鼠</div>
          <div style={{ background: 'rgba(192, 132, 252, 0.1)', padding: '4px 10px', borderRadius: 12, fontSize: 12, color: 'var(--color-stardust)', fontWeight: 600 }}>🏠 {facilityCount} 设施</div>
          <div style={{ background: 'rgba(255, 184, 0, 0.1)', padding: '4px 10px', borderRadius: 12, fontSize: 12, color: 'var(--color-energy)', fontWeight: 600 }}>😇 {busyAngels} 天使</div>
        </div>
      </div>

      {/* 叙事面板 */}
      {state.narrative && (
        <div className="card narrative-panel" style={{ marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 40, opacity: 0.1 }}>✨</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>📖</span> 本回合物语
          </div>
          <div style={{ lineHeight: 1.8, fontSize: 14, color: 'var(--color-text)', textShadow: '0 1px 0 white' }}>{state.narrative}</div>
        </div>
      )}

      {/* 引导提示 */}
      {guideTips.length > 0 && (
        <div className="card guide-card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>💡</span> 乐园小贴士
          </div>
          {guideTips.map((tip, i) => (
            <div key={i} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: i < guideTips.length - 1 ? 6 : 0, paddingLeft: 4, borderLeft: '2px solid rgba(3, 105, 161, 0.2)' }}>
              {tip}
            </div>
          ))}
        </div>
      )}

      {/* 资源 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <ResourceBar icon="⚡" label="乐园能源" value={game.energy} max={game.energyCap} color="var(--color-energy)" />
        <ResourceBar icon="✨" label="梦幻星尘" value={game.stardust} color="var(--color-stardust)" />
        <ResourceBar icon="💝" label="鼠鼠幸福度" value={game.happiness} max={100} color="var(--color-happiness)" />
        
        <div style={{ textAlign: 'right' }}>
          <button
            className="btn btn-sm"
            style={{ background: 'transparent', boxShadow: 'none', color: 'var(--color-text-muted)', fontWeight: 500 }}
            onClick={() => setShowResourceHelp(!showResourceHelp)}
          >
            {showResourceHelp ? '收起百科' : '❔ 资源说明'}
          </button>
        </div>
        {showResourceHelp && (
          <div className="fade-in" style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8, lineHeight: 1.6, borderTop: '1px dashed var(--color-border)', paddingTop: 8 }}>
            <div style={{ marginBottom: 4 }}><b>⚡ 能源</b> — 鼠鼠玩耍产生的能量，用于建造与扩建</div>
            <div style={{ marginBottom: 4 }}><b>✨ 星尘</b> — 天使们的共鸣产物，能让天使变得更强大</div>
            <div><b>💝 幸福度</b> — 大家的平均心情，越高大家的干劲就越足哦！</div>
          </div>
        )}
      </div>

      {/* 产能预估 + 明细 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)' }}>下回合预想:</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ fontWeight: 800, color: production.netTotal >= 0 ? '#10B981' : 'var(--color-mood)' }}>
                ⚡ {production.netTotal >= 0 ? '+' : ''}{production.netTotal}
              </span>
              {Object.values(game.facilities).some(f => f.type === 'stardust_altar' && f.managedBy) && (
                <span style={{ fontWeight: 800, color: 'var(--color-stardust)' }}>✨ +2</span>
              )}
              {moodForecast.hamsterDetails.length > 0 && (() => {
                const delta = moodForecast.predictedAvg - moodForecast.currentAvg;
                return (
                  <span style={{ fontWeight: 800, color: delta < 0 ? 'var(--color-mood)' : delta > 0 ? '#10B981' : 'var(--color-text-muted)' }}>
                    💝 {delta >= 0 ? '+' : ''}{delta}
                  </span>
                );
              })()}
            </div>
          </div>
          <button
            className="btn btn-sm"
            onClick={() => setShowBreakdown(!showBreakdown)}
          >
            {showBreakdown ? '隐藏' : '明细'}
          </button>
        </div>

        {showBreakdown && (
          <div className="fade-in" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--color-border)', fontSize: 12 }}>
            {production.facilities.map((fb, i) => (
              <div key={i} style={{ marginBottom: 8, background: 'rgba(0,0,0,0.02)', padding: 8, borderRadius: 12 }}>
                <div style={{ color: 'var(--color-text)', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                   <span>🏢</span> {fb.name}
                </div>
                {fb.hamsterDetails.map((hd, j) => (
                  <div key={j} style={{ color: 'var(--color-text-muted)', paddingLeft: 20, marginBottom: 2 }}>
                    {hd.name}: ({hd.facilityBase} + {hd.base}) × {hd.levelMult.toFixed(1)}{hd.angelMult > 1 ? ` × 天使${hd.angelMult.toFixed(1)}` : ''} = ⚡{Math.round((hd.facilityBase + hd.base) * hd.levelMult * hd.angelMult)}
                  </div>
                ))}
                <div style={{ color: 'var(--color-text)', paddingLeft: 20, fontWeight: 600 }}>小计: ⚡{fb.subtotal}</div>
              </div>
            ))}
            <div style={{ background: 'rgba(244, 114, 182, 0.05)', padding: 10, borderRadius: 12, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span>产出合计</span>
                <span style={{ fontWeight: 700 }}>⚡{production.finalTotal}</span>
              </div>
              {production.maintenance > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-mood)', marginBottom: 2 }}>
                  <span>设施维护费</span>
                  <span>-⚡{production.maintenance}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 4, marginTop: 4, fontWeight: 800 }}>
                <span>预计净收</span>
                <span style={{ color: production.netTotal >= 0 ? '#10B981' : 'var(--color-mood)' }}>⚡{production.netTotal}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 当前 Buff */}
      {Object.keys(game.buffs).length > 0 && (
        <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', borderColor: '#bbf7d0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🌟</span> 乐园祝福 & 状态
          </div>
          {Object.entries(game.buffs).map(([id, buff]) => {
            let mechanic = '';
            if (buff.type === 'mood_regen') mechanic = `💝+${buff.value}`;
            else if (buff.type === 'mood_drain') mechanic = `💝-${buff.value}`;
            else if (buff.type === 'production_boost') mechanic = `⚡+${buff.value}%`;
            else if (buff.type === 'facility_down') mechanic = `⚡-50%`;
            else if (buff.type === 'stardust_bonus') mechanic = `✨+${buff.value}`;
            return (
              <div key={id} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 4, background: 'rgba(255,255,255,0.5)', padding: '4px 8px', borderRadius: 8 }}>
                <span style={{ color: '#15803d', fontWeight: 600 }}>{buff.description || buff.type} {mechanic && <span style={{ fontWeight: 400, opacity: 0.8 }}>({mechanic})</span>}</span>
                <span style={{ color: '#166534', opacity: 0.6 }}>{buff.duration} 回合</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 待处理事件提示 */}
      {pendingCount > 0 && (
        <div className="card silly-option" style={{ marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#b45309' }}>
            🔔 发现了 {pendingCount} 个新奇事！
          </div>
          <div style={{ fontSize: 12, color: '#d97706', marginTop: 4 }}>请先前往「事件」页面查看哦~</div>
        </div>
      )}

      {/* 成就 */}
      {unlockedAchievements.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8 }}>🏆 乐园荣耀</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {unlockedAchievements.map(a => (
              <span key={a} style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)', color: '#92400E', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                ✨ {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 推进回合 */}
      <div style={{ padding: '0 4px 20px' }}>
        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '16px 0', fontSize: 18, borderRadius: 24, boxShadow: '0 6px 0 #D14D8E' }}
          onClick={() => advanceTurnAndGenerate()}
          disabled={pendingCount > 0 || state.generating}
        >
          {state.generating ? (
            <><span>🍭</span> 正在编织新的一天...</>
          ) : pendingCount > 0 ? (
            <><span>⚠️</span> 还有事情没处理完呢</>
          ) : (
            <><span>🚀</span> 开启下一回合</>
          )}
        </button>
      </div>

      {/* 调试面板 */}
      {state.rawAiOutput && (
        <div style={{ paddingBottom: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <button
              className="btn btn-sm"
              style={{ background: 'transparent', boxShadow: 'none', color: 'var(--color-text-muted)', opacity: 0.5 }}
              onClick={() => setShowDebug(!showDebug)}
            >
              {showDebug ? '收起' : '查看'} 乐园底层逻辑
            </button>
          </div>
          {showDebug && (
            <div className="card debug-panel" style={{ marginTop: 12 }}>
              <pre style={{
                fontSize: 10,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: 200,
                overflow: 'auto',
                margin: 0,
                color: '#64748b',
              }}>
                {state.rawAiOutput}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Overview;
