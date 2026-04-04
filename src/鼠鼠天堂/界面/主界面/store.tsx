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
  /** AI 正在生成中 */
  generating: boolean;
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
  | { type: 'ADVANCE_TURN' }
  | { type: 'DISMISS_PROPOSAL' }
  | { type: 'SET_GENERATING'; generating: boolean }
  | { type: 'RELOAD' };

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
        game: { ...result.state, adoption_proposal: null },
        log: addLog(state, `收养了鼠鼠: ${action.data.name}`, 'adopt'),
      };
    }

    case 'DISMISS_PROPOSAL':
      return { ...state, game: { ...state.game, adoption_proposal: null } };

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

      return { ...state, game, log };
    }

    case 'SET_GENERATING':
      return { ...state, generating: action.generating };

    case 'RELOAD': {
      // 从 MVU 重新加载最新状态（AI 更新后调用）
      try {
        const freshState = loadGameState();
        return { ...state, game: freshState, generating: false };
      } catch {
        return { ...state, generating: false };
      }
    }

    default:
      return state;
  }
}

// ── Context ──

interface StoreContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  /** 推进回合并触发 AI 生成 */
  advanceTurnAndGenerate: () => Promise<void>;
  /** 与角色互动并触发 AI 生成 */
  interactWithCharacter: (characterId: string) => Promise<void>;
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
  generating: false,
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

  // AI 生成完成后从 MVU 重新加载状态
  useEffect(() => {
    const handler = eventOn(iframe_events.GENERATION_ENDED, () => {
      // 给 MVU 一点时间完成 JSONPatch 应用和 VARIABLE_UPDATE_ENDED 钩子
      setTimeout(() => dispatch({ type: 'RELOAD' }), 300);
    });
    return () => handler.stop();
  }, []);

  // 4.2 推进回合并触发 AI 生成
  const advanceTurnAndGenerate = useCallback(async () => {
    if (state.generating) return;

    // 1. 引擎结算（同步 reducer）
    dispatch({ type: 'ADVANCE_TURN' });
    dispatch({ type: 'SET_GENERATING', generating: true });

    try {
      // 2. 等待状态保存到 MVU（auto-save effect 会处理）
      // 这里手动保存确保 AI 读到最新状态
      const freshState = loadGameState();
      const settled = checkAchievements(settleTurn(tickCooldowns(freshState)));
      await saveGameState(settled.state);

      // 3. 创建 user 消息楼层（触发世界书 EJS 模板注入动态提示词）
      await createChatMessages(
        [{ role: 'user', message: `[推进到回合 ${settled.state.turn}]` }],
        { refresh: 'none' },
      );

      // 4. 调用 AI 生成（世界书自动注入状态摘要+事件指令）
      await generate({
        should_stream: true,
      });
    } catch (e) {
      console.error('[鼠鼠天堂] AI 生成失败:', e);
      dispatch({ type: 'SET_GENERATING', generating: false });
    }
    // 注意：generating 状态由 GENERATION_ENDED 事件监听器重置
  }, [state.generating]);

  // 4.4 个体互动
  const interactWithCharacter = useCallback(async (characterId: string) => {
    if (state.generating) return;

    dispatch({ type: 'SET_GENERATING', generating: true });

    try {
      const game = loadGameState();
      const character = game.hamsters[characterId] || game.angels[characterId];
      const name = character?.name ?? characterId;

      await createChatMessages(
        [{ role: 'user', message: `[与${name}互动]` }],
        { refresh: 'none' },
      );

      await generate({
        should_stream: true,
      });
    } catch (e) {
      console.error('[鼠鼠天堂] 互动生成失败:', e);
      dispatch({ type: 'SET_GENERATING', generating: false });
    }
  }, [state.generating]);

  return (
    <StoreContext.Provider value={{ state, dispatch, advanceTurnAndGenerate, interactWithCharacter }}>
      {children}
    </StoreContext.Provider>
  );
};
