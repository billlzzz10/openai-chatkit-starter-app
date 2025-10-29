import { z } from 'zod';

export const ChunkSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string(),
  chunkHash: z.string().min(40),
  text: z.string(),
  tokenCount: z.number().int().nonnegative(),
  position: z.number().int().nonnegative(),
  createdAt: z.date()
});