const fs = require('fs');
const vm = require('vm');

const bundle = fs.readFileSync('debug_bundle_new.js', 'utf8');
const nwStart = bundle.indexOf('border-dashed');

if (nwStart === -1) {
    console.log("Could not find 'border-dashed' in the bundle... This is odd.")
} else {
    try {
        const moduleStart = bundle.lastIndexOf('__d(function', nwStart);
        const nextModule = bundle.indexOf('\n__d(function', nwStart);
        const moduleCode = bundle.substring(moduleStart, nextModule);

        const injectIdx = moduleCode.indexOf(').injectData)(');
        const dataStart = injectIdx + ').injectData)('.length;

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

        console.log('New data length:', dataObj.length);
        const testCode = 'var __test = ' + dataObj + ';';
        const script = new vm.Script(testCode, { filename: 'nw_test_new.js' });
        console.log('\nVALID JS IN V8!');
    } catch (e) {
        console.log('Error analyzing:', e.message);
    }
}
