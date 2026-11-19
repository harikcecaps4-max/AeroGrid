'use strict';

const { z } = require('zod');

/**
 * Strict positive integer identifier schema supporting numeric JSON integers
 * and positive base-10 integer strings (e.g. 1 or "1").
 */
const positiveIntIdSchema = z.union([
  z.number().int('ID must be an integer').positive('ID must be a positive integer'),
  z
    .string()
    .trim()
    .regex(/^[1-9]\d*$/, 'ID must be a positive integer')
    .transform(Number),
]);

const evaluateRequestSchema = z.object({
  aircraftId: positiveIntIdSchema,
  airstripId: positiveIntIdSchema,
});

const rankFiltersSchema = z.object({
  state: z.string().trim().min(1).optional(),
  surface: z
    .enum(['asphalt', 'concrete', 'gravel', 'grass', 'laterite', 'unpaved', 'turf', 'dirt', 'earth'])
    .optional(),
  ownership: z.enum(['private', 'municipal', 'state', 'central', 'defence', 'psu']).optional(),
  minRunwayLengthM: z.number().positive().max(6000).optional(),
  includeNotViable: z.boolean().optional(),
  onlyViable: z.boolean().optional(),
});

const rankRequestSchema = z.object({
  aircraftId: positiveIntIdSchema,
  filters: rankFiltersSchema.optional().default({}),
});

const compareRequestSchema = z.object({
  aircraftId: positiveIntIdSchema,
  airstripIds: z
    .array(positiveIntIdSchema)
    .min(2, 'At least 2 airstripIds are required for comparison')
    .max(3, 'At most 3 airstripIds can be compared at once')
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'airstripIds must be unique',
    }),
});

module.exports = {
  positiveIntIdSchema,
  evaluateRequestSchema,
  rankFiltersSchema,
  rankRequestSchema,
  compareRequestSchema,
};
