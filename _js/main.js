/*
 * vim: ts=3 sw=3 et wrap co=150 go-=b
 */

// Global variables. /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const GRID_HEIGHT         =  32; // Vertical   dimension on screen (default 32).
const GRID_WIDTH          =  32; // Horizontal dimension on screen (default 32).
const INITIAL_WALL_BUDGET = 100;
const MAX_TERRAIN_HEIGHT  =  20;
const N_HOUSES_PER_MAP    =  35; // Default 35.
const N_MOUNTAINS_PER_MAP =   6; // Default 6.
const N_ROUNDS_PER_GAME   =   5;
const SPRITE_HEIGHT       =  32; // Must match height of cell images (default 32).
const SPRITE_WIDTH        =  32; // Must match width  of cell images (default 32).

let ctx = document.getElementById('canvas').getContext('2d');

ctx.canvas.width  = GRID_WIDTH  * SPRITE_WIDTH ;
ctx.canvas.height = GRID_HEIGHT * SPRITE_HEIGHT;

let globalCoordsVisitedAsKeys = {}; // Used in recusive function to prevent visiting already visited squares.
let globalImages              = [];
let gameGrid                  = [];
let terrainGrid               = [];
let gameState                 =
{
   gameMode           : 'game', // Possible values: {'game', 'simulation', 'information', 'high-scores'}
   gridNumbersAreShown: false,
   floodIsReceding    : false,
   hasHouse           : true,
   isBuildingWalls    : false,
   nHomesLost         : 0,
   playerScore        : 0,
   roundNo            : 1,
   totalHousesLost    : 0,
   totalHousesSaved   : 0,
   wallBudget         : INITIAL_WALL_BUDGET
};

// Startup code. /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let imageFilenames =
[
   '_images/00_ground.png', // Water (deep   )
   '_images/01_ground.png', // Water (shallow)
   '_images/02_ground.png', // Sand (light )
   '_images/03_ground.png', // Sand (medium)
   '_images/04_ground.png', // Sand (dark  )
   '_images/05_ground.png', // Green (lightest)
   '_images/06_ground.png', // Green (light   )
   '_images/07_ground.png', // Green (dark    )
   '_images/08_ground.png', // Green (darkest )
   '_images/09_ground.png', // \
   '_images/10_ground.png', // |
   '_images/11_ground.png', // |
   '_images/12_ground.png', // |
   '_images/13_ground.png', // |
   '_images/14_ground.png', // +- TODO: Define these colors and ensure the user can tell for any two shades which one is higher.
   '_images/15_ground.png', // |
   '_images/16_ground.png', // |
   '_images/17_ground.png', // |
   '_images/18_ground.png', // |
   '_images/19_ground.png', // /
   '_images/flood_barrier.png',
   '_images/house_transparent.png',
   '_images/house_destroyed_in_water.png'
];

Promise.all
(
   [
      loadImage(imageFilenames[ 0]),
      loadImage(imageFilenames[ 1]),
      loadImage(imageFilenames[ 2]),
      loadImage(imageFilenames[ 3]),
      loadImage(imageFilenames[ 4]),
      loadImage(imageFilenames[ 5]),
      loadImage(imageFilenames[ 6]),
      loadImage(imageFilenames[ 7]),
      loadImage(imageFilenames[ 8]),
      loadImage(imageFilenames[ 9]),
      loadImage(imageFilenames[10]),
      loadImage(imageFilenames[11]),
      loadImage(imageFilenames[12]),
      loadImage(imageFilenames[13]),
      loadImage(imageFilenames[14]),
      loadImage(imageFilenames[15]),
      loadImage(imageFilenames[16]),
      loadImage(imageFilenames[17]),
      loadImage(imageFilenames[18]),
      loadImage(imageFilenames[19]),
      loadImage(imageFilenames[20]),
      loadImage(imageFilenames[21]),
      loadImage(imageFilenames[22])
   ]
)
.then
(
   (images) => {main(images);}
)
.catch((e) => console.error(e));

/*
 * Main function.
 */
