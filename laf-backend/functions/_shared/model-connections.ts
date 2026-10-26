import { decryptModelKey } from './learning-account.js';
import { ProviderError } from './ai-providers/learning-provider.js';

// Shared by inference and discovery; every lookup binds both the owner and profile.
export async function readModelCredential(db: any, owner: string, profile: any) {
  const key = (
    await db
      .collection('learning_model_keys')
      .where({
        _id: profile.keyRef,
        user_id: owner,
        profile_id: profile.id
      })
      .get()
  ).data?.[0];
  if (!key) throw new ProviderError('KEY_UNAVAILABLE', '指定连接的密钥不可用，请重新连接');
  return decryptModelKey(key.vault, owner, profile.id, process.env.LEARNING_VAULT_KEY || '');
}
