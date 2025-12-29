# Cadence Timer

Uma aplicação web para treinos de musculação com controle de cadência, projetada para auxiliar na execução precisa de repetições com tempos definidos para cada fase (excêntrica, pausa, concêntrica, pausa).

## Funcionalidades

*   **Timer de Cadência:** Controle visual e sonoro para cada fase do movimento (Excêntrica, Concêntrica, Isometria).
*   **Cronômetro Global:** Visualização do tempo total de treino durante a execução.
*   **Edição em Tempo Real:** Ajuste carga e repetições (ou tempo de isometria) durante o descanso.
*   **Suporte a Isometria:** Inputs adaptativos que registram "Tempo (s)" para exercícios isométricos e "Reps" para dinâmicos.
*   **Bi-Sets (Supersets):** Agrupe dois exercícios para execução sequencial (Ex1 -> Prep -> Ex2 -> Descanso) com log unificado.
*   **Wake Lock:** Mantém a tela do celular ligada durante o treino.
*   **Resumo de Treino Detalhado:** Tela de finalização com:
    *   **Agrupamento por Exercício:** Séries organizadas por exercício para melhor visualização, mesmo em Bi-sets.
    *   Comparativo com o treino anterior (indicadores de performance).
    *   Edição inline compacta e intuitiva.
    *   Cálculo automático de duração total.
*   **Histórico:** Registro detalhado de treinos com possibilidade de edição posterior.
*   **Importar/Exportar:** Backup e restauração de dados (treinos e histórico) via arquivo JSON.
*   **Inputs Inteligentes:** Botões de + e - para facilitar a entrada de dados.

## Como Usar

1.  **Configuração (Setup):**
    *   Crie "Treinos" (ex: Treino A, Treino B).
    *   Adicione exercícios e configure:
        *   Séries e Repetições Alvo.
        *   **Cadência:** Segundos para Desce (Excêntrica), Pausa em Baixo, Sobe (Concêntrica), Pausa em Cima.
        *   Intervalos de Descanso (Entre Séries e Entre Exercícios).
        *   Modo "Até a Falha" e "Isometria".
    *   Use os botões de **Backup** e **Restaurar** para salvar suas configurações.

2.  **Treino Ativo:**
    *   Siga as instruções visuais e sonoras.
    *   O contador de repetições começa em 1.
    *   **Timer Global:** Acompanhe a duração total do treino no canto superior direito.
    *   Ao terminar uma série, durante o descanso, use os campos de input para corrigir a carga e as repetições realizadas *naquela série*.
        *   Se o exercício for **Isométrico**, o campo de repetições mudará automaticamente para **"Tempo (s)"**.
    *   Botão "Falha/Acabei" encerra a série antecipadamente.

3.  **Finalização:**
    *   Ao completar todos os exercícios, você verá a tela de **Resumo**.
    *   Revise os dados de cada série. Ajuste se necessário.
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
