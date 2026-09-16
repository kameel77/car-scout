export function generateReference(prefix: string = 'AF'): string {
  const timestamp = Date.now().toString();
  return `${prefix}-${timestamp.slice(-8)}`;
}
