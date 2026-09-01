export type MutationIdentityPart = string | number | boolean | null;

type MutationAttempt = {
  identity: string;
  mutationId: string;
};

export class MutationAttemptRegistry {
  private readonly attempts = new Map<string, MutationAttempt>();
  private readonly createId: () => string;

  constructor(createId = () => crypto.randomUUID()) {
    this.createId = createId;
  }

  idFor(operation: string, identityParts: readonly MutationIdentityPart[]) {
    const identity = JSON.stringify(identityParts);
    const current = this.attempts.get(operation);
    if (current?.identity === identity) return current.mutationId;

    const mutationId = this.createId();
    this.attempts.set(operation, { identity, mutationId });
    return mutationId;
  }

  clear(operation: string, mutationId: string) {
    if (this.attempts.get(operation)?.mutationId === mutationId) {
      this.attempts.delete(operation);
    }
  }

  clearAll() {
    this.attempts.clear();
  }
}
