/** Normalize lookalikes while retaining UTF-16 offsets into the original document. */
export function normalizeForDetection(original: string) {
  let text = '';
  const starts: number[] = [], ends: number[] = [];
  let offset = 0;
  for (const character of original) {
    const end = offset + character.length;
    // Zero-width and bidi formatting can split an otherwise valid identifier.
    const normalized = /^[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]$/.test(character) ? '' : character.normalize('NFKC');
    text += normalized;
    for (let j = 0; j < normalized.length; j++) { starts.push(offset); ends.push(end); }
    offset = end;
  }
  return { text, starts, ends };
}
