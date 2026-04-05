// 3.3.2 事件页 — 事件卡片 + 选项选择 + 收养提案

import React from 'react';
import { useStore } from '../store';
import { getTabGuides } from '../guides';

/** 资源变化标注 */
const Delta: React.FC<{ value: number; icon: string }> = ({ value, icon }) => {
  if (value === 0) return null;
  const cls = value > 0 ? 'delta-pos' : 'delta-neg';
  return <span className={cls}>{icon}{value > 0 ? '+' : ''}{value}</span>;
};

const Events: React.FC = () => {
  const { state, dispatch } = useStore();
  const eventEntries = Object.entries(state.game.pending_events);
  const proposal = state.game.adoption_proposal;
  const showProposal = proposal && !state.proposalDismissed;
  const hasContent = eventEntries.length > 0 || showProposal;
  const tips = getTabGuides(state.game).events;

  if (!hasContent) {
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
          当前没有待处理事件
          <div style={{ fontSize: 12, marginTop: 8 }}>
            {state.generating ? '正在生成事件...' : '推进回合后会生成新事件'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 收养提案 */}
      {showProposal && (
        <div className="card" style={{ borderColor: '#f472b6', background: '#fdf2f8' }}>
          <div style={{ fontWeight: 600, marginBottom: 6, color: '#be185d' }}>有一只鼠鼠在乐园门口等待收养!</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>
            <div><b>{proposal.name}</b> — {proposal.breed}</div>
            <div>性格: {proposal.personality}</div>
            <div>基础产能: ⚡{proposal.basePower}{proposal.preference ? ` | 偏好: ${proposal.preference}` : ''}</div>
            {proposal.story && <div style={{ marginTop: 4, color: '#6b7280', fontStyle: 'italic' }}>{proposal.story}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                const existingCount = Object.keys(state.game.hamsters).length;
                const id = `hamster_${existingCount + 1}`;
                dispatch({
                  type: 'ADOPT_HAMSTER',
                  hamsterId: id,
                  data: {
                    name: proposal.name,
                    breed: proposal.breed,
                    personality: proposal.personality,
                    basePower: proposal.basePower,
                    preference: proposal.preference,
                    story: proposal.story,
                  },
                });
              }}
            >
              收养 (⚡-15)
            </button>
            <button
              className="btn"
              onClick={() => dispatch({ type: 'DISMISS_PROPOSAL' })}
            >
              下次再说
            </button>
            <button
              className="btn btn-sm"
              style={{ color: '#9ca3af', marginLeft: 'auto' }}
              onClick={() => dispatch({ type: 'REJECT_PROPOSAL' })}
            >
              不想要了
            </button>
          </div>
        </div>
      )}

      {/* 事件列表 */}
      {eventEntries.map(([eventId, event]) => (
        <div key={eventId} className="card">
          {/* 事件描述 */}
          <div style={{ marginBottom: 10, lineHeight: 1.6 }}>{event.description}</div>

          {/* 关联角色 */}
          {event.related_characters && (
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
              关联: {event.related_characters}
            </div>
          )}

          {/* 选项 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(event.options).map(([optKey, opt]) => (
              <button
                key={optKey}
                className={`btn ${opt.is_silly ? 'silly-option' : ''}`}
                style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => dispatch({ type: 'CHOOSE_EVENT', eventId, optionKey: optKey })}
              >
                <span>
                  {opt.is_silly && '🎪 '}
                  {opt.label}
                </span>
                <span style={{ display: 'flex', gap: 8, fontSize: 12, flexShrink: 0, marginLeft: 8 }}>
                  <Delta value={opt.energy_delta} icon="⚡" />
                  <Delta value={opt.stardust_delta} icon="✨" />
                  <Delta value={opt.mood_delta} icon="💛" />
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Events;
