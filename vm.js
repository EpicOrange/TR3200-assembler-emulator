var mem_size_ = 1179647; // bytes in 0x000000 to 0x11ffff
var memory = Array(mem_size_); // all the memory. all of it
/*
TR3200 v0.4h

Important addresses:
0x000000-0x01ffff: initial ram
0x000000-0x0fffff: maximum ram
0x100000-0x107fff: rom
0x110000-0x112000: devices (max 32 devices)
0x11e040:          RNG
0x11e050:          clock speed 
0x11ff00-0x11ffff: registers

*/


/*
Currently just doing this:
0x000000: 0xff < reference this address for the dword
0x000001: 0x00
0x000002: 0x00
0x000003: 0x00

so 0x000000: 0x000000ff
*/

// table supresses warnings; table is true when it's the table fetching a value
function getMemory(address, table) {
  if (address < 0x000000 || address > mem_size_)
    return error("tried to get ram at out-of-bounds address " + hexToStr(address, 6));
  if ((address % 4) != 0)
    warning("tried to get dword at non-aligned address " + hexToStr(address, 6));
  address -= (address % 4); // align
  if ( typeof memory[address] == "undefined"
      || typeof memory[address+1] == "undefined"
      || typeof memory[address+2] == "undefined"
      || typeof memory[address+3] == "undefined" ) {
    if (!table)
      warning("tried to get undefined ram dword at " + hexToStr(address, 6));
    return 0x00000000;
  }
  var value = memory[address];
  value = value | (memory[address+1] << 2*4);
  value = value | (memory[address+2] << 4*4);
  value = value | (memory[address+3] << 6*4);
  return (value >>> 0); // this returns a little-endian dword
}

