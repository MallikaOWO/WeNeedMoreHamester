// 3.3.4 鼠鼠页 — 鼠鼠卡片 + 居住/玩耍分配 + 详情

import React, { useState } from 'react';
import { useStore } from '../store';
import { getTabGuides } from '../guides';
import { getFacilityDef, FACILITY_DEFS } from '../../../data/facilities';

const MoodBar: React.FC<{ value: number }> = ({ value }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(244, 114, 182, 0.05)', padding: '2px 8px', borderRadius: 10 }}>
    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-happiness)' }}>💝{value}</span>
    <div className="bar-track" style={{ width: 40, height: 8 }}>
      <div className="bar-fill" style={{ width: `${value}%`, background: value > 60 ? 'var(--color-happiness)' : value > 30 ? 'var(--color-energy)' : 'var(--color-mood)' }} />
    </div>
  </div>
);

const StaminaBar: React.FC<{ value: number }> = ({ value }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(52, 211, 153, 0.05)', padding: '2px 8px', borderRadius: 10 }}>
    <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>🏃{value}</span>
    <div className="bar-track" style={{ width: 40, height: 8 }}>
      <div className="bar-fill" style={{ width: `${value}%`, background: '#34D399' }} />
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
          <div className="card guide-card" style={{ marginBottom: 16 }}>
             <div style={{ fontWeight: 700, marginBottom: 4 }}>💡 寻找小伙伴</div>
            {tips.map((tip, i) => (
              <div key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>{tip}</div>
            ))}
          </div>
        )}
        <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '48px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🐹❓</div>
          <div style={{ fontWeight: 600 }}>乐园里还没有鼠鼠入住呢...</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>快去推进回合，看看有没有迷路的鼠鼠吧！</div>
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
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {tips && tips.length > 0 && (
        <div className="card guide-card">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>💡 小提示</div>
          {tips.map((tip, i) => (
            <div key={i} style={{ fontSize: 13, lineHeight: 1.6 }}>{tip}</div>
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
              style={{ padding: '16px 16px 12px', cursor: 'pointer', background: expanded ? 'linear-gradient(to bottom, rgba(244, 114, 182, 0.05), transparent)' : 'transparent' }}
              onClick={() => { setExpandedId(expanded ? null : hId); setAssignMode(null); }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)' }}>{h.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8, background: '#F3F4F6', padding: '2px 8px', borderRadius: 8 }}>{h.breed}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <MoodBar value={h.mood} />
                  <StaminaBar value={h.stamina} />
                </div>
              </div>

              {/* 状态简报 */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: '#7C6A71', background: '#FFF0F6', padding: '2px 6px', borderRadius: 4 }}>性格: {h.personality}</span>
                <span style={{ fontSize: 11, color: '#0369A1', background: '#E0F2FE', padding: '2px 6px', borderRadius: 4 }}>🏠 {livingName}</span>
                <span style={{ fontSize: 11, color: workName ? '#166534' : '#6B7280', background: workName ? '#DCFCE7' : '#F3F4F6', padding: '2px 6px', borderRadius: 4 }}>
                  {workName ? `🎡 正在玩耍: ${workName}` : '💤 休息中'}
                </span>
              </div>
            </div>

            {/* 展开详情 */}
            {expanded && (
              <div className="fade-in" style={{ padding: '0 16px 16px', borderTop: '1px dashed var(--color-border)' }}>
                <div style={{ marginTop: 12, background: 'rgba(255,255,255,0.5)', padding: 12, borderRadius: 16 }}>
                  <div style={{ fontSize: 13, marginBottom: 8, color: 'var(--color-text)', lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-happiness)' }}>[背景故事]</span> {h.story}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <span>🍭 偏好: <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>{(h.preference && FACILITY_DEFS.find(d => d.type === h.preference)?.name) || h.preference || '随遇而安'}</span></span>
                    <span>⚡ 基础产能: <span style={{ color: 'var(--color-energy)', fontWeight: 800 }}>{h.basePower}</span></span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  {/* 动作按钮 */}
                  {h.workingAt ? (
                    <button
                      className="btn btn-sm"
                      style={{ background: '#F3F4F6', color: '#4B5563' }}
                      onClick={() => dispatch({ type: 'STOP_WORKING', hamsterId: hId })}
                    >
                      🏠 回窝休息
                    </button>
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
                    style={{ background: '#E0F2FE', color: '#0369A1' }}
                    onClick={() => setAssignMode(isAssigning && assignMode?.type === 'living' ? null : { hamsterId: hId, type: 'living' })}
                  >
                    📦 搬家
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    style={{ background: 'var(--color-stardust)', boxShadow: '0 2px 0 #8B5CF6' }}
                    onClick={() => interactWithCharacter(hId)}
                    disabled={state.generating}
                  >
                    {state.generating ? '✨ 互动中...' : '💬 摸摸它'}
                  </button>
                </div>

                {/* 设施选择列表 */}
                {isAssigning && (
                  <div className="fade-in" style={{ marginTop: 12, background: '#F9FAFB', padding: 12, borderRadius: 16, border: '1px solid #E5E7EB' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#4B5563' }}>
                      {assignMode?.type === 'work' ? '🎡 选择玩耍设施' : '📦 选择新住所'}:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(assignMode?.type === 'work' ? availableWorkFacilities : getAvailableLivingFacilities(hId)).map(([fId, f]) => {
                        const def = getFacilityDef(f.type);
                        const isCurrent = h.livingAt === fId;
                        const residents = assignMode?.type === 'living' ? Object.values(game.hamsters).filter(ham => ham.livingAt === fId).length : Object.keys(f.occupants).length;
                        return (
                          <button
                            key={fId}
                            className="btn btn-sm"
                            style={{ justifyContent: 'space-between', padding: '8px 12px' }}
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

                {/* 记忆日记 */}
                {Object.keys(h.memory).length > 0 && (() => {
                  const entries = Object.entries(h.memory);
                  const isExpanded = memoryExpanded[hId] ?? false;
                  const shown = isExpanded ? entries : entries.slice(-3);
                  const hasMore = entries.length > 3;
                  return (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-happiness)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                        <span>📓 鼠鼠心语</span>
                        {hasMore && (
                          <span
                            style={{ color: 'var(--color-stardust)', cursor: 'pointer', fontSize: 11 }}
                            onClick={(e) => { e.stopPropagation(); setMemoryExpanded(p => ({ ...p, [hId]: !isExpanded })); }}
                          >
                            {isExpanded ? '收起 ▲' : `查看往事 (${entries.length}) ▼`}
                          </span>
                        )}
                      </div>
                      <div style={{ background: '#FFF9FE', padding: '10px 12px', borderRadius: 12, border: '1px solid #FFD1E8' }}>
                        {shown.map(([key, text]) => (
                          <div key={key} style={{ fontSize: 12, color: 'var(--color-text)', lineHeight: 1.6, marginBottom: 4, display: 'flex', gap: 6 }}>
                            <span style={{ color: key.startsWith('!') ? 'var(--color-happiness)' : 'var(--color-border)' }}>{key.startsWith('!') ? '💖' : '🐾'}</span>
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
        );
      })}
    </div>
  );
};

export default Hamsters;
