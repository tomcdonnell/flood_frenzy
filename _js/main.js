/*
 * vim: ts=3 sw=3 et wrap co=150 go-=b
 */

const ctx = document.getElementById('canvas').getContext('2d');

ctx.canvas.width  = 1022;
ctx.canvas.height = 1022;

// Global variables. /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const GRID_HEIGHT         =  32; // Vertical   dimension on screen.
const GRID_WIDTH          =  32; // Horizontal dimension on screen.
const SPRITE_HEIGHT       =  32;
const SPRITE_WIDTH        =  32;
const MAX_TERRAIN_HEIGHT  =  20;
const INITIAL_WALL_BUDGET = 100;

let globalCoordsVisitedAsKeys = {}; // Used in recusive function to prevent visiting already visited squares.
let globalImages              = [];
let gameState                 = {gridNumbersAreShown: false, isBuildingWalls: false, wallBudget: INITIAL_WALL_BUDGET, waterLevel: null};
let gameGrid                  = [];
let terrainGrid               = [];

// Startup code. /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

Promise.all
(
   [
      loadImage('_images/01 deep water layer.png'),
      loadImage('_images/02 shallow water layer.png'),
      loadImage('_images/03 light sand layer.png'),
      loadImage('_images/04 darker sand layer.png'),
      loadImage('_images/05 darkest sand layer.png'),
      loadImage('_images/06 grass lightest layer.png'),
      loadImage('_images/07 grass dark layer.png'),
      loadImage('_images/08 grass darker layer.png'),
      loadImage('_images/09 grass darkest layer.png'),
      loadImage('_images/10 dirt light layer.png'),
      loadImage('_images/11 dirt dark layer.png'),
      loadImage('_images/12 dirt darkest layer.png'),
      loadImage('_images/13 rock light layer.png'),
      loadImage('_images/14 rock dark layer.png'),
      loadImage('_images/15 rock darker layer.png'),
      loadImage('_images/16 rock darkest layer.png'),
      loadImage('_images/17 rock darkest realy small snow layer.png'),
      loadImage('_images/18 rock darkest small snow layer.png'),
      loadImage('_images/19 rock darkest half snow layer.png'),
      loadImage('_images/20 pure snow layer.png'),
      loadImage('_images/21 flood barrier.png')
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

   initialiseGameGrid();

   drawGameGrid(false); // Initially draw the grid without the numbers.

   // Set water level to be the lowest height on the grid.
   let lowestHeight = 999;
   for (let x = 0; x < GRID_WIDTH; ++x)
   {
      for (let y = 0; y < GRID_HEIGHT; ++y)
      {
         if (gameGrid[x][y].height < lowestHeight)
         {
            lowestHeight = gameGrid[x][y].height;
         }
      }
   }
   gameState.waterLevel = lowestHeight;


   $('canvas').click(onClickCanvas);

   $('canvas').mousedown(onMouseDownCanvas).mouseup(onMouseUpCanvas).mousemove(onMouseMoveCanvas);
   $('span.wall-budget').html(gameState.wallBudget);
}

// Functions. ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function initialiseGameGrid()
{
   terrainGrid = generateTerrainGrid();

   for (let x = 0; x < GRID_WIDTH; ++x)
   {
      gameGrid[x] = [];

      for (let y = 0; y < GRID_HEIGHT; ++y)
      {
         let gridSquareHeight = terrainGrid[x][y];

         gameGrid[x][y] =
         {
            height      : gridSquareHeight,
            isUnderwater: (gridSquareHeight < 10),
            isWall      : false
         }
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
            (gridSquareObj.isWall)?
            globalImages[20]:
            globalImages[gridSquareObj.height]
         );

         drawSpriteOnGridSquare(x, y, imageForGridSquare);

         if (boolDrawHeightNumbersOnSquares)
         {
            drawTextOnGridSquare(x, y, gridSquareObj.height);
         }
      }
   }
}

function drawSpriteOnGridSquare(x, y, image) {ctx.drawImage(image, x * SPRITE_WIDTH, y * SPRITE_HEIGHT)   ;}
function drawTextOnGridSquare(x, y, text)    {printTextOnCanvas(x * SPRITE_WIDTH, y * SPRITE_HEIGHT, text);}

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

   // Choose six random squares to be mountain tops.
   // If the mountain tops happen to be on the same squares, that is no problem.
   for (let i = 0; i < 6; ++i)
   {
      let mountainTopX   = getRandomInt(0, GRID_WIDTH );
      let mountainTopY   = getRandomInt(0, GRID_HEIGHT);
      let mountainHeight = getRandomInt(MAX_TERRAIN_HEIGHT - 5, MAX_TERRAIN_HEIGHT);

      terrainGrid[mountainTopX][mountainTopY] = mountainHeight;
   }

   for (var i = 0; i < MAX_TERRAIN_HEIGHT; ++i)
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

