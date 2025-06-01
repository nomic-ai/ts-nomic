/**
 * Generates random JSON data with a variety of column types for testing purposes.
 * @param length - Number of records to generate
 * @returns Array of objects with mixed data types
 */
export function generateRandomJsonData(
  length: number = 100
): Record<string, unknown>[] {
  const data: Record<string, unknown>[] = [];

  for (let i = 0; i < length; i++) {
    const record: Record<string, unknown> = {
      // string column, always present
      id: `record_${i}`,
      // string column, sometimes null
      name:
        Math.random() < 0.05
          ? null
          : ['Alice', 'Bob'][Math.floor(Math.random() * 2)],
      // int column, sometimes null
      // You're only as old as you feel.
      [`person's "age"`]:
        Math.random() < 0.1 ? null : Math.floor(Math.random() * 80) + 18,
      // bool column, sometimes null
      is_active: Math.random() < 0.05 ? null : Math.random() > 0.5,
      // date column, sometimes null
      created_at:
        Math.random() < 0.75
          ? null
          : new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      // array of strings column, variable length, sometimes null
      // tags: Math.random() < 0.15 ? null : generateRandomTags(),
      // struct column, sometimes null, always the same structure
      structured_metadata: Math.random() < 0.2 ? null : generateStructData(),
      // struct column, sometimes null, always a different structure
      dynamic_metadata:
        Math.random() < 0.2 ? null : generateDynamicStructData(),
      // big int column, sometimes null
      big_int: Math.random() < 0.05 ? null : 100_000_000_000_000n,
      // fixed size list of floats, never null
      embedding: Array.from({ length: 20 }, () => Math.random()),
      // entirely null
      null_column: null,
      // entirely undefined
      undefined_column: undefined,
    };

    data.push(record);
  }

  return data;
}

function generateRandomTags(): string[] {
  const allTags = ['urgent', 'important', 'review', 'draft', 'completed'];
  const numTags = Math.floor(Math.random() * 4) + 1;
  const shuffled = allTags.sort(() => 0.5 - Math.random());

  return shuffled.slice(0, numTags);
}

function generateStructData(): Record<string, unknown> {
  const texts = ['api', 'manual', 'import', 'sync', 'migration', 'batch'];
  const text = texts[Math.floor(Math.random() * 6)];
  const textList = texts.slice(0, Math.floor(Math.random() * 6));
  const num = Math.floor(Math.random() * 5);

  return {
    text,
    textList,
    num,
    nullableText: Math.random() < 0.5 ? null : text,
    subStruct: {
      bool: Math.random() > 0.7,
      nullableTextList: Math.random() < 0.5 ? null : textList,
    },
  };
}

function generateDynamicStructData(): Record<string, unknown> {
  const initialStruct = generateStructData();
  // delete a random field
  const fieldToDelete =
    Object.keys(initialStruct)[
      Math.floor(Math.random() * Object.keys(initialStruct).length)
    ];
  delete initialStruct[fieldToDelete];
  // add a new random field
  const newFieldKey = Math.random().toString(36).substring(2, 8);
  initialStruct[newFieldKey] = Math.random() < 0.5 ? null : Math.random() > 0.5;
  return initialStruct;
}
