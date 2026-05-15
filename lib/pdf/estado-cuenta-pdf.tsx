import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// ─── Tipos ────────────────────────────────────────────────────────────────

export interface ConsumoItem {
  tipoNombre: string;
  periodo: Date;
  lecturaAnterior: number;
  lecturaActual: number;
  consumoCalculado: number;
  totalAPagar: number;
  esVariable: boolean;
}

export interface EstadoCuentaData {
  id: string;
  parcelaNumero: string;
  parcelaNombre: string | null;
  parcelaSector: string | null;
  propietarioNombre: string;
  periodoLabel: string;
  fechaEmision: Date | null;
  subtotalAgua: number;
  subtotalLuz: number;
  subtotalGc: number;
  deudaAnterior: number;
  total: number;
  consumos: ConsumoItem[];
  // Config
  nombreCondominio: string;
  direccion: string;
  telefono: string;
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
  nombreTitular: string;
  rutTitular: string;
  emailPagos: string;
  mensajePieEc: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function clp(n: number): string {
  return `$${Math.round(n).toLocaleString("es-CL")}`;
}

function fmtFecha(d: Date | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtPeriodoCorto(d: Date): string {
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const dt = new Date(d);
  return `${meses[dt.getMonth()]} ${dt.getFullYear()}`;
}

// Agrupa consumos por tipo
function agruparPorTipo(consumos: ConsumoItem[]): Map<string, ConsumoItem[]> {
  const map = new Map<string, ConsumoItem[]>();
  for (const c of consumos) {
    if (!map.has(c.tipoNombre)) map.set(c.tipoNombre, []);
    map.get(c.tipoNombre)!.push(c);
  }
  return map;
}

function subtotalPorTipo(nombre: string, data: EstadoCuentaData): number {
  const n = nombre.toLowerCase();
  if (n.includes("agua")) return data.subtotalAgua;
  if (n.includes("luz")) return data.subtotalLuz;
  return data.subtotalGc;
}

// ─── Estilos ──────────────────────────────────────────────────────────────

const C = {
  darkBlue: "#1a365d",
  blue2: "#17335a",
  lightGray: "#f7fafc",
  borderGray: "#e2e8f0",
  textGray: "#4a5568",
  red: "#c53030",
  redLight: "#fff5f5",
  white: "#ffffff",
  black: "#1a202c",
  totalBg: "#edf2f7",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: C.black,
    paddingBottom: 32,
  },

  // ─── Header ───
  header: {
    backgroundColor: C.darkBlue,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: { flexDirection: "column" },
  headerTitle: { color: C.white, fontSize: 16, fontFamily: "Helvetica-Bold" },
  headerSubtitle: { color: "#b0c4de", fontSize: 8, marginTop: 2 },
  headerRight: { color: C.white, fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "right" },

  // ─── Título del documento ───
  titleRow: {
    paddingHorizontal: 20,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  docTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.black },
  docDate: { fontSize: 9, color: C.textGray },

  divider: {
    marginHorizontal: 20,
    marginTop: 6,
    borderBottomWidth: 2,
    borderBottomColor: C.darkBlue,
  },

  // ─── Parcela info ───
  parcelaBox: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: C.lightGray,
    borderRadius: 4,
    padding: 8,
    flexDirection: "row",
    gap: 16,
  },
  parcelaItem: { flexDirection: "column" },
  parcelaLabel: { fontSize: 7, color: C.textGray, marginBottom: 1 },
  parcelaValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },

