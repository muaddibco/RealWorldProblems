import { TableClient, TableEntity, TableServiceClient } from '@azure/data-tables';
import { IssueCard } from '../types';

interface CachedIssueEntity extends TableEntity {
  issueNumber: number;
  data: string; // JSON string of IssueCard
  timestamp: number;
}

const TABLE_NAME = 'IssuesCache';
const PARTITION_KEY = 'issues';

let tableClient: TableClient | null = null;

function getConnectionString(): string {
  const connectionString = process.env.AzureWebJobsStorage || process.env.STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error('Storage connection string not configured. Set AzureWebJobsStorage or STORAGE_CONNECTION_STRING environment variable.');
  }
  return connectionString;
}

async function getTableClient(): Promise<TableClient> {
  if (tableClient) {
    return tableClient;
  }

  try {
    const connectionString = getConnectionString();
    const tableServiceClient = TableServiceClient.fromConnectionString(connectionString);
    const client = TableClient.fromConnectionString(connectionString, TABLE_NAME);
    
    // Ensure table exists
    await tableServiceClient.createTable(TABLE_NAME).catch(() => {
      // Table might already exist, ignore error
    });

    tableClient = client;
    return client;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to initialize table client: ${message}`);
  }
}

export async function getCachedIssues(): Promise<IssueCard[] | null> {
  try {
    const client = await getTableClient();
    const entities = await client.listEntities<CachedIssueEntity>();
    
    const issues: IssueCard[] = [];
    for await (const entity of entities) {
      try {
        const issueCard = JSON.parse(entity.data) as IssueCard;
        issues.push(issueCard);
      } catch (parseError) {
        const message = parseError instanceof Error ? parseError.message : String(parseError);
        console.warn(`Failed to parse cached issue entity: ${message}`, entity);
      }
    }

    return issues.length > 0 ? issues : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to retrieve cached issues: ${message}`);
    // Return null to fall back to GitHub API fetch
    return null;
  }
}

export async function getCachedIssue(issueNumber: number): Promise<IssueCard | null> {
  try {
    const client = await getTableClient();
    const rowKey = String(issueNumber);
    
    const entity = await client.getEntity<CachedIssueEntity>(PARTITION_KEY, rowKey);
    if (!entity) {
      return null;
    }

    return JSON.parse(entity.data) as IssueCard;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('404') || message.includes('not found')) {
      return null;
    }
    console.error(`Failed to retrieve cached issue ${issueNumber}: ${message}`);
    return null;
  }
}

export async function setCachedIssues(issues: IssueCard[]): Promise<void> {
  try {
    const client = await getTableClient();
    const timestamp = Date.now();

    // Clear old entries
    try {
      const entities = await client.listEntities<CachedIssueEntity>();
      for await (const entity of entities) {
        await client.deleteEntity(entity.partitionKey, entity.rowKey);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`Warning clearing old cache entries: ${message}`);
    }

    // Insert new entries in batches (Table Storage has batch size limits)
    const batchSize = 100;
    for (let i = 0; i < issues.length; i += batchSize) {
      const batch = issues.slice(i, i + batchSize);
      
      for (const issue of batch) {
        const entity: CachedIssueEntity = {
          partitionKey: PARTITION_KEY,
          rowKey: String(issue.number),
          issueNumber: issue.number,
          data: JSON.stringify(issue),
          timestamp,
        };
        
        await client.upsertEntity(entity, 'Merge');
      }
    }

    console.log(`Cached ${issues.length} issues to table storage`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to cache issues: ${message}`);
    throw error;
  }
}

export async function clearCache(): Promise<void> {
  try {
    const client = await getTableClient();
    const entities = await client.listEntities<CachedIssueEntity>();
    
    for await (const entity of entities) {
      await client.deleteEntity(entity.partitionKey, entity.rowKey);
    }

    console.log('Cleared issues cache');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to clear cache: ${message}`);
    throw error;
  }
}
