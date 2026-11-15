'use strict';

/**
 * Validates incoming HTTP requests against a Zod schema.
 * Supports validating body, query, and params.
 */
function validateRequest({ body: bodySchema, query: querySchema, params: paramsSchema }) {
  return (req, res, next) => {
    try {
      if (bodySchema) {
        req.body = bodySchema.parse(req.body);
      }
      if (querySchema) {
        req.query = querySchema.parse(req.query);
      }
      if (paramsSchema) {
        req.params = paramsSchema.parse(req.params);
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
        });
      }
      next(err);
    }
  };
}

module.exports = {
  validateRequest,
};

