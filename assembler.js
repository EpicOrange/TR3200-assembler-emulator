var labelRegex = /^[a-zA-Z]+:$/;
function assemble(input) {
  var lines = input.trim().split("\n");
  var currentAddress = 0x100000;
  var argTable = [];
  var instructions = [];
  var labels = {};
  // parse all lines and store args as arrays in argTable[]
  for (var i = 0; i < lines.length; i++) {
    lines[i] = lines[i].replace(/;.+$/, "").trim(); // get rid of comments and extra whitespace
    if (lines[i] == "") // line is empty
      continue;
    else if (lines[i].match(labelRegex)) { // line is a label
      var name = lines[i].match(/^[a-zA-Z]+/);
      if (name in labels) 
        return error("Duplicate label \"" + name + "\" on line " + (i+1));
      labels[name] = currentAddress;
      continue;
    } else { // line is an instruction
      var args = lines[i].replace(/[\s,]+/g, ",").split(","); // array of args, including the op
      var op = args[0].toUpperCase(); // op name
      if (op == "NOP") {
        argTable.push(["MOV", "%r0", "%r0"]); // hard code NOP as MOV %r0 %r0
        continue;
      } else if (!(op in opcodes)) 
        return error("Unrecognized operation " + op + " on line " + (i+1));
      var instruction = opcodes[op];
      var arg_length = numArgs(instruction); // the number of args the instruction is supposed to have
      if (arg_length != (args.length - 1)) {
        // this next line means 'if the instruction has another opcode in opcodes[2], and has the right # of args for that'
        if ( !((op in d_opcodes) && (args.length - 1 == numArgs(d_opcodes[op]))) )
          return error( op + " (opcode: " + hexToStr(opcodes[op], 2) + ") on line " + (i+1) + " requires " + 
              arg_length + " argument" + (arg_length == 1 ? "" : "s")+ ". (given: " + (args.length - 1) + ")" );
      }

      // modify args: "0x10" => 16
      var next_dword = false;
      for (var j = 1; j <= arg_length; j++) {
        // there's a better way to structure this, but this is more readable. i think.
        // actually i'm just too lazy to structure this right
        if (args[j] in regNames) { // do nothing; args[j] is a register name which is valid
        } else if (j == 1 && args[1].match(/^[a-zA-Z]+$/)) { // also do nothing; args[1] is a label
        } else if (j == 1) {
          if (typeof parseInt(args[1]) == "number") { // args[1] is an immediate value
            args[1] = parseInt(args[1]) >>> 0; // turn into a unsigned 32-bit int

            // this part of the code just checks if the value should be put in the next dword
            if (args[1] > 0xffffffff)
              return error("Argument 1 on line " + (i+1) + " cannot fit into a dword (value: " + hexToStr(args[1], 1) + ")");
            var absvalue = (args[1] >> 31) ? ~args[1] + 1 : args[1]; // absolute value of dword
            var limit;
            if (arg_length == 3) limit = 0x4000;
            else if (arg_length == 2) limit = 0x40000;
            else if (arg_length == 1) limit = 0x400000;
            if (absvalue >= limit) {
              currentAddress += 4;
              next_dword = true;
            }
          } else
            return error("Argument 1 on line " + (i+1) + " is not a register name, label, or 32-bit signed integer!");
        } else {
          return error("Argument " + j + " on line " + (i+1) + " is not a register name!");
        }
      }
      args[4] = arg_length;
      args[5] = next_dword;
      argTable.push(args);
      currentAddress += 4;
    }
  }

  // now go through argTable[] and turn them into dwords to store in instructions[]
  for (var i = 0; i < argTable.length; i++) { // i is line value. should probably do a foreach loop though
    var args = argTable[i]; // [opcode, rn, rd/rs, rd, # args, push value as dword]
    var instruction = opcodes[args[0].toUpperCase()];

     // reason we check later for labels: when reading instructions, it's possible the labels aren't parsed yet
    if (args.length != 0 && args[1] in labels)
      args[1] = labels[args[1]];

    switch (args[4]) {
    case 3:
      instruction = instruction | (regNames[args[2]] << 7*4); // rs: 0x *0 00 00 00
      instruction = instruction | (regNames[args[3]] << 6*4); // rd: 0x 0* 00 00 00
      if (typeof args[1] == "number") { // if rn is a number value
        if (args[5]) {
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
        if (args[5]) {
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
        if (args[5]) {
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
      return error("Too many arguments on line " + (i+1)); // should never happen.
    }
  }
  undoStorage = input; // no errors, store in undo

  // print all instructions to console. may change later for copy paste powers
  for (var i = 0; i < instructions.length; i++) {
    console.log(hexToStr(0x100000 + i*4, 6) + ": " + hexToStr(instructions[i]));
  }
  
  // clear memory
  memory = Array(mem_size_);

  // load assembled code into the rom memory
  if (instructions.length > 0x7fff)
    return error("too many instructions(" + instructions.length + ", cannot fit into rom chip of 32 kib");
  for (var i = 0; i < instructions.length; i++) {
    setMemory(0x100000 + i*4, instructions[i], true);
  }
  // put a sleep instruction in case the rom already had stuff in it
  setMemory(0x100000 + instructions.length*4, 0x00000000, true);

  // clear error without user having to press OK
  clearError();

  // restart the VM
  boot();
}