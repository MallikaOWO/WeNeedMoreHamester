// 3.1 全局状态管理
// React Context + useReducer，连接 MVU 读写和游戏引擎

import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import type { GameState, Hamster } from '../../schema';
import { loadGameState, saveGameState } from '../../bridge/state';
import { createInitialGameState } from '../../data/init';

// engine imports
import { buildFacility, upgradeFacility, assignAngelToFacility } from '../../engine/facility';
import { adoptHamster, assignHamster, unassignHamster } from '../../engine/hamster';
import { levelUpAngel, useSkill, tickCooldowns } from '../../engine/angel';
import { applyEventChoice, rollEventSlots } from '../../engine/event';
import { settleTurn } from '../../engine/turn';
import { checkAchievements } from '../../engine/achievement';

// ── UI 状态 ──

export type TabId = 'overview' | 'hamsters' | 'facilities' | 'angels' | 'events' | 'log';

export interface LogEntry {
  turn: number;
  text: string;
  type: 'event' | 'build' | 'upgrade' | 'adopt' | 'skill' | 'achievement' | 'turn';
}

export interface AppState {
  game: GameState;
  tab: TabId;
  log: LogEntry[];
  loading: boolean;
}

// ── Actions ──

export type Action =
  | { type: 'LOAD'; state: GameState }
  | { type: 'SET_TAB'; tab: TabId }
  | { type: 'BUILD_FACILITY'; facilityType: string }
  | { type: 'UPGRADE_FACILITY'; facilityId: string }
  | { type: 'ASSIGN_ANGEL'; angelId: string; facilityId: string }
  | { type: 'ADOPT_HAMSTER'; hamsterId: string; data: Omit<Hamster, 'assignedTo' | 'memory' | 'mood' | 'stamina'> }
  | { type: 'ASSIGN_HAMSTER'; hamsterId: string; facilityId: string }
  | { type: 'UNASSIGN_HAMSTER'; hamsterId: string }
  | { type: 'LEVEL_UP_ANGEL'; angelId: string }
  | { type: 'USE_SKILL'; angelId: string; skillId: string; targetId?: string }
  | { type: 'CHOOSE_EVENT'; eventId: string; optionKey: string }
  | { type: 'ADVANCE_TURN' };

// ── Reducer ──

function addLog(state: AppState, text: string, logType: LogEntry['type']): LogEntry[] {
  return [...state.log, { turn: state.game.turn, text, type: logType }];
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD':
      return { ...state, game: action.state, loading: false };

    case 'SET_TAB':
      return { ...state, tab: action.tab };

    case 'BUILD_FACILITY': {
      const newGame = buildFacility(state.game, action.facilityType);
      if (newGame === state.game) return state;
      return {
        ...state,
        game: newGame,
        log: addLog(state, `建造了设施: ${action.facilityType}`, 'build'),
      };
    }

    case 'UPGRADE_FACILITY': {
      const newGame = upgradeFacility(state.game, action.facilityId);
      if (newGame === state.game) return state;
      return {
        ...state,
        game: newGame,
        log: addLog(state, `升级了设施: ${action.facilityId}`, 'upgrade'),
      };
    }

    case 'ASSIGN_ANGEL': {
      const newGame = assignAngelToFacility(state.game, action.angelId, action.facilityId);
      if (newGame === state.game) return state;
      return { ...state, game: newGame };
    }

    case 'ADOPT_HAMSTER': {
      const result = adoptHamster(state.game, action.hamsterId, action.data);
      if (!result.success) return state;
      return {
        ...state,
        game: result.state,
        log: addLog(state, `收养了鼠鼠: ${action.data.name}`, 'adopt'),
      };
    }

    case 'ASSIGN_HAMSTER': {
      const result = assignHamster(state.game, action.hamsterId, action.facilityId);
      if (!result.success) return state;
      return { ...state, game: result.state };
    }

    case 'UNASSIGN_HAMSTER': {
      const newGame = unassignHamster(state.game, action.hamsterId);
      return { ...state, game: newGame };
    }

    case 'LEVEL_UP_ANGEL': {
      const newGame = levelUpAngel(state.game, action.angelId);
      if (newGame === state.game) return state;
      const angel = newGame.angels[action.angelId];
      return {
        ...state,
        game: newGame,
        log: addLog(state, `${angel?.name ?? action.angelId} 升级到 Lv.${angel?.level}`, 'skill'),
      };
    }

    case 'USE_SKILL': {
      const result = useSkill(state.game, action.angelId, action.skillId, action.targetId);
      if (!result.success) return state;
      return {
        ...state,
        game: result.state,
        log: addLog(state, `使用了技能: ${action.skillId}`, 'skill'),
      };
    }

    case 'CHOOSE_EVENT': {
      const event = state.game.pending_events[action.eventId];
      const option = event?.options[action.optionKey];
      const newGame = applyEventChoice(state.game, action.eventId, action.optionKey);
      if (newGame === state.game) return state;
      return {
        ...state,
        game: newGame,
        log: addLog(state, `事件「${event?.description?.slice(0, 20) ?? ''}...」选择了: ${option?.label ?? ''}`, 'event'),
      };
    }

    case 'ADVANCE_TURN': {
      let game = state.game;
      let log = [...state.log];

      // 1. 回合结算（settleTurn 已含 turn+1）
      game = settleTurn(game);
      game = tickCooldowns(game);
      log.push({ turn: game.turn, text: `回合 ${game.turn} 开始`, type: 'turn' });

      // 2. 成就检测
      const achResult = checkAchievements(game);
      game = achResult.state;
      for (const ach of achResult.unlocked) {
        log.push({ turn: game.turn, text: `解锁成就: ${ach.name} (+${ach.reward}星尘)`, type: 'achievement' });
      }

      // 3. 生成下回合事件槽（实际事件由 AI 生成，这里只是占位）
      const slots = rollEventSlots(game);
      log.push({ turn: game.turn, text: `本回合事件槽: ${slots.join('、')}`, type: 'turn' });

      return { ...state, game, log };
    }

    default:
      return state;
  }
}

// ── Context ──

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export function useGameState(): GameState {
  return useStore().state.game;
}

export function useDispatch(): React.Dispatch<Action> {
  return useStore().dispatch;
}

// ── Provider ──

const initialAppState: AppState = {
  game: {
    energy: 0, energyCap: 0, stardust: 0, turn: 0, happiness: 0,
    hamsters: {}, facilities: {}, angels: {}, achievements: {},
    pending_events: {}, adoption_proposal: null,
  },
  tab: 'overview',
  log: [],
  loading: true,
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialAppState);
  const initialized = useRef(false);

  // 初始化：从 MVU 加载状态
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      const gameState = loadGameState();
      dispatch({ type: 'LOAD', state: gameState });
    } catch (e) {
      console.error('[鼠鼠天堂] 加载状态失败，使用初始状态:', e);
      dispatch({ type: 'LOAD', state: createInitialGameState() });
    }
  }, []);

  // 自动保存：game 变化时写回 MVU
  const prevGame = useRef(state.game);
  useEffect(() => {
    if (state.loading) return;
    if (prevGame.current === state.game) return;
    prevGame.current = state.game;
    saveGameState(state.game).catch(e => {
      console.error('[鼠鼠天堂] 保存状态失败:', e);
    });
  }, [state.game, state.loading]);

  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
};
