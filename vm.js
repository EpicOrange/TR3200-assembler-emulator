
/*
TR3200 v0.4h (TODO change)

Important addresses: // TODO: check for update
0x000000-0x01ffff: initial ram
0x000000-0x0fffff: maximum ram
0x100000-0x107fff: rom
0x110000-0x112000: devices (max 32 devices)
0x11e040:          RNG
0x11e050:          clock speed 
0x11ff00-0x11ffff: registers // FIXME that can't be right: 64 registers?

*/

/* ANOTHER TODO LIST

  setflag
  move everything into an object. getters and setters are awesome
  memory_control.js rewrite
  parser.js rewrite


  rewrite these functions:
    execute (attach cycle counts and look over each instruction to see if changed, also return error)
    last bit of step to catch execute() returning errors

  functions that should not be functions:
    sleep(), setFlag()
  variables that should not be variables:
    booting, asleep, rnValue (in execute())
*/
  // Object.defineProperties(this, { // can't do this since no way to find address
  //   "memory": {
  //      "get": function() { ... },
  //      "set": function() { ... }
  //   }
  // });


var VM = new function() {
  this.mem_size = 0x1fffff; // TODO: maybe it shouldn't be writable?
  this.cycles_used = 0; // cycles passed
  this.running = 0; // either 0 (not running) or the setInterval return value (running)
  this._memory = {};
  this.memory = new Proxy(this._memory, {
    get: function(object, address) {
      if (!Number.isInteger(parseInt(address))) { // address is not an integer
        if (address in regNames) {
          address = 0x11ff00 + (regNames[address] * 4); // change address to the register's address
        } else {
          return error("tried to get ram at invalid address \"" + hexToStr(address, 6) + "\"");
        }
      }
      address = parseInt(address);
      if (address < 0x000000 || address > this.mem_size) { // address is out of bounds
        return error("tried to get ram at out-of-bounds address " + hexToStr(address, 6));
      }
      if ((address % 4) != 0) { // address is unaligned to 4 bytes
        warning("tried to get ram at non-aligned address " + hexToStr(address, 6));
        address -= (address % 4); // realign to lower address
      }
      return uint(object[address]);
    },
    set: function(object, address, value) {
      if (!Number.isInteger(parseInt(address))) { // address is not an integer
        if (address in regNames) {
          address = 0x11ff00 + (regNames[address] * 4); // change address to the register's address
        } else {
          return error( "tried to set ram at invalid address \"" + hexToStr(address, 6)
              + "\" to " + hexToStr(value) );
        }
      }
      address = parseInt(address);
      if (address < 0x000000 || address > this.mem_size) { // address is out of bounds
        return error( "tried to set ram at out-of-bounds address " + hexToStr(address, 6)
             + " to " + hexToStr(value) );
      } else if (!Number.isInteger(value)) { // value is not an integer
        return error("tried to set ram at " + hexToStr(address, 6) + " to non-integer value \"" + value + "\"");
      } else if (value < -2147483648 || value > 0xffffffff) { // value can't fit into a dword
        return error("tried to set ram at " + hexToStr(address, 6) + " to out-of-bounds value " + hexToStr(value));
      }
      if ((address % 4) != 0) { // address is unaligned to 4 bytes
        warning("tried to set ram at non-aligned address " + hexToStr(address, 6));
        address -= (address % 4); // realign to lower address
      }
      if ( this.running // can't set rom when running (it's rom after all)
          && address >= 0x100000 && address <= 0x107fff ) {
        return error("tried to set rom at " + hexToStr(address, 6) + " to " + hexToStr(value));
      }
      // set the dword; FIXME does this cause infinite recursion?
      object[address] = value;

      // if the address is displayed in the table, update the table
      if (address >= currentPos && address < currentPos + (tableSize*4)) {
        updateMemoryTable();
        flashBox("memory", (address - currentPos) / 4);
      }
      // if the address is a register, update the table
      if (address >= 0x11ff00 && address <= 0x11ff40) {
        var registerName = regNames2[(address - 0x11ff00) / 4];
        document.getElementById(registerName).innerHTML = hexToStr(value);
        flashBox("register", registerName);
      }
    }
  });
};

