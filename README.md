# Cadence Timer

Uma aplicação web mobile-first para treinos de musculação com controle de cadência, projetada para auxiliar na execução precisa de repetições com tempos definidos para cada fase do movimento.

## Funcionalidades

### 🏋️ Configuração de Treinos

*   **Múltiplos Treinos:** Crie, renomeie e exclua treinos (ex: Treino A, Treino B). O novo exercício herda configurações do anterior.
*   **Exercícios Configuráveis:**
    *   Nome do exercício.
    *   Número de Séries e Repetições Alvo.
    *   **Cadência (Segundos):** Excêntrica (Desce), Pausa em Baixo, Concêntrica (Sobe), Pausa em Cima.
    *   **Intervalos:** Tempo de Preparo, Descanso entre Séries, Descanso entre Exercícios.
    *   **Começar pela Concêntrica:** Inverte a ordem das fases (Sobe → Pausa → Desce → Pausa).
*   **Modo Até a Falha:** Define faixa de repetições (Min–Max). O timer não para automaticamente; o usuário encerra com o botão "Falha/Acabei". Inclui feedback visual (DENTRO DA META, ACIMA DA META).
*   **Exercícios Isométricos:** Configura o tempo alvo ao invés de repetições. Countdown e tempo acumulado exibidos no formato `M:SS`. Suporta modo falha com overtime.
*   **Exercícios Unilaterais:** Execução por lado (Esquerdo/Direito) com transição configurável entre lados e registro de reps por lado. Possibilidade de alternar o lado inicial durante o descanso.
*   **Reordenar Exercícios:** Botões ↑↓ para mover exercício de posição.

### 🔗 Bi-Sets, Tri-Sets e Giant Sets

*   **Agrupamento de Exercícios:** Vincule exercícios adjacentes com o botão 🔗 para executá-los em sequência sem descanso completo entre eles (Ex1 → Prep → Ex2 → Descanso).
*   **Labels Automáticos:** BI-SET, TRI-SET ou GIANT SET conforme o número de exercícios agrupados.
*   **Sincronização:** Séries e descanso entre séries são sincronizados dentro do grupo.
*   **Log Unificado:** Inputs de carga e reps para todos os exercícios do grupo aparecem na tela de descanso.

### ⏱️ Treino Ativo

*   **Timer de Cadência:** Controle visual e sonoro (TTS em pt-BR) para cada fase do movimento.
*   **Formatos de Countdown:**
    *   Fases curtas (cadência/holds): formato `SS` com 2 dígitos (ex: `03`, `02`, `01`).
    *   Isometria (countdown e tempo acumulado): formato `M:SS` (ex: `0:45`, `1:30`).
    *   Descanso entre séries/exercícios: formato `M:SS` (ex: `1:00`, `1:30`).
*   **Cronômetro Global:** Tempo total de treino com ícone ⏱️ no canto superior direito.
*   **Feedback por Cores:** Cada fase tem uma cor distinta (Excêntrica, Concêntrica, Isometria, Descanso, Preparar).
*   **Beep de Contagem:** Bip sonoro nos últimos 3 segundos de cada fase longa ou de descanso.
*   **Anúncios por Voz (TTS):** "Desce", "Sobe", "Segura", "Descansa", "Preparar", "Treino Concluído" — em português (pt-BR).
*   **Edição durante Descanso:** Campos para ajustar carga (kg) e repetições durante o intervalo, com botões +/−.
*   **Info do Próximo Exercício/Série:** Exibido na tela de descanso.
*   **Botão Pular:** Avança para a próxima fase a qualquer momento.
*   **Pausar/Retomar:** Pausa e retoma o treino.

### 📊 Conselho de Carga Inteligente

*   **Ícone com Indicador:** Ícone de peso (🏋️) com sobreposição visual:
    *   🔵 **Subir Carga** (última performance acima do máximo da faixa).
    *   🔴 **Descer Carga** (última performance abaixo do mínimo da faixa).
    *   🟢 **Manter Carga** (última performance dentro da faixa).
