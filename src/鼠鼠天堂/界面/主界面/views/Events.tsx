// 3.3.2 事件页 — 事件卡片 + 选项选择

import React from 'react';
import { useStore } from '../store';

/** 资源变化标注 */
const Delta: React.FC<{ value: number; icon: string }> = ({ value, icon }) => {
  if (value === 0) return null;
  const cls = value > 0 ? 'delta-pos' : 'delta-neg';
  return <span className={cls}>{icon}{value > 0 ? '+' : ''}{value}</span>;
};

const Events: React.FC = () => {
  const { state, dispatch } = useStore();
  const eventEntries = Object.entries(state.game.pending_events);

  if (eventEntries.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>
        当前没有待处理事件
        <div style={{ fontSize: 12, marginTop: 8 }}>推进回合后会生成新事件</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
