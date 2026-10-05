export default {
  id: "m09",
  level: 3,
  n: 1,
  icon: "GitBranch",
  sim: null,
  en: {
    title: "Do You Need a Second Loop?",
    tagline: "One loop is the default; a second loop is a cost you pay only when the symptoms demand it.",
    objectives: [
      "Apply the 'one loop until it hurts' rule to decide when a secondary loop is justified.",
      "Recognize the five symptoms of an overloaded primary loop: step explosion, context pressure, mixed concerns, error cascades, and latency drift.",
      "Estimate a harness complexity budget in tokens, iterations, and failure modes before adding any new loop."
    ],
    sections: [
      {
        kind: "text",
        heading: "Start With One Loop",
        body: "Every agent begins as a single loop. The model reads the current state, decides what to do next, calls a tool, reads the result, and repeats until the task is done or a stop condition fires. The *harness* (arnés) — the code that wraps the model, dispatches tool calls, manages state, and enforces limits — exists to make that one loop reliable. Before you add planning loops, critic loops, or subagent hierarchies, get brutally honest about what the primary loop already achieves.\n\nA single well-built loop handles a surprising range of real work. A support agent that reads a ticket, searches the docs, and drafts a reply is one loop. A coding agent that reads a file, edits it, runs the tests, and reads the failure output is one loop. A research agent that issues searches, opens pages, and synthesizes an answer is one loop. In each case the loop is the same machinery; only the tools and the system prompt change. The temptation to add loops usually arrives early — 'what if we add a planner?' — and it usually arrives before any measurement.\n\nHere is the uncomfortable arithmetic. Each additional loop multiplies the things you must get right. Two loops need a contract: what each one owns, what data passes between them, and who decides when they disagree. They need separate prompts, separate state, and separate failure handling. They need loop-aware logging, because a single interleaved trace becomes unreadable. And they cost real money: if your primary loop averages 12 iterations at 3,000 tokens of context each, that is roughly 36,000 tokens per task; a planner that re-runs every few steps can easily double it. Complexity is not free, and in harness engineering it compounds faster than intuition suggests.\n\nThere is also a team cost that rarely appears in architecture diagrams. Every loop is a mental model that every engineer on the team must hold: what it owns, when it runs, how it fails. One loop means one mental model and one place to add logging, retries, and guardrails. Two loops mean reasoning about interleavings — did the planner see the executor's latest observation, or a stale copy? Three loops mean a distributed system with all the classic hazards and none of the classic tooling. When someone proposes a new loop, ask who will debug it at 2 a.m. with only the trace to go on. If the answer is uncomfortable silence, the loop is not ready."
      },
      {
        kind: "text",
        heading: "One Loop Until It Hurts",
        body: "The rule is simple: keep one loop until it hurts, and define 'hurts' with numbers, not feelings. A complexity budget is the finite allowance of tokens per task, wall-clock latency, iterations per task, and failure modes you can afford before the system becomes undebuggable or uneconomical. Every loop you add spends from that budget. Spend it like money: deliberately, on measured pain, with an expected return.\n\nThere are five symptoms that reliably indicate the primary loop is structurally overloaded. First, step explosion: tasks routinely need 25 to 40 iterations where similar tasks once needed 8, because the model is thrashing between subtasks. Second, context pressure: the window is 60 to 70 percent full before productive work even starts, eaten by tool schemas, history, and a system prompt doing three jobs. Third, mixed concerns: one system prompt is simultaneously planning the approach, executing steps, and critiquing its own output — three roles, one prompt, and each role dilutes the others. Fourth, error cascades: a single failed tool call poisons the next ten steps because nothing isolates phases from each other. Fifth, latency drift: p99 latency creeps upward release after release as the loop accumulates responsibilities.\n\nThe two-symptom rule turns this into a decision procedure. One symptom is a bad week; fix the loop you have. Two or more persistent symptoms, measured over real traffic across many tasks, justify spending complexity budget on a second loop — and they tell you which loop to build. Step explosion plus mixed concerns points at a planning loop. Error cascades plus context pressure point at delegation with isolated subagents. Latency drift alone points at the tools, not the loop: profile before you architect.\n\nMeasurement deserves its own discipline. Do not eyeball step counts from a handful of demo runs; instrument the harness to log per-task telemetry from day one: iterations used, tokens consumed per part — system, tools, history — tool error rates, and wall-clock time per phase. Aggregate weekly. The numbers that matter are distributions, not anecdotes: p50 and p95, not the worst demo. A team that measures can watch a symptom develop over a month and schedule the architectural work deliberately; a team that does not will add the second loop during an incident, which is the most expensive possible moment to redesign. The complexity budget is only real if someone is keeping the books."
      },
      {
        kind: "code",
        heading: "Anatomy of a Primary Loop",
        lang: "javascript",
        code: "async function runPrimaryLoop({ model, tools, systemPrompt, maxSteps = 25 }) {\n  const messages = [{ role: \"system\", content: systemPrompt }];\n  const trace = []; // one trace, one loop: easy to read\n\n  for (let step = 0; step < maxSteps; step++) {\n    const decision = await model.chat(messages, { tools });\n    messages.push(decision.message);\n    trace.push({ step, type: \"decision\", at: Date.now() });\n\n    if (decision.finishReason === \"stop\") {\n      return { ok: true, answer: decision.message.content, trace };\n    }\n    if (!decision.toolCalls?.length) {\n      return { ok: false, error: \"model stalled: no tool call, no answer\", trace };\n    }\n    for (const call of decision.toolCalls) {\n      try {\n        const result = await tools[call.name](call.args);\n        messages.push({ role: \"tool\", name: call.name, content: result });\n      } catch (err) {\n        // Errors stay inside the loop's history: the model sees and adapts.\n        messages.push({ role: \"tool\", name: call.name, content: `ERROR: ${err.message}` });\n        trace.push({ step, type: \"tool_error\", tool: call.name });\n      }\n    }\n  }\n  return { ok: false, error: \"maxSteps exceeded\", trace };\n}",
        note: "The whole product in 30 lines: decide, act, observe, repeat — with a step cap and a single readable trace."
      },
      {
        kind: "compare",
        heading: "One Loop vs. Two Loops",
        headers: ["One loop", "Two loops"],
        rows: [
          ["Context load", "A single prompt carries everything and grows with task complexity.", "Each loop's prompt stays small; a loop only sees what it owns."],
          ["Failure modes", "One place to debug; errors stay local to the trace.", "Loops can disagree, deadlock, or duplicate work without a contract."],
          ["Latency", "Sequential but predictable; easy to reason about p99.", "Parallel loops can be faster; serial loops add round trips per step."],
          ["Cost per task", "One model call per step, plus tool latency.", "Interacting loops run 2-3x model calls per step when they coordinate."],
          ["Debuggability", "One linear trace to read top to bottom.", "Interleaved traces; you need loop-aware logging and correlation ids."],
          ["Prompt engineering", "One system prompt to tune and version.", "Every loop needs its own prompt, plus the contract between them."],
          ["Onboarding cost", "One mental model: what the loop owns and how it fails.", "Engineers must reason about interleavings, contracts, and stale state between loops."]
        ]
      },
      {
        kind: "callout",
        tone: "warn",
        title: "The Two-Symptom Rule",
        body: "Do not add a loop for a single bad day. Require at least two persistent symptoms — measured over real traffic, not imagined — before spending complexity budget. A second loop you cannot justify in one sentence is a second loop you will regret at 2 a.m. Log step counts, token usage, and error rates per task, and let the numbers make the case. Most 'we need a planner' conversations end the moment someone asks for the measurements. When the numbers do make the case, write the justification down: which two symptoms, measured how, over what traffic, and what the new loop is expected to move. Six months later, that note is how you will know whether the loop earned its keep."
      },
      {
        kind: "code",
        heading: "Scoring Loop Pressure",
        lang: "javascript",
        code: "// Turns raw telemetry into a 0-100 pressure score and a verdict.\n// Run this over a week of real tasks before proposing a second loop.\nfunction loopPressure({ avgSteps, p95Steps, contextFill, errorRate, rolesInPrompt }) {\n  let score = 0;\n  if (avgSteps > 15) score += 20;          // step explosion\n  if (p95Steps > 30) score += 15;\n  if (contextFill > 0.6) score += 20;      // context pressure\n  if (errorRate > 0.15) score += 20;       // error cascades\n  if (rolesInPrompt >= 3) score += 15;     // mixed concerns: plan+act+critique\n  if (avgSteps > 15 && rolesInPrompt >= 3) score += 10; // correlated symptoms\n\n  const verdict =\n    score >= 60 ? \"ADD_LOOP: two or more structural symptoms persist\" :\n    score >= 35 ? \"WATCH: one symptom present, fix the loop you have\" :\n                  \"HEALTHY: one loop is enough\";\n  return { score: Math.min(score, 100), verdict };\n}\n\n// Example: a healthy support agent\nconsole.log(loopPressure({ avgSteps: 8, p95Steps: 14, contextFill: 0.3, errorRate: 0.05, rolesInPrompt: 1 }));\n// { score: 0, verdict: 'HEALTHY: one loop is enough' }",
        note: "A starting heuristic, not a law: calibrate the thresholds against your own traffic."
      }
    ],
    takeaways: [
      "The primary loop — observe, decide, act, repeat — is the default architecture; most agents should ship with exactly one.",
      "Every additional loop spends complexity budget: tokens, latency, failure modes, and debugging surface all compound.",
      "'One loop until it hurts' means measuring pain — step counts, context fill, error cascades, latency — over real traffic.",
      "Spend a second loop only when at least two persistent symptoms point at the same structural problem."
    ],
    quiz: [
      {
        q: "Your agent completes most tasks in 6-10 loop iterations with 30% context fill. A teammate proposes adding a planner loop 'for robustness'. What does the 'one loop until it hurts' rule say?",
        options: ["Keep one loop; there is no measured pain to fix", "Add it but keep it disabled until needed", "Add it — more loops always increase robustness", "Add it only after tasks start failing in production"],
        answer: 0,
        why: "The rule demands measured pain before spending complexity budget. 6-10 steps and 30% context fill show a healthy loop; a planner would add cost and failure modes for no demonstrated return."
      },
      {
        q: "Which of the following is a genuine symptom that a second loop may be justified?",
        options: ["The system prompt is 400 tokens long", "Tasks routinely need 30+ iterations and the window is 70% full before productive work begins", "The model occasionally asks the user a clarifying question", "Tool calls return in under 200 milliseconds"],
        answer: 1,
        why: "Step explosion plus context pressure are two of the five structural symptoms. The other options describe healthy or irrelevant behavior."
      },
      {
        q: "Adding a critic loop to a working single-loop agent will…",
        options: ["Increase cost per task while potentially improving quality — a trade-off to measure", "Always reduce total token cost", "Eliminate hallucinations entirely", "Guarantee that the loop converges"],
        answer: 0,
        why: "A critic loop adds model calls per step, so cost rises. Whether quality improves enough to justify it must be measured, not assumed."
      },
      {
        q: "What is a 'complexity budget' in harness design?",
        options: ["The maximum number of lines allowed in the harness codebase", "The finite allowance of tokens, latency, iterations, and failure modes you can spend before the system becomes undebuggable or uneconomical", "The dollar budget for model API keys", "The number of tools the model is allowed to call"],
        answer: 1,
        why: "The complexity budget frames every architectural addition as spending from a finite allowance of tokens, latency, iterations, and debuggability."
      },
      {
        q: "Two loops that must agree before acting can…",
        options: ["Automatically share one context window", "Never fail if both use the same model", "Deadlock or duplicate work if their contract is underspecified", "Halve latency in every scenario"],
        answer: 2,
        why: "Without a precise contract — who owns what, who decides ties — interacting loops develop emergent failure modes like deadlock and duplicated effort."
      },
      {
        q: "The 'two-symptom rule' states that you should…",
        options: ["Treat two loops as the maximum any harness may have", "Count symptoms only if they appear twice in one day", "Require at least two persistent, measured symptoms before adding a loop", "Always add exactly two loops, no more"],
        answer: 2,
        why: "One symptom is a bad week — fix the existing loop. Two or more persistent symptoms measured over real traffic justify spending budget on a second loop."
      },
      {
        q: "Why is 'error cascades' a structural symptom rather than just a bug?",
        options: ["Because all errors in agents are structural by definition", "Because cascades cannot happen inside a single loop", "Because it means the model's temperature is set too high", "Because one failed tool call poisoning many later steps shows the loop lacks isolation between phases"],
        answer: 3,
        why: "A single failure corrupting downstream steps reveals a structural lack of phase isolation — exactly the kind of problem a separate loop (e.g., delegated subtasks) is designed to fix."
      },
      {
        q: "A support agent handles tickets in 8 steps with 25% context fill, but p99 latency is 45 seconds because one docs-search tool is slow. The right fix is to…",
        options: ["Add a critic loop to review latency", "Raise the iteration cap to 50", "Add a planning loop to reduce steps", "Fix or parallelize the slow tool — the loop itself shows no structural symptoms"],
        answer: 3,
        why: "Latency drift from a single slow tool is a tooling problem, not a loop-architecture problem. The loop metrics are healthy, so profile and fix the tool before architecting."
      }
    ]
  },
  es: {
    title: "¿Necesitas un segundo bucle?",
    tagline: "Un bucle es la opción por defecto; un segundo bucle es un coste que solo pagas cuando los síntomas lo exigen.",
    objectives: [
      "Aplicar la regla de «un bucle hasta que duela» para decidir cuándo está justificado un bucle secundario.",
      "Reconocer los cinco síntomas de un bucle principal sobrecargado: explosión de pasos, presión de contexto, mezcla de responsabilidades, cascadas de errores y deriva de latencia.",
      "Estimar el presupuesto de complejidad de un harness en tokens, iteraciones y modos de fallo antes de añadir un bucle nuevo."
    ],
    sections: [
      {
        kind: "text",
        heading: "Empieza con un bucle",
        body: "Todo agente empieza siendo un único bucle. El modelo lee el estado actual, decide qué hacer a continuación, llama a una herramienta, lee el resultado y repite hasta completar la tarea o hasta que se dispara una condición de parada. El *harness* (arnés) — el código que envuelve al modelo, distribuye las llamadas a herramientas, gestiona el estado e impone límites — existe para que ese único bucle sea fiable. Antes de añadir bucles de planificación, bucles de crítica o jerarquías de subagentes, conviene ser brutalmente honesto sobre lo que el bucle principal ya consigue.\n\nUn único bucle bien construido cubre una cantidad sorprendente de trabajo real. Un agente de soporte que lee un ticket, busca en la documentación y redacta una respuesta es un bucle. Un agente de programación que lee un fichero, lo edita, ejecuta los tests y lee la salida de los fallos es un bucle. Un agente de investigación que lanza búsquedas, abre páginas y sintetiza una respuesta es un bucle. En cada caso el bucle es la misma maquinaria; solo cambian las herramientas y el prompt del sistema. La tentación de añadir bucles suele llegar pronto — «¿y si añadimos un planificador?» — y suele llegar antes de cualquier medición.\n\nEsta es la aritmética incómoda. Cada bucle adicional multiplica las cosas que debes hacer bien. Dos bucles necesitan un contrato: qué posee cada uno, qué datos pasan entre ellos y quién decide cuando discrepan. Necesitan prompts separados, estado separado y gestión de fallos separada. Necesitan registros (logs) que distingan bucles, porque una única traza entrelazada se vuelve ilegible. Y cuestan dinero real: si tu bucle principal promedia 12 iteraciones con 3000 tokens de contexto cada una, son unos 36 000 tokens por tarea; un planificador que se reejecuta cada pocos pasos puede duplicarlo fácilmente. La complejidad no es gratis, y en la ingeniería de harnesses se acumula más rápido de lo que sugiere la intuición.\n\nHay también un coste de equipo que rara vez aparece en los diagramas de arquitectura. Cada bucle es un modelo mental que cada ingeniero del equipo debe sostener: qué posee, cuándo corre, cómo falla. Un bucle significa un modelo mental y un único lugar donde añadir registros, reintentos y guardarraíles. Dos bucles significan razonar sobre entrelazados: ¿vio el planificador la última observación del ejecutor o una copia obsoleta? Tres bucles significan un sistema distribuido con todos los peligros clásicos y ninguna de las herramientas clásicas. Cuando alguien proponga un bucle nuevo, pregunta quién lo depurará a las 2 de la madrugada solo con la traza. Si la respuesta es un silencio incómodo, el bucle no está listo."
      },
      {
        kind: "text",
        heading: "Un bucle hasta que duela",
        body: "La regla es sencilla: mantén un bucle hasta que duela, y define «doler» con números, no con sensaciones. Un presupuesto de complejidad es la cantidad finita de tokens por tarea, latencia de reloj, iteraciones por tarea y modos de fallo que puedes permitirte antes de que el sistema se vuelva indepurable o antieconómico. Cada bucle que añades gasta de ese presupuesto. Gástalo como dinero: con deliberación, sobre un dolor medido y con un retorno esperado.\n\nHay cinco síntomas que indican de forma fiable que el bucle principal está sobrecargado estructuralmente. Primero, explosión de pasos: las tareas necesitan rutinariamente de 25 a 40 iteraciones donde antes bastaban 8, porque el modelo va y viene entre subtareas. Segundo, presión de contexto: la ventana está llena al 60 o 70 por ciento antes de que empiece el trabajo productivo, devorada por los esquemas de herramientas, el historial y un prompt del sistema que hace tres trabajos. Tercero, mezcla de responsabilidades: un único prompt del sistema planifica el enfoque, ejecuta pasos y critica su propia salida a la vez — tres roles, un prompt, y cada rol diluye a los demás. Cuarto, cascadas de errores: una sola llamada a herramienta fallida envenena los diez pasos siguientes porque nada aísla las fases entre sí. Quinto, deriva de latencia: la latencia p99 sube versión tras versión a medida que el bucle acumula responsabilidades.\n\nLa regla de los dos síntomas convierte esto en un procedimiento de decisión. Un síntoma es una mala semana; arregla el bucle que tienes. Dos o más síntomas persistentes, medidos sobre tráfico real en muchas tareas, justifican gastar presupuesto de complejidad en un segundo bucle — y te dicen qué bucle construir. Explosión de pasos más mezcla de responsabilidades apunta a un bucle de planificación. Cascadas de errores más presión de contexto apuntan a delegación con subagentes aislados. La deriva de latencia por sí sola apunta a las herramientas, no al bucle: perfila antes de diseñar arquitectura.\n\nLa medición merece su propia disciplina. No estimes los pasos a ojo con unas pocas demos; instrumenta el harness para registrar telemetría por tarea desde el día uno: iteraciones usadas, tokens consumidos por partes — sistema, herramientas, historial —, tasas de error de herramientas y tiempo de reloj por fase. Agrega por semanas. Los números que importan son distribuciones, no anécdotas: p50 y p95, no la peor demo. Un equipo que mide puede ver cómo se desarrolla un síntoma durante un mes y planificar el trabajo arquitectónico con deliberación; un equipo que no lo hace añadirá el segundo bucle durante un incidente, que es el momento más caro posible para rediseñar. El presupuesto de complejidad solo es real si alguien lleva las cuentas."
      },
      {
        kind: "code",
        heading: "Anatomía de un bucle principal",
        lang: "javascript",
        code: "async function runPrimaryLoop({ model, tools, systemPrompt, maxSteps = 25 }) {\n  const messages = [{ role: \"system\", content: systemPrompt }];\n  const trace = []; // one trace, one loop: easy to read\n\n  for (let step = 0; step < maxSteps; step++) {\n    const decision = await model.chat(messages, { tools });\n    messages.push(decision.message);\n    trace.push({ step, type: \"decision\", at: Date.now() });\n\n    if (decision.finishReason === \"stop\") {\n      return { ok: true, answer: decision.message.content, trace };\n    }\n    if (!decision.toolCalls?.length) {\n      return { ok: false, error: \"model stalled: no tool call, no answer\", trace };\n    }\n    for (const call of decision.toolCalls) {\n      try {\n        const result = await tools[call.name](call.args);\n        messages.push({ role: \"tool\", name: call.name, content: result });\n      } catch (err) {\n        // Errors stay inside the loop's history: the model sees and adapts.\n        messages.push({ role: \"tool\", name: call.name, content: `ERROR: ${err.message}` });\n        trace.push({ step, type: \"tool_error\", tool: call.name });\n      }\n    }\n  }\n  return { ok: false, error: \"maxSteps exceeded\", trace };\n}",
        note: "Todo el producto en 30 líneas: decidir, actuar, observar, repetir — con límite de pasos y una única traza legible."
      },
      {
        kind: "compare",
        heading: "Un bucle frente a dos bucles",
        headers: ["Un bucle", "Dos bucles"],
        rows: [
          ["Carga de contexto", "Un único prompt lo lleva todo y crece con la complejidad de la tarea.", "El prompt de cada bucle se mantiene pequeño; un bucle solo ve lo que posee."],
          ["Modos de fallo", "Un solo lugar que depurar; los errores quedan locales a la traza.", "Los bucles pueden discrepar, bloquearse o duplicar trabajo sin un contrato."],
          ["Latencia", "Secuencial pero predecible; fácil razonar sobre p99.", "Los bucles paralelos pueden ser más rápidos; los seriales añaden idas y vueltas por paso."],
          ["Coste por tarea", "Una llamada al modelo por paso, más la latencia de herramientas.", "Los bucles que interactúan ejecutan 2-3 veces más llamadas por paso al coordinarse."],
          ["Depurabilidad", "Una traza lineal que se lee de arriba abajo.", "Trazas entrelazadas; necesitas logs que distingan bucles e ids de correlación."],
          ["Ingeniería de prompts", "Un prompt del sistema que afinar y versionar.", "Cada bucle necesita su propio prompt, más el contrato entre ellos."]
        ]
      },
      {
        kind: "callout",
        tone: "warn",
        title: "La regla de los dos síntomas",
        body: "No añadas un bucle por un mal día. Exige al menos dos síntomas persistentes — medidos sobre tráfico real, no imaginados — antes de gastar presupuesto de complejidad. Un segundo bucle que no puedas justificar en una frase es un segundo bucle del que te arrepentirás a las 2 de la madrugada. Registra pasos, uso de tokens y tasas de error por tarea, y deja que los números defiendan el caso. La mayoría de las conversaciones de «necesitamos un planificador» terminan en el momento en que alguien pide las mediciones."
      },
      {
        kind: "code",
        heading: "Puntuar la presión del bucle",
        lang: "javascript",
        code: "// Turns raw telemetry into a 0-100 pressure score and a verdict.\n// Run this over a week of real tasks before proposing a second loop.\nfunction loopPressure({ avgSteps, p95Steps, contextFill, errorRate, rolesInPrompt }) {\n  let score = 0;\n  if (avgSteps > 15) score += 20;          // step explosion\n  if (p95Steps > 30) score += 15;\n  if (contextFill > 0.6) score += 20;      // context pressure\n  if (errorRate > 0.15) score += 20;       // error cascades\n  if (rolesInPrompt >= 3) score += 15;     // mixed concerns: plan+act+critique\n  if (avgSteps > 15 && rolesInPrompt >= 3) score += 10; // correlated symptoms\n\n  const verdict =\n    score >= 60 ? \"ADD_LOOP: two or more structural symptoms persist\" :\n    score >= 35 ? \"WATCH: one symptom present, fix the loop you have\" :\n                  \"HEALTHY: one loop is enough\";\n  return { score: Math.min(score, 100), verdict };\n}\n\n// Example: a healthy support agent\nconsole.log(loopPressure({ avgSteps: 8, p95Steps: 14, contextFill: 0.3, errorRate: 0.05, rolesInPrompt: 1 }));\n// { score: 0, verdict: 'HEALTHY: one loop is enough' }",
        note: "Una heurística inicial, no una ley: calibra los umbrales con tu propio tráfico."
      }
    ],
    takeaways: [
      "El bucle principal — observar, decidir, actuar, repetir — es la arquitectura por defecto; la mayoría de los agentes deberían lanzarse con exactamente uno.",
      "Cada bucle adicional gasta presupuesto de complejidad: tokens, latencia, modos de fallo y superficie de depuración se acumulan.",
      "«Un bucle hasta que duela» significa medir el dolor — pasos, llenado de contexto, cascadas de errores, latencia — sobre tráfico real.",
      "Gasta un segundo bucle solo cuando al menos dos síntomas persistentes apunten al mismo problema estructural."
    ],
    quiz: [
      {
        q: "Tu agente completa la mayoría de las tareas en 6-10 iteraciones con un 30% de contexto ocupado. Un compañero propone añadir un bucle planificador «por robustez». ¿Qué dice la regla de «un bucle hasta que duela»?",
        options: ["Añadirlo pero mantenerlo desactivado por defecto", "Añadirlo: más bucles siempre aumentan la robustez", "Añadirlo solo cuando las tareas empiecen a fallar", "Mantener un bucle; no hay ningún dolor medido que corregir"],
        answer: 3,
        why: "La regla exige un dolor medido antes de gastar presupuesto de complejidad. 6-10 pasos y un 30% de contexto muestran un bucle sano; un planificador añadiría coste y modos de fallo sin retorno demostrado."
      },
      {
        q: "¿Cuál de los siguientes es un síntoma genuino de que un segundo bucle podría estar justificado?",
        options: ["Las llamadas a herramientas responden en menos de 200 milisegundos", "El prompt del sistema tiene 400 tokens", "Las tareas necesitan rutinariamente más de 30 iteraciones y la ventana está al 70% antes de empezar el trabajo productivo", "El modelo ocasionalmente pide una aclaración al usuario"],
        answer: 2,
        why: "La explosión de pasos más la presión de contexto son dos de los cinco síntomas estructurales. Las demás opciones describen comportamientos sanos o irrelevantes."
      },
      {
        q: "Añadir un bucle crítico a un agente de un solo bucle que funciona…",
        options: ["Elimina las alucinaciones por completo", "Garantiza que el bucle converja", "Aumenta el coste por tarea pudiendo mejorar la calidad: un compromiso que hay que medir", "Siempre reduce el coste total en tokens"],
        answer: 2,
        why: "Un bucle crítico añade llamadas al modelo por paso, así que el coste sube. Si la calidad mejora lo suficiente para justificarlo debe medirse, no asumirse."
      },
      {
        q: "¿Qué es un «presupuesto de complejidad» en el diseño de harnesses?",
        options: ["El número máximo de líneas permitido en el código del harness", "La cantidad finita de tokens, latencia, iteraciones y modos de fallo que puedes gastar antes de que el sistema se vuelva indepurable o antieconómico", "El presupuesto en dólares para las claves de la API", "El número de herramientas que el modelo puede llamar"],
        answer: 1,
        why: "El presupuesto de complejidad plantea cada añadido arquitectónico como un gasto de una cantidad finita de tokens, latencia, iteraciones y depurabilidad."
      },
      {
        q: "Dos bucles que deben ponerse de acuerdo antes de actuar pueden…",
        options: ["Reducir la latencia a la mitad en todos los casos", "Compartir automáticamente una ventana de contexto", "No fallar nunca si ambos usan el mismo modelo", "Bloquearse o duplicar trabajo si su contrato está poco especificado"],
        answer: 3,
        why: "Sin un contrato preciso — quién posee qué, quién desempata — los bucles que interactúan desarrollan modos de fallo emergentes como bloqueos y trabajo duplicado."
      },
      {
        q: "La «regla de los dos síntomas» establece que debes…",
        options: ["Contar los síntomas solo si aparecen dos veces en un día", "Exigir al menos dos síntomas persistentes y medidos antes de añadir un bucle", "Añadir siempre exactamente dos bucles, ni más", "Tratar dos bucles como el máximo que puede tener un harness"],
        answer: 1,
        why: "Un síntoma es una mala semana: arregla el bucle existente. Dos o más síntomas persistentes medidos sobre tráfico real justifican gastar presupuesto en un segundo bucle."
      },
      {
        q: "¿Por qué las «cascadas de errores» son un síntoma estructural y no un simple bug?",
        options: ["Porque una llamada fallida que envenena muchos pasos posteriores muestra que el bucle carece de aislamiento entre fases", "Porque todos los errores en agentes son estructurales por definición", "Porque las cascadas no pueden ocurrir dentro de un único bucle", "Porque significa que la temperatura del modelo es demasiado alta"],
        answer: 0,
        why: "Un único fallo que corrompe los pasos siguientes revela una falta estructural de aislamiento entre fases, justo el tipo de problema que un bucle separado (p. ej., subtareas delegadas) está diseñado para resolver."
      },
      {
        q: "Un agente de soporte resuelve tickets en 8 pasos con un 25% de contexto ocupado, pero la latencia p99 es de 45 segundos porque una herramienta de búsqueda en la documentación es lenta. La corrección adecuada es…",
        options: ["Corregir o paralelizar la herramienta lenta: el bucle en sí no muestra síntomas estructurales", "Añadir un bucle crítico que revise la latencia", "Elevar el límite de iteraciones a 50", "Añadir un bucle de planificación para reducir pasos"],
        answer: 0,
        why: "La deriva de latencia por una única herramienta lenta es un problema de herramientas, no de arquitectura del bucle. Las métricas del bucle son sanas, así que perfila y corrige la herramienta antes de diseñar arquitectura."
      }
    ]
  }
};
