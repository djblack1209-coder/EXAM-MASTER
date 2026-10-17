// Missing/empty values are successful reads. A storage fault cannot supply a write base.
export function readPersistent(reader) {
  try {
    return { status: 'ready', value: reader() };
  } catch (cause) {
    if (cause?.code === 'CONTEXT_CHANGED') throw cause;
    const error =
      cause?.code === 'SESSION_UNAVAILABLE'
        ? cause
        : Object.assign(new Error('持久化数据暂不可读，请重试'), {
            name: 'PersistenceUnavailableError',
            code: 'SESSION_UNAVAILABLE'
          });
    return { status: 'unavailable', error };
  }
}

export function requirePersistent(reader) {
  const result = readPersistent(reader);
  if (result.status !== 'ready') throw result.error;
  return result.value;
}