  // ─── Section header ───
  sectionHeader: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: C.darkBlue,
    padding: 5,
    borderRadius: 3,
  },
  sectionHeaderRed: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: C.red,
    padding: 5,
    borderRadius: 3,
  },
  sectionHeaderText: { color: C.white, fontSize: 8, fontFamily: "Helvetica-Bold" },

  // ─── Tipo heading ───
  tipoHeading: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 3,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: C.black,
  },

  // ─── Tabla consumos ───
  table: { marginHorizontal: 20 },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: C.lightGray,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableHeaderCell: { fontSize: 7, color: C.textGray, fontFamily: "Helvetica-Bold" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: C.borderGray,
  },
  tableCell: { fontSize: 8, color: C.black },
  tableCellRight: { fontSize: 8, color: C.black, textAlign: "right" },

  // Columnas consumo variable: Período, Lec.Ant, Lec.Act, Consumo, Total
  col0: { width: "18%" },
  col1: { width: "20%" },
  col2: { width: "20%" },
  col3: { width: "18%" },
  col4: { width: "24%", textAlign: "right" },

  // Columnas consumo fijo (GC): Período, Concepto, Total
  fCol0: { width: "20%" },
  fCol1: { width: "60%" },
  fCol2: { width: "20%", textAlign: "right" },

  subtotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginTop: 1,
  },
  subtotalLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", marginRight: 8 },
  subtotalValue: { fontSize: 8, fontFamily: "Helvetica-Bold", width: "24%", textAlign: "right" },

  dividerThin: {
    marginHorizontal: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: C.borderGray,
  },

  // ─── Deuda anterior ───
  deudaTableHeaderRow: {
    flexDirection: "row",
    backgroundColor: C.redLight,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  deudaRow: {
    flexDirection: "row",
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  deudaLabel: { fontSize: 7, color: C.textGray, fontFamily: "Helvetica-Bold" },
  deudaValue: { fontSize: 8, color: C.red, textAlign: "right" },
  deudaSubtotalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  deudaSubtotalLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.red, marginRight: 8 },
  deudaSubtotalValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.red, width: "24%", textAlign: "right" },

  // ─── Resumen ───
  resumenBlock: {
    marginHorizontal: 20,
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  resumenBox: {
    backgroundColor: C.lightGray,
    borderRadius: 4,
    padding: 10,
    width: 200,
  },
  resumenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  resumenLabel: { fontSize: 9, color: C.textGray },
  resumenValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1.5,
    borderTopColor: C.darkBlue,
  },
  totalLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.darkBlue },
  totalValue: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.darkBlue },

  // ─── Datos de pago ───
  pagoBlock: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: "#eef3fa",
    borderRadius: 4,
    padding: 10,
  },
  pagoTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.darkBlue, marginBottom: 6 },
  pagoRow: { flexDirection: "row", marginBottom: 3 },
  pagoLabel: { fontSize: 8, color: C.textGray, width: 90 },
  pagoValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.black },

  // ─── Pie ───
  footer: {
    marginHorizontal: 20,
    marginTop: 14,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: C.borderGray,
  },
  footerMsg: { fontSize: 8, color: C.textGray, marginBottom: 4 },
  footerInfo: { fontSize: 7, color: "#8a9299" },
});

// ─── Componente PDF ────────────────────────────────────────────────────────

