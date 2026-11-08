/**
 * Invalid input to the OPID discovery, such as unreadable XML, a log that is not
 * state-aware, or two events at the same time. The message is written to be shown to the
 * user as is.
 */
export class DiscoveryInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscoveryInputError";
  }
}
