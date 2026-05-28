UPDATE public.desbravadores
SET cargo_adicional = CASE
      WHEN cargo_adicional IS NULL OR cargo_adicional = '' THEN cargo
      ELSE cargo_adicional
    END,
    cargo = CASE WHEN genero = 'F' THEN 'Desbravadora' ELSE 'Desbravador' END,
    updated_at = NOW()
WHERE (
    cargo ILIKE '%capit%'
    OR (cargo ILIKE '%secret%' AND cargo ILIKE '%unidade%')
    OR UPPER(COALESCE(cargo, '')) IN ('CPT', 'SUN')
  );
