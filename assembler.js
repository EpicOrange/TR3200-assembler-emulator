var labelRegex = /^[a-zA-Z]+:$/;

/*
==================================
Syntax :

- *instr* Rd, Rs, Rn
- STORE Rs + Rn, Rd
- STORE [Rs + Rn], Rd
- LOAD Rd, Rs + Rn
- LOAD Rd, [Rs + Rn]
Examples :

- %r7 = %r6 | %r7 : OR %r7, %r6 , %r7   ->  0x81000767
- Loads dword at %r1+1024 in %r7 : LOAD %r7, %r1 + 1024 -> 0x60A80227
- %r0 = %r1 & 0xAAAA5555 : AND %r0, %r1, 0xAAAA -> 0xC0C00010, 0xAAAA5555
==================================
Syntax :

- *instr* Rd, Rn
- LOAD Rd, Rn
- STORE Rn, Rd
- JMP/CALL Rd + Rn
Examples :

- Set %r10 = %sp : MOV %r10, %sp -> 0x400000DA
- Jumps to %r1 + 0x300 : JMP %r1 + 0x300 -> 0x59800C01
- Writes LSB byte in %r10 to 0xFF0B0000 : STOREB 0xFF0B0000, %r10 -> 0x48C0000A, 0xFF0B0000
==================================
Syntax :

- *instr* Rn
Examples :

- INT 21h -> 0x29800021
- CALL 0xBEBECAFE -> 0x26C00000, 0xBEBECAFE
==================================
Syntax : - instr

Examples : - RET -> 0x01000000
*/