// todo get and set rng and clock speed
function setMemory(address, value, setRom) {
  if (address < 0x000000 || address > mem_size_)
    return error("tried to set ram at out-of-bounds address " + hexToStr(address, 6));
  if ((address % 4) != 0)
    warning("tried to get dword at non-aligned address " + hexToStr(address, 6));
  address -= (address % 4); // align
  if (!setRom && address >= 0x100000 && address <= 0x107fff)
    return error("tried to set address in rom: " + hexToStr(address, 6));
  if (typeof value != "number" && isNaN(parseInt(value)))
    return error("tried to set the non-numeric value " + value
        + " to address " + hexToStr(address, 6));
  if (typeof value == "string")
    value = parseInt(value);

  if (value > 0xffffffff)
    return error("tried to set the dword at address " + hexToStr(address, 6)
        + " to out-of-range value " + hexToStr(value));
  memory[address+0] = (value >>> 0*4) & 0x000000ff;
  memory[address+1] = (value >>> 2*4) & 0x000000ff;
  memory[address+2] = (value >>> 4*4) & 0x000000ff;
  memory[address+3] = (value >>> 6*4) & 0x000000ff;

  // update the user's table if the address is within bounds
  if (address >= currentPos && address < currentPos + (tableSize*4)) {
    updateMemoryTable();
    flashBox("memory", (address - currentPos) / 4);
  }
}
function getRegister(register) {
  var index = register;
  if (typeof register != "number") {
    if (!(register in regNames))
      return error("Tried to get an invalid register: " + register);
    index = regNames[register];
  }
  return getMemory(0x11ff00 + index*4);
}
function setRegister(register, value) {
  var index = register;
  if (typeof register != "number") {
    if (!(register in regNames))
      return error("Tried to get an invalid register: " + register);
    index = regNames[register];
  }
  setMemory(0x11ff00 + index*4, value);
  document.getElementById(regNames2[index]).innerHTML = hexToStr(value);
  flashBox("register", register);
}
function setFlag(index, value) {
  var mask = 1 << index;
  if (value) {
    setRegister("%flags", getRegister("%flags") | mask); // set
  } else {
    setRegister("%flags", getRegister("%flags") & ~mask); // unset
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
  // memory = Array(mem_size_);

  // clear registers
  for (var i = 0; i < 16; i++) {
    setRegister(i, 0);
  }

  // temporary since no boot config code to run
  // you could say this is the boot code
  pc = 0x100000;
  setRegister("%sp", 0x01fffc);

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
  var rnValue;
  if (typeof rn != "undefined")
    rnValue = (m ? rn : getRegister(rn)) >>> 0;
  var skip = false; // for conditionals
  switch (opcode) {
  case 0x0: // SLEEP
    sleep();
    break;
// RET    0x01 Return from subrutine                                    4
// RFI    0x02 Return from interrupt                                    6

  case 0x20: // XCHGB
    if (m)
      warning("m bit set while executing XCHGB");
    var value = getRegister(rn);
    setRegister(rn, (value << 24) | (value >> 24) | (value & 0x00ffff00));
  case 0x21: // XCHGW
    if (m)
      warning("m bit set while executing XCHGW");
    var value = getRegister(rn);
    setRegister(rn, (value << 16) | (value >> 16));
  case 0x22: // GETPC
    if (m)
      warning("m bit set while executing GETPC");
    setRegister(rn, pc + 4);
  case 0x23: // POP
    if (m)
      warning("m bit set while executing POP");
    var address = getRegister("%sp") + 4;
    setRegister(rn, getMemory(address));
    setRegister("%sp", address);
    break;
  case 0x24: // PUSH
    if (m)
      warning("m bit set while executing PUSH");
    var address = getRegister("%sp");
    setMemory(address, rn);
    setRegister("%sp", address - 4);
    break;
  case 0x25: // JMP
    pc = rnValue & 0xfffffffc;
    pc -= 4; // don't advance PC
    break;
  case 0x26: // CALL
    pc = rnValue & 0xfffffffc;
    setMemory(address, rnValue);
    setRegister("%sp", address - 4);
    pc -= 4;
    break;
  case 0x27: // RJMP
    pc += (rnValue & 0xfffffffc);
    pc -= 4;
    break;
  case 0x28: // RCALL
    pc += (rnValue & 0xfffffffc);
    setMemory(address, rnValue);
    setRegister("%sp", address - 4);
    pc -= 4;
    break;

// INT    0x29 Software Interrupt                                       6

  case 0x40: // MOV
    setRegister(rd, rnValue);
    break;
  case 0x41: // SWP
    if (m)
      warning("m bit set while executing SWP");
    var temp = getRegister(rd);
    setRegister(rd, rn);
    setRegister(rn, temp);
    break;
  case 0x42: // NOT
    setRegister(rd, ~rnValue);
    break;
  case 0x43: // SIGXB
    setRegister(rd, ((rnValue >> 7) ? rnValue | 0xffffff00 : rnValue));
    break;
  case 0x44: // SIGXW
    setRegister(rd, ((rnValue >> 15) ? rnValue | 0xffff0000 : rnValue));
    break;
  case 0x45: // LOAD
    setRegister(rd, getMemory(rnValue));
    break;
  case 0x46: // LOADW
    setRegister(rd, getMemory(rnValue) & 0xffff);
    break;
  case 0x47: // LOADB
    setRegister(rd, getMemory(rnValue) & 0xff);
    break;
  case 0x48: // STORE
    setMemory(rnValue, getRegister(rd));
    break;
  case 0x49: // STOREW
    setMemory(rnValue, getRegister(rd) & 0xffff);
    break;
  case 0x4a: // STOREB
    setMemory(rnValue, getRegister(rd) & 0xff);
    break;
  case 0x4b: // IFEQ
    skip = rnValue != getRegister(rd);
    break;
  case 0x4c: // IFNEQ
    skip = rnValue == getRegister(rd);
    break;
  case 0x4d: // IFL
    skip = rnValue >= getRegister(rd);
    break;
  case 0x4e: // IFSL
    skip = (rnValue >> 0) >= (getRegister(rd) >> 0);
    break;
  case 0x4f: // IFLE
    skip = rnValue > getRegister(rd);
    break;
  case 0x50: // IFSLE
    skip = (rnValue >> 0) > (getRegister(rd) >> 0);
    break;
  case 0x51: // IFBITS
    skip = (rnValue & getRegister(rd)) == 0;
    break;
  case 0x52: // IFCLEAR
    skip = (rnValue & getRegister(rd)) != 0;
    break;
  case 0x53: // JMP
    pc = (rnValue + getRegister(rd)) & 0xfffffffc;
    break;
  case 0x54: // CALL
    pc = (rnValue + getRegister(rd)) & 0xfffffffc;
    setMemory(address, rnValue);
    setRegister("%sp", address - 4);
    break;
  case 0x80: // AND
    setRegister(rd, getRegister(rs) & rnValue);
    break;
  case 0x81: // OR
    setRegister(rd, getRegister(rs) | rnValue);
    break;
  case 0x82: // XOR
    setRegister(rd, getRegister(rs) ^ rnValue);
    break;
  case 0x83: // BITC
    setRegister(rd, getRegister(rs) & ~rnValue);
    break;
  case 0x84: // ADD
  case 0x85: // ADDC
    var value = getRegister(rs) + rnValue;
    setFlag(0, value > 0xffffffff); // carry flag
    setFlag( 1, (((value & 0x80000000) ^ (rnValue & 0x80000000)) ^ ((rnValue & 0x80000000) ^ (getRegister(rs) & 0x80000000))) >>> 31); // overflow flag
    value &= 0xffffffff;
    if (opcode == 0x85) // ADDC
      value += getRegister("%flags") & 1;
    setRegister(rd, value >>> 0);
    break;
  case 0x86: // SUB
  case 0x87: // SUBB
    var c = opcode == 0x86 ? 1 : (getRegister("%flags") & 1);
    var value = (getRegister(rs) + c + ~rnValue) >>> 0;
    setFlag(0, getRegister(rs) < rnValue); // carry flag
    setFlag( 1, ((value >>> 31) ^ (rnValue >>> 31)) ^ ((rnValue >>> 31) ^ (getRegister(rs) >>> 31)) ); // overflow flag
    setRegister(rd, value >>> 0);
    break;
  case 0x88: // RSB
  case 0x89: // RSBB
    var c = opcode == 0x88 ? 1 : (getRegister("%flags") & 1);
    var value = (rnValue + c + ~getRegister(rs)) >>> 0;
    setFlag(0, rnValue < getRegister(rs)); // carry flag
    setFlag( 1, ((value >>> 31) ^ (getRegister(rs) >>> 31)) ^ ((getRegister(rs) >>> 31) ^ (rnValue >>> 31)) ); // overflow flag
    setRegister(rd, value >>> 0);
    break;
  case 0x8a: // LLS
    var value = getRegister(rs) << rnValue;
    setRegister(rd, value >>> 0);
    break;
  case 0x8b: // LRS
    var value = getRegister(rs) >>> rnValue;
    setRegister(rd, value);
    break;
  case 0x8c: // ARS
    var value = getRegister(rs) >>> rnValue;
    if (getRegister(rs) >>> 31)
      value = value | (0xffffffff << (32 - rnValue));
    setRegister(rd, value);
    break;
  case 0x8d: // ROTL
    var value = getRegister(rs) << rnValue;
    if (getRegister(rs) >>> 31)
      value = value | 0x00000001;
    setRegister(rd, value);
    break;
  case 0x8e: // ROTR
    var value = getRegister(rs) >>> rnValue;
    if (getRegister(rs) & 1)
      value = value | 0x80000000;
    setRegister(rd, value);
    break;
  case 0x8f: // MUL
    var a = getRegister(rs);
    var b = rnValue;
    var value = (a & 0xffff) * (b & 0xffff); // 1st digit
    var y = (a >>> 16) * (b >>> 16); // 2nd digit
    var temp = ((a & 0xffff) * (b >>> 16)) + ((a >>> 16) * (b & 0xffff)); // middle
    value += (temp & 0xffff) << 16;
    y += temp >>> 16;
    setRegister("%y", y >>> 0);
    setRegister(rd, value >>> 0);
    break;
  case 0x90: // SMUL
    // booth's multiplication algorithm
    var a = getRegister(rs); // multiplicand
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
      y = (y >>> 1) | ((temp << 31) >>> 0);
    }
    setRegister("%y", y >>> 0);
    setRegister(rd, value >>> 0);
    break;
  case 0x91: // DIV
    setFlag(2, (rnValue == 0))
    if (rnValue == 0) break;
    var y = getRegister(rs) % rnValue;
    var value = getRegister(rs) / rnValue;
    setRegister("%y", y >>> 0);
    setRegister(rd, value >>> 0);
    break;
  case 0x92: // SDIV
    setFlag(2, (rnValue == 0))
    if (rnValue == 0) break;
    var a = (getRegister(rs) >>> 31) ? ~getRegister(rs) + 1 : getRegister(rs);
    var b = (rnValue >>> 31) ? ~rnValue + 1 : rnValue;
    var y = (a % b) >>> 0;
    var value = Math.floor(a / b) >>> 0;
    if (getRegister(rs) >>> 31)
      y = ~y + 1;
    if ((getRegister(rs) >>> 31) ^ (rnValue >>> 31))
      value = ~value + 1;
    setRegister("%y", y >>> 0);
    setRegister(rd, value >>> 0);
    break;
  case 0x93: // LOAD
    setRegister(rd, getMemory(getRegister(rs) + rnValue));
    break;
  case 0x94: // LOADW
    setRegister(rd, getMemory(getRegister(rs) + rnValue) & 0xffff);
    break;
  case 0x95: // LOADB
    setRegister(rd, getMemory(getRegister(rs) + rnValue) & 0xff);
    break;
  case 0x96: // STORE
    setMemory(getRegister(rs) + rnValue, getRegister(rd));
    break;
  case 0x97: // STOREW
    setMemory(getRegister(rs) + rnValue, getRegister(rd) & 0xffff);
    break;
  case 0x98: // STOREB
    setMemory(getRegister(rs) + rnValue, getRegister(rd) & 0xff);
    break;
  default:
    console.log("unimplemented opcode: 0x" + opcode.toString(16));
  }
  if (skip) {
    do {
      pc += 4;
      var nextOp = getMemory(pc) & 0xff;
    } while (nextOp >= 0x4b && nextOp <= 0x52);
  }
}

