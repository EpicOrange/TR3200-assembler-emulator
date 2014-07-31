// this file just contains utility functions like error and rand
function rand(max) {
  return Math.floor(Math.random() * max);
}
function padZero(txt, num) {
  var pad = "";
  for (var i = 0; i < num - txt.length; i++)
    pad += "0";
  return pad + txt;
}
function error(note) {
  console.log("ERROR: " + note);
  document.getElementById("errorDisplay").innerHTML = note;
  document.getElementById("errorDisplay").style.display = "inline-block";
  document.getElementById("errorOK").style.display = "inline-block";
  return "error";
}
function clearError() {
  document.getElementById("errorDisplay").style.display = "none";
  document.getElementById("errorOK").style.display = "none";
}
function warning(note) {
  console.log("WARNING: " + note);
}
function hexToStr(hex, digits) {
  if (hex < 0)
    // magic trick http://www.gibdon.com/2006/12/javascript-fixing-negative-hexadecimal.html
    hex += 0xffffffff + 1;
  return "0x" + padZero(hex.toString(16), digits || 8);
}
function numArgs(opcode) {
  if (typeof opcode == "string") {
    if (opcode in opcodes) {
      opcode = opcodes[opcode];
    } else {
      return error("tried to get number of args of an unknown op: " + opcode);
    }
  }
  if (opcode >= 0x80) {
    return 3;
  } else if (opcode >= 0x40) {
    return 2;
  } else if (opcode >= 0x20) {
    return 1;
  } else if (opcode >= 0x00) {
    return 0;
  } else {
    return error("tried to get number of args of a negative opcode: " + opcode);
  }
}

var undoStorage = "";
function undo() {
  var temp = document.getElementById("input").value;
  document.getElementById("input").value = undoStorage;
  undoStorage = temp;
}

function flashBox(type, index) {
  if (booting) return;
  var element;
  var t = (running ? 100 : 1000);
  switch (type) {
  case "register":
    if (typeof index == "number")
      index = regNames2[index];
    element = document.getElementById(index);
    break;
  case "memory":
    element = document.getElementById("memory-value-" + index);
    break;
  }
  if (element != null) {
    element.className = "set";
    setTimeout(function() { // meh
      element.className = "";
    }, t);
  }
}

var opcodes = {
  "SLEEP": 0x00,
  "RET": 0x01,
  "RFI": 0x02,
  "XCHGB": 0x20,
  "XCHGW": 0x21,
  "GETPC": 0x22,
  "POP": 0x23,
  "PUSH": 0x24,
  "JMP": 0x25,
  "CALL": 0x26,
  "RJMP": 0x27,
  "RCALL": 0x28,
  "INT": 0x29,
  "MOV": 0x40,
  "SWP": 0x41,
  "NOT": 0x42,
  "SIGXB": 0x43,
  "SIGXW": 0x44,
  "LOAD": 0x45,
  "LOADW": 0x46,
  "LOADB": 0x47,
  "STORE": 0x48,
  "STOREW": 0x49,
  "STOREB": 0x4A,
  "IFEQ": 0x4B,
  "IFNEQ": 0x4C,
  "IFL": 0x4D,
  "IFSL": 0x4E,
  "IFLE": 0x4F,
  "IFSLE": 0x50,
  "IFBITS": 0x51,
  "IFCLEAR": 0x52,
  "AND": 0x80,
  "OR": 0x81,
  "XOR": 0x82,
  "BITC": 0x83,
  "ADD": 0x84,
  "ADDC": 0x85,
  "SUB": 0x86,
  "SUBB": 0x87,
  "RSB": 0x88,
  "RSBB": 0x89,
  "LLS": 0x8A,
  "LRS": 0x8B,
  "ARS": 0x8C,
  "ROTL": 0x8D,
  "ROTR": 0x8E,
  "MUL": 0x8F,
  "SMUL": 0x90,
  "DIV": 0x91,
  "SDIV": 0x92
};
var d_opcodes = { // instructions with duplicate names
  "JMP": 0x53,
  "CALL": 0x54,
  "LOAD": 0x93,
  "LOADW": 0x94,
  "LOADB": 0x95,
  "STORE": 0x96,
  "STOREW": 0x97,
  "STOREB": 0x98
};var opcodes2 = {
  0x00: "SLEEP",
  0x01: "RET",
  0x02: "RFI",
  0x20: "XCHGB",
  0x21: "XCHGW",
  0x22: "GETPC",
  0x23: "POP",
  0x24: "PUSH",
  0x25: "JMP",
  0x26: "CALL",
  0x27: "RJMP",
  0x28: "RCALL",
  0x29: "INT",
  0x40: "MOV",
  0x41: "SWP",
  0x42: "NOT",
  0x43: "SIGXB",
  0x44: "SIGXW",
  0x45: "LOAD",
  0x46: "LOADW",
  0x47: "LOADB",
  0x48: "STORE",
  0x49: "STOREW",
  0x4A: "STOREB",
  0x4B: "IFEQ",
  0x4C: "IFNEQ",
  0x4D: "IFL",
  0x4E: "IFSL",
  0x4F: "IFLE",
  0x50: "IFSLE",
  0x51: "IFBITS",
  0x52: "IFCLEAR",
  0x53: "JMP",
  0x54: "CALL",
  0x80: "AND",
  0x81: "OR",
  0x82: "XOR",
  0x83: "BITC",
  0x84: "ADD",
  0x85: "ADDC",
  0x86: "SUB",
  0x87: "SUBB",
  0x88: "RSB",
  0x89: "RSBB",
  0x8A: "LLS",
  0x8B: "LRS",
  0x8C: "ARS",
  0x8D: "ROTL",
  0x8E: "ROTR",
  0x8F: "MUL",
  0x90: "SMUL",
  0x91: "DIV",
  0x92: "SDIV",
  0x93: "LOAD",
  0x94: "LOADW",
  0x95: "LOADB",
  0x96: "STORE",
  0x97: "STOREW",
  0x98: "STOREB",
};
var regNames = {
  "%r0": 0,
  "%r1": 1,
  "%r2": 2,
  "%r3": 3,
  "%r4": 4,
  "%r5": 5,
  "%r6": 6,
  "%r7": 7,
  "%r8": 8,
  "%r9": 9,
  "%r10": 10,
  "%y": 11,
  "%r11": 11,
  "%bp": 12,
  "%r12": 12,
  "%sp": 13,
  "%r13": 13,
  "%ia": 14,
  "%r14": 14,
  "%flags": 15,
  "%r15": 15
};
var regNames2 = {
  0: "%r0",
  1: "%r1",
  2: "%r2",
  3: "%r3",
  4: "%r4",
  5: "%r5",
  6: "%r6",
  7: "%r7",
  8: "%r8",
  9: "%r9",
  10: "%r10",
  11: "%y",
  12: "%bp",
  13: "%sp",
  14: "%ia",
  15: "%flags"
};