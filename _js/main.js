/*
 * vim: ts=3 sw=3 et wrap co=150 go-=b
 */

const ctx = document.getElementById('canvas').getContext('2d');

ctx.canvas.width  = 1055;
ctx.canvas.height = 1055;

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

Promise.all
(
   [
      loadImage('_images/water_32x32.png'),
      loadImage('_images/land_32x32.png' )
   ]
)
.then
(
   (images) => {main(images);}
)
.catch((e) => console.info(e));

/*
 * Main function.
 */
function main(images)
{
   let grid = [];

   for (let i = 0; i < 32; ++i)
   {
      grid[i] = [];

      for (let j = 0; j < 32; ++j)
      {
         grid[i][j] = i * j;
      }
   }

   for (let i = 0; i < 32; ++i)
   {
      for (let j = 0; j < 32; ++j)
      {
         ctx.drawImage(images[((grid[i][j] > 15)? 0: 1)], i * 33, j * 33);
      }
   }
}
