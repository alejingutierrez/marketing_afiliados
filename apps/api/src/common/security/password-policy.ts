const MIN_LENGTH = 12;
const SPECIAL_CHAR_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;
const DIGIT_PATTERN = /\d/;
const UPPERCASE_PATTERN = /[A-ZÁÉÍÓÚÜÑ]/;
const LOWERCASE_PATTERN = /[a-záéíóúüñ]/;

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password || password.length < MIN_LENGTH) {
    errors.push(`Debe tener al menos ${MIN_LENGTH} caracteres`);
  }
  if (!DIGIT_PATTERN.test(password)) {
    errors.push('Debe incluir al menos un número');
  }
  if (!UPPERCASE_PATTERN.test(password)) {
    errors.push('Debe incluir al menos una letra mayúscula');
  }
  if (!LOWERCASE_PATTERN.test(password)) {
    errors.push('Debe incluir al menos una letra minúscula');
  }
  if (!SPECIAL_CHAR_PATTERN.test(password)) {
    errors.push('Debe incluir al menos un carácter especial');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