function main(images)
{
   globalImages = images;

   // Add images to color-key.
   for (let i = 0; i < 20; ++i)
   {
      $('div.color-key-div').append("<span><span class='height-number-span'>" + i + "</span><img src='" + imageFilenames[i] + "'/></span>");
   }


   $('canvas').click(onClickCanvas);
   $('canvas').mousedown(onMouseDownCanvas).mouseup(onMouseUpCanvas).mousemove(onMouseMoveCanvas);
   $('span.wall-budget'           ).html(gameState.wallBudget);
   $('span.n-rounds-per-game-span').html(N_ROUNDS_PER_GAME);

   onClickGameModeButton();
}

// Initialisation functions. /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function initialiseGameGrid()
{
   terrainGrid = generateTerrainGrid();
//   let terrainGrid =
//   [
//      // Test data set.  To use, must set GRID_HEIGHT and GRID_WIDTH to match dimensions here.
//      [11, 12, 14, 13, 12, 11, 10,  9],
//      [13, 18, 18, 18, 18, 18, 15, 11],
//      [16, 14, 17, 19, 17, 17, 13, 10],
//      [14, 15, 19, 18, 19, 18, 14, 10],
//      [13, 18, 19, 19, 19, 17, 12, 11],
//      [12, 15, 17, 18, 17, 14, 11, 10],
//      [11, 16, 16, 13, 15, 14, 16, 10],
//      [10, 12, 12, 14, 12, 13, 14, 12],
//   ];

   for (let x = 0; x < GRID_WIDTH; ++x)
   {
      gameGrid[x] = [];

      for (let y = 0; y < GRID_HEIGHT; ++y)
      {
         let gridSquareHeight = terrainGrid[x][y];

         gameGrid[x][y] =
         {
            height      : gridSquareHeight,
            heightOrig  : gridSquareHeight, // Used when the flood recedes.
            isWall      : false,
            isUnderwater: (gridSquareHeight <= 1)
         }
      }
   }

   // Add houses.
   let nHousesAdded = 0;
   while (nHousesAdded < N_HOUSES_PER_MAP)
   {
      let houseX          = getRandomInt(0, GRID_WIDTH );
      let houseY          = getRandomInt(0, GRID_HEIGHT);
      let houseGridSquare = gameGrid[houseX][houseY];

      if (3 < houseGridSquare.height && houseGridSquare.height < 15)
      {
         houseGridSquare.hasHouse = true;
         ++nHousesAdded;
      }
   }
}

function drawGameGrid(boolDrawHeightNumbersOnSquares)
{
   for (let x = 0; x < GRID_WIDTH; ++x)
   {
      for (let y = 0; y < GRID_HEIGHT; ++y)
      {
         let gridSquareObj = gameGrid[x][y];

         if (gridSquareObj.height < 0 || gridSquareObj.height > 19)
         {
            throw 'Grid square [' + x + '][' + y + '] height (' + gridSquareObj.height + ') out of expected range.';
         }

         let imageForGridSquare =
         (
            (gridSquareObj.isWall)? globalImages[20]:
            (
               (gridSquareObj.hasHouse)? globalImages[21]:
               globalImages[gridSquareObj.height]
            )
         );

         drawSpriteOnGridSquare(x, y, imageForGridSquare);

         if (boolDrawHeightNumbersOnSquares)
         {
            drawTextOnGridSquare(x, y, gridSquareObj.height);
         }
      }
   }
}

