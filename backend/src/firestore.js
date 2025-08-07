/**
 * Firestore REST API client for Cloudflare Workers
 */
export class FirestoreClient {
  constructor(projectId, accessToken) {
    this.projectId = projectId;
    this.accessToken = accessToken;
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  }

  /**
   * @param {string} collection - Collection name
   * @param {string} docId - Document ID
   * @param {object} data - Document data
   * @returns {Promise<object>}
   */
  async createDocument(collection, docId, data) {
    const url = `${this.baseUrl}/${collection}?documentId=${docId}`;

    console.log(`Creating Firestore document: ${collection}/${docId}`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: this.convertToFirestoreFields(data),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Firestore create error:", {
        status: response.status,
        error,
      });
      throw new Error(`Firestore create error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log(
      `Firestore document created successfully: ${collection}/${docId}`
    );
    return result;
  }

 /**
   * @param {string} collection - Collection name
   * @param {string} docId - Document ID
   * @param {object} data - The fields to update
   * @returns {Promise<object>}
   */
  async updateDocument(collection, docId, data) {
    // This creates a query string like "updateMask.fieldPaths=status&updateMask.fieldPaths=completedAt"
    // It tells Firestore ONLY to touch these fields.
    const updateMask = Object.keys(data)
      .map((key) => `updateMask.fieldPaths=${key}`)
      .join("&");

    const url = `${this.baseUrl}/${collection}/${docId}?${updateMask}`;

    console.log(`Updating Firestore document: ${collection}/${docId}`);

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: this.convertToFirestoreFields(data),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Firestore update error:", {
        status: response.status,
        error,
      });
      throw new Error(`Firestore update error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    console.log(
      `Firestore document updated successfully: ${collection}/${docId}`
    );
    return result;
  }

  /**
   * @param {string} collection - Collection name
   * @param {string} docId - Document ID
   * @returns {Promise<object|null>}
   */
  async getDocument(collection, docId) {
    const url = `${this.baseUrl}/${collection}/${docId}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Firestore get error: ${response.status} - ${error}`);
    }

    const result = await response.json();
    return this.convertFromFirestoreFields(result.fields);
  }

  /**
   * @param {object} obj - JavaScript object
   * @returns {object} Firestore fields object
   */
  convertToFirestoreFields(obj) {
    const fields = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value === null) {
        fields[key] = { nullValue: null };
      } else if (typeof value === "string") {
        fields[key] = { stringValue: value };
      } else if (typeof value === "number") {
        if (Number.isInteger(value)) {
          fields[key] = { integerValue: value.toString() };
        } else {
          fields[key] = { doubleValue: value };
        }
      } else if (typeof value === "boolean") {
        fields[key] = { booleanValue: value };
      } else if (value instanceof Date) {
        fields[key] = { timestampValue: value.toISOString() };
      } else if (Array.isArray(value)) {
        fields[key] = {
          arrayValue: {
            values: value.map((item) => {
              if (typeof item === "object" && item !== null) {
                return {
                  mapValue: { fields: this.convertToFirestoreFields(item) },
                };
              } else {
                return this.convertToFirestoreFields({ temp: item }).temp;
              }
            }),
          },
        };
      } else if (typeof value === "object") {
        fields[key] = {
          mapValue: {
            fields: this.convertToFirestoreFields(value),
          },
        };
      }
    }

    return fields;
  }

  /**
   * @param {object} fields - Firestore fields object
   * @returns {object} JavaScript object
   */
  convertFromFirestoreFields(fields) {
    const obj = {};

    for (const [key, value] of Object.entries(fields)) {
      if (value.nullValue !== undefined) {
        obj[key] = null;
      } else if (value.stringValue !== undefined) {
        obj[key] = value.stringValue;
      } else if (value.integerValue !== undefined) {
        obj[key] = parseInt(value.integerValue);
      } else if (value.doubleValue !== undefined) {
        obj[key] = value.doubleValue;
      } else if (value.booleanValue !== undefined) {
        obj[key] = value.booleanValue;
      } else if (value.timestampValue !== undefined) {
        obj[key] = new Date(value.timestampValue);
      } else if (value.arrayValue !== undefined) {
        obj[key] = value.arrayValue.values.map((item) => {
          if (item.mapValue) {
            return this.convertFromFirestoreFields(item.mapValue.fields);
          } else {
            return this.convertFromFirestoreFields({ temp: item }).temp;
          }
        });
      } else if (value.mapValue !== undefined) {
        obj[key] = this.convertFromFirestoreFields(value.mapValue.fields);
      }
    }

    return obj;
  }
}

/**
 * @param {string} serviceAccountKey - Service account JSON string
 * @returns {Promise<string>} Access token
 */
export async function getAccessToken(serviceAccountKey) {
  try {
    console.log("Getting Google Cloud access token...");

    if (!serviceAccountKey) {
      throw new Error("Service account key is missing");
    }

    const serviceAccount = JSON.parse(serviceAccountKey);
    console.log(
      "Service account parsed, client_email:",
      serviceAccount.client_email
    );

    // Create JWT header
    const header = {
      alg: "RS256",
      typ: "JWT",
    };

    // Create JWT payload
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    console.log("JWT payload created");

    // Sign JWT
    const token = await signJWT(header, payload, serviceAccount.private_key);
    console.log("JWT signed successfully");

    // Exchange JWT for access token
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: token,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Token exchange failed:", {
        status: response.status,
        error: errorText,
      });
      throw new Error(
        `Token exchange failed: ${response.status} - ${errorText}`
      );
    }

    const data = await response.json();
    console.log("Access token obtained successfully");
    return data.access_token;
  } catch (error) {
    console.error("Error in getAccessToken:", error);
    throw error;
  }
}

/**
 * @param {object} header - JWT header
 * @param {object} payload - JWT payload
 * @param {string} privateKey - Private key
 * @returns {Promise<string>} Signed JWT
 */
async function signJWT(header, payload, privateKey) {
  try {
    console.log("Signing JWT...");

    // Base64url encode header and payload
    const encodedHeader = btoa(JSON.stringify(header))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const encodedPayload = btoa(JSON.stringify(payload))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const data = `${encodedHeader}.${encodedPayload}`;

    // Clean and decode private key
    const cleanKey = privateKey
      .replace(/-----BEGIN PRIVATE KEY-----/, "")
      .replace(/-----END PRIVATE KEY-----/, "")
      .replace(/\n/g, "")
      .replace(/\r/g, "");

    console.log("Private key cleaned, length:", cleanKey.length);

    const binaryKey = Uint8Array.from(atob(cleanKey), (c) => c.charCodeAt(0));
    console.log("Binary key created, length:", binaryKey.length);

    // Import private key
    const cryptoKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryKey,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"]
    );

    console.log("Crypto key imported successfully");

    // Sign the data
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      new TextEncoder().encode(data)
    );

    console.log("Data signed successfully");

    // Base64url encode signature
    const encodedSignature = btoa(
      String.fromCharCode(...new Uint8Array(signature))
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const finalToken = `${data}.${encodedSignature}`;
    console.log("JWT created successfully, length:", finalToken.length);

    return finalToken;
  } catch (error) {
    console.error("Error in signJWT:", error);
    throw error;
  }
}
