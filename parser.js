function parseAsHex(input, code) {
  input = input.replace("0x", ""); // also remove all the 0x from 0xffffffff
  if (!input.match(/^[\s0-9a-f]+$/gi)) // make sure only hex
    return error("input is not in hexadecimal");
  input = input.trim().replace(/\s+/, " ") + " "; // replace all whitespace with one space
  undoStorage = input; // store in undo
  if ( !(input.match(/^([0-9a-fA-F]{8} )+$/)) // bytes
      && !(input.match(/^([0-9a-fA-F]{32} )+$/)) ) { // dwords
    return error("input is not in one of the following formats:\n\
        ff ff ff ff (bytes)\n\
        ffffffff ffffffff (dwords)"); // reason is to catch mistakes e.g. ffff ffff fff ffff
  }
  input = input.replace(/\s+/g, ""); // remove whitespace
  var str = input.trim().match(/.{8}/g); // group as dword strings (also cuts off any remainder)

  for (var i = 0; i < str.length; i++) {
    code[i] = parseInt(str[i], 16);
  }
}

function parseAsBin(input, code, bigendian) {
  if (!input.match(/^[\s01]+$/g)) // make sure input is only binary
    return error("input is not in binary");
  input = input.trim().replace(/\s+/, " ") + " "; // replace all whitespace with one space
  undoStorage = input; // store in undo
  if ( !(input.match(/^([01]{4} )+$/)) // nibbles
      && !(input.match(/^([01]{8} )+$/)) // bytes
      && !(input.match(/^([01]{32} )+$/)) ) { // dwords
    return error("input is not in one of the following formats:\n\
        0000 0000 0000 0000 0000 0000 0000 0000 (nibbles)\n\
        000000000 00000000 00000000 00000000 (bytes)\n\
        000000000000000000000000000000000 (dwords)"); // reason is to catch mistakes e.g. 0000 0000 000 0000
  }
  input = input.replace(/\s+/g, ""); // remove whitespace
  var str = input.trim().match(/.{32}/g); // group as dword strings (also cuts off any remainder)
  if (bigendian) { // have to convert to little-endian
    str.forEach(function(val, i, array) {
      var littleendian = "";
      littleendian += val.substr(24, 8);
      littleendian += val.substr(16, 8);
      littleendian += val.substr(8, 8);
      littleendian += val.substr(0, 8);
      array[i] = littleendian;
    });
  }

  for (var i = 0; i < str.length; i++) {
    code[i] = parseInt(str[i], 16);
  }
}

function parse(input) {
  if (input.match(/^\s*$/g)) return; // return if input is just whitespace
  var instructions = [];
  if (document.getElementById("format").selectedIndex == 0) {
    parseAsHex(input, instructions);
  } else {
    parseAsBin(input, instructions, document.getElementById("format").selectedIndex == 2);
  }

  // load assembled code into the rom memory
  if (instructions.length > 0x7fff)
    return error("too many instructions(" + instructions.length + ", cannot fit into rom chip of 32 kib");
  for (var i = 0; i < instructions.length; i++) {
    setMemory(0x100000 + i*4, instructions[i], true, true);
  }
  // put a sleep instruction in case the rom already had stuff in it
  setMemory(0x100000 + instructions.length*4, 0x00000000, true, true);
  
  // now to start the vm
  run();
}