function generateTerrainGrid()
{
   for (let x = 0; x < GRID_WIDTH; ++x)
   {
      terrainGrid[x] = [];

      for (let y = 0; y < GRID_HEIGHT; ++y)
      {
         terrainGrid[x][y] = null;
      }
   }

   // Choose N_MOUNTAINS_PER_MAP random squares to be mountain tops.
   // If the mountain tops happen to be on the same squares, that is no problem.
   for (let i = 0; i < N_MOUNTAINS_PER_MAP; ++i)
   {
      let mountainTopX   = getRandomInt(0, GRID_WIDTH );
      let mountainTopY   = getRandomInt(0, GRID_HEIGHT);
      let mountainHeight = getRandomInt(MAX_TERRAIN_HEIGHT - 5, MAX_TERRAIN_HEIGHT);

      terrainGrid[mountainTopX][mountainTopY] = mountainHeight;
   }

   for (let i = 0; i < MAX_TERRAIN_HEIGHT; ++i)
   {
      let tempTerrainGrid = copyArray(terrainGrid);

      // Fill in terrain surrounding mountain tops.  First left->right, top->bottom.
      for (let x = 0; x < GRID_WIDTH; ++x)
      {
         for (let y = 0; y < GRID_HEIGHT; ++y)
         {
            if (terrainGrid[x][y] === null && terrainSquareHasNonNullNeighbour(x, y))
            {
               // Fill in empty terrain square depending on height of surrounding squares.
               let heightOfHighestNeighbour = getHeightOfHighestNeighbour(x, y);
               let randomDecrement          = getRandomInt(1, 4);
               let newHeight                = ((heightOfHighestNeighbour > randomDecrement)? heightOfHighestNeighbour - randomDecrement: 0);

               tempTerrainGrid[x][y] = newHeight;
            }
            else
            {
               tempTerrainGrid[x][y] = terrainGrid[x][y];
            }
         }
      }

      terrainGrid = copyArray(tempTerrainGrid);
   }

   // Final pass to convert any null squares to zero.
   for (let x = 0; x < GRID_WIDTH; ++x)
   {
      for (let y = 0; y < GRID_HEIGHT; ++y)
      {
         if (terrainGrid[x][y] === null)
         {
            terrainGrid[x][y] = 0;
         }
      }
   }

   return terrainGrid;
}

// Event handlers. ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function onClickGameModeButton()
{
   $('#canvas'                                 ).show();
   $('div.buttons-div.game'                    ).show();
   $('div.buttons-div.simulation'              ).hide();
   $('div.color-key-div'                       ).show();
   $('div.game-end-popup'                      ).hide();
   $('div.game-mode-div > label'               ).removeClass('selected');
   $('div.game-mode-start-sequence-popup'      ).hide();
   $('div.game-mode-start-sequence-popup.first').show();
   $('div.high-scores-div'                     ).hide();
   $('div.information-div'                     ).hide();
   $('input#game-mode-button'                  ).prop('checked', true).closest('label').addClass('selected');
   $('p.simulation-instructions'               ).hide();

   gameState.floodIsReceding  = false;
   gameState.gameMode         = 'game';
   gameState.nHomesLost       = 0;
   gameState.nRainDropsFallen = 0;
   gameState.playerScore      = 0;
   gameState.roundNo          = 1;
   gameState.wallBudget       = INITIAL_WALL_BUDGET;
   $('span.wall-budget'  ).html(gameState.wallBudget);
   $('span.round-no-span').html(gameState.roundNo   );

   initialiseGameGrid();
   drawGameGrid(false); // Initially draw the grid without the numbers.
}

function onClickSimulationModeButton()
{
   $('#canvas'                           ).show();
   $('div.buttons-div.game'              ).hide();
   $('div.buttons-div.simulation'        ).show();
   $('div.color-key-div'                 ).show();
   $('div.game-end-popup'                ).hide();
   $('div.game-mode-div > label'         ).removeClass('selected');
   $('div.game-mode-start-sequence-popup').hide();
   $('div.high-scores-div'               ).hide();
   $('div.information-div'               ).hide();
   $('div.round-start-popup'             ).hide();
   $('div.round-summary-popup'           ).hide();
   $('input#simulation-mode-button'      ).closest('label').addClass('selected');
   $('p.simulation-instructions'         ).show();

   gameState.gameMode   = 'simulation';
   gameState.wallBudget = INITIAL_WALL_BUDGET * 10;
   $('span.wall-budget').html(gameState.wallBudget);
}

function onClickInformationModeButton()
{
   $('#canvas'                           ).hide();
   $('div.buttons-div.game'              ).hide();
   $('div.buttons-div.simulation'        ).hide();
   $('div.color-key-div'                 ).hide();
   $('div.game-end-popup'                ).hide();
   $('div.game-mode-div > label'         ).removeClass('selected');
   $('div.game-mode-start-sequence-popup').hide();
   $('div.high-scores-div'               ).hide();
   $('div.information-div'               ).show();
   $('div.round-start-popup'             ).hide();
   $('div.round-summary-popup'           ).hide();
   $('input#information-mode-button'     ).closest('label').addClass('selected');
   $('p.simulation-instructions'         ).hide();

   gameState.gameMode = 'game';
}

