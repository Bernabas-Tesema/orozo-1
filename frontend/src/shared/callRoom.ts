/**
 * Resolve the shared LiveKit room for an interpretation session.
 *
 * Client and interpreter must join ONE media room for the same request,
 * matching Eliotel's gcall-<classId> pattern (LiveKit instead of mesh signaling).
 */
export function resolveCallRoom(session: {
  id: string;
  callRoom?: string | null;
  requestReference?: string | null;
}): string {
  const explicit = String(session.callRoom || '').trim();
  if (explicit) return sanitizeRoomId(explicit);

  const reference = String(session.requestReference || '').trim();
  if (reference) return sanitizeRoomId(`orzo-${reference}`);

  return sanitizeRoomId(`orzo-${session.id}`);
}

function sanitizeRoomId(value: string): string {
  const cleaned = value.replace(/[^\w.-]+/g, '-').replace(/-+/g, '-');
  return cleaned.replace(/^-|-$/g, '') || 'orzo-room';
}
