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
  document.getElementById("run").addEventListener('click', run, false);
  document.getElementById("pause").addEventListener('click', pause, false);
  document.getElementById("step").addEventListener('click', step, false);
  document.getElementById("memoryTop").addEventListener("click", function() {updateMemoryTable(currentPos - 4);}, false);
  document.getElementById("memoryBottom").addEventListener("click", function() {updateMemoryTable(currentPos + 4);}, false);
  document.getElementById("errorOK").addEventListener('click', clearError, false);
  document.getElementById("jump").addEventListener("click", function() {updateMemoryTable(document.getElementById("jumpValue").value);}, false);
  document.getElementById("jumpValue").value = "000000";

  setupCanvas();

  var defaultInput = [
    "MOV 0x1, %r10 ; assemble me and run!",
    "STORE 0x0, %r10",
    "STORE 0x4, %r10",
    "MOV 0x4, %r1",
    "MOV 0x8, %r2",
    "label:",
    "LOAD %r0 %r8 ; commas are optional",
    "LOAD %r1 %r9",
    "ADD %r8 %r9 %r10",
    "STORE %r2 %r10",
    "; unsigned dwords can't contain the 47th fibbonacci",
    "IFEQ 0xb8 %r2",
    "  JMP end",
    "ADD 0x4 %r0 %r0",
    "ADD 0x4 %r1 %r1",
    "ADD 0x4 %r2 %r2",
    "JMP label",
    "end:"
  ].join("\n");

  document.getElementById("input").value = defaultInput;
  undoStorage = defaultInput;
  
  boot();
  updateMemoryTable();
}