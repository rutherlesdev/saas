export function extractJsonPayload<T>(output: string): T {
  for (let index = 0; index < output.length; index += 1) {
    const startChar = output[index];
    if (startChar !== "{" && startChar !== "[") {
      continue;
    }

    const endChar = startChar === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let cursor = index; cursor < output.length; cursor += 1) {
      const current = output[cursor];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (current === "\\") {
          escaped = true;
          continue;
        }

        if (current === '"') {
          inString = false;
        }
        continue;
      }

      if (current === '"') {
        inString = true;
        continue;
      }

      if (current === startChar) {
        depth += 1;
      } else if (current === endChar) {
        depth -= 1;

        if (depth === 0) {
          const candidate = output.slice(index, cursor + 1);
          try {
            return JSON.parse(candidate) as T;
          } catch {
            break;
          }
        }
      }
    }
  }

  throw new Error("OpenClaw CLI did not return valid JSON output");
}
