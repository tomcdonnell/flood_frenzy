/*
 * vim: ts=3 sw=3 et wrap co=150 go-=b
 */

// Global variables. /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const MAX_TERRAIN_HEIGHT = 20;
const N_ROUNDS_PER_GAME  =  5;
const SPRITE_HEIGHT      = 32; // Must match height of cell images (default 32).
const SPRITE_WIDTH       = 32; // Must match width  of cell images (default 32).

let ctx                       = document.getElementById('canvas').getContext('2d');
let globalCoordsVisitedAsKeys = {}; // Used in recusive function to prevent visiting already visited squares.
let globalImages              = [];
let gameGrid                  = [];
let terrainGrid               = [];
let gameState                 =
{
   floodIsReceding    : false ,
   gameMode           : 'game', // Possible values: {'game', 'simulation', 'information', 'high-scores'}
   gridHeight         : null  ,
   gridNumbersAreShown: false ,
   gridWidth          : null  ,
   isBuildingWalls    : false ,
   nHomesLost         : 0     ,
   nWaterPathsByKey   : {}    , // Keys are in format 'r,c->r,c'.
   playerScore        : 0     ,
   roundNo            : 1     ,
   totalHousesLost    : 0     ,
   totalHousesSaved   : 0
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
   $('span.n-rounds-per-game-span').html(N_ROUNDS_PER_GAME);

   onClickGameModeButton();
}

// Initialisation functions. /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function initialiseGameGrid()
{
   gameState.gridHeight = $('select#grid-size').val();
   gameState.gridWidth  = $('select#grid-size').val();
   terrainGrid          = generateTerrainGrid();
//   terrainGrid          =
//   [
//      // Test data set.  To use, must set gameState.gridHeight and gameState.gridWidth to match dimensions here.
//      [19, 19, 19, 19, 19, 19, 19,  9],
//      [19, 18, 19,  0,  1,  2,  3, 10],
//      [19, 17, 19, 19, 19, 19,  4, 11],
//      [19, 16, 19, 12, 17, 19,  5, 12],
//      [19, 15, 19, 13, 16, 19,  6, 13],
//      [19, 14, 19, 19, 19, 19,  7, 14],
//      [19, 13, 12, 11, 10,  9,  8, 15],
//      [19, 19, 19, 19, 19, 19, 19, 16],
//   ];

   for (let r = 0; r < gameState.gridHeight; ++r)
   {
      gameGrid[r] = [];

      for (let c = 0; c < gameState.gridWidth; ++c)
      {
         let gridSquareHeight = terrainGrid[r][c];

         gameGrid[r][c] =
         {
            hasHouse    : false           ,
            height      : gridSquareHeight,
            heightOrig  : gridSquareHeight, // Used when the flood recedes.
            isWall      : false           ,
            isUnderwater: (gridSquareHeight <= 1)
         }
      }
   }

   // Add houses.
   let nHousesAdded  = 0;
   let nHousesPerMap = $('select#n-houses').val();
   while (nHousesAdded < nHousesPerMap)
   {
      let houseR          = getRandomInt(0, gameState.gridHeight);
      let houseC          = getRandomInt(0, gameState.gridWidth );
      let houseGridSquare = gameGrid[houseR][houseC];

      if (3 < houseGridSquare.height && houseGridSquare.height < 15)
      {
         houseGridSquare.hasHouse = true;
         ++nHousesAdded;
      }
   }
}

