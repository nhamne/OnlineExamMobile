const fs = require('fs');
const vm = require('vm');

// Read the NativeWind data from the bundle directly (not the file we wrote)
const bundle = fs.readFileSync('debug_bundle.js', 'utf8');
const moduleStart = bundle.lastIndexOf('__d(function', bundle.indexOf('border-dashed'));
const nextModule = bundle.indexOf('\n__d(function', bundle.indexOf('border-dashed'));
const moduleCode = bundle.substring(moduleStart, nextModule);

// Extract just the injectData argument
const injectIdx = moduleCode.indexOf(').injectData)(');
const dataStart = injectIdx + ').injectData)('.length;

// Find matching close - track parens
let depth = 0;
let i = dataStart;
let foundStart = false;
for (; i < moduleCode.length; i++) {
  if (moduleCode[i] === '{' && !foundStart) { foundStart = true; depth = 1; continue; }
  if (foundStart) {
    if (moduleCode[i] === '{') depth++;
    if (moduleCode[i] === '}') depth--;
    if (depth === 0) break;
  }
}
const dataObj = moduleCode.substring(dataStart, i + 1);
console.log('Extracted object length:', dataObj.length);
console.log('First 100:', dataObj.substring(0, 100));
console.log('Last 100:', dataObj.substring(dataObj.length - 100));

// Now try to compile it with vm to get proper error info
const testCode = 'var __test = ' + dataObj + ';';
try {
  const script = new vm.Script(testCode, { filename: 'nw_test.js' });
  console.log('\nVALID JS for V8!');
  console.log('This means the issue is Hermes-specific.');
} catch (e) {
  console.log('\nINVALID JS for V8:', e.message);
  // Get position from error
  const match = e.stack.match(/nw_test\.js:(\d+):(\d+)/);
  if (match) {
    const line = parseInt(match[1]);
    const col = parseInt(match[2]);
    console.log('Line:', line, 'Col:', col);
    const lines = testCode.split('\n');
    if (lines[line-1]) {
      const errorLine = lines[line-1];
      console.log('Error line content around col', col, ':');
      console.log(errorLine.substring(Math.max(0, col - 80), col + 80));
      console.log(' '.repeat(Math.min(80, col)) + '^');
    }
  }
}
