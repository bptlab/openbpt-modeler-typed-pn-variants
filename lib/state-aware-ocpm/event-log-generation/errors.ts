/**
 * Invalid input to the event log generation, such as a negative object limit, an unknown
 * object type or unreadable XML. The message is written to be shown to the user as is.
 */
export class EventLogInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EventLogInputError";
  }
}
