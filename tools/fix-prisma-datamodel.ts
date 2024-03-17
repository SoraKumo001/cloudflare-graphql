import fs from 'fs';

const srcPath = 'node_modules/.prisma/client/index.js';
const destPath = 'node_modules/.prisma/client/wasm.js';

const src = fs.readFileSync(srcPath);
const runtimeDataModel = String(src).match(/config\.runtimeDataModel = JSON\.parse\(".*"\)/)?.[0];
if (runtimeDataModel) {
	const dist = fs.readFileSync(destPath);
	const newRuntimeDataModel = String(dist).replace(/config\.runtimeDataModel = JSON\.parse\(".*"\)/, runtimeDataModel);
	fs.writeFileSync(destPath, newRuntimeDataModel);
}
