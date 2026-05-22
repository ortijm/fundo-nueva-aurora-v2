import { describe, it, expect } from "vitest";

// ─── Helpers que replican la lógica del ParcelaSelector y admin filter ──────

/**
 * Determina si el ParcelaSelector debe mostrarse.
 * Se oculta cuando hay 1 o menos parcelas.
 */
function shouldShowSelector(parcelaCount: number): boolean {
  return parcelaCount > 1;
}

/**
 * Obtiene la parcela seleccionada: si el searchParams tiene un ID válido,
 * lo usa. Si no, usa la primera parcela.
 */
function getSelectedParcela(
  searchParamsParcela: string | undefined,
  parcelas: Array<{ id: string }>
): string | null {
  if (parcelas.length === 0) return null;
  if (searchParamsParcela && parcelas.some((p) => p.id === searchParamsParcela)) {
    return searchParamsParcela;
  }
  return parcelas[0].id;
}

/**
 * Filtra propietarios activos para el select de admin (todos los activos,
 * sin importar si ya tienen parcela).
 */
function filterActiveOwners(
  usuarios: Array<{ isActive: boolean; id: string; nombre: string; parcelas: Array<{ numero: string }> }>
): Array<{ id: string; label: string }> {
  return usuarios
    .filter((u) => u.isActive)
    .map((u) => {
      const parcelasStr =
        u.parcelas.length > 0
          ? ` — ${u.parcelas.map((p) => p.numero).join(", ")}`
          : "";
      return { id: u.id, label: `${u.nombre}${parcelasStr}` };
    });
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("ParcelaSelector lógica", () => {
  describe("shouldShowSelector", () => {
    it("se oculta con 0 parcelas", () => {
      expect(shouldShowSelector(0)).toBe(false);
    });

    it("se oculta con 1 parcela (comportamiento legacy)", () => {
      expect(shouldShowSelector(1)).toBe(false);
    });

    it("se muestra con 2+ parcelas", () => {
      expect(shouldShowSelector(2)).toBe(true);
      expect(shouldShowSelector(5)).toBe(true);
    });
  });

  describe("getSelectedParcela", () => {
    const parcelas = [
      { id: "p1" },
      { id: "p2" },
      { id: "p3" },
    ];

    it("usa la primera parcela si no hay searchParams", () => {
      expect(getSelectedParcela(undefined, parcelas)).toBe("p1");
    });

    it("usa searchParams si es válido", () => {
      expect(getSelectedParcela("p2", parcelas)).toBe("p2");
    });

    it("ignora searchParams inválido, usa la primera", () => {
      expect(getSelectedParcela("p999", parcelas)).toBe("p1");
    });

    it("retorna null si no hay parcelas", () => {
      expect(getSelectedParcela(undefined, [])).toBe(null);
      expect(getSelectedParcela("p1", [])).toBe(null);
    });
  });
});

describe("Admin — filterActiveOwners", () => {
  const usuarios = [
    {
      isActive: true,
      id: "u1",
      nombre: "Juan Pérez",
      parcelas: [{ numero: "A-101" }],
    },
    {
      isActive: true,
      id: "u2",
      nombre: "María González",
      parcelas: [
        { numero: "B-202" },
        { numero: "C-303" },
      ],
    },
    {
      isActive: true,
      id: "u3",
      nombre: "Pedro Soto",
      parcelas: [],
    },
    {
      isActive: false,
      id: "u4",
      nombre: "Inactivo",
      parcelas: [{ numero: "D-404" }],
    },
  ];

  it("incluye todos los activos (con o sin parcela)", () => {
    const result = filterActiveOwners(usuarios);
    expect(result).toHaveLength(3);
  });

  it("excluye inactivos", () => {
    const result = filterActiveOwners(usuarios);
    expect(result.find((u) => u.id === "u4")).toBeUndefined();
  });

  it("muestra parcelas actuales junto al nombre", () => {
    const result = filterActiveOwners(usuarios);
    expect(result.find((u) => u.id === "u1")?.label).toBe("Juan Pérez — A-101");
    expect(result.find((u) => u.id === "u2")?.label).toBe(
      "María González — B-202, C-303"
    );
    expect(result.find((u) => u.id === "u3")?.label).toBe("Pedro Soto");
  });

  it("propietario con 2 parcelas activas aparece una sola vez (no duplicado)", () => {
    const result = filterActiveOwners(usuarios);
    const maria = result.filter((u) => u.id === "u2");
    expect(maria).toHaveLength(1);
  });
});
