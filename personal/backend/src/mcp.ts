import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import type {Env,Thought} from './types';
import {db} from './db';
import {getEmbedding,extractMetadata,EMBEDDING_PROVIDER,EMBEDDING_MODEL} from './ai';
async function result(p:PromiseLike<Record<string,unknown>[]>):Promise<{data:Thought[]|null,error:{message:string}|null}>{try{return {data:await p as Thought[],error:null}}catch{return {data:null,error:{message:'Database operation failed'}}}}
export function createMcp(env:Env){const sql=db(env);
// --- MCP Server Setup ---

const server = new McpServer({
  name: "open-brain",
  version: "1.0.0",
});

// Tool 1: Semantic Search
server.registerTool(
  "search_thoughts",
  {
    title: "Search Thoughts",
    description:
      "Search captured thoughts by meaning. Use this when the user asks about a topic, person, or idea they've previously captured.",
    inputSchema: {
      query: z.string().trim().min(1).max(2000).describe("What to search for"),
      limit: z.number().int().min(1).max(50).optional().default(10),
      threshold: z.number().min(0).max(1).optional().default(0.5),
    },
  },
  async ({ query, limit, threshold }) => {
    try {
      const qEmb = await getEmbedding(env, query);
      // match_thoughts (core RPC) doesn't filter deleted_at, so over-fetch
      // and post-filter against a visible-id set.
      const overFetch = Math.min(200, limit * 4);
      const { data, error } = await result(sql`select * from public.match_thoughts(${JSON.stringify(qEmb)}::extensions.vector,${threshold}::double precision,${overFetch}::integer,'{}'::jsonb)`);

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Search error: ${error.message}` }],
          isError: true,
        };
      }

      let rows = (data ?? []) as Array<{
        id: string;
        content: string;
        metadata: Record<string, unknown>;
        similarity: number;
        created_at: string;
      }>;
      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const { data: visible, error: visErr } = await result(sql`select id from public.thoughts where id=any(${ids}::uuid[]) and deleted_at is null`);
        if (visErr) {
          return {
            content: [{ type: "text" as const, text: `Search error: ${visErr.message}` }],
            isError: true,
          };
        }
        const visibleSet = new Set((visible ?? []).map((r: { id: string }) => r.id));
        rows = rows.filter((r) => visibleSet.has(r.id)).slice(0, limit);
      }

      if (rows.length === 0) {
        return {
          content: [{ type: "text" as const, text: `No thoughts found matching "${query}".` }],
        };
      }

      const results = rows.map(
        (
          t: {
            content: string;
            metadata: Record<string, unknown>;
            similarity: number;
            created_at: string;
          },
          i: number
        ) => {
          const m = t.metadata || {};
          const parts = [
            `--- Result ${i + 1} (${(t.similarity * 100).toFixed(1)}% match) ---`,
            `Captured: ${new Date(t.created_at).toLocaleDateString()}`,
            `Type: ${m.type || "unknown"}`,
          ];
          if (Array.isArray(m.topics) && m.topics.length)
            parts.push(`Topics: ${(m.topics as string[]).join(", ")}`);
          if (Array.isArray(m.people) && m.people.length)
            parts.push(`People: ${(m.people as string[]).join(", ")}`);
          if (Array.isArray(m.action_items) && m.action_items.length)
            parts.push(`Actions: ${(m.action_items as string[]).join("; ")}`);
          parts.push(`\n${t.content}`);
          return parts.join("\n");
        }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${rows.length} thought(s):\n\n${results.join("\n\n")}`,
          },
        ],
      };
    } catch (err: unknown) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error && err.message==='Writes temporarily disabled' ? err.message : 'Operation failed'}` }],
        isError: true,
      };
    }
  }
);

// Tool 2: List Recent
server.registerTool(
  "list_thoughts",
  {
    title: "List Recent Thoughts",
    description:
      "List recently captured thoughts with optional filters by type, topic, person, or time range.",
    inputSchema: {
      limit: z.number().int().min(1).max(50).optional().default(10),
      type: z.string().optional().describe("Filter by type: observation, task, idea, reference, person_note"),
      topic: z.string().optional().describe("Filter by topic tag"),
      person: z.string().optional().describe("Filter by person mentioned"),
      days: z.number().min(0).max(36500).optional().describe("Only thoughts from the last N days"),
    },
  },
  async ({ limit, type, topic, person, days }) => {
    try {
      const filters: Record<string, unknown> = {};
      if(type) filters.type=type;
      if(topic) filters.topics=[topic];
      if(person) filters.people=[person];
      const since=days ? new Date(Date.now()-days*86400000).toISOString() : null;
      const {data,error}=await result(sql`select content,metadata,created_at from public.thoughts where deleted_at is null and metadata @> ${JSON.stringify(filters)}::jsonb and (${since}::timestamptz is null or created_at>=${since}::timestamptz) order by created_at desc limit ${limit}`);

      if (error) {
        return {
          content: [{ type: "text" as const, text: `Error: ${error.message}` }],
          isError: true,
        };
      }

      if (!data || !data.length) {
        return { content: [{ type: "text" as const, text: "No thoughts found." }] };
      }

      const results = data.map(
        (
          t: { content: string; metadata: Record<string, unknown>; created_at: string },
          i: number
        ) => {
          const m = t.metadata || {};
          const tags = Array.isArray(m.topics) ? (m.topics as string[]).join(", ") : "";
          return `${i + 1}. [${new Date(t.created_at).toLocaleDateString()}] (${m.type || "??"}${tags ? " - " + tags : ""})\n   ${t.content}`;
        }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `${data.length} recent thought(s):\n\n${results.join("\n\n")}`,
          },
        ],
      };
    } catch (err: unknown) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error && err.message==='Writes temporarily disabled' ? err.message : 'Operation failed'}` }],
        isError: true,
      };
    }
  }
);

