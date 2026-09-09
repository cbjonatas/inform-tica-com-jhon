-- Inserção de questões reais de concursos para enriquecer o banco de dados
INSERT INTO public.questions (module_id, statement, options, correct_index, explanation, banca, ano) VALUES
(
  '11111111-1111-1111-1111-111111111101',
  'A memória cache de um computador tem por finalidade principal:',
  '["Aumentar a capacidade de armazenamento permanente de arquivos e programas.", "Reduzir o tempo de acesso aos dados mais frequentemente utilizados pela CPU.", "Substituir a memória RAM para que o computador gaste menos energia.", "Executar o diagnóstico de integridade física dos discos rígidos durante o boot.", "Armazenar o código básico de inicialização da placa-mãe (BIOS/UEFI)."]'::jsonb,
  1,
  'A memória cache é uma memória de alta velocidade (SRAM) localizada próxima ou dentro do processador. Sua função é armazenar temporariamente os dados e instruções mais requisitados pela CPU, diminuindo a latência de acesso em comparação à memória principal (DRAM).',
  'FGV',
  2024
),
(
  '11111111-1111-1111-1111-111111111101',
  'Em relação às memórias voláteis e não voláteis, assinale a opção correta:',
  '["A memória RAM é não volátil, mantendo seus dados após o desligamento do equipamento.", "A memória ROM e a memória Flash são exemplos de memórias não voláteis.", "A memória Cache é do tipo não volátil, preservando o estado do pipeline do processador.", "Os registradores do processador são memórias secundárias e não voláteis.", "O SSD é classificado como memória primária e volátil."] '::jsonb,
  1,
  'Memórias não voláteis são aquelas que retêm seus dados mesmo na ausência de energia elétrica. Memórias ROM e memórias Flash (usadas em pendrives e SSDs) são clássicos exemplos de memórias não voláteis.',
  'Cebraspe',
  2023
),
(
  '11111111-1111-1111-1111-111111111102',
  'No sistema operacional Linux, qual comando é utilizado para alterar as permissões de acesso de um arquivo ou diretório?',
  '["chown", "chmod", "ps -ef", "mkdir", "mv"]'::jsonb,
  1,
  'O comando chmod (change mode) altera as permissões de leitura (r), escrita (w) e execução (x) de arquivos e pastas no Linux. O comando chown, por sua vez, altera o dono/grupo (change owner).',
  'FCC',
  2024
),
(
  '11111111-1111-1111-1111-111111111102',
  'No Windows 11, o atalho de teclado padrão utilizado para abrir rapidamente o Explorador de Arquivos é:',
  '["Windows + D", "Windows + E", "Windows + L", "Windows + R", "Windows + I"]'::jsonb,
  1,
  'O atalho Windows + E abre o Explorador de Arquivos (Explorer). Windows + D mostra a área de trabalho, Windows + L bloqueia a estação de trabalho, Windows + R abre o Executar e Windows + I abre as Configurações.',
  'Vunesp',
  2023
),
(
  '11111111-1111-1111-1111-111111111103',
  'Qual protocolo da camada de aplicação do modelo TCP/IP é responsável por converter nomes de domínio amigáveis (como www.exemplo.com.br) em endereços IP numéricos?',
  '["DHCP", "DNS", "FTP", "SMTP", "SNMP"]'::jsonb,
  1,
  'O DNS (Domain Name System) atua como a agenda da internet, resolvendo nomes legíveis por humanos em endereços IP para que os pacotes possam ser roteados até os servidores de destino.',
  'Cebraspe',
  2024
),
(
  '11111111-1111-1111-1111-111111111103',
  'Na arquitetura de redes TCP/IP, qual protocolo de transporte é orientado a conexão e garante a entrega ordenada e confiável dos pacotes de dados?',
  '["UDP", "IP", "TCP", "ICMP", "ARP"]'::jsonb,
  2,
  'O TCP (Transmission Control Protocol) é orientado a conexão (realiza o handshake em três vias), fornece controle de fluxo, retransmissão de pacotes perdidos e garantia de entrega em ordem. Já o UDP não é orientado a conexão e não garante entrega.',
  'FGV',
  2024
);