function onClickHighScoresModeButton()
{
   $('#canvas'                           ).hide();
   $('div.buttons-div.game'              ).hide();
   $('div.buttons-div.simulation'        ).hide();
   $('div.color-key-div'                 ).hide();
   $('div.game-end-popup'                ).hide();
   $('div.game-mode-div > label'         ).removeClass('selected');
   $('div.game-mode-start-sequence-popup').hide();
   $('div.high-scores-div'               ).show();
   $('div.information-div'               ).hide();
   $('div.round-start-popup'             ).hide();
   $('div.round-summary-popup'           ).hide();
   $('input#high-scores-mode-button'     ).closest('label').addClass('selected');
   $('p.simulation-instructions'         ).hide();

   gameState.gameMode = 'high-scores';
}

function onClickContinueToNextRound()
{
   if (gameState.roundNo <= N_ROUNDS_PER_GAME)
   {
      let divJq = $('div.round-start-popup');
      divJq.find('span.round-no-span').html(gameState.roundNo);
      divJq.show();
   }
   else
   {
      let divJq = $('div.game-end-popup');
      divJq.find('span.total-score-span').html(gameState.playerScore);
      divJq.show();
   }
}

function onClickStartRound()
{
   gameState.floodIsReceding   = false;
   gameState.gameMode          = 'game';
   gameState.nHomesLost        = 0;
   gameState.nRainDropsFallen  = 0;
   gameState.wallBudget        = INITIAL_WALL_BUDGET;
   $('span.wall-budget').html(gameState.wallBudget);

   if (gameState.roundNo != 1)
   {
      initialiseGameGrid();
      drawGameGrid(false); // Initially draw the grid without the numbers.
   }

   window.setTimeout(rainOnRandomSquarePeriodicallyUntilLimitThenRecede, 1000);
}

function onClickGenerateNewTerrain()
{
   initialiseGameGrid();

   drawGameGrid(gameState.gridNumbersAreShown); // Initially draw the grid without the numbers.

   gameState.wallBudget = INITIAL_WALL_BUDGET;
   $('span.wall-budget').html(gameState.wallBudget);
}

function onClickToggleHeightNumbers()
{
   let gridNumbersAreShown = gameState.gridNumbersAreShown;

   drawGameGrid(!gameState.gridNumbersAreShown);

   gameState.gridNumbersAreShown = !gameState.gridNumbersAreShown;
}

function onClickRainOnRandomSquare()
{
   let rainX         = null;
   let rainY         = null;
   let squareIsValid = false;

   while (!squareIsValid)
   {
      rainX = getRandomInt(0, GRID_WIDTH );
      rainY = getRandomInt(0, GRID_HEIGHT);

      if (!gameGrid[rainX][rainY].isWall)
      {
         squareIsValid = true;
      }
   }

   drawTextOnGridSquare(rainX, rainY, 'R');
   rainUntilWaterLevelRisesByOne(rainX, rainY);
}

function onClickRecedeFlood()
{
   decreaseWaterLevelEverywhereByOne();
}

function onMouseUpCanvas(e)
{
   gameState.isBuildingWalls = false
   $('span.walls-budget-container').css('border-color', 'black');
}

function onMouseDownCanvas(e)
{
   gameState.isBuildingWalls = true;
   $('span.walls-budget-container').css('border-color', 'red');
}

