export default {
  id: "m12",
  level: 3,
  n: 4,
  icon: "Users",
  sim: null,
  en: {
    title: "Delegation & Human-in-the-Loop",
    tagline: "Fan work out to subagents, synthesize it back — and put a human gate in front of anything irreversible.",
    objectives: [
      "Design fan-out/fan-in delegation: spawn subagents on independent subtasks, then synthesize their results.",
      "Place approval gates on irreversible, expensive, or ambiguous actions with default-deny timeouts.",
      "Write escalation policies that route failures to the right responder: retry, subagent, or human."
    ],
    sections: [
      {
        kind: "text",
        heading: "Subagents: Spawn, Fan Out, Fan In",
        body: "Delegation is the loop pattern for parallelism. When a task decomposes into subtasks that are independent — researching five competitors, summarizing ten documents, probing three APIs — running them sequentially in one loop is pure waste. Instead, the parent agent spawns subagents, each a full agent loop with its own context window, tools, and system prompt, scoped to exactly one subtask. They run concurrently. When they finish, the parent fans the results back in and synthesizes them into a single answer. The pattern is spawn, fan out, fan in, synthesize.\n\nEach subagent gets a fresh context window, which is the hidden superpower of delegation. Ten documents at 8,000 tokens each would crush a single 128k window once you add prompts and tool schemas; ten subagents each read one document in a clean window and return a 500-token summary. The parent's context stays small and focused on synthesis. This is also the failure-isolation story from m09 made concrete: a subagent that crashes, loops, or hallucinates poisons only its own subtask, and the parent can retry or drop that branch without losing the other nine.\n\nDelegation has strict prerequisites, and skipping them is the classic failure. Subtasks must be genuinely independent — no shared mutable state, no ordering constraints the parent forgot to encode. Each subtask needs a crisp contract: inputs, expected output shape, and done criteria. Without contracts, fan-in becomes archaeology: ten blobs of prose the parent must somehow reconcile. And synthesis is itself a model call that needs budgeting — it is not free, and for large fan-outs (20+ branches) it can become the bottleneck. A good rule: delegate when subtasks are independent and each takes more than ~5 steps; below that, the spawn and synthesis overhead eats the win.\n\nWatch out for the most common delegation bug: the subtask that is not actually independent. It usually hides in shared mutable state — two subagents writing to the same document, or one branch's output silently depending on another branch's side effects. The symptom is flakiness: the fan-out works nine times and produces garbage the tenth, depending on timing. The fix is to make independence structural, not hopeful: give each subagent its own scratch space, forbid cross-branch communication in the subtask prompt, and have the parent merge results explicitly during synthesis. If two subtasks must coordinate, they are one subtask — merge them and stop pretending."
      },
      {
        kind: "code",
        heading: "Fan-Out / Fan-In with Timeouts",
        lang: "javascript",
        code: "async function fanOutFanIn({ spawnSubagent, subtasks, synthesize, timeoutMs = 120000 }) {\n  const branches = subtasks.map((t) =>\n    Promise.race([\n      spawnSubagent(t), // each gets a fresh context window + scoped prompt\n      new Promise((_, reject) =>\n        setTimeout(() => reject(new Error(`subagent timeout: ${t.id}`)), timeoutMs))\n    ])\n      .then((result) => ({ id: t.id, ok: true, result }))\n      .catch((err) => ({ id: t.id, ok: false, error: err.message }))\n  );\n  const settled = await Promise.all(branches); // fan in: wait for all\n  const failed = settled.filter((b) => !b.ok);\n  // Synthesize from successes; report failures explicitly, never silently drop.\n  return synthesize({ results: settled.filter((b) => b.ok), failures: failed });\n}",
        note: "Every branch gets a timeout and a structured envelope; the synthesizer sees both results and failures."
      },
      {
        kind: "text",
        heading: "Approval Gates: When to Ask the Human",
        body: "Some actions should never run on model authority alone. Sending an email to a customer, deleting data, charging a card, merging to the main branch, publishing a post — these are irreversible or expensive, and the cost of a mistake dwarfs the cost of asking. An approval gate pauses the loop before such an action, presents the proposed action with its context and evidence to a human, and resumes only on explicit approval. This is human-in-the-loop as a control, not as a chatbot feature.\n\nThe gate needs a policy, not vibes. Classify actions into tiers: auto-approve (read-only operations, idempotent writes to scratch space), notify (approve automatically but log prominently, e.g., creating a draft), and require-approval (irreversible, external, or financial effects). The policy lives in the *harness* (arnés) as data — a table mapping action patterns to tiers — so it is auditable and testable, not buried in a prompt the model might talk its way around. Critically, the model must never be able to approve its own gate: the approval decision comes from outside the loop, via a UI, a message, or an API callback.\n\nTimeouts make gates production-safe. A gate that waits forever is a stuck task; a gate that defaults to approve on timeout is a security hole. Default to deny: if the human does not respond within the window — 15 minutes for interactive chat, longer for async queues — the action is rejected and the loop continues with a safe alternative or escalates. Log every gate event: what was proposed, the evidence shown, who decided, and when. In regulated contexts this log is the difference between 'the agent did it' and an accountable decision trail.\n\nEscalation policies also need an owner and a clock. 'Escalate to the on-call engineer' is not a policy; it is a wish. A real policy names the responder for each tier, the response-time expectation, and what the loop does while waiting: does it pause the whole task, continue with other branches, or time out into a safe default? For approval gates, define the waiting behavior explicitly — most production systems let independent branches continue while the gated action waits, then reconcile. And every escalation must carry context: the trace so far, what was tried, and what decision is needed. An escalation without context is just a notification; with context, it is a handoff."
      },
      {
        kind: "callout",
        tone: "key",
        title: "A Gate Is a Control, Not a Crutch",
        body: "Human-in-the-loop does not fix a bad agent; it contains one. If your loop needs human approval on every third step, the task decomposition is wrong — the human becomes the slowest, most expensive part of the loop. Gates belong at the boundary of irreversibility: few, explicit, and fast to decide. Everything inside the boundary should run autonomously, or you have built a very expensive autocomplete. Also name an owner and a clock for every escalation tier: who responds, how fast, and what the loop does while waiting. 'Escalate to on-call' without those three is a wish, not a policy."
      },
      {
        kind: "code",
        heading: "Policy-Driven Approval Gate",
        lang: "javascript",
        code: "// Policy as data: auditable, testable, invisible to prompt injection.\nconst POLICY = [\n  { match: /^(read|search|list)\\./, tier: \"auto\" },\n  { match: /^draft\\./, tier: \"notify\" },\n  { match: /^(send|delete|charge|merge|publish)\\./, tier: \"require\" },\n];\n\nasync function gatedAction({ action, args, evidence, requestApproval, timeoutMs = 900000 }) {\n  const tier = POLICY.find((p) => p.match.test(action))?.tier ?? \"require\";\n  if (tier === \"auto\") return runTool(action, args);\n  if (tier === \"notify\") { notifyHuman({ action, args }); return runTool(action, args); }\n\n  // tier === \"require\": default-deny on timeout. The model cannot approve itself.\n  const decision = await Promise.race([\n    requestApproval({ action, args, evidence }),\n    new Promise((r) => setTimeout(() => r({ approved: false, reason: \"timeout: default-deny\" }), timeoutMs)),\n  ]);\n  auditLog.push({ at: Date.now(), action, args, decision });\n  if (!decision.approved) throw new Error(`rejected: ${decision.reason}`);\n  return runTool(action, args);\n}",
        note: "Unknown actions fall through to 'require': the safe default for anything the policy author did not anticipate."
      },
      {
        kind: "checklist",
        heading: "Delegation & Human-in-the-Loop Checklist",
        items: [
          "Delegate only independent subtasks with crisp contracts: inputs, output shape, and done criteria per branch.",
          "Give every subagent a timeout and a structured result envelope; fan-in must surface failures, never silently drop them.",
          "Budget the synthesis step — it is a model call, and the bottleneck for large fan-outs.",
          "Classify actions into auto / notify / require-approval tiers as data in the harness, not as prompt prose.",
          "Gates default to deny on timeout; the model can never approve its own gate.",
          "Log every gate decision with evidence, decider, and timestamp for an accountable trail.",
          "Write the escalation ladder: retry in-loop → delegate to subagent → approval gate → human takeover, in that order.",
          "Make subtask independence structural: separate scratch space per branch, no cross-branch communication, parent merges explicitly."
        ]
      }
    ],
    takeaways: [
      "Delegation parallelizes independent subtasks, giving each subagent a fresh context window and isolating failures per branch.",
      "Fan-out/fan-in needs contracts per subtask, per-branch timeouts, and a budgeted synthesis step — otherwise fan-in is archaeology.",
      "Approval gates belong at the boundary of irreversibility, driven by a policy table with default-deny timeouts.",
      "Escalation is a ladder — retry, delegate, gate, human — and every rung must be explicit in the harness."
    ],
    quiz: [
      {
        q: "What is the hidden superpower of delegating document summarization to ten subagents instead of one loop?",
        options: ["Subagents are always smarter than the parent", "It eliminates the need for a synthesis step", "Each subagent gets a fresh context window, so the parent's context stays small and one branch's failure poisons only its own subtask", "Subagents never need timeouts"],
        answer: 2,
        why: "Fresh windows per branch solve both context pressure and failure isolation at once. The parent only ever sees compact summaries plus explicit failure reports."
      },
      {
        q: "Which is a strict prerequisite for safe delegation?",
        options: ["Subtasks must be genuinely independent, each with a crisp contract: inputs, output shape, and done criteria", "All subtasks must use the same model", "The parent must watch every subagent step in real time", "Delegation only works with exactly three subagents"],
        answer: 0,
        why: "Independence plus contracts is what makes fan-in tractable. Without them, branches interfere and their outputs cannot be reconciled."
      },
      {
        q: "An approval gate times out with no human response. The safe behavior is to…",
        options: ["Approve automatically — the human probably agrees", "Retry the approval request forever", "Default to deny: reject the action and continue with a safe alternative or escalate", "Let the model approve its own action to keep velocity"],
        answer: 2,
        why: "Default-deny is the only safe timeout semantic. Approve-on-timeout turns every unattended moment into a security hole, and self-approval defeats the gate entirely."
      },
      {
        q: "Why should the approval policy live as data in the harness rather than as instructions in the prompt?",
        options: ["Prompts cannot contain lists", "Data tables are auditable and testable, and the model cannot talk its way around a code-level policy the way it can reinterpret prompt prose", "It makes the prompt shorter for aesthetic reasons", "Policies in code run faster on GPUs"],
        answer: 1,
        why: "A policy the model can read is a policy the model can argue with. Enforcement belongs in code the model cannot negotiate."
      },
      {
        q: "A loop asks for human approval on every third step. According to the module, this means…",
        options: ["The human-in-the-loop design is working perfectly", "The task decomposition is wrong — the human has become the slowest, most expensive part of the loop", "More gates should be added for safety", "The model needs a higher temperature"],
        answer: 1,
        why: "Gates belong at the boundary of irreversibility: few and explicit. Approval on routine steps means autonomy failed upstream, at decomposition time."
      },
      {
        q: "In fan-out/fan-in, what should happen to a branch that times out?",
        options: ["Silently drop it so synthesis stays clean", "Report it explicitly as a failure to the synthesizer, alongside the successful results", "Restart the entire fan-out from scratch", "Pretend it succeeded with empty output"],
        answer: 1,
        why: "Silent drops corrupt synthesis with survivorship bias. The synthesizer must know what failed to weigh the partial results honestly."
      },
      {
        q: "Which action tier fits 'send.email to a customer'?",
        options: ["auto — emails are harmless", "notify — send it, just log prominently", "require — external, hard-to-reverse effect, so a human approves first", "It depends on the model's mood"],
        answer: 2,
        why: "External, hard-to-reverse effects sit squarely in require-approval. The cost of a mistaken send dwarfs the cost of one approval click."
      },
      {
        q: "What is the correct escalation ladder?",
        options: ["Human takeover first, then retry, then delegate", "Retry in-loop → delegate to a subagent → approval gate → human takeover", "Delete the task and start over at each failure", "Escalation ladders are unnecessary with good prompts"],
        answer: 1,
        why: "Escalation should climb from cheapest to most expensive: local retry, then isolated delegation, then a gate, then a human — each rung explicit in the harness."
      }
    ]
  },
  es: {
    title: "Delegación y humano en el bucle",
    tagline: "Distribuye el trabajo entre subagentes, sintetiza el resultado — y pon una puerta humana ante todo lo irreversible.",
    objectives: [
      "Diseñar delegación fan-out/fan-in: lanzar subagentes en subtareas independientes y sintetizar sus resultados.",
      "Colocar puertas de aprobación en acciones irreversibles, caras o ambiguas, con denegación por defecto ante timeout.",
      "Escribir políticas de escalada que dirijan los fallos al respondedor adecuado: reintento, subagente o humano."
    ],
    sections: [
      {
        kind: "text",
        heading: "Subagentes: lanzar, distribuir, reintegrar",
        body: "La delegación es el patrón de bucles para el paralelismo. Cuando una tarea se descompone en subtareas independientes — investigar cinco competidores, resumir diez documentos, probar tres APIs — ejecutarlas en secuencia en un único bucle es puro desperdicio. En su lugar, el agente padre lanza subagentes, cada uno un bucle de agente completo con su propia ventana de contexto, herramientas y prompt del sistema, acotado a exactamente una subtarea. Corren en concurrente. Al terminar, el padre reintegra los resultados y los sintetiza en una única respuesta. El patrón es lanzar, distribuir (fan-out), reintegrar (fan-in) y sintetizar.\n\nCada subagente recibe una ventana de contexto fresca, que es el superpoder oculto de la delegación. Diez documentos de 8000 tokens cada uno aplastarían una única ventana de 128k en cuanto sumas prompts y esquemas de herramientas; diez subagentes leen cada uno un documento en una ventana limpia y devuelven un resumen de 500 tokens. El contexto del padre se mantiene pequeño y enfocado en la síntesis. Esta es también la historia de aislamiento de fallos de m09 hecha concreta: un subagente que se bloquea, itera sin fin o alucina solo envenena su propia subtarea, y el padre puede reintentar o descartar esa rama sin perder las otras nueve.\n\nLa delegación tiene prerrequisitos estrictos, y saltárselos es el fallo clásico. Las subtareas deben ser genuinamente independientes — sin estado mutable compartido, sin restricciones de orden que el padre olvidó codificar. Cada subtarea necesita un contrato nítido: entradas, forma de salida esperada y criterios de finalización. Sin contratos, la reintegración se vuelve arqueología: diez bloques de prosa que el padre debe reconciliar de algún modo. Y la síntesis es en sí misma una llamada al modelo que hay que presupuestar — no es gratis, y para distribuciones grandes (más de 20 ramas) puede convertirse en el cuello de botella. Una buena regla: delega cuando las subtareas sean independientes y cada una tome más de unos 5 pasos; por debajo, el coste de lanzar y sintetizar se come la ganancia.\n\nCuidado con el bug más común de la delegación: la subtarea que no es realmente independiente. Suele esconderse en estado mutable compartido — dos subagentes escribiendo en el mismo documento, o la salida de una rama dependiendo en silencio de los efectos laterales de otra. El síntoma es la intermitencia: la distribución funciona nueve veces y produce basura la décima, según el timing. La solución es hacer la independencia estructural, no esperanzada: espacio temporal propio para cada subagente, prohibir la comunicación entre ramas en el prompt de la subtarea y hacer que el padre fusione los resultados explícitamente durante la síntesis. Si dos subtareas deben coordinarse, son una sola subtarea: fusiónalas y deja de fingir."
      },
      {
        kind: "code",
        heading: "Fan-out / fan-in con timeouts",
        lang: "javascript",
        code: "async function fanOutFanIn({ spawnSubagent, subtasks, synthesize, timeoutMs = 120000 }) {\n  const branches = subtasks.map((t) =>\n    Promise.race([\n      spawnSubagent(t), // each gets a fresh context window + scoped prompt\n      new Promise((_, reject) =>\n        setTimeout(() => reject(new Error(`subagent timeout: ${t.id}`)), timeoutMs))\n    ])\n      .then((result) => ({ id: t.id, ok: true, result }))\n      .catch((err) => ({ id: t.id, ok: false, error: err.message }))\n  );\n  const settled = await Promise.all(branches); // fan in: wait for all\n  const failed = settled.filter((b) => !b.ok);\n  // Synthesize from successes; report failures explicitly, never silently drop.\n  return synthesize({ results: settled.filter((b) => b.ok), failures: failed });\n}",
        note: "Cada rama recibe un timeout y un sobre estructurado; el sintetizador ve tanto resultados como fallos."
      },
      {
        kind: "text",
        heading: "Puertas de aprobación: cuándo preguntar al humano",
        body: "Algunas acciones nunca deberían ejecutarse solo con la autoridad del modelo. Enviar un correo a un cliente, borrar datos, cargar una tarjeta, fusionar a la rama principal, publicar un post — son irreversibles o caras, y el coste de un error eclipsa el coste de preguntar. Una puerta de aprobación pausa el bucle antes de tal acción, presenta la acción propuesta con su contexto y evidencia a un humano, y solo reanuda con aprobación explícita. Esto es humano-en-el-bucle como control, no como funcionalidad de chatbot.\n\nLa puerta necesita una política, no sensaciones. Clasifica las acciones en niveles: aprobación automática (operaciones de solo lectura, escrituras idempotentes en espacio temporal), notificar (aprobar automáticamente pero registrar de forma prominente, p. ej. crear un borrador) y requiere-aprobación (efectos irreversibles, externos o financieros). La política vive en el *harness* (arnés) como datos — una tabla que mapea patrones de acción a niveles — para que sea auditable y testeable, no enterrada en un prompt con el que el modelo podría negociar. Críticamente, el modelo nunca debe poder aprobar su propia puerta: la decisión de aprobación viene de fuera del bucle, vía interfaz, mensaje o callback de API.\n\nLos timeouts hacen las puertas seguras en producción. Una puerta que espera eternamente es una tarea atascada; una puerta que aprueba por defecto ante timeout es un agujero de seguridad. Denegación por defecto: si el humano no responde en la ventana — 15 minutos para chat interactivo, más para colas asíncronas — la acción se rechaza y el bucle continúa con una alternativa segura o escala. Registra cada evento de puerta: qué se propuso, la evidencia mostrada, quién decidió y cuándo. En contextos regulados este registro es la diferencia entre «el agente lo hizo» y una pista de decisión con responsables.\n\nLas políticas de escalada también necesitan responsable y reloj. «Escalar al ingeniero de guardia» no es una política; es un deseo. Una política real nombra al respondedor de cada nivel, la expectativa de tiempo de respuesta y qué hace el bucle mientras espera: ¿pausa toda la tarea, continúa con otras ramas o expira hacia un valor seguro por defecto? Para las puertas de aprobación, define el comportamiento de espera explícitamente: la mayoría de los sistemas de producción dejan que las ramas independientes continúen mientras la acción bajo puerta espera, y luego reconcilian. Y cada escalada debe llevar contexto: la traza hasta ahora, qué se intentó y qué decisión se necesita. Una escalada sin contexto es solo una notificación; con contexto, es un traspaso."
      },
      {
        kind: "callout",
        tone: "key",
        title: "Una puerta es un control, no una muleta",
        body: "El humano-en-el-bucle no arregla un mal agente; lo contiene. Si tu bucle necesita aprobación humana cada tres pasos, la descomposición de la tarea está mal — el humano se convierte en la parte más lenta y cara del bucle. Las puertas pertenecen a la frontera de la irreversibilidad: pocas, explícitas y rápidas de decidir. Todo lo que quede dentro de la frontera debería correr de forma autónoma, o habrás construido un autocompletado muy caro. Nombra también un responsable y un reloj para cada nivel de escalada: quién responde, en cuánto tiempo y qué hace el bucle mientras espera. «Escalar a guardia» sin esas tres cosas es un deseo, no una política."
      },
      {
        kind: "code",
        heading: "Puerta de aprobación dirigida por política",
        lang: "javascript",
        code: "// Policy as data: auditable, testable, invisible to prompt injection.\nconst POLICY = [\n  { match: /^(read|search|list)\\./, tier: \"auto\" },\n  { match: /^draft\\./, tier: \"notify\" },\n  { match: /^(send|delete|charge|merge|publish)\\./, tier: \"require\" },\n];\n\nasync function gatedAction({ action, args, evidence, requestApproval, timeoutMs = 900000 }) {\n  const tier = POLICY.find((p) => p.match.test(action))?.tier ?? \"require\";\n  if (tier === \"auto\") return runTool(action, args);\n  if (tier === \"notify\") { notifyHuman({ action, args }); return runTool(action, args); }\n\n  // tier === \"require\": default-deny on timeout. The model cannot approve itself.\n  const decision = await Promise.race([\n    requestApproval({ action, args, evidence }),\n    new Promise((r) => setTimeout(() => r({ approved: false, reason: \"timeout: default-deny\" }), timeoutMs)),\n  ]);\n  auditLog.push({ at: Date.now(), action, args, decision });\n  if (!decision.approved) throw new Error(`rejected: ${decision.reason}`);\n  return runTool(action, args);\n}",
        note: "Las acciones desconocidas caen a «require»: el valor seguro por defecto para lo que el autor de la política no anticipó."
      },
      {
        kind: "checklist",
        heading: "Lista de delegación y humano-en-el-bucle",
        items: [
          "Delega solo subtareas independientes con contratos nítidos: entradas, forma de salida y criterios de finalización por rama.",
          "Da a cada subagente un timeout y un sobre de resultado estructurado; la reintegración debe mostrar los fallos, nunca descartarlos en silencio.",
          "Presupuesta el paso de síntesis: es una llamada al modelo y el cuello de botella en distribuciones grandes.",
          "Clasifica las acciones en niveles auto / notify / require-approval como datos en el harness, no como prosa del prompt.",
          "Las puertas deniegan por defecto ante timeout; el modelo nunca puede aprobar su propia puerta.",
          "Registra cada decisión de puerta con evidencia, decisor y marca temporal para una pista con responsables.",
          "Escribe la escalera de escalada: reintento en el bucle → delegar a subagente → puerta de aprobación → toma de control humana, en ese orden."
        ]
      }
    ],
    takeaways: [
      "La delegación paraleliza subtareas independientes, dando a cada subagente una ventana de contexto fresca y aislando fallos por rama.",
      "El fan-out/fan-in necesita contratos por subtarea, timeouts por rama y un paso de síntesis presupuestado — si no, la reintegración es arqueología.",
      "Las puertas de aprobación pertenecen a la frontera de la irreversibilidad, dirigidas por una tabla de políticas con denegación por defecto ante timeout.",
      "La escalada es una escalera — reintentar, delegar, puerta, humano — y cada peldaño debe ser explícito en el harness."
    ],
    quiz: [
      {
        q: "¿Cuál es el superpoder oculto de delegar el resumen de documentos a diez subagentes en lugar de un bucle?",
        options: ["Los subagentes siempre son más listos que el padre", "Elimina la necesidad del paso de síntesis", "Cada subagente recibe una ventana de contexto fresca, así el contexto del padre se mantiene pequeño y el fallo de una rama solo envenena su propia subtarea", "Los subagentes nunca necesitan timeouts"],
        answer: 2,
        why: "Las ventanas frescas por rama resuelven a la vez la presión de contexto y el aislamiento de fallos. El padre solo ve resúmenes compactos más informes explícitos de fallos."
      },
      {
        q: "¿Cuál es un prerrequisito estricto para una delegación segura?",
        options: ["Las subtareas deben ser genuinamente independientes, cada una con un contrato nítido: entradas, forma de salida y criterios de finalización", "Todas las subtareas deben usar el mismo modelo", "El padre debe observar cada paso de cada subagente en tiempo real", "La delegación solo funciona con exactamente tres subagentes"],
        answer: 0,
        why: "La independencia más los contratos es lo que hace tratable la reintegración. Sin ellos, las ramas interfieren y sus salidas no se pueden reconciliar."
      },
      {
        q: "Una puerta de aprobación expira sin respuesta humana. El comportamiento seguro es…",
        options: ["Aprobar automáticamente: el humano probablemente está de acuerdo", "Reintentar la solicitud de aprobación eternamente", "Denegar por defecto: rechazar la acción y continuar con una alternativa segura o escalar", "Dejar que el modelo apruebe su propia acción para mantener velocidad"],
        answer: 2,
        why: "La denegación por defecto es la única semántica segura ante timeout. Aprobar ante timeout convierte cada momento desatendido en un agujero de seguridad, y la autoaprobación anula la puerta por completo."
      },
      {
        q: "¿Por qué la política de aprobación debe vivir como datos en el harness y no como instrucciones en el prompt?",
        options: ["Los prompts no pueden contener listas", "Las tablas de datos son auditables y testeables, y el modelo no puede discutir una política a nivel de código como sí puede reinterpretar la prosa del prompt", "Hace el prompt más corto por estética", "Las políticas en código corren más rápido en GPU"],
        answer: 1,
        why: "Una política que el modelo puede leer es una política con la que el modelo puede discutir. La aplicación pertenece al código que el modelo no puede negociar."
      },
      {
        q: "Un bucle pide aprobación humana cada tres pasos. Según el módulo, esto significa…",
        options: ["Que el diseño de humano-en-el-bucle funciona perfectamente", "Que la descomposición de la tarea está mal: el humano se ha convertido en la parte más lenta y cara del bucle", "Que hay que añadir más puertas por seguridad", "Que el modelo necesita mayor temperatura"],
        answer: 1,
        why: "Las puertas pertenecen a la frontera de la irreversibilidad: pocas y explícitas. La aprobación en pasos rutinarios significa que la autonomía falló antes, en la descomposición."
      },
      {
        q: "En fan-out/fan-in, ¿qué debe pasar con una rama que expira por timeout?",
        options: ["Descartarla en silencio para que la síntesis quede limpia", "Informarla explícitamente como fallo al sintetizador, junto a los resultados exitosos", "Reiniciar toda la distribución desde cero", "Fingir que tuvo éxito con salida vacía"],
        answer: 1,
        why: "Los descartes silenciosos corrompen la síntesis con sesgo de supervivencia. El sintetizador debe saber qué falló para ponderar honestamente los resultados parciales."
      },
      {
        q: "¿Qué nivel corresponde a «send.email a un cliente»?",
        options: ["auto: los correos son inofensivos", "notify: enviarlo y solo registrarlo de forma prominente", "El estado de ánimo del modelo", "require: efecto externo y difícil de revertir, así que un humano aprueba primero"],
        answer: 3,
        why: "Los efectos externos y difíciles de revertir caen de lleno en requiere-aprobación. El coste de un envío erróneo eclipsa el coste de un clic de aprobación."
      },
      {
        q: "¿Cuál es la escalera de escalada correcta?",
        options: ["Toma de control humana primero, luego reintento, luego delegar", "Reintento en el bucle → delegar a un subagente → puerta de aprobación → toma de control humana", "Borrar la tarea y empezar de cero ante cada fallo", "Las escaleras de escalada son innecesarias con buenos prompts"],
        answer: 1,
        why: "La escalada debe subir de lo más barato a lo más caro: reintento local, luego delegación aislada, luego puerta, luego humano — cada peldaño explícito en el harness."
      }
    ]
  }
};
