// this is for the canvas for future TDA implementation
var charX = 16;
var charY = 24;
var viewX, viewY;
var canvas;
var fore, back;

function init() {
  // make buttons work
  document.getElementById("write").addEventListener('click', function() {writeCanvas(input.value);}, false);
  document.getElementById("parse").addEventListener('click', function() {parse(input.value);}, false);
  document.getElementById("assemble").addEventListener('click', function() {assemble(input.value);}, false);
  document.getElementById("undo").addEventListener('click', undo, false);
  document.getElementById("reset").addEventListener('click', boot, false);
  document.getElementById("run").addEventListener('click', run, false);
  document.getElementById("step").addEventListener('click', step, false);
  document.getElementById("memoryTop").addEventListener("click", function() {updateMemoryTable(currentPos - 4);}, false);
  document.getElementById("memoryBottom").addEventListener("click", function() {updateMemoryTable(currentPos + 4);}, false);
  document.getElementById("jump").addEventListener("click", function() {updateMemoryTable(document.getElementById("jumpValue").value);}, false);

  // setup canvas
  viewX = document.getElementById("canvas").width / charX; // number of tiles X
  viewY = document.getElementById("canvas").height / charY; // and Y
  canvas = document.getElementById("canvas").getContext('2d'); // setup context
  canvas.font = "24px Courier New";
  canvas.textAlign = "center";
  canvas.textBaseline = "middle";
  canvas.fillStyle = "white";
  fore = colors[15];
  back = colors[0];

  document.getElementById("jumpValue").value = "000000";

  var defaultInput = "MOV 0x3200 %r0\nMOV %r0 %r1 ; assemble me and run!";
  document.getElementById("input").value = defaultInput;
  undoStorage = defaultInput;
  boot();
  updateMemoryTable();
}
