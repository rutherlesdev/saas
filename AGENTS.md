# AGENTS.md — Guia de Trabalho do Agente

Este arquivo orienta como agentes de IA devem trabalhar neste repositório.

O objetivo não é criar atrito desnecessário. A ideia é manter qualidade, previsibilidade e transparência, usando bom senso para adaptar o nível de rigor ao tamanho e ao risco de cada mudança.

---

## Identidade do Projeto

- Monorepo Turborepo
- Aplicação principal: `apps/web/` (Next.js 16, App Router, TypeScript)
- Queue: BullMQ + ioredis
- Auth/DB: Supabase
- Observabilidade: OpenTelemetry + Sentry + Pino
- Testes: Vitest 2.1.9 (unit + integration) + Playwright (e2e)

---

## Princípios de Trabalho

- Explore o código existente antes de propor mudanças.
- Preserve padrões já adotados no projeto sempre que fizer sentido.
- Prefira mudanças pequenas, coesas e fáceis de validar.
- Não afirme que algo está pronto sem deixar claro o que foi validado.
- Escale o nível de teste e de cerimônia conforme o impacto da mudança.
- Se algum passo não puder ser executado, registre isso explicitamente.

---

## Qualidade Antes de Encerrar

Para mudanças de código em `apps/web/`, o padrão é validar o escopo antes de dizer que terminou.

### Validação recomendada por padrão

```bash
cd /home/openclaw/saas/apps/web

# Base para mudanças em lib/ e app/api/
npx vitest run tests/ --reporter=verbose

# Extra quando a mudança afeta BullMQ / queue
npx vitest run lib/queue/ --reporter=verbose

# Cobertura quando solicitado ou ao fechar uma feature maior
npm run test:coverage
```

### O que conta como concluído

- Os testes relevantes ao escopo passaram.
- Nenhum teste pré-existente foi quebrado sem explicação.
- Código novo com comportamento novo deve ter pelo menos um teste cobrindo o caminho feliz.
- Em mudanças compartilhadas ou de maior risco, rode uma validação mais ampla em vez de só a mínima.

### Como aplicar com bom senso

- Mudanças em docs, comentários ou texto não exigem a mesma bateria de testes de uma mudança em runtime.
- Se a alteração tocar `lib/`, `app/api/` ou código compartilhado, prefira rodar `tests/`.
- Se tocar fila, producer, worker ou observabilidade da queue, rode também os testes co-localizados de `lib/queue/`.
- Se houver bloqueio de ambiente, reporte o que foi possível validar e o que ficou pendente.

---

## Estratégia de Testes

Use esta estrutura como referência:

```text
tests/
  unit/           -> lógica pura, sem I/O
  integration/    -> rotas de API com mocks de Redis/Supabase
  e2e/            -> fluxos completos com servidor rodando (Playwright)
lib/*/**.test.ts  -> testes co-localizados com módulos como BullMQ workers/producers
```

### Quando criar cada tipo de teste

- `tests/unit/`: helpers, utils e lógica pura
- `tests/integration/`: handlers em `app/api/`
- `tests/e2e/`: fluxos completos e críticos para o usuário
- `lib/*/**.test.ts`: comportamento específico de queue, producer, worker ou módulo técnico coeso

### Padrão para testes de integração de API

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/minha-dependencia', () => ({
  minhaFuncao: vi.fn().mockResolvedValue({ id: 'mock-id' }),
}));

describe('GET /api/minha-feature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna 200 com dados válidos', async () => {
    const { GET } = await import('@/app/api/minha-feature/route');
    const req = new Request('http://localhost/api/minha-feature');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ status: 'ok' });
  });
});
```

### Atenção importante

- Faça mocks de dependências externas no topo do arquivo.
- Use `vi.clearAllMocks()` entre testes.
- Não troque o setup global para `vi.restoreAllMocks()`, porque isso apaga `mockResolvedValue` configurado em vários cenários.

---

## Observabilidade em Código Novo

Para novos fluxos de negócio em `lib/` ou `app/api/`, tente sair com observabilidade básica no mesmo PR. Nem todo caso exige tudo, mas logger e tracing costumam ser o mínimo esperado.

### Logger estruturado

```typescript
import { getLogger } from '@/lib/queue/observability/logger';

const logger = getLogger('minha-feature');

logger.info({ jobId, userId }, 'Processando job');
logger.error({ err, jobId }, 'Falha ao processar');
```

### Tracing

```typescript
import { withSpan } from '@/lib/observability/tracing';

export async function processarAlgo(id: string) {
  return withSpan('processarAlgo', async (span) => {
    span.setAttribute('id', id);
    // logica aqui
  });
}
```

### Métricas

Use métricas quando latência, throughput, retries ou volume fizerem diferença para operar o fluxo.

```typescript
import { getMetricsCollector } from '@/lib/queue/observability/metrics';

const metrics = getMetricsCollector();

metrics.recordProcessingTime('minha-fila', durationMs);
```

### Correlation ID em rotas de API

Se a rota abre um fluxo novo ou for importante para rastreabilidade, devolva `x-correlation-id`.

```typescript
import { ensureCorrelationId } from '@/lib/queue/observability/correlation';