*   **Exibido em:** Tela de Preview (pré-treino), Descanso (durante treino), Resumo (pós-treino), Histórico.

### 📋 Preview Pré-Treino

*   Exibe lista de exercícios com séries × reps.
*   **Pré-preenchimento de Cargas:** Busca a última carga do histórico por exercício (por ID ou nome).
*   Permite ajustar cargas antes de iniciar com inputs +/−.
*   Exibe conselho de carga baseado no histórico.

### 🏁 Resumo do Treino (Pós-Treino)

*   **Agrupamento Inteligente:** Séries organizadas por Bi-Set e por Exercício, evitando duplicação visual.
*   **Comparativo com Treino Anterior:** Indicadores ↑↓= de performance por série (carga e reps).
*   **Edição Inline:** Corrija carga, reps ou tempo de cada série antes de salvar.
*   **Cálculo de Duração:** Duração total do treino calculada automaticamente.
*   Opção de Salvar ou Descartar.

### 📜 Histórico de Treinos

*   Registro detalhado de todas as sessões com data/hora.
*   **Sessões Expansíveis:** Clique para expandir/recolher os detalhes de cada sessão.
*   **Edição Posterior:** Modo edição inline para corrigir carga, reps ou tempo de séries passadas.
*   Exclusão de sessões individuais e limpeza completa do histórico.
*   Exibe conselho de carga retroativamente.

### 🔄 Recuperação de Treino

*   **Auto-Save:** Estado do treino salvo no localStorage a cada 2 segundos.
*   **Detecção de Interrupção:** Se o app fechar inesperadamente, ao reabrir exibe prompt para retomar o treino de onde parou.
*   Opções: **Continuar Treino** ou **Descartar e Iniciar Novo**.

### ⚙️ Configurações

*   **Manter Tela Ligada:** Toggle para ativar/desativar o Wake Lock (mantém a tela do celular ligada durante o treino). Ativado por padrão.
*   **Backup (Exportar):** Exporta treinos, histórico e configurações para arquivo JSON com data no nome.
*   **Restaurar (Importar):** Importa dados de um arquivo JSON de backup. Inclui validação e migração automática de campos ausentes (biSetId, prepTime).

## Como Usar

1.  **Configuração (Setup):**
    *   Crie treinos e adicione exercícios.
    *   Configure cadência, séries, repetições, intervalos de descanso.
    *   Ative opções como "Até a Falha", "Isometria", "Unilateral" ou agrupe em Bi-Sets conforme necessário.
    *   Use **Backup/Restaurar** em Configurações para manter seus dados seguros.

2.  **Preview:**
    *   Ao clicar em INICIAR, revise a lista de exercícios e ajuste as cargas iniciais.
    *   O conselho de carga indica se deve subir, descer ou manter com base no último treino.

3.  **Treino Ativo:**
    *   Siga as instruções visuais (cores) e sonoras (voz e beeps).
    *   **Countdowns:** Fases curtas exibem segundos com 2 dígitos (`03`). Fases longas usam `M:SS`.
    *   **Timer Global:** Acompanhe a duração total (ícone ⏱️) no canto superior direito.
    *   Durante o descanso, ajuste carga e reps realizadas naquela série.
    *   Exercícios isométricos registram tempo ao invés de reps.
    *   No modo falha, o botão "Falha/Acabei" encerra a série manualmente.

4.  **Finalização:**
    *   Ao completar todos os exercícios, veja o **Resumo** com comparativo.
    *   Revise e ajuste dados de cada série se necessário.
    *   Clique em "Salvar e Fechar" para gravar no histórico.

## Instalação e Execução

Projeto construído com React e Vite.

```bash
npm install
npm run dev
```

Para rodar os testes:

```bash
npm test
```

## Tecnologias

*   React
*   Vite
*   Vitest (Testes Unitários)
*   Lucide React (Ícones)
*   Web Speech API (Text-to-Speech)
*   Web Audio API (Beeps sonoros)
*   Screen Wake Lock API (Manter tela ligada)
*   localStorage (Persistência de dados)
