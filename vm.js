var ram = Array(128*1024); // 128 KB
function getRam(address) {
  if (address < 0x000000 || address > 128*1024)
    error("tried to fetch ram address at " + hexToStr(address));
  return ram[address];
}
function setRam(address, value) {
  if (address < 0x000000 || address > 128*1024)
    error("tried to set ram address at " + hexToStr(address));
  if (typeof value != "number" && isNaN(parseInt(value)))
    error("tried to set the non-numeric value " + value
        + " to address " + hexToStr(address));
  ram[address] = parseInt(value);
}
var colors = [
  "#000000", // Black
  "#EFDCB2", // Light Blue
  "#F2A231", // Mid Blue
  "#FF0000", // Blue
  "#32261B", // Dark Blue
  "#27CEA3", // Light Green
  "#1A8944", // Green
  "#4E482F", // Swamp Green
  "#6BE2F7", // Yellow
  "#3189EB", // Copper
  "#2264A4", // Brown
  "#2B3C49", // Dark Brown
  "#8B6FE0", // Pink
  "#3326BE", // Red
  "#9D9D9D", // Gray
  "#FFFFFF" // White
  ];
var registers; // TODO put registers in the ram too
function boot() {
  registers = [ // at addresses 0x11FF00 to 0x11FFFF
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // %r0-%r10 (general-purpose)
  0,           // %y (multiplication/quotient)
  0,           // %bp (base pointer);
  0,           // %sp (stack pointer)
  0,           // %flags
               //   31 -> abcd eeee fghh hhhh hhhh hhhh hhhh hhhh <- 0
               //   a: CF (carry flag)
               //   b: OF (overflow flag)
               //   c: DE (division error flag)
               //   d: IF (interrupt flag)
               //   e: reserved
               //   f: EI (enable interrupt)
               //   g: ESS (enable single-step mode)
               //   h: reserved

  0];          // %ia interrupt address
}


var asleep = false;
function sleep() { // temporary test function
  if (!asleep) {
    asleep = true;
    console.log("sleeping!");
  }
}

// note: should probably put all stuff, e.g. registers, into ram before implementing instructions
function execute(opcode, params, m, rn, rs, rd) {
    // only SLEEP (0x00) implemented for testing purposes
    switch (opcode) {
    case 0x0: // SLEEP
      sleep();
      break;
    case 0x40: // MOV
      if (m) { // sets a register
      }
      break;
    default:
      console.log("unimplemented opcode: 0x" + opcode.toString(16));
    }
}

function run(rom) { // instruction is in little-endian
  for (var i = 0; i < rom.length; i++) { // todo i should be some register that points to the rom
    var instruction = rom[i];
    var opcode = instruction & 0xff;
    var parameters = numArgs(opcode); // number of parameters
    var m = instruction & 0x00008000;
    var rn, rs, rd;
    switch (parameters) {
    case 3:
      rs = opcode & 0xf0000000;
      rd = opcode & 0x0f000000;
      if (m) {
        if ((instruction & 0x00ffff00) == 0x00004000) {
          rn = rom[++i];
        } else {
          rn = ((instruction & 0x00ff0000) >> 4*4)
             | ((instruction & 0x00007f00) >> 0*4);
        }
      } else {
        rn = opcode & 0x000f0000;
      }
      break;
    case 2:
      rd = opcode & 0x0f000000;
      if (m) {
        if ((instruction & 0xf0ffff00) == 0x00004000) {
          rn = rom[++i];
        } else {
          rn = ((instruction & 0xf0000000) >> 7*4)
             | ((instruction & 0x00ff0000) >> 2*4)
             | ((instruction & 0x00007f00) << 1*4);
        }
      } else {
        rn = opcode & 0xf0000000;
      }
      break;
    case 1:
      if (m) {
        if ((instruction & 0xffffff00) == 0x00004000) {
          rn = rom[++i];
        } else {
          rn = ((instruction & 0xff000000) >> 6*4)
             | ((instruction & 0x00ff0000) >> 2*4)
             | ((instruction & 0x00007f00) << 2*4);
        }
      } else {
        rn = opcode & 0x0f000000;
      }
      break;
    case 0:
      break;
    }

    // now to actually execute the code
    execute(opcode, parameters, m, rn, rs, rd);
  }
  console.log("done with rom");
  sleep();
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
JMP    0x25 Absolute Jump           %pc = Rn & 0xFFFFFFFC            3
CALL   0x26 Absolute Jump& Push %pc %pc = Rn & 0xFFFFFFFC            4
RJMP   0x27 Relative Jump           %pc = (%pc + Rn) & 0xFFFFFFFC    3
RCALL  0x28 Relative Jump& Push %pc %pc = (&pc + Rn) & 0xFFFFFFFC    4
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
LRS    0x8B Logical Right Shift     Rd = Rs >> Rn                    3
ARS    0x8C Arithmetic Right Shift  Rd = Rs >>> Rn                   3
ROTL   0x8D Rotate Left             Rd = Rs ROTL Rn                  3
ROTR   0x8E Rotate Right            Rd = Rs ROTR Rn                  3
MUL    0x8F Multiplication 32x32    Y:Rd = Rs * Rn                  20
SMUL   0x90 Signed Multiplication   Y:Rd = Rs * Rn                  30
DIV    0x91 Division 32:32          Rd = Rs / Rn ; Y = Rs % Rn      25
SDIV   0x92 Signed Division         Rd = Rs / Rn; Y = Rs % Rn       35
LOAD   0x93 Loads a dword           Rd = ram[Rs + Rn]                3
LOADW  0x94 Loads a word            Rd = ram[Rs + Rn]                3
LOADB  0x95 Loads a byte            Rd = ram[Rs + Rn]                3
STORE  0x96 Saves a dword           ram[Rs + Rn] = Rd                3
STOREW 0x97 Saves a word            ram[Rs + Rn] = Rd                3
STOREB 0x98 Saves a byte            ram[Rs + Rn] = Rd                3



*/