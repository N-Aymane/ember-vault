const validUint = value => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
export function migrateSave(value) {
  if (!value || !validUint(value.version) || !validUint(value.best)) throw new Error('Invalid save');
  if (value.version === 0) return {version: 1, best: value.best, cleared: 0};
  if (value.version !== 1) throw new Error('Save was created by a newer version');
  if (!validUint(value.cleared)) throw new Error('Invalid progress');
  return {version: 1, best: value.best, cleared: value.cleared};
}
export async function openSave() {
  if (!globalThis.indexedDB) throw new Error('Browser storage is unavailable');
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('ember-vault', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('progress');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close other vault tabs to upgrade saves'));
  });
  db.onversionchange = () => db.close();
  const read = await new Promise((resolve, reject) => {
    const transaction = db.transaction('progress', 'readonly');
    const request = transaction.objectStore('progress').get('profile');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  let current;
  try { current = read === undefined ? {version: 1, best: 0, cleared: 0} : migrateSave(read); }
  catch (error) { db.close(); throw error; }
  return {get current() { return current; }, write(value) {
    const safe = migrateSave(value);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('progress', 'readwrite');
      transaction.objectStore('progress').put(safe, 'profile');
      transaction.oncomplete = () => { current = safe; resolve(); };
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('Save interrupted'));
    });
  }};
}
