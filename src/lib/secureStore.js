import * as SecureStore from 'expo-secure-store';

const KEY = 'OPENAI_API_KEY';

export async function getApiKey() {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setApiKey(value) {
  if (!value) {
    await SecureStore.deleteItemAsync(KEY);
    return;
  }
  await SecureStore.setItemAsync(KEY, value);
}

export async function hasApiKey() {
  const k = await getApiKey();
  return !!(k && k.trim().length > 0);
}

const MIGRATION_V2_KEY = 'MIGRATION_V2_COMPLETED';

export async function isMigrationV2Done() {
  try {
    const v = await SecureStore.getItemAsync(MIGRATION_V2_KEY);
    return v === '1';
  } catch {
    return false;
  }
}

export async function markMigrationV2Done() {
  try {
    await SecureStore.setItemAsync(MIGRATION_V2_KEY, '1');
  } catch {}
}
