const pinecone = require('@pinecone-database/pinecone'); // Import PineconeClient
const uuid = require('uuid');

class PineconeDataStore {
    constructor(indexName) {
        this.indexName = indexName;
        this.index = new pinecone.PineconeClient();
    }

    async init() {
        await this.index.init({
            environment: 'us-east4-gcp',
            apiKey: '9eb93914-1cfd-49ec-8cce-1996a139466b',
        });
    }

    async _upsert(chunks) {
        let docIds = Object.keys(chunks);
        let vectors = [];

        for (let docId in chunks) {
            let docChunks = chunks[docId];
            for (let chunk of docChunks) {
                vectors.push({id: chunk.id, vector: chunk.embedding, metadata: chunk.metadata});
            }
        }

        await this.index.upsert({
            upsertRequest: {
                indexName: this.indexName,
                items: vectors
            }
        });

        return docIds;
    }

    async _query(queries) {
        let results = [];

        for (let query of queries) {
            let queryResult = await this.index.query({
                queryRequest: {
                    indexName: this.indexName,
                    topK: query.top_k,
                    vector: query.embedding,
                    filter: query.filter
                }
            });
            results.push(queryResult);
        }

        return results;
    }

    async delete(ids, filter, deleteAll) {
        if (deleteAll) {
            await this.index.delete({
                deleteRequest: {
                    indexName: this.indexName,
                    deleteAll: true
                }
            });
        } else if (ids) {
            await this.index.delete({
                deleteRequest: {
                    indexName: this.indexName,
                    ids: ids
                }
            });
        }

        return true;
    }
}
