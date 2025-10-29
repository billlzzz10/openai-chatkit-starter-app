if (!process.stdin.isTTY) {
  process.stdin.isTTY = true;
  process.stdin.setRawMode = process.stdin.setRawMode || function setRawMode() {};
  process.stdin.resume();
}
