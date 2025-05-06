import MiniIndexer from "@/components/mini-kit/mini-indexer";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Qdrant Indexer | Agent",
  description: "Test and manage your Qdrant vector database connections",
};

export default function IndexerPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Qdrant Indexer</h1>
          <p className="text-muted-foreground">
            Connect to and manage your Qdrant vector database
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MiniIndexer className="md:col-span-1" />
          
          <div className="flex flex-col p-4 border rounded-lg shadow-sm bg-card text-card-foreground md:col-span-1">
            <h3 className="text-lg font-semibold mb-3">Guide</h3>
            <div className="space-y-4 text-sm">
              <p>
                The Qdrant Indexer allows you to connect to a Qdrant vector database and manage your collections.
              </p>
              <p>
                <strong>Connection URL:</strong> By default, the Indexer connects to <code className="bg-muted px-1.5 py-0.5 rounded text-xs">http://127.0.0.1:6333</code>. 
                You can configure this in the environment variables.
              </p>
              <p>
                <strong>Test Connection:</strong> Click the "Test Connection" button to verify your Qdrant server is running and accessible.
                If successful, you'll see a list of available collections.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
