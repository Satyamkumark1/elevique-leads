/** A failure that will never succeed on retry (e.g. invalid recipient, 4xx) → job goes `dead` at once. */
export class PermanentJobError extends Error {
  name = "PermanentJobError";
}