function drawGameGrid(boolDrawHeightNumbersOnSquares)
{
   ctx.canvas.width  = gameState.gridWidth  * SPRITE_WIDTH ;
   ctx.canvas.height = gameState.gridHeight * SPRITE_HEIGHT;

   for (let r = 0; r < gameState.gridHeight; ++r)
   {
      for (let c = 0; c < gameState.gridWidth; ++c)
      {
         let gridSquareObj = gameGrid[r][c];

         if (gridSquareObj.height < 0 || gridSquareObj.height > 19)
         {
            throw 'Grid square [' + r + '][' + c + '] height (' + gridSquareObj.height + ') out of expected range.';
         }

         let imageForGridSquare =
         (
            (gridSquareObj.isWall)? globalImages[20]:
            (
               (gridSquareObj.hasHouse)? globalImages[21]:
               globalImages[gridSquareObj.height]
            )
         );

         drawSpriteOnGridSquare(r, c, imageForGridSquare);

         if (boolDrawHeightNumbersOnSquares)
         {
            drawTextOnGridSquare(r, c, gridSquareObj.height);
         }
      }
   }
}

function generateTerrainGrid()
{
   for (let x = 0; x < gameState.gridWidth; ++x)
   {
      terrainGrid[x] = [];

      for (let y = 0; y < gameState.gridHeight; ++y)
      {
         terrainGrid[x][y] = null;
      }
   }

   // Choose random squares to be mountain tops.
   // If the mountain tops happen to be on the same squares, that is no problem.
   let nMountainsPerMap = $('select#n-mountains').val();
   for (let i = 0; i < nMountainsPerMap; ++i)
   {
      let mountainTopX   = getRandomInt(0, gameState.gridWidth );
      let mountainTopY   = getRandomInt(0, gameState.gridHeight);
      let mountainHeight = getRandomInt(MAX_TERRAIN_HEIGHT - 5, MAX_TERRAIN_HEIGHT);

      terrainGrid[mountainTopX][mountainTopY] = mountainHeight;
   }

   for (let i = 0; i < MAX_TERRAIN_HEIGHT; ++i)
   {
      let tempTerrainGrid = copyArray(terrainGrid);

      // Fill in terrain surrounding mountain tops.  First left->right, top->bottom.
      for (let x = 0; x < gameState.gridWidth; ++x)
      {
         for (let y = 0; y < gameState.gridHeight; ++y)
         {
            if (terrainGrid[x][y] === null && terrainSquareHasNonNullNeighbour(x, y))
            {
               // Fill in empty terrain square depending on height of surrounding squares.
               let heightOfHighestNeighbour = getHeightOfHighestNeighbour(x, y);
               let randomDecrement          = getRandomInt(1, 2 + Number($('select#mountain-asymmetry').val()));
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
   for (let x = 0; x < gameState.gridWidth; ++x)
   {
      for (let y = 0; y < gameState.gridHeight; ++y)
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
   $('span.round-no-span').html(gameState.roundNo);

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

   gameState.gameMode = 'simulation';
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
   gameState.floodIsReceding  = false;
   gameState.gameMode         = 'game';
   gameState.nHomesLost       = 0;
   gameState.nRainDropsFallen = 0;

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
}

function onClickToggleHeightNumbers()
{
   let gridNumbersAreShown = gameState.gridNumbersAreShown;

   drawGameGrid(!gameState.gridNumbersAreShown);

   gameState.gridNumbersAreShown = !gameState.gridNumbersAreShown;
}

function onClickRainOnRandomSquare()
{
   let rainR         = null;
   let rainC         = null;
   let squareIsValid = false;

   gameState.nWaterPathsByKey = {};

   while (!squareIsValid)
   {
      rainR = getRandomInt(0, gameState.gridHeight);
      rainC = getRandomInt(0, gameState.gridWidth );

      if (!gameGrid[rainR][rainC].isWall)
      {
         squareIsValid = true;
      }
   }

   rainUntilWaterLevelRisesByOne(rainR, rainC, true);
}

function onClickRainOnAllSquares()
{
   gameState.nWaterPathsByKey = {};

   for (let x = 0; x < gameState.gridWidth; ++x)
   {
      for (let y = 0; y < gameState.gridHeight; ++y)
      {
         rainUntilWaterLevelRisesByOne(x, y, false);
      }
   }
}

function onClickRecedeFlood()
{
   decreaseWaterLevelEverywhereByOne();
}

function onMouseUpCanvas(e)   {gameState.isBuildingWalls = false;}
function onMouseDownCanvas(e) {gameState.isBuildingWalls = true ;}

function onMouseMoveCanvas(e)
{
   if (gameState.isBuildingWalls)
   {
      let canvasJq     = $('canvas');
      let canvasOffset = canvasJq.offset();
      let mouseX       = e.pageX - canvasOffset.left;
      let mouseY       = e.pageY - canvasOffset.top;
      let mouseGridR   = Math.floor(mouseY / SPRITE_HEIGHT);
      let mouseGridC   = Math.floor(mouseX / SPRITE_WIDTH );

      if (mouseGridR > gameState.gridHeight || mouseGridC > gameState.gridWidth)
      {
         throw new Exception('Mouse grid coordinates out of expected range.');
      }

      if (gameGrid[mouseGridR][mouseGridC].height < MAX_TERRAIN_HEIGHT - 1)
      {
         drawSpriteOnGridSquare(mouseGridR, mouseGridC, globalImages[20]);
         gameGrid[mouseGridR][mouseGridC].isWall = true;
         gameGrid[mouseGridR][mouseGridC].height = 19;

         --gameState.wallBudget;

         $('span.wall-budget').html(gameState.wallBudget);

         if (gameState.gridNumbersAreShown)
         {
            drawTextOnGridSquare(mouseGridR, mouseGridC, gameGrid[mouseGridR][mouseGridC].height);
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

   gameState.nWaterPathsByKey = {};

   let canvasJq     = $('canvas');
   let canvasOffset = canvasJq.offset();
   let mouseX       = e.pageX - canvasOffset.left;
   let mouseY       = e.pageY - canvasOffset.top;
   let mouseGridR   = Math.floor(mouseY / SPRITE_HEIGHT);
   let mouseGridC   = Math.floor(mouseX / SPRITE_WIDTH );

   rainUntilWaterLevelRisesByOne(mouseGridR, mouseGridC, true);
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
      let rainR         = null;
      let rainC         = null;
      let squareIsValid = false;

      while (!squareIsValid)
      {
         rainR = getRandomInt(0, gameState.gridHeight);
         rainC = getRandomInt(0, gameState.gridWidth );

         if (!gameGrid[rainR][rainC].isWall)
         {
            squareIsValid = true;
         }
      }

      rainUntilWaterLevelRisesByOne(rainR, rainC, true);

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
   for (let r = 0; r < gameState.gridHeight; ++r)
   {
      for (let c = 0; c < gameState.gridWidth; ++c)
      {
         if (gameGrid[r][c].height > gameGrid[r][c].heightOrig)
         {
            --gameGrid[r][c].height;

            if (gameGrid[r][c].height == gameGrid[r][c].heightOrig)
            {
               gameGrid[r][c].isUnderwater = (gameGrid[r][c].heightOrig <= 1);

               let imageIndex =
               (
                  (gameGrid[r][c].hasHouse)? 22:
                  (
                     (gameGrid[r][c].isWall)? 20:
                     gameGrid[r][c].height
                  )
               );

               drawSpriteOnGridSquare(r, c, globalImages[imageIndex]);
            }
         }
      }
   }
}

function rainUntilWaterLevelRisesByOne(rainR, rainC, boolIncreaseFloodLevel)
{
   globalCoordsVisitedAsKeys = {}; // Clear this before calling recursive function.
   let localPoolBottomCoords = findLocalLowestGridCoordsRecursively(rainR, rainC);

   if (localPoolBottomCoords === null)
   {
      // Grid coords returned being null means the submitted coords are a local minimum.
      localPoolBottomCoords = {r: rainR, c: rainC};
   }

   if (boolIncreaseFloodLevel)
   {
      let targetWaterLevel = gameGrid[localPoolBottomCoords.r][localPoolBottomCoords.c].height + 1;
      addWaterUpToWaterLevelRecursively(localPoolBottomCoords.r, localPoolBottomCoords.c, targetWaterLevel);
   }

   ++gameState.nRainDropsFallen;
}

function findLocalLowestGridCoordsRecursively(r, c)
{
   globalCoordsVisitedAsKeys[r + ',' + c] = true;

   // Collect all the results so we can filter and sort them.
   let currentSquareHeight = gameGrid[r][c];
   let allResultCoords     = [];
   let neighbourCoords     =
   [
      {r: r - 1, c: c - 1}, // TL.
      {r: r - 1, c: c    }, // TM.
      {r: r - 1, c: c + 1}, // TR.
      {r: r    , c: c - 1}, // ML.
      {r: r    , c: c + 1}, // MR.
      {r: r + 1, c: c - 1}, // BL.
      {r: r + 1, c: c    }, // BM.
      {r: r + 1, c: c + 1}  // BR.
   ];

   // For each neighbouring square...
   for (let coord of neighbourCoords)
   {
      if
      (
         // If that square is on the map AND
         //    that square's height is less than or equal to the current square's height AND
         //    we have not visited that square before...
         coord.r >= 0 && coord.r < gameState.gridHeight &&
         coord.c >= 0 && coord.c < gameState.gridWidth  &&
         gameGrid[coord.r][coord.c].height <= gameGrid[r][c].height &&
         globalCoordsVisitedAsKeys[coord.r + ',' + coord.c] === undefined
      )
      {
         // Add the coordinates of that square to the array.
         allResultCoords.push(coord);
      }
   }

   if (allResultCoords.length == 0)
   {
      // None of the neighbouring squares is lower, so return the given coordinates.
      return {r: r, c: c};
   }

   // Sort by height ascending.
   allResultCoords.sort
   (
      function compare(a, b)
      {
         let aHeight = gameGrid[a.r][a.c].height;
         let bHeight = gameGrid[b.r][b.c].height;
         return ((aHeight === bHeight)? 0: ((aHeight > bHeight)? 1: -1));
      }
   );

   let lowerGridSquare = allResultCoords[0];

   if (gameState.gameMode == 'simulation')
   {
      let halfSpriteHeight = SPRITE_HEIGHT / 2;
      let halfSpriteWidth  = SPRITE_WIDTH  / 2;
      // Draw line from current grid square to new grid square.
      ctx.strokeStyle = 'rgb(60, 60, 200)'; // Set draw colour to blue.
      ctx.beginPath();                    // Start a path that will later be drawn.
      ctx.moveTo(c * SPRITE_WIDTH + halfSpriteWidth, r * SPRITE_HEIGHT + halfSpriteHeight);

      if (gameGrid[r][c].height > 0)
      {
         ctx.lineTo(lowerGridSquare.c * SPRITE_WIDTH + halfSpriteWidth, lowerGridSquare.r * SPRITE_HEIGHT + halfSpriteHeight);

         // Remember that water has found a path from the higher square to the lower square.
         let key = r + ',' + c + '->' + lowerGridSquare.r + ',' + lowerGridSquare.c;
         if (gameState.nWaterPathsByKey[key] === undefined) {gameState.nWaterPathsByKey[key] = 0;}
         ++gameState.nWaterPathsByKey[key];

         ctx.lineCap   = 'round';
         ctx.lineWidth = gameState.nWaterPathsByKey[key] / 2;
      }
      else
      {
         ctx.moveTo(lowerGridSquare.c * SPRITE_WIDTH + halfSpriteWidth, lowerGridSquare.r * SPRITE_HEIGHT + halfSpriteHeight);
      }

      ctx.stroke();
   }

   // Return the coordinates of the lowest neighbouring grid square.
   return findLocalLowestGridCoordsRecursively(lowerGridSquare.r, lowerGridSquare.c);
}

function addWaterUpToWaterLevelRecursively(r, c, targetWaterLevel)
{
   if
   (
      // If current square exists AND
      //    current square's height is less than the water level...
      r >= 0 && r < gameState.gridHeight &&
      c >= 0 && c < gameState.gridWidth  &&
      gameGrid[r][c].height < targetWaterLevel
   )
   {
      gameGrid[r][c].height = targetWaterLevel;
      drawSpriteOnGridSquare(r, c, globalImages[0]);
   }

   let currentSquareHeight = gameGrid[r][c];
   let allResultCoords     = [];
   let neighbourCoords     =
   [
      {r: r - 1, c: c - 1}, // TL.
      {r: r - 1, c: c    }, // TM.
      {r: r - 1, c: c + 1}, // TR.
      {r: r    , c: c - 1}, // ML.
      {r: r    , c: c + 1}, // MR.
      {r: r + 1, c: c - 1}, // BL.
      {r: r + 1, c: c    }, // BM.
      {r: r + 1, c: c + 1}  // BR.
   ];

   for (let coord of neighbourCoords)
   {
      if
      (
         // If that square exists AND
         //    that square's height is less than the water level...
         coord.r >= 0 && coord.r < gameState.gridHeight &&
         coord.c >= 0 && coord.c < gameState.gridWidth  &&
         gameGrid[coord.r][coord.c].height < targetWaterLevel
      )
      {
         gameGrid[coord.r][coord.c].height = targetWaterLevel;

         let imageIndex = 0;

         if (gameGrid[coord.r][coord.c].hasHouse)
         {
            if (!gameGrid[coord.r][coord.c].isUnderwater)
            {
               ++gameState.nHomesLost;
            }

            imageIndex = 22;
         }

         gameGrid[coord.r][coord.c].isUnderwater = true;

         drawSpriteOnGridSquare(coord.r, coord.c, globalImages[imageIndex]);

         addWaterUpToWaterLevelRecursively(coord.r, coord.c, targetWaterLevel);
      }
   }
}

// Utility functions. ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function getAvgHeightOfSurroundingSquares(r, c)
{
   let n   = 0;
   let sum = 0;

   if (r > 0                        && c > 0                      ) {sum += Number(terrainGrid[r - 1][c - 1]); ++n;} // top-left.
   if (r > 0                                                      ) {sum += Number(terrainGrid[r - 1][c    ]); ++n;} // top-middle.
   if (r > 0                        && c < gameState.gridWidth - 1) {sum += Number(terrainGrid[r - 1][c + 1]); ++n;} // top-right.

   if (                                c > 0                      ) {sum += Number(terrainGrid[r    ][c - 1]); ++n;} // left.
   if (                                c < gameState.gridWidth - 1) {sum += Number(terrainGrid[r    ][c + 1]); ++n;} // right.

   if (r < gameState.gridHeight - 1 && c > 0                      ) {sum += Number(terrainGrid[r + 1][c - 1]); ++n;} // bottom-left.
   if (r < gameState.gridHeight - 1                               ) {sum += Number(terrainGrid[r + 1][c    ]); ++n;} // bottom-middle.
   if (r < gameState.gridHeight - 1 && c < gameState.gridWidth - 1) {sum += Number(terrainGrid[r + 1][c + 1]); ++n;} // bottom-right.

   return ((n > 0)? Math.floor(sum / n): 0);
}

function getHeightOfHighestNeighbour(r, c)
{
   let highestH = 0;
   let g        = gameState;

   if (r > 0                && c > 0              ) {let h = Number(terrainGrid[r - 1][c - 1]); if (h > highestH) {highestH = h;}} // top-left.
   if (r > 0                                      ) {let h = Number(terrainGrid[r - 1][c    ]); if (h > highestH) {highestH = h;}} // top-middle.
   if (r > 0                && c < g.gridWidth - 1) {let h = Number(terrainGrid[r - 1][c + 1]); if (h > highestH) {highestH = h;}} // top-right.

   if (                        c > 0              ) {let h = Number(terrainGrid[r    ][c - 1]); if (h > highestH) {highestH = h;}} // left.
   if (                        c < g.gridWidth - 1) {let h = Number(terrainGrid[r    ][c + 1]); if (h > highestH) {highestH = h;}} // right.

   if (r < g.gridHeight - 1 && c > 0              ) {let h = Number(terrainGrid[r + 1][c - 1]); if (h > highestH) {highestH = h;}} // bottom-left.
   if (r < g.gridHeight - 1                       ) {let h = Number(terrainGrid[r + 1][c    ]); if (h > highestH) {highestH = h;}} // bottom-middle.
   if (r < g.gridHeight - 1 && c < g.gridWidth - 1) {let h = Number(terrainGrid[r + 1][c + 1]); if (h > highestH) {highestH = h;}} // bottom-right.

   return highestH;
}

function terrainSquareHasNonNullNeighbour(r, c)
{
   let highestH = 0;
   let g        = gameState;

   if (r > 0                && c > 0              ) {if (terrainGrid[r - 1][c - 1] !== null) {return true;}} // top-left.
   if (r > 0                                      ) {if (terrainGrid[r - 1][c    ] !== null) {return true;}} // top-middle.
   if (r > 0                && c < g.gridWidth - 1) {if (terrainGrid[r - 1][c + 1] !== null) {return true;}} // top-right.

   if (                        c > 0              ) {if (terrainGrid[r    ][c - 1] !== null) {return true;}} // left.
   if (                        c < g.gridWidth - 1) {if (terrainGrid[r    ][c + 1] !== null) {return true;}} // right.

   if (r < g.gridHeight - 1 && c > 0              ) {if (terrainGrid[r + 1][c - 1] !== null) {return true;}} // bottom-left.
   if (r < g.gridHeight - 1                       ) {if (terrainGrid[r + 1][c    ] !== null) {return true;}} // bottom-middle.
   if (r < g.gridHeight - 1 && c < g.gridWidth - 1) {if (terrainGrid[r + 1][c + 1] !== null) {return true;}} // bottom-right.

   return false;
}

function updateScoreAndShowEndOfRoundSummary()
{
   let nHomesTotal = 0;

   for (let r = 0; r < gameState.gridHeight; ++r)
   {
      for (let c = 0; c < gameState.gridWidth; ++c)
      {
         if (gameGrid[r][c].hasHouse)
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

   for (let r = 0; r < gameState.gridHeight; ++r)
   {
      for (let c = 0; c < gameState.gridWidth; ++c)
      {
         if (gameGrid[r][c].isUnderwater)
         {
            ++nSquaresUnderwater;
         }
      }
   }

   return (nSquaresUnderwater / (gameState.gridWidth * gameState.gridHeight)) * 100;
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

   for (let r = 0; r < terrainGrid.length; ++r)
   {
      newTerrainGrid[r] = [];

      for (let c = 0; c < terrainGrid[r].length; ++c)
      {
         newTerrainGrid[r][c] = terrainGrid[r][c];
      }
   }

   return newTerrainGrid;
}

/*
 * Get a random number in range [low, high).
 */
function getRandomInt(low, high)
{
   return low + Math.floor(Math.random() * (high - low))
}

function drawSpriteOnGridSquare(r, c, image)
{
   ctx.drawImage(image, c * SPRITE_WIDTH, r * SPRITE_HEIGHT);
}

function drawTextOnGridSquare(r, c, text)
{
   ctx.fillStyle = 'rgb(0, 0, 200)';
   ctx.font      = 'bold 16px Arial';
   ctx.fillText(text, c * SPRITE_WIDTH + 10, r * SPRITE_HEIGHT + 22);
}

