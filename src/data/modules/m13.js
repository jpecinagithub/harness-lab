export default {
  id: "m13",
  level: 4,
  n: 1,
  icon: "Brain",
  sim: "memory",
  en: {
    title: "The Context Window as Working Memory",
    tagline: "The context window is the model's working memory: finite, expensive, and yours to budget.",
    objectives: [
      "Budget a context window in tokens using real model limits: 128k, 200k, and 1M token windows.",
      "Account for everything that fills the window: system prompt, tool schemas, history, and tool results.",
      "Recognize context rot — attention dilution and lost-in-the-middle — and defend with headroom and structure."
    ],
    sections: [
      {
        kind: "text",
        heading: "Your Budget in Tokens",
        body: "The context window is the model's working memory: everything the model can 'think with' right now must fit inside it. Unlike human working memory, its size is public and exact. Common tiers you will actually encounter: 128,000 tokens (the workhorse tier for GPT-4-class and Claude Sonnet-class models), 200,000 tokens (Claude's classic large window), and 1,000,000 tokens (Gemini-class long-context models). These numbers look generous until you do the arithmetic of a real agent loop.\n\nA token is roughly 4 characters of English text — about three quarters of a word. That means 128k tokens hold around 300 pages of text, 200k around 450 pages, and 1M over 2,000 pages. Sounds like plenty. Now subtract the fixed costs. A serious system prompt runs 2,000 to 5,000 tokens. Tool schemas — the JSON definitions of every tool the model may call — easily add 500 to 2,000 tokens per tool; an agent with 15 tools can burn 15,000 tokens before the user has said a word. Conversation history grows with every turn, and tool results are the silent killer: one `search.docs` call returning 10 long documents can inject 20,000 tokens in a single step.\n\nThe *harness* (arnés) is the budget office. Nobody else will stop the window from filling up: the model will happily keep consuming context until it hits the limit and the API returns an error, or worse, until performance has quietly degraded long before the limit. Budgeting means deciding up front how the window is divided — how much for the system prompt, how much for tools, how much for history, how much headroom for the answer — and enforcing it in code, every turn. A window you do not budget is a window you will overflow at the worst possible moment."
      },
      {
        kind: "text",
        heading: "Watch a Window Fill Up",
        body: "Reading about token budgets is abstract; watching one fill is visceral. The simulator below lets you build a realistic agent context piece by piece — add a system prompt, attach tool schemas, run a few loop iterations with chunky tool results — and watch the budget bar climb toward the limit of a 128k, 200k, or 1M window. Try it below: stack five tools with large schemas, then run ten iterations that each return a 3,000-token search result, and see how fast 'plenty of room' becomes 'we are at 82 percent and the task is half done'.\n\nPay attention to which additions move the needle most. Beginners blame the conversation history; veterans blame tool results. A single untruncated `read.file` on a 2,000-line source file, or a `query.database` that returns 500 rows as JSON, can outweigh twenty turns of chat. This is why production harnesses truncate, summarize, or paginate tool outputs before they ever reach the model — the window is defended at ingestion time, not at overflow time.\n\nAlso notice the asymmetry: inputs are cheap to add and expensive to remove. Once 40,000 tokens of tool output are in the history, every subsequent model call pays for them again — attention is computed over the whole window, every token, every step. Context is not storage; it is a recurring tax. The cheapest token is the one you never put in the window."
      },
      {
        kind: "code",
        heading: "Counting Tokens in JavaScript",
        lang: "javascript",
        code: "// Production code would call the provider's tokenizer; this estimator is\n// accurate within ~10% for English and good enough for budgeting logic.\nfunction estimateTokens(text) {\n  if (!text) return 0;\n  // ~4 chars per token for prose; code and JSON are denser (~3.2 chars).\n  const looksLikeCode = /[{}\\[\\];=]/.test(text.slice(0, 500));\n  const charsPerToken = looksLikeCode ? 3.2 : 4.0;\n  return Math.ceil(text.length / charsPerToken);\n}\n\nfunction contextUsage({ systemPrompt, toolSchemas, history, headroom = 8000 }) {\n  const parts = {\n    system: estimateTokens(systemPrompt),\n    tools: toolSchemas.reduce((n, s) => n + estimateTokens(JSON.stringify(s)), 0),\n    history: history.reduce((n, m) => n + estimateTokens(m.content), 0),\n    headroom, // reserved for the model's answer: never spend this\n  };\n  const used = parts.system + parts.tools + parts.history;\n  return Object.assign({}, parts, { used, total: used + headroom });\n}\n\nconst u = contextUsage({\n  systemPrompt: \"You are a careful assistant that answers concisely.\",\n  toolSchemas: [{ name: \"search\", description: \"Search the documentation index\", parameters: {} }],\n  history: [{ role: \"user\", content: \"Summarize these docs\" }],\n});\nconsole.log(u); // { system, tools, history, headroom, used, total }",
        note: "Estimate per part, not just the total: you need to know WHAT is eating the window to fix it. Per-part estimates also power the budget allocator below — you cannot enforce caps you cannot measure."
      },
      {
        kind: "text",
        heading: "Context Rot: When Big Windows Go Bad",
        body: "Here is the trap of the 1M-token era: fitting is not the same as attending. As the window fills, model performance on information buried in the middle degrades — the well-documented 'lost in the middle' effect. Retrieval accuracy for a fact at 5% or 95% of the window stays high; the same fact at 50% can drop 20 to 40 points depending on the model and task. The model technically sees everything and effectively uses the edges. Engineers call this context rot: the window is full, the tokens are paid for, and the reasoning is worse than with a smaller, better-curated context.\n\nRot has three compounding causes. First, attention dilution: with 100,000 tokens competing, each token gets a thinner slice of the model's focus, so weak signals — the one contradictory sentence in a long document — get washed out. Second, positional bias: models overweight the start (instructions) and the end (recent turns) of the window, which means your carefully retrieved evidence in the middle is systematically underweighted. Third, distraction accumulation: irrelevant tool outputs do not just waste tokens; they actively pull the model's reasoning off track, and the more of them there are, the stronger the pull.\n\nThe defense is curation, not capacity. Upgrading from 128k to 1M without changing what you put in the window usually buys latency and cost, not quality. The winning pattern is a small, dense, well-ordered context: the goal and constraints first, the most relevant evidence next, recent history last, and ruthless truncation of everything else. Measure this yourself: run your eval suite at 20%, 50%, and 80% window fill with the same task. Most teams discover their quality cliff starts around 50 to 60% — long before any API limit.\n\nA related trap: the 'just in case' context habit. Engineers stuff the window with background documents, full conversation history, and every tool result 'in case the model needs it'. Each addition feels free and each one degrades the attention available for what actually matters. Fight it with a default-deny posture for context: every segment must justify its tokens by answering 'what decision does this inform?' If nothing in the next three steps depends on a segment, it does not belong in the window — it belongs in the vector store from m15, retrievable on demand. The discipline is the same as budgeting money: default to not spending, and make every expense defend itself."
      },
      {
        kind: "code",
        heading: "A Window Budget Allocator",
        lang: "javascript",
        code: "// Divide the window up front; enforce it every turn.\nfunction makeBudget(windowSize, policy = {}) {\n  const p = Object.assign(\n    { system: 0.05, tools: 0.10, history: 0.45, retrieved: 0.20, headroom: 0.20 },\n    policy\n  );\n  const caps = Object.fromEntries(\n    Object.entries(p).map(([k, frac]) => [k, Math.floor(windowSize * frac)])\n  );\n  return {\n    caps,\n    check(usage) {\n      // usage: { system, tools, history, retrieved } in tokens\n      const over = Object.entries(usage)\n        .filter(([k, v]) => v > (caps[k] ?? Infinity))\n        .map(([k, v]) => `${k}: ${v} > cap ${caps[k]}`);\n      const total = Object.values(usage).reduce((a, b) => a + b, 0);\n      if (total > windowSize - caps.headroom) over.push(`headroom violated`);\n      return { ok: over.length === 0, over };\n    },\n  };\n}\n\nconst budget = makeBudget(128000);\nconsole.log(budget.caps); // { system: 6400, tools: 12800, history: 57600, retrieved: 25600, headroom: 25600 }\nconsole.log(budget.check({ system: 3000, tools: 9000, history: 60000, retrieved: 10000 }));\n// { ok: false, over: ['history: 60000 > cap 57600'] } -> compact history now",
        note: "Caps are policy, not physics: tune the fractions per task type, but always keep headroom sacred. Revisit the fractions quarterly against real traffic — policies drift as tasks evolve."
      },
      {
        kind: "callout",
        tone: "key",
        title: "Headroom Is Sacred",
        body: "Reserve 15 to 20 percent of every window for the model's output and never spend it on inputs. A window at 100 percent fill does not just risk an API error — it leaves the model no room to think, and long generations get cut off mid-reasoning. If your budget check ever reports a headroom violation, compact or truncate before the next model call, not after it fails. Apply default-deny to context as a standing rule: every segment must justify its tokens, and anything the next three steps do not depend on belongs in long-term memory, retrievable on demand — not in the window, taxed every turn."
      }
    ],
    takeaways: [
      "Budget real windows — 128k, 200k, 1M tokens — by part: system prompt, tool schemas, history, retrieved content, and sacred headroom.",
      "Tool results, not chat history, are usually what fills the window; defend at ingestion with truncation and pagination.",
      "Context rot is real: past ~50-60% fill, lost-in-the-middle and attention dilution degrade reasoning before any API limit.",
      "Curation beats capacity: a small, dense, well-ordered context outperforms a huge cluttered one on quality, latency, and cost."
    ],
    quiz: [
      {
        q: "Roughly how much English text fits in a 128k-token window?",
        options: ["About 30 pages", "About 300 pages — at ~4 characters per token, minus fixed costs like tool schemas", "About 3,000 pages", "An unlimited amount; 128k is just a billing tier"],
        answer: 2,
        why: "At ~4 chars/token, 128k tokens ≈ 500k characters ≈ 300 pages — and fixed costs (system prompt, tool schemas) eat a chunk before the task starts."
      },
      {
        q: "In a typical agent loop, what most often fills the context window fastest?",
        options: ["Verbose tool results — one untruncated search or file read can inject tens of thousands of tokens in a single step", "The user's short chat messages", "The model's own brief answers", "The JSON brackets in tool schemas"],
        answer: 0,
        why: "Tool outputs are the silent killer: a single large result dwarfs many turns of chat. Veterans defend the window at ingestion time."
      },
      {
        q: "What is 'context rot'?",
        options: ["Data corruption in the vector database", "A tokenizer bug that mangles Unicode", "When the API deletes old messages without warning", "Performance degradation — lost-in-the-middle retrieval failures and attention dilution — as the window fills, well before any API limit"],
        answer: 3,
        why: "Fitting is not attending: past ~50-60% fill, buried information gets systematically underweighted even though the tokens are paid for."
      },
      {
        q: "Why is 'lost in the middle' a problem for RAG-style evidence placement?",
        options: ["It only affects the first and last documents", "Models systematically overweight the start and end of the window, so evidence buried in the middle gets underweighted", "It is a myth with no measured effect", "It only happens in windows under 8k tokens"],
        answer: 1,
        why: "Positional bias is measured and consistent: retrieval accuracy at 5% or 95% of the window beats 50% by 20-40 points on many tasks."
      },
      {
        q: "Your budget allocator reports a headroom violation. The correct response is to…",
        options: ["Ignore it; headroom is just a suggestion", "Compact or truncate inputs before the next model call — never spend the reserved output space", "Increase the temperature to compensate", "Switch to a smaller model"],
        answer: 2,
        why: "Headroom is sacred: it reserves space for the model's answer. Spending it risks API errors and generations cut off mid-reasoning."
      },
      {
        q: "A team upgrades from a 128k to a 1M window without changing what goes into context. The likely result?",
        options: ["Quality, latency, and cost all improve proportionally", "Mostly higher latency and cost, with little quality gain — curation beats capacity", "Context rot disappears entirely", "Token counting becomes unnecessary"],
        answer: 0,
        why: "Capacity without curation buys tokens, not attention. The documented failure mode is paying for a bigger window full of the same distracting clutter."
      },
      {
        q: "Why should token usage be measured per part (system, tools, history) rather than as one total?",
        options: ["Per-part measurement is required by law", "Because you need to know WHAT is eating the window to fix it — totals tell you there is a problem, parts tell you which defense to apply", "Totals are impossible to compute", "It makes the dashboard look more professional"],
        answer: 3,
        why: "A 90k total could mean bloated tool schemas (fix: fewer/leaner tools) or runaway history (fix: compaction) — the remedy depends entirely on the breakdown."
      },
      {
        q: "Which ordering principle best defends against positional bias?",
        options: ["Randomize the order of all context every turn", "Goal and constraints first, most relevant evidence next, recent history last — with ruthless truncation of everything else", "Put the most important content exactly in the middle", "Alphabetical order by content hash"],
        answer: 1,
        why: "Place what matters where attention is strongest — the start and the end — and keep the context small and dense so there is less middle to get lost in."
      }
    ]
  },
  es: {
    title: "La ventana de contexto como memoria de trabajo",
    tagline: "La ventana de contexto es la memoria de trabajo del modelo: finita, cara y tuya para presupuestar.",
    objectives: [
      "Presupuestar una ventana de contexto en tokens usando límites reales: ventanas de 128k, 200k y 1M de tokens.",
      "Contabilizar todo lo que llena la ventana: prompt del sistema, esquemas de herramientas, historial y resultados de herramientas.",
      "Reconocer la putrefacción del contexto (context rot) — dilución de la atención y pérdida en el medio — y defenderte con margen y estructura."
    ],
    sections: [
      {
        kind: "text",
        heading: "Tu presupuesto en tokens",
        body: "La ventana de contexto es la memoria de trabajo del modelo: todo aquello con lo que el modelo puede «pensar» ahora mismo debe caber dentro. A diferencia de la memoria de trabajo humana, su tamaño es público y exacto. Niveles comunes que encontrarás en la práctica: 128 000 tokens (el nivel de trabajo para modelos de clase GPT-4 y Claude Sonnet), 200 000 tokens (la clásica ventana grande de Claude) y 1 000 000 de tokens (modelos de contexto largo de clase Gemini). Estos números parecen generosos hasta que haces la aritmética de un bucle de agente real.\n\nUn token son aproximadamente 4 caracteres de texto en inglés, como tres cuartos de palabra. Eso significa que 128k tokens contienen unas 300 páginas de texto, 200k unas 450 páginas y 1M más de 2000 páginas. Parece suficiente. Ahora resta los costes fijos. Un prompt del sistema serio ocupa de 2000 a 5000 tokens. Los esquemas de herramientas — las definiciones JSON de cada herramienta que el modelo puede llamar — suman fácilmente de 500 a 2000 tokens por herramienta; un agente con 15 herramientas puede quemar 15 000 tokens antes de que el usuario haya dicho una palabra. El historial de conversación crece con cada turno, y los resultados de herramientas son el asesino silencioso: una llamada a `search.docs` que devuelva 10 documentos largos puede inyectar 20 000 tokens en un solo paso.\n\nEl *harness* (arnés) es la oficina del presupuesto. Nadie más impedirá que la ventana se llene: el modelo seguirá consumiendo contexto alegremente hasta chocar con el límite y que la API devuelva un error, o peor, hasta que el rendimiento se haya degradado en silencio mucho antes del límite. Presupuestar significa decidir de antemano cómo se divide la ventana — cuánto para el prompt del sistema, cuánto para herramientas, cuánto para historial, cuánto margen para la respuesta — y hacerlo cumplir en código, en cada turno. Una ventana que no presupuestas es una ventana que desbordarás en el peor momento posible."
      },
      {
        kind: "text",
        heading: "Mira cómo se llena una ventana",
        body: "Leer sobre presupuestos de tokens es abstracto; ver cómo se llena uno es visceral. El simulador de abajo te permite construir un contexto de agente realista pieza a pieza — añadir un prompt del sistema, adjuntar esquemas de herramientas, ejecutar unas iteraciones del bucle con resultados voluminosos — y ver cómo la barra del presupuesto sube hacia el límite de una ventana de 128k, 200k o 1M. Pruébalo abajo: apila cinco herramientas con esquemas grandes, luego ejecuta diez iteraciones que devuelvan cada una un resultado de búsqueda de 3000 tokens, y observa lo rápido que «hay sitio de sobra» se convierte en «estamos al 82 por ciento y la tarea va por la mitad».\n\nFíjate en qué añadidos mueven más la aguja. Los principiantes culpan al historial de conversación; los veteranos culpan a los resultados de herramientas. Un único `read.file` sin truncar sobre un fichero de 2000 líneas, o un `query.database` que devuelva 500 filas como JSON, puede pesar más que veinte turnos de chat. Por eso los harnesses de producción truncan, resumen o paginan las salidas de herramientas antes de que lleguen al modelo: la ventana se defiende en la ingesta, no en el desbordamiento.\n\nObserva también la asimetría: las entradas son baratas de añadir y caras de quitar. Una vez que 40 000 tokens de salida de herramientas están en el historial, cada llamada posterior al modelo los paga de nuevo — la atención se calcula sobre toda la ventana, cada token, cada paso. El contexto no es almacenamiento; es un impuesto recurrente. El token más barato es el que nunca entra en la ventana."
      },
      {
        kind: "code",
        heading: "Contar tokens en JavaScript",
        lang: "javascript",
        code: "// Production code would call the provider's tokenizer; this estimator is\n// accurate within ~10% for English and good enough for budgeting logic.\nfunction estimateTokens(text) {\n  if (!text) return 0;\n  // ~4 chars per token for prose; code and JSON are denser (~3.2 chars).\n  const looksLikeCode = /[{}\\[\\];=]/.test(text.slice(0, 500));\n  const charsPerToken = looksLikeCode ? 3.2 : 4.0;\n  return Math.ceil(text.length / charsPerToken);\n}\n\nfunction contextUsage({ systemPrompt, toolSchemas, history, headroom = 8000 }) {\n  const parts = {\n    system: estimateTokens(systemPrompt),\n    tools: toolSchemas.reduce((n, s) => n + estimateTokens(JSON.stringify(s)), 0),\n    history: history.reduce((n, m) => n + estimateTokens(m.content), 0),\n    headroom, // reserved for the model's answer: never spend this\n  };\n  const used = parts.system + parts.tools + parts.history;\n  return Object.assign({}, parts, { used, total: used + headroom });\n}\n\nconst u = contextUsage({\n  systemPrompt: \"You are a careful assistant that answers concisely.\",\n  toolSchemas: [{ name: \"search\", description: \"Search the documentation index\", parameters: {} }],\n  history: [{ role: \"user\", content: \"Summarize these docs\" }],\n});\nconsole.log(u); // { system, tools, history, headroom, used, total }",
        note: "Estima por partes, no solo el total: necesitas saber QUÉ se come la ventana para corregirlo."
      },
      {
        kind: "text",
        heading: "Putrefacción del contexto: cuando las ventanas grandes se tuercen",
        body: "Esta es la trampa de la era del millón de tokens: caber no es lo mismo que atender. A medida que la ventana se llena, el rendimiento del modelo sobre la información enterrada en el medio se degrada — el bien documentado efecto «perdido en el medio» (lost-in-the-middle). La precisión de recuperación de un dato al 5% o al 95% de la ventana se mantiene alta; el mismo dato al 50% puede caer de 20 a 40 puntos según el modelo y la tarea. El modelo técnicamente lo ve todo y efectivamente usa los bordes. Los ingenieros lo llaman putrefacción del contexto (context rot): la ventana está llena, los tokens están pagados y el razonamiento es peor que con un contexto menor y mejor curado.\n\nLa putrefacción tiene tres causas que se combinan. Primera, dilución de la atención: con 100 000 tokens compitiendo, cada token recibe una porción más fina del foco del modelo, así que las señales débiles — la única frase contradictoria en un documento largo — se diluyen. Segunda, sesgo posicional: los modelos sobreponderan el inicio (instrucciones) y el final (turnos recientes) de la ventana, lo que significa que tu evidencia cuidadosamente recuperada en el medio queda sistemáticamente infraponderada. Tercera, acumulación de distracciones: las salidas irrelevantes de herramientas no solo desperdician tokens; desvían activamente el razonamiento del modelo, y cuantas más hay, más fuerte es el tirón.\n\nLa defensa es la curaduría, no la capacidad. Pasar de 128k a 1M sin cambiar lo que metes en la ventana suele comprar latencia y coste, no calidad. El patrón ganador es un contexto pequeño, denso y bien ordenado: el objetivo y las restricciones primero, la evidencia más relevante después, el historial reciente al final, y truncado despiadado de todo lo demás. Mídelo tú mismo: ejecuta tu batería de evaluación al 20%, 50% y 80% de llenado con la misma tarea. La mayoría de los equipos descubre que su acantilado de calidad empieza en torno al 50 o 60%, mucho antes de cualquier límite de la API."
      },
      {
        kind: "code",
        heading: "Un asignador de presupuesto de ventana",
        lang: "javascript",
        code: "// Divide the window up front; enforce it every turn.\nfunction makeBudget(windowSize, policy = {}) {\n  const p = Object.assign(\n    { system: 0.05, tools: 0.10, history: 0.45, retrieved: 0.20, headroom: 0.20 },\n    policy\n  );\n  const caps = Object.fromEntries(\n    Object.entries(p).map(([k, frac]) => [k, Math.floor(windowSize * frac)])\n  );\n  return {\n    caps,\n    check(usage) {\n      // usage: { system, tools, history, retrieved } in tokens\n      const over = Object.entries(usage)\n        .filter(([k, v]) => v > (caps[k] ?? Infinity))\n        .map(([k, v]) => `${k}: ${v} > cap ${caps[k]}`);\n      const total = Object.values(usage).reduce((a, b) => a + b, 0);\n      if (total > windowSize - caps.headroom) over.push(`headroom violated`);\n      return { ok: over.length === 0, over };\n    },\n  };\n}\n\nconst budget = makeBudget(128000);\nconsole.log(budget.caps); // { system: 6400, tools: 12800, history: 57600, retrieved: 25600, headroom: 25600 }\nconsole.log(budget.check({ system: 3000, tools: 9000, history: 60000, retrieved: 10000 }));\n// { ok: false, over: ['history: 60000 > cap 57600'] } -> compact history now",
        note: "Los límites son política, no física: ajusta las fracciones por tipo de tarea, pero mantén siempre sagrado el margen."
      },
      {
        kind: "callout",
        tone: "key",
        title: "El margen es sagrado",
        body: "Reserva del 15 al 20 por ciento de cada ventana para la salida del modelo y no lo gastes nunca en entradas. Una ventana llena al 100 por ciento no solo arriesga un error de la API: deja al modelo sin espacio para pensar, y las generaciones largas se cortan a mitad del razonamiento. Si tu comprobación de presupuesto reporta una violación del margen, compacta o trunca antes de la siguiente llamada al modelo, no después de que falle."
      }
    ],
    takeaways: [
      "Presupuesta ventanas reales — 128k, 200k, 1M de tokens — por partes: prompt del sistema, esquemas de herramientas, historial, contenido recuperado y margen sagrado.",
      "Los resultados de herramientas, no el historial del chat, son lo que suele llenar la ventana; defiéndela en la ingesta con truncado y paginación.",
      "La putrefacción del contexto es real: pasado un 50-60% de llenado, la pérdida en el medio y la dilución de la atención degradan el razonamiento antes de cualquier límite de la API.",
      "La curaduría vence a la capacidad: un contexto pequeño, denso y bien ordenado supera a uno enorme y desordenado en calidad, latencia y coste."
    ],
    quiz: [
      {
        q: "¿Aproximadamente cuánto texto en inglés cabe en una ventana de 128k tokens?",
        options: ["Unas 30 páginas", "Unas 300 páginas: a ~4 caracteres por token, menos los costes fijos como los esquemas de herramientas", "Unas 3000 páginas", "Una cantidad ilimitada; 128k es solo un nivel de facturación"],
        answer: 2,
        why: "A ~4 caracteres por token, 128k tokens ≈ 500k caracteres ≈ 300 páginas, y los costes fijos (prompt del sistema, esquemas de herramientas) consumen una parte antes de que empiece la tarea."
      },
      {
        q: "En un bucle de agente típico, ¿qué llena más rápido la ventana de contexto?",
        options: ["Los resultados verbosos de herramientas: una búsqueda o lectura de fichero sin truncar puede inyectar decenas de miles de tokens en un solo paso", "Los mensajes cortos del usuario en el chat", "Las respuestas breves del propio modelo", "Los corchetes JSON de los esquemas de herramientas"],
        answer: 0,
        why: "Las salidas de herramientas son el asesino silencioso: un único resultado grande eclipsa muchos turnos de chat. Los veteranos defienden la ventana en la ingesta."
      },
      {
        q: "¿Qué es la «putrefacción del contexto» (context rot)?",
        options: ["Corrupción de datos en la base de datos vectorial", "Un bug del tokenizador que destroza el Unicode", "Cuando la API borra mensajes antiguos sin avisar", "Degradación del rendimiento — fallos de recuperación por pérdida en el medio y dilución de la atención — a medida que la ventana se llena, mucho antes de cualquier límite de la API"],
        answer: 3,
        why: "Caber no es atender: pasado un 50-60% de llenado, la información enterrada queda sistemáticamente infraponderada aunque los tokens estén pagados."
      },
      {
        q: "¿Por qué el efecto «perdido en el medio» es un problema para la colocación de evidencia tipo RAG?",
        options: ["Solo afecta al primer y al último documento", "Los modelos sobreponderan sistemáticamente el inicio y el final de la ventana, así que la evidencia enterrada en el medio queda infraponderada", "Es un mito sin efecto medido", "Solo ocurre en ventanas de menos de 8k tokens"],
        answer: 1,
        why: "El sesgo posicional está medido y es consistente: la precisión de recuperación al 5% o 95% de la ventana supera a la del 50% en 20-40 puntos en muchas tareas."
      },
      {
        q: "Tu asignador de presupuesto reporta una violación del margen (headroom). La respuesta correcta es…",
        options: ["Ignorarla; el margen es solo una sugerencia", "Compactar o truncar entradas antes de la siguiente llamada al modelo: no gastar nunca el espacio reservado a la salida", "Subir la temperatura para compensar", "Cambiar a un modelo menor"],
        answer: 2,
        why: "El margen es sagrado: reserva espacio para la respuesta del modelo. Gastarlo arriesga errores de la API y generaciones cortadas a mitad del razonamiento."
      },
      {
        q: "Un equipo pasa de una ventana de 128k a una de 1M sin cambiar lo que mete en el contexto. ¿El resultado probable?",
        options: ["Calidad, latencia y coste mejoran proporcionalmente", "Sobre todo más latencia y coste, con poca ganancia de calidad: la curaduría vence a la capacidad", "La putrefacción del contexto desaparece por completo", "Contar tokens deja de ser necesario"],
        answer: 0,
        why: "La capacidad sin curaduría compra tokens, no atención. El modo de fallo documentado es pagar por una ventana mayor llena del mismo desorden distractor."
      },
      {
        q: "¿Por qué medir el uso de tokens por partes (sistema, herramientas, historial) en lugar de un único total?",
        options: ["La medición por partes es obligatoria por ley", "Porque necesitas saber QUÉ se come la ventana para corregirlo: los totales dicen que hay un problema, las partes dicen qué defensa aplicar", "Los totales son imposibles de calcular", "Hace que el panel se vea más profesional"],
        answer: 3,
        why: "Un total de 90k puede significar esquemas inflados (solución: menos herramientas o más ligeras) o historial desbocado (solución: compactación); el remedio depende por completo del desglose."
      },
      {
        q: "¿Qué principio de ordenación defiende mejor contra el sesgo posicional?",
        options: ["Aleatorizar el orden de todo el contexto en cada turno", "Objetivo y restricciones primero, evidencia más relevante después, historial reciente al final — con truncado despiadado de todo lo demás", "Poner el contenido más importante exactamente en el medio", "Orden alfabético por hash del contenido"],
        answer: 1,
        why: "Coloca lo que importa donde la atención es más fuerte — el inicio y el final — y mantén el contexto pequeño y denso para que haya menos «medio» donde perderse."
      }
    ]
  }
};