// Tool 3: Stats
server.registerTool(
  "thought_stats",
  {
    title: "Thought Statistics",
    description: "Get a summary of all captured thoughts: totals, types, top topics, and people.",
    inputSchema: {},
  },
  async () => {
    try {
      const totals=await sql`select count(*)::integer as count from public.thoughts where deleted_at is null`;
      const count=totals[0].count;
      const data=await sql`select metadata,created_at from public.thoughts where deleted_at is null order by created_at desc`;

      const types: Record<string, number> = {};
      const topics: Record<string, number> = {};
      const people: Record<string, number> = {};

      for (const r of data || []) {
        const m = (r.metadata || {}) as Record<string, unknown>;
        if (m.type) types[m.type as string] = (types[m.type as string] || 0) + 1;
        if (Array.isArray(m.topics))
          for (const t of m.topics) topics[t as string] = (topics[t as string] || 0) + 1;
        if (Array.isArray(m.people))
          for (const p of m.people) people[p as string] = (people[p as string] || 0) + 1;
      }

      const sort = (o: Record<string, number>): [string, number][] =>
        Object.entries(o)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

      const lines: string[] = [
        `Total thoughts: ${count}`,
        `Date range: ${
          data?.length
            ? new Date(data[data.length - 1].created_at).toLocaleDateString() +
              " → " +
              new Date(data[0].created_at).toLocaleDateString()
            : "N/A"
        }`,
        "",
        "Types:",
        ...sort(types).map(([k, v]) => `  ${k}: ${v}`),
      ];

      if (Object.keys(topics).length) {
        lines.push("", "Top topics:");
        for (const [k, v] of sort(topics)) lines.push(`  ${k}: ${v}`);
      }

      if (Object.keys(people).length) {
        lines.push("", "People mentioned:");
        for (const [k, v] of sort(people)) lines.push(`  ${k}: ${v}`);
      }

      return { content: [{ type: "text" as const, text: lines.join("\n") }] };
    } catch (err: unknown) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error && err.message==='Writes temporarily disabled' ? err.message : 'Operation failed'}` }],
        isError: true,
      };
    }
  }
);

// Tool 4: Capture Thought
server.registerTool(
  "capture_thought",
  {
    title: "Capture Thought",
    description:
      "Save a new thought to the Open Brain. Generates an embedding and extracts metadata automatically. Use this when the user wants to save something to their brain directly from any AI client — notes, insights, decisions, or migrated content from other systems.",
    inputSchema: {
      content: z.string().trim().min(1).max(100000).describe("The thought to capture — a clear, standalone statement that will make sense when retrieved later by any AI"),
    },
  },
  async ({ content }) => {
    try {
      if(env.WRITES_ENABLED!=='true') throw new Error('Writes temporarily disabled');
      const [embedding, metadata] = await Promise.all([
        getEmbedding(env, content),
        extractMetadata(env, content),
      ]);

      if(env.WRITES_ENABLED!=='true') throw new Error('Writes temporarily disabled');
      const md={...metadata,source:'mcp',embedding_provider:EMBEDDING_PROVIDER,embedding_model:EMBEDDING_MODEL};
      // Keep original upsert normalization/metadata merge, save vector in same statement.
      await sql`insert into public.thoughts(content,content_fingerprint,metadata,embedding) values (${content},encode(sha256(convert_to(lower(trim(regexp_replace(${content},'\\s+',' ','g'))),'UTF8')),'hex'),${JSON.stringify(md)}::jsonb,${JSON.stringify(embedding)}::extensions.vector) on conflict(content_fingerprint) where content_fingerprint is not null do update set metadata=public.thoughts.metadata||excluded.metadata,embedding=excluded.embedding,updated_at=now()`;

      const meta = metadata as Record<string, unknown>;
      let confirmation = `Captured as ${meta.type || "thought"}`;
      if (Array.isArray(meta.topics) && meta.topics.length)
        confirmation += ` — ${(meta.topics as string[]).join(", ")}`;
      if (Array.isArray(meta.people) && meta.people.length)
        confirmation += ` | People: ${(meta.people as string[]).join(", ")}`;
      if (Array.isArray(meta.action_items) && meta.action_items.length)
        confirmation += ` | Actions: ${(meta.action_items as string[]).join("; ")}`;

      return {
        content: [{ type: "text" as const, text: confirmation }],
      };
    } catch (err: unknown) {
      return {
        content: [{ type: "text" as const, text: `Error: ${err instanceof Error && err.message==='Writes temporarily disabled' ? err.message : 'Operation failed'}` }],
        isError: true,
      };
    }
  }
);

return server;
}