function setFlag(index, value) {
  var mask = 1 << index;
  if (value) {
    VM.memory["%flags"] = VM.memory["%flags"] | mask; // set
  } else {
    VM.memory["%flags"] = VM.memory["%flags"] & ~mask; // unset
  }
}

var pc;
var booting = true;
function boot() {
  booting = true;
  if (running) {
    pause();
  }
  
  // clear memory. but the specs don't say this is supposed to be done.
  // VM.memory = {};

  // clear registers
  for (var i = 0; i < 16; i++) {
    VM.memory[0x11ff00 + (i * 4)] = 0;
  }

  // temporary
  // you could say this is the boot code
  pc = 0x100000;
  cycles_used = 0;
  VM.memory["%sp"] = 0x01fffc;

  asleep = false;
  document.getElementById("%pc").innerHTML = hexToStr(pc, 6);
  document.getElementById("currentInstruction").innerHTML = "N/A";
  document.getElementById("currentInstructionText").innerHTML = "???";
  updateMemoryTable();
  booting = false;
}

var runInterval;
var running = false;
function run() {
    runInterval = setInterval(step, 1);
    document.getElementById("run").value = "pause";
    running = true;
}
function pause() {
    clearInterval(runInterval);
    document.getElementById("run").value = "run";
    running = false;
}
function toggle() {
  if (!running) {
    run();
  } else {
    pause();
  }
}

var asleep = false; // temporary test thingy
function sleep() { // temporary test function
  if (!asleep) {
    asleep = true;
    pause();
    console.log("sleeping!");
  }
}

