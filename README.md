# Console Manager (Star Tech)

PWA para gerir o stock de consolas portáteis. Next.js (exportação estática) + Supabase.

- `supabase/migrations/` esquema da base de dados; `supabase/seed.sql` modelos, versões e cores (gerado do Excel por `scripts/make_seed.py`).
- `app/` ecrãs: login, lista de modelos com stock, detalhe por cor (entrada / Vendido).
- Variáveis: copiar `.env.example` para `.env.local` e preencher a chave pública (anon/publishable). Nunca usar a `service_role`.
- Cloudflare Pages: build `npm run build`, diretório de saída `out`.
