// Exact installed names supplied by the CUPS inventory. No default-printer fallback.
export const PRINTER_ROUTES = Object.freeze([
  {key:'AP_COPIER',name:'AP Office Copier',mediaProfileId:'STATEMENT'},
  {key:'AP_TARDY',name:'AP Office Tardy Printer',mediaProfileId:'80MM_RECEIPT'},
  {key:'BACK_OFFICE',name:'Back Office',mediaProfileId:'A6'},
  {key:'CAFE_TARDY',name:'Cafe Tardy Printer',mediaProfileId:'80MM_RECEIPT'},
  {key:'MAIN_COPIER',name:'Main Office Copier',mediaProfileId:'STATEMENT'},
  {key:'RECEIPT1',name:'Receipt Printer 1',mediaProfileId:'80MM_RECEIPT'},
  {key:'RECEIPT2',name:'Receipt Printer 2',mediaProfileId:'80MM_RECEIPT'}
].map(Object.freeze));
