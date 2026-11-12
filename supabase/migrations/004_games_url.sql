-- Link para a lista de jogos de cada modelo (páginas criadas noutra app).
alter table models add column if not exists games_url text;
notify pgrst, 'reload schema';
