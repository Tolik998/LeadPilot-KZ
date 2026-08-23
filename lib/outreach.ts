export function selectOutreachTemplate(
  status: string,
  firstMessage: string,
  followUpMessage: string,
) {
  return status === "new" ? firstMessage : followUpMessage;
}
