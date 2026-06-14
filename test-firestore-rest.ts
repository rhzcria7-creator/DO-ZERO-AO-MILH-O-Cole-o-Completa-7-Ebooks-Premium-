import fetch from "node-fetch";

async function testQuery(idToken: string, email: string) {
  const projectId = "steam-port-ff4nj";
  const databaseId = "ai-studio-070dfb43-05fd-44e4-a0f4-f00ac0df6737";
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery`;

  const queryPayload = {
    structuredQuery: {
      from: [{ collectionId: "purchases" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: "email" },
                op: "EQUAL",
                value: { stringValue: email }
              }
            },
            {
              fieldFilter: {
                field: { fieldPath: "status" },
                op: "EQUAL",
                value: { stringValue: "completed" }
              }
            }
          ]
        }
      }
    }
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(queryPayload)
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
