export type PunchCommand = {
  userId: string;
  scheduleItemId: string;
  kind: "ENTRY" | "EXIT";
  idempotencyKey: string;
};

export type PunchResult = {
  ok: boolean;
  externalReference?: string;
  message: string;
};

export interface PunchAdapter {
  clock(command: PunchCommand): Promise<PunchResult>;
}
