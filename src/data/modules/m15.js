export default {
  id: "m15",
  level: 4,
  n: 3,
  icon: "Database",
  sim: "memory",
  en: {
    title: "Long-Term Memory",
    tagline: "Give the agent a past: store experiences as embeddings, retrieve them as memory, and expose both as tools.",
    objectives: [
      "Explain embeddings and vector stores with real numbers: dimensions, cosine similarity, and retrieval thresholds.",
      "Distinguish episodic, semantic, and procedural memory — and choose the right one per use case.",
      "Expose memory to the agent loop as tools: memory_write at decision points, memory_search when the past is relevant."
    ],
    sections: [
      {
        kind: "text",
        heading: "Beyond the Window: Embeddings",
        body: "The context window is working memory; it vanishes when the session ends. Long-term memory is what survives: facts, experiences, and skills the agent can recall in future sessions. The machinery underneath is the *embedding* — a model that converts text into a dense vector of numbers capturing its meaning. Similar meanings land near each other in vector space, which turns 'find relevant memories' into a geometry problem: compute the embedding of the query, find the stored vectors closest to it.\n\nReal numbers to anchor on. Common embedding dimensions: 768 (compact models), 1,536 (the classic OpenAI ada-scale), and 3,072 (large modern models). Bigger is not automatically better for memory: 768 dimensions at 4 bytes each is 3 KB per memory — a million memories fit in 3 GB. Closeness is measured with cosine similarity, from -1 (opposite) to 1 (identical direction). In practice, retrieval thresholds live around 0.70 to 0.85: below 0.70 you drown in false positives, above 0.85 you miss useful paraphrases. These thresholds are not universal constants — calibrate them on your own data, because embedding geometry shifts with domain and language.\n\nThe vector store is the database that holds these vectors and answers nearest-neighbor queries fast — milliseconds over millions of vectors with indexes like HNSW. For a harness, the store can start embarrassingly simple: an in-memory array with brute-force cosine similarity handles thousands of memories with no infrastructure at all. Graduate to a real vector database (pgvector, Qdrant, Pinecone) when you need persistence across restarts, metadata filtering ('only memories from this user'), or scale past ~100k vectors. The *harness* (arnés) does not care which store you use; it cares that write and search are fast, reliable tools the loop can call.\n\nA practical warning about dimensions: higher is not always better for retrieval quality. On many domain-specific memory workloads, a well-tuned 768-dimension model beats a generic 3,072-dimension one, because what matters is whether the embedding space separates your concepts — 'refund policy' versus 'billing dispute' — not raw capacity. Bigger vectors also cost more everywhere: 4x the storage, slower index builds, pricier embedding calls. Start at 768 or 1,536, measure retrieval precision on a labeled set of query-memory pairs, and only scale up dimensions when the evals say the space is too cramped. Embedding choice is an empirical question, not a prestige purchase."
      },
      {
        kind: "text",
        heading: "RAG as Memory: Try It Below",
        body: "Retrieval-augmented generation is usually taught as 'search over documents', but for an agent it is better understood as memory: the agent writes down what it learns, and later retrieves what is relevant. The loop is simple — after a task, distill what was learned into short memory texts; before a task, embed the current goal, search the store, and inject the top hits into context. The agent literally gets wiser with use, without any retraining.\n\nThe simulator below makes this concrete. Try it below: write a handful of memories (a user preference, a past failure and its fix, a project fact), then run searches with different queries and watch the similarity scores decide what gets recalled. Notice how a query about 'refund policy' retrieves the refund memory at 0.87 but also drags in a vaguely related billing memory at 0.71 — that is the threshold trade-off from the previous section, live. Push the threshold to 0.85 and the noise vanishes along with some genuinely useful paraphrases.\n\nTwo design decisions dominate everything else. First, what to store: raw transcripts are cheap to write and expensive to retrieve (noisy, long); distilled facts ('the user prefers concise summaries; learned 2026-09-14') are the opposite. Store distillations, not dumps. Second, when to inject: retrieved memories compete for the same window budget from m13, so cap injection at 3 to 5 memories and a fixed token allowance (1,000-2,000 tokens). Memory that floods the window is not memory; it is clutter with a vector index."
      },
      {
        kind: "code",
        heading: "A Minimal Vector Store",
        lang: "javascript",
        code: "// Brute-force cosine search. Handles thousands of memories; no dependencies.\n// Swap the array for pgvector/Qdrant past ~100k vectors.\nfunction cosine(a, b) {\n  let dot = 0, na = 0, nb = 0;\n  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }\n  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);\n}\n\nfunction makeMemoryStore(embed) {\n  const items = []; // { id, text, vector, meta, at }\n  return {\n    async write(text, meta = {}) {\n      const item = { id: crypto.randomUUID(), text, vector: await embed(text), meta, at: Date.now() };\n      items.push(item);\n      return item.id;\n    },\n    async search(query, { topK = 5, minScore = 0.72 } = {}) {\n      const q = await embed(query);\n      return items\n        .map((m) => Object.assign({}, m, { score: cosine(q, m.vector) }))\n        .filter((m) => m.score >= minScore)\n        .sort((a, b) => b.score - a.score)\n        .slice(0, topK);\n    },\n  };\n}",
        note: "The whole retrieval layer in 25 lines: embed, cosine-rank, threshold, top-K. Everything else is scaling."
      },
      {
        kind: "text",
        heading: "Three Kinds of Long-Term Memory",
        body: "Not all memories are the same, and the harness should treat them differently. Episodic memory is the agent's diary: 'on 2026-09-14, the deploy failed because the env var was missing; we fixed it by adding it to the pipeline.' Episodes are timestamped, specific, and most useful for avoiding repeated mistakes. They decay fast — last month's incident is rarely relevant — and they are the noisiest to retrieve, because every episode looks a bit like every other.\n\nSemantic memory is the agent's encyclopedia: distilled, timeless facts. 'The user prefers concise summaries.' 'Refunds require manager approval above 500 EUR.' 'The production database is Postgres 15.' Semantic memories are deduplicated and updated rather than appended: when the refund threshold changes, the old fact is replaced, not supplemented. This is the memory type that most obviously improves with use, and the one where stale facts do the most damage — a superseded fact retrieved at high similarity is worse than no memory at all.\n\nProcedural memory is the agent's muscle memory: how to do things. Reusable skills, playbooks, tool-use patterns — 'to onboard a vendor: create the record, verify tax id, send the welcome pack, in that order.' Procedural memory often lives as versioned documents or even as code (a script the agent learned to reuse) rather than as vectors, because procedures need exactness that similarity search cannot guarantee. When an agent 'learns' a workflow, what you are really building is procedural memory with an approval process for updates.\n\nIn practice the three kinds leak into each other, and the harness needs rules for the boundaries. When an episodic memory gets retrieved successfully ten times, promote it: distill it into a semantic fact and let the episode decay. When a semantic fact accumulates enough exceptions, demote it back to episodes or split it — 'refunds above 500 EUR need approval, except for enterprise tier' is two facts wearing one trench coat. And when a procedural playbook is followed verbatim fifty times, consider compiling it into code: a deterministic script beats a retrieved document for reliability, and it stops consuming retrieval budget entirely. Memory kinds are a lifecycle, not a taxonomy."
      },
      {
        kind: "code",
        heading: "Memory as Tools: memory_write / memory_search",
        lang: "javascript",
        code: "// Tool schemas the agent loop can call. Memory becomes just another\n// capability the model invokes when the past is relevant.\nconst memoryTools = [\n  {\n    name: \"memory_write\",\n    description: \"Store a distilled fact for future sessions. Write facts, not transcripts.\",\n    parameters: {\n      type: \"object\",\n      properties: {\n        text: { type: \"string\", description: \"One distilled fact, self-contained.\" },\n        kind: { type: \"string\", enum: [\"episodic\", \"semantic\", \"procedural\"] },\n      },\n      required: [\"text\", \"kind\"],\n    },\n  },\n  {\n    name: \"memory_search\",\n    description: \"Search long-term memory. Call when the current task resembles past experience.\",\n    parameters: {\n      type: \"object\",\n      properties: {\n        query: { type: \"string\" },\n        kinds: { type: \"array\", items: { type: \"string\" } },\n      },\n      required: [\"query\"],\n    },\n  },\n];\n\n// The harness prompt nudge (one line in the system prompt is enough):\n// \"You have memory_write/memory_search. Record durable facts you learn;\n//  search memory when past experience could help.\"",
        note: "Write at decision points, not every step: a memory per task or per lesson, never a memory per tool call."
      },
      {
        kind: "compare",
        heading: "Episodic vs. Semantic vs. Procedural",
        headers: ["Episodic", "Semantic", "Procedural"],
        rows: [
          ["What", "Timestamped experiences: what happened and what fixed it.", "Timeless facts: preferences, thresholds, stable truths.", "How-to knowledge: playbooks, workflows, reusable skills."],
          ["Example", "'Deploy failed 2026-09-14: missing env var.'", "'Refunds above 500 EUR need manager approval.'", "'Vendor onboarding: record, tax id, welcome pack.'"],
          ["Update rule", "Append; decay by age.", "Replace on change; deduplicate.", "Version with review; exactness matters."],
          ["Retrieval risk", "Noisy: episodes blur together.", "Stale facts retrieved confidently.", "Wrong version applied exactly."],
          ["Storage", "Vectors with timestamps.", "Vectors, deduplicated.", "Often documents or code, not vectors."],
          ["Lifecycle", "Decays; promote to semantic when repeatedly useful.", "Splits when exceptions accumulate; superseded facts replaced.", "Compiles into code when followed verbatim often enough."]
        ]
      }
    ],
    takeaways: [
      "Embeddings turn memory into geometry: 768-3,072 dimensions, cosine similarity, retrieval thresholds around 0.70-0.85.",
      "RAG-as-memory means distilling lessons into short texts on write and injecting at most 3-5 hits on read.",
      "Episodic memory logs experiences, semantic memory keeps facts, procedural memory keeps playbooks — each with its own update rule.",
      "Expose memory as tools the loop calls deliberately; write at decision points, never per tool call."
    ],
    quiz: [
      {
        q: "What does an embedding model produce, and why is it useful for memory?",
        options: ["A compressed ZIP of the text for cheaper storage", "A dense vector capturing meaning, so 'find relevant memories' becomes a nearest-neighbor geometry problem", "A summary written by a larger model", "An encryption key for the memory database"],
        answer: 2,
        why: "Embeddings place similar meanings near each other in vector space; cosine similarity then retrieves by meaning, not keywords."
      },
      {
        q: "A memory store uses a cosine-similarity threshold of 0.55. The likely symptom is…",
        options: ["Retrieval drowned in false positives — vaguely related memories flood the context", "Perfect precision on every query", "Faster queries than a higher threshold", "Memories that never decay"],
        answer: 0,
        why: "Below ~0.70, similarity stops discriminating: the agent retrieves noise. The practical band is 0.70-0.85, calibrated per domain."
      },
      {
        q: "'The production database is Postgres 15' is which kind of memory?",
        options: ["Episodic — it describes a specific event", "Procedural — it describes a workflow", "It is not a memory at all", "Semantic — a distilled, timeless fact"],
        answer: 3,
        why: "Semantic memory holds stable facts. Episodic would be timestamped ('on 2026-09-14 we migrated…'); procedural would be a how-to."
      },
      {
        q: "Why store distilled facts rather than raw transcripts as memories?",
        options: ["Transcripts are illegal to store", "Raw transcripts are cheap to write but noisy and long to retrieve; distillations are compact and precise", "Embeddings cannot process long texts", "Distillations use more dimensions"],
        answer: 1,
        why: "Retrieval quality depends on what you stored. A 40k-token transcript buries the one lesson; a one-line fact retrieves cleanly."
      },
      {
        q: "When should the agent call memory_write?",
        options: ["After every single tool call, for completeness", "At decision points: one memory per task or per durable lesson learned — never per tool call", "Only when the user explicitly says 'remember this'", "Once per year during maintenance"],
        answer: 2,
        why: "Per-step writes flood the store with noise and cost an embedding call each time. Decision-point writes keep memory dense and valuable."
      },
      {
        q: "Why does procedural memory often live as versioned documents or code rather than vectors?",
        options: ["Vectors cannot store text", "Procedures need exactness — similarity search retrieves 'close enough', which is dangerous for step-by-step workflows", "Documents are cheaper than databases", "Procedural memory is never retrieved"],
        answer: 0,
        why: "A playbook applied approximately is a playbook applied wrong. Exact artifacts with versioned updates beat fuzzy retrieval for how-to knowledge."
      },
      {
        q: "The update rule for semantic memory is…",
        options: ["Append everything; never delete", "Replace on change and deduplicate — a superseded fact retrieved confidently is worse than no memory", "Decay by age like episodic memory", "Rewrite all facts weekly on a schedule"],
        answer: 3,
        why: "Semantic facts claim timelessness, so stale ones are actively harmful. Replacement and dedup keep the encyclopedia truthful."
      },
      {
        q: "Retrieved memories are capped at 3-5 hits and 1,000-2,000 tokens because…",
        options: ["The vector store cannot return more", "Retrieved content competes for the same window budget as everything else — memory that floods the window is clutter with an index", "Cosine similarity breaks past 5 results", "Users dislike reading more than 5 memories"],
        answer: 1,
        why: "Memory injection spends the m13 budget. Uncapped retrieval reintroduces the context-pressure symptom that memory was supposed to relieve."
      }
    ]
  },
  es: {
    title: "Memoria a largo plazo",
    tagline: "Dale al agente un pasado: almacena experiencias como embeddings, recupéralas como memoria y expón ambas como herramientas.",
    objectives: [
      "Explicar embeddings y almacenes vectoriales con números reales: dimensiones, similitud coseno y umbrales de recuperación.",
      "Distinguir memoria episódica, semántica y procedimental — y elegir la adecuada por caso de uso.",
      "Exponer la memoria al bucle del agente como herramientas: memory_write en puntos de decisión, memory_search cuando el pasado sea relevante."
    ],
    sections: [
      {
        kind: "text",
        heading: "Más allá de la ventana: embeddings",
        body: "La ventana de contexto es memoria de trabajo; se esfuma cuando termina la sesión. La memoria a largo plazo es lo que sobrevive: hechos, experiencias y habilidades que el agente puede recordar en futuras sesiones. La maquinaria subyacente es el *embedding* — un modelo que convierte texto en un vector denso de números que captura su significado. Los significados similares quedan cerca entre sí en el espacio vectorial, lo que convierte «encontrar recuerdos relevantes» en un problema de geometría: calcula el embedding de la consulta y encuentra los vectores almacenados más cercanos.\n\nNúmeros reales para anclarte. Dimensiones comunes de embeddings: 768 (modelos compactos), 1536 (la clásica escala ada de OpenAI) y 3072 (modelos grandes modernos). Más grande no es automáticamente mejor para memoria: 768 dimensiones a 4 bytes cada una son 3 KB por recuerdo — un millón de recuerdos caben en 3 GB. La cercanía se mide con similitud coseno, de -1 (opuesto) a 1 (dirección idéntica). En la práctica, los umbrales de recuperación viven en torno a 0,70-0,85: por debajo de 0,70 te ahogas en falsos positivos, por encima de 0,85 pierdes paráfrasis útiles. Estos umbrales no son constantes universales: calíbralos con tus propios datos, porque la geometría de los embeddings cambia con el dominio y el idioma.\n\nEl almacén vectorial es la base de datos que guarda estos vectores y responde consultas de vecinos más cercanos rápido — milisegundos sobre millones de vectores con índices como HNSW. Para un harness, el almacén puede empezar de forma vergonzosamente simple: un array en memoria con búsqueda coseno por fuerza bruta maneja miles de recuerdos sin infraestructura. Pasa a una base vectorial real (pgvector, Qdrant, Pinecone) cuando necesites persistencia entre reinicios, filtrado por metadatos («solo recuerdos de este usuario») o escala más allá de ~100k vectores. Al *harness* (arnés) no le importa qué almacén uses; le importa que escribir y buscar sean herramientas rápidas y fiables que el bucle pueda llamar.\n\nUn aviso práctico sobre dimensiones: más no siempre es mejor para la calidad de recuperación. En muchas cargas de memoria de dominio específico, un modelo de 768 dimensiones bien ajustado supera a uno genérico de 3072: lo que importa es si el espacio de embeddings separa tus conceptos — «política de reembolsos» frente a «disputa de facturación» —, no la capacidad bruta. Los vectores mayores también cuestan más en todo: 4 veces más almacenamiento, índices más lentos de construir, llamadas de embedding más caras."
      },
      {
        kind: "text",
        heading: "RAG como memoria: pruébalo abajo",
        body: "La generación aumentada por recuperación (RAG) suele enseñarse como «búsqueda sobre documentos», pero para un agente se entiende mejor como memoria: el agente anota lo que aprende y luego recupera lo relevante. El bucle es simple: tras una tarea, destila lo aprendido en textos cortos de memoria; antes de una tarea, calcula el embedding del objetivo actual, busca en el almacén e inyecta los mejores resultados en el contexto. El agente literalmente se vuelve más sabio con el uso, sin ningún reentrenamiento.\n\nEl simulador de abajo lo hace concreto. Pruébalo abajo: escribe un puñado de recuerdos (una preferencia del usuario, un fallo pasado y su solución, un dato del proyecto), luego ejecuta búsquedas con distintas consultas y observa cómo las puntuaciones de similitud deciden qué se recuerda. Fíjate en cómo una consulta sobre «política de reembolsos» recupera el recuerdo de reembolsos a 0,87 pero también arrastra un recuerdo de facturación vagamente relacionado a 0,71 — ese es el compromiso del umbral de la sección anterior, en directo. Sube el umbral a 0,85 y el ruido desaparece junto con algunas paráfrasis genuinamente útiles.\n\nDos decisiones de diseño dominan todo lo demás. Primera, qué almacenar: las transcripciones en bruto son baratas de escribir y caras de recuperar (ruidosas, largas); los hechos destilados («el usuario prefiere resúmenes concisos; aprendido el 2026-09-14») son lo contrario. Almacena destilaciones, no volquetes. Segunda, cuándo inyectar: los recuerdos recuperados compiten por el mismo presupuesto de ventana del m13, así que limita la inyección a 3-5 recuerdos y una asignación fija de tokens (1000-2000 tokens). La memoria que inunda la ventana no es memoria; es desorden con un índice vectorial."
      },
      {
        kind: "code",
        heading: "Un almacén vectorial mínimo",
        lang: "javascript",
        code: "// Brute-force cosine search. Handles thousands of memories; no dependencies.\n// Swap the array for pgvector/Qdrant past ~100k vectors.\nfunction cosine(a, b) {\n  let dot = 0, na = 0, nb = 0;\n  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }\n  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);\n}\n\nfunction makeMemoryStore(embed) {\n  const items = []; // { id, text, vector, meta, at }\n  return {\n    async write(text, meta = {}) {\n      const item = { id: crypto.randomUUID(), text, vector: await embed(text), meta, at: Date.now() };\n      items.push(item);\n      return item.id;\n    },\n    async search(query, { topK = 5, minScore = 0.72 } = {}) {\n      const q = await embed(query);\n      return items\n        .map((m) => Object.assign({}, m, { score: cosine(q, m.vector) }))\n        .filter((m) => m.score >= minScore)\n        .sort((a, b) => b.score - a.score)\n        .slice(0, topK);\n    },\n  };\n}",
        note: "Toda la capa de recuperación en 25 líneas: embedding, ranking por coseno, umbral, top-K. Todo lo demás es escala."
      },
      {
        kind: "text",
        heading: "Tres tipos de memoria a largo plazo",
        body: "No todos los recuerdos son iguales, y el harness debería tratarlos de forma distinta. La memoria episódica es el diario del agente: «el 2026-09-14, el despliegue falló porque faltaba la variable de entorno; lo corregimos añadiéndola al pipeline». Los episodios tienen marca temporal, son específicos y muy útiles para evitar repetir errores. Decaen rápido — el incidente del mes pasado rara vez es relevante — y son los más ruidosos de recuperar, porque cada episodio se parece un poco a los demás.\n\nLa memoria semántica es la enciclopedia del agente: hechos destilados e intemporales. «El usuario prefiere resúmenes concisos». «Los reembolsos requieren aprobación del responsable por encima de 500 EUR». «La base de datos de producción es Postgres 15». Los recuerdos semánticos se deduplican y actualizan en lugar de añadirse: cuando cambia el umbral de reembolso, el hecho antiguo se reemplaza, no se complementa. Este es el tipo de memoria que más obviamente mejora con el uso, y aquel donde los hechos obsoletos hacen más daño: un hecho superado recuperado con alta similitud es peor que no tener memoria.\n\nLa memoria procedimental es la memoria muscular del agente: cómo hacer las cosas. Habilidades reutilizables, manuales, patrones de uso de herramientas — «para dar de alta un proveedor: crea el registro, verifica el NIF, envía el pack de bienvenida, en ese orden». La memoria procedimental suele vivir como documentos versionados o incluso como código (un script que el agente aprendió a reutilizar) más que como vectores, porque los procedimientos necesitan una exactitud que la búsqueda por similitud no puede garantizar. Cuando un agente «aprende» un flujo de trabajo, lo que realmente estás construyendo es memoria procedimental con un proceso de aprobación para las actualizaciones.\n\nEn la práctica los tres tipos se mezclan, y el harness necesita reglas para las fronteras. Cuando un recuerdo episódico se recupera con éxito diez veces, promuévelo: destílalo en un hecho semántico y deja que el episodio decaiga. Cuando un hecho semántico acumula suficientes excepciones, divídelo. Y cuando un manual procedimental se sigue al pie de la letra cincuenta veces, considera compilarlo en código: un script determinista vence a un documento recuperado en fiabilidad y deja de consumir presupuesto de recuperación por completo."
      },
      {
        kind: "code",
        heading: "Memoria como herramientas: memory_write / memory_search",
        lang: "javascript",
        code: "// Tool schemas the agent loop can call. Memory becomes just another\n// capability the model invokes when the past is relevant.\nconst memoryTools = [\n  {\n    name: \"memory_write\",\n    description: \"Store a distilled fact for future sessions. Write facts, not transcripts.\",\n    parameters: {\n      type: \"object\",\n      properties: {\n        text: { type: \"string\", description: \"One distilled fact, self-contained.\" },\n        kind: { type: \"string\", enum: [\"episodic\", \"semantic\", \"procedural\"] },\n      },\n      required: [\"text\", \"kind\"],\n    },\n  },\n  {\n    name: \"memory_search\",\n    description: \"Search long-term memory. Call when the current task resembles past experience.\",\n    parameters: {\n      type: \"object\",\n      properties: {\n        query: { type: \"string\" },\n        kinds: { type: \"array\", items: { type: \"string\" } },\n      },\n      required: [\"query\"],\n    },\n  },\n];\n\n// The harness prompt nudge (one line in the system prompt is enough):\n// \"You have memory_write/memory_search. Record durable facts you learn;\n//  search memory when past experience could help.\"",
        note: "Escribe en puntos de decisión, no en cada paso: un recuerdo por tarea o por lección, nunca un recuerdo por llamada a herramienta."
      },
      {
        kind: "compare",
        heading: "Episódica frente a semántica frente a procedimental",
        headers: ["Episódica", "Semántica", "Procedimental"],
        rows: [
          ["Qué", "Experiencias con fecha: qué pasó y qué lo arregló.", "Hechos intemporales: preferencias, umbrales, verdades estables.", "Conocimiento de cómo: manuales, flujos, habilidades reutilizables."],
          ["Ejemplo", "«Despliegue fallido el 2026-09-14: faltaba la variable de entorno».", "«Los reembolsos por encima de 500 EUR necesitan aprobación del responsable».", "«Alta de proveedor: registro, NIF, pack de bienvenida»."],
          ["Regla de actualización", "Añadir; decae con la edad.", "Reemplazar al cambiar; deduplicar.", "Versionar con revisión; la exactitud importa."],
          ["Riesgo de recuperación", "Ruidosa: los episodios se confunden.", "Hechos obsoletos recuperados con confianza.", "Versión incorrecta aplicada con exactitud."],
          ["Almacenamiento", "Vectores con marcas temporales.", "Vectores, deduplicados.", "A menudo documentos o código, no vectores."]
        ]
      }
    ],
    takeaways: [
      "Los embeddings convierten la memoria en geometría: 768-3072 dimensiones, similitud coseno, umbrales de recuperación en torno a 0,70-0,85.",
      "RAG-como-memoria significa destilar lecciones en textos cortos al escribir e inyectar como máximo 3-5 resultados al leer.",
      "La memoria episódica registra experiencias, la semántica guarda hechos, la procedimental guarda manuales — cada una con su regla de actualización.",
      "Expón la memoria como herramientas que el bucle llama deliberadamente; escribe en puntos de decisión, nunca por llamada a herramienta."
    ],
    quiz: [
      {
        q: "¿Qué produce un modelo de embeddings y por qué es útil para la memoria?",
        options: ["Un ZIP comprimido del texto para almacenamiento más barato", "Un vector denso que captura el significado, así «encontrar recuerdos relevantes» se vuelve un problema geométrico de vecinos cercanos", "Un resumen escrito por un modelo mayor", "Una clave de cifrado para la base de memoria"],
        answer: 2,
        why: "Los embeddings colocan significados similares cerca en el espacio vectorial; la similitud coseno recupera entonces por significado, no por palabras clave."
      },
      {
        q: "Un almacén de memoria usa un umbral de similitud coseno de 0,55. El síntoma probable es…",
        options: ["Recuperación ahogada en falsos positivos: recuerdos vagamente relacionados inundan el contexto", "Precisión perfecta en cada consulta", "Consultas más rápidas que con un umbral mayor", "Recuerdos que nunca decaen"],
        answer: 0,
        why: "Por debajo de ~0,70 la similitud deja de discriminar: el agente recupera ruido. La banda práctica es 0,70-0,85, calibrada por dominio."
      },
      {
        q: "«La base de datos de producción es Postgres 15» es qué tipo de memoria?",
        options: ["Episódica: describe un evento específico", "Procedimental: describe un flujo de trabajo", "No es una memoria en absoluto", "Semántica: un hecho destilado e intemporal"],
        answer: 3,
        why: "La memoria semántica guarda hechos estables. La episódica tendría fecha («el 2026-09-14 migramos…»); la procedimental sería un cómo hacerlo."
      },
      {
        q: "¿Por qué almacenar hechos destilados en lugar de transcripciones en bruto como recuerdos?",
        options: ["Almacenar transcripciones es ilegal", "Las transcripciones en bruto son baratas de escribir pero ruidosas y largas de recuperar; las destilaciones son compactas y precisas", "Los embeddings no pueden procesar textos largos", "Las destilaciones usan más dimensiones"],
        answer: 1,
        why: "La calidad de recuperación depende de lo que almacenaste. Una transcripción de 40k tokens entierra la única lección; un hecho de una línea se recupera limpio."
      },
      {
        q: "¿Cuándo debe el agente llamar a memory_write?",
        options: ["Tras cada llamada a herramienta, por completitud", "En puntos de decisión: un recuerdo por tarea o por lección duradera aprendida — nunca por llamada a herramienta", "Solo cuando el usuario dice explícitamente «recuerda esto»", "Una vez al año durante el mantenimiento"],
        answer: 2,
        why: "Escribir por paso inunda el almacén de ruido y cuesta una llamada de embedding cada vez. Escribir en puntos de decisión mantiene la memoria densa y valiosa."
      },
      {
        q: "¿Por qué la memoria procedimental suele vivir como documentos versionados o código en lugar de vectores?",
        options: ["Los vectores no pueden almacenar texto", "Los procedimientos necesitan exactitud: la búsqueda por similitud recupera «bastante parecido», lo cual es peligroso para flujos paso a paso", "Los documentos son más baratos que las bases de datos", "La memoria procedimental nunca se recupera"],
        answer: 0,
        why: "Un manual aplicado de forma aproximada es un manual aplicado mal. Los artefactos exactos con actualizaciones versionadas vencen a la recuperación difusa para el conocimiento de cómo hacerlo."
      },
      {
        q: "La regla de actualización de la memoria semántica es…",
        options: ["Añadir todo; no borrar nunca", "Decaer con la edad como la memoria episódica", "Reescribir todos los hechos semanalmente con un programador", "Reemplazar al cambiar y deduplicar: un hecho superado recuperado con confianza es peor que no tener memoria"],
        answer: 3,
        why: "Los hechos semánticos pretenden intemporalidad, así que los obsoletos son activamente dañinos. El reemplazo y la deduplicación mantienen veraz la enciclopedia."
      },
      {
        q: "Los recuerdos recuperados se limitan a 3-5 resultados y 1000-2000 tokens porque…",
        options: ["El almacén vectorial no puede devolver más", "El contenido recuperado compite por el mismo presupuesto de ventana que todo lo demás: la memoria que inunda la ventana es desorden con un índice", "La similitud coseno se rompe con más de 5 resultados", "A los usuarios no les gusta leer más de 5 recuerdos"],
        answer: 1,
        why: "La inyección de memoria gasta el presupuesto del m13. La recuperación sin límite reintroduce el síntoma de presión de contexto que la memoria debía aliviar."
      }
    ]
  }
};
