
/*
TR3200 v0.4.0
Computer is v0.4.9

Important addresses:
0x000000-0x01ffff: initial ram
0x020000-0x0fffff: additional ram
0x100000-0x107fff: rom
0x110000-0x112000: device enumeration and control (0x100 bytes space each, max 32 devices)
0x11e040:          RNG
0x11e050:          clock speed (100KHz which probably shouldn't be expected on javascript)
0x11f000-0x11f0ff: nvram
0x11ff00-0x11ffff: registers (64 registers?)
0x110000-0xffffff: device memory
*/

/* currently, the memory object is like this

  VM.memory[0x000000] = 0xaabbccdd;
  VM.memory[0x000004] = 0x11223344;

  address: 
  0x000000: 0xaabbccdd
        01: 0xcc <== these bytes are implicit and not actually stored
        02: 0xbb
        03: 0xaa
  0x000004: 0x11223344
        05: 0x33
        06: 0x22
        07: 0x11

  fetching VM.memory[0x100003] will return 0x223344aa

*/

/* ANOTHER TODO LIST
  
  make memory table resize correctly: see resizeFunction in init() and see memorycontrol.js

  commit message: "UI overhaul, also fixed some bugs and made assembler check number of params"




  rewrite execute
    attach cycle counts
    look over each instruction to see if changed
    make em all work as well cause some don't

  parser.js rewrite

  sanitize step() for invalid instructions (such as those made from parser)

  specifications say the vm has four internal devices: 
      https://github.com/trillek-team/trillek-computer#pit-programmable-interval-timer

  ui changes:
    add line numbers to input
    no need to use zoom
*/

var VM = new function() {
  this.mem_size = 0x1fffff; // TODO: maybe it shouldn't be writable?
  Object.defineProperty(this, 'mem_size', {
    configurable: false,
    writable: false,
    value: 0x1fffff
  });
  this.cycles_used = 0; // cycles passed
  this.running = 0; // either 0 (not running) or the setInterval return value (running)
  this.pc = 0; // PC register (has no address)
  this._memory = {};
  this.memory = new Proxy(this._memory, {
    // get dword from address+0 to address+3 (address+0 being LSB)
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
      if (address & 0x3) { // address is unaligned to 4 bytes
        // warning("tried to get ram at non-aligned address " + hexToStr(address, 6));
        var offset = (address & 0x3) * 8;
        address &= 0xfffffc; // realign to lower address
        var dword1 = object[address];
        var dword2 = object[address + 4];

        // this works trust me
        return ((dword1 & (0xffffffff << offset)) >>> offset)
             | ((dword2 & (0xffffffff >>> (32 - offset))) << (32 - offset));
      } else {
        return uint(object[address]);
      }
    },
    // set dword from address+0 to address+3 to value(address+0 being LSB of value)
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
      if ( this.running // can't set rom when running (it's rom after all)
          && address >= 0x100000 && address <= 0x107fff ) {
        return error("tried to set rom at " + hexToStr(address, 6) + " to " + hexToStr(value));
      }

      // now actually set things
      if (address & 0x3) { // address is unaligned to 4 bytes
        // warning("tried to set ram at non-aligned address " + hexToStr(address, 6));
        var offset = (address & 0x3) * 8;
        address &= 0xfffffc; // realign to lower address
        var dword1 = object[address];
        var dword2 = object[address + 4];

        // clear the bits to be replaced
        dword1 &= ~(0xffffffff << offset);
        dword2 &= ~(0xffffffff >>> (32 - offset));

        // set the cleared bits
        dword1 |= value << offset;
        dword2 |= value >>> (32 - offset);

        // store it in memory
        object[address & 0xfffffc] = dword1;
        showEditedValue(address, dword1);
        if (address + 4 <= VM.mem_size) {
          object[address + 4] = dword2;
          showEditedValue(address + 4, dword2);
        }
      } else {
        object[address] = value;
        showEditedValue(address, value);
      }
    }
  });
  this.flags = new Proxy({}, {
    get: function(object, name) {
      if (name in flagNames) {
        return (this._memory[0x11ff3c] >>> flagNames[name]) & 1;
      } else {
        return error("tried to get unknown flag " + name);
      }
    },
    set: function(object, name, value) {
      if (!(name in flagNames)) {
        return error("tried to set unknown flag " + name + " to " + value);
      }
      var newValue = VM._memory[0x11ff3c];
      var position = flagNames[name];
      if (value) {
        newValue |= (1 << position); // set
      } else {
        newValue &= ~(1 << position); // unset
      }
      VM._memory[0x11ff3c] = newValue;

      // update the %flags register on table
      document.getElementById("%flags").innerHTML = hexToStr(value);
      flashBox("register", "%flags");
    }
  });
  this.run = function() {
    if (!this.running) {
      this.running = setInterval(step, 1);
    }
    document.getElementById("run").value = "pause";
  };
  this.pause = function() {
    if (this.running) {
      clearInterval(this.running);
      this.running = 0;
    }
    document.getElementById("run").value = "run";
  };
  this.clearRam = function() {
    for (var k in VM._memory) {
      delete VM._memory[k];
    }
  }
  this.boot = function() {
    if (VM.running) {
      VM.pause();
    }
    
    // clear memory. but the specs don't say this is supposed to be done.
    // VM.clearRam();

    // clear registers by directing editing memory (to avoid table flashing)
    for (var i = 0; i < 16; i++) {
      document.getElementById(regNames2[i]).innerHTML = "0x00000000";
      VM._memory[0x11ff00 + (i * 4)] = 0;
    }

    // refresh cycle counter
    VM.cycles_used = 0;

    // temporary
    // you could say this is the boot code
    VM.pc = 0x100000;
    VM._memory[0x11ff34] = 0x0001ffff; // %sp starts at end of RAM
    document.getElementById("%sp").innerHTML = "0x0001fffc";

    asleep = false;
    document.getElementById("%pc").innerHTML = hexToStr(VM.pc, 6);
    document.getElementById("currentInstruction").innerHTML = "N/A";
    document.getElementById("currentInstructionText").innerHTML = "???";
    updateMemoryTable();
  }
};

