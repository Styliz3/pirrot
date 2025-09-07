// api/sdk.js
export default async function handler(req, res) {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  if(!clientId){
    res.setHeader('Content-Type','application/javascript');
    return res.send(`alert("Missing PAYPAL_CLIENT_ID env var");`);
  }
  // NOTE: switch to www.paypal.com for LIVE. Keep sandbox for testing.
  const sdk = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&components=buttons&intent=capture`;
  res.setHeader('Content-Type','application/javascript');
  res.send(`
    (function(){
      var s=document.createElement('script');
      s.src='${sdk}';
      s.onload=function(){ if(window.initPayPalButtons) window.initPayPalButtons(); };
      document.currentScript.parentNode.insertBefore(s, document.currentScript);
    })();
  `);
}
