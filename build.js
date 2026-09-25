const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'frontend', 'dist');
const destDir = path.join(__dirname, 'dist');

console.log('Copying frontend/dist to dist...');

if (fs.existsSync(destDir)) {
  fs.rmSync(destDir, { recursive: true, force: true });
}
if (fs.existsSync(path.join(__dirname, 'public'))) {
  fs.rmSync(path.join(__dirname, 'public'), { recursive: true, force: true });
}

if (fs.existsSync(srcDir)) {
  fs.cpSync(srcDir, destDir, { recursive: true });
  fs.cpSync(srcDir, path.join(__dirname, 'public'), { recursive: true });
  console.log('Successfully moved frontend build to root dist and public folders.');
} else {
  console.error('frontend/dist does not exist! Build might have failed.');
  process.exit(1);
}
