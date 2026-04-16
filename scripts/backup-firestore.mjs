import path from "node:path";
import {
  ensureDirectory,
  fileTimestamp,
  initAdminContext,
  parseCliArgs,
  parseCsvArg,
  writeJsonFileWithHash,
} from "./_backup-utils.mjs";

function serializeValue(value) {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  if (Buffer.isBuffer(value)) {
    return {
      __type: "bytes",
      base64: value.toString("base64"),
    };
  }

  if (typeof value === "object") {
    if (typeof value.toDate === "function") {
      return {
        __type: "timestamp",
        iso: value.toDate().toISOString(),
      };
    }

    if (typeof value.latitude === "number" && typeof value.longitude === "number") {
      return {
        __type: "geopoint",
        latitude: value.latitude,
        longitude: value.longitude,
      };
    }

    if (typeof value.path === "string" && value.firestore) {
      return {
        __type: "reference",
        path: value.path,
      };
    }

    const output = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = serializeValue(nested);
    }
    return output;
  }

  return value;
}

async function exportDocumentNode(docSnap, { includeSubcollections, maxDepth }, depth = 0) {
  const payload = {
    id: docSnap.id,
    path: docSnap.ref.path,
    data: serializeValue(docSnap.data() || {}),
    subcollections: [],
  };

  if (!includeSubcollections || depth >= maxDepth) {
    return payload;
  }

  const subcollections = await docSnap.ref.listCollections();
  subcollections.sort((a, b) => a.id.localeCompare(b.id));

  for (const subcollectionRef of subcollections) {
    const exported = await exportCollectionNode(
      subcollectionRef,
      { includeSubcollections, maxDepth },
      depth + 1
    );
    payload.subcollections.push(exported);
  }

  return payload;
}

async function exportCollectionNode(collectionRef, options, depth = 0) {
  const snapshot = await collectionRef.get();
  const docs = [];

  for (const docSnap of snapshot.docs) {
    docs.push(await exportDocumentNode(docSnap, options, depth));
  }

  return {
    id: collectionRef.id,
    path: collectionRef.path,
    docCount: docs.length,
    docs,
  };
}

function countDocsInCollectionNode(collectionNode) {
  let total = Number(collectionNode?.docCount || 0);
  const docs = Array.isArray(collectionNode?.docs) ? collectionNode.docs : [];

  for (const docNode of docs) {
    const subcollections = Array.isArray(docNode?.subcollections) ? docNode.subcollections : [];
    for (const subcollectionNode of subcollections) {
      total += countDocsInCollectionNode(subcollectionNode);
    }
  }

  return total;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const includeSubcollections = String(args["include-subcollections"] || "true").toLowerCase() !== "false";
  const maxDepth = Number.isFinite(Number(args["max-depth"]))
    ? Math.max(0, Math.floor(Number(args["max-depth"])))
    : 8;
  const requestedCollections = new Set(parseCsvArg(args.collections));

  const { db, projectId } = initAdminContext({ requireStorage: false });
  const outputDir = path.join(process.cwd(), "scripts", "output", "backups");
  ensureDirectory(outputDir);

  const collections = await db.listCollections();
  collections.sort((a, b) => a.id.localeCompare(b.id));

  const selectedCollections = collections.filter((collectionRef) => {
    if (requestedCollections.size === 0) {
      return true;
    }

    return requestedCollections.has(collectionRef.id);
  });

  if (selectedCollections.length === 0) {
    throw new Error("No collections matched the requested filter.");
  }

  const collectionNodes = [];
  for (let index = 0; index < selectedCollections.length; index += 1) {
    const collectionRef = selectedCollections[index];
    console.log(
      `Exporting collection ${index + 1}/${selectedCollections.length}: ${collectionRef.id}`
    );

    const exported = await exportCollectionNode(collectionRef, {
      includeSubcollections,
      maxDepth,
    });
    collectionNodes.push(exported);

    console.log(
      `Completed ${collectionRef.id}: ${exported.docCount} top-level docs`
    );
  }

  const totalTopLevelDocuments = collectionNodes.reduce(
    (sum, collectionNode) => sum + Number(collectionNode.docCount || 0),
    0
  );
  const totalDocumentsIncludingSubcollections = collectionNodes.reduce(
    (sum, collectionNode) => sum + countDocsInCollectionNode(collectionNode),
    0
  );

  const timestamp = fileTimestamp();
  const backupFileName = `firestore-backup-${timestamp}.json`;
  const backupPath = path.join(outputDir, backupFileName);

  const payload = {
    generatedAt: new Date().toISOString(),
    projectId,
    mode: {
      includeSubcollections,
      maxDepth,
    },
    summary: {
      topLevelCollections: collectionNodes.length,
      topLevelDocuments: totalTopLevelDocuments,
      totalDocumentsIncludingSubcollections,
    },
    collections: collectionNodes,
  };

  const backupWriteResult = writeJsonFileWithHash(backupPath, payload);

  const manifestFileName = `firestore-backup-${timestamp}.manifest.json`;
  const manifestPath = path.join(outputDir, manifestFileName);
  const manifest = {
    generatedAt: new Date().toISOString(),
    kind: "firestore-backup-manifest",
    projectId,
    backup: {
      file: backupFileName,
      sha256: backupWriteResult.sha256,
      bytes: backupWriteResult.bytes,
    },
    summary: payload.summary,
    collections: collectionNodes.map((collectionNode) => ({
      id: collectionNode.id,
      path: collectionNode.path,
      topLevelDocCount: collectionNode.docCount,
      totalDocCount: countDocsInCollectionNode(collectionNode),
    })),
  };

  writeJsonFileWithHash(manifestPath, manifest);

  console.log(`Firestore backup written: ${path.relative(process.cwd(), backupPath)}`);
  console.log(`Manifest written: ${path.relative(process.cwd(), manifestPath)}`);
  console.log(`Top-level collections: ${payload.summary.topLevelCollections}`);
  console.log(`Top-level documents: ${payload.summary.topLevelDocuments}`);
  console.log(`Total documents (including nested): ${payload.summary.totalDocumentsIncludingSubcollections}`);
}

main().catch((error) => {
  console.error("Firestore backup failed:", error.message || String(error));
  process.exit(1);
});
