import { useState, useCallback } from 'react';

export type RuleSet = {
  name: string;
  birth: number[];
  survival: number[];
  description: string;
};

export const RULE_SETS: Record<string, RuleSet> = {
  conway: {
    name: "Game of Life",
    birth: [3],
    survival: [2, 3],
    description: "Standard rules. Well balanced."
  },
  highlife: {
    name: "HighLife",
    birth: [3, 6],
    survival: [2, 3],
    description: "Self-replicating patterns are common."
  },
  seeds: {
    name: "Seeds",
    birth: [2],
    survival: [],
    description: "Explosive growth, but dies easily."
  },
  maze: {
    name: "Maze",
    birth: [3],
    survival: [1, 2, 3, 4, 5],
    description: "Forms maze-like structures."
  },
  replicator: {
    name: "Replicator",
    birth: [1, 3, 5, 7],
    survival: [1, 3, 5, 7],
    description: "Invented by Edward Fredkin. Creates copies."
  },
  daynight: {
    name: "Day & Night",
    birth: [3, 6, 7, 8],
    survival: [3, 4, 6, 7, 8],
    description: "Very active and complex movements."
  }
};

export function useLifeGame(rows: number, cols: number) {
  const [grid, setGrid] = useState<boolean[][]>(() => 
    Array.from({ length: rows }, () => Array(cols).fill(false))
  );
  const [generation, setGeneration] = useState(0);
  const [currentRule, setCurrentRule] = useState<RuleSet>(RULE_SETS.conway);

  const computeNext = useCallback((currentGrid: boolean[][], rule: RuleSet = currentRule) => {
    const nextGrid = Array.from({ length: rows }, () => Array(cols).fill(false));
    let hasChanged = false;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isAlive = currentGrid[r][c];
        let neighbors = 0;
        const emptyNeighbors: [number, number][] = [];

        for (let i = -1; i <= 1; i++) {
          for (let j = -1; j <= 1; j++) {
            if (i === 0 && j === 0) continue;
            const nr = r + i;
            const nc = c + j;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              if (currentGrid[nr][nc]) {
                neighbors++;
              } else {
                emptyNeighbors.push([nr, nc]);
              }
            }
          }
        }

        let nextState = false;

        // 独自ルール: 孤立セルの彷徨 (SeedsやReplicatorなど爆発系以外で適用)
        const isExplosive = rule.birth.includes(1) || (rule.birth.includes(2) && rule.survival.length === 0);
        
        if (isAlive) {
          if (!isExplosive && neighbors === 0) {
             // 彷徨う: ランダム移動
             if (emptyNeighbors.length > 0) {
               const [tr, tc] = emptyNeighbors[Math.floor(Math.random() * emptyNeighbors.length)];
               nextGrid[tr][tc] = true;
               nextState = false; // 元の場所は死ぬ
             } else {
               nextState = true; // 動けないなら留まる
             }
          } else {
            // 生存ルール
            nextState = rule.survival.includes(neighbors);
          }
        } else {
          // 誕生ルール
          nextState = rule.birth.includes(neighbors);
        }

        // 彷徨いによる移動先が既に埋まっている場合の競合は、
        // 単純な上書き（後勝ち）またはOR条件になるが、
        // ここでは nextGrid[tr][tc] = true しているので、
        // 誕生ルールと競合しても「生」が優先される。
        
        // ただし、上記ループ内で nextGrid[tr][tc] = true すると、
        // まだ処理していないセル (r, cより後ろ) の判定に影響を与えないよう、
        // nextGrid は「次の世代」として独立している必要がある。
        // しかし、彷徨いロジックは「移動」なので、移動先を true にする。
        // もし移動先が (r, c) より前なら問題ないが、後ろだとどうなるか？
        // nextGrid は初期化されているので、移動先を true にするだけでよい。
        // ただし、複数のセルが同じ場所に移動してくる可能性はある（融合）。
        
        if (nextState) {
          nextGrid[r][c] = true;
        }
      }
    }

    // 変更検知
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (nextGrid[r][c] !== currentGrid[r][c]) {
          hasChanged = true;
          break;
        }
      }
    }

    return { newGrid: nextGrid, hasChanged };
  }, [rows, cols, currentRule]);

  const toggleCell = useCallback((r: number, c: number) => {
    setGrid(prev => {
      const newGrid = prev.map(row => [...row]);
      newGrid[r][c] = !newGrid[r][c];
      return newGrid;
    });
    setGeneration(0);
  }, []);

  const setCell = useCallback((r: number, c: number, value: boolean) => {
    setGrid(prev => {
      if (prev[r][c] === value) return prev;
      const newGrid = prev.map(row => [...row]);
      newGrid[r][c] = value;
      return newGrid;
    });
    setGeneration(0);
  }, []);

  const nextGeneration = useCallback(() => {
    let changed = false;
    setGrid(prev => {
      const { newGrid, hasChanged } = computeNext(prev);
      changed = hasChanged;
      return newGrid;
    });
    setGeneration(g => g + 1);
    return changed;
  }, [computeNext]);

  const clearGrid = useCallback(() => {
    setGrid(Array.from({ length: rows }, () => Array(cols).fill(false)));
    setGeneration(0);
  }, [rows, cols]);

  const changeRule = useCallback((ruleKey: string) => {
    if (RULE_SETS[ruleKey]) {
      setCurrentRule(RULE_SETS[ruleKey]);
    }
  }, []);

  return { 
    grid, 
    generation, 
    currentRule,
    toggleCell, 
    nextGeneration, 
    clearGrid, 
    setGrid, 
    computeNext,
    changeRule,
    setCell
  };
}
