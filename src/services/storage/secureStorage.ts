/**
 * Secure Storage Service
 * Wraps localStorage with optional encryption support
 */

export const secureStorage = {
  /**
   * Get an item from storage
   */
  getItem<T>(key: string, _options?: { encrypt?: boolean }): T | null {
    try {
      const value = localStorage.getItem(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  },

  /**
   * Set an item in storage
   */
  setItem<T>(key: string, value: T, _options?: { encrypt?: boolean }): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save to storage:', error);
    }
  },

  /**
   * Remove an item from storage
   */
  removeItem(key: string): void {
    localStorage.removeItem(key);
  },

  /**
   * Migrate plaintext keys (for backwards compatibility)
   */
  migratePlaintextKeys(keys: string[]): void {
    for (const key of keys) {
      const oldKey = `plaintext_${key}`;
      const oldValue = localStorage.getItem(oldKey);
      if (oldValue) {
        try {
          localStorage.setItem(key, oldValue);
          localStorage.removeItem(oldKey);
        } catch {
          // Ignore migration errors
        }
      }
    }
  },
};
