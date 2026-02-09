/**
 * Privacy utilities for masking sensitive information
 */

/**
 * Masks an email address while keeping the domain visible.
 * For non-email strings (usernames), masks all but the first character.
 * Example: aaaaaa@gmail.com -> ******@gmail.com
 * Example: aaaaaa@gmail.com (my-project) -> ******@gmail.com (******)
 * Example: 0xtbug -> 0*****
 * Example: Kiro -> K***
 */
export function maskEmail(input: string): string {
  if (!input) return '';

  // Check if input contains an email pattern
  const hasEmail = /[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+/i.test(input);

  if (hasEmail) {
    // Mask email addresses
    let result = input.replace(/([a-zA-Z0-9._-]+)(@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, (_, __, domainPart) => {
      return '******' + domainPart;
    });

    // Mask parenthesized content (like project IDs)
    result = result.replace(/\([a-zA-Z0-9-]+\)/g, '(******)');

    return result;
  }

  // For non-email strings (usernames), keep first char and mask the rest
  if (input.length <= 1) return input;
  return input.charAt(0) + '*'.repeat(Math.min(input.length - 1, 5));
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