function execute(opcode, params, m, rn, rs, rd) {
  var rnValue; // either what value of rn is (if rn is a register) or just rn
  if (typeof rn != "undefined")
    rnValue = uint(m ? rn : VM.memory[rn]);
  var skip = false; // for conditionals
  switch (opcode) {
  case 0x00: // SLEEP
    sleep();
    break;
  case 0x01: // RET
    break;
  case 0x02: // RFI
    break;
  case 0x20: // XCHGB
    if (m)
      warning("m bit set while executing XCHGB");
    var value = VM.memory[rn];
    VM.memory[rn] = (value << 24) | (value >> 24) | (value & 0x00ffff00);
    break;
  case 0x21: // XCHGW
    if (m)
      warning("m bit set while executing XCHGW");
    var value = VM.memory[rn];
    VM.memory[rn] = (value << 16) | (value >> 16);
    break;
  case 0x22: // GETPC
    if (m)
      warning("m bit set while executing GETPC");
    VM.memory[rn] = pc + 4;
    break;
  case 0x23: // POP
    if (m)
      warning("m bit set while executing POP");
    var address = VM.memory["%sp"] + 4;
    VM.memory[rn] = VM.memory[address];
    VM.memory["%sp"] = address;
    break;
  case 0x24: // PUSH
    if (m)
      warning("m bit set while executing PUSH");
    var address = VM.memory["%sp"];
    VM.memory[address] = rn;
    VM.memory["%sp"] = address - 4;
    break;
  case 0x25: // JMP
    pc = rnValue & 0xfffffffc;
    pc -= 4; // don't advance PC
    break;
  case 0x26: // CALL
    pc = rnValue & 0xfffffffc;
    VM.memory[address] = rnValue;
    VM.memory["%sp"] = address - 4;
    pc -= 4;
    break;
  case 0x27: // RJMP
    pc += (rnValue & 0xfffffffc);
    pc -= 4;
    break;
  case 0x28: // RCALL
    pc += (rnValue & 0xfffffffc);
    VM.memory[address] = rnValue;
    VM.memory["%sp"] = address - 4;
    pc -= 4;
    break;
  case 0x29: // INT
    break;
  case 0x40: // MOV
    VM.memory[rd] = rnValue;
    break;
  case 0x41: // SWP
    if (m)
      warning("m bit set while executing SWP");
    var temp = VM.memory[rd];
    VM.memory[rd] = rn;
    VM.memory[rn] = temp;
    break;
  case 0x42: // NOT
    VM.memory[rd] = ~rnValue;
    break;
  case 0x43: // SIGXB
    VM.memory[rd] = ((rnValue >> 7) ? rnValue | 0xffffff00 : rnValue);
    break;
  case 0x44: // SIGXW
    VM.memory[rd] = ((rnValue >> 15) ? rnValue | 0xffff0000 : rnValue);
    break;
  case 0x45: // LOAD
    VM.memory[rd] = VM.memory[rnValue];
    break;
  case 0x46: // LOADW
    VM.memory[rd] = VM.memory[rnValue] & 0xffff;
    break;
  case 0x47: // LOADB
    VM.memory[rd] = VM.memory[rnValue] & 0xff;
    break;
  case 0x48: // STORE
    VM.memory[rnValue] = VM.memory[rd];
    break;
  case 0x49: // STOREW
    VM.memory[rnValue] = VM.memory[rd] & 0xffff;
    break;
  case 0x4a: // STOREB
    VM.memory[rnValue] = VM.memory[rd] & 0xff;
    break;
  case 0x4b: // IFEQ
    skip = rnValue != VM.memory[rd];
    break;
  case 0x4c: // IFNEQ
    skip = rnValue == VM.memory[rd];
    break;
  case 0x4d: // IFL
    skip = rnValue >= VM.memory[rd];
    break;
  case 0x4e: // IFSL
    skip = (rnValue >> 0) >= (VM.memory[rd] >> 0);
    break;
  case 0x4f: // IFLE
    skip = rnValue > VM.memory[rd];
    break;
  case 0x50: // IFSLE
    skip = (rnValue >> 0) > (VM.memory[rd] >> 0);
    break;
  case 0x51: // IFBITS
    skip = (rnValue & VM.memory[rd]) == 0;
    break;
  case 0x52: // IFCLEAR
    skip = (rnValue & VM.memory[rd]) != 0;
    break;
  case 0x53: // JMP
    pc = (rnValue + VM.memory[rd]) & 0xfffffffc;
    break;
  case 0x54: // CALL
    pc = (rnValue + VM.memory[rd]) & 0xfffffffc;
    VM.memory[address] = rnValue;
    VM.memory["%sp"] = address - 4;
    break;
  case 0x80: // AND
    VM.memory[rd] = VM.memory[rs] & rnValue;
    break;
  case 0x81: // OR
    VM.memory[rd] = VM.memory[rs] | rnValue;
    break;
  case 0x82: // XOR
    VM.memory[rd] = VM.memory[rs] ^ rnValue;
    break;
  case 0x83: // BITC
    VM.memory[rd] = VM.memory[rs] & ~rnValue;
    break;
  case 0x84: // ADD
  case 0x85: // ADDC
    var value = VM.memory[rs] + rnValue;
    setFlag(0, value > 0xffffffff); // carry flag
    setFlag( 1, (((value & 0x80000000) ^ (rnValue & 0x80000000)) ^ ((rnValue & 0x80000000) ^ (VM.memory[rs] & 0x80000000))) >>> 31); // overflow flag
    value &= 0xffffffff;
    if (opcode == 0x85) // ADDC
      value += VM.memory["%flags"] & 1;
    VM.memory[rd] = uint(value);
    break;
  case 0x86: // SUB
  case 0x87: // SUBB
    var c = opcode == 0x86 ? 1 : (VM.memory["%flags"] & 1);
    var value = uint(VM.memory[rs] + c + ~rnValue);
    setFlag(0, VM.memory[rs] < rnValue); // carry flag
    setFlag( 1, ((value >>> 31) ^ (rnValue >>> 31)) ^ ((rnValue >>> 31) ^ (VM.memory[rs] >>> 31)) ); // overflow flag
    VM.memory[rd] = uint(value);
    break;
  case 0x88: // RSB
  case 0x89: // RSBB
    var c = opcode == 0x88 ? 1 : (VM.memory["%flags"] & 1);
    var value = uint(rnValue + c + ~VM.memory[rs]);
    setFlag(0, rnValue < VM.memory[rs]); // carry flag
    setFlag( 1, ((value >>> 31) ^ (VM.memory[rs] >>> 31)) ^ ((VM.memory[rs] >>> 31) ^ (rnValue >>> 31)) ); // overflow flag
    VM.memory[rd] = uint(value);
    break;
  case 0x8a: // LLS
    var value = VM.memory[rs] << rnValue;
    VM.memory[rd] = uint(value);
    break;
  case 0x8b: // LRS
    var value = VM.memory[rs] >>> rnValue;
    VM.memory[rd] = value;
    break;
  case 0x8c: // ARS
    var value = VM.memory[rs] >>> rnValue;
    if (VM.memory[rs] >>> 31)
      value = value | (0xffffffff << (32 - rnValue));
    VM.memory[rd] = value;
    break;
  case 0x8d: // ROTL
    var value = VM.memory[rs] << rnValue;
    if (VM.memory[rs] >>> 31)
      value = value | 0x00000001;
    VM.memory[rd] = value;
    break;
  case 0x8e: // ROTR
    var value = VM.memory[rs] >>> rnValue;
    if (VM.memory[rs] & 1)
      value = value | 0x80000000;
    VM.memory[rd] = value;
    break;
  case 0x8f: // MUL
    var a = VM.memory[rs];
    var b = rnValue;
    var value = (a & 0xffff) * (b & 0xffff); // 1st digit
    var y = (a >>> 16) * (b >>> 16); // 2nd digit
    var temp = ((a & 0xffff) * (b >>> 16)) + ((a >>> 16) * (b & 0xffff)); // middle
    value += (temp & 0xffff) << 16;
    y += temp >>> 16;
    VM.memory["%y"] = uint(y);
    VM.memory[rd] = uint(value);
    break;
  case 0x90: // SMUL
    // booth's multiplication algorithm
    var a = VM.memory[rs]; // multiplicand
    var y = 0;
    var value = rnValue;
    var b = 0; // bit
    for (var i = 0; i < 32; i++) {
      if (!(value & 1) && (b == 1)) { // add
        y = (y + a) & 0xffffffff;
      } else if ((value & 1) && (b == 0)) { // sub
        y = (y + ~a + 1) & 0xffffffff;
      }
      // [y] >> [value] >> [b]
      var temp = y >>> 31;
      b = value & 1;
      value = (value >>> 1) | ((y & 1) << 31);
      y = (y >>> 1) | uint(temp << 31);
    }
    VM.memory["%y"] = uint(y);
    VM.memory[rd] = uint(value);
    break;
  case 0x91: // DIV
    setFlag(2, (rnValue == 0))
    if (rnValue == 0) break;
    var y = VM.memory[rs] % rnValue;
    var value = VM.memory[rs] / rnValue;
    VM.memory["%y"] = uint(y);
    VM.memory[rd] = uint(value);
    break;
  case 0x92: // SDIV
    setFlag(2, (rnValue == 0))
    if (rnValue == 0) break;
    var a = (VM.memory[rs] >>> 31) ? ~VM.memory[rs] + 1 : VM.memory[rs];
    var b = (rnValue >>> 31) ? ~rnValue + 1 : rnValue;
    var y = uint(a % b);
    var value = uint(Math.floor(a / b));
    if (VM.memory[rs] >>> 31)
      y = ~y + 1;
    if ((VM.memory[rs] >>> 31) ^ (rnValue >>> 31))
      value = ~value + 1;
    VM.memory["%y"] = uint(y);
    VM.memory[rd] = uint(value);
    break;
  case 0x93: // LOAD
    VM.memory[rd] = VM.memory[VM.memory[rs] + rnValue];
    break;
  case 0x94: // LOADW
    VM.memory[rd] = VM.memory[VM.memory[rs] + rnValue] & 0xffff;
    break;
  case 0x95: // LOADB
    VM.memory[rd] = VM.memory[VM.memory[rs] + rnValue] & 0xff;
    break;
  case 0x96: // STORE
    VM.memory[VM.memory[rs] + rnValue] = VM.memory[rd];
    break;
  case 0x97: // STOREW
    VM.memory[VM.memory[rs] + rnValue] = VM.memory[rd] & 0xffff;
    break;
  case 0x98: // STOREB
    VM.memory[VM.memory[rs] + rnValue] = VM.memory[rd] & 0xff;
    break;
  default:
    console.log("unimplemented opcode: 0x" + opcode.toString(16));
  }
  if (skip) { // skipping the next instruction
    do {
      pc += 4;
      var nextOp = VM.memory[pc] & 0xff;
    } while (nextOp >= 0x4b && nextOp <= 0x52); // keep skipping if instructions todo: why keep skipping ifs?
  }
}

