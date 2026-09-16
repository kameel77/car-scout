export function generateReference(): string {
  const timestamp = Date.now().toString();
  return `AF-${timestamp.slice(-8)}`;
}
