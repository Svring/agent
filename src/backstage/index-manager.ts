import { QdrantClient } from '@qdrant/js-client-rest';

/**
 * Singleton class to manage Qdrant connection and indexing operations
 */
class IndexManager {
  private static instance: IndexManager;
  private client: QdrantClient;
  private qdrantUrl: string;
  private isConnected: boolean = false;

  constructor(qdrantUrl: string = 'http://127.0.0.1:6333') {
    this.qdrantUrl = qdrantUrl;
    this.client = new QdrantClient({ url: qdrantUrl });
    console.log(`IndexManager initialized with Qdrant at ${qdrantUrl}`);
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): IndexManager {
    if (!IndexManager.instance) {
      // Load URL from env vars if available
      const url = process.env.QDRANT_URL || 'http://127.0.0.1:6333';
      IndexManager.instance = new IndexManager(url);
    }
    return IndexManager.instance;
  }

  async testConnection() {
    try {
      console.log('Testing connection to Qdrant...');
      const result = await this.client.getCollections();
      const collectionNames = result.collections.map(c => c.name);
      console.log('Successfully connected. Collections:', collectionNames);
      this.isConnected = true;
      return { success: true, message: 'Connection successful', collections: collectionNames };
    } catch (error) {
      this.isConnected = false;
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to connect to Qdrant or fetch collections:', error);
      return { success: false, message: `Connection failed: ${errorMessage}` };
    }
  }

  /**
   * Get the current connection status
   */
  public getStatus(): { connected: boolean; url: string } {
    return { connected: this.isConnected, url: this.qdrantUrl };
  }

  /**
   * Get the client instance
   */
  public getClient(): QdrantClient {
    return this.client;
  }

  // Add other methods for indexing, searching, etc. here
}

// Export the singleton instance
export const indexManager = IndexManager.getInstance();

// For backwards compatibility
export { IndexManager };

// // Original code (now moved into the class)
// // TO connect to Qdrant running locally
// const client = new QdrantClient({url: 'http://127.0.0.1:6333'});

// const result = await client.getCollections();

// console.log('List of collections:', result.collections);