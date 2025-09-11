"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type TestCase = {
  input: any | any[]; // single arg or array of args
  expected: any;
  label?: string;
};

type Challenge = {
  id: string;
  title: string;
  description: string;
  starterCode: string; // JS code; must define function `solve`
  tests: TestCase[];
};

function deepEqual(a: any, b: any): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a == null || b == null) return false;
  if (typeof a !== "object") return a === b;

  // Arrays
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Dates
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }

  // Objects
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!bKeys.includes(k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

function getUserFunction(code: string): ((...args: any[]) => any) | null {
  try {
    const runner = new Function(
      "require",
      "module",
      "exports",
      `"use strict";
      // Prevent some globals
      const window = undefined; const document = undefined; const globalThis_ = undefined;
      ${code}
      if (typeof solve === 'function') { return solve; }
      if (module && module.exports && typeof module.exports.solve === 'function') { return module.exports.solve; }
      if (exports && typeof exports.solve === 'function') { return exports.solve; }
      return null;`
    );
    return runner(
      () => {
        throw new Error("require não é suportado neste ambiente");
      },
      { exports: {} },
      {}
    );
  } catch (e) {
    console.error(e);
    return null;
  }
}

const challenges: Challenge[] = [
  {
    id: "two-sum",
    title: "Two Sum",
    description:
      "Dado um array de números inteiros nums e um inteiro target, retorne os índices de dois números que somam target. Assuma que sempre existe exatamente uma solução e você não pode usar o mesmo elemento duas vezes.",
    starterCode:
      `// Implemente a função solve(nums, target): deve retornar [i, j]
function solve(nums, target) {
  // Escreva seu código aqui
  // Dica: use um Map para armazenar valores já vistos
}

// Você também pode exportar com module.exports = { solve };`,
    tests: [
      { input: [[2, 7, 11, 15], 9], expected: [0, 1], label: "Exemplo 1" },
      { input: [[3, 2, 4], 6], expected: [1, 2] },
      { input: [[3, 3], 6], expected: [0, 1] },
    ],
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    description:
      "Dada uma string com os caracteres '()[]{}', determine se a string é válida. Uma string é válida se os parênteses forem fechados na ordem correta.",
    starterCode:
      `// Implemente a função solve(s): deve retornar true/false
function solve(s) {
  // Escreva seu código aqui
}
`,
    tests: [
      { input: ["()"], expected: true },
      { input: ["()[]{}"], expected: true },
      { input: ["(]"], expected: false },
      { input: ["([)]"], expected: false },
      { input: ["{[]}"], expected: true },
    ],
  },
  {
    id: "fizz-buzz",
    title: "FizzBuzz",
    description:
      "Dado um inteiro n, retorne uma lista de strings de 1 até n. Para múltiplos de 3, 'Fizz'; para múltiplos de 5, 'Buzz'; para ambos, 'FizzBuzz'; caso contrário, o número.",
    starterCode:
      `// Implemente a função solve(n): deve retornar string[]
function solve(n) {
  // Escreva seu código aqui
}
`,
    tests: [
      { input: [3], expected: ["1", "2", "Fizz"] },
      { input: [5], expected: ["1", "2", "Fizz", "4", "Buzz"] },
      {
        input: [15],
        expected: [
          "1",
          "2",
          "Fizz",
          "4",
          "Buzz",
          "Fizz",
          "7",
          "8",
          "Fizz",
          "Buzz",
          "11",
          "Fizz",
          "13",
          "14",
          "FizzBuzz",
        ],
      },
    ],
  },
  {
    id: "reverse-string",
    title: "Reverse String",
    description: "Dada uma string s, retorne a string invertida.",
    starterCode:
      `// Implemente a função solve(s): deve retornar a string invertida
function solve(s) {
  // Escreva seu código aqui
}
`,
    tests: [
      { input: ["hello"], expected: "olleh" },
      { input: ["abc"], expected: "cba" },
      { input: [""], expected: "" },
    ],
  },
  {
    id: "merge-sorted-arrays",
    title: "Merge Two Sorted Arrays",
    description:
      "Dadas duas listas ordenadas nums1 e nums2, retorne uma única lista ordenada contendo todos os elementos de ambas.",
    starterCode:
      `// Implemente a função solve(nums1, nums2): deve retornar um novo array ordenado
function solve(nums1, nums2) {
  // Escreva seu código aqui
}
`,
    tests: [
      { input: [[1, 3, 5], [2, 4, 6]], expected: [1, 2, 3, 4, 5, 6] },
      { input: [[], [1, 2]], expected: [1, 2] },
      { input: [[-1, 0, 3], [-2, 4]], expected: [-2, -1, 0, 3, 4] },
    ],
  },
];

export default function VibeCoderChallenge() {
  const [accepted, setAccepted] = useState<null | boolean>(null);
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [code, setCode] = useState<string>(() => challenges[0].starterCode);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<
    { pass: boolean; expected: any; received: any; label?: string; error?: string }[]
  >([]);
  const [allPassed, setAllPassed] = useState(false);

  const challenge = useMemo(() => challenges[challengeIndex], [challengeIndex]);

  const onSelectChallenge = (idx: number) => {
    setChallengeIndex(idx);
    setCode(challenges[idx].starterCode);
    setResults([]);
    setAllPassed(false);
  };

  const runValidation = async () => {
    setRunning(true);
    setAllPassed(false);
    setResults([]);
    try {
      const userFn = getUserFunction(code);
      if (typeof userFn !== "function") {
        setResults([{ pass: false, expected: "função solve", received: null, error: "Não foi possível encontrar a função solve" }]);
        setRunning(false);
        return;
      }

      const localResults: { pass: boolean; expected: any; received: any; label?: string; error?: string }[] = [];
      for (const t of challenge.tests) {
        try {
          const args = Array.isArray(t.input) ? t.input : [t.input];
          // rudimentary timeout via Promise.race is not reliable in sync code; we call directly
          const output = userFn(...args);
          const pass = deepEqual(output, t.expected);
          localResults.push({ pass, expected: t.expected, received: output, label: t.label });
        } catch (e: any) {
          localResults.push({ pass: false, expected: t.expected, received: undefined, label: t.label, error: e?.message || String(e) });
        }
      }
      setResults(localResults);
      setAllPassed(localResults.length > 0 && localResults.every((r) => r.pass));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="p-4 h-full overflow-auto">
      {accepted === null && (
        <div className="border rounded-md p-6 bg-muted/30">
          <h3 className="text-lg font-semibold mb-2">Você é vibe coder?</h3>
          <p className="text-sm text-muted-foreground mb-4">Se ainda não existem arquivos para mostrar, que tal encarar um desafio rápido no estilo LeetCode?</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setAccepted(true)}>Sim</Button>
            <Button size="sm" variant="secondary" onClick={() => setAccepted(false)}>Não agora</Button>
          </div>
        </div>
      )}

      {accepted === false && (
        <div className="p-6 text-sm text-muted-foreground">Tudo bem! Assim que os arquivos forem gerados, eles aparecerão aqui.</div>
      )}

      {accepted === true && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm font-medium">Desafio:</label>
            <select
              className="h-8 px-2 rounded-md border bg-background text-sm"
              value={challengeIndex}
              onChange={(e) => onSelectChallenge(Number(e.target.value))}
            >
              {challenges.map((c, idx) => (
                <option value={idx} key={c.id}>
                  {idx + 1}. {c.title}
                </option>
              ))}
            </select>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setCode(challenge.starterCode)}>Resetar código</Button>
              <Button size="sm" onClick={runValidation} disabled={running}>{running ? "Validando..." : "Validar"}</Button>
            </div>
          </div>

          <div className="text-sm leading-relaxed p-3 rounded-md bg-muted/40 border">
            <div className="font-semibold mb-1">{challenge.title}</div>
            <p className="text-muted-foreground">{challenge.description}</p>
            <p className="mt-2 text-xs text-muted-foreground">Requisito: defina uma função <code>solve</code> que atenda aos testes abaixo.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-sm font-medium mb-1">Seu código (JavaScript):</label>
              <textarea
                className="font-mono text-sm p-3 border rounded-md min-h-[260px] bg-background"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Dica: você pode usar <code>{"module.exports = { solve }"}</code> se preferir exportar explicitamente.
              </p>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-medium mb-1">Resultados dos testes:</label>
              <div className="border rounded-md p-3 min-h-[260px] bg-background">
                {results.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum teste executado ainda.</div>
                ) : (
                  <ul className="space-y-2">
                    {results.map((r, i) => (
                      <li key={i} className={`text-sm ${r.pass ? "text-emerald-600" : "text-red-600"}`}>
                        <div className="font-medium">{r.pass ? "✓ Passou" : "✗ Falhou"} {r.label ? `- ${r.label}` : ``}</div>
                        {!r.pass && (
                          <div className="text-xs text-muted-foreground">
                            <div><span className="font-medium">Esperado:</span> {JSON.stringify(r.expected)}</div>
                            <div><span className="font-medium">Recebido:</span> {JSON.stringify(r.received)}</div>
                            {r.error && <div><span className="font-medium">Erro:</span> {r.error}</div>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {allPassed && (
                  <div className="mt-3 text-sm font-medium text-emerald-700">Parabéns! Todos os testes passaram 🎉</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