export function EstadoCuentaPDF({ data }: { data: EstadoCuentaData }) {
  const consumosPorTipo = agruparPorTipo(data.consumos);
  const totalPeriodo = data.subtotalAgua + data.subtotalLuz + data.subtotalGc;

  return (
    <Document title={`Estado de Cuenta ${data.parcelaNumero} ${data.periodoLabel}`}>
      <Page size="A4" style={s.page}>
        {/* ── HEADER ── */}
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.headerTitle}>{data.nombreCondominio.toUpperCase()}</Text>
            <Text style={s.headerSubtitle}>
              {[data.direccion, data.telefono].filter(Boolean).join("  ·  ")}
            </Text>
          </View>
          <Text style={s.headerRight}>{data.propietarioNombre}</Text>
        </View>

        {/* ── TÍTULO ── */}
        <View style={s.titleRow}>
          <Text style={s.docTitle}>
            ESTADO DE CUENTA — {data.periodoLabel.toUpperCase()}
          </Text>
          {data.fechaEmision && (
            <Text style={s.docDate}>Fecha emisión: {fmtFecha(data.fechaEmision)}</Text>
          )}
        </View>
        <View style={s.divider} />

        {/* ── PARCELA INFO ── */}
        <View style={s.parcelaBox}>
          <View style={s.parcelaItem}>
            <Text style={s.parcelaLabel}>PARCELA</Text>
            <Text style={s.parcelaValue}>
              {data.parcelaNumero}{data.parcelaNombre ? ` — ${data.parcelaNombre}` : ""}
            </Text>
          </View>
          <View style={s.parcelaItem}>
            <Text style={s.parcelaLabel}>PROPIETARIO</Text>
            <Text style={s.parcelaValue}>{data.propietarioNombre}</Text>
          </View>
          {data.parcelaSector && (
            <View style={s.parcelaItem}>
              <Text style={s.parcelaLabel}>SECTOR</Text>
              <Text style={s.parcelaValue}>{data.parcelaSector}</Text>
            </View>
          )}
        </View>

        {/* ── DETALLE CONSUMOS ── */}
        {data.consumos.length > 0 && (
          <>
            <View style={s.sectionHeader}>
              <Text style={s.sectionHeaderText}>DETALLE DE CONSUMOS</Text>
            </View>

            {Array.from(consumosPorTipo.entries()).map(([tipoNombre, items]) => {
              const esVariable = items[0].esVariable;
              const subtotal = subtotalPorTipo(tipoNombre, data);

              return (
                <View key={tipoNombre}>
                  <Text style={s.tipoHeading}>{tipoNombre.toUpperCase()}</Text>

                  {/* Encabezado tabla */}
                  <View style={s.table}>
                    <View style={s.tableHeaderRow}>
                      {esVariable ? (
                        <>
                          <Text style={[s.tableHeaderCell, s.col0]}>Período</Text>
                          <Text style={[s.tableHeaderCell, s.col1]}>Lec. Anterior</Text>
                          <Text style={[s.tableHeaderCell, s.col2]}>Lec. Actual</Text>
                          <Text style={[s.tableHeaderCell, s.col3]}>Consumo</Text>
                          <Text style={[s.tableHeaderCell, s.col4]}>Total</Text>
                        </>
                      ) : (
                        <>
                          <Text style={[s.tableHeaderCell, s.fCol0]}>Período</Text>
                          <Text style={[s.tableHeaderCell, s.fCol1]}>Concepto</Text>
                          <Text style={[s.tableHeaderCell, s.fCol2]}>Total</Text>
                        </>
                      )}
                    </View>

                    {/* Filas */}
                    {items.map((item, idx) => (
                      <View key={idx} style={s.tableRow}>
                        {esVariable ? (
                          <>
                            <Text style={[s.tableCell, s.col0]}>{fmtPeriodoCorto(item.periodo)}</Text>
                            <Text style={[s.tableCell, s.col1]}>{item.lecturaAnterior.toFixed(2)}</Text>
                            <Text style={[s.tableCell, s.col2]}>{item.lecturaActual.toFixed(2)}</Text>
                            <Text style={[s.tableCell, s.col3]}>{item.consumoCalculado.toFixed(2)}</Text>
                            <Text style={[s.tableCellRight, s.col4]}>{clp(item.totalAPagar)}</Text>
                          </>
                        ) : (
                          <>
                            <Text style={[s.tableCell, s.fCol0]}>{fmtPeriodoCorto(item.periodo)}</Text>
                            <Text style={[s.tableCell, s.fCol1]}>{tipoNombre}</Text>
                            <Text style={[s.tableCellRight, s.fCol2]}>{clp(item.totalAPagar)}</Text>
                          </>
                        )}
                      </View>
                    ))}

                    {/* Subtotal */}
                    <View style={s.subtotalRow}>
                      <Text style={s.subtotalLabel}>Subtotal {tipoNombre}:</Text>
                      <Text style={s.subtotalValue}>{clp(subtotal)}</Text>
                    </View>
                  </View>
                  <View style={s.dividerThin} />
                </View>
              );
            })}
          </>
        )}

        {/* ── DEUDA ANTERIOR ── */}
        {data.deudaAnterior > 0 && (
          <>
            <View style={s.sectionHeaderRed}>
              <Text style={s.sectionHeaderText}>DEUDA DE PERÍODOS ANTERIORES</Text>
            </View>
            <View style={s.table}>
              <View style={s.deudaTableHeaderRow}>
                <Text style={[s.deudaLabel, { width: "30%" }]}>Concepto</Text>
                <Text style={[s.deudaLabel, { width: "70%", textAlign: "right" }]}>Monto</Text>
              </View>
              <View style={s.deudaRow}>
                <Text style={[s.tableCell, { width: "30%" }]}>Deuda registrada al momento de emisión</Text>
                <Text style={[s.deudaValue, { width: "70%" }]}>{clp(data.deudaAnterior)}</Text>
              </View>
              <View style={s.deudaSubtotalRow}>
                <Text style={s.deudaSubtotalLabel}>Total Deuda Anterior:</Text>
                <Text style={s.deudaSubtotalValue}>{clp(data.deudaAnterior)}</Text>
              </View>
            </View>
            <View style={s.dividerThin} />
          </>
        )}

        {/* ── RESUMEN ── */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionHeaderText}>RESUMEN</Text>
        </View>
        <View style={s.resumenBlock}>
          <View style={s.resumenBox}>
            {data.subtotalAgua > 0 && (
              <View style={s.resumenRow}>
                <Text style={s.resumenLabel}>Agua</Text>
                <Text style={s.resumenValue}>{clp(data.subtotalAgua)}</Text>
              </View>
            )}
            {data.subtotalLuz > 0 && (
              <View style={s.resumenRow}>
                <Text style={s.resumenLabel}>Luz</Text>
                <Text style={s.resumenValue}>{clp(data.subtotalLuz)}</Text>
              </View>
            )}
            {data.subtotalGc > 0 && (
              <View style={s.resumenRow}>
                <Text style={s.resumenLabel}>Gasto Común</Text>
                <Text style={s.resumenValue}>{clp(data.subtotalGc)}</Text>
              </View>
            )}
            {data.deudaAnterior > 0 && (
              <View style={s.resumenRow}>
                <Text style={[s.resumenLabel, { color: C.red }]}>Deuda Anterior</Text>
                <Text style={[s.resumenValue, { color: C.red }]}>{clp(data.deudaAnterior)}</Text>
              </View>
            )}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>TOTAL A PAGAR</Text>
              <Text style={s.totalValue}>{clp(data.total)}</Text>
            </View>
          </View>
        </View>

        {/* ── DATOS DE PAGO ── */}
        {data.banco && (
          <View style={s.pagoBlock}>
            <Text style={s.pagoTitle}>DATOS DE PAGO</Text>
            <View style={s.pagoRow}>
              <Text style={s.pagoLabel}>Banco:</Text>
              <Text style={s.pagoValue}>{data.banco}</Text>
            </View>
            <View style={s.pagoRow}>
              <Text style={s.pagoLabel}>Tipo de cuenta:</Text>
              <Text style={s.pagoValue}>{data.tipoCuenta}</Text>
            </View>
            <View style={s.pagoRow}>
              <Text style={s.pagoLabel}>Número:</Text>
              <Text style={s.pagoValue}>{data.numeroCuenta}</Text>
            </View>
            <View style={s.pagoRow}>
              <Text style={s.pagoLabel}>Titular:</Text>
              <Text style={s.pagoValue}>{data.nombreTitular}</Text>
            </View>
            <View style={s.pagoRow}>
              <Text style={s.pagoLabel}>RUT:</Text>
              <Text style={s.pagoValue}>{data.rutTitular}</Text>
            </View>
            {data.emailPagos && (
              <View style={s.pagoRow}>
                <Text style={s.pagoLabel}>Email comprobante:</Text>
                <Text style={s.pagoValue}>{data.emailPagos}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── PIE ── */}
        <View style={s.footer}>
          {data.mensajePieEc && <Text style={s.footerMsg}>{data.mensajePieEc}</Text>}
          <Text style={s.footerInfo}>
            {data.nombreCondominio}  ·  {data.direccion}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
