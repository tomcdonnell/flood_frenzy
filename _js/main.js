/*
 * vim: ts=3 sw=3 et wrap co=150 go-=b
 */

const ctx = document.getElementById('canvas').getContext('2d');

ctx.canvas.width  = 1022;
ctx.canvas.height = 1022;

// Global variables. /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let gameGrid    = [];
let terrainGrid = [];

const GRID_LENGTH        = 32; // Vertical   dimension on screen.
const GRID_WIDTH         = 32; // Horizontal dimension on screen.
const SPRITE_HEIGHT      = 32;
const SPRITE_WIDTH       = 32;
const MAX_TERRAIN_HEIGHT = 20;

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
      loadImage('_images/20 pure snow layer.png')
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
   initialiseGameGrid();

//   drawGameGrid(images, true);
   drawGameGrid(images, false);
}

// Functions. ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

function initialiseGameGrid()
{
   terrainGrid = generateTerrainGrid();

   for (let x = 0; x < GRID_WIDTH; ++x)
   {
      gameGrid[x] = [];

      for (let y = 0; y < GRID_LENGTH; ++y)
      {
         let gridSquareHeight = terrainGrid[x][y];

         gameGrid[x][y] = {height: gridSquareHeight, isUnderwater: (gridSquareHeight < 10)}
      }
   }
}

function drawGameGrid(images, boolDrawHeightNumbersOnSquares)
{
   for (let x = 0; x < GRID_WIDTH; ++x)
   {
      for (let y = 0; y < GRID_LENGTH; ++y)
      {
         let gridSquareObj = gameGrid[x][y];

         if (gridSquareObj.height < 0 || gridSquareObj.height > 19)
         {
            throw 'Grid square [' + x + '][' + y + '] height (' + gridSquareObj.height + ') out of expected range.';
         }

         let imageForGridSquare = images[gridSquareObj.height];

         ctx.drawImage(imageForGridSquare, x * SPRITE_WIDTH, y * SPRITE_HEIGHT);

         if (boolDrawHeightNumbersOnSquares)
         {
            printTextOnCanvas(x * (SPRITE_WIDTH + 1), y * (SPRITE_HEIGHT + 1), gridSquareObj.height);
         }
      }
   }
}

function generateTerrainGrid()
{
   for (let x = 0; x < GRID_WIDTH; ++x)
   {
      terrainGrid[x] = [];

      for (let y = 0; y < GRID_LENGTH; ++y)
      {
         terrainGrid[x][y] = null;
      }
   }

   // Choose five random squares to be mountain tops.
   // If the mountain tops happen to be on the same squares, that is no problem.
   for (let i = 0; i < 5; ++i)
   {
      let mountainTopX   = getRandomInt(0, GRID_WIDTH );
      let mountainTopY   = getRandomInt(0, GRID_LENGTH);
      let mountainHeight = getRandomInt(15, 20);

      terrainGrid[mountainTopX][mountainTopY] = mountainHeight;
   }

   for (var i = 0; i < 20; ++i)
   {
      let tempTerrainGrid = copyArray(terrainGrid);

      // Fill in terrain surrounding mountain tops.  First left->right, top->bottom.
      for (let x = 0; x < GRID_WIDTH; ++x)
      {
         for (let y = 0; y < GRID_LENGTH; ++y)
         {
            if (terrainGrid[x][y] === null && terrainSquareHasNonNullNeighbour(x, y))
            {
               // Fill in empty terrain square depending on height of surrounding squares.
               let heightOfHighestNeighbour = getHeightOfHighestNeighbour(x, y);
               let randomDecrement          = getRandomInt(1, 3);
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
      for (let y = 0; y < GRID_LENGTH; ++y)
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

   if (y < GRID_LENGTH - 1 && x > 0             ) {sum += Number(terrainGrid[x - 1][y + 1]); ++n;} // bottom-left.
   if (y < GRID_LENGTH - 1                      ) {sum += Number(terrainGrid[x    ][y + 1]); ++n;} // bottom-middle.
   if (y < GRID_LENGTH - 1 && x < GRID_WIDTH - 1) {sum += Number(terrainGrid[x + 1][y + 1]); ++n;} // bottom-right.

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

   if (y < GRID_LENGTH - 1 && x > 0             ) {let h = Number(terrainGrid[x - 1][y + 1]); if (h > highestH) {highestH = h;}} // bottom-left.
   if (y < GRID_LENGTH - 1                      ) {let h = Number(terrainGrid[x    ][y + 1]); if (h > highestH) {highestH = h;}} // bottom-middle.
   if (y < GRID_LENGTH - 1 && x < GRID_WIDTH - 1) {let h = Number(terrainGrid[x + 1][y + 1]); if (h > highestH) {highestH = h;}} // bottom-right.

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

   if (y < GRID_LENGTH - 1 && x > 0             ) {if (terrainGrid[x - 1][y + 1] !== null) {return true;}} // bottom-left.
   if (y < GRID_LENGTH - 1                      ) {if (terrainGrid[x    ][y + 1] !== null) {return true;}} // bottom-middle.
   if (y < GRID_LENGTH - 1 && x < GRID_WIDTH - 1) {if (terrainGrid[x + 1][y + 1] !== null) {return true;}} // bottom-right.

   return false;
}

function copyArray(terrainGrid)
{
   let newTerrainGrid = [];

   for (let x = 0; x < GRID_WIDTH; ++x)
   {
      newTerrainGrid[x] = [];

      for (let y = 0; y < GRID_LENGTH; ++y)
      {
         newTerrainGrid[x][y] = terrainGrid[x][y];
      }
   }

   return newTerrainGrid;
}
