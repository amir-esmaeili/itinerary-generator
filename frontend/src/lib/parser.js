/**
 * Converts a raw Firestore document's fields into a clean JavaScript object.
 * @param {object} fields - The raw 'fields' object from Firestore.
 * @returns {object|null} A clean JavaScript object.
 */
export function parseFirestoreDocument(fields) {
  if (!fields) return null;

  const obj = {};

  for (const [key, value] of Object.entries(fields)) {
    const valueType = Object.keys(value)[0];

    switch (valueType) {
      case "stringValue":
        obj[key] = value.stringValue;
        break;
      case "integerValue":
        obj[key] = parseInt(value.integerValue, 10);
        break;
      case "doubleValue":
        obj[key] = value.doubleValue;
        break;
      case "booleanValue":
        obj[key] = value.booleanValue;
        break;
      case "timestampValue":
        obj[key] = new Date(value.timestampValue);
        break;
      case "nullValue":
        obj[key] = null;
        break;
      case "mapValue":
        obj[key] = parseFirestoreDocument(value.mapValue.fields);
        break;
      case "arrayValue":
        obj[key] = value.arrayValue.values
          ? value.arrayValue.values.map(item => parseFirestoreDocument(item.mapValue.fields))
          : [];
        break;
      default:
        obj[key] = value;
        break;
    }
  }
  return obj;
}