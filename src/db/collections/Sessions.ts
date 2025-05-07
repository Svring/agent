import { CollectionConfig } from "payload";
import { getPayload } from 'payload'; // Import getPayload for hook
import configPromise from '@payload-config'; // Import configPromise for hook

export const Sessions: CollectionConfig = {
  slug: 'sessions',
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'messages',
      type: 'relationship',
      relationTo: 'messages',
      hasMany: true,
    },
  ],
  hooks: {
    beforeDelete: [
      async ({ req, id }) => {
        console.log(`Attempting to delete session with ID: ${id}`);
        try {
          const payload = await getPayload({ config: await configPromise });

          // Find all messages related to this session
          const relatedMessages = await payload.find({
            collection: 'messages',
            where: {
              session: {
                equals: id,
              },
            },
            depth: 0, // We only need IDs for deletion
            limit: 0, // Set limit to 0 to get all matching documents (or a very high number if 0 is not supported for all)
            pagination: false, // Some versions might need this to get all
          });

          if (relatedMessages.docs && relatedMessages.docs.length > 0) {
            console.log(`Found ${relatedMessages.docs.length} messages to delete for session ${id}.`);
            // Delete each related message
            // This can be slow for many messages. For very large numbers, consider a bulk operation if available
            // or a background task.
            for (const message of relatedMessages.docs) {
              try {
                await payload.delete({
                  collection: 'messages',
                  id: message.id,
                });
                console.log(`Deleted message ${message.id} for session ${id}`);
              } catch (msgDeleteError) {
                console.error(`Error deleting message ${message.id} for session ${id}:`, msgDeleteError);
                // Decide if you want to throw an error here to stop the session deletion or just log it
                // For now, we log and continue, meaning the session might be deleted even if some messages fail deletion
              }
            }
            console.log(`Finished deleting messages for session ${id}.`);
          } else {
            console.log(`No messages found to delete for session ${id}.`);
          }
        } catch (error) {
          console.error(`Error in beforeDelete hook for session ${id}:`, error);
          // Throwing an error here will prevent the session from being deleted
          throw new Error(`Failed to delete downstream messages for session ${id}. Session deletion aborted.`);
        }
      },
    ],
  },
}
