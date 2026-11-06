import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';

export type EloLevel = 700 | 900 | 1100;

export type ComputerMove = {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
};

const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 335,
  r: 500,
  q: 900,
  k: 20_000,
};

const LEVELS: Record<
  EloLevel,
  { depth: number; tolerance: number; blunderChance: number }
> = {
  700: { depth: 1, tolerance: 125, blunderChance: 0.08 },
  900: { depth: 2, tolerance: 55, blunderChance: 0.025 },
  1100: { depth: 3, tolerance: 20, blunderChance: 0.008 },
};

const MATE_SCORE = 100_000;

function evaluate(chess: Chess): number {
  let score = 0;
  const board = chess.board();

  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const piece = board[row][column];
      if (!piece) continue;

      const sign = piece.color === 'w' ? 1 : -1;
      let value = PIECE_VALUE[piece.type];
      const centerDistance =
        Math.abs(3.5 - row) + Math.abs(3.5 - column);

      if (piece.type === 'p') {
        const progress = piece.color === 'w' ? 6 - row : row - 1;
        value += Math.max(0, progress) * 7;
        value += (3.5 - Math.abs(3.5 - column)) * 2;
      } else if (piece.type === 'n' || piece.type === 'b') {
        value += Math.max(0, 7 - centerDistance) * 5;
      } else if (piece.type === 'q') {
        value += Math.max(0, 5 - centerDistance) * 2;
      } else if (piece.type === 'k' && chess.moveNumber() < 20) {
        value += centerDistance * 4;
      }

      score += sign * value;
    }
  }

  return chess.turn() === 'w' ? score : -score;
}

function moveOrderValue(move: Move): number {
  const captured = move.captured ? PIECE_VALUE[move.captured] : 0;
  const attacker = PIECE_VALUE[move.piece];
  const promotion = move.promotion ? PIECE_VALUE[move.promotion] : 0;
  const checkBonus = move.san.includes('+') || move.san.includes('#') ? 45 : 0;

  return captured * 10 - attacker + promotion + checkBonus;
}

function orderedMoves(chess: Chess): Move[] {
  return chess
    .moves({ verbose: true })
    .sort((a, b) => moveOrderValue(b) - moveOrderValue(a));
}

function search(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
): number {
  if (chess.isCheckmate()) return -MATE_SCORE + ply;
  if (chess.isDraw()) return 0;
  if (depth <= 0) return evaluate(chess);

  let best = -Infinity;
  for (const move of orderedMoves(chess)) {
    chess.move(move);
    const score = -search(chess, depth - 1, -beta, -alpha, ply + 1);
    chess.undo();

    best = Math.max(best, score);
    alpha = Math.max(alpha, score);
    if (alpha >= beta) break;
  }

  return best;
}

export function chooseComputerMove(
  fen: string,
  level: EloLevel,
): ComputerMove | null {
  const chess = new Chess(fen);
  const moves = orderedMoves(chess);
  if (moves.length === 0) return null;

  const settings = LEVELS[level];

  if (Math.random() < settings.blunderChance) {
    const move = moves[Math.floor(Math.random() * moves.length)];
    return { from: move.from, to: move.to, promotion: move.promotion };
  }

  const scoredMoves = moves.map((move) => {
    chess.move(move);
    const score = -search(chess, settings.depth - 1, -Infinity, Infinity, 1);
    chess.undo();
    return { move, score };
  });

  const bestScore = Math.max(...scoredMoves.map(({ score }) => score));
  const acceptable = scoredMoves.filter(
    ({ score }) => score >= bestScore - settings.tolerance,
  );
  const choice = acceptable[Math.floor(Math.random() * acceptable.length)];

  return {
    from: choice.move.from,
    to: choice.move.to,
    promotion: choice.move.promotion,
  };
}
