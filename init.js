// this is for the canvas for future TDA implementation
var charX = 16;
var charY = 24;
var viewX, viewY;
var canvas;
var fore, back;
function setupCanvas() {
  viewX = document.getElementById("canvas").width / charX; // number of tiles X
  viewY = document.getElementById("canvas").height / charY; // and Y
  canvas = document.getElementById("canvas").getContext('2d'); // setup context
  canvas.font = "24px Courier New";
  canvas.textAlign = "center";
  canvas.textBaseline = "middle";
  canvas.fillStyle = "white";
  fore = colors[15];
  back = colors[0];
}

function init() {
  // make buttons work
  document.getElementById("write").addEventListener('click', function() {writeCanvas(input.value);}, false);
  document.getElementById("parse").addEventListener('click', function() {parse(input.value);}, false);
  document.getElementById("assemble").addEventListener('click', function() {assemble(input.value);}, false);
  document.getElementById("undo").addEventListener('click', undo, false);
  document.getElementById("reset").addEventListener('click', boot, false);
  document.getElementById("run").addEventListener('click', function() {if (!VM.running) VM.run(); else VM.pause();}, false);
  document.getElementById("step").addEventListener('click', step, false);
  document.getElementById("memoryTop").addEventListener("click", function() {updateMemoryTable(currentPos - 4);}, false);
  document.getElementById("memoryBottom").addEventListener("click", function() {updateMemoryTable(currentPos + 4);}, false);
  document.getElementById("errorOK").addEventListener('click', clearError, false);
  document.getElementById("jump").addEventListener("click", function() {updateMemoryTable(document.getElementById("jumpValue").value);}, false);
  document.getElementById("jumpValue").value = "000000";
  document.getElementById("clear").addEventListener("click", function() {boot();}, false);

  setupCanvas();

  var defaultInput = [
//*
    "; assemble me and run!", 
    "MOV %r1, 1",
    "STORE %r3, %r2",
    "ADD %r3, %r3, 4",
    "MOV %r0, %r1",
    "MOV %r1, %r2",
    "ADD %r2, %r1, %r0",
    "IFEQ %flags, 0",
    "JMP 0x00100004"
/*///    default ^   v test code

//*/
  ].join("\n");
  document.getElementById("input").value = defaultInput;
  undoStorage = defaultInput;
  
  boot();
  updateMemoryTable();
}