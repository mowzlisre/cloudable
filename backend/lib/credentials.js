// Shared in-process credential store.
// Populated by electron/main.js on startup and profile switch.
// Read by backend/routes/aggregate.js for multi-account queries.

let _active = { accessKeyId: null, secretKey: null, region: 'us-east-1' };
let _profiles = []; // [{ id, name, accessKeyId, secretKey, region }]

module.exports = {
  setActive(creds)    { _active = creds; },
  getActive()         { return _active; },
  setProfiles(list)   { _profiles = list; },
  getProfiles()       { return _profiles; },
  getProfile(id)      { return _profiles.find(p => p.id === id); },
};
