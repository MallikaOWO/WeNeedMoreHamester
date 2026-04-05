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
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
      <span>{icon} {label}</span>
      <span style={{ fontWeight: 600 }}>{value}{max != null ? ` / ${max}` : ''}</span>
    </div>
    {max != null && (
      <div className="bar-track">
        <div
          className="bar-fill"
          style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }}
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
    <div>
      {/* 回合信息 */}
      <div className="card" style={{ marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>回合 {game.turn}</div>
        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
          {hamsterCount} 只鼠鼠 | {facilityCount} 个设施 | {busyAngels} 天使值班
        </div>
      </div>

      {/* 叙事面板 */}
      {state.narrative && (
        <div className="card narrative-panel" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>本回合叙事</div>
          <div style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{state.narrative}</div>
        </div>
      )}

      {/* 引导提示 */}
      {guideTips.length > 0 && (
        <div className="card" style={{ marginBottom: 12, background: '#eff6ff', borderColor: '#3b82f6' }}>
          {guideTips.map((tip, i) => (
            <div key={i} style={{ color: '#1e40af', fontSize: 13, lineHeight: 1.6, marginBottom: i < guideTips.length - 1 ? 4 : 0 }}>
              {tip}
            </div>
          ))}
        </div>
      )}

      {/* 资源 */}
      <div className="card" style={{ marginBottom: 12 }}>
        <ResourceBar icon="⚡" label="能源" value={game.energy} max={game.energyCap} color="var(--color-energy)" />
        <ResourceBar icon="✨" label="星尘" value={game.stardust} color="var(--color-stardust)" />
        <ResourceBar icon="💛" label="心情" value={game.happiness} max={100} color="var(--color-happiness)" />
        <div style={{ textAlign: 'right', marginTop: 2 }}>
          <button
            className="btn btn-sm"
            style={{ fontSize: 10, color: '#9ca3af', padding: '0 4px' }}
            onClick={() => setShowResourceHelp(!showResourceHelp)}
          >
            {showResourceHelp ? '收起说明' : '?'}
          </button>
        </div>
        {showResourceHelp && (
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4, lineHeight: 1.6, borderTop: '1px solid #e5e7eb', paddingTop: 6 }}>
            <div><b>⚡ 能源</b> — 鼠鼠快乐玩耍产生的电力，用于建造设施、维持运营</div>
            <div><b>✨ 星尘</b> — 天使与星辰共鸣凝聚的稀有资源，用于天使升级</div>
            <div><b>💛 心情</b> — 鼠鼠们的平均心情值，心情越高产能越高（70=基准，100=+20%）</div>
          </div>
        )}
      </div>

      {/* 产能预估 + 明细 */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 12, color: '#6b7280' }}>下回合预估 </span>
            <span style={{ fontWeight: 600, color: production.netTotal >= 0 ? undefined : '#ef4444' }}>
              ⚡ {production.netTotal >= 0 ? '+' : ''}{production.netTotal}
            </span>
            {production.maintenance > 0 && (
              <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>(产{production.finalTotal} - 维护{production.maintenance})</span>
            )}
            {Object.values(game.facilities).some(f => f.type === 'stardust_altar' && f.managedBy) && (
              <span style={{ marginLeft: 8, fontWeight: 600 }}>✨ +2</span>
            )}
            {moodForecast.hamsterDetails.length > 0 && (() => {
              const delta = moodForecast.predictedAvg - moodForecast.currentAvg;
              return (
                <span style={{ marginLeft: 8, fontWeight: 600, color: delta < 0 ? '#ef4444' : delta > 0 ? '#22c55e' : undefined }}>
                  💛 {delta >= 0 ? '+' : ''}{delta}
                </span>
              );
            })()}
          </div>
          {(production.facilities.length > 0 || moodForecast.hamsterDetails.length > 0) && (
            <button
              className="btn btn-sm"
              style={{ fontSize: 11, color: '#9ca3af' }}
              onClick={() => setShowBreakdown(!showBreakdown)}
            >
              {showBreakdown ? '收起' : '明细'}
            </button>
          )}
        </div>

        {showBreakdown && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb', fontSize: 12 }}>
            {production.facilities.map((fb, i) => (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ color: '#374151', fontWeight: 500 }}>{fb.name}</div>
                {fb.hamsterDetails.map((hd, j) => (
                  <div key={j} style={{ color: '#6b7280', paddingLeft: 8 }}>
                    {hd.name}: (设施{hd.facilityBase} + 鼠鼠{hd.base}) × Lv.{hd.levelMult.toFixed(1)}{hd.angelMult > 1 ? ` × 天使${hd.angelMult.toFixed(1)}` : ''} = ⚡{Math.round((hd.facilityBase + hd.base) * hd.levelMult * hd.angelMult)}
                  </div>
                ))}
                <div style={{ color: '#374151', paddingLeft: 8 }}>小计: ⚡{fb.subtotal}</div>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed #e5e7eb', paddingTop: 4, marginTop: 4 }}>
              <div style={{ color: '#6b7280' }}>
                基础合计: ⚡{Math.round(production.rawTotal)} × 心情加成{(production.moodMult * 100).toFixed(0)}% = <b>⚡{production.finalTotal}</b>
              </div>
              {production.maintenance > 0 && (
                <div style={{ color: '#ef4444' }}>
                  设施维护: -⚡{production.maintenance}
                </div>
              )}
              <div style={{ fontWeight: 500 }}>
                净收入: <b>⚡{production.netTotal}</b>
              </div>
            </div>
            {moodForecast.hamsterDetails.length > 0 && (
              <div style={{ borderTop: '1px dashed #e5e7eb', paddingTop: 4, marginTop: 4 }}>
                <div style={{ color: '#6b7280', marginBottom: 4 }}>心情预估 (当前均值 💛{moodForecast.currentAvg} → 预估 💛{moodForecast.predictedAvg})</div>
                {moodForecast.hamsterDetails.map((md, i) => (
                  <div key={i} style={{ color: '#6b7280', paddingLeft: 8 }}>
                    {md.name}: 💛{md.current} {md.delta >= 0 ? '+' : ''}{md.delta} → <span style={{ color: md.delta < 0 ? '#ef4444' : md.delta > 0 ? '#22c55e' : '#374151' }}>{md.predicted}</span>
                    {md.delta < 0 && ' (工作消耗)'}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 当前 Buff */}
      {Object.keys(game.buffs).length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>当前效果</div>
          {Object.entries(game.buffs).map(([id, buff]) => {
            // 生成机制说明
            let mechanic = '';
            if (buff.type === 'mood_regen') mechanic = `💛+${buff.value}/回合${buff.target === 'global' ? '(全体)' : ''}`;
            else if (buff.type === 'mood_drain') mechanic = `💛-${buff.value}/回合`;
            else if (buff.type === 'production_boost') mechanic = `⚡产能+${buff.value}%`;
            else if (buff.type === 'facility_down') mechanic = `⚡产能-50%`;
            else if (buff.type === 'stardust_bonus') mechanic = `✨+${buff.value}`;
            else if (buff.type === 'lucky_guard') mechanic = '下回合事件含高收益选项';
            else if (buff.type === 'force_opportunity') mechanic = '下回合必出机遇事件';
            return (
              <div key={id} style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span>{buff.description || buff.type}{mechanic && <span style={{ color: '#6b7280', marginLeft: 4 }}>({mechanic})</span>}</span>
                <span style={{ color: '#9ca3af', flexShrink: 0, marginLeft: 8 }}>{buff.duration}回合</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 待处理事件提示 */}
      {pendingCount > 0 && (
        <div className="card" style={{ marginBottom: 12, background: '#fffbeb', borderColor: '#f59e0b' }}>
          <span style={{ color: '#b45309' }}>有 {pendingCount} 个待处理事件，请先前往「事件」页处理</span>
        </div>
      )}

      {/* 成就 */}
      {unlockedAchievements.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>已解锁成就</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {unlockedAchievements.map(a => (
              <span key={a} style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{a}</span>
            ))}
          </div>
        </div>
      )}

      {/* 推进回合 */}
      <button
        className="btn btn-primary"
        style={{ width: '100%', padding: '10px 0', fontSize: 15 }}
        onClick={() => advanceTurnAndGenerate()}
        disabled={pendingCount > 0 || state.generating}
      >
        {state.generating ? '正在生成...' : pendingCount > 0 ? '请先处理待处理事件' : '推进回合'}
      </button>

      {/* 调试面板 */}
      {state.rawAiOutput && (
        <div style={{ marginTop: 12 }}>
          <button
            className="btn btn-sm"
            style={{ color: '#9ca3af', fontSize: 11 }}
            onClick={() => setShowDebug(!showDebug)}
          >
            {showDebug ? '收起' : '查看'} AI 原始输出
          </button>
          {showDebug && (
            <div className="card debug-panel" style={{ marginTop: 6 }}>
              <pre style={{
                fontSize: 11,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: 300,
                overflow: 'auto',
                margin: 0,
                color: '#6b7280',
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
