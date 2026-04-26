const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const projectDir = context.packager.projectDir;
  const iconPath = path.join(projectDir, 'electron', 'assets', 'app-icon.ico');
  const exeName = `${context.packager.appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  const rcEditPath = path.join(projectDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe');

  if (!fs.existsSync(iconPath) || !fs.existsSync(exePath) || !fs.existsSync(rcEditPath)) {
    console.warn('[afterPack] No se pudo aplicar icono: falta icono, EXE o rcedit.');
    return;
  }

  const resultado = spawnSync(rcEditPath, [exePath, '--set-icon', iconPath], {
    stdio: 'inherit',
    windowsHide: true,
  });

  if (resultado.status !== 0) {
    console.warn(`[afterPack] rcedit devolvio codigo ${resultado.status}.`);
  }
};
