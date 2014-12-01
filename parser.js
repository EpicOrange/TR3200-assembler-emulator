function parse(input) {
  var instructions = [];
  var bigEndian = document.getElementById("endianness").selectedIndex == 1;
  if (document.getElementById("format").selectedIndex == 0) { // hex
    var str = input.replace(/\s+|0x/gi, ""); // remove all whitespace and '0x'
    if (!str.match(/^[0-9a-f]+$/gi)) { // check if it's only hex digits now
      return error("input is not in hexadecimal");
    }
    var dwords = str.match(/.{8}/g); // group as dword strings (also cuts off any remainder)

    for (var i = 0; i < dwords.length; i++) {
      var num = parseInt(dwords[i], 16);
      if (bigEndian) { // need to make it little-endian
        num = reverseEndianness(num);
      }
      instructions[i] = num;
    }
  } else { // bin
    var str = input.replace(/\s+|0b/gi, ""); // remove all whitespace and '0b'
    if (!str.match(/^[01]+$/gi)) { // check if it's only binary now
      return error("input is not in binary");
    }
    var dwords = str.match(/.{32}/g); // group as dword strings (also cuts off any remainder)

    for (var i = 0; i < dwords.length; i++) {
      var num = parseInt(dwords[i], 2);
      if (bigEndian) { // need to make it little-endian
        num = reverseEndianness(num);
      }
      instructions[i] = num;
    }
  }
  loadRom(instructions);
}
