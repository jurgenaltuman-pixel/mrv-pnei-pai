export const PASSWORD_MIN_LENGTH = 8;

export function validateStrongPassword(password) {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`;
  }
  if (!/[A-ZÁÉÍÓÚÑ]/.test(password)) {
    return 'Incluí al menos una letra mayúscula.';
  }
  if (!/[a-záéíóúñ]/.test(password)) {
    return 'Incluí al menos una letra minúscula.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Incluí al menos un número.';
  }
  return null;
}
