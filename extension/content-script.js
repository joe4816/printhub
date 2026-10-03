(() => {
  'use strict';

  const CHANNEL='PRINTHUB_BRIDGE_V1';

  window.addEventListener('message', async event => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const msg = event.data || {};
    if (msg.channel !== CHANNEL || msg.source !== 'PRINTHUB_PAGE' || msg.type !== 'request' || !msg.id) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type:'PRINTHUB_REQUEST',
        action:String(msg.action || ''),
        payload:msg.payload || {}
      });

      window.postMessage({
        channel:CHANNEL,
        source:'PRINTHUB_EXTENSION',
        type:'response',
        id:msg.id,
        ok:Boolean(response && response.ok),
        value:response && response.value,
        error:response && response.error
      }, window.location.origin);
    } catch (err) {
      window.postMessage({
        channel:CHANNEL,
        source:'PRINTHUB_EXTENSION',
        type:'response',
        id:msg.id,
        ok:false,
        error:String(err && err.message || err)
      }, window.location.origin);
    }
  });

  chrome.runtime.onMessage.addListener(msg => {
    if (!msg || msg.type !== 'PRINTHUB_EVENT') return;
    window.postMessage({
      channel:CHANNEL,
      source:'PRINTHUB_EXTENSION',
      type:'event',
      event:msg.event,
      value:msg.value
    }, window.location.origin);
  });
})();
