const path = require('path');
const fs = require('fs/promises');
const { existsSync } = require('fs');
const { spawn } = require('child_process');

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit', shell: true });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const posDir = path.join(repoRoot, 'snackhouse-pos');
  const posPackageJson = path.join(posDir, 'package.json');
  if (!existsSync(posPackageJson)) {
    throw new Error(`Could not find POS app at ${posPackageJson}`);
  }

  // Build the React app.
  await run('npm', ['install'], posDir);
  await run('npm', ['run', 'build'], posDir);

  // Copy build output into the API, so the web service can serve it.
  const srcBuildDir = path.join(posDir, 'build');
  const destPublicDir = path.join(__dirname, '..', 'public');

  await fs.rm(destPublicDir, { recursive: true, force: true });
  await fs.mkdir(destPublicDir, { recursive: true });
  await fs.cp(srcBuildDir, destPublicDir, { recursive: true });

  // Optional: keep SPA routing working on static hosts that look for _redirects.
  const redirectsFile = path.join(destPublicDir, '_redirects');
  if (!existsSync(redirectsFile)) {
    await fs.writeFile(redirectsFile, '/* /index.html 200\n', 'utf8');
  }

  // eslint-disable-next-line no-console
  console.log(`Copied POS build -> ${destPublicDir}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

