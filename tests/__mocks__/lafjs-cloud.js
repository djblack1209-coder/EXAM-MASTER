const chainProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === 'then') {
        return undefined;
      }

      if (prop === 'count') {
        return async () => ({ total: 0 });
      }

      if (prop === 'get') {
        return async () => ({ data: [] });
      }

      if (prop === 'add') {
        return async () => ({ id: 'mock_id' });
      }

      if (prop === 'update') {
        return async () => ({ updated: 1 });
      }

      if (prop === 'remove') {
        return async () => ({ deleted: 1 });
      }

      return () => chainProxy;
    }
  }
);

const command = {
  inc: (value) => ({ $inc: value }),
  gte: (value) => ({ $gte: value }),
  lte: (value) => ({ $lte: value }),
  neq: (value) => ({ $ne: value }),
  in: (value) => ({ $in: value }),
  and: (...value) => ({ $and: value }),
  or: (...value) => ({ $or: value })
};

const db = {
  command,
  collection: () => chainProxy
};

const cloud = {
  database: () => db,
  logger: {
    log: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  },
  uploadFile: async () => ({ fileID: 'mock_file_id' }),
  getTempFileURL: async () => ({ fileList: [] }),
  invoke: async () => ({ code: 0, data: null, msg: 'ok' })
};

export default cloud;
