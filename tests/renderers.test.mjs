import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDocument, pageStyleFor } from '../shared/renderers.js';

test('80mm renderer produces receipt document', () => {
  const rendered = renderDocument({
    routeId:'AP_RECEIPT',
    routeLabel:'AP Receipt',
    rendererId:'GENERIC_RECEIPT',
    mediaProfileId:'80MM_RECEIPT'
  }, {
    title:'Student Pass',
    fields:[{label:'Student',value:'Sample Student'}]
  });

  assert.equal(rendered.mediaProfileId, '80MM_RECEIPT');
  assert.match(rendered.pageStyle, /80mm/);
  assert.match(rendered.html, /ph-receipt/);
  assert.match(rendered.html, /Sample Student/);
});

test('letter renderer produces file-copy document', () => {
  const rendered = renderDocument({
    routeId:'AP_FILE',
    routeLabel:'AP File Copy',
    rendererId:'GENERIC_FILE',
    mediaProfileId:'LETTER_FILE'
  }, {
    title:'File Copy',
    fields:[{label:'Student',value:'Sample Student'}]
  });

  assert.match(rendered.pageStyle, /letter portrait/);
  assert.match(rendered.html, /ph-file-copy/);
  assert.match(rendered.html, /<table>/);
});

test('renderer escapes payload HTML', () => {
  const rendered = renderDocument({
    routeId:'AP_RECEIPT',
    rendererId:'GENERIC_RECEIPT',
    mediaProfileId:'80MM_RECEIPT'
  }, {
    title:'<script>alert(1)</script>',
    fields:[{label:'Student',value:'<b>unsafe</b>'}]
  });

  assert.doesNotMatch(rendered.html, /<script>/);
  assert.doesNotMatch(rendered.html, /<b>unsafe<\/b>/);
  assert.match(rendered.html, /&lt;script&gt;/);
  assert.match(rendered.html, /&lt;b&gt;unsafe&lt;\/b&gt;/);
});

test('unsupported media profile is rejected', () => {
  assert.throws(() => pageStyleFor('UNKNOWN'), /Unsupported media profile/);
});
