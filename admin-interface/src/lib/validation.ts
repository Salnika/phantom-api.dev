/**
 * Utility functions for input validation and sanitization
 */

/**
 * Safely parses JSON string without throwing errors
 * @param jsonString String to parse
 * @returns Parsed object or null if invalid
 */
export function safeJsonParse(jsonString: string): any {
  try {
    if (!jsonString || typeof jsonString !== 'string') {
      return null;
    }
    
    // Basic validation - reject if contains potentially dangerous content
    if (jsonString.includes('<script>') || 
        jsonString.includes('javascript:') || 
        jsonString.includes('data:text/html')) {
      console.warn('Potentially dangerous JSON content detected');
      return null;
    }
    
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Invalid JSON:', error);
    return null;
  }
}

/**
 * Sanitizes string input to prevent XSS attacks
 * @param input String to sanitize
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/&/g, '&amp;');
}

/**
 * Validates email format
 * @param email Email to validate
 * @returns True if valid email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 320; // RFC 5321 limit
}

/**
 * Validates password strength
 * @param password Password to validate
 * @returns Object with validation result and message
 */
export function validatePassword(password: string): { isValid: boolean; message?: string } {
  if (!password || typeof password !== 'string') {
    return { isValid: false, message: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (password.length > 128) {
    return { isValid: false, message: 'Password is too long (max 128 characters)' };
  }
  
  // Check for basic complexity
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  const complexityCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
  
  if (complexityCount < 3) {
    return { 
      isValid: false, 
      message: 'Password must contain at least 3 of: lowercase, uppercase, numbers, special characters' 
    };
  }
  
  return { isValid: true };
}

/**
 * Validates and sanitizes form data
 * @param data Form data object
 * @returns Sanitized data object
 */
export function sanitizeFormData(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value;
    } else if (value === null || value === undefined) {
      sanitized[key] = null;
    } else if (typeof value === 'object') {
      // For objects, convert to JSON safely
      try {
        sanitized[key] = JSON.stringify(value);
      } catch {
        sanitized[key] = null;
      }
    } else {
      sanitized[key] = String(value);
    }
  }
  
  return sanitized;
}

/**
 * Validates resource name to prevent injection attacks
 * @param resourceName Resource name to validate
 * @returns True if valid resource name
 */
export function isValidResourceName(resourceName: string): boolean {
  if (!resourceName || typeof resourceName !== 'string') {
    return false;
  }
  
  // Only allow alphanumeric characters, underscores, and hyphens
  const validPattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
  return validPattern.test(resourceName) && resourceName.length <= 64;
}

/**
 * Rate limiting helper for client-side validation
 */
export class ClientRateLimit {
  private attempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }
  
  /**
   * Checks if an action is rate limited
   * @param key Unique key for the action (e.g., 'login', 'api-call')
   * @returns True if action should be blocked
   */
  isBlocked(key: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(key);
    
    if (!record) {
      return false;
    }
    
    // Reset if window has passed
    if (now - record.lastAttempt > this.windowMs) {
      this.attempts.delete(key);
      return false;
    }
    
    return record.count >= this.maxAttempts;
  }
  
  /**
   * Records an attempt
   * @param key Unique key for the action
   */
  recordAttempt(key: string): void {
    const now = Date.now();
    const record = this.attempts.get(key);
    
    if (!record || now - record.lastAttempt > this.windowMs) {
      this.attempts.set(key, { count: 1, lastAttempt: now });
    } else {
      record.count++;
      record.lastAttempt = now;
    }
  }
  
  /**
   * Resets attempts for a key (e.g., after successful action)
   * @param key Unique key for the action
   */
  reset(key: string): void {
    this.attempts.delete(key);
  }
}