function onMouseMoveCanvas(e)
{
   if (gameState.isBuildingWalls && gameState.wallBudget > 0)
   {
      let canvasJq     = $('canvas');
      let canvasOffset = canvasJq.offset();
      let mouseX       = e.pageX - canvasOffset.left;
      let mouseY       = e.pageY - canvasOffset.top;
      let mouseGridX   = Math.floor(mouseX / GRID_WIDTH );
      let mouseGridY   = Math.floor(mouseY / GRID_HEIGHT);

      if (mouseGridX > GRID_WIDTH || mouseGridY > GRID_HEIGHT)
      {
         throw new Exception('Mouse grid coordinates out of expected range.');
      }

      if (gameGrid[mouseGridX][mouseGridY].height < MAX_TERRAIN_HEIGHT - 1)
      {
         drawSpriteOnGridSquare(mouseGridX, mouseGridY, globalImages[20]);
         gameGrid[mouseGridX][mouseGridY].isWall = true;
         gameGrid[mouseGridX][mouseGridY].height = 19;

         --gameState.wallBudget;

         $('span.wall-budget').html(gameState.wallBudget);

         if (gameState.gridNumbersAreShown)
         {
            drawTextOnGridSquare(mouseGridX, mouseGridY, gameGrid[mouseGridX][mouseGridY].height);
         }
      }
   }
}

function onClickCanvas(e)
{
   if (gameState.gameMode != 'simulation')
   {
      return;
   }

   let canvasJq     = $('canvas');
   let canvasOffset = canvasJq.offset();
   let mouseX       = e.pageX - canvasOffset.left;
   let mouseY       = e.pageY - canvasOffset.top;
   let mouseGridX   = Math.floor(mouseX / SPRITE_WIDTH );
   let mouseGridY   = Math.floor(mouseY / SPRITE_HEIGHT);

   drawTextOnGridSquare(mouseGridX, mouseGridY, 'R');
   rainUntilWaterLevelRisesByOne(mouseGridX, mouseGridY);
}

// Flood functions. //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function rainOnRandomSquarePeriodicallyUntilLimitThenRecede()
{
   if (gameState.floodIsReceding)
   {
      decreaseWaterLevelEverywhereByOne();

      // Count down gameState.nRainDropsFallen so we know when the flood has completely receded.
      --gameState.nRainDropsFallen;

      if (gameState.nRainDropsFallen > 0)
      {
         window.setTimeout(rainOnRandomSquarePeriodicallyUntilLimitThenRecede, 100);
      }
      else
      {
         updateScoreAndShowEndOfRoundSummary();
      }
   }
   else
   {
      let rainX         = null;
      let rainY         = null;
      let squareIsValid = false;

      while (!squareIsValid)
      {
         rainX = getRandomInt(0, GRID_WIDTH );
         rainY = getRandomInt(0, GRID_HEIGHT);

         if (!gameGrid[rainX][rainY].isWall)
         {
            squareIsValid = true;
         }
      }

      rainUntilWaterLevelRisesByOne(rainX, rainY);

      if (getPercentageOfGridUnderwater() > 50)
      {
         gameState.floodIsReceding = true;
      }

      window.setTimeout(rainOnRandomSquarePeriodicallyUntilLimitThenRecede, 1000);
   }
}

function decreaseWaterLevelEverywhereByOne()
{
   // Decrease water level everyone by one.
   for (let x = 0; x < GRID_WIDTH; ++x)
   {
      for (let y = 0; y < GRID_HEIGHT; ++y)
      {
         if (gameGrid[x][y].height > gameGrid[x][y].heightOrig)
         {
            --gameGrid[x][y].height;

            if (gameGrid[x][y].height == gameGrid[x][y].heightOrig)
            {
               gameGrid[x][y].isUnderwater = (gameGrid[x][y].heightOrig <= 1);

               let imageIndex =
               (
                  (gameGrid[x][y].hasHouse)? 22:
                  (
                     (gameGrid[x][y].isWall)? 20:
                     gameGrid[x][y].height
                  )
               );

               drawSpriteOnGridSquare(x, y, globalImages[imageIndex]);
            }
         }
      }
   }
}

function rainUntilWaterLevelRisesByOne(rainX, rainY)
{
   globalCoordsVisitedAsKeys = {}; // Clear this before calling recursive function.
   let localPoolBottomCoords = findLocalLowestGridCoordsRecursively(rainX, rainY);

   if (localPoolBottomCoords === null)
   {
      // Grid coords returned being null means the submitted coords are a local minimum.
      localPoolBottomCoords = {x: rainX, y: rainY};
   }

   if (gameState.gridNumbersAreShown)
   {
      drawTextOnGridSquare(localPoolBottomCoords.x, localPoolBottomCoords.y, 'M'); // Mark local minima.
   }

   let targetWaterLevel = gameGrid[localPoolBottomCoords.x][localPoolBottomCoords.y].height + 1;
   addWaterUpToWaterLevelRecursively(localPoolBottomCoords.x, localPoolBottomCoords.y, targetWaterLevel);

   ++gameState.nRainDropsFallen;
}

