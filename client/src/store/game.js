export class Board {
  constructor(player, { rows, cols }) {
    this.activePlayer = player;
    this.rows = rows;
    this.cols = cols;
    this.board = Array.from({ length: rows })
      .map((_, i) => "R" + i)
      .map(row => Array.from({ length: cols }).map((_, i) => row + " C" + i));

    this.filledCells = 0;
    this.superPositions = []; // TODO
  }
  occupySlot({ colIndex }) {
    let rowIndex = this.board.length - 1;
    while (rowIndex >= 0) {
      if (!this.isAlreadyOccupied(rowIndex, colIndex)) {
        this.board[rowIndex][colIndex] = this.activePlayer.marker;
        this.filledCells++;
        return;
      }
      rowIndex--;
    }
  }
  isColAvailable(colIndex) {
    let rowIndex = this.board.length - 1;
    while (rowIndex >= 0) {
      if (!this.isAlreadyOccupied(rowIndex, colIndex)) {
        return true;
      }
      rowIndex--;
    }
    return false;
  }

  occupySlotWithSuperPosition({ superPositionCount, colIndex }) {
    let rowIndex = this.board.length - 1;
    while (rowIndex >= 0) {

      if (!this.isAlreadyOccupied(rowIndex, colIndex)) {
        this.board[rowIndex][colIndex] =
          this.activePlayer.marker + superPositionCount;
        this.filledCells++;
        return rowIndex;
      }
      rowIndex--;
    }
  }
  setActivePlayer(player) {
    this.activePlayer = player;
  }
  getBoard() {
    return this.board;
  }
  isAlreadyOccupied(rowIndex, colIndex) {
    return (
      this.board[rowIndex][colIndex].includes(BROWN_MARKER) ||
      this.board[rowIndex][colIndex].includes(GREEN_MARKER)
    );
  }
  isFull() {
    return this.filledCells === this.rows * this.cols;
  }
  isPlayerMarker(rowIndex, colIndex) {
    return (
      this.board[rowIndex][colIndex] === BROWN_MARKER ||
      this.board[rowIndex][colIndex] === GREEN_MARKER
    );
  }
  applyQuantumGate(gate) {
    for (let i = 0; i < gate.length; i++) {
      if (gate.charAt(i) === "0") {
        const posRemove = this.superPositions[i][1];
        this.updateColour(posRemove.R, posRemove.C);


        const posKeep = this.superPositions[i][0];
        this.updateColour(posKeep.R, posKeep.C);
      } else {
        const posRemove = this.superPositions[i][0];
        this.updateColour(posRemove.R, posRemove.C);

        const posKeep = this.superPositions[i][1];
        this.updateColour(posKeep.R, posKeep.C);
      }
    }


    const cleanBoard = () => {
      for (let colIndex = 0; colIndex < this.cols; colIndex++) {
        let rowIndex = this.board.length - 1;
        while (rowIndex >= 0) {
          if (
            rowIndex - 1 >= 0 &&
            !this.isPlayerMarker(rowIndex, colIndex) &&
            this.isPlayerMarker(rowIndex - 1, colIndex)
          ) {

            this.board[rowIndex][colIndex] = this.board[rowIndex - 1][colIndex];
            this.board[rowIndex - 1][colIndex] =
              "R" + rowIndex + " C" + colIndex;
          }

          rowIndex--;
        }
      }
    };

    for (let index = 0; index < this.rows * this.cols; index++) {
      cleanBoard();
    }

    this.filledCells =
      this.board.rows * this.board.cols - 2 * this.superPositions.length;
    this.superPositions = [];

  }

  updateColour(r, c) {
    if (this.board[r][c].includes(BROWN_MARKER)) {
      this.board[r][c] = BROWN_MARKER;
    } else if (this.board[r][c].includes(GREEN_MARKER)) {
      this.board[r][c] = GREEN_MARKER;
    } else {
      this.board[r][c] = "R" + r + " C" + c;
    }
  }

  addSuperPosition(arr) {
    this.superPositions.push(arr);
  }

  hasPlayerWon() {
    let element;
    const checkRows = () => {
      for (let row = 0; row < this.board.length; row++) {
        for (let col = 0; col < this.board[row].length - 3; col++) {
          element = this.board[row][col];
          if (
            element == this.board[row][col + 1] &&
            element == this.board[row][col + 2] &&
            element == this.board[row][col + 3]
          ) {
            return true;
          }
        }
      }
      return false;
    };

    const checkColumns = () => {
      for (let row = 0; row < this.board.length - 3; row++) {
        for (let col = 0; col < this.board[row].length; col++) {
          element = this.board[row][col];
          if (
            element == this.board[row + 1][col] &&
            element == this.board[row + 2][col] &&
            element == this.board[row + 3][col]
          ) {
            return true;
          }
        }
      }
      return false;
    };
    const checkMainDiagonal = () => {
      for (let row = 0; row < this.board.length - 3; row++) {
        for (let col = 0; col < this.board[row].length - 3; col++) {
          element = this.board[row][col];
          if (
            element == this.board[row + 1][col + 1] &&
            element == this.board[row + 2][col + 2] &&
            element == this.board[row + 3][col + 3]
          ) {
            return true;
          }
        }
      }
      return false;
    };

    const checkCounterDiagonal = () => {
      for (let row = 0; row < this.board.length - 3; row++) {
        for (let col = 3; col < this.board[row].length; col++) {
          element = this.board[row][col];
          if (
            element == this.board[row + 1][col - 1] &&
            element == this.board[row + 2][col - 2] &&
            element == this.board[row + 3][col - 3]
          ) {
            return true;
          }
        }
      }
      return false;
    };
    if (
      checkRows() ||
      checkColumns() ||
      checkMainDiagonal() ||
      checkCounterDiagonal()
    ) {
      return element;
    }
    return false;
  }
}
export class Player {
  constructor(name, marker) {
    this.name = name;
    this.marker = marker;
  }
}

export const BROWN_MARKER = "BROWN";
export const GREEN_MARKER = "GREEN";