function step() {
  if (asleep) // todo: this is a temporary thing
    return;
  var instruction = VM.memory[pc]; // little-endian

  // update the table
  document.getElementById("%pc").innerHTML = hexToStr(pc, 6);
  document.getElementById("currentInstruction").innerHTML = hexToStr(instruction);

  // get opcode and params
  var opcode = instruction & 0xff;
  var parameters = numParams(opcode);
  var m = (instruction & 0x00008000) != 0;
  var l = (instruction & 0x00004000) != 0;
  var rn, rs, rd;
  var rnLimit = 0x3FFFFF;

  switch (parameters) {
  case 3:
    rs = ((instruction & 0x00c00000) >> 22)
       | ((instruction & 0x00000300) >> 6);
  case 2:
    rd = (instruction & 0x00003c00) >> 10;
  case 1:
    if (m && l) {
        pc += 4;
        rn = VM.memory[pc];
    } else {
      rn = ((instruction & 0x000f0000) >>> 8)
         | ((instruction & 0xff000000) >>> 24);
    }
  }

  // display text form of this instruction on the table
  var text = "???";
  if (opcode in opcodes2) {
    text = opcodes2[opcode];
    switch (parameters) {
    case 3:
      text += " " + regNames2[rd];
      text += ", " + regNames2[rs];
      text += ", " + (m ? hexToStr(rn) : regNames2[rn]);
      break;
    case 2:
      text += " " + regNames2[rd];
      text += ", " + (m ? hexToStr(rn) : regNames2[rn]);
      break;
    case 1:
      text += " " + (m ? hexToStr(rn) : regNames2[rn]);
      break;
    }
  }
  document.getElementById("currentInstructionText").innerHTML = text;

  var isError = execute(opcode, parameters, m, rn, regNames2[rs], regNames2[rd]) != undefined;
  pc += 4;
  if (isError && running) {
    pause();
  }
}

