// 3.3.2 事件页 — 事件卡片 + 选项选择 + 收养提案

import React from 'react';
import { useStore } from '../store';
import { getTabGuides } from '../guides';
import { getFacilityDef } from '../../../data/facilities';

/** 资源变化标注 */
const Delta: React.FC<{ value: number; icon: string }> = ({ value, icon }) => {
  if (value === 0) return null;
  const cls = value > 0 ? 'delta-pos' : 'delta-neg';
  return (
    <span className={cls} style={{ fontSize: 11, padding: '1px 4px', borderRadius: 'var(--radius-sm)', background: value > 0 ? 'var(--color-stardust-bg)' : 'var(--color-mood-bg)' }}>
      {icon}{value > 0 ? '+' : ''}{value}
    </span>
  );
};

const Events: React.FC = () => {
  const { state, dispatch } = useStore();
  const eventEntries = Object.entries(state.game.pending_events);
  const proposal = state.game.adoption_proposal;
  const showProposal = proposal && !state.proposalDismissed;
  const hasContent = eventEntries.length > 0 || showProposal;

  // 收养可行性检查
  const adoptCheck = (() => {
    if (!proposal) return { ok: false, reason: '' };
    const game = state.game;
    const livingCap = Object.values(game.facilities)
      .filter(f => getFacilityDef(f.type)?.category === 'living')
      .reduce((sum, f) => sum + f.capacity, 0);
    const livingUsed = Object.values(game.hamsters).filter(h => h.livingAt).length;
    if (livingUsed >= livingCap) return { ok: false, reason: '住所已满，请先建造新住所' };
    if (game.energy < 15) return { ok: false, reason: `能源不足（需要15⚡，当前${game.energy}⚡）` };
    return { ok: true, reason: '' };
  })();
  const tips = getTabGuides(state.game).events;

  if (!hasContent) {
    return (
      <div className="fade-in">
        {tips && tips.length > 0 && (
          <div className="card guide-card">
            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>💡 事件簿</div>
            {tips.map((tip, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.5 }}>{tip}</div>
            ))}
          </div>
        )}
        <div className="card" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '32px 16px' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>☕</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>当前没有待处理事件</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            {state.generating ? '正在生成...' : '推进回合后会出现新事件'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* 收养提案 */}
      {showProposal && (
        <div className="card" style={{ borderColor: 'var(--color-happiness)', background: 'var(--color-happiness-bg)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--color-accent)', fontSize: 13 }}>
            🐹 有一只鼠鼠想加入乐园！
          </div>

          <div style={{ background: 'white', padding: 10, borderRadius: 'var(--radius-md)', marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{proposal.name}</span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{proposal.breed}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={{ fontSize: 11, background: 'var(--color-surface)', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>性格: {proposal.personality}</span>
              <span style={{ fontSize: 11, background: 'var(--color-surface)', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>⚡ 产能: {proposal.basePower}</span>
              {proposal.preference && <span style={{ fontSize: 11, background: 'var(--color-energy-bg)', color: 'var(--color-text)', padding: '1px 6px', borderRadius: 'var(--radius-sm)' }}>🍭 偏好: {proposal.preference}</span>}
            </div>
            {proposal.story && <div style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5, fontStyle: 'italic' }}>{proposal.story}</div>}
          </div>

          {!adoptCheck.ok && (
            <div style={{ fontSize: 12, color: 'var(--color-negative)', marginBottom: 6, fontWeight: 600 }}>
              ⚠ {adoptCheck.reason}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-primary btn-sm"
              disabled={!adoptCheck.ok}
              onClick={() => {
                if (!adoptCheck.ok) return;
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
              🤝 收养 (⚡-15)
            </button>
            <button className="btn btn-sm" onClick={() => dispatch({ type: 'DISMISS_PROPOSAL' })}>下次再说</button>
            <button
              className="btn btn-sm"
              style={{ background: 'transparent', border: 'none', color: 'var(--color-text-light)', marginLeft: 'auto' }}
              onClick={() => dispatch({ type: 'REJECT_PROPOSAL' })}
            >
              送走
            </button>
          </div>
        </div>
      )}

      {/* 事件列表 */}
      {eventEntries.map(([eventId, event]) => (
        <div key={eventId} className="card">
          <div style={{ marginBottom: 10, fontSize: 13, lineHeight: 1.6, fontWeight: 500 }}>
            {event.description}
          </div>

          {event.related_characters && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, background: 'var(--color-surface)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', width: 'fit-content' }}>
              👥 {event.related_characters}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(event.options).map(([optKey, opt]) => (
              <button
                key={optKey}
                className={`btn ${opt.is_silly ? 'silly-option' : ''}`}
                style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px' }}
                onClick={() => dispatch({ type: 'CHOOSE_EVENT', eventId, optionKey: optKey })}
              >
                <span style={{ fontWeight: 600, fontSize: 13 }}>
                  {opt.is_silly && '🤡 '}{opt.label}
                </span>
                <span style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                  <Delta value={opt.energy_delta} icon="⚡" />
                  <Delta value={opt.stardust_delta} icon="✨" />
                  <Delta value={opt.mood_delta} icon="💝" />
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
