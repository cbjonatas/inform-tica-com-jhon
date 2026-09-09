# Informática com Jhon

Crie uma aplicação web completa chamada:

INFORMÁTICA COM JHON PARA CONCURSOS

É uma plataforma de ensino exclusiva para o meu curso de Informática para Concursos.

NÃO quero uma plataforma genérica de cursos. Toda a experiência deve ser pensada para alunos que estudam INFORMÁTICA para concursos públicos.

A plataforma deverá possuir área do ALUNO, área ADMINISTRATIVA/PROFESSOR e recursos de INTELIGÊNCIA ARTIFICIAL.

1. TECNOLOGIA E ARQUITETURA

Utilize uma arquitetura moderna, organizada e escalável.

Priorize:

React

TypeScript

Tailwind CSS

Componentes reutilizáveis

Supabase para autenticação, banco de dados e storage, caso seja a melhor opção disponível no projeto

Row Level Security (RLS)

Estrutura preparada para integração com APIs de IA

Não coloque chaves secretas ou API Keys diretamente no frontend.

Utilize Edge Functions/server-side para operações que exigem credenciais privadas.

O projeto deve ser responsivo e funcionar perfeitamente em:

Desktop

Notebook

Tablet

Smartphone

2. IDENTIDADE DA PLATAFORMA

Nome:

INFORMÁTICA COM JHON PARA CONCURSOS

Criar uma identidade visual:

Moderna

Profissional

Tecnológica

Educacional

Voltada para concursos públicos

Evitar aparência infantil ou excessivamente genérica.

Criar uma interface limpa, com excelente hierarquia visual.

Utilizar cards, indicadores de progresso, menus laterais e componentes modernos.

3. AUTENTICAÇÃO

Criar sistema de autenticação utilizando Supabase Auth.

Páginas:

/login
/cadastro
/recuperar-senha
/dashboard

Cadastro do aluno:

Nome completo

E-mail

WhatsApp

Senha

Criar controle de permissões:

ROLE = ADMIN
ROLE = STUDENT

O aluno nunca poderá acessar páginas administrativas.

4. ESTRUTURA DO CURSO

A estrutura deverá ser:

CURSO
→ MÓDULOS
→ AULAS
→ CONTEÚDOS

Exemplo:

INFORMÁTICA COM JHON PARA CONCURSOS

MÓDULO 01 — HARDWARE E SOFTWARE

Aula 01 — Conceitos de Hardware
Aula 02 — Processadores
Aula 03 — Memória
Aula 04 — Armazenamento

MÓDULO 02 — SISTEMAS OPERACIONAIS

Aula 01 — Windows
Aula 02 — Linux

MÓDULO 03 — REDES

Aula 01 — Conceitos de Redes
Aula 02 — Topologias
Aula 03 — Protocolos
Aula 04 — TCP/IP

O administrador deverá conseguir criar, editar, excluir e reordenar módulos e aulas sem alterar o código.

5. DASHBOARD DO ALUNO

Após login, o aluno deverá acessar:

/dashboard

Mostrar:

"Olá, [nome do aluno]!"

"Continue sua preparação."

Exibir:

Progresso geral do curso

Última aula assistida

Continuar estudando

Módulos

Questões respondidas

Percentual de acertos

Questões erradas

Materiais recentes

Acesso à IA

Criar um botão de destaque:

CONTINUAR ESTUDANDO

Esse botão deve levar o aluno diretamente para a última aula acessada.

6. PÁGINA DE MÓDULO

Criar:

/curso/modulo/

Mostrar:

Nome do módulo

Descrição

Percentual de conclusão

Lista de aulas

Status de cada aula

Cada aula deve mostrar:

✓ Concluída

ou

○ Não concluída

Ao clicar, abrir a aula.

7. PÁGINA DA AULA

Criar:

/curso/aula/

Layout:

TOPO:

Nome do módulo

Nome da aula

Progresso

CENTRO:

Player de vídeo

ABAIXO DO VÍDEO:

[ DESCRIÇÃO ]
[ TRANSCRIÇÃO ]
[ PDF ]
[ QUESTÕES ]
[ IA ]

O aluno deverá conseguir:

Play/Pause

Alterar velocidade

Tela cheia

Volume

Avançar

Retroceder

Continuar de onde parou

Salvar automaticamente o progresso do vídeo.

Quando o aluno chegar ao final da aula, permitir marcar como concluída.

8. UPLOAD DE VIDEOAULA

No painel administrativo, criar:

/admin/aulas/nova

Campos:

Título
Módulo
Descrição
Vídeo
PDF
Materiais complementares

O vídeo deverá ser armazenado no Storage.

Criar estrutura preparada para vídeos grandes.

Não carregar o vídeo inteiro diretamente no banco de dados.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2c3d0b60-b5f2-4620-a118-35cec41a94bd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
