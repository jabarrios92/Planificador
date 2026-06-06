import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini safely
let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
  try {
    ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
    console.log("Gemini API initialized successfully from server side.");
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
  }
} else {
  console.warn("GEMINI_API_KEY is not defined or is placeholder. Using backup study simulation.");
}

// API Routes

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", geminiConfigured: !!ai });
});

// AI Mentor Study generator endpoint (handles summaries, mnemonics, and quiz generation)
app.post("/api/mentor/generate", async (req, res) => {
  const { topicId, topicTitle, specialty } = req.body;

  if (!topicTitle || !specialty) {
    return res.status(400).json({ error: "Missing topicTitle or specialty parameters." });
  }

  // Fallback data in case Gemini is not set up or fails
  const mockResponse = {
    keyConcepts: [
      `La fisiopatología principal del tema "${topicTitle}" en la rama de ${specialty} se fundamenta en un entendimiento estructurado de los signos clínicos de alarma y la escala de gravedad.`,
      "El diagnóstico de primera elección generalmente se apoya en estudios de imagen no invasivos o marcadores serológicos tempranos.",
      "El tratamiento inicial debe priorizar la estabilización hemodinámica del paciente antes de intervenciones definitivas o invasivas."
    ],
    mnemonics: [
      `REPASO: R-econocer síntomas de ${topicTitle}, E-valuar estabilidad, P-resentar tratamiento, A-notar evolución, S-eguimiento oportuno, O-ptimizar dosis.`
    ],
    quiz: [
      {
        question: `Masculino de 45 años ingresa al servicio de urgencias con sintomatología directamente sugerente de complicación aguda asociada a ${topicTitle}. Al examen físico, vitales limítrofes. ¿Cuál es la primera conducta terapéutica/diagnóstica recomendada?`,
        options: [
          "Iniciar reanimación hídrica agresiva y solicitar paraclínicos urgentes",
          "Proceder inmediatamente a cirugía de rescate o intervención de urgencia sin estudios adicionales",
          "Dar de alta con manejo sintomático ambulatorio y control en consulta externa",
          "Administrar triple esquema antibiótico empírico de amplio espectro antes de obtener cultivos"
        ],
        correctIndex: 0,
        explanation: "La estabilización del paciente y la obtención de exámenes paraclínicos para guiar las conductas ulteriores son siempre la prioridad diagnóstica y terapéutica."
      },
      {
        question: `En relación al diagnóstico a largo plazo y prevención de recurrencias en un cuadro típico de ${topicTitle}, ¿cuál de los siguientes enunciados representa el estándar de cuidado médico actual para el examen de residencia?`,
        options: [
          "Determinar factores de riesgo modificables y pautar seguimiento espaciado según tolerancia clínica",
          "Suspender todo tipo de terapia de mantenimiento ante el primer signo de remisión temporal",
          "Realizar tomografía de control cada 48 horas como método de cribado estándar",
          "Recomendar reposo prolongado y dieta hipocalórica estricta sin justificación científica"
        ],
        correctIndex: 0,
        explanation: "El control de factores de riesgo y el seguimiento individualizado evitan la cronicidad y reducen la morbimortalidad general del paciente."
      }
    ]
  };

  if (!ai) {
    // Return mock data with a flag indicating simulation mode
    return res.json({ ...mockResponse, isMock: true, reason: "Gemini API key not configured." });
  }

  try {
    const prompt = `Eres un Mentor de Estudio de Medicina de Élite, un profesor experto que prepara a médicos graduados para aprobar con puntajes sobresalientes el examen de residencia médica especialidad en medicina y cirugía (como ENARM, MIR o residencias universitarias de primer nivel).

Sintetiza la información académica oficial, guías de práctica clínica internacionales y nacionales más recientes y "perlas clínicas" de alta rentabilidad de examen para:
TEMA: "${topicTitle}"
ESPECIALIDAD: "${specialty}"

Debes responder estrictamente en formato JSON válido que cumpla con el siguiente esquema de TypeScript:
{
  "keyConcepts": string[], // Lista de exactamente 3-4 perlas clínicas claves que son sumamente preguntadas en el examen.
  "mnemonics": string[], // 1 o 2 reglas mnemotécnicas creativas o mnemotecnias útiles en español para memorizar conceptos de este tema.
  "quiz": { // Exactamente 3 preguntas caso clínico realístico con 4 opciones cada una.
    "question": string,
    "options": string[], // exactamente 4 opciones
    "correctIndex": number, // índice base 0 de la respuesta correcta
    "explanation": string // justificación rica fundamentada médicamente de la respuesta correcta e incorrecta en español
  }[]
}

REGLAS DE FORMATO CRÍTICAS:
- Tu respuesta DEBE ser únicamente el objeto JSON, listo para JSON.parse().
- No envuelvas el JSON en bloques de código markdown de tipo \`\`\`json ni agregues ningún texto aclaratorio previo o posterior.
- Asegúrate de codificar las comillas correctamente y evitar caracteres de salto de línea ilegales dentro del JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["keyConcepts", "mnemonics", "quiz"],
          properties: {
            keyConcepts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Clinical pearls and core guidelines concepts"
            },
            mnemonics: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Mnemonics or memory aids"
            },
            quiz: {
              type: Type.ARRAY,
              description: "Three residency level multiple choice quiz questions",
              items: {
                type: Type.OBJECT,
                required: ["question", "options", "correctIndex", "explanation"],
                properties: {
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  correctIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const parsedText = response.text?.trim() || "";
    const cleanJson = parsedText.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    
    try {
      const data = JSON.parse(cleanJson);
      return res.json(data);
    } catch (parseError) {
      console.error("JSON Parsing failed from Gemini output. Raw text:", parsedText, parseError);
      return res.json({
        ...mockResponse,
        isMock: true,
        reason: "Failed to parse AI output. Returned clean backup resource."
      });
    }

  } catch (error: any) {
    console.error("Error communicating with Gemini:", error);
    return res.json({
      ...mockResponse,
      isMock: true,
      reason: error?.message || "Failed to communicate with AI API."
    });
  }
});

// Configure Vite or Static Assets handling
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    // Developer Mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware integrated.");
  } else {
    // Production Mode
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving built static production resources.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started. Web App running on http://localhost:${PORT}`);
  });
}

setupServer();
