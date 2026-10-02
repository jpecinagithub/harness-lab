export default {
  id: "m14",
  level: 4,
  n: 2,
  icon: "Minimize2",
  sim: null,
  en: {
    title: "Short-Term Memory: Compaction",
    tagline: "When history outgrows the window, compress it — but never compress what the task cannot afford to lose.",
    objectives: [
      "Compare truncation strategies and rolling summaries, with their fidelity, cost, and complexity trade-offs.",
      "Run summarizer model calls that preserve entities, numbers, decisions, and open questions.",
      "Protect verbatim content — the user goal, tool schemas, the active plan — from ever being compacted."
    ],
    sections: [
      {
        kind: "text",
        heading: "Why Compaction Exists",
        body: "Every long-running agent faces the same arithmetic: history grows linearly with steps, the window does not. After 30 iterations of a tool-heavy loop, the transcript can easily exceed 60,000 tokens — past the history budget of a 128k window from m13. Something has to give. Compaction is how the *harness* (arnés) answers: systematically reducing the history's footprint while preserving what future steps need. It is lossy compression for conversation, and like all lossy compression, its quality depends entirely on what you throw away.\n\nThe blunt instrument is truncation: keep the first N and last M messages, drop the middle. It is cheap, deterministic, and surprisingly effective for linear tasks where the middle was mostly exploration. Its failure mode is amnesia about decisions: 'we already tried the v2 API and it returned 403' lived in the dropped middle, so the agent tries it again. Slightly smarter is relevance truncation — keep messages that mention entities in the current goal — but relevance heuristics rot as goals shift.\n\nThe precision instrument is the rolling summary. When history crosses a threshold — say 70% of its budget — the harness takes the oldest segment, calls a summarizer model to compress it, and splices the summary back where the raw messages were. A 20,000-token segment becomes a 1,500-token summary: a 13:1 compaction ratio, and the summary is written in the language of decisions and facts rather than the blow-by-blow of tool calls. The trade-off is cost and complexity: every compaction is a model call (typically 2,000-4,000 tokens), it adds latency at the moment the loop is already heavy, and a bad summary poisons everything downstream. Compaction does not eliminate the budget problem; it converts a hard limit into a managed, recurring cost.\n\nCompaction also interacts with the planning loop from m10 in a way that bites. The active plan's statuses live in history, and a summarizer that rewrites 'step 3: done' as 'early steps completed' has destroyed information the executor needs — which steps, exactly? This is why the keep-verbatim list exists, and why the plan should ideally live outside the compactable history entirely: in a dedicated state slot the harness manages, versioned and pinned. Treat the plan like the goal — structured state, not conversation. The broader principle: anything the harness reasons about mechanically (statuses, ids, counts, schemas) should never pass through a lossy summarizer. Summaries are for narrative context; state is for state."
      },
      {
        kind: "code",
        heading: "Rolling Summary Compaction",
        lang: "javascript",
        code: "async function maybeCompact({ summarizer, messages, budget, threshold = 0.7 }) {\n  const histTokens = estimateTokens(messages.map((m) => m.content).join(\"\\n\"));\n  if (histTokens < budget.caps.history * threshold) return { messages, compacted: false };\n\n  // Split: keep the recent tail verbatim, summarize everything older.\n  const cutAt = Math.floor(messages.length * 0.6);\n  const oldPart = messages.slice(0, cutAt);\n  const recentPart = messages.slice(cutAt);\n\n  const summary = await summarizer.summarize(\n    \"Summarize for a future agent continuing this task. Preserve: \" +\n    \"decisions made, facts learned, numbers/ids, errors encountered, \" +\n    \"and open questions. Omit: tool-call chatter.\\n\\n\" +\n    oldPart.map((m) => `${m.role}: ${m.content}`).join(\"\\n\")\n  );\n  const compacted = [{ role: \"system\", content: `[SUMMARY of ${oldPart.length} earlier messages]\\n${summary}` }].concat(recentPart);\n  return { messages: compacted, compacted: true, ratio: histTokens / estimateTokens(summary) };\n}",
        note: "Trigger on budget fraction, not message count: 10 huge tool outputs compact sooner than 50 chatty turns."
      },
      {
        kind: "text",
        heading: "The Summarizer Call: What to Keep",
        body: "The summarizer is a separate model call with a different job than any other in the harness: it writes for a future reader that is also a model. That changes what 'good' means. A good summary preserves five things: decisions made ('we chose the v3 API over v2'), facts learned ('the customer is on the enterprise tier'), numbers and identifiers (order ids, amounts, error codes — never paraphrase these), errors encountered and what they taught ('v2 returns 403 for this key'), and open questions ('still unclear whether refunds apply'). It omits the blow-by-blow: nobody needs the third retry of a successful tool call.\n\nUse a cheap, fast model for summarization. The task is compression, not reasoning — a small model at low temperature does it well for a fraction of the cost. Typical numbers: summarizing 20,000 tokens costs roughly 20,000 input tokens plus 1,500 output tokens on the cheap model, versus paying 20,000 tokens on every subsequent step of the expensive main model. The break-even is usually 2 to 3 future steps: if the task will run longer than that, compaction pays for itself almost immediately.\n\nAnd then there is the inviolable list — content that must never be compacted, summarized, or paraphrased. The user's original goal, verbatim: paraphrase drift here is how agents slowly solve the wrong problem. Tool schemas: the model needs exact parameter definitions, not a summary of them. The active plan from m10: statuses and dependencies must stay precise. Anything the user explicitly marked as important. Implement this as a keep-verbatim list checked before every compaction: protected segments are pinned in place while everything around them compresses. A summary that loses the goal is not a summary; it is sabotage with good compression ratios.\n\nOne more subtlety: summarization quality degrades with input noise. If the segment being compacted is 80% failed tool retries and error spam, even a good summarizer struggles to extract the signal — garbage in, eloquent garbage out. The fix is pre-compaction hygiene: strip or collapse repeated failures before summarizing (keep the first occurrence and the final outcome), drop heartbeat chatter, and truncate absurdly long single outputs. A 20,000-token segment of clean signal compresses beautifully; the same size of noise compresses into confident-sounding nonsense. Compaction is the second stage of a pipeline whose first stage is deciding what deserves to be remembered at all."
      },
      {
        kind: "code",
        heading: "Compaction with a Keep-Verbatim List",
        lang: "javascript",
        code: "// Protected segments are pinned; everything else is compactable.\nasync function compactWithProtection({ summarizer, segments, budget }) {\n  // segments: [{ kind: 'goal'|'schema'|'plan'|'history', content }]\n  const PROTECTED = new Set([\"goal\", \"schema\", \"plan\"]);\n  const pinned = segments.filter((s) => PROTECTED.has(s.kind));\n  const free = segments.filter((s) => !PROTECTED.has(s.kind));\n\n  const freeTokens = estimateTokens(free.map((s) => s.content).join(\"\\n\"));\n  if (freeTokens < budget.caps.history * 0.7) {\n    return { segments, compacted: false }; // nothing to do; goal untouched\n  }\n  const summary = await summarizer.summarize(\n    \"Compress the conversation below. Keep decisions, facts, numbers, \" +\n    \"errors, open questions.\\n\\n\" +\n    free.map((s) => s.content).join(\"\\n\")\n  );\n  // Reassemble: pinned content keeps its exact position and wording.\n  return {\n    segments: pinned.concat([{ kind: \"history\", content: `[SUMMARY]\\n${summary}` }]),\n    compacted: true,\n  };\n}",
        note: "Pinning is positional too: the goal stays first, where positional bias favors it."
      },
      {
        kind: "compare",
        heading: "Truncation vs. Summarization",
        headers: ["Truncation", "Summarization"],
        rows: [
          ["Fidelity", "Lossy and blind: dropped facts are gone silently.", "Lossy but directed: the summary is told what to preserve."],
          ["Cost", "Free — pure string surgery.", "One model call per compaction (2k-4k tokens on a cheap model)."],
          ["Latency", "Zero added latency.", "Adds a round trip at the heaviest moment of the loop."],
          ["Failure mode", "Amnesia: the agent retries things it already tried.", "Poisoned summary: one bad compression corrupts all downstream steps."],
          ["Determinism", "Fully deterministic and testable.", "Model-dependent; summaries vary between runs."],
          ["Best fit", "Linear tasks, short horizons, tight latency budgets.", "Long tasks where decisions and facts must survive dozens of steps."],
          ["State safety", "Statuses and ids survive exactly as written.", "Narrative survives; mechanical state must be pinned or it degrades."]
        ]
      },
      {
        kind: "callout",
        tone: "warn",
        title: "Never Compact the Goal",
        body: "The user's original goal, the active plan's statuses, and tool schemas are pinned verbatim — always. Summarization paraphrases, and paraphrase drift on the goal is how an agent spends 40 steps brilliantly solving the wrong problem. If your compaction ever touches these segments, that is not an optimization; it is a bug. Test it: compact a long session and diff the pinned segments before and after. They must be byte-identical. Keep mechanically-reasoned state — plan statuses, ids, counts, schemas — out of the summarizer entirely. Store it in a dedicated, pinned state slot. Summaries carry narrative; state carries truth."
      }
    ],
    takeaways: [
      "Compaction converts a hard window limit into a managed recurring cost: compress history when it crosses ~70% of its budget.",
      "Rolling summaries at 10:1+ ratios preserve decisions, facts, numbers, errors, and open questions — never tool-call chatter.",
      "Summarize with a cheap, fast model at low temperature; compaction pays for itself within 2-3 future steps.",
      "Pin the user goal, tool schemas, and active plan verbatim — paraphrase drift on the goal solves the wrong problem brilliantly."
    ],
    quiz: [
      {
        q: "When should a rolling-summary compaction trigger?",
        options: ["After every single loop iteration", "When history crosses a budget fraction (e.g., 70% of its cap) — measured in tokens, not message count", "Only when the API returns a context-length error", "Once per day on a schedule"],
        answer: 2,
        why: "Triggering on budget fraction keeps compaction proportional to actual pressure. Fixed schedules or post-error triggers are either wasteful or too late."
      },
      {
        q: "What is the main failure mode of plain truncation?",
        options: ["It costs too many tokens", "Amnesia about decisions: facts from the dropped middle are gone silently, so the agent retries things it already tried", "It requires a separate model call", "It makes the context window larger"],
        answer: 0,
        why: "Truncation is free and deterministic, but blind — dropped content vanishes without a trace, and decision amnesia is the classic symptom."
      },
      {
        q: "A good compaction summary preserves…",
        options: ["Every tool call with full arguments for completeness", "The exact wording of casual small talk", "Decisions, facts, numbers/ids, errors and their lessons, and open questions — omitting tool-call chatter", "Only the most recent user message"],
        answer: 3,
        why: "The summary is written for a future model-reader: it needs the durable conclusions, not the blow-by-blow. Numbers and ids must never be paraphrased."
      },
      {
        q: "Why use a cheap, fast model for the summarizer call?",
        options: ["Cheap models produce longer summaries", "Summarization is compression, not reasoning — a small model at low temperature does it well for a fraction of the cost", "Expensive models refuse to summarize", "It is required by the API terms of service"],
        answer: 1,
        why: "The economics are stark: ~20k cheap input tokens once versus 20k expensive tokens on every future step. Break-even is typically 2-3 steps."
      },
      {
        q: "Which content belongs on the keep-verbatim (pinned) list?",
        options: ["Old tool outputs and retry chatter", "The user's original goal, tool schemas, and the active plan's statuses", "The summarizer's own previous summaries", "System timestamps"],
        answer: 2,
        why: "Paraphrase drift on the goal, schemas, or plan statuses corrupts the task itself. These segments must be byte-identical before and after compaction."
      },
      {
        q: "What is the main failure mode of summarization-based compaction?",
        options: ["It is fully deterministic, so it cannot fail", "A poisoned summary: one bad compression corrupts every downstream step that builds on it", "It always increases token usage", "Summaries cannot be written in English"],
        answer: 0,
        why: "Unlike truncation's local amnesia, a bad summary is load-bearing: everything downstream reasons from it. Validate summaries on evals, not vibes."
      },
      {
        q: "A 20,000-token history segment becomes a 1,500-token summary. The compaction ratio and its implication are…",
        options: ["0.075:1 — the summary is too small to be useful", "Roughly 13:1 — strong compression, but every future step now depends on the summary's fidelity", "1:1 — no compression happened", "It cannot be computed without the model name"],
        answer: 3,
        why: "13:1 is an excellent ratio and exactly why summarization beats truncation for long tasks — with the caveat that the summary becomes critical infrastructure."
      },
      {
        q: "How should you test that protected segments survive compaction?",
        options: ["Trust the summarizer's promise to be careful", "Compact a long session and diff the pinned segments before and after — they must be byte-identical", "Check that the summary is shorter than the original", "Count the tokens; identical counts prove identical content"],
        answer: 1,
        why: "Byte-identical diffing is the only real guarantee. Token counts can match while wording drifts, and 'be careful' is not an engineering control."
      }
    ]
  },
  es: {
    title: "Memoria a corto plazo: compactación",
    tagline: "Cuando el historial supera la ventana, comprímelo — pero nunca comprimas lo que la tarea no puede permitirse perder.",
    objectives: [
      "Comparar estrategias de truncado y resúmenes continuos, con sus compromisos de fidelidad, coste y complejidad.",
      "Ejecutar llamadas de resumen que preserven entidades, números, decisiones y preguntas abiertas.",
      "Proteger el contenido literal — el objetivo del usuario, los esquemas de herramientas, el plan activo — para que nunca se compacte."
    ],
    sections: [
      {
        kind: "text",
        heading: "Por qué existe la compactación",
        body: "Todo agente de larga duración enfrenta la misma aritmética: el historial crece linealmente con los pasos, la ventana no. Tras 30 iteraciones de un bucle con muchas herramientas, la transcripción puede superar fácilmente los 60 000 tokens — más que el presupuesto de historial de una ventana de 128k del m13. Algo tiene que ceder. La compactación es la respuesta del *harness* (arnés): reducir sistemáticamente la huella del historial preservando lo que los pasos futuros necesitan. Es compresión con pérdida para la conversación, y como toda compresión con pérdida, su calidad depende por completo de lo que descartes.\n\nEl instrumento romo es el truncado: conserva los primeros N y los últimos M mensajes, elimina el medio. Es barato, determinista y sorprendentemente eficaz para tareas lineales donde el medio fue sobre todo exploración. Su modo de fallo es la amnesia sobre decisiones: «ya probamos la API v2 y devolvió 403» vivía en el medio eliminado, así que el agente lo intenta de nuevo. Algo más listo es el truncado por relevancia — conservar mensajes que mencionen entidades del objetivo actual — pero las heurísticas de relevancia se pudren a medida que cambian los objetivos.\n\nEl instrumento de precisión es el resumen continuo (rolling summary). Cuando el historial cruza un umbral — digamos el 70% de su presupuesto — el harness toma el segmento más antiguo, llama a un modelo resumidor para comprimirlo y reinserta el resumen donde estaban los mensajes originales. Un segmento de 20 000 tokens se convierte en un resumen de 1500 tokens: una tasa de compactación de 13:1, y el resumen está escrito en el lenguaje de las decisiones y los hechos, no en el parte de guerra de las llamadas a herramientas. El compromiso es coste y complejidad: cada compactación es una llamada al modelo (típicamente 2000-4000 tokens), añade latencia justo cuando el bucle ya va cargado, y un mal resumen envenena todo lo que viene después. La compactación no elimina el problema del presupuesto; convierte un límite duro en un coste gestionado y recurrente.\n\nLa compactación también interactúa con el bucle de planificación del m10 de un modo que muerde. Los estados del plan activo viven en el historial, y un resumidor que reescribe «paso 3: hecho» como «primeros pasos completados» ha destruido información que el ejecutor necesita: ¿qué pasos, exactamente? Por eso existe la lista de contenido literal, y por eso el plan debería vivir fuera del historial compactable: en un hueco de estado dedicado que gestiona el harness, versionado y fijado. Trata el plan como el objetivo: estado estructurado, no conversación. El principio general: nada sobre lo que el harness razone mecánicamente (estados, ids, conteos, esquemas) debería pasar por un resumidor con pérdida. Los resúmenes son para el contexto narrativo; el estado es para el estado."
      },
      {
        kind: "code",
        heading: "Compactación con resumen continuo",
        lang: "javascript",
        code: "async function maybeCompact({ summarizer, messages, budget, threshold = 0.7 }) {\n  const histTokens = estimateTokens(messages.map((m) => m.content).join(\"\\n\"));\n  if (histTokens < budget.caps.history * threshold) return { messages, compacted: false };\n\n  // Split: keep the recent tail verbatim, summarize everything older.\n  const cutAt = Math.floor(messages.length * 0.6);\n  const oldPart = messages.slice(0, cutAt);\n  const recentPart = messages.slice(cutAt);\n\n  const summary = await summarizer.summarize(\n    \"Summarize for a future agent continuing this task. Preserve: \" +\n    \"decisions made, facts learned, numbers/ids, errors encountered, \" +\n    \"and open questions. Omit: tool-call chatter.\\n\\n\" +\n    oldPart.map((m) => `${m.role}: ${m.content}`).join(\"\\n\")\n  );\n  const compacted = [{ role: \"system\", content: `[SUMMARY of ${oldPart.length} earlier messages]\\n${summary}` }].concat(recentPart);\n  return { messages: compacted, compacted: true, ratio: histTokens / estimateTokens(summary) };\n}",
        note: "Dispara por fracción del presupuesto, no por número de mensajes: 10 salidas enormes se compactan antes que 50 turnos charlatanes."
      },
      {
        kind: "text",
        heading: "La llamada al resumidor: qué conservar",
        body: "El resumidor es una llamada al modelo separada con un trabajo distinto a cualquier otro del harness: escribe para un lector futuro que también es un modelo. Eso cambia lo que significa «bueno». Un buen resumen preserva cinco cosas: decisiones tomadas («elegimos la API v3 sobre la v2»), hechos aprendidos («el cliente está en el nivel enterprise»), números e identificadores (ids de pedido, importes, códigos de error — nunca parafrasear estos), errores encontrados y lo que enseñaron («v2 devuelve 403 para esta clave»), y preguntas abiertas («sigue sin estar claro si aplican los reembolsos»). Omite el parte de guerra: nadie necesita el tercer reintento de una llamada exitosa.\n\nUsa un modelo barato y rápido para resumir. La tarea es compresión, no razonamiento — un modelo pequeño a baja temperatura lo hace bien por una fracción del coste. Números típicos: resumir 20 000 tokens cuesta unos 20 000 tokens de entrada más 1500 de salida en el modelo barato, frente a pagar 20 000 tokens en cada paso posterior del modelo caro principal. El punto de equilibrio suele estar en 2 o 3 pasos futuros: si la tarea durará más, la compactación se amortiza casi de inmediato.\n\nY luego está la lista inviolable — contenido que nunca debe compactarse, resumirse ni parafrasearse. El objetivo original del usuario, literal: la deriva de la paráfrasis aquí es como los agentes acaban resolviendo lentamente el problema equivocado. Los esquemas de herramientas: el modelo necesita las definiciones exactas de parámetros, no un resumen de ellas. El plan activo del m10: los estados y dependencias deben mantenerse precisos. Todo lo que el usuario marcó explícitamente como importante. Implementa esto como una lista de «mantener literal» que se comprueba antes de cada compactación: los segmentos protegidos quedan fijados mientras todo a su alrededor se comprime. Un resumen que pierde el objetivo no es un resumen; es sabotaje con buenas tasas de compresión.\n\nOtra sutileza: la calidad del resumen se degrada con el ruido de entrada. Si el segmento a compactar es 80% reintentos fallidos de herramientas y spam de errores, incluso un buen resumidor lucha por extraer la señal: basura dentro, basura elocuente fuera. La solución es higiene pre-compactación: elimina o colapsa los fallos repetidos antes de resumir (conserva la primera ocurrencia y el resultado final), descarta la cháchara de latidos y trunca las salidas individuales absurdamente largas. Un segmento de 20 000 tokens de señal limpia se comprime de maravilla; el mismo tamaño de ruido se comprime en disparates que suenan seguros. La compactación es la segunda etapa de un pipeline cuya primera etapa es decidir qué merece ser recordado."
      },
      {
        kind: "code",
        heading: "Compactación con lista de contenido literal",
        lang: "javascript",
        code: "// Protected segments are pinned; everything else is compactable.\nasync function compactWithProtection({ summarizer, segments, budget }) {\n  // segments: [{ kind: 'goal'|'schema'|'plan'|'history', content }]\n  const PROTECTED = new Set([\"goal\", \"schema\", \"plan\"]);\n  const pinned = segments.filter((s) => PROTECTED.has(s.kind));\n  const free = segments.filter((s) => !PROTECTED.has(s.kind));\n\n  const freeTokens = estimateTokens(free.map((s) => s.content).join(\"\\n\"));\n  if (freeTokens < budget.caps.history * 0.7) {\n    return { segments, compacted: false }; // nothing to do; goal untouched\n  }\n  const summary = await summarizer.summarize(\n    \"Compress the conversation below. Keep decisions, facts, numbers, \" +\n    \"errors, open questions.\\n\\n\" +\n    free.map((s) => s.content).join(\"\\n\")\n  );\n  // Reassemble: pinned content keeps its exact position and wording.\n  return {\n    segments: pinned.concat([{ kind: \"history\", content: `[SUMMARY]\\n${summary}` }]),\n    compacted: true,\n  };\n}",
        note: "La fijación también es posicional: el objetivo queda primero, donde el sesgo posicional lo favorece."
      },
      {
        kind: "compare",
        heading: "Truncado frente a resumen",
        headers: ["Truncado", "Resumen"],
        rows: [
          ["Fidelidad", "Con pérdida y ciego: los hechos eliminados desaparecen en silencio.", "Con pérdida pero dirigido: al resumen se le dice qué preservar."],
          ["Coste", "Gratis: pura cirugía de cadenas.", "Una llamada al modelo por compactación (2k-4k tokens en un modelo barato)."],
          ["Latencia", "Cero latencia añadida.", "Añade una ida y vuelta en el momento más pesado del bucle."],
          ["Modo de fallo", "Amnesia: el agente reintenta cosas que ya probó.", "Resumen envenenado: una mala compresión corrompe todos los pasos siguientes."],
          ["Determinismo", "Totalmente determinista y testeable.", "Depende del modelo; los resúmenes varían entre ejecuciones."],
          ["Mejor ajuste", "Tareas lineales, horizontes cortos, presupuestos de latencia ajustados.", "Tareas largas donde decisiones y hechos deben sobrevivir docenas de pasos."]
        ]
      },
      {
        kind: "callout",
        tone: "warn",
        title: "Nunca compactes el objetivo",
        body: "El objetivo original del usuario, los estados del plan activo y los esquemas de herramientas quedan fijados literales — siempre. Resumir es parafrasear, y la deriva de la paráfrasis sobre el objetivo es como un agente dedica 40 pasos a resolver brillantemente el problema equivocado. Si tu compactación toca alguna vez estos segmentos, eso no es una optimización; es un bug. Pruébalo: compacta una sesión larga y compara los segmentos fijados antes y después. Deben ser idénticos byte a byte. Mantén el estado sobre el que se razona mecánicamente — estados del plan, ids, conteos, esquemas — fuera del resumidor por completo. Guárdalo en un hueco de estado dedicado y fijado. Los resúmenes llevan narrativa; el estado lleva verdad."
      }
    ],
    takeaways: [
      "La compactación convierte un límite duro de ventana en un coste recurrente gestionado: comprime el historial cuando cruza ~70% de su presupuesto.",
      "Los resúmenes continuos con tasas de 10:1 o más preservan decisiones, hechos, números, errores y preguntas abiertas — nunca la cháchara de herramientas.",
      "Resume con un modelo barato y rápido a baja temperatura; la compactación se amortiza en 2-3 pasos futuros.",
      "Fija literales el objetivo del usuario, los esquemas de herramientas y el plan activo: la deriva de la paráfrasis sobre el objetivo resuelve brillantemente el problema equivocado."
    ],
    quiz: [
      {
        q: "¿Cuándo debe dispararse una compactación con resumen continuo?",
        options: ["Tras cada iteración del bucle", "Cuando el historial cruza una fracción del presupuesto (p. ej., el 70% de su límite), medida en tokens, no en número de mensajes", "Solo cuando la API devuelve un error de longitud de contexto", "Una vez al día con un programador"],
        answer: 2,
        why: "Disparar por fracción del presupuesto mantiene la compactación proporcional a la presión real. Los calendarios fijos o los disparadores post-error son derrochadores o llegan tarde."
      },
      {
        q: "¿Cuál es el principal modo de fallo del truncado simple?",
        options: ["Cuesta demasiados tokens", "Amnesia sobre decisiones: los hechos del medio eliminado desaparecen en silencio, así que el agente reintenta cosas que ya probó", "Requiere una llamada separada al modelo", "Hace la ventana de contexto más grande"],
        answer: 0,
        why: "El truncado es gratis y determinista, pero ciego: el contenido eliminado se esfuma sin rastro, y la amnesia de decisiones es el síntoma clásico."
      },
      {
        q: "Un buen resumen de compactación preserva…",
        options: ["Cada llamada a herramienta con sus argumentos completos", "La redacción exacta de la charla trivial", "Decisiones, hechos, números/ids, errores y sus lecciones, y preguntas abiertas — omitiendo la cháchara de herramientas", "Solo el mensaje más reciente del usuario"],
        answer: 3,
        why: "El resumen se escribe para un futuro lector-modelo: necesita las conclusiones duraderas, no el parte de guerra. Los números e ids nunca deben parafrasearse."
      },
      {
        q: "¿Por qué usar un modelo barato y rápido para la llamada al resumidor?",
        options: ["Los modelos baratos producen resúmenes más largos", "Resumir es compresión, no razonamiento: un modelo pequeño a baja temperatura lo hace bien por una fracción del coste", "Los modelos caros se niegan a resumir", "Lo exigen los términos del servicio de la API"],
        answer: 1,
        why: "La economía es clara: ~20k tokens baratos de entrada una vez frente a 20k tokens caros en cada paso futuro. El equilibrio suele estar en 2-3 pasos."
      },
      {
        q: "¿Qué contenido pertenece a la lista de mantener literal (fijado)?",
        options: ["Salidas antiguas de herramientas y cháchara de reintentos", "Los resúmenes anteriores del propio resumidor", "El objetivo original del usuario, los esquemas de herramientas y los estados del plan activo", "Las marcas temporales del sistema"],
        answer: 2,
        why: "La deriva de la paráfrasis sobre el objetivo, los esquemas o los estados del plan corrompe la tarea misma. Estos segmentos deben ser idénticos byte a byte antes y después de compactar."
      },
      {
        q: "¿Cuál es el principal modo de fallo de la compactación basada en resúmenes?",
        options: ["Es totalmente determinista, así que no puede fallar", "Un resumen envenenado: una mala compresión corrompe cada paso posterior que se apoya en él", "Siempre aumenta el uso de tokens", "Los resúmenes no se pueden escribir en inglés"],
        answer: 0,
        why: "A diferencia de la amnesia local del truncado, un mal resumen es estructural: todo lo posterior razona a partir de él. Valida los resúmenes con evaluaciones, no con sensaciones."
      },
      {
        q: "Un segmento de historial de 20 000 tokens se convierte en un resumen de 1500 tokens. La tasa de compactación y su implicación son…",
        options: ["0,075:1: el resumen es demasiado pequeño para ser útil", "Aproximadamente 13:1: compresión fuerte, pero cada paso futuro depende ahora de la fidelidad del resumen", "1:1: no hubo compresión", "No se puede calcular sin el nombre del modelo"],
        answer: 3,
        why: "13:1 es una tasa excelente y justo por eso el resumen supera al truncado en tareas largas — con la advertencia de que el resumen se vuelve infraestructura crítica."
      },
      {
        q: "¿Cómo probar que los segmentos protegidos sobreviven a la compactación?",
        options: ["Confiar en la promesa del resumidor de tener cuidado", "Compactar una sesión larga y comparar los segmentos fijados antes y después: deben ser idénticos byte a byte", "Comprobar que el resumen es más corto que el original", "Contar los tokens; conteos idénticos prueban contenido idéntico"],
        answer: 1,
        why: "La comparación byte a byte es la única garantía real. Los conteos de tokens pueden coincidir mientras la redacción deriva, y «ten cuidado» no es un control de ingeniería."
      }
    ]
  }
};
