<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { Chess, type PieceSymbol, type Square } from 'chess.js';
import { chooseComputerMove, type EloLevel } from './chess-ai';

type Color = 'w' | 'b';
type Screen = 'setup' | 'game';
type PromotionPiece = 'q' | 'r' | 'b' | 'n';

const levels: { value: EloLevel; label: string }[] = [
  { value: 700, label: 'Для разминки' },
  { value: 900, label: 'Уверенная игра' },
  { value: 1100, label: 'Посложнее' },
];
const pieceGlyphs: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};
const promotionChoices: { type: PromotionPiece; label: string }[] = [
  { type: 'q', label: 'Ферзь' },
  { type: 'r', label: 'Ладья' },
  { type: 'b', label: 'Слон' },
  { type: 'n', label: 'Конь' },
];
const screen = ref<Screen>('setup');
const selectedLevel = ref<EloLevel>(900);
const playerColor = ref<Color>('w');
const chess = ref(new Chess());
const revision = ref(0);
const selectedSquare = ref<Square | null>(null);
const legalDestinations = ref<Square[]>([]);
const lastMove = ref<{ from: Square; to: Square } | null>(null);
const thinking = ref(false);
const promotionFrom = ref<Square | null>(null);
const promotionTo = ref<Square | null>(null);
let computerTimer: ReturnType<typeof setTimeout> | null = null;

const boardSquares = computed(() => {
  revision.value;
  const files = playerColor.value === 'w' ? 'abcdefgh'.split('') : 'hgfedcba'.split('');
  const ranks = playerColor.value === 'w' ? '87654321'.split('') : '12345678'.split('');
  return ranks.flatMap((rank, row) =>
    files.map((file, column) => ({
      square: `${file}${rank}` as Square,
      row,
      column,
      piece: chess.value.get(`${file}${rank}` as Square),
    })),
  );
});
const gameOver = computed(() => {
  revision.value;
  return chess.value.isGameOver();
});
const isPlayerTurn = computed(() => chess.value.turn() === playerColor.value && !gameOver.value);