function step() {
  if (asleep) // this is temporary, (hopefully)
    return;
  var instruction = getMemory(pc); // reminder: instructions are in little-endian
  var opcode = instruction & 0xff;
  var parameters = numArgs(opcode); // number of parameters
  var m = (instruction & 0x00008000) >>> 15;
  var rn = undefined, rs = undefined, rd = undefined;

  // update the table
  // todo: also show the assembly code version, e.g. 0xd0018040 => MOV 0x00000010 %sp
  document.getElementById("%pc").innerHTML = hexToStr(pc, 6);
  document.getElementById("currentInstruction").innerHTML = hexToStr(instruction);

  // this entire switch is for extracting rn, rs, and rd from the instruction.
  // there's probably a more compact and less readable way to do this
  switch (parameters) {
  case 3:
    rs = (instruction & 0xf0000000) >>> 7*4;
    rd = (instruction & 0x0f000000) >>> 6*4;
    if (m) {
      if ((instruction & 0x00ff7f00) == 0x00004000) {
        pc += 4;
        rn = getMemory(pc);
      } else {
        rn = ((instruction & 0x00ff0000) >>> 4*4)
           | ((instruction & 0x00007f00) >>> 0*4);
      }
    } else {
      rn = (instruction & 0x000f0000) >>> 4*4;
    }
    break;
  case 2:
    rd = (instruction & 0x0f000000) >>> 6*4;
    if (m) {
      if ((instruction & 0xf0ff7f00) == 0x00004000) {
        pc += 4;
        rn = getMemory(pc);
      } else {
        rn = ((instruction & 0xf0000000) >>> 7*4)
           | ((instruction & 0x00ff0000) >>> 3*4)
           | ((instruction & 0x00007f00) << 1*4);
      }
    } else {
      rn = (instruction & 0xf0000000) >>> 7*4;
    }
    break;
  case 1:
    if (m) {
      if ((instruction & 0xffff7f00) == 0x00004000) {
        pc += 4;
        rn = getMemory(pc);
      } else {
        rn = ((instruction & 0xff000000) >>> 6*4)
           | ((instruction & 0x00ff0000) >>> 2*4)
           | ((instruction & 0x00007f00) << 2*4);
      }
    } else {
      rn = (instruction & 0x0f000000) >>> 6*4;
    }
    break;
  case 0:
    break;
  }

  var operation = "???"; // text form of the operation
  if (opcode in opcodes2) {
    operation = opcodes2[opcode];
    if (typeof rd != "undefined")
      operation += " " + regNames2[rd];
    if (typeof rs != "undefined")
      operation += " " + regNames2[rs];
    if (typeof rn != "undefined")
      operation += " " + (m ? hexToStr(rn) : regNames2[rn]);
  }
  document.getElementById("currentInstructionText").innerHTML = operation;

  // debug code
  // var debugText = "PC: " + hexToStr(pc), 6) + "; read instruction " + hexToStr(instruction) + " (" + operation + ")\n\t";
  // debugText += "opcode: " + hexToStr(opcode, 2) + "; ";
  // debugText += "m: " + (m ? "true; " : "false; ");
  // if (typeof rn != "undefined")
  //   debugText += "rn: " + (m ? hexToStr(rn) : regNames2[rn]) + "; ";
  // if (typeof rs != "undefined")
  //   debugText += "rs: " + regNames2[rs] + "; ";
  // if (typeof rd != "undefined")
  //   debugText += "rd: " + regNames2[rd] + "; ";
  // console.log(debugText);

  // todo: this actually doesn't work since execute doesn't return anything
  var isError = execute(opcode, parameters, m, rn, rs, rd) == "error";
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

instructions:
31                                    0
000o oooo xxxx xxxx xxxx xxxx xxxx xxxx (0 parameters)
001o oooo Mxxx xxxx xxxx xxxx xxxx nnnn (1 parameter)
01oo oooo Mxxx xxxx xxxx xxxx nnnn dddd (2 parameters)
1ooo oooo Mxxx xxxx xxxx nnnn ssss dddd (3 parameters)
first 2 opcode bits determine number of parameters

o: opcode
x: ignored
M: indicates that n is an immediate value 
   (and occupies the x's to the left)
n: source register
s: second source register
d: target register

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