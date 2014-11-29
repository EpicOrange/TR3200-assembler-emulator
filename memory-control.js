var currentPos = 0; // address at top of table
var tableSize = 9; // yes you can change this
function createNewRow(address, index) {
  return "<tr>"
      + "<td id=\"memory-address-" + index + "\">"
      + hexToStr(address, 6)
      + "</td>"
      + "<td id=\"memory-value-" + index + "\">"
      + hexToStr(VM.memory[address])
      + "</td></tr>\n";
}
function updateMemoryTable(newAddress) {
  if (newAddress !== undefined) {
    if (!Number.isInteger(newAddress)) {
      newAddress = parseInt(newAddress, 16);
      if (!Number.isInteger(newAddress)) {
        return error("tried to view memory at a noninteger address " + newAddress);
      }
    }
    if (newAddress < 0x000000) {
      return error("tried to view memory at an out-of-bounds address: " + hexToStr(newAddress, 6));
    } else if (newAddress > 0xffffff) {
      return error("tried to view memory at an out-of-bounds address: " + hexToStr(newAddress + (tableSize * 4), 6));
    }
    if (newAddress + (tableSize * 4) > 0xffffff) {
      newAddress = 0x1000000 - (tableSize * 4);
    }
    currentPos = newAddress & 0xfffffc; // align to memory
  }
  if (currentPos < 0) {
    currentPos = 0;
  } else if (currentPos + (tableSize * 4) > 0xffffff) {
    currentPos = 0x1000000 - (tableSize * 4);
  }
  var container = document.getElementById("memory-body");
  var rows = container.rows;
  if (rows.length < tableSize) { // add rows
    for (var i = rows.length; i < tableSize; i++) {
      document.getElementById("memory-body").innerHTML += createNewRow(i*4, i);
    }
  } else if (rows.length > tableSize) { // delete rows
    for (var i = rows.length - 1; i >= tableSize; i--) {
      document.getElementById("memory-body").removeChild(rows[i]);
    }
  }
  for (var i = 0; i < tableSize; i++) {
    var address = document.getElementById("memory-address-" + i);
    var value = document.getElementById("memory-value-" + i);
    var assignedAddress = currentPos + (i*4);
    address.innerHTML = hexToStr(assignedAddress, 6);
    value.innerHTML = hexToStr(VM.memory[assignedAddress]);
  }
}
function showEditedValue(address, value) {
  // if the address is displayed in the table, update the table
  if (address >= currentPos && address < currentPos + (tableSize*4)) {
    updateMemoryTable();
    flashBox("memory", (address - currentPos) / 4);
  }
  // if the address is a register, update the register table
  if (address >= 0x11ff00 && address <= 0x11ff40) {
    var registerName = regNames2[(address - 0x11ff00) / 4];
    document.getElementById(registerName).innerHTML = hexToStr(value);
    flashBox("register", registerName);
  }
}