var currentPos = 0; // address at top of table
function createNewRow(address, index) {
  return "<tr>"
      + "<td id=\"memory-address-" + index + "\">"
      + hexToStr(address, 6)
      + "</td>"
      + "<td id=\"memory-value-" + index + "\">"
      + hexToStr(getMemory(address, true))
      + "</td></tr>\n";
}
function updateMemoryTable(newAddress) {
  if (typeof newAddress != "undefined") {
    if (typeof newAddress == "string")
      newAddress = parseInt(newAddress, 16);
    newAddress -= (newAddress % 4); // align to memory
    if (isNaN(newAddress))
      return error("tried to view memory at a non-numerical address");
    if (newAddress < 0x000000 || newAddress >= 0xffffff)
      return error("tried to view memory at an out-of-bounds address: " + hexToStr(newAddress));
    currentPos = newAddress;
  }
  if (currentPos < 0)
    currentPos = 0;
  var container = document.getElementById("memory-body");
  var rows = container.rows;
  if (rows.length < 6) {
    for (var i = rows.length; i < 6; i++) {
      document.getElementById("memory-body").innerHTML += createNewRow(i*4, i);
    }
  } else if (rows.length > 6) { // should never happen
    for (var i = 6; i < rows.length; i++) {
      document.getElementById("memory-body").removeChild(rows[i]);
    }
  }
  for (var i = 0; i < 6; i++) {
    var address = document.getElementById("memory-address-" + i);
    var value = document.getElementById("memory-value-" + i);
    var assignedAddress = currentPos + (i*4);
    address.innerHTML = hexToStr(assignedAddress, 6);
    value.innerHTML = hexToStr(getMemory(assignedAddress, true));
  }
}