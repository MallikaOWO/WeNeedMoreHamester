// 3.3.4 鼠鼠页 — 鼠鼠卡片 + 分配 + 详情

import React, { useState } from 'react';
import { useStore } from '../store';
import { getFacilityDef } from '../../../data/facilities';

const MoodBar: React.FC<{ value: number }> = ({ value }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <span style={{ fontSize: 11 }}>💛{value}</span>
    <div className="bar-track" style={{ width: 50 }}>
      <div className="bar-fill" style={{ width: `${value}%`, background: value > 60 ? '#ec4899' : value > 30 ? '#f59e0b' : '#ef4444' }} />
    </div>
  </div>
);

const StaminaBar: React.FC<{ value: number }> = ({ value }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <span style={{ fontSize: 11 }}>🏃{value}</span>
    <div className="bar-track" style={{ width: 50 }}>
      <div className="bar-fill" style={{ width: `${value}%`, background: '#22c55e' }} />
    </div>
  </div>
);

const Hamsters: React.FC = () => {
  const { state, dispatch } = useStore();
  const game = state.game;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  if (game.hamsters.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>
        乐园里还没有鼠鼠
        <div style={{ fontSize: 12, marginTop: 8 }}>通过事件收养鼠鼠，或等待 AI 带来新朋友</div>
      </div>
    );
  }

  // 可分配的设施（有容量且未满）
  const availableFacilities = game.facilities.filter(f => f.capacity > 0 && f.occupants.length < f.capacity);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {game.hamsters.map(h => {
        const expanded = expandedId === h.id;
        const assigning = assigningId === h.id;
        const location = h.assignedTo
          ? getFacilityDef(game.facilities.find(f => f.id === h.assignedTo)?.type ?? '')?.name ?? '工作中'
          : '休息中';

        return (
          <div key={h.id} className="card">
            {/* 头部 */}
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setExpandedId(expanded ? null : h.id)}
            >
              <div>
                <span style={{ fontWeight: 600 }}>{h.name}</span>
                <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>({h.breed})</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <MoodBar value={h.mood} />
                <StaminaBar value={h.stamina} />
              </div>
            </div>

            {/* 状态行 */}
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              性格: {h.personality.join('、')} | 位置: {location}
            </div>

            {/* 展开详情 */}
            {expanded && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>故事: {h.story}</div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>偏好设施: {h.preference || '无'}</div>
                <div style={{ fontSize: 12, marginBottom: 8 }}>基础产能: ⚡{h.basePower}</div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {/* 分配/取消分配 */}
                  {h.assignedTo ? (
                    <button
                      className="btn btn-sm"
                      onClick={() => dispatch({ type: 'UNASSIGN_HAMSTER', hamsterId: h.id })}
                    >
                      回窝休息
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm"
                      onClick={() => setAssigningId(assigning ? null : h.id)}
                      disabled={availableFacilities.length === 0}
                    >
                      {assigning ? '取消' : '分配到设施'}
                    </button>
                  )}
                </div>

                {/* 设施选择 */}
                {assigning && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {availableFacilities.map(f => {
                      const def = getFacilityDef(f.type);
                      return (
                        <button
                          key={f.id}
                          className="btn btn-sm"
                          style={{ textAlign: 'left' }}
                          onClick={() => {
                            dispatch({ type: 'ASSIGN_HAMSTER', hamsterId: h.id, facilityId: f.id });
                            setAssigningId(null);
                          }}
                        >
                          {def?.name ?? f.type} ({f.occupants.length}/{f.capacity})
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 记忆 */}
                {h.memory.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>记忆 ({h.memory.length})</div>
                    {h.memory.slice(-3).map((m, i) => (
                      <div key={i} style={{ fontSize: 11, color: '#374151', lineHeight: 1.4 }}>
                        {m.important && '⭐ '}[回合{m.turn}] {m.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Hamsters;
