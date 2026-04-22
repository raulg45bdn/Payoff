import * as LocalAuthentication from 'expo-local-authentication';

/**
 * Checks whether Face ID / Touch ID is available AND enrolled on this device.
 * Always call this before prompting — never call authenticate() blindly.
 * Returns { available: boolean, biometricType: string | null }
 */
export async function checkBiometricAvailability() {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return { available: false, biometricType: null };

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) return { available: false, biometricType: null };

    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const hasFaceId = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const biometricType = hasFaceId ? 'Face ID' : 'Touch ID';

    return { available: true, biometricType };
  } catch {
    return { available: false, biometricType: null };
  }
}

/**
 * Prompts biometric authentication. Must call checkBiometricAvailability() first.
 * Returns true if authenticated successfully.
 */
export async function authenticateWithBiometrics(promptMessage = 'Confirm your identity to access PayOff') {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: false, // allow PIN fallback
      cancelLabel: 'Cancel',
    });
    return result.success;
  } catch {
    return false;
  }
}