// TODO: implement interrupts so this isn't needed
var asleep = false; // temporary test thingy
function sleep() { // temporary test function
  if (!asleep) {
    asleep = true;
    console.log("sleeping!");
  }
  VM.pause();
}

function execute(opcode, params, rnValue, rn, rs, rd) {
  var skip = false; // for conditionals
  switch (opcode) {
  case 0x00: // SLEEP
    sleep(); // TODO make this wait for hardware interrupt
    VM.cycles_used += 1;
    break;
  case 0x01: // RET
    // TODO
    VM.cycles_used += 4;
    break;
  case 0x02: // RFI
    // TODO
    VM.cycles_used += 6;
    break;
  case 0x20: // XCHGB
    VM.memory[rn] = (rnValue & 0x00ffff00) | (rnValue << 24) | (rnValue >>> 24);
    VM.cycles_used += 3;
    break;
  case 0x21: // XCHGW
    VM.memory[rn] = (rnValue << 16) | (rnValue >>> 16);
    VM.cycles_used += 3;
    break;
  case 0x22: // GETPC
    VM.memory[rn] = VM.pc + 4;
    VM.cycles_used += 3;
    break;
  case 0x23: // POP: reads at [%sp++] (increment after write to that addr)
    // remember: little endian. last byte of register is stored in lowest # address
    var sp = VM.memory["%sp"] + 4;
    VM.memory[sp] = VM.memory[rn];
    VM.memory["%sp"] = sp;
    break;
  case 0x24: // PUSH: writes at [--%sp] (decrement first, write to that addr)
    // remember: little endian
    var sp = VM.memory["%sp"];
    VM.memory[sp] = rn;
    VM.memory["%sp"] = sp - 4;
    break;
  case 0x25: // JMP
    VM.pc = rnValue & 0xfffffffc;
    VM.pc -= 4; // don't advance PC
    break;
  case 0x26: // CALL
    VM.pc = rnValue & 0xfffffffc;
    VM.memory[address] = rnValue;
    VM.memory["%sp"] = address - 4;
    VM.pc -= 4;
    break;
  case 0x27: // RJMP
    VM.pc += (rnValue & 0xfffffffc);
    VM.pc -= 4;
    break;
  case 0x28: // RCALL
    VM.pc += (rnValue & 0xfffffffc);
    VM.memory[address] = rnValue;
    VM.memory["%sp"] = address - 4;
    VM.pc -= 4;
    break;
  case 0x29: // INT
    break;
  case 0x40: // MOV
    VM.memory[rd] = rnValue;
    break;
  case 0x41: // SWP
    var temp = VM.memory[rd];
    VM.memory[rd] = rn;
    VM.memory[rn] = temp;
    break;
  case 0x42: // NOT
    VM.memory[rd] = ~rnValue;
    break;
  case 0x43: // SIGXB
    VM.memory[rd] = ((rnValue >>> 7) ? rnValue | 0xffffff00 : rnValue);
    break;
  case 0x44: // SIGXW
    VM.memory[rd] = ((rnValue >>> 15) ? rnValue | 0xffff0000 : rnValue);
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
    skip = rnValue >= uint(VM.memory[rd]);
    break;
  case 0x4f: // IFLE
    skip = rnValue > VM.memory[rd];
    break;
  case 0x50: // IFSLE
    skip = rnValue > uint(VM.memory[rd]);
    break;
  case 0x51: // IFBITS
    skip = (rnValue & VM.memory[rd]) == 0;
    break;
  case 0x52: // IFCLEAR
    skip = (rnValue & VM.memory[rd]) != 0;
    break;
  case 0x53: // JMP
    VM.pc = (rnValue + VM.memory[rd]) & 0xfffffffc;
    break;
  case 0x54: // CALL
    VM.pc = (rnValue + VM.memory[rd]) & 0xfffffffc;
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
    VM.flags["cf"] = value > 0xffffffff; // carry flag
    VM.flags["of"] = ( ((value & 0x80000000) ^ (rnValue & 0x80000000))
        ^ ((rnValue & 0x80000000) ^ (VM.memory[rs] & 0x80000000)) ) >>> 31; // overflow flag
    value &= 0xffffffff;
    if (opcode == 0x85) { // ADDC
      value += VM.memory["%flags"] & 1;
    }
    VM.memory[rd] = uint(value);
    break;
  case 0x86: // SUB
  case 0x87: // SUBB
    var c = opcode == 0x86 ? 1 : (VM.memory["%flags"] & 1);
    var value = uint(VM.memory[rs] + c + ~rnValue);
    VM.flags["cf"] = VM.memory[rs] < rnValue; // carry flag
    VM.flags["of"] = ((value >>> 31) ^ (rnValue >>> 31))
        ^ ((rnValue >>> 31) ^ (VM.memory[rs] >>> 31)); // overflow flag
    VM.memory[rd] = uint(value);
    break;
  case 0x88: // RSB
  case 0x89: // RSBB
    var c = opcode == 0x88 ? 1 : (VM.memory["%flags"] & 1);
    var value = uint(rnValue + c + ~VM.memory[rs]);
    VM.flags["cf"] = rnValue < VM.memory[rs]; // carry flag
    VM.flags["of"] = ((value >>> 31) ^ (VM.memory[rs] >>> 31))
        ^ ((VM.memory[rs] >>> 31) ^ (rnValue >>> 31)); // overflow flag
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
      value |= (0xffffffff << (32 - rnValue));
    VM.memory[rd] = value;
    break;
  case 0x8d: // ROTL
    var value = VM.memory[rs] << rnValue;
    if (VM.memory[rs] >>> 31)
      value |= 0x00000001;
    VM.memory[rd] = value;
    break;
  case 0x8e: // ROTR
    var value = VM.memory[rs] >>> rnValue;
    if (VM.memory[rs] & 1)
      value |= 0x80000000;
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
      // [y] >>> [value] >>> [b]
      var temp = y >>> 31;
      b = value & 1;
      value = (value >>> 1) | ((y & 1) << 31);
      y = (y >>> 1) | uint(temp << 31);
    }
    VM.memory["%y"] = uint(y);
    VM.memory[rd] = uint(value);
    break;
  case 0x91: // DIV
    if (rnValue == 0) {
      VM.flags["de"] = true;
      break;
    }
    var y = VM.memory[rs] % rnValue;
    var value = VM.memory[rs] / rnValue;
    VM.memory["%y"] = uint(y);
    VM.memory[rd] = uint(value);
    break;
  case 0x92: // SDIV
    if (rnValue == 0) {
      VM.flags["de"] = true;
      break;
    }
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
      VM.pc += 4;
      var nextOp = VM.memory[VM.pc] & 0xff;
    } while (nextOp >= 0x4b && nextOp <= 0x52); // keep skipping if instructions todo: why keep skipping ifs?
  }
}

