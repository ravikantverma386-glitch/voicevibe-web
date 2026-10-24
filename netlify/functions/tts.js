exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "POST only" };
  try {
    const { text, voice } = JSON.parse(event.body || "{}");
    if (!text || text.length > 5000) return { statusCode: 400, body: "bad text" };

    const model = process.env.TTS_MODEL || "gemini-3.1-flash-tts-preview";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || "Kore" } } }
        }
      })
    });
    if (!r.ok) return { statusCode: 502, body: "gemini error " + r.status };
    const j = await r.json();
    const b64 = j.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!b64) return { statusCode: 502, body: "no audio" };

    const pcm = Buffer.from(b64, "base64");
    const h = Buffer.alloc(44);
    h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(24000, 24); h.writeUInt32LE(48000, 28);
    h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write("data", 36); h.writeUInt32LE(pcm.length, 40);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: Buffer.concat([h, pcm]).toString("base64") })
    };
  } catch (e) {
    return { statusCode: 500, body: "server error" };
  }
};
