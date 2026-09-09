-- Dados Demonstrativos Ricos (Item 36): Módulos, Aulas, Materiais, Transcrições e Questões

-- 1. Atualizar aulas existentes com transcrições ricas e timestamps estruturados
UPDATE public.lessons
SET 
  transcription_status = 'completed',
  description = 'Conceitos de CPU, clock, núcleos, cache L1/L2/L3 e barramentos com foco em questões de provas.',
  transcript_timestamps = '[
    {"time": 0, "label": "00:00 — Introdução aos Processadores", "text": "Nesta aula vamos estudar a Unidade Central de Processamento (CPU) e seus componentes fundamentais."},
    {"time": 120, "label": "02:00 — Clock, Núcleos e Threads", "text": "Entenda a diferença entre frequência de clock (GHz), múltiplos núcleos físicos e processamento paralelo."},
    {"time": 280, "label": "04:40 — Hierarquia de Memória Cache", "text": "A memória cache SRAM é dividida em níveis L1, L2 e L3, operando em altíssima velocidade."},
    {"time": 450, "label": "07:30 — Pegadinhas Clássicas da FGV", "text": "Atenção: clock elevado não é o único parâmetro de desempenho. A arquitetura interna e cache são determinantes."},
    {"time": 600, "label": "10:00 — Resumo e Exercícios", "text": "Revisão dos pontos principais e resolução das questões do simulado."}
  ]'::jsonb
WHERE id = '11111111-1111-1111-1111-111111111101' OR position = 2;

-- 2. Inserir Materiais em PDF demonstrativos nas aulas
INSERT INTO public.materials (lesson_id, title, file_url)
VALUES
(
  (SELECT id FROM public.lessons WHERE title ILIKE '%Hardware%' LIMIT 1),
  'Apostila Completa — Hardware para Concursos.pdf',
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
),
(
  (SELECT id FROM public.lessons WHERE title ILIKE '%Windows%' LIMIT 1),
  'Guia Rápido de Atalhos — Windows 11 para Concursos.pdf',
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
),
(
  (SELECT id FROM public.lessons WHERE title ILIKE '%Linux%' LIMIT 1),
  'Tabela de Comandos Essenciais — Linux (chmod, chown, grep).pdf',
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
),
(
  (SELECT id FROM public.lessons WHERE title ILIKE '%Redes%' LIMIT 1),
  'Resumo Esquematizado — Modelo OSI e Pilha TCP/IP.pdf',
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
)
ON CONFLICT DO NOTHING;

-- 3. Inserir mais questões de alto nível das principais bancas
INSERT INTO public.questions (module_id, statement, options, correct_index, explanation, banca, ano, difficulty, subject)
VALUES
(
  '11111111-1111-1111-1111-111111111101',
  'No que diz respeito à arquitetura de computadores e à memória RAM, assinale a opção correta:',
  '["A memória RAM retém os dados gravados mesmo quando a alimentação elétrica do microcomputador é interrompida.", "A memória RAM é classificada como memória secundária de massa, destinada ao arquivamento de longo prazo.", "A tecnologia DDR (Double Data Rate) realiza duas transferências de dados por ciclo de clock.", "A memória Cache opera em velocidades inferiores à memória RAM principal por razões de economia de energia.", "A memória virtual é um circuito integrado especial soldado à placa-mãe ao lado do soquete da CPU."]'::jsonb,
  2,
  'Gabarito: C. A tecnologia DDR permite transmitir dados tanto na subida quanto na descida do sinal de clock (duas transferências por ciclo). A RAM é primária e volátil, a Cache é mais rápida que a RAM e a memória virtual é uma extensão em disco gerenciada pelo SO.',
  'Cebraspe',
  2024,
  'medio',
  'Hardware e Software'
),
(
  '11111111-1111-1111-1111-111111111102',
  'No sistema operacional Linux, para conceder permissão total de leitura, escrita e execução apenas para o proprietário do arquivo, e nenhuma permissão para o grupo e outros usuários, deve-se aplicar o comando:',
  '["chmod 777 arquivo", "chmod 700 arquivo", "chmod 644 arquivo", "chmod 755 arquivo", "chown 700 arquivo"]'::jsonb,
  1,
  'Gabarito: B. O valor octal 700 significa: Proprietário = 7 (4+2+1: leitura, escrita e execução); Grupo = 0 (nenhuma); Outros = 0 (nenhuma). O comando chown altera o dono, não as permissões.',
  'FGV',
  2024,
  'facil',
  'Sistemas Operacionais'
),
(
  '11111111-1111-1111-1111-111111111103',
  'Em relação aos protocolos da camada de transporte da pilha TCP/IP, é correto afirmar:',
  '["O UDP é um protocolo orientado a conexão que realiza controle de congestionamento de rede.", "O TCP utiliza o mecanismo de Three-Way Handshake (SYN, SYN-ACK, ACK) para estabelecimento de sessão confiável.", "O protocolo IP é o principal representante da camada de transporte, garantindo o sequenciamento dos pacotes.", "Tanto o TCP quanto o UDP operam exclusivamente sem confirmação de entrega para maximizar a taxa de transferência.", "A porta de destino é um campo que não existe no cabeçalho dos segmentos TCP."]'::jsonb,
  1,
  'Gabarito: B. O TCP estabelece conexões confiáveis por meio do aperto de mão em três vias (Three-Way Handshake). O IP opera na camada de rede (internet), e o UDP não é orientado a conexão.',
  'FCC',
  2024,
  'medio',
  'Redes'
);