function findLocalLowestGridCoordsRecursively(x, y)
{
   globalCoordsVisitedAsKeys['x:' + x + ',' + y] = true;

   // Collect all the results so we can filter and sort them.
   let currentSquareHeight = gameGrid[x][y];
   let allResultCoords     = [];
   let neighbourCoords     =
   [
      {x: x - 1, y: y - 1}, // TL.
      {x: x    , y: y - 1}, // TM.
      {x: x + 1, y: y - 1}, // TR.
      {x: x - 1, y: y    }, // ML.
      {x: x + 1, y: y    }, // MR.
      {x: x - 1, y: y + 1}, // BL.
      {x: x    , y: y + 1}, // BM.
      {x: x + 1, y: y + 1}  // BR.
   ];

   // For each neighbouring square...
   for (let coord of neighbourCoords)
   {
      if
      (
         // If that square is on the map AND
         //    that square's height is less than or equal to the current square's height AND
         //    we have not visited that square before...
         coord.x >= 0 && coord.x < GRID_WIDTH  &&
         coord.y >= 0 && coord.y < GRID_HEIGHT &&
         gameGrid[coord.x][coord.y].height <= gameGrid[x][y].height &&
         globalCoordsVisitedAsKeys['x:' + coord.x + ',' + coord.y] === undefined
      )
      {
         // Add the coordinates of that square to the array.
         allResultCoords.push(coord);
      }
   }

   if (allResultCoords.length == 0)
   {
      // None of the neighbouring squares is lower, so return the given coordinates.
      return {x: x, y: y};
   }

   // Sort by height ascending.
   allResultCoords.sort
   (
      function compare(a, b)
      {
         let aHeight = gameGrid[a.x][a.y].height;
         let bHeight = gameGrid[b.x][b.y].height;
         return ((aHeight === bHeight)? 0: ((aHeight > bHeight)? 1: -1));
      }
   );

   let lowerGridSquare = allResultCoords[0];

   if (gameState.gameMode == 'simulation')
   {
      let halfSpriteHeight = SPRITE_HEIGHT / 2;
      let halfSpriteWidth  = SPRITE_WIDTH  / 2;
      // Draw line from current grid square to new grid square.
      ctx.strokeStyle = 'rgb(0, 0, 200)'; // Set draw colour to red.
      ctx.beginPath();                    // Start a path that will later be drawn.
      ctx.moveTo(x                 * SPRITE_WIDTH + halfSpriteWidth, y                 * SPRITE_HEIGHT + halfSpriteHeight);
      ctx.lineTo(lowerGridSquare.x * SPRITE_WIDTH + halfSpriteWidth, lowerGridSquare.y * SPRITE_HEIGHT + halfSpriteHeight);
      ctx.stroke();
   }

   // Return the coordinates of the lowest neighbouring grid square.
   return findLocalLowestGridCoordsRecursively(lowerGridSquare.x, lowerGridSquare.y);
}

