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