/*
 * Get a random number in range [low, high).
 */
function getRandomInt(low, high)
{
   return low + Math.floor(Math.random() * (high - low))
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

/*
 * Draw the supplied text at the supplied position.
 */
function printTextOnCanvas(x, y, text)
{
   ctx.fillStyle = 'rgb(255, 0, 0)';
   ctx.font      = 'bold 16px Arial';
   ctx.fillText(text, x + 10, y + 22);
}

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

function generateNewTerrain()
{
   initialiseGameGrid();

   drawGameGrid(gameState.gridNumbersAreShown); // Initially draw the grid without the numbers.
}

function toggleHeightNumbers()
{
   let gridNumbersAreShown = gameState.gridNumbersAreShown;

   drawGameGrid(!gameState.gridNumbersAreShown);

   gameState.gridNumbersAreShown = !gameState.gridNumbersAreShown;
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
         gameGrid[mouseGridX][mouseGridY].isWall  = true;
         gameGrid[mouseGridX][mouseGridY].height += 1;

         --gameState.wallBudget;

         $('span.wall-budget').html(gameState.wallBudget);

         if (gameState.gridNumbersAreShown)
         {
            drawTextOnGridSquare(mouseGridX, mouseGridY, gameGrid[mouseGridX][mouseGridY].height);
         }
      }
   }
}

function simulateFlood()
{
   // Choose a random grid square from which rain will fall.
   let rainX = getRandomInt(0, GRID_WIDTH );
   let rainY = getRandomInt(0, GRID_HEIGHT);

   rainUntilWaterLevelRisesByOne(rainX, rainY);
}

function onClickCanvas(e)
{
   let canvasJq     = $('canvas');
   let canvasOffset = canvasJq.offset();
   let mouseX       = e.pageX - canvasOffset.left;
   let mouseY       = e.pageY - canvasOffset.top;
   let mouseGridX   = Math.floor(mouseX / GRID_WIDTH );
   let mouseGridY   = Math.floor(mouseY / GRID_HEIGHT);

   rainUntilWaterLevelRisesByOne(mouseGridX, mouseGridY);
}

function rainUntilWaterLevelRisesByOne(rainX, rainY)
{
   globalCoordsVisitedAsKeys = {}; // Clear this before calling recursive function.
   let gridCoords = findLocalLowestGridCoordsRecursively(rainX, rainY);

   if (gridCoords === null)
   {
      // Grid coords returned being null means the submitted coords are a local minimum.
      gridCoords = {x: rainX, y: rainY};
   }

   if (gameState.gridNumbersAreShown)
   {
      drawTextOnGridSquare(gridCoords.x, gridCoords.y, 'M'); // Mark local minima.
   }
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
   for (coord of neighbourCoords)
   {
      if
      (
         // If that square exists AND
         //    that square's height is less than or equal to the current square's height AND
         //    we have not visited that square before...
         coord.x >= 0 && coord.x < GRID_WIDTH  &&
         coord.y >= 0 && coord.y < GRID_HEIGHT &&
         gameGrid[coord.x][coord.y].height <= gameGrid[x][y].height &&
         globalCoordsVisitedAsKeys['x:' + coord.x + ',' + coord.y] === undefined
      )
      {
         // Find the lowest local grid coords from that square.
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

   if (gameState.gridNumbersAreShown)
   {
      // Draw line from current grid square to new grid square.
      ctx.strokeStyle = 'rgb(255, 0, 0)'; // Set draw colour to red.
      ctx.beginPath();                    // Start a path that will later be drawn.
      ctx.moveTo(x                 * GRID_WIDTH + 16, y                 * GRID_HEIGHT + 16);
      ctx.lineTo(lowerGridSquare.x * GRID_WIDTH + 16, lowerGridSquare.y * GRID_HEIGHT + 16);
      ctx.stroke();
   }

   // Return the coordinates of the lowest neighbouring grid square.
   return findLocalLowestGridCoordsRecursively(lowerGridSquare.x, lowerGridSquare.y);
}