function addWaterUpToWaterLevelRecursively(x, y, targetWaterLevel)
{
   if
   (
      // If current square exists AND
      //    current square's height is less than the water level...
      x >= 0 && x < GRID_WIDTH  &&
      y >= 0 && y < GRID_HEIGHT &&
      gameGrid[x][y].height < targetWaterLevel
   )
   {
      gameGrid[x][y].height = targetWaterLevel;
      drawSpriteOnGridSquare(x, y, globalImages[0]);
   }

   let currentSquareHeight = gameGrid[x][y];
   let allResultCoords     = [];
   let neighbourCoords     =
   [
      {x: x - 1, y: y - 1}, // TL.
      {x: x    , y: y - 1}, // TM.
      {x: x + 1, y: y - 1}, // TR.
      {x: x - 1, y: y    }, // ML.
      {x: x + 1, y: y    }, // MR.
      {x: x - 1, y: y + 1}, // BL.
      {x: x    , y: y + 1}, // BM.
      {x: x + 1, y: y + 1}  // BR.
   ];

   for (let coord of neighbourCoords)
   {
      if
      (
         // If that square exists AND
         //    that square's height is less than the water level...
         coord.x >= 0 && coord.x < GRID_WIDTH  &&
         coord.y >= 0 && coord.y < GRID_HEIGHT &&
         gameGrid[coord.x][coord.y].height < targetWaterLevel
      )
      {
         gameGrid[coord.x][coord.y].height = targetWaterLevel;

         let imageIndex = 0;

         if (gameGrid[coord.x][coord.y].hasHouse)
         {
            if (!gameGrid[coord.x][coord.y].isUnderwater)
            {
               ++gameState.nHomesLost;
            }

            imageIndex = 22;
         }

         gameGrid[coord.x][coord.y].isUnderwater = true;

         drawSpriteOnGridSquare(coord.x, coord.y, globalImages[imageIndex]);

         addWaterUpToWaterLevelRecursively(coord.x, coord.y, targetWaterLevel);
      }
   }
}

// Utility functions. ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getAvgHeightOfSurroundingSquares(x, y)
{
   let n   = 0;
   let sum = 0;

   if (y > 0               && x > 0             ) {sum += Number(terrainGrid[x - 1][y - 1]); ++n;} // top-left.
   if (y > 0                                    ) {sum += Number(terrainGrid[x    ][y - 1]); ++n;} // top-middle.
   if (y > 0               && x < GRID_WIDTH - 1) {sum += Number(terrainGrid[x + 1][y - 1]); ++n;} // top-right.

   if (                       x > 0             ) {sum += Number(terrainGrid[x - 1][y    ]); ++n;} // left.
   if (                       x < GRID_WIDTH - 1) {sum += Number(terrainGrid[x + 1][y    ]); ++n;} // right.

   if (y < GRID_HEIGHT - 1 && x > 0             ) {sum += Number(terrainGrid[x - 1][y + 1]); ++n;} // bottom-left.
   if (y < GRID_HEIGHT - 1                      ) {sum += Number(terrainGrid[x    ][y + 1]); ++n;} // bottom-middle.
   if (y < GRID_HEIGHT - 1 && x < GRID_WIDTH - 1) {sum += Number(terrainGrid[x + 1][y + 1]); ++n;} // bottom-right.

   return ((n > 0)? Math.floor(sum / n): 0);
}

function getHeightOfHighestNeighbour(x, y)
{
   let highestH = 0;

   if (y > 0               && x > 0             ) {let h = Number(terrainGrid[x - 1][y - 1]); if (h > highestH) {highestH = h;}} // top-left.
   if (y > 0                                    ) {let h = Number(terrainGrid[x    ][y - 1]); if (h > highestH) {highestH = h;}} // top-middle.
   if (y > 0               && x < GRID_WIDTH - 1) {let h = Number(terrainGrid[x + 1][y - 1]); if (h > highestH) {highestH = h;}} // top-right.

   if (                       x > 0             ) {let h = Number(terrainGrid[x - 1][y    ]); if (h > highestH) {highestH = h;}} // left.
   if (                       x < GRID_WIDTH - 1) {let h = Number(terrainGrid[x + 1][y    ]); if (h > highestH) {highestH = h;}} // right.

   if (y < GRID_HEIGHT - 1 && x > 0             ) {let h = Number(terrainGrid[x - 1][y + 1]); if (h > highestH) {highestH = h;}} // bottom-left.
   if (y < GRID_HEIGHT - 1                      ) {let h = Number(terrainGrid[x    ][y + 1]); if (h > highestH) {highestH = h;}} // bottom-middle.
   if (y < GRID_HEIGHT - 1 && x < GRID_WIDTH - 1) {let h = Number(terrainGrid[x + 1][y + 1]); if (h > highestH) {highestH = h;}} // bottom-right.

   return highestH;
}

