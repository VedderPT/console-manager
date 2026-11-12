-- Imagem por defeito para o catálogo WhatsApp (páginas do catálogo Canva). As fotos reais ficam em image_path.
alter table models add column if not exists catalog_image_path text;
