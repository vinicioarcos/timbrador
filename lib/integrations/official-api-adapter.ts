import type { PunchAdapter, PunchCommand, PunchResult } from "./punch-adapter";

export class OfficialApiAdapter implements PunchAdapter {
  async clock(_command: PunchCommand): Promise<PunchResult> {
    throw new Error(
      "Integración bloqueada: falta contrato técnico autorizado del sistema institucional. Ver T-007."
    );
  }
}