function assemble(input) {
  var lines = input.trim().replace(/;.+\n/, "\n").split("\n"); // remove comments and separate lines into an array
  var instructions = []; // bytes to store in rom
  // parse lines one by one
  for (var lineNumber = 1; lineNumber <= lines.length; lineNumber++) {
    var line = lines[lineNumber - 1].trim().toLowerCase();
    if (line == "") continue;

    var op = line.match(/^[a-z]+/);
    if (!op) {
      return error("no op found on line " + lineNumber);
    }
    op = op[0];
    if (!(op in opcodes)) {
      return error("Unrecognized op on line " + lineNumber + ": " + op.toUpperCase());
    }
    var opcode = opcodes[op];

    // parse parameters
    var parameters = numParams(op);
    var paramList = line.replace(/^[a-z]+\s+/, "").replace(/\s*/g, "").split(",");
    // spit out an error if there's the wrong number of parameters
    // TODO: this

    // now get rn, rs, and rd
    var rn, rs, rd;
    var rnLimit; // to determine if L bit should be set
    // special cases for some instructions
    if (opcode >= 0x93 && opcode <= 0x95) { // 3 parameter load: "LOAD Rd, Rs + Rn"
      var temp = paramList[1].split("+");
      if (temp.length == 2) {
        rs = temp[0].trim();
        rn = temp[1].trim();
        rd = paramList[0];
      } else {
        return error("LOAD parameter syntax error on line " + lineNumber);
      }
    } else if (opcode >= 0x96 && opcode <= 0x98) { // 3 parameter store: "STORE Rs + Rn, Rd"
      var temp = paramList[0].split("+");
      if (temp.length == 2) {
        rs = temp[0].trim();
        rn = temp[1].trim();
        rd = paramList[1];
      } else {
        return error("STORE parameter syntax error on line " + lineNumber);
      }
    } else if (opcode >= 0x48 && opcode <= 0x4a) { // 2 parameter store: "STORE Rn, Rd"
      rd = paramList[1];
      rn = paramList[0];
      rnLimit = 0x3FFFF;
    } else if (opcode == 0x53 || opcode == 0x54) { // 2 parameter jmp or call: "JMP/CALL Rd + Rn"
      var temp = paramList[0].split("+");
      if (temp.length == 2) {
        rn = temp[1].trim();
        rd = temp[0].trim();
      } else {
        return error("JMP/CALL parameter syntax error on line " + lineNumber);
      }
    } else if (parameters == 3) { // 3 parameters: *instr* Rd, Rs, Rn
      rd = paramList[0];
      rs = paramList[1];
      rn = paramList[2];
      rnLimit = 0x3FFFFF;
    } else if (parameters == 2) { // 2 parameters: *instr* Rd, Rn
      rd = paramList[0];
      rn = paramList[1];
      rnLimit = 0x3FFFF;
    } else if (parameters == 1) { // 1 parameter: *instr* Rn
      rn = paramList[0];
      rnLimit = 0x3FFF;
    }

    // turn 0x10, "%r10" into number values
    var m = false, l = false;
    switch (parameters) {
    case 3:
      if (rs in regNames) {
        rs = regNames[rs];
      } else {
        return error("Invalid value(" + rs + ") for Rs on line " + lineNumber);
      }
    case 2:
      if (rd in regNames) {
        rd = regNames[rd];
      } else {
        return error("Invalid value(" + rd + ") for Rd on line " + lineNumber);
      }
    case 1:
      if (rn in regNames) {
        rn = regNames[rn];
      } else if (isNaN(parseInt(rn))) {
        return error("Invalid value(" + rn + ") for Rn on line " + lineNumber);
      } else {
        rn = parseInt(rn);
        m = true;
        if (rn < 0) {
          return error("Negative value " + rn + " on line " + lineNumber);
        }
      }
    }

    // construct dword
    // 3 param: 0b oooo oooo mldd ddss ssnn nnnn nnnn nnnn
    //         (0b nnnn nnnn ssnn nnnn mldd ddss oooo oooo)
    // 2 param: 0b oooo oooo mldd ddnn nnnn nnnn nnnn nnnn
    //         (0b nnnn nnnn nnnn nnnn mldd ddnn oooo oooo)
    // 1 param: 0b oooo oooo mlnn nnnn nnnn nnnn nnnn nnnn
    //         (0b nnnn nnnn nnnn nnnn mlnn nnnn oooo oooo)
    // 0 param: 0b oooo oooo 00xx xxxx xxxx xxxx xxxx xxxx
    //         (0b xxxx xxxx xxxx xxxx 00xx xxxx oooo oooo)

    var instruction; // the dword, big endian
    instruction = opcode << 24; // opcode: 0x ff 00 00 00
    switch (parameters) {
    case 3:
      instruction |= (rs << 14); // rs: 0x 00 03 c0 00 
    case 2:
      instruction |= (rd << 18); // rd: 0x 03 c0 00 00 
    case 1:
      if (rn < rnLimit) {
        instruction |= rn; // rn: depends on # of params
      } else if (rn < 0xffffffff) {
        l = true;
      } else {
        return error("Value > 0xffffffff " + rn + " on line " + lineNumber);
      }
    default:
      instruction |= (m << 23); // m bit: 0x 00 80 00 00
      instruction |= (l << 22); // l bit: 0x 00 40 00 00
    }

    // finally, push the values into the array
    instructions.push(reverseEndianness(instruction));
    if (l) {
      instructions.push(reverseEndianness(rn));
    }
  }

  // instructions should now contain all the bytes to be stored

  // print out all instructions for debugging purposes.
  for (var i = 0; i < instructions.length; i++) {
    console.log(hexToStr(0x100000 + i*4, 6) + ": " + hexToStr(instructions[i]));
  }
  
  boot(); // reset PC and other things

  // load assembled code into the rom
  if (instructions.length > 0x7fff) {
    return error("only 32 KiB space, this requires " + instructions.length + " bytes");
  }
  for (var i = 0; i < instructions.length; i++) {
    VM.memory[0x100000 + i*4] = instructions[i];
  }
  // put a sleep instruction at the end
  VM.memory[0x100000 + instructions.length*4] = 0x00000000;

  undoStorage = input; // no errors found in assembling, store input in undo
  clearError(); // clear error without user having to press OK
}
