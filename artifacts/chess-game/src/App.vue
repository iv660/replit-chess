<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { Chess, type PieceSymbol, type Square } from 'chess.js';
import { useI18n } from 'vue-i18n';
import { chooseComputerMove, type EloLevel } from './chess-ai';
import { localeStorageKey } from './i18n';

type Color = 'w' | 'b';
type Screen = 'setup' | 'game';
type PromotionPiece = 'q' | 'r' | 'b' | 'n';

const levels: EloLevel[] = [700, 900, 1100];
const pieceGlyphs: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};
const promotionChoices: PromotionPiece[] = ['q', 'r', 'b', 'n'];
const { t, locale } = useI18n({ useScope: 'global' });
const screen = ref<Screen>('setup');
const selectedLevel = ref<EloLevel>(900);
const playerColor = ref<Color>('w');
// chess.js temporarily mutates and restores its board while generating legal moves.
// Keep the engine out of Vue's deep reactivity; revision explicitly refreshes the UI.
const chess = shallowRef(new Chess());
const revision = ref(0);
const selectedSquare = ref<Square | null>(null);
const legalDestinations = ref<Square[]>([]);
const lastMove = ref<{ from: Square; to: Square } | null>(null);
const thinking = ref(false);
const promotionFrom = ref<Square | null>(null);
const promotionTo = ref<Square | null>(null);
let computerTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  locale,
  (nextLocale) => {
    const activeLocale = nextLocale === 'ru' ? 'ru' : 'en';
    document.documentElement.lang = activeLocale;
    document.title = t('meta.title');

    const localizedMeta = [
      ['meta[name="description"]', 'meta.description'],
      ['meta[property="og:title"]', 'meta.title'],
      ['meta[property="og:description"]', 'meta.description'],
      ['meta[name="twitter:title"]', 'meta.title'],
      ['meta[name="twitter:description"]', 'meta.description'],
    ] as const;
    for (const [selector, key] of localizedMeta) {
      document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', t(key));
    }

    try {
      window.localStorage.setItem(localeStorageKey, activeLocale);
    } catch {
      // The selected locale still works for this session when storage is unavailable.
    }
  },
  { immediate: true },
);

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
const isPlayerTurn = computed(() => {
  // Track every committed position: gameOver can remain false across a turn change.
  revision.value;
  return chess.value.turn() === playerColor.value && !gameOver.value;
});

function pieceName(piece: PieceSymbol): string {
  switch (piece) {
    case 'k': return t('pieces.king');
    case 'q': return t('pieces.queen');
    case 'r': return t('pieces.rook');
    case 'b': return t('pieces.bishop');
    case 'n': return t('pieces.knight');
    case 'p': return t('pieces.pawn');
  }
}
function levelName(level: EloLevel): string {
  switch (level) {
    case 700: return t('levels.700');
    case 900: return t('levels.900');
    case 1100: return t('levels.1100');
  }
}
function squareLabel(square: Square): string {
  const piece = chess.value.get(square);
  if (!piece) return t('board.emptySquare', { square });
  return t('board.pieceSquare', {
    square,
    color: t(piece.color === 'w' ? 'colors.white' : 'colors.black').toLocaleLowerCase(),
    piece: pieceName(piece.type),
  });
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
  if (chess.value.isCheckmate()) return t(chess.value.turn() === playerColor.value ? 'results.checkmateLoss' : 'results.checkmateWin');
  if (chess.value.isStalemate()) return t('results.stalemate');
  if (chess.value.isThreefoldRepetition()) return t('results.repetition');
  if (chess.value.isInsufficientMaterial()) return t('results.insufficient');
  if (chess.value.isDraw()) return t('results.draw');
  return '';
}
const turnTitle = computed(() => {
  revision.value;
  if (gameOver.value) return resultMessage();
  if (thinking.value) return t('game.statusThinking');
  if (chess.value.isCheck()) return t(isPlayerTurn.value ? 'game.statusCheckYourTurn' : 'game.statusCheckOpponent');
  return t(isPlayerTurn.value ? 'game.statusYourTurn' : 'game.statusOpponentTurn');
});
const turnDetail = computed(() => {
  if (gameOver.value) return t('game.detailFinished');
  if (thinking.value) return t('game.detailThinking');
  if (chess.value.isCheck()) return t('game.detailCheck');
  return t(isPlayerTurn.value ? 'game.detailYourTurn' : 'game.detailOpponentTurn');
});
const playerLabel = computed(() => t(playerColor.value === 'w' ? 'colors.white' : 'colors.black'));
const computerLabel = computed(() => t(playerColor.value === 'w' ? 'colors.black' : 'colors.white'));
const fileLetters = computed(() => playerColor.value === 'w' ? 'abcdefgh'.split('') : 'hgfedcba'.split(''));
const rankNumbers = computed(() => playerColor.value === 'w' ? '87654321'.split('') : '12345678'.split(''));

