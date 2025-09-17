# Landinfy

Um clone da ferramenta Lovable, projetado para ajudar desenvolvedores e empreendedores a criarem landing pages profissionais e otimizadas para conversão em segundos, utilizando inteligência artificial. O foco é em design moderno, SEO e experiência do usuário, resolvendo o problema comum de gastar horas ou dias criando páginas de destino do zero.

## Problemas que Resolve

- **Tempo de Desenvolvimento**: Elimina a necessidade de codificar manualmente landing pages, permitindo criação rápida com IA.
- **Falta de Expertise em Design**: Oferece layouts profissionais e responsivos sem precisar de designers especializados.
- **SEO e Conversão**: Integra melhores práticas de SEO e elementos de conversão para aumentar leads e vendas.
- **Gerenciamento de Projetos**: Facilita a edição, pré-visualização e download de projetos completos.
- **Aprendizado e Diversão**: Inclui desafios de codificação para praticar habilidades de programação.

## Funcionalidades

- **Criação de Projetos**: Gere landing pages personalizadas baseadas em prompts de usuário, com seções como herói, recursos, preços, depoimentos e formulários de contato.
- **Prévia em Tempo Real**: Visualize as páginas geradas em um iframe integrado, com hot reload para mudanças instantâneas.
- **Edição de Código**: Edite arquivos gerados diretamente no editor integrado, permitindo personalizações avançadas.
- **Download de ZIP**: Baixe o projeto completo como um arquivo ZIP para deploy em qualquer plataforma.
- **Desafios de Codificação (Vibe Coder)**: Inclui desafios estilo LeetCode para praticar algoritmos e lógica de programação enquanto aguarda geração de arquivos.
- **Formulários de Feedback**: Colete feedback dos usuários via formulários interativos, com integração via EmailJS.
- **Monitoramento e Analytics**: Pronto para integração com Google Analytics, Clarity ou outros provedores de analytics.
- **Componentes Personalizáveis**: Configure componentes como herói, recursos, preços, etc., no assistente passo a passo.
- **Autenticação Segura**: Usa Clerk para login e gerenciamento de usuários.
- **Banco de Dados**: Armazena projetos e dados com Prisma e NeonDB.

## Tecnologias Utilizadas

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS
- **UI**: Shadcn UI, Radix UI, Lucide React
- **Backend**: TRPC, Prisma, NeonDB
- **Autenticação**: Clerk
- **IA e Agentes**: Inngest para processamento assíncrono e geração de código
- **Sandbox Seguro**: E2B Sandbox para execução de código sem riscos
- **Outros**: JSZip para geração de ZIP, EmailJS para formulários

## Como Começar

### Pré-requisitos

- Node.js 18+
- npm ou bun
- Conta no NeonDB
- Conta no Clerk
- Conta no Inngest (opcional para agentes)

### Instalação

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/landinfy-clone.git
   cd landinfy-clone
   ```

2. Instale as dependências:
   ```bash
   npm install
   # ou
   bun install
   ```

3. Configure as variáveis de ambiente:
   Crie um arquivo `.env` com:
   ```
   DATABASE_URL=your-neon-db-url
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-key
   CLERK_SECRET_KEY=your-clerk-secret
   INNGEST_SIGNING_KEY=your-inngest-key
   # Outras chaves necessárias
   ```

4. Configure o banco de dados:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

5. Execute o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## Uso

1. **Criar um Projeto**: Use o formulário na página inicial para descrever a landing page desejada.
2. **Personalizar Componentes**: Configure componentes como herói, recursos, etc., no assistente passo a passo.
3. **Pré-visualizar**: Veja a prévia da página gerada.
4. **Editar**: Faça edições no código via o editor integrado.
5. **Baixar**: Exporte o projeto como ZIP para deploy.

## Estrutura do Projeto

- `src/app`: Páginas Next.js
- `src/components`: Componentes reutilizáveis
- `src/modules`: Módulos específicos (projetos, mensagens, etc.)
- `src/inngest`: Funções de agentes IA
- `src/trpc`: Rotas TRPC
- `prisma`: Esquema do banco de dados
- `sandbox-templates`: Templates para sandbox E2B

## Contribuição

1. Fork o projeto.
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`).
3. Commit suas mudanças (`git commit -am 'Adiciona nova feature'`).
4. Push para a branch (`git push origin feature/nova-feature`).
5. Abra um Pull Request.

## Licença

Este projeto é licenciado sob a MIT License. Veja o arquivo LICENSE para detalhes.