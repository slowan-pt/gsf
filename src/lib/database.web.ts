type QueryRow = Record<string, unknown>;

const emptyResult = {
  lastInsertRowId: 0,
  changes: 0,
};

const webDB = {
  execAsync: async (_source: string) => undefined,
  runAsync: async (_source: string, ..._params: unknown[]) => emptyResult,
  getFirstAsync: async <T extends QueryRow = QueryRow>(
    _source: string,
    ..._params: unknown[]
  ): Promise<T | null> => null,
  getAllAsync: async <T extends QueryRow = QueryRow>(
    _source: string,
    ..._params: unknown[]
  ): Promise<T[]> => [],
};

export const getDB = async () => webDB;

