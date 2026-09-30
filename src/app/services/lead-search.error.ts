/** Error carrying a translation key so the UI can show a localised message. */
export class LeadSearchError extends Error {
  constructor(
    readonly translationKey: string,
    cause?: unknown,
  ) {
    super(translationKey, { cause });
  }
}
