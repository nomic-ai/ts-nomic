import { test } from 'uvu';
import * as arrow from 'apache-arrow';

/**
type TestTableOptions = {
  length: number;
  modality: "text" | "embedding";
};
 */

export function make_test_table({
  length = 32,
  modality = 'text',
  batches = 2,
} /*: Partial<TestTableOptions>*/ = {}) {
  /*  type columns = {
    id: arrow.Data;
    text: arrow.Data;
    embedding?: arrow.Data;
    date: arrow.Data;
  }; */
  const batch_list = [];
  for (let i = 0; i < batches; i++) {
    const cols /*: columns*/ = {
      id: create_id_column(length / batches),
      text: create_text_column(length / batches),
      embedding: create_embedding_column(length / batches),
      date: create_date_column(length / batches),
    };
    if (modality === 'text') {
      delete cols['embedding'];
    }
    batch_list.push(new arrow.RecordBatch(cols));
  }
  return new arrow.Table(batch_list);
}

function create_date_column(length = 32) {
  const f = new arrow.TimestampNanosecond();
  const dates = [];
  for (let i = 0; i < length; i++) {
    const datum = new Date(2002, 2, i, 2, 2, 2, 2);
    dates.push(datum);
  }
  return arrow.vectorFromArray(dates, f).data[0];
}

function create_text_column(length = 32) {
  const f = new arrow.Utf8();
  const vectorData = arrow.vectorFromArray(
    create_sample_wordlist(length),
    f
  ).data;
  return vectorData[0];
}

function range(length = 32) {
  return Array.from(Array(length).keys());
}

function create_id_column(length = 32) {
  const f = new arrow.Utf8();
  const vectorData = arrow.vectorFromArray(range(length), f).data;
  return vectorData[0];
}

function create_embedding_column(length = 32, dims = 16) {
  const f = new arrow.FixedSizeList(
    dims,
    new arrow.Field('inner', new arrow.Float16())
  );

  let builder = arrow.makeBuilder({
    type: f,
    children: [{ type: new arrow.Float16() }],
  });

  for (let i = 0; i < length; i++) {
    const datum = new Array(dims);
    for (let j = 0; j < dims; j++) {
      datum[j] = Math.random();
    }
    builder = builder.append(datum);
  }

  const v = builder.finish().toVector();
  return v.data[0];
}

/**
 * Create a sample wordlist for testing.
 */
function create_sample_wordlist(length) {
  const sample_words = [
    'lorem',
    'ipsum',
    'dolor',
    'sit',
    'amet',
    'consectetur',
    'adipiscing',
    'elit',
    'sed',
  ];
  const words = [];
  for (let i = 0; i < length; i++) {
    words.push(sample_words[Math.floor(Math.random() * sample_words.length)]);
  }
  return words;
}
