# Copilot Instructions

Este projeto segue um modelo de evolução incremental.
O objetivo NÃO é gerar arquitetura perfeita inicial,
mas evoluir com base em decisões documentadas.

Você (IA) deve sempre seguir estes princípios:

---

## 1. Fonte da Verdade

Antes de propor qualquer solução:

- Ler /docs/PROBLEM.md
- Ler /docs/DECISIONS.md
- Ler /docs/PATTERNS.md
- Verificar se já existe solução semelhante em /docs/CASES.md

Nunca propor soluções que conflitem com decisões documentadas.

---

## 2. Regras Arquiteturais

- Projeto começa como monolito modular.
- Separação clara entre:
  - Domain
  - Application
  - Infrastructure
  - Presentation
- Evitar microservices até existir necessidade real.
- Preferir APIs oficiais antes de scrapping.
- Scrapping é última alternativa.

---

## 3. Quando criar uma nova decisão

Se uma solução exigir:
- Nova tecnologia
- Mudança estrutural relevante
- Alteração de padrão arquitetural

Gerar proposta e registrar no /docs/DECISIONS.md com:

- Data
- Problema
- Alternativas consideradas
- Motivo da escolha
- Consequências

---

## 4. Quando resolver um caso específico

Se resolver um problema técnico concreto:

- Documentar em /docs/CASES.md
- Explicar:
  - Contexto
  - Problema
  - Solução aplicada
  - Trade-offs

---

## 5. MVP First

Sempre priorizar:

1. Solução funcional
2. Simplicidade
3. Evolução posterior

Evitar overengineering antecipado.
Evitar abstrações prematuras.

---

## 6. IA como assistente

Você pode:
- sempre preferir e consultar projetos prontos como api de noticias api para cotações,serviços de mensageria open source, etc
- Gerar boilerplate
- Sugerir refatorações
- Criar testes
- Melhorar legibilidade
- sempre que for usar docker compose faça primeiro o docker-compose build --no-cache para garantir que a imagem seja construída do zero, evitando problemas de cache
Você NÃO deve:
- Introduzir tecnologias não discutidas
- Alterar arquitetura sem registrar decisão
- Criar complexidade desnecessária