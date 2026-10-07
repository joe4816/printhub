// Exact installed names supplied by the CUPS inventory. No default-printer fallback.
const PRINTER_ROUTES = Object.freeze([
  {key:'AP_COPIER',name:'AP Office Copier',mediaProfileId:'STATEMENT'},
  {key:'AP_TARDY',name:'AP Office Tardy Printer',mediaProfileId:'80MM_RECEIPT'},
  {key:'BACK_OFFICE',name:'Back Office',mediaProfileId:'B6'},
  {key:'MAIN_COPIER',name:'Main Office Copier',mediaProfileId:'STATEMENT'},
  {key:'RECEIPT1',name:'Receipt Printer 1',mediaProfileId:'80MM_RECEIPT'},
  {key:'RECEIPT2',name:'Receipt Printer 2',mediaProfileId:'80MM_RECEIPT'}
].map(Object.freeze));

function resolveExactPrinter(printers, binding, bindingKey) {
  const uri = String(binding.uri || '').trim();
  const name = String(binding.name || '').trim();
  if (!uri && !name) throw new Error('Binding ' + bindingKey + ' has no installed name or URI.');
  const byUri = uri ? printers.filter(p => String(p.uri || '') === uri) : [];
  const matches = byUri.length ? byUri : printers.filter(p => String(p.name || '') === name);
  if (matches.length !== 1) throw new Error(matches.length ?
    'Ambiguous installed printer for ' + bindingKey + '.' : 'Installed printer not found: ' + (name || uri));
  return matches[0];
}

function chooseProfileMedia(caps, profile, requestedHeight) {
  if (profile === '80MM_RECEIPT') return chooseMedia(caps, requestedHeight);
  if (!['STATEMENT','B6'].includes(profile)) throw new Error('Unsupported paper profile: ' + profile);
  const options = caps.media_size && caps.media_size.option || [];
  const label = m => [m.name,m.vendor_id,m.custom_display_name].join(' ').toUpperCase();
  const named = options.filter(m => !m.is_continuous_feed && (profile === 'B6' ?
    /(?:^|[^A-Z0-9])B6(?:[^A-Z0-9]|$)/.test(label(m)) :
    /STATEMENT|HALF[ _-]?LETTER/.test(label(m))));
  const geometric = options.filter(m => {
    const dims = [Number(m.width_microns),Number(m.height_microns)].sort((a,b)=>a-b);
    const wanted = profile === 'STATEMENT' ? [139700,215900] : [107950,139700];
    return !m.is_continuous_feed && dims.every((v,i)=>Math.abs(v-wanted[i])<=1500);
  });
  // Back Office's B6 is an intentional driver alias for loaded quarter-letter paper.
  const candidates = named.length ? named : geometric;
  const selected = candidates.find(m=>m.is_default) || candidates[0];
  if (!selected) throw new Error(profile + ' paper is not advertised by this installed printer.');
  if (!(selected.width_microns > 0 && selected.height_microns > 0)) throw new Error('Invalid copier media dimensions.');
  return {width_microns:selected.width_microns,height_microns:selected.height_microns,
    ...(selected.vendor_id ? {vendor_id:selected.vendor_id} : {})};
}

function buildProfileTicket(caps, media, trim, profile) {
  const ticket = buildTicket(caps, media, profile === '80MM_RECEIPT' && trim);
  if (profile === '80MM_RECEIPT') return ticket;
  const orientation = profile === 'STATEMENT' ? 'LANDSCAPE' : 'PORTRAIT';
  const orientationOptions = caps.page_orientation && caps.page_orientation.option || [];
  if (orientationOptions.length && !orientationOptions.some(o=>o.type===orientation)) {
    throw new Error('Printer does not advertise ' + orientation + ' orientation.');
  }
  const duplexOptions = caps.duplex && caps.duplex.option || [];
  if (duplexOptions.length && !duplexOptions.some(o=>o.type==='NO_DUPLEX')) throw new Error('Printer does not advertise single-sided printing.');
  ticket.print.page_orientation = {type:orientation};
  ticket.print.duplex = {type:'NO_DUPLEX'};
  return ticket;
}
