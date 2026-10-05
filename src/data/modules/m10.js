export default {
  id: "m10",
  level: 3,
  n: 2,
  icon: "Map",
  sim: null,
  en: {
    title: "The Planning Loop",
    tagline: "Separate thinking about the work from doing the work — and replan only when the world disagrees.",
    objectives: [
      "Implement the plan-and-execute pattern: plan once, execute stepwise, replan on deviation.",
      "Decide when the planner deserves a separate model call, model, or temperature.",
      "Keep plans as versioned data in memory so replanning is a patch, not a restart."
    ],
    sections: [
      {
        kind: "text",
        heading: "Plan, Then Act",
        body: "The most common second loop in production agents is the planning loop. Instead of asking one prompt to both decide the strategy and execute each step, you split the job: a planner produces a plan, an executor works through it step by step, and an observer compares progress against the plan. When reality deviates — a tool returns something unexpected, a step becomes impossible — the loop replans rather than improvising blindly. The cycle is plan, act, observe, replan, and it repeats until the goal is reached or the replan budget is exhausted.\n\nWhy does this help? Because planning and acting pull the model's attention in opposite directions. Planning wants the big picture: the goal, the constraints, the order of operations. Acting wants the immediate next step: which tool, which arguments, how to interpret this one result. When a single prompt does both, long-horizon coherence degrades — the model optimizes for the next step and quietly drops the strategy. A dedicated planning pass produces an explicit artifact, the plan, that the executor can be held accountable to. Drift becomes visible: step 4 was supposed to query the billing API, but the executor searched the docs instead.\n\nThe cost is real, so budget it. A planning call typically consumes 1,000 to 3,000 tokens and adds one full round trip of latency before any work starts. Replanning on every step would be absurd; replanning on meaningful deviation is the point. A good rule of thumb: plan once per task, replan at most 2 to 3 times per task, and treat each replan as an event worth logging with its trigger. If you find yourself replanning constantly, the plan granularity is wrong — the steps are too brittle — or the task was never plannable in the first place.\n\nThere is a subtle failure worth naming early: the plan that is too precise. A 40-step plan with exact tool arguments looks rigorous, but the first unexpected tool output invalidates steps 12 through 40 and forces a full replan — the planning equivalent of the error cascades from m09. Good plans are hierarchical: 5 to 8 coarse steps, each expandable at execution time. Coarse steps survive contact with reality; fine-grained scripts do not. When you review a plan, ask which steps could survive their predecessor returning something unexpected. If the answer is 'none', the plan is a script wearing a costume, and you have paid planning cost for execution fragility."
      },
      {
        kind: "code",
        heading: "Plan-and-Execute Skeleton",
        lang: "javascript",
        code: "async function planAndExecute({ planner, executor, goal, maxReplans = 3 }) {\n  let plan = await planner.makePlan(goal); // one planning call up front\n  let replans = 0;\n\n  while (replans <= maxReplans) {\n    const outcome = await executor.run(plan); // stepwise tool loop\n    if (outcome.status === \"done\") return { ok: true, result: outcome.result, replans };\n\n    // Deviation: the world disagreed with the plan.\n    const diagnosis = await planner.diagnose(plan, outcome.observation);\n    if (!diagnosis.recoverable || replans === maxReplans) {\n      return { ok: false, error: diagnosis.reason, replans };\n    }\n    plan = await planner.patchPlan(plan, diagnosis); // patch, don't restart\n    replans++;\n  }\n}",
        note: "The executor owns the steps; the planner owns the strategy. Replanning patches the plan instead of starting over."
      },
      {
        kind: "text",
        heading: "When the Planner Is a Separate Call",
        body: "Not every task needs a separate planning call. Inline planning — 'first write a brief plan, then execute it' inside one system prompt — is often enough for tasks under 10 steps, and it costs nothing extra. Promote the planner to its own model call when three conditions hold: the task reliably exceeds 10 to 15 steps, the strategy genuinely benefits from a different cognitive posture than execution, and you can point to failures caused by plan drift rather than bad tools.\n\nA separate planning call buys you three levers you cannot get inline. First, a different model: planning is a reasoning-heavy, low-volume job, so a larger or slower model for the plan plus a smaller, cheaper model for execution is a common cost-optimal split — the plan might cost 2,000 tokens once while 20 execution steps run on the cheap model. Second, different sampling: planners usually run at low temperature (0.0 to 0.3) for determinism, while executors may run slightly higher to handle messy tool outputs. Third, a plan-only system prompt: short, focused, and free of tool schemas, which keeps the planning context small and the strategy sharp.\n\nWhere the plan lives matters as much as how it is made. Keep plans in memory as structured data — an array of steps with ids, descriptions, status fields, and dependencies — not as prose buried in chat history. Version them: plan v1, v2, v3, each with the observation that triggered the change. This turns replanning into a diff operation the *harness* (arnés) can reason about, and it gives you an audit trail: when a task fails, you can see exactly which plan version was active and why it changed. A plan you cannot diff is a plan you cannot debug.\n\nOne more consideration: the planner's output is a promise the executor must be able to keep. A plan that assumes tools or data the executor does not have is worse than no plan — it sends the loop confidently in an impossible direction. Validate plans mechanically before execution: every step references a known tool or a previous step's output, dependencies form no cycles, and the final step actually answers the goal. This validation is cheap — a pure function over structured data, no model call — and it catches an entire class of failures where the planner hallucinates capabilities. The contract from m09 applies here too: the plan is the interface between two loops, and interfaces deserve validation."
      },
      {
        kind: "callout",
        tone: "key",
        title: "The Plan Is Data, Not Prose",
        body: "Represent plans as structured objects — steps with ids, statuses (pending, active, done, blocked), and dependencies — never as a paragraph the executor must re-interpret. Structured plans can be validated (no dangling dependencies), diffed (what changed in v2?), rendered in a UI, and patched surgically. Prose plans invite the executor to hallucinate structure that was never there. Plans also need an audience beyond the executor: render them in your UI or logs. A plan the human operator cannot read is a plan nobody will trust when the task goes sideways."
      },
      {
        kind: "code",
        heading: "Replan as a Patch",
        lang: "javascript",
        code: "// Plans are data: [{ id, title, status, dependsOn }]. Replanning patches\n// the array instead of regenerating it, preserving completed work.\nfunction patchPlan(plan, diagnosis) {\n  const next = structuredClone(plan);\n  for (const change of diagnosis.changes) {\n    const step = next.find((s) => s.id === change.id);\n    if (!step) throw new Error(`replan references unknown step ${change.id}`);\n    if (change.op === \"replace\") step.title = change.title;\n    if (change.op === \"insertAfter\") {\n      const i = next.indexOf(step);\n      next.splice(i + 1, 0, { id: crypto.randomUUID(), title: change.title, status: \"pending\", dependsOn: [step.id] });\n    }\n    if (change.op === \"block\") step.status = \"blocked\";\n  }\n  // Guard: never resurrect completed steps, never drop the goal step.\n  const done = new Set(plan.filter((s) => s.status === \"done\").map((s) => s.id));\n  for (const s of next) if (done.has(s.id)) s.status = \"done\";\n  return next;\n}\n\nfunction planIsStalled(plan) {\n  return plan.every((s) => s.status === \"blocked\" || s.status === \"done\");\n}",
        note: "Surgical patches keep completed steps intact; guards prevent the planner from rewriting history."
      },
      {
        kind: "checklist",
        heading: "Planning-Loop Hygiene",
        items: [
          "Plan once per task; cap replans at 2-3 and log every replan with its trigger observation.",
          "Store plans as versioned structured data with step ids, statuses, and dependencies.",
          "Use a low temperature (0.0-0.3) and a plan-only prompt for the planner; keep tool schemas out of it.",
          "Define replan triggers explicitly: blocked step, unexpected tool output, or executor deviation — not 'every N steps'.",
          "Never let replanning resurrect completed steps or silently drop the goal step.",
          "Measure: planning tokens per task, replans per task, and plan-drift failures before and after adding the loop.",
          "Keep plans coarse (5-8 steps): fine-grained scripts shatter on first contact with unexpected tool output.",
          "Validate every plan mechanically — known tools, no dependency cycles, final step answers the goal — before execution."
        ]
      }
    ],
    takeaways: [
      "The planning loop splits strategy from execution: plan once, execute stepwise, replan only on meaningful deviation.",
      "A separate planning call buys a different model, different sampling, and a focused prompt — promote to it only with measured plan-drift failures.",
      "Plans belong in memory as versioned structured data so replanning is a patch and failures leave an audit trail.",
      "Cap replans at 2-3 per task; constant replanning signals wrong plan granularity, not a need for more planning."
    ],
    quiz: [
      {
        q: "In the plan-and-execute pattern, when should the loop replan?",
        options: ["After every single execution step, to stay maximally adaptive", "On a fixed schedule of every 5 steps", "Only when an observation shows meaningful deviation: a blocked step, unexpected output, or executor drift", "Never — replanning indicates the planner failed"],
        answer: 2,
        why: "Replanning is expensive and each replan is a structural event. Triggering only on meaningful deviation keeps the loop stable and the audit trail honest."
      },
      {
        q: "Which task is the best candidate for promoting the planner to a separate model call?",
        options: ["A 20-step research task where failures come from the model losing the overall strategy mid-task", "A 4-step task that copies a file and restarts a service", "A task where the tools are slow but the strategy is trivial", "A single-turn question-answering task"],
        answer: 0,
        why: "Long tasks with plan-drift failures are exactly what a separate planning call fixes. Short or tool-bound tasks gain nothing from the extra call and latency."
      },
      {
        q: "Why might you use a larger model for planning and a smaller one for execution?",
        options: ["Larger models cannot call tools, so they must plan", "Planning is reasoning-heavy but low-volume: one 2,000-token plan can steer twenty cheap execution steps", "Small models are incapable of following plans", "It doubles the context window automatically"],
        answer: 1,
        why: "The cost-optimal split concentrates expensive reasoning where leverage is highest — the plan — while high-volume execution runs cheap. The other options are false."
      },
      {
        q: "What does 'the plan is data, not prose' mean in practice?",
        options: ["Plans must be written in binary format", "Plans should be structured objects with ids, statuses, and dependencies so they can be validated, diffed, and patched", "The planner should never use natural language", "Plans should be stored in a SQL database"],
        answer: 1,
        why: "Structured plans enable validation, diffing, surgical patching, and UI rendering — none of which prose plans support reliably."
      },
      {
        q: "A task replans 8 times and still fails. The most likely diagnosis is…",
        options: ["The replan cap is too low and should be raised to 20", "Wrong plan granularity or a task that was never plannable — not a need for more replanning", "The executor's temperature is too low", "The plan needs more steps added blindly"],
        answer: 1,
        why: "Constant replanning is a signal, not a fix: the steps are too brittle or the environment too chaotic for planning to help. Raising the cap just burns tokens."
      },
      {
        q: "Which sampling setup is conventional for a planner/executor split?",
        options: ["Planner at low temperature (0.0-0.3) for determinism; executor slightly higher to handle messy tool outputs", "Both at maximum temperature for creativity", "Planner at high temperature; executor at zero", "Temperature is irrelevant once you have two loops"],
        answer: 0,
        why: "Planning benefits from determinism — the same goal should yield the same strategy — while execution needs flexibility to cope with unpredictable tool results."
      },
      {
        q: "Why keep tool schemas out of the planner's prompt?",
        options: ["Tool schemas are secret and must never be shown to any model", "To keep the planning context small and the strategy sharp; the executor owns tool details", "Planners are legally forbidden from calling tools", "Schemas make the planner slower at arithmetic"],
        answer: 3,
        why: "Separation of concerns: the planner reasons about strategy, the executor about tool mechanics. Mixing them reintroduces the mixed-concerns symptom the second loop was meant to fix."
      },
      {
        q: "Your audit trail shows plan v3 active at failure time, with v2→v3 triggered by 'billing API returned 403'. This is useful because…",
        options: ["It proves the planner is never at fault", "It lets you see exactly which strategy was active and what observation forced the change — making the failure debuggable", "It satisfies a legal requirement in all jurisdictions", "It automatically fixes the 403 error"],
        answer: 1,
        why: "Versioned plans with trigger observations turn 'the agent failed' into a debuggable story: which plan, which change, which evidence."
      }
    ]
  },
  es: {
    title: "El bucle de planificación",
    tagline: "Separa pensar sobre el trabajo de hacer el trabajo — y replanifica solo cuando el mundo discrepa.",
    objectives: [
      "Implementar el patrón planificar-y-ejecutar: planificar una vez, ejecutar por pasos, replanificar ante desviaciones.",
      "Decidir cuándo el planificador merece una llamada al modelo separada, otro modelo u otra temperatura.",
      "Mantener los planes como datos versionados en memoria para que replanificar sea un parche, no un reinicio."
    ],
    sections: [
      {
        kind: "text",
        heading: "Planifica, luego actúa",
        body: "El segundo bucle más común en agentes de producción es el bucle de planificación. En lugar de pedir a un único prompt que decida la estrategia y ejecute cada paso, divides el trabajo: un planificador produce un plan, un ejecutor lo recorre paso a paso y un observador compara el progreso con el plan. Cuando la realidad se desvía — una herramienta devuelve algo inesperado, un paso se vuelve imposible — el bucle replanifica en lugar de improvisar a ciegas. El ciclo es planificar, actuar, observar, replanificar, y se repite hasta alcanzar el objetivo o agotar el presupuesto de replanificaciones.\n\n¿Por qué ayuda? Porque planificar y actuar tiran de la atención del modelo en direcciones opuestas. Planificar quiere la visión global: el objetivo, las restricciones, el orden de las operaciones. Actuar quiere el siguiente paso inmediato: qué herramienta, qué argumentos, cómo interpretar este resultado concreto. Cuando un único prompt hace ambas cosas, la coherencia de largo alcance se degrada: el modelo optimiza el siguiente paso y abandona silenciosamente la estrategia. Una pasada de planificación dedicada produce un artefacto explícito, el plan, al que se puede exigir cuentas al ejecutor. La deriva se vuelve visible: el paso 4 debía consultar la API de facturación, pero el ejecutor buscó en la documentación.\n\nEl coste es real, así que presupuéstalo. Una llamada de planificación consume típicamente de 1000 a 3000 tokens y añade una ida y vuelta completa de latencia antes de que empiece ningún trabajo. Replanificar en cada paso sería absurdo; replanificar ante una desviación significativa es la clave. Una buena regla práctica: planifica una vez por tarea, replanifica como máximo 2 o 3 veces por tarea, y trata cada replanificación como un evento que merece registro con su disparador. Si te ves replanificando constantemente, la granularidad del plan es incorrecta — los pasos son demasiado frágiles — o la tarea nunca fue planificable.\n\nHay un fallo sutil que conviene nombrar pronto: el plan demasiado preciso. Un plan de 40 pasos con argumentos exactos parece riguroso, pero la primera salida inesperada invalida los pasos 12 a 40 y fuerza una replanificación total: el equivalente en planificación de las cascadas de errores del m09. Los buenos planes son jerárquicos: de 5 a 8 pasos gruesos, cada uno expandible en ejecución. Los pasos gruesos sobreviven al contacto con la realidad; los guiones milimétricos no. Si ningún paso sobreviviría a que su predecesor devuelva algo inesperado, el plan es un guion disfrazado, y has pagado coste de planificación por fragilidad de ejecución."
      },
      {
        kind: "code",
        heading: "Esqueleto de planificar-y-ejecutar",
        lang: "javascript",
        code: "async function planAndExecute({ planner, executor, goal, maxReplans = 3 }) {\n  let plan = await planner.makePlan(goal); // one planning call up front\n  let replans = 0;\n\n  while (replans <= maxReplans) {\n    const outcome = await executor.run(plan); // stepwise tool loop\n    if (outcome.status === \"done\") return { ok: true, result: outcome.result, replans };\n\n    // Deviation: the world disagreed with the plan.\n    const diagnosis = await planner.diagnose(plan, outcome.observation);\n    if (!diagnosis.recoverable || replans === maxReplans) {\n      return { ok: false, error: diagnosis.reason, replans };\n    }\n    plan = await planner.patchPlan(plan, diagnosis); // patch, don't restart\n    replans++;\n  }\n}",
        note: "El ejecutor posee los pasos; el planificador posee la estrategia. Replanificar parchea el plan en lugar de empezar de cero."
      },
      {
        kind: "text",
        heading: "Cuando el planificador es una llamada separada",
        body: "No toda tarea necesita una llamada de planificación separada. La planificación en línea — «primero escribe un breve plan, luego ejecútalo» dentro de un único prompt del sistema — suele bastar para tareas de menos de 10 pasos, y no cuesta nada extra. Promueve el planificador a su propia llamada al modelo cuando se cumplen tres condiciones: la tarea supera fiablemente los 10 a 15 pasos, la estrategia se beneficia de verdad de una postura cognitiva distinta a la ejecución, y puedes señalar fallos causados por deriva del plan y no por herramientas defectuosas.\n\nUna llamada de planificación separada te da tres palancas que no existen en línea. Primera, un modelo distinto: planificar es un trabajo de razonamiento intenso y bajo volumen, así que un modelo mayor o más lento para el plan más un modelo menor y barato para la ejecución es una división habitualmente óptima en coste — el plan puede costar 2000 tokens una vez mientras 20 pasos de ejecución corren en el modelo barato. Segunda, un muestreo distinto: los planificadores suelen correr a baja temperatura (0,0 a 0,3) por determinismo, mientras los ejecutores pueden ir algo más altos para manejar salidas de herramientas desordenadas. Tercera, un prompt dedicado al plan: corto, enfocado y libre de esquemas de herramientas, lo que mantiene pequeño el contexto de planificación y afilada la estrategia.\n\nDónde vive el plan importa tanto como cómo se crea. Mantén los planes en memoria como datos estructurados — un array de pasos con ids, descripciones, campos de estado y dependencias — no como prosa enterrada en el historial del chat. Versionarlos: plan v1, v2, v3, cada uno con la observación que disparó el cambio. Esto convierte la replanificación en una operación de diff sobre la que el *harness* (arnés) puede razonar, y te da una pista de auditoría: cuando una tarea falla, puedes ver exactamente qué versión del plan estaba activa y por qué cambió. Un plan sobre el que no puedes hacer diff es un plan que no puedes depurar.\n\nUna consideración más: la salida del planificador es una promesa que el ejecutor debe poder cumplir. Un plan que asume herramientas o datos que el ejecutor no tiene es peor que ningún plan: envía al bucle con confianza en una dirección imposible. Valida los planes mecánicamente antes de ejecutar: cada paso referencia una herramienta conocida o la salida de un paso previo, las dependencias no forman ciclos y el paso final responde al objetivo. Esta validación es barata — una función pura sobre datos estructurados, sin llamada al modelo — y detecta toda una clase de fallos donde el planificador alucina capacidades."
      },
      {
        kind: "callout",
        tone: "key",
        title: "El plan es dato, no prosa",
        body: "Representa los planes como objetos estructurados — pasos con ids, estados (pending, active, done, blocked) y dependencias — nunca como un párrafo que el ejecutor deba reinterpretar. Los planes estructurados se pueden validar (sin dependencias colgadas), comparar (¿qué cambió en la v2?), mostrar en una interfaz y parchear con cirugía. Los planes en prosa invitan al ejecutor a alucinar una estructura que nunca existió. Los planes también necesitan audiencia más allá del ejecutor: muéstralos en tu interfaz o registros. Un plan que el operador humano no puede leer es un plan en el que nadie confiará cuando la tarea se tuerza."
      },
      {
        kind: "code",
        heading: "Replanificar como parche",
        lang: "javascript",
        code: "// Plans are data: [{ id, title, status, dependsOn }]. Replanning patches\n// the array instead of regenerating it, preserving completed work.\nfunction patchPlan(plan, diagnosis) {\n  const next = structuredClone(plan);\n  for (const change of diagnosis.changes) {\n    const step = next.find((s) => s.id === change.id);\n    if (!step) throw new Error(`replan references unknown step ${change.id}`);\n    if (change.op === \"replace\") step.title = change.title;\n    if (change.op === \"insertAfter\") {\n      const i = next.indexOf(step);\n      next.splice(i + 1, 0, { id: crypto.randomUUID(), title: change.title, status: \"pending\", dependsOn: [step.id] });\n    }\n    if (change.op === \"block\") step.status = \"blocked\";\n  }\n  // Guard: never resurrect completed steps, never drop the goal step.\n  const done = new Set(plan.filter((s) => s.status === \"done\").map((s) => s.id));\n  for (const s of next) if (done.has(s.id)) s.status = \"done\";\n  return next;\n}\n\nfunction planIsStalled(plan) {\n  return plan.every((s) => s.status === \"blocked\" || s.status === \"done\");\n}",
        note: "Los parches quirúrgicos mantienen intactos los pasos completados; las guardas impiden que el planificador reescriba la historia."
      },
      {
        kind: "checklist",
        heading: "Higiene del bucle de planificación",
        items: [
          "Planifica una vez por tarea; limita las replanificaciones a 2-3 y registra cada una con su observación disparadora.",
          "Almacena los planes como datos estructurados versionados con ids de paso, estados y dependencias.",
          "Usa baja temperatura (0,0-0,3) y un prompt dedicado al plan para el planificador; mantén fuera los esquemas de herramientas.",
          "Define los disparadores de replanificación explícitamente: paso bloqueado, salida inesperada o desviación del ejecutor — no «cada N pasos».",
          "No permitas que la replanificación resucite pasos completados ni elimine silenciosamente el paso del objetivo.",
          "Mide: tokens de planificación por tarea, replanificaciones por tarea y fallos por deriva del plan antes y después de añadir el bucle.",
          "Mantén los planes gruesos (5-8 pasos): los guiones milimétricos se rompen al primer contacto con una salida inesperada."
        ]
      }
    ],
    takeaways: [
      "El bucle de planificación separa estrategia de ejecución: planifica una vez, ejecuta por pasos, replanifica solo ante desviaciones significativas.",
      "Una llamada de planificación separada aporta otro modelo, otro muestreo y un prompt enfocado — promuévela solo con fallos medidos por deriva del plan.",
      "Los planes pertenecen a la memoria como datos estructurados versionados, para que replanificar sea un parche y los fallos dejen pista de auditoría.",
      "Limita las replanificaciones a 2-3 por tarea; replanificar constantemente indica una granularidad errónea, no necesidad de más planificación."
    ],
    quiz: [
      {
        q: "En el patrón planificar-y-ejecutar, ¿cuándo debe replanificar el bucle?",
        options: ["Tras cada paso de ejecución, para máxima adaptabilidad", "Con un calendario fijo cada 5 pasos", "Solo cuando una observación muestre una desviación significativa: paso bloqueado, salida inesperada o deriva del ejecutor", "Nunca: replanificar indica que el planificador falló"],
        answer: 2,
        why: "Replanificar es caro y cada replanificación es un evento estructural. Dispararla solo ante desviaciones significativas mantiene el bucle estable y honesta la pista de auditoría."
      },
      {
        q: "¿Qué tarea es la mejor candidata para promover el planificador a una llamada al modelo separada?",
        options: ["Una tarea de investigación de 20 pasos donde los fallos vienen de que el modelo pierde la estrategia global a mitad de tarea", "Una tarea de 4 pasos que copia un fichero y reinicia un servicio", "Una tarea donde las herramientas son lentas pero la estrategia es trivial", "Una tarea de pregunta-respuesta de un solo turno"],
        answer: 0,
        why: "Las tareas largas con fallos por deriva del plan son exactamente lo que corrige una llamada de planificación separada. Las tareas cortas o limitadas por herramientas no ganan nada con la llamada y la latencia extra."
      },
      {
        q: "¿Por qué usar un modelo mayor para planificar y uno menor para ejecutar?",
        options: ["Los modelos grandes no pueden llamar a herramientas, así que deben planificar", "Los modelos pequeños son incapaces de seguir planes", "Planificar es intenso en razonamiento pero de bajo volumen: un plan de 2000 tokens puede dirigir veinte pasos baratos de ejecución", "Duplica automáticamente la ventana de contexto"],
        answer: 2,
        why: "La división óptima en coste concentra el razonamiento caro donde más apalancamiento tiene — el plan — mientras la ejecución de alto volumen corre barata. Las demás opciones son falsas."
      },
      {
        q: "¿Qué significa en la práctica «el plan es dato, no prosa»?",
        options: ["Los planes deben escribirse en formato binario", "Los planes deben ser objetos estructurados con ids, estados y dependencias para poder validarlos, compararlos y parchearlos", "El planificador no debe usar nunca lenguaje natural", "Los planes deben guardarse en una base de datos SQL"],
        answer: 1,
        why: "Los planes estructurados permiten validación, diff, parcheo quirúrgico y visualización en interfaz — nada de lo cual soportan de forma fiable los planes en prosa."
      },
      {
        q: "Una tarea replanifica 8 veces y aun así falla. El diagnóstico más probable es…",
        options: ["El límite de replanificaciones es demasiado bajo y debería subirse a 20", "La temperatura del ejecutor es demasiado baja", "Granularidad errónea del plan o una tarea que nunca fue planificable — no necesidad de más replanificación", "Hay que añadir más pasos al plan a ciegas"],
        answer: 2,
        why: "Replanificar constantemente es una señal, no una solución: los pasos son demasiado frágiles o el entorno demasiado caótico para que planificar ayude. Subir el límite solo quema tokens."
      },
      {
        q: "¿Qué configuración de muestreo es convencional en una división planificador/ejecutor?",
        options: ["Planificador a baja temperatura (0,0-0,3) por determinismo; ejecutor algo más alta para manejar salidas desordenadas", "Ambos a temperatura máxima por creatividad", "Planificador a temperatura alta; ejecutor a cero", "La temperatura es irrelevante cuando hay dos bucles"],
        answer: 0,
        why: "La planificación se beneficia del determinismo — el mismo objetivo debería dar la misma estrategia — mientras la ejecución necesita flexibilidad para lidiar con resultados impredecibles de las herramientas."
      },
      {
        q: "¿Por qué mantener los esquemas de herramientas fuera del prompt del planificador?",
        options: ["Los esquemas de herramientas son secretos y ningún modelo debe verlos", "Los planificadores tienen prohibido por ley llamar a herramientas", "Los esquemas hacen al planificador más lento en aritmética", "Para mantener pequeño el contexto de planificación y afilada la estrategia; el ejecutor posee los detalles de herramientas"],
        answer: 3,
        why: "Separación de responsabilidades: el planificador razona sobre estrategia, el ejecutor sobre mecánica de herramientas. Mezclarlos reintroduce el síntoma de mezcla de responsabilidades que el segundo bucle debía corregir."
      },
      {
        q: "Tu pista de auditoría muestra el plan v3 activo en el momento del fallo, con la transición v2→v3 disparada por «la API de facturación devolvió 403». Esto es útil porque…",
        options: ["Demuestra que el planificador nunca tiene la culpa", "Permite ver exactamente qué estrategia estaba activa y qué observación forzó el cambio — haciendo el fallo depurable", "Cumple un requisito legal en todas las jurisdicciones", "Corrige automáticamente el error 403"],
        answer: 1,
        why: "Los planes versionados con observaciones disparadoras convierten «el agente falló» en una historia depurable: qué plan, qué cambio, qué evidencia."
      }
    ]
  }
};
