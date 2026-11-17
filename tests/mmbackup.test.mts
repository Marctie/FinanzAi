// Test dell'importazione Money Manager su un database finto con la stessa struttura (nessun dato reale).
// Uso: node --no-warnings tests/mmbackup.test.mts
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { zipSync, unzipSync } from 'fflate';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { argbToHex, buildImport, defaultMapping, extractDatabase, readMmData, NEW_CATEGORY } from '../src/app/core/mmbackup.ts';

const dir = mkdtempSync(join(tmpdir(), 'mm-'));
const dbPath = join(dir, 'MyFinance.db');
const db = new DatabaseSync(dbPath);
db.exec(`
  create table category (uid text, title text, type text, icon text, color integer, limitAmount integer, isRemoved integer, position integer);
  create table account (uid text, title text);
  create table "transaction" (uid text, type text, amountInAccountCurrency integer, amountInDefaultCurrency integer,
    accountCurrencyCode text, date text, comment text, isRemoved integer);
  create table sync_link (entityType text, entityUid text, otherType text, otherUid text, isRemoved integer);
  create table reminding (uid text, title text);
  insert into category values ('c1','', 'Expense','products', 4293553944, 0, 0, 1),
                              ('c2','Edicola','Expense','books', 4294095112, 5000, 0, 2),
                              ('c3','', 'Income','prepaid', 4281235663, 0, 0, 3),
                              ('c4','Vecchia','Expense','other', 0, 0, 1, 4);
  insert into account values ('a1',''), ('a2','Credito');
  insert into "transaction" values ('t1','Expense',1250,1250,'EUR','2025-05-04','Esselunga',0),
                                   ('t2','Expense',500,500,'EUR','2025-05-05','',0),
                                   ('t3','Income',180000,180000,'EUR','2025-05-27','',0),
                                   ('t4','Expense',999,999,'EUR','2025-05-06','cancellato',1),
                                   ('t5','Expense',700,700,'EUR','2025-06-01','',0);
  insert into sync_link values ('Transaction','t1','Category','c1',0), ('Transaction','t2','Category','c2',0),
                               ('Transaction','t3','Category','c3',0), ('Transaction','t2','Account','a2',0),
                               ('Transaction','t5','Category','c1',1),
                               ('Reminding','r1','RegularPaymentPeriod','p1',0), ('RegularPaymentPeriod','p1','Transaction','t3',0);
  insert into reminding values ('r1','Stipendio mensile');
`);
db.close();

// Il file vero è: 8 byte di prefisso + ZIP con MyFinance.db e foto
const zip = zipSync({ 'MyFinance.db': new Uint8Array(readFileSync(dbPath)), 'backup_meta': new TextEncoder().encode('{}') });
const file = new Uint8Array(8 + zip.length); file.set(new Uint8Array(8).fill(8)); file.set(zip, 8);
const extracted = extractDatabase(file, unzipSync);
writeFileSync(join(dir, 'x.db'), extracted);
const db2 = new DatabaseSync(join(dir, 'x.db'), { readOnly: true });
const data = readMmData(sql => db2.prepare(sql).all() as Record<string, unknown>[]);

let n = 0; const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok', name); };
t('movimenti cancellati esclusi, importi da centesimi', () => {
  assert.equal(data.transactions.length, 4);
  assert.equal(data.expense, 12.5 + 5 + 7);
  assert.equal(data.income, 1800);
});
t('categorie predefinite riconosciute dall\'icona, cancellate escluse', () => {
  assert.deepEqual(data.categories.map(c => c.title).sort(), ['Spesa alimentare', 'Stipendio', 'Edicola']);
  assert.equal(argbToHex(4293553944), '#eb9918'.replace('eb9918', (4293553944 & 0xffffff).toString(16).padStart(6, '0')));
});
const targets = [{ id: 'spesa', name: 'Spesa', type: 'expense' as const }, { id: 'stipendio', name: 'Stipendio', type: 'income' as const },
  { id: 'altro-uscita', name: 'Altro', type: 'expense' as const }, { id: 'altro-entrata', name: 'Altro', type: 'income' as const }];
const mapping = defaultMapping(data.categories, targets);
t('abbinamento proposto', () => {
  assert.equal(mapping['c1'], 'spesa');
  assert.equal(mapping['c3'], 'stipendio');
  assert.equal(mapping['c2'], NEW_CATEGORY);
});
const res = buildImport(data, mapping, { budgets: true, recurring: true, month: '2026-11' });
t('conversione: id stabili, titoli, metodo di pagamento, ricorrenze, budget', () => {
  const byId = Object.fromEntries(res.transactions.map(x => [x.id, x]));
  assert.equal(byId['mm-t1'].title, 'Esselunga');
  assert.equal(byId['mm-t1'].category, 'spesa');
  assert.equal(byId['mm-t2'].title, 'Edicola');
  assert.equal(byId['mm-t2'].category, 'custom-mm-c2');
  assert.equal(byId['mm-t2'].paymentMethod, 'carta-credito');
  assert.equal(byId['mm-t3'].isRecurring, true);
  assert.equal(byId['mm-t3'].recurringId, 'mm-r1');
  assert.equal(byId['mm-t3'].title, 'Stipendio mensile');
  assert.equal(byId['mm-t5'].category, 'altro-uscita');          // collegamento alla categoria cancellato
  assert.deepEqual(res.newCategories.map(c => c.name), ['Edicola']);
  assert.deepEqual(res.budgets.map(b => [b.categoryId, b.amount]), [['custom-mm-c2', 50]]);
});
t('file non valido', () => {
  assert.throws(() => extractDatabase(new Uint8Array([1, 2, 3, 4, 5, 6]), unzipSync), /non sembra un backup/);
});
db2.close();
console.log(`\n${n} test superati`);
