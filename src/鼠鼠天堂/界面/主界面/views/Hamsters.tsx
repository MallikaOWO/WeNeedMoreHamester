// 3.3.4 鼠鼠页 — 鼠鼠卡片 + 居住/玩耍分配 + 详情

import React, { useState } from 'react';
import { useStore } from '../store';
import { getTabGuides } from '../guides';
import { getFacilityDef, FACILITY_DEFS } from '../../../data/facilities';

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
  const { state, dispatch, interactWithCharacter } = useStore();
  const game = state.game;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [assignMode, setAssignMode] = useState<{ hamsterId: string; type: 'work' | 'living' } | null>(null);

  const hamsterEntries = Object.entries(game.hamsters);
  const tips = getTabGuides(game).hamsters;

  if (hamsterEntries.length === 0) {
    return (
      <div>
        {tips && tips.length > 0 && (
          <div className="card" style={{ marginBottom: 12, background: '#eff6ff', borderColor: '#3b82f6' }}>
            {tips.map((tip, i) => (
              <div key={i} style={{ color: '#1e40af', fontSize: 13, lineHeight: 1.6 }}>{tip}</div>
            ))}
          </div>
        )}
        <div className="card" style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>
          乐园里还没有鼠鼠
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
      // 如果当前鼠鼠已住这里，不算占位
      const selfHere = game.hamsters[excludeHamsterId]?.livingAt === fId ? 1 : 0;
      return (residents - selfHere) < f.capacity;
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {tips && tips.length > 0 && (
        <div className="card" style={{ background: '#eff6ff', borderColor: '#3b82f6' }}>
          {tips.map((tip, i) => (
            <div key={i} style={{ color: '#1e40af', fontSize: 13, lineHeight: 1.6 }}>{tip}</div>
          ))}
        </div>
      )}
      {hamsterEntries.map(([hId, h]) => {
        const expanded = expandedId === hId;
        const isAssigning = assignMode?.hamsterId === hId;

        const livingFacility = h.livingAt ? game.facilities[h.livingAt] : null;
        const livingName = livingFacility ? (getFacilityDef(livingFacility.type)?.name ?? '未知') : '无住所';
        const workFacility = h.workingAt ? game.facilities[h.workingAt] : null;
        const workName = workFacility ? (getFacilityDef(workFacility.type)?.name ?? '未知') : null;

        return (
          <div key={hId} className="card">
            {/* 头部 */}
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => { setExpandedId(expanded ? null : hId); setAssignMode(null); }}
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
              性格: {h.personality} | 住所: {livingName}
              {workName ? ` | 玩耍: ${workName}` : ' | 休息中'}
            </div>

            {/* 展开详情 */}
            {expanded && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>故事: {h.story}</div>
                <div style={{ fontSize: 12, marginBottom: 4 }}>偏好设施: {(h.preference && FACILITY_DEFS.find(d => d.type === h.preference)?.name) || h.preference || '无'}</div>
                <div style={{ fontSize: 12, marginBottom: 8 }}>基础产能: ⚡{h.basePower}</div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {/* 玩耍相关 */}
                  {h.workingAt ? (
                    <button
                      className="btn btn-sm"
                      onClick={() => dispatch({ type: 'STOP_WORKING', hamsterId: hId })}
                    >
                      回窝休息
                    </button>
                  ) : (
                    <>
                      <button
                        className="btn btn-sm"
                        onClick={() => setAssignMode(isAssigning && assignMode?.type === 'work' ? null : { hamsterId: hId, type: 'work' })}
                        disabled={availableWorkFacilities.length === 0}
                        style={availableWorkFacilities.length === 0 ? { opacity: 0.5 } : undefined}
                      >
                        {isAssigning && assignMode?.type === 'work' ? '取消' : '去玩耍'}
                      </button>
                      {availableWorkFacilities.length === 0 && (
                        <span style={{ fontSize: 11, color: '#dc2626' }}>玩耍设施已满</span>
                      )}
                    </>
                  )}
                  {/* 换住所 */}
                  <button
                    className="btn btn-sm"
                    onClick={() => setAssignMode(isAssigning && assignMode?.type === 'living' ? null : { hamsterId: hId, type: 'living' })}
                  >
                    {isAssigning && assignMode?.type === 'living' ? '取消' : '换住所'}
                  </button>
                  {/* 互动 */}
                  <button
                    className="btn btn-sm"
                    onClick={() => interactWithCharacter(hId)}
                    disabled={state.generating}
                  >
                    {state.generating ? '互动中...' : '互动'}
                  </button>
                </div>

                {/* 设施选择列表 */}
                {isAssigning && assignMode?.type === 'work' && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>选择玩耍设施:</div>
                    {availableWorkFacilities.map(([fId, f]) => {
                      const def = getFacilityDef(f.type);
                      return (
                        <button
                          key={fId}
                          className="btn btn-sm"
                          style={{ textAlign: 'left' }}
                          onClick={() => {
                            dispatch({ type: 'ASSIGN_WORK', hamsterId: hId, facilityId: fId });
                            setAssignMode(null);
                          }}
                        >
                          {def?.name ?? f.type} ({Object.keys(f.occupants).length}/{f.capacity})
                        </button>
                      );
                    })}
                  </div>
                )}

                {isAssigning && assignMode?.type === 'living' && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>选择住所:</div>
                    {getAvailableLivingFacilities(hId).map(([fId, f]) => {
                      const def = getFacilityDef(f.type);
                      const residents = Object.values(game.hamsters).filter(ham => ham.livingAt === fId).length;
                      const isCurrent = h.livingAt === fId;
                      return (
                        <button
                          key={fId}
                          className="btn btn-sm"
                          style={{ textAlign: 'left' }}
                          disabled={isCurrent}
                          onClick={() => {
                            dispatch({ type: 'CHANGE_LIVING', hamsterId: hId, facilityId: fId });
                            setAssignMode(null);
                          }}
                        >
                          {def?.name ?? f.type} ({residents}/{f.capacity})
                          {isCurrent && ' (当前)'}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 记忆 */}
                {Object.keys(h.memory).length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>记忆 ({Object.keys(h.memory).length})</div>
                    {Object.entries(h.memory).slice(-3).map(([key, text]) => (
                      <div key={key} style={{ fontSize: 11, color: '#374151', lineHeight: 1.4 }}>
                        {key.startsWith('!') && '⭐ '}[{key}] {text}
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
