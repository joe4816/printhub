import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPassKioskReceiptPdf, buildPrintablePassKioskReceiptPdf} from '../shared/passkiosk-receipt-pdf.js';

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

test('call-pass delivery header precedes school and restores the return signature/time', () => {
  const pdf = decoded(buildPassKioskReceiptPdf({
    Workflow:'RQST', 'Student Name':'Sample Student',
    'Delivery Period':'P2', 'Delivery Room':'202', 'Delivery Teacher':'Edmondson',
    Destination:'Office', When:'Immediately', 'Requested By':'Joseph Nagy'
  }));
  assert.ok(pdf.indexOf('DELIVER TO: P2 / Rm 202 / Edmondson') < pdf.indexOf('Middle School'));
  assert.match(pdf, /REQUEST FOR STUDENT/);
  assert.match(pdf, /Sample Student/);
  assert.match(pdf, /Sent back to class by/);
  assert.match(pdf, /J\. Nagy/);
  assert.match(pdf, /\(@\) Tj/);
});

test('hall pass keeps explicit excused status separate from reason and restores return fields', () => {
  for (const excused of [true, false]) {
    const pdf = decoded(buildPassKioskReceiptPdf({
      Workflow:'PASS', Excused:excused, 'Session User':'Derek Krallman'
    }));
    assert.match(pdf, excused ? /Excused by/ : /Signed by/);
    assert.match(pdf, /D\. Krallman/);
    assert.match(pdf, /Time returned/);
    assert.match(pdf, /\(Signed\) Tj/);
    assert.match(pdf, /This pass must be returned/);
    assert.doesNotMatch(pdf, /REASON \/ EXCUSED FOR/);
  }
});

test('detention has its identifiers, date issued, date(s) and separate direction bullets', () => {
  const pdf = decoded(buildPassKioskReceiptPdf({
    Workflow:'DET', 'Student Name':'Sample Student', 'Student ID':'TEST-123',
    Grade:8, 'Created At':'2026-10-07T00:31:00Z',
    'Detention Dates':['2026-10-07','2026-10-08'],
    'Directions Snapshot':'First instruction\nSecond instruction'
  }));
  assert.match(pdf, /Student ID: TEST-123/);
  assert.match(pdf, /Dear Parent\/Guardian/);
  assert.match(pdf, /Student Signature/);
  assert.match(pdf, /Parent Signature/);
  assert.match(pdf, /\(ISSUED\) Tj/);
  assert.match(pdf, /Oct 6, 2026, 5:31 PM/);
  assert.match(pdf, /Oct 7, 2026, Oct 8, 2026/);
  assert.match(pdf, /- First instruction/);
  assert.match(pdf, /- Second instruction/);
  assert.match(pdf, /Room 602/);
});

test('both detention notices keep issuer with issue date above infraction and detention dates', () => {
  for (const Workflow of ['DET', 'LUNCH_DET']) {
    const pdf = decoded(buildPassKioskReceiptPdf({Workflow,
      'Issued By':'Joseph Nagy', 'Created At':'2026-10-07T13:42:00Z',
      'Reason(s)':'TEST INFRACTION', 'Detention Date':'2026-10-07'}));
    assert.match(pdf, /Oct 7, 2026, 6:42 AM \/ J\. Nagy/);
    assert.ok(pdf.indexOf('J. Nagy') < pdf.indexOf('DETENTION DATE'));
    assert.ok(pdf.indexOf('J. Nagy') < pdf.indexOf('INFRACTION'));
    assert.doesNotMatch(pdf, /\(Issued by\) Tj/);
    assert.match(pdf, /Administrator Signature/);
  }
});

test('activity bus has a complete template instead of generic workflow fallback', () => {
  const pdf = decoded(buildPassKioskReceiptPdf({
    Workflow:'BUS', 'Student Name':'Sample Student',
    'Bus Route(s)':'TEST ROUTE', 'Bus Drop-off(s)':'TEST STOP', 'Approved By':'Joseph Nagy'
  }));
  assert.match(pdf, /ACTIVITY BUS PASS/);
  assert.match(pdf, /TEST ROUTE/);
  assert.match(pdf, /TEST STOP/);
  assert.match(pdf, /Administrator \/ Teacher/);
  assert.doesNotMatch(pdf, /\(Signature\)/);
  assert.doesNotMatch(pdf, /\(WORKFLOW\)/);
});

test('WinAnsi preserves Spanish names and converts room separators into readable text', () => {
  const pdf = decoded(buildPassKioskReceiptPdf({
    Workflow:'PASS', 'Student Name':'José Muñoz',
    To:'Rm 202 · Edmondson', 'Session User':'L. Siqueiros'
  }));
  assert.match(pdf, /Jos\\351 Mu\\361oz/);
  assert.match(pdf, /Rm 202 \/ Edmondson/);
  assert.doesNotMatch(pdf, /Rm 202 \? Edmondson/);
  assert.match(pdf, /WinAnsiEncoding/);
});


test('stored signature raster is embedded as an image; no blank signature substitute', () => {
  const pdf = decoded(buildPassKioskReceiptPdf({Workflow:'PASS', 'Session User':'Test Adult',
    'Signature Raster':{width:2, height:2, grayHex:'ff0000ff'}}));
  assert.match(pdf, /\/Subtype \/Image/);
  assert.match(pdf, /\/Sig 7 0 R/);
  assert.match(pdf, /\/Sig Do/);
  assert.doesNotMatch(pdf, /\(Signature\)/);
  assert.match(pdf, /Time returned/);
    assert.match(pdf, /\(Signed\) Tj/);
});

test('a configured but missing signature stops production printing', async () => {
  await assert.rejects(buildPrintablePassKioskReceiptPdf({Workflow:'PASS',
    'Signature File':'test.png'}), /not supplied by the backend/);
  assert.throws(() => buildPassKioskReceiptPdf({Workflow:'PASS',
    'Signature Raster':{width:2, height:2, grayHex:'00'}}), /Invalid signature/);
});
