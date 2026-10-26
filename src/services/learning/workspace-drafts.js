// Navigation drafts live only in this running store, outside saved learning facts.
const stores = new WeakMap();
export function workspaceDrafts(store) {
  let cache = stores.get(store);
  if (!cache) {
    cache = { context: undefined, values: new Map() };
    stores.set(store, cache);
  }
  function scoped(context) {
    if (context !== cache.context) {
      cache.values.clear();
      cache.context = context;
    }
    return Boolean(context);
  }
  return {
    read(context, key) {
      return scoped(context) ? { ...(cache.values.get(key) || {}) } : {};
    },
    remove(context, key) {
      if (scoped(context)) cache.values.delete(key);
    },
    save(context, key, value) {
      if (scoped(context)) cache.values.set(key, { ...value });
    }
  };
}
