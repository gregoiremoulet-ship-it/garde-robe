import express from "express";
import fs from "fs";
if (fs.existsSync(".env")) for (const l of fs.readFileSync(".env","utf8").split("\n")) { const m=l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/); if(m&&!process.env[m[1]]) process.env[m[1]]=m[2].trim(); }
const app = express();
app.use(express.json({ limit: "40mb" }));
app.use(express.static("public"));
const split = d => { const m = /^data:(.+?);base64,(.*)$/.exec(d); return { inline_data: { mime_type: m[1], data: m[2] } }; };
app.post("/api/tryon", async (req, res) => {
  try {
    if (process.env.APP_CODE && req.headers["x-code"] !== process.env.APP_CODE) return res.status(401).json({ error: "Code d'accès incorrect" });
    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(400).json({ error: "GEMINI_API_KEY manquante (fichier .env)" });
    const { person, garments } = req.body;
    const list = garments.map((g, i) => `image ${i + 2}: ${g.cat} (${g.name}, ${g.color})`).join("; ");
    const prompt = `Image 1 is a photo of a person. Generate a photorealistic full-body fashion photo of this exact same person (same face, hair, skin tone, body shape) wearing ALL of these garments exactly as they appear in the reference photos: ${list}. Keep each garment's color, pattern and cut faithful. Natural standing pose, clean soft studio background, even lighting, head to toe visible, vertical 3:4 framing. No text, no watermark.`;
    const parts = [{ text: prompt }, split(person), ...garments.map(g => split(g.img))];
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts }] })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: j.error?.message || "Erreur API" });
    const p = j.candidates?.[0]?.content?.parts?.find(x => x.inlineData || x.inline_data);
    const d = p && (p.inlineData || p.inline_data);
    if (!d) return res.status(502).json({ error: "Aucune image renvoyée (contenu refusé ?)" });
    res.json({ image: `data:${d.mimeType || d.mime_type};base64,${d.data}` });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});
const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => console.log(`👗 http://localhost:${port}`));