function pieceName(piece: PieceSymbol): string {
  return ({ k: 'король', q: 'ферзь', r: 'ладья', b: 'слон', n: 'конь', p: 'пешка' })[piece];
}
function squareLabel(square: Square): string {
  const piece = chess.value.get(square);
  if (!piece) return `${square}, пустая клетка`;
  return `${square}, ${piece.color === 'w' ? 'белые' : 'чёрные'}: ${pieceName(piece.type)}`;
}
function isLightSquare(row: number, column: number): boolean {
  return (row + column) % 2 === 1;
}
function isCheckedKing(square: Square): boolean {
  const piece = chess.value.get(square);
  return Boolean(piece?.type === 'k' && piece.color === chess.value.turn() && chess.value.isCheck());
}
function squareClasses(square: Square, row: number, column: number) {
  return {
    light: isLightSquare(row, column),
    dark: !isLightSquare(row, column),
    selected: selectedSquare.value === square,
    'last-move': lastMove.value?.from === square || lastMove.value?.to === square,
    'in-check': isCheckedKing(square),
  };
}
function clearSelection() {
  selectedSquare.value = null;
  legalDestinations.value = [];
}
function startNewGame() {
  if (computerTimer) clearTimeout(computerTimer);
  computerTimer = null;
  const color: Color = Math.random() < 0.5 ? 'w' : 'b';
  playerColor.value = color;
  chess.value = new Chess();
  revision.value += 1;
  lastMove.value = null;
  thinking.value = color === 'b';
  promotionFrom.value = null;
  promotionTo.value = null;
  clearSelection();
  screen.value = 'game';
  if (color === 'b') scheduleComputerMove();
}
function returnToSetup() {
  if (computerTimer) clearTimeout(computerTimer);
  computerTimer = null;
  thinking.value = false;
  clearSelection();
  promotionFrom.value = null;
  promotionTo.value = null;
  screen.value = 'setup';
}
function selectPiece(square: Square) {
  const piece = chess.value.get(square);
  if (!piece || piece.color !== playerColor.value || !isPlayerTurn.value || thinking.value) return;
  selectedSquare.value = square;
  legalDestinations.value = chess.value.moves({ square, verbose: true }).map((move) => move.to);
}
function onSquareClick(square: Square) {
  if (screen.value !== 'game' || !isPlayerTurn.value || thinking.value || promotionFrom.value) return;
  const piece = chess.value.get(square);
  if (selectedSquare.value && legalDestinations.value.includes(square)) {
    const from = selectedSquare.value;
    const movingPiece = chess.value.get(from);
    if (movingPiece?.type === 'p' && (square.endsWith('8') || square.endsWith('1'))) {
      promotionFrom.value = from;
      promotionTo.value = square;
      return;
    }
    applyMove(from, square);
    return;
  }
  if (piece?.color === playerColor.value) {
    selectPiece(square);
    return;
  }
  clearSelection();
}
function choosePromotion(piece: PromotionPiece) {
  if (!promotionFrom.value || !promotionTo.value) return;
  const from = promotionFrom.value;
  const to = promotionTo.value;
  promotionFrom.value = null;
  promotionTo.value = null;
  applyMove(from, to, piece);
}
function applyMove(from: Square, to: Square, promotion?: PromotionPiece) {
  try {
    const move = chess.value.move({ from, to, ...(promotion ? { promotion } : {}) });
    lastMove.value = { from: move.from, to: move.to };
    clearSelection();
    revision.value += 1;
    if (!chess.value.isGameOver()) {
      thinking.value = true;
      scheduleComputerMove();
    } else {
      thinking.value = false;
    }
  } catch {
    clearSelection();
  }
}
function scheduleComputerMove() {
  if (computerTimer) clearTimeout(computerTimer);
  computerTimer = setTimeout(() => {
    computerTimer = null;
    if (screen.value !== 'game' || chess.value.isGameOver() || chess.value.turn() === playerColor.value) {
      thinking.value = false;
      return;
    }
    const move = chooseComputerMove(chess.value.fen(), selectedLevel.value);
    if (!move) {
      thinking.value = false;
      revision.value += 1;
      return;
    }
    const played = chess.value.move({ ...move, promotion: move.promotion ?? 'q' });
    lastMove.value = { from: played.from, to: played.to };
    revision.value += 1;
    thinking.value = false;
    clearSelection();
  }, 550);
}
function resultMessage(): string {
  if (chess.value.isCheckmate()) return chess.value.turn() === playerColor.value ? 'Мат. Партия окончена.' : 'Вы поставили мат.';
  if (chess.value.isStalemate()) return 'Пат. Ничья.';
  if (chess.value.isThreefoldRepetition()) return 'Троекратное повторение. Ничья.';
  if (chess.value.isInsufficientMaterial()) return 'Недостаточно фигур для мата. Ничья.';
  if (chess.value.isDraw()) return 'Ничья.';
  return '';
}
const turnTitle = computed(() => {
  revision.value;
  if (gameOver.value) return resultMessage();
  if (thinking.value) return 'Соперник обдумывает ход';
  if (chess.value.isCheck()) return isPlayerTurn.value ? 'Шах. Ваш ход' : 'Шах сопернику';
  return isPlayerTurn.value ? 'Ваш ход' : 'Ход соперника';
});
const turnDetail = computed(() => {
  if (gameOver.value) return 'Можно начать новую партию в любой момент.';
  if (thinking.value) return 'Компьютер выбирает продолжение. Немного терпения.';
  if (chess.value.isCheck()) return 'Король под атакой — найдите безопасный ответ.';
  return isPlayerTurn.value ? 'Выберите фигуру, затем клетку для хода.' : 'Партия продолжается.';
});
const playerLabel = computed(() => playerColor.value === 'w' ? 'Белые' : 'Чёрные');
const computerLabel = computed(() => playerColor.value === 'w' ? 'Чёрные' : 'Белые');
const fileLetters = computed(() => playerColor.value === 'w' ? 'abcdefgh'.split('') : 'hgfedcba'.split(''));
const rankNumbers = computed(() => playerColor.value === 'w' ? '87654321'.split('') : '12345678'.split(''));

