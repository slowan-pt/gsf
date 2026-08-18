-- Subdivisão dentro da categoria do catálogo de especialidades.
-- Ex.: categoria "Ciência e Tecnologia" -> subcategoria "Informática", "Elétrica", "Biologia".
alter table especialidades_modelo
  add column if not exists subcategoria text;
