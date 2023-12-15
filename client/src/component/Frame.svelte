
<script>
  import { Board, Player, BROWN_MARKER, GREEN_MARKER } from "../store/game.js";
  import { fly, fade } from "svelte/transition";
  import { elasticOut } from "svelte/easing";
  import { playing } from "../store/index.js";

  const PLAYER1 = new Player("Red", BROWN_MARKER);
  const PLAYER2 = new Player("Green", GREEN_MARKER);
  let gameBoard = new Board(PLAYER1, { rows: 6, cols: 7 });
  let activeBoard = gameBoard.getBoard();
  let winnerName;
  let superPositionActivated = false;
  let superPositionColumns = [];
  let superPositionCount = 0;
  let activePlayerName = gameBoard.activePlayer.name;

  const BACKEND_URL = "<@BACKEND_URL@>";

  const switchActivePlayer = () => {
    if (gameBoard.activePlayer.name === PLAYER1.name) {
      gameBoard.setActivePlayer(PLAYER2);
      activePlayerName = PLAYER2.name;
    } else {
      gameBoard.setActivePlayer(PLAYER1);
      activePlayerName = PLAYER1.name;
    }
  };
  const handleSuperPosition = async ({ rowIndex, colIndex }) => {
    superPositionActivated = true;
    if (superPositionActivated) {
      if (!gameBoard.isColAvailable(colIndex)) {
        alert("column already full");
      }
      const plantedRow = gameBoard.occupySlotWithSuperPosition({
        superPositionCount,
        rowIndex,
        colIndex
      });
      superPositionColumns.push({ R: plantedRow, C: colIndex });

      if (superPositionColumns.length === 2) {
        gameBoard.addSuperPosition(superPositionColumns);
        superPositionActivated = false;
        superPositionColumns = [];
        superPositionCount++;
        switchActivePlayer();
      }
    }

  };

  const handlePlayerMove = async ({ rowIndex, colIndex }) => {
    if (!gameBoard.isColAvailable(colIndex)) {
      alert("column already full");
      return;
    }

    if (await canProceed()) {
      if (superPositionActivated) {
        handleSuperPosition({ rowIndex, colIndex });
      } else {
        gameBoard.occupySlot({ rowIndex, colIndex });
        switchActivePlayer();
      }
      activeBoard = [...gameBoard.getBoard()];
    }
    await canProceed();
  };
  const canProceed = async () => {
    let winner = gameBoard.hasPlayerWon();
    if (gameBoard.isFull()) {
      if (!winner) {
        quantumGate = await computeCollapse();
        gameBoard.applyQuantumGate(quantumGate);

        winner = gameBoard.hasPlayerWon();
        if (!winner) {
          return false;
        }
      }
    }

    winner = gameBoard.hasPlayerWon();
    if (winner) {
      if (PLAYER1.marker === winner) {
        winnerName = PLAYER1.name;
      } else {
        winnerName = PLAYER2.name;
      }
      return false;
    }
    return true;
  };

  const computeCollapse = async () => {
    const payload = { super_positions: gameBoard.superPositions.length };
    const res = await fetch(`${BACKEND_URL}/collapse`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
      .then(async response => {
        if (response.ok) {
          const data = await response.json();
          return data.res;
        } else return "";
      })
      .catch(error => {
        return Promise.reject(error);
      });
    return res;
  };

  const collapseForPlayer = async () => {
    let quantumGate = await computeCollapse();
    gameBoard.applyQuantumGate(quantumGate);

    activeBoard = [...gameBoard.getBoard()];

    if (await canProceed()) switchActivePlayer();
  };

</script>
<style>
  .GREEN {
    background: green;
  }
  .BROWN {
    background: brown;
  }
  .superGREEN {
    background: blue;
  }
  .superBROWN {
    background:blue;
  }
  .circle {
    border-radius: 20%;
    -moz-border-radius: 20%;
    -webkit-border-radius: 20%;
    width: 5rem;
    height: 5rem;
    border: 2px solid black;
  }
  .empty {
    background: lightgray;
  }
  h2 {
    text-align: center;
  }
  .big-btn {
    margin-left: 0rem;
    width: 40rem;
    font-size: 2rem;
  }
</style>
<div>
  {#if winnerName}
    <div class="flex flex-center">
      <h2
        style="margin-left:7rem;color:pink;"
        
        out:fade>
        {winnerName} Won!
      </h2>
    </div>
  {:else}
    <div class="flex flex-center">
      <h2 
      style="margin-left: 0rem;color:{activePlayerName === 'PLAYER2' ? 'red' : 'black'}">
        {activePlayerName}'s turn 
      </h2>
    </div>
    {#if superPositionActivated}
      <div class="flex flex-center" style="margin-left:7rem;color:blue">
        <h4>Superposition is Active</h4>
      </div>
    {:else}
      <div class="flex flex-center" >
        <button 
        on:click={() => (superPositionActivated = true)}
        class="big-btn"  style="background-color: white; color: black;" >
        Activate Quantum Move 
      </button>
      </div>
    {/if}
  {/if}
<center>
  <div class="column padding-all-1 flex flex-center" >
    <div>
      <table width="50vW" height="50vH">
        <tbody>
          {#each activeBoard as rows, rowIndex}
            <tr>
              {#each rows as column, colIndex}
                <td
                  id={'R' + rowIndex + 'C' + colIndex}
                  on:click={() => handlePlayerMove({ colIndex, rowIndex })}>
                  {#if column === GREEN_MARKER}
                    <div
                      class="circle GREEN"
                       />
                  {:else if column === BROWN_MARKER}
                    <div
                      class="circle BROWN"
                       />
                  {:else if column.includes(GREEN_MARKER)}
                    <div
                      class="circle superGREEN"
                     />
                  {:else if column.includes(BROWN_MARKER)}
                    <div
                      class="circle superBROWN"
                      />
                  {:else}
                    <div class="circle empty" />
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</center>
  <button
    on:click={collapseForPlayer}
    hidden={superPositionCount <= 0 || winnerName}
    class="big-btn" style="background-color: white; color: black;"  >
    Collapse 
  </button>
</div>
