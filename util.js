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
  VM.pause();
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
function numParams(opcode) {
  if (typeof opcode == "string") {
    if (opcode in opcodes) {
      opcode = opcodes[opcode];
    } else {
      return error("tried to get number of params of an unknown op: " + opcode);
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
    return error("tried to get number of params of a negative opcode: " + opcode);
  }
}
function uint(number) { // todo: check if number is a number. or maybe don't
  return (number >>> 0);
}
function reverseEndianness(dword) {
  dword = uint(dword);
  var reversed = (dword & 0xff000000) >>> 24;
  reversed |= (dword & 0xff0000) >>> 8;
  reversed |= (dword & 0xff00) << 8;
  reversed |= (dword & 0xff) << 24;
  return reversed;
}

var undoStorage = "";
function undo() {
  var temp = document.getElementById("input").value;
  document.getElementById("input").value = undoStorage;
  undoStorage = temp;
}

function flashBox(type, index) {
  var element;
  var t = (VM.running ? 100 : 1000);
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
  "sleep": 0x00,
  "ret": 0x01,
  "rfi": 0x02,
  "xchgb": 0x20,
  "xchgw": 0x21,
  "getpc": 0x22,
  "pop": 0x23,
  "push": 0x24,
  "jmp": 0x25,
  "call": 0x26,
  "rjmp": 0x27,
  "rcall": 0x28,
  "int": 0x29,
  "mov": 0x40,
  "swp": 0x41,
  "not": 0x42,
  "sigxb": 0x43,
  "sigxw": 0x44,
  "load": 0x45,
  "loadw": 0x46,
  "loadb": 0x47,
  "store": 0x48,
  "storew": 0x49,
  "storeb": 0x4a,
  "ifeq": 0x4b,
  "ifneq": 0x4c,
  "ifl": 0x4d,
  "ifsl": 0x4e,
  "ifle": 0x4f,
  "ifsle": 0x50,
  "ifbits": 0x51,
  "ifclear": 0x52,
  "and": 0x80,
  "or": 0x81,
  "xor": 0x82,
  "bitc": 0x83,
  "add": 0x84,
  "addc": 0x85,
  "sub": 0x86,
  "subb": 0x87,
  "rsb": 0x88,
  "rsbb": 0x89,
  "lls": 0x8a,
  "lrs": 0x8b,
  "ars": 0x8c,
  "rotl": 0x8d,
  "rotr": 0x8e,
  "mul": 0x8f,
  "smul": 0x90,
  "div": 0x91,
  "sdiv": 0x92
};
var alt_opcodes = { // instructions with duplicate names
  "jmp": 0x53,
  "call": 0x54,
  "load": 0x93,
  "loadw": 0x94,
  "loadb": 0x95,
  "store": 0x96,
  "storew": 0x97,
  "storeb": 0x98
};
var opcodes2 = {
  0x00: "sleep",
  0x01: "ret",
  0x02: "rfi",
  0x20: "xchgb",
  0x21: "xchgw",
  0x22: "getpc",
  0x23: "pop",
  0x24: "push",
  0x25: "jmp",
  0x26: "call",
  0x27: "rjmp",
  0x28: "rcall",
  0x29: "int",
  0x40: "mov",
  0x41: "swp",
  0x42: "not",
  0x43: "sigxb",
  0x44: "sigxw",
  0x45: "load",
  0x46: "loadw",
  0x47: "loadb",
  0x48: "store",
  0x49: "storew",
  0x4a: "storeb",
  0x4b: "ifeq",
  0x4c: "ifneq",
  0x4d: "ifl",
  0x4e: "ifsl",
  0x4f: "ifle",
  0x50: "ifsle",
  0x51: "ifbits",
  0x52: "ifclear",
  0x53: "jmp",
  0x54: "call",
  0x80: "and",
  0x81: "or",
  0x82: "xor",
  0x83: "bitc",
  0x84: "add",
  0x85: "addc",
  0x86: "sub",
  0x87: "subb",
  0x88: "rsb",
  0x89: "rsbb",
  0x8a: "lls",
  0x8b: "lrs",
  0x8c: "ars",
  0x8d: "rotl",
  0x8e: "rotr",
  0x8f: "mul",
  0x90: "smul",
  0x91: "div",
  0x92: "sdiv",
  0x93: "load",
  0x94: "loadw",
  0x95: "loadb",
  0x96: "store",
  0x97: "storew",
  0x98: "storeb",
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
var flagNames = {
  "cf": 0, // carry flag
  "of": 1, // overflow flag
  "de": 2, // division error
  "if": 3, // interrupt flag
  "ei": 8, // enable interrupts
  "es": 9 // single-step-mode
}