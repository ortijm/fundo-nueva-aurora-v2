-- ============================================================
-- RLS Policies — Condominio Nueva Aurora v2
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Helper: si el usuario autenticado es ADMINISTRADOR
CREATE OR REPLACE FUNCTION auth.is_admin() RETURNS BOOLEAN AS $$
  SELECT COALESCE(auth.jwt() -> 'user_metadata' ->> 'rol' = 'ADMINISTRADOR', false);
$$ LANGUAGE SQL STABLE;

-- 1. USUARIOS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_self_select" ON usuarios
  FOR SELECT USING (auth.uid() = "supabaseId");

CREATE POLICY "usuarios_admin_all" ON usuarios
  FOR ALL USING (auth.is_admin());

-- 2. PARCELAS
ALTER TABLE parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parcelas_self_select" ON parcelas
  FOR SELECT USING (
    propietario_id IN (SELECT id FROM usuarios WHERE "supabaseId" = auth.uid())
  );

CREATE POLICY "parcelas_admin_all" ON parcelas
  FOR ALL USING (auth.is_admin());

-- 3. CONSUMOS MENSUALES
ALTER TABLE consumos_mensuales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consumos_self_select" ON consumos_mensuales
  FOR SELECT USING (
    parcela_id IN (SELECT id FROM parcelas WHERE propietario_id IN (
      SELECT id FROM usuarios WHERE "supabaseId" = auth.uid()
    ))
  );

CREATE POLICY "consumos_admin_all" ON consumos_mensuales
  FOR ALL USING (auth.is_admin());

-- 4. PAGOS
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagos_self_select" ON pagos
  FOR SELECT USING (
    parcela_id IN (SELECT id FROM parcelas WHERE propietario_id IN (
      SELECT id FROM usuarios WHERE "supabaseId" = auth.uid()
    ))
  );

CREATE POLICY "pagos_admin_all" ON pagos
  FOR ALL USING (auth.is_admin());

-- 5. ESTADOS DE CUENTA
ALTER TABLE estados_cuenta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ec_self_select" ON estados_cuenta
  FOR SELECT USING (
    parcela_id IN (SELECT id FROM parcelas WHERE propietario_id IN (
      SELECT id FROM usuarios WHERE "supabaseId" = auth.uid()
    ))
  );

CREATE POLICY "ec_admin_all" ON estados_cuenta
  FOR ALL USING (auth.is_admin());

-- 6. NOTIFICACIONES
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_self_select" ON notificaciones
  FOR SELECT USING (
    destinatario_id IN (SELECT id FROM usuarios WHERE "supabaseId" = auth.uid())
  );

CREATE POLICY "notif_admin_all" ON notificaciones
  FOR ALL USING (auth.is_admin());

-- 7. GASTOS (admin only)
ALTER TABLE gastos_condominio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gastos_admin_all" ON gastos_condominio
  FOR ALL USING (auth.is_admin());

-- 8. PERIODOS GASTO (admin only)
ALTER TABLE periodos_gasto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "periodos_admin_all" ON periodos_gasto
  FOR ALL USING (auth.is_admin());

-- 9. FONDO CONDOMINIO (admin only)
ALTER TABLE fondo_condominio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fondo_admin_all" ON fondo_condominio
  FOR ALL USING (auth.is_admin());

-- 10. CONFIGURACION (admin only)
ALTER TABLE configuracion_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_admin_all" ON configuracion_sistema
  FOR ALL USING (auth.is_admin());

-- 11. RATE LIMITS (solo service role)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limits_service_only" ON rate_limits
  USING (false);

-- 12. TIPOS CONSUMO (lectura pública, escritura admin)
ALTER TABLE tipos_consumo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_consumo_select_all" ON tipos_consumo
  FOR SELECT USING (true);

CREATE POLICY "tipos_consumo_admin_all" ON tipos_consumo
  FOR ALL USING (auth.is_admin());
