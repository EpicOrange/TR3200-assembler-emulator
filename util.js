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
