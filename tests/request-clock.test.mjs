import test from 'node:test';
import assert from 'node:assert/strict';
import {requestClockTime} from '../shared/request-clock.js';
import {buildPassKioskPdf} from '../shared/passkiosk-receipt-pdf.js';
import {passKioskDocumentModel} from '../adapters/passkiosk.js';

test('request times accept Sheets time cells and ordinary app values', () => {
  for (const input of ['1899-12-30T21:31:00.000Z', new Date('1899-12-30T21:31:00.000Z'), '13:31', '1:31 PM', 811 / 1440]) {
    assert.equal(requestClockTime(input), '1:31 PM');
  }
  assert.equal(requestClockTime('00:00'), '12:00 AM');
  assert.equal(requestClockTime('12:00'), '12:00 PM');
  assert.equal(requestClockTime('08:05'), '8:05 AM');
  assert.equal(requestClockTime(''), '');
  assert.equal(requestClockTime('not a time'), 'not a time');
});

test('regular and linked requests format WHEN across every paper profile', () => {
  for (const id of ['REQUEST', 'DETENTION-RQST']) {
    const tx = {Workflow:'RQST', 'Transaction ID':id, 'Student Name':'SAMPLE', When:'At:', 'At Time':'1899-12-30T21:31:00.000Z'};
    assert.equal(passKioskDocumentModel(tx).fields.find(f => f.label === 'When').value, 'At 1:31 PM');
    for (const profile of ['80MM_RECEIPT','STATEMENT','A6','B6']) {
      const pdf = Buffer.from(buildPassKioskPdf(tx, profile).pdfBase64, 'base64').toString();
      assert.match(pdf, /\(At 1:31 PM\) Tj/);
      assert.doesNotMatch(pdf, /1899/);
    }
  }
  assert.equal(passKioskDocumentModel({Workflow:'RQST',When:'Immediately'}).fields.find(f => f.label === 'When').value, 'Immediately');
});
