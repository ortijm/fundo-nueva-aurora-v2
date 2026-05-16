-- ============================================================
-- RLS Policies — Condominio Nueva Aurora v2
-- Ejecutar en Supabase SQL Editor
-- https://supabase.com/dashboard/project/qowowujbcutgaqyhoxjm/sql/new
-- ============================================================

-- Helper: un policy puede llamar auth.jwt() directamente.
-- Inlineamos el check de admin para evitar problemas de permisos.

-- 1. USUARIOS
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuarios_self_select" ON usuarios;
CREATE POLICY "usuarios_self_select" ON usuarios
  FOR SELECT USING (auth.uid()::text = "supabaseId");

DROP POLICY IF EXISTS "usuarios_admin_all" ON usuarios;
CREATE POLICY "usuarios_admin_all" ON usuarios
  FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'rol' = 'ADMINISTRADOR');

-- 2. PARCELAS
ALTER TABLE parcelas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parcelas_self_select" ON parcelas;
CREATE POLICY "parcelas_self_select" ON parcelas
  FOR SELECT USING (
    "propietarioId" IN (SELECT id FROM usuarios WHERE auth.uid()::text = "supabaseId")
  );

DROP POLICY IF EXISTS "parcelas_admin_all" ON parcelas;
CREATE POLICY "parcelas_admin_all" ON parcelas
  FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'rol' = 'ADMINISTRADOR');

-- 3. CONSUMOS MENSUALES
ALTER TABLE consumos_mensuales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consumos_self_select" ON consumos_mensuales;
CREATE POLICY "consumos_self_select" ON consumos_mensuales
  FOR SELECT USING (
    "parcelaId" IN (SELECT id FROM parcelas WHERE "propietarioId" IN (
      SELECT id FROM usuarios WHERE auth.uid()::text = "supabaseId"
    ))
  );

DROP POLICY IF EXISTS "consumos_admin_all" ON consumos_mensuales;
CREATE POLICY "consumos_admin_all" ON consumos_mensuales
  FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'rol' = 'ADMINISTRADOR');

-- 4. PAGOS
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pagos_self_select" ON pagos;
CREATE POLICY "pagos_self_select" ON pagos
  FOR SELECT USING (
    "parcelaId" IN (SELECT id FROM parcelas WHERE "propietarioId" IN (
      SELECT id FROM usuarios WHERE auth.uid()::text = "supabaseId"
    ))
  );

DROP POLICY IF EXISTS "pagos_admin_all" ON pagos;
CREATE POLICY "pagos_admin_all" ON pagos
  FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'rol' = 'ADMINISTRADOR');

-- 5. ESTADOS DE CUENTA
ALTER TABLE estados_cuenta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ec_self_select" ON estados_cuenta;
CREATE POLICY "ec_self_select" ON estados_cuenta
  FOR SELECT USING (
    "parcelaId" IN (SELECT id FROM parcelas WHERE "propietarioId" IN (
      SELECT id FROM usuarios WHERE auth.uid()::text = "supabaseId"
    ))
  );

DROP POLICY IF EXISTS "ec_admin_all" ON estados_cuenta;
CREATE POLICY "ec_admin_all" ON estados_cuenta
  FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'rol' = 'ADMINISTRADOR');

-- 6. NOTIFICACIONES
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_self_select" ON notificaciones;
CREATE POLICY "notif_self_select" ON notificaciones
  FOR SELECT USING (
    "destinatarioId" IN (SELECT id FROM usuarios WHERE auth.uid()::text = "supabaseId")
  );

DROP POLICY IF EXISTS "notif_admin_all" ON notificaciones;
CREATE POLICY "notif_admin_all" ON notificaciones
  FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'rol' = 'ADMINISTRADOR');

-- 7. GASTOS (admin only)
ALTER TABLE gastos_condominio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gastos_admin_all" ON gastos_condominio;
CREATE POLICY "gastos_admin_all" ON gastos_condominio
  FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'rol' = 'ADMINISTRADOR');

-- 8. PERIODOS GASTO (admin only)
ALTER TABLE periodos_gasto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "periodos_admin_all" ON periodos_gasto;
CREATE POLICY "periodos_admin_all" ON periodos_gasto
  FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'rol' = 'ADMINISTRADOR');

-- 9. FONDO CONDOMINIO (admin only)
ALTER TABLE fondo_condominio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fondo_admin_all" ON fondo_condominio;
CREATE POLICY "fondo_admin_all" ON fondo_condominio
  FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'rol' = 'ADMINISTRADOR');

-- 10. CONFIGURACION (admin only)
ALTER TABLE configuracion_sistema ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_admin_all" ON configuracion_sistema;
CREATE POLICY "config_admin_all" ON configuracion_sistema
  FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'rol' = 'ADMINISTRADOR');

-- 11. RATE LIMITS (service role only)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_limits_service_only" ON rate_limits;
CREATE POLICY "rate_limits_service_only" ON rate_limits
  USING (false);

-- 12. TIPOS CONSUMO (lectura pública, escritura admin)
ALTER TABLE tipos_consumo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tipos_consumo_select_all" ON tipos_consumo;
CREATE POLICY "tipos_consumo_select_all" ON tipos_consumo
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "tipos_consumo_admin_all" ON tipos_consumo;
CREATE POLICY "tipos_consumo_admin_all" ON tipos_consumo
  FOR ALL USING (auth.jwt() -> 'user_metadata' ->> 'rol' = 'ADMINISTRADOR');
