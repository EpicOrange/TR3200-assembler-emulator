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
  document.getElementById("run").addEventListener('click', toggle, false);
  document.getElementById("step").addEventListener('click', step, false);
  document.getElementById("memoryTop").addEventListener("click", function() {updateMemoryTable(currentPos - 4);}, false);
  document.getElementById("memoryBottom").addEventListener("click", function() {updateMemoryTable(currentPos + 4);}, false);
  document.getElementById("errorOK").addEventListener('click', clearError, false);
  document.getElementById("jump").addEventListener("click", function() {updateMemoryTable(document.getElementById("jumpValue").value);}, false);
  document.getElementById("jumpValue").value = "000000";
  document.getElementById("clear").addEventListener("click", function() {memory = Array(mem_size_); boot();}, false);

  setupCanvas();

  var defaultInput = [
//*
    "MOV %r10, 1 ; assemble me and run!",
    "STORE %r10, 0",
    "STORE %r10, 4",
    "MOV %r1, 4",
    "MOV %r2, 8",
    "label:",
    "LOAD %r8 %r0 ; commas are optional",
    "LOAD %r9 %r1",
    "ADD %r10 %r9 %r8",
    "IFEQ %flags 3",
    "  JMP end",
    "STORE %r10 %r2",
    "ADD %r0 %r0 4",
    "ADD %r1 %r1 4",
    "ADD %r2 %r2 4",
    "JMP label",
    "end:"
/*/// test code

    "MOV %r4 21",
    "MOV %r5 5",
    "SDIV %r10 %r4 %r5 ; 21 / 5 = 4 + 1",
    "MOV %r4 21",
    "MOV %r5 -5",
    "SDIV %r10 %r4 %r5 ; 21 / -5 = -4 + 1",
    "MOV %r4 -21",
    "MOV %r5 5",
    "SDIV %r10 %r4 %r5 ; -21 / 5 = -4 + -1",
    "MOV %r4 -21",
    "MOV %r5 -5",
    "SDIV %r10 %r4 %r5 ; -21 / -5 = 4 + -1",

//*/
  ].join("\n");
  document.getElementById("input").value = defaultInput;
  undoStorage = defaultInput;
  
  boot();
  updateMemoryTable();
}