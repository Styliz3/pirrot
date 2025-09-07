const WEBHOOK_URL = "https://discord.com/api/webhooks/1414199129952747570/CB6A3V7d6utc32CJzHWxXYEeIla965F0YESdm1mvGtI3jLpJ7LWJq1YsqYFF1ZQYKJPB";

// Sound effect assets only
const ASSETS = [
  {
    id: "vine-boom",
    name: "Vine Boom",
    url: "https://www.myinstants.com/media/sounds/vine-boom.mp3",
    filename: "vine-boom.mp3",
    tags: ["meme", "boom"],
  },
  {
    id: "oh-hell-naw",
    name: "Oh Hell Naw",
    url: "https://www.myinstants.com/media/sounds/oh-hell-naw-man-wtf-man.mp3",
    filename: "oh-hell-naw.mp3",
    tags: ["meme", "reaction"],
  },
  {
    id: "apple-pay",
    name: "Apple Pay",
    url: "https://www.myinstants.com/media/sounds/apple-pay.mp3",
    filename: "apple-pay.mp3",
    tags: ["apple", "sfx"],
  }
];

let packageMode = new Set();

function router() {
  const path = window.location.pathname;
  const app = document.getElementById("app");
  if (path.startsWith("/order/")) {
    const id = path.split("/order/")[1];
    const asset = ASSETS.find(a=>a.id===id);
    app.innerHTML = renderOrder(asset);
    attachOrderEvents(asset);
  } else {
    app.innerHTML = renderExplore();
    attachExploreEvents();
  }
}

function renderExplore() {
  return `
    <div class="grid">
      ${ASSETS.map(a=>`
        <div class="card">
          <h3>${a.name}</h3>
          <div>${a.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
          <button class="btn" data-download="${a.id}">Download</button>
          <label><input type="checkbox" data-pack="${a.id}"> Add to package</label>
        </div>
      `).join("")}
    </div>
  `;
}

function attachExploreEvents() {
  document.querySelectorAll("[data-download]").forEach(btn=>{
    btn.onclick = async ()=>{
      const id = btn.dataset.download;
      const asset = ASSETS.find(a=>a.id===id);
      await downloadAsset(asset);
      history.pushState({}, "", `/order/${id}`);
      router();
    };
  });
  document.querySelectorAll("[data-pack]").forEach(cb=>{
    cb.onchange = ()=>{
      if (cb.checked) packageMode.add(cb.dataset.pack);
      else packageMode.delete(cb.dataset.pack);
      updatePackBar();
    };
  });
}

function renderOrder(asset) {
  return `
    <div class="order">
      <h2>Order: ${asset.name}</h2>
      <p><b>ID:</b> ${asset.id}</p>
      <p><b>File:</b> ${asset.filename}</p>
      <input id="social" placeholder="Your social link (optional)"/>
      <button id="sendSocial" class="btn">Send</button>
    </div>
  `;
}

function attachOrderEvents(asset) {
  document.getElementById("sendSocial").onclick = ()=>{
    const link = document.getElementById("social").value.trim();
    if (!link) return;
    fetch(WEBHOOK_URL, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        embeds:[{
          title:"New Download Social Link",
          description:`Asset: **${asset.name}**\nLink: ${link}`,
          color:0x5865F2
        }]
      })
    });
    alert("Thanks! Sent to us.");
  };
}

async function downloadAsset(asset) {
  try {
    const res = await fetch(asset.url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = asset.filename;
    a.click();
    URL.revokeObjectURL(a.href);
    sendWebhook(asset);
  } catch (e) {
    alert("Could not fetch asset due to CORS. Still logged download.");
    sendWebhook(asset);
  }
}

function sendWebhook(asset) {
  fetch(WEBHOOK_URL, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      embeds:[{
        title:"Download",
        description:`**${asset.name}** downloaded\nID: ${asset.id}`,
        color:0x00ff00
      }]
    })
  });
}

function updatePackBar() {
  const bar = document.getElementById("packBar");
  if (packageMode.size>0) {
    bar.style.display="flex";
    document.getElementById("packCount").textContent = packageMode.size+" selected";
  } else {
    bar.style.display="none";
  }
}

document.getElementById("downloadZip").onclick = async ()=>{
  const zip = new JSZip();
  for (const id of packageMode) {
    const asset = ASSETS.find(a=>a.id===id);
    try {
      const res = await fetch(asset.url);
      const blob = await res.blob();
      zip.file(asset.filename, blob);
    } catch(e) {}
  }
  const blob = await zip.generateAsync({type:"blob"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "package.zip";
  a.click();
  URL.revokeObjectURL(a.href);
  fetch(WEBHOOK_URL, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({content:`ZIP package downloaded (${packageMode.size} files)`})
  });
};

document.getElementById("clearPack").onclick = ()=>{
  packageMode.clear();
  updatePackBar();
  router();
};

document.getElementById("nav-explore").onclick = ()=>{
  history.pushState({}, "", "/");
  router();
};

window.onpopstate = router;
router();
