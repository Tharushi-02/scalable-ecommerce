import { z } from 'zod';

// Usage: validate({ body: schemaA, params: schemaB, query: schemaC })
// Any of the three can be left out.
export const validate = (schemas) => (req, res, next) => {
  const shape = {};
  for (const key of ['body', 'params', 'query']) {
    if (schemas[key]) shape[key] = schemas[key];
  }

  req.validated = z.object(shape).parse({
    body: req.body ?? {},
    params: req.params,
    query: req.query,
  });

  next();
};