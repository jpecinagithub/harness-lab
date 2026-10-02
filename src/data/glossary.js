// HARNESS LAB glossary — 40 terms, EN + ES (professional European Spanish)
export default [
  {
    term: "Harness",
    en: "The surrounding software that turns a language model into an agent: the loop driver, tool registry, model adapter, and memory layer that let the model perceive, act, and persist across steps.",
    es: "El software que rodea a un modelo de lenguaje para convertirlo en agente: el conductor del bucle, el registro de herramientas, el adaptador del modelo y la capa de memoria que le permiten percibir, actuar y persistir entre pasos.",
  },
  {
    term: "Main loop",
    en: "The core iteration of an agent harness: send context to the model, parse its reply, execute any requested tool calls, append results, and repeat until the model answers or a cap is hit.",
    es: "La iteración central de un harness de agente: enviar el contexto al modelo, interpretar su respuesta, ejecutar las llamadas a herramientas solicitadas, añadir los resultados y repetir hasta que el modelo responde o se alcanza un tope.",
  },
  {
    term: "Tool call",
    en: "A structured request from the model to execute a named tool with JSON arguments; the harness validates, executes, and returns the result into the model's context for the next step.",
    es: "Una petición estructurada del modelo para ejecutar una herramienta nombrada con argumentos JSON; el harness la valida, la ejecuta y devuelve el resultado al contexto del modelo para el siguiente paso.",
  },
  {
    term: "Function calling",
    en: "The model API capability that lets a model emit structured tool calls (name + JSON arguments) instead of free text, so the harness can execute real actions deterministically.",
    es: "La capacidad de la API del modelo que le permite emitir llamadas a herramientas estructuradas (nombre + argumentos JSON) en vez de texto libre, para que el harness pueda ejecutar acciones reales de forma determinista.",
  },
  {
    term: "ReAct",
    en: "A prompting pattern that interleaves Reasoning traces with Actions (tool calls) and Observations (results), giving the model an explicit think-act-observe rhythm inside the loop.",
    es: "Un patrón de prompting que intercala trazas de razonamiento con acciones (llamadas a herramientas) y observaciones (resultados), dando al modelo un ritmo explícito de pensar-actuar-observar dentro del bucle.",
  },
  {
    term: "System prompt",
    en: "The persistent instruction block prepended to every model call that defines the agent's identity, role, rules, and available tools; the highest-leverage text in the harness.",
    es: "El bloque persistente de instrucciones antepuesto a cada llamada al modelo que define la identidad, el rol, las reglas y las herramientas disponibles del agente; el texto de mayor impacto del harness.",
  },
  {
    term: "Context window",
    en: "The maximum amount of text (in tokens) a model can consider in one call, including system prompt, history, tool definitions, and tool results; the hard budget every harness designs against.",
    es: "La cantidad máxima de texto (en tokens) que un modelo puede considerar en una llamada, incluyendo system prompt, historial, definiciones de herramientas y resultados; el presupuesto duro contra el que diseña cada harness.",
  },
  {
    term: "Token",
    en: "The sub-word unit models bill and reason in (roughly 3–4 characters of English per token); the currency of context windows, latency, and API cost.",
    es: "La unidad de subpalabra en la que los modelos facturan y razonan (unos 3–4 caracteres de inglés por token); la moneda de las ventanas de contexto, la latencia y el coste de API.",
  },
  {
    term: "JSON Schema",
    en: "The standard for declaring the shape of a tool's arguments (types, required fields, enums, bounds); the model reads it to construct valid calls and the harness uses it to validate them.",
    es: "El estándar para declarar la forma de los argumentos de una herramienta (tipos, campos obligatorios, enums, límites); el modelo lo lee para construir llamadas válidas y el harness lo usa para validarlas.",
  },
  {
    term: "MCP",
    en: "Model Context Protocol: an open standard where servers expose Tools, Resources, and Prompts over JSON-RPC, and clients in any host app consume them — write once, use in every compatible harness.",
    es: "Model Context Protocol: un estándar abierto donde los servidores exponen Tools, Resources y Prompts sobre JSON-RPC, y los clientes de cualquier app anfitriona los consumen: escribir una vez, usar en cada harness compatible.",
  },
  {
    term: "MCP server",
    en: "The capability side of MCP: a process or endpoint that advertises tools, resources, and prompts and executes them, knowing nothing about which host or model connects.",
    es: "El lado de las capacidades en MCP: un proceso o endpoint que anuncia herramientas, recursos y prompts y los ejecuta, sin saber qué host o modelo se conecta.",
  },
  {
    term: "MCP client",
    en: "The protocol session inside the host: exactly one client per server connection, handling initialization, capability negotiation, and JSON-RPC request routing.",
    es: "La sesión de protocolo dentro del host: exactamente un cliente por conexión a servidor, que gestiona la inicialización, la negociación de capacidades y el enrutado de peticiones JSON-RPC.",
  },
  {
    term: "MCP host",
    en: "The user-facing application (harness, IDE, assistant) that owns the UI, API keys, model connection, and the trust boundary deciding which servers to connect and which tools need approval.",
    es: "La aplicación visible al usuario (harness, IDE, asistente) que posee la interfaz, las claves API, la conexión con el modelo y la frontera de confianza que decide a qué servidores conectarse y qué herramientas necesitan aprobación.",
  },
  {
    term: "Resource (MCP)",
    en: "An MCP primitive for read-only data the host attaches to context via URI (e.g. file:///notes/todo.md); fetched by harness code without burning a model tool-call round-trip.",
    es: "Una primitiva MCP para datos de solo lectura que el host adjunta al contexto vía URI (p. ej. file:///notes/todo.md); obtenida por el código del harness sin quemar una ida y vuelta de llamada a herramienta del modelo.",
  },
  {
    term: "Skill",
    en: "A packaged bundle of expertise: curated instructions plus a scoped tool set plus workflow knowledge, versioned and routable so the harness loads exactly one sharp brief per task.",
    es: "Un paquete de pericia: instrucciones curadas más un conjunto acotado de herramientas más conocimiento del flujo de trabajo, versionado y enrutable para que el harness cargue un único briefing afilado por tarea.",
  },
  {
    term: "Subagent",
    en: "A child agent spawned by a parent agent to handle a delegated subtask with its own context, returning a result; the core mechanism for parallel and hierarchical agent work.",
    es: "Un agente hijo lanzado por un agente padre para resolver una subtarea delegada con su propio contexto, devolviendo un resultado; el mecanismo central del trabajo paralelo y jerárquico entre agentes.",
  },
  {
    term: "Planning loop",
    en: "An outer loop where the agent first decomposes a goal into a plan of steps, then executes them, replanning when observations diverge — planning separated from acting.",
    es: "Un bucle externo donde el agente primero descompone un objetivo en un plan de pasos, luego los ejecuta, replanificando cuando las observaciones divergen: planificar separado de actuar.",
  },
  {
    term: "Reflection loop",
    en: "A loop stage where the agent critiques its own draft output or trajectory against criteria and revises it before proceeding, catching errors a single pass would miss.",
    es: "Una fase del bucle donde el agente critica su propio borrador o trayectoria según unos criterios y lo revisa antes de continuar, detectando errores que una sola pasada pasaría por alto.",
  },
  {
    term: "Human-in-the-loop",
    en: "A design where the harness pauses at defined checkpoints (approval gates) for explicit human decisions before continuing, keeping people in control of consequential actions.",
    es: "Un diseño donde el harness se pausa en puntos definidos (puertas de aprobación) para decisiones humanas explícitas antes de continuar, manteniendo a las personas al control de las acciones con consecuencias.",
  },
  {
    term: "Short-term memory",
    en: "The rolling window of recent conversation turns kept in context; capped and evicted as it grows, since every retained turn costs tokens on every step.",
    es: "La ventana rodante de turnos recientes de conversación mantenida en el contexto; limitada y desalojada al crecer, ya que cada turno conservado cuesta tokens en cada paso.",
  },
  {
    term: "Long-term memory",
    en: "Durable facts the agent keeps across sessions — user preferences, pinned findings, learned constraints — stored outside context and selectively reloaded when relevant.",
    es: "Hechos duraderos que el agente conserva entre sesiones (preferencias del usuario, hallazgos fijados, restricciones aprendidas), guardados fuera del contexto y recargados selectivamente cuando son relevantes.",
  },
  {
    term: "Embeddings",
    en: "Dense numeric vectors representing the meaning of text, where similar meanings sit close together; the basis for semantic search over memory and documents.",
    es: "Vectores numéricos densos que representan el significado de un texto, donde significados parecidos quedan próximos; la base de la búsqueda semántica sobre memoria y documentos.",
  },
  {
    term: "Vector store",
    en: "A database optimized for storing embeddings and retrieving the nearest vectors to a query, used to give agents semantic recall over large memories and corpora.",
    es: "Una base de datos optimizada para guardar embeddings y recuperar los vectores más cercanos a una consulta, usada para dar a los agentes recuerdo semántico sobre memorias y corpus grandes.",
  },
  {
    term: "RAG",
    en: "Retrieval-Augmented Generation: fetching relevant documents (often via a vector store) and injecting them into the prompt so the model answers from retrieved evidence instead of pure parametric memory.",
    es: "Retrieval-Augmented Generation: obtener documentos relevantes (a menudo vía un vector store) e inyectarlos en el prompt para que el modelo responda desde evidencia recuperada en vez de solo su memoria paramétrica.",
  },
  {
    term: "Compaction",
    en: "Compressing a long conversation or trace into a shorter summary that preserves the facts needed to continue, reclaiming context-window space mid-task.",
    es: "Comprimir una conversación o traza larga en un resumen más corto que conserva los hechos necesarios para continuar, recuperando espacio de la ventana de contexto a mitad de tarea.",
  },
  {
    term: "Summarization",
    en: "Condensing tool outputs, documents, or history into shorter text; the harness's main lever for keeping context small when raw content is too large to retain verbatim.",
    es: "Condensar salidas de herramientas, documentos o historial en texto más corto; la principal palanca del harness para mantener pequeño el contexto cuando el contenido crudo es demasiado grande para conservarlo literal.",
  },
  {
    term: "Streaming",
    en: "Delivering model output token-by-token as it is generated instead of waiting for the complete response; improves perceived latency and lets the harness react (e.g. stop) mid-generation.",
    es: "Entregar la salida del modelo token a token según se genera, en vez de esperar la respuesta completa; mejora la latencia percibida y permite al harness reaccionar (p. ej. detener) a mitad de generación.",
  },
  {
    term: "Stop sequence",
    en: "A string that tells the model API to halt generation when produced (e.g. \"```\" or a custom marker); used to bound outputs and to delimit structured sections.",
    es: "Una cadena que indica a la API del modelo detener la generación al producirla (p. ej. \"```\" o un marcador propio); usada para acotar salidas y delimitar secciones estructuradas.",
  },
  {
    term: "Max iterations",
    en: "The hard cap on loop steps per task; the circuit breaker that guarantees a runaway agent stops, bounding worst-case latency and cost.",
    es: "El tope duro de pasos del bucle por tarea; el cortacircuitos que garantiza que un agente desbocado se detiene, acotando la latencia y el coste en el peor caso.",
  },
  {
    term: "Idempotency",
    en: "The property that repeating a tool call with the same arguments has the same effect as calling it once; essential for safe retries in loops where a call may be re-issued after a failure.",
    es: "La propiedad de que repetir una llamada a herramienta con los mismos argumentos tiene el mismo efecto que llamarla una vez; esencial para reintentos seguros en bucles donde una llamada puede reemitirse tras un fallo.",
  },
  {
    term: "Fan-out/fan-in",
    en: "A parallel pattern where the harness issues multiple independent tool calls at once (fan-out) and then combines their results (fan-in), cutting wall-clock latency for independent subtasks.",
    es: "Un patrón paralelo donde el harness emite varias llamadas a herramientas independientes a la vez (fan-out) y luego combina sus resultados (fan-in), reduciendo la latencia real en subtareas independientes.",
  },
  {
    term: "Approval gate",
    en: "A checkpoint where the loop pauses and requires explicit human approval before executing a consequential tool call; the standard guard for destructive or irreversible actions.",
    es: "Un punto de control donde el bucle se pausa y exige aprobación humana explícita antes de ejecutar una llamada a herramienta con consecuencias; la protección estándar para acciones destructivas o irreversibles.",
  },
  {
    term: "Prompt injection",
    en: "An attack where untrusted content processed by the harness (web pages, files, quoted text) contains instructions that steer the model against its task; defended in layers, never by a single filter.",
    es: "Un ataque donde contenido no confiable procesado por el harness (páginas web, archivos, texto citado) contiene instrucciones que desvían al modelo de su tarea; se defiende por capas, nunca con un solo filtro.",
  },
  {
    term: "Observability",
    en: "The practice of making harness behavior answerable from logs: what the model saw and decided, what tools did, per-step latency and cost — the foundation of debugging, evals, and cost control.",
    es: "La práctica de hacer el comportamiento del harness respondible desde registros: qué vio y decidió el modelo, qué hicieron las herramientas, latencia y coste por paso; el cimiento de la depuración, las evaluaciones y el control de costes.",
  },
  {
    term: "Trace",
    en: "A structured, replayable record of one agent run — every iteration's inputs, model decisions, tool calls, results, latencies, and costs; the raw material for debugging and evals.",
    es: "Un registro estructurado y reproducible de una ejecución del agente: entradas, decisiones del modelo, llamadas a herramientas, resultados, latencias y costes de cada iteración; la materia prima para depurar y evaluar.",
  },
  {
    term: "Temperature",
    en: "The sampling randomness parameter of model generation: low values make output deterministic and focused, high values make it varied and creative; harnesses usually keep it low for tool-calling reliability.",
    es: "El parámetro de aleatoriedad del muestreo en la generación del modelo: valores bajos dan salidas deterministas y enfocadas, valores altos las hacen variadas y creativas; los harness suelen mantenerla baja para llamadas a herramientas fiables.",
  },
  {
    term: "Tool registry",
    en: "The harness-side catalog mapping tool names to their definitions (description, JSON Schema, implementation); described to the model every step, so its size is a permanent context-window tax.",
    es: "El catálogo del lado del harness que mapea nombres de herramientas a sus definiciones (descripción, JSON Schema, implementación); se describe al modelo en cada paso, así que su tamaño es un impuesto permanente sobre la ventana de contexto.",
  },
  {
    term: "Parallel tool calls",
    en: "The model requesting several independent tools in a single response turn; the harness executes them concurrently and returns all results together, saving round-trips.",
    es: "El modelo solicitando varias herramientas independientes en un único turno de respuesta; el harness las ejecuta en paralelo y devuelve todos los resultados juntos, ahorrando idas y vueltas.",
  },
  {
    term: "Transport (stdio/SSE)",
    en: "MCP's two message carriers: stdio runs the server as a local child process (zero networking, dies with the host), SSE exposes it as an HTTP service any networked host can reach (needs auth, TLS, rate limits).",
    es: "Los dos portadores de mensajes de MCP: stdio ejecuta el servidor como proceso hijo local (cero red, muere con el host), SSE lo expone como servicio HTTP alcanzable por cualquier host con red (necesita auth, TLS y límites de tasa).",
  },
  {
    term: "One-shot vs agentic",
    en: "One-shot: a single model call answers the task — cheap and predictable. Agentic: a loop with tools iterates toward the answer — powerful for multi-step work, but with variable cost (5–30 calls) and a need for iteration caps and budgets.",
    es: "One-shot: una sola llamada al modelo responde la tarea; barato y predecible. Agente: un bucle con herramientas itera hacia la respuesta; potente para trabajo de varios pasos, pero con coste variable (5–30 llamadas) y necesidad de topes de iteración y presupuestos.",
  },
];