function terrainSquareHasNonNullNeighbour(x, y)
{
   let highestH = 0;

   if (y > 0               && x > 0             ) {if (terrainGrid[x - 1][y - 1] !== null) {return true;}} // top-left.
   if (y > 0                                    ) {if (terrainGrid[x    ][y - 1] !== null) {return true;}} // top-middle.
   if (y > 0               && x < GRID_WIDTH - 1) {if (terrainGrid[x + 1][y - 1] !== null) {return true;}} // top-right.

   if (                       x > 0             ) {if (terrainGrid[x - 1][y    ] !== null) {return true;}} // left.
   if (                       x < GRID_WIDTH - 1) {if (terrainGrid[x + 1][y    ] !== null) {return true;}} // right.

   if (y < GRID_HEIGHT - 1 && x > 0             ) {if (terrainGrid[x - 1][y + 1] !== null) {return true;}} // bottom-left.
   if (y < GRID_HEIGHT - 1                      ) {if (terrainGrid[x    ][y + 1] !== null) {return true;}} // bottom-middle.
   if (y < GRID_HEIGHT - 1 && x < GRID_WIDTH - 1) {if (terrainGrid[x + 1][y + 1] !== null) {return true;}} // bottom-right.

   return false;
}

function updateScoreAndShowEndOfRoundSummary()
{
   let nHomesTotal = 0;

   for (let x = 0; x < GRID_WIDTH; ++x)
   {
      for (let y = 0; y < GRID_HEIGHT; ++y)
      {
         if (gameGrid[x][y].hasHouse)
         {
            ++nHomesTotal;
         }
      }
   }

   let nHomesSaved    = nHomesTotal - gameState.nHomesLost;
   let scoreIncrement = nHomesSaved - gameState.nHomesLost;
   let divJq          = $('div.round-summary-popup');

   divJq.find('span.round-no-span'             ).html(gameState.roundNo    );
   divJq.find('span.n-homes-lost-span'         ).html(gameState.nHomesLost );
   divJq.find('span.n-homes-saved-span'        ).html(nHomesSaved          );
   divJq.find('span.score-before-this-round'   ).html(gameState.playerScore);
   divJq.find('span.score-increment-this-round').html(scoreIncrement       );

   gameState.playerScore += scoreIncrement;

   divJq.find('span.total-score-span').html(gameState.playerScore);
   divJq.show();

   ++gameState.roundNo;
}

function getPercentageOfGridUnderwater()
{
   let nSquaresUnderwater = 0;

   for (let x = 0; x < GRID_WIDTH; ++x)
   {
      for (let y = 0; y < GRID_HEIGHT; ++y)
      {
         if (gameGrid[x][y].isUnderwater)
         {
            ++nSquaresUnderwater;
         }
      }
   }

   return (nSquaresUnderwater / (GRID_WIDTH * GRID_HEIGHT)) * 100;
}

function loadImage(url)
{
   return new Promise
   (
      (fulfill, reject) =>
      {
         let imageObj = new Image();
         imageObj.onload = () => fulfill(imageObj);
         imageObj.src = url;
      }
   );
}

function copyArray(terrainGrid)
{
   let newTerrainGrid = [];

   for (let x = 0; x < terrainGrid.length; ++x)
   {
      newTerrainGrid[x] = [];

      for (let y = 0; y < terrainGrid[x].length; ++y)
      {
         newTerrainGrid[x][y] = terrainGrid[x][y];
      }
   }

   return newTerrainGrid;
}

/*
 * Draw the supplied text at the supplied position.
 */
function printTextOnCanvas(x, y, text)
{
   ctx.fillStyle = 'rgb(0, 0, 200)';
   ctx.font      = 'bold 16px Arial';
   ctx.fillText(text, x + 10, y + 22);
}

/*
 * Get a random number in range [low, high).
 */
function getRandomInt(low, high)
{
   return low + Math.floor(Math.random() * (high - low))
}

function drawSpriteOnGridSquare(x, y, image) {ctx.drawImage(image, x * SPRITE_WIDTH, y * SPRITE_HEIGHT)   ;}
function drawTextOnGridSquare(x, y, text)    {printTextOnCanvas(x * SPRITE_WIDTH, y * SPRITE_HEIGHT, text);}

