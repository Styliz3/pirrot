// Vercel serverless function (Edge-compatible) for DevPost MVP
// File path: /api/api.js
// NOTE: This demo stores data in-memory. Deploying will reset on cold start.
// For production, replace these with a real DB (Vercel Postgres / KV).

export const config = { runtime: 'edge' };

// ---- In-memory stores ----
const store = {
  users: new Map(), // email -> { id, email, username, ratingAverage, ratingCount }
  posts: new Map(), // id -> post
  postThrottle: new Map(), // userId -> timestamp
  ratings: [], // { id, fromId, toId, value, createdAt }
  reports: [], // { id, reporterId, targetType, targetId, reason, createdAt }
};

const MOD_CODE = process.env.MOD_ACCESS_CODE || 'letmein-f2-demo';

// Utility
const uid = ()n=> crypto.randomUUID();
const now = () => new Date();

function getOrCreateUser(profile){
  let u = store.users.get(profile.email);
  if (!u){
    u = { id: uid(), email: profile.email, username: profile.username || 'user'+Math.floor(Math.random()*9999), ratingAverage: 0, ratingCount: 0 };
    store.users.set(profile.email, u);
  } else if (profile.username && u.username !== profile.username){
    u.username = profile.username;
  }
  return u;
}

function json(res, status=200){
  return new Response(JSON.stringify(res), { status, headers: { 'Content-Type': 'application/json' }});
}

function bad(msg, status=400){ return new Response(msg, { status }); }

// Sorting helper for top list
function topSort(a,b){
  if (b.author.ratingAverage !== a.author.ratingAverage) return b.author.ratingAverage - a.author.ratingAverage;
  if (b.author.ratingCount !== a.author.ratingCount) return b.author.ratingCount - a.author.ratingCount;
  return new Date(b.createdAt) - new Date(a.createdAt);
}

// ---- Handlers ----
async function handleCreatePost(req){
  const body = await req.json();
  const { author, title, description, images, portfolio, socials, contact } = body || {};
  if (!author?.email || !author?.username) return bad('Unauthorized', 401);
  if (!title || !description) return bad('Missing fields');
  if (!Array.isArray(images) || images.length < 2) return bad('At least 2 images required');

  const user = getOrCreateUser(author);

  // throttle one per hour
  const last = store.postThrottle.get(user.id) || 0;
  if (Date.now() - last < 60*60*1000) return bad('One post per hour.', 429);

  const post = {
    id: uid(),
    createdAt: now().toISOString(),
    updatedAt: now().toISOString(),
    title, description, images, portfolio: portfolio||null, socials: socials||{}, contact: contact||null,
    status: 'ON_HOLD',
    authorId: user.id,
  };
  store.posts.set(post.id, post);
  store.postThrottle.set(user.id, Date.now());

  return json(serializePost(post));
}

async function handleListPosts(req){
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q')||'').toLowerCase();
  const order = searchParams.get('order') || 'top';
  const posts = [...store.posts.values()].filter(p => p.status === 'APPROVED');
  const filtered = q ? posts.filter(p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || getAuthor(p).username.toLowerCase().includes(q)) : posts;
  const result = filtered.map(serializePost);
  if (order==='new') result.sort((a,b)=> new Date(b.createdAt)-new Date(a.createdAt)); else result.sort(topSort);
  return json(result);
}

async function handleDeletePost(req){
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const body = await req.json().catch(()=>({}));
  const author = body.author;
  if (!id) return bad('Missing id');
  const post = store.posts.get(id);
  if (!post) return bad('Not found', 404);
  const user = author?.email ? getOrCreateUser(author) : null;
  if (!user || user.id !== post.authorId) return bad('Forbidden', 403);
  // soft delete
  post.status = 'DELETED';
  post.updatedAt = now().toISOString();
  // reset throttle
  store.postThrottle.delete(user.id);
  return new Response(null, { status: 204 });
}

async function handleRateUser(req){
  const { from, toEmail, value } = await req.json();
  if (!from?.email || !toEmail) return bad('Unauthorized', 401);
  const v = Number(value);
  if (!(v>=1 && v<=5)) return bad('Bad rating');
  const fromU = getOrCreateUser(from);
  const toU = getOrCreateUser({ email: toEmail });
  if (fromU.id === toU.id) return bad('Cannot rate yourself');
  const r = { id: uid(), fromId: fromU.id, toId: toU.id, value: v, createdAt: now().toISOString() };
  store.ratings.push(r);
  // recompute rating
  const rs = store.ratings.filter(x=>x.toId===toU.id);
  toU.ratingCount = rs.length;
  toU.ratingAverage = Number((rs.reduce((a,c)=>a+c.value,0)/Math.max(1,rs.length)).toFixed(2));
  return json({ ok: true, ratingAverage: toU.ratingAverage, ratingCount: toU.ratingCount });
}

async function handleReport(req){
  const { reporter, targetType, targetId, reason } = await req.json();
  if (!reporter?.email) return bad('Unauthorized', 401);
  if (!targetType || !targetId || !reason) return bad('Missing fields');
  const repU = getOrCreateUser(reporter);
  const rep = { id: uid(), reporterId: repU.id, targetType, targetId, reason, createdAt: now().toISOString() };
  store.reports.push(rep);
  return json({ ok: true });
}

function requireMod(req){
  const code = req.headers.get('x-mod-code');
  if (code !== MOD_CODE) throw new Response('Forbidden', { status: 403 });
}

async function handleListHold(req){
  try{ requireMod(req); } catch(res){ return res; }
  const holds = [...store.posts.values()].filter(p=>p.status==='ON_HOLD');
  return json(holds.map(serializePost));
}

async function handleListReports(req){
  try{ requireMod(req); } catch(res){ return res; }
  return json(store.reports);
}

async function handleModerate(req){
  try{ requireMod(req); } catch(res){ return res; }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const { action, reason } = await req.json();
  const post = store.posts.get(id);
  if (!post) return bad('Not found', 404);
  if (action === 'approve') post.status='APPROVED';
  else if (action === 'reject'){ post.status='REJECTED'; post.rejectionReason = reason||'Not specified'; }
  else return bad('Bad action');
  post.updatedAt = now().toISOString();
  return new Response(null, { status: 204 });
}

function getAuthor(post){
  for (const u of store.users.values()){ if (u.id === post.authorId) return u; }
  return { id:'', email:'', username:'unknown', ratingAverage:0, ratingCount:0 };
}

function serializePost(p){
  const author = getAuthor(p);
  return { ...p, author };
}

export default async function handler(req){
  const { searchParams } = new URL(req.url);
  const route = searchParams.get('route');
  try{
    if (req.method==='OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,x-mod-code' }});

    if (route === 'create_post' && req.method==='POST') return await handleCreatePost(req);
    if (route === 'list_posts' && req.method==='GET') return await handleListPosts(req);
    if (route === 'delete_post' && req.method==='DELETE') return await handleDeletePost(req);
    if (route === 'rate_user' && req.method==='POST') return await handleRateUser(req);
    if (route === 'report' && req.method==='POST') return await handleReport(req);
    if (route === 'list_hold' && req.method==='GET') return await handleListHold(req);
    if (route === 'list_reports' && req.method==='GET') return await handleListReports(req);
    if (route === 'moderate' && req.method==='POST') return await handleModerate(req);

    return bad('Not found', 404);
  } catch(err){
    console.error(err);
    if (err instanceof Response) return err;
    return bad('Server error', 500);
  }
}