function step() {
  if (asleep) { // todo: this is a temporary thing
    VM.pause();
    return;
  }
  var instruction = VM.memory[VM.pc]; // little-endian

  // update the table
  document.getElementById("%pc").innerHTML = hexToStr(VM.pc, 6);
  document.getElementById("currentInstruction").innerHTML = hexToStr(reverseEndianness(instruction));

  // get opcode and params
  var opcode = instruction & 0xff;
  var parameters = numParams(opcode);
  var m = (instruction & 0x00008000) != 0;
  var l = (instruction & 0x00004000) != 0;
  var rn, rs, rd;

  switch (parameters) {
  case 3:
    rs = ((instruction & 0x00c00000) >>> 22)
       | ((instruction & 0x00000300) >>> 6);
  case 2:
    rd = (instruction & 0x00003c00) >>> 10;
  case 1:
    if (m && l) {
        VM.pc += 4;
        rn = reverseEndianness(VM.memory[VM.pc]);
    } else {
      rn = ((instruction & 0x000f0000) >>> 8)
         | ((instruction & 0xff000000) >>> 24);
    }
  }

  // display text form of this instruction on the table
  var text = "???";
  if (opcode in opcodes2) {
    text = opcodes2[opcode].toUpperCase();
    var rnName = (m ? hexToStr(rn) : regNames2[rn]);
    var rdName = regNames2[rd];
    var rsName = regNames2[rs];
    // special cases!
    if (opcode >= 0x93 && opcode <= 0x95) { // 3 parameter load: "LOAD Rd, Rs + Rn"
      text += " " + rdName + ", " + rsName + " + " + rnName;
    } else if (opcode >= 0x96 && opcode <= 0x98) { // 3 parameter store: "STORE Rs + Rn, Rd"
      text += " " + rsName + " + " + rnName + ", " + rdName;
    } else if (opcode >= 0x48 && opcode <= 0x4a) { // 2 parameter store: "STORE Rn, Rd"
      text += " " + rnName + ", " + rdName;
    } else if (opcode == 0x53 || opcode == 0x54) { // 2 parameter jmp or call: "JMP/CALL Rd + Rn"
      text += " " + rdName + " + " + rnName;
    } else if (parameters == 3) { // 3 parameters: *instr* Rd, Rs, Rn
      text += " " + rdName + ", " + rsName + ", " + rnName;
    } else if (parameters == 2) { // 2 parameters: *instr* Rd, Rn
      text += " " + rdName + ", " + rnName;
    } else if (parameters == 1) { // 1 parameter: *instr* Rn
      text += " " + rnName;
    }
  }
  document.getElementById("currentInstructionText").innerHTML = text;

  // deal with rn and m bit
  var rnValue; // what the rn register stores, or the immediate value
  if (m) {
    switch (opcode) {
    case 0x20: // XCHGB
    case 0x21: // XCHGW
    case 0x22: // GETPC
    case 0x23: // POP
    case 0x24: // PUSH
    case 0x41: // SWP
      return error("m bit set while executing " + regNames2[opcode]);
    }
    if (l) {
      rnValue = uint(rn);
    } else if (parameters == 3) {
      rnValue = uint(rn & 0x1fff);
      if (rn & 0x2000) {
        rnValue = uint(~rnValue + 1);
      }
    } else if (parameters == 2) {
      rnValue = uint(rn & 0x1ffff);
      if (rn & 0x20000) {
        rnValue = uint(~rnValue + 1);
      }
    } else if (parameters == 1) {
      rnValue = uint(rn & 0x1fffff);
      if (rn & 0x200000) {
        rnValue = uint(~rnValue + 1);
      }
    }
  } else if (parameters != 0) {
    rnValue = VM.memory[regNames2[rn]];
  }

  execute(opcode, parameters, rnValue, rn, regNames2[rs], regNames2[rd]);
  VM.pc += 4;
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