/**
 * Privacy utilities for masking sensitive information
 */

/**
 * Masks an email address while keeping the domain visible.
 * Example: aaaaaa@gmail.com -> ******@gmail.com
 */
/**
 * Masks an email address while keeping the domain visible.
 * Handles both standalone emails and emails strings with suffixes like " (project-id)".
 * Example: aaaaaa@gmail.com -> ******@gmail.com
 * Example: aaaaaa@gmail.com (my-project) -> ******@gmail.com (******)
 */
export function maskEmail(input: string): string {
  if (!input) return '';

  let result = input.replace(/([a-zA-Z0-9._-]+)(@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, (_, __, domainPart) => {
    return '******' + domainPart;
  });

  result = result.replace(/\([a-zA-Z0-9-]+\)/g, '(******)');

  return result;
}

/**
 * Masks a file/folder path, typically for Antigravity folders.
 * Prioritizes hiding emails found in the filename, then applies standard prefix/suffix masking.
 * Example: gemini-aaaaaa@gmail.com-project -> gemini-******@gmail.com-******
 */
export function maskFolder(filename: string): string {
  if (!filename) return '';

  let processed = filename;

  processed = processed.replace(/([a-zA-Z0-9._-]+)(@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, (_, __, domainPart) => {
      return '******' + domainPart;
  });

  const prefixes = ['antigravity-', 'codex-', 'gemini-cli-', 'anthropic-', 'gemini-'];

  for (const prefix of prefixes) {
    if (processed.toLowerCase().startsWith(prefix)) {
        const lastDashIndex = processed.lastIndexOf('-');

        if (lastDashIndex !== -1 && lastDashIndex > prefix.length - 1) {
             return `${processed.substring(0, lastDashIndex + 1)}******`;
        }

        return `${prefix}******`;
    }
  }

  const lastDashIndex = processed.lastIndexOf('-');
  if (lastDashIndex !== -1 && lastDashIndex < processed.length - 1) {
    return `${processed.substring(0, lastDashIndex + 1)}******`;
  }

  return `${processed.substring(0, Math.min(3, processed.length))}******`;
}
