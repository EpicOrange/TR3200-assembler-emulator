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

var colors = [
  "#000000", // Black
  "#EFDCB2", // Light Blue
  "#F2A231", // Mid Blue
  "#FF0000", // Blue
  "#32261B", // Dark Blue
  "#27CEA3", // Light Green
  "#1A8944", // Green
  "#4E482F", // Swamp Green
  "#6BE2F7", // Yellow
  "#3189EB", // Copper
  "#2264A4", // Brown
  "#2B3C49", // Dark Brown
  "#8B6FE0", // Pink
  "#3326BE", // Red
  "#9D9D9D", // Gray
  "#FFFFFF" // White
  ];

