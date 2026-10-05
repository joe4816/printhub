import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPassKioskReceiptPdf} from '../shared/passkiosk-receipt-pdf.js';

function decoded(doc) {
  return Buffer.from(doc.pdfBase64, 'base64').toString('latin1');
}

test('PASS receipt stays portrait and always renders an Excused checkbox label', () => {
  for (const excused of [true, false]) {
    const doc = buildPassKioskReceiptPdf({
      Workflow:'PASS',
      'Student Name':'Sample Student',
      Grade:'8',
      From:'Office - Room 239',
      To:'Rm 206 - Poling',
      Excused:excused,
      'Created At':'2026-10-05T18:00:00Z',
      'Transaction ID':'PK-TEST',
      'Session User':'Test User'
    });

    assert.equal(doc.widthMicrons, 80000);
    assert.ok(doc.heightMicrons >= 90000);
    assert.match(decoded(doc), /EXCUSED/);
    assert.match(decoded(doc), /MediaBox/);
  }
});

test('REQUEST and detention receipts use the same portrait-safe geometry', () => {
  const request = buildPassKioskReceiptPdf({
    Workflow:'RQST',
    'Student Name':'Jordan Smith',
    Grade:'8',
    Destination:'Back Office',
    'Requested By':'L. Siqueiros',
    When:'Immediately',
    'Reason(s)':'Going Home',
    'Transaction ID':'PK-RQST'
  });
  const detention = buildPassKioskReceiptPdf({
    Workflow:'DET',
    'Student Name':'Jordan Smith',
    Grade:'8',
    'Issued By':'J. Nagy',
    'Detention Date':'2026-10-06T12:00:00-07:00',
    'Report To':'Room 239',
    'Reason(s)':'Tardy',
    'Directions Snapshot':'Bring Chromebook\nReport by 2:15 PM',
    'Transaction ID':'PK-DET'
  });

  assert.ok(request.heightMicrons >= 90000);
  assert.ok(detention.heightMicrons >= 90000);
});
