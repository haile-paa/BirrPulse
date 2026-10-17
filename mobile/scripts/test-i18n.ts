import assert from 'node:assert/strict';
import { AM } from '@/i18n/am';
import { setLang } from '@/i18n/lang';
import { t, tr } from '@/i18n/core';

// English is the identity
setLang('en');
assert.equal(tr('Wallet'), 'Wallet');
assert.equal(t('Add to {name}', { name: 'Phone' }), 'Add to Phone');

setLang('am');
assert.equal(tr('Wallet'), 'ቦርሳ');
assert.equal(tr('  Wallet '), '  ቦርሳ ', 'surrounding whitespace is preserved');
assert.equal(tr('Totally unknown string'), 'Totally unknown string', 'missing translations fall back to English');
assert.equal(t('Add to {name}', { name: 'Phone' }), 'ወደ Phone ጨምር');
assert.equal(t('{n} day(s) to go', { n: 3 }), '3 ቀን(ቶች) ይቀራሉ');
assert.equal(tr('Oct'), 'ኦክቶ');

// Every translation keeps the same {placeholders} as its English template, and none is empty.
const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
let n = 0;
for (const [en, am] of Object.entries(AM)) {
  assert.ok(am.trim().length > 0, `empty translation for "${en}"`);
  assert.equal(ph(am), ph(en), `placeholders differ for "${en}"`);
  assert.ok(/[\u1200-\u137F]/.test(am) || /^[\d\s.·%{}\w()/-]+$/.test(am), `"${en}" does not look Amharic`);
  n++;
}
setLang('en');
console.log(`i18n tests passed (${n} translations)`);
