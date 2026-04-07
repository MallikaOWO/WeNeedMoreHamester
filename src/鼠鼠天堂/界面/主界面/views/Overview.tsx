// 3.3.1 总览页 — 回合信息 + 叙事面板 + 产能明细 + 推进回合

import React, { useState } from 'react';
import { useStore } from '../store';
import { getTabGuides } from '../guides';
import { getFacilityDef, getMaintenanceCost } from '../../../data/facilities';
import { calcMoodMultiplier, calcAngelMult, STAMINA_COST_PER_TURN, STAMINA_RESTORE_BASE, LOW_STAMINA_THRESHOLD, MOOD_COST_PER_TURN } from '../../../engine/turn';

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

/** 预估下回合心情变化 */
function calcMoodForecast(game: ReturnType<typeof useStore>['state']['game']): MoodForecast {
  const hamsters = Object.values(game.hamsters);
  if (hamsters.length === 0) return { hamsterDetails: [], currentAvg: game.happiness, predictedAvg: game.happiness };

  const details: MoodForecast['hamsterDetails'] = [];

  for (const h of hamsters) {
    let delta = 0;

    if (h.workingAt) {
      const livingFac = h.livingAt ? game.facilities[h.livingAt] : null;
      const livingAngel = livingFac?.managedBy ? game.angels[livingFac.managedBy] : null;
      const reduction = livingAngel?.manageDomain === 'life' ? Math.round(MOOD_COST_PER_TURN * 0.5) : MOOD_COST_PER_TURN;
      delta -= reduction;
    }

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

    for (const f of Object.values(game.facilities)) {
      if (f.type === 'lounge' && f.managedBy) {
        const levelMult = 1 + (f.level - 1) * 0.3;
        delta += Math.round(2 * levelMult);
      }
    }

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

interface StaminaForecast {
  hamsterDetails: { name: string; current: number; delta: number; predicted: number; willStop: boolean }[];
}

/** 预估下回合体力变化 */
function calcStaminaForecast(game: ReturnType<typeof useStore>['state']['game']): StaminaForecast {
  const hasCanteen = Object.values(game.facilities).some(f => f.type === 'canteen');
  const restoreAmount = hasCanteen ? Math.round(STAMINA_RESTORE_BASE * 1.5) : STAMINA_RESTORE_BASE;

  const details: StaminaForecast['hamsterDetails'] = [];
  for (const h of Object.values(game.hamsters)) {
    let delta = 0;
    if (h.workingAt) {
      const workFacility = game.facilities[h.workingAt];
      const workAngel = workFacility?.managedBy ? game.angels[workFacility.managedBy] : null;
      const extraCost = workAngel?.manageDomain === 'power' ? 3 : 0;
      delta = -(STAMINA_COST_PER_TURN + extraCost);
    } else {
      delta = restoreAmount;
    }
    const predicted = Math.max(0, Math.min(100, h.stamina + delta));
    const willStop = h.workingAt !== null && predicted <= LOW_STAMINA_THRESHOLD;
    details.push({ name: h.name, current: h.stamina, delta, predicted, willStop });
  }
  return { hamsterDetails: details };
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

  let maintenance = 0;
  for (const f of Object.values(game.facilities)) {
    const def = getFacilityDef(f.type);
    if (def) maintenance += getMaintenanceCost(def, f.level);
  }

  return { facilities, rawTotal, moodMult, finalTotal, maintenance, netTotal: finalTotal - maintenance };
}

const Overview: React.FC = () => {
  const { state, advanceTurnAndGenerate } = useStore();
  const [showDebug, setShowDebug] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const game = state.game;
  const production = calcProductionBreakdown(game);
  const moodForecast = calcMoodForecast(game);
  const staminaForecast = calcStaminaForecast(game);
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
      {/* 回合 + 统计 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, padding: '4px 2px' }}>
        <span style={{ fontSize: 16, fontWeight: 800 }}>回合 {game.turn}</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          🐹{hamsterCount} · 🏠{facilityCount} · 😇{busyAngels}
        </span>
      </div>

      {/* 叙事面板 */}
      {state.narrative && (
        <div className="card narrative-panel">
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4, fontWeight: 600 }}>📖 本回合叙事</div>
          <div style={{ lineHeight: 1.7, fontSize: 13, color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>{state.narrative}</div>
        </div>
      )}

      {/* 引导提示 */}
      {guideTips.length > 0 && (
        <div className="card guide-card">
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>💡 提示</div>
          {guideTips.map((tip, i) => (
            <div key={i} style={{ fontSize: 12, lineHeight: 1.5, marginBottom: i < guideTips.length - 1 ? 3 : 0 }}>{tip}</div>
          ))}
        </div>
      )}

      {/* 产能预估 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>下回合:</span>
            <span style={{ fontWeight: 800, color: production.netTotal >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>
              ⚡{production.netTotal >= 0 ? '+' : ''}{production.netTotal}
            </span>
            {production.maintenance > 0 && (
              <span style={{ color: 'var(--color-text-light)', fontSize: 11 }}>(产{production.finalTotal} - 维护{production.maintenance})</span>
            )}
            {Object.values(game.facilities).some(f => f.type === 'stardust_altar' && f.managedBy) && (
              <span style={{ fontWeight: 800, color: 'var(--color-stardust)' }}>✨+2</span>
            )}
            {moodForecast.hamsterDetails.length > 0 && (() => {
              const delta = moodForecast.predictedAvg - moodForecast.currentAvg;
              return (
                <span style={{ fontWeight: 800, color: delta < 0 ? 'var(--color-negative)' : delta > 0 ? 'var(--color-positive)' : 'var(--color-text-muted)' }}>
                  💝{delta >= 0 ? '+' : ''}{delta}
                </span>
              );
            })()}
          </div>
          {(production.facilities.length > 0 || moodForecast.hamsterDetails.length > 0) && (
            <button
              className="btn btn-sm"
              style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', padding: '2px 6px' }}
              onClick={() => setShowBreakdown(!showBreakdown)}
            >
              {showBreakdown ? '收起' : '明细'}
            </button>
          )}
        </div>

        {showBreakdown && (
          <div className="fade-in" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--color-border)', fontSize: 12 }}>
            {production.facilities.map((fb, i) => (
              <div key={i} style={{ marginBottom: 6, background: 'var(--color-surface)', padding: 8, borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>🏢 {fb.name}</div>
                {fb.hamsterDetails.map((hd, j) => (
                  <div key={j} style={{ color: 'var(--color-text-muted)', paddingLeft: 16, marginBottom: 1 }}>
                    {hd.name}: ({hd.facilityBase}+{hd.base})×{hd.levelMult.toFixed(1)}{hd.angelMult > 1 ? `×天使${hd.angelMult.toFixed(1)}` : ''} = ⚡{Math.round((hd.facilityBase + hd.base) * hd.levelMult * hd.angelMult)}
                  </div>
                ))}
                <div style={{ paddingLeft: 16, fontWeight: 600 }}>小计: ⚡{fb.subtotal}</div>
              </div>
            ))}
            <div style={{ background: 'var(--color-happiness-bg)', padding: 8, borderRadius: 'var(--radius-sm)', marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>产出合计</span><span style={{ fontWeight: 700 }}>⚡{production.finalTotal}</span>
              </div>
              {production.maintenance > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-negative)' }}>
                  <span>设施维护</span><span>-⚡{production.maintenance}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--color-border)', paddingTop: 4, marginTop: 4, fontWeight: 800 }}>
                <span>净收入</span>
                <span style={{ color: production.netTotal >= 0 ? 'var(--color-positive)' : 'var(--color-negative)' }}>⚡{production.netTotal}</span>
              </div>
            </div>
            {moodForecast.hamsterDetails.length > 0 && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--color-border)' }}>
                <div style={{ color: 'var(--color-text-muted)', marginBottom: 3 }}>心情预估 (均值 💝{moodForecast.currentAvg} → {moodForecast.predictedAvg})</div>
                {moodForecast.hamsterDetails.map((md, i) => (
                  <div key={i} style={{ color: 'var(--color-text-muted)', paddingLeft: 16 }}>
                    {md.name}: 💝{md.current} {md.delta >= 0 ? '+' : ''}{md.delta} → <span style={{ color: md.delta < 0 ? 'var(--color-negative)' : md.delta > 0 ? 'var(--color-positive)' : 'var(--color-text)' }}>{md.predicted}</span>
                  </div>
                ))}
              </div>
            )}
            {staminaForecast.hamsterDetails.length > 0 && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--color-border)' }}>
                <div style={{ color: 'var(--color-text-muted)', marginBottom: 3 }}>体力预估</div>
                {staminaForecast.hamsterDetails.map((sd, i) => (
                  <div key={i} style={{ color: 'var(--color-text-muted)', paddingLeft: 16 }}>
                    {sd.name}: 🏃{sd.current} {sd.delta >= 0 ? '+' : ''}{sd.delta} → <span style={{ color: sd.willStop ? 'var(--color-negative)' : sd.delta < 0 ? 'var(--color-text)' : 'var(--color-positive)' }}>{sd.predicted}</span>
                    {sd.willStop && <span style={{ color: 'var(--color-negative)', marginLeft: 4 }}>⚠停工</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 当前 Buff */}
      {Object.keys(game.buffs).length > 0 && (
        <div className="card" style={{ background: 'var(--color-stardust-bg)', borderColor: 'var(--color-stardust)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>🌟 当前效果</div>
          {Object.entries(game.buffs).map(([id, buff]) => {
            let mechanic = '';
            if (buff.type === 'mood_regen') mechanic = `💝+${buff.value}/回合`;
            else if (buff.type === 'mood_drain') mechanic = `💝-${buff.value}/回合`;
            else if (buff.type === 'production_boost') mechanic = `⚡+${buff.value}%`;
            else if (buff.type === 'facility_down') mechanic = `⚡-50%`;
            else if (buff.type === 'stardust_bonus') mechanic = `✨+${buff.value}`;
            else if (buff.type === 'lucky_guard') mechanic = '高收益选项';
            else if (buff.type === 'force_opportunity') mechanic = '必出机遇';
            return (
              <div key={id} style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span>{buff.description || buff.type}{mechanic && <span style={{ color: 'var(--color-text-muted)', marginLeft: 4 }}>({mechanic})</span>}</span>
                <span style={{ color: 'var(--color-text-light)', flexShrink: 0, marginLeft: 8 }}>{buff.duration}回合</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 待处理事件 */}
      {pendingCount > 0 && (
        <div className="card silly-option" style={{ textAlign: 'center', padding: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>🔔 有 {pendingCount} 个待处理事件 — 前往「事件」页</span>
        </div>
      )}

      {/* 成就 */}
      {unlockedAchievements.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>🏆 已解锁</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {unlockedAchievements.map(a => (
              <span key={a} style={{ background: 'var(--color-energy-bg)', color: 'var(--color-text)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, border: '1px solid var(--color-energy)' }}>
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 推进回合 — sticky 底部 */}
      <div className="bottom-action">
        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px 0', fontSize: 15 }}
          onClick={() => advanceTurnAndGenerate()}
          disabled={pendingCount > 0 || state.generating}
        >
          {state.generating ? '正在生成...' : pendingCount > 0 ? '请先处理事件' : '🚀 推进回合'}
        </button>
      </div>

      {/* 调试 */}
      {state.rawAiOutput && (
        <div style={{ textAlign: 'center', paddingBottom: 8 }}>
          <button
            className="btn btn-sm"
            style={{ background: 'transparent', border: 'none', color: 'var(--color-text-light)', fontSize: 11 }}
            onClick={() => setShowDebug(!showDebug)}
          >
            {showDebug ? '收起' : '查看'} AI 原始输出
          </button>
          {showDebug && (
            <div className="card debug-panel" style={{ marginTop: 6, textAlign: 'left' }}>
              <pre style={{ fontSize: 10, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 200, overflow: 'auto', margin: 0, color: 'var(--color-text-muted)' }}>
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
