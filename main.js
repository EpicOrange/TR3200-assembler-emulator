// drawing functions for future TDA implementation
function drawChar(char, x, y, fColor, bColor) {
  if (typeof char != "string") return; // validate things
  if (x < 0 || y < 0 || x >= viewX || y >= viewY) return;

  if (fColor) // change colors if necessary
    fore = colors[fColor];
  if (bColor)
    back = colors[bColor];

  canvas.fillStyle = back; // background
  canvas.fillRect(x*charX, y*charY, charX, charY);

  canvas.fillStyle = fore; // foreground
  canvas.fillText(char[0], (x*charX) + (charX/2), (y*charY) + (charY/2));
}
function writeCanvas(input) {
  input = input.split("\n");
  for (var i = 0; i < viewY && i < input.length; i++) {
    for (var j = 0; j < viewX && j < input[i].length; j++) {
      drawChar(input[i][j], j, i);
    }
  }
}

var undoStorage = "";
function undo() {
  var temp = document.getElementById("input").value;
  document.getElementById("input").value = undoStorage;
  undoStorage = temp;
}