onBeforeUnmount(() => {
  if (computerTimer) clearTimeout(computerTimer);
});
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand" aria-label="Тихий ход — шахматный стол">
        <div class="brand-mark" aria-hidden="true">♞</div>
        <div>
          <div class="brand-name">Тихий ход</div>
          <div class="brand-note">шахматный стол</div>
        </div>
      </div>
      <div class="top-note">Партия без спешки</div>
    </header>

    <main class="main-layout">
      <section v-if="screen === 'setup'" class="setup-view" aria-labelledby="setup-title">
        <div class="intro">
          <div class="eyebrow">Ваше место за доской</div>
          <h1 id="setup-title">Одна партия.<br /><em>В своём ритме.</em></h1>
          <p class="intro-copy">
            Здесь всё просто: выберите силу соперника и садитесь за доску.
            Без регистрации, часов и лишних отвлечений.
          </p>
          <div class="little-rule"></div>
          <div class="motto">Доска уже ждёт.</div>
        </div>

        <div class="setup-card">
          <div class="decorative-board" aria-hidden="true">
            <i v-for="n in 16" :key="n"></i>
          </div>
          <div class="card-kicker">Новая партия</div>
          <h2>Выберите соперника</h2>
          <span class="field-label" id="level-label">Уровень игры</span>
          <div class="level-options" role="group" aria-labelledby="level-label">
            <button
              v-for="level in levels"
              :key="level.value"
              type="button"
              class="level-button"
              :class="{ selected: selectedLevel === level.value }"
              :aria-pressed="selectedLevel === level.value"
              @click="selectedLevel = level.value"
            >
              <strong>{{ level.value }}</strong>
              <span>{{ level.label }}</span>
            </button>
          </div>
          <p class="rating-note">Уровни ориентировочные, не официальный рейтинг.</p>
          <button class="start-button" type="button" @click="startNewGame">
            Начать партию
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h11M10 5l5 5-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <p class="setup-foot">Цвет фигур определится случайно</p>
        </div>
      </section>

      <section v-else class="game-layout" aria-label="Шахматная партия">
        <div class="board-column">
          <div class="player-strip">
            <div class="player-avatar" :class="playerColor === 'w' ? 'avatar-light' : 'avatar-dark'" aria-hidden="true">{{ playerColor === 'w' ? '♔' : '♚' }}</div>
            <div>
              <div class="player-name">Вы · {{ playerLabel }}</div>
              <div class="player-sub">Ориентир {{ selectedLevel }} Elo</div>
            </div>
            <span class="turn-indicator" :class="{ active: !isPlayerTurn && !gameOver }" aria-label="Сейчас ход соперника"></span>
          </div>
          <div class="board-frame">
            <div class="chessboard" role="grid" aria-label="Шахматная доска">
              <button
                v-for="cell in boardSquares"
                :key="cell.square"
                type="button"
                role="gridcell"
                class="square"
                :class="squareClasses(cell.square, cell.row, cell.column)"
                :aria-label="squareLabel(cell.square)"
                :aria-selected="selectedSquare === cell.square"
                :disabled="thinking || gameOver || !isPlayerTurn"
                @click="onSquareClick(cell.square)"
              >
                <span v-if="legalDestinations.includes(cell.square)" class="destination" :class="{ capture: cell.piece }" aria-hidden="true"></span>
                <span
                  v-if="cell.piece"
                  class="piece"
                  :class="cell.piece.color === 'w' ? 'white-piece' : 'black-piece'"
                  aria-hidden="true"
                >{{ pieceGlyphs[cell.piece.color][cell.piece.type] }}</span>
                <span v-if="cell.column === 0" class="coord" aria-hidden="true">{{ rankNumbers[cell.row] }}</span>
                <span v-if="cell.row === 7" class="coord file" aria-hidden="true">{{ fileLetters[cell.column] }}</span>
              </button>
            </div>
          </div>
          <div class="board-caption"><span>Партия · ~{{ selectedLevel }} Elo</span><span>Без часов</span></div>
          <div class="player-strip">
            <div class="player-avatar" :class="playerColor === 'w' ? 'avatar-dark' : 'avatar-light'" aria-hidden="true">{{ playerColor === 'w' ? '♚' : '♔' }}</div>
            <div>
              <div class="player-name">Соперник · {{ computerLabel }}</div>
              <div class="player-sub">Компьютер</div>
            </div>
            <span class="turn-indicator" :class="{ active: thinking }" aria-label="Соперник обдумывает ход"></span>
          </div>
        </div>

        <aside class="game-panel" aria-live="polite">
          <div class="eyebrow">За доской</div>
          <h1>Ваша партия</h1>
          <div class="turn-card" :class="{ waiting: thinking, finished: gameOver }">
            <div class="turn-symbol" aria-hidden="true">{{ gameOver ? '·' : thinking ? '…' : isPlayerTurn ? (playerColor === 'w' ? '♔' : '♚') : (playerColor === 'w' ? '♚' : '♔') }}</div>
            <div>
              <div class="turn-title">{{ turnTitle }}</div>
              <div class="turn-detail">{{ turnDetail }}</div>
            </div>
          </div>
          <div class="panel-divider"></div>
          <div class="detail-row"><span>Соперник</span><strong>Компьютер</strong></div>
          <div class="detail-row"><span>Уровень</span><strong>~{{ selectedLevel }} Elo</strong></div>
          <div class="detail-row"><span>Ваш цвет</span><strong>{{ playerLabel }}</strong></div>
          <button class="new-game-button" type="button" @click="returnToSetup">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16.5 8A6.5 6.5 0 1 0 17 11M16 4v4h-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
            Новая партия
          </button>
          <p class="gentle-note">Хороший ход начинается с паузы.</p>
        </aside>
      </section>
    </main>

    <div v-if="promotionFrom && promotionTo" class="modal-backdrop" @click.self="promotionFrom = null; promotionTo = null">
      <section class="promotion-dialog" role="dialog" aria-modal="true" aria-labelledby="promotion-title">
        <h2 id="promotion-title">Превращение пешки</h2>
        <p>Выберите фигуру для продолжения партии.</p>
        <div class="promotion-options">
          <button
            v-for="option in promotionChoices"
            :key="option.type"
            type="button"
            class="promotion-choice"
            :aria-label="option.label"
            @click="choosePromotion(option.type)"
          >
            <span class="piece" :class="playerColor === 'w' ? 'white-piece' : 'black-piece'" aria-hidden="true">{{ pieceGlyphs[playerColor][option.type] }}</span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
