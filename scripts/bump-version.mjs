// Numero di versione UNICO del progetto, aggiornato a ogni intervento.
// Aggiorna insieme: package.json, environment(.prod).ts (versione mostrata nell'app e inviata con la telemetria),
// android/app/build.gradle (versionName + versionCode, che il Play Store vuole sempre crescente).
//
// Uso:  node scripts/bump-version.mjs patch|minor|major     (oppure un numero preciso, es. 1.2.0)
//       node scripts/bump-version.mjs                       (mostra la versione attuale)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './env.mjs';

const pkgPath = join(ROOT, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const gradlePath = join(ROOT, 'android', 'app', 'build.gradle');
const gradle = readFileSync(gradlePath, 'utf8');
const code = Number(/versionCode (\d+)/.exec(gradle)?.[1] ?? 0);

const arg = process.argv[2];
if (!arg) {
  console.log(`versione ${pkg.version} (Android versionCode ${code})`);
  process.exit(0);
}

const [maj, min, pat] = pkg.version.split('.').map(Number);
const next = /^\d+\.\d+\.\d+$/.test(arg) ? arg
  : arg === 'major' ? `${maj + 1}.0.0`
  : arg === 'minor' ? `${maj}.${min + 1}.0`
  : arg === 'patch' ? `${maj}.${min}.${pat + 1}`
  : null;
if (!next) { console.error('Argomento non valido: patch | minor | major | X.Y.Z'); process.exit(1); }

pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
for (const f of ['environment.ts', 'environment.prod.ts']) {
  const p = join(ROOT, 'src', 'environments', f);
  writeFileSync(p, readFileSync(p, 'utf8').replace(/appVersion: '[^']*'/, `appVersion: '${next}'`));
}
writeFileSync(gradlePath, gradle
  .replace(/versionCode \d+/, `versionCode ${code + 1}`)
  .replace(/versionName "[^"]*"/, `versionName "${next}"`));
console.log(`versione ${next} (Android versionCode ${code + 1})`);
