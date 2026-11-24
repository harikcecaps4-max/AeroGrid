'use strict';

const { CAVEAT_TEXT } = require('../decision/config');

/**
 * Validates incoming HTTP requests against a Zod schema.
 * Supports validating body, query, and params.
 * In Express 5.x, req.query is a getter and cannot be reassigned; parsed query
 * values are stored on req.validatedQuery.
 */
function validateRequest({ body: bodySchema, query: querySchema, params: paramsSchema }) {
  return (req, res, next) => {
    try {
      if (bodySchema) {
        req.body = bodySchema.parse(req.body);
      }
      if (querySchema) {
        req.validatedQuery = querySchema.parse(req.query);
      }
      if (paramsSchema) {
        req.validatedParams = paramsSchema.parse(req.params);
        req.params = req.validatedParams;
      }
      next();
    } catch (err) {
      const zodIssues = Array.isArray(err?.issues)
        ? err.issues
        : Array.isArray(err?.errors)
          ? err.errors
          : null;
      if (zodIssues) {
        const issues = zodIssues.map((e) => ({
          path: Array.isArray(e.path) ? e.path.join('.') : '',
          message: e.message,
        }));
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data provided.',
          issues,
          caveat: CAVEAT_TEXT,
        });
      }
      next(err);
    }
  };
}

module.exports = {
  validateRequest,
};

