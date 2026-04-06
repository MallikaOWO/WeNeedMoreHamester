// 3.3.4 鼠鼠页 — 鼠鼠卡片 + 居住/玩耍分配 + 详情

import React, { useState } from 'react';
import { useStore } from '../store';
import { getTabGuides } from '../guides';
import { getFacilityDef, FACILITY_DEFS } from '../../../data/facilities';

const MoodBar: React.FC<{ value: number }> = ({ value }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-happiness)' }}>💝{value}</span>
    <div className="bar-track" style={{ width: 36, height: 6 }}>
      <div className="bar-fill" style={{ width: `${value}%`, background: value > 60 ? 'var(--color-happiness)' : value > 30 ? 'var(--color-energy)' : 'var(--color-mood)' }} />
    </div>
  </div>
);

const StaminaBar: React.FC<{ value: number }> = ({ value }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-positive)' }}>🏃{value}</span>
    <div className="bar-track" style={{ width: 36, height: 6 }}>
      <div className="bar-fill" style={{ width: `${value}%`, background: 'var(--color-positive)' }} />
    </div>
  </div>
);

const Hamsters: React.FC = () => {
  const { state, dispatch, interactWithCharacter } = useStore();
  const game = state.game;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [memoryExpanded, setMemoryExpanded] = useState<Record<string, boolean>>({});
  const [assignMode, setAssignMode] = useState<{ hamsterId: string; type: 'work' | 'living' } | null>(null);

  const hamsterEntries = Object.entries(game.hamsters);
  const tips = getTabGuides(game).hamsters;

  if (hamsterEntries.length === 0) {
    return (
      <div className="fade-in">
        {tips && tips.length > 0 && (
          <div className="card guide-card">
            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>💡 寻找小伙伴</div>
            {tips.map((tip, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.5 }}>{tip}</div>
            ))}
          </div>
        )}
        <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '32px 16px' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🐹❓</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>乐园里还没有鼠鼠</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>推进回合看看有没有迷路的鼠鼠吧</div>
        </div>
      </div>
    );
  }

  // 有空位的玩耍设施（play 类）
  const availableWorkFacilities = Object.entries(game.facilities)
    .filter(([, f]) => {
      const def = getFacilityDef(f.type);
      return def?.category === 'play' && f.capacity > 0 && Object.keys(f.occupants).length < f.capacity;
    });

  // 有空位的居住设施（living 类）
  const getAvailableLivingFacilities = (excludeHamsterId: string) =>
    Object.entries(game.facilities).filter(([fId, f]) => {
      const def = getFacilityDef(f.type);
      if (def?.category !== 'living') return false;
      const residents = Object.values(game.hamsters).filter(h => h.livingAt === fId).length;
      const selfHere = game.hamsters[excludeHamsterId]?.livingAt === fId ? 1 : 0;
      return (residents - selfHere) < f.capacity;
    });

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tips && tips.length > 0 && (
        <div className="card guide-card">
          <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>💡 小提示</div>
          {tips.map((tip, i) => (
            <div key={i} style={{ fontSize: 12, lineHeight: 1.5 }}>{tip}</div>
          ))}
        </div>
      )}
      {hamsterEntries.map(([hId, h]) => {
        const expanded = expandedId === hId;
        const isAssigning = assignMode?.hamsterId === hId;

        const livingFacility = h.livingAt ? game.facilities[h.livingAt] : null;
        const livingName = livingFacility ? (getFacilityDef(livingFacility.type)?.name ?? '未知') : '露宿街头';
        const workFacility = h.workingAt ? game.facilities[h.workingAt] : null;
        const workName = workFacility ? (getFacilityDef(workFacility.type)?.name ?? '未知') : null;

        return (
          <div key={hId} className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* 头部 */}
            <div
              style={{ padding: '10px 12px 8px', cursor: 'pointer', background: expanded ? 'var(--color-happiness-bg)' : 'transparent' }}
              onClick={() => { setExpandedId(expanded ? null : hId); setAssignMode(null); }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>{h.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 6, background: 'var(--color-surface)', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>{h.breed}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <MoodBar value={h.mood} />
                  <StaminaBar value={h.stamina} />
                </div>
              </div>

              {/* 状态简报 */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-happiness-bg)', padding: '1px 5px', borderRadius: 'var(--radius-sm)' }}>{h.personality}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-stardust-bg)', padding: '1px 5px', borderRadius: 'var(--radius-sm)' }}>🏠 {livingName}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', background: workName ? 'var(--color-energy-bg)' : 'var(--color-surface)', padding: '1px 5px', borderRadius: 'var(--radius-sm)' }}>
                  {workName ? `🎡 ${workName}` : '💤 休息中'}
                </span>
              </div>
            </div>

            {/* 展开详情 */}
            {expanded && (
              <div className="fade-in" style={{ padding: '0 12px 12px', borderTop: '1px dashed var(--color-border)' }}>
                <div style={{ marginTop: 8, background: 'var(--color-surface)', padding: 10, borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 12, marginBottom: 6, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>背景</span> {h.story}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)' }}>
                    <span>偏好: <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{(h.preference && FACILITY_DEFS.find(d => d.type === h.preference)?.name) || h.preference || '随遇而安'}</span></span>
                    <span>⚡ 产能: <span style={{ color: 'var(--color-energy)', fontWeight: 700 }}>{h.basePower}</span></span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {h.workingAt ? (
                    <button className="btn btn-sm" onClick={() => dispatch({ type: 'STOP_WORKING', hamsterId: hId })}>🏠 回窝休息</button>
                  ) : (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => setAssignMode(isAssigning && assignMode?.type === 'work' ? null : { hamsterId: hId, type: 'work' })}
                      disabled={availableWorkFacilities.length === 0}
                    >
                      🎡 去玩耍
                    </button>
                  )}
                  <button
                    className="btn btn-sm"
                    style={{ background: 'var(--color-stardust-bg)', borderColor: 'var(--color-stardust)' }}
                    onClick={() => setAssignMode(isAssigning && assignMode?.type === 'living' ? null : { hamsterId: hId, type: 'living' })}
                  >
                    📦 搬家
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    style={{ background: 'var(--color-stardust)' }}
                    onClick={() => interactWithCharacter(hId)}
                    disabled={state.generating}
                  >
                    {state.generating ? '互动中...' : '💬 摸摸它'}
                  </button>
                </div>

                {/* 设施选择 */}
                {isAssigning && (
                  <div className="fade-in" style={{ marginTop: 8, background: 'var(--color-surface)', padding: 8, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: 'var(--color-text-muted)' }}>
                      {assignMode?.type === 'work' ? '🎡 选择玩耍设施' : '📦 选择新住所'}:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {(assignMode?.type === 'work' ? availableWorkFacilities : getAvailableLivingFacilities(hId)).map(([fId, f]) => {
                        const def = getFacilityDef(f.type);
                        const isCurrent = h.livingAt === fId;
                        const residents = assignMode?.type === 'living' ? Object.values(game.hamsters).filter(ham => ham.livingAt === fId).length : Object.keys(f.occupants).length;
                        return (
                          <button
                            key={fId}
                            className="btn btn-sm"
                            style={{ justifyContent: 'space-between', padding: '6px 10px' }}
                            disabled={isCurrent}
                            onClick={() => {
                              dispatch({ type: assignMode?.type === 'work' ? 'ASSIGN_WORK' : 'CHANGE_LIVING', hamsterId: hId, facilityId: fId });
                              setAssignMode(null);
                            }}
                          >
                            <span>{def?.name ?? f.type}</span>
                            <span style={{ opacity: 0.6 }}>{residents}/{f.capacity}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 记忆 */}
                {Object.keys(h.memory).length > 0 && (() => {
                  const entries = Object.entries(h.memory);
                  const isMemExpanded = memoryExpanded[hId] ?? false;
                  const shown = isMemExpanded ? entries : entries.slice(-3);
                  const hasMore = entries.length > 3;
                  return (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                        <span>📓 记忆 ({entries.length})</span>
                        {hasMore && (
                          <span
                            style={{ color: 'var(--color-stardust)', cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); setMemoryExpanded(p => ({ ...p, [hId]: !isMemExpanded })); }}
                          >
                            {isMemExpanded ? '收起 ▲' : '展开 ▼'}
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
        );
      })}
    </div>
  );
};

export default Hamsters;
