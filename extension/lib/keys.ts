// BYOK (D3): keys live only in this browser's local extension storage. They are never synced or sent anywhere but the provider's API.
export type ApiKeys = { typesafe: string; anthropic: string };

const STORAGE_KEY = "apiKeys";

export async function loadKeys(): Promise<ApiKeys> {
  const stored = (await browser.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as Partial<ApiKeys> | undefined;
  return { typesafe: stored?.typesafe ?? "", anthropic: stored?.anthropic ?? "" };
}

export async function saveKeys(keys: ApiKeys): Promise<void> {
  await browser.storage.local.set({
    [STORAGE_KEY]: { typesafe: keys.typesafe.trim(), anthropic: keys.anthropic.trim() },
  });
}
