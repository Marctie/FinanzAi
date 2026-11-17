// Test della logica pura (unione a tre vie, suddivisione spese, saldi). Uso: node tests/logic.test.mts
import assert from 'node:assert/strict';
import { mergeList, diffList } from '../src/app/core/merge.util.ts';
import { splitExpense, computeBalances, simplifyDebts, validateSplit } from '../src/app/core/balances.util.ts';

let n = 0; const t = (name: string, fn: () => void) => { fn(); n++; console.log('ok', name); };

t('unione: modifiche su elementi diversi si sommano', () => {
  const base = [{ id: 'a', v: 1, updatedAt: '1' }, { id: 'b', v: 1, updatedAt: '1' }];
  const local = [{ id: 'a', v: 2, updatedAt: '2' }, { id: 'b', v: 1, updatedAt: '1' }];
  const remote = [{ id: 'a', v: 1, updatedAt: '1' }, { id: 'b', v: 3, updatedAt: '3' }, { id: 'c', v: 1, updatedAt: '3' }];
  assert.deepEqual(mergeList(base, local, remote).map(x => [x.id, x.v]), [['a', 2], ['b', 3], ['c', 1]]);
});
t('unione: cancellazione da una parte, nessuna modifica dall’altra → cancellato', () => {
  const base = [{ id: 'a', v: 1 }], local: any[] = [], remote = [{ id: 'a', v: 1 }];
  assert.equal(mergeList(base, local, remote).length, 0);
});
t('unione: cancellato da me, modificato dall’altro → si tiene la modifica', () => {
  assert.deepEqual(mergeList([{ id: 'a', v: 1 }], [], [{ id: 'a', v: 9 }]), [{ id: 'a', v: 9 }]);
});
t('unione campo per campo: campi diversi si combinano, stesso campo vince il più recente', () => {
  const b = { id: 'a', title: 'x', amount: 10, updatedAt: '1' };
  const l = { id: 'a', title: 'loc', amount: 10, updatedAt: '2' };
  const r = { id: 'a', title: 'x', amount: 20, updatedAt: '3' };
  assert.deepEqual(mergeList([b], [l], [r])[0], { id: 'a', title: 'loc', amount: 20, updatedAt: '3' });
  const r2 = { id: 'a', title: 'rem', amount: 10, updatedAt: '3' };
  assert.equal(mergeList([b], [l], [r2])[0].title, 'rem');
});
t('unione senza base: niente viene perso', () => {
  assert.deepEqual(mergeList(null, [{ id: 'l' }], [{ id: 'r' }]).map(x => x.id).sort(), ['l', 'r']);
});
t('diff', () => {
  const d = diffList([{ id: 'a', v: 1 }, { id: 'b', v: 1 }], [{ id: 'a', v: 2 }, { id: 'c', v: 1 }]);
  assert.deepEqual([d.added.map(x => x.id), d.changed.map(x => x.id), d.removed.map(x => x.id)], [['c'], ['a'], ['b']]);
});
t('parti uguali con centesimi: 10 € tra 3 → 3,34 + 3,33 + 3,33', () => {
  const m = splitExpense(10, 'equal', [{ userId: 'A', value: 0 }, { userId: 'B', value: 0 }, { userId: 'C', value: 0 }]);
  assert.deepEqual([...m.values()], [334, 333, 333]);
});
t('percentuale', () => {
  const m = splitExpense(100, 'percent', [{ userId: 'A', value: 70 }, { userId: 'B', value: 30 }]);
  assert.deepEqual([m.get('A'), m.get('B')], [7000, 3000]);
});
t('importi', () => {
  const m = splitExpense(50, 'amount', [{ userId: 'A', value: 20 }, { userId: 'B', value: 30 }]);
  assert.deepEqual([m.get('A'), m.get('B')], [2000, 3000]);
});
t('validazione', () => {
  assert.match(validateSplit(100, 'percent', [{ userId: 'A', value: 50 }, { userId: 'B', value: 40 }])!, /100%/);
  assert.match(validateSplit(50, 'amount', [{ userId: 'A', value: 20 }])!, /devono fare 50/);
  assert.equal(validateSplit(50, 'equal', [{ userId: 'A', value: 0 }]), null);
});
t('saldi e chi deve a chi', () => {
  const e = (id: string, amount: number, paidBy: string, who: string[]) => ({ id, title: '', amount, date: '', category: '',
    paidBy, splitMode: 'equal' as const, shares: who.map(userId => ({ userId, value: 0 })), createdBy: '', createdAt: '', updatedAt: '' });
  const bal = computeBalances([e('1', 90, 'A', ['A', 'B', 'C']), e('2', 30, 'B', ['A', 'B', 'C'])], ['A', 'B', 'C']);
  assert.deepEqual(bal.map(b => [b.userId, b.net]), [['A', 50], ['B', -10], ['C', -40]]);
  assert.deepEqual(simplifyDebts(bal), [{ from: 'C', to: 'A', amount: 40 }, { from: 'B', to: 'A', amount: 10 }]);
  // un rimborso azzera il debito
  const settle = { ...e('3', 40, 'C', ['A']), isSettlement: true, splitMode: 'amount' as const, shares: [{ userId: 'A', value: 40 }] };
  const after = computeBalances([e('1', 90, 'A', ['A', 'B', 'C']), e('2', 30, 'B', ['A', 'B', 'C']), settle], ['A', 'B', 'C']);
  assert.deepEqual(simplifyDebts(after), [{ from: 'B', to: 'A', amount: 10 }]);
});
console.log(`\n${n} test superati`);
