const { Meilisearch } = require('meilisearch');

const client = new Meilisearch({
  host: process.env.MEILISEARCH_HOST || 'http://127.0.0.1:7700',
  apiKey: process.env.MEILISEARCH_API_KEY || '', // Default is empty if no master key is set
});

// Helper functions for easy syncing
async function syncDocument(indexName, document) {
  try {
    const index = client.index(indexName);
    await index.addDocuments([document], { primaryKey: 'id' });
  } catch (error) {
    console.error(`Error syncing document to Meilisearch index ${indexName}:`, error);
  }
}

async function deleteDocument(indexName, documentId) {
  try {
    const index = client.index(indexName);
    await index.deleteDocument(documentId);
  } catch (error) {
    console.error(`Error deleting document from Meilisearch index ${indexName}:`, error);
  }
}

async function searchIndex(indexName, query, options = {}) {
  try {
    const index = client.index(indexName);
    return await index.search(query, options);
  } catch (error) {
    console.error(`Error searching Meilisearch index ${indexName}:`, error);
    return { hits: [], query: query, estimatedTotalHits: 0 };
  }
}

module.exports = {
  client,
  syncDocument,
  deleteDocument,
  searchIndex
};