// below are just notes n stuff
/*

Calling convention

%r0 to %r3 holds argument values passed to a subroutine. CALLER code MUST assume that these values will not be preserved.
%r0 will be used to the return value if there is any. If the return value is a 64 bit value, then %r1:%r0 will be the 64 bit return value.
Subsequent arguments are passed on the stack. Function arguments of a procedural language are pushed in reversed order that are declared.
%r4 to %r10 are used for local variables. CALLEE subroutine or function MUST preserve it.
%y, %ia and %flags special registers must be preserved.
%bp register MUST be preserved being pushed to the stack before the extra arguments by the CALLER. %bp takes the value of %sp after pushing the extra arguments.
CALLEE function/subroutine can use %bp + n to read extra arguments, and %bp - n for local variable. Where n = (number of parameter - 5) * 4.

OPCODES:
0 parameters:
SLEEP  0x00 Sleeps the CPU and waits that a Interrupt happens       +1
RET    0x01 Return from subrutine                                    4
RFI    0x02 Return from interrupt                                    6

1 parameter:
XCHGB  0x20 Exchange Bytes of the 16 LSB  (M = 0)                    3
XCHGW  0x21 Exchange Words  (M = 0)                                  3
GETPC  0x22 Return %pc value        Rn = %pc+4 (M = 0)               3
POP    0x23 Pops from the stack     %sp +=4 ; Rn = [%sp] (M = 0)     3
PUSH   0x24 Push to the stack       [%sp] = Rn ; %sp -=4 (M = 0)     3
INT    0x29 Software Interrupt                                       6

2 parameters:
MOV    0x40 Set/Move a value        Rd = Rn                          3
SWP    0x41 Swaps values            Rd = Rn; Rn = Rd (M bit = 0)     3
NOT    0x42 Does bitwise NOT        Rd = NOT Rn                      3
SIGXB  0x43 Extend Sign of Byte     Rd = Rn | 0xFFFFFF00 if Rn[7]    3
SIGXW  0x44 Extend Sign of Word     Rd = Rn | 0xFFFF0000 if Rn[15]   3
LOAD   0x45 Loads a dword           Rd = ram[Rn]                     3
LOADW  0x46 Loads a word            Rd = ram[Rn]                     3
LOADB  0x47 Loads a byte            Rd = ram[Rn]                     3
STORE  0x48 Saves a dword           ram[Rn] = Rd                     3
STOREW 0x49 Saves a word            ram[Rn] = Rd                     3
STOREB 0x4A Saves a byte            ram[Rn] = Rd                     3
IFEQ   0x4B Execute If Rd == Rn                                     +3
IFNEQ  0x4C Execute If Rd != Rn                                     +3
IFL    0x4D Execute If Rd < Rn (unsigned)                           +3
IFSL   0x4E Execute If Rd < Rn (signed)                             +3
IFLE   0x4F Execute If Rd <= Rn (unsigned)                          +3
IFSLE  0x50 Execute If Rd <= Rn (signed)                            +3
IFBITS 0x51 Execute If Rd & Rn != 0                                 +3
IFCLEAR0x52 Execute If Rd & Rn == 0                                 +3
JMP    0x53 Absolute Jump           %pc = (Rd + Rn) & 0xFFFFFFFC     3
CALL   0x54 Absolute Jump& Push %pc %pc = (Rd + Rn) & 0xFFFFFFFC     4

3 parameters:
AND    0x80 Bitwise And             Rd = Rs AND Rn                   3
OR     0x81 Bitwise Or              Rd = Rs OR Rn                    3
XOR    0x82 Bitwise XOr             Rd = Rs XOR Rn                   3
BITC   0x83 Bitclear                Rd = Rs AND NOT Rn               3
ADD    0x84 Addition                Rd = Rs + Rn                     3
ADDC   0x85 Addition with Carry     Rd = Rs + Rn + C                 3
SUB    0x86 Substraction            Rd = Rs - Rn                     3
SUBB   0x87 Subs with Burrow        Rd = Rs - (Rn + C)               3
RSB    0x88 Reverse Substract       Rd = Rn - Rs                     3
RSBB   0x89 RSB with Burrow         Rd = Rn - (Rs + C)               3
LLS    0x8A Logical Left Shift      Rd = Rs << Rn                    3
LRS    0x8B Logical Right Shift     Rd = Rs >>> Rn                   3
ARS    0x8C Arithmetic Right Shift  Rd = Rs >>> Rn                   3
ROTL   0x8D Rotate Left             Rd = Rs ROTL Rn                  3
ROTR   0x8E Rotate Right            Rd = Rs ROTR Rn                  3
MUL    0x8F Multiplication 32x32    Y:Rd = Rs * Rn                  20
SMUL   0x90 Signed Multiplication   Y:Rd = Rs * Rn                  30
DIV    0x91 Division 32:32          Rd = Rs / Rn ; Y = Rs % Rn      25
SDIV   0x92 Signed Division         Rd = Rs / Rn ; Y = Rs % Rn      35
LOAD   0x93 Loads a dword           Rd = ram[Rs + Rn]                3
LOADW  0x94 Loads a word            Rd = ram[Rs + Rn]                3
LOADB  0x95 Loads a byte            Rd = ram[Rs + Rn]                3
STORE  0x96 Saves a dword           ram[Rs + Rn] = Rd                3
STOREW 0x97 Saves a word            ram[Rs + Rn] = Rd                3
STOREB 0x98 Saves a byte            ram[Rs + Rn] = Rd                3


  registers = [ // at addresses 0x11FF00 to 0x11FFFF
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // %r0-%r10 (general-purpose)
  0,           // %y (multiplication/quotient)
  0,           // %bp (base pointer);
  0,           // %sp (stack pointer)
  0,           // %flags
               //   31 -> hhhh hhhh hhhh hhhh hhhh hhgf eeee dcba <- 0
               //   a: CF (carry flag)
               //   b: OF (overflow flag)
               //   c: DE (division error flag)
               //   d: IF (interrupt flag)
               //   e: reserved
               //   f: EI (enable interrupt)
               //   g: ESS (enable single-step mode)
               //   h: reserved

  0];          // %ia interrupt address

*/