var charX = 16;
var charY = 24;
var viewX, viewY;
var canvas;
var fore, back;

function init() {
  viewX = document.getElementById("canvas").width / charX; // number of tiles X
  viewY = document.getElementById("canvas").height / charY; // and Y
  canvas = document.getElementById("canvas").getContext('2d'); // setup context
  canvas.font = "24px Courier New";
  canvas.textAlign = "center";
  canvas.textBaseline = "middle";
  canvas.fillStyle = "white";
  fore = colors[15];
  back = colors[0];
  input.value = "0x20148084";
  //input.value = "ADD 0x14 %r11 %r0";
  //input.value = "1111 1111 0000 0000 0000 0000 0000 0000";
  boot();
}
