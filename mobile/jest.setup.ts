// In-memory MMKV for Jest (the native module can't load in Node).
jest.mock('react-native-mmkv', () => {
  const create = () => {
    const m = new Map<string, string>();
    return {
      getString: (k: string) => m.get(k),
      set: (k: string, v: string) => void m.set(k, String(v)),
      remove: (k: string) => m.delete(k),
      clearAll: () => m.clear(),
      getAllKeys: () => [...m.keys()],
    };
  };
  return { createMMKV: create };
});
