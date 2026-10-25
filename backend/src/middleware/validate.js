// Usage: router.get('/', validate({ query: searchQuerySchema }), controller)
// Parsed (coerced, whitelisted) values replace the originals, so controllers never see raw input.
export const validate = (schemas) => (req, res, next) => {
  try {
    for (const key of ['params', 'query', 'body']) {
      if (schemas[key]) req[key] = schemas[key].parse(req[key]);
    }
    next();
  } catch (err) {
    next(err);
  }
};
