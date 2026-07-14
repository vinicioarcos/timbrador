import type { PunchAdapter, PunchCommand, PunchResult } from "./punch-adapter";

export class MockPunchAdapter implements PunchAdapter {
  async clock(command: PunchCommand): Promise<PunchResult> {
    return {
      ok: true,
      externalReference: `mock:${command.idempotencyKey}`,
      message: "Timbrada simulada correctamente",
    };
  }
}
