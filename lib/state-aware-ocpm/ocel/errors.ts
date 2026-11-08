/**
 * OCEL XML or a state-aware attribute value that cannot be read. The message is written to
 * be shown to the user as is.
 */
export class OcelFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcelFormatError";
  }
}
