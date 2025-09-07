// api/sdk.js
export default async function handler(req, res) {
  const clientId = process.env.PAYPAL_CLIENT_ID; // set in Vercel env
  const sdkUrl = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&components=buttons&intent=capture`;
  const js = `
    (function(){
      var s=document.createElement('script');
      s.src='${sdkUrl}';
      s.onload=function(){ if(window.initPayPalButtons) window.initPayPalButtons('${clientId}'); };
      document.currentScript.parentNode.insertBefore(s, document.currentScript);
    })();
  `;
  res.setHeader('Content-Type','application/javascript');
  res.send(js);
}