export async function GET(req: Request) {
  const correlationId = ensureCorrelationId();

  return NextResponse.json(data, {
    headers: { 'x-correlation-id': correlationId },
  });
}
```

---

## Commits e Entrega

Quando uma feature ou correção estiver integrada, validada e em um estado coerente, prefira encerrar com commit.

```bash
cd /home/openclaw/saas
git status
git diff --stat
git add -A
git commit -m "feat(escopo): descricao curta"
```

### Convenção de commit

| Prefixo | Uso comum |
|---------|-----------|
| `feat(scope):` | Nova funcionalidade |
| `fix(scope):` | Correção de bug |
| `test(scope):` | Adição ou ajuste de testes |
| `refactor(scope):` | Refatoração sem mudança de comportamento |
| `chore(scope):` | Config, dependências, tooling |
| `obs(scope):` | Logs, traces, métricas, telemetria |

Escopos comuns: `queue`, `api`, `auth`, `ui`, `worker`, `health`, `metrics`, `tracing`

### Mensagem sugerida

```text
feat(escopo): descricao curta da feature

- O que foi adicionado ou alterado
- Validacao: testes/tsc executados
- Observabilidade: logger/tracing/metrics quando aplicavel
```

---

## Checklist de Saída

Use este checklist para mudanças de código. Nem todo item se aplica a todo caso, mas ele ajuda a evitar lacunas:

```text
[ ] Codigo implementado e TypeScript validado quando a mudanca toca runtime/contratos
    -> npx tsc --noEmit

[ ] Testes unitarios adicionados/ajustados quando houver logica pura
    -> npx vitest run tests/unit/ --reporter=verbose

[ ] Testes de integracao adicionados/ajustados quando houver rota de API
    -> npx vitest run tests/integration/ --reporter=verbose

[ ] Suite relevante executada
    -> npx vitest run tests/ --reporter=verbose

[ ] Suite ampliada executada se houve impacto em codigo compartilhado
    -> npx vitest run --reporter=verbose

[ ] Observabilidade revisada para novos fluxos

[ ] Commit preparado quando o trabalho estiver em estado entregavel
```

---

## Não Quebrar o Baseline

Após mudanças em arquivos compartilhados, vale a pena rodar a suíte mais ampla:

```bash
cd /home/openclaw/saas/apps/web
npx vitest run --reporter=verbose
```

Falhas conhecidas podem servir como baseline apenas se ainda continuarem existindo no momento da execução. Elas não devem ser usadas para encobrir regressões novas.

Histórico conhecido:

- `lib/queue/integration.test.ts > should handle concurrent job submissions`
- `lib/queue/producers.test.ts > should handle idempotency key`

Se aparecer qualquer falha nova, trate como regressão até prova em contrário.

---

## Variáveis de Ambiente

Nunca hardcode secrets. Use as envs já previstas no projeto:

| Variável | Arquivo | Uso |
|----------|---------|-----|
| `REDIS_URL` ou `REDIS_HOST`/`REDIS_PORT` | `.env.queue` | Conexão Redis/BullMQ |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` | Cliente Supabase browser |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` | Cliente Supabase server |
| `SENTRY_DSN` | `.env.local` | Sentry server-side |
| `NEXT_PUBLIC_SENTRY_DSN` | `.env.local` | Sentry client-side |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `.env.queue` | Jaeger/Tempo trace export |
| `OTEL_SERVICE_NAME` | `.env.queue` | Nome do serviço no trace |

Em testes, as envs sao injetadas via `vitest.config.ts`. Evite duplicar configuracao em `.env.test`, salvo necessidade real e documentada.

---

## Estrutura de Arquivos

```text
apps/web/
  app/api/           -> Route Handlers (Next.js App Router)
  lib/
    queue/           -> BullMQ: producers, workers, config
      observability/ -> logger.ts, metrics.ts, correlation.ts
    observability/   -> tracing.ts
  tests/
    unit/            -> Testes unitarios isolados
    integration/     -> Testes de rotas de API
    e2e/             -> Playwright
    setup.ts         -> vi.clearAllMocks() global
  instrumentation.ts -> Init OTEL + Sentry
  vitest.config.ts   -> Config de testes
  playwright.config.ts
```

---

## Fluxo de Trabalho Sugerido

```text
1. Entender o contexto e ler o codigo relacionado
2. Implementar a menor mudanca segura para o objetivo
3. Adicionar ou ajustar testes quando houver comportamento novo
4. Rodar a validacao proporcional ao impacto
5. Rodar validacao mais ampla se tocar codigo compartilhado
6. Executar tsc quando a mudanca afetar contratos ou runtime
7. Commitar quando o trabalho estiver coeso e validado
8. Reportar o que mudou, o que foi testado e qualquer risco pendente
```

---

## Bom Senso e Exceções

- Mudancas pequenas de documentacao podem ser tratadas com menos cerimonia.
- Hotfixes podem priorizar a validacao mais critica primeiro, desde que o que ficou pendente seja dito explicitamente.
- Se algum comando falhar por ambiente, dependencia externa ou infraestrutura, nao invente resultado: registre a limitacao.
- Quando houver conflito entre seguir o processo ao pe da letra e proteger a entrega, priorize a intencao da regra: qualidade, rastreabilidade e clareza.
