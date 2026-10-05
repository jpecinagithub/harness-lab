export default {
  id: "m11",
  level: 3,
  n: 3,
  icon: "SearchCheck",
  sim: null,
  en: {
    title: "Reflection & Self-Critique",
    tagline: "Errors are information: build loops that verify, critique, and repair — then make sure they can stop.",
    objectives: [
      "Build verify loops where a critic checks the generator's output against an explicit rubric.",
      "Implement self-repairing code flows: run, capture the error, feed it back, retry with a cap.",
      "Detect non-convergence — stuck loops, oscillating fixes, degrading quality — and escalate instead of looping forever."
    ],
    sections: [
      {
        kind: "text",
        heading: "The Generator-Critic Split",
        body: "A single model call that both produces an answer and judges its own answer is doing two jobs with one brain, and it shows: the model grades its own homework generously. The reflection pattern splits the roles. A generator produces a candidate — code, a draft, a plan — and a critic evaluates it against an explicit rubric, in a separate call, ideally with a prompt that never saw the generator's reasoning. The critic's verdict feeds back into the next generation attempt. This is the verify loop: generate, critique, repair, repeat until the rubric passes or the budget runs out.\n\nWhy does this work when 'try harder' does not? Because errors are information the first attempt did not have. A compiler error, a failing test, a rubric score of 4 out of 10 with the note 'missing null check on line 12' — each is a concrete, checkable fact. The repair attempt is not a vague second guess; it is a targeted response to evidence. This is why self-repairing code is the canonical example: run the code, capture stderr, hand the exact error back to the model, and watch the fix rate climb. On well-scoped repair tasks, one or two verify iterations routinely fix what zero-shot generation misses.\n\nBut the critic is only as good as its rubric and its independence. A critic prompt that says 'is this good?' will say yes. A critic prompt with a checklist — 'does it handle empty input? does it close the file handle? does it match the required output schema?' — finds real defects. And a critic that shares the generator's full reasoning chain inherits its blind spots; give the critic the artifact plus the requirements, not the generator's internal monologue. Independence is what makes the second opinion worth its tokens.\n\nA practical note on cost: reflection is one of the most expensive patterns per unit of quality gained, because every verify iteration is a full model call over a growing context. Budget it where mistakes are expensive — code that ships, plans that commit resources, answers that carry the company's name — and skip it where they are cheap. A draft that a human will review anyway rarely needs a critic loop; a migration script that runs unattended at 3 a.m. always does. The question is never 'does reflection help?' — it almost always helps a little — but 'is this the highest-value place to spend those tokens?' Teams that apply verify loops uniformly end up with slow, expensive agents; teams that apply them at the failure boundaries end up with agents that are both fast and trustworthy."
      },
      {
        kind: "code",
        heading: "Self-Repairing Code: Run, Error, Fix",
        lang: "javascript",
        code: "async function selfRepair({ model, task, runCode, maxAttempts = 4 }) {\n  let code = await model.generate(task.prompt); // attempt 1: zero-shot\n  const history = [];\n\n  for (let attempt = 1; attempt <= maxAttempts; attempt++) {\n    const result = await runCode(code); // sandboxed execution\n    history.push({ attempt, ok: result.ok, stderr: result.stderr?.slice(0, 2000) });\n    if (result.ok) return { ok: true, code, attempts: attempt, history };\n\n    // The error IS the prompt for the next attempt: concrete, checkable.\n    code = await model.generate(\n      `Previous attempt failed. Fix ONLY the reported error; do not refactor.\\n` +\n      `Error:\\n${result.stderr}\\n\\nCode:\\n${code}`\n    );\n  }\n  return { ok: false, code, attempts: maxAttempts, history };\n}",
        note: "The repair prompt is deliberately narrow: fix the reported error, nothing else. Breadth is where repair loops wander."
      },
      {
        kind: "text",
        heading: "The Critic Pattern — and Its Limits",
        body: "The critic pattern generalizes beyond code. For a draft email, the critic scores tone, completeness, and factual claims against source material. For a plan, the critic checks that every step has an owner and no dependency dangles. The shape is always the same: artifact in, rubric-scored verdict out, with specific defects listed, not vibes. A useful critic returns a machine-readable verdict — a score plus a list of {location, issue, severity} — so the *harness* (arnés) can decide mechanically whether to accept, repair, or escalate.\n\nNow the hard part: loops that never converge. Reflection feels safe because each iteration looks like progress, but three failure modes hide inside. First, the stuck loop: the same error appears on attempt 2, 3, and 4 — the model is rewriting the same broken line with different variable names. Second, oscillation: attempt 3 fixes the null check but breaks the schema; attempt 4 restores the schema but drops the null check. The artifact ping-pongs between two defects. Third, quality decay: each repair makes the code longer and more convoluted while the rubric score flatlines — the model is thrashing.\n\nConvergence needs machinery, not hope. Cap attempts — 3 to 5 is the productive range for most repair tasks; beyond that, returns collapse. Detect stuckness: if the normalized error signature matches a previous attempt, stop immediately. Track the rubric score across attempts and stop when it fails to improve twice in a row. And always define the escalation: when the loop gives up, the artifact, the full history, and the final critic verdict go to a human or to a different strategy — never into a silent retry. A verify loop without a stop condition is not a safety feature; it is a token-burning machine with good intentions.\n\nThere is one more limit worth internalizing: the critic cannot see what is not in its rubric. If the rubric checks correctness but not security, the loop will converge on code that passes every test and still leaks credentials. If it checks tone but not factuality, you get a beautiful, confident lie. Reflection optimizes for the rubric the way training optimizes for the loss function — Goodhart's law applies to critics too. The fix is rubric maintenance: review the rubric against real failures quarterly, add checks for each incident class you actually suffered, and retire checks that never fire. A verify loop is a living system, not a configured one."
      },
      {
        kind: "callout",
        tone: "warn",
        title: "Cap It or It Will Not Stop",
        body: "Every verify loop needs three stop conditions: a hard attempt cap (3-5), stuck detection (same error signature twice = stop), and a no-improvement rule (rubric score flat for two attempts = stop). When all three are exhausted, escalate with the full history attached. The most expensive bug in reflection loops is not a bad repair — it is a loop that runs 40 attempts overnight because nobody told it when to quit. And remember Goodhart's law: the loop converges on what the rubric measures, not what you meant. Review the rubric against real incidents quarterly, or the critic will perfect the wrong thing."
      },
      {
        kind: "code",
        heading: "Stuck Detection and Convergence Tracking",
        lang: "javascript",
        code: "// Normalized error signatures catch 'same error, different wording'.\nfunction signature(stderr) {\n  return stderr\n    .replace(/\\d+/g, \"#\")          // line numbers change; error kind doesn't\n    .replace(/\\s+/g, \" \")\n    .trim()\n    .slice(0, 160);\n}\n\nfunction shouldStop(history) {\n  // history: [{ attempt, ok, stderr, score }] newest last\n  const sigs = history.map((h) => signature(h.stderr || \"\"));\n  if (new Set(sigs).size < sigs.length) return \"stuck: repeated error signature\";\n  const scores = history.map((h) => h.score ?? 0);\n  if (scores.length >= 3) {\n    const [a, b, c] = scores.slice(-3);\n    if (c <= b && b <= a) return \"no-improvement: score flat or falling twice\";\n  }\n  if (history.some((h) => h.score >= 9)) return \"passed: rubric threshold met\";\n  return null; // keep going\n}",
        note: "Normalize before comparing: line numbers and paths change between attempts, the underlying error usually does not."
      },
      {
        kind: "compare",
        heading: "Generator-Only vs. Generator + Critic",
        headers: ["Generator only", "Generator + critic"],
        rows: [
          ["Quality", "Single-pass quality; defects ship silently.", "Rubric-scored; defects get named and repaired before shipping."],
          ["Cost", "One call per artifact.", "2-4x calls per artifact (generate + critique + repairs)."],
          ["Latency", "Minimal; one round trip.", "Each verify iteration adds a full round trip."],
          ["Failure visibility", "Failures surface downstream, in production.", "Failures surface inside the loop, with evidence attached."],
          ["Risk", "Overconfident output with no second opinion.", "Infinite repair loops if stop conditions are missing."],
          ["Best fit", "Low-stakes, easily reversible outputs.", "Code, plans, and anything expensive to get wrong."],
          ["Rubric risk", "No rubric to maintain.", "Converges on what the rubric measures — review it against real failures or it perfects the wrong thing."]
        ]
      }
    ],
    takeaways: [
      "Split generation from judgment: a critic with an explicit rubric, in a separate call, catches what self-grading misses.",
      "Self-repair works because errors are concrete evidence — run the code, capture stderr, feed the exact error back.",
      "Every verify loop needs stop conditions: an attempt cap of 3-5, stuck detection, and a no-improvement rule.",
      "When the loop gives up, escalate with the artifact, history, and final verdict — never retry silently."
    ],
    quiz: [
      {
        q: "Why does a separate critic call outperform asking the generator to 'check its own work' in the same prompt?",
        options: ["Separate calls are always cheaper", "The model grades its own homework generously; an independent critic with an explicit rubric and no access to the generator's reasoning has fewer blind spots", "Critics use a different neural network architecture", "Generators cannot read rubrics"],
        answer: 1,
        why: "Self-grading in one prompt inherits the generator's blind spots and optimism. Independence plus an explicit checklist is what makes the second opinion valuable."
      },
      {
        q: "What makes self-repairing code effective as a pattern?",
        options: ["Feeding the exact execution error back as concrete, checkable evidence for a targeted repair attempt", "Asking the model to rewrite everything from scratch each time", "Increasing the temperature on every retry", "Hiding errors from the model so it stays confident"],
        answer: 0,
        why: "A compiler error or failing test is new information the first attempt lacked. Targeted repair against evidence beats vague regeneration."
      },
      {
        q: "Your repair loop shows attempt 2 and attempt 4 failing with the same normalized error signature. What should the harness do?",
        options: ["Increase maxAttempts to 20 and continue", "Switch to a larger model mid-loop without recording it", "Stop immediately — this is a stuck loop — and escalate with the history", "Delete the error logs to save context"],
        answer: 2,
        why: "A repeated error signature means the model is rewriting the same broken code. More attempts burn tokens; the correct move is to stop and escalate."
      },
      {
        q: "A useful critic verdict should be…",
        options: ["A single emoji summarizing the vibe", "Machine-readable: a score plus specific defects as {location, issue, severity} so the harness can decide accept, repair, or escalate", "A long essay about the artifact's potential", "Always 'looks good to me' to keep velocity high"],
        answer: 1,
        why: "Structured verdicts let the harness act mechanically. Vague praise or essays cannot drive accept/repair/escalate decisions."
      },
      {
        q: "Which scenario describes oscillation in a verify loop?",
        options: ["The loop finishes on the first attempt", "Attempt 3 fixes the null check but breaks the schema; attempt 4 restores the schema but drops the null check", "The rubric score climbs steadily to 10", "The critic and generator agree immediately"],
        answer: 1,
        why: "Oscillation is the artifact ping-ponging between two defects — each repair unfixes the previous one. It never converges without intervention."
      },
      {
        q: "What is the productive attempt-cap range for most repair tasks?",
        options: ["3 to 5 attempts — beyond that, returns collapse", "50 to 100 attempts for thoroughness", "Exactly 1 attempt; retries are wasteful", "There should be no cap if the task matters"],
        answer: 0,
        why: "Empirically, one or two verify iterations capture most of the gain. Past ~5 attempts the model is usually thrashing, not improving."
      },
      {
        q: "Why should the critic receive the artifact plus requirements, but NOT the generator's internal reasoning?",
        options: ["Reasoning chains are too long to fit in any context window", "To preserve the critic's independence — shared reasoning inherits the generator's blind spots", "Generators are forbidden from producing reasoning", "It makes the critic run faster on GPUs"],
        answer: 1,
        why: "A critic that reads the generator's monologue tends to retrace the same faulty logic. Independence is the point of the second opinion."
      },
      {
        q: "When a verify loop exhausts its budget without passing the rubric, the harness should…",
        options: ["Silently retry from scratch with higher temperature", "Escalate with the artifact, full history, and final critic verdict attached — to a human or a different strategy", "Ship the last attempt anyway", "Delete the trace to keep logs clean"],
        answer: 1,
        why: "Exhaustion is a decision point, not a failure to hide. The history is exactly what a human or fallback strategy needs to take over intelligently."
      }
    ]
  },
  es: {
    title: "Reflexión y autocrítica",
    tagline: "Los errores son información: construye bucles que verifiquen, critiquen y reparen — y asegúrate de que puedan parar.",
    objectives: [
      "Construir bucles de verificación donde un crítico evalúe la salida del generador contra una rúbrica explícita.",
      "Implementar flujos de código autorreparable: ejecutar, capturar el error, retroalimentarlo y reintentar con un límite.",
      "Detectar la no convergencia — bucles atascados, correcciones oscilantes, calidad en degradación — y escalar en lugar de iterar eternamente."
    ],
    sections: [
      {
        kind: "text",
        heading: "La división generador-crítico",
        body: "Un único modelo que produce una respuesta y juzga su propia respuesta hace dos trabajos con un cerebro, y se nota: el modelo corrige sus propios deberes con generosidad. El patrón de reflexión divide los roles. Un generador produce un candidato — código, un borrador, un plan — y un crítico lo evalúa contra una rúbrica explícita, en una llamada separada, idealmente con un prompt que nunca vio el razonamiento del generador. El veredicto del crítico retroalimenta el siguiente intento de generación. Este es el bucle de verificación: generar, criticar, reparar, repetir hasta que la rúbrica se supera o se agota el presupuesto.\n\n¿Por qué funciona esto cuando «inténtalo más fuerte» no funciona? Porque los errores son información que el primer intento no tenía. Un error de compilación, un test fallido, una puntuación de 4 sobre 10 con la nota «falta comprobación de nulo en la línea 12» — cada uno es un hecho concreto y comprobable. El intento de reparación no es una segunda conjetura vaga; es una respuesta dirigida a la evidencia. Por eso el código autorreparable es el ejemplo canónico: ejecuta el código, captura stderr, devuelve el error exacto al modelo y observa cómo sube la tasa de reparación. En tareas de reparación bien acotadas, una o dos iteraciones de verificación corrigen rutinariamente lo que la generación zero-shot no consigue.\n\nPero el crítico solo es tan bueno como su rúbrica y su independencia. Un prompt de crítico que dice «¿esto está bien?» dirá que sí. Un prompt de crítico con lista de comprobación — «¿maneja la entrada vacía? ¿cierra el descriptor del fichero? ¿coincide con el esquema de salida requerido?» — encuentra defectos reales. Y un crítico que comparte la cadena completa de razonamiento del generador hereda sus puntos ciegos; dale al crítico el artefacto más los requisitos, no el monólogo interno del generador. La independencia es lo que hace que la segunda opinión valga sus tokens.\n\nUna nota práctica sobre el coste: la reflexión es uno de los patrones más caros por unidad de calidad ganada, porque cada iteración de verificación es una llamada completa al modelo sobre un contexto creciente. Presupéstala donde los errores son caros — código que se publica, planes que comprometen recursos, respuestas que llevan el nombre de la empresa — y omítela donde son baratos. La pregunta nunca es «¿ayuda la reflexión?» — casi siempre ayuda un poco — sino «¿es este el lugar de mayor valor para gastar esos tokens?». Los equipos que aplican bucles de verificación de forma uniforme acaban con agentes lentos y caros; los que los aplican en las fronteras del fallo acaban con agentes rápidos y confiables."
      },
      {
        kind: "code",
        heading: "Código autorreparable: ejecutar, error, corregir",
        lang: "javascript",
        code: "async function selfRepair({ model, task, runCode, maxAttempts = 4 }) {\n  let code = await model.generate(task.prompt); // attempt 1: zero-shot\n  const history = [];\n\n  for (let attempt = 1; attempt <= maxAttempts; attempt++) {\n    const result = await runCode(code); // sandboxed execution\n    history.push({ attempt, ok: result.ok, stderr: result.stderr?.slice(0, 2000) });\n    if (result.ok) return { ok: true, code, attempts: attempt, history };\n\n    // The error IS the prompt for the next attempt: concrete, checkable.\n    code = await model.generate(\n      `Previous attempt failed. Fix ONLY the reported error; do not refactor.\\n` +\n      `Error:\\n${result.stderr}\\n\\nCode:\\n${code}`\n    );\n  }\n  return { ok: false, code, attempts: maxAttempts, history };\n}",
        note: "El prompt de reparación es deliberadamente estrecho: corrige solo el error reportado, nada más. La amplitud es donde los bucles de reparación se pierden."
      },
      {
        kind: "text",
        heading: "El patrón crítico — y sus límites",
        body: "El patrón crítico se generaliza más allá del código. Para un borrador de correo, el crítico puntúa tono, completitud y afirmaciones factuales contra el material fuente. Para un plan, el crítico comprueba que cada paso tenga responsable y que ninguna dependencia quede colgada. La forma es siempre la misma: artefacto dentro, veredicto puntuado por rúbrica fuera, con defectos específicos listados, no sensaciones. Un crítico útil devuelve un veredicto legible por máquina — una puntuación más una lista de {location, issue, severity} — para que el *harness* (arnés) pueda decidir mecánicamente si aceptar, reparar o escalar.\n\nAhora la parte difícil: los bucles que nunca convergen. La reflexión parece segura porque cada iteración parece progreso, pero tres modos de fallo se esconden dentro. Primero, el bucle atascado: el mismo error aparece en el intento 2, 3 y 4 — el modelo reescribe la misma línea rota con distintos nombres de variable. Segundo, la oscilación: el intento 3 corrige la comprobación de nulo pero rompe el esquema; el intento 4 restaura el esquema pero pierde la comprobación de nulo. El artefacto rebota entre dos defectos. Tercero, la degradación de calidad: cada reparación hace el código más largo y enrevesado mientras la puntuación de la rúbrica se estanca — el modelo está dando palos de ciego.\n\nLa convergencia necesita maquinaria, no esperanza. Limita los intentos — de 3 a 5 es el rango productivo para la mayoría de las tareas de reparación; más allá, los retornos colapsan. Detecta el atasco: si la firma de error normalizada coincide con un intento anterior, para de inmediato. Sigue la puntuación de la rúbrica entre intentos y para cuando no mejore dos veces seguidas. Y define siempre la escalada: cuando el bucle se rinde, el artefacto, el historial completo y el veredicto final del crítico van a un humano o a otra estrategia — nunca a un reintento silencioso. Un bucle de verificación sin condición de parada no es una medida de seguridad; es una máquina de quemar tokens con buenas intenciones.\n\nHay un límite más que conviene interiorizar: el crítico no ve lo que no está en su rúbrica. Si la rúbrica comprueba corrección pero no seguridad, el bucle convergerá en código que pasa todos los tests y aun así filtra credenciales. Si comprueba tono pero no factualidad, obtienes una mentira hermosa y segura de sí misma. La reflexión optimiza para la rúbrica como el entrenamiento optimiza para la función de pérdida: la ley de Goodhart también aplica a los críticos. La solución es mantener la rúbrica: revísala contra fallos reales cada trimestre, añade comprobaciones para cada clase de incidente que hayas sufrido y retira las que nunca se disparan. Un bucle de verificación es un sistema vivo, no uno configurado."
      },
      {
        kind: "callout",
        tone: "warn",
        title: "Ponle límite o no parará",
        body: "Todo bucle de verificación necesita tres condiciones de parada: un límite duro de intentos (3-5), detección de atasco (misma firma de error dos veces = parar) y una regla de no mejora (puntuación estancada dos intentos = parar). Cuando las tres se agotan, escala con el historial completo adjunto. El bug más caro en los bucles de reflexión no es una mala reparación: es un bucle que ejecuta 40 intentos durante la noche porque nadie le dijo cuándo rendirse. Y recuerda la ley de Goodhart: el bucle converge en lo que la rúbrica mide, no en lo que querías decir. Revísala contra incidentes reales cada trimestre, o el crítico perfeccionará lo incorrecto."
      },
      {
        kind: "code",
        heading: "Detección de atasco y seguimiento de convergencia",
        lang: "javascript",
        code: "// Normalized error signatures catch 'same error, different wording'.\nfunction signature(stderr) {\n  return stderr\n    .replace(/\\d+/g, \"#\")          // line numbers change; error kind doesn't\n    .replace(/\\s+/g, \" \")\n    .trim()\n    .slice(0, 160);\n}\n\nfunction shouldStop(history) {\n  // history: [{ attempt, ok, stderr, score }] newest last\n  const sigs = history.map((h) => signature(h.stderr || \"\"));\n  if (new Set(sigs).size < sigs.length) return \"stuck: repeated error signature\";\n  const scores = history.map((h) => h.score ?? 0);\n  if (scores.length >= 3) {\n    const [a, b, c] = scores.slice(-3);\n    if (c <= b && b <= a) return \"no-improvement: score flat or falling twice\";\n  }\n  if (history.some((h) => h.score >= 9)) return \"passed: rubric threshold met\";\n  return null; // keep going\n}",
        note: "Normaliza antes de comparar: los números de línea y las rutas cambian entre intentos, el error subyacente normalmente no."
      },
      {
        kind: "compare",
        heading: "Solo generador frente a generador + crítico",
        headers: ["Solo generador", "Generador + crítico"],
        rows: [
          ["Calidad", "Calidad de una sola pasada; los defectos se publican en silencio.", "Puntuado por rúbrica; los defectos se nombran y reparan antes de publicar."],
          ["Coste", "Una llamada por artefacto.", "2-4 veces más llamadas por artefacto (generar + criticar + reparaciones)."],
          ["Latencia", "Mínima; una ida y vuelta.", "Cada iteración de verificación añade una ida y vuelta completa."],
          ["Visibilidad de fallos", "Los fallos aparecen después, en producción.", "Los fallos aparecen dentro del bucle, con evidencia adjunta."],
          ["Riesgo", "Salida con exceso de confianza y sin segunda opinión.", "Bucles de reparación infinitos si faltan condiciones de parada."],
          ["Mejor ajuste", "Salidas de bajo riesgo y fácilmente reversibles.", "Código, planes y todo lo caro de hacer mal."],
          ["Riesgo de rúbrica", "Ninguna rúbrica que mantener.", "Converge en lo que la rúbrica mide: revísala contra fallos reales o perfeccionará lo incorrecto."]
        ]
      }
    ],
    takeaways: [
      "Separa la generación del juicio: un crítico con rúbrica explícita, en llamada separada, detecta lo que la autocorrección no ve.",
      "La autorreparación funciona porque los errores son evidencia concreta: ejecuta el código, captura stderr y devuelve el error exacto.",
      "Todo bucle de verificación necesita condiciones de parada: límite de 3-5 intentos, detección de atasco y regla de no mejora.",
      "Cuando el bucle se rinde, escala con el artefacto, el historial y el veredicto final — nunca reintentes en silencio."
    ],
    quiz: [
      {
        q: "¿Por qué una llamada de crítico separada supera a pedir al generador que «revise su propio trabajo» en el mismo prompt?",
        options: ["Las llamadas separadas siempre son más baratas", "Los críticos usan una arquitectura de red neuronal distinta", "El modelo corrige sus propios deberes con generosidad; un crítico independiente con rúbrica explícita y sin acceso al razonamiento del generador tiene menos puntos ciegos", "Los generadores no pueden leer rúbricas"],
        answer: 2,
        why: "La autocorrección en un único prompt hereda los puntos ciegos y el optimismo del generador. La independencia más una lista explícita es lo que da valor a la segunda opinión."
      },
      {
        q: "¿Qué hace eficaz al código autorreparable como patrón?",
        options: ["Retroalimentar el error exacto de ejecución como evidencia concreta y comprobable para un intento de reparación dirigido", "Pedir al modelo que reescriba todo desde cero cada vez", "Subir la temperatura en cada reintento", "Ocultar los errores al modelo para que mantenga la confianza"],
        answer: 0,
        why: "Un error de compilación o un test fallido es información nueva que el primer intento no tenía. La reparación dirigida contra evidencia supera a la regeneración vaga."
      },
      {
        q: "Tu bucle de reparación muestra que los intentos 2 y 4 fallan con la misma firma de error normalizada. ¿Qué debe hacer el harness?",
        options: ["Aumentar maxAttempts a 20 y continuar", "Cambiar a un modelo mayor a mitad del bucle sin registrarlo", "Borrar los registros de error para ahorrar contexto", "Parar de inmediato — es un bucle atascado — y escalar con el historial"],
        answer: 3,
        why: "Una firma de error repetida significa que el modelo reescribe el mismo código roto. Más intentos queman tokens; lo correcto es parar y escalar."
      },
      {
        q: "Un veredicto útil del crítico debería ser…",
        options: ["Un único emoji que resuma la sensación", "Legible por máquina: una puntuación más defectos específicos como {location, issue, severity} para que el harness decida aceptar, reparar o escalar", "Un ensayo largo sobre el potencial del artefacto", "Siempre «se ve bien» para mantener la velocidad"],
        answer: 1,
        why: "Los veredictos estructurados permiten al harness actuar mecánicamente. Los elogios vagos o los ensayos no pueden dirigir decisiones de aceptar, reparar o escalar."
      },
      {
        q: "¿Qué escenario describe oscilación en un bucle de verificación?",
        options: ["El bucle termina en el primer intento", "La puntuación de la rúbrica sube de forma constante hasta 10", "El intento 3 corrige la comprobación de nulo pero rompe el esquema; el intento 4 restaura el esquema pero pierde la comprobación de nulo", "El crítico y el generador están de acuerdo de inmediato"],
        answer: 2,
        why: "La oscilación es el artefacto rebotando entre dos defectos: cada reparación deshace la anterior. Nunca converge sin intervención."
      },
      {
        q: "¿Cuál es el rango productivo de límite de intentos para la mayoría de las tareas de reparación?",
        options: ["De 3 a 5 intentos: más allá, los retornos colapsan", "De 50 a 100 intentos por exhaustividad", "Exactamente 1 intento; los reintentos son un desperdicio", "No debería haber límite si la tarea importa"],
        answer: 0,
        why: "Empíricamente, una o dos iteraciones de verificación capturan la mayor parte de la ganancia. Pasados unos 5 intentos el modelo suele dar palos de ciego, no mejorar."
      },
      {
        q: "¿Por qué el crítico debe recibir el artefacto más los requisitos, pero NO el razonamiento interno del generador?",
        options: ["Las cadenas de razonamiento son demasiado largas para cualquier ventana de contexto", "Los generadores tienen prohibido producir razonamiento", "Hace que el crítico corra más rápido en GPU", "Para preservar la independencia del crítico: el razonamiento compartido hereda los puntos ciegos del generador"],
        answer: 3,
        why: "Un crítico que lee el monólogo del generador tiende a recorrer la misma lógica defectuosa. La independencia es el sentido de la segunda opinión."
      },
      {
        q: "Cuando un bucle de verificación agota su presupuesto sin superar la rúbrica, el harness debe…",
        options: ["Reintentar en silencio desde cero con mayor temperatura", "Escalar con el artefacto, el historial completo y el veredicto final del crítico adjuntos — a un humano o a otra estrategia", "Publicar el último intento igualmente", "Borrar la traza para mantener limpios los registros"],
        answer: 1,
        why: "El agotamiento es un punto de decisión, no un fallo que ocultar. El historial es exactamente lo que un humano o una estrategia alternativa necesita para tomar el relevo con inteligencia."
      }
    ]
  }
};
