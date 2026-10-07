import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildPassKioskPdf, buildPassKioskReceiptPdf, PASSKIOSK_PAPER_PROFILES} from '../shared/passkiosk-receipt-pdf.js';

const base = {
  'Student Name':'Sample Student', 'Student ID':'TEST-ONLY', Grade:8,
  'Created At':'2026-10-07T13:42:00Z', 'Session User':'Sal', 'Issued By':'Sal',
  'Requested By':'Sal', 'Approved By':'Sal', 'Transaction ID':'SAMPLE-NOT-RECORDED',
  From:'Office - Room 239', To:'Rm 202 / Teacher', Destination:'Office - Room 239',
  'Delivery Period':'P1', 'Delivery Room':'109', 'Delivery Teacher':'Teacher', When:'Immediately',
  'Detention Date':'2026-10-07', 'Report To':'Room 602', 'Reason(s)':'Sample infraction',
  'Directions Snapshot':'Report by 1:46 PM.\nReleased at 4:20 PM.\nLate bus Monday through Thursday.',
  'Bus Route(s)':'TEST ROUTE', 'Bus Drop-off(s)':'TEST STOP',
  'Signature Raster':{width:2, height:1, grayHex:'00ff'}
};
const pdf = d => Buffer.from(d.pdfBase64, 'base64').toString('latin1');
for (const paper of Object.keys(PASSKIOSK_PAPER_PROFILES)) {
  for (const variant of ['PASS', 'PASS_EXCUSED', 'RQST', 'LUNCH_DET', 'DET', 'BUS']) {
    test(paper + ' retains approved fields, signature, and sheet geometry for ' + variant, () => {
      const tx = {...base, Workflow:variant === 'PASS_EXCUSED' ? 'PASS' : variant, Excused:variant === 'PASS_EXCUSED'};
      const doc = buildPassKioskPdf(tx, paper), content = pdf(doc);
      assert.equal(doc.widthMicrons, PASSKIOSK_PAPER_PROFILES[paper].widthMicrons);
      if (paper !== '80MM_RECEIPT') assert.equal(doc.heightMicrons, 139700);
      assert.ok(doc.layoutScale >= 0.7);
      assert.match(content, /SAMPLE-NOT-RECORDED/);
      assert.match(content, /\/Sig Do/);
      assert.match(content, /Ernest A\. Becker Sr\. Middle School/);
      if (tx.Workflow === 'PASS') {
        for (const value of ['CORRIDOR PASS', 'EXCUSED', 'Time returned', 'Signed', 'This pass must be returned']) assert.ok(content.includes(value));
        assert.ok(content.includes(tx.Excused ? 'Excused by' : 'Signed by'));
      } else if (tx.Workflow === 'RQST') {
        assert.ok(content.includes('REQUEST FOR STUDENT'));
        assert.ok(content.indexOf('DELIVER TO:') < content.indexOf('Ernest A. Becker'));
        assert.ok(content.includes('Sent back to class by'));
      } else if (['DET','LUNCH_DET'].includes(tx.Workflow)) {
        for (const value of ['Dear Parent/Guardian', 'ISSUED', 'Administrator Signature', 'Student Signature', 'Parent Signature']) assert.ok(content.includes(value));
        assert.ok(content.indexOf('Sal') < content.indexOf('INFRACTION'));
        assert.ok(!content.includes('Issued by'));
        assert.ok(content.includes('Oct 7, 2026'));
      } else assert.ok(content.includes('ACTIVITY BUS PASS'));
    });
  }
}
test('all six receipt variants preserve the approved 0.8.2 PDF bytes', () => {
  // Baseline hashes from the deployed 0.8.2 renderer, commit f7d95ef.
  const hashes = {
    PASS:'00102b1847f67e3b4b64a6f4413b5944cb3d6f8515e28b8feb8b714db9b2b4b0',
    PASS_EXCUSED:'8017b35c9effc9bdd5b4b809134e00b1b7de57ae58dda787684135c8584397b5',
    RQST:'5dce52e993a25e242e677a89ccf4c00b6898350a9b0762bee36d85972c995398',
    LUNCH_DET:'05e363b90d2595fa975a8d6d974d130fb6f96d0f44c4c62cf3ff6af9878e5966',
    DET:'6c4b8dc82c542c285817ed783e306010d33481489830b4c667ddbbbfaea6ab9e',
    BUS:'b725cedf39ab1ba936a279e7244b7d3758e94101cf4a9e8651d7488db5673a5e'
  };
  for (const [variant, hash] of Object.entries(hashes)) {
    const tx = {...base,Workflow:variant === 'PASS_EXCUSED' ? 'PASS' : variant,Excused:variant === 'PASS_EXCUSED'};
    assert.equal(createHash('sha256').update(Buffer.from(buildPassKioskReceiptPdf(tx).pdfBase64,'base64')).digest('hex'), hash, variant);
  }
});
test('fixed paper refuses content that would be unreadable instead of clipping', () => {
  assert.throws(() => buildPassKioskPdf({...base,Workflow:'DET','Reason(s)':'Long infraction '.repeat(200)},'B6'), /too long/);
});
