import { createI18n } from 'vue-i18n';

export type SupportedLocale = 'en' | 'ru';

const localeStorageKey = 'quiet-move-locale';

function getInitialLocale(): SupportedLocale {
  try {
    const stored = window.localStorage.getItem(localeStorageKey);
    if (stored === 'ru' || stored === 'en') return stored;
  } catch {
    // Continue with the default locale when storage is unavailable.
  }

  return 'en';
}

const messages = {
  en: {
    meta: {
      title: 'Play for fun — Chess',
      description:
        'Play chess against the computer. Choose a level and side, with the full rules of chess.',
    },
    language: { label: 'Language' },
    brand: {
      ariaLabel: 'Play for fun — chess table',
      name: 'Play for fun',
      note: 'chess table',
      topNote: 'A game at your own pace',
    },
    setup: {
      eyebrow: 'Take your place at the board',
      headlineFirst: 'One game.',
      headlineSecond: 'At your own pace.',
      intro:
        'Simply choose your opponent and take your seat at the board. No registration, clocks, or distractions.',
      motto: 'The board is waiting.',
      cardKicker: 'New game',
      chooseOpponent: 'Choose your opponent',
      levelLabel: 'Playing strength',
      ratingNote: 'Levels are approximate, not official ratings.',
      start: 'Start game',
      randomColor: 'Your color will be chosen at random',
    },
    levels: {
      '700': 'Warm-up',
      '900': 'Steady play',
      '1100': 'A challenge',
    },
    colors: { white: 'White', black: 'Black' },
    pieces: {
      king: 'king',
      queen: 'queen',
      rook: 'rook',
      bishop: 'bishop',
      knight: 'knight',
      pawn: 'pawn',
    },
    board: {
      emptySquare: '{square}, empty square',
      pieceSquare: '{square}, {color} {piece}',
      ariaLabel: 'Chessboard',
      caption: 'Game · ~{level} Elo',
      noClock: 'No clock',
    },
    game: {
      ariaLabel: 'Chess game',
      playerName: 'You · {color}',
      opponentName: 'Opponent · {color}',
      playerSub: 'Approx. {level} Elo',
      computerSub: 'Computer',
      panelEyebrow: 'At the board',
      panelTitle: 'Your game',
      statusYourTurn: 'Your move',
      statusOpponentTurn: 'Opponent to move',
      statusThinking: 'Opponent is thinking',
      statusCheckYourTurn: 'Check — your move',
      statusCheckOpponent: 'Your opponent is in check',
      detailYourTurn: 'Choose a piece, then a square to move to.',
      detailOpponentTurn: 'The game is in progress.',
      detailThinking: 'The computer is choosing a move. Just a moment.',
      detailCheck: 'Your king is under attack. Find a safe response.',
      detailFinished: 'You can start a new game at any time.',
      opponent: 'Opponent',
      computer: 'Computer',
      level: 'Level',
      yourColor: 'Your color',
      newGame: 'New game',
      gentleNote: 'A good move starts with a pause.',
      opponentTurnIndicator: 'It is the opponent’s turn',
      yourTurnIndicator: 'It is your turn',
    },
    results: {
      checkmateLoss: 'Checkmate. Game over.',
      checkmateWin: 'You delivered checkmate.',
      stalemate: 'Stalemate. Draw.',
      repetition: 'Threefold repetition. Draw.',
      insufficient: 'Insufficient material. Draw.',
      draw: 'Draw.',
    },
    promotion: {
      title: 'Promote pawn',
      description: 'Choose a piece to continue the game.',
    },
  },
  ru: {
    meta: {
      title: 'Игра в удовольствие — шахматы',
      description:
        'Играйте в шахматы против компьютера. Выберите уровень и сторону — правила соблюдаются полностью.',
    },
    language: { label: 'Язык' },
    brand: {
      ariaLabel: 'Игра в удовольствие — шахматный стол',
      name: 'Игра в удовольствие',
      note: 'шахматный стол',
      topNote: 'Партия без спешки',
    },
    setup: {
      eyebrow: 'Ваше место за доской',
      headlineFirst: 'Одна партия.',
      headlineSecond: 'В своём ритме.',
      intro:
        'Здесь всё просто: выберите силу соперника и садитесь за доску. Без регистрации, часов и лишних отвлечений.',
      motto: 'Доска уже ждёт.',
      cardKicker: 'Новая партия',
      chooseOpponent: 'Выберите соперника',
      levelLabel: 'Уровень игры',
      ratingNote: 'Уровни ориентировочные, не официальный рейтинг.',
      start: 'Начать партию',
      randomColor: 'Цвет фигур определится случайно',
    },
    levels: {
      '700': 'Для разминки',
      '900': 'Уверенная игра',
      '1100': 'Посложнее',
    },
    colors: { white: 'Белые', black: 'Чёрные' },
    pieces: {
      king: 'король',
      queen: 'ферзь',
      rook: 'ладья',
      bishop: 'слон',
      knight: 'конь',
      pawn: 'пешка',
    },
    board: {
      emptySquare: '{square}, пустая клетка',
      pieceSquare: '{square}, {color}: {piece}',
      ariaLabel: 'Шахматная доска',
      caption: 'Партия · ~{level} Elo',
      noClock: 'Без часов',
    },
    game: {
      ariaLabel: 'Шахматная партия',
      playerName: 'Вы · {color}',
      opponentName: 'Соперник · {color}',
      playerSub: 'Ориентир {level} Elo',
      computerSub: 'Компьютер',
      panelEyebrow: 'За доской',
      panelTitle: 'Ваша партия',
      statusYourTurn: 'Ваш ход',
      statusOpponentTurn: 'Ход соперника',
      statusThinking: 'Соперник обдумывает ход',
      statusCheckYourTurn: 'Шах. Ваш ход',
      statusCheckOpponent: 'Шах сопернику',
      detailYourTurn: 'Выберите фигуру, затем клетку для хода.',
      detailOpponentTurn: 'Партия продолжается.',
      detailThinking: 'Компьютер выбирает продолжение. Немного терпения.',
      detailCheck: 'Король под атакой — найдите безопасный ответ.',
      detailFinished: 'Можно начать новую партию в любой момент.',
      opponent: 'Соперник',
      computer: 'Компьютер',
      level: 'Уровень',
      yourColor: 'Ваш цвет',
      newGame: 'Новая партия',
      gentleNote: 'Хороший ход начинается с паузы.',
      opponentTurnIndicator: 'Сейчас ход соперника',
      yourTurnIndicator: 'Сейчас ваш ход',
    },
    results: {
      checkmateLoss: 'Мат. Партия окончена.',
      checkmateWin: 'Вы поставили мат.',
      stalemate: 'Пат. Ничья.',
      repetition: 'Троекратное повторение. Ничья.',
      insufficient: 'Недостаточно фигур для мата. Ничья.',
      draw: 'Ничья.',
    },
    promotion: {
      title: 'Превращение пешки',
      description: 'Выберите фигуру для продолжения партии.',
    },
  },
} as const;

export const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'en',
  messages,
});

export { localeStorageKey };
