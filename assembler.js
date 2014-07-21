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
  "JMP": 0x53,
  "CALL": 0x54,
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
  "SDIV": 0x92,
  "LOAD": 0x93,
  "LOADW": 0x94,
  "LOADB": 0x95,
  "STORE": 0x96,
  "STOREW": 0x97,
  "STOREB": 0x98
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

function assemble(input) { // also TODO: handle NOP, SLEEP, and RFI as instructions by themselves
  undoStorage = input; // store in undo
  var lines = input.trim().split("\n");
  var instructions = [];
  for (var i = 0; i < lines.length; i++) {
    lines[i] = lines[i].replace(/;.+$/, "").trim(); // get rid of comments
    var args = lines[i].replace(/[\s,]+/g, ",").split(",");
    var op = args[0].toUpperCase();
    if (!(op in opcodes)) 
      return error("Unrecognized operation " + op + " on line " + i);
    var instruction = opcodes[op];
    var value = 0;
    if (numArgs(instruction) != (args.length - 1)) {
      return error( op + " (opcode: " + opcodes[op] + ") on line " + i + " requires " + 
          numArgs(instruction) + " arguments. (given: " + (args.length - 1) + ")" );
    }
    for (var j = 1; j < args.length; j++) {
      if (args[j] in regNames) { // do nothing
      } else if (j == 1) {
        args[j] = parseInt(args[j]) >>> 0; // turn into a unsigned 32-bit int
        if (typeof args[j] != "number") {
          return error("Argument 1 on line " + i + " is not a register name or a 32-bit signed integer!");
        }
        value = (args[1] >> 31) ? ~args[1] + 1 : args[1]; // two's complement to number
      } else {
        return error("Argument " + j + " on line " + i + " is not a register name!");
      }
    }
    switch (args.length - 1) {
    case 3:
      instruction = instruction | (regNames[args[2]] << 7*4); // rs: 0x *0 00 00 00
      instruction = instruction | (regNames[args[3]] << 6*4); // rd: 0x 0* 00 00 00
      if (typeof args[1] == "number") { // if rn is a number value
        if (Math.abs(value) >= 0x4000) {
          // todo add some checking for if the value is greater than 0xffffffff
          instruction = instruction | 0x0000C000;
          instructions.push(instruction);
          instructions.push(args[1]);
        } else {
          instruction = instruction | (args[1] & 0x00ff) << 4*4;  // 0x 00 ** 00 00
          instruction = instruction | (args[1] & 0xff00) << 0*4;  // 0x 00 00 ** 00
          instruction = instruction | 0x00008000;                 // set M bit
          instructions.push(instruction);
        }
      } else {
        instruction = instruction | (regNames[args[1]] << 4*4); // rn: 0x 00 0* 00 00
        instructions.push(instruction);
      }
      break;
    case 2:
      instruction = instruction | (regNames[args[2]] << 6*4); // rd: 0x 0* 00 00 00
      if (typeof args[1] == "number") { // if rn is a number value
        if (Math.abs(value) >= 0x40000) {
          instruction = instruction | 0x0000C000;
          instructions.push(instruction);
          instructions.push(args[1]);
        } else {
          instruction = instruction | (args[1] & 0x00000f) << 7*4;  // 0x *0 00 00 00
          instruction = instruction | (args[1] & 0x000ff0) << 3*4;  // 0x 00 ** 00 00
          instruction = instruction | (args[1] & 0x0ff000) >> 1*4;  // 0x 00 00 ** 00
          instruction = instruction | 0x00008000;                   // set M bit
          instructions.push(instruction);
        }
      } else {
        instruction = instruction | (regNames[args[1]] << 7*4); // rn: 0x *0 00 00 00
        instructions.push(instruction);
      }
      break;
    case 1:
      if (typeof args[1] == "number") { // if rn is a number value
        if (Math.abs(value) >= 0x400000) {
          instruction = instruction | 0x0000C000;
          instructions.push(instruction);
          instructions.push(args[1]);
        } else {
          instruction = instruction | (args[1] & 0x0000ff) << 6*4;  // 0x ** 00 00 00
          instruction = instruction | (args[1] & 0x00ff00) << 2*4;  // 0x 00 ** 00 00
          instruction = instruction | (args[1] & 0xff0000) >> 2*4;  // 0x 00 00 ** 00
          instruction = instruction | 0x00008000;                   // set M bit
          instructions.push(instruction);
        }
      } else {
        instruction = instruction | (regNames[args[1]] << 6*4); // rn: 0x 0* 00 00 00
        instructions.push(instruction);
      }
      break;
    case 0:
      instructions.push(instruction);
      break;
    default:
      return error("Too many arguments on line " + i);
    }
  }
  // print all instructions to console. may change later for copy paste powers
  for (var i = 0; i < instructions.length; i++) {
    console.log((i*4) + ": " + hexToStr(instructions[i]));
  }

  // load assembled code into the rom memory
  if (instructions.length > 0x7fff)
    return error("too many instructions(" + instructions.length + ", cannot fit into rom chip of 32 kib");
  for (var i = 0; i < instructions.length; i++) {
    setMemory(0x100000 + i*4, instructions[i], true, true);
  }
  // put a sleep instruction in case the rom already had stuff in it
  setMemory(0x100000 + instructions.length*4, 0x00000000, true, true);
}