onBeforeUnmount(() => {
  if (computerTimer) clearTimeout(computerTimer);
});
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand" :aria-label="t('brand.ariaLabel')">
        <div class="brand-mark" aria-hidden="true">♞</div>
        <div>
          <div class="brand-name">{{ t('brand.name') }}</div>
          <div class="brand-note">{{ t('brand.note') }}</div>
        </div>
      </div>
      <div class="topbar-right">
        <div class="top-note">{{ t('brand.topNote') }}</div>
        <select v-model="locale" class="language-select" :aria-label="t('language.label')">
          <option value="en">English</option>
          <option value="ru">Русский</option>
        </select>
      </div>
    </header>

    <main class="main-layout">
      <section v-if="screen === 'setup'" class="setup-view" aria-labelledby="setup-title">
        <div class="intro">
          <div class="eyebrow">{{ t('setup.eyebrow') }}</div>
          <h1 id="setup-title">{{ t('setup.headlineFirst') }}<br /><em>{{ t('setup.headlineSecond') }}</em></h1>
          <p class="intro-copy">{{ t('setup.intro') }}</p>
          <div class="little-rule"></div>
          <div class="motto">{{ t('setup.motto') }}</div>
        </div>

        <div class="setup-card">
          <div class="decorative-board" aria-hidden="true">
            <i v-for="n in 16" :key="n"></i>
          </div>
          <div class="card-kicker">{{ t('setup.cardKicker') }}</div>
          <h2>{{ t('setup.chooseOpponent') }}</h2>
          <span class="field-label" id="level-label">{{ t('setup.levelLabel') }}</span>
          <div class="level-options" role="group" aria-labelledby="level-label">
            <button
              v-for="level in levels"
              :key="level"
              type="button"
              class="level-button"
              :class="{ selected: selectedLevel === level }"
              :aria-pressed="selectedLevel === level"
              @click="selectedLevel = level"
            >
              <strong>{{ level }}</strong>
              <span>{{ levelName(level) }}</span>
            </button>
          </div>
          <p class="rating-note">{{ t('setup.ratingNote') }}</p>
          <button class="start-button" type="button" @click="startNewGame">
            {{ t('setup.start') }}
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h11M10 5l5 5-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
          </button>
          <p class="setup-foot">{{ t('setup.randomColor') }}</p>
        </div>
      </section>

      <section v-else class="game-layout" :aria-label="t('game.ariaLabel')">
        <div class="board-column">
          <div class="player-strip">
            <div class="player-avatar" :class="playerColor === 'w' ? 'avatar-dark' : 'avatar-light'" aria-hidden="true">{{ playerColor === 'w' ? '♚' : '♔' }}</div>
            <div>
              <div class="player-name">{{ t('game.opponentName', { color: computerLabel }) }}</div>
              <div class="player-sub">{{ t('game.computerSub') }}</div>
            </div>
            <span class="turn-indicator" :class="{ active: !isPlayerTurn && !gameOver }" :aria-label="t('game.opponentTurnIndicator')"></span>
          </div>
          <div class="board-frame">
            <div class="chessboard" role="grid" :aria-label="t('board.ariaLabel')">
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
          <div class="board-caption">
            <span>{{ t('board.caption', { level: selectedLevel }) }}</span>
            <span>{{ t('board.noClock') }}</span>
          </div>
          <div class="player-strip">
            <div class="player-avatar" :class="playerColor === 'w' ? 'avatar-light' : 'avatar-dark'" aria-hidden="true">{{ playerColor === 'w' ? '♔' : '♚' }}</div>
            <div>
              <div class="player-name">{{ t('game.playerName', { color: playerLabel }) }}</div>
              <div class="player-sub">{{ t('game.playerSub', { level: selectedLevel }) }}</div>
            </div>
            <span class="turn-indicator" :class="{ active: isPlayerTurn }" :aria-label="t('game.yourTurnIndicator')"></span>
          </div>
        </div>

        <aside class="game-panel" aria-live="polite">
          <div class="eyebrow">{{ t('game.panelEyebrow') }}</div>
          <h1>{{ t('game.panelTitle') }}</h1>
          <div class="turn-card" :class="{ waiting: thinking, finished: gameOver }">
            <div class="turn-symbol" aria-hidden="true">{{ gameOver ? '·' : thinking ? '…' : isPlayerTurn ? (playerColor === 'w' ? '♔' : '♚') : (playerColor === 'w' ? '♚' : '♔') }}</div>
            <div>
              <div class="turn-title">{{ turnTitle }}</div>
              <div class="turn-detail">{{ turnDetail }}</div>
            </div>
          </div>
          <div class="panel-divider"></div>
          <div class="detail-row"><span>{{ t('game.opponent') }}</span><strong>{{ t('game.computer') }}</strong></div>
          <div class="detail-row"><span>{{ t('game.level') }}</span><strong>~{{ selectedLevel }} Elo</strong></div>
          <div class="detail-row"><span>{{ t('game.yourColor') }}</span><strong>{{ playerLabel }}</strong></div>
          <button class="new-game-button" type="button" @click="returnToSetup">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16.5 8A6.5 6.5 0 1 0 17 11M16 4v4h-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
            {{ t('game.newGame') }}
          </button>
          <p class="gentle-note">{{ t('game.gentleNote') }}</p>
        </aside>
      </section>
    </main>

    <div v-if="promotionFrom && promotionTo" class="modal-backdrop" @click.self="promotionFrom = null; promotionTo = null">
      <section class="promotion-dialog" role="dialog" aria-modal="true" aria-labelledby="promotion-title">
        <h2 id="promotion-title">{{ t('promotion.title') }}</h2>
        <p>{{ t('promotion.description') }}</p>
        <div class="promotion-options">
          <button
            v-for="option in promotionChoices"
            :key="option"
            type="button"
            class="promotion-choice"
            :aria-label="pieceName(option)"
            @click="choosePromotion(option)"
          >
            <span class="piece" :class="playerColor === 'w' ? 'white-piece' : 'black-piece'" aria-hidden="true">{{ pieceGlyphs[playerColor][option] }}</span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
