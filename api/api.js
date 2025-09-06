// Vercel serverless function: /api/api
// Uses Groq API with model: meta-llama/llama-4-maverick-17b-128e-instruct (multimodal)
// Expects JSON body: { prompt: string, imageData?: dataURL, assets?: [{name,width,height}] }
// Returns: { nodes: [ {type, x,y,w,h,r, fill, stroke, strokeSize, opacity, shadow, text, srcIndex} ] }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { prompt = '', imageData = null, assets = [] } = req.body || {};
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing GROQ_API_KEY env var' });
    return;
  }

  // Build OpenAI-style payload for Groq chat.completions
  const messages = [
    {
      role: 'system',
      content: [
        { type: 'text', text: `You are a UI layout generator. Output ONLY a minified JSON object with key "nodes" (array). Each node can be of type 'rect', 'image', or 'text'.
Rules:
- Coordinates are relative to a frame width 1200 and height 700 unless user implies a different aspect; prefer 1200x700.
- Use provided assets indices for image nodes: property srcIndex integer.
- Provide attractive modern dashboard/card layouts with shadows (shadow:true) where appropriate, rounded corners, readable colors.
- Use 0..64 for radius r, 0..24 for strokeSize, 0..100 for opacity.
- For text nodes, include text and optionally font like '700 24px Inter' and align 'left'|'center'|'right'.
- Keep values integers where reasonable.
Return compact JSON. Do not include backticks.` }
      ]
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: `Assets: ${assets.map((a,i)=>`[${i}] ${a.name} ${a.width}x${a.height}`).join(', ') || 'none'}` },
        { type: 'text', text: `Prompt: ${prompt || 'create a stylish hero with title, subtitle, CTA and one image'}` },
        ...(imageData ? [{ type: 'input_image', image_data: imageData }] : [])
      ]
    }
  ];

  try {
    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
        temperature: 0.6,
        max_tokens: 1200,
        messages,
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      res.status(resp.status).json({ error: `Groq API error: ${text}` });
      return;
    }

    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content || '';

    let nodes;
    try { nodes = JSON.parse(content).nodes; } catch (_) {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try{ nodes = JSON.parse(match[0]).nodes; }catch(e){}
      }
    }

    if (!Array.isArray(nodes)) {
      // Very defensive fallback layout
      nodes = [
        { type:'rect', x:40, y:40, w:360, h:200, r:18, fill:'#1a2034', stroke:'#2b3350', strokeSize:2, opacity:100, shadow:true },
        { type:'text', x:60, y:60, w:320, h:40, r:0, fill:'#e9ecf1', text:'Maverick UI', font:'800 28px Inter', align:'left' },
        { type:'text', x:60, y:100, w:320, h:30, r:0, fill:'#aab2c7', text:'Generated fallback layout', font:'500 18px Inter', align:'left' },
        { type:'image', x:440, y:60, w:640, h:360, r:24, srcIndex:0, stroke:'#141824', strokeSize:0, opacity:100, shadow:true },
        { type:'rect', x:40, y:260, w:1040, h:180, r:18, fill:'#161d33', stroke:'#232b49', strokeSize:1, opacity:100, shadow:false }
      ];
    }

    res.status(200).json({ nodes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
