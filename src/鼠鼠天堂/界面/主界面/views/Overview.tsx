// 3.3.1 总览页 — 资源栏 + 回合信息 + 推进回合

import React from 'react';
import { useStore } from '../store';
import { FACILITY_DEFS } from '../../../data/facilities';

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

/** 计算本回合预估产能 */
function estimateProduction(game: ReturnType<typeof useStore>['state']['game']): number {
  let total = 0;
  for (const f of game.facilities) {
    const def = FACILITY_DEFS.find(d => d.type === f.type);
    if (!def || def.basePower <= 0) continue;
    if (!f.managedBy) continue;
    const occupants = f.occupants.length;
    if (occupants === 0) continue;
    const levelMult = 1 + (f.level - 1) * 0.3;
    total += Math.round(def.basePower * occupants * levelMult);
  }
  // 心情乘数
  const moodMult = 0.5 + (game.happiness / 100) * 0.5;
  return Math.round(total * moodMult);
}

const Overview: React.FC = () => {
  const { state, dispatch } = useStore();
  const game = state.game;
  const estimated = estimateProduction(game);
  const pendingCount = game.pendingEvents.length;

  return (
    <div>
      {/* 回合信息 */}
      <div className="card" style={{ marginBottom: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>回合 {game.turn}</div>
        <div style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
          {game.hamsters.length} 只鼠鼠 | {game.facilities.length} 个设施 | {game.angels.filter(a => a.assignedFacility).length} 天使值班
        </div>
      </div>

      {/* 资源 */}
      <div className="card" style={{ marginBottom: 12 }}>
        <ResourceBar icon="⚡" label="能源" value={game.energy} max={game.energyCap} color="var(--color-energy)" />
        <ResourceBar icon="✨" label="星尘" value={game.stardust} color="var(--color-stardust)" />
        <ResourceBar icon="💛" label="心情" value={game.happiness} max={100} color="var(--color-happiness)" />
      </div>

      {/* 产能预览 */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>下回合预估</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <span>⚡ +{estimated}</span>
          {game.facilities.some(f => f.type === 'stardust_altar') && <span>✨ +2</span>}
        </div>
      </div>

      {/* 待处理事件提示 */}
      {pendingCount > 0 && (
        <div className="card" style={{ marginBottom: 12, background: '#fffbeb', borderColor: '#f59e0b' }}>
          <span style={{ color: '#b45309' }}>有 {pendingCount} 个待处理事件，请先前往「事件」页处理</span>
        </div>
      )}

      {/* 成就 */}
      {game.achievements.length > 0 && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>已解锁成就</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {game.achievements.map(a => (
              <span key={a} style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{a}</span>
            ))}
          </div>
        </div>
      )}

      {/* 推进回合 */}
      <button
        className="btn btn-primary"
        style={{ width: '100%', padding: '10px 0', fontSize: 15 }}
        onClick={() => dispatch({ type: 'ADVANCE_TURN' })}
        disabled={pendingCount > 0}
      >
        {pendingCount > 0 ? '请先处理待处理事件' : '推进回合'}
      </button>
    </div>
  );
};

export default Overview;
