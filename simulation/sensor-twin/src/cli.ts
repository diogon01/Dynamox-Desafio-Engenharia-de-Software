/**
 * CLI do gêmeo digital. Os comandos `generate` (B3) e `ingest` (B4) são preenchidos nos
 * próximos blocos do plano; este stub existe para os scripts raiz nunca apontarem para
 * um arquivo inexistente.
 */
const command = process.argv[2] ?? '(nenhum)';

console.error(
  `sensor-twin: o comando "${command}" será entregue nos blocos B3/B4 do plano ` +
    '(docs/planning/BON-06_EXECUTION_PLAN_V2.md). Por enquanto, rode os testes: ' +
    'npm run test -w @dynamox/sensor-twin',
);
process.exit(1